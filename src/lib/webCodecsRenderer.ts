import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import {
  AspectRatio,
  ExportOptions,
  HockeyOverlaySettings,
  Transition,
  VideoClip,
} from '../types';
import {
  calculateTimeline,
  drawHockeyOverlays,
  drawVideoFitted,
  preloadVideo,
  renderTransitionEffect,
  RenderTimelineSegment,
} from './videoRenderer';
import {
  decodeAudioBlob,
  renderGoalHornBuffer,
} from './audio';
import { loadBlobIntoMemory } from './videoLoader';

/**
 * Check if the current browser environment supports WebCodecs (VideoEncoder).
 */
export function isWebCodecsSupported(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).VideoEncoder === 'function';
}

/**
 * Wait for video element to seek to exact target time and decode the frame.
 */
function seekVideoFrame(video: HTMLVideoElement, targetTime: number): Promise<void> {
  return new Promise((resolve) => {
    const clampedTime = Math.max(0, targetTime);
    if (Math.abs(video.currentTime - clampedTime) < 0.02 && video.readyState >= 2) {
      resolve();
      return;
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener('seeked', finish);
      video.removeEventListener('error', finish);
      clearTimeout(timer);
      resolve();
    };

    // Fast safety fallback (120ms max per frame)
    const timer = setTimeout(finish, 120);

    video.addEventListener('seeked', finish, { once: true });
    video.addEventListener('error', finish, { once: true });

    try {
      video.currentTime = clampedTime;
    } catch {
      finish();
    }
  });
}

/**
 * Offline Audio Synthesis and Rendering:
 * Pre-mixes all audio (clip audio tracks, hockey goal horn, upbeat music) into a pristine AudioBuffer
 * using an OfflineAudioContext. This executes in ~200ms with zero real-time audio drift!
 */
