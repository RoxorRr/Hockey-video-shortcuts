export type AspectRatio = '9:16' | '16:9' | '1:1';

export type TransitionType =
  | 'crossfade'
  | 'wipe-left'
  | 'wipe-right'
  | 'slide-push'
  | 'goal-flash'
  | 'zoom'
  | 'glitch';

export interface Transition {
  type: TransitionType;
  duration: number; // in seconds, e.g. 0.8
}

export type HockeyTag = 'GOAL' | 'SAVE' | 'HIT' | 'DEKE' | 'POWERPLAY' | 'OT WINNER' | 'CELEBRATION';

export interface VideoClip {
  id: string;
  name: string;
  url: string;
  blob?: Blob;
  originalDuration: number; // in seconds
  startTime: number; // trim start in seconds
  endTime: number; // trim end in seconds
  originalWidth?: number;
  originalHeight?: number;
  volume: number; // 0 to 1
  playbackRate: number; // 0.5 to 2.0
  thumbnailUrl?: string;
  tag?: HockeyTag;
  customTagText?: string;
  hornTimingOverride?: number; // Custom time offset in seconds within this clip
  hornDisabled?: boolean; // Disable horn on this specific clip
  hasNativeHorn?: boolean; // Video already has native arena horn in its audio track
  zoom?: number; // Zoom magnification (1.0 = normal, up to 3.5x)
  panX?: number; // Horizontal focus offset percentage (-100 to 100, 0 = center)
  panY?: number; // Vertical focus offset percentage (-100 to 100, 0 = center)
  // Per-clip overlay customization:
  useCustomOverlays?: boolean; // When true, uses clip-specific scorebug & player banner
  scorebugOverride?: Partial<ScorebugConfig> & { enabled?: boolean };
  playerBannerOverride?: Partial<PlayerBannerConfig> & { enabled?: boolean };
}

export interface GoalHornConfig {
  enabled: boolean;
  useCustomHorn: boolean;
  customHornName?: string;
  customHornUrl?: string;
  customHornBlob?: Blob;
  customHornDuration?: number; // in seconds
  hornDuration?: number; // editable goal horn duration in seconds (synth or custom, e.g. 5.0s, up to 30s+)
  duckVideoAudio?: boolean; // duck/lower clip native audio when horn blares
  skipClipsWithNativeHorn?: boolean; // automatically skip triggering horn if clip has native horn
  triggerMode: 'every_clip' | 'goal_clips_only';
  clipOffsetSeconds: number; // specific seconds into each clip to trigger horn (e.g. 0.0s, 0.5s, 1.5s)
  volume: number; // 0.0 to 1.5 (default 1.0)
}

export interface ScorebugConfig {
  enabled: boolean;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  period: string; // "1ST", "2ND", "3RD", "OT", "SO"
  timeRemaining: string; // "0:18", "14:22"
}

export interface PlayerBannerConfig {
  enabled: boolean;
  playerName: string;
  jerseyNumber: string;
  actionText: string; // e.g. "Top Shelf Wrister", "Glove Save of the Year"
}

export interface SavedPlayer {
  id: string;
  name: string;
  jerseyNumber: string;
  defaultAction?: string;
  team?: string;
  updatedAt?: number;
}

export interface HockeyOverlaySettings {
  scorebug: ScorebugConfig;
  playerBanner: PlayerBannerConfig;
  goalHornSound: boolean;
  hornConfig?: GoalHornConfig;
  redSirenFlash: boolean;
  showStamps: boolean;
}

export interface YouTubeUploadMetadata {
  title: string;
  description: string;
  privacyStatus: 'public' | 'unlisted' | 'private';
  tags: string[];
  isShorts: boolean;
}

export interface YouTubeUploadResult {
  videoId: string;
  url: string;
  title: string;
}

export type ExportQualityPreset = 'source' | '4k' | '1080p' | '720p';

export interface ExportOptions {
  qualityPreset?: ExportQualityPreset;
  fps?: 60 | 30;
  bitrate?: number; // in bps
  preferMp4?: boolean;
}

