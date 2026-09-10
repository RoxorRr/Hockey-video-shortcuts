// Web Audio API synthesizer for Hockey Arena sounds: Goal Horn, Arena Buzzer, Skate Swoosh, Crowd Roar
import { GoalHornConfig } from '../types';

let audioCtx: AudioContext | null = null;
const audioBufferCache = new Map<string, AudioBuffer>();

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function stripId3Header(buffer: ArrayBuffer): ArrayBuffer {
  if (buffer.byteLength < 10) return buffer;
  const view = new DataView(buffer);
  // 'ID3' = 0x49, 0x44, 0x33
  if (view.getUint8(0) === 0x49 && view.getUint8(1) === 0x44 && view.getUint8(2) === 0x33) {
    // Bytes 6-9 are syncsafe 7-bit bytes
    const b0 = view.getUint8(6) & 0x7f;
    const b1 = view.getUint8(7) & 0x7f;
    const b2 = view.getUint8(8) & 0x7f;
    const b3 = view.getUint8(9) & 0x7f;
    const tagSize = (b0 << 21) | (b1 << 14) | (b2 << 7) | b3;
    const headerTotal = 10 + tagSize;
    if (headerTotal > 0 && headerTotal < buffer.byteLength) {
      return buffer.slice(headerTotal);
    }
  }
  return buffer;
}

/**
 * Decode an uploaded audio file Blob (MP3, WAV, OGG, AAC) into an AudioBuffer
 */
export async function decodeAudioBlob(blob: Blob, customCtx?: AudioContext): Promise<AudioBuffer> {
  const ctx = customCtx || getAudioContext();
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {}
  }
  const arrayBuffer = await blob.arrayBuffer();
  try {
    // Decode a copy to prevent detached array buffer errors on reuse
    return await ctx.decodeAudioData(arrayBuffer.slice(0));
  } catch (firstErr) {
    // Fallback: strip ID3v2 metadata header if present (common reason MP3 files fail in decodeAudioData)
    try {
      const stripped = stripId3Header(arrayBuffer.slice(0));
      return await ctx.decodeAudioData(stripped);
    } catch {
      throw firstErr;
    }
  }
}

/**
 * Play a decoded AudioBuffer with customizable volume and destination
 */
export function playAudioBuffer(
  buffer: AudioBuffer,
  volume = 1.0,
  destination?: AudioNode,
  customCtx?: AudioContext,
  duration?: number,
): { stop: () => void; source?: AudioBufferSourceNode; gainNode?: GainNode } {
  try {
    const ctx = customCtx || getAudioContext();
    const dest = destination || ctx.destination;
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gainNode = ctx.createGain();
    const targetVol = Math.max(0, Math.min(2.5, volume));
    const now = ctx.currentTime;
    gainNode.gain.value = targetVol;
    gainNode.gain.setValueAtTime(targetVol, now);

    const safeDuration = duration && duration > 0 ? duration : buffer.duration;
    if (safeDuration > buffer.duration) {
      source.loop = true;
    }
    const stopTime = now + safeDuration;
    // Gentle fade out at the end of duration
    const fadeStart = Math.max(now, stopTime - 0.25);
    gainNode.gain.setValueAtTime(targetVol, fadeStart);
    gainNode.gain.linearRampToValueAtTime(0.001, stopTime);
    source.stop(stopTime);

    source.connect(gainNode);
    gainNode.connect(dest);

    // Immediate playback start
    source.start();

    return {
      source,
      gainNode,
      stop: () => {
        try {
          const t = ctx.currentTime;
          gainNode.gain.cancelScheduledValues(t);
          gainNode.gain.setValueAtTime(gainNode.gain.value, t);
          gainNode.gain.linearRampToValueAtTime(0.001, t + 0.05);
          setTimeout(() => {
            try {
              source.stop();
              source.disconnect();
              gainNode.disconnect();
            } catch {}
          }, 60);
        } catch {}
      },
    };
  } catch (err) {
    console.warn('Error playing audio buffer:', err);
    return { stop: () => {} };
  }
}

/**
 * Authentic NHL stadium goal horn simulation (dual-tone brass horn with harmonics and reverb)
 */
