import { AIMusicTrack, SportsMusicStyle } from '../types';

export interface RealLibraryTrack {
  id: string;
  title: string;
  artist: string;
  era: '80s' | '90s' | '00s' | 'modern';
  genre: string;
  bpm: number;
  duration: number; // approximate seconds
  audioUrl: string;
  description: string;
  style: SportsMusicStyle;
  icon: string;
  tags: string[];
}

export const REAL_MUSIC_TRACKS: RealLibraryTrack[] = [
  // ================= 80s ERA TRACKS =================
  {
    id: 'real-80s-radio-rock',
    title: 'Radio Rock Arena',
    artist: 'Audionautix',
    era: '80s',
    genre: 'Classic Arena Rock',
    bpm: 138,
    duration: 118,
    audioUrl: '/assets/music/radio_rock.mp3',
    description: 'High-voltage 80s stadium rock with driving electric guitar riffs, punchy kick, and classic hockey swagger.',
    style: 'era-80s-rock',
    icon: '🎸',
    tags: ['80s', 'Rock', 'Arena', 'Guitar Riffs', 'Stadium'],
  },
  {
    id: 'real-80s-the-champion',
    title: 'The Champion',
    artist: 'Efface Studios',
    era: '80s',
    genre: 'Stadium Rock Anthem',
    bpm: 128,
    duration: 180,
    audioUrl: '/assets/music/the_champion.mp3',
    description: 'Triumphant arena rock celebration with live drum kit, soaring lead lines, and championship intensity.',
    style: 'era-80s-rock',
    icon: '🏆',
    tags: ['80s', 'Trophy', 'Anthem', 'Victory', 'Hype'],
  },
  {
    id: 'real-80s-down-n-dirty',
    title: "Down 'N Dirty Riff",
    artist: 'Jingle Punks',
    era: '80s',
    genre: 'Hard Riff Rock',
    bpm: 115,
    duration: 58,
    audioUrl: '/assets/music/down_n_dirty_rock.mp3',
    description: 'Gritty blues-rock stadium distortion, pumping bassline, and classic arena hockey power chords.',
    style: 'era-80s-rock',
    icon: '⚡',
    tags: ['80s', 'Gritty', 'Riffs', 'Bass', 'Power'],
  },

  // ================= 90s ERA TRACKS =================
  {
    id: 'real-90s-eurodance-sign',
    title: 'Eurodance Jock Jam',
    artist: 'JoeniNpcGamer',
    era: '90s',
    genre: '90s Eurodance & Rink Dance',
    bpm: 135,
    duration: 320,
    audioUrl: '/assets/music/eurodance_sign.mp3',
    description: 'Unmistakable 90s Jock Jams stadium dance beat with pounding 4-on-the-floor kick, synth stabs, and rink energy.',
    style: 'era-90s-jams',
    icon: '🏒',
    tags: ['90s', 'Eurodance', 'Jock Jams', 'Dance', 'Pump Up'],
  },
  {
    id: 'real-90s-the-chase',
    title: 'The Fast Break Chase',
    artist: 'Topher Mohr & Alex Elena',
    era: '90s',
    genre: '90s Action Rock',
    bpm: 145,
    duration: 102,
    audioUrl: '/assets/music/the_chase.mp3',
    description: 'Relentless up-tempo 90s action rock, screaming overdrive guitars, and breakaway speed.',
    style: 'era-90s-grunge',
    icon: '🔥',
    tags: ['90s', 'Chase', 'Breakaway', 'Speed', 'Rock'],
  },
  {
    id: 'real-90s-party-time',
    title: 'Party Time Pump-Up',
    artist: 'Efface Studios',
    era: '90s',
    genre: '90s Arena Hype',
    bpm: 126,
    duration: 199,
    audioUrl: '/assets/music/party_time.mp3',
    description: 'Lively goal celebration and party pump-up track with grooving bass, live kit, and celebratory arena spirit.',
    style: 'era-90s-jams',
    icon: '🎉',
    tags: ['90s', 'Celebration', 'Goal', 'Party', 'Hype'],
  },

  // ================= 00s ERA TRACKS =================
  {
    id: 'real-00s-modern-rock-boy',
    title: 'Modern Rock Boy (EA NHL Skate Punk)',
    artist: 'Audionautix',
    era: '00s',
    genre: '00s Pop-Punk / Skate-Punk',
    bpm: 160,
    duration: 111,
    audioUrl: '/assets/music/modern_rock_boy.mp3',
    description: 'Classic 2000s EA Sports NHL soundtrack energy! Fast-paced pop-punk guitars, driving 160 BPM drums (Sum 41 / Blink-182 vibe).',
    style: 'era-00s-punk',
    icon: '🛹',
    tags: ['00s', 'Pop-Punk', 'EA NHL', 'Skate Punk', 'Fast Break'],
  },
  {
    id: 'real-00s-fury',
    title: 'Fury Playoff Distortion',
    artist: 'Efface Studios',
    era: '00s',
    genre: '00s Nu-Metal / Hard Rock',
    bpm: 130,
    duration: 198,
    audioUrl: '/assets/music/fury.mp3',
    description: 'Heavy drop-D distortion, aggressive playoff intensity, and crushing rock beats for big hits and fights.',
    style: 'era-00s-numetal',
    icon: '💥',
    tags: ['00s', 'Nu-Metal', 'Heavy', 'Playoffs', 'Big Hits'],
  },
  {
    id: 'real-00s-energy-drive',
    title: 'Energy Drive Highlight',
    artist: 'PixlPerfect',
    era: '00s',
    genre: '00s Alternative Rock',
    bpm: 140,
    duration: 180,
    audioUrl: '/assets/music/energy_drive.mp3',
    description: 'Punchy 2000s sports highlight rock with infectious rhythm guitar, steady drive, and broadcast clarity.',
    style: 'arena-rock',
    icon: '🚀',
    tags: ['00s', 'Alternative', 'Highlights', 'Drive', 'Broadcast'],
  },

  // ================= MODERN ERA TRACKS =================
  {
    id: 'real-modern-sports-spirit',
    title: 'Sports Spirit Highlight Reel',
    artist: 'Efface Studios',
    era: 'modern',
    genre: 'Modern Sports Broadcast Theme',
    bpm: 125,
    duration: 160,
    audioUrl: '/assets/music/sports_spirit.mp3',
    description: 'Modern stadium highlight reel theme with driving beat, motivational energy, and broadcast-ready production.',
    style: 'arena-rock',
    icon: '🏅',
    tags: ['Modern', 'Broadcast', 'Highlight Reel', 'Motivation', 'Stadium'],
  },
];

