import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useNotifications } from '@/hooks/useNotifications';

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

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { requestPermissions, getPushToken } = useNotifications();

  useEffect(() => {
    setupNotifications();
  }, []);

  const setupNotifications = async () => {
    // Set up Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('tournament-updates', {
        name: 'Tournament Updates',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFD700',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('points-earned', {
        name: 'Points Earned',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 100],
        lightColor: '#00FF88',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('daily-reminder', {
        name: 'Daily Reminder',
        importance: Notifications.AndroidImportance.LOW,
        vibrationPattern: [0, 50],
        lightColor: '#3B82F6',
        sound: 'default',
      });
    }

    // Request permissions
    await requestPermissions();

    // Get push token
    await getPushToken();

    // Set up notification listeners
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
    });

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  };

  return <>{children}</>;
}
