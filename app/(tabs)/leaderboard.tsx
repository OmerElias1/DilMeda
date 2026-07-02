import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy, RefreshCw, Medal, Globe, Swords, Star, Award, Shield, User, Flame, Gamepad2 } from 'lucide-react-native';
import { supabase, Profile } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useTournaments } from '@/hooks/useTournaments';
import { useFocusEffect } from 'expo-router';
import { useLanguage } from '@/hooks/useLanguage';
import ParticleBackground from '@/components/ParticleBackground';
import { colors, spacing, radius, shadow } from '@/constants/theme';

const RANK_COLORS = [colors.gold, colors.silver, colors.bronze];
const MEDAL_GLOW = ['rgba(255, 215, 0, 0.25)', 'rgba(192, 192, 192, 0.2)', 'rgba(205, 127, 50, 0.2)'];

type LeaderRow = { id: string; username: string | null; points: number; games_played?: number; daily_streak?: number };

// Helper to match level/tier style with profile page
function getLevelInfo(points: number) {
  if (points >= 10000) return { tierKey: 'tierLegend' as const, color: '#FF6B6B' };
  if (points >= 5000)  return { tierKey: 'tierMaster' as const, color: '#FFD700' };
  if (points >= 2500)  return { tierKey: 'tierDiamond' as const, color: '#00FFCC' };
  if (points >= 1000)  return { tierKey: 'tierGold' as const, color: '#FFD700' };
  if (points >= 500)   return { tierKey: 'tierSilver' as const, color: '#C0C0C0' };
  if (points >= 100)   return { tierKey: 'tierBronze' as const, color: '#CD7F32' };
  return { tierKey: 'tierRookie' as const, color: '#8F7EA6' };
}

function PodiumBlock({ player, rank }: { player: LeaderRow; rank: number }) {
  const c = RANK_COLORS[rank - 1] ?? colors.textMuted;
  const glow = MEDAL_GLOW[rank - 1] ?? 'rgba(255,255,255,0.02)';
  const isFirst = rank === 1;
  const { t } = useLanguage();
  const levelInfo = getLevelInfo(player.points);

  return (
    <View style={[styles.podiumPlayer, isFirst && styles.podiumFirst, { borderColor: c, backgroundColor: glow }]}>
      {isFirst && (
        <View style={styles.crownContainer}>
          <Trophy color={colors.gold} size={28} fill={colors.gold} />
        </View>
      )}
      
      <View style={styles.medalIconWrap}>
        <Medal color={c} size={20} fill={rank <= 3 ? c : 'transparent'} />
      </View>

      <View style={[styles.podiumAvatar, { borderColor: c }]}>
        <Text style={styles.podiumAvatarText}>{(player.username ?? 'U').charAt(0).toUpperCase()}</Text>
        <View style={[styles.miniBadge, { backgroundColor: levelInfo.color }]} />
      </View>

      <Text style={styles.podiumName} numberOfLines={1}>{player.username ?? 'Player'}</Text>
      
      <View style={styles.pointsBadgeMini}>
        <Text style={[styles.podiumPts, { color: c }]}>{player.points}</Text>
        <Text style={styles.podiumPtsLabel}>PTS</Text>
      </View>

      {/* Stand Details */}
      <View style={[styles.pedestalStand, { backgroundColor: c + '30', height: isFirst ? 32 : 24 }]}>
        <Text style={[styles.pedestalRankText, { color: c }]}>{t('rankWord')} {rank}</Text>
      </View>
    </View>
  );
}

