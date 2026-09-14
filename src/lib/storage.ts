/**
 * IndexedDB persistence for Hockey Video Project
 * Stores video blobs, clip trims, transitions, and overlay settings
 * so projects survive browser refresh.
 */

import { AspectRatio, FramingMode, HockeyOverlaySettings, Transition, VideoClip } from '../types';

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
  originalWidth?: number;
  originalHeight?: number;
  volume: number;
  playbackRate: number;
  thumbnailUrl?: string;
  tag?: VideoClip['tag'];
  customTagText?: string;
  hornTimingOverride?: number;
  hornDisabled?: boolean;
  hasNativeHorn?: boolean;
  zoom?: number;
  panX?: number;
  panY?: number;
  framingMode?: FramingMode;
  useCustomOverlays?: boolean;
  scorebugOverride?: VideoClip['scorebugOverride'];
  playerBannerOverride?: VideoClip['playerBannerOverride'];
  recordedAt?: number;
  recordedAtDisplay?: string;
  hasFilenameTimestamp?: boolean;
}

export interface SavedProjectData {
  aspectRatio: AspectRatio;
  framingMode?: FramingMode;
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
    const serializedClips: SerializedClip[] = clips.map((c) => {
      const origDur = Number.isFinite(c.originalDuration) && c.originalDuration > 0.05 ? c.originalDuration : 5.0;
      const startT = Number.isFinite(c.startTime) && c.startTime >= 0 ? c.startTime : 0;
      const endT = Number.isFinite(c.endTime) && c.endTime > startT ? c.endTime : origDur;
      return {
        id: c.id,
        name: c.name,
        blob: c.blob,
        originalDuration: origDur,
        startTime: startT,
        endTime: endT,
        originalWidth: c.originalWidth,
        originalHeight: c.originalHeight,
        volume: Number.isFinite(c.volume) ? c.volume : 1,
        playbackRate: Number.isFinite(c.playbackRate) && c.playbackRate > 0 ? c.playbackRate : 1,
        thumbnailUrl: c.thumbnailUrl,
        tag: c.tag,
        customTagText: c.customTagText,
        hornTimingOverride: c.hornTimingOverride,
        hornDisabled: c.hornDisabled,
        hasNativeHorn: c.hasNativeHorn,
        zoom: c.zoom,
        panX: c.panX,
        panY: c.panY,
        framingMode: c.framingMode,
        useCustomOverlays: c.useCustomOverlays,
        scorebugOverride: c.scorebugOverride,
        playerBannerOverride: c.playerBannerOverride,
        recordedAt: c.recordedAt,
        recordedAtDisplay: c.recordedAtDisplay,
        hasFilenameTimestamp: c.hasFilenameTimestamp,
      };
    });

    // Sanitize overlaySettings to guarantee no unclonable objects (like AudioBuffer or AudioNode) reach IndexedDB
    let sanitizedOverlaySettings: HockeyOverlaySettings = { ...overlaySettings };
    if (sanitizedOverlaySettings.backgroundMusic) {
      const bg = sanitizedOverlaySettings.backgroundMusic;
      let cleanTrack = bg.currentTrack;
      if (cleanTrack) {
        const {
          id,
          title,
          style,
          era,
          artist,
          genre,
          source,
          isCustomUpload,
          startTimeOffset,
          waveformPeaks,
          fileSize,
          musicalKey,
          chordProgressionDesc,
          prompt,
          bpm,
          duration,
          audioBlob,
          audioUrl,
          generatedAt,
          energyLevel,
        } = cleanTrack as any;
        cleanTrack = {
          id,
          title,
          style,
          era,
          artist,
          genre,
          source,
          isCustomUpload,
          startTimeOffset: typeof startTimeOffset === 'number' ? startTimeOffset : 0,
          waveformPeaks: Array.isArray(waveformPeaks) ? waveformPeaks : undefined,
          fileSize,
          musicalKey,
          chordProgressionDesc,
          prompt,
          bpm,
          duration,
          audioBlob: audioBlob instanceof Blob ? audioBlob : undefined,
          audioUrl: typeof audioUrl === 'string' ? audioUrl : undefined,
          generatedAt,
          energyLevel,
        };
      }
      sanitizedOverlaySettings = {
        ...sanitizedOverlaySettings,
        backgroundMusic: {
          ...bg,
          currentTrack: cleanTrack,
        },
      };
    }

    const projectData: SavedProjectData = {
      aspectRatio,
      transitions,
      overlaySettings: sanitizedOverlaySettings,
      clips: serializedClips,
      updatedAt: Date.now(),
    };

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(projectData, PROJECT_KEY);

        req.onsuccess = () => resolve();
        req.onerror = () => {
          console.warn('IndexedDB put request failed:', req.error);
          resolve();
        };
      } catch (putErr) {
        console.warn('Failed to put project into IndexedDB:', putErr);
        resolve();
      }
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
            const origDur = Number.isFinite(sc.originalDuration) && sc.originalDuration > 0.05 ? sc.originalDuration : 5.0;
            const startT = Number.isFinite(sc.startTime) && sc.startTime >= 0 ? sc.startTime : 0;
            const endT = Number.isFinite(sc.endTime) && sc.endTime > startT ? sc.endTime : origDur;
            revivedClips.push({
              ...sc,
              url,
              originalDuration: origDur,
              startTime: startT,
              endTime: endT,
              playbackRate: Number.isFinite(sc.playbackRate) && sc.playbackRate > 0 ? sc.playbackRate : 1.0,
              hornTimingOverride: sc.hornTimingOverride,
              hornDisabled: sc.hornDisabled,
              hasNativeHorn: sc.hasNativeHorn,
              zoom: sc.zoom,
              panX: sc.panX,
              panY: sc.panY,
              framingMode: sc.framingMode,
              recordedAt: sc.recordedAt,
              recordedAtDisplay: sc.recordedAtDisplay,
              hasFilenameTimestamp: sc.hasFilenameTimestamp,
            });
          }
        }

        // Revive custom horn object URL if a custom horn blob was saved
        let revivedOverlaySettings = data.overlaySettings;
        if (revivedOverlaySettings?.hornConfig) {
          if (revivedOverlaySettings.hornConfig.customHornBlob) {
            try {
              const hornUrl = URL.createObjectURL(revivedOverlaySettings.hornConfig.customHornBlob);
              revivedOverlaySettings = {
                ...revivedOverlaySettings,
                hornConfig: {
                  ...revivedOverlaySettings.hornConfig,
                  customHornUrl: hornUrl,
                },
              };
            } catch (e) {
              console.warn('Could not revive custom horn URL:', e);
            }
          } else if (revivedOverlaySettings.hornConfig.customHornUrl?.startsWith('blob:')) {
            // Revoked/dead blob URL from previous browser session
            revivedOverlaySettings = {
              ...revivedOverlaySettings,
              hornConfig: {
                ...revivedOverlaySettings.hornConfig,
                customHornUrl: undefined,
              },
            };
          }
        }

        // Revive background music object URL if audioBlob was saved
        if (revivedOverlaySettings?.backgroundMusic?.currentTrack) {
          const track = revivedOverlaySettings.backgroundMusic.currentTrack;
          if (track.audioBlob) {
            try {
              track.audioUrl = URL.createObjectURL(track.audioBlob);
            } catch (e) {
              console.warn('Could not revive background music audio URL:', e);
            }
          } else if (track.audioUrl?.startsWith('blob:')) {
            track.audioUrl = undefined;
          }
        }

        resolve({
          clips: revivedClips,
          transitions: data.transitions || [],
          overlaySettings: revivedOverlaySettings,
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
