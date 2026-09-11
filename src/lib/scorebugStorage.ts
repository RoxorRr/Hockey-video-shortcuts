import { ScorebugConfig } from '../types';

const SCOREBUG_STORAGE_KEY = 'hockey_saved_game_scorebug';
const SCOREBUG_EVENT = 'hockey_scorebug_changed';

/**
 * Default fallback scorebug configuration
 */
export const DEFAULT_SCOREBUG: ScorebugConfig = {
  enabled: true,
  homeTeam: 'NYR',
  awayTeam: 'BOS',
  homeScore: 3,
  awayScore: 2,
  period: '3RD',
  timeRemaining: '0:18',
};

/**
 * Save remembered game scorebug to localStorage
 */
export function saveRememberedScorebug(config: Partial<ScorebugConfig>): void {
  try {
    const existing = getRememberedScorebug() || DEFAULT_SCOREBUG;
    const merged: ScorebugConfig = {
      ...existing,
      ...config,
    };
    localStorage.setItem(SCOREBUG_STORAGE_KEY, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent(SCOREBUG_EVENT, { detail: merged }));
  } catch (err) {
    console.warn('Could not save scorebug to localStorage', err);
  }
}

/**
 * Retrieve remembered game scorebug from localStorage
 */
export function getRememberedScorebug(): ScorebugConfig | null {
  try {
    const raw = localStorage.getItem(SCOREBUG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.homeTeam && parsed.awayTeam) {
      return {
        enabled: parsed.enabled ?? true,
        homeTeam: String(parsed.homeTeam).toUpperCase(),
        awayTeam: String(parsed.awayTeam).toUpperCase(),
        homeScore: typeof parsed.homeScore === 'number' ? parsed.homeScore : 0,
        awayScore: typeof parsed.awayScore === 'number' ? parsed.awayScore : 0,
        period: parsed.period || '1ST',
        timeRemaining: parsed.timeRemaining || '20:00',
      };
    }
    return null;
  } catch {
    return null;
  }
}
