// Web Audio API synthesizer for Hockey Arena sounds: Goal Horn, Arena Buzzer, Skate Swoosh, Crowd Roar

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Authentic NHL stadium goal horn simulation (dual-tone brass horn with harmonics and reverb)
 */
export function playGoalHorn(durationSeconds = 3.5, destination?: AudioNode) {
  try {
    const ctx = getAudioContext();
    const dest = destination || ctx.destination;
    const now = ctx.currentTime;

    // Dual horn tones: ~220Hz (A3) and ~277.18Hz (C#4), plus octave ~110Hz (A2)
    const freqs = [110, 220, 222, 277.2, 279, 440];
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);

    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(0.35, now + 0.08); // Quick attack
    gainNode.gain.setValueAtTime(0.35, now + durationSeconds - 0.4);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + durationSeconds); // Decay

    freqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(filter);
      osc.start(now);
      osc.stop(now + durationSeconds);
    });

    filter.connect(gainNode);
    gainNode.connect(dest);

    // Add crowd cheer underneath
    playCrowdRoar(durationSeconds, dest);
  } catch (err) {
    console.warn('Audio playback not permitted yet or failed:', err);
  }
}

/**
 * Crowd cheering roar using band-pass filtered white/pink noise
 */
export function playCrowdRoar(durationSeconds = 4.0, destination?: AudioNode) {
  try {
    const ctx = getAudioContext();
    const dest = destination || ctx.destination;
    const now = ctx.currentTime;

    // Create noise buffer
    const bufferSize = ctx.sampleRate * durationSeconds;
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
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(0.2, now + 0.4);
    gainNode.gain.setValueAtTime(0.2, now + durationSeconds - 0.8);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + durationSeconds);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(dest);

    noise.start(now);
    noise.stop(now + durationSeconds);
  } catch (err) {
    console.warn('Crowd roar failed:', err);
  }
}

/**
 * Arena buzzer / game clock horn
 */
export function playArenaBuzzer(durationSeconds = 1.2, destination?: AudioNode) {
  try {
    const ctx = getAudioContext();
    const dest = destination || ctx.destination;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(130, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.03);
    gain.gain.setValueAtTime(0.3, now + durationSeconds - 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSeconds);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + durationSeconds);
  } catch (err) {
    console.warn('Arena buzzer failed:', err);
  }
}

/**
 * Transition swoosh sound effect (ice skate slice sound)
 */
export function playTransitionWhoosh(destination?: AudioNode) {
  try {
    const ctx = getAudioContext();
    const dest = destination || ctx.destination;
    const now = ctx.currentTime;
    const duration = 0.4;

    const bufferSize = ctx.sampleRate * duration;
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
    filter.frequency.exponentialRampToValueAtTime(400, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    noise.start(now);
    noise.stop(now + duration);
  } catch (err) {
    // Ignore silent failure
  }
}
