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
  volume: number; // 0 to 1
  playbackRate: number; // 0.5 to 2.0
  thumbnailUrl?: string;
  tag?: HockeyTag;
  customTagText?: string;
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

export interface HockeyOverlaySettings {
  scorebug: ScorebugConfig;
  playerBanner: PlayerBannerConfig;
  goalHornSound: boolean;
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
