// AI Sports Music Generator & Synthesizer Engine
// Generates upbeat, vocal-free sports background music matching video sequence duration
// Supports authentic 80s, 90s, 00s (2000s) historical eras and modern sports styles with dynamic procedural variety
import { AIMusicTrack, SportsMusicStyle } from '../types';
import { audioBufferToWav } from './audio';

export interface SportsMusicPlan {
  title: string;
  style: SportsMusicStyle;
  era: '80s' | '90s' | '00s' | 'modern';
  bpm: number;
  rootKey: string;
  chords: string[];
  chordDesc?: string;
  scale: number[]; // semitone intervals from root
  melodyNotes: number[]; // indices into scale
  rhythmDensity: 'standard' | 'double_time' | 'half_time_heavy' | 'skate_punk';
  distortionLevel: number; // 0 to 1
  brassLevel: number;
  synthLevel: number;
  organLevel?: number;
  energyLevel: 'high' | 'peak' | 'epic';
}

export interface SportsMusicStyleMeta {
  id: SportsMusicStyle;
  name: string;
  era: '80s' | '90s' | '00s' | 'modern';
  description: string;
  defaultBpm: number;
  icon: string;
  accentColor: string;
}

export const SPORTS_MUSIC_STYLES: SportsMusicStyleMeta[] = [
  // ================= 80s ERA =================
  {
    id: 'era-80s-rock',
    name: '80s Stadium Arena Rock',
    era: '80s',
    description: 'Van Halen & Europe style power chords, soaring analog synth brass & gated reverb drums',
    defaultBpm: 130,
    icon: '🎸',
    accentColor: 'text-amber-400 border-amber-500/40 bg-amber-950/40',
  },
  {
    id: 'era-80s-synth',
    name: '80s Neon Synthwave',
    era: '80s',
    description: 'Miami Vice / Rocky IV training montage arpeggios, driving saw bass & analog stadium pulse',
    defaultBpm: 128,
    icon: '🕹️',
    accentColor: 'text-fuchsia-400 border-fuchsia-500/40 bg-fuchsia-950/40',
  },

  // ================= 90s ERA =================
  {
    id: 'era-90s-jams',
    name: '90s Jock Anthems & Eurodance',
    era: '90s',
    description: '2 Unlimited style organ stabs, fast 4-on-the-floor beat & hype stadium rave chords',
    defaultBpm: 138,
    icon: '🏒',
    accentColor: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40',
  },
  {
    id: 'era-90s-grunge',
    name: '90s Arena Grunge & Alt-Rock',
    era: '90s',
    description: 'Offspring & Nirvana style heavy distorted power chords, room crashes & garage energy',
    defaultBpm: 144,
    icon: '⚡',
    accentColor: 'text-yellow-400 border-yellow-500/40 bg-yellow-950/40',
  },

  // ================= 00s (2000s) ERA =================
  {
    id: 'era-00s-punk',
    name: '00s EA NHL Pop-Punk',
    era: '00s',
    description: 'EA Sports NHL video game soundtrack vibes! 160 BPM skate-punk drums, drop-D riffs & octave leads',
    defaultBpm: 160,
    icon: '🛹',
    accentColor: 'text-rose-400 border-rose-500/40 bg-rose-950/40',
  },
  {
    id: 'era-00s-numetal',
    name: '00s Nu-Metal Sports Hype',
    era: '00s',
    description: 'Linkin Park & Papa Roach style heavy drop-D chug riffs, massive half-time beats & playoff pump-up',
    defaultBpm: 136,
    icon: '💥',
    accentColor: 'text-purple-400 border-purple-500/40 bg-purple-950/40',
  },

  // ================= MODERN STYLES =================
  {
    id: 'arena-rock',
    name: 'Modern Arena Rock',
    era: 'modern',
    description: 'High-gain modern guitar power chords & driving 4/4 stadium rock percussion',
    defaultBpm: 132,
    icon: '🔥',
    accentColor: 'text-orange-400 border-orange-500/40 bg-orange-950/40',
  },
  {
    id: 'electronic-rush',
    name: 'Modern Electronic Rush',
    era: 'modern',
    description: '130 BPM pulsing synthwave arpeggios, sidechain bass & four-on-the-floor energy',
    defaultBpm: 130,
    icon: '🔊',
    accentColor: 'text-sky-400 border-sky-500/40 bg-sky-950/40',
  },
  {
    id: 'hype-trap',
    name: 'Modern Hype Sports Trap',
    era: 'modern',
    description: '808 sub-bass glides, fast rolling hi-hats & punchy highlight montage beats',
    defaultBpm: 140,
    icon: '🏆',
    accentColor: 'text-amber-400 border-amber-500/40 bg-amber-950/40',
  },
  {
    id: 'cinematic-brass',
    name: 'Cinematic Stomp & Brass',
    era: 'modern',
    description: 'Epic brass fanfares, marching taiko stadium percussion & playoff intensity',
    defaultBpm: 124,
    icon: '🎺',
    accentColor: 'text-red-400 border-red-500/40 bg-red-950/40',
  },
  {
    id: 'stadium-90s',
    name: '90s Rink Organ Classic',
    era: '90s',
    description: 'Classic hockey organ stabs, fast breakbeats & upbeat arena pump-up nostalgia',
    defaultBpm: 136,
    icon: '🎹',
    accentColor: 'text-teal-400 border-teal-500/40 bg-teal-950/40',
  },
];

// Note frequencies map (Hz)
const NOTE_FREQS: Record<string, number> = {
  B1: 61.74,
  C2: 65.41,
  Cs2: 69.3,
  D2: 73.42,
  Eb2: 77.78,
  E2: 82.41,
  F2: 87.31,
  Fs2: 92.5,
  G2: 98.0,
  Ab2: 103.83,
  A2: 110.0,
  Bb2: 116.54,
  B2: 123.47,
  C3: 130.81,
  Cs3: 138.59,
  D3: 146.83,
  Eb3: 155.56,
  E3: 164.81,
  F3: 174.61,
  Fs3: 185.0,
  G3: 196.0,
  Ab3: 207.65,
  A3: 220.0,
  Bb3: 233.08,
  B3: 246.94,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880.0,
};