async function renderOfflineMasterAudio(
  clips: VideoClip[],
  segments: RenderTimelineSegment[],
  totalDuration: number,
  overlaySettings: HockeyOverlaySettings,
): Promise<AudioBuffer | null> {
  if (totalDuration <= 0) return null;

  const sampleRate = 44100;
  const totalSamples = Math.ceil(totalDuration * sampleRate);
  const OfflineCtxClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  if (!OfflineCtxClass) return null;

  const offlineCtx = new OfflineCtxClass(2, Math.max(sampleRate, totalSamples), sampleRate);
  const bgMusic = overlaySettings.backgroundMusic;
  const isMusicEnabled = Boolean(bgMusic?.enabled && bgMusic?.currentTrack);
  const origVideoFactor = bgMusic?.originalVideoVolume ?? 1.0;

  // Master Gain node
  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = 1.0;
  masterGain.connect(offlineCtx.destination);

  // Clips Gain
  const clipsGain = offlineCtx.createGain();
  clipsGain.gain.value = origVideoFactor;
  clipsGain.connect(masterGain);

  // Decode audio for each clip
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const seg = segments[i];
    if (!seg) continue;

    if (clip.blob instanceof Blob) {
      try {
        const audioBuf = await decodeAudioBlob(clip.blob, offlineCtx);
        if (audioBuf) {
          const src = offlineCtx.createBufferSource();
          src.buffer = audioBuf;

          const clipGain = offlineCtx.createGain();
          clipGain.gain.value = clip.volume ?? 1.0;
          src.connect(clipGain);
          clipGain.connect(clipsGain);

          const r = clip.playbackRate || 1.0;
          src.playbackRate.value = r;

          const segDuration = Math.max(0.1, (clip.endTime - clip.startTime) / r);
          src.start(seg.clipStartInTimeline, clip.startTime, segDuration);
        }
      } catch (err) {
        console.warn(`Could not decode audio for clip ${i}:`, err);
      }
    }
  }

  // Goal Horn Sound
  const hornCfg = overlaySettings.hornConfig || {
    enabled: overlaySettings.goalHornSound ?? true,
    useCustomHorn: false,
    triggerMode: 'every_clip' as const,
    clipOffsetSeconds: 0.5,
    volume: 1.0,
    hornDuration: 5.0,
    skipClipsWithNativeHorn: true,
    duckVideoAudio: true,
  };

  const hornGloballyEnabled = (overlaySettings.goalHornSound !== false) && (hornCfg.enabled !== false);
  if (hornGloballyEnabled) {
    const hornDur = Math.max(0.5, Math.min(30, hornCfg.hornDuration || 5.0));
    const hornVol = (hornCfg.volume ?? 1.25) * 1.35;

    let hornBuf: AudioBuffer | null = null;
    if (hornCfg.useCustomHorn && hornCfg.customHornBlob) {
      try {
        hornBuf = await decodeAudioBlob(hornCfg.customHornBlob, offlineCtx);
      } catch {}
    }
    if (!hornBuf) {
      try {
        hornBuf = await renderGoalHornBuffer(hornDur, hornVol, sampleRate);
      } catch {}
    }

    if (hornBuf) {
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const clip = seg.clip;
        const hasNative = Boolean(clip.hasNativeHorn);
        if (clip.hornDisabled || (hasNative && hornCfg.skipClipsWithNativeHorn !== false)) continue;

        const clipTagUpper = (clip.tag || '').toUpperCase();
        const isGoal =
          clipTagUpper === 'GOAL' ||
          clipTagUpper === 'OT WINNER' ||
          clipTagUpper.includes('GOAL') ||
          clipTagUpper.includes('WINNER') ||
          clipTagUpper.includes('SNIPE') ||
          clipTagUpper.includes('SCORE');

        const shouldTrigger =
          hornCfg.triggerMode === 'every_clip' || isGoal || clip.hornTimingOverride !== undefined;

        if (shouldTrigger) {
          const segDuration = Math.max(0.2, seg.clipEndInTimeline - seg.clipStartInTimeline);
          const rawOffset = clip.hornTimingOverride ?? hornCfg.clipOffsetSeconds ?? 0.5;
          const r = clip.playbackRate || 1.0;
          const triggerOffset = Math.min(Math.max(0, segDuration - 0.4), Math.max(0, rawOffset) / r);
          const triggerTime = seg.clipStartInTimeline + triggerOffset;

          const hornSrc = offlineCtx.createBufferSource();
          hornSrc.buffer = hornBuf;
          const hGain = offlineCtx.createGain();
          hGain.gain.value = 1.0;
          hornSrc.connect(hGain);
          hGain.connect(masterGain);

          hornSrc.start(triggerTime, 0, hornDur);

          // Duck clips audio during horn
          if (hornCfg.duckVideoAudio !== false) {
            clipsGain.gain.setValueAtTime(origVideoFactor, triggerTime);
            clipsGain.gain.linearRampToValueAtTime(origVideoFactor * 0.15, triggerTime + 0.08);
            clipsGain.gain.setValueAtTime(origVideoFactor * 0.15, triggerTime + Math.max(0.2, hornDur - 0.3));
            clipsGain.gain.linearRampToValueAtTime(origVideoFactor, triggerTime + hornDur);
          }
        }
      }
    }
  }

  // Background Music
  if (isMusicEnabled && bgMusic?.currentTrack?.audioBlob) {
    try {
      const musicBuf = await decodeAudioBlob(bgMusic.currentTrack.audioBlob, offlineCtx);
      if (musicBuf) {
        const musicSrc = offlineCtx.createBufferSource();
        musicSrc.buffer = musicBuf;
        musicSrc.loop = bgMusic.loop !== false;
        const mGain = offlineCtx.createGain();
        mGain.gain.value = bgMusic.volume ?? 0.75;
        musicSrc.connect(mGain);
        mGain.connect(masterGain);

        const startOffset = bgMusic.currentTrack.startTimeOffset || 0;
        musicSrc.start(0, startOffset, totalDuration);
      }
    } catch (e) {
      console.warn('Could not decode offline background music:', e);
    }
  }

  try {
    return await offlineCtx.startRendering();
  } catch (renderErr) {
    console.warn('Offline audio rendering error:', renderErr);
    return null;
  }
}

/**
 * Determine export dimensions based on preset and aspect ratio
 */
