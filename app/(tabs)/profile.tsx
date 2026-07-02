import React, { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, Modal, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  LogOut, Star, Award, Clock, ChevronRight, Trophy, Lock,
  Globe, Bell, Sparkles, MessageSquare, X, Crown, Zap,
  Target, Flame, TrendingUp, Shield, GamepadIcon
} from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useTournament } from '@/hooks/useTournament';
import { useLanguage } from '@/hooks/useLanguage';
import ParticleBackground from '@/components/ParticleBackground';
import NotificationsModal from '@/components/NotificationsModal';
import AchievementsModal from '@/components/AchievementsModal';
import SupportModal from '@/components/SupportModal';
import TournamentPrizeDashboard from '@/components/TournamentPrizeDashboard';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { formatEthiopianMonthYear } from '@/lib/ethiopianCalendar';

// ─── Level / tier system ────────────────────────────────────────────────────
function getLevel(points: number) {
  if (points >= 10000) return { level: 10, title: 'LEGEND', tierKey: 'tierLegend' as const, color: '#FF6B6B', nextAt: null };
  if (points >= 5000)  return { level: 8,  title: 'MASTER',  tierKey: 'tierMaster' as const,  color: '#FFD700', nextAt: 10000 };
  if (points >= 2500)  return { level: 6,  title: 'DIAMOND', tierKey: 'tierDiamond' as const, color: '#00FFCC', nextAt: 5000 };
  if (points >= 1000)  return { level: 4,  title: 'GOLD',    tierKey: 'tierGold' as const,    color: '#FFD700', nextAt: 2500 };
  if (points >= 500)   return { level: 3,  title: 'SILVER',  tierKey: 'tierSilver' as const,  color: '#C0C0C0', nextAt: 1000 };
  if (points >= 100)   return { level: 2,  title: 'BRONZE',  tierKey: 'tierBronze' as const,  color: '#CD7F32', nextAt: 500 };
  return { level: 1, title: 'ROOKIE', tierKey: 'tierRookie' as const, color: '#8F7EA6', nextAt: 100 };
}

function getLevelProgress(points: number, nextAt: number | null, prevAt: number) {
  if (!nextAt) return 1;
  return Math.min((points - prevAt) / (nextAt - prevAt), 1);
}

function getPrevAt(points: number) {
  if (points >= 10000) return 5000;
  if (points >= 5000)  return 2500;
  if (points >= 2500)  return 1000;
  if (points >= 1000)  return 500;
  if (points >= 500)   return 100;
  if (points >= 100)   return 0;
  return 0;
}

// ─── Stat pill ───────────────────────────────────────────────────────────────
function StatPill({
  icon, value, label, color = colors.gold
}: { icon: React.ReactNode; value: string | number; label: string; color?: string }) {
  return (
    <View style={[statPillStyles.wrap, { borderColor: color + '40' }]}>
      {icon}
      <Text style={[statPillStyles.value, { color }]}>{value}</Text>
      <Text style={statPillStyles.label}>{label}</Text>
    </View>
  );
}

const statPillStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    backgroundColor: '#1C0D3260',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    gap: 3,
  },
  value: { fontSize: 18, fontWeight: '900', letterSpacing: 0.2 },
  label: { color: colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.5, textAlign: 'center' },
});

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const { tournament, timeLeft, isExpired, refetch: refetchTournament, refreshPoints } = useTournament();
  const { lang, setLang, t } = useLanguage();
  const [signingOut, setSigningOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshProfile();
      refetchTournament();
      refreshPoints();
    }, [refreshProfile, refetchTournament, refreshPoints])
  );
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showAchievementsModal, setShowAchievementsModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showPrizeDashboard, setShowPrizeDashboard] = useState(false);
  const [prizeDashboardKey, setPrizeDashboardKey] = useState(0);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Password Too Short', 'Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords Don\'t Match', 'Please ensure both passwords are identical');
      return;
    }

    setPasswordLoading(true);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Success', 'Password changed successfully');
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordModal(false);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const pts = profile?.points ?? 0;
  const lvl = getLevel(pts);
  const prevAt = getPrevAt(pts);
  const progress = getLevelProgress(pts, lvl.nextAt, prevAt);
  const initial = (profile?.username ?? user?.email ?? user?.phone ?? 'U').charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.root}>
      <ParticleBackground />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Hero Header ───────────────────────────────────── */}
        <LinearGradient colors={['#2D0B4E', '#1A0B2E', '#0D0618']} style={styles.profileHeader}>
          <View style={styles.headerAccentBar} />

          {/* Level badge top-right */}
          <View style={[styles.levelBadge, { borderColor: lvl.color + '70', backgroundColor: lvl.color + '15' }]}>
            <Text style={[styles.levelBadgeText, { color: lvl.color }]}>{t('lvlLabel')} {lvl.level}</Text>
          </View>

          {/* Avatar */}
          <View style={styles.avatarOuter}>
            <View style={[styles.avatarCircle, { borderColor: lvl.color }]}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={[styles.avatarGlowRing, { borderColor: lvl.color + '30' }]} />
            {/* Shield icon on avatar bottom */}
            <View style={[styles.tierBadge, { backgroundColor: lvl.color }]}>
              <Shield color="#0D0618" size={10} fill="#0D0618" />
            </View>
          </View>

          <Text style={styles.profileName}>{profile?.username ?? 'Champion'}</Text>
          <Text style={styles.profileEmail}>{user?.email || user?.phone || ''}</Text>

          {/* Tier pill */}
          <View style={[styles.profileBadge, { borderColor: lvl.color + '60', backgroundColor: lvl.color + '15' }]}>
            <Star color={lvl.color} size={10} fill={lvl.color} />
            <Text style={[styles.profileBadgeText, { color: lvl.color }]}>{t(lvl.tierKey)} · {t('championParticipant')}</Text>
          </View>

          {/* XP Progress bar */}
          <View style={styles.xpBarWrap}>
            <View style={styles.xpBarRow}>
              <Text style={styles.xpBarLabel}>{t('xpProgress')}</Text>
              {lvl.nextAt ? (
                <Text style={styles.xpBarValue}>{pts} / {lvl.nextAt} pts</Text>
              ) : (
                <Text style={[styles.xpBarValue, { color: '#FF6B6B' }]}>{t('maxLevel')}</Text>
              )}
            </View>
            <View style={styles.xpBarBg}>
              <View style={[styles.xpBarFill, { width: `${Math.round(progress * 100)}%` as any, backgroundColor: lvl.color }]} />
            </View>
            {lvl.nextAt && (
              <Text style={styles.xpBarHint}>{lvl.nextAt - pts} {t('ptsToLevelUp')} {t(getLevel(lvl.nextAt).tierKey)}</Text>
            )}
          </View>
        </LinearGradient>

        {/* ── Stats Grid ────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatPill
            icon={<Trophy color={colors.gold} size={18} fill={colors.gold} />}
            value={pts}
            label={t('statTotalXp')}
            color={colors.gold}
          />
          <StatPill
            icon={<GamepadIcon color={colors.neon} size={18} />}
            value={profile?.games_played ?? 0}
            label={t('statGames')}
            color={colors.neon}
          />
          <StatPill
            icon={<Flame color="#FF6B6B" size={18} />}
            value={`${profile?.daily_streak ?? 0}🔥`}
            label={t('statStreak')}
            color="#FF6B6B"
          />
          <StatPill
            icon={<Clock color={colors.textSecondary} size={18} />}
            value={isExpired ? '—' : `${timeLeft.days}d ${timeLeft.hours}h`}
            label={t('statCampaign')}
            color={colors.textSecondary}
          />
        </View>

        {/* ── Tournament Info ───────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Zap color={colors.gold} size={13} fill={colors.gold} />
            <Text style={styles.sectionTitle}>{t('activeCampaignDetails')}</Text>
          </View>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Award color={colors.gold} size={15} fill={colors.gold} />
              <Text style={styles.infoLabel}>{t('activeLobby')}</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{tournament?.name ?? '—'}</Text>
            </View>
            <View style={[styles.infoRow, styles.infoRowBorder]}>
              <Sparkles color={colors.neon} size={15} />
              <Text style={styles.infoLabel}>{t('grandPrize')}</Text>
              <Text style={[styles.infoValue, { color: colors.gold }]}>{tournament?.prize_pool ?? '—'}</Text>
            </View>
            <View style={[styles.infoRow, styles.infoRowBorder]}>
              <Target color={colors.textSecondary} size={15} />
              <Text style={styles.infoLabel}>{t('missionStatus')}</Text>
              <View style={[styles.statusBadge, {
                backgroundColor: isExpired ? 'rgba(255,68,68,0.12)' : 'rgba(0,255,136,0.12)',
                borderColor: isExpired ? colors.error : colors.success
              }]}>
                <Text style={[styles.statusText, { color: isExpired ? colors.error : colors.success }]}>
                  {isExpired ? t('expiredStatus') : t('activeStatus')}
                </Text>
              </View>
            </View>
            {!isExpired && tournament && (
              <View style={[styles.infoRow, styles.infoRowBorder]}>
                <Clock color={colors.textSecondary} size={15} />
                <Text style={styles.infoLabel}>Time Remaining</Text>
                <Text style={[styles.infoValue, { color: colors.neon }]}>
                  {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Account Info ─────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Shield color={colors.textSecondary} size={13} />
            <Text style={styles.sectionTitle}>{t('gamerCredentials')}</Text>
          </View>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('email')}</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{user?.email ?? '—'}</Text>
            </View>
            <View style={[styles.infoRow, styles.infoRowBorder]}>
              <Text style={styles.infoLabel}>{t('fullName')}</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{profile?.full_name ?? '—'}</Text>
            </View>
            <View style={[styles.infoRow, styles.infoRowBorder]}>
              <Text style={styles.infoLabel}>{t('phoneNumber')}</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{profile?.phone_number || user?.phone || '—'}</Text>
            </View>
            <View style={[styles.infoRow, styles.infoRowBorder]}>
              <Text style={styles.infoLabel}>{t('memberSince')}</Text>
              <Text style={styles.infoValue}>
                {profile?.created_at
                  ? lang === 'am'
                    ? formatEthiopianMonthYear(profile.created_at, 'am')
                    : new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                  : '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Performance Highlights ────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <TrendingUp color={colors.neon} size={13} />
            <Text style={styles.sectionTitle}>{t('performanceHighlights')}</Text>
          </View>
          <View style={styles.highlightsGrid}>
            <View style={[styles.highlightCard, { borderColor: colors.gold + '40' }]}>
              <Text style={styles.highlightEmoji}>🏆</Text>
              <Text style={[styles.highlightNum, { color: colors.gold }]}>{pts.toLocaleString()}</Text>
              <Text style={styles.highlightLbl}>{t('lifetimePoints')}</Text>
            </View>
            <View style={[styles.highlightCard, { borderColor: colors.neon + '40' }]}>
              <Text style={styles.highlightEmoji}>🎮</Text>
              <Text style={[styles.highlightNum, { color: colors.neon }]}>{profile?.games_played ?? 0}</Text>
              <Text style={styles.highlightLbl}>{t('gamesPlayedHighlight')}</Text>
            </View>
            <View style={[styles.highlightCard, { borderColor: '#FF6B6B40' }]}>
              <Text style={styles.highlightEmoji}>🔥</Text>
              <Text style={[styles.highlightNum, { color: '#FF6B6B' }]}>{profile?.daily_streak ?? 0}</Text>
              <Text style={styles.highlightLbl}>{t('dayStreakHighlight')}</Text>
            </View>
            <View style={[styles.highlightCard, { borderColor: lvl.color + '40' }]}>
              <Text style={styles.highlightEmoji}>⭐</Text>
              <Text style={[styles.highlightNum, { color: lvl.color }]}>{lvl.level}</Text>
              <Text style={styles.highlightLbl}>{t('playerLevelHighlight')}</Text>
            </View>
          </View>
        </View>

        {/* ── Settings ─────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Target color={colors.textSecondary} size={13} />
            <Text style={styles.sectionTitle}>{t('systemConfigurations')}</Text>
          </View>
          <View style={styles.settingsCard}>

            {/* Change Password */}
            <TouchableOpacity style={styles.settingRow} onPress={() => setShowPasswordModal(true)}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIconWrap, { backgroundColor: 'rgba(107,90,142,0.15)' }]}>
                  <Lock color={colors.textSecondary} size={16} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>{t('changePassword')}</Text>
                  <Text style={styles.settingSub}>{t('changePasswordSub')}</Text>
                </View>
              </View>
              <ChevronRight color={colors.textMuted} size={18} />
            </TouchableOpacity>

            {/* Language */}
            <View style={[styles.settingRow, styles.settingRowNoBorder]}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIconWrap, { backgroundColor: 'rgba(0,255,204,0.1)' }]}>
                  <Globe color={colors.neon} size={16} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>{t('arenaLanguage')}</Text>
                  <Text style={styles.settingSub}>
                    {lang === 'en' ? t('englishInterface') : t('amharicInterface')}
                  </Text>
                </View>
              </View>
              <View style={styles.languageButtons}>
                <TouchableOpacity
                  style={[styles.langBtn, lang === 'en' && styles.langBtnActive]}
                  onPress={() => setLang('en')}
                >
                  <Text style={[styles.langBtnText, lang === 'en' && styles.langBtnTextActive]}>EN</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.langBtn, lang === 'am' && styles.langBtnActive]}
                  onPress={() => setLang('am')}
                >
                  <Text style={[styles.langBtnText, lang === 'am' && styles.langBtnTextActive]}>AM</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Push Notifications */}
            <TouchableOpacity style={styles.settingRow} onPress={() => setShowNotificationsModal(true)}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIconWrap, { backgroundColor: 'rgba(255,179,71,0.12)' }]}>
                  <Bell color={colors.warning} size={16} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>{t('lobbyNotifications')}</Text>
                  <Text style={styles.settingSub}>{t('manageNotifsDesc')}</Text>
                </View>
              </View>
              <ChevronRight color={colors.textMuted} size={18} />
            </TouchableOpacity>

            {/* Achievements */}
            <TouchableOpacity style={styles.settingRow} onPress={() => setShowAchievementsModal(true)}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIconWrap, { backgroundColor: 'rgba(255,215,0,0.12)' }]}>
                  <Trophy color={colors.gold} size={16} fill={colors.gold} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>{t('myAchievements')}</Text>
                  <Text style={styles.settingSub}>{t('unlockedAchievementsAwards')}</Text>
                </View>
              </View>
              <ChevronRight color={colors.textMuted} size={18} />
            </TouchableOpacity>

            {/* Help & Support */}
            <TouchableOpacity style={[styles.settingRow, styles.settingRowNoBorder]} onPress={() => setShowSupportModal(true)}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIconWrap, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                  <MessageSquare color={colors.info} size={16} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>{t('supportTitle')}</Text>
                  <Text style={styles.settingSub}>{t('supportAgent')}</Text>
                </View>
              </View>
              <ChevronRight color={colors.textMuted} size={18} />
            </TouchableOpacity>
          </View>

          {/* Prize Dashboard – stand-alone CTA */}
          <TouchableOpacity
            style={styles.prizeDashboardRow}
            onPress={() => { setPrizeDashboardKey(k => k + 1); setShowPrizeDashboard(true); }}
          >
            <LinearGradient colors={['#2D1555', '#1C0D32']} style={styles.prizeDashboardInner}>
              <Crown color={colors.gold} size={20} fill={colors.gold} />
              <View style={{ flex: 1 }}>
                <Text style={styles.prizeDashboardTitle}>{t('prizeDashboard')}</Text>
                <Text style={styles.prizeDashboardSub}>{t('prizeDashboardSub')}</Text>
              </View>
              <ChevronRight color={colors.gold} size={18} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* ── Sign Out ─────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.signOutBtn, signingOut && styles.signOutBtnDisabled]}
          onPress={handleSignOut}
          disabled={signingOut}
        >
          <LogOut color={colors.error} size={16} />
          <Text style={styles.signOutText}>{signingOut ? t('signingOut') : t('terminateSession')}</Text>
        </TouchableOpacity>

        <Text style={styles.version}>{t('version')}</Text>
      </ScrollView>

      {/* Password Modal */}
      <Modal
        visible={showPasswordModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
              <X color={colors.textMuted} size={22} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('changeAccessPassword')}</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.passwordForm}>
              <Text style={styles.formLabel}>{t('newPassword')}</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter new password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                editable={!passwordLoading}
              />

              <Text style={styles.formLabel}>{t('confirmPassword')}</Text>
              <TextInput
                style={styles.input}
                placeholder="Confirm new password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!passwordLoading}
              />

              <TouchableOpacity
                style={[styles.updateBtn, passwordLoading && styles.updateBtnDisabled]}
                onPress={handleChangePassword}
                disabled={passwordLoading}
              >
                <Text style={styles.updateBtnText}>
                  {passwordLoading ? 'UPDATING CREDENTIALS...' : 'CONFIRM NEW PASSWORD'}
                </Text>
              </TouchableOpacity>

              <View style={styles.passwordTips}>
                <Text style={styles.passwordTipsTitle}>{t('passwordReqs')}</Text>
                <Text style={styles.passwordTip}>• Must be at least 6 characters in length</Text>
                <Text style={styles.passwordTip}>• Ensure passwords are matching exactly</Text>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Notifications Modal */}
      <Modal
        visible={showNotificationsModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowNotificationsModal(false)}
      >
        <NotificationsModal onClose={() => setShowNotificationsModal(false)} />
      </Modal>

      {/* Achievements Modal */}
      <Modal
        visible={showAchievementsModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowAchievementsModal(false)}
      >
        <AchievementsModal onClose={() => setShowAchievementsModal(false)} />
      </Modal>

      {/* Support Modal */}
      <Modal
        visible={showSupportModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowSupportModal(false)}
      >
        <SupportModal onClose={() => setShowSupportModal(false)} />
      </Modal>

      {/* Prize Dashboard Modal */}
      <Modal
        visible={showPrizeDashboard}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowPrizeDashboard(false)}
      >
        <TournamentPrizeDashboard key={prizeDashboardKey} onClose={() => setShowPrizeDashboard(false)} />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 110 },

  // ── Hero Header ────────────────────────────────────────────────────────────
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl + 10,
    paddingBottom: spacing.xl,
    borderBottomWidth: 1.5,
    borderBottomColor: '#3D1F6E60',
    gap: 6,
    position: 'relative',
  },
  headerAccentBar: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: colors.gold,
  },
  levelBadge: {
    position: 'absolute', top: 14, right: 16,
    borderWidth: 1.5, borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  levelBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  avatarOuter: { position: 'relative', marginBottom: 6 },
  avatarCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#0D0618', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5,
    shadowColor: colors.gold, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 16,
  },
  avatarGlowRing: {
    position: 'absolute', top: -5, left: -5, right: -5, bottom: -5, borderRadius: 50,
    borderWidth: 1.5,
  },
  tierBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#0D0618',
  },
  avatarText: { fontSize: 36, fontWeight: '900', color: colors.textPrimary },
  profileName: { color: colors.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: 0.5 },
  profileEmail: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  profileBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, marginTop: 4,
  },
  profileBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },

  // XP Bar
  xpBarWrap: {
    width: '100%', marginTop: 10, gap: 5,
  },
  xpBarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  xpBarLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  xpBarValue: { color: colors.gold, fontSize: 10, fontWeight: '900' },
  xpBarBg: {
    height: 8, backgroundColor: '#0D0618',
    borderRadius: radius.full, overflow: 'hidden',
    borderWidth: 1, borderColor: '#3D1F6E50',
  },
  xpBarFill: { height: '100%', borderRadius: radius.full },
  xpBarHint: { color: colors.textMuted, fontSize: 9, fontWeight: '700', textAlign: 'center' },

  // ── Stats Row ─────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },

  // ── Section ───────────────────────────────────────────────────────────────
  section: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#8F7EA6', fontSize: 10, fontWeight: '900',
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  infoCard: {
    backgroundColor: '#1C0D3280', borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: '#3D1F6E50', overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.md,
    gap: spacing.sm,
  },
  infoRowBorder: { borderTopWidth: 1.5, borderTopColor: '#0D0618' },
  infoLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '700', flex: 1 },
  infoValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '800', flex: 1, textAlign: 'right' },
  statusBadge: {
    borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2,
  },
  statusText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },

  // ── Highlights grid ───────────────────────────────────────────────────────
  highlightsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  highlightCard: {
    width: '47%', backgroundColor: '#1C0D3270',
    borderRadius: radius.lg, borderWidth: 1.5,
    padding: 14, alignItems: 'center', gap: 4,
  },
  highlightEmoji: { fontSize: 22 },
  highlightNum: { fontSize: 22, fontWeight: '900', letterSpacing: 0.2 },
  highlightLbl: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  // ── Settings card ─────────────────────────────────────────────────────────
  settingsCard: {
    backgroundColor: '#1C0D3280', borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: '#3D1F6E50', overflow: 'hidden',
    marginBottom: 10,
  },
  settingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    borderBottomWidth: 1.5, borderBottomColor: '#3D1F6E35',
  },
  settingRowNoBorder: { borderBottomWidth: 0 },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  settingIconWrap: {
    width: 36, height: 36, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  settingInfo: { gap: 2 },
  settingTitle: { color: colors.textPrimary, fontWeight: '800', fontSize: 14, letterSpacing: 0.2 },
  settingSub: { color: colors.textMuted, fontSize: 12 },
  languageButtons: { flexDirection: 'row', gap: 6 },
  langBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radius.sm, borderWidth: 1, borderColor: '#3D1F6E60',
    backgroundColor: '#0D0618',
  },
  langBtnActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  langBtnText: { color: '#8F7EA6', fontWeight: '800', fontSize: 10 },
  langBtnTextActive: { color: colors.bgDeep },

  // Prize dashboard
  prizeDashboardRow: {
    borderRadius: radius.lg, overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(255,215,0,0.35)',
  },
  prizeDashboardInner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: spacing.md, paddingVertical: 14,
  },
  prizeDashboardTitle: { color: colors.gold, fontWeight: '900', fontSize: 14, letterSpacing: 0.3 },
  prizeDashboardSub: { color: colors.textMuted, fontSize: 11, marginTop: 1 },

  // ── Sign Out ──────────────────────────────────────────────────────────────
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: spacing.md, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1.5, borderColor: 'rgba(255,68,68,0.45)',
    backgroundColor: 'rgba(255,68,68,0.07)', marginBottom: spacing.md,
  },
  signOutBtnDisabled: { opacity: 0.5 },
  signOutText: { color: colors.error, fontSize: 13, fontWeight: '900', letterSpacing: 0.8 },
  version: { color: colors.textMuted, fontSize: 10, fontWeight: '700', textAlign: 'center', marginTop: spacing.sm },

  // ── Modal ─────────────────────────────────────────────────────────────────
  modalRoot: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1.5, borderBottomColor: '#3D1F6E50',
  },
  modalTitle: { color: colors.gold, fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  modalContent: { padding: spacing.md },
  passwordForm: { gap: spacing.md },
  formLabel: { color: colors.textPrimary, fontWeight: '800', fontSize: 13, marginTop: spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#0D0618', borderWidth: 1.5, borderColor: '#3D1F6E60',
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    color: colors.textPrimary, fontSize: 14,
  },
  updateBtn: {
    backgroundColor: colors.gold, paddingVertical: spacing.md, borderRadius: radius.md,
    alignItems: 'center', marginTop: spacing.lg,
  },
  updateBtnDisabled: { opacity: 0.6 },
  updateBtnText: { color: colors.bgDeep, fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  passwordTips: { marginTop: spacing.xl, padding: spacing.md, backgroundColor: 'rgba(255,215,0,0.06)', borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255,215,0,0.15)' },
  passwordTipsTitle: { color: colors.gold, fontWeight: '900', fontSize: 12, marginBottom: 6, letterSpacing: 0.5 },
  passwordTip: { color: colors.textMuted, fontSize: 11, marginVertical: 2 },
});
