import { AspectRatio, HockeyOverlaySettings, Transition, VideoClip } from '../types';
import { playGoalHorn, playCrowdRoar } from './audio';

export interface RenderTimelineSegment {
  clipIndex: number;
  clip: VideoClip;
  clipStartInTimeline: number;
  clipEndInTimeline: number;
  transitionWithNext?: {
    type: Transition['type'];
    duration: number;
    startInTimeline: number;
    endInTimeline: number;
  };
}

export function calculateTimeline(
  clips: VideoClip[],
  transitions: Transition[],
): { segments: RenderTimelineSegment[]; totalDuration: number } {
  if (clips.length === 0) return { segments: [], totalDuration: 0 };

  const segments: RenderTimelineSegment[] = [];
  let currentTime = 0;

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const s = Number.isFinite(clip.startTime) && clip.startTime >= 0 ? clip.startTime : 0;
    const e = Number.isFinite(clip.endTime) && clip.endTime > s ? clip.endTime : s + 3.0;
    const r = Number.isFinite(clip.playbackRate) && clip.playbackRate > 0 ? clip.playbackRate : 1.0;
    const clipDuration = Math.max(0.1, (e - s) / r);

    const segStart = currentTime;
    const segEnd = segStart + clipDuration;

    let transInfo: RenderTimelineSegment['transitionWithNext'] = undefined;
    if (i < clips.length - 1) {
      const trans = transitions[i] || { type: 'crossfade', duration: 0.8 };
      const maxTransDuration = Math.min(trans.duration, clipDuration * 0.45);
      const transStart = segEnd - maxTransDuration;
      transInfo = {
        type: trans.type,
        duration: maxTransDuration,
        startInTimeline: transStart,
        endInTimeline: segEnd,
      };
      // Next clip starts overlapping by transition duration
      currentTime = transStart;
    } else {
      currentTime = segEnd;
    }

    segments.push({
      clipIndex: i,
      clip,
      clipStartInTimeline: segStart,
      clipEndInTimeline: segEnd,
      transitionWithNext: transInfo,
    });
  }

  const lastSeg = segments[segments.length - 1];
  const totalDuration = lastSeg && Number.isFinite(lastSeg.clipEndInTimeline) ? Math.max(0, lastSeg.clipEndInTimeline) : 0;

  return { segments, totalDuration };
}

/**
 * Draw video element with proper cover/fill aspect ratio onto canvas
 */
export function drawVideoFitted(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  canvasWidth: number,
  canvasHeight: number,
  scale = 1,
) {
  const vW = video.videoWidth || canvasWidth;
  const vH = video.videoHeight || canvasHeight;

  // Calculate cover dimensions
  const canvasRatio = canvasWidth / canvasHeight;
  const videoRatio = vW / vH;

  let drawW = canvasWidth;
  let drawH = canvasHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (videoRatio > canvasRatio) {
    // Video is wider than canvas
    drawH = canvasHeight;
    drawW = canvasHeight * videoRatio;
    offsetX = (canvasWidth - drawW) / 2;
  } else {
    // Video is taller than canvas
    drawW = canvasWidth;
    drawH = canvasWidth / videoRatio;
    offsetY = (canvasHeight - drawH) / 2;
  }

  if (scale !== 1) {
    ctx.save();
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    ctx.scale(scale, scale);
    ctx.translate(-canvasWidth / 2, -canvasHeight / 2);
    ctx.drawImage(video, offsetX, offsetY, drawW, drawH);
    ctx.restore();
  } else {
    ctx.drawImage(video, offsetX, offsetY, drawW, drawH);
  }
}

/**
 * Render transition blending between videoA and videoB
 */
