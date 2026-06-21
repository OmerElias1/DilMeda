import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Trophy, Star, Zap, Target, Crown, Medal, Flame, Clock,
  ChevronLeft, Lock, CheckCircle
} from 'lucide-react-native';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/lib/supabase';

type Props = {
  onClose: () => void;
};

type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  requirement: number;
  type: 'points' | 'games' | 'wins' | 'streak' | 'special';
  tier: 'bronze' | 'silver' | 'gold';
};

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_game',
    title: 'First Steps',
    description: 'Play your first game',
    icon: <Zap color={colors.neon} size={24} />,
    requirement: 1,
    type: 'games',
    tier: 'bronze',
  },
  {
    id: 'game_master',
    title: 'Game Master',
    description: 'Play 50 games',
    icon: <Target color={colors.gold} size={24} />,
    requirement: 50,
    type: 'games',
    tier: 'silver',
  },
  {
    id: 'point_collector',
    title: 'Point Collector',
    description: 'Earn 1,000 points total',
    icon: <Star color={colors.gold} size={24} fill={colors.gold} />,
    requirement: 1000,
    type: 'points',
    tier: 'bronze',
  },
  {
    id: 'point_hunter',
    title: 'Point Hunter',
    description: 'Earn 5,000 points total',
    icon: <Star color={colors.gold} size={24} />,
    requirement: 5000,
    type: 'points',
    tier: 'silver',
  },
  {
    id: 'champion',
    title: 'Champion',
    description: 'Reach the top 10 leaderboard',
    icon: <Crown color={colors.gold} size={24} />,
    requirement: 10,
    type: 'wins',
    tier: 'gold',
  },
  {
    id: 'daily_player',
    title: 'Daily Player',
    description: 'Play for 7 consecutive days',
    icon: <Flame color="#FF6B6B" size={24} />,
    requirement: 7,
    type: 'streak',
    tier: 'silver',
  },
  {
    id: 'early_bird',
    title: 'Early Bird',
    description: 'Join the first tournament',
    icon: <Clock color={colors.neon} size={24} />,
    requirement: 1,
    type: 'special',
    tier: 'bronze',
  },
  {
    id: 'lucky_spinner',
    title: 'Lucky Spinner',
    description: 'Get 100 points from a single spin',
    icon: <Medal color={colors.gold} size={24} />,
    requirement: 100,
    type: 'special',
    tier: 'gold',
  },
];

const TIER_COLORS = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: colors.gold,
};

const TIER_BG = {
  bronze: 'rgba(205,127,50,0.15)',
  silver: 'rgba(192,192,192,0.15)',
  gold: 'rgba(255,215,0,0.15)',
};

