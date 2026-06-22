import { useState, useEffect, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type NotificationPreferences = {
  tournament_start: boolean;
  tournament_end: boolean;
  new_prize: boolean;
  daily_reminder: boolean;
  points_earned: boolean;
  rank_change: boolean;
  new_features: boolean;
};

export function useNotifications() {
  const [permissions, setPermissions] = useState<Notifications.PermissionStatus>();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    tournament_start: true,
    tournament_end: true,
    new_prize: true,
    daily_reminder: false,
    points_earned: true,
    rank_change: true,
    new_features: true,
  });
  const [loading, setLoading] = useState(true);

  // Request notification permissions
  const requestPermissions = useCallback(async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    const existingStatus = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      finalStatus = await Notifications.requestPermissionsAsync();
    }
    
    setPermissions(finalStatus);
    return finalStatus === 'granted';
  }, []);

  // Get push notification token
  const getPushToken = useCallback(async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return null;

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    
    setPushToken(token.data);
    return token.data;
  }, [requestPermissions]);

  // Load notification preferences from Supabase
  const loadPreferences = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading notification preferences:', error);
        return;
      }

      if (data) {
        setPreferences({
          tournament_start: data.tournament_start,
          tournament_end: data.tournament_end,
          new_prize: data.new_prize,
          daily_reminder: data.daily_reminder,
          points_earned: data.points_earned,
          rank_change: data.rank_change,
          new_features: data.new_features,
        });
        if (data.push_token) {
          setPushToken(data.push_token);
        }
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save notification preferences to Supabase
  const savePreferences = useCallback(async (newPreferences: Partial<NotificationPreferences>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const token = pushToken || await getPushToken();
      const updatedPrefs = { ...preferences, ...newPreferences };

      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          tournament_start: updatedPrefs.tournament_start,
          tournament_end: updatedPrefs.tournament_end,
          new_prize: updatedPrefs.new_prize,
          daily_reminder: updatedPrefs.daily_reminder,
          points_earned: updatedPrefs.points_earned,
          rank_change: updatedPrefs.rank_change,
          new_features: updatedPrefs.new_features,
          push_token: token,
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error saving notification preferences:', error);
        return false;
      }

      setPreferences(updatedPrefs);
      return true;
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      return false;
    }
  }, [preferences, pushToken, getPushToken]);

  // Send a local notification
  const sendNotification = useCallback(async (title: string, body: string, data?: any) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
        },
        trigger: null, // Send immediately
      });
      return true;
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  }, []);

  // Schedule a notification for a specific time
  const scheduleNotification = useCallback(async (
    title: string,
    body: string,
    trigger: Notifications.NotificationTriggerInput,
    data?: any
  ) => {
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
        },
        trigger,
      });
      return identifier;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return null;
    }
  }, []);

  // Cancel a scheduled notification
  const cancelNotification = useCallback(async (identifier: string) => {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
      return true;
    } catch (error) {
      console.error('Error canceling notification:', error);
      return false;
    }
  }, []);

  // Cancel all scheduled notifications
  const cancelAllNotifications = useCallback(async () => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      return true;
    } catch (error) {
      console.error('Error canceling all notifications:', error);
      return false;
    }
  }, []);

  // Initialize notifications
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  return {
    permissions,
    pushToken,
    preferences,
    loading,
    requestPermissions,
    getPushToken,
    savePreferences,
    sendNotification,
    scheduleNotification,
    cancelNotification,
    cancelAllNotifications,
  };
}
