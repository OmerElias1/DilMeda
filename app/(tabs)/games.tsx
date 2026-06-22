import React, { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy, Zap, Shield, Brain, Dices, Leaf, Wind, Flame, Users, Clock, Lock, Star, Play, Sparkles, Layers, Music, ShieldAlert, RefreshCw } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useTournaments, useTimeLeft, TournamentWithCount } from '@/hooks/useTournaments';
import { useLanguage } from '@/hooks/useLanguage';
import AdPlayer from '@/components/AdPlayer';
import ParticleBackground from '@/components/ParticleBackground';
import MedaClicker from '@/games/MedaClicker';
import AdAvoider from '@/games/AdAvoider';
import MemoryMatch from '@/games/MemoryMatch';
import LuckySpinWheel from '@/games/LuckySpinWheel';
import TreeGrower from '@/games/TreeGrower';
import SkyDrifter from '@/games/SkyDrifter';
import MetroRush from '@/games/MetroRush';
import CyberStack from '@/games/CyberStack';
import RhythmPulse from '@/games/RhythmPulse';
import LaserDeflector from '@/games/LaserDeflector';
import ColorOrbit from '@/games/ColorOrbit';
import { Tournament } from '@/lib/supabase';
import { colors, spacing, radius, shadow } from '@/constants/theme';

type GameId = 'clicker' | 'avoider' | 'memory' | 'spin' | 'tree' | 'sky' | 'metro' | 'stack' | 'rhythm' | 'deflector' | 'orbit';

const GAMES = [
  { id: 'clicker' as GameId, title: 'Meda Clicker',  sub: 'Tap the gold coin!',         Icon: Zap,    color: ['#472202','#1A0B2E'] as [string,string], pts: '~60 pts',    diff: 'EASY', tag: 'COIN TAP' },
  { id: 'avoider' as GameId, title: 'Ad-Avoider',    sub: 'Dodge bad ads, catch gold',   Icon: Shield, color: ['#1E0F42','#0D0618'] as [string,string], pts: 'Unlimited', diff: 'MEDIUM', tag: 'DODGE AD' },
  { id: 'memory'  as GameId, title: 'Memory Match',  sub: 'Match all pairs',             Icon: Brain,  color: ['#0E3320','#0D0618'] as [string,string], pts: '90 pts',    diff: 'MEDIUM', tag: 'MEMORY' },
  { id: 'spin'    as GameId, title: 'Lucky Spin',    sub: 'Spin once daily',             Icon: Dices,  color: ['#3A2202','#1A0B2E'] as [string,string], pts: '100 pts',   diff: 'LUCK', tag: 'DAILY WHEEL' },
  { id: 'tree'    as GameId, title: 'Tree Grower',   sub: 'Water daily to earn',         Icon: Leaf,   color: ['#0A3315','#0D1A0B'] as [string,string], pts: '60 pts',    diff: 'DAILY', tag: 'SIMULATION' },
  { id: 'sky'     as GameId, title: 'Sky Drifter',   sub: 'Tap to flap, dodge pipes',    Icon: Wind,   color: ['#031A2E','#050B1A'] as [string,string], pts: 'Unlimited', diff: 'HARD',  tag: 'FLAPPY' },
  { id: 'metro'   as GameId, title: 'Metro Rush',    sub: 'Dodge obstacles, dash far',   Icon: Flame,  color: ['#2E1A0A','#1A0B05'] as [string,string], pts: 'Unlimited', diff: 'HARD',  tag: 'RUNNER' },
  { id: 'stack'   as GameId, title: 'Cyber Stack',   sub: 'Stack neon blocks high',      Icon: Layers, color: ['#2E0515','#0D0208'] as [string,string], pts: 'Unlimited', diff: 'EASY',  tag: 'STACKER' },
  { id: 'rhythm'  as GameId, title: 'Rhythm Pulse',  sub: 'Tap to the neon beat',        Icon: Music,  color: ['#052E2A','#020D0C'] as [string,string], pts: 'Unlimited', diff: 'MEDIUM', tag: 'RHYTHM' },
  { id: 'deflector' as GameId, title: 'Laser Deflector', sub: 'Bounce laser balls away',  Icon: ShieldAlert, color: ['#2E2A05','#0D0C02'] as [string,string], pts: 'Unlimited', diff: 'MEDIUM', tag: 'ARCADE' },
  { id: 'orbit'   as GameId, title: 'Color Orbit',   sub: 'Spin to match laser colors',  Icon: RefreshCw, color: ['#2E052A','#0D020C'] as [string,string], pts: 'Unlimited', diff: 'HARD',  tag: 'COLOR MATCH' },
];

