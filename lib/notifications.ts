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

    let isEnabled = true;
    if (error || !prefs) {
      console.log('No notification preferences found for user, using default settings');
      // Default preferences: daily_reminder is false, others are true
      isEnabled = type !== 'daily_reminder';
    } else {
      const prefKey = type as keyof typeof prefs;
      isEnabled = !!prefs[prefKey];
    }

    if (!isEnabled) {
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
 * Send a competitive rank-based notification after a game session.
 * Fetches the leaderboard, finds the player just above the user, and
 * fires an urgency-style push message referencing that rival by name.
 */
export async function notifyRankAlert(
  userId: string,
  tournamentId?: string | null
): Promise<void> {
  try {
    // ── 1. Fetch leaderboard (tournament or global) ──
    let rows: { id: string; username: string | null; points: number }[] = [];

    if (tournamentId) {
      const { data } = await supabase
        .from('tournament_points')
        .select('user_id, points, profiles(username)')
        .eq('tournament_id', tournamentId)
        .order('points', { ascending: false })
        .limit(100);
      if (data) {
        rows = data.map((r: any) => ({
          id: r.user_id,
          username: r.profiles?.username ?? null,
          points: r.points,
        }));
      }
    } else {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, points')
        .order('points', { ascending: false })
        .limit(100);
      if (data) rows = data as any[];
    }

    const myIdx = rows.findIndex(r => r.id === userId);
    const myRank = myIdx + 1; // 1-based, 0 if not found
    const totalPlayers = rows.length;

    // Player directly above the user
    const rival = myIdx > 0 ? rows[myIdx - 1] : null;
    const rivalName = rival?.username ?? 'Someone';

    // Player directly below (about to catch up)
    const chaser = myIdx >= 0 && myIdx < rows.length - 1 ? rows[myIdx + 1] : null;
    const chaserName = chaser?.username ?? 'Someone';

    let title = '';
    let body = '';

    if (myRank === 0) {
      // Not on board yet
      title = '🎮 Jump into the race!';
      body = 'You\'re not on the leaderboard yet. Play now to grab a spot!';
    } else if (myRank === 1) {
      // Currently #1 — warn about the chaser
      if (chaser) {
        title = '👑 You\'re #1 — but for how long?';
        body = `${chaserName} is breathing down your neck. Stay sharp and defend your crown!`;
      } else {
        title = '🏆 Unbeatable!';
        body = 'You sit alone at the top. Keep going to stay there!';
      }
    } else {
      // Not #1 — pick a message style based on rank and context
      const dangerZone = totalPlayers > 0 && myRank > Math.ceil(totalPlayers * 0.7);

      const rivalMessages = [
        { t: '⚡ Rivalry Alert', b: `${rivalName} has surpassed your points. Play now to reclaim your rank!` },
        { t: '🔥 You\'ve been overtaken!', b: `${rivalName} just jumped ahead. Hit the games and take back your spot!` },
        { t: '😤 Don\'t let them win!', b: `${rivalName} is ahead of you. Show them who\'s boss — play now!` },
        { t: '⚠️ Rank Slipping!', b: `${rivalName} is pulling away. Get back in the game before it\'s too late!` },
      ];

      const eliminationMessages = [
        { t: '🚨 Elimination Risk!', b: `You\'re at risk of being eliminated. Play now to climb the board!` },
        { t: '⚠️ Danger Zone!', b: `You\'re close to the bottom. One good game can change everything!` },
        { t: '🔴 Act Fast!', b: `Your rank is slipping into elimination territory. Don\'t wait — play now!` },
      ];

      const chaserMessages = [
        { t: '👀 Watch your back!', b: `${chaserName} is closing in fast. Play now to keep your lead!` },
        { t: '⚡ Stay ahead!', b: `${chaserName} is almost caught up. Don\'t let them pass you!` },
      ];

      let pool;
      if (dangerZone) {
        pool = eliminationMessages;
      } else if (rival) {
        // Alternate between rival-above and chaser-below messages
        pool = Math.random() < 0.6 ? rivalMessages : (chaser ? chaserMessages : rivalMessages);
      } else {
        pool = chaserMessages.length > 0 ? chaserMessages : rivalMessages;
      }

      const pick = pool[Math.floor(Math.random() * pool.length)];
      title = pick.t;
      body = pick.b;
    }

    await sendNotificationIfEnabled(userId, 'rank_change', title, body, { myRank, totalPlayers });
  } catch (e) {
    console.error('Error sending rank alert notification:', e);
  }
}

/**
 * Send tournament start notification
 */
export async function notifyTournamentStart(userId: string, tournamentName: string): Promise<void> {
  await sendNotificationIfEnabled(
    userId,
    'tournament_start',
    'Tournament Started!',
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
    'Rank Updated!',
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
    'Daily Reminder',
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
        title: 'Daily Reminder',
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
