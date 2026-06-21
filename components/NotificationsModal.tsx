import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Switch, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Zap, Trophy, Clock, TrendingUp, ChevronLeft } from 'lucide-react-native';
import { useLanguage } from '@/hooks/useLanguage';
import { colors, spacing, radius, shadow } from '@/constants/theme';

type Props = {
  onClose: () => void;
};

export default function NotificationsModal({ onClose }: Props) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState({
    tournamentStart: true,
    tournamentEnd: true,
    newPrize: true,
    dailyReminder: false,
    pointsEarned: true,
    rankChange: true,
    newFeatures: true,
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 20 : 0) }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <ChevronLeft color={colors.textPrimary} size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('notifTitle')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoBox}>
          <Bell color={colors.gold} size={20} />
          <Text style={styles.infoText}>
            {t('notifInfo')}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>{t('notifTourneyUpdates')}</Text>

        <SettingRow
          icon={<Trophy color={colors.gold} size={20} />}
          title={t('notifTStart')}
          subtitle={t('notifTStartSub')}
          value={settings.tournamentStart}
          onToggle={() => toggleSetting('tournamentStart')}
        />

        <SettingRow
          icon={<Clock color={colors.neon} size={20} />}
          title={t('notifTEnd')}
          subtitle={t('notifTEndSub')}
          value={settings.tournamentEnd}
          onToggle={() => toggleSetting('tournamentEnd')}
        />

        <SettingRow
          icon={<TrendingUp color={colors.success} size={20} />}
          iconBg="rgba(0,255,136,0.15)"
          title={t('notifNewPrize')}
          subtitle={t('notifNewPrizeSub')}
          value={settings.newPrize}
          onToggle={() => toggleSetting('newPrize')}
        />

        <Text style={styles.sectionTitle}>{t('notifActivityAlerts')}</Text>

        <SettingRow
          icon={<Zap color={colors.warning} size={20} />}
          iconBg="rgba(255,165,0,0.15)"
          title={t('notifPointsEarned')}
          subtitle={t('notifPointsEarnedSub')}
          value={settings.pointsEarned}
          onToggle={() => toggleSetting('pointsEarned')}
        />

        <SettingRow
          icon={<Trophy color={colors.neon} size={20} />}
          title={t('notifRankChange')}
          subtitle={t('notifRankChangeSub')}
          value={settings.rankChange}
          onToggle={() => toggleSetting('rankChange')}
        />

        <SettingRow
          icon={<Clock color={colors.textMuted} size={20} />}
          title={t('notifDailyReminder')}
          subtitle={t('notifDailyReminderSub')}
          value={settings.dailyReminder}
          onToggle={() => toggleSetting('dailyReminder')}
        />

        <Text style={styles.sectionTitle}>{t('notifAppUpdates')}</Text>

        <SettingRow
          icon={<Bell color={colors.info} size={20} />}
          iconBg="rgba(59,130,246,0.15)"
          title={t('notifNewFeatures')}
          subtitle={t('notifNewFeaturesSub')}
          value={settings.newFeatures}
          onToggle={() => toggleSetting('newFeatures')}
        />

        <View style={styles.saveBox}>
          <TouchableOpacity style={styles.saveBtn} onPress={onClose}>
            <Text style={styles.saveBtnText}>{t('notifSavePrefs')}</Text>
          </TouchableOpacity>
          <Text style={styles.saveNote}>
            {t('notifSaveNote')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

type SettingRowProps = {
  icon: React.ReactNode;
  iconBg?: string;
  title: string;
  subtitle: string;
  value: boolean;
  onToggle: () => void;
};

function SettingRow({ icon, iconBg, title, subtitle, value, onToggle }: SettingRowProps) {
  return (
    <View style={styles.settingRow}>
      <View style={[styles.iconBox, iconBg && { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <View style={styles.settingText}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSub}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.bgDeep, true: colors.gold }}
        thumbColor={value ? colors.bgDeep : colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { padding: 4 },
  title: { color: colors.gold, fontSize: 18, fontWeight: '800' },
  content: { padding: spacing.md },
  infoBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, borderRadius: radius.md,
    backgroundColor: 'rgba(255,215,0,0.08)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)',
    marginBottom: spacing.lg,
  },
  infoText: { color: colors.textSecondary, fontSize: 13, flex: 1 },
  sectionTitle: {
    color: colors.textPrimary, fontWeight: '700', fontSize: 15,
    marginTop: spacing.md, marginBottom: spacing.sm,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  iconBox: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,215,0,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.md,
  },
  settingText: { flex: 1 },
  settingTitle: { color: colors.textPrimary, fontWeight: '600', fontSize: 14 },
  settingSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  saveBox: { marginTop: spacing.xl, alignItems: 'center' },
  saveBtn: {
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderRadius: radius.md, alignItems: 'center',
  },
  saveBtnText: { color: colors.bgDeep, fontWeight: '800', fontSize: 14 },
  saveNote: { color: colors.textMuted, fontSize: 11, marginTop: spacing.sm },
});