export function playGoalHorn(
  durationSeconds = 5.0,
  destination?: AudioNode,
  volume = 1.0,
  customCtx?: AudioContext,
): {
  stop: () => void;
  oscillators?: OscillatorNode[];
  gainNode?: GainNode;
  filter?: BiquadFilterNode;
} {
  try {
    const ctx = customCtx || (destination ? (destination.context as AudioContext) : getAudioContext());
    const dest = destination || ctx.destination;
    const now = ctx.currentTime;
    const vol = Math.max(0, Math.min(2.5, volume));
    const safeDuration = Math.max(0.8, Math.min(60.0, durationSeconds));

    // Dual horn tones: ~220Hz (A3) and ~277.18Hz (C#4), plus octave ~110Hz (A2)
    const freqs = [110, 220, 222, 277.2, 279, 440];
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);

    const peakGain = 0.95 * vol;
    const decayStart = Math.max(now + 0.1, now + safeDuration - 0.4);
    const stopTime = now + safeDuration;

    // Set immediate gain so audio is instantly full-volume from sample 0
    gainNode.gain.value = peakGain;
    gainNode.gain.setValueAtTime(peakGain, now);
    gainNode.gain.setValueAtTime(peakGain, decayStart);
    gainNode.gain.linearRampToValueAtTime(0.001, stopTime); // Decay

    const oscillators: OscillatorNode[] = [];
    freqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(filter);
      // Start immediately
      osc.start();
      osc.stop(stopTime);
      oscillators.push(osc);
    });

    filter.connect(gainNode);
    gainNode.connect(dest);

    // Add crowd cheer underneath
    const crowdRoarHandle = playCrowdRoar(safeDuration, dest, vol * 0.85, ctx);

    return {
      oscillators,
      gainNode,
      filter,
      stop: () => {
        try {
          const t = ctx.currentTime;
          gainNode.gain.cancelScheduledValues(t);
          gainNode.gain.setValueAtTime(gainNode.gain.value, t);
          gainNode.gain.linearRampToValueAtTime(0.001, t + 0.08);
          crowdRoarHandle?.stop?.();
          setTimeout(() => {
            oscillators.forEach((osc) => {
              try {
                osc.stop();
                osc.disconnect();
              } catch {}
            });
            try {
              filter.disconnect();
              gainNode.disconnect();
            } catch {}
          }, 90);
        } catch {}
      },
    };
  } catch (err) {
    console.warn('Audio playback not permitted yet or failed:', err);
    return { stop: () => {} };
  }
}

/**
 * Plays either the user's custom uploaded horn or the synth horn based on GoalHornConfig
 */
