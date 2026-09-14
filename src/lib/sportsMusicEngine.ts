// AI Sports Music Generator & Synthesizer Engine
// Generates upbeat, vocal-free sports background music matching video sequence duration
import { AIMusicTrack, SportsMusicStyle } from '../types';
import { audioBufferToWav, getAudioContext } from './audio';

export interface SportsMusicPlan {
  title: string;
  style: SportsMusicStyle;
  bpm: number;
  rootKey: string;
  chords: string[];
  scale: number[]; // semitone intervals from root
  melodyNotes: number[]; // indices into scale
  rhythmDensity: 'standard' | 'double_time' | 'half_time_heavy';
  distortionLevel: number; // 0 to 1
  brassLevel: number;
  synthLevel: number;
  energyLevel: 'high' | 'peak' | 'epic';
}

export const SPORTS_MUSIC_STYLES: {
  id: SportsMusicStyle;
  name: string;
  description: string;
  defaultBpm: number;
  icon: string;
  accentColor: string;
}[] = [
  {
    id: 'arena-rock',
    name: 'Arena Stadium Rock',
    description: 'Heavy distorted guitar power chords & driving 4/4 hockey stadium drums',
    defaultBpm: 132,
    icon: '🎸',
    accentColor: 'text-amber-400 border-amber-500/40 bg-amber-950/40',
  },
  {
    id: 'electronic-rush',
    name: 'Electronic Rush',
    description: '130 BPM pulsing synthwave arpeggios, sidechain bass & four-on-the-floor energy',
    defaultBpm: 130,
    icon: '⚡',
    accentColor: 'text-sky-400 border-sky-500/40 bg-sky-950/40',
  },
  {
    id: 'hype-trap',
    name: 'Hype Sports Trap',
    description: '808 sub-bass glides, fast rolling hi-hats & punchy highlight montage beats',
    defaultBpm: 140,
    icon: '🔥',
    accentColor: 'text-orange-400 border-orange-500/40 bg-orange-950/40',
  },
  {
    id: 'cinematic-brass',
    name: 'Cinematic Stomp & Brass',
    description: 'Epic brass fanfares, marching taiko stadium percussion & playoff intensity',
    defaultBpm: 124,
    icon: '🎺',
    accentColor: 'text-red-400 border-red-500/40 bg-red-950/40',
  },
  {
    id: 'stadium-90s',
    name: '90s Jock Anthem',
    description: 'Classic hockey organ stabs, fast breakbeats & upbeat arena pump-up nostalgia',
    defaultBpm: 136,
    icon: '🏒',
    accentColor: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40',
  },
];