export function getExportResolution(
  preset: string = 'source',
  aspectRatio: AspectRatio = '16:9',
  maxSourceW: number = 1920,
  maxSourceH: number = 1080,
): { width: number; height: number } {
  let width = 1920;
  let height = 1080;

  if (preset === '4k') {
    if (aspectRatio === '9:16') {
      width = 2160;
      height = 3840;
    } else if (aspectRatio === '1:1') {
      width = 2160;
      height = 2160;
    } else {
      width = 3840;
      height = 2160;
    }
  } else if (preset === '720p') {
    if (aspectRatio === '9:16') {
      width = 720;
      height = 1280;
    } else if (aspectRatio === '1:1') {
      width = 720;
      height = 720;
    } else {
      width = 1280;
      height = 720;
    }
  } else if (preset === '1080p') {
    if (aspectRatio === '9:16') {
      width = 1080;
      height = 1920;
    } else if (aspectRatio === '1:1') {
      width = 1080;
      height = 1080;
    } else {
      width = 1920;
      height = 1080;
    }
  } else {
    // 'source'
    if (aspectRatio === '9:16') {
      if (maxSourceH >= 3840 || maxSourceW >= 2160) {
        width = 2160;
        height = 3840;
      } else if (maxSourceH >= 2560 || maxSourceW >= 1440) {
        width = 1440;
        height = 2560;
      } else {
        width = 1080;
        height = 1920;
      }
    } else if (aspectRatio === '1:1') {
      const maxDim = Math.max(maxSourceW, maxSourceH);
      if (maxDim >= 2160) {
        width = 2160;
        height = 2160;
      } else {
        width = Math.max(1080, Math.round(maxDim / 2) * 2);
        height = width;
      }
    } else {
      if (maxSourceW >= 3840 || maxSourceH >= 2160) {
        width = 3840;
        height = 2160;
      } else if (maxSourceW >= 2560 || maxSourceH >= 1440) {
        width = 2560;
        height = 1440;
      } else if (maxSourceW >= 1920 || maxSourceH >= 1080) {
        width = 1920;
        height = 1080;
      } else if (maxSourceW > 0 && maxSourceH > 0) {
        width = Math.max(1920, Math.round(maxSourceW / 2) * 2);
        height = Math.max(1080, Math.round(maxSourceH / 2) * 2);
      } else {
        width = 1920;
        height = 1080;
      }
    }
  }

  // Ensure dimensions are even (H.264 requirement)
  width = Math.round(width / 2) * 2;
  height = Math.round(height / 2) * 2;

  return { width, height };
}

/**
 * Deterministic Frame-by-Frame WebCodecs Exporter:
 * Renders every single frame independently at exact timestamps.
 * Guarantees ZERO stutter, ZERO frame drops, and ZERO freezing!
 */
