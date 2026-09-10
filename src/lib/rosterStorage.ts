import { SavedPlayer } from '../types';

const ROSTER_STORAGE_KEY = 'hockey_saved_roster';
const ROSTER_CHANGE_EVENT = 'hockey_roster_changed';

export const DEFAULT_ROSTER: SavedPlayer[] = [
  {
    id: 'p-mcdavid',
    name: 'Connor McDavid',
    jerseyNumber: '97',
    defaultAction: 'Top Shelf Snapper (Game Winner)',
    team: 'EDM',
    updatedAt: Date.now() - 1000,
  },
  {
    id: 'p-pastrnak',
    name: 'David Pastrňák',
    jerseyNumber: '88',
    defaultAction: 'One-Timer Blast',
    team: 'BOS',
    updatedAt: Date.now() - 2000,
  },
  {
    id: 'p-shesterkin',
    name: 'Igor Shesterkin',
    jerseyNumber: '31',
    defaultAction: 'Robbery Windmill Glove Save',
    team: 'NYR',
    updatedAt: Date.now() - 3000,
  },
  {
    id: 'p-matthews',
    name: 'Auston Matthews',
    jerseyNumber: '34',
    defaultAction: 'Quick Release Wrister Through Traffic',
    team: 'TOR',
    updatedAt: Date.now() - 4000,
  },
  {
    id: 'p-mackinnon',
    name: 'Nathan MacKinnon',
    jerseyNumber: '29',
    defaultAction: 'Coast-to-Coast Breakaway Goal',
    team: 'COL',
    updatedAt: Date.now() - 5000,
  },
  {
    id: 'p-makar',
    name: 'Cale Makar',
    jerseyNumber: '8',
    defaultAction: 'Spin-O-Rama Point Blast',
    team: 'COL',
    updatedAt: Date.now() - 6000,
  },
  {
    id: 'p-crosby',
    name: 'Sidney Crosby',
    jerseyNumber: '87',
    defaultAction: 'Signature Backhand Roof',
    team: 'PIT',
    updatedAt: Date.now() - 7000,
  },
  {
    id: 'p-ovechkin',
    name: 'Alexander Ovechkin',
    jerseyNumber: '8',
    defaultAction: 'Ovi Office Power Play Bomb',
    team: 'WSH',
    updatedAt: Date.now() - 8000,
  },
];

export function getSavedRoster(): SavedPlayer[] {
  try {
    const raw = localStorage.getItem(ROSTER_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(DEFAULT_ROSTER));
      return DEFAULT_ROSTER;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to parse saved roster from storage, resetting to default', err);
  }
  return DEFAULT_ROSTER;
}

function notifyRosterChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ROSTER_CHANGE_EVENT));
  }
}

export function savePlayerToRoster(player: {
  name: string;
  jerseyNumber: string;
  defaultAction?: string;
  team?: string;
}): SavedPlayer[] {
  const cleanName = (player.name || '').trim();
  const cleanNum = (player.jerseyNumber || '').trim();
  if (!cleanName) return getSavedRoster();

  const current = getSavedRoster();
  const existingIndex = current.findIndex(
    (p) => p.name.toLowerCase() === cleanName.toLowerCase(),
  );

  let updated: SavedPlayer[];
  if (existingIndex >= 0) {
    const existing = current[existingIndex];
    const updatedPlayer: SavedPlayer = {
      ...existing,
      name: cleanName,
      jerseyNumber: cleanNum || existing.jerseyNumber,
      defaultAction: player.defaultAction?.trim() || existing.defaultAction,
      team: player.team?.trim() || existing.team,
      updatedAt: Date.now(),
    };
    updated = [
      updatedPlayer,
      ...current.filter((_, i) => i !== existingIndex),
    ];
  } else {
    const newPlayer: SavedPlayer = {
      id: 'player-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      name: cleanName,
      jerseyNumber: cleanNum || '0',
      defaultAction: player.defaultAction?.trim() || 'Highlight Play',
      team: player.team?.trim(),
      updatedAt: Date.now(),
    };
    updated = [newPlayer, ...current];
  }

  try {
    localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save player roster to localStorage', err);
  }

  notifyRosterChange();
  return updated;
}

export function removePlayerFromRoster(id: string): SavedPlayer[] {
  const current = getSavedRoster();
  const filtered = current.filter((p) => p.id !== id);
  try {
    localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to remove player from localStorage', err);
  }
  notifyRosterChange();
  return filtered;
}

export function autoRememberPlayer(
  name: string,
  jerseyNumber: string,
  defaultAction?: string,
): void {
  const trimmed = (name || '').trim();
  if (trimmed.length < 2) return;
  savePlayerToRoster({
    name: trimmed,
    jerseyNumber: (jerseyNumber || '').trim(),
    defaultAction: (defaultAction || '').trim(),
  });
}

export function subscribeToRosterChanges(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(ROSTER_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener(ROSTER_CHANGE_EVENT, callback);
  };
}
