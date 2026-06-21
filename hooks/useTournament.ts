/**
 * Backward-compatibility shim.
 * All game components and legacy screens import `useTournament` from here.
 * We now delegate to useTournaments so the active tournament is the one
 * the user is actually registered in (or the first active one globally).
 */
import { useTournaments, useTimeLeft } from './useTournaments';

export function useTournament() {
  const { activeTournament, refreshPoints, refetch, myTournamentPoints } = useTournaments();
  const timeLeft = useTimeLeft(activeTournament?.end_time);
  const isExpired = activeTournament ? timeLeft.expired : false;

  return {
    tournament: activeTournament,
    timeLeft,
    isExpired,
    myTournamentPoints,
    loading: false,
    refetch,
    refreshPoints,
  };
}
