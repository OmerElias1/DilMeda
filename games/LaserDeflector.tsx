import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated as A, Easing, PanResponder } from 'react-native';
import { Zap, ChevronRight, ShieldAlert } from 'lucide-react-native';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTournament } from '@/hooks/useTournament';

const { width: SW } = Dimensions.get('window');
const GW = Math.min(SW - 32, 380);
const GH = 480;

const PADDLE_W = 75;
const PADDLE_H = 12;
const BALL_SIZE = 14;
const POOL_SIZE = 6;

type Spark = { id: number; x: number; y: number; vx: number; vy: number; size: number; alpha: number };
type Props = { onClose: () => void; onPlayAgain?: () => void };

const COLORS = ['#FF0055', '#00FFCC', '#FFCC00', '#9900FF'];

// Pre-allocate static ball pool entry type
type BallSlot = {
  id: number;
  xAnim: A.Value;
  yAnim: A.Value;
  xVal: number;
  yVal: number;
  vx: number;
  vy: number;
  color: string;
  active: boolean;
};

// Create pool outside component so Animated.Values are stable
const BALL_POOL: BallSlot[] = Array.from({ length: POOL_SIZE }, (_, i) => ({
  id: i,
  xAnim: new A.Value(-BALL_SIZE * 2),
  yAnim: new A.Value(-BALL_SIZE * 2),
  xVal: -BALL_SIZE * 2,
  yVal: -BALL_SIZE * 2,
  vx: 0,
  vy: 0,
  color: COLORS[0],
  active: false,
}));

