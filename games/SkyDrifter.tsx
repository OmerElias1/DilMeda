import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  Animated as RNAnimated, Easing,
} from 'react-native';
import { Zap, ChevronRight, Wind } from 'lucide-react-native';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTournament } from '@/hooks/useTournament';

const { width: SW } = Dimensions.get('window');
const GAME_W = Math.min(SW - 32, 380);
const GAME_H = 480;

// Bird
const BIRD_W = 38;
const BIRD_H = 30;
const BIRD_X = GAME_W * 0.22;

// Pipes
const PIPE_W = 52;
const GAP = 140;
const PIPE_SPEED_INIT = 2.8;  // px per frame
const PIPE_INTERVAL = 90;     // frames between pipes

// Physics
const GRAVITY = 0.38;
const FLAP_VEL = -7.2;
const MAX_FALL = 10;

// Scoring
const PIPES_PER_POINT = 1;

type Pipe = {
  id: number;
  x: number;
  topH: number;
  scored: boolean;
};

type Props = { onClose: () => void; onPlayAgain?: () => void };

// ── Realistic Bird drawn with Views ──────────────────────────────────────────
function RealisticBird({ wingAnim }: { wingAnim: RNAnimated.Value }) {
  const wingRot = wingAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-35deg'] });
  return (
    <View style={{ width: 38, height: 30, position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
      {/* Body */}
      <View style={{ width: 28, height: 24, borderRadius: 12, backgroundColor: '#E8A020', position: 'relative', overflow: 'hidden' }}>
        {/* Eye */}
        <View style={{ position: 'absolute', top: 5, left: 16, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#000' }} />
        </View>
        {/* Beak */}
        <View style={{
          position: 'absolute', top: 7, left: 24,
          width: 0, height: 0,
          borderTopWidth: 5, borderTopColor: 'transparent',
          borderBottomWidth: 5, borderBottomColor: 'transparent',
          borderLeftWidth: 8, borderLeftColor: '#FF9900',
        }} />
      </View>
      {/* Wing */}
      <RNAnimated.View style={{
        position: 'absolute', top: 6, left: 4,
        width: 16, height: 10, borderRadius: 5,
        backgroundColor: '#C07010',
        transform: [{ rotate: wingRot }],
      }} />
    </View>
  );
}

export default function SkyDrifter({ onClose, onPlayAgain }: Props) {
  const { endGameSession } = useAuth();
  const { isExpired } = useTournament();

  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [flashRed, setFlashRed] = useState(false);
  const [pipeHeights, setPipeHeights] = useState<number[]>([180, 220]);

  // Refs
  const birdYRef = useRef(GAME_H / 2);
  const birdVRef = useRef(0);
  const scoreRef = useRef(0);
  const bestRef = useRef(0);
  const tickRef = useRef(0);
  const loopRef = useRef<number | null>(null);
  const gameActiveRef = useRef(false);
  const pipeSpeed = useRef(PIPE_SPEED_INIT);
  const pipeHeightsRef = useRef<number[]>([180, 220]);

  // Static pool of 2 pipes using Animated.Value
  const pipesPool = useRef([
    { id: 0, xAnim: new RNAnimated.Value(GAME_W + 50), xVal: GAME_W + 50, scored: false },
    { id: 1, xAnim: new RNAnimated.Value(GAME_W + 50 + 260), xVal: GAME_W + 50 + 260, scored: false },
  ]).current;

  // Animated values
  const birdYAnim = useRef(new RNAnimated.Value(GAME_H / 2)).current;
  const birdRotAnim = useRef(new RNAnimated.Value(0)).current;
  const bgScrollAnim = useRef(new RNAnimated.Value(0)).current;
  const titleGlow = useRef(new RNAnimated.Value(0)).current;
  const resultScale = useRef(new RNAnimated.Value(0)).current;
  const wingAnim = useRef(new RNAnimated.Value(0)).current;

  // Title glow loop - only on ready screen
  useEffect(() => {
    if (phase !== 'ready') return;
    const anim = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(titleGlow, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        RNAnimated.timing(titleGlow, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [phase]);

  // Wing flap + background scroll while playing
  useEffect(() => {
    if (phase === 'playing') {
      RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(wingAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
          RNAnimated.timing(wingAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
        ])
      ).start();

      // Slower background scroll (less frequent redraws)
      RNAnimated.loop(
        RNAnimated.timing(bgScrollAnim, { toValue: -GAME_W, duration: 10000, easing: Easing.linear, useNativeDriver: true })
      ).start();
    } else {
      wingAnim.stopAnimation();
      bgScrollAnim.stopAnimation();
    }
  }, [phase]);

  // Result card pop-in
  useEffect(() => {
    if (phase === 'done') {
      RNAnimated.spring(resultScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }).start();
    } else {
      resultScale.setValue(0);
    }
  }, [phase]);

  const flap = useCallback(() => {
    if (!gameActiveRef.current) return;
    birdVRef.current = FLAP_VEL;
    // Tilt up briefly
    RNAnimated.sequence([
      RNAnimated.timing(birdRotAnim, { toValue: -1, duration: 80, useNativeDriver: true }),
    ]).start();
  }, []);

  const endGame = useCallback(() => {
    gameActiveRef.current = false;
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    loopRef.current = null;

    const finalScore = scoreRef.current;
    if (finalScore > bestRef.current) {
      bestRef.current = finalScore;
      setBestScore(finalScore);
    }

    setFlashRed(true);
    setTimeout(() => setFlashRed(false), 300);
    setPhase('done');

    endGameSession(finalScore);
  }, [endGameSession]);

  const frameSkipSD = useRef(0);
  const gameLoop = useCallback(() => {
    if (!gameActiveRef.current) return;

    // Throttle to ~30fps
    frameSkipSD.current = (frameSkipSD.current + 1) % 2;
    if (frameSkipSD.current !== 0) {
      loopRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    tickRef.current++;

    // Physics
    birdVRef.current = Math.min(birdVRef.current + GRAVITY, MAX_FALL);
    birdYRef.current += birdVRef.current;
    birdYAnim.setValue(birdYRef.current);

    // Bird rotation
    const rot = Math.max(-0.5, Math.min(1, birdVRef.current / 10));
    birdRotAnim.setValue(rot);

    // Ceiling / floor collision
    if (birdYRef.current <= 0 || birdYRef.current + BIRD_H >= GAME_H) {
      endGame(); return;
    }

    let hit = false;
    let scored = false;

    pipesPool.forEach((p, idx) => {
      p.xVal -= pipeSpeed.current;
      p.xAnim.setValue(p.xVal);

      const birdRight = BIRD_X + BIRD_W;
      const birdTop = birdYRef.current;
      const birdBottom = birdYRef.current + BIRD_H;
      const topH = pipeHeightsRef.current[idx];

      if (
        birdRight > p.xVal + 6 && BIRD_X < p.xVal + PIPE_W - 6 &&
        (birdTop < topH || birdBottom > topH + GAP)
      ) {
        hit = true;
      }

      if (p.xVal + PIPE_W < -10) {
        const otherIdx = (idx + 1) % 2;
        p.xVal = Math.max(GAME_W, pipesPool[otherIdx].xVal + 260);
        p.xAnim.setValue(p.xVal);
        p.scored = false;

        const minTop = 60;
        const maxTop = GAME_H - GAP - 60;
        const newTopH = Math.floor(Math.random() * (maxTop - minTop) + minTop);
        pipeHeightsRef.current[idx] = newTopH;
        setPipeHeights([...pipeHeightsRef.current]);
      }

      if (!p.scored && p.xVal + PIPE_W < BIRD_X) {
        scoreRef.current += PIPES_PER_POINT;
        pipeSpeed.current = PIPE_SPEED_INIT + scoreRef.current * 0.08;
        p.scored = true;
        scored = true;
      }
    });

    if (hit) { endGame(); return; }
    if (scored) setScore(scoreRef.current);

    loopRef.current = requestAnimationFrame(gameLoop);
  }, [endGame]);

  const startGame = () => {
    gameActiveRef.current = true;
    birdYRef.current = GAME_H / 2;
    birdVRef.current = 0;
    birdYAnim.setValue(GAME_H / 2);
    birdRotAnim.setValue(0);

    const minTop = 60;
    const maxTop = GAME_H - GAP - 60;
    const h0 = Math.floor(Math.random() * (maxTop - minTop) + minTop);
    const h1 = Math.floor(Math.random() * (maxTop - minTop) + minTop);
    pipeHeightsRef.current = [h0, h1];
    setPipeHeights([h0, h1]);

    pipesPool[0].xVal = GAME_W + 50;
    pipesPool[0].xAnim.setValue(pipesPool[0].xVal);
    pipesPool[0].scored = false;

    pipesPool[1].xVal = GAME_W + 50 + 260;
    pipesPool[1].xAnim.setValue(pipesPool[1].xVal);
    pipesPool[1].scored = false;

    scoreRef.current = 0;
    setScore(0);
    tickRef.current = 0;
    pipeSpeed.current = PIPE_SPEED_INIT;
    setFlashRed(false);
    setPhase('playing');
    loopRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    return () => {
      gameActiveRef.current = false;
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
    };
  }, []);

  const birdRotDeg = birdRotAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-30deg', '45deg'] });
  const titleOpacity = titleGlow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  // ── EXPIRED ──
  if (isExpired) {
    return (
      <View style={s.container}>
        <Text style={s.expiredText}>Tournament ended!</Text>
        <TouchableOpacity style={s.btnOutline} onPress={onClose}>
          <Text style={s.btnOutlineText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── READY ──
  if (phase === 'ready') {
    return (
      <View style={s.container}>
        <RNAnimated.View style={{ opacity: titleOpacity }}>
          <View style={s.titleRow}>
            <Wind color="#00BFFF" size={26} />
            <Text style={s.gameTitle}>SKY DRIFTER</Text>
            <Wind color="#00BFFF" size={26} />
          </View>
        </RNAnimated.View>

        {/* Demo bird */}
        <View style={s.demoBird}>
          <RealisticBird wingAnim={wingAnim} />
        </View>

        <View style={s.infoCard}>
          <Text style={s.infoHeading}>How to Play</Text>
          <Text style={s.infoText}>
            <Text style={{ color: '#00BFFF', fontWeight: '800' }}>Tap anywhere</Text> to flap your wings
          </Text>
          <Text style={s.infoText}>Fly through the <Text style={{ color: colors.neon, fontWeight: '800' }}>glowing pipes</Text></Text>
          <Text style={s.infoText}>Don't hit the pipes or walls!</Text>
          <Text style={[s.infoText, { color: colors.gold, marginTop: 8 }]}>⚡ Speed increases with score!</Text>
        </View>



        <TouchableOpacity style={s.startBtn} onPress={startGame} activeOpacity={0.8}>
          <Text style={s.startBtnText}>START FLYING</Text>
          <ChevronRight color={colors.bgDeep} size={20} />
        </TouchableOpacity>

        <TouchableOpacity style={s.btnOutline} onPress={onClose}>
          <Text style={s.btnOutlineText}>Exit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── DONE ──
  if (phase === 'done') {
    const isNewBest = score >= bestScore && score > 0;
    return (
      <View style={s.container}>
        <RNAnimated.View style={[s.resultCard, { transform: [{ scale: resultScale }] }]}>
          <View style={s.trophyRing}>
            <Text style={{ fontSize: 38 }}>🪦</Text>
          </View>
          <Text style={s.resultTitle}>CRASHED!</Text>
          <Text style={s.resultScore}>{score}</Text>
          <Text style={s.resultLabel}>PIPES CLEARED</Text>
          {isNewBest && (
            <View style={s.newBestBadge}>
              <Zap color={colors.gold} size={12} fill={colors.gold} />
              <Text style={s.newBestText}>NEW BEST!</Text>
            </View>
          )}
          <View style={s.resultStats}>
            <View style={s.statItem}>
              <Text style={s.statNum}>{bestScore}</Text>
              <Text style={s.statLabel}>BEST</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statNum}>{(PIPE_SPEED_INIT + score * 0.08).toFixed(1)}x</Text>
              <Text style={s.statLabel}>SPEED</Text>
            </View>
          </View>
        </RNAnimated.View>

        <TouchableOpacity style={s.startBtn} onPress={onPlayAgain || startGame} activeOpacity={0.8}>
          <Text style={s.startBtnText}>FLY AGAIN</Text>
          <ChevronRight color={colors.bgDeep} size={20} />
        </TouchableOpacity>
        <TouchableOpacity style={s.btnOutline} onPress={onClose}>
          <Text style={s.btnOutlineText}>Exit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── PLAYING ──
  return (
    <View style={s.container}>
      {/* HUD */}
      <View style={s.hud}>
        <View style={s.hudLeft}>
          <Text style={s.hudScore}>{score}</Text>
          <Text style={s.hudScoreLabel}>PIPES</Text>
        </View>
        <View style={s.speedBadge}>
          <Zap color="#00BFFF" size={11} fill="#00BFFF" />
          <Text style={s.speedText}>{pipeSpeed.current.toFixed(1)}x SPEED</Text>
        </View>
      </View>

      {/* Game Canvas */}
      <TouchableOpacity
        style={[s.gameArea, flashRed && s.gameAreaFlash]}
        onPress={flap}
        activeOpacity={1}
      >
        {/* Scrolling sky background */}
        <RNAnimated.View style={[s.bgLayer, { transform: [{ translateX: bgScrollAnim }] }]} />

        {/* Ground line */}
        <View style={s.groundLine} />

        {/* Pipes */}
        {pipesPool.map((p, idx) => (
          <RNAnimated.View
            key={p.id}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: PIPE_W,
              height: GAME_H,
              transform: [{ translateX: p.xAnim }],
            }}
          >
            {/* Top pipe */}
            <View style={[s.pipe, { left: 0, top: 0, height: pipeHeights[idx] }]}>
              <View style={s.pipeCap} />
            </View>
            {/* Bottom pipe */}
            <View style={[s.pipe, { left: 0, top: pipeHeights[idx] + GAP, bottom: 0, height: GAME_H - pipeHeights[idx] - GAP }]}>
              <View style={s.pipeCapBottom} />
            </View>
          </RNAnimated.View>
        ))}

        {/* Bird */}
        <RNAnimated.View
          style={[s.birdWrap, {
            transform: [
              { translateY: birdYAnim },
              { rotate: birdRotDeg },
            ],
            left: BIRD_X,
          }]}
        >
          <RealisticBird wingAnim={wingAnim} />
        </RNAnimated.View>

        {/* Tap hint (first 2 seconds approximation) */}
        {tickRef.current < 80 && (
          <View style={s.tapHint}>
            <Text style={s.tapHintText}>TAP TO FLAP!</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const PIPE_COLOR = '#00A86B';
const PIPE_DARK = '#006B44';
const PIPE_GLOW = 'rgba(0,255,150,0.12)';

const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.bg,
    alignItems: 'center', justifyContent: 'center',
    gap: 14, padding: spacing.md,
  },
  expiredText: { color: colors.error, fontSize: 16, textAlign: 'center', fontWeight: '600' },

  // Ready screen
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gameTitle: {
    color: '#00BFFF', fontSize: 30, fontWeight: '900', letterSpacing: 4,
  },
  demoBird: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(0,191,255,0.1)',
    borderWidth: 2, borderColor: 'rgba(0,191,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  infoCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: 18,
    borderWidth: 1, borderColor: colors.border,
    width: Math.min(SW - 64, 340), alignItems: 'center', gap: 5,
  },
  infoHeading: { color: colors.textPrimary, fontSize: 15, fontWeight: '800', marginBottom: 4 },
  infoText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },

  bestBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,215,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)',
    borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 5,
  },
  bestText: { color: colors.gold, fontSize: 12, fontWeight: '900', letterSpacing: 1 },

  startBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#00BFFF', paddingVertical: 14, paddingHorizontal: 32,
    borderRadius: radius.full,
  },
  startBtnText: { color: colors.bgDeep, fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  btnOutline: {
    borderWidth: 1.5, borderColor: colors.border, paddingVertical: 10,
    paddingHorizontal: spacing.xl, borderRadius: radius.full,
  },
  btnOutlineText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },

  // HUD
  hud: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: GAME_W, marginBottom: 4,
  },
  hudLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  hudScore: { color: '#00BFFF', fontSize: 26, fontWeight: '900' },
  hudScoreLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  hudRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bestHud: { color: colors.gold, fontSize: 13, fontWeight: '800' },
  speedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,191,255,0.1)', borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(0,191,255,0.25)',
  },
  speedText: { color: '#00BFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  // Game area
  gameArea: {
    width: GAME_W, height: GAME_H,
    backgroundColor: '#050B1A',
    borderRadius: radius.lg, borderWidth: 2, borderColor: '#1A3A5C',
    overflow: 'hidden', position: 'relative',
  },
  gameAreaFlash: { borderColor: colors.error, backgroundColor: 'rgba(255,68,68,0.07)' },

  // Background
  bgLayer: {
    position: 'absolute', top: 0, left: 0,
    width: GAME_W * 2, height: GAME_H,
  },
  star: {
    position: 'absolute', backgroundColor: '#FFFFFF', borderRadius: 2,
  },
  cloud: {
    position: 'absolute', width: 120, height: 40, borderRadius: 20,
    backgroundColor: '#AADEFF',
  },
  groundLine: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 3, backgroundColor: '#00A86B', opacity: 0.4,
  },

  // Pipes
  pipe: {
    position: 'absolute',
    width: PIPE_W,
    backgroundColor: PIPE_DARK,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: PIPE_COLOR,
  },
  pipeCap: {
    position: 'absolute', bottom: 0, left: -5, right: -5, height: 18,
    backgroundColor: PIPE_COLOR, borderRadius: 4,
  },
  pipeCapBottom: {
    position: 'absolute', top: 0, left: -5, right: -5, height: 18,
    backgroundColor: PIPE_COLOR, borderRadius: 4,
  },

  // Bird
  birdWrap: {
    position: 'absolute',
    top: 0,
    width: BIRD_W + 16,
    height: BIRD_H + 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tap hint
  tapHint: {
    position: 'absolute', bottom: 20, alignSelf: 'center',
    backgroundColor: 'rgba(0,191,255,0.15)',
    borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(0,191,255,0.3)',
  },
  tapHintText: { color: '#00BFFF', fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  // Result
  resultCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: 26,
    alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border,
    width: Math.min(SW - 64, 340), ...shadow.card,
  },
  trophyRing: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(0,191,255,0.08)',
    borderWidth: 2, borderColor: '#00BFFF',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  resultTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: 3 },
  resultScore: { color: '#00BFFF', fontSize: 52, fontWeight: '900' },
  resultLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  newBestBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,215,0,0.15)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.4)',
    borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 4,
  },
  newBestText: { color: colors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  resultStats: {
    flexDirection: 'row', alignItems: 'center', gap: 20,
    marginTop: 4, backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 24,
    borderWidth: 1, borderColor: '#1A3A5C',
  },
  statItem: { alignItems: 'center', gap: 2 },
  statNum: { color: colors.textPrimary, fontSize: 18, fontWeight: '900' },
  statLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  statDivider: { width: 1, height: 30, backgroundColor: colors.border },
});

