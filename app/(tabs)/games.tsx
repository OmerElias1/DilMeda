import React, { useState, useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert, ActivityIndicator, Platform, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Trophy, Zap, Shield, Brain, Dices, Leaf, Wind, Flame, Users, Clock,
  Lock, Star, Play, Sparkles, Layers, Music, ShieldAlert, RefreshCw,
  ChevronRight, Swords, Crown,
} from 'lucide-react-native';
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
import MedaMiner from '@/games/MedaMiner';
import NeonShield from '@/games/NeonShield';
import CyberPath from '@/games/CyberPath';
import AstroDrift from '@/games/AstroDrift';
import { Tournament } from '@/lib/supabase';
import { colors, spacing, radius, shadow } from '@/constants/theme';

const { width: W } = Dimensions.get('window');

type GameId = 'clicker' | 'avoider' | 'memory' | 'spin' | 'tree' | 'sky' | 'metro' | 'stack' | 'rhythm' | 'deflector' | 'orbit' | 'miner' | 'shield' | 'path' | 'drift';

const GAMES = [
  { id: 'clicker' as GameId, Icon: Zap,        color: ['#472202', '#1A0B2E'] as [string,string], accent: '#FFD700', diff: 'EASY',   tag: 'COIN TAP'   },
  { id: 'avoider' as GameId, Icon: Shield,      color: ['#1E0F42', '#0D0618'] as [string,string], accent: '#00FF88', diff: 'MEDIUM', tag: 'DODGE AD'   },
  { id: 'memory'  as GameId, Icon: Brain,       color: ['#0E3320', '#0D0618'] as [string,string], accent: '#00BFFF', diff: 'MEDIUM', tag: 'MEMORY'     },
  { id: 'spin'    as GameId, Icon: Dices,       color: ['#3A2202', '#1A0B2E'] as [string,string], accent: '#FF9F43', diff: 'LUCK',   tag: 'DAILY WHEEL'},
  { id: 'tree'    as GameId, Icon: Leaf,        color: ['#0A3315', '#0D1A0B'] as [string,string], accent: '#00FF88', diff: 'DAILY',  tag: 'SIMULATION' },
  { id: 'sky'     as GameId, Icon: Wind,        color: ['#031A2E', '#050B1A'] as [string,string], accent: '#00BFFF', diff: 'HARD',   tag: 'FLAPPY'     },
  { id: 'metro'   as GameId, Icon: Flame,       color: ['#2E1A0A', '#1A0B05'] as [string,string], accent: '#FF6B6B', diff: 'HARD',   tag: 'RUNNER'     },
  { id: 'stack'   as GameId, Icon: Layers,      color: ['#2E0515', '#0D0208'] as [string,string], accent: '#FF00FF', diff: 'EASY',   tag: 'STACKER'    },
  { id: 'rhythm'  as GameId, Icon: Music,       color: ['#052E2A', '#020D0C'] as [string,string], accent: '#00FFFF', diff: 'MEDIUM', tag: 'RHYTHM'     },
  { id: 'deflector'as GameId,Icon: ShieldAlert, color: ['#2E2A05', '#0D0C02'] as [string,string], accent: '#FFDD00', diff: 'MEDIUM', tag: 'ARCADE'     },
  { id: 'orbit'   as GameId, Icon: RefreshCw,   color: ['#2E052A', '#0D020C'] as [string,string], accent: '#CC00FF', diff: 'HARD',   tag: 'COLOR MATCH'},
];

const DIFF_COLORS: Record<string, string> = {
  EASY: '#00FF88', MEDIUM: '#FFD700', HARD: '#00BFFF', LUCK: '#FF9F43', DAILY: '#00FF88',
};

// ── Pulse dot ─────────────────────────────────────────────────────────────────
function PulseDot({ color }: { color: string }) {
  const pulse = useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.5, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <View style={{ width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{
        width: 10, height: 10, borderRadius: 5, backgroundColor: color,
        transform: [{ scale: pulse }], opacity: 0.85,
      }} />
    </View>
  );
}