/**
 * Converts a RealLibraryTrack into an AIMusicTrack object ready for player and video export.
 */
export function convertLibraryTrackToAIMusicTrack(
  libTrack: RealLibraryTrack,
  targetDuration: number,
): AIMusicTrack {
  return {
    id: libTrack.id,
    title: libTrack.title,
    artist: libTrack.artist,
    genre: libTrack.genre,
    source: 'library',
    style: libTrack.style,
    era: libTrack.era,
    bpm: libTrack.bpm,
    duration: Math.max(targetDuration, libTrack.duration),
    audioUrl: libTrack.audioUrl,
    startTimeOffset: 0,
    generatedAt: Date.now(),
    energyLevel: 'peak',
  };
}

/**
 * Inspects an uploaded audio file (MP3, WAV, AAC, M4A, OGG) using Web Audio API
 * to decode duration and compute visual waveform peaks.
 */
export async function createUploadedMusicTrack(file: File): Promise<AIMusicTrack> {
  const audioBlob = file;
  const audioUrl = URL.createObjectURL(file);

  let duration = 60;
  let waveformPeaks: number[] = [];

  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    duration = audioBuffer.duration;

    // Generate 40 normalized peak points for waveform visualization
    const channelData = audioBuffer.getChannelData(0);
    const step = Math.floor(channelData.length / 40);
    for (let i = 0; i < 40; i++) {
      let max = 0;
      const start = i * step;
      const end = Math.min(start + step, channelData.length);
      for (let j = start; j < end; j += 10) {
        const val = Math.abs(channelData[j]);
        if (val > max) max = val;
      }
      waveformPeaks.push(Math.round(max * 100));
    }
    await audioCtx.close();
  } catch (err) {
    console.warn('Could not decode audio buffer for waveform, using estimated duration:', err);
    // Fallback waveform
    waveformPeaks = [30, 45, 70, 85, 60, 40, 90, 100, 75, 50, 65, 80, 95, 70, 40, 60, 80, 55, 35, 70];
  }

  // Clean display title from filename
  const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');

  return {
    id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: cleanTitle,
    artist: 'Custom Upload',
    genre: 'User Soundtrack',
    source: 'uploaded',
    isCustomUpload: true,
    style: 'arena-rock',
    era: 'modern',
    bpm: 128,
    duration,
    audioBlob,
    audioUrl,
    startTimeOffset: 0,
    waveformPeaks,
    fileSize: file.size,
    generatedAt: Date.now(),
    energyLevel: 'peak',
  };
}

/**
 * Creates a track from a direct audio URL or link
 */
export function createUrlMusicTrack(url: string, customName?: string): AIMusicTrack {
  const name = customName || url.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'Stream Track';
  return {
    id: `url-${Date.now()}`,
    title: name,
    artist: 'Web Audio Stream',
    genre: 'Custom Audio Stream',
    source: 'url',
    style: 'arena-rock',
    era: 'modern',
    bpm: 128,
    duration: 180,
    audioUrl: url,
    startTimeOffset: 0,
    generatedAt: Date.now(),
    energyLevel: 'peak',
  };
}
