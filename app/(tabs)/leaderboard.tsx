import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy, RefreshCw, Medal, Globe, Swords, Star, Award } from 'lucide-react-native';
import { supabase, Profile } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useTournaments } from '@/hooks/useTournaments';
import { useFocusEffect } from 'expo-router';
import { useLanguage } from '@/hooks/useLanguage';
import ParticleBackground from '@/components/ParticleBackground';
import { colors, spacing, radius, shadow } from '@/constants/theme';

const RANK_COLORS = [colors.gold, colors.silver, colors.bronze];
const MEDAL_GLOW = ['rgba(255, 215, 0, 0.2)', 'rgba(192, 192, 192, 0.15)', 'rgba(205, 127, 50, 0.15)'];

type LeaderRow = { id: string; username: string | null; points: number };

function PodiumBlock({ player, rank }: { player: LeaderRow; rank: number }) {
  const c = RANK_COLORS[rank - 1] ?? colors.textMuted;
  const glow = MEDAL_GLOW[rank - 1] ?? 'rgba(255,255,255,0.02)';
  const isFirst = rank === 1;
  const { t } = useLanguage();
  return (
    <View style={[styles.podiumPlayer, isFirst && styles.podiumFirst, { borderColor: c, backgroundColor: glow }]}>
      <View style={styles.medalIconWrap}>
        <Medal color={c} size={24} fill={rank <= 3 ? c : 'transparent'} />
      </View>
      <View style={[styles.podiumAvatar, { borderColor: c }]}>
        <Text style={styles.podiumAvatarText}>{(player.username ?? 'U').charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={styles.podiumName} numberOfLines={1}>{player.username ?? 'Player'}</Text>
      <View style={styles.pointsBadgeMini}>
        <Text style={[styles.podiumPts, { color: c }]}>{player.points}</Text>
        <Text style={styles.podiumPtsLabel}>PTS</Text>
      </View>
      
      {/* Pedestal stand styling */}
      <View style={[styles.pedestalStand, { backgroundColor: c + '40', height: isFirst ? 28 : 18 }]}>
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
      .select('user_id, points, profiles(username)')
      .eq('tournament_id', activeTournament.id)
      .order('points', { ascending: false })
      .limit(50);
    if (data) {
      setTPlayers(data.map((r: any) => ({
        id: r.user_id,
        username: r.profiles?.username ?? null,
        points: r.points,
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
      setGPlayers(data.map((p: Profile) => ({ id: p.id, username: p.username, points: p.points })));
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

  return (
    <SafeAreaView style={styles.root}>
      <ParticleBackground />

      {/* Header */}
      <LinearGradient colors={['#270C4E', '#0D0618']} style={styles.header}>
        <Trophy color={colors.gold} size={20} fill={colors.gold} />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{t('leaderboardStandings')}</Text>
          {activeTournament && tab === 'tournament' ? (
            <Text style={styles.headerSub}>{activeTournament.name}</Text>
          ) : (
            <Text style={styles.headerSub}>{t('competeWorldwide')}</Text>
          )}
        </View>
        <TouchableOpacity onPress={refresh} style={styles.refreshBtn}>
          <RefreshCw color={colors.textMuted} size={15} />
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

      {/* My rank bar styled as a gamer stat banner */}
      {myProfile && (
        <View style={styles.myRankBar}>
          <Award color={colors.gold} size={15} />
          <Text style={styles.myRankText}>{t('yourCurrentStanding')}</Text>
          <Text style={styles.myRankValue}>#{myRank > 0 ? myRank : '—'}</Text>
          <View style={styles.bulletSeparator} />
          <Text style={styles.myRankPts}>{myPoints} PTS</Text>
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
          {/* Podium Blocks */}
          {players.length >= 3 && (
            <View style={styles.podium}>
              {[1, 0, 2].map(idx => {
                const p = players[idx];
                if (!p) return null;
                return <PodiumBlock key={p.id} player={p} rank={idx + 1} />;
              })}
            </View>
          )}

          {/* Leaderboard list */}
          <View style={styles.listCard}>
            {players.map((p, i) => {
              const isMe = p.id === myProfile?.id;
              const rank = i + 1;
              return (
                <View key={p.id} style={[styles.listRow, isMe && styles.listRowMe, i < players.length - 1 && styles.listRowBorder]}>
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
                  <View style={[styles.avatar, { borderColor: rank <= 3 ? RANK_COLORS[rank - 1] : '#3D1F6E70' }]}>
                    <Text style={styles.avatarText}>{(p.username ?? 'U').charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.playerInfo}>
                    <Text style={[styles.playerName, isMe && styles.playerNameMe]} numberOfLines={1}>
                      {p.username ?? 'Player'}{isMe && t('youLabel')}
                    </Text>
                  </View>
                  
                  <View style={styles.ptsWrapper}>
                    <Text style={[styles.pts, rank === 1 && { color: colors.gold }]}>{p.points}</Text>
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
  
  // My Rank Bar
  myRankBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,215,0,0.06)',
    padding: spacing.md,
    borderBottomWidth: 1.5, borderBottomColor: 'rgba(255,215,0,0.15)',
  },
  myRankText: { color: colors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  myRankValue: { color: colors.gold, fontSize: 14, fontWeight: '900' },
  bulletSeparator: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textMuted, marginHorizontal: 8 },
  myRankPts: { color: colors.neon, fontSize: 13, fontWeight: '900' },
  
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md },
  
  // Podium Stands
  podium: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end',
    gap: spacing.sm, marginBottom: spacing.lg, paddingHorizontal: spacing.xs,
  },
  podiumPlayer: {
    alignItems: 'center', flex: 1, gap: 4,
    borderRadius: radius.lg, padding: 10,
    borderWidth: 1.5, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8,
  },
  podiumFirst: { transform: [{ translateY: -10 }], ...shadow.gold },
  medalIconWrap: { marginBottom: 2 },
  podiumAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#0D0618',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2,
  },
  podiumAvatarText: { color: colors.textPrimary, fontSize: 16, fontWeight: '900' },
  podiumName: { color: colors.textPrimary, fontSize: 11, fontWeight: '900', maxWidth: 85, textAlign: 'center' },
  pointsBadgeMini: { flexDirection: 'row', alignItems: 'baseline', gap: 2, marginTop: 2 },
  podiumPts: { fontSize: 15, fontWeight: '900' },
  podiumPtsLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '800' },
  
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
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#0A0314',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
  },
  avatarText: { color: colors.textPrimary, fontSize: 13, fontWeight: '900' },
  playerInfo: { flex: 1 },
  playerName: { color: colors.textPrimary, fontSize: 13, fontWeight: '800' },
  playerNameMe: { color: colors.gold, fontWeight: '900' },
  ptsWrapper: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  pts: { color: colors.textPrimary, fontSize: 14, fontWeight: '900' },
  ptsLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '800', width: 22 },
});