export default function AchievementsModal({ onClose }: Props) {
  const { profile, user } = useAuth();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const userPoints = profile?.points ?? 0;
  const gamesPlayed = profile?.games_played ?? 0;
  const dailyStreak = profile?.daily_streak ?? 0;

  // Load unlocked achievements from the database
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('user_achievements')
        .select('achievement_id')
        .eq('user_id', user.id);

      if (!cancelled && data) {
        setUnlockedIds(new Set(data.map((r: { achievement_id: string }) => r.achievement_id)));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  /** Returns 0–100 progress for achievements that have not yet been unlocked via DB */
  const getProgress = (achievement: Achievement): number => {
    if (unlockedIds.has(achievement.id)) return 100;
    switch (achievement.type) {
      case 'points':
        return Math.min(100, (userPoints / achievement.requirement) * 100);
      case 'games':
        return Math.min(100, (gamesPlayed / achievement.requirement) * 100);
      case 'streak':
        return Math.min(100, (dailyStreak / achievement.requirement) * 100);
      default:
        return 0;
    }
  };

  const isUnlocked = (achievement: Achievement): boolean =>
    unlockedIds.has(achievement.id) || getProgress(achievement) >= 100;

  const unlockedCount = ACHIEVEMENTS.filter(isUnlocked).length;

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 20 : 0) }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <ChevronLeft color={colors.textPrimary} size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('achTitle')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Trophy color={colors.gold} size={28} />
            <Text style={styles.statValue}>{unlockedCount}/{ACHIEVEMENTS.length}</Text>
            <Text style={styles.statLabel}>{t('achUnlocked')}</Text>
          </View>
          <View style={styles.statBox}>
            <Star color={colors.neon} size={28} />
            <Text style={styles.statValue}>{userPoints}</Text>
            <Text style={styles.statLabel}>{t('achTotalPoints')}</Text>
          </View>
          <View style={styles.statBox}>
            <Flame color="#FF6B6B" size={28} />
            <Text style={styles.statValue}>{dailyStreak}</Text>
            <Text style={styles.statLabel}>{t('achDayStreak')}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t('achYourBadges')}</Text>

        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
        ) : (
          ACHIEVEMENTS.map(achievement => {
            const progress = getProgress(achievement);
            const unlocked = isUnlocked(achievement);

            return (
              <View
                key={achievement.id}
                style={[
                  styles.achievementCard,
                  unlocked && { backgroundColor: TIER_BG[achievement.tier], borderColor: TIER_COLORS[achievement.tier] }
                ]}
              >
                <View style={styles.achievementHeader}>
                  <View style={[
                    styles.iconCircle,
                    { backgroundColor: unlocked ? TIER_BG[achievement.tier] : 'rgba(255,255,255,0.05)' }
                  ]}>
                    {!unlocked && <Lock color={colors.textMuted} size={16} style={{ position: 'absolute' }} />}
                    {achievement.icon}
                  </View>
                  <View style={styles.achievementInfo}>
                    <View style={styles.titleRow}>
                      <Text style={[
                        styles.achievementTitle,
                        !unlocked && styles.achievementTitleLocked
                      ]}>
                        {t(`ach_${achievement.id}` as any) || achievement.title}
                      </Text>
                      {unlocked && (
                        <View style={[styles.tierBadge, { backgroundColor: TIER_COLORS[achievement.tier] }]}>
                          <Text style={styles.tierText}>{achievement.tier.toUpperCase()}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[
                      styles.achievementDesc,
                      !unlocked && styles.achievementDescLocked
                    ]}>
                      {t(`ach_${achievement.id}_desc` as any) || achievement.description}
                    </Text>
                    {unlocked ? (
                      <View style={styles.unlockedRow}>
                        <CheckCircle color={TIER_COLORS[achievement.tier]} size={14} />
                        <Text style={[styles.unlockedLabel, { color: TIER_COLORS[achievement.tier] }]}>
                          {t('achUnlockedLabel')}
                        </Text>
                      </View>
                    ) : progress > 0 && (
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${progress}%` }]} />
                        <Text style={styles.progressText}>{Math.round(progress)}%</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        )}

        <View style={styles.comingBox}>
          <Text style={styles.comingTitle}>{t('achMoreComing')}</Text>
          <Text style={styles.comingText}>
            {t('achMoreComingSub')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { padding: 4 },
  title: { color: colors.gold, fontSize: 18, fontWeight: '800' },
  content: { padding: spacing.md },
  statsRow: {
    flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md,
  },
  statBox: {
    flex: 1, padding: spacing.sm, borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', gap: 4,
  },
  statValue: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textAlign: 'center' },
  sectionTitle: {
    color: colors.textPrimary, fontWeight: '700', fontSize: 15,
    marginTop: spacing.md, marginBottom: spacing.md,
  },
  achievementCard: {
    padding: spacing.md, borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  achievementHeader: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.md,
  },
  achievementInfo: { flex: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  achievementTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 14, flex: 1 },
  achievementTitleLocked: { color: colors.textMuted },
  tierBadge: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: radius.sm, marginLeft: spacing.sm,
  },
  tierText: { color: colors.bgDeep, fontSize: 9, fontWeight: '800' },
  achievementDesc: { color: colors.textSecondary, fontSize: 12 },
  achievementDescLocked: { color: colors.textMuted },
  unlockedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  unlockedLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  progressBar: {
    height: 6, backgroundColor: colors.bgDeep,
    borderRadius: radius.full, marginTop: spacing.sm,
    flexDirection: 'row', alignItems: 'center',
  },
  progressFill: {
    height: '100%', backgroundColor: colors.gold,
    borderRadius: radius.full,
  },
  progressText: { position: 'absolute', right: 6, color: colors.textMuted, fontSize: 9, fontWeight: '600' },
  comingBox: {
    marginTop: spacing.xl, padding: spacing.md,
    borderRadius: radius.md, backgroundColor: 'rgba(255,215,0,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)',
    alignItems: 'center',
  },
  comingTitle: { color: colors.gold, fontWeight: '700', fontSize: 14, marginBottom: 4 },
  comingText: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
});
