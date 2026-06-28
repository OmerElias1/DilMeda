import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Easing,
} from 'react-native';
import { Zap, Trophy, ChevronRight, Clock, Star } from 'lucide-react-native';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTournament } from '@/hooks/useTournament';

const { width: W } = Dimensions.get('window');
const COIN_SIZE = 160;
const RING_SIZE = COIN_SIZE + 28;

type Props = {
  onClose: () => void;
  onPlayAgain?: () => void;
};

export default function MedaClicker({ onClose, onPlayAgain }: Props) {
  const { endGameSession } = useAuth();
  const { isExpired } = useTournament();
  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [count, setCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);

  const coinAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const resultScale = useRef(new Animated.Value(0)).current;
  const titlePulse = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countRef = useRef(0);
  const lastTapRef = useRef(0);
  const comboRef = useRef(0);
  const bestComboRef = useRef(0);

  useEffect(() => {
    if (phase !== 'ready') return;
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(titlePulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(titlePulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    glowLoop.start();
    pulseLoop.start();
    return () => { glowLoop.stop(); pulseLoop.stop(); };
  }, [phase]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (phase === 'done') {
      Animated.spring(resultScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }).start();
    } else {
      resultScale.setValue(0);
    }
  }, [phase]);

  const startGame = () => {
    setPhase('playing');
    setCount(0);
    countRef.current = 0;
    comboRef.current = 0;
    bestComboRef.current = 0;
    setCombo(0);
    setBestCombo(0);
    setTimeLeft(10);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          finishGame();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const finishGame = async () => {
    setPhase('done');
    const pts = Math.max(countRef.current, 0);
    await endGameSession(pts);
  };

  const handleTap = () => {
    if (phase !== 'playing') return;
    const now = Date.now();

    // Anti-cheat: prevent autoclickers (max ~15 taps per second)
    if (lastTapRef.current > 0 && now - lastTapRef.current < 65) {
      return;
    }

    countRef.current++;
    setCount(countRef.current);

    // Combo tracking
    if (now - lastTapRef.current < 350) {
      comboRef.current++;
    } else {
      comboRef.current = 1;
    }
    lastTapRef.current = now;
    setCombo(comboRef.current);
    if (comboRef.current > bestComboRef.current) {
      bestComboRef.current = comboRef.current;
      setBestCombo(comboRef.current);
    }

    // Coin bounce
    Animated.sequence([
      Animated.spring(coinAnim, { toValue: 0.82, useNativeDriver: true, tension: 400, friction: 5 }),
      Animated.spring(coinAnim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 6 }),
    ]).start();

    // Ripple burst
    rippleAnim.setValue(0);
    Animated.timing(rippleAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
  };

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.8] });
  const rippleScale = rippleAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] });
  const rippleOpacity = rippleAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.5, 0.3, 0] });
  const titleGlowOp = titlePulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  const comboColor = combo >= 15 ? '#FF00FF' : combo >= 10 ? '#FF4444' : combo >= 5 ? '#FF8C00' : colors.gold;
  const timerColor = timeLeft <= 3 ? colors.error : timeLeft <= 6 ? colors.warning : colors.neon;

  if (isExpired) {
    return (
      <View style={s.container}>
        <Text style={s.expiredText}>Tournament ended. Come back next time!</Text>
        <TouchableOpacity style={s.btnOutline} onPress={onClose}>
          <Text style={s.btnOutlineText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── DONE ──
  if (phase === 'done') {
    const tapsPerSec = (count / 10).toFixed(1);
    return (
      <View style={s.container}>
        <Animated.View style={[s.resultCard, { transform: [{ scale: resultScale }] }]}>
          <View style={s.trophyRing}>
            <Trophy color={colors.gold} size={40} fill={colors.gold} />
          </View>
          <Text style={s.resultTitle}>TIME'S UP!</Text>
          <Text style={s.resultScore}>{count}</Text>
          <Text style={s.resultLabel}>TOTAL TAPS</Text>

          <View style={s.resultStatsRow}>
            <View style={s.resultStatItem}>
              <Text style={s.resultStatVal}>{tapsPerSec}</Text>
              <Text style={s.resultStatLabel}>TAPS/SEC</Text>
            </View>
            <View style={[s.resultStatDivider]} />
            <View style={s.resultStatItem}>
              <Text style={[s.resultStatVal, { color: colors.neon }]}>{bestCombo}x</Text>
              <Text style={s.resultStatLabel}>BEST COMBO</Text>
            </View>
          </View>

          <View style={s.pointsBadge}>
            <Zap color={colors.bgDeep} size={16} fill={colors.bgDeep} />
            <Text style={s.pointsBadgeText}>+{count} Points Earned</Text>
          </View>
        </Animated.View>

        <TouchableOpacity style={s.startBtn} onPress={onPlayAgain || startGame} activeOpacity={0.8}>
          <Text style={s.startBtnText}>PLAY AGAIN</Text>
          <ChevronRight color={colors.bgDeep} size={20} />
        </TouchableOpacity>
        <TouchableOpacity style={s.btnOutline} onPress={onClose}>
          <Text style={s.btnOutlineText}>Exit</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── READY ──
  if (phase === 'ready') {
    return (
      <View style={s.container}>
        <Animated.View style={{ opacity: titleGlowOp }}>
          <View style={s.titleRow}>
            <Zap color={colors.gold} size={24} fill={colors.gold} />
            <Text style={s.gameTitle}>MEDA CLICKER</Text>
            <Zap color={colors.gold} size={24} fill={colors.gold} />
          </View>
        </Animated.View>

        <View style={s.infoCard}>
          <Text style={s.infoHeading}>How to Play</Text>
          <Text style={s.infoText}>Tap the gold coin as <Text style={{ color: colors.gold, fontWeight: '800' }}>fast</Text> as you can!</Text>
          <Text style={s.infoText}>You have <Text style={{ color: colors.neon, fontWeight: '800' }}>10 seconds</Text></Text>
          <Text style={s.infoText}>Each tap = <Text style={{ color: colors.gold, fontWeight: '800' }}>1 point</Text></Text>
          <Text style={[s.infoText, { color: colors.neon, marginTop: 6 }]}>⚡ Build combos for bragging rights!</Text>
        </View>

        {/* Preview coin */}
        <View style={s.coinPreviewWrap}>
          <View style={s.coin}>
            <Text style={s.coinSymbol}>✦</Text>
          </View>
        </View>

        <TouchableOpacity style={s.startBtn} onPress={startGame} activeOpacity={0.8}>
          <Text style={s.startBtnText}>START GAME</Text>
          <ChevronRight color={colors.bgDeep} size={20} />
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
          <Text style={s.hudTapNum}>{count}</Text>
          <Text style={s.hudTapLabel}>TAPS</Text>
        </View>

        {combo >= 3 && (
          <View style={[s.comboPill, { backgroundColor: comboColor + '25', borderColor: comboColor }]}>
            <Zap color={comboColor} size={14} fill={comboColor} />
            <Text style={[s.comboText, { color: comboColor }]}>{combo}x</Text>
          </View>
        )}

        <View style={[s.timerPill, { borderColor: timerColor }]}>
          <Clock color={timerColor} size={14} />
          <Text style={[s.timerText, { color: timerColor }]}>{timeLeft}s</Text>
        </View>
      </View>

      {/* Coin area */}
      <TouchableOpacity onPress={handleTap} activeOpacity={1} style={s.coinTouchArea}>
        {/* Timer ring background */}
        <View style={s.timerRing}>
          {/* Remaining time visual indicator */}
          <View style={[s.timerRingFill, {
            borderColor: timerColor,
            borderTopColor: timeLeft > 7.5 ? timerColor : 'transparent',
            borderRightColor: timeLeft > 5 ? timerColor : 'transparent',
            borderBottomColor: timeLeft > 2.5 ? timerColor : 'transparent',
            borderLeftColor: timeLeft > 0 ? timerColor : 'transparent',
          }]} />
        </View>

        {/* Coin */}
        <Animated.View style={[s.coinWrapper, { transform: [{ scale: coinAnim }] }]}>
          <View style={s.coin}>
            <View style={s.coinInnerRing} />
            <Text style={s.coinSymbol}>✦</Text>
          </View>
        </Animated.View>

        <Text style={s.tapHint}>TAP!</Text>
      </TouchableOpacity>

      {/* Taps per second */}
      <Text style={s.tpsText}>{(count / Math.max(10 - timeLeft, 1)).toFixed(1)} taps/sec</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.bg,
    alignItems: 'center', justifyContent: 'center',
    gap: 14, padding: spacing.lg,
  },
  expiredText: { color: colors.error, fontSize: 16, textAlign: 'center', fontWeight: '600' },

  // ── Ready ──
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gameTitle: { color: colors.gold, fontSize: 28, fontWeight: '900', letterSpacing: 4 },
  infoCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: 20,
    borderWidth: 1, borderColor: colors.border, width: '100%', alignItems: 'center', gap: 5,
  },
  infoHeading: { color: colors.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  infoText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },
  coinPreviewWrap: { alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.gold, paddingVertical: 14, paddingHorizontal: 32,
    borderRadius: radius.full, ...shadow.gold,
  },
  startBtnText: { color: colors.bgDeep, fontSize: 16, fontWeight: '900', letterSpacing: 1 },

  // ── HUD ──
  hud: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', paddingHorizontal: 8, marginBottom: 8,
  },
  hudLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  hudTapNum: { color: colors.gold, fontSize: 36, fontWeight: '900' },
  hudTapLabel: { color: colors.goldDim, fontSize: 12, fontWeight: '700' },
  comboPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.full, borderWidth: 1.5,
  },
  comboText: { fontSize: 14, fontWeight: '900' },
  timerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.neon,
    backgroundColor: 'rgba(0,255,204,0.08)',
  },
  timerText: { fontSize: 18, fontWeight: '900' },

  // ── Coin ──
  coinTouchArea: { alignItems: 'center', justifyContent: 'center', padding: 30 },
  timerRing: {
    position: 'absolute', width: RING_SIZE, height: RING_SIZE,
    borderRadius: RING_SIZE / 2, borderWidth: 2,
    borderColor: 'rgba(61,31,110,0.4)',
  },
  timerRingFill: {
    position: 'absolute', width: RING_SIZE - 4, height: RING_SIZE - 4,
    borderRadius: (RING_SIZE - 4) / 2, borderWidth: 3, top: -1, left: -1,
  },
  coinWrapper: { ...shadow.gold },
  coin: {
    width: COIN_SIZE, height: COIN_SIZE, borderRadius: COIN_SIZE / 2,
    backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center',
    borderWidth: 5, borderColor: colors.goldLight,
  },
  coinInnerRing: {
    position: 'absolute', width: COIN_SIZE - 24, height: COIN_SIZE - 24,
    borderRadius: (COIN_SIZE - 24) / 2, borderWidth: 2,
    borderColor: 'rgba(13,6,24,0.2)',
  },
  coinSymbol: { color: colors.bgDeep, fontSize: 52, fontWeight: '900' },
  tapHint: { color: colors.gold, fontSize: 14, fontWeight: '800', letterSpacing: 3, marginTop: 10 },
  tpsText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },

  // ── Result ──
  resultCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: 28,
    alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border,
    width: '100%', ...shadow.card,
  },
  trophyRing: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: 'rgba(255,215,0,0.1)', borderWidth: 2, borderColor: colors.gold,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  resultTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: 3 },
  resultScore: { color: colors.gold, fontSize: 56, fontWeight: '900' },
  resultLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  resultStatsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 8,
    paddingVertical: 12, paddingHorizontal: 20,
    backgroundColor: colors.bgDeep, borderRadius: radius.lg, width: '100%',
    justifyContent: 'center',
  },
  resultStatItem: { alignItems: 'center', gap: 2 },
  resultStatVal: { color: colors.gold, fontSize: 22, fontWeight: '900' },
  resultStatLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  resultStatDivider: { width: 1, height: 32, backgroundColor: colors.border },
  pointsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.gold, paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: radius.full, marginTop: 4,
  },
  pointsBadgeText: { color: colors.bgDeep, fontSize: 13, fontWeight: '800' },

  btnOutline: {
    borderWidth: 1.5, borderColor: colors.border, paddingVertical: 12,
    paddingHorizontal: spacing.xl, borderRadius: radius.full,
  },
  btnOutlineText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
});