const DIFF_COLORS: Record<string,string> = {
  EASY: colors.neon, MEDIUM: colors.gold, HARD: '#00BFFF', LUCK: '#FF9F43', DAILY: '#00FF88',
};

// ── Tournament card (list view) ───────────────────────────────────────────────
function TournamentCard({
  tournament, isLocked, onRegister, registering,
}: {
  tournament: TournamentWithCount;
  isLocked: boolean;
  onRegister: (t: TournamentWithCount) => void;
  registering: boolean;
}) {
  const tTime = useTimeLeft(tournament.end_time);
  const expired = tTime.expired;
  
  const rTime = useTimeLeft(tournament.registration_deadline ?? undefined);
  const regExpired = tournament.registration_deadline ? rTime.expired : expired;

  const { t } = useLanguage();
  const bg = tournament.banner_color ?? '#2D1555';

  return (
    <View style={[styles.tCard, expired && { opacity: 0.55 }]}>
      <LinearGradient colors={[bg, '#0D0618']} style={styles.tCardGradient}>
        <View style={styles.cardHeaderAccent} />
        
        {/* Header row */}
        <View style={styles.tCardHeader}>
          <View style={styles.tCardIconWrap}>
            <Trophy color={colors.gold} size={24} fill={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tCardName}>{tournament.name}</Text>
            <Text style={styles.tCardDesc} numberOfLines={2}>{tournament.description}</Text>
          </View>
        </View>

        {/* Prize Pool Display */}
        <View style={styles.tCardPrize}>
          <Text style={styles.tCardPrizeLabel}>{t('grandPrize')}</Text>
          <View style={styles.prizeValRow}>
            <Sparkles color={colors.gold} size={18} />
            <Text style={styles.tCardPrizeValue}>{tournament.prize_pool}</Text>
          </View>
        </View>

        {/* RPG-style attribute badges */}
        <View style={styles.tCardStatsGrid}>
          {/* Tournament End Time Pill */}
          <View style={styles.tCardStatPill}>
            <Clock color={colors.textSecondary} size={12} />
            {expired
              ? <Text style={[styles.tCardStatText, { color: colors.error }]}>{t('ended2')}</Text>
              : <Text style={styles.tCardStatText}>{tTime.days}d {tTime.hours}h {t('leftWord')}</Text>
            }
          </View>

          {/* Registration Deadline Pill */}
          {tournament.registration_deadline && !expired && (
            <View style={[styles.tCardStatPill, regExpired && { borderColor: 'rgba(255, 68, 68, 0.3)' }]}>
              <Clock color={regExpired ? colors.error : colors.gold} size={12} />
              {regExpired ? (
                <Text style={[styles.tCardStatText, { color: colors.error }]}>
                  {t('registrationClosed')}
                </Text>
              ) : (
                <Text style={[styles.tCardStatText, { color: colors.gold }]}>
                  {t('registrationDeadline')} {rTime.days > 0 ? `${rTime.days}d ` : ''}{rTime.hours}h
                </Text>
              )}
            </View>
          )}

          <View style={styles.tCardStatPill}>
            <Users color={colors.textSecondary} size={12} />
            <Text style={styles.tCardStatText}>{tournament.player_count} {t('players')}</Text>
          </View>
          <View style={styles.tCardStatPill}>
            <Star color={colors.gold} size={12} fill={colors.gold} />
            <Text style={[styles.tCardStatText, { color: colors.gold }]}>{t('feeLabel')} {tournament.entry_fee}</Text>
          </View>
        </View>

        {/* CTA */}
        {expired ? (
          <View style={styles.tCardBtnDisabled}>
            <Text style={styles.tCardBtnDisabledText}>{t('tournamentEnded2')}</Text>
          </View>
        ) : isLocked ? (
          <View style={styles.tCardBtnLocked}>
            <Lock color={colors.textMuted} size={13} />
            <Text style={styles.tCardBtnLockedText}>{t('participatingOtherLobby')}</Text>
          </View>
        ) : regExpired ? (
          <View style={{ width: '100%' }}>
            <View style={styles.tCardBtnDisabled}>
              <Lock color={colors.textMuted} size={13} style={{ marginRight: 6 }} />
              <Text style={styles.tCardBtnDisabledText}>{t('registrationClosed')}</Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 6, fontStyle: 'italic' }}>
              {t('lateRegistrationNotice')}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.tCardBtn}
            onPress={() => onRegister(tournament)}
            disabled={registering}
            activeOpacity={0.8}
          >
            <LinearGradient colors={[colors.gold, colors.goldDim]} style={styles.tCardBtnGrad}>
              {registering
                ? <ActivityIndicator color={colors.bgDeep} size="small" />
                : <Text style={styles.tCardBtnText}>{t('enterChampionship')}</Text>
              }
            </LinearGradient>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </View>
  );
}

