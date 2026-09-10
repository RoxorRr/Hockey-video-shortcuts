import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AspectRatio, HockeyOverlaySettings, Transition, VideoClip } from '../types';
import {
  calculateTimeline,
  drawHockeyOverlays,
  drawVideoFitted,
  preloadVideo,
  renderTransitionEffect,
} from '../lib/videoRenderer';
import { playHornSound } from '../lib/audio';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Sparkles,
  Plus,
  ZoomIn,
  ZoomOut,
  Crosshair,
} from 'lucide-react';

interface VideoPlayerProps {
  clips: VideoClip[];
  transitions: Transition[];
  overlaySettings: HockeyOverlaySettings;
  aspectRatio: AspectRatio;
  onAddSampleClips: () => void;
  onOpenUploadDialog: () => void;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onUpdateClip?: (index: number, updated: VideoClip) => void;
  selectedClipIndex?: number | null;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  clips,
  transitions,
  overlaySettings,
  aspectRatio,
  onAddSampleClips,
  onOpenUploadDialog,
  currentTime,
  onTimeUpdate,
  onUpdateClip,
  selectedClipIndex,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoElementsRef = useRef<HTMLVideoElement[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const playedHornClipIndicesRef = useRef<Set<number>>(new Set());
  const activeHornStopRef = useRef<(() => void) | null>(null);
  const isDuckingAudioRef = useRef<boolean>(false);
  const currentTimeRef = useRef<number>(currentTime);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const { segments, totalDuration } = calculateTimeline(clips, transitions);

  // Preload videos when clips change
  useEffect(() => {
    let isCancelled = false;
    videoElementsRef.current.forEach((v) => {
      v.pause();
      v.src = '';
    });
    videoElementsRef.current = [];

    const loadAll = async () => {
      const elements: HTMLVideoElement[] = [];
      for (const clip of clips) {
        try {
          let activeUrl = clip.url;
          if (clip.blob instanceof Blob && (!activeUrl || activeUrl.startsWith('blob:'))) {
            try {
              activeUrl = URL.createObjectURL(clip.blob);
              clip.url = activeUrl;
            } catch {}
          }
          const v = await preloadVideo(activeUrl, clip.blob);
          v.volume = isMuted ? 0 : clip.volume;
          elements.push(v);
        } catch (err) {
          console.error('Error preloading video:', clip.name, err);
        }
      }
      if (!isCancelled) {
        videoElementsRef.current = elements;
        renderAtTime(currentTime);
      }
    };

    if (clips.length > 0) {
      loadAll();
    }

    return () => {
      isCancelled = true;
    };
  }, [clips]);

  // Sync mute state to video elements
  useEffect(() => {
    videoElementsRef.current.forEach((v, i) => {
      v.volume = isMuted ? 0 : (clips[i]?.volume ?? 1);
    });
  }, [isMuted, clips]);

  // Render frame at a specific timeline timestamp
  const renderAtTime = useCallback(
    (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas || clips.length === 0 || segments.length === 0) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const isShorts = aspectRatio === '9:16';

      // Clamp time
      const clampedTime = Math.max(0, Math.min(time, totalDuration));

      // Find active segment
      let activeIndex = segments.findIndex(
        (seg) => clampedTime >= seg.clipStartInTimeline && clampedTime <= seg.clipEndInTimeline,
      );
      if (activeIndex === -1) {
        activeIndex = clampedTime >= totalDuration ? segments.length - 1 : 0;
      }

      const seg = segments[activeIndex];
      const video = videoElementsRef.current[activeIndex];
      const clip = seg.clip;

      // Clear canvas
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      if (video && video.readyState >= 2) {
        // Calculate clip source time
        const timeInClip = (clampedTime - seg.clipStartInTimeline) * clip.playbackRate;
        const videoCurrentTime = Math.min(clip.endTime, clip.startTime + timeInClip);
        if (Math.abs(video.currentTime - videoCurrentTime) > 0.08) {
          video.currentTime = videoCurrentTime;
        }

        if (isPlaying && !isMuted) {
          const baseVol = clip.volume ?? 1.0;
          const vol = isDuckingAudioRef.current ? baseVol * 0.15 : baseVol;
          if (video.volume !== vol) video.volume = vol;
          if (video.muted) video.muted = false;
          if (video.paused) {
            video.play().catch(() => {});
          }
        } else {
          if (!video.paused) video.pause();
        }

        // Pause all other video elements to prevent background audio leaks
        videoElementsRef.current.forEach((v, idx) => {
          if (idx !== activeIndex && !v.paused) {
            try {
              v.pause();
            } catch {}
          }
        });

        // Check if currently inside transition with next clip
        if (
          seg.transitionWithNext &&
          clampedTime >= seg.transitionWithNext.startInTimeline &&
          activeIndex + 1 < segments.length
        ) {
          const trans = seg.transitionWithNext;
          const nextVideo = videoElementsRef.current[activeIndex + 1];
          const nextClip = segments[activeIndex + 1].clip;

          if (nextVideo && nextVideo.readyState >= 2) {
            const transProgress = (clampedTime - trans.startInTimeline) / trans.duration;
            const nextTimeInClip = (clampedTime - trans.startInTimeline) * nextClip.playbackRate;
            nextVideo.currentTime = Math.min(nextClip.endTime, nextClip.startTime + nextTimeInClip);

            renderTransitionEffect(
              ctx,
              video,
              nextVideo,
              trans.type,
              transProgress,
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
            );
          }
        } else {
          drawVideoFitted(
            ctx,
            video,
            width,
            height,
            clip.zoom ?? 1,
            clip.panX ?? 0,
            clip.panY ?? 0,
          );
        }
      } else {
        // Video loading or placeholder
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, width, height);
      }

      // Draw Hockey Overlays
      drawHockeyOverlays(ctx, overlaySettings, clip, width, height, isShorts);
    },
    [clips, segments, totalDuration, overlaySettings, aspectRatio],
  );

  // Playback Loop
  useEffect(() => {
    if (!isPlaying) {
      lastTimestampRef.current = null;
      if (activeHornStopRef.current) {
        activeHornStopRef.current();
        activeHornStopRef.current = null;
      }
      isDuckingAudioRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const step = (timestamp: number) => {
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
      }
      const rawDelta = (timestamp - lastTimestampRef.current) / 1000;
      const delta = Math.min(rawDelta, 0.1); // Guard against giant delta jumps
      lastTimestampRef.current = timestamp;

      let nextTime = currentTimeRef.current + delta;
      if (nextTime >= totalDuration) {
        currentTimeRef.current = 0;
        setIsPlaying(false);
        lastTimestampRef.current = null;
        if (activeHornStopRef.current) {
          activeHornStopRef.current();
          activeHornStopRef.current = null;
        }
        isDuckingAudioRef.current = false;
        onTimeUpdate(0);
        renderAtTime(0);
        playedHornClipIndicesRef.current.clear();
        return;
      }

      currentTimeRef.current = nextTime;

      // Check for horn trigger in active clip
      const hornCfg = overlaySettings.hornConfig || {
        enabled: overlaySettings.goalHornSound,
        useCustomHorn: false,
        triggerMode: 'every_clip' as const,
        clipOffsetSeconds: 0.5,
        volume: 1.0,
        hornDuration: 5.0,
        skipClipsWithNativeHorn: true,
        duckVideoAudio: true,
      };

      const hornEnabled = overlaySettings.goalHornSound && (hornCfg.enabled ?? true);
      if (hornEnabled && !isMuted) {
        const activeIdx = segments.findIndex(
          (seg) => nextTime >= seg.clipStartInTimeline && nextTime <= seg.clipEndInTimeline,
        );
        if (activeIdx !== -1) {
          const activeSeg = segments[activeIdx];
          const activeClip = activeSeg.clip;

          // Check native horn conflict prevention
          const hasNative = Boolean(activeClip.hasNativeHorn);
          const skipBecauseNative = hasNative && (hornCfg.skipClipsWithNativeHorn !== false);
          const isEligible = !activeClip.hornDisabled && !skipBecauseNative;

          if (isEligible && !playedHornClipIndicesRef.current.has(activeIdx)) {
            const isGoal = activeClip.tag === 'GOAL';
            const shouldTrigger = hornCfg.triggerMode === 'every_clip' || isGoal;

            if (shouldTrigger) {
              const rawOffset = activeClip.hornTimingOverride ?? hornCfg.clipOffsetSeconds ?? 0.5;
              const triggerOffset = Math.max(0, rawOffset) / (activeClip.playbackRate || 1.0);

              if (nextTime >= activeSeg.clipStartInTimeline + triggerOffset) {
                playedHornClipIndicesRef.current.add(activeIdx);

                // Duck native video background audio if enabled
                if (hornCfg.duckVideoAudio) {
                  isDuckingAudioRef.current = true;
                  const dur = hornCfg.hornDuration ?? hornCfg.customHornDuration ?? 5.0;
                  setTimeout(() => {
                    isDuckingAudioRef.current = false;
                  }, dur * 1000);
                }

                playHornSound(hornCfg).then(({ stop }) => {
                  activeHornStopRef.current = stop;
                });
              }
            }
          }
        }
      }

      onTimeUpdate(nextTime);
      renderAtTime(nextTime);
      animationFrameRef.current = requestAnimationFrame(step);
    };

    animationFrameRef.current = requestAnimationFrame(step);

    return () => {
      lastTimestampRef.current = null;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, totalDuration, onTimeUpdate, renderAtTime, overlaySettings, segments, isMuted]);

  // Initial and seek re-render
  useEffect(() => {
    if (!isPlaying) {
      renderAtTime(currentTime);
    }
  }, [currentTime, isPlaying, renderAtTime]);

  const togglePlay = () => {
    if (clips.length === 0) return;
    if (currentTimeRef.current >= totalDuration) {
      currentTimeRef.current = 0;
      onTimeUpdate(0);
      playedHornClipIndicesRef.current.clear();
    }
    if (isPlaying && activeHornStopRef.current) {
      activeHornStopRef.current();
      activeHornStopRef.current = null;
    }
    isDuckingAudioRef.current = false;
    lastTimestampRef.current = null;
    setIsPlaying(!isPlaying);
  };

  const handleRestart = () => {
    if (activeHornStopRef.current) {
      activeHornStopRef.current();
      activeHornStopRef.current = null;
    }
    isDuckingAudioRef.current = false;
    lastTimestampRef.current = null;
    playedHornClipIndicesRef.current.clear();
    currentTimeRef.current = 0;
    onTimeUpdate(0);
    renderAtTime(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (activeHornStopRef.current) {
      activeHornStopRef.current();
      activeHornStopRef.current = null;
    }
    isDuckingAudioRef.current = false;
    lastTimestampRef.current = null;
    playedHornClipIndicesRef.current.clear();

    // Mark clips whose horn trigger timestamp has already elapsed as played
    segments.forEach((seg, idx) => {
      const rawOffset =
        seg.clip.hornTimingOverride ?? overlaySettings.hornConfig?.clipOffsetSeconds ?? 0.5;
      const triggerOffset = Math.max(0, rawOffset) / (seg.clip.playbackRate || 1.0);
      if (val > seg.clipStartInTimeline + triggerOffset) {
        playedHornClipIndicesRef.current.add(idx);
      }
    });

    currentTimeRef.current = val;
    onTimeUpdate(val);
    renderAtTime(val);
  };

  const formatTime = (secs: number) => {
    if (!Number.isFinite(secs) || isNaN(secs) || secs < 0) return '0:00.0';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m}:${s < 10 ? '0' : ''}${s}.${ms}`;
  };

  // Find which clip is active at currentTime (or user selected)
  const activeClipIndex = React.useMemo(() => {
    if (clips.length === 0) return -1;
    if (selectedClipIndex !== null && selectedClipIndex !== undefined && selectedClipIndex >= 0 && selectedClipIndex < clips.length) {
      return selectedClipIndex;
    }
    const idx = segments.findIndex(
      (seg) => currentTime >= seg.clipStartInTimeline && currentTime <= seg.clipEndInTimeline
    );
    return idx !== -1 ? idx : 0;
  }, [clips.length, selectedClipIndex, segments, currentTime]);

  const activeClip = activeClipIndex !== -1 ? clips[activeClipIndex] : null;

  const handleClipZoomChange = (newZoom: number) => {
    if (!activeClip || activeClipIndex === -1 || !onUpdateClip) return;
    const clampedZoom = Math.max(1.0, Math.min(3.5, Number(newZoom.toFixed(2))));
    onUpdateClip(activeClipIndex, {
      ...activeClip,
      zoom: clampedZoom,
    });
    requestAnimationFrame(() => renderAtTime(currentTime));
  };

  const handleClipPanChange = (pX: number, pY: number) => {
    if (!activeClip || activeClipIndex === -1 || !onUpdateClip) return;
    onUpdateClip(activeClipIndex, {
      ...activeClip,
      panX: pX,
      panY: pY,
    });
    requestAnimationFrame(() => renderAtTime(currentTime));
  };

  // Dimensions for canvas
  const canvasWidth = aspectRatio === '9:16' ? 720 : aspectRatio === '1:1' ? 720 : 1280;
  const canvasHeight = aspectRatio === '9:16' ? 1280 : aspectRatio === '1:1' ? 720 : 720;

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-slate-950/90 p-3 lg:p-6 rounded-2xl border border-slate-800/80 shadow-2xl relative overflow-hidden">
      {/* Background ice rink subtle ambient glow */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_50%_40%,#38bdf8_0%,transparent_60%)]"></div>

      {/* Main View Area */}
      <div className="relative flex items-center justify-center w-full flex-1 min-h-[360px] max-h-[580px]">
        {clips.length === 0 ? (
          <div
            onClick={onOpenUploadDialog}
            className="group flex flex-col items-center justify-center text-center p-8 sm:p-12 max-w-lg w-full border-2 border-dashed border-slate-700 hover:border-red-500 rounded-3xl bg-slate-900/60 hover:bg-slate-900/90 cursor-pointer transition-all duration-200 shadow-2xl"
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-600/20 to-sky-600/20 border border-red-500/30 group-hover:border-red-500 group-hover:scale-105 text-red-400 flex items-center justify-center mb-5 transition-all shadow-inner">
              <Plus className="w-10 h-10 text-red-500" />
            </div>
            <h3 className="text-2xl font-black text-white font-['Chakra_Petch'] tracking-wide mb-2 uppercase">
              Ready for Your Hockey Videos
            </h3>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed max-w-sm">
              Drag and drop your highlight video clips here or click anywhere in this box to upload (<span className="text-slate-300 font-mono">MP4, WebM, MOV</span>).
            </p>
            <button
              id="upload-my-videos-btn"
              onClick={(e) => {
                e.stopPropagation();
                onOpenUploadDialog();
              }}
              className="flex items-center justify-center gap-2.5 bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition shadow-xl shadow-red-950/60 font-['Chakra_Petch']"
            >
              <Plus className="w-5 h-5" />
              Upload Hockey Videos
            </button>
            <p className="text-[11px] text-slate-500 mt-4">
              Saved automatically in your browser — your project stays intact even if you refresh.
            </p>
          </div>
        ) : (
          <div
            className={`relative rounded-xl overflow-hidden shadow-2xl border-2 border-slate-800 bg-black flex items-center justify-center transition-all ${
              aspectRatio === '9:16'
                ? 'aspect-[9/16] h-full max-h-[540px]'
                : aspectRatio === '16:9'
                ? 'aspect-[16/9] w-full max-w-[780px]'
                : 'aspect-square h-full max-h-[500px]'
            }`}
          >
            <canvas
              ref={canvasRef}
              width={canvasWidth}
              height={canvasHeight}
              className="w-full h-full object-contain cursor-pointer"
              onClick={togglePlay}
            />

            {/* Quick Play overlay icon when paused */}
            {!isPlaying && (
              <button
                id="canvas-play-overlay-btn"
                onClick={togglePlay}
                className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 flex items-center justify-center transition backdrop-blur-xs scale-100 hover:scale-110"
              >
                <Play className="w-7 h-7 ml-1 text-red-500 fill-red-500" />
              </button>
            )}

            {/* Top aspect ratio indicator pill */}
            <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-semibold text-slate-300 border border-white/10 tracking-wider">
              {aspectRatio === '9:16' ? '9:16 SHORTS' : aspectRatio === '16:9' ? '16:9 HD' : '1:1'}
            </div>
          </div>
        )}
      </div>

      {/* Playback Controls & Timeline Scrubber */}
      {clips.length > 0 && (
        <div className="w-full max-w-3xl mt-4 bg-slate-900/90 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-2.5">
          {/* Scrubber track */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-sky-400 min-w-[56px]">
              {formatTime(currentTime)}
            </span>
            <input
              id="timeline-scrubber-slider"
              type="range"
              min={0}
              max={Number.isFinite(totalDuration) && totalDuration > 0.1 ? totalDuration : 1}
              step={0.05}
              value={Number.isFinite(currentTime) ? currentTime : 0}
              onChange={handleSeek}
              className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
            <span className="text-xs font-mono text-slate-400 min-w-[56px] text-right">
              {formatTime(totalDuration)}
            </span>
          </div>

          {/* Buttons row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                id="player-restart-btn"
                onClick={handleRestart}
                title="Restart playback"
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                id="player-play-btn"
                onClick={togglePlay}
                className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-600 hover:bg-red-500 text-white transition shadow shadow-red-950/40"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

              <button
                id="player-mute-btn"
                onClick={() => setIsMuted(!isMuted)}
                title={isMuted ? 'Unmute' : 'Mute'}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
              <span className="bg-slate-800/80 px-2 py-1 rounded border border-slate-700/60">
                {clips.length} {clips.length === 1 ? 'Clip' : 'Clips'}
              </span>
              <span className="bg-slate-800/80 px-2 py-1 rounded border border-slate-700/60">
                {transitions.length} {transitions.length === 1 ? 'Transition' : 'Transitions'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Zoom Feature Directly Below Video */}
      {clips.length > 0 && activeClip && onUpdateClip && (
        <div className="w-full max-w-3xl mt-2.5 bg-slate-900/95 border border-slate-800/90 rounded-xl p-3 flex flex-col gap-2.5 shadow-lg shadow-black/40">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ZoomIn className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs font-bold text-white uppercase tracking-wider font-['Chakra_Petch']">
                Clip Zoom &amp; Framing
              </span>
              <span
                className="text-[11px] font-mono text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 truncate max-w-[150px]"
                title={activeClip.name}
              >
                {activeClip.name}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                  (activeClip.zoom ?? 1) > 1.02
                    ? 'bg-amber-950/90 text-amber-300 border-amber-700/80'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                {(activeClip.zoom ?? 1) > 1.02
                  ? `${(activeClip.zoom ?? 1).toFixed(2)}x Zoomed`
                  : '1.0x Full Ice'}
              </span>
            </div>

            {((activeClip.zoom ?? 1) > 1.02 ||
              (activeClip.panX ?? 0) !== 0 ||
              (activeClip.panY ?? 0) !== 0) && (
              <button
                type="button"
                onClick={() => {
                  handleClipZoomChange(1.0);
                  handleClipPanChange(0, 0);
                }}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-800 px-2.5 py-1 rounded border border-slate-800 transition"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Framing
              </button>
            )}
          </div>

          {/* Slider & Presets Row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <div className="flex items-center gap-2 flex-1">
              <button
                type="button"
                title="Zoom Out (-0.2x)"
                onClick={() =>
                  handleClipZoomChange(Math.max(1.0, (activeClip.zoom ?? 1) - 0.2))
                }
                className="p-1.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <input
                type="range"
                min={1.0}
                max={3.5}
                step={0.05}
                value={activeClip.zoom ?? 1.0}
                onChange={(e) => handleClipZoomChange(parseFloat(e.target.value) || 1.0)}
                className="flex-1 h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <button
                type="button"
                title="Zoom In (+0.2x)"
                onClick={() =>
                  handleClipZoomChange(Math.min(3.5, (activeClip.zoom ?? 1) + 0.2))
                }
                className="p-1.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-xs text-amber-400 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800 min-w-[54px] text-center">
                {(activeClip.zoom ?? 1.0).toFixed(2)}x
              </span>
            </div>

            {/* Quick Magnification Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { label: '1.0x Full Ice', val: 1.0 },
                { label: '1.25x Wide', val: 1.25 },
                { label: '1.5x Action', val: 1.5 },
                { label: '2.0x Tight', val: 2.0 },
                { label: '2.5x Close', val: 2.5 },
              ].map((p) => (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => handleClipZoomChange(p.val)}
                  className={`text-[11px] px-2 py-0.5 rounded font-mono border transition ${
                    Math.abs((activeClip.zoom ?? 1) - p.val) < 0.04
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Framing / Pan buttons when zoomed */}
          {(activeClip.zoom ?? 1) > 1.02 && (
            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Crosshair className="w-3.5 h-3.5 text-sky-400" />
                <span>Player Focal Point:</span>
                <span className="font-mono text-[10px] text-sky-400 font-bold">
                  {activeClip.panX ?? 0 > 0 ? `+${activeClip.panX}` : activeClip.panX ?? 0}% X /{' '}
                  {activeClip.panY ?? 0 > 0 ? `+${activeClip.panY}` : activeClip.panY ?? 0}% Y
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {[
                  { label: 'Left Wing', x: -60, y: 0 },
                  { label: 'Far Boards', x: 0, y: -50 },
                  { label: 'Center Ice', x: 0, y: 0 },
                  { label: 'Near Net', x: 0, y: 55 },
                  { label: 'Right Wing', x: 60, y: 0 },
                ].map((f) => (
                  <button
                    key={f.label}
                    type="button"
                    onClick={() => handleClipPanChange(f.x, f.y)}
                    className={`text-[10px] px-2 py-0.5 rounded border transition ${
                      (activeClip.panX ?? 0) === f.x && (activeClip.panY ?? 0) === f.y
                        ? 'bg-sky-500/20 border-sky-500 text-sky-300 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