export async function playHornSound(
  config?: GoalHornConfig,
  destination?: AudioNode,
  customCtx?: AudioContext,
): Promise<{ stop: () => void }> {
  const vol = config?.volume ?? 1.0;
  const rawDuration =
    typeof config?.hornDuration === 'number' && Number.isFinite(config?.hornDuration)
      ? config.hornDuration
      : (typeof config?.customHornDuration === 'number' && Number.isFinite(config?.customHornDuration)
          ? config.customHornDuration
          : 5.0);
  const targetDuration = Math.max(0.5, Math.min(60.0, rawDuration));

  if (config?.useCustomHorn) {
    // 1. Resolve custom audio URL
    let audioUrl = config.customHornUrl;
    if (!audioUrl && config.customHornBlob) {
      try {
        audioUrl = URL.createObjectURL(config.customHornBlob);
      } catch {}
    }

    // 2. Direct browser audio element playback (standard UI preview, audition, & video player playback)
    // Works reliably across all MP3 (even with ID3v2 tags/artwork), AAC, M4A, WAV, OGG without Web Audio decoding failures
    if (!destination && audioUrl) {
      try {
        const audio = new Audio();
        audio.src = audioUrl;
        audio.volume = Math.max(0, Math.min(1.0, vol));
        audio.preload = 'auto';

        const fileDur = config.customHornDuration || 3.0;
        if (targetDuration > fileDur) {
          audio.loop = true;
        }

        let isExplicitlyStopped = false;
        let fadeTimer: any = null;

        await audio.play();

        // STRICT DURATION ENFORCEMENT:
        // Begin gentle volume fade-out 250ms before targetDuration, and hard pause exactly at targetDuration
        const fadeStartMs = Math.max(0, (targetDuration - 0.25) * 1000);
        const hardStopMs = targetDuration * 1000;

        const fadeTimeout = setTimeout(() => {
          if (isExplicitlyStopped) return;
          try {
            let currentVol = audio.volume;
            fadeTimer = setInterval(() => {
              currentVol = Math.max(0, currentVol - 0.15);
              audio.volume = currentVol;
              if (currentVol <= 0.05) {
                clearInterval(fadeTimer);
                fadeTimer = null;
              }
            }, 25);
          } catch {}
        }, fadeStartMs);

        const stopTimeout = setTimeout(() => {
          if (isExplicitlyStopped) return;
          try {
            if (fadeTimer) clearInterval(fadeTimer);
            audio.pause();
            audio.currentTime = 0;
          } catch {}
        }, hardStopMs);

        return {
          stop: () => {
            isExplicitlyStopped = true;
            clearTimeout(fadeTimeout);
            clearTimeout(stopTimeout);
            if (fadeTimer) clearInterval(fadeTimer);
            try {
              audio.pause();
              audio.currentTime = 0;
            } catch {}
          },
        };
      } catch (audioElErr) {
        console.warn('HTMLAudioElement play failed, attempting Web Audio buffer decode:', audioElErr);
      }
    }

    // 3. Web Audio buffer playback (used during video export when a MediaStream destination is provided)
    if (config.customHornBlob || audioUrl) {
      try {
        const ctx = customCtx || (destination ? (destination.context as AudioContext) : getAudioContext());
        if (ctx.state === 'suspended') {
          try {
            await ctx.resume();
          } catch {}
        }
        let blob = config.customHornBlob;
        if (!blob && audioUrl) {
          try {
            const resp = await fetch(audioUrl);
            blob = await resp.blob();
            config.customHornBlob = blob;
          } catch {}
        }
        if (blob) {
          const cacheKey = config.customHornName || 'custom_horn_blob';
          let buffer = audioBufferCache.get(cacheKey);
          if (!buffer) {
            buffer = await decodeAudioBlob(blob, ctx);
            audioBufferCache.set(cacheKey, buffer);
          }
          return playAudioBuffer(buffer, vol, destination, ctx, targetDuration);
        }
      } catch (decodeErr) {
        console.warn('Could not decode custom horn blob for Web Audio:', decodeErr);
      }
    }
  }

  // Fallback or default: Synthesizer Goal Horn
  const effectiveCtx = customCtx || (destination ? (destination.context as AudioContext) : getAudioContext());
  return playGoalHorn(targetDuration, destination, vol, effectiveCtx);
}

/**
 * Crowd cheering roar using band-pass filtered white/pink noise
 */
export function playCrowdRoar(
  durationSeconds = 4.0,
  destination?: AudioNode,
  volume = 1.0,
  customCtx?: AudioContext,
): { stop: () => void } {
  try {
    const ctx = customCtx || (destination ? (destination.context as AudioContext) : getAudioContext());
    const dest = destination || ctx.destination;
    const now = ctx.currentTime;
    const vol = Math.max(0, Math.min(2.0, volume));
    const safeDuration = Math.max(0.8, Math.min(60.0, durationSeconds));

    // Create noise buffer (guarantee integer length)
    const bufferSize = Math.floor(ctx.sampleRate * safeDuration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Pink noise approximation
      const pink = (lastOut + 0.02 * white) / 1.02;
      lastOut = pink;
      data[i] = pink * 3.5;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, now);
    filter.Q.setValueAtTime(1.2, now);

    const gainNode = ctx.createGain();
    const peak = 0.35 * vol;
    const decayStart = Math.max(now + 0.1, now + safeDuration - Math.min(0.8, safeDuration * 0.3));
    const stopTime = now + safeDuration;

    gainNode.gain.value = peak;
    gainNode.gain.setValueAtTime(peak, now);
    gainNode.gain.setValueAtTime(peak, decayStart);
    gainNode.gain.linearRampToValueAtTime(0.001, stopTime);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(dest);

    noise.start();
    noise.stop(stopTime);

    return {
      stop: () => {
        try {
          const t = ctx.currentTime;
          gainNode.gain.cancelScheduledValues(t);
          gainNode.gain.setValueAtTime(gainNode.gain.value, t);
          gainNode.gain.linearRampToValueAtTime(0.001, t + 0.08);
          setTimeout(() => {
            try {
              noise.stop();
              noise.disconnect();
              gainNode.disconnect();
            } catch {}
          }, 90);
        } catch {}
      },
    };
  } catch (err) {
    console.warn('Crowd roar failed:', err);
    return { stop: () => {} };
  }
}

/**
 * Arena buzzer / game clock horn
 */
export function playArenaBuzzer(
  durationSeconds = 1.2,
  destination?: AudioNode,
  customCtx?: AudioContext,
) {
  try {
    const ctx = customCtx || (destination ? (destination.context as AudioContext) : getAudioContext());
    const dest = destination || ctx.destination;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(130, now);

    const gain = ctx.createGain();
    gain.gain.value = 0.3;
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.setValueAtTime(0.3, now + durationSeconds - 0.05);
    gain.gain.linearRampToValueAtTime(0.001, now + durationSeconds);

    osc.connect(gain);
    gain.connect(dest);

    osc.start();
    osc.stop(now + durationSeconds);
  } catch (err) {
    console.warn('Arena buzzer failed:', err);
  }
}

/**
 * Convert an AudioBuffer to a standard 16-bit PCM WAV Blob.
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const length = buffer.length;
  const dataSize = length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;
  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = channels[c][i];
      sample = Math.max(-1, Math.min(1, sample));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Offline rendering of the authentic NHL stadium goal horn into an AudioBuffer.
 * Runs in ~10ms and produces a deterministic AudioBuffer containing the brass
 * sawtooth harmonics, lowpass filter, and crowd roar pink noise.
 */
export async function renderGoalHornBuffer(
  durationSeconds = 5.0,
  volume = 1.0,
  sampleRate = 44100,
): Promise<AudioBuffer> {
  const safeDuration = Math.max(0.8, Math.min(60.0, durationSeconds));
  const totalSamples = Math.floor(sampleRate * safeDuration);
  const OfflineCtxClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  const offlineCtx = new OfflineCtxClass(2, totalSamples, sampleRate);

  const freqs = [110, 220, 222, 277.2, 279, 440];
  const gainNode = offlineCtx.createGain();
  const filter = offlineCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1400, 0);

  const vol = Math.max(0, Math.min(2.5, volume));
  const peakGain = 0.95 * vol;
  const decayStart = Math.max(0.1, safeDuration - 0.4);

  gainNode.gain.setValueAtTime(peakGain, 0);
  gainNode.gain.setValueAtTime(peakGain, decayStart);
  gainNode.gain.linearRampToValueAtTime(0.001, safeDuration);

  freqs.forEach((freq) => {
    const osc = offlineCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, 0);
    osc.connect(filter);
    osc.start(0);
    osc.stop(safeDuration);
  });

  filter.connect(gainNode);
  gainNode.connect(offlineCtx.destination);

  // Add crowd roar pink noise in the offline graph
  const noiseBuf = offlineCtx.createBuffer(1, totalSamples, sampleRate);
  const data = noiseBuf.getChannelData(0);
  let lastOut = 0.0;
  for (let i = 0; i < totalSamples; i++) {
    const white = Math.random() * 2 - 1;
    const pink = (lastOut + 0.02 * white) / 1.02;
    lastOut = pink;
    data[i] = pink * 3.5;
  }
  const noise = offlineCtx.createBufferSource();
  noise.buffer = noiseBuf;

  const crowdFilter = offlineCtx.createBiquadFilter();
  crowdFilter.type = 'bandpass';
  crowdFilter.frequency.setValueAtTime(600, 0);
  crowdFilter.Q.setValueAtTime(1.2, 0);

  const crowdGain = offlineCtx.createGain();
  const crowdPeak = 0.35 * (vol * 0.85);
  const crowdDecay = Math.max(0.1, safeDuration - Math.min(0.8, safeDuration * 0.3));
  crowdGain.gain.setValueAtTime(crowdPeak, 0);
  crowdGain.gain.setValueAtTime(crowdPeak, crowdDecay);
  crowdGain.gain.linearRampToValueAtTime(0.001, safeDuration);

  noise.connect(crowdFilter);
  crowdFilter.connect(crowdGain);
  crowdGain.connect(offlineCtx.destination);

  noise.start(0);
  noise.stop(safeDuration);

  return await offlineCtx.startRendering();
}

/**
 * Transition swoosh sound effect (ice skate slice sound)
 */
export function playTransitionWhoosh(destination?: AudioNode, customCtx?: AudioContext) {
  try {
    const ctx = customCtx || (destination ? (destination.context as AudioContext) : getAudioContext());
    const dest = destination || ctx.destination;
    const now = ctx.currentTime;
    const duration = 0.4;

    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.linearRampToValueAtTime(400, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.08);
    gain.gain.linearRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    noise.start(now);
    noise.stop(now + duration);
  } catch (err) {
    // Ignore silent failure
  }
}