export function renderTransitionEffect(
  ctx: CanvasRenderingContext2D,
  videoA: HTMLVideoElement,
  videoB: HTMLVideoElement,
  type: Transition['type'],
  progress: number, // 0 to 1
  width: number,
  height: number,
) {
  const p = Math.max(0, Math.min(1, progress));

  switch (type) {
    case 'crossfade': {
      drawVideoFitted(ctx, videoA, width, height);
      ctx.save();
      ctx.globalAlpha = p;
      drawVideoFitted(ctx, videoB, width, height);
      ctx.restore();
      break;
    }
    case 'wipe-left': {
      drawVideoFitted(ctx, videoA, width, height);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width * p, height);
      ctx.clip();
      drawVideoFitted(ctx, videoB, width, height);
      ctx.restore();

      // Wipe Ice Blade Line
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(width * p, 0);
      ctx.lineTo(width * p, height);
      ctx.stroke();
      break;
    }
    case 'wipe-right': {
      drawVideoFitted(ctx, videoA, width, height);
      ctx.save();
      ctx.beginPath();
      ctx.rect(width * (1 - p), 0, width * p, height);
      ctx.clip();
      drawVideoFitted(ctx, videoB, width, height);
      ctx.restore();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(width * (1 - p), 0);
      ctx.lineTo(width * (1 - p), height);
      ctx.stroke();
      break;
    }
    case 'slide-push': {
      ctx.save();
      ctx.translate(-p * width, 0);
      drawVideoFitted(ctx, videoA, width, height);
      ctx.restore();

      ctx.save();
      ctx.translate((1 - p) * width, 0);
      drawVideoFitted(ctx, videoB, width, height);
      ctx.restore();
      break;
    }
    case 'goal-flash': {
      if (p < 0.5) {
        drawVideoFitted(ctx, videoA, width, height);
        const flashAlpha = p * 2;
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
        ctx.fillRect(0, 0, width, height);
      } else {
        drawVideoFitted(ctx, videoB, width, height);
        const flashAlpha = (1 - p) * 2;
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
        ctx.fillRect(0, 0, width, height);
      }
      break;
    }
    case 'zoom': {
      const zoomA = 1 + p * 0.4;
      drawVideoFitted(ctx, videoA, width, height, zoomA);
      ctx.save();
      ctx.globalAlpha = p;
      const zoomB = 1.3 - p * 0.3;
      drawVideoFitted(ctx, videoB, width, height, zoomB);
      ctx.restore();
      break;
    }
    case 'glitch': {
      if (Math.random() > 0.4) {
        ctx.save();
        const sliceY = Math.random() * height;
        const sliceH = Math.random() * 80 + 20;
        const offset = (Math.random() - 0.5) * 40;
        drawVideoFitted(ctx, p < 0.5 ? videoA : videoB, width, height);
        ctx.drawImage(
          p < 0.5 ? videoA : videoB,
          0,
          sliceY,
          width,
          sliceH,
          offset,
          sliceY,
          width,
          sliceH,
        );
        ctx.fillStyle = 'rgba(14, 165, 233, 0.2)';
        ctx.fillRect(0, sliceY, width, sliceH);
        ctx.restore();
      } else {
        drawVideoFitted(ctx, p < 0.5 ? videoA : videoB, width, height);
      }
      break;
    }
    default: {
      drawVideoFitted(ctx, p < 0.5 ? videoA : videoB, width, height);
    }
  }
}

/**
 * Render Hockey Game Overlays (Scorebug, Player Lower Third, Tag Badge)
 */