// Note frequencies map (Hz)
const NOTE_FREQS: Record<string, number> = {
  C2: 65.41,
  D2: 73.42,
  E2: 82.41,
  F2: 87.31,
  G2: 98.0,
  A2: 110.0,
  B2: 123.47,
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  F3: 174.61,
  G3: 196.0,
  A3: 220.0,
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

// Procedural fallback plans for instant generation without network lag
export function getPresetPlan(style: SportsMusicStyle, customPrompt?: string): SportsMusicPlan {
  switch (style) {
    case 'arena-rock':
      return {
        title: customPrompt ? `Rock: ${customPrompt.slice(0, 24)}` : 'Overtime Powerplay Rock',
        style: 'arena-rock',
        bpm: 132,
        rootKey: 'E2',
        chords: ['E2', 'G2', 'A2', 'C3'],
        scale: [0, 3, 5, 7, 10, 12, 15, 17], // Minor Pentatonic
        melodyNotes: [0, 3, 5, 7, 5, 7, 10, 12, 10, 7, 5, 3],
        rhythmDensity: 'standard',
        distortionLevel: 0.75,
        brassLevel: 0.2,
        synthLevel: 0.3,
        energyLevel: 'peak',
      };
    case 'electronic-rush':
      return {
        title: customPrompt ? `Electro: ${customPrompt.slice(0, 24)}` : 'Breakaway Neon Rush',
        style: 'electronic-rush',
        bpm: 130,
        rootKey: 'A2',
        chords: ['A2', 'F2', 'C3', 'G2'],
        scale: [0, 2, 3, 5, 7, 8, 10, 12], // Natural Minor
        melodyNotes: [0, 7, 10, 12, 10, 7, 8, 7, 5, 7, 3, 2],
        rhythmDensity: 'double_time',
        distortionLevel: 0.25,
        brassLevel: 0.1,
        synthLevel: 0.85,
        energyLevel: 'high',
      };
    case 'hype-trap':
      return {
        title: customPrompt ? `Trap: ${customPrompt.slice(0, 24)}` : '808 Slapshot Montage',
        style: 'hype-trap',
        bpm: 140,
        rootKey: 'D2',
        chords: ['D2', 'A2', 'Bb2', 'G2'],
        scale: [0, 1, 5, 7, 8, 12], // Phrygian / Trap minor
        melodyNotes: [0, 0, 7, 8, 7, 5, 1, 0, 5, 7, 8, 12],
        rhythmDensity: 'half_time_heavy',
        distortionLevel: 0.45,
        brassLevel: 0.65,
        synthLevel: 0.5,
        energyLevel: 'peak',
      };
    case 'cinematic-brass':
      return {
        title: customPrompt ? `Brass: ${customPrompt.slice(0, 24)}` : 'Stanley Cup Glory March',
        style: 'cinematic-brass',
        bpm: 124,
        rootKey: 'C2',
        chords: ['C2', 'G2', 'A2', 'F2'],
        scale: [0, 2, 4, 7, 9, 12, 14, 16], // Major Fanfare
        melodyNotes: [0, 4, 7, 12, 14, 12, 7, 9, 7, 4, 2, 0],
        rhythmDensity: 'standard',
        distortionLevel: 0.15,
        brassLevel: 0.9,
        synthLevel: 0.15,
        energyLevel: 'epic',
      };
    case 'stadium-90s':
    default:
      return {
        title: customPrompt ? `Stadium: ${customPrompt.slice(0, 24)}` : 'Rink Organ Pump-Up',
        style: 'stadium-90s',
        bpm: 136,
        rootKey: 'G2',
        chords: ['G2', 'C3', 'D3', 'C3'],
        scale: [0, 2, 4, 5, 7, 9, 11, 12], // Mixolydian / Major
        melodyNotes: [0, 4, 7, 12, 7, 4, 5, 7, 12, 11, 9, 7],
        rhythmDensity: 'double_time',
        distortionLevel: 0.35,
        brassLevel: 0.5,
        synthLevel: 0.7,
        energyLevel: 'high',
      };
  }
}

// Generate distortion curve for overdrive guitars / aggressive sports synths
function makeDistortionCurve(amount = 20): Float32Array {
  const k = typeof amount === 'number' ? amount : 20;
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
 * Matches the exact requested sequence duration.
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
  masterGain.gain.linearRampToValueAtTime(0.88, 0.12);
  const fadeOutStart = Math.max(0.15, safeDuration - 0.4);
  masterGain.gain.setValueAtTime(0.88, fadeOutStart);
  masterGain.gain.linearRampToValueAtTime(0.001, safeDuration);

  masterGain.connect(offlineCtx.destination);

  // Mixer sub-busses
  const drumBus = offlineCtx.createGain();
  drumBus.gain.value = 1.0;
  drumBus.connect(masterGain);

  const bassBus = offlineCtx.createGain();
  bassBus.gain.value = 0.85;
  bassBus.connect(masterGain);

  const musicBus = offlineCtx.createGain();
  musicBus.gain.value = 0.8;
  musicBus.connect(masterGain);

  // Distortion node for rock guitar & aggressive synths
  const waveshaper = offlineCtx.createWaveShaper();
  waveshaper.curve = makeDistortionCurve(Math.round(plan.distortionLevel * 50));
  waveshaper.oversample = '4x';

  const guitarFilter = offlineCtx.createBiquadFilter();
  guitarFilter.type = 'lowpass';
  guitarFilter.frequency.value = 2400;

  waveshaper.connect(guitarFilter);
  guitarFilter.connect(musicBus);

  // Timing math
  const beatDuration = 60 / plan.bpm; // e.g. ~0.45s per beat
  const barDuration = beatDuration * 4; // 4 beats per bar
  const sixteenth = beatDuration / 4;

  const totalBeats = Math.ceil(safeDuration / beatDuration);

  // 1. ==================== DRUMS & RHYTHM SECTION ====================
  // Synthesize kicks, snares, and hi-hats over the timeline
  for (let beat = 0; beat < totalBeats; beat++) {
    const beatTime = beat * beatDuration;
    if (beatTime >= safeDuration - 0.05) break;

    const beatInBar = beat % 4;
    const isFirstBeatOfBar = beatInBar === 0;

    // --- KICK DRUM ---
    const isKick =
      plan.rhythmDensity === 'half_time_heavy'
        ? beatInBar === 0 || (beatInBar === 2 && beat % 8 === 2)
        : beatInBar === 0 || beatInBar === 2 || (beatInBar === 1 && beat % 8 === 5);

    if (isKick) {
      const osc = offlineCtx.createOscillator();
      const kickGain = offlineCtx.createGain();
      osc.type = 'sine';

      // Pitch drop: punchy high click down to deep sub bass
      const startPitch = plan.style === 'hype-trap' ? 140 : 160;
      const endPitch = plan.style === 'hype-trap' ? 38 : 48;
      const kickLen = plan.style === 'hype-trap' ? 0.38 : 0.24;

      osc.frequency.setValueAtTime(startPitch, beatTime);
      osc.frequency.exponentialRampToValueAtTime(endPitch, beatTime + 0.08);

      kickGain.gain.setValueAtTime(1.1, beatTime);
      kickGain.gain.exponentialRampToValueAtTime(0.001, beatTime + kickLen);

      osc.connect(kickGain);
      kickGain.connect(drumBus);

      osc.start(beatTime);
      osc.stop(beatTime + kickLen);
    }

    // --- SNARE / CLAP ---
    const isSnare =
      plan.rhythmDensity === 'half_time_heavy'
        ? beatInBar === 2 // Half-time trap snare on beat 3 (0-indexed: 2)
        : beatInBar === 1 || beatInBar === 3; // Standard backbeat on 2 & 4

    if (isSnare) {
      // Snare tonal body
      const snareOsc = offlineCtx.createOscillator();
      const snareToneGain = offlineCtx.createGain();
      snareOsc.type = 'triangle';
      snareOsc.frequency.setValueAtTime(190, beatTime);
      snareOsc.frequency.exponentialRampToValueAtTime(80, beatTime + 0.06);

      snareToneGain.gain.setValueAtTime(0.7, beatTime);
      snareToneGain.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.14);

      snareOsc.connect(snareToneGain);
      snareToneGain.connect(drumBus);
      snareOsc.start(beatTime);
      snareOsc.stop(beatTime + 0.15);

      // Snare crisp noise crack
      const noiseDur = 0.22;
      const noiseBuf = offlineCtx.createBuffer(1, Math.floor(sampleRate * noiseDur), sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noiseSrc = offlineCtx.createBufferSource();
      noiseSrc.buffer = noiseBuf;

      const noiseFilter = offlineCtx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.value = 1200;

      const noiseGain = offlineCtx.createGain();
      noiseGain.gain.setValueAtTime(0.85, beatTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, beatTime + noiseDur);

      noiseSrc.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(drumBus);

      noiseSrc.start(beatTime);
      noiseSrc.stop(beatTime + noiseDur);
    }

    // --- HI-HATS (8th & 16th notes) ---
    const hatSubdivisions = plan.rhythmDensity === 'double_time' ? 4 : 2;
    for (let sub = 0; sub < hatSubdivisions; sub++) {
      const hatTime = beatTime + sub * (beatDuration / hatSubdivisions);
      if (hatTime >= safeDuration - 0.02) break;

      const hatDur = sub === 1 && hatSubdivisions === 2 ? 0.08 : 0.04;
      const hatBuf = offlineCtx.createBuffer(1, Math.floor(sampleRate * hatDur), sampleRate);
      const hData = hatBuf.getChannelData(0);
      for (let i = 0; i < hData.length; i++) {
        hData[i] = Math.random() * 2 - 1;
      }
      const hatSrc = offlineCtx.createBufferSource();
      hatSrc.buffer = hatBuf;

      const hatFilter = offlineCtx.createBiquadFilter();
      hatFilter.type = 'highpass';
      hatFilter.frequency.value = 7500;

      const hatGain = offlineCtx.createGain();
      const velocity = sub === 0 ? 0.45 : 0.25;
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
      const crashDur = 1.4;
      const crashBuf = offlineCtx.createBuffer(1, Math.floor(sampleRate * crashDur), sampleRate);
      const cData = crashBuf.getChannelData(0);
      for (let i = 0; i < cData.length; i++) {
        cData[i] = Math.random() * 2 - 1;
      }
      const crashSrc = offlineCtx.createBufferSource();
      crashSrc.buffer = crashBuf;

      const crashFilter = offlineCtx.createBiquadFilter();
      crashFilter.type = 'bandpass';
      crashFilter.frequency.value = 4800;
      crashFilter.Q.value = 0.8;

      const crashGain = offlineCtx.createGain();
      crashGain.gain.setValueAtTime(0.55, beatTime);
      crashGain.gain.exponentialRampToValueAtTime(0.001, beatTime + crashDur);

      crashSrc.connect(crashFilter);
      crashFilter.connect(crashGain);
      crashGain.connect(drumBus);

      crashSrc.start(beatTime);
      crashSrc.stop(beatTime + crashDur);
    }
  }

  // 2. ==================== BASSLINE (Pumping, Overdriven, or 808) ====================
  const baseFreq = NOTE_FREQS[plan.rootKey] || 82.41;
  const numBars = Math.ceil(safeDuration / barDuration);

  for (let bar = 0; bar < numBars; bar++) {
    const barStart = bar * barDuration;
    if (barStart >= safeDuration) break;

    // Pick chord base for this bar
    const chordIndex = bar % plan.chords.length;
    const chordKey = plan.chords[chordIndex];
    const chordBaseFreq = NOTE_FREQS[chordKey] || baseFreq;

    // 8th note rhythm for bass
    const bassSteps = 8;
    for (let s = 0; s < bassSteps; s++) {
      const stepTime = barStart + s * (beatDuration / 2);
      if (stepTime >= safeDuration - 0.05) break;

      // Note selection (root, fifth, octave, minor third)
      let freq = chordBaseFreq;
      if (s === 2 || s === 6) freq = chordBaseFreq * 1.5; // fifth
      if (s === 3 || s === 7) freq = chordBaseFreq * 1.2; // minor third / syncopation

      const bassOsc = offlineCtx.createOscillator();
      const bassGain = offlineCtx.createGain();

      bassOsc.type = plan.style === 'arena-rock' ? 'sawtooth' : 'sawtooth';
      bassOsc.frequency.setValueAtTime(freq, stepTime);

      const bassLen = beatDuration * 0.45;
      bassGain.gain.setValueAtTime(0.65, stepTime);
      bassGain.gain.exponentialRampToValueAtTime(0.001, stepTime + bassLen);

      const bassFilter = offlineCtx.createBiquadFilter();
      bassFilter.type = 'lowpass';
      bassFilter.frequency.setValueAtTime(550, stepTime);
      bassFilter.frequency.linearRampToValueAtTime(250, stepTime + bassLen);

      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(bassBus);

      bassOsc.start(stepTime);
      bassOsc.stop(stepTime + bassLen);
    }
  }

  // 3. ==================== CHORD RIFFS & GUITAR POWER CHORDS ====================
  for (let bar = 0; bar < numBars; bar++) {
    const barStart = bar * barDuration;
    if (barStart >= safeDuration) break;

    const chordKey = plan.chords[bar % plan.chords.length];
    const chordFreq = NOTE_FREQS[chordKey] || baseFreq;

    // Root + 5th + Octave = Power Chord!
    const chordPitches = [chordFreq * 2, chordFreq * 3, chordFreq * 4];

    // Rhythmic guitar chug pattern (driving 8ths with accents)
    const chugPattern = [1, 0, 1, 1, 0, 1, 1, 0]; // 8th note syncopation
    for (let i = 0; i < chugPattern.length; i++) {
      if (chugPattern[i] === 0) continue;
      const chordTime = barStart + i * (beatDuration / 2);
      if (chordTime >= safeDuration - 0.05) break;

      const chordLen = beatDuration * 0.42;

      chordPitches.forEach((pitch) => {
        const osc = offlineCtx.createOscillator();
        const gGain = offlineCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(pitch, chordTime);

        gGain.gain.setValueAtTime(0.2, chordTime);
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

  // 4. ==================== LEAD THEME / BRASS FANFARE ====================
  // Plays an upbeat, energetic hook every 2 bars
  const leadOctave = baseFreq * 4;
  const melodyPattern = plan.melodyNotes;
  let melodyIdx = 0;

  for (let beat = 0; beat < totalBeats; beat += 0.5) {
    const leadTime = beat * beatDuration;
    if (leadTime >= safeDuration - 0.1) break;

    // Play melody on selected upbeat syncopations
    const beatFract = beat % 2;
    if (beatFract === 0 || beatFract === 0.5 || beatFract === 1.5) {
      const scaleStep = melodyPattern[melodyIdx % melodyPattern.length];
      melodyIdx++;

      // Frequency calculation: root * 2^(semitones / 12)
      const leadPitch = leadOctave * Math.pow(2, scaleStep / 12);
      const leadLen = beatDuration * 0.45;

      const leadOsc1 = offlineCtx.createOscillator();
      const leadOsc2 = offlineCtx.createOscillator();
      const leadGain = offlineCtx.createGain();

      // Dual detuned oscillators for wide, anthemic stadium presence
      leadOsc1.type = plan.brassLevel > 0.5 ? 'sawtooth' : 'square';
      leadOsc2.type = 'sawtooth';

      leadOsc1.frequency.setValueAtTime(leadPitch, leadTime);
      leadOsc2.frequency.setValueAtTime(leadPitch * 1.004, leadTime); // slight detune

      const leadFilter = offlineCtx.createBiquadFilter();
      leadFilter.type = 'lowpass';
      const cutoff = plan.brassLevel > 0.5 ? 3200 : 2500;
      leadFilter.frequency.setValueAtTime(cutoff, leadTime);
      leadFilter.frequency.exponentialRampToValueAtTime(800, leadTime + leadLen);

      leadGain.gain.setValueAtTime(0.22, leadTime);
      leadGain.gain.exponentialRampToValueAtTime(0.001, leadTime + leadLen);

      leadOsc1.connect(leadFilter);
      leadOsc2.connect(leadFilter);
      leadFilter.connect(leadGain);
      leadGain.connect(musicBus);

      leadOsc1.start(leadTime);
      leadOsc2.start(leadTime);
      leadOsc1.stop(leadTime + leadLen);
      leadOsc2.stop(leadTime + leadLen);
    }
  }

  // 5. ==================== FINAL CRASH & POWER RESOLUTION ====================
  // Clean final power chord resolution right at the end of the video
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
 * Generate a complete AIMusicTrack object with AudioBuffer and WAV Blob.
 */
export async function generateAIMusicTrack(
  style: SportsMusicStyle,
  targetDuration: number,
  customPrompt?: string,
): Promise<AIMusicTrack> {
  let plan = getPresetPlan(style, customPrompt);

  // Attempt server-side Gemini generation for custom AI variations if available
  try {
    const response = await fetch('/api/generate-sports-music-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: customPrompt || `Upbeat energetic sports music for hockey highlights in ${style} style`,
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
        };
      }
    }
  } catch (err) {
    // Graceful fallback to procedural plan
    console.info('Using high-performance local AI music blueprint (server offline or skipped)');
  }

  const audioBuffer = await renderSportsMusicAudio(plan, targetDuration);
  const audioBlob = audioBufferToWav(audioBuffer);
  const audioUrl = URL.createObjectURL(audioBlob);

  const track: AIMusicTrack = {
    id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    title: plan.title,
    style,
    prompt: customPrompt,
    bpm: plan.bpm,
    duration: targetDuration,
    audioBuffer,
    audioBlob,
    audioUrl,
    generatedAt: Date.now(),
    energyLevel: plan.energyLevel,
  };

  return track;
}
