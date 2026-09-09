/**
 * IndexedDB persistence for Hockey Video Project
 * Stores video blobs, clip trims, transitions, and overlay settings
 * so projects survive browser refresh.
 */

import { AspectRatio, HockeyOverlaySettings, Transition, VideoClip } from '../types';

const DB_NAME = 'HockeyHighlightsDB';
const DB_VERSION = 1;
const STORE_NAME = 'projectStore';
const PROJECT_KEY = 'active_hockey_project';

interface SerializedClip {
  id: string;
  name: string;
  blob?: Blob;
  originalDuration: number;
  startTime: number;
  endTime: number;
  volume: number;
  playbackRate: number;
  thumbnailUrl?: string;
  tag?: VideoClip['tag'];
  customTagText?: string;
}

export interface SavedProjectData {
  aspectRatio: AspectRatio;
  transitions: Transition[];
  overlaySettings: HockeyOverlaySettings;
  clips: SerializedClip[];
  updatedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Save project to IndexedDB
 */
export async function saveProjectToStorage(
  clips: VideoClip[],
  transitions: Transition[],
  overlaySettings: HockeyOverlaySettings,
  aspectRatio: AspectRatio,
): Promise<void> {
  try {
    const db = await openDB();
    const serializedClips: SerializedClip[] = clips.map((c) => ({
      id: c.id,
      name: c.name,
      blob: c.blob,
      originalDuration: c.originalDuration,
      startTime: c.startTime,
      endTime: c.endTime,
      volume: c.volume,
      playbackRate: c.playbackRate,
      thumbnailUrl: c.thumbnailUrl,
      tag: c.tag,
      customTagText: c.customTagText,
    }));

    const projectData: SavedProjectData = {
      aspectRatio,
      transitions,
      overlaySettings,
      clips: serializedClips,
      updatedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(projectData, PROJECT_KEY);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to save project to IndexedDB:', err);
  }
}

/**
 * Load project from IndexedDB and revive object URLs
 */
export async function loadProjectFromStorage(): Promise<{
  clips: VideoClip[];
  transitions: Transition[];
  overlaySettings?: HockeyOverlaySettings;
  aspectRatio?: AspectRatio;
} | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(PROJECT_KEY);

      req.onsuccess = () => {
        const data = req.result as SavedProjectData | undefined;
        if (!data) {
          resolve(null);
          return;
        }

        const revivedClips: VideoClip[] = [];
        for (const sc of data.clips) {
          if (sc.blob) {
            const url = URL.createObjectURL(sc.blob);
            revivedClips.push({
              ...sc,
              url,
            });
          }
        }

        resolve({
          clips: revivedClips,
          transitions: data.transitions || [],
          overlaySettings: data.overlaySettings,
          aspectRatio: data.aspectRatio,
        });
      };

      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to load project from IndexedDB:', err);
    return null;
  }
}

/**
 * Clear saved project from IndexedDB
 */
export async function clearProjectFromStorage(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(PROJECT_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to clear project from IndexedDB:', err);
  }
}