// Helper: randomly pick an item from an array
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Track generation variation counter so successive generations increment take numbers
let takeCounter = 1;

interface StyleBlueprintConfig {
  era: '80s' | '90s' | '00s' | 'modern';
  bpmRange: [number, number];
  candidateKeys: string[];
  progressions: { chords: string[]; desc: string }[];
  scales: number[][];
  melodies: number[][];
  rhythmDensity: 'standard' | 'double_time' | 'half_time_heavy' | 'skate_punk';
  distortionLevel: number;
  brassLevel: number;
  synthLevel: number;
  organLevel?: number;
  energyLevel: 'high' | 'peak' | 'epic';
  titlePool: string[];
}

const STYLE_BLUEPRINTS: Record<string, StyleBlueprintConfig> = {
  // ================= 80s ERA ROCK =================
  'era-80s-rock': {
    era: '80s',
    bpmRange: [126, 136],
    candidateKeys: ['E2', 'A2', 'D2', 'G2'],
    progressions: [
      { chords: ['E2', 'D2', 'A2', 'E2'], desc: 'I - bVII - IV - I (Arena Anthem)' },
      { chords: ['E2', 'G2', 'A2', 'C3'], desc: 'i - bIII - IV - bVI (Stadium Power)' },
      { chords: ['A2', 'F2', 'G2', 'A2'], desc: 'i - bVI - bVII - i (Final Countdown)' },
      { chords: ['E2', 'C3', 'D3', 'E2'], desc: 'i - bVI - bVII - i (Overtime Riff)' },
    ],
    scales: [
      [0, 3, 5, 7, 10, 12, 15, 17], // Minor Pentatonic
      [0, 2, 4, 5, 7, 9, 11, 12], // Major Fanfare
    ],
    melodies: [
      [0, 4, 7, 12, 11, 9, 7, 5, 4, 2, 0, 7],
      [0, 3, 5, 7, 10, 7, 5, 7, 10, 12, 10, 7],
      [7, 9, 12, 14, 12, 9, 7, 4, 2, 4, 7, 12],
      [0, 0, 7, 7, 10, 10, 12, 12, 10, 7, 5, 3],
    ],
    rhythmDensity: 'standard',
    distortionLevel: 0.7,
    brassLevel: 0.65,
    synthLevel: 0.55,
    energyLevel: 'peak',
    titlePool: [
      '80s Miracle on Ice',
      '80s Neon Slapshot Anthem',
      '80s Stadium Powerplay',
      '80s Gold Medal Heroics',
      '80s Sudden Death Rush',
      '80s Blue Line Glory',
    ],
  },

  // ================= 80s ERA SYNTH =================
  'era-80s-synth': {
    era: '80s',
    bpmRange: [124, 132],
    candidateKeys: ['A2', 'D2', 'F2', 'E2'],
    progressions: [
      { chords: ['A2', 'F2', 'C3', 'G2'], desc: 'i - bVI - bIII - bVII (Miami Heat)' },
      { chords: ['D2', 'Bb2', 'F2', 'C3'], desc: 'i - bVI - bIII - bVII (Night Drive)' },
      { chords: ['A2', 'G2', 'F2', 'G2'], desc: 'i - bVII - bVI - bVII (Training Montage)' },
      { chords: ['E2', 'C3', 'A2', 'B2'], desc: 'i - bVI - iv - V (Rocky IV Pulse)' },
    ],
    scales: [
      [0, 2, 3, 5, 7, 8, 10, 12], // Natural Minor
      [0, 2, 4, 7, 9, 12], // Pentatonic
    ],
    melodies: [
      [0, 7, 10, 12, 10, 7, 8, 7, 5, 7, 3, 2],
      [7, 10, 12, 15, 14, 12, 10, 7, 8, 7, 5, 0],
      [0, 3, 7, 12, 10, 7, 5, 3, 0, 3, 7, 10],
      [12, 10, 8, 7, 5, 7, 8, 10, 12, 14, 12, 10],
    ],
    rhythmDensity: 'double_time',
    distortionLevel: 0.2,
    brassLevel: 0.35,
    synthLevel: 0.9,
    energyLevel: 'high',
    titlePool: [
      '80s Neon Breakaway',
      '80s Turbo Rink Rush',
      '80s Retro Ice Chase',
      '80s Miami Slapshot',
      '80s Synth Montage Hero',
      '80s Cyber Puck Pulse',
    ],
  },

  // ================= 90s ERA JAMS & EURODANCE =================
  'era-90s-jams': {
    era: '90s',
    bpmRange: [134, 144],
    candidateKeys: ['G2', 'C2', 'A2', 'D2'],
    progressions: [
      { chords: ['G2', 'F2', 'C3', 'G2'], desc: 'I - bVII - IV - I (Get Ready For This)' },
      { chords: ['A2', 'G2', 'F2', 'G2'], desc: 'i - bVII - bVI - bVII (Jock Jam Rave)' },
      { chords: ['C2', 'G2', 'A2', 'F2'], desc: 'I - V - vi - IV (All-Star Pump Up)' },
      { chords: ['G2', 'C3', 'D3', 'C3'], desc: 'I - IV - V - IV (Classic Rink Organ)' },
    ],
    scales: [
      [0, 2, 4, 5, 7, 9, 10, 12], // Mixolydian (Rave/Jams)
      [0, 3, 5, 7, 10, 12], // Minor Pentatonic
    ],
    melodies: [
      [0, 4, 7, 12, 7, 4, 5, 7, 12, 10, 7, 4],
      [7, 7, 10, 12, 10, 7, 5, 5, 7, 10, 7, 5],
      [12, 10, 7, 5, 7, 10, 12, 12, 10, 7, 5, 0],
      [0, 0, 7, 7, 5, 5, 12, 12, 10, 7, 5, 4],
    ],
    rhythmDensity: 'double_time',
    distortionLevel: 0.25,
    brassLevel: 0.45,
    synthLevel: 0.75,
    organLevel: 0.9,
    energyLevel: 'peak',
    titlePool: [
      '90s Jock Jam Powerplay',
      '90s Rink Organ Rave',
      '90s Stadium Pump-Up Anthem',
      '90s Breakaway Blitz \'96',
      '90s All-Star Slapshot',
      '90s Stanley Cup Jam',
    ],
  },

  // ================= 90s ERA GRUNGE & ALT-ROCK =================
  'era-90s-grunge': {
    era: '90s',
    bpmRange: [140, 152],
    candidateKeys: ['E2', 'D2', 'A2', 'G2'],
    progressions: [
      { chords: ['E2', 'G2', 'A2', 'C3'], desc: 'i - bIII - IV - bVI (Seattle Slapshot)' },
      { chords: ['D2', 'F2', 'C3', 'G2'], desc: 'i - bIII - bVII - IV (Green Day 90s Vibe)' },
      { chords: ['E2', 'C3', 'G2', 'D3'], desc: 'i - bVI - bIII - bVII (Offspring Rink Riff)' },
      { chords: ['A2', 'C3', 'D3', 'F3'], desc: 'i - bIII - IV - bVI (Raw Arena Grunge)' },
    ],
    scales: [
      [0, 3, 5, 6, 7, 10, 12], // Blues / Grunge Scale
      [0, 3, 5, 7, 10, 12],
    ],
    melodies: [
      [0, 3, 5, 6, 7, 5, 3, 0, 5, 7, 10, 12],
      [7, 5, 3, 0, 3, 5, 7, 10, 7, 5, 3, 0],
      [12, 10, 7, 6, 5, 3, 0, 3, 5, 7, 10, 12],
      [0, 7, 10, 12, 10, 7, 5, 3, 5, 7, 5, 3],
    ],
    rhythmDensity: 'standard',
    distortionLevel: 0.85,
    brassLevel: 0.1,
    synthLevel: 0.2,
    energyLevel: 'peak',
    titlePool: [
      '90s Rink Riot Grunge',
      '90s Overdrive Slapshot',
      '90s Garage Ice Rebellion',
      '90s Hardcheck Blitz',
      '90s Alternative Arena Rush',
      '90s Penalty Box Grunge',
    ],
  },

  // ================= 00s (2000s) EA NHL POP-PUNK =================
  'era-00s-punk': {
    era: '00s',
    bpmRange: [154, 168], // High-tempo skate punk!
    candidateKeys: ['D2', 'E2', 'A2', 'C2', 'G2'],
    progressions: [
      { chords: ['D2', 'A2', 'B2', 'G2'], desc: 'I - V - vi - IV (Classic EA NHL Anthem)' },
      { chords: ['B2', 'G2', 'D2', 'A2'], desc: 'vi - IV - I - V (Sum 41 Overtime Rush)' },
      { chords: ['D2', 'G2', 'B2', 'A2'], desc: 'I - IV - vi - V (Blink Skate Breakaway)' },
      { chords: ['E2', 'C3', 'G2', 'D3'], desc: 'i - bVI - bIII - bVII (Pop-Punk Faceoff)' },
      { chords: ['D2', 'C3', 'G2', 'D2'], desc: 'I - bVII - IV - I (Drop-D Fast Blitz)' },
    ],
    scales: [
      [0, 2, 4, 5, 7, 9, 11, 12], // Major High-Energy Pop-Punk
      [0, 2, 4, 7, 9, 12], // Pentatonic Octaves
    ],
    melodies: [
      [12, 11, 9, 7, 9, 11, 12, 14, 12, 11, 9, 7],
      [0, 4, 7, 12, 11, 9, 7, 4, 2, 4, 7, 12],
      [7, 9, 11, 12, 14, 12, 11, 9, 7, 4, 7, 12],
      [12, 12, 11, 11, 9, 9, 7, 7, 9, 11, 12, 14],
      [0, 2, 4, 7, 9, 12, 14, 16, 14, 12, 9, 7],
    ],
    rhythmDensity: 'skate_punk', // Signature fast kick-snare-kick-snare
    distortionLevel: 0.88,
    brassLevel: 0.1,
    synthLevel: 0.2,
    energyLevel: 'epic',
    titlePool: [
      '00s EA NHL Faceoff Hype',
      '00s Skate Punk Breakaway',
      '00s Overtime Riot Anthem',
      '00s Sudden Death Punk',
      '00s Blue Line Blitz',
      '00s Center Ice Adrenaline',
      '00s Slapshot Skate Rush',
    ],
  },

  // ================= 00s (2000s) NU-METAL =================
  'era-00s-numetal': {
    era: '00s',
    bpmRange: [132, 144],
    candidateKeys: ['D2', 'C2', 'B1', 'A2'],
    progressions: [
      { chords: ['D2', 'Eb2', 'D2', 'Bb2'], desc: 'i - bII - i - bVI (Linkin Park Drop-D)' },
      { chords: ['D2', 'Bb2', 'C3', 'D2'], desc: 'i - bVI - bVII - i (Papa Roach Pump-Up)' },
      { chords: ['B1', 'G2', 'A2', 'B1'], desc: 'i - bVI - bVII - i (Heavy Playoff Slam)' },
      { chords: ['C2', 'Ab2', 'Bb2', 'C2'], desc: 'i - bVI - bVII - i (Industrial Ice Hype)' },
    ],
    scales: [
      [0, 1, 3, 5, 7, 8, 10, 12], // Phrygian Heavy
      [0, 1, 5, 7, 8, 12],
    ],
    melodies: [
      [0, 0, 7, 8, 7, 5, 1, 0, 5, 7, 8, 12],
      [0, 1, 0, 7, 8, 7, 1, 0, 3, 5, 1, 0],
      [12, 11, 8, 7, 5, 1, 0, 0, 7, 8, 7, 0],
      [0, 7, 8, 12, 8, 7, 5, 1, 0, 3, 1, 0],
    ],
    rhythmDensity: 'half_time_heavy',
    distortionLevel: 0.92,
    brassLevel: 0.5,
    synthLevel: 0.45,
    energyLevel: 'epic',
    titlePool: [
      '00s Nu-Metal Playoff Slam',
      '00s Drop-D Slapshot Hype',
      '00s Hardcheck Adrenaline',
      '00s Arena Riot Impact',
      '00s Overtime Heavy Assault',
      '00s Ice Crush Anthem',
    ],
  },

  // ================= MODERN ARENA ROCK =================
  'arena-rock': {
    era: 'modern',
    bpmRange: [130, 136],
    candidateKeys: ['E2', 'G2', 'A2', 'D2'],
    progressions: [
      { chords: ['E2', 'G2', 'A2', 'C3'], desc: 'i - bIII - IV - bVI (Modern Arena Drive)' },
      { chords: ['A2', 'C3', 'D3', 'F3'], desc: 'i - bIII - IV - bVI (Powerplay Surge)' },
      { chords: ['D2', 'F2', 'G2', 'Bb2'], desc: 'i - bIII - IV - bVI (High-Gain Blitz)' },
    ],
    scales: [[0, 3, 5, 7, 10, 12, 15, 17]],
    melodies: [
      [0, 3, 5, 7, 5, 7, 10, 12, 10, 7, 5, 3],
      [7, 10, 12, 15, 12, 10, 7, 5, 7, 10, 12, 10],
      [0, 5, 7, 10, 12, 10, 7, 5, 3, 5, 7, 0],
    ],
    rhythmDensity: 'standard',
    distortionLevel: 0.75,
    brassLevel: 0.25,
    synthLevel: 0.35,
    energyLevel: 'peak',
    titlePool: [
      'Overtime Powerplay Rock',
      'Stadium Distortion Rush',
      'Hat-Trick Arena Rock',
      'Rink Firepower Anthem',
    ],
  },

  // ================= MODERN ELECTRONIC RUSH =================
  'electronic-rush': {
    era: 'modern',
    bpmRange: [128, 134],
    candidateKeys: ['A2', 'F2', 'D2'],
    progressions: [
      { chords: ['A2', 'F2', 'C3', 'G2'], desc: 'i - bVI - bIII - bVII (Neon Rush)' },
      { chords: ['D2', 'Bb2', 'F2', 'C3'], desc: 'i - bVI - bIII - bVII (Cyber Breakaway)' },
    ],
    scales: [[0, 2, 3, 5, 7, 8, 10, 12]],
    melodies: [
      [0, 7, 10, 12, 10, 7, 8, 7, 5, 7, 3, 2],
      [12, 10, 7, 8, 10, 12, 14, 12, 10, 7, 5, 3],
    ],
    rhythmDensity: 'double_time',
    distortionLevel: 0.25,
    brassLevel: 0.15,
    synthLevel: 0.88,
    energyLevel: 'high',
    titlePool: [
      'Breakaway Neon Rush',
      'High-Speed Electro Slapshot',
      'Cybernetic Goal Blitz',
    ],
  },

  // ================= MODERN HYPE TRAP =================
  'hype-trap': {
    era: 'modern',
    bpmRange: [138, 146],
    candidateKeys: ['D2', 'C2', 'Eb2'],
    progressions: [
      { chords: ['D2', 'A2', 'Bb2', 'G2'], desc: 'i - v - bVI - iv (808 Hype)' },
      { chords: ['C2', 'G2', 'Ab2', 'F2'], desc: 'i - v - bVI - iv (Slapshot Montage)' },
    ],
    scales: [[0, 1, 5, 7, 8, 12]],
    melodies: [
      [0, 0, 7, 8, 7, 5, 1, 0, 5, 7, 8, 12],
      [12, 8, 7, 5, 1, 0, 5, 7, 8, 12, 8, 7],
    ],
    rhythmDensity: 'half_time_heavy',
    distortionLevel: 0.45,
    brassLevel: 0.65,
    synthLevel: 0.5,
    energyLevel: 'peak',
    titlePool: [
      '808 Slapshot Montage',
      'Trap Hockey Hype Anthem',
      'Sub-Bass Goal Horn Rush',
    ],
  },

  // ================= CINEMATIC BRASS =================
  'cinematic-brass': {
    era: 'modern',
    bpmRange: [122, 128],
    candidateKeys: ['C2', 'D2', 'G2'],
    progressions: [
      { chords: ['C2', 'G2', 'A2', 'F2'], desc: 'I - V - vi - IV (Stanley Cup March)' },
      { chords: ['D2', 'A2', 'B2', 'G2'], desc: 'I - V - vi - IV (Glory Fanfare)' },
    ],
    scales: [[0, 2, 4, 7, 9, 12, 14, 16]],
    melodies: [
      [0, 4, 7, 12, 14, 12, 7, 9, 7, 4, 2, 0],
      [7, 9, 12, 14, 16, 14, 12, 9, 7, 4, 7, 12],
    ],
    rhythmDensity: 'standard',
    distortionLevel: 0.15,
    brassLevel: 0.95,
    synthLevel: 0.15,
    energyLevel: 'epic',
    titlePool: [
      'Stanley Cup Glory March',
      'Championship Rink Fanfare',
      'Playoff Victory Anthem',
    ],
  },

  // ================= STADIUM 90S ALIAS =================
  'stadium-90s': {
    era: '90s',
    bpmRange: [134, 142],
    candidateKeys: ['G2', 'C2', 'A2'],
    progressions: [
      { chords: ['G2', 'C3', 'D3', 'C3'], desc: 'I - IV - V - IV (Rink Organ Classic)' },
      { chords: ['G2', 'F2', 'C3', 'G2'], desc: 'I - bVII - IV - I (Get Ready Jam)' },
    ],
    scales: [[0, 2, 4, 5, 7, 9, 11, 12]],
    melodies: [
      [0, 4, 7, 12, 7, 4, 5, 7, 12, 11, 9, 7],
      [7, 10, 12, 10, 7, 5, 4, 5, 7, 12, 10, 7],
    ],
    rhythmDensity: 'double_time',
    distortionLevel: 0.35,
    brassLevel: 0.5,
    synthLevel: 0.65,
    organLevel: 0.95,
    energyLevel: 'high',
    titlePool: [
      'Rink Organ Pump-Up \'94',
      'Classic Stadium Let\'s Go',
      'Arena Hammond Breakout',
    ],
  },
};

