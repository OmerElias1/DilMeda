import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Modal
} from 'react-native';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTournaments, useTimeLeft } from '@/hooks/useTournaments';
import { Play, Eye, Zap } from 'lucide-react-native';

const AD_SCENARIOS = [
  { title: 'Habesha Coffee Co.', desc: 'Premium Ethiopian coffee delivered to your door', points: 5, color: '#8B4513' },
  { title: 'EthioTelecom Data', desc: 'Get 2GB for just 30 ETB. Limited time offer!', points: 8, color: '#1E40AF' },
  { title: 'Addis Fashion Week', desc: 'Discover the latest in Ethiopian fashion', points: 5, color: '#7C3AED' },
  { title: 'Zemen Bank', desc: 'Open a digital account in minutes. Zero fees!', points: 10, color: '#047857' },
  { title: 'Awash Insurance', desc: 'Protect your family. Affordable plans available', points: 6, color: '#B45309' },
];

type AdPlayerProps = {
  onClose?: () => void;
  onAdWatched?: () => void;
  givePoints?: boolean;
};

export default function AdPlayer({ onClose, onAdWatched, givePoints = true }: AdPlayerProps) {
  const { addPoints, refreshProfile } = useAuth();
  const { activeTournament } = useTournaments();
  const timeLeft = useTimeLeft(activeTournament?.end_time);
  const isExpired = activeTournament ? timeLeft.expired : false;
  const [phase, setPhase] = useState<'idle' | 'watching' | 'reward'>('idle');
  const [progress, setProgress] = useState(0);
  const [currentAd] = useState(() => AD_SCENARIOS[Math.floor(Math.random() * AD_SCENARIOS.length)]);
  const [earned, setEarned] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const rewardAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const AD_DURATION = 20;

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startAd = () => {
    if (isExpired) return;
    setPhase('watching');
    setProgress(0);
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: AD_DURATION * 1000,
      useNativeDriver: false,
    }).start();

    let elapsed = 0;
    timerRef.current = setInterval(() => {
      elapsed++;
      setProgress(elapsed);
      if (elapsed >= AD_DURATION) {
        clearInterval(timerRef.current!);
        finishAd();
      }
    }, 1000);
  };

  const finishAd = async () => {
    const pts = currentAd.points;
    if (givePoints) {
      await addPoints(pts);
    }
    // Record the ad view + clear the needs_ad_watch flag
    const { supabase } = await import('@/lib/supabase');
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      // ── Insert into ad_views ───────────────────────────────────────
      await supabase.from('ad_views').insert({
        user_id:       session.user.id,
        tournament_id: activeTournament?.id ?? null,
        points_earned: givePoints ? pts : 0,
        viewed_at:     new Date().toISOString(),
      });
      // ── Clear ad gate on profile ───────────────────────────────────
      await supabase
        .from('profiles')
        .update({ needs_ad_watch: false })
        .eq('id', session.user.id);
      await refreshProfile();
    }
    setEarned(givePoints ? pts : 0);
    setPhase('reward');
    Animated.spring(rewardAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 6 }).start();
    onAdWatched?.();
  };

  const reset = () => {
    setPhase('idle');
    setProgress(0);
    progressAnim.setValue(0);
    rewardAnim.setValue(0);
    onClose?.();
  };

  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  if (isExpired) {
    return (
      <View style={styles.container}>
        <Text style={styles.expiredText}>Tournament has ended. Ad rewards are locked.</Text>
      </View>
    );
  }

  if (phase === 'reward') {
    return (
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ scale: rewardAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
            opacity: rewardAnim,
          },
        ]}
      >
        <View style={styles.rewardBurst}>
          <Text style={styles.rewardEmoji}>🏆</Text>
          {givePoints ? (
            <>
              <Text style={styles.rewardPoints}>+{earned} pts</Text>
              <Text style={styles.rewardMsg}>Ad Completed!</Text>
              <Text style={styles.rewardSub}>Points added to your tournament score</Text>
            </>
          ) : (
            <>
              <Text style={styles.rewardMsg}>Ad Completed!</Text>
              <Text style={styles.rewardSub}>You can now play another game</Text>
            </>
          )}
        </View>
        <TouchableOpacity style={styles.btnGold} onPress={reset}>
          <Text style={styles.btnGoldText}>{givePoints ? 'Watch Another Ad' : 'Continue'}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  if (phase === 'watching') {
    return (
      <View style={styles.container}>
        <View style={[styles.adScreen, { borderColor: currentAd.color }]}>
          <View style={[styles.adBrandDot, { backgroundColor: currentAd.color }]} />
          <Text style={styles.adTitle}>{currentAd.title}</Text>
          <Text style={styles.adDesc}>{currentAd.desc}</Text>
          <View style={styles.adVisual}>
            <Eye color={colors.neon} size={48} />
            <Text style={styles.adWatchingText}>Watching Ad...</Text>
          </View>
          <Text style={styles.adTimer}>{AD_DURATION - progress}s</Text>
        </View>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
        </View>
        <View style={styles.progressInfo}>
          <Text style={styles.progressLabel}>Ad Progress</Text>
          {givePoints && (
            <Text style={styles.progressReward}>+{currentAd.points} pts on completion</Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.idleContent}>
        <Zap color={colors.gold} size={40} />
        <Text style={styles.idleTitle}>{givePoints ? 'Watch & Earn' : 'Watch Ad to Continue'}</Text>
        <Text style={styles.idleSub}>
          {givePoints ? 'Watch a 20-second ad to earn points' : 'Watch a 20-second ad to play another game'}
        </Text>
        <View style={styles.adPreviewCard}>
          <Text style={styles.adPreviewLabel}>Next Ad:</Text>
          <Text style={styles.adPreviewTitle}>{currentAd.title}</Text>
          {givePoints && (
            <Text style={styles.adPreviewReward}>+{currentAd.points} points</Text>
          )}
        </View>
      </View>
      <TouchableOpacity style={styles.btnGold} onPress={startAd}>
        <Play color={colors.bgDeep} size={18} />
        <Text style={styles.btnGoldText}>{givePoints ? 'Watch Ad Now' : 'Start Ad'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
  },
  expiredText: {
    color: colors.error,
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '600',
  },
  idleContent: {
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.xl,
  },
  idleTitle: {
    color: colors.gold,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 8,
  },
  idleSub: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  adPreviewCard: {
    marginTop: spacing.md,
    backgroundColor: colors.bgDeep,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    width: 240,
  },
  adPreviewLabel: { color: colors.textMuted, fontSize: 11, marginBottom: 4 },
  adPreviewTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  adPreviewReward: { color: colors.neon, fontSize: 13, fontWeight: '700', marginTop: 4 },
  adScreen: {
    width: '100%',
    backgroundColor: colors.bgDeep,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 2,
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.md,
  },
  adBrandDot: { width: 10, height: 10, borderRadius: 5 },
  adTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
  adDesc: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },
  adVisual: { alignItems: 'center', marginVertical: spacing.md, gap: 8 },
  adWatchingText: { color: colors.neon, fontSize: 14, fontWeight: '600' },
  adTimer: { color: colors.gold, fontSize: 28, fontWeight: '900' },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: colors.bgDeep,
    borderRadius: radius.full,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.neon,
    borderRadius: radius.full,
  },
  progressInfo: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: { color: colors.textMuted, fontSize: 11 },
  progressReward: { color: colors.neon, fontSize: 11, fontWeight: '700' },
  rewardBurst: {
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.xl,
  },
  rewardEmoji: { fontSize: 56 },
  rewardPoints: { color: colors.gold, fontSize: 42, fontWeight: '900' },
  rewardMsg: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  rewardSub: { color: colors.textSecondary, fontSize: 13, textAlign: 'center' },
  btnGold: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.gold,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.full,
    ...shadow.gold,
  },
  btnGoldText: {
    color: colors.bgDeep,
    fontSize: 15,
    fontWeight: '800',
  },
});
