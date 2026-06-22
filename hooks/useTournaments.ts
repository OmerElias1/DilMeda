import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, Tournament, TournamentRegistration } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { notifyTournamentStart, notifyTournamentEnd } from '@/lib/notifications';

export type TournamentWithCount = Tournament & { player_count: number };

export function useTournaments() {
  const { user, setActiveTournamentId } = useAuth();
  const [tournaments, setTournaments] = useState<TournamentWithCount[]>([]);
  const [myRegistration, setMyRegistration] = useState<TournamentRegistration | null>(null);
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [myTournamentPoints, setMyTournamentPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const previousActiveTournamentRef = useRef<Tournament | null>(null);

  const fetchTournaments = useCallback(async () => {
    const { data } = await supabase
      .from('tournaments')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (!data) return;

    // Get player counts for each tournament
    const withCounts: TournamentWithCount[] = await Promise.all(
      (data as Tournament[]).map(async (t) => {
        const { count } = await supabase
          .from('tournament_registrations')
          .select('*', { count: 'exact', head: true })
          .eq('tournament_id', t.id);
        return { ...t, player_count: count ?? 0 };
      })
    );
    setTournaments(withCounts);
  }, []);

  const fetchMyPoints = useCallback(async (tournamentId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from('tournament_points')
      .select('points')
      .eq('user_id', user.id)
      .eq('tournament_id', tournamentId)
      .maybeSingle();
    setMyTournamentPoints(data?.points ?? 0);
  }, [user]);

  const fetchMyRegistration = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('tournament_registrations')
      .select('*, tournaments(*)')
      .eq('user_id', user.id)
      .order('registered_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setMyRegistration(data as TournamentRegistration);
      const t = (data as any).tournaments as Tournament;
      const isAlive = t && new Date(t.end_time) > new Date() && t.active;
      if (isAlive) {
        setActiveTournament(t);
        setActiveTournamentId(t.id);
        fetchMyPoints(t.id);
      } else {
        // Tournament ended - send notification if we had an active tournament
        if (previousActiveTournamentRef.current && t) {
          notifyTournamentEnd(user.id, t.name);
        }
        setActiveTournament(null);
        setActiveTournamentId(null);
        setMyTournamentPoints(0);
      }
    } else {
      setMyRegistration(null);
      setActiveTournament(null);
      setActiveTournamentId(null);
      setMyTournamentPoints(0);
    }
    setLoading(false);
  }, [user, fetchMyPoints, setActiveTournamentId]);
  const register = useCallback(async (tournamentId: string): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not logged in' };
    if (activeTournament) return { error: 'You are already in an active tournament.' };
    
    // Check registration deadline
    const tObj = tournaments.find(t => t.id === tournamentId);
    if (tObj && tObj.registration_deadline) {
      const deadline = new Date(tObj.registration_deadline).getTime();
      if (Date.now() > deadline) {
        return { error: 'Registration deadline has passed. Late registration payments are not yet integrated.' };
      }
    }

    setRegistering(true);
    const { error } = await supabase
      .from('tournament_registrations')
      .insert({ user_id: user.id, tournament_id: tournamentId });
    if (!error) {
      await fetchMyRegistration();
      // Send tournament start notification
      if (tObj) {
        await notifyTournamentStart(user.id, tObj.name);
      }
    }
    setRegistering(false);
    return { error: error?.message ?? null };
  }, [user, activeTournament, tournaments, fetchMyRegistration]);
  const refreshPoints = useCallback(async () => {
    if (activeTournament) await fetchMyPoints(activeTournament.id);
  }, [activeTournament, fetchMyPoints]);

  useEffect(() => {
    fetchTournaments();
    fetchMyRegistration();
  }, [fetchTournaments, fetchMyRegistration]);

  // Track previous active tournament for end notification
  useEffect(() => {
    if (activeTournament) {
      previousActiveTournamentRef.current = activeTournament;
    }
  }, [activeTournament]);

  return {
    tournaments,
    myRegistration,
    activeTournament,
    myTournamentPoints,
    isLocked: activeTournament !== null,
    loading,
    registering,
    register,
    refetch: fetchMyRegistration,
    refreshTournaments: fetchTournaments,
    refreshPoints,
  };
}

export function useTimeLeft(endTime: string | undefined) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false });

  useEffect(() => {
    if (!endTime) return;
    const tick = () => {
      const diff = new Date(endTime).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }); return; }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
        expired: false,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  return timeLeft;
}