/**
 * Generate a dynamic, non-repetitive procedural sports music plan for the requested style.
 * Every invocation randomizes the root key, chord progression, melody motif, BPM, and title!
 */
export function getDynamicSportsMusicPlan(
  style: SportsMusicStyle,
  customPrompt?: string,
): SportsMusicPlan {
  const config = STYLE_BLUEPRINTS[style] || STYLE_BLUEPRINTS['arena-rock'];

  // Randomize root key from candidate pool
  const rootKey = pickRandom(config.candidateKeys);

  // Randomize chord progression from candidate pool
  const chosenProg = pickRandom(config.progressions);

  // Randomize scale and melody motif
  const scale = pickRandom(config.scales);
  const melodyNotes = pickRandom(config.melodies);

  // Randomize BPM within range
  const [minBpm, maxBpm] = config.bpmRange;
  const bpm = minBpm + Math.floor(Math.random() * (maxBpm - minBpm + 1));

  // Dynamic take number and title
  takeCounter++;
  const baseTitle = customPrompt
    ? `${config.era.toUpperCase()} ${style.replace('era-', '').replace('-', ' ')}: ${customPrompt.slice(0, 20)}`
    : pickRandom(config.titlePool);
  const title = `${baseTitle} (Take ${takeCounter})`;

  return {
    title,
    style,
    era: config.era,
    bpm,
    rootKey,
    chords: chosenProg.chords,
    chordDesc: chosenProg.desc,
    scale,
    melodyNotes,
    rhythmDensity: config.rhythmDensity,
    distortionLevel: config.distortionLevel,
    brassLevel: config.brassLevel,
    synthLevel: config.synthLevel,
    organLevel: config.organLevel,
    energyLevel: config.energyLevel,
  };
}

