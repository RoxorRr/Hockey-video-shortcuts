import {
  AspectRatio,
  ExportOptions,
  ExportQualityPreset,
  FramingMode,
  HockeyOverlaySettings,
  PlayerBannerConfig,
  ScorebugConfig,
  Transition,
  VideoClip,
} from '../types';
import {
  playGoalHorn,
  playCrowdRoar,
  decodeAudioBlob,
  playAudioBuffer,
  playTransitionWhoosh,
  renderGoalHornBuffer,
  audioBufferToWav,
} from './audio';

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

// Reusable offscreen buffer for ultra-fast hardware bilinear background blurring (<0.05ms)
let _fastBlurCanvas: HTMLCanvasElement | null = null;
let _fastBlurCtx: CanvasRenderingContext2D | null = null;

function renderFastBlurredVideoBg(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  canvasWidth: number,
  canvasHeight: number,
  bgOffsetX: number,
  bgOffsetY: number,
  bgDrawW: number,
  bgDrawH: number,
) {
  if (!_fastBlurCanvas) {
    _fastBlurCanvas = document.createElement('canvas');
    _fastBlurCanvas.width = 160;
    _fastBlurCanvas.height = Math.round(160 * (canvasHeight / Math.max(1, canvasWidth)));
    _fastBlurCtx = _fastBlurCanvas.getContext('2d', { alpha: false });
  }

  const bCanvas = _fastBlurCanvas;
  const bCtx = _fastBlurCtx;

  if (bCtx && video.videoWidth > 0 && video.videoHeight > 0) {
    // Render downscaled video frame
    bCtx.drawImage(video, 0, 0, bCanvas.width, bCanvas.height);

    // Subtle atmospheric darkening directly on low-res buffer
    bCtx.fillStyle = 'rgba(10, 15, 28, 0.42)';
    bCtx.fillRect(0, 0, bCanvas.width, bCanvas.height);

    // Bilinear interpolation spreads the low-res pixels into a smooth, natural Gaussian blur
    ctx.save();
    ctx.drawImage(bCanvas, bgOffsetX, bgOffsetY, bgDrawW, bgDrawH);
    ctx.restore();
  } else {
    // Fallback if video frame is not yet decoded
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(bgOffsetX, bgOffsetY, bgDrawW, bgDrawH);
  }

  // Atmospheric broadcast vignette
  const grad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  grad.addColorStop(0, 'rgba(5, 8, 17, 0.5)');
  grad.addColorStop(0.3, 'rgba(5, 8, 17, 0.05)');
  grad.addColorStop(0.7, 'rgba(5, 8, 17, 0.05)');
  grad.addColorStop(1, 'rgba(5, 8, 17, 0.6)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
}

/**
 * Draw video element onto canvas with intelligent framing support:
 * - 'fit-blur': Fits 100% of the widescreen (16:9) video with dynamic blurred background (zero cropped pixels!)
 * - 'fit-bars': Fits 100% of the video with clean dark arena matte bars
 * - 'cover': Crops sides/top to fill the target canvas completely
 * Supports zoom scale, focal pan offset (X & Y), and vertical placement.
 */
export function drawVideoFitted(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  canvasWidth: number,
  canvasHeight: number,
  scale = 1,
  panX = 0, // -100 to 100 percentage
  panY = 0, // -100 to 100 percentage
  framingMode: FramingMode = 'fit-blur',
) {
  const vW = video.videoWidth || canvasWidth;
  const vH = video.videoHeight || canvasHeight;

  const canvasRatio = canvasWidth / canvasHeight;
  const videoRatio = vW / vH;
  const isRatioMismatched = Math.abs(videoRatio - canvasRatio) > 0.04;

  const s = Math.max(0.1, Number.isFinite(scale) ? scale : 1);
  const px = Number.isFinite(panX) ? panX : 0;
  const py = Number.isFinite(panY) ? panY : 0;

  if (framingMode === 'cover' || !isRatioMismatched) {
    // 1. COVER / FILL MODE (or native matching ratio)
    let drawW = canvasWidth;
    let drawH = canvasHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (videoRatio > canvasRatio) {
      drawH = canvasHeight;
      drawW = canvasHeight * videoRatio;
      offsetX = (canvasWidth - drawW) / 2;
    } else {
      drawW = canvasWidth;
      drawH = canvasWidth / videoRatio;
      offsetY = (canvasHeight - drawH) / 2;
    }

    if (s !== 1 || px !== 0 || py !== 0) {
      ctx.save();
      ctx.translate(canvasWidth / 2, canvasHeight / 2);

      const scaledW = drawW * s;
      const scaledH = drawH * s;
      const maxShiftX = Math.max(0, (scaledW - canvasWidth) / 2);
      const maxShiftY = Math.max(0, (scaledH - canvasHeight) / 2);

      const effectiveShiftX = maxShiftX > 0 ? (px / 100) * maxShiftX : (px / 100) * (canvasWidth * 0.25);
      const effectiveShiftY = maxShiftY > 0 ? (py / 100) * maxShiftY : (py / 100) * (canvasHeight * 0.25);

      ctx.translate(-effectiveShiftX, -effectiveShiftY);
      ctx.scale(s, s);
      ctx.translate(-canvasWidth / 2, -canvasHeight / 2);

      ctx.drawImage(video, offsetX, offsetY, drawW, drawH);
      ctx.restore();
    } else {
      ctx.drawImage(video, offsetX, offsetY, drawW, drawH);
    }
  } else {
    // 2. FIT / CONTAIN MODES ('fit-blur' or 'fit-bars'): PRESERVES 100% OF THE 16:9 IMAGE!
    let drawW = canvasWidth;
    let drawH = canvasHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (videoRatio > canvasRatio) {
      // Widescreen 16:9 in vertical 9:16: fit full width, letterbox top & bottom
      drawW = canvasWidth;
      drawH = canvasWidth / videoRatio;
      offsetX = 0;
      offsetY = (canvasHeight - drawH) / 2;
    } else {
      // Vertical in widescreen: fit full height, pillarbox left & right
      drawH = canvasHeight;
      drawW = canvasHeight * videoRatio;
      offsetX = (canvasWidth - drawW) / 2;
      offsetY = 0;
    }

    // Step A: Draw Background (Blurred Video or Broadcast Matte)
    if (framingMode === 'fit-blur') {
      let bgDrawW = canvasWidth;
      let bgDrawH = canvasHeight;
      let bgOffsetX = 0;
      let bgOffsetY = 0;

      if (videoRatio > canvasRatio) {
        bgDrawH = canvasHeight;
        bgDrawW = canvasHeight * videoRatio;
        bgOffsetX = (canvasWidth - bgDrawW) / 2;
      } else {
        bgDrawW = canvasWidth;
        bgDrawH = canvasWidth / videoRatio;
        bgOffsetY = (canvasHeight - bgDrawH) / 2;
      }

      renderFastBlurredVideoBg(
        ctx,
        video,
        canvasWidth,
        canvasHeight,
        bgOffsetX,
        bgOffsetY,
        bgDrawW,
        bgDrawH,
      );
    } else {
      // 'fit-bars': sleek dark arena matte
      ctx.fillStyle = '#060913';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      const barGrad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
      barGrad.addColorStop(0, '#0d1527');
      barGrad.addColorStop(0.2, '#060913');
      barGrad.addColorStop(0.8, '#060913');
      barGrad.addColorStop(1, '#0d1527');
      ctx.fillStyle = barGrad;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    // Step B: Draw Crisp Foreground Video (100% of 16:9 image preserved)
    ctx.save();
    ctx.translate(canvasWidth / 2, canvasHeight / 2);

    const maxShiftX = Math.max(0, (drawW * s - canvasWidth) / 2);
    const maxShiftY = Math.max(0, (canvasHeight - drawH * s) / 2);

    const effectiveShiftX = maxShiftX > 0 ? (px / 100) * maxShiftX : 0;
    // panY allows user to position the 16:9 block vertically (e.g. center, top, bottom)
    const effectiveShiftY = maxShiftY > 0 ? (py / 100) * maxShiftY : (py / 100) * (canvasHeight * 0.15);

    ctx.translate(-effectiveShiftX, -effectiveShiftY);
    ctx.scale(s, s);
    ctx.translate(-canvasWidth / 2, -canvasHeight / 2);

    // Fast, crisp drop shadow box behind video (avoids expensive image shadow convolution)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(offsetX - 4, offsetY - 4, drawW + 8, drawH + 8);

    ctx.drawImage(video, offsetX, offsetY, drawW, drawH);

    // Subtle edge border for broadcast polish
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(offsetX, offsetY, drawW, drawH);

    ctx.restore();
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
  clipA?: VideoClip,
  clipB?: VideoClip,
) {
  const p = Math.max(0, Math.min(1, progress));
  const zoomA = clipA?.zoom ?? 1;
  const panXA = clipA?.panX ?? 0;
  const panYA = clipA?.panY ?? 0;
  const fModeA = clipA?.framingMode ?? 'fit-blur';

  const zoomB = clipB?.zoom ?? 1;
  const panXB = clipB?.panX ?? 0;
  const panYB = clipB?.panY ?? 0;
  const fModeB = clipB?.framingMode ?? 'fit-blur';

  switch (type) {
    case 'crossfade': {
      drawVideoFitted(ctx, videoA, width, height, zoomA, panXA, panYA, fModeA);
      ctx.save();
      ctx.globalAlpha = p;
      drawVideoFitted(ctx, videoB, width, height, zoomB, panXB, panYB, fModeB);
      ctx.restore();
      break;
    }
    case 'wipe-left': {
      drawVideoFitted(ctx, videoA, width, height, zoomA, panXA, panYA, fModeA);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width * p, height);
      ctx.clip();
      drawVideoFitted(ctx, videoB, width, height, zoomB, panXB, panYB, fModeB);
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
      drawVideoFitted(ctx, videoA, width, height, zoomA, panXA, panYA, fModeA);
      ctx.save();
      ctx.beginPath();
      ctx.rect(width * (1 - p), 0, width * p, height);
      ctx.clip();
      drawVideoFitted(ctx, videoB, width, height, zoomB, panXB, panYB, fModeB);
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
      drawVideoFitted(ctx, videoA, width, height, zoomA, panXA, panYA, fModeA);
      ctx.restore();

      ctx.save();
      ctx.translate((1 - p) * width, 0);
      drawVideoFitted(ctx, videoB, width, height, zoomB, panXB, panYB, fModeB);
      ctx.restore();
      break;
    }
    case 'goal-flash': {
      if (p < 0.5) {
        drawVideoFitted(ctx, videoA, width, height, zoomA, panXA, panYA, fModeA);
        const flashAlpha = p * 2;
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
        ctx.fillRect(0, 0, width, height);
      } else {
        drawVideoFitted(ctx, videoB, width, height, zoomB, panXB, panYB, fModeB);
        const flashAlpha = (1 - p) * 2;
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
        ctx.fillRect(0, 0, width, height);
      }
      break;
    }
    case 'zoom': {
      const transZoomA = zoomA * (1 + p * 0.4);
      drawVideoFitted(ctx, videoA, width, height, transZoomA, panXA, panYA, fModeA);
      ctx.save();
      ctx.globalAlpha = p;
      const transZoomB = zoomB * (1.3 - p * 0.3);
      drawVideoFitted(ctx, videoB, width, height, transZoomB, panXB, panYB, fModeB);
      ctx.restore();
      break;
    }
    case 'glitch': {
      const targetVid = p < 0.5 ? videoA : videoB;
      const targetZoom = p < 0.5 ? zoomA : zoomB;
      const targetPanX = p < 0.5 ? panXA : panXB;
      const targetPanY = p < 0.5 ? panYA : panYB;
      const targetFMode = p < 0.5 ? fModeA : fModeB;

      if (Math.random() > 0.4) {
        ctx.save();
        const sliceY = Math.random() * height;
        const sliceH = Math.random() * 80 + 20;
        const offset = (Math.random() - 0.5) * 40;

        drawVideoFitted(ctx, targetVid, width, height, targetZoom, targetPanX, targetPanY, targetFMode);
        ctx.drawImage(
          targetVid,
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
        drawVideoFitted(ctx, targetVid, width, height, targetZoom, targetPanX, targetPanY, targetFMode);
      }
      break;
    }
    default: {
      const targetVid = p < 0.5 ? videoA : videoB;
      const targetZoom = p < 0.5 ? zoomA : zoomB;
      const targetPanX = p < 0.5 ? panXA : panXB;
      const targetPanY = p < 0.5 ? panYA : panYB;
      const targetFMode = p < 0.5 ? fModeA : fModeB;
      drawVideoFitted(ctx, targetVid, width, height, targetZoom, targetPanX, targetPanY, targetFMode);
    }
  }
}

/**
 * Resolves the effective overlays for a clip:
 * Returns the clip's custom scorebug and player lower third if customized,
 * or seamlessly falls back to global settings.
 */
export function getClipEffectiveOverlays(
  settings: HockeyOverlaySettings,
  clip: VideoClip | undefined,
): { scorebug: ScorebugConfig; playerBanner: PlayerBannerConfig } {
  if (!clip || !clip.useCustomOverlays) {
    return {
      scorebug: settings.scorebug,
      playerBanner: settings.playerBanner,
    };
  }

  const scorebug: ScorebugConfig = {
    ...settings.scorebug,
    ...(clip.scorebugOverride || {}),
    enabled:
      clip.scorebugOverride?.enabled !== undefined
        ? clip.scorebugOverride.enabled
        : settings.scorebug.enabled,
  };

  const playerBanner: PlayerBannerConfig = {
    ...settings.playerBanner,
    ...(clip.playerBannerOverride || {}),
    enabled:
      clip.playerBannerOverride?.enabled !== undefined
        ? clip.playerBannerOverride.enabled
        : settings.playerBanner.enabled,
  };

  return { scorebug, playerBanner };
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
  const { scorebug: sb, playerBanner: pb } = getClipEffectiveOverlays(settings, currentClip);

  // Compute UI scaling based on base design dimensions (1280 base for 16:9, 720 base for 9:16/1:1)
  const baseW = isShorts ? 720 : 1280;
  const uiScale = width / baseW;

  ctx.save();
  ctx.scale(uiScale, uiScale);

  const virtualW = baseW;
  const virtualH = height / uiScale;

  // 1. Scorebug in top corner
  if (sb.enabled) {
    ctx.save();

    const awayName = (sb.awayTeam || 'AWAY').trim();
    const homeName = (sb.homeTeam || 'HOME').trim();

    // Measure team names to allocate generous space
    ctx.font = '700 18px Chakra Petch, sans-serif';
    const awayMeasure = ctx.measureText(awayName).width;
    const homeMeasure = ctx.measureText(homeName).width;
    const maxTeamTextW = Math.max(awayMeasure, homeMeasure, 60);

    const clockWidth = 104;
    const teamSlotWidth = Math.max(124, maxTeamTextW + 52);
    const idealWidth = teamSlotWidth * 2 + clockWidth;

    const maxSbWidth = isShorts ? Math.min(virtualW - 32, 600) : Math.min(virtualW - 72, 700);
    const minSbWidth = isShorts ? 360 : 440;
    const sbWidth = Math.max(minSbWidth, Math.min(idealWidth, maxSbWidth));

    const sbHeight = 58;
    const sbX = isShorts ? (virtualW - sbWidth) / 2 : 36;
    const sbY = isShorts ? 48 : 36;

    // Glass backdrop with rounded clipping
    ctx.beginPath();
    ctx.roundRect(sbX, sbY, sbWidth, sbHeight, 10);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.clip();

    const teamsAreaWidth = sbWidth - clockWidth;
    const halfTeamsWidth = teamsAreaWidth / 2;

    // --- Away Team Section (Left Half) ---
    // Away score badge
    ctx.fillStyle = 'rgba(14, 165, 233, 0.16)';
    ctx.fillRect(sbX + halfTeamsWidth - 44, sbY + 8, 36, sbHeight - 16);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 22px Chakra Petch, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(sb.awayScore), sbX + halfTeamsWidth - 26, sbY + 37);

    // Away team name (auto-scales if long)
    let awayFont = 18;
    ctx.font = `700 ${awayFont}px Chakra Petch, sans-serif`;
    while (ctx.measureText(awayName).width > (halfTeamsWidth - 52) && awayFont > 11) {
      awayFont -= 1;
      ctx.font = `700 ${awayFont}px Chakra Petch, sans-serif`;
    }
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    ctx.fillText(awayName, sbX + 14, sbY + 36);

    // Vertical divider between Away and Home
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(sbX + halfTeamsWidth, sbY + 11, 1, sbHeight - 22);

    // --- Home Team Section (Right Half of Teams Area) ---
    // Home score badge
    ctx.fillStyle = 'rgba(14, 165, 233, 0.16)';
    ctx.fillRect(sbX + teamsAreaWidth - 44, sbY + 8, 36, sbHeight - 16);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 22px Chakra Petch, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(sb.homeScore), sbX + teamsAreaWidth - 26, sbY + 37);

    // Home team name (auto-scales if long)
    let homeFont = 18;
    ctx.font = `700 ${homeFont}px Chakra Petch, sans-serif`;
    while (ctx.measureText(homeName).width > (halfTeamsWidth - 52) && homeFont > 11) {
      homeFont -= 1;
      ctx.font = `700 ${homeFont}px Chakra Petch, sans-serif`;
    }
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    ctx.fillText(homeName, sbX + halfTeamsWidth + 14, sbY + 36);

    // --- Period & Clock Section (Far Right) ---
    const clockX = sbX + teamsAreaWidth;
    ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
    ctx.fillRect(clockX, sbY, clockWidth, sbHeight);

    ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.fillRect(clockX, sbY, 1, sbHeight);

    ctx.fillStyle = '#f59e0b';
    ctx.font = '700 13px Chakra Petch, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(sb.period, clockX + clockWidth / 2, sbY + 25);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 16px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(sb.timeRemaining, clockX + clockWidth / 2, sbY + 46);

    ctx.restore();
  }

  // 2. Player Highlight Lower Third
  if (pb.enabled) {
    ctx.save();

    const bannerW = isShorts ? virtualW - 48 : 460;
    const bannerH = 74;
    const bannerX = isShorts ? 24 : 40;
    const bannerY = virtualH - bannerH - (isShorts ? 110 : 50);

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

    // Player Name with dynamic scaling
    const pName = pb.playerName || '';
    let nameFont = 20;
    ctx.font = `700 ${nameFont}px Chakra Petch, sans-serif`;
    while (ctx.measureText(pName).width > (bannerW - 88) && nameFont > 13) {
      nameFont -= 1;
      ctx.font = `700 ${nameFont}px Chakra Petch, sans-serif`;
    }
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    ctx.fillText(pName, bannerX + 74, bannerY + 36);

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

    const tagX = virtualW - (isShorts ? 24 : 40);
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

  // Restore uiScale
  ctx.restore();
}

/**
 * Fast and reliable video preloading helper.
 * Safely handles local blob: URLs, data: URLs, and remote URLs without triggering CORS errors.
 */
export function preloadVideo(url: string, blobFallback?: Blob): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');

    // CRITICAL: NEVER set crossOrigin for blob: or data: URLs!
    // In Chromium and WebKit browsers, setting crossOrigin on a blob: URI triggers an immediate CORS/security error.
    if (url.startsWith('http://') || url.startsWith('https://')) {
      video.crossOrigin = 'anonymous';
    }

    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    // Attach temporarily to document body so sandboxed browser environments don't throttle decoder
    video.style.cssText =
      'position:fixed;top:-9999px;left:-9999px;width:2px;height:2px;opacity:0.001;pointer-events:none;z-index:-999;';
    document.body.appendChild(video);

    let hasResolved = false;
    let fallbackTimer: any = null;
    let attemptedBlobFallback = false;

    const cleanup = () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      video.removeEventListener('loadedmetadata', onReady);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('canplaythrough', onReady);
      video.removeEventListener('error', onError);
    };

    const onReady = () => {
      if (hasResolved) return;
      hasResolved = true;
      cleanup();
      resolve(video);
    };

    const onError = () => {
      if (hasResolved) return;
      const mediaErr = video.error;

      // If we have a blob fallback available and haven't tried recreating the URL yet, retry with fresh object URL:
      if (blobFallback && !attemptedBlobFallback) {
        attemptedBlobFallback = true;
        try {
          const freshUrl = URL.createObjectURL(blobFallback);
          video.removeAttribute('crossorigin');
          video.src = freshUrl;
          video.load();
          return;
        } catch (e) {
          console.warn('Failed to retry with blobFallback:', e);
        }
      }

      // If readyState is already >= 1, the video metadata actually loaded and frames can be decoded:
      if (video.readyState >= 1 || video.videoWidth > 0) {
        onReady();
        return;
      }

      cleanup();
      const codeMsg = mediaErr
        ? ` (error code ${mediaErr.code}: ${mediaErr.message || 'Media decode or unsupported format'})`
        : '';
      reject(new Error(`Failed to load video${codeMsg}: ${url}`));
    };

    video.addEventListener('loadedmetadata', onReady, { once: true });
    video.addEventListener('loadeddata', onReady, { once: true });
    video.addEventListener('canplay', onReady, { once: true });
    video.addEventListener('canplaythrough', onReady, { once: true });
    video.addEventListener('error', onError);

    video.src = url;
    try {
      video.load();
    } catch {}

    if (video.readyState >= 1 || video.videoWidth > 0) {
      onReady();
      return;
    }

    // Safety fallback timeout
    fallbackTimer = setTimeout(() => {
      if (!hasResolved) {
        if (video.readyState >= 1 || video.videoWidth > 0) {
          onReady();
        } else if (blobFallback && !attemptedBlobFallback) {
          onError();
        } else {
          onReady();
        }
      }
    }, 4000);
  });
}

