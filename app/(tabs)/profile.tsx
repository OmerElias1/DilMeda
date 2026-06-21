import React, { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, Modal, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { LogOut, Star, Award, Clock, ChevronRight, Trophy, Lock, Globe, Bell, Sparkles, MessageSquare } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useTournament } from '@/hooks/useTournament';
import { useLanguage } from '@/hooks/useLanguage';
import ParticleBackground from '@/components/ParticleBackground';
import NotificationsModal from '@/components/NotificationsModal';
import AchievementsModal from '@/components/AchievementsModal';
import SupportModal from '@/components/SupportModal';
import { colors, spacing, radius, shadow } from '@/constants/theme';
import { formatEthiopianMonthYear } from '@/lib/ethiopianCalendar';

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

  const initial = (profile?.username ?? user?.email ?? user?.phone ?? 'U').charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.root}>
      <ParticleBackground />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile header */}
        <LinearGradient colors={['#270C4E', '#0D0618']} style={styles.profileHeader}>
          <View style={styles.headerAccentBar} />
          
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initial}</Text>
            <View style={styles.avatarGlowRing} />
          </View>
          <Text style={styles.profileName}>{profile?.username ?? 'Champion'}</Text>
          <Text style={styles.profileEmail}>{user?.email || user?.phone || ''}</Text>
          
          <View style={styles.profileBadge}>
            <Star color={colors.gold} size={11} fill={colors.gold} />
            <Text style={styles.profileBadgeText}>{t('championParticipant')}</Text>
          </View>
        </LinearGradient>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, shadow.gold, { borderColor: 'rgba(255, 215, 0, 0.35)' }]}>
            <Trophy color={colors.gold} size={22} fill={colors.gold} />
            <Text style={styles.statValue}>{profile?.points ?? 0}</Text>
            <Text style={styles.statLabel}>{t('totalXpScore')}</Text>
          </View>
          <View style={styles.statCard}>
            <Clock color={colors.textSecondary} size={22} />
            <Text style={[styles.statValue, { color: colors.neon }]}>
              {isExpired ? 'ENDED' : `${timeLeft.days}d ${timeLeft.hours}h`}
            </Text>
            <Text style={styles.statLabel}>{t('campaignTime')}</Text>
          </View>
        </View>

        {/* Tournament Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('activeCampaignDetails')}</Text>
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
              <Clock color={colors.textSecondary} size={15} />
              <Text style={styles.infoLabel}>{t('missionStatus')}</Text>
              <View style={[styles.statusBadge, { backgroundColor: isExpired ? 'rgba(255,68,68,0.12)' : 'rgba(0,255,136,0.12)', borderColor: isExpired ? colors.error : colors.success }]}>
                <Text style={[styles.statusText, { color: isExpired ? colors.error : colors.success }]}>
                  {isExpired ? t('expiredStatus') : t('activeStatus')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Account Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('gamerCredentials')}</Text>
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

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('systemConfigurations')}</Text>

          {/* Change Password */}
          <TouchableOpacity style={styles.settingRow} onPress={() => setShowPasswordModal(true)}>
            <View style={styles.settingLeft}>
              <Lock color={colors.textSecondary} size={18} />
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>{t('changePassword')}</Text>
                <Text style={styles.settingSub}>{t('changePasswordSub')}</Text>
              </View>
            </View>
            <ChevronRight color={colors.textMuted} size={18} />
          </TouchableOpacity>

          {/* Language */}
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Globe color={colors.textSecondary} size={18} />
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
              <Bell color={colors.textSecondary} size={18} />
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
              <Trophy color={colors.gold} size={18} fill={colors.gold} />
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>{t('myAchievements')}</Text>
                <Text style={styles.settingSub}>{t('unlockedAchievementsAwards')}</Text>
              </View>
            </View>
            <ChevronRight color={colors.textMuted} size={18} />
          </TouchableOpacity>

          {/* Help & Support */}
          <TouchableOpacity style={styles.settingRow} onPress={() => setShowSupportModal(true)}>
            <View style={styles.settingLeft}>
              <MessageSquare color={colors.gold} size={18} />
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>{t('supportTitle')}</Text>
                <Text style={styles.settingSub}>{t('supportAgent')}</Text>
              </View>
            </View>
            <ChevronRight color={colors.textMuted} size={18} />
          </TouchableOpacity>
        </View>

        {/* Sign Out */}
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
              <Text style={styles.modalCloseBtn}>✕</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 110 },
  
  // Profile Header Card styling
  profileHeader: {
    alignItems: 'center', padding: spacing.xl,
    paddingTop: spacing.xl + 10, paddingBottom: spacing.xl,
    borderBottomWidth: 1.5, borderBottomColor: '#3D1F6E60',
    gap: 6, position: 'relative',
  },
  headerAccentBar: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: colors.gold,
  },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#0D0618', alignItems: 'center', justifyContent: 'center',
    marginBottom: 6, borderWidth: 2, borderColor: colors.gold,
    position: 'relative',
    shadowColor: colors.gold, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 12,
  },
  avatarGlowRing: {
    position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: 44,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.25)',
  },
  avatarText: { fontSize: 32, fontWeight: '900', color: colors.textPrimary },
  profileName: { color: colors.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: 0.5 },
  profileEmail: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  profileBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,215,0,0.12)', borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)',
    marginTop: 6,
  },
  profileBadgeText: { color: colors.gold, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  
  // Stats Row
  statsRow: {
    flexDirection: 'row', gap: spacing.md,
    padding: spacing.md,
  },
  statCard: {
    flex: 1, backgroundColor: '#1C0D3280', borderRadius: radius.lg,
    padding: spacing.md, alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: '#3D1F6E50',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6,
    elevation: 4,
  },
  statValue: { color: colors.gold, fontSize: 22, fontWeight: '900', letterSpacing: 0.2 },
  statLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  
  // Section style
  section: { padding: spacing.md, paddingTop: 0 },
  sectionTitle: { color: '#8F7EA6', fontSize: 10, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
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
  
  // Sign Out button
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: spacing.md, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1.5, borderColor: 'rgba(255,68,68,0.45)',
    backgroundColor: 'rgba(255,68,68,0.07)',
  },
  signOutBtnDisabled: { opacity: 0.5 },
  signOutText: { color: colors.error, fontSize: 13, fontWeight: '900', letterSpacing: 0.8 },
  version: { color: colors.textMuted, fontSize: 10, fontWeight: '700', textAlign: 'center', marginTop: spacing.lg },
  
  // Settings menu items
  settingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    borderBottomWidth: 1.5, borderBottomColor: '#3D1F6E35',
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
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
  
  modalRoot: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1.5, borderBottomColor: '#3D1F6E50',
  },
  modalCloseBtn: { color: colors.textMuted, fontSize: 22 },
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
    alignItems: 'center', marginTop: spacing.lg, ...shadow.gold,
  },
  updateBtnDisabled: { opacity: 0.6 },
  updateBtnText: { color: colors.bgDeep, fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  passwordTips: { marginTop: spacing.xl, padding: spacing.md, backgroundColor: 'rgba(255,215,0,0.06)', borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255,215,0,0.15)' },
  passwordTipsTitle: { color: colors.gold, fontWeight: '900', fontSize: 12, marginBottom: 6, letterSpacing: 0.5 },
  passwordTip: { color: colors.textMuted, fontSize: 11, marginVertical: 2 },
});
