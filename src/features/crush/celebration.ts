import { navigationRef } from '@/navigation/navigationRef';

/** Matches whose celebration already opened in this session (the add response and the socket both announce it). */
const seen = new Set<string>();

export function markCelebrationSeen(matchId: string) {
  seen.add(matchId);
}

/** Opens "It's a match" once per match, unless the user is signing in or already looking at it. */
export function openCelebration(matchId: string) {
  if (seen.has(matchId) || !navigationRef.isReady()) return;
  const route = navigationRef.getCurrentRoute();
  if (route?.name === 'MatchCelebration') return;
  const names = navigationRef.getRootState()?.routeNames ?? [];
  if (!names.includes('MatchCelebration')) return;
  seen.add(matchId);
  navigationRef.navigate('MatchCelebration', { matchId });
}