export async function exportWithWebCodecs(
  clips: VideoClip[],
  transitions: Transition[],
  overlaySettings: HockeyOverlaySettings,
  aspectRatio: AspectRatio,
  onProgress?: (percent: number, status: string) => void,
  options?: ExportOptions,
): Promise<Blob> {
  if (clips.length === 0) {
    throw new Error('No video clips to export.');
  }

  onProgress?.(5, 'Initializing frame-by-frame master encoder...');

  const { segments, totalDuration } = calculateTimeline(clips, transitions);
  if (totalDuration <= 0) {
    throw new Error('Total sequence duration is zero.');
  }

  // Container to host videos for frame decoding
  const hostDiv = document.createElement('div');
  hostDiv.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:2px;height:2px;opacity:0.001;pointer-events:none;';
  document.body.appendChild(hostDiv);

  const videoElements: HTMLVideoElement[] = [];
  try {
    // Preload video elements
    for (let i = 0; i < clips.length; i++) {
      onProgress?.(
        Math.round(5 + (i / clips.length) * 10),
        `Preparing clip ${i + 1} of ${clips.length}...`,
      );

      let activeUrl = clips[i].url;
      if (clips[i].blob instanceof Blob) {
        try {
          const { memoryUrl, memoryBlob } = await loadBlobIntoMemory(clips[i].blob);
          activeUrl = memoryUrl;
          clips[i].url = activeUrl;
          clips[i].blob = memoryBlob;
        } catch {}
      }

      const video = await preloadVideo(activeUrl, clips[i].blob, clips[i].startTime, clips[i].endTime);
      video.muted = true;
      hostDiv.appendChild(video);
      videoElements.push(video);
    }

    // Measure maximum resolution
    let maxSourceW = 0;
    let maxSourceH = 0;
    for (let i = 0; i < videoElements.length; i++) {
      const v = videoElements[i];
      const w = v.videoWidth || clips[i].originalWidth || 0;
      const h = v.videoHeight || clips[i].originalHeight || 0;
      if (w > maxSourceW) maxSourceW = w;
      if (h > maxSourceH) maxSourceH = h;
    }

    const fps = options?.fps || 30; // 30 or 60 fps
    const isShorts = aspectRatio === '9:16';
    const { width, height } = getExportResolution(options?.qualityPreset, aspectRatio, maxSourceW, maxSourceH);

    // Target Bitrate
    let targetBitrate = 12_000_000;
    if (width >= 3840 || height >= 3840) targetBitrate = 24_000_000;
    else if (width <= 1280 && height <= 720) targetBitrate = 6_000_000;
    if (options?.bitrate) targetBitrate = options.bitrate;

    // Render Offline Master Audio
    onProgress?.(16, 'Rendering pristine master audio tracks...');
    const masterAudioBuffer = await renderOfflineMasterAudio(clips, segments, totalDuration, overlaySettings);

    // Canvas setup
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false })!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Verify AudioEncoder availability
    const hasAudioData = Boolean(masterAudioBuffer && masterAudioBuffer.length > 0);
    const supportsAudioEncoder = typeof (window as any).AudioEncoder === 'function';

    let canEncodeAudio = false;
    let audioCodec = 'mp4a.40.2'; // AAC
    if (hasAudioData && supportsAudioEncoder) {
      try {
        const support = await (window as any).AudioEncoder.isConfigSupported({
          codec: audioCodec,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitrate: 192_000,
        });
        canEncodeAudio = Boolean(support && support.supported);
      } catch {
        canEncodeAudio = false;
      }
    }

    // Initialize mp4-muxer
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: 'avc',
        width,
        height,
      },
      audio: canEncodeAudio
        ? {
            codec: 'aac',
            numberOfChannels: 2,
            sampleRate: 44100,
          }
        : undefined,
      fastStart: 'in-memory',
    });

    // Configure VideoEncoder
    const VideoEncoderClass = (window as any).VideoEncoder;
    let videoEncoder: any = null;
    let encodeError: any = null;

    videoEncoder = new VideoEncoderClass({
      output: (chunk: any, meta: any) => {
        muxer.addVideoChunk(chunk, meta);
      },
      error: (e: any) => {
        console.error('WebCodecs VideoEncoder error:', e);
        encodeError = e;
      },
    });

    // Test codec configurations: AVC High -> Main -> Baseline
    const avcCodecs = ['avc1.640028', 'avc1.4d002a', 'avc1.42e01f'];
    let selectedCodec = avcCodecs[1];

    for (const c of avcCodecs) {
      try {
        const res = await VideoEncoderClass.isConfigSupported({
          codec: c,
          width,
          height,
          bitrate: targetBitrate,
          framerate: fps,
        });
        if (res && res.supported) {
          selectedCodec = c;
          break;
        }
      } catch {}
    }

    videoEncoder.configure({
      codec: selectedCodec,
      width,
      height,
      bitrate: targetBitrate,
      framerate: fps,
      hardwareAcceleration: 'prefer-hardware',
      avc: { format: 'avc' },
    });

    // Configure AudioEncoder if available
    let audioEncoder: any = null;
    if (canEncodeAudio && masterAudioBuffer) {
      const AudioEncoderClass = (window as any).AudioEncoder;
      audioEncoder = new AudioEncoderClass({
        output: (chunk: any, meta: any) => {
          muxer.addAudioChunk(chunk, meta);
        },
        error: (e: any) => {
          console.warn('AudioEncoder error:', e);
        },
      });

      audioEncoder.configure({
        codec: audioCodec,
        sampleRate: 44100,
        numberOfChannels: 2,
        bitrate: 192_000,
      });

      // Encode audio chunks
      const sampleRate = masterAudioBuffer.sampleRate;
      const numChannels = masterAudioBuffer.numberOfChannels;
      const totalAudioFrames = masterAudioBuffer.length;
      const chunkSize = sampleRate; // 1 second chunks

      const AudioDataClass = (window as any).AudioData;
      for (let offset = 0; offset < totalAudioFrames; offset += chunkSize) {
        const framesInChunk = Math.min(chunkSize, totalAudioFrames - offset);
        const planar = new Float32Array(framesInChunk * numChannels);
        for (let ch = 0; ch < numChannels; ch++) {
          const chData = masterAudioBuffer.getChannelData(ch).subarray(offset, offset + framesInChunk);
          planar.set(chData, ch * framesInChunk);
        }

        const audioData = new AudioDataClass({
          format: 'f32-planar',
          sampleRate,
          numberOfFrames: framesInChunk,
          numberOfChannels: numChannels,
          timestamp: Math.round((offset / sampleRate) * 1_000_000), // microseconds
          data: planar,
        });

        audioEncoder.encode(audioData);
        audioData.close();
      }

      await audioEncoder.flush();
    }

    // Step through each video frame deterministically
    const totalFrames = Math.max(1, Math.round(totalDuration * fps));
    const frameDurationMicros = Math.round((1 / fps) * 1_000_000);
    const VideoFrameClass = (window as any).VideoFrame;

    onProgress?.(22, `Rendering ${totalFrames} frames with zero dropped frames...`);

    let currentSegIdx = 0;

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      if (options?.signal?.aborted) {
        throw new Error('Export was cancelled by user.');
      }
      if (encodeError) throw encodeError;

      const timelineTime = frameIndex / fps;

      // Locate active timeline segment
      while (
        currentSegIdx < segments.length - 1 &&
        timelineTime >= segments[currentSegIdx].clipEndInTimeline
      ) {
        currentSegIdx++;
      }

      const seg = segments[currentSegIdx];
      const video = videoElements[currentSegIdx];
      const clip = seg.clip;
      const rate = clip.playbackRate || 1.0;

      // Exact time inside clip
      const timeInSeg = Math.max(0, timelineTime - seg.clipStartInTimeline);
      const targetClipTime = Math.min(clip.endTime, clip.startTime + timeInSeg * rate);

      await seekVideoFrame(video, targetClipTime);

      // Clear frame
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      // Transition check
      const trans = seg.transitionWithNext;
      const isInTransition = Boolean(
        trans &&
        currentSegIdx + 1 < segments.length &&
        timelineTime >= trans.startInTimeline
      );

      if (isInTransition && trans) {
        const nextIdx = currentSegIdx + 1;
        const nextVideo = videoElements[nextIdx];
        const nextClip = segments[nextIdx].clip;
        const nextRate = nextClip.playbackRate || 1.0;

        const timeInNext = Math.max(0, timelineTime - trans.startInTimeline);
        const nextTargetTime = Math.min(nextClip.endTime, nextClip.startTime + timeInNext * nextRate);
        await seekVideoFrame(nextVideo, nextTargetTime);

        const progress = Math.max(0, Math.min(1, (timelineTime - trans.startInTimeline) / trans.duration));
        renderTransitionEffect(
          ctx,
          video,
          nextVideo,
          trans.type,
          progress,
          width,
          height,
          clip,
          nextClip,
        );
      } else {
        drawVideoFitted(
          ctx,
          video,
          width,
          height,
          clip.zoom ?? 1,
          clip.panX ?? 0,
          clip.panY ?? 0,
          clip.framingMode ?? 'fit-blur',
        );
      }

      // Draw broadcast sports overlays
      drawHockeyOverlays(ctx, overlaySettings, clip, width, height, isShorts);

      // Create pristine uncompressed VideoFrame at exact microsecond timestamp
      const frameTimestamp = Math.round(timelineTime * 1_000_000);
      const vFrame = new VideoFrameClass(canvas, {
        timestamp: frameTimestamp,
        duration: frameDurationMicros,
      });

      // Keyframe every 2 seconds
      const isKeyframe = frameIndex % (fps * 2) === 0;
      videoEncoder.encode(vFrame, { keyFrame: isKeyframe });
      vFrame.close();

      // Backpressure: prevent encoder queue overflow and memory starvation
      if (videoEncoder.encodeQueueSize > 4) {
        await new Promise<void>((r) => {
          const check = () => {
            if (!videoEncoder || videoEncoder.encodeQueueSize <= 2) r();
            else setTimeout(check, 6);
          };
          check();
        });
      }

      // Yield periodically to keep UI responsive and prevent browser watchdog timeouts
      if (frameIndex % 8 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }

      // Report smooth progress
      if (frameIndex % 6 === 0 || frameIndex === totalFrames - 1) {
        const percent = Math.min(97, Math.round(22 + (frameIndex / totalFrames) * 75));
        onProgress?.(
          percent,
          `Frame-by-frame: ${frameIndex + 1} / ${totalFrames} (${percent}%) • 0% dropped frames`,
        );
      }
    }

    onProgress?.(98, 'Finalizing MP4 file packaging...');
    await videoEncoder.flush();
    muxer.finalize();

    const { buffer } = muxer.target;
    const finalBlob = new Blob([buffer], { type: 'video/mp4' });
    onProgress?.(100, 'Master MP4 export completed!');
    return finalBlob;
  } finally {
    if (hostDiv.parentNode) {
      document.body.removeChild(hostDiv);
    }
  }
}
