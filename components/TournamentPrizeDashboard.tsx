import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, ActivityIndicator, Alert, Clipboard, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Trophy, Crown, Medal, Copy, RefreshCw, Phone, Mail, Calendar, Users } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { useLanguage } from '@/hooks/useLanguage';
import { formatEthiopianMonthYear } from '@/lib/ethiopianCalendar';

// ── Types ─────────────────────────────────────────────────────────────────────
type TopPlayer = {
  tournament_id: string;
  tournament_name: string;
  prize_pool: string;
  end_time: string;
  active: boolean;
  user_id: string;
  tournament_points: number;
  rank: number;
  username: string | null;
  full_name: string | null;
  phone_or_email: string | null;
  phone_number: string | null;
  last_active: string;
};

type TournamentGroup = {
  tournament_id: string;
  tournament_name: string;
  prize_pool: string;
  end_time: string;
  active: boolean;
  players: TopPlayer[];
};

// ── Rank medal config ─────────────────────────────────────────────────────────
const RANK_CONFIG = [
  { icon: Crown,  color: '#FFD700', bg: 'rgba(255,215,0,0.12)',  border: 'rgba(255,215,0,0.35)',  key: 'rank1st' as const },
  { icon: Trophy, color: '#C0C0C0', bg: 'rgba(192,192,192,0.1)', border: 'rgba(192,192,192,0.3)', key: 'rank2nd' as const },
  { icon: Medal,  color: '#CD7F32', bg: 'rgba(205,127,50,0.1)',  border: 'rgba(205,127,50,0.3)',  key: 'rank3rd' as const },
];

// ── Copy helper ───────────────────────────────────────────────────────────────
function copyToClipboard(text: string, successTitle: string, successMsg: string) {
  if (Platform.OS === 'web') {
    navigator.clipboard?.writeText(text);
  } else {
    Clipboard.setString(text);
  }
  Alert.alert(successTitle, successMsg);
}

