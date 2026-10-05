import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AspectRatio, FramingMode, VideoClip } from '../types';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  Scissors,
  Film,
  Clock,
  Trash2,
  Plus,
  Sparkles,
} from 'lucide-react';

interface VideoPlayerProps {
  clips: VideoClip[];
  selectedClipIndex: number | null;
  onSelectClipIndex?: (index: number) => void;
  onUpdateClip?: (index: number, updated: VideoClip) => void;
  onRemoveClip?: (index: number) => void;
  onMoveClip?: (index: number, direction: 'left' | 'right') => void;
  aspectRatio: AspectRatio;
  onAspectRatioChange?: (ratio: AspectRatio) => void;
  onApplyFramingModeToAll?: (mode: FramingMode) => void;
  onAddSampleClips?: () => void;
  onOpenUploadDialog?: () => void;
  // Optional backwards-compat props
  overlaySettings?: any;
  transitions?: any;
  currentTime?: number;
  onTimeUpdate?: (time: number) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  clips,
  selectedClipIndex,
  onSelectClipIndex,
  onUpdateClip,
  onRemoveClip,
  aspectRatio,
  onAspectRatioChange,
  onApplyFramingModeToAll,
  onAddSampleClips,
  onOpenUploadDialog,
}) => {
  const activeIndex =
    selectedClipIndex !== null &&
    selectedClipIndex !== undefined &&
    selectedClipIndex >= 0 &&
    selectedClipIndex < clips.length
      ? selectedClipIndex
      : clips.length > 0
      ? 0
      : null;

  const clip = activeIndex !== null ? clips[activeIndex] : null;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);
  const scrubberRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayTime, setCurrentPlayTime] = useState(0);

  const effectiveFramingMode: FramingMode =
    clip?.framingMode ?? (aspectRatio === '9:16' ? 'fit-blur' : 'fit-blur');

  const maxDuration = clip && Number.isFinite(clip.originalDuration) && clip.originalDuration > 0.1
    ? clip.originalDuration
    : 5.0;

  const startTime = clip && Number.isFinite(clip.startTime) ? clip.startTime : 0;
  const endTime =
    clip && Number.isFinite(clip.endTime) && clip.endTime > startTime
      ? clip.endTime
      : maxDuration;
  const volume = clip?.volume ?? 1;
  const playbackRate = clip?.playbackRate ?? 1;
  const trimmedDuration = Math.max(0.1, (endTime - startTime) / playbackRate);

  const updateClipField = useCallback(
    (fields: Partial<VideoClip>) => {
      if (activeIndex === null || !onUpdateClip || !clip) return;
      onUpdateClip(activeIndex, { ...clip, ...fields });
    },
    [activeIndex, clip, onUpdateClip]
  );

  // Sync video time bounds on clip change or trim
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !clip) return;

    video.playbackRate = playbackRate;
    video.volume = volume;

    if (video.currentTime < startTime || video.currentTime > endTime) {
      video.currentTime = startTime;
      setCurrentPlayTime(0);
    }
  }, [clip?.id, startTime, endTime, playbackRate, volume]);

  // Video timeupdate handler
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.currentTime >= endTime) {
      video.pause();
      setIsPlaying(false);
      video.currentTime = startTime;
      setCurrentPlayTime(0);
      return;
    }

    const elapsed = Math.max(0, (video.currentTime - startTime) / playbackRate);
    setCurrentPlayTime(elapsed);
  };

  // Play / Pause toggle
  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      if (bgVideoRef.current) bgVideoRef.current.pause();
      setIsPlaying(false);
    } else {
      if (video.currentTime >= endTime - 0.05 || video.currentTime < startTime) {
        video.currentTime = startTime;
        setCurrentPlayTime(0);
      }
      video
        .play()
        .then(() => {
          setIsPlaying(true);
          if (bgVideoRef.current) {
            bgVideoRef.current.currentTime = video.currentTime;
            bgVideoRef.current.play().catch(() => {});
          }
        })
        .catch(() => setIsPlaying(false));
    }
  };

  // Seek
  const handleSeek = (offsetSec: number) => {
    const video = videoRef.current;
    if (!video) return;

    const clampedOffset = Math.max(0, Math.min(trimmedDuration, offsetSec));
    const targetVideoTime = startTime + clampedOffset * playbackRate;
    video.currentTime = targetVideoTime;
    setCurrentPlayTime(clampedOffset);

    if (bgVideoRef.current) {
      bgVideoRef.current.currentTime = targetVideoTime;
    }
  };

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrubberRef.current) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    handleSeek(ratio * trimmedDuration);
  };

  // Aspect ratio container styles
  const getAspectStyle = (ratio: AspectRatio): React.CSSProperties => {
    if (ratio === '9:16') {
      return { width: 'auto', height: '100%', aspectRatio: '9 / 16' };
    }
    if (ratio === '16:9') {
      return { width: '100%', height: 'auto', aspectRatio: '16 / 9', maxHeight: '100%' };
    }
    return { width: 'auto', height: '100%', aspectRatio: '1 / 1' };
  };

  // If no clips exist, show an inviting clean dropzone
  if (!clip || clips.length === 0) {
    return (
      <div className="flex-1 min-h-0 bg-slate-950 border border-slate-800 rounded-xl flex flex-col items-center justify-center p-6 text-center shadow-lg">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-4 shadow">
          <Film className="w-8 h-8 text-sky-400" />
        </div>
        <h3 className="font-['Chakra_Petch'] font-bold text-lg text-white mb-1 tracking-wide">
          NO CLIPS LOADED
        </h3>
        <p className="text-xs text-slate-400 max-w-sm mb-5">
          Add your video files to trim, arrange in order, and connect them seamlessly with 100% native quality.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenUploadDialog}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-lg shadow-red-950/50 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Video Files</span>
          </button>
          {onAddSampleClips && (
            <button
              type="button"
              onClick={onAddSampleClips}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-sky-400 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Load Sample Clips</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-slate-900/95 border border-slate-800 rounded-xl overflow-hidden shadow-lg select-none">
      {/* 1. Top Bar: Clip Index, Name, Aspect Ratio, Delete */}
      <div className="h-10 px-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {/* Previous / Next buttons */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              disabled={activeIndex <= 0}
              onClick={() => onSelectClipIndex && onSelectClipIndex(activeIndex - 1)}
              className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-800 transition cursor-pointer"
              title="Previous Clip"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={activeIndex >= clips.length - 1}
              onClick={() => onSelectClipIndex && onSelectClipIndex(activeIndex + 1)}
              className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-800 transition cursor-pointer"
              title="Next Clip"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Sequence badge */}
          <span className="bg-emerald-600 text-white font-mono font-bold text-[10px] px-1.5 py-0.5 rounded shrink-0 shadow-xs">
            #{activeIndex + 1} of {clips.length}
          </span>

          {/* Clip Name */}
          <input
            type="text"
            value={clip.name}
            onChange={(e) => updateClipField({ name: e.target.value })}
            className="bg-transparent text-white font-semibold text-xs px-1.5 py-0.5 rounded hover:bg-slate-800/50 focus:bg-slate-900 focus:border focus:border-slate-700 focus:outline-none truncate max-w-[200px] sm:max-w-xs"
            title="Click to rename clip"
          />
        </div>

        {/* Top Right: Format & Remove */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Aspect ratio buttons */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 shadow-xs">
            {(['9:16', '16:9', '1:1'] as AspectRatio[]).map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => onAspectRatioChange?.(ratio)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono transition cursor-pointer ${
                  aspectRatio === ratio
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title={`Switch to ${ratio} format`}
              >
                {ratio}
              </button>
            ))}
          </div>

          {onRemoveClip && (
            <button
              type="button"
              onClick={() => onRemoveClip(activeIndex)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-850 transition cursor-pointer"
              title="Delete this clip"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Video Stage */}
      <div className="flex-1 min-h-0 relative flex items-center justify-center bg-black p-2 overflow-hidden select-none">
        <div
          style={getAspectStyle(aspectRatio)}
          className="relative rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-850 shadow-2xl select-none cursor-pointer"
          onClick={togglePlayPause}
        >
          {/* Blurred Background for fit-blur */}
          {effectiveFramingMode === 'fit-blur' && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
              <video
                ref={bgVideoRef}
                src={clip.url}
                playsInline
                muted
                aria-hidden="true"
                className="w-full h-full object-cover blur-2xl scale-125 opacity-60 brightness-[0.5]"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/10 to-slate-950/70" />
            </div>
          )}

          {/* Main Video Element */}
          <video
            ref={videoRef}
            src={clip.url}
            playsInline
            onTimeUpdate={handleTimeUpdate}
            className="w-full h-auto max-h-full object-contain relative z-10 pointer-events-none drop-shadow-2xl"
          />

          {/* Center Play overlay indicator when paused */}
          {!isPlaying && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 pointer-events-none transition-opacity">
              <div className="w-12 h-12 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-xl shadow-red-950/80 pl-0.5">
                <Play className="w-6 h-6 fill-current" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Controls & Scrubber */}
      <div className="p-2.5 bg-slate-950/90 border-t border-slate-800 space-y-2 shrink-0">
        {/* Scrubber Bar */}
        <div className="space-y-1">
          <div
            ref={scrubberRef}
            onClick={handleScrubberClick}
            className="relative w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 cursor-pointer group"
          >
            {/* Progress fill */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-red-600 to-sky-500 rounded-full"
              style={{
                width: `${Math.min(100, Math.max(0, (currentPlayTime / trimmedDuration) * 100))}%`,
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>{currentPlayTime.toFixed(1)}s</span>
            <span className="text-slate-200 font-bold">{trimmedDuration.toFixed(1)}s</span>
          </div>
        </div>

        {/* Playback Controls Toolbar */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-850">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlayPause}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow cursor-pointer ${
                isPlaying
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-red-600 hover:bg-red-500 text-white'
              }`}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSeek(0)}
              className="p-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
              title="Replay from clip start"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Speed & Volume */}
          <div className="flex items-center gap-2">
            {/* Speed */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              {[0.5, 0.75, 1.0, 1.5].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => updateClipField({ playbackRate: rate })}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                    playbackRate === rate
                      ? 'bg-red-600 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Volume */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1">
              <button
                type="button"
                onClick={() => updateClipField({ volume: volume === 0 ? 1 : 0 })}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                {volume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5 text-red-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-slate-300" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => updateClipField({ volume: parseFloat(e.target.value) || 0 })}
                className="w-14 h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-red-500"
              />
            </div>
          </div>
        </div>

        {/* 4. Trim Controls (Start Time & End Time) */}
        <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-850 space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-[11px] text-slate-300 font-bold uppercase font-['Chakra_Petch']">
            <div className="flex items-center gap-1.5">
              <Scissors className="w-3 h-3 text-red-400" />
              <span>Trim Clip (Source: {maxDuration.toFixed(1)}s)</span>
            </div>
            <span className="font-mono text-sky-400">{trimmedDuration.toFixed(1)}s kept</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Start slider */}
            <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 font-mono font-bold shrink-0">START:</span>
              <input
                type="range"
                min={0}
                max={Math.max(0.1, endTime - 0.2)}
                step={0.1}
                value={startTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  updateClipField({ startTime: val });
                  if (videoRef.current) {
                    videoRef.current.currentTime = val;
                    setCurrentPlayTime(0);
                  }
                }}
                className="flex-1 h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-sky-400"
              />
              <span className="text-[10px] font-mono text-slate-200 min-w-[28px] text-right">
                {startTime.toFixed(1)}s
              </span>
            </div>

            {/* End slider */}
            <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 font-mono font-bold shrink-0">END:</span>
              <input
                type="range"
                min={startTime + 0.1}
                max={maxDuration}
                step={0.1}
                value={endTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || maxDuration;
                  updateClipField({ endTime: val });
                }}
                className="flex-1 h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-sky-400"
              />
              <span className="text-[10px] font-mono text-slate-200 min-w-[28px] text-right">
                {endTime.toFixed(1)}s
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