export default function LaserDeflector({ onClose, onPlayAgain }: Props) {
  const { endGameSession } = useAuth();
  const { isExpired } = useTournament();

  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [sparks, setSparks] = useState<Spark[]>([]);
  // Pool render state: only color per slot changes (active drives visibility via position)
  const [slotColors, setSlotColors] = useState<string[]>(Array(POOL_SIZE).fill(COLORS[0]));

  const sparksRef = useRef<Spark[]>([]);
  const paddleXRef = useRef((GW - PADDLE_W) / 2);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const activeRef = useRef(false);
  const loopRef = useRef<number | null>(null);
  const tickRef = useRef(0);
  const sparkId = useRef(0);
  const slotColorsRef = useRef(slotColors);
  useEffect(() => { slotColorsRef.current = slotColors; }, [slotColors]);

  const paddleXAnim = useRef(new A.Value((GW - PADDLE_W) / 2)).current;
  const glowAnim = useRef(new A.Value(0)).current;
  const resultScale = useRef(new A.Value(0)).current;

  // Title glow loop - only on ready screen
  useEffect(() => {
    if (phase !== 'ready') return;
    const anim = A.loop(A.sequence([
      A.timing(glowAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      A.timing(glowAnim, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [phase]);

  useEffect(() => {
    if (phase === 'done') {
      A.spring(resultScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }).start();
    } else {
      resultScale.setValue(0);
    }
  }, [phase]);

  const endGame = useCallback(() => {
    activeRef.current = false;
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    // Park all balls off-screen
    BALL_POOL.forEach(b => {
      b.active = false;
      b.xAnim.setValue(-BALL_SIZE * 2);
      b.yAnim.setValue(-BALL_SIZE * 2);
    });
    setPhase('done');
    endGameSession(scoreRef.current);
  }, [endGameSession]);

  const spawnSparks = (x: number, y: number) => {
    for (let i = 0; i < 8; i++) {
      sparksRef.current.push({
        id: sparkId.current++,
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: -(Math.random() * 4 + 2),
        size: Math.random() * 4 + 2,
        alpha: 1.0,
      });
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gs) => {
        if (!activeRef.current) return;
        let nx = gs.moveX - (SW - GW) / 2 - PADDLE_W / 2;
        nx = Math.max(0, Math.min(GW - PADDLE_W, nx));
        paddleXRef.current = nx;
        paddleXAnim.setValue(nx);
      },
    })
  ).current;

  const frameSkipLD = useRef(0);
  const gameLoop = useCallback(() => {
    if (!activeRef.current) return;

    // Throttle to ~30fps
    frameSkipLD.current = (frameSkipLD.current + 1) % 2;
    if (frameSkipLD.current !== 0) {
      loopRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    tickRef.current++;

    // 1. Spawn a ball into a free pool slot
    const spawnRate = Math.max(23, 60 - Math.floor(scoreRef.current / 8) * 5);
    const hasActive = BALL_POOL.some(b => b.active);
    if (tickRef.current % spawnRate === 0 || !hasActive) {
      const freeIdx = BALL_POOL.findIndex(b => !b.active);
      if (freeIdx !== -1) {
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];
        const slot = BALL_POOL[freeIdx];
        slot.xVal = Math.random() * (GW - BALL_SIZE * 2) + BALL_SIZE;
        slot.yVal = -10;
        slot.vx = (Math.random() - 0.5) * 4;
        slot.vy = Math.random() * 2 + 2.5 + (scoreRef.current * 0.1);
        slot.color = color;
        slot.active = true;
        slot.xAnim.setValue(slot.xVal);
        slot.yAnim.setValue(slot.yVal);
        if (slotColorsRef.current[freeIdx] !== color) {
          const next = [...slotColorsRef.current];
          next[freeIdx] = color;
          setSlotColors(next);
        }
      }
    }

    // 2. Physics & collisions
    const padX = paddleXRef.current;
    const padY = GH - 45;
    let livesChanged = false;
    let scoreChanged = false;

    BALL_POOL.forEach(b => {
      if (!b.active) return;

      b.xVal += b.vx;
      b.yVal += b.vy;

      if (b.xVal <= 0) { b.xVal = 0; b.vx = -b.vx; }
      else if (b.xVal + BALL_SIZE >= GW) { b.xVal = GW - BALL_SIZE; b.vx = -b.vx; }

      if (
        b.yVal + BALL_SIZE >= padY &&
        (b.yVal - b.vy) + BALL_SIZE <= padY + 6 &&
        b.xVal + BALL_SIZE >= padX &&
        b.xVal <= padX + PADDLE_W &&
        b.vy > 0
      ) {
        b.yVal = padY - BALL_SIZE;
        b.vy = -Math.abs(b.vy);
        const hitPoint = (b.xVal + BALL_SIZE / 2 - padX) / PADDLE_W;
        b.vx = (hitPoint - 0.5) * 8;
        scoreRef.current++;
        scoreChanged = true;
        // Sparks removed for performance
      }

      if (b.yVal < 0 && b.vy < 0) { b.vy = Math.abs(b.vy); }

      if (b.yVal > GH) {
        b.active = false;
        b.xAnim.setValue(-BALL_SIZE * 2);
        b.yAnim.setValue(-BALL_SIZE * 2);
        livesRef.current--;
        livesChanged = true;
        if (livesRef.current <= 0) { endGame(); return; }
      } else {
        b.xAnim.setValue(b.xVal);
        b.yAnim.setValue(b.yVal);
      }
    });

    if (livesChanged) setLives(livesRef.current);
    if (scoreChanged) setScore(scoreRef.current);

    loopRef.current = requestAnimationFrame(gameLoop);
  }, [endGame]);

  const startGame = () => {
    activeRef.current = true;
    scoreRef.current = 0;
    livesRef.current = 3;
    setScore(0);
    setLives(3);
    paddleXRef.current = (GW - PADDLE_W) / 2;
    paddleXAnim.setValue((GW - PADDLE_W) / 2);
    // Reset pool
    BALL_POOL.forEach(b => {
      b.active = false;
      b.xAnim.setValue(-BALL_SIZE * 2);
      b.yAnim.setValue(-BALL_SIZE * 2);
    });
    sparksRef.current = [];
    setSparks([]);
    tickRef.current = 0;
    setPhase('playing');
    loopRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
    };
  }, []);

  const titleOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

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

  if (phase === 'ready') {
    return (
      <View style={s.container}>
        <A.View style={{ opacity: titleOpacity }}>
          <View style={s.titleRow}>
            <ShieldAlert color="#FFCC00" size={26} />
            <Text style={s.gameTitle}>LASER DEFLECTOR</Text>
            <ShieldAlert color="#FFCC00" size={26} />
          </View>
        </A.View>

        <View style={s.infoCard}>
          <Text style={s.infoHeading}>How to Play</Text>
          <Text style={s.infoText}>Protect the bottom floor from incoming laser cores.</Text>
          <Text style={s.infoText}>
            <Text style={{ color: '#FFCC00', fontWeight: '800' }}>Slide your finger</Text> left/right to move the shield.
          </Text>
          <Text style={s.infoText}>Deflect the lasers to gain points.</Text>
          <Text style={[s.infoText, { color: colors.gold, marginTop: 8 }]}>⚡ You have 3 shields total!</Text>
        </View>

        <TouchableOpacity style={s.startBtn} onPress={startGame} activeOpacity={0.8}>
          <Text style={s.startBtnText}>START DEFENDING</Text>
          <ChevronRight color={colors.bgDeep} size={20} />
        </TouchableOpacity>

        <TouchableOpacity style={s.btnOutline} onPress={onClose}>
          <Text style={s.btnOutlineText}>Exit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'done') {
    return (
      <View style={s.container}>
        <A.View style={[s.resultCard, { transform: [{ scale: resultScale }] }]}>
          <View style={s.crashedRing}>
            <Text style={{ fontSize: 38 }}>🛡️💥</Text>
          </View>
          <Text style={s.resultTitle}>SHIELDS BROKEN!</Text>
          <Text style={s.resultScore}>{score}</Text>
          <Text style={s.resultLabel}>LASERS DEFLECTED</Text>
        </A.View>

        <TouchableOpacity style={s.startBtn} onPress={onPlayAgain || startGame} activeOpacity={0.8}>
          <Text style={s.startBtnText}>DEFEND AGAIN</Text>
          <ChevronRight color={colors.bgDeep} size={20} />
        </TouchableOpacity>
        <TouchableOpacity style={s.btnOutline} onPress={onClose}>
          <Text style={s.btnOutlineText}>Exit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* HUD */}
      <View style={s.hud}>
        <View style={s.hudLeft}>
          <Text style={s.hudScore}>{score}</Text>
          <Text style={s.hudScoreLabel}>DEFLECTIONS</Text>
        </View>
        <View style={s.healthRow}>
          {[...Array(3)].map((_, i) => (
            <View
              key={i}
              style={[
                s.healthBlock,
                { backgroundColor: i < lives ? '#FFCC00' : 'rgba(255,255,255,0.08)' },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Game area */}
      <View style={s.gameArea} {...panResponder.panHandlers}>
        {/* Pool balls — each driven by its own Animated.Value pair (native thread) */}
        {BALL_POOL.map((b, idx) => (
          <A.View
            key={b.id}
            style={[
              s.ball,
              {
                backgroundColor: slotColors[idx],
                shadowColor: slotColors[idx],
                transform: [{ translateX: b.xAnim }, { translateY: b.yAnim }],
              },
            ]}
          />
        ))}

        {/* Sparks removed for performance */}

        {/* Paddle */}
        <A.View
          style={[
            s.paddle,
            {
              transform: [{ translateX: paddleXAnim }],
              top: GH - 45,
            },
          ]}
        >
          {/* Neon side highlights */}
          <View style={s.paddleGlow} />
        </A.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.bg,
    alignItems: 'center', justifyContent: 'center',
    gap: 14, padding: spacing.md,
  },
  expiredText: { color: colors.error, fontSize: 16, textAlign: 'center', fontWeight: '600' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gameTitle: {
    color: '#FFCC00', fontSize: 30, fontWeight: '900', letterSpacing: 4,
    textShadowColor: 'rgba(255,204,0,0.6)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10,
  },
  infoCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: 18,
    borderWidth: 1, borderColor: colors.border,
    width: Math.min(SW - 64, 340), alignItems: 'center', gap: 5,
  },
  infoHeading: { color: colors.textPrimary, fontSize: 15, fontWeight: '800', marginBottom: 4 },
  infoText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFCC00', paddingVertical: 14, paddingHorizontal: 32,
    borderRadius: radius.full,
    shadowColor: '#FFCC00', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 12, elevation: 8,
  },
  startBtnText: { color: colors.bgDeep, fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  btnOutline: {
    borderWidth: 1.5, borderColor: colors.border, paddingVertical: 10,
    paddingHorizontal: spacing.xl, borderRadius: radius.full,
  },
  btnOutlineText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },

  hud: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: GW, marginBottom: 4,
  },
  hudLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  hudScore: { color: '#FFCC00', fontSize: 26, fontWeight: '900' },
  hudScoreLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  healthRow: { flexDirection: 'row', gap: 4 },
  healthBlock: { width: 18, height: 8, borderRadius: 2 },

  gameArea: {
    width: GW, height: GH,
    backgroundColor: '#0A0A05',
    borderRadius: radius.lg, borderWidth: 2, borderColor: '#3A301A',
    overflow: 'hidden', position: 'relative',
  },
  ball: {
    position: 'absolute',
    width: BALL_SIZE, height: BALL_SIZE,
    borderRadius: BALL_SIZE / 2,
    top: 0, left: 0,
  },
  spark: {
    position: 'absolute',
    backgroundColor: '#FFCC00',
  },
  paddle: {
    position: 'absolute',
    left: 0,
    width: PADDLE_W, height: PADDLE_H,
    borderRadius: 6,
    backgroundColor: '#FFCC00',
    shadowColor: '#FFCC00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  paddleGlow: {
    position: 'absolute',
    left: 2, right: 2, top: 1, bottom: 1,
    backgroundColor: '#FFFDE0',
    borderRadius: 4,
  },
  resultCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: 26,
    alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border,
    width: Math.min(SW - 64, 340), ...shadow.card,
  },
  crashedRing: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,204,0,0.08)',
    borderWidth: 2, borderColor: '#FFCC00',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  resultTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: 3 },
  resultScore: { color: '#FFCC00', fontSize: 52, fontWeight: '900' },
  resultLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
});