// ── Tournament card ────────────────────────────────────────────────────────────
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
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn  = () => Animated.spring(scaleAnim, { toValue: 0.975, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1,     useNativeDriver: true }).start();

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, expired && { opacity: 0.6 }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() => !expired && !isLocked && !regExpired && onRegister(tournament)}
        disabled={expired || isLocked || regExpired || registering}
      >
        <View style={styles.tCard}>
          <LinearGradient colors={[bg + 'EE', '#0D0618']} style={styles.tCardGrad}>
            {/* Top accent stripe */}
            <LinearGradient
              colors={['#FFD700', '#FF9F43', '#FFD700']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.tCardTopStripe}
            />

            {/* Header */}
            <View style={styles.tCardHeader}>
              <View style={styles.tCardIconOuter}>
                <LinearGradient colors={['rgba(255,215,0,0.25)', 'rgba(255,215,0,0.05)']} style={styles.tCardIconGrad}>
                  <Crown color={colors.gold} size={26} fill={colors.gold} />
                </LinearGradient>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tCardName} numberOfLines={1}>{tournament.name}</Text>
                <Text style={styles.tCardDesc} numberOfLines={2}>{tournament.description}</Text>
              </View>
              {!expired && !regExpired && !isLocked && (
                <View style={styles.livePill}>
                  <PulseDot color="#00FF88" />
                  <Text style={styles.livePillText}>LIVE</Text>
                </View>
              )}
            </View>

            {/* Grand Prize Hero */}
            <LinearGradient
              colors={['rgba(255,215,0,0.18)', 'rgba(255,165,0,0.08)', 'rgba(255,215,0,0.04)']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.prizeHero}
            >
              <View style={styles.prizeHeroLeft}>
                <Text style={styles.prizeHeroLabel}>{t('grandPrize')}</Text>
                <Text style={styles.prizeHeroValue}>{tournament.prize_pool}</Text>
              </View>
              <Sparkles color={colors.gold} size={36} />
            </LinearGradient>

            {/* Stats row */}
            <View style={styles.tCardStats}>
              <View style={styles.statChip}>
                {expired
                  ? <><View style={[styles.statDot, { backgroundColor: colors.error }]} /><Text style={[styles.statChipText, { color: colors.error }]}>{t('ended2')}</Text></>
                  : <><Clock color={colors.neon} size={12} /><Text style={styles.statChipText}>{tTime.days}d {tTime.hours}h {t('leftWord')}</Text></>
                }
              </View>
              <View style={styles.statChip}>
                <Users color="#7C8CFB" size={12} />
                <Text style={styles.statChipText}>{tournament.player_count} {t('players')}</Text>
              </View>
              <View style={styles.statChip}>
                <Star color={colors.gold} size={12} fill={colors.gold} />
                <Text style={[styles.statChipText, { color: colors.gold }]}>{t('feeLabel')} {tournament.entry_fee}</Text>
              </View>
              {tournament.registration_deadline && !expired && (
                <View style={[styles.statChip, regExpired && { borderColor: 'rgba(255,68,68,0.4)' }]}>
                  <Lock color={regExpired ? colors.error : '#FF9F43'} size={12} />
                  <Text style={[styles.statChipText, { color: regExpired ? colors.error : '#FF9F43' }]}>
                    {regExpired ? t('registrationClosed') : `${t('registrationDeadline')} ${rTime.days > 0 ? `${rTime.days}d ` : ''}${rTime.hours}h`}
                  </Text>
                </View>
              )}
            </View>

            {/* CTA */}
            {expired ? (
              <View style={styles.ctaEnded}>
                <Text style={styles.ctaEndedText}>{t('tournamentEnded2')}</Text>
              </View>
            ) : isLocked ? (
              <View style={styles.ctaLocked}>
                <Lock color={colors.textMuted} size={14} />
                <Text style={styles.ctaLockedText}>{t('participatingOtherLobby')}</Text>
              </View>
            ) : regExpired ? (
              <View>
                <View style={styles.ctaEnded}>
                  <Lock color={colors.textMuted} size={14} style={{ marginRight: 6 }} />
                  <Text style={styles.ctaEndedText}>{t('registrationClosed')}</Text>
                </View>
                <Text style={styles.ctaLateFee}>{t('lateRegistrationNotice')}</Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => onRegister(tournament)}
                disabled={registering}
                activeOpacity={0.85}
                style={styles.ctaBtn}
              >
                <LinearGradient
                  colors={['#FFD700', '#FF9F43', '#FFD700']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.ctaBtnGrad}
                >
                  {registering
                    ? <ActivityIndicator color={colors.bgDeep} size="small" />
                    : <>
                        <Swords color={colors.bgDeep} size={16} />
                        <Text style={styles.ctaBtnText}>{t('enterChampionship')}</Text>
                        <ChevronRight color={colors.bgDeep} size={16} />
                      </>
                  }
                </LinearGradient>
              </TouchableOpacity>
            )}
          </LinearGradient>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Game lobby ─────────────────────────────────────────────────────────────────
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
  const [activeGame, setActiveGame]   = useState<GameId | null>(null);
  const [showAdModal, setShowAdModal] = useState(false);
  const [pendingGame, setPendingGame] = useState<GameId | null>(null);
  const tTime = useTimeLeft(tournament.end_time);
  const { t } = useLanguage();
  const gamesPlayedRef = useRef(0);

  const needsAd = () => { gamesPlayedRef.current += 1; return gamesPlayedRef.current % AD_EVERY_N_GAMES === 0; };

  const closeGame = useCallback(async () => {
    setActiveGame(null);
    await Promise.all([refreshProfile(), refreshPoints()]);
  }, [refreshProfile, refreshPoints]);

  const renderGame = (id: GameId) => {
    const onPlayAgain = async () => {
      await Promise.all([refreshProfile(), refreshPoints()]);
      if (needsAd()) { setPendingGame(id); setActiveGame(null); setShowAdModal(true); }
      else { setActiveGame(null); setTimeout(() => setActiveGame(id), 50); }
    };
    switch (id) {
      case 'clicker':   return <MedaClicker    onClose={closeGame} onPlayAgain={onPlayAgain} />;
      case 'avoider':   return <AdAvoider      onClose={closeGame} onPlayAgain={onPlayAgain} />;
      case 'memory':    return <MemoryMatch    onClose={closeGame} onPlayAgain={onPlayAgain} />;
      case 'spin':      return <LuckySpinWheel onClose={closeGame} />;
      case 'tree':      return <TreeGrower     onClose={closeGame} />;
      case 'sky':       return <SkyDrifter     onClose={closeGame} onPlayAgain={onPlayAgain} />;
      case 'metro':     return <MetroRush      onClose={closeGame} onPlayAgain={onPlayAgain} />;
      case 'stack':     return <CyberStack     onClose={closeGame} onPlayAgain={onPlayAgain} />;
      case 'rhythm':    return <RhythmPulse    onClose={closeGame} onPlayAgain={onPlayAgain} />;
      case 'deflector': return <LaserDeflector onClose={closeGame} onPlayAgain={onPlayAgain} />;
      case 'orbit':     return <ColorOrbit     onClose={closeGame} onPlayAgain={onPlayAgain} />;
      case 'miner':     return <MedaMiner      onClose={closeGame} onPlayAgain={onPlayAgain} />;
      case 'shield':    return <NeonShield     onClose={closeGame} onPlayAgain={onPlayAgain} />;
      case 'path':      return <CyberPath      onClose={closeGame} onPlayAgain={onPlayAgain} />;
      case 'drift':     return <AstroDrift     onClose={closeGame} onPlayAgain={onPlayAgain} />;
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      {/* Lobby HUD */}
      <LinearGradient
        colors={[tournament.banner_color ?? '#2D1555', '#120826', '#0D0618']}
        style={styles.lobbyBanner}
      >
        {/* Top accent */}
        <LinearGradient colors={['#FFD700','#FF9F43','#FFD700']} start={{x:0,y:0}} end={{x:1,y:0}} style={styles.lobbyTopStripe} />

        <View style={styles.lobbyLeft}>
          <View style={styles.campaignPill}>
            <PulseDot color={colors.neon} />
            <Text style={styles.campaignPillText}>{t('campaignLobby')}</Text>
          </View>
          <Text style={styles.lobbyTitle} numberOfLines={1}>{tournament.name}</Text>
          <Text style={styles.lobbySub}>{t('prize')}: <Text style={{ color: colors.gold, fontWeight: '900' }}>{tournament.prize_pool}</Text></Text>
        </View>

        <View style={styles.lobbyRight}>
          <LinearGradient colors={['rgba(255,215,0,0.2)','rgba(255,215,0,0.05)']} style={styles.lobbyPtsBadge}>
            <Star color={colors.gold} size={12} fill={colors.gold} />
            <Text style={styles.lobbyPtsText}>{myPoints} PTS</Text>
          </LinearGradient>
          {tTime.expired
            ? <Text style={[styles.lobbyCountdown, { color: colors.error }]}>{t('ended2')}</Text>
            : <View style={styles.lobbyTimeRow}>
                <Clock color={colors.neon} size={11} />
                <Text style={styles.lobbyCountdown}>{tTime.days}d {tTime.hours}h {t('leftWord')}</Text>
              </View>
          }
        </View>
      </LinearGradient>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.lobbySectionLabel}>{t('selectCampaignMission')}</Text>

        {GAMES.map((game, idx) => {
          const tKey = 'game' + game.id.charAt(0).toUpperCase() + game.id.slice(1);
          return (
            <TouchableOpacity
              key={game.id}
              style={[styles.gameCard, tTime.expired && styles.cardDisabled]}
              onPress={() => {
                if (!tTime.expired) {
                  if (needsAd()) { setPendingGame(game.id); setShowAdModal(true); }
                  else setActiveGame(game.id);
                }
              }}
              activeOpacity={0.88}
            >
              <LinearGradient colors={game.color} style={styles.gameCardGrad}>
                {/* Left accent bar */}
                <View style={[styles.gameAccentBar, { backgroundColor: game.accent }]} />

                <View style={styles.gameCardRow}>
                  {/* Icon */}
                  <View style={[styles.gameIconWrap, { borderColor: game.accent + '55', shadowColor: game.accent }]}>
                    <game.Icon color={game.accent} size={22} fill={game.id === 'spin' ? game.accent : 'none'} />
                  </View>

                  {/* Info */}
                  <View style={styles.gameInfo}>
                    <View style={styles.gameTitleRow}>
                      <Text style={styles.gameTitle} numberOfLines={1}>{t((tKey + 'Title') as any)}</Text>
                      <View style={[styles.diffPill, { borderColor: DIFF_COLORS[game.diff] + '50', backgroundColor: DIFF_COLORS[game.diff] + '18' }]}>
                        <Text style={[styles.diffText, { color: DIFF_COLORS[game.diff] }]}>{t(game.diff.toLowerCase() as any)}</Text>
                      </View>
                    </View>
                    <Text style={styles.gameSub} numberOfLines={1}>{t((tKey + 'Sub') as any)}</Text>
                    <View style={styles.gameMeta}>
                      <View style={[styles.gameTagPill, { borderColor: game.accent + '30' }]}>
                        <Text style={[styles.gameTagText, { color: game.accent + 'CC' }]}>{t((tKey + 'Tag') as any)}</Text>
                      </View>
                      <Text style={[styles.gamePts, { color: game.accent }]}>{t('rewardLabel')} {t((tKey + 'Pts') as any)}</Text>
                    </View>
                  </View>

                  {/* Play button */}
                  <View style={[styles.playBtn, { backgroundColor: game.accent, shadowColor: game.accent }]}>
                    <Play color="#0D0618" size={14} fill="#0D0618" />
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Game modal */}
      <Modal visible={activeGame !== null} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setActiveGame(null)}>
        <View style={[styles.gameModal, { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 20 : 0) }]}>
          <LinearGradient colors={['#1A0840','#0D0618']} style={styles.gameModalHeader}>
            <TouchableOpacity onPress={() => setActiveGame(null)} style={styles.backBtn}>
              <Text style={styles.backBtnText}>{t('closeMission')}</Text>
            </TouchableOpacity>
            <Text style={styles.gameModalTitle}>
              {activeGame ? t(('game' + activeGame.charAt(0).toUpperCase() + activeGame.slice(1) + 'Title') as any) : ''}
            </Text>
            <View style={{ width: 60 }} />
          </LinearGradient>
          <View style={{ flex: 1 }}>{activeGame && renderGame(activeGame)}</View>
        </View>
      </Modal>

      {/* Ad gate */}
      <Modal visible={showAdModal} animationType="slide" presentationStyle="pageSheet"
        onRequestClose={() => { setShowAdModal(false); setPendingGame(null); }}>
        <View style={styles.adModal}>
          <LinearGradient colors={['#1A0840','#0D0618']} style={styles.adModalHeader}>
            <Text style={styles.adModalTitle}>{t('rechargingEnergyRequired')}</Text>
          </LinearGradient>
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

// ── Root screen ────────────────────────────────────────────────────────────────
export default function TournamentsScreen() {
  const { profile, refreshProfile } = useAuth();
  const { tournaments, activeTournament, myTournamentPoints, isLocked, loading, registering, register, refreshPoints, refetch, refreshTournaments } = useTournaments();
  const { t } = useLanguage();

  useFocusEffect(useCallback(() => {
    refetch(); refreshTournaments(); refreshPoints();
  }, [refetch, refreshTournaments, refreshPoints]));

  const handleRegister = (tObj: TournamentWithCount) => {
    Alert.alert(
      `${t('enterLobbyAlertTitle')}${tObj.name}?`,
      `${t('enterLobbyAlertMsg')}${tObj.prize_pool}${t('enterLobbyAlertMsgSuffix')}`,
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('confirmEntry'), onPress: async () => { const { error } = await register(tObj.id); if (error) Alert.alert('Error', error); } },
      ]
    );
  };

  if (activeTournament) {
    return <GameLobby tournament={activeTournament} myPoints={myTournamentPoints} refreshProfile={refreshProfile} refreshPoints={refreshPoints} />;
  }

  return (
    <SafeAreaView style={styles.root}>
      <ParticleBackground />

      {/* Hero header */}
      <LinearGradient colors={['#1A0840', '#0D0618']} style={styles.heroHeader}>
        <LinearGradient colors={['#FFD700','#FF9F43','#FFD700']} start={{x:0,y:0}} end={{x:1,y:0}} style={styles.heroTopStripe} />
        <View style={styles.heroRow}>
          <View style={styles.heroIconWrap}>
            <LinearGradient colors={['rgba(255,215,0,0.3)','rgba(255,165,0,0.1)']} style={styles.heroIconGrad}>
              <Trophy color={colors.gold} size={28} fill={colors.gold} />
            </LinearGradient>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>{t('championshipArena')}</Text>
            <Text style={styles.heroSub}>{t('registerInActiveLobbies')}</Text>
          </View>
          <View style={styles.heroBadge}>
            <PulseDot color={colors.neon} />
            <Text style={styles.heroBadgeText}>LIVE</Text>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.gold} size="large" />
          <Text style={styles.loadingText}>{t('syncArenas')}</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingTop: spacing.md }]} showsVerticalScrollIndicator={false}>
          {tournaments.length === 0 ? (
            <View style={styles.emptyWrap}>
              <LinearGradient colors={['rgba(255,215,0,0.1)','transparent']} style={styles.emptyIcon}>
                <Trophy color={colors.textMuted} size={52} />
              </LinearGradient>
              <Text style={styles.emptyText}>{t('noActiveArenas')}</Text>
              <Text style={styles.emptySub}>{t('checkBackSoonUpcoming')}</Text>
            </View>
          ) : (
            tournaments.map(tour => (
              <TournamentCard
                key={tour.id}
                tournament={tour}
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

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  // Hero header
  heroHeader: {
    borderBottomWidth: 1.5, borderBottomColor: 'rgba(255,215,0,0.15)',
    paddingBottom: 14, position: 'relative', overflow: 'hidden',
  },
  heroTopStripe: { height: 3, width: '100%' },
  heroRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.md, paddingTop: 12,
  },
  heroIconWrap: { borderRadius: 16, overflow: 'hidden' },
  heroIconGrad: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  heroTitle: { color: colors.gold, fontSize: 20, fontWeight: '900', letterSpacing: 0.6 },
  heroSub: { color: colors.textSecondary, fontSize: 11, marginTop: 2, opacity: 0.85, lineHeight: 16 },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,255,136,0.12)', borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)',
  },
  heroBadgeText: { color: colors.neon, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { color: colors.textMuted, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.md, gap: spacing.md + 2 },

  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: spacing.md },
  emptyIcon: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textSecondary, fontSize: 16, fontWeight: '800' },
  emptySub: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },

  // Tournament card
  tCard: {
    borderRadius: radius.xl, overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(255,215,0,0.2)',
    ...shadow.card,
    shadowColor: '#FFD700', shadowOpacity: 0.12, shadowRadius: 16,
  },
  tCardGrad: { gap: spacing.md, position: 'relative' },
  tCardTopStripe: { height: 3, width: '100%' },
  tCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
  },
  tCardIconOuter: { borderRadius: 16, overflow: 'hidden' },
  tCardIconGrad: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  tCardName: { color: colors.textPrimary, fontSize: 17, fontWeight: '900', letterSpacing: 0.2 },
  tCardDesc: { color: colors.textSecondary, fontSize: 12, lineHeight: 17, opacity: 0.85, marginTop: 2 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,255,136,0.12)', borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(0,255,136,0.35)',
  },
  livePillText: { color: colors.neon, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },

  prizeHero: {
    marginHorizontal: spacing.md,
    borderRadius: radius.lg, padding: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)',
  },
  prizeHeroLeft: { gap: 2 },
  prizeHeroLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  prizeHeroValue: { color: colors.gold, fontSize: 28, fontWeight: '900', letterSpacing: 0.3 },

  tCardStats: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  statChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  statDot: { width: 6, height: 6, borderRadius: 3 },
  statChipText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },

  ctaBtn: { marginHorizontal: spacing.md, marginBottom: spacing.md, borderRadius: radius.lg, overflow: 'hidden', ...shadow.gold },
  ctaBtnGrad: {
    paddingVertical: 14, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, borderRadius: radius.lg,
  },
  ctaBtnText: { color: colors.bgDeep, fontWeight: '900', fontSize: 15, letterSpacing: 0.4 },
  ctaEnded: {
    marginHorizontal: spacing.md, marginBottom: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.lg,
    paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  ctaEndedText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  ctaLocked: {
    marginHorizontal: spacing.md, marginBottom: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(107,90,142,0.1)', borderRadius: radius.lg, paddingVertical: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  ctaLockedText: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  ctaLateFee: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginBottom: spacing.md, fontStyle: 'italic', paddingHorizontal: spacing.md },

  // Game lobby
  lobbyBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1.5, borderBottomColor: 'rgba(255,215,0,0.2)',
    position: 'relative', overflow: 'hidden',
  },
  lobbyTopStripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  lobbyLeft: { flex: 1, gap: 3, padding: spacing.md, paddingTop: spacing.md + 4 },
  campaignPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,255,136,0.12)', borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)', marginBottom: 2,
  },
  campaignPillText: { color: colors.neon, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  lobbyTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '900', letterSpacing: 0.2 },
  lobbySub: { color: colors.textSecondary, fontSize: 12, opacity: 0.9 },
  lobbyRight: { alignItems: 'flex-end', gap: 6, padding: spacing.md, paddingTop: spacing.md + 4 },
  lobbyPtsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)',
  },
  lobbyPtsText: { color: colors.gold, fontWeight: '900', fontSize: 13 },
  lobbyTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lobbyCountdown: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },

  lobbySectionLabel: {
    color: 'rgba(143,126,166,0.9)', fontSize: 11, fontWeight: '900',
    letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 2,
  },

  // Game cards
  gameCard: {
    borderRadius: radius.lg + 2, overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)',
    ...shadow.card,
  },
  cardDisabled: { opacity: 0.45 },
  gameCardGrad: { position: 'relative' },
  gameAccentBar: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 3 },
  gameCardRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 14, gap: spacing.md,
  },
  gameIconWrap: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, flexShrink: 0,
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 4,
  },
  gameInfo: { flex: 1, gap: 3, minWidth: 0 },
  gameTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  gameTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '900', letterSpacing: 0.2, flexShrink: 1 },
  diffPill: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  diffText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  gameSub: { color: colors.textSecondary, fontSize: 11, opacity: 0.85 },
  gameMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' },
  gameTagPill: {
    borderWidth: 1, borderRadius: radius.sm,
    paddingHorizontal: 6, paddingVertical: 2, backgroundColor: 'rgba(0,0,0,0.3)',
  },
  gameTagText: { fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  gamePts: { fontSize: 10, fontWeight: '900', letterSpacing: 0.2 },
  playBtn: {
    width: 38, height: 38, borderRadius: 19, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 8, elevation: 5,
  },

  // Modals
  gameModal: { flex: 1, backgroundColor: colors.bg },
  gameModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md, borderBottomWidth: 1.5, borderBottomColor: 'rgba(255,215,0,0.15)',
  },
  backBtn: { padding: 4 },
  backBtnText: { color: colors.gold, fontSize: 14, fontWeight: '800' },
  gameModalTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '900' },
  adModal: { flex: 1, backgroundColor: colors.bg },
  adModalHeader: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  adModalTitle: { color: colors.gold, fontSize: 18, fontWeight: '800' },
});
