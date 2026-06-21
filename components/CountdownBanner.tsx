import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, spacing, radius } from '@/constants/theme';
import { useTournaments, useTimeLeft } from '@/hooks/useTournaments';
import { Trophy } from 'lucide-react-native';

function TimeBox({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.timeBox}>
      <Text style={styles.timeValue}>{String(value).padStart(2, '0')}</Text>
      <Text style={styles.timeLabel}>{label}</Text>
    </View>
  );
}

export default function CountdownBanner() {
  const { activeTournament } = useTournaments();
  const timeLeft = useTimeLeft(activeTournament?.end_time);
  const tournament = activeTournament;
  const isExpired = timeLeft.expired;
  const loading = false;

  if (loading || !activeTournament) return null;

  if (isExpired) {
    return (
      <View style={[styles.banner, styles.expiredBanner]}>
        <Trophy color={colors.gold} size={18} />
        <Text style={styles.expiredText}>Tournament Concluded — Calculating Winners</Text>
      </View>
    );
  }

  return (
    <View style={styles.banner}>
      <View style={styles.topRow}>
        <Trophy color={colors.gold} size={16} />
        <Text style={styles.tournamentName}>{tournament?.name ?? 'DilMeda Championship'}</Text>
      </View>
      <View style={styles.prizeRow}>
        <Text style={styles.prizeLabel}>Grand Prize:</Text>
        <Text style={styles.prizeValue}>{tournament?.prize_pool ?? '—'}</Text>
      </View>
      <View style={styles.countdownRow}>
        <TimeBox value={timeLeft.days} label="DAYS" />
        <Text style={styles.sep}>:</Text>
        <TimeBox value={timeLeft.hours} label="HRS" />
        <Text style={styles.sep}>:</Text>
        <TimeBox value={timeLeft.minutes} label="MIN" />
        <Text style={styles.sep}>:</Text>
        <TimeBox value={timeLeft.seconds} label="SEC" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: 'rgba(35,16,64,0.95)',
    borderBottomWidth: 1.5,
    borderBottomColor: colors.borderGold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  expiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(80,20,20,0.95)',
    borderBottomColor: colors.error,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  tournamentName: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  prizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  prizeLabel: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  prizeValue: {
    color: colors.neon,
    fontSize: 12,
    fontWeight: '700',
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeBox: {
    alignItems: 'center',
    backgroundColor: colors.bgDeep,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 48,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeValue: {
    color: colors.gold,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
  },
  timeLabel: {
    color: colors.textMuted,
    fontSize: 9,
    letterSpacing: 1,
    marginTop: 1,
  },
  sep: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  expiredText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '700',
  },
});
