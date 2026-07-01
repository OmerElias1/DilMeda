import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useFrameCallback,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { ChevronRight, ShieldAlert } from 'lucide-react-native';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTournament } from '@/hooks/useTournament';

const { width: SW } = Dimensions.get('window');
const GW = Math.min(SW - 32, 380);
const GH = 480;
const PADDLE_W = 75;
const PADDLE_H = 12;
const BALL_SIZE = 14;
const PAD_Y = GH - 45;

type Props = { onClose: () => void; onPlayAgain?: () => void };

export default function LaserDeflector({ onClose, onPlayAgain }: Props) {
  const { endGameSession } = useAuth();
  const { isExpired } = useTournament();

  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);

  // ── Paddle (UI thread) ────────────────────────────────────────────
  const paddleX = useSharedValue((GW - PADDLE_W) / 2);

  // ── Ball 0 shared values (UI thread physics + render) ─────────────
  const b0x = useSharedValue(-BALL_SIZE * 2);
  const b0y = useSharedValue(-BALL_SIZE * 2);
  const b0vx = useSharedValue(0);
  const b0vy = useSharedValue(0);
  const b0a = useSharedValue(0); // 0=inactive 1=active

  // ── Ball 1 ────────────────────────────────────────────────────────
  const b1x = useSharedValue(-BALL_SIZE * 2);
  const b1y = useSharedValue(-BALL_SIZE * 2);
  const b1vx = useSharedValue(0);
  const b1vy = useSharedValue(0);
  const b1a = useSharedValue(0);

  // ── Ball 2 ────────────────────────────────────────────────────────
  const b2x = useSharedValue(-BALL_SIZE * 2);
  const b2y = useSharedValue(-BALL_SIZE * 2);
  const b2vx = useSharedValue(0);
  const b2vy = useSharedValue(0);
  const b2a = useSharedValue(0);

  // ── Game state (shared values accessible from worklets) ───────────
  const gameActive = useSharedValue(0);
  const tickSv = useSharedValue(0);
  const scoreSv = useSharedValue(0);
  const livesSv = useSharedValue(3);

  // JS thread callbacks (called from worklet via runOnJS)
  const jsSetScore = (s: number) => setScore(s);
  const jsSetLives = (l: number) => setLives(l);
  const jsGameOver = (s: number) => {
    endGameSession(s);
    setPhase('done');
  };

  // ── Pan gesture — runs entirely on UI thread ──────────────────────
  const panGesture = Gesture.Pan().onUpdate((e) => {
    'worklet';
    let nx = e.x - PADDLE_W / 2;
    paddleX.value = Math.max(0, Math.min(GW - PADDLE_W, nx));
  });

  // ── Frame callback — UI thread, true 60fps, zero bridge crossing ──
  const fc = useFrameCallback((fi) => {
    if (!gameActive.value) return;

    // Delta-time: how many "standard frames" (16.67ms) elapsed
    const dt = Math.min((fi.timeSincePreviousFrame ?? 16.67) / 16.67, 3);
    tickSv.value = tickSv.value + 1;
    const tick = tickSv.value;
    const curScore = scoreSv.value;

    // ── Spawn ──────────────────────────────────────────────────────
    const hasActive = b0a.value || b1a.value || b2a.value;
    const spawnRate = Math.max(23, 60 - Math.floor(curScore / 8) * 5);

    if (tick % spawnRate === 0 || !hasActive) {
      let freeSlot = -1;
      if (!b0a.value) freeSlot = 0;
      else if (!b1a.value) freeSlot = 1;
      else if (!b2a.value) freeSlot = 2;

      if (freeSlot !== -1) {
        const sx = Math.random() * (GW - BALL_SIZE * 2) + BALL_SIZE;
        const svx = (Math.random() - 0.5) * 3;
        const svy = Math.random() * 1.5 + 2 + curScore * 0.05;
        if (freeSlot === 0) {
          b0x.value = sx; b0y.value = -10; b0vx.value = svx; b0vy.value = svy; b0a.value = 1;
        } else if (freeSlot === 1) {
          b1x.value = sx; b1y.value = -10; b1vx.value = svx; b1vy.value = svy; b1a.value = 1;
        } else {
          b2x.value = sx; b2y.value = -10; b2vx.value = svx; b2vy.value = svy; b2a.value = 1;
        }
      }
    }

    // ── Physics (inlined per ball — worklets can't dynamically index hook refs) ──
    const padX = paddleX.value;
    let scoreChanged = false;
    let livesChanged = false;

    // Ball 0
    if (b0a.value) {
      let bx = b0x.value, by = b0y.value, bvx = b0vx.value, bvy = b0vy.value;
      bx += bvx * dt;
      by += bvy * dt;
      bvy = Math.min(bvy + 0.04 * dt, 14); // gravity
      if (bx <= 0) { bx = 0; bvx = Math.abs(bvx); }
      else if (bx + BALL_SIZE >= GW) { bx = GW - BALL_SIZE; bvx = -Math.abs(bvx); }
      if (by < 0 && bvy < 0) bvy = Math.abs(bvy);
      if (by + BALL_SIZE >= PAD_Y && by < PAD_Y + PADDLE_H + 6 && bx + BALL_SIZE >= padX && bx <= padX + PADDLE_W && bvy > 0) {
        by = PAD_Y - BALL_SIZE;
        bvy = -Math.abs(bvy) * 0.95;
        bvx = ((bx + BALL_SIZE / 2 - padX) / PADDLE_W - 0.5) * 7;
        scoreSv.value = scoreSv.value + 1;
        scoreChanged = true;
      }
      if (by > GH) {
        b0x.value = -BALL_SIZE * 2; b0y.value = -BALL_SIZE * 2; b0a.value = 0;
        livesSv.value = livesSv.value - 1; livesChanged = true;
        if (livesSv.value <= 0) { gameActive.value = 0; runOnJS(jsGameOver)(scoreSv.value); return; }
      } else { b0x.value = bx; b0y.value = by; b0vx.value = bvx; b0vy.value = bvy; }
    }

    // Ball 1
    if (b1a.value) {
      let bx = b1x.value, by = b1y.value, bvx = b1vx.value, bvy = b1vy.value;
      bx += bvx * dt;
      by += bvy * dt;
      bvy = Math.min(bvy + 0.04 * dt, 14);
      if (bx <= 0) { bx = 0; bvx = Math.abs(bvx); }
      else if (bx + BALL_SIZE >= GW) { bx = GW - BALL_SIZE; bvx = -Math.abs(bvx); }
      if (by < 0 && bvy < 0) bvy = Math.abs(bvy);
      if (by + BALL_SIZE >= PAD_Y && by < PAD_Y + PADDLE_H + 6 && bx + BALL_SIZE >= padX && bx <= padX + PADDLE_W && bvy > 0) {
        by = PAD_Y - BALL_SIZE;
        bvy = -Math.abs(bvy) * 0.95;
        bvx = ((bx + BALL_SIZE / 2 - padX) / PADDLE_W - 0.5) * 7;
        scoreSv.value = scoreSv.value + 1;
        scoreChanged = true;
      }
      if (by > GH) {
        b1x.value = -BALL_SIZE * 2; b1y.value = -BALL_SIZE * 2; b1a.value = 0;
        livesSv.value = livesSv.value - 1; livesChanged = true;
        if (livesSv.value <= 0) { gameActive.value = 0; runOnJS(jsGameOver)(scoreSv.value); return; }
      } else { b1x.value = bx; b1y.value = by; b1vx.value = bvx; b1vy.value = bvy; }
    }

    // Ball 2
    if (b2a.value) {
      let bx = b2x.value, by = b2y.value, bvx = b2vx.value, bvy = b2vy.value;
      bx += bvx * dt;
      by += bvy * dt;
      bvy = Math.min(bvy + 0.04 * dt, 14);
      if (bx <= 0) { bx = 0; bvx = Math.abs(bvx); }
      else if (bx + BALL_SIZE >= GW) { bx = GW - BALL_SIZE; bvx = -Math.abs(bvx); }
      if (by < 0 && bvy < 0) bvy = Math.abs(bvy);
      if (by + BALL_SIZE >= PAD_Y && by < PAD_Y + PADDLE_H + 6 && bx + BALL_SIZE >= padX && bx <= padX + PADDLE_W && bvy > 0) {
        by = PAD_Y - BALL_SIZE;
        bvy = -Math.abs(bvy) * 0.95;
        bvx = ((bx + BALL_SIZE / 2 - padX) / PADDLE_W - 0.5) * 7;
        scoreSv.value = scoreSv.value + 1;
        scoreChanged = true;
      }
      if (by > GH) {
        b2x.value = -BALL_SIZE * 2; b2y.value = -BALL_SIZE * 2; b2a.value = 0;
        livesSv.value = livesSv.value - 1; livesChanged = true;
        if (livesSv.value <= 0) { gameActive.value = 0; runOnJS(jsGameOver)(scoreSv.value); return; }
      } else { b2x.value = bx; b2y.value = by; b2vx.value = bvx; b2vy.value = bvy; }
    }

    // Only cross bridge to update UI when something changed
    if (scoreChanged) runOnJS(jsSetScore)(scoreSv.value);
    if (livesChanged) runOnJS(jsSetLives)(livesSv.value);
  }, false); // start inactive

  // ── Animated styles (UI thread → render) ─────────────────────────
  const paddleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: paddleX.value }],
  }));
  const ball0Style = useAnimatedStyle(() => ({
    transform: [{ translateX: b0x.value }, { translateY: b0y.value }],
  }));
  const ball1Style = useAnimatedStyle(() => ({
    transform: [{ translateX: b1x.value }, { translateY: b1y.value }],
  }));
  const ball2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: b2x.value }, { translateY: b2y.value }],
  }));

  // ── Game controls ─────────────────────────────────────────────────
  const startGame = () => {
    scoreSv.value = 0; livesSv.value = 3; tickSv.value = 0;
    paddleX.value = (GW - PADDLE_W) / 2;
    b0a.value = 0; b0x.value = -BALL_SIZE * 2; b0y.value = -BALL_SIZE * 2;
    b1a.value = 0; b1x.value = -BALL_SIZE * 2; b1y.value = -BALL_SIZE * 2;
    b2a.value = 0; b2x.value = -BALL_SIZE * 2; b2y.value = -BALL_SIZE * 2;
    setScore(0); setLives(3);
    setPhase('playing');
    gameActive.value = 1;
    fc.setActive(true);
  };

  React.useEffect(() => {
    return () => {
      gameActive.value = 0;
      fc.setActive(false);
    };
  }, []);

  // ── Render ────────────────────────────────────────────────────────
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
        <View style={s.titleRow}>
          <ShieldAlert color="#FFCC00" size={26} />
          <Text style={s.gameTitle}>LASER DEFLECTOR</Text>
          <ShieldAlert color="#FFCC00" size={26} />
        </View>

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
        <View style={s.resultCard}>
          <View style={s.crashedRing}>
            <Text style={{ fontSize: 38 }}>🛡️💥</Text>
          </View>
          <Text style={s.resultTitle}>SHIELDS BROKEN!</Text>
          <Text style={s.resultScore}>{score}</Text>
          <Text style={s.resultLabel}>LASERS DEFLECTED</Text>
        </View>

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
              style={[s.healthBlock, { backgroundColor: i < lives ? '#FFCC00' : 'rgba(255,255,255,0.08)' }]}
            />
          ))}
        </View>
      </View>

      {/* Game area — GestureDetector runs on UI thread */}
      <GestureDetector gesture={panGesture}>
        <View style={s.gameArea}>
          <Animated.View style={[s.ball, { backgroundColor: '#00FFCC' }, ball0Style]} />
          <Animated.View style={[s.ball, { backgroundColor: '#FFCC00' }, ball1Style]} />
          <Animated.View style={[s.ball, { backgroundColor: '#FF0055' }, ball2Style]} />
          <Animated.View style={[s.paddle, paddleStyle]} />
        </View>
      </GestureDetector>
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
  paddle: {
    position: 'absolute',
    left: 0,
    top: PAD_Y,
    width: PADDLE_W, height: PADDLE_H,
    borderRadius: 6,
    backgroundColor: '#FFCC00',
    elevation: 4,
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
