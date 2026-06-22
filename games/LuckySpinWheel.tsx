import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated
} from 'react-native';
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTournament } from '@/hooks/useTournament';
import { supabase } from '@/lib/supabase';

type Props = { onClose: () => void };

const SEGMENTS = [
  { label: '+10', points: 10, color: '#2D1555', textColor: colors.gold },
  { label: '+50', points: 50, color: '#1A0B2E', textColor: colors.neon },
  { label: '+5',  points: 5,  color: '#3D1F6E', textColor: colors.textPrimary },
  { label: '+100',points: 100,color: '#0D0618', textColor: '#FFD700' },
  { label: '+20', points: 20, color: '#2D1555', textColor: colors.neon },
  { label: '+15', points: 15, color: '#1A0B2E', textColor: colors.textPrimary },
  { label: '+75', points: 75, color: '#3D1F6E', textColor: colors.gold },
  { label: '+30', points: 30, color: '#0D0618', textColor: colors.neon },
];

const NUM_SEG     = SEGMENTS.length;
const RADIUS      = 130;
const CX          = 140;
const CY          = 140;
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours in ms

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function segmentPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const s = polarToCartesian(cx, cy, r, startAngle);
  const e = polarToCartesian(cx, cy, r, endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} Z`;
}

export default function LuckySpinWheel({ onClose }: Props) {
  const { addPoints, user, refreshProfile, endGameSession } = useAuth();
  const { isExpired } = useTournament();

  const [spinning,     setSpinning]     = useState(false);
  const [result,       setResult]       = useState<typeof SEGMENTS[0] | null>(null);
  const [phase,        setPhase]        = useState<'ready' | 'result'>('ready');
  const [cooldownLeft, setCooldownLeft] = useState(0);
  // loading=true until the DB query confirms the real cooldown value
  const [loading,      setLoading]      = useState(true);

  const rotationRef  = useRef(new Animated.Value(0)).current;
  const currentAngle = useRef(0);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── helpers ────────────────────────────────────────────────────────────────
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback((targetTime: number) => {
    stopTimer();
    const tick = () => {
      const remaining = Math.max(0, targetTime - Date.now());
      setCooldownLeft(remaining);
      if (remaining <= 0) stopTimer();
    };
    tick();                                          // immediate first tick
    timerRef.current = setInterval(tick, 1000);
  }, [stopTimer]);

  // ── KEY FIX: always read spin_last_used from DB on mount ──────────────────
  // We never trust the in-memory profile because it can be stale after navigation.
  useEffect(() => {
    let cancelled = false;

    const checkCooldown = async () => {
      if (!user) { setLoading(false); return; }
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('spin_last_used')
          .eq('id', user.id)
          .single();

        if (cancelled) return;

        if (!error && data?.spin_last_used) {
          const last       = new Date(data.spin_last_used).getTime();
          const targetTime = last + COOLDOWN_MS;
          const remaining  = Math.max(0, targetTime - Date.now());
          setCooldownLeft(remaining);
          if (remaining > 0) startTimer(targetTime);
        } else {
          setCooldownLeft(0);   // never spun or column missing → allow spin
        }
      } catch {
        setCooldownLeft(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    checkCooldown();
    return () => { cancelled = true; stopTimer(); };
  }, [user, startTimer, stopTimer]);

  // ── spin handler ───────────────────────────────────────────────────────────
  const spin = async () => {
    if (spinning || isExpired || cooldownLeft > 0 || loading) return;
    setSpinning(true);
    setPhase('ready');
    setResult(null);

    const targetSegIdx = Math.floor(Math.random() * NUM_SEG);
    const segAngle     = 360 / NUM_SEG;
    const extraSpins   = 5 + Math.floor(Math.random() * 3);
    const landAngle    = extraSpins * 360 + (360 - targetSegIdx * segAngle - segAngle / 2);
    const totalAngle   = currentAngle.current + landAngle;

    Animated.timing(rotationRef, {
      toValue:          totalAngle,
      duration:         4000,
      useNativeDriver:  true,
    }).start(async () => {
      currentAngle.current = totalAngle % 360;
      const seg = SEGMENTS[targetSegIdx];
      setResult(seg);
      setPhase('result');
      setSpinning(false);

      // Award points
      await addPoints(seg.points);

      if (user) {
        const now = new Date().toISOString();

        // ── 1. Save cooldown timestamp FIRST (critical — must not fail) ──────
        const { error: spinError } = await supabase
          .from('profiles')
          .update({ spin_last_used: now })
          .eq('id', user.id);

        if (spinError) {
          console.error('[SpinWheel] Failed to save spin_last_used:', spinError.message);
        }

        // ── 2. Record game played (sets needs_ad_watch, updates streak) ───────
        await supabase.rpc('record_game_played', { p_user_id: user.id });

        // ── 3. Unlock lucky_spinner achievement if 100pts were won ────────────
        if (seg.points >= 100) {
          await supabase.from('user_achievements')
            .insert({ user_id: user.id, achievement_id: 'lucky_spinner' })
            .throwOnError()
            // suppress if already exists
            .then(() => {}, () => {});
        }

        await refreshProfile();
      }

      // Start local 24 h countdown
      const targetTime = Date.now() + COOLDOWN_MS;
      setCooldownLeft(COOLDOWN_MS);
      startTimer(targetTime);
    });
  };

  // ── helpers ────────────────────────────────────────────────────────────────
  const rotation = rotationRef.interpolate({
    inputRange:  [0, 360],
    outputRange: ['0deg', '360deg'],
    extrapolate: 'extend',
  });

  const fmtCooldown = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const h   = Math.floor(totalSec / 3600);
    const m   = Math.floor((totalSec % 3600) / 60);
    const sec = totalSec % 60;
    return `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Text style={styles.gameTitle}>LUCKY SPIN</Text>
      <Text style={styles.gameSub}>Spin to win bonus points!</Text>

      {/* Wheel */}
      <View style={styles.wheelContainer}>
        <View style={styles.pointer}><Text style={styles.pointerArrow}>▼</Text></View>
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Svg width={280} height={280} viewBox="0 0 280 280">
            <G>
              {SEGMENTS.map((seg, i) => {
                const startAngle = i * (360 / NUM_SEG);
                const endAngle   = (i + 1) * (360 / NUM_SEG);
                const midAngle   = (startAngle + endAngle) / 2;
                const textPt     = polarToCartesian(CX, CY, RADIUS * 0.65, midAngle);
                return (
                  <G key={i}>
                    <Path
                      d={segmentPath(CX, CY, RADIUS, startAngle, endAngle)}
                      fill={seg.color}
                      stroke={colors.borderGold}
                      strokeWidth="1.5"
                    />
                    <SvgText
                      x={textPt.x} y={textPt.y + 5}
                      fill={seg.textColor} fontSize="13" fontWeight="bold"
                      textAnchor="middle"
                      transform={`rotate(${midAngle}, ${textPt.x}, ${textPt.y})`}
                    >
                      {seg.label}
                    </SvgText>
                  </G>
                );
              })}
            </G>
            {/* Center hub */}
            <G>
              <Path
                d={`M ${CX} ${CY} m -18 0 a 18 18 0 1 0 36 0 a 18 18 0 1 0 -36 0`}
                fill={colors.gold}
              />
              <SvgText x={CX} y={CY + 5} fill={colors.bgDeep} fontSize="14"
                fontWeight="bold" textAnchor="middle">★</SvgText>
            </G>
          </Svg>
        </Animated.View>
      </View>

      {/* Win result */}
      {phase === 'result' && result && (
        <View style={styles.resultBox}>
          <Text style={styles.resultLabel}>You Won!</Text>
          <Text style={styles.resultPts}>{result.label} Points</Text>
        </View>
      )}

      {/* Cooldown / Spin button */}
      {loading ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>⏳ Checking spin status…</Text>
        </View>
      ) : cooldownLeft > 0 ? (
        <View style={styles.cooldownBox}>
          <Text style={styles.cooldownLabel}>Next spin in</Text>
          <Text style={styles.cooldownTimer}>{fmtCooldown(cooldownLeft)}</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.btnGold, (spinning || isExpired) && styles.btnDisabled]}
          onPress={spin}
          disabled={spinning || isExpired}
        >
          <Text style={styles.btnGoldText}>{spinning ? 'Spinning…' : 'SPIN!'}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.btnOutline} onPress={onClose}>
        <Text style={styles.btnOutlineText}>Exit</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.bg,
    alignItems: 'center', justifyContent: 'center',
    gap: spacing.md, padding: spacing.md,
  },
  gameTitle: {
    color: colors.gold, fontSize: 26, fontWeight: '900', letterSpacing: 3,
  },
  gameSub: { color: colors.textSecondary, fontSize: 13 },
  wheelContainer: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  pointer: { position: 'absolute', top: -8, zIndex: 10, alignItems: 'center' },
  pointerArrow: { color: colors.gold, fontSize: 24 },
  resultBox: {
    backgroundColor: colors.bgCard, borderRadius: radius.md, padding: spacing.md,
    alignItems: 'center', borderWidth: 1.5, borderColor: colors.gold, ...shadow.gold,
  },
  resultLabel: { color: colors.textSecondary, fontSize: 13 },
  resultPts: { color: colors.gold, fontSize: 28, fontWeight: '900' },
  statusBox: {
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    paddingVertical: 12, paddingHorizontal: spacing.xl,
    borderWidth: 1, borderColor: colors.border,
  },
  statusText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  cooldownBox: {
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    paddingVertical: 14, paddingHorizontal: spacing.xl,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', gap: 4,
  },
  cooldownLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  cooldownTimer: { color: colors.gold, fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  btnGold: {
    backgroundColor: colors.gold, paddingVertical: 14,
    paddingHorizontal: spacing.xl + 16, borderRadius: radius.full, ...shadow.gold,
  },
  btnDisabled: { opacity: 0.5 },
  btnGoldText: { color: colors.bgDeep, fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  btnOutline: {
    borderWidth: 1.5, borderColor: colors.border,
    paddingVertical: 12, paddingHorizontal: spacing.xl, borderRadius: radius.full,
  },
  btnOutlineText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
});
