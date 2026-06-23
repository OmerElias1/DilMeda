import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  Animated as RNAnimated, Easing,
} from 'react-native';
import { Zap, ChevronRight, Wind, Skull } from 'lucide-react-native';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTournament } from '@/hooks/useTournament';

const { width: SW } = Dimensions.get('window');
const GAME_W = Math.min(SW - 32, 380);
const GAME_H = 480;

const BIRD_W = 38;
const BIRD_H = 30;
const BIRD_X = GAME_W * 0.22;

const PIPE_W = 52;
const GAP = 145;
const PIPE_SPEED_INIT = 2.6;
const PIPE_SEP = 270;

const GRAVITY = 0.38;
const FLAP_VEL = -7.2;
const MAX_FALL = 10;

type Props = { onClose: () => void; onPlayAgain?: () => void };

function Bird({ wingAnim }: { wingAnim: RNAnimated.Value }) {
  const wingRot = wingAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-35deg'] });
  return (
    <View style={{ width: 38, height: 30, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 28, height: 24, borderRadius: 12, backgroundColor: '#E8A020', overflow: 'hidden' }}>
        <View style={{ position: 'absolute', top: 5, left: 16, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#000' }} />
        </View>
        <View style={{ position: 'absolute', top: 7, left: 24, width: 0, height: 0, borderTopWidth: 5, borderTopColor: 'transparent', borderBottomWidth: 5, borderBottomColor: 'transparent', borderLeftWidth: 8, borderLeftColor: '#FF9900' }} />
      </View>
      <RNAnimated.View style={{ position: 'absolute', top: 6, left: 4, width: 16, height: 10, borderRadius: 5, backgroundColor: '#C07010', transform: [{ rotate: wingRot }] }} />
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

  // Game refs — no setState during the loop
  const birdYRef = useRef(GAME_H / 2);
  const birdVRef = useRef(0);
  const scoreRef = useRef(0);
  const bestRef = useRef(0);
  const loopRef = useRef<number | null>(null);
  const gameActiveRef = useRef(false);
  const pipeSpeedRef = useRef(PIPE_SPEED_INIT);

  // Each pipe: x position and top-pipe height as Animated.Values
  const pipes = useRef([
    {
      id: 0,
      xAnim: new RNAnimated.Value(GAME_W + 50),
      topHAnim: new RNAnimated.Value(180),
      xVal: GAME_W + 50,
      topH: 180,
      scored: false,
    },
    {
      id: 1,
      xAnim: new RNAnimated.Value(GAME_W + 50 + PIPE_SEP),
      topHAnim: new RNAnimated.Value(220),
      xVal: GAME_W + 50 + PIPE_SEP,
      topH: 220,
      scored: false,
    },
  ]).current;

  const birdYAnim = useRef(new RNAnimated.Value(GAME_H / 2)).current;
  const birdRotAnim = useRef(new RNAnimated.Value(0)).current;
  const titleGlow = useRef(new RNAnimated.Value(0)).current;
  const resultScale = useRef(new RNAnimated.Value(0)).current;
  const wingAnim = useRef(new RNAnimated.Value(0)).current;
  const wingLoopRef = useRef<RNAnimated.CompositeAnimation | null>(null);

  const birdRotDeg = birdRotAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-30deg', '45deg'] });
  const titleOpacity = titleGlow.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  // Title glow — ready screen only
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

  // Wing flap — only while playing
  useEffect(() => {
    if (phase === 'playing') {
      wingLoopRef.current = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(wingAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
          RNAnimated.timing(wingAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
        ])
      );
      wingLoopRef.current.start();
    } else {
      wingLoopRef.current?.stop();
      wingLoopRef.current = null;
    }
  }, [phase]);

  // Result pop-in
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
    RNAnimated.timing(birdRotAnim, { toValue: -1, duration: 80, useNativeDriver: true }).start();
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

  const randTopH = () => {
    const min = 60, max = GAME_H - GAP - 60;
    return Math.floor(Math.random() * (max - min) + min);
  };

  // ── Game loop — zero setState calls here ──────────────────────────────────
  const gameLoop = useCallback(() => {
    if (!gameActiveRef.current) return;

    // Physics
    birdVRef.current = Math.min(birdVRef.current + GRAVITY, MAX_FALL);
    birdYRef.current += birdVRef.current;
    birdYAnim.setValue(birdYRef.current);

    // Rotation
    birdRotAnim.setValue(Math.max(-0.5, Math.min(1, birdVRef.current / 10)));

    // Boundary collision
    if (birdYRef.current <= 0 || birdYRef.current + BIRD_H >= GAME_H) {
      endGame(); return;
    }

    let hit = false;
    let scoredThisFrame = false;

    for (const p of pipes) {
      p.xVal -= pipeSpeedRef.current;
      p.xAnim.setValue(p.xVal);

      // Collision check
      const birdRight = BIRD_X + BIRD_W;
      const birdTop = birdYRef.current;
      const birdBottom = birdYRef.current + BIRD_H;

      if (
        birdRight > p.xVal + 6 &&
        BIRD_X < p.xVal + PIPE_W - 6 &&
        (birdTop < p.topH || birdBottom > p.topH + GAP)
      ) {
        hit = true;
        break;
      }

      // Recycle pipe — update Animated.Value directly, no setState
      if (p.xVal + PIPE_W < -10) {
        const other = pipes.find(o => o.id !== p.id)!;
        p.xVal = Math.max(GAME_W, other.xVal + PIPE_SEP);
        p.xAnim.setValue(p.xVal);
        p.scored = false;
        p.topH = randTopH();
        p.topHAnim.setValue(p.topH); // ← drives pipe height via Animated.Value, no re-render
      }

      // Score
      if (!p.scored && p.xVal + PIPE_W < BIRD_X) {
        scoreRef.current += 1;
        pipeSpeedRef.current = PIPE_SPEED_INIT + scoreRef.current * 0.08;
        p.scored = true;
        scoredThisFrame = true;
      }
    }

    if (hit) { endGame(); return; }
    // Only re-render score display when it changes
    if (scoredThisFrame) setScore(scoreRef.current);

    loopRef.current = requestAnimationFrame(gameLoop);
  }, [endGame]);

  const startGame = () => {
    gameActiveRef.current = true;
    birdYRef.current = GAME_H / 2;
    birdVRef.current = 0;
    birdYAnim.setValue(GAME_H / 2);
    birdRotAnim.setValue(0);

    const h0 = randTopH(), h1 = randTopH();
    pipes[0].xVal = GAME_W + 50;
    pipes[0].xAnim.setValue(pipes[0].xVal);
    pipes[0].topH = h0;
    pipes[0].topHAnim.setValue(h0);
    pipes[0].scored = false;

    pipes[1].xVal = GAME_W + 50 + PIPE_SEP;
    pipes[1].xAnim.setValue(pipes[1].xVal);
    pipes[1].topH = h1;
    pipes[1].topHAnim.setValue(h1);
    pipes[1].scored = false;

    scoreRef.current = 0;
    setScore(0);
    pipeSpeedRef.current = PIPE_SPEED_INIT;
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

  // ── Expired ───────────────────────────────────────────────────────────────
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

  // ── Ready ─────────────────────────────────────────────────────────────────
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

        <View style={s.demoBird}>
          <Bird wingAnim={wingAnim} />
        </View>

        <View style={s.infoCard}>
          <Text style={s.infoHeading}>How to Play</Text>
          <Text style={s.infoText}><Text style={{ color: '#00BFFF', fontWeight: '800' }}>Tap anywhere</Text> to flap your wings</Text>
          <Text style={s.infoText}>Fly through the <Text style={{ color: colors.neon, fontWeight: '800' }}>glowing pipes</Text></Text>
          <Text style={s.infoText}>Don't hit the pipes or walls!</Text>
          <Text style={[s.infoText, { color: colors.gold, marginTop: 8 }]}>Speed increases with score!</Text>
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

  // ── Done ──────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const isNewBest = score >= bestScore && score > 0;
    return (
      <View style={s.container}>
        <RNAnimated.View style={[s.resultCard, { transform: [{ scale: resultScale }] }]}>
          <View style={s.trophyRing}>
            <Skull color="#00BFFF" size={36} />
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

  // ── Playing ───────────────────────────────────────────────────────────────
  return (
    <View style={s.container}>
      <View style={s.hud}>
        <View style={s.hudLeft}>
          <Text style={s.hudScore}>{score}</Text>
          <Text style={s.hudScoreLabel}>PIPES</Text>
        </View>
        <View style={s.speedBadge}>
          <Zap color="#00BFFF" size={11} fill="#00BFFF" />
          <Text style={s.speedText}>{pipeSpeedRef.current.toFixed(1)}x SPEED</Text>
        </View>
      </View>

      <TouchableOpacity style={[s.gameArea, flashRed && s.gameAreaFlash]} onPress={flap} activeOpacity={1}>
        {/* Ground */}
        <View style={s.groundLine} />

        {/* Pipes — top height driven by Animated.Value, no setState */}
        {pipes.map((p) => (
          <RNAnimated.View
            key={p.id}
            style={{ position: 'absolute', top: 0, left: 0, width: PIPE_W, height: GAME_H, transform: [{ translateX: p.xAnim }] }}
          >
            {/* Top pipe — height animated directly */}
            <RNAnimated.View style={[s.pipe, { top: 0, height: p.topHAnim }]}>
              <View style={s.pipeCap} />
            </RNAnimated.View>
            {/* Bottom pipe — positioned by: topH + GAP. We use a transform trick */}
            <RNAnimated.View style={[s.pipe, {
              top: RNAnimated.add(p.topHAnim, GAP) as any,
              bottom: 0,
              height: RNAnimated.add(
                RNAnimated.multiply(p.topHAnim, -1),
                GAME_H - GAP
              ) as any,
            }]}>
              <View style={s.pipeCapBottom} />
            </RNAnimated.View>
          </RNAnimated.View>
        ))}

        {/* Bird */}
        <RNAnimated.View style={[s.birdWrap, { transform: [{ translateY: birdYAnim }, { rotate: birdRotDeg }], left: BIRD_X }]}>
          <Bird wingAnim={wingAnim} />
        </RNAnimated.View>
      </TouchableOpacity>
    </View>
  );
}

const PIPE_COLOR = '#00A86B';
const PIPE_DARK  = '#006B44';

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 14, padding: spacing.md },
  expiredText: { color: colors.error, fontSize: 16, textAlign: 'center', fontWeight: '600' },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gameTitle: { color: '#00BFFF', fontSize: 30, fontWeight: '900', letterSpacing: 4 },
  demoBird: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(0,191,255,0.1)', borderWidth: 2, borderColor: 'rgba(0,191,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  infoCard: { backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: 18, borderWidth: 1, borderColor: colors.border, width: Math.min(SW - 64, 340), alignItems: 'center', gap: 5 },
  infoHeading: { color: colors.textPrimary, fontSize: 15, fontWeight: '800', marginBottom: 4 },
  infoText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },

  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#00BFFF', paddingVertical: 14, paddingHorizontal: 32, borderRadius: radius.full },
  startBtnText: { color: colors.bgDeep, fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  btnOutline: { borderWidth: 1.5, borderColor: colors.border, paddingVertical: 10, paddingHorizontal: spacing.xl, borderRadius: radius.full },
  btnOutlineText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },

  hud: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: GAME_W, marginBottom: 4 },
  hudLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  hudScore: { color: '#00BFFF', fontSize: 26, fontWeight: '900' },
  hudScoreLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  speedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,191,255,0.1)', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(0,191,255,0.25)' },
  speedText: { color: '#00BFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  gameArea: { width: GAME_W, height: GAME_H, backgroundColor: '#050B1A', borderRadius: radius.lg, borderWidth: 2, borderColor: '#1A3A5C', overflow: 'hidden', position: 'relative' },
  gameAreaFlash: { borderColor: colors.error, backgroundColor: 'rgba(255,68,68,0.07)' },
  groundLine: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: '#00A86B', opacity: 0.4 },

  pipe: { position: 'absolute', width: PIPE_W, backgroundColor: PIPE_DARK, borderLeftWidth: 3, borderRightWidth: 3, borderColor: PIPE_COLOR },
  pipeCap: { position: 'absolute', bottom: 0, left: -5, right: -5, height: 18, backgroundColor: PIPE_COLOR, borderRadius: 4 },
  pipeCapBottom: { position: 'absolute', top: 0, left: -5, right: -5, height: 18, backgroundColor: PIPE_COLOR, borderRadius: 4 },

  birdWrap: { position: 'absolute', top: 0, width: BIRD_W + 16, height: BIRD_H + 16, alignItems: 'center', justifyContent: 'center' },

  resultCard: { backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: 26, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, width: Math.min(SW - 64, 340), ...shadow.card },
  trophyRing: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0,191,255,0.08)', borderWidth: 2, borderColor: '#00BFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  resultTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: 3 },
  resultScore: { color: '#00BFFF', fontSize: 52, fontWeight: '900' },
  resultLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  newBestBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,215,0,0.15)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.4)', borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 4 },
  newBestText: { color: colors.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  resultStats: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 4, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 24, borderWidth: 1, borderColor: '#1A3A5C' },
  statItem: { alignItems: 'center', gap: 2 },
  statNum: { color: colors.textPrimary, fontSize: 18, fontWeight: '900' },
  statLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  statDivider: { width: 1, height: 30, backgroundColor: colors.border },
});
