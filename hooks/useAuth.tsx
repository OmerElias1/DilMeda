import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, Profile } from '@/lib/supabase';
import * as Linking from 'expo-linking';
import { useURL } from 'expo-linking';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isRecoveryMode: boolean;
  setIsRecoveryMode: (val: boolean) => void;
  activeTournamentId: string | null;
  setActiveTournamentId: (id: string | null) => void;
  signUp: (identifier: { email?: string; phone?: string }, password: string, name?: string) => Promise<{ error: string | null; needsVerification?: boolean }>;
  signIn: (identifier: { email?: string; phone?: string }, password: string) => Promise<{ error: string | null; needsVerification?: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  addPoints: (pts: number) => Promise<void>;
  /** Call at the end of any game session. Awards pts, records the game played,
   *  updates daily streak, and auto-unlocks achievements via the DB trigger. */
  endGameSession: (pts: number) => Promise<void>;
  verifyOtp: (params: { email?: string; phone?: string; token: string; type: 'sms' | 'signup' | 'recovery' }) => Promise<{ error: string | null; session?: Session | null; user?: User | null }>;
  sendPasswordResetOtp: (phone: string) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [activeTournamentId, setActiveTournamentIdState] = useState<string | null>(null);

  // Use a ref so the addPoints closure always sees the latest value
  const activeTournamentIdRef = useRef<string | null>(null);

  const setActiveTournamentId = useCallback((id: string | null) => {
    activeTournamentIdRef.current = id;
    setActiveTournamentIdState(id);
  }, []);

  const fetchProfile = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    if (data) {
      setProfile(data as Profile);
    } else {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({
            id: uid,
            phone_or_email: session.user.email || session.user.phone || '',
            username: session.user.user_metadata?.full_name || (session.user.email ? session.user.email.split('@')[0] : (session.user.phone || 'Player')),
            full_name: session.user.user_metadata?.full_name || null,
            phone_number: session.user.phone || session.user.user_metadata?.phone_number || null,
            points: 0,
            avatar_seed: uid,
          })
          .select()
          .maybeSingle();
        if (newProfile) setProfile(newProfile as Profile);
      }
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  const handleAuthDeepLink = useCallback(async (rawUrl: string) => {
    // decode the URI in case characters like # are encoded as %23
    const url = decodeURI(rawUrl);
    
    // We need to parse BOTH the normal query parameters (for recovery=true) and the hash parameters
    const queryString = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
    const hashString = url.includes('#') ? url.split('#')[1] : '';

    const parseParams = (str: string) => str.split('&').reduce((acc, current) => {
      const [key, value] = current.split('=');
      if (key && value) acc[key] = decodeURIComponent(value);
      return acc;
    }, {} as Record<string, string>);

    const queryParams = parseParams(queryString);
    const hashParams = parseParams(hashString);

    const accessToken = hashParams['access_token'] || queryParams['access_token'];
    const refreshToken = hashParams['refresh_token'] || queryParams['refresh_token'];
    const type = hashParams['type'] || queryParams['type'];
    const recoveryParam = queryParams['recovery'];

    if ((accessToken && refreshToken && type === 'recovery') || recoveryParam === 'true') {
      // Set recovery mode BEFORE setting session to prevent race condition with navigation
      setIsRecoveryMode(true);

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) {
          console.error('Error setting session from recovery link:', error);
        }
      }
    } else if (accessToken && refreshToken && type === 'signup') {
      // Email confirmation link clicked — set session to log user in automatically
      console.log('Email confirmed via deep link — logging in...');
      const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) {
        console.error('Error setting session from email confirmation link:', error);
      }
    }
  }, []);

  const incomingUrl = useURL();
  
  useEffect(() => {
    if (incomingUrl) {
      handleAuthDeepLink(incomingUrl);
    }
  }, [incomingUrl, handleAuthDeepLink]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') setIsRecoveryMode(true);
      if (session?.user) {
        (async () => { await fetchProfile(session.user.id); })();
      } else {
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signUp = async (identifier: { email?: string; phone?: string }, password: string, name?: string) => {
    const authPayload: any = {
      password,
      options: {
        data: {
          full_name: name || null,
        },
      },
    };
    if (identifier.email) {
      authPayload.email = identifier.email;
      authPayload.options.emailRedirectTo = 'dilmeda://auth/callback';
    } else if (identifier.phone) {
      authPayload.phone = identifier.phone;
    }
    const { data, error } = await supabase.auth.signUp(authPayload);
    if (error) return { error: error.message, needsVerification: false };
    // If email confirmation is required, data.user exists but data.session is null
    if (data.user && !data.session) {
      return { error: null, needsVerification: true };
    }
    return { error: null, needsVerification: false };
  };

  const signIn = async (identifier: { email?: string; phone?: string }, password: string) => {
    const authPayload: any = { password };
    if (identifier.email) {
      authPayload.email = identifier.email;
    } else if (identifier.phone) {
      authPayload.phone = identifier.phone;
    }
    const { error } = await supabase.auth.signInWithPassword(authPayload);
    return { error: error?.message ?? null };
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  const verifyOtp = async (params: { email?: string; phone?: string; token: string; type: 'sms' | 'signup' | 'recovery' }) => {
    const { token, type } = params;
    if (params.phone) {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: params.phone,
        token,
        type: type === 'signup' ? 'sms' : (type === 'recovery' ? 'sms' : type),
      });
      if (error) return { error: error.message };
      return { error: null, session: data.session, user: data.user };
    } else if (params.email) {
      const { data, error } = await supabase.auth.verifyOtp({
        email: params.email,
        token,
        type: type === 'recovery' ? 'recovery' : 'signup',
      });
      if (error) return { error: error.message };
      return { error: null, session: data.session, user: data.user };
    }
    return { error: 'Invalid verification identifier' };
  };

  const sendPasswordResetOtp = async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) return { error: error.message };
    return { error: null };
  };

  const addPoints = async (pts: number) => {
    if (!user) return;
    // Global points
    await supabase.rpc('increment_points', { user_id: user.id, points_to_add: pts });
    setProfile(prev => prev ? { ...prev, points: prev.points + pts } : null);
    // Tournament-scoped points (auto-wired when user is in a tournament)
    if (activeTournamentIdRef.current) {
      await supabase.rpc('increment_tournament_points', {
        p_user_id: user.id,
        p_tournament_id: activeTournamentIdRef.current,
        p_points: pts,
      });
    }
  };

  /**
   * Call at the end of any game session.
   * - Awards pts globally (and to the active tournament)
   * - Calls record_game_played which updates games_played, daily_streak, needs_ad_watch
   * - The DB trigger fires automatically to unlock eligible achievements
   * - Refreshes the local profile state
   */
  const endGameSession = async (pts: number) => {
    if (!user) return;
    // 1. Award points
    await addPoints(pts);
    // 2. Record the game – updates streak & games_played and sets needs_ad_watch
    await supabase.rpc('record_game_played', { p_user_id: user.id });
    // 3. Refresh local profile so UI reflects updated stats & streak
    await refreshProfile();
  };

  return (
    <AuthContext.Provider value={{
      session, user, profile, loading, isRecoveryMode, setIsRecoveryMode,
      activeTournamentId, setActiveTournamentId,
      signUp, signIn, signOut, refreshProfile, addPoints, endGameSession,
      verifyOtp, sendPasswordResetOtp,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