// ── Game lobby (inside a tournament) ─────────────────────────────────────────
const AD_EVERY_N_GAMES = 3;

function GameLobby({
  tournament, myPoints, refreshProfile, refreshPoints,
}: {
  tournament: Tournament;
  myPoints: number;
  refreshProfile: () => Promise<any>;
  refreshPoints: () => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [activeGame, setActiveGame] = useState<GameId | null>(null);
  const [showAdModal, setShowAdModal] = useState(false);
  const [pendingGame, setPendingGame] = useState<GameId | null>(null);
  const tTime = useTimeLeft(tournament.end_time);
  const { t } = useLanguage();

  // Simple local counter — every AD_EVERY_N_GAMES plays an ad is shown
  const gamesPlayedRef = useRef(0);

  const needsAd = () => {
    gamesPlayedRef.current += 1;
    return gamesPlayedRef.current % AD_EVERY_N_GAMES === 0;
  };

  const closeGame = useCallback(async () => {
    setActiveGame(null);
    await Promise.all([refreshProfile(), refreshPoints()]);
  }, [refreshProfile, refreshPoints]);

  const renderGame = (id: GameId) => {
    const onPlayAgain = async () => {
      await Promise.all([refreshProfile(), refreshPoints()]);
      if (needsAd()) {
        // Ad is due — show it before next game
        setPendingGame(id);
        setActiveGame(null);
        setShowAdModal(true);
      } else {
        // Cycle through null to remount the game component
        setActiveGame(null);
        setTimeout(() => setActiveGame(id), 50);
      }
    };
    switch (id) {
      case 'clicker': return <MedaClicker onClose={closeGame} onPlayAgain={onPlayAgain} />;
      case 'avoider': return <AdAvoider   onClose={closeGame} onPlayAgain={onPlayAgain} />;
      case 'memory':  return <MemoryMatch onClose={closeGame} onPlayAgain={onPlayAgain} />;
      case 'spin':    return <LuckySpinWheel onClose={closeGame} />;
      case 'tree':    return <TreeGrower  onClose={closeGame} />;
      case 'sky':     return <SkyDrifter  onClose={closeGame} onPlayAgain={onPlayAgain} />;
      case 'metro':   return <MetroRush   onClose={closeGame} onPlayAgain={onPlayAgain} />;
      case 'stack':   return <CyberStack  onClose={closeGame} onPlayAgain={onPlayAgain} />;
      case 'rhythm':  return <RhythmPulse onClose={closeGame} onPlayAgain={onPlayAgain} />;
      case 'deflector': return <LaserDeflector onClose={closeGame} onPlayAgain={onPlayAgain} />;
      case 'orbit':   return <ColorOrbit  onClose={closeGame} onPlayAgain={onPlayAgain} />;
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      {/* Battle LOBBY HUD Banner */}
      <LinearGradient
        colors={[tournament.banner_color ?? '#2D1555', '#0D0618']}
        style={styles.lobbyBanner}
      >
        <View style={styles.lobbyBannerLeft}>
          <View style={styles.campaignBadge}>
            <Text style={styles.campaignBadgeText}>{t('campaignLobby')}</Text>
          </View>
          <Text style={styles.lobbyBannerTitle}>{tournament.name}</Text>
          <Text style={styles.lobbyBannerSub}>{t('prize')}: {tournament.prize_pool}</Text>
        </View>
        <View style={styles.lobbyBannerRight}>
          <View style={styles.lobbyPointsBadge}>
            <Star color={colors.gold} size={11} fill={colors.gold} />
            <Text style={styles.lobbyPointsText}>{myPoints} PTS</Text>
          </View>
          {tTime.expired
            ? <Text style={[styles.lobbyCountdown, { color: colors.error }]}>{t('ended2')}</Text>
            : <Text style={styles.lobbyCountdown}>{tTime.days}d {tTime.hours}h {t('leftWord')}</Text>
          }
        </View>
      </LinearGradient>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.lobbySectionTitle}>{t('selectCampaignMission')}</Text>

        {GAMES.map(game => (
          <TouchableOpacity
            key={game.id}
            style={[styles.gameCard, tTime.expired && styles.cardDisabled]}
            onPress={() => {
              if (!tTime.expired) {
                if (needsAd()) {
                  setPendingGame(game.id);
                  setShowAdModal(true);
                } else {
                  setActiveGame(game.id);
                }
              }
            }}
            activeOpacity={0.85}
          >
            <LinearGradient colors={game.color} style={styles.gameCardGrad}>
              {/* Card accent indicator */}
              <View style={[styles.gameCardAccent, { backgroundColor: DIFF_COLORS[game.diff] }]} />
              
              <View style={styles.gameCardRow}>
                <View style={[styles.gameIconWrap, { borderColor: DIFF_COLORS[game.diff] + '40' }]}>
                  <game.Icon color={colors.gold} size={24} fill={game.id === 'spin' ? colors.gold : 'transparent'} />
                </View>
                
                <View style={styles.gameInfo}>
                  <View style={styles.gameTitleRow}>
                    <Text style={styles.gameTitle}>{t(('game' + game.id.charAt(0).toUpperCase() + game.id.slice(1) + 'Title') as any)}</Text>
                    <View style={[styles.diffBadge, { borderColor: DIFF_COLORS[game.diff] + '40', backgroundColor: DIFF_COLORS[game.diff] + '15' }]}>
                      <Text style={[styles.diffText, { color: DIFF_COLORS[game.diff] }]}>{t((game.diff.toLowerCase()) as any)}</Text>
                    </View>
                  </View>
                  <Text style={styles.gameSub}>{t(('game' + game.id.charAt(0).toUpperCase() + game.id.slice(1) + 'Sub') as any)}</Text>
                  
                  <View style={styles.gameBadgeRow}>
                    <View style={styles.gameTagBadge}>
                      <Text style={styles.gameTagText}>{t(('game' + game.id.charAt(0).toUpperCase() + game.id.slice(1) + 'Tag') as any)}</Text>
                    </View>
                    <Text style={styles.gamePts}>{t('rewardLabel')} {t(('game' + game.id.charAt(0).toUpperCase() + game.id.slice(1) + 'Pts') as any)}</Text>
                  </View>
                </View>
                
                <View style={[styles.playBtn, { shadowColor: DIFF_COLORS[game.diff] }]}>
                  <Play color={colors.bgDeep} size={15} fill={colors.bgDeep} />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ))}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Game modal */}
      <Modal visible={activeGame !== null} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setActiveGame(null)}>
        <View style={[styles.gameModal, { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 20 : 0) }]}>
          <View style={styles.gameModalHeader}>
            <TouchableOpacity onPress={() => setActiveGame(null)} style={styles.backBtn}>
              <Text style={styles.backBtnText}>{t('closeMission')}</Text>
            </TouchableOpacity>
            <Text style={styles.gameModalTitle}>
              {activeGame ? t(('game' + activeGame.charAt(0).toUpperCase() + activeGame.slice(1) + 'Title') as any) : ''}
            </Text>
            <View style={{ width: 60 }} />
          </View>
          <View style={{ flex: 1 }}>{activeGame && renderGame(activeGame)}</View>
        </View>
      </Modal>

      {/* Ad gate modal */}
      <Modal visible={showAdModal} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => { setShowAdModal(false); setPendingGame(null); }}>
        <View style={styles.adModal}>
          <View style={styles.adModalHeader}>
            <Text style={styles.adModalTitle}>{t('rechargingEnergyRequired')}</Text>
          </View>
          <AdPlayer
            givePoints={false}
            onClose={async () => { await refreshProfile(); setShowAdModal(false); setPendingGame(null); }}
            onAdWatched={async () => {
              await refreshProfile(); setShowAdModal(false);
              if (pendingGame) { setActiveGame(pendingGame); setPendingGame(null); }
            }}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Root screen ───────────────────────────────────────────────────────────────
export default function TournamentsScreen() {
  const { profile, refreshProfile } = useAuth();
  const { tournaments, activeTournament, myTournamentPoints, isLocked, loading, registering, register, refreshPoints, refetch, refreshTournaments } = useTournaments();
  const { t } = useLanguage();

  useFocusEffect(
    useCallback(() => {
      refetch();
      refreshTournaments();
      refreshPoints();
    }, [refetch, refreshTournaments, refreshPoints])
  );

  const handleRegister = (tObj: TournamentWithCount) => {
    Alert.alert(
      `${t('enterLobbyAlertTitle')}${tObj.name}?`,
      `${t('enterLobbyAlertMsg')}${tObj.prize_pool}${t('enterLobbyAlertMsgSuffix')}`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('confirmEntry'),
          onPress: async () => {
            const { error } = await register(tObj.id);
            if (error) Alert.alert('Error', error);
          },
        },
      ]
    );
  };

  if (activeTournament) {
    return (
      <GameLobby
        tournament={activeTournament}
        myPoints={myTournamentPoints}
        refreshProfile={refreshProfile}
        refreshPoints={refreshPoints}
      />
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ParticleBackground />
      <View style={styles.headerBar}>
        <Trophy color={colors.gold} size={22} fill={colors.gold} />
        <View>
          <Text style={styles.headerTitle}>{t('championshipArena')}</Text>
          <Text style={styles.headerSub}>{t('registerInActiveLobbies')}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>{t('syncArenas')}</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {tournaments.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Trophy color={colors.textMuted} size={48} />
              <Text style={styles.emptyText}>{t('noActiveArenas')}</Text>
              <Text style={styles.emptySub}>{t('checkBackSoonUpcoming')}</Text>
            </View>
          ) : (
            tournaments.map(t => (
              <TournamentCard
                key={t.id}
                tournament={t}
                isLocked={isLocked}
                onRegister={handleRegister}
                registering={registering}
              />
            ))
          )}
          <View style={{ height: 110 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md,
    borderBottomWidth: 1.5, borderBottomColor: '#3D1F6E60',
  },
  headerTitle: { color: colors.gold, fontSize: 20, fontWeight: '900', letterSpacing: 0.8 },
  headerSub:   { color: colors.textSecondary, fontSize: 11, marginTop: 1, opacity: 0.8 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { color: colors.textMuted, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },

  scroll: { flex: 1 },
  scrollContent: { padding: spacing.md, gap: spacing.md },

  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: spacing.sm },
  emptyText: { color: colors.textSecondary, fontSize: 16, fontWeight: '800' },
  emptySub:  { color: colors.textMuted, fontSize: 12 },

  /* Tournament card list */
  tCard: { borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1.5, borderColor: '#3D1F6E60', ...shadow.card },
  tCardGradient: { padding: spacing.md, gap: spacing.md, position: 'relative' },
  cardHeaderAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: colors.gold },
  tCardHeader: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  tCardIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,215,0,0.1)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,215,0,0.3)',
  },
  tCardName: { color: colors.textPrimary, fontSize: 16, fontWeight: '900', marginBottom: 3, letterSpacing: 0.2 },
  tCardDesc: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, opacity: 0.8 },
  tCardPrize: {
    backgroundColor: 'rgba(255,215,0,0.06)', borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: 'rgba(255,215,0,0.15)',
  },
  tCardPrizeLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  prizeValRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  tCardPrizeValue: { color: colors.gold, fontSize: 20, fontWeight: '900' },
  tCardStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tCardStatPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#1E0C32', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.full, borderWidth: 1, borderColor: '#3D1F6E50',
  },
  tCardStatText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },

  tCardBtn: { borderRadius: radius.lg, overflow: 'hidden', ...shadow.gold },
  tCardBtnGrad: { paddingVertical: 12, alignItems: 'center', borderRadius: radius.lg },
  tCardBtnText: { color: colors.bgDeep, fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
  tCardBtnDisabled: {
    backgroundColor: colors.bgDeep, borderRadius: radius.lg, paddingVertical: 12, alignItems: 'center',
  },
  tCardBtnDisabledText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  tCardBtnLocked: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(107,90,142,0.1)', borderRadius: radius.lg, paddingVertical: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  tCardBtnLockedText: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  /* Game lobby */
  lobbyBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.md, paddingVertical: spacing.lg,
    borderBottomWidth: 1.5, borderBottomColor: 'rgba(255,215,0,0.25)',
  },
  lobbyBannerLeft: { flex: 1, gap: 2 },
  campaignBadge: {
    backgroundColor: colors.neon + '20', borderWidth: 1, borderColor: colors.neonDim,
    borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start',
    marginBottom: 4,
  },
  campaignBadgeText: { color: colors.neon, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  lobbyBannerTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '900', letterSpacing: 0.2 },
  lobbyBannerSub:   { color: colors.textSecondary, fontSize: 12, marginTop: 1, opacity: 0.8 },
  lobbyBannerRight: { alignItems: 'flex-end', gap: 4 },
  lobbyPointsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,215,0,0.12)', borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)',
  },
  lobbyPointsText: { color: colors.gold, fontWeight: '900', fontSize: 12, letterSpacing: 0.2 },
  lobbyCountdown:  { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },

  lobbySectionTitle: { color: '#8F7EA6', fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginVertical: 4 },

  /* Game cards */
  gameCard: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1.5, borderColor: '#3D1F6E60', ...shadow.card, marginBottom: spacing.sm },
  cardDisabled: { opacity: 0.5 },
  gameCardGrad: { borderRadius: radius.lg, position: 'relative' },
  gameCardAccent: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 3 },
  gameCardRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
  gameIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#1C0B30', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  gameInfo: { flex: 1, gap: 2 },
  gameTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gameTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '900', letterSpacing: 0.2 },
  diffBadge: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 1 },
  diffText:  { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  gameSub: { color: colors.textSecondary, fontSize: 11, opacity: 0.8 },
  gameBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  gameTagBadge: {
    backgroundColor: '#0F031E', borderWidth: 1, borderColor: '#3D1F6E70',
    borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2,
  },
  gameTagText: { color: colors.textSecondary, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  gamePts: { color: colors.neon, fontSize: 10, fontWeight: '900', letterSpacing: 0.2 },
  playBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.gold,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 4,
  },

  /* Game / Ad modals */
  gameModal: { flex: 1, backgroundColor: colors.bg },
  gameModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md, borderBottomWidth: 1.5, borderBottomColor: '#3D1F6E50',
  },
  backBtn: { padding: 4 },
  backBtnText: { color: colors.gold, fontSize: 14, fontWeight: '800' },
  gameModalTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '900' },
  adModal: { flex: 1, backgroundColor: colors.bg },
  adModalHeader: {
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  adModalTitle: { color: colors.gold, fontSize: 18, fontWeight: '800' },
  countdownText: { color: colors.textSecondary, fontSize: 12 },
});