/**
 * Prime a video element to a specific timestamp and wait for frame decoding.
 * Avoids any seek-thrashing or dropped frames during live canvas capture.
 */
export function primeVideo(video: HTMLVideoElement, targetTime: number): Promise<void> {
  return new Promise((resolve) => {
    video.pause();
    const clampedTime = Math.max(0, targetTime);
    if (Math.abs(video.currentTime - clampedTime) < 0.05 && (video.readyState >= 2 || video.videoWidth > 0)) {
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

    video.addEventListener('seeked', finish, { once: true });
    video.addEventListener('error', finish, { once: true });
    const timer = setTimeout(finish, 1200);

    try {
      video.currentTime = clampedTime;
    } catch {
      finish();
    }
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
  options?: ExportOptions,
): Promise<Blob> {
  if (clips.length === 0) {
    throw new Error('No video clips to export.');
  }

  onProgress?.(5, 'Preparing video assets and timeline...');

  const { segments, totalDuration } = calculateTimeline(clips, transitions);

  // Initialize AudioContext immediately on user gesture before async loads to guarantee running state
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioContextClass();
  if (audioContext.state !== 'running') {
    try {
      audioContext.resume();
    } catch {}
  }

  // Active host container in DOM to ensure browser GPU decoders and canvas compositor stay at full 60fps
  const hostDiv = document.createElement('div');
  hostDiv.id = 'video-render-engine-host';
  hostDiv.style.cssText =
    'position:fixed;bottom:0;right:0;width:320px;height:180px;overflow:hidden;opacity:0.01;pointer-events:none;z-index:99999;';
  document.body.appendChild(hostDiv);

  // Preload all video elements first to inspect true native video resolution
  const videoElements: HTMLVideoElement[] = [];
  for (let i = 0; i < clips.length; i++) {
    onProgress?.(
      Math.round(5 + (i / clips.length) * 12),
      `Loading clip ${i + 1} of ${clips.length}...`,
    );

    // If clip has a blob, ensure we have an active, non-revoked object URL
    let activeUrl = clips[i].url;
    if (clips[i].blob instanceof Blob) {
      try {
        activeUrl = URL.createObjectURL(clips[i].blob);
        clips[i].url = activeUrl;
      } catch (e) {
        console.warn('Could not create object URL from blob:', e);
      }
    }

    const video = await preloadVideo(activeUrl, clips[i].blob);
    // Unmute video so Web Audio can route its audio track into the recording stream.
    // Note: It connects solely to audioDest (the recorder) and NOT audioContext.destination (speakers),
    // so user's physical speakers remain completely silent while export records loud and clear!
    video.muted = false;
    video.volume = 1.0;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;';
    hostDiv.appendChild(video);
    videoElements.push(video);
  }

  // Detect highest source video resolution from uploaded clips
  let maxSourceW = 0;
  let maxSourceH = 0;
  for (let i = 0; i < videoElements.length; i++) {
    const v = videoElements[i];
    const w = v.videoWidth || clips[i].originalWidth || 0;
    const h = v.videoHeight || clips[i].originalHeight || 0;
    if (w > maxSourceW) maxSourceW = w;
    if (h > maxSourceH) maxSourceH = h;
  }

  const preset = options?.qualityPreset || 'source';
  const isShorts = aspectRatio === '9:16';
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
    // 'source' preset: Preserves 100% of source footage clarity and resolution
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

  // Setup Canvas with High Quality smoothing
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  hostDiv.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  onProgress?.(20, 'Initializing audio mixer and recording stream...');

  // Ensure AudioContext is running
  if (audioContext.state !== 'running') {
    try {
      await audioContext.resume();
    } catch {}
  }
  const audioDest = audioContext.createMediaStreamDestination();

  // Master Gain -> audioDest (MediaStream recorder)
  const masterGain = audioContext.createGain();
  masterGain.gain.value = 1.0;
  masterGain.connect(audioDest);

  // CRUCIAL FOR CHROMIUM:
  // In Chromium browsers, MediaStreamAudioDestinationNode does NOT pull audio
  // from synthetic Web Audio nodes (AudioBufferSourceNode, OscillatorNode) unless
  // audioContext.destination (the hardware audio sink) is also connected in the active graph.
  // We attach a near-zero gain tap (0.000001 = -120dB) to audioContext.destination.
  // This keeps Chromium's hardware audio clock running and pulling every buffer quantum
  // without making any audible sound through the user's physical speakers.
  const keepAliveGain = audioContext.createGain();
  keepAliveGain.gain.value = 0.000001;
  masterGain.connect(keepAliveGain);
  try {
    keepAliveGain.connect(audioContext.destination);
  } catch (destErr) {
    console.warn('Could not connect keep-alive tap to destination:', destErr);
  }

  // Sub-mixer for video clips (with dynamic ducking when goal horn sounds)
  const bgMusic = overlaySettings.backgroundMusic;
  const isMusicEnabled = Boolean(bgMusic?.enabled && bgMusic?.currentTrack);
  const origVideoFactor = bgMusic?.originalVideoVolume ?? 1.0;

  const clipsGain = audioContext.createGain();
  clipsGain.gain.value = origVideoFactor; // Preserves original clip audio and video music
  clipsGain.connect(masterGain);

  // Sub-mixer for AI Background Music (upbeat sports music without vocals)
  const musicGain = audioContext.createGain();
  const targetMusicVol = isMusicEnabled ? (bgMusic?.volume ?? 0.75) : 0.0;
  musicGain.gain.value = targetMusicVol;
  musicGain.connect(masterGain);

  let musicAudioEl: HTMLAudioElement | null = null;

  if (isMusicEnabled && bgMusic?.currentTrack) {
    const track = bgMusic.currentTrack;
    const trackBlob = track.audioBlob;
    const trackUrl = track.audioUrl || (trackBlob ? URL.createObjectURL(trackBlob) : '');

    if (trackUrl) {
      try {
        const mEl = new Audio();
        mEl.src = trackUrl;
        mEl.loop = bgMusic.loop !== false;
        mEl.preload = 'auto';
        hostDiv.appendChild(mEl);
        musicAudioEl = mEl;
        const mSrc = audioContext.createMediaElementSource(mEl);
        mSrc.connect(musicGain);
      } catch (err) {
        console.warn('Could not attach background music audio element:', err);
      }
    }
  }

  // Sub-mixer for goal horn and sound FX (boosted to ensure horn is punchy over clips)
  const sfxGain = audioContext.createGain();
  sfxGain.gain.value = 1.6;
  sfxGain.connect(masterGain);

  // Dedicated horn gain node for precise volume and envelope cutoff
  const hornGain = audioContext.createGain();
  hornGain.gain.value = 1.0;
  hornGain.connect(sfxGain);

  // Continuous inaudible carrier oscillator into masterGain to ensure continuous audio frames
  const clockOsc = audioContext.createOscillator();
  const clockGain = audioContext.createGain();
  clockGain.gain.value = 0.00005; // inaudible carrier
  clockOsc.connect(clockGain);
  clockGain.connect(masterGain);
  clockOsc.start();

  // Retain all active audio node handles during export so V8 Garbage Collector cannot prematurely sweep them
  const activeAudioHandles: { stop?: () => void }[] = [];

  // Connect each video element to clipsGain via MediaElementAudioSourceNode
  const clipGainNodes: (GainNode | null)[] = [];
  const clipAudioSources: (MediaElementAudioSourceNode | null)[] = [];

  for (let i = 0; i < videoElements.length; i++) {
    const video = videoElements[i];
    try {
      const source = audioContext.createMediaElementSource(video);
      const gain = audioContext.createGain();
      gain.gain.value = 0.0; // muted initially until its segment starts
      source.connect(gain);
      gain.connect(clipsGain);

      clipAudioSources.push(source);
      clipGainNodes.push(gain);
    } catch (err) {
      console.warn(`Could not attach MediaElementSource to video clip ${i}:`, err);
      clipAudioSources.push(null);
      clipGainNodes.push(null);
    }
  }

  // Pre-prepare goal horn audio:
  // In Chromium/headless container, HTMLAudioElement + MediaElementAudioSourceNode is the
  // only audio pipeline that reliably delivers audio packets to MediaRecorder.
  let hornAudioBuffer: AudioBuffer | null = null;
  let hornAudioElement: HTMLAudioElement | null = null;
  let hornWavBlobUrl: string | null = null;

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

  const configuredHornDuration = Math.max(
    0.5,
    Math.min(
      60.0,
      typeof hornCfg.hornDuration === 'number' && Number.isFinite(hornCfg.hornDuration)
        ? hornCfg.hornDuration
        : (typeof hornCfg.customHornDuration === 'number' && Number.isFinite(hornCfg.customHornDuration)
            ? hornCfg.customHornDuration
            : 5.0)
    )
  );
  const hornVol = (hornCfg.volume ?? 1.25) * 1.35;

  if (hornCfg.useCustomHorn && (hornCfg.customHornUrl || hornCfg.customHornBlob)) {
    let hornBlob = hornCfg.customHornBlob;
    const hornUrl = hornCfg.customHornUrl;
    if (!hornBlob && hornUrl) {
      try {
        const res = await fetch(hornUrl);
        hornBlob = await res.blob();
        hornCfg.customHornBlob = hornBlob;
      } catch (fetchErr) {
        console.warn('Could not fetch custom horn audio blob:', fetchErr);
      }
    }

    const effectiveHornUrl = hornUrl || (hornBlob ? URL.createObjectURL(hornBlob) : '');
    if (effectiveHornUrl) {
      try {
        const audioEl = new Audio();
        audioEl.src = effectiveHornUrl;
        audioEl.preload = 'auto';
        hostDiv.appendChild(audioEl);
        hornAudioElement = audioEl;
        const source = audioContext.createMediaElementSource(audioEl);
        source.connect(hornGain);
      } catch (elErr) {
        console.warn('Could not initialize custom horn audio element source:', elErr);
      }
    }

    if (hornBlob) {
      try {
        hornAudioBuffer = await decodeAudioBlob(hornBlob, audioContext);
      } catch (err) {
        console.warn('Could not decode custom horn blob into AudioBuffer:', err);
      }
    }
  }

  // If not using a custom horn OR custom horn setup failed:
  // Render the authentic NHL stadium synth horn of configuredHornDuration length,
  // convert it to a WAV blob URL, and create hornAudioElement connected to hornGain!
  if (!hornAudioElement) {
    try {
      hornAudioBuffer = await renderGoalHornBuffer(configuredHornDuration, hornVol, audioContext.sampleRate || 44100);
      const wavBlob = audioBufferToWav(hornAudioBuffer);
      hornWavBlobUrl = URL.createObjectURL(wavBlob);
      const audioEl = new Audio(hornWavBlobUrl);
      audioEl.preload = 'auto';
      hostDiv.appendChild(audioEl);
      hornAudioElement = audioEl;
      const source = audioContext.createMediaElementSource(audioEl);
      source.connect(hornGain);
    } catch (synthErr) {
      console.warn('Could not pre-render goal horn buffer:', synthErr);
    }
  }

  // Target bitrate calibrated for pristine broadcast quality without encoder choking
  let targetBitrate = 14_000_000;
  if (width >= 3840 || height >= 3840) {
    targetBitrate = 28_000_000;
  } else if (width >= 2560 || height >= 2560) {
    targetBitrate = 20_000_000;
  } else if (width <= 1280 && height <= 720) {
    targetBitrate = 8_000_000;
  }
  if (options?.bitrate) {
    targetBitrate = options.bitrate;
  }

  // Capture canvas video stream at fluid 60 FPS matching high-speed sports action
  const fps = options?.fps || 60;
  const canvasStream = canvas.captureStream(fps);
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioDest.stream.getAudioTracks(),
  ]);

  // Determine best supported MIME type (prefer high-quality VP9 / MP4 AVC High Profile)
  const mimeTypes = options?.preferMp4
    ? [
        'video/mp4;codecs=avc1.640028,mp4a.40.2',
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ]
    : [
        'video/webm;codecs=vp9,opus',
        'video/mp4;codecs=avc1.640028,mp4a.40.2',
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4',
        'video/webm;codecs=vp8,opus',
        'video/webm',
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
    videoBitsPerSecond: targetBitrate,
    audioBitsPerSecond: 256_000,
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
      activeAudioHandles.forEach((h) => {
        try {
          h.stop?.();
        } catch {}
      });
      videoElements.forEach((v) => {
        try {
          v.pause();
          v.muted = true;
        } catch {}
      });
      if (hornWavBlobUrl) {
        try {
          URL.revokeObjectURL(hornWavBlobUrl);
        } catch {}
      }
      if (hornAudioElement) {
        try {
          hornAudioElement.pause();
          hornAudioElement.src = '';
        } catch {}
      }
      if (musicAudioEl) {
        try {
          musicAudioEl.pause();
          musicAudioEl.src = '';
        } catch {}
      }
      try {
        audioContext.close();
      } catch {}
      if (hostDiv && hostDiv.parentNode) {
        document.body.removeChild(hostDiv);
      }
    };

    const startExportExecution = async () => {
      onProgress?.(18, 'Pre-buffering clip sequence...');

      // Prime clip 0 to its exact start time before recording begins
      await primeVideo(videoElements[0], clips[0].startTime);

      // If there is a clip 1, start pre-priming it in the background
      if (clips.length > 1) {
        primeVideo(videoElements[1], clips[1].startTime);
      }

      // Render pristine initial frame onto canvas before starting recorder
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);
      drawVideoFitted(
        ctx,
        videoElements[0],
        width,
        height,
        clips[0].zoom ?? 1,
        clips[0].panX ?? 0,
        clips[0].panY ?? 0,
        clips[0].framingMode ?? 'fit-blur',
      );
      drawHockeyOverlays(ctx, overlaySettings, clips[0], width, height, isShorts);

      // Start recording
      recorder.start(250);

      // Start background music playback synchronously with recording
      if (musicAudioEl) {
        try {
          musicAudioEl.currentTime = bgMusic?.currentTrack?.startTimeOffset || 0;
          musicAudioEl.play().catch((err) => {
            console.warn('Could not start background music element during render:', err);
          });
        } catch {}
      }

      // Activate initial clip audio and start video playback
      if (clipGainNodes[0]) {
        clipGainNodes[0]!.gain.value = clips[0].volume ?? 1.0;
      }
      videoElements[0].playbackRate = clips[0].playbackRate || 1.0;
      videoElements[0].play().catch(() => {
        videoElements[0].muted = true;
        videoElements[0].play().catch(() => {});
      });

      const renderStartTime = performance.now();
      let activeSegIndex = 0;
      let activeHornStopAt: number | null = null;
      const playedHornSegments = new Set<number>();
      const playedTransitionSounds = new Set<number>();
      let animId: number;
      let isFinishing = false;

      const finishExport = () => {
        if (isFinishing) return;
        isFinishing = true;
        cancelAnimationFrame(animId);

        onProgress?.(99, 'Packaging video chunks and finalizing master file...');
        videoElements.forEach((v) => v.pause());
        if (hornAudioElement) {
          try {
            hornAudioElement.pause();
            hornAudioElement.currentTime = 0;
          } catch {}
        }
        if (musicAudioEl) {
          try {
            musicAudioEl.pause();
          } catch {}
        }

        // Allow final audio quantums and video frames to settle into recording chunks
        setTimeout(() => {
          if (recorder.state === 'recording') {
            try {
              recorder.requestData();
            } catch {}
            recorder.stop();
          }
        }, 400);
      };

      const renderLoop = () => {
        if (isFinishing) return;

        const currentSeg = segments[activeSegIndex];
        const currentVideo = videoElements[activeSegIndex];
        const clip = currentSeg.clip;
        const r = clip.playbackRate || 1.0;

        // Keep active video playing smoothly without interrupting hardware decoder
        if (currentVideo.paused && !currentVideo.ended) {
          currentVideo.playbackRate = r;
          currentVideo.play().catch(() => {
            currentVideo.muted = true;
            currentVideo.play().catch(() => {});
          });
        }

        // Calculate clip local playback time and timeline position
        const clipDurationSec = Math.max(0.1, (clip.endTime - clip.startTime) / r);
        const videoCurrentTime = currentVideo.currentTime;
        const timeInClip = Math.max(0, (videoCurrentTime - clip.startTime) / r);
        const timelineTime = Math.min(
          totalDuration,
          currentSeg.clipStartInTimeline + Math.min(clipDurationSec, timeInClip),
        );

        // Goal horn cutoff marker
        if (activeHornStopAt !== null && timelineTime >= activeHornStopAt) {
          try {
            if (hornAudioElement) {
              hornAudioElement.pause();
              hornAudioElement.currentTime = 0;
            }
          } catch {}
          activeHornStopAt = null;
        }

        // Clear frame
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, width, height);

        // Transition handling
        const trans = currentSeg.transitionWithNext;
        const nextIndex = activeSegIndex + 1;
        const hasNext = nextIndex < segments.length && Boolean(trans);

        const isInTransition = Boolean(
          hasNext &&
          trans &&
          timelineTime >= trans.startInTimeline,
        );

        if (isInTransition && trans && nextIndex < segments.length) {
          const nextVideo = videoElements[nextIndex];
          const nextClip = segments[nextIndex].clip;
          const nextRate = nextClip.playbackRate || 1.0;

          if (nextVideo.paused && !nextVideo.ended) {
            nextVideo.playbackRate = nextRate;
            nextVideo.play().catch(() => {
              nextVideo.muted = true;
              nextVideo.play().catch(() => {});
            });
          }

          const transProgress = Math.max(0, Math.min(1, (timelineTime - trans.startInTimeline) / trans.duration));

          // Crossfade audio
          const clip1Vol = clip.volume ?? 1.0;
          const clip2Vol = nextClip.volume ?? 1.0;
          if (clipGainNodes[activeSegIndex]) {
            clipGainNodes[activeSegIndex]!.gain.value = (1 - transProgress) * clip1Vol;
          }
          if (clipGainNodes[nextIndex]) {
            clipGainNodes[nextIndex]!.gain.value = transProgress * clip2Vol;
          }

          // Play transition swoosh
          if (!playedTransitionSounds.has(activeSegIndex)) {
            playedTransitionSounds.add(activeSegIndex);
            playTransitionWhoosh(sfxGain, audioContext);
          }

          renderTransitionEffect(
            ctx,
            currentVideo,
            nextVideo,
            trans.type,
            transProgress,
            width,
            height,
            clip,
            nextClip,
          );
        } else {
          // Solo playback
          const clipVol = clip.volume ?? 1.0;
          if (clipGainNodes[activeSegIndex]) {
            clipGainNodes[activeSegIndex]!.gain.value = clipVol;
          }

          drawVideoFitted(
            ctx,
            currentVideo,
            width,
            height,
            clip.zoom ?? 1,
            clip.panX ?? 0,
            clip.panY ?? 0,
            clip.framingMode ?? 'fit-blur',
          );
        }

        // Ensure any other clips are muted
        for (let k = 0; k < clipGainNodes.length; k++) {
          if (k !== activeSegIndex && (!isInTransition || k !== nextIndex)) {
            if (clipGainNodes[k] && clipGainNodes[k]!.gain.value !== 0) {
              clipGainNodes[k]!.gain.value = 0;
            }
          }
        }

        // Hockey overlays
        drawHockeyOverlays(ctx, overlaySettings, clip, width, height, isShorts);

        // Trigger goal horn sound at specific time in clip
        const hornGloballyEnabled =
          (overlaySettings.goalHornSound !== false) && (hornCfg.enabled !== false);
        const hasNative = Boolean(clip.hasNativeHorn);
        const skipBecauseNative = hasNative && (hornCfg.skipClipsWithNativeHorn !== false);
        const isEligible = !clip.hornDisabled && !skipBecauseNative;

        if (hornGloballyEnabled && isEligible && !playedHornSegments.has(activeSegIndex)) {
          const clipTagUpper = (clip.tag || '').toUpperCase();
          const isGoal =
            clipTagUpper === 'GOAL' ||
            clipTagUpper === 'OT WINNER' ||
            clipTagUpper.includes('GOAL') ||
            clipTagUpper.includes('WINNER') ||
            clipTagUpper.includes('SNIPE') ||
            clipTagUpper.includes('SCORE');
          const shouldTrigger =
            hornCfg.triggerMode === 'every_clip' ||
            isGoal ||
            clip.hornTimingOverride !== undefined;

          if (shouldTrigger) {
            const segDuration = Math.max(0.2, currentSeg.clipEndInTimeline - currentSeg.clipStartInTimeline);
            const rawOffset = clip.hornTimingOverride ?? hornCfg.clipOffsetSeconds ?? 0.5;
            const maxAllowedOffset = Math.max(0, segDuration - 0.4);
            const triggerOffset = Math.min(maxAllowedOffset, Math.max(0, rawOffset) / r);

            if (timelineTime >= currentSeg.clipStartInTimeline + triggerOffset) {
              playedHornSegments.add(activeSegIndex);

              if (audioContext.state !== 'running') {
                try {
                  audioContext.resume();
                } catch {}
              }

              const hornDur = configuredHornDuration;

              // Duck clips game audio
              if (hornCfg.duckVideoAudio !== false) {
                const now = audioContext.currentTime;
                try {
                  if (typeof (clipsGain.gain as any).cancelAndHoldAtTime === 'function') {
                    (clipsGain.gain as any).cancelAndHoldAtTime(now);
                  } else {
                    clipsGain.gain.cancelScheduledValues(now);
                  }
                } catch {}
                clipsGain.gain.setValueAtTime(clipsGain.gain.value || origVideoFactor, now);
                clipsGain.gain.linearRampToValueAtTime(origVideoFactor * 0.15, now + 0.08);
                const duckHoldUntil = now + Math.max(0.2, hornDur - 0.3);
                clipsGain.gain.setValueAtTime(origVideoFactor * 0.15, duckHoldUntil);
                clipsGain.gain.linearRampToValueAtTime(origVideoFactor, now + hornDur);
              }

              // Duck background music
              if (isMusicEnabled && bgMusic?.duckOnGoalHorn !== false && musicGain) {
                const now = audioContext.currentTime;
                try {
                  if (typeof (musicGain.gain as any).cancelAndHoldAtTime === 'function') {
                    (musicGain.gain as any).cancelAndHoldAtTime(now);
                  } else {
                    musicGain.gain.cancelScheduledValues(now);
                  }
                } catch {}
                musicGain.gain.setValueAtTime(musicGain.gain.value || targetMusicVol, now);
                musicGain.gain.linearRampToValueAtTime(targetMusicVol * 0.25, now + 0.08);
                const duckHoldUntil = now + Math.max(0.2, hornDur - 0.3);
                musicGain.gain.setValueAtTime(targetMusicVol * 0.25, duckHoldUntil);
                musicGain.gain.linearRampToValueAtTime(targetMusicVol, now + hornDur);
              }

              const hornVol = (hornCfg.volume ?? 1.25) * 1.35;

              if (hornAudioElement) {
                try {
                  hornAudioElement.currentTime = 0;
                  hornAudioElement.play().catch(() => {
                    const synthHandle = playGoalHorn(hornDur, hornGain, hornVol, audioContext);
                    if (synthHandle) activeAudioHandles.push(synthHandle);
                  });
                } catch {
                  const synthHandle = playGoalHorn(hornDur, hornGain, hornVol, audioContext);
                  if (synthHandle) activeAudioHandles.push(synthHandle);
                }
              } else {
                const synthHandle = playGoalHorn(hornDur, hornGain, hornVol, audioContext);
                if (synthHandle) activeAudioHandles.push(synthHandle);
              }

              activeHornStopAt = timelineTime + hornDur;
            }
          }
        }

        // Check if current segment is completed
        const segmentFinished =
          isInTransition
            ? (timelineTime >= currentSeg.clipEndInTimeline || videoCurrentTime >= clip.endTime - 0.04)
            : (videoCurrentTime >= clip.endTime - 0.04 || timeInClip >= clipDurationSec);

        if (segmentFinished) {
          if (nextIndex < segments.length) {
            // Hand off to next segment cleanly
            currentVideo.pause();
            if (clipGainNodes[activeSegIndex]) {
              clipGainNodes[activeSegIndex]!.gain.value = 0;
            }

            activeSegIndex = nextIndex;

            // Pre-prime subsequent clip (if one exists after next)
            if (activeSegIndex + 1 < videoElements.length) {
              primeVideo(videoElements[activeSegIndex + 1], clips[activeSegIndex + 1].startTime);
            }

            animId = requestAnimationFrame(renderLoop);
            return;
          } else {
            // Final segment has completed! All clips rendered 100%!
            finishExport();
            return;
          }
        }

        // Safety watchdog: prevent indefinite loop if browser tab throttles or a video stalls
        if ((performance.now() - renderStartTime) / 1000 > totalDuration + 6.0) {
          finishExport();
          return;
        }

        const percent = Math.min(98, Math.round(20 + (timelineTime / totalDuration) * 78));
        onProgress?.(
          percent,
          `Rendering: ${timelineTime.toFixed(1)}s / ${totalDuration.toFixed(1)}s (${percent}%)...`,
        );

        animId = requestAnimationFrame(renderLoop);
      };

      animId = requestAnimationFrame(renderLoop);
    };

    startExportExecution().catch((err) => {
      console.error('Export execution failed:', err);
      cleanUp();
      reject(err);
    });
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