// Generate distortion curve for overdrive guitars / aggressive sports synths
function makeDistortionCurve(amount = 25): Float32Array {
  const k = typeof amount === 'number' ? amount : 25;
  const nSamples = 44100;
  const curve = new Float32Array(nSamples);
  const deg = Math.PI / 180;
  for (let i = 0; i < nSamples; ++i) {
    const x = (i * 2) / nSamples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

/**
 * Render a complete instrumental sports track into an AudioBuffer using OfflineAudioContext.
 * Matches the exact requested sequence duration with authentic era sound design.
 */
export async function renderSportsMusicAudio(
  plan: SportsMusicPlan,
  targetDurationSeconds: number,
): Promise<AudioBuffer> {
  const safeDuration = Math.max(3.0, Math.min(300.0, targetDurationSeconds));
  const sampleRate = 44100;
  const totalSamples = Math.ceil(sampleRate * safeDuration);

  const OfflineCtxClass =
    window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  const offlineCtx = new OfflineCtxClass(2, totalSamples, sampleRate);

  const masterGain = offlineCtx.createGain();
  masterGain.gain.setValueAtTime(0.88, 0);

  // Gentle fade-in (100ms) and fade-out (350ms) at the absolute ends
  masterGain.gain.setValueAtTime(0.001, 0);
  masterGain.gain.linearRampToValueAtTime(0.88, 0.1);
  const fadeOutStart = Math.max(0.15, safeDuration - 0.4);
  masterGain.gain.setValueAtTime(0.88, fadeOutStart);
  masterGain.gain.linearRampToValueAtTime(0.001, safeDuration);

  masterGain.connect(offlineCtx.destination);

  // Mixer sub-busses
  const drumBus = offlineCtx.createGain();
  drumBus.gain.value = 1.05;
  drumBus.connect(masterGain);

  const bassBus = offlineCtx.createGain();
  bassBus.gain.value = 0.9;
  bassBus.connect(masterGain);

  const musicBus = offlineCtx.createGain();
  musicBus.gain.value = 0.85;
  musicBus.connect(masterGain);

  // Distortion node for rock guitar & aggressive synths
  const waveshaper = offlineCtx.createWaveShaper();
  waveshaper.curve = makeDistortionCurve(Math.round(plan.distortionLevel * 60));
  waveshaper.oversample = '4x';

  const guitarFilter = offlineCtx.createBiquadFilter();
  guitarFilter.type = 'lowpass';
  guitarFilter.frequency.value = plan.style === 'era-00s-punk' ? 4200 : 2600;

  waveshaper.connect(guitarFilter);
  guitarFilter.connect(musicBus);

  // Timing math
  const beatDuration = 60 / plan.bpm;
  const barDuration = beatDuration * 4;
  const totalBeats = Math.ceil(safeDuration / beatDuration);
  const numBars = Math.ceil(safeDuration / barDuration);

  const is80s = plan.era === '80s';
  const is90s = plan.era === '90s';
  const is00s = plan.era === '00s';
  const isSkatePunk = plan.rhythmDensity === 'skate_punk';

  // 1. ==================== DRUMS & RHYTHM SECTION ====================
  for (let beat = 0; beat < totalBeats; beat++) {
    const beatTime = beat * beatDuration;
    if (beatTime >= safeDuration - 0.05) break;

    const beatInBar = beat % 4;

    // --- KICK DRUM ---
    let isKick = false;
    if (isSkatePunk) {
      // Skate-punk: kick on beat 1 and upbeat of beat 2 (& of 2)
      isKick = beatInBar === 0 || beatInBar === 2;
    } else if (plan.rhythmDensity === 'half_time_heavy') {
      isKick = beatInBar === 0 || (beatInBar === 2 && beat % 8 === 2);
    } else if (is90s && (plan.style === 'era-90s-jams' || plan.style === 'stadium-90s')) {
      // Relentless 4-on-the-floor kick for 90s Eurodance / Jock Jam
      isKick = true;
    } else {
      isKick = beatInBar === 0 || beatInBar === 2 || (beatInBar === 1 && beat % 8 === 5);
    }

    if (isKick) {
      const osc = offlineCtx.createOscillator();
      const kickGain = offlineCtx.createGain();
      osc.type = 'sine';

      const startPitch = plan.style === 'hype-trap' ? 140 : is00s ? 175 : 160;
      const endPitch = plan.style === 'hype-trap' ? 36 : 48;
      const kickLen = plan.style === 'hype-trap' ? 0.38 : isSkatePunk ? 0.18 : 0.24;

      osc.frequency.setValueAtTime(startPitch, beatTime);
      osc.frequency.exponentialRampToValueAtTime(endPitch, beatTime + 0.07);

      kickGain.gain.setValueAtTime(isSkatePunk ? 1.2 : 1.1, beatTime);
      kickGain.gain.exponentialRampToValueAtTime(0.001, beatTime + kickLen);

      osc.connect(kickGain);
      kickGain.connect(drumBus);

      osc.start(beatTime);
      osc.stop(beatTime + kickLen);
    }

    // Skate-punk syncopated extra kick on & of beat 2 (beat 1.5 in 0-indexed beats)
    if (isSkatePunk) {
      const syncKickTime = beatTime + beatDuration * 0.5;
      if (beatInBar === 1 && syncKickTime < safeDuration - 0.05) {
        const sOsc = offlineCtx.createOscillator();
        const sGain = offlineCtx.createGain();
        sOsc.type = 'sine';
        sOsc.frequency.setValueAtTime(160, syncKickTime);
        sOsc.frequency.exponentialRampToValueAtTime(50, syncKickTime + 0.06);

        sGain.gain.setValueAtTime(0.9, syncKickTime);
        sGain.gain.exponentialRampToValueAtTime(0.001, syncKickTime + 0.16);

        sOsc.connect(sGain);
        sGain.connect(drumBus);
        sOsc.start(syncKickTime);
        sOsc.stop(syncKickTime + 0.16);
      }
    }

    // --- SNARE / CLAP ---
    const isSnare =
      plan.rhythmDensity === 'half_time_heavy'
        ? beatInBar === 2 // Half-time trap/nu-metal snare on beat 3
        : beatInBar === 1 || beatInBar === 3; // Standard backbeat on 2 & 4

    if (isSnare) {
      // Snare tonal body
      const snareOsc = offlineCtx.createOscillator();
      const snareToneGain = offlineCtx.createGain();
      snareOsc.type = is00s ? 'triangle' : 'sawtooth';
      const snarePitch = is00s ? 210 : 190;
      snareOsc.frequency.setValueAtTime(snarePitch, beatTime);
      snareOsc.frequency.exponentialRampToValueAtTime(85, beatTime + 0.05);

      snareToneGain.gain.setValueAtTime(is00s ? 0.85 : 0.7, beatTime);
      snareToneGain.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.12);

      snareOsc.connect(snareToneGain);
      snareToneGain.connect(drumBus);
      snareOsc.start(beatTime);
      snareOsc.stop(beatTime + 0.13);

      // Snare crisp noise crack (Gated reverb style for 80s!)
      const noiseDur = is80s ? 0.14 : isSkatePunk ? 0.18 : 0.22;
      const noiseBuf = offlineCtx.createBuffer(1, Math.floor(sampleRate * noiseDur), sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noiseSrc = offlineCtx.createBufferSource();
      noiseSrc.buffer = noiseBuf;

      const noiseFilter = offlineCtx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.value = is80s ? 1000 : 1400;

      const noiseGain = offlineCtx.createGain();
      noiseGain.gain.setValueAtTime(is80s ? 1.1 : 0.85, beatTime);

      if (is80s) {
        // Gated snare abrupt cut! High volume sustain then sudden shutoff
        noiseGain.gain.setValueAtTime(1.0, beatTime + 0.1);
        noiseGain.gain.linearRampToValueAtTime(0.001, beatTime + 0.13);
      } else {
        noiseGain.gain.exponentialRampToValueAtTime(0.001, beatTime + noiseDur);
      }

      noiseSrc.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(drumBus);

      noiseSrc.start(beatTime);
      noiseSrc.stop(beatTime + noiseDur);
    }

    // --- HI-HATS & OFF-BEAT OPEN HATS ---
    // 90s Eurodance signature: Open Hi-Hat on offbeats (the "&" of every quarter note)
    if (is90s && (plan.style === 'era-90s-jams' || plan.style === 'stadium-90s')) {
      const offbeatTime = beatTime + beatDuration * 0.5;
      if (offbeatTime < safeDuration - 0.05) {
        const openHatDur = 0.18;
        const oBuf = offlineCtx.createBuffer(1, Math.floor(sampleRate * openHatDur), sampleRate);
        const oData = oBuf.getChannelData(0);
        for (let i = 0; i < oData.length; i++) oData[i] = Math.random() * 2 - 1;
        const oSrc = offlineCtx.createBufferSource();
        oSrc.buffer = oBuf;
        const oFilter = offlineCtx.createBiquadFilter();
        oFilter.type = 'highpass';
        oFilter.frequency.value = 6500;
        const oGain = offlineCtx.createGain();
        oGain.gain.setValueAtTime(0.55, offbeatTime);
        oGain.gain.exponentialRampToValueAtTime(0.001, offbeatTime + openHatDur);
        oSrc.connect(oFilter);
        oFilter.connect(oGain);
        oGain.connect(drumBus);
        oSrc.start(offbeatTime);
        oSrc.stop(offbeatTime + openHatDur);
      }
    }

    // Standard / Skate-Punk hi-hat subdivisions (8th or 16th notes)
    const hatSubdivisions = isSkatePunk || plan.rhythmDensity === 'double_time' ? 4 : 2;
    for (let sub = 0; sub < hatSubdivisions; sub++) {
      const hatTime = beatTime + sub * (beatDuration / hatSubdivisions);
      if (hatTime >= safeDuration - 0.02) break;

      const hatDur = sub === 1 && hatSubdivisions === 2 ? 0.07 : 0.04;
      const hatBuf = offlineCtx.createBuffer(1, Math.floor(sampleRate * hatDur), sampleRate);
      const hData = hatBuf.getChannelData(0);
      for (let i = 0; i < hData.length; i++) hData[i] = Math.random() * 2 - 1;
      const hatSrc = offlineCtx.createBufferSource();
      hatSrc.buffer = hatBuf;

      const hatFilter = offlineCtx.createBiquadFilter();
      hatFilter.type = 'highpass';
      hatFilter.frequency.value = is00s ? 8500 : 7500;

      const hatGain = offlineCtx.createGain();
      const velocity = sub === 0 ? 0.45 : 0.22;
      hatGain.gain.setValueAtTime(velocity, hatTime);
      hatGain.gain.exponentialRampToValueAtTime(0.001, hatTime + hatDur);

      hatSrc.connect(hatFilter);
      hatFilter.connect(hatGain);
      hatGain.connect(drumBus);

      hatSrc.start(hatTime);
      hatSrc.stop(hatTime + hatDur);
    }

    // --- CRASH CYMBAL at section starts (every 4 bars) ---
    if (beat % 16 === 0 && beatTime < safeDuration - 1.0) {
      const crashDur = 1.6;
      const crashBuf = offlineCtx.createBuffer(1, Math.floor(sampleRate * crashDur), sampleRate);
      const cData = crashBuf.getChannelData(0);
      for (let i = 0; i < cData.length; i++) cData[i] = Math.random() * 2 - 1;
      const crashSrc = offlineCtx.createBufferSource();
      crashSrc.buffer = crashBuf;

      const crashFilter = offlineCtx.createBiquadFilter();
      crashFilter.type = 'bandpass';
      crashFilter.frequency.value = 5200;
      crashFilter.Q.value = 0.7;

      const crashGain = offlineCtx.createGain();
      crashGain.gain.setValueAtTime(0.65, beatTime);
      crashGain.gain.exponentialRampToValueAtTime(0.001, beatTime + crashDur);

      crashSrc.connect(crashFilter);
      crashFilter.connect(crashGain);
      crashGain.connect(drumBus);

      crashSrc.start(beatTime);
      crashSrc.stop(beatTime + crashDur);
    }
  }

  // 2. ==================== BASSLINE (Era-Tailored) ====================
  const baseFreq = NOTE_FREQS[plan.rootKey] || 82.41;

  for (let bar = 0; bar < numBars; bar++) {
    const barStart = bar * barDuration;
    if (barStart >= safeDuration) break;

    const chordKey = plan.chords[bar % plan.chords.length];
    const chordBaseFreq = NOTE_FREQS[chordKey] || baseFreq;

    // 8th or 16th note rhythm for bass
    const bassSteps = isSkatePunk || plan.rhythmDensity === 'double_time' ? 8 : 8;
    for (let s = 0; s < bassSteps; s++) {
      const stepTime = barStart + s * (beatDuration / 2);
      if (stepTime >= safeDuration - 0.05) break;

      // Note selection (root, fifth, octave, minor third)
      let freq = chordBaseFreq;
      if (s === 2 || s === 6) freq = chordBaseFreq * 1.5; // fifth
      if (s === 3 || s === 7) freq = chordBaseFreq * 1.2; // syncopation note

      const bassOsc = offlineCtx.createOscillator();
      const bassGain = offlineCtx.createGain();

      bassOsc.type = is80s ? 'sawtooth' : is00s ? 'sawtooth' : 'triangle';
      bassOsc.frequency.setValueAtTime(freq, stepTime);

      const bassLen = beatDuration * (isSkatePunk ? 0.42 : 0.46);
      bassGain.gain.setValueAtTime(is00s ? 0.75 : 0.65, stepTime);
      bassGain.gain.exponentialRampToValueAtTime(0.001, stepTime + bassLen);

      const bassFilter = offlineCtx.createBiquadFilter();
      bassFilter.type = 'lowpass';
      bassFilter.frequency.setValueAtTime(is00s ? 750 : 550, stepTime);
      bassFilter.frequency.linearRampToValueAtTime(280, stepTime + bassLen);

      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(bassBus);

      bassOsc.start(stepTime);
      bassOsc.stop(stepTime + bassLen);
    }
  }

  // 3. ==================== CHORD RIFFS & GUITAR / ORGAN / SYNTH ====================
  const isOrgan = (plan.organLevel ?? 0) > 0.6;

  for (let bar = 0; bar < numBars; bar++) {
    const barStart = bar * barDuration;
    if (barStart >= safeDuration) break;

    const chordKey = plan.chords[bar % plan.chords.length];
    const chordFreq = NOTE_FREQS[chordKey] || baseFreq;

    // Power chord triad (Root + 5th + Octave)
    const chordPitches = [chordFreq * 2, chordFreq * 3, chordFreq * 4];

    if (isOrgan) {
      // 90s HAMMOND RINK ORGAN STABS
      // 8th note syncopated stabs: [1, 0, 1, 0, 1, 1, 0, 1]
      const organRhythm = [1, 0, 1, 0, 1, 1, 0, 1];
      for (let i = 0; i < organRhythm.length; i++) {
        if (organRhythm[i] === 0) continue;
        const stabTime = barStart + i * (beatDuration / 2);
        if (stabTime >= safeDuration - 0.05) break;

        const stabLen = beatDuration * 0.38;

        // Additive multi-harmonic drawbars for rich rink organ
        [1, 2, 3, 4].forEach((harmonicMult) => {
          chordPitches.forEach((pitch) => {
            const osc = offlineCtx.createOscillator();
            const oGain = offlineCtx.createGain();
            osc.type = harmonicMult === 1 ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime(pitch * (harmonicMult === 3 ? 1.5 : harmonicMult === 4 ? 2 : 1), stabTime);

            const vol = harmonicMult === 1 ? 0.18 : 0.09 / harmonicMult;
            oGain.gain.setValueAtTime(vol, stabTime);
            oGain.gain.exponentialRampToValueAtTime(0.001, stabTime + stabLen);

            osc.connect(oGain);
            oGain.connect(musicBus);
            osc.start(stabTime);
            osc.stop(stabTime + stabLen);
          });
        });
      }
    } else {
      // GUITAR POWER CHORD CHUG (80s Arena Rock, 90s Grunge, 00s Skate Punk)
      // Dynamic syncopated chug pattern
      const chugPattern = isSkatePunk
        ? [1, 1, 1, 1, 1, 1, 1, 1] // Relentless driving 8th-note pop-punk chug!
        : [1, 0, 1, 1, 0, 1, 1, 0]; // Syncopated arena rock

      for (let i = 0; i < chugPattern.length; i++) {
        if (chugPattern[i] === 0) continue;
        const chordTime = barStart + i * (beatDuration / 2);
        if (chordTime >= safeDuration - 0.05) break;

        const chordLen = beatDuration * (isSkatePunk ? 0.44 : 0.42);

        chordPitches.forEach((pitch) => {
          const osc = offlineCtx.createOscillator();
          const gGain = offlineCtx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(pitch, chordTime);

          const vol = isSkatePunk ? 0.22 : 0.2;
          gGain.gain.setValueAtTime(vol, chordTime);
          gGain.gain.exponentialRampToValueAtTime(0.001, chordTime + chordLen);

          osc.connect(gGain);
          if (plan.distortionLevel > 0.3) {
            gGain.connect(waveshaper); // Route through distortion
          } else {
            gGain.connect(musicBus);
          }

          osc.start(chordTime);
          osc.stop(chordTime + chordLen);
        });
      }
    }
  }

  // 4. ==================== LEAD THEME & ANTHEM HOOK ====================
  // Plays an upbeat, energetic hook with distinct era voicing
  const leadOctave = baseFreq * (is00s ? 6 : 4);
  const melodyPattern = plan.melodyNotes;
  let melodyIdx = 0;

  for (let beat = 0; beat < totalBeats; beat += 0.5) {
    const leadTime = beat * beatDuration;
    if (leadTime >= safeDuration - 0.1) break;

    const beatFract = beat % 2;
    if (beatFract === 0 || beatFract === 0.5 || beatFract === 1.5) {
      const scaleStep = melodyPattern[melodyIdx % melodyPattern.length];
      melodyIdx++;

      const leadPitch = leadOctave * Math.pow(2, scaleStep / 12);
      const leadLen = beatDuration * 0.45;

      const leadOsc1 = offlineCtx.createOscillator();
      const leadOsc2 = offlineCtx.createOscillator();
      const leadGain = offlineCtx.createGain();

      // Era-specific lead sound:
      // 80s: Brass synth (square + saw)
      // 00s: Screaming octave guitar lead (sawtooth)
      // 90s: Rave saw hook
      leadOsc1.type = is80s && plan.brassLevel > 0.5 ? 'square' : 'sawtooth';
      leadOsc2.type = 'sawtooth';

      leadOsc1.frequency.setValueAtTime(leadPitch, leadTime);
      leadOsc2.frequency.setValueAtTime(leadPitch * 1.005, leadTime); // chorus detune

      const leadFilter = offlineCtx.createBiquadFilter();
      leadFilter.type = 'lowpass';
      const cutoff = is00s ? 4000 : plan.brassLevel > 0.5 ? 3200 : 2500;
      leadFilter.frequency.setValueAtTime(cutoff, leadTime);
      leadFilter.frequency.exponentialRampToValueAtTime(900, leadTime + leadLen);

      leadGain.gain.setValueAtTime(0.24, leadTime);
      leadGain.gain.exponentialRampToValueAtTime(0.001, leadTime + leadLen);

      leadOsc1.connect(leadFilter);
      leadOsc2.connect(leadFilter);
      leadFilter.connect(leadGain);

      if (is00s && plan.distortionLevel > 0.5) {
        leadGain.connect(waveshaper); // 00s guitar octave lead through distortion
      } else {
        leadGain.connect(musicBus);
      }

      leadOsc1.start(leadTime);
      leadOsc2.start(leadTime);
      leadOsc1.stop(leadTime + leadLen);
      leadOsc2.stop(leadTime + leadLen);
    }
  }

  // 5. ==================== FINAL CRASH & POWER RESOLUTION ====================
  const endChordTime = Math.max(0, safeDuration - 0.4);
  const endPitches = [baseFreq * 2, baseFreq * 3, baseFreq * 4, baseFreq * 6];
  endPitches.forEach((pitch) => {
    const osc = offlineCtx.createOscillator();
    const gGain = offlineCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(pitch, endChordTime);

    gGain.gain.setValueAtTime(0.35, endChordTime);
    gGain.gain.exponentialRampToValueAtTime(0.001, safeDuration);

    osc.connect(gGain);
    gGain.connect(musicBus);

    osc.start(endChordTime);
    osc.stop(safeDuration);
  });

  return await offlineCtx.startRendering();
}

/**
 * Generate a complete AIMusicTrack object with non-repetitive procedural variations and AI blueprints.
 */
export async function generateAIMusicTrack(
  style: SportsMusicStyle,
  targetDuration: number,
  customPrompt?: string,
): Promise<AIMusicTrack> {
  // 1. Generate dynamic, randomized procedural plan (guarantees variety every take)
  let plan = getDynamicSportsMusicPlan(style, customPrompt);

  // 2. Attempt server-side Gemini generation for AI custom blueprints if available
  try {
    const response = await fetch('/api/generate-sports-music-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: customPrompt || `Upbeat energetic sports music for hockey highlights in ${style} style (Era: ${plan.era})`,
        style,
        duration: targetDuration,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.plan) {
        plan = {
          ...plan,
          ...data.plan,
          style,
          era: plan.era,
        };
      }
    }
  } catch (err) {
    console.info('Using dynamic procedural sports engine blueprint');
  }

  const audioBuffer = await renderSportsMusicAudio(plan, targetDuration);
  const audioBlob = audioBufferToWav(audioBuffer);
  const audioUrl = URL.createObjectURL(audioBlob);

  const track: AIMusicTrack = {
    id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    title: plan.title,
    style,
    era: plan.era,
    musicalKey: plan.rootKey,
    chordProgressionDesc: plan.chordDesc,
    prompt: customPrompt,
    bpm: plan.bpm,
    duration: targetDuration,
    audioBlob,
    audioUrl,
    generatedAt: Date.now(),
    energyLevel: plan.energyLevel,
  };

  return track;
}