// ── Bird part styles ──────────────────────────────────────────────────────────
const bird = StyleSheet.create({
  root: {
    width: 54,
    height: 42,
    position: 'relative',
  },

  // ── Body ──
  body: {
    position: 'absolute',
    width: 30, height: 20,
    backgroundColor: '#E8A020',         // warm amber-orange
    borderRadius: 14,
    top: 11, left: 10,
    overflow: 'hidden',
  },
  // Lighter chest area
  chest: {
    position: 'absolute',
    width: 14, height: 14,
    backgroundColor: '#FFCD55',
    borderRadius: 8,
    top: 4, left: 2,
  },
  // Dark wing-shadow stripe across the back
  bodyStripe: {
    position: 'absolute',
    width: 30, height: 5,
    backgroundColor: 'rgba(100,50,0,0.25)',
    top: 6, left: 0,
  },

  // ── Upper wing (animates up on flap) ──
  wingUpper: {
    position: 'absolute',
    width: 28, height: 13,
    backgroundColor: '#C07010',         // darker brown-gold
    borderRadius: 10,
    top: 9, left: 12,
    transformOrigin: 'left center',
  },
  wingUpperInner: {
    position: 'absolute',
    width: 20, height: 8,
    backgroundColor: '#D08820',
    borderRadius: 6,
    top: 3, left: 3,
  },
  wingTip: {
    position: 'absolute',
    width: 8, height: 4,
    backgroundColor: '#5C3000',
    borderRadius: 4,
    top: 5, right: 1,
  },

  // ── Lower wing flap ──
  wingLower: {
    position: 'absolute',
    width: 22, height: 8,
    backgroundColor: '#B06008',
    borderRadius: 8,
    top: 22, left: 14,
    transformOrigin: 'left top',
  },

  // ── Tail feathers ──
  tail: {
    position: 'absolute',
    right: 1, top: 14,
    flexDirection: 'row',
    gap: 1,
  },
  feather: {
    width: 5, height: 14,
    backgroundColor: '#7A4200',
    borderRadius: 3,
  },

  // ── Head ──
  head: {
    position: 'absolute',
    width: 20, height: 19,
    backgroundColor: '#E8A020',
    borderRadius: 12,
    top: 5, left: 2,
    overflow: 'visible',
  },

  // Crown spike
  crown: {
    position: 'absolute',
    width: 5, height: 9,
    backgroundColor: '#C07010',
    borderRadius: 3,
    top: -6, left: 7,
    transform: [{ rotate: '8deg' }],
  },

  // ── Eye ──
  eyeWhite: {
    position: 'absolute',
    width: 10, height: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    top: 3, left: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    overflow: 'visible',
  },
  pupil: {
    position: 'absolute',
    width: 6, height: 6,
    backgroundColor: '#1A0A00',
    borderRadius: 4,
    top: 2, left: 2,
  },
  eyeShine: {
    position: 'absolute',
    width: 3, height: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    top: 1, left: 1,
  },

  // ── Beak ──
  beakUpper: {
    position: 'absolute',
    width: 11, height: 5,
    backgroundColor: '#FF9900',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
    top: 6, left: -9,
  },
  beakLower: {
    position: 'absolute',
    width: 9, height: 4,
    backgroundColor: '#E07800',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    top: 10, left: -8,
  },
});

