import { supabase } from './supabase';
import * as Notifications from 'expo-notifications';

export type NotificationType = 
  | 'tournament_start'
  | 'tournament_end'
  | 'new_prize'
  | 'daily_reminder'
  | 'points_earned'
  | 'rank_change'
  | 'new_features';

/**
 * Send a notification based on user preferences
 */
export async function sendNotificationIfEnabled(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: any
): Promise<boolean> {
  try {
    // Get user's notification preferences
    const { data: prefs, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !prefs) {
      console.log('No notification preferences found for user');
      return false;
    }

    // Check if this notification type is enabled
    const prefKey = type as keyof typeof prefs;
    if (!prefs[prefKey]) {
      console.log(`Notification type ${type} is disabled for user`);
      return false;
    }

    // Send the notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { ...data, type },
        sound: true,
      },
      trigger: null, // Send immediately
    });

    return true;
  } catch (error) {
    console.error('Error sending notification:', error);
    return false;
  }
}

/**
 * Send points earned notification
 */
export async function notifyPointsEarned(userId: string, points: number, totalPoints: number): Promise<void> {
  await sendNotificationIfEnabled(
    userId,
    'points_earned',
    '🎉 Points Earned!',
    `You earned ${points} points! Total: ${totalPoints}`,
    { points, totalPoints }
  );
}

/**
 * Send tournament start notification
 */
export async function notifyTournamentStart(userId: string, tournamentName: string): Promise<void> {
  await sendNotificationIfEnabled(
    userId,
    'tournament_start',
    '🏆 Tournament Started!',
    `The "${tournamentName}" tournament has begun! Good luck!`,
    { tournamentName }
  );
}

/**
 * Send tournament end notification
 */
export async function notifyTournamentEnd(userId: string, tournamentName: string): Promise<void> {
  await sendNotificationIfEnabled(
    userId,
    'tournament_end',
    '⏰ Tournament Ended',
    `The "${tournamentName}" tournament has ended. Check your rank!`,
    { tournamentName }
  );
}

/**
 * Send rank change notification
 */
export async function notifyRankChange(userId: string, newRank: number, totalPlayers: number): Promise<void> {
  await sendNotificationIfEnabled(
    userId,
    'rank_change',
    '📈 Rank Updated!',
    `You are now ranked #${newRank} out of ${totalPlayers} players!`,
    { newRank, totalPlayers }
  );
}

/**
 * Send daily reminder notification
 */
export async function notifyDailyReminder(userId: string): Promise<void> {
  await sendNotificationIfEnabled(
    userId,
    'daily_reminder',
    '⚡ Daily Reminder',
    'Don\'t forget to play today and earn points!',
    {}
  );
}

/**
 * Schedule a daily reminder notification
 */
export async function scheduleDailyReminder(userId: string, hour: number = 10): Promise<string | null> {
  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚡ Daily Reminder',
        body: 'Don\'t forget to play today and earn points!',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour,
        minute: 0,
        repeats: true,
      },
    });
    return identifier;
  } catch (error) {
    console.error('Error scheduling daily reminder:', error);
    return null;
  }
}
