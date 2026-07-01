import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Dimensions, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Eye, Zap, Star, TrendingUp, Gamepad2, Trophy, Clock,
  ShieldAlert, Sparkles, Award, X, Sunrise, Sun, Moon,
  CheckCircle2, Circle, Flame, ArrowRight, Play
} from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useTournaments, useTimeLeft } from '@/hooks/useTournaments';
import { useFocusEffect, router } from 'expo-router';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/lib/supabase';
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
  const [topPlayers, setTopPlayers] = useState<{ username: string; points: number }[]>([]);
  const [adWatchedToday, setAdWatchedToday] = useState(false);
  const isExpired = timeLeft.expired;

  const checkAdWatchStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const todayStr = new Date().toISOString().split('T')[0];
      const { count, error } = await supabase
        .from('ad_views')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .gte('viewed_at', `${todayStr}T00:00:00.000Z`);

      if (error) {
        console.log('Error checking ad watch status:', error);
      } else {
        setAdWatchedToday((count ?? 0) > 0);
      }
    } catch (err) {
      console.log('Failed to check ad watch status:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refetch();
      refreshPoints();
      refreshTournaments();
      checkAdWatchStatus();
    }, [refetch, refreshPoints, refreshTournaments, checkAdWatchStatus])
  );

  // Fetch top competitors for live engagement feed
  useEffect(() => {
    async function getStandings() {
      try {
        if (activeTournament) {
          const { data } = await supabase
            .from('tournament_points')
            .select('points, profiles(username)')
            .eq('tournament_id', activeTournament.id)
            .order('points', { ascending: false })
            .limit(3);
          if (data) {
            setTopPlayers(data.map((d: any) => ({
              username: d.profiles?.username ?? 'Champion',
              points: d.points
            })));
          }
        } else {
          const { data } = await supabase
            .from('profiles')
            .select('username, points')
            .order('points', { ascending: false })
            .limit(3);
          if (data) {
            setTopPlayers(data.map((d: any) => ({
              username: d.username ?? 'Champion',
              points: d.points
            })));
          }
        }
      } catch (err) {
        console.log('Error fetching standings:', err);
      }
    }
    getStandings();
  }, [activeTournament, profile?.points]);

  const getGreetingConfig = () => {
    const h = new Date().getHours();
    if (h < 12) return { text: t('goodMorning'), icon: Sunrise, color: '#FF9F43' };
    if (h < 17) return { text: t('goodAfternoon'), icon: Sun, color: '#FFCC00' };
    return { text: t('goodEvening'), icon: Moon, color: '#A29BFE' };
  };

  const getRankTier = (pts: number) => {
    if (pts < 100) return { key: 'bronzeLeague', name: 'BRONZE LEAGUE', color: '#CD7F32', next: 100 };
    if (pts < 300) return { key: 'silverLeague', name: 'SILVER LEAGUE', color: '#C0C0C0', next: 300 };
    if (pts < 1000) return { key: 'goldLeague', name: 'GOLD LEAGUE', color: colors.gold, next: 1000 };
    return { key: 'diamondLeague', name: 'DIAMOND LEAGUE', color: colors.neon, next: 99999 };
  };

  const userPts = profile?.points ?? 0;
  const rankTier = getRankTier(userPts);
  const progressToNext = rankTier.next === 99999 ? 100 : ((userPts % rankTier.next) / rankTier.next) * 100;
  const greet = getGreetingConfig();
  const GreetingIcon = greet.icon;

  // Level System (100 Points per Level)
  const userLevel = Math.floor(userPts / 100) + 1;
  const currentLevelXp = userPts % 100;

  // Daily Objectives status checks
  const objectives = [
    { id: 1, title: t('objectiveEarnXPTitle'), desc: t('objectiveEarnXPDesc'), completed: userPts > 0 },
    { id: 2, title: t('objectiveRechargeEnergyTitle'), desc: t('objectiveRechargeEnergyDesc'), completed: adWatchedToday },
    { id: 3, title: t('objectiveReachLevelTitle'), desc: t('objectiveReachLevelDesc'), completed: userPts >= 100 },
    { id: 4, title: t('objectiveContenderTitle'), desc: t('objectiveContenderDesc'), completed: activeTournament !== null }
  ];

  return (
    <SafeAreaView style={styles.root}>
      <ParticleBackground />
      <CountdownBanner />
      
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* GAMER PROFILE HEADER */}
        <View style={styles.header}>
          <View style={styles.avatarRow}>
            <LinearGradient
              colors={[rankTier.color, '#1B0D2D']}
              style={styles.avatarRing}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {(profile?.username ?? 'C').charAt(0).toUpperCase()}
                </Text>
              </View>
            </LinearGradient>
            
            <View>
              <View style={styles.greetingRow}>
                <GreetingIcon color={greet.color} size={13} style={styles.greetIcon} />
                <Text style={styles.greeting}>{greet.text},</Text>
              </View>
              <Text style={styles.username}>{profile?.username ?? t('championPlaceholder')}</Text>
            </View>
          </View>
          
          <View style={styles.headerRight}>
            <View style={styles.levelBadge}>
              <Text style={styles.levelLabel}>{t('lvlLabel')}</Text>
              <Text style={styles.levelValue}>{userLevel}</Text>
            </View>
            <View style={styles.pointsBadge}>
              <Star color={colors.gold} size={14} fill={colors.gold} />
              <Text style={styles.pointsText}>{userPts}</Text>
            </View>
          </View>
        </View>

        {/* BATTLE PASS STATUS BOARD */}
        <LinearGradient
          colors={['#200D3E', '#0E041E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.scoreCard}
        >
          {/* Top border glowing highlight */}
          <LinearGradient
            colors={[rankTier.color, 'rgba(0, 255, 204, 0.4)']}
            style={styles.cardAccentLine}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          
          <View style={styles.scoreCardInner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.scoreLabel}>{t('tournamentPoints')}</Text>
              <Text style={styles.scoreValue}>{userPts}</Text>
              
              <View style={[styles.tierPill, { borderColor: rankTier.color + '60', backgroundColor: rankTier.color + '15' }]}>
                <Award color={rankTier.color} size={12} />
                <Text style={[styles.tierPillText, { color: rankTier.color }]}>{t(rankTier.key as any)}</Text>
              </View>
            </View>
            <View style={[styles.scoreIcon, { borderColor: rankTier.color + '50' }]}>
              <Sparkles color={colors.gold} size={26} />
            </View>
          </View>

          {/* XP Progress Bar */}
          <View style={styles.xpLabelRow}>
            <Text style={styles.xpProgressText}>{t('levelProgress').replace('{level}', String(userLevel))}</Text>
            <Text style={styles.xpProgressVal}>{currentLevelXp} / 100 XP</Text>
          </View>
          <View style={styles.scoreBar}>
            <LinearGradient
              colors={[rankTier.color, '#00FFCC']}
              style={[styles.scoreBarFill, { width: `${Math.max(6, currentLevelXp)}%` }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </View>
        </LinearGradient>

        {/* FEATURED ARENA HERO BANNER */}
        <TouchableOpacity
          style={styles.featuredHeroCard}
          activeOpacity={0.9}
          onPress={() => router.navigate('/games')}
        >
          <LinearGradient
            colors={['#4E0C3E', '#1A0416', '#09010C']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          
          {/* Neon decorative overlays */}
          <View style={styles.heroDecorCircle} />
          
          <View style={styles.featuredHeroContent}>
            <View style={styles.featuredBadgeRow}>
              <View style={styles.featuredBadge}>
                <Flame color="#FF3E6C" size={10} fill="#FF3E6C" />
                <Text style={styles.featuredBadgeText}>{t('featuredGame')}</Text>
              </View>
              <Text style={styles.featuredMultiplier}>{t('xpBonus')}</Text>
            </View>

            <Text style={styles.heroTitle}>{t('gameDeflectorTitle')}</Text>
            <Text style={styles.heroDescription}>
              {t('gameDeflectorSub')}
            </Text>

            <View style={styles.heroFooter}>
              <View style={styles.heroStats}>
                <View style={styles.heroStatTag}>
                  <Text style={styles.heroStatTagText}>{t('fpsReady')}</Text>
                </View>
                <View style={[styles.heroStatTag, { backgroundColor: 'rgba(0, 255, 204, 0.12)' }]}>
                  <Text style={[styles.heroStatTagText, { color: '#00FFCC' }]}>{t('gameDeflectorTag')}</Text>
                </View>
              </View>

              <View style={styles.heroPlayButton}>
                <Text style={styles.heroPlayButtonText}>{t('playNow')}</Text>
                <Play color="#000" size={12} fill="#000" />
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* ENERGY STATION (WATCH AD) */}
        <View style={styles.sectionHeader}>
          <Zap color={colors.neon} size={15} fill={colors.neon} />
          <Text style={styles.sectionTitle}>{t('energyStation')}</Text>
          {isExpired && <Text style={styles.lockedTag}>{t('locked')}</Text>}
        </View>

        <TouchableOpacity
          style={[styles.adCard, isExpired && styles.cardDisabled]}
          onPress={() => !isExpired && setAdModalOpen(true)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={isExpired ? ['#1B1B32', '#1B1B32'] : ['#0C2521', '#06010D']}
            style={styles.adCardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Edge neon glow indicator */}
            <View style={[styles.adEdgeIndicator, { backgroundColor: isExpired ? '#8F7EA6' : colors.neon }]} />

            <View style={styles.adCardContent}>
              <View style={[styles.adIconWrap, { borderColor: isExpired ? colors.textMuted : 'rgba(0, 255, 204, 0.4)' }]}>
                <Eye color={isExpired ? colors.textMuted : colors.neon} size={23} />
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

        {/* ACTIVE TOURNAMENT OR MINI-LEADERBOARD DISPLAY */}
        <View style={styles.sectionHeader}>
          <Trophy color={colors.gold} size={15} fill={colors.gold} />
          <Text style={styles.sectionTitle}>
            {activeTournament ? t('activeBattleLobby') : t('championshipStandings')}
          </Text>
        </View>

        {activeTournament ? (
          <View style={styles.activeTCard}>
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

            {/* Live Challengers Standings inside Card */}
            {topPlayers.length > 0 && (
              <View style={styles.challengersList}>
                <View style={styles.challengerListHeader}>
                  <TrendingUp color="#8F7EA6" size={11} />
                  <Text style={styles.challengerListTitle}>{t('topLobbyContenders')}</Text>
                </View>
                {topPlayers.map((player, idx) => (
                  <View key={idx} style={styles.challengerRow}>
                    <View style={styles.challengerLeft}>
                      <Text style={[styles.challengerRankText, idx === 0 && { color: colors.gold }, idx === 1 && { color: '#C0C0C0' }]}>
                        #{idx + 1}
                      </Text>
                      <Text style={styles.challengerName} numberOfLines={1}>
                        {player.username}
                      </Text>
                    </View>
                    <Text style={styles.challengerScore}>{player.points} pts</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.noTournamentCard}>
            {/* Show Global Standings as dynamic preview */}
            <View style={styles.noTHeader}>
              <ShieldAlert color="#FFCC00" size={18} />
              <Text style={styles.noTournamentText}>{t('noActiveLobby')}</Text>
            </View>
            
            <Text style={styles.noTournamentSub}>
              {t('gamesTabPrompt')}
            </Text>

            {topPlayers.length > 0 && (
              <View style={[styles.challengersList, { marginTop: 12, borderTopWidth: 1, borderTopColor: '#3D1F6E40', paddingTop: 12 }]}>
                <Text style={styles.challengerListTitle}>{t('leaderboardStandings')}</Text>
                {topPlayers.map((player, idx) => (
                  <View key={idx} style={[styles.challengerRow, { backgroundColor: 'rgba(255,255,255,0.01)' }]}>
                    <View style={styles.challengerLeft}>
                      <Text style={[styles.challengerRankText, idx === 0 && { color: colors.gold }, idx === 1 && { color: '#C0C0C0' }]}>
                        #{idx + 1}
                      </Text>
                      <Text style={styles.challengerName}>{player.username}</Text>
                    </View>
                    <Text style={styles.challengerScore}>{player.points} pts</Text>
                  </View>
                ))}
              </View>
            )}
            
            <TouchableOpacity
              style={styles.lobbyRegisterButton}
              activeOpacity={0.8}
              onPress={() => router.navigate('/games')}
            >
              <Text style={styles.lobbyRegisterButtonText}>{t('exploreLiveLobbies')}</Text>
              <ArrowRight color="#000" size={13} />
            </TouchableOpacity>
          </View>
        )}

        {/* TACTICAL OBJECTIVES (DAILY QUESTS) */}
        <View style={styles.sectionHeader}>
          <Gamepad2 color={colors.gold} size={15} />
          <Text style={styles.sectionTitle}>{t('tacticalObjectives')}</Text>
        </View>

        <View style={styles.objectivesList}>
          {objectives.map((obj) => (
            <View key={obj.id} style={[styles.objectiveCard, obj.completed && styles.objectiveCompleted]}>
              <View style={styles.objCheckContainer}>
                {obj.completed ? (
                  <CheckCircle2 color="#00FFCC" size={18} fill="rgba(0, 255, 204, 0.1)" />
                ) : (
                  <Circle color="#8F7EA6" size={18} />
                )}
              </View>
              <View style={styles.objTextContainer}>
                <Text style={[styles.objTitle, obj.completed && styles.objTitleStrikethrough]}>
                  {obj.title}
                </Text>
                <Text style={styles.objDesc}>{obj.desc}</Text>
              </View>
              <View style={[styles.objXpBadge, obj.completed && { borderColor: 'rgba(0,255,204,0.3)' }]}>
                <Text style={[styles.objXpText, obj.completed && { color: '#00FFCC' }]}>DONE</Text>
              </View>
            </View>
          ))}
        </View>
        
      </ScrollView>

      {/* WATCH AD MODAL */}
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
          <AdPlayer onClose={() => setAdModalOpen(false)} onAdWatched={() => setAdWatchedToday(true)} />
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
  avatarRing: {
    width: 50, height: 50, borderRadius: 25,
    padding: 2, alignItems: 'center', justifyContent: 'center',
  },
  avatarCircle: {
    width: '100%', height: '100%', borderRadius: 23,
    backgroundColor: colors.bgDeep, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.textPrimary, fontSize: 18, fontWeight: '900' },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  greetIcon: { transform: [{ translateY: -1 }] },
  greeting: { color: colors.textSecondary, fontSize: 11, fontWeight: '600', opacity: 0.8 },
  username: { color: colors.textPrimary, fontSize: 17, fontWeight: '900', letterSpacing: 0.3 },
  
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  levelBadge: {
    backgroundColor: '#00FFCC12', borderWidth: 1, borderColor: '#00FFCC25',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignItems: 'center',
  },
  levelLabel: { color: '#00FFCC', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  levelValue: { color: '#00FFCC', fontSize: 11, fontWeight: '900', marginTop: -2 },
  
  pointsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#23104080', borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1.5, borderColor: 'rgba(255,215,0,0.3)',
    shadowColor: colors.gold, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 6,
    elevation: 4,
  },
  pointsText: { color: colors.gold, fontSize: 12, fontWeight: '900' },
  
  // Score Card (Battle Pass experience board)
  scoreCard: {
    borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg,
    borderWidth: 1, borderColor: '#3D1F6E70',
    position: 'relative', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12,
    elevation: 6,
  },
  cardAccentLine: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 2.5,
  },
  scoreCardInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  scoreLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  scoreValue: { color: colors.textPrimary, fontSize: 38, fontWeight: '900', lineHeight: 42, letterSpacing: -0.5 },
  tierPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
    marginTop: 6, alignSelf: 'flex-start',
  },
  tierPillText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  scoreIcon: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: '#180B2B',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.2,
  },
  xpLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  xpProgressText: { color: colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  xpProgressVal: { color: colors.textSecondary, fontSize: 9, fontWeight: '900' },
  scoreBar: {
    height: 6, backgroundColor: '#070211', borderRadius: radius.full, overflow: 'hidden',
  },
  scoreBarFill: { height: '100%', borderRadius: radius.full },
  
  // FEATURED GAME CHALLENGE CARD
  featuredHeroCard: {
    height: 160, borderRadius: radius.lg, marginBottom: spacing.lg,
    overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255, 62, 108, 0.25)',
    shadowColor: '#FF3E6C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10,
    elevation: 5,
  },
  heroDecorCircle: {
    position: 'absolute', right: -40, top: -40, width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(255, 62, 108, 0.08)', filter: 'blur(15px)',
  },
  featuredHeroContent: {
    flex: 1, padding: spacing.md, justifyContent: 'space-between',
  },
  featuredBadgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  featuredBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255, 62, 108, 0.15)', borderRadius: radius.sm,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#FF3E6C80',
  },
  featuredBadgeText: { color: '#FF3E6C', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  featuredMultiplier: { color: colors.gold, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  heroTitle: { color: '#FFF', fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
  heroDescription: { color: colors.textSecondary, fontSize: 11, lineHeight: 15, opacity: 0.8 },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroStats: { flexDirection: 'row', gap: 6 },
  heroStatTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: radius.sm,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  heroStatTagText: { color: colors.textSecondary, fontSize: 8, fontWeight: '900' },
  heroPlayButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FFCC00', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: radius.md,
  },
  heroPlayButtonText: { color: '#000', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  // Section layout
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm, marginTop: 4 },
  sectionTitle: { color: '#8F7EA6', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, flex: 1 },
  lockedTag: {
    color: colors.error, fontSize: 9, fontWeight: '900', letterSpacing: 1,
    backgroundColor: 'rgba(255,68,68,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.error + '40',
  },
  
  // Ad Recharge Card
  adCard: { marginBottom: spacing.lg, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(0, 255, 204, 0.25)' },
  cardDisabled: { borderColor: colors.border, opacity: 0.5 },
  adCardGradient: { borderRadius: radius.lg, position: 'relative' },
  adEdgeIndicator: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 3.5 },
  adCardContent: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md, paddingLeft: 16 },
  adIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#0A201C', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.2, position: 'relative',
  },
  pulseDot: {
    position: 'absolute', top: 2, right: 2, width: 6, height: 6, borderRadius: 3,
  },
  adCardText: { flex: 1 },
  adCardTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  adCardSub: { color: colors.textSecondary, fontSize: 10.5, marginTop: 2, opacity: 0.8 },
  textDisabled: { color: colors.textMuted },
  adEarnBadge: {
    backgroundColor: 'rgba(0,255,204,0.15)', borderRadius: radius.md,
    paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: colors.neonDim,
  },
  adEarnText: { color: colors.neon, fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  
  // Active Tournament Card
  activeTCard: {
    backgroundColor: '#1B0E32', borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: 'rgba(255,215,0,0.3)',
    padding: spacing.md, marginBottom: spacing.lg, gap: spacing.md,
    shadowColor: colors.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8,
    elevation: 5,
  },
  activeTRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lobbyMissionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  liveIndicator: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF3E6C',
    alignItems: 'center', justifyContent: 'center',
  },
  liveIndicatorPulse: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,62,108,0.4)',
    position: 'absolute',
  },
  activeTName: { color: colors.textPrimary, fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },
  activeTBadge: {
    backgroundColor: 'rgba(255,215,0,0.1)', borderRadius: radius.sm,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.gold,
  },
  activeTBadgeText: { color: colors.gold, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  statsGrid: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1, backgroundColor: '#0F0422', borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: '#3D1F6E50',
  },
  statValue: { fontSize: 13, fontWeight: '900', textAlign: 'center', marginTop: 3 },
  statLabel: { color: colors.textMuted, fontSize: 8.5, fontWeight: '800', letterSpacing: 0.5, textAlign: 'center' },
  
  // Challengers List
  challengersList: {
    backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: radius.md,
    padding: spacing.sm, gap: 6, borderWidth: 1, borderColor: '#3D1F6E35',
  },
  challengerListHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  challengerListTitle: { color: '#8F7EA6', fontSize: 8.5, fontWeight: '900', letterSpacing: 1 },
  challengerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, paddingHorizontal: 8, borderRadius: radius.sm,
  },
  challengerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  challengerRankText: { color: '#8F7EA6', fontSize: 11, fontWeight: '900', width: 22 },
  challengerName: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  challengerScore: { color: colors.textPrimary, fontSize: 11, fontWeight: '900' },

  // No Active Lobby joined placeholder
  noTournamentCard: {
    backgroundColor: '#170B27', borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: '#3D1F6E50',
    padding: spacing.md, marginBottom: spacing.lg,
  },
  noTHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  noTournamentText: { color: colors.textPrimary, fontSize: 13, fontWeight: '900' },
  noTournamentSub: { color: colors.textMuted, fontSize: 10.5, lineHeight: 15, marginBottom: 8 },
  lobbyRegisterButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#FFCC00', paddingVertical: 10, borderRadius: radius.md,
    marginTop: 8,
  },
  lobbyRegisterButtonText: { color: '#000', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  
  // DAILY QUESTS / TACTICAL OBJECTIVES
  objectivesList: { gap: spacing.sm, marginBottom: spacing.lg },
  objectiveCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#14082590',
    borderRadius: radius.md, padding: spacing.md, gap: spacing.sm,
    borderWidth: 1, borderColor: '#3D1F6E40',
  },
  objectiveCompleted: {
    borderColor: 'rgba(0, 255, 204, 0.25)',
    backgroundColor: '#091C1760',
  },
  objCheckContainer: { justifyContent: 'center', alignItems: 'center' },
  objTextContainer: { flex: 1, gap: 2 },
  objTitle: { color: colors.textPrimary, fontSize: 12, fontWeight: '900' },
  objTitleStrikethrough: { color: '#8F7EA6', textDecorationLine: 'line-through', opacity: 0.8 },
  objDesc: { color: colors.textMuted, fontSize: 9.5 },
  objXpBadge: {
    borderWidth: 1, borderColor: '#3D1F6E50', borderRadius: radius.sm,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  objXpText: { color: '#8F7EA6', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  
  modalRoot: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { color: colors.gold, fontSize: 18, fontWeight: '800' },
  closeBtn: { padding: 6 },
});