export default function LeaderboardScreen() {
  const { profile: myProfile } = useAuth();
  const { activeTournament, myTournamentPoints } = useTournaments();
  const { t } = useLanguage();

  const [tab, setTab] = useState<'tournament' | 'global'>(activeTournament ? 'tournament' : 'global');
  const [tPlayers, setTPlayers] = useState<LeaderRow[]>([]);
  const [gPlayers, setGPlayers] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTournamentLB = useCallback(async () => {
    if (!activeTournament) return;
    const { data } = await supabase
      .from('tournament_points')
      .select('user_id, points, profiles(username, games_played, daily_streak)')
      .eq('tournament_id', activeTournament.id)
      .order('points', { ascending: false })
      .limit(50);
    if (data) {
      setTPlayers(data.map((r: any) => ({
        id: r.user_id,
        username: r.profiles?.username ?? null,
        points: r.points,
        games_played: r.profiles?.games_played ?? 0,
        daily_streak: r.profiles?.daily_streak ?? 0,
      })));
    }
  }, [activeTournament]);

  const fetchGlobalLB = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('points', { ascending: false })
      .limit(50);
    if (data) {
      setGPlayers(data.map((p: Profile) => ({
        id: p.id,
        username: p.username,
        points: p.points,
        games_played: p.games_played,
        daily_streak: p.daily_streak,
      })));
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchTournamentLB(), fetchGlobalLB()]);
    setLoading(false);
  }, [fetchTournamentLB, fetchGlobalLB]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    if (activeTournament) setTab('tournament');
  }, [activeTournament?.id]);

  const players = tab === 'tournament' ? tPlayers : gPlayers;
  const myPoints = tab === 'tournament' ? myTournamentPoints : (myProfile?.points ?? 0);
  const myRank = players.findIndex(p => p.id === myProfile?.id) + 1;

  // Render Podium elements (1st, 2nd, 3rd)
  const renderPodium = () => {
    if (players.length < 3) return null;
    
    // Ordered as [2nd, 1st, 3rd] for classic visual pedestal layout
    const podiumOrder = [1, 0, 2];
    
    return (
      <View style={styles.podiumContainer}>
        <View style={styles.podium}>
          {podiumOrder.map(idx => {
            const p = players[idx];
            if (!p) return null;
            return <PodiumBlock key={p.id} player={p} rank={idx + 1} />;
          })}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <ParticleBackground />

      {/* Header */}
      <LinearGradient colors={['#270C4E', '#0D0618']} style={styles.header}>
        <Trophy color={colors.gold} size={22} fill={colors.gold} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('leaderboardStandings')}</Text>
          {activeTournament && tab === 'tournament' ? (
            <Text style={styles.headerSub}>{activeTournament.name}</Text>
          ) : (
            <Text style={styles.headerSub}>{t('competeWorldwide')}</Text>
          )}
        </View>
        <TouchableOpacity onPress={refresh} style={styles.refreshBtn}>
          <RefreshCw color={colors.textSecondary} size={16} />
        </TouchableOpacity>
      </LinearGradient>

      {/* Switch tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'tournament' && styles.tabBtnActive]}
          onPress={() => setTab('tournament')}
        >
          <Swords color={tab === 'tournament' ? colors.gold : '#8F7EA6'} size={14} />
          <Text style={[styles.tabBtnText, tab === 'tournament' && styles.tabBtnTextActive]}>
            {t('tournamentArena')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'global' && styles.tabBtnActive]}
          onPress={() => setTab('global')}
        >
          <Globe color={tab === 'global' ? colors.gold : '#8F7EA6'} size={14} />
          <Text style={[styles.tabBtnText, tab === 'global' && styles.tabBtnTextActive]}>
            {t('globalArena')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* My Rank Gamer Banner Card */}
      {myProfile && (
        <View style={styles.myRankBanner}>
          <LinearGradient
            colors={['rgba(255,215,0,0.15)', 'rgba(28,13,50,0.8)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.myRankGradient}
          >
            <View style={styles.myRankLeft}>
              <View style={[styles.myRankBadgeWrap, { borderColor: myRank <= 3 && myRank > 0 ? RANK_COLORS[myRank - 1] : colors.gold }]}>
                <Award color={myRank <= 3 && myRank > 0 ? RANK_COLORS[myRank - 1] : colors.gold} size={18} />
              </View>
              <View>
                <Text style={styles.myRankText}>{t('yourCurrentStanding')}</Text>
                <Text style={styles.myRankValue}>
                  {myRank > 0 ? `${t('rankWord')} #${myRank}` : 'Unranked'}
                </Text>
              </View>
            </View>
            <View style={styles.myRankRight}>
              <Text style={styles.myRankPts}>{myPoints.toLocaleString()}</Text>
              <Text style={styles.myRankPtsLabel}>TOTAL PTS</Text>
            </View>
          </LinearGradient>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>{t('fetchingStandings')}</Text>
        </View>
      ) : players.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>
            {tab === 'tournament' && !activeTournament
              ? t('joinTournamentFirstToCompete')
              : t('arenaOpenBeFirst')}
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Pedestal Top 3 Podium */}
          {renderPodium()}

          {/* List Card for ranks */}
          <View style={styles.listCard}>
            {players.map((p, i) => {
              const isMe = p.id === myProfile?.id;
              const rank = i + 1;
              const levelInfo = getLevelInfo(p.points);

              return (
                <View
                  key={p.id}
                  style={[
                    styles.listRow,
                    isMe && styles.listRowMe,
                    i < players.length - 1 && styles.listRowBorder
                  ]}
                >
                  {/* Rank Column */}
                  <View style={styles.rankCol}>
                    {rank <= 3 ? (
                      <View style={[styles.listMedalWrap, { borderColor: RANK_COLORS[rank - 1] }]}>
                        <Medal color={RANK_COLORS[rank - 1]} size={16} fill={RANK_COLORS[rank - 1]} />
                      </View>
                    ) : (
                      <Text style={[styles.rankNum, rank <= 10 && { color: colors.gold, fontWeight: '900' }]}>
                        #{rank}
                      </Text>
                    )}
                  </View>

                  {/* Avatar with dynamic level ring */}
                  <View style={[styles.avatar, { borderColor: levelInfo.color }]}>
                    <Text style={styles.avatarText}>{(p.username ?? 'U').charAt(0).toUpperCase()}</Text>
                  </View>

                  {/* Player Stats & Username Info */}
                  <View style={styles.playerInfo}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.playerName, isMe && styles.playerNameMe]} numberOfLines={1}>
                        {p.username ?? 'Player'}{isMe ? t('youLabel') : ''}
                      </Text>
                      <View style={[styles.levelTag, { backgroundColor: levelInfo.color + '15', borderColor: levelInfo.color + '40' }]}>
                        <Text style={[styles.levelTagText, { color: levelInfo.color }]}>{t(levelInfo.tierKey)}</Text>
                      </View>
                    </View>

                    {/* Stats subtitle */}
                    <View style={styles.playerSubStats}>
                      <Gamepad2 color={colors.textMuted} size={10} />
                      <Text style={styles.playerSubStatsText}>{p.games_played ?? 0} games</Text>
                      {p.daily_streak !== undefined && p.daily_streak > 0 && (
                        <>
                          <View style={styles.dotSeparator} />
                          <Flame color="#FF6B6B" size={10} fill="#FF6B6B" />
                          <Text style={styles.playerSubStatsText}>{p.daily_streak} day streak</Text>
                        </>
                      )}
                    </View>
                  </View>
                  
                  {/* Points display */}
                  <View style={styles.ptsWrapper}>
                    <Text style={[styles.pts, rank === 1 && { color: colors.gold }]}>
                      {p.points.toLocaleString()}
                    </Text>
                    <Text style={styles.ptsLabel}>PTS</Text>
                  </View>
                </View>
              );
            })}
          </View>
          <View style={{ height: 110 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm,
    borderBottomWidth: 1.5, borderBottomColor: '#3D1F6E60',
  },
  headerTitle: { color: colors.gold, fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  headerSub: { color: colors.textSecondary, fontSize: 11, opacity: 0.8 },
  refreshBtn: { padding: 8 },
  tabRow: {
    flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: '#3D1F6E60',
    backgroundColor: '#0D0618',
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14,
  },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: colors.gold },
  tabBtnText: { color: '#8F7EA6', fontWeight: '800', fontSize: 11, letterSpacing: 0.5 },
  tabBtnTextActive: { color: colors.gold },
  
  // My Rank Banner Card
  myRankBanner: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  myRankGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 215, 0, 0.25)',
  },
  myRankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  myRankBadgeWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    backgroundColor: '#0D0618',
    justifyContent: 'center',
    alignItems: 'center',
  },
  myRankText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  myRankValue: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 1,
  },
  myRankRight: {
    alignItems: 'flex-end',
  },
  myRankPts: {
    color: colors.neon,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  myRankPtsLabel: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md },
  
  // Podium Stands
  podiumContainer: {
    backgroundColor: 'rgba(28,13,50,0.4)',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: '#3D1F6E40',
    marginBottom: spacing.lg,
  },
  podium: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end',
    gap: spacing.sm,
  },
  podiumPlayer: {
    alignItems: 'center', flex: 1, gap: 4,
    borderRadius: radius.lg, padding: 8,
    borderWidth: 1.5, overflow: 'hidden',
    position: 'relative',
  },
  podiumFirst: {
    transform: [{ translateY: -8 }],
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  crownContainer: {
    position: 'absolute',
    top: -2,
    alignSelf: 'center',
    zIndex: 10,
  },
  medalIconWrap: { marginBottom: 2, zIndex: 5 },
  podiumAvatar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: '#0D0618',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2,
    position: 'relative',
  },
  miniBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#0D0618',
  },
  podiumAvatarText: { color: colors.textPrimary, fontSize: 16, fontWeight: '900' },
  podiumName: { color: colors.textPrimary, fontSize: 11, fontWeight: '900', maxWidth: 85, textAlign: 'center' },
  pointsBadgeMini: { flexDirection: 'row', alignItems: 'baseline', gap: 2, marginTop: 2 },
  podiumPts: { fontSize: 14, fontWeight: '900' },
  podiumPtsLabel: { color: colors.textMuted, fontSize: 8, fontWeight: '800' },
  
  pedestalStand: {
    width: '120%', marginTop: 8, marginBottom: -10,
    alignItems: 'center', justifyContent: 'center',
  },
  pedestalRankText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  
  // List styling
  listCard: {
    backgroundColor: '#1C0D3280', borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: '#3D1F6E60', overflow: 'hidden',
  },
  listRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm },
  listRowMe: { backgroundColor: 'rgba(255,215,0,0.06)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)' },
  listRowBorder: { borderBottomWidth: 1.5, borderBottomColor: '#0A0314' },
  rankCol: { width: 34, alignItems: 'center' },
  listMedalWrap: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0314',
  },
  rankNum: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  avatar: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#0A0314',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
  },
  avatarText: { color: colors.textPrimary, fontSize: 13, fontWeight: '900' },
  playerInfo: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  playerName: { color: colors.textPrimary, fontSize: 13, fontWeight: '800' },
  playerNameMe: { color: colors.gold, fontWeight: '900' },
  levelTag: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  levelTagText: {
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  playerSubStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playerSubStatsText: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: '600',
  },
  dotSeparator: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textMuted,
    marginHorizontal: 2,
  },
  ptsWrapper: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  pts: { color: colors.textPrimary, fontSize: 14, fontWeight: '900' },
  ptsLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '800', width: 22 },
});
