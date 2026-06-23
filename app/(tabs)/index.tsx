import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, Zap, Star, TrendingUp, Gamepad2, Trophy, Clock, ShieldAlert, Sparkles, Award, X } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useTournaments, useTimeLeft } from '@/hooks/useTournaments';
import { useFocusEffect } from 'expo-router';
import { useLanguage } from '@/hooks/useLanguage';
import CountdownBanner from '@/components/CountdownBanner';
import ParticleBackground from '@/components/ParticleBackground';
import AdPlayer from '@/components/AdPlayer';
import { colors, spacing, radius, shadow } from '@/constants/theme';

export default function HomeScreen() {
  const { profile } = useAuth();
  const { activeTournament, myTournamentPoints, tournaments, refetch, refreshPoints, refreshTournaments } = useTournaments();
  const { t } = useLanguage();
  const timeLeft = useTimeLeft(activeTournament?.end_time);
  const [adModalOpen, setAdModalOpen] = useState(false);
  const isExpired = timeLeft.expired;

  useFocusEffect(
    useCallback(() => {
      refetch();
      refreshPoints();
      refreshTournaments();
    }, [refetch, refreshPoints, refreshTournaments])
  );

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('goodMorning');
    if (h < 17) return t('goodAfternoon');
    return t('goodEvening');
  };

  const getRankTier = (pts: number) => {
    if (pts < 100) return { name: 'BRONZE LEAGUE', color: '#CD7F32' };
    if (pts < 300) return { name: 'SILVER LEAGUE', color: '#C0C0C0' };
    if (pts < 1000) return { name: 'GOLD LEAGUE', color: colors.gold };
    return { name: 'DIAMOND LEAGUE', color: colors.neon };
  };

  const userPts = profile?.points ?? 0;
  const rankTier = getRankTier(userPts);

  return (
    <SafeAreaView style={styles.root}>
      <ParticleBackground />
      <CountdownBanner />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Gamer Header */}
        <View style={styles.header}>
          <View style={styles.avatarRow}>
            <View style={[styles.avatarCircle, { borderColor: rankTier.color }]}>
              <Text style={styles.avatarText}>
                {(profile?.username ?? 'C').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.greeting}>{greeting()},</Text>
              <Text style={styles.username}>{profile?.username ?? 'Champion'}</Text>
            </View>
          </View>
          <View style={styles.pointsBadge}>
            <Star color={colors.gold} size={15} fill={colors.gold} />
            <Text style={styles.pointsText}>{userPts}</Text>
          </View>
        </View>

        {/* Battle Pass / Experience Tracker Card */}
        <LinearGradient
          colors={['#270C4E', '#110524']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.scoreCard}
        >
          {/* Top border neon line */}
          <View style={[styles.cardAccentLine, { backgroundColor: rankTier.color }]} />
          
          <View style={styles.scoreCardInner}>
            <View>
              <Text style={styles.scoreLabel}>{t('tournamentPoints')}</Text>
              <Text style={styles.scoreValue}>{userPts}</Text>
              
              <View style={[styles.tierPill, { borderColor: rankTier.color + '60', backgroundColor: rankTier.color + '18' }]}>
                <Award color={rankTier.color} size={13} />
                <Text style={[styles.tierPillText, { color: rankTier.color }]}>{rankTier.name}</Text>
              </View>
            </View>
            <View style={[styles.scoreIcon, { borderColor: rankTier.color + '50' }]}>
              <Sparkles color={colors.gold} size={28} />
            </View>
          </View>

          <View style={styles.xpLabelRow}>
            <Text style={styles.xpProgressText}>{t('xpProgress')}</Text>
            <Text style={styles.xpProgressVal}>{userPts % 100} / 100</Text>
          </View>
          <View style={styles.scoreBar}>
            <View style={[styles.scoreBarFill, { width: `${Math.max(8, userPts % 100)}%`, backgroundColor: rankTier.color }]} />
          </View>
        </LinearGradient>

        {/* Watch Ad - Energy Station */}
        <View style={styles.sectionHeader}>
          <Zap color={colors.neon} size={16} fill={colors.neon} />
          <Text style={styles.sectionTitle}>{t('energyStation')}</Text>
          {isExpired && <Text style={styles.lockedTag}>{t('locked')}</Text>}
        </View>

        <TouchableOpacity
          style={[styles.adCard, isExpired && styles.cardDisabled]}
          onPress={() => !isExpired && setAdModalOpen(true)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={isExpired ? ['#1A1A2E', '#1A1A2E'] : ['#1E3B33', '#110524']}
            style={styles.adCardGradient}
          >
            <View style={styles.adCardContent}>
              <View style={[styles.adIconWrap, { borderColor: isExpired ? colors.textMuted : colors.neon }]}>
                <Eye color={isExpired ? colors.textMuted : colors.neon} size={26} />
                <View style={[styles.pulseDot, { backgroundColor: isExpired ? colors.textMuted : colors.neon }]} />
              </View>
              <View style={styles.adCardText}>
                <Text style={[styles.adCardTitle, isExpired && styles.textDisabled]}>{t('rechargeEnergy')}</Text>
                <Text style={[styles.adCardSub, isExpired && styles.textDisabled]}>
                  {isExpired ? t('tournamentEnded') : t('watchAdSecurePts')}
                </Text>
              </View>
              {!isExpired && (
                <View style={styles.adEarnBadge}>
                  <Text style={styles.adEarnText}>+5 PTS</Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Active Arena / Mission Details */}
        <View style={styles.sectionHeader}>
          <Trophy color={colors.gold} size={16} fill={colors.gold} />
          <Text style={styles.sectionTitle}>
            {activeTournament ? t('activeLobby') : t('availableLobbies')}
          </Text>
        </View>

        {activeTournament ? (
          <View style={styles.activeTCard}>
            <View style={styles.activeTCardGlow} />
            <View style={styles.activeTRow}>
              <View style={styles.lobbyMissionTitleRow}>
                <View style={styles.liveIndicator}>
                  <View style={styles.liveIndicatorPulse} />
                </View>
                <Text style={styles.activeTName} numberOfLines={1}>{activeTournament.name}</Text>
              </View>
              <View style={styles.activeTBadge}>
                <Text style={styles.activeTBadgeText}>{t('liveLobby')}</Text>
              </View>
            </View>
            
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{t('grandPrize')}</Text>
                <Text style={[styles.statValue, { color: colors.gold }]}>{activeTournament.prize_pool}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{t('myScore')}</Text>
                <Text style={[styles.statValue, { color: colors.neon }]}>{myTournamentPoints}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{t('timeRemaining')}</Text>
                <Text style={[styles.statValue, { color: '#FF9F43' }]}>
                  {isExpired ? t('ended') : `${timeLeft.days}d ${timeLeft.hours}h`}
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.noTournamentCard}>
            <ShieldAlert color={colors.textMuted} size={32} />
            <Text style={styles.noTournamentText}>{t('noActiveLobby')}</Text>
            <Text style={styles.noTournamentSub}>
              {t('gamesTabPrompt')}
            </Text>
          </View>
        )}

        {/* Tutorial Missions / How to Earn */}
        <View style={styles.sectionHeader}>
          <Gamepad2 color={colors.gold} size={16} />
          <Text style={styles.sectionTitle}>{t('tacticalObjectives')}</Text>
        </View>
        <View style={styles.howGrid}>
          {[
            { icon: Gamepad2, title: t('playGames'), sub: t('dodgeClickMatch'), color: colors.neon },
            { icon: Eye, title: t('watchAds'), sub: t('rechargePointsAnytime'), color: '#FF9F43' },
            { icon: Zap, title: t('spinWheel'), sub: t('unlockDailyLucky'), color: colors.gold },
            { icon: Trophy, title: t('rankHigh'), sub: t('secureTop3'), color: '#FF5E7E' },
          ].map((item, i) => (
            <View key={i} style={styles.howCard}>
              <View style={[styles.howIconWrap, { borderColor: item.color + '40', backgroundColor: item.color + '10' }]}>
                <item.icon color={item.color} size={22} fill={item.color === colors.gold ? colors.gold : 'transparent'} />
              </View>
              <Text style={styles.howTitle}>{item.title}</Text>
              <Text style={styles.howSub}>{item.sub}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={adModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAdModalOpen(false)}
      >
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('watchEarn')}</Text>
            <TouchableOpacity onPress={() => setAdModalOpen(false)} style={styles.closeBtn}>
              <X color={colors.textSecondary} size={22} />
            </TouchableOpacity>
          </View>
          <AdPlayer onClose={() => setAdModalOpen(false)} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 110 },
  
  // Header Gamer Profile style
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: spacing.lg, paddingTop: spacing.sm,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarCircle: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: colors.bgDeep, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5,
  },
  avatarText: { color: colors.textPrimary, fontSize: 20, fontWeight: '900' },
  greeting: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', opacity: 0.7 },
  username: { color: colors.textPrimary, fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  pointsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#23104080', borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1.5, borderColor: 'rgba(255,215,0,0.4)',
    shadowColor: colors.gold, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 8,
    elevation: 5,
  },
  pointsText: { color: colors.gold, fontSize: 14, fontWeight: '900', letterSpacing: 0.2 },
  
  // Score Card (Battle Pass experience board)
  scoreCard: {
    borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg,
    borderWidth: 1, borderColor: '#3D1F6E80',
    position: 'relative', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16,
    elevation: 8,
  },
  cardAccentLine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
  },
  scoreCardInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  scoreLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  scoreValue: { color: colors.textPrimary, fontSize: 44, fontWeight: '900', lineHeight: 48, letterSpacing: -0.5 },
  tierPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
    marginTop: 6, alignSelf: 'flex-start',
  },
  tierPillText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  scoreIcon: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: '#1C0E32',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
  },
  xpLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  xpProgressText: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  xpProgressVal: { color: colors.textSecondary, fontSize: 10, fontWeight: '900' },
  scoreBar: {
    height: 6, backgroundColor: '#0A0314', borderRadius: radius.full, overflow: 'hidden',
  },
  scoreBarFill: { height: '100%', borderRadius: radius.full },
  
  // Section layout
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm, marginTop: 4 },
  sectionTitle: { color: '#8F7EA6', fontSize: 12, fontWeight: '900', letterSpacing: 1.2, flex: 1 },
  lockedTag: {
    color: colors.error, fontSize: 9, fontWeight: '900', letterSpacing: 1,
    backgroundColor: 'rgba(255,68,68,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.error + '40',
  },
  
  // Ad Recharge Card
  adCard: { marginBottom: spacing.lg, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0, 255, 204, 0.25)' },
  cardDisabled: { borderColor: colors.border, opacity: 0.5 },
  adCardGradient: { borderRadius: radius.lg },
  adCardContent: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
  adIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#0E2420', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, position: 'relative',
  },
  pulseDot: {
    position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: 4,
  },
  adCardText: { flex: 1 },
  adCardTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  adCardSub: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  textDisabled: { color: colors.textMuted },
  adEarnBadge: {
    backgroundColor: 'rgba(0,255,204,0.15)', borderRadius: radius.md,
    paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: colors.neonDim,
  },
  adEarnText: { color: colors.neon, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  
  // Active Tournament Card
  activeTCard: {
    backgroundColor: '#1E0E35', borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: 'rgba(255,215,0,0.35)',
    padding: spacing.md, marginBottom: spacing.lg, gap: spacing.md,
    position: 'relative', overflow: 'hidden',
    shadowColor: colors.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10,
    elevation: 6,
  },
  activeTCardGlow: {
    position: 'absolute', top: -50, right: -50, width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,215,0,0.06)', filter: 'blur(20px)',
  },
  activeTRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lobbyMissionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  liveIndicator: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF4444',
    alignItems: 'center', justifyContent: 'center',
  },
  liveIndicatorPulse: {
    width: 14, height: 14, borderRadius: 7, backgroundColor: '#FF444440',
    position: 'absolute',
  },
  activeTName: { color: colors.textPrimary, fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  activeTBadge: {
    backgroundColor: 'rgba(255,215,0,0.12)', borderRadius: radius.sm,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.gold,
  },
  activeTBadgeText: { color: colors.gold, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  statsGrid: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1, backgroundColor: '#110524B3', borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: '#3D1F6E70',
  },
  statValue: { fontSize: 14, fontWeight: '900', textAlign: 'center', marginTop: 3 },
  statLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.5, textAlign: 'center' },
  
  // No Active Lobby joined placeholder
  noTournamentCard: {
    backgroundColor: '#1B0D2D', borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: '#3D1F6E60',
    padding: spacing.xl, alignItems: 'center', gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  noTournamentText: { color: colors.textSecondary, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  noTournamentSub: { color: colors.textMuted, fontSize: 11, textAlign: 'center', lineHeight: 16 },
  
  // Tactical Objectives (How to Earn)
  howGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  howCard: {
    width: '47.5%', backgroundColor: '#1A0B2E80', borderRadius: radius.lg,
    padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: '#3D1F6E60',
    gap: 6,
  },
  howIconWrap: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  howTitle: { color: colors.textPrimary, fontSize: 12, fontWeight: '900', textAlign: 'center', letterSpacing: 0.2 },
  howSub: { color: colors.textMuted, fontSize: 10, textAlign: 'center', lineHeight: 14 },
  
  modalRoot: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { color: colors.gold, fontSize: 18, fontWeight: '800' },
  closeBtn: { padding: 6 },
});