// ── Player Row ────────────────────────────────────────────────────────────────
function PlayerRow({ player }: { player: TopPlayer }) {
  const { t } = useLanguage();
  const rank = Math.min(player.rank - 1, 2); // clamp to 0–2 index
  const cfg  = RANK_CONFIG[rank];
  const RankIcon = cfg.icon;

  const contact  = player.phone_number || player.phone_or_email || '—';
  const isPhone  = contact.startsWith('+') || /^\d/.test(contact);
  const ContactIcon = isPhone ? Phone : Mail;

  const displayName = player.full_name || player.username || t('championPlaceholder');

  return (
    <View style={[styles.playerRow, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      {/* Rank badge */}
      <View style={[styles.rankBadge, { borderColor: cfg.color }]}>
        <RankIcon color={cfg.color} size={14} fill={cfg.color} />
        <Text style={[styles.rankLabel, { color: cfg.color }]}>{t(cfg.key)}</Text>
      </View>

      {/* Player info */}
      <View style={styles.playerInfo}>
        <Text style={styles.playerName} numberOfLines={1}>{displayName}</Text>
        {player.username && player.full_name && (
          <Text style={styles.playerUsername} numberOfLines={1}>@{player.username}</Text>
        )}
        <View style={styles.contactRow}>
          <ContactIcon color={colors.textMuted} size={11} />
          <Text style={styles.contactText} numberOfLines={1}>{contact}</Text>
          {contact !== '—' && (
            <TouchableOpacity
              onPress={() => copyToClipboard(contact, t('copied'), t('contactCopied'))}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Copy color={cfg.color} size={11} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Points */}
      <View style={styles.pointsColumn}>
        <Text style={[styles.pointsValue, { color: cfg.color }]}>
          {player.tournament_points.toLocaleString()}
        </Text>
        <Text style={styles.pointsLabel}>{t('pts').toUpperCase()}</Text>
      </View>
    </View>
  );
}

// ── Tournament Card ───────────────────────────────────────────────────────────
function TournamentCard({ group }: { group: TournamentGroup }) {
  const { t, lang } = useLanguage();
  const endDate  = new Date(group.end_time);
  const isActive = group.active && endDate > new Date();
  
  const dateStr = lang === 'am' 
    ? formatEthiopianMonthYear(group.end_time, 'am')
    : endDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <View style={styles.card}>
      {/* Card header */}
      <LinearGradient
        colors={isActive ? ['#1A0840', '#0D0618'] : ['#1C1C1C', '#111111']}
        style={styles.cardHeader}
      >
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.cardTournamentName} numberOfLines={1}>{group.tournament_name}</Text>
          <View style={styles.cardMeta}>
            <Calendar color={colors.textMuted} size={11} />
            <Text style={styles.cardMetaText}>{dateStr}</Text>
            <View style={[styles.statusDot, { backgroundColor: isActive ? colors.success : colors.textMuted }]} />
            <Text style={[styles.cardMetaText, { color: isActive ? colors.success : colors.textMuted }]}>
              {isActive ? t('active') : t('ended2')}
            </Text>
          </View>
        </View>
        <View style={styles.prizeTag}>
          <Text style={styles.prizeAmount}>{group.prize_pool}</Text>
          <Text style={styles.prizeLabel}>{t('prize').toUpperCase()}</Text>
        </View>
      </LinearGradient>

      {/* Players */}
      <View style={styles.playersContainer}>
        {group.players.length === 0 ? (
          <View style={styles.emptyState}>
            <Users color={colors.textMuted} size={20} />
            <Text style={styles.emptyText}>{t('noParticipants')}</Text>
          </View>
        ) : (
          group.players.map((p) => <PlayerRow key={p.user_id} player={p} />)
        )}
      </View>
    </View>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function TournamentPrizeDashboard({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [groups, setGroups]   = useState<TournamentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch top 3 per tournament using a direct query (works even without the SQL view)
      const { data, error: fetchErr } = await supabase
        .from('tournament_points')
        .select(`
          user_id,
          tournament_id,
          points,
          updated_at,
          profiles ( username, full_name, phone_or_email, phone_number ),
          tournaments ( id, name, prize_pool, end_time, active )
        `)
        .order('points', { ascending: false });

      if (fetchErr) throw new Error(fetchErr.message);
      if (!data) { setGroups([]); return; }

      // Group by tournament, keep top 3 per tournament
      const map = new Map<string, TournamentGroup>();

      for (const row of data as any[]) {
        const t = row.tournaments;
        const p = row.profiles;
        if (!t || !p) continue;

        if (!map.has(row.tournament_id)) {
          map.set(row.tournament_id, {
            tournament_id:   row.tournament_id,
            tournament_name: t.name,
            prize_pool:      t.prize_pool,
            end_time:        t.end_time,
            active:          t.active,
            players: [],
          });
        }

        const group = map.get(row.tournament_id)!;
        if (group.players.length < 3) {
          group.players.push({
            tournament_id:      row.tournament_id,
            tournament_name:    t.name,
            prize_pool:         t.prize_pool,
            end_time:           t.end_time,
            active:             t.active,
            user_id:            row.user_id,
            tournament_points:  row.points,
            rank:               group.players.length + 1,
            username:           p.username,
            full_name:          p.full_name,
            phone_or_email:     p.phone_or_email,
            phone_number:       p.phone_number,
            last_active:        row.updated_at,
          });
        }
      }

      // Sort: ended tournaments first (for prize distribution), then active
      const sorted = Array.from(map.values()).sort((a, b) => {
        const aEnded = !a.active || new Date(a.end_time) <= new Date();
        const bEnded = !b.active || new Date(b.end_time) <= new Date();
        if (aEnded && !bEnded) return -1;
        if (!aEnded && bEnded) return 1;
        return new Date(b.end_time).getTime() - new Date(a.end_time).getTime();
      });

      setGroups(sorted);
    } catch (e: any) {
      setError(e.message || 'Failed to load tournament data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={styles.root}>
      {/* Header */}
      <LinearGradient
        colors={['#1A0840', '#0D0618']}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <X color={colors.textMuted} size={22} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Crown color={colors.gold} size={18} fill={colors.gold} />
          <Text style={styles.headerTitle}>{t('prizeDashboard').toUpperCase()}</Text>
        </View>
        <TouchableOpacity onPress={load} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <RefreshCw color={colors.textMuted} size={18} />
        </TouchableOpacity>
      </LinearGradient>

      <Text style={styles.subtitle}>{t('prizeDashboardSubtitle')}</Text>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>{t('loadingRankings')}</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryBtnText}>{t('retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.center}>
          <Trophy color={colors.textMuted} size={48} />
          <Text style={styles.emptyText}>{t('noTournamentData')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {groups.map((g) => (
            <TournamentCard key={g.tournament_id} group={g} />
          ))}
          <Text style={styles.tip}>
            {t('prizeDashboardTip')}
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 14,
    borderBottomWidth: 1.5, borderBottomColor: 'rgba(255,215,0,0.2)',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: {
    color: colors.gold, fontSize: 15, fontWeight: '900', letterSpacing: 1.2,
  },
  subtitle: {
    color: colors.textMuted, fontSize: 11, textAlign: 'center',
    marginVertical: 8, paddingHorizontal: spacing.md,
  },

  scroll: { padding: spacing.md, paddingBottom: 40, gap: spacing.md },

  // Tournament card
  card: {
    borderRadius: radius.lg, overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(255,215,0,0.2)',
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 12,
  },
  cardHeaderLeft: { flex: 1, gap: 4 },
  cardTournamentName: {
    color: colors.textPrimary, fontSize: 15, fontWeight: '900', letterSpacing: 0.3,
  },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardMetaText: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  prizeTag: {
    alignItems: 'center', backgroundColor: 'rgba(255,215,0,0.12)',
    borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)',
    marginLeft: spacing.md,
  },
  prizeAmount: { color: colors.gold, fontSize: 13, fontWeight: '900' },
  prizeLabel: { color: colors.gold, fontSize: 8, fontWeight: '700', letterSpacing: 1, opacity: 0.7 },

  // Players
  playersContainer: { backgroundColor: colors.bgCard, gap: 1 },
  playerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderWidth: 0, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: spacing.sm,
  },
  rankBadge: {
    alignItems: 'center', justifyContent: 'center',
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, backgroundColor: 'transparent', gap: 1,
  },
  rankLabel: { fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  playerInfo: { flex: 1, gap: 2 },
  playerName: { color: colors.textPrimary, fontSize: 13, fontWeight: '800' },
  playerUsername: { color: colors.textMuted, fontSize: 11 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  contactText: { color: colors.textSecondary, fontSize: 11, flex: 1 },
  pointsColumn: { alignItems: 'center' },
  pointsValue: { fontSize: 16, fontWeight: '900' },
  pointsLabel: { color: colors.textMuted, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },

  emptyState: { alignItems: 'center', padding: spacing.lg, gap: 8 },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },

  // States
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.textMuted, fontSize: 13 },
  errorText: { color: colors.error, fontSize: 13, textAlign: 'center', paddingHorizontal: spacing.lg },
  retryBtn: {
    backgroundColor: colors.gold, borderRadius: radius.full,
    paddingHorizontal: 24, paddingVertical: 10,
  },
  retryBtnText: { color: colors.bgDeep, fontWeight: '800' },

  tip: {
    color: colors.textMuted, fontSize: 10, textAlign: 'center',
    marginTop: spacing.md, fontStyle: 'italic',
  },
});
