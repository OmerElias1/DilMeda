// lib/supabase.ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Profile = {
  id: string;
  phone_or_email: string | null;
  username: string | null;
  points: number;
  avatar_seed: string | null;
  spin_last_used: string | null;
  needs_ad_watch: boolean;
  last_game_played_at: string | null;
  full_name: string | null;
  phone_number: string | null;
  games_played: number;
  daily_streak: number;
  created_at: string;
};
export type Tournament = {
  id: string;
  name: string;
  description: string;
  end_time: string;
  start_time: string;
  prize_pool: string;
  entry_fee: string;
  max_players: number;
  banner_color: string;
  active: boolean;
  registration_deadline?: string | null;
  created_at: string;
};
export type TournamentRegistration = {
  id: string;
  user_id: string;
  tournament_id: string;
  registered_at: string;
};

export type TournamentPoints = {
  id: string;
  user_id: string;
  tournament_id: string;
  points: number;
  updated_at: string;
};

export type AdView = {
  id: string;
  user_id: string;
  tournament_id: string | null;
  points_earned: number;
  viewed_at: string;
};