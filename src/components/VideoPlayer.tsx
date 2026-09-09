import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AspectRatio, HockeyOverlaySettings, Transition, VideoClip } from '../types';
import {
  calculateTimeline,
  drawHockeyOverlays,
  drawVideoFitted,
  preloadVideo,
  renderTransitionEffect,
} from '../lib/videoRenderer';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Sparkles,
  Plus,
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
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoElementsRef = useRef<HTMLVideoElement[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

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
          const v = await preloadVideo(clip.url);
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
            );
          } else {
            drawVideoFitted(ctx, video, width, height);
          }
        } else {
          drawVideoFitted(ctx, video, width, height);
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
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const step = (timestamp: number) => {
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
      }
      const delta = (timestamp - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = timestamp;

      let nextTime = currentTime + delta;
      if (nextTime >= totalDuration) {
        nextTime = 0; // Loop or stop
        setIsPlaying(false);
        onTimeUpdate(0);
        renderAtTime(0);
        return;
      }

      onTimeUpdate(nextTime);
      renderAtTime(nextTime);
      animationFrameRef.current = requestAnimationFrame(step);
    };

    animationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, currentTime, totalDuration, onTimeUpdate, renderAtTime]);

  // Initial and seek re-render
  useEffect(() => {
    if (!isPlaying) {
      renderAtTime(currentTime);
    }
  }, [currentTime, isPlaying, renderAtTime]);

  const togglePlay = () => {
    if (clips.length === 0) return;
    if (currentTime >= totalDuration) {
      onTimeUpdate(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleRestart = () => {
    onTimeUpdate(0);
    renderAtTime(0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
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
    </div>
  );
};