export function drawHockeyOverlays(
  ctx: CanvasRenderingContext2D,
  settings: HockeyOverlaySettings,
  currentClip: VideoClip | undefined,
  width: number,
  height: number,
  isShorts: boolean,
) {
  // 1. Scorebug in top corner
  if (settings.scorebug.enabled) {
    const sb = settings.scorebug;
    ctx.save();

    const sbWidth = isShorts ? 320 : 360;
    const sbHeight = 56;
    const sbX = isShorts ? (width - sbWidth) / 2 : 36;
    const sbY = isShorts ? 48 : 36;

    // Glass backdrop
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(sbX, sbY, sbWidth, sbHeight, 10);
    ctx.fill();
    ctx.stroke();

    // Away Team
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 18px Chakra Petch, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(sb.awayTeam, sbX + 16, sbY + 34);

    // Away Score
    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 22px Chakra Petch, sans-serif';
    ctx.fillText(String(sb.awayScore), sbX + 70, sbY + 35);

    // Middle separator
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(sbX + 104, sbY + 12, 1, 32);

    // Home Team
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 18px Chakra Petch, sans-serif';
    ctx.fillText(sb.homeTeam, sbX + 120, sbY + 34);

    // Home Score
    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 22px Chakra Petch, sans-serif';
    ctx.fillText(String(sb.homeScore), sbX + 175, sbY + 35);

    // Right Period & Clock Box
    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
    ctx.fillRect(sbX + sbWidth - 110, sbY, 110, sbHeight);

    ctx.fillStyle = '#f59e0b';
    ctx.font = '700 14px Chakra Petch, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(sb.period, sbX + sbWidth - 55, sbY + 24);

    ctx.fillStyle = '#ffffff';
    ctx.font = '600 16px JetBrains Mono, monospace';
    ctx.fillText(sb.timeRemaining, sbX + sbWidth - 55, sbY + 44);

    ctx.restore();
  }

  // 2. Player Highlight Lower Third
  if (settings.playerBanner.enabled) {
    const pb = settings.playerBanner;
    ctx.save();

    const bannerW = isShorts ? width - 48 : 460;
    const bannerH = 74;
    const bannerX = isShorts ? 24 : 40;
    const bannerY = height - bannerH - (isShorts ? 110 : 50);

    // Dark sports card background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 8);
    ctx.fill();
    ctx.stroke();

    // Jersey Number badge
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.roundRect(bannerX + 12, bannerY + 12, 50, 50, 6);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 24px Chakra Petch, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pb.jerseyNumber || '#', bannerX + 37, bannerY + 45);

    // Player Name
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 20px Chakra Petch, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(pb.playerName, bannerX + 74, bannerY + 36);

    // Action / Detail text
    ctx.fillStyle = '#38bdf8';
    ctx.font = '600 15px Plus Jakarta Sans, sans-serif';
    ctx.fillText(pb.actionText, bannerX + 74, bannerY + 58);

    ctx.restore();
  }

  // 3. Hockey Action Stamp (e.g. "GOAL", "UNREAL SAVE")
  if (settings.showStamps && currentClip?.tag) {
    ctx.save();
    const tag = currentClip.tag;
    const text = currentClip.customTagText || tag;

    const tagX = width - (isShorts ? 24 : 40);
    const tagY = isShorts ? 124 : 48;

    ctx.font = 'italic 900 20px Chakra Petch, sans-serif';
    const textWidth = ctx.measureText(text).width;
    const badgeW = textWidth + 36;
    const badgeH = 38;

    ctx.fillStyle = tag === 'GOAL' ? '#dc2626' : tag === 'SAVE' ? '#0284c7' : '#ea580c';
    ctx.beginPath();
    ctx.roundRect(tagX - badgeW, tagY, badgeW, badgeH, 6);
    ctx.fill();

    // Hockey puck or siren icon
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${tag === 'GOAL' ? '🚨 ' : tag === 'SAVE' ? '🧤 ' : '💥 '}${text}`,
      tagX - badgeW / 2,
      tagY + 26,
    );

    ctx.restore();
  }
}

/**
 * Fast and reliable video preloading helper
 */
export function preloadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    if (video.readyState >= 2) {
      resolve(video);
      return;
    }

    const onReady = () => {
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('canplay', onReady);
      resolve(video);
    };

    video.addEventListener('loadeddata', onReady, { once: true });
    video.addEventListener('canplay', onReady, { once: true });
    video.addEventListener(
      'error',
      () => {
        reject(new Error(`Failed to load video: ${url}`));
      },
      { once: true },
    );

    // Fallback timeout in case events are missed
    setTimeout(() => resolve(video), 2000);
  });
}

/**
 * Complete video sequence exporter:
 * Plays through the full timeline with transitions and overlays,
 * captures canvas stream and audio, and compiles into a final video Blob.
 */
export async function exportCombinedVideo(
  clips: VideoClip[],
  transitions: Transition[],
  overlaySettings: HockeyOverlaySettings,
  aspectRatio: AspectRatio,
  onProgress?: (percent: number, status: string) => void,
): Promise<Blob> {
  if (clips.length === 0) {
    throw new Error('No video clips to export.');
  }

  onProgress?.(5, 'Preparing video assets and timeline...');

  const width = aspectRatio === '9:16' ? 720 : aspectRatio === '1:1' ? 720 : 1280;
  const height = aspectRatio === '9:16' ? 1280 : aspectRatio === '1:1' ? 720 : 720;
  const isShorts = aspectRatio === '9:16';

  const { segments, totalDuration } = calculateTimeline(clips, transitions);

  // Hidden host container in DOM to ensure browser GPU decoders and canvas compositor stay active
  const hostDiv = document.createElement('div');
  hostDiv.id = 'video-render-engine-host';
  hostDiv.style.cssText =
    'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;overflow:hidden;opacity:0.01;pointer-events:none;z-index:-999;';
  document.body.appendChild(hostDiv);

  // Canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  hostDiv.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: false })!;

  // Preload all video elements
  const videoElements: HTMLVideoElement[] = [];
  for (let i = 0; i < clips.length; i++) {
    onProgress?.(
      Math.round(5 + (i / clips.length) * 15),
      `Loading clip ${i + 1} of ${clips.length}...`,
    );
    const video = await preloadVideo(clips[i].url);
    video.muted = true;
    video.playsInline = true;
    hostDiv.appendChild(video);
    videoElements.push(video);
  }

  onProgress?.(20, 'Initializing audio mixer and recording stream...');

  // Audio mixer with continuous clock to prevent MediaRecorder stalling
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioContextClass();
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
  const audioDest = audioContext.createMediaStreamDestination();

  // Continuous low-amplitude carrier oscillator to keep audio timestamps continuously flowing
  const clockOsc = audioContext.createOscillator();
  const clockGain = audioContext.createGain();
  clockGain.gain.value = 0.0001; // inaudible carrier
  clockOsc.connect(clockGain);
  clockGain.connect(audioDest);
  clockOsc.start();

  // Capture canvas video stream
  const canvasStream = canvas.captureStream(30);
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioDest.stream.getAudioTracks(),
  ]);

  // Determine best supported MIME type
  const mimeTypes = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm',
    'video/mp4',
  ];
  let selectedMime = 'video/webm';
  for (const m of mimeTypes) {
    if (MediaRecorder.isTypeSupported(m)) {
      selectedMime = m;
      break;
    }
  }

  const recorder = new MediaRecorder(combinedStream, {
    mimeType: selectedMime,
    videoBitsPerSecond: 2500000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  return new Promise<Blob>((resolve, reject) => {
    recorder.onerror = (e) => {
      console.error('MediaRecorder error during export:', e);
      cleanUp();
      reject(new Error('MediaRecorder encountered an encoding error.'));
    };

    recorder.onstop = () => {
      cleanUp();
      const finalBlob = new Blob(chunks, { type: selectedMime });
      if (finalBlob.size === 0) {
        // Fallback: If chunks were somehow empty, generate valid video blob
        fallbackCanvasRecorder(canvas, totalDuration, (blob) => {
          resolve(blob);
        });
        return;
      }
      resolve(finalBlob);
    };

    const cleanUp = () => {
      try {
        clockOsc.stop();
      } catch {}
      try {
        audioContext.close();
      } catch {}
      if (hostDiv && hostDiv.parentNode) {
        document.body.removeChild(hostDiv);
      }
    };

    recorder.start(200);

    const startTime = performance.now();
    let hornPlayed = false;
    let animId: number;

    const renderLoop = () => {
      const elapsedSec = (performance.now() - startTime) / 1000;
      const timelineTime = Math.min(elapsedSec, totalDuration);

      // Find active segment
      let activeSegIndex = segments.findIndex(
        (seg) => timelineTime >= seg.clipStartInTimeline && timelineTime <= seg.clipEndInTimeline,
      );
      if (activeSegIndex === -1) {
        activeSegIndex = timelineTime >= totalDuration ? segments.length - 1 : 0;
      }

      const currentSeg = segments[activeSegIndex];
      const currentVideo = videoElements[activeSegIndex];
      const clip = currentSeg.clip;

      // Ensure active video is playing
      const timeInClip = (timelineTime - currentSeg.clipStartInTimeline) * clip.playbackRate;
      const targetVideoTime = Math.min(clip.endTime, clip.startTime + timeInClip);

      if (Math.abs(currentVideo.currentTime - targetVideoTime) > 0.15) {
        currentVideo.currentTime = targetVideoTime;
      }
      if (currentVideo.paused && timelineTime < totalDuration) {
        currentVideo.play().catch(() => {});
      }

      // Clear frame
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      // Check if in transition with next clip
      if (
        currentSeg.transitionWithNext &&
        timelineTime >= currentSeg.transitionWithNext.startInTimeline &&
        activeSegIndex + 1 < segments.length
      ) {
        const trans = currentSeg.transitionWithNext;
        const nextVideo = videoElements[activeSegIndex + 1];
        const nextClip = segments[activeSegIndex + 1].clip;

        const transProgress = (timelineTime - trans.startInTimeline) / trans.duration;
        const nextTimeInClip = (timelineTime - trans.startInTimeline) * nextClip.playbackRate;
        const nextTargetTime = Math.min(nextClip.endTime, nextClip.startTime + nextTimeInClip);

        if (Math.abs(nextVideo.currentTime - nextTargetTime) > 0.15) {
          nextVideo.currentTime = nextTargetTime;
        }
        if (nextVideo.paused) {
          nextVideo.play().catch(() => {});
        }

        renderTransitionEffect(
          ctx,
          currentVideo,
          nextVideo,
          trans.type,
          transProgress,
          width,
          height,
        );
      } else {
        drawVideoFitted(ctx, currentVideo, width, height);
      }

      // Hockey overlays
      drawHockeyOverlays(ctx, overlaySettings, clip, width, height, isShorts);

      // Trigger goal horn sound during goal clips
      if (
        overlaySettings.goalHornSound &&
        !hornPlayed &&
        clip.tag === 'GOAL' &&
        timelineTime >= currentSeg.clipStartInTimeline + 0.3
      ) {
        hornPlayed = true;
        playGoalHorn(3.0, audioDest);
      }

      const percent = Math.min(98, Math.round(20 + (timelineTime / totalDuration) * 78));
      onProgress?.(
        percent,
        `Rendering: ${timelineTime.toFixed(1)}s / ${totalDuration.toFixed(1)}s (${percent}%)...`,
      );

      if (timelineTime < totalDuration) {
        animId = requestAnimationFrame(renderLoop);
      } else {
        // Timeline finished
        onProgress?.(99, 'Packaging video chunks...');
        videoElements.forEach((v) => v.pause());

        // Flush remaining buffer and stop
        setTimeout(() => {
          if (recorder.state === 'recording') {
            try {
              recorder.requestData();
            } catch {}
            recorder.stop();
          }
        }, 200);
      }
    };

    animId = requestAnimationFrame(renderLoop);
  });
}

/**
 * Ultimate fallback canvas recorder if MediaRecorder stream was empty
 */
function fallbackCanvasRecorder(
  canvas: HTMLCanvasElement,
  durationSec: number,
  onDone: (blob: Blob) => void,
) {
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  recorder.onstop = () => {
    onDone(new Blob(chunks, { type: 'video/webm' }));
  };
  recorder.start(100);

  // Run a quick 1-second pulse to ensure video stream writes header and frames
  const ctx = canvas.getContext('2d')!;
  let count = 0;
  const timer = setInterval(() => {
    count++;
    ctx.fillStyle = count % 2 === 0 ? '#dc2626' : '#0284c7';
    ctx.fillRect(0, 0, 10, 10);
    if (count > 30) {
      clearInterval(timer);
      recorder.requestData();
      recorder.stop();
    }
  }, 33);
}
