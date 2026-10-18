import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  CheckCircle2,
  Loader2,
  HardDrive,
  Cpu,
  Play,
  Pause,
  RefreshCw,
  Sparkles,
  Zap,
  Film,
  Layers,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { VideoClip } from '../types';
import { bufferClipIntoMemory, getBufferCoveragePercent } from '../lib/videoLoader';

interface VideoBufferModalProps {
  isOpen: boolean;
  onClose: () => void;
  clips: VideoClip[];
  onUpdateClip?: (index: number, updated: VideoClip) => void;
  onProceedToExport?: () => void;
}

interface VideoTileState {
  bufferPercent: number;
  readyState: number;
  isReady: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  width: number;
  height: number;
}

export const VideoBufferModal: React.FC<VideoBufferModalProps> = ({
  isOpen,
  onClose,
  clips,
  onUpdateClip,
  onProceedToExport,
}) => {
  const [isRebufferingAll, setIsRebufferingAll] = useState(false);
  const [globalProgress, setGlobalProgress] = useState<number>(0);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalClips = clips.length;
  const loadedCount = clips.filter((c) => c.isLoaded && !c.isBuffering).length;
  const allLoaded = totalClips > 0 && loadedCount === totalClips;

  const handleRebufferAll = async () => {
    setIsRebufferingAll(true);
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      try {
        const buffered = await bufferClipIntoMemory(clip);
        onUpdateClip?.(i, buffered);
      } catch (e) {
        console.warn('Rebuffer clip error:', e);
      }
      setGlobalProgress(Math.round(((i + 1) / clips.length) * 100));
    }
    setIsRebufferingAll(false);
  };

  // Calculate total RAM size
  const totalSizeBytes = clips.reduce((acc, c) => acc + (c.blob?.size || 0), 0);
  const totalSizeMb = (totalSizeBytes / (1024 * 1024)).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-emerald-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
              {allLoaded ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              ) : (
                <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white font-['Chakra_Petch'] tracking-wide">
                  VIDEO BUFFER PREVIEW & MEMORY LOADER
                </h3>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    allLoaded
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/50'
                      : 'bg-sky-950/80 text-sky-300 border-sky-600/50'
                  }`}
                >
                  {allLoaded ? 'ALL IN RAM (100%)' : `BUFFERING ${loadedCount}/${totalClips}`}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Live video frame decoder status and RAM buffer coverage across all {totalClips} timeline clips.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="Close buffer preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Progress Bar Banner */}
        <div className="px-5 py-3 bg-slate-950/50 border-b border-slate-800/80 shrink-0 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-['Chakra_Petch'] font-semibold text-slate-300">
              <HardDrive className="w-3.5 h-3.5 text-sky-400" />
              <span>
                Total Browser RAM Cache: <strong className="text-white">{totalSizeMb} MB</strong>
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-emerald-400 font-bold">
                {loadedCount} of {totalClips} clips ready in memory
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-sky-400">
              {totalClips > 0 ? Math.round((loadedCount / totalClips) * 100) : 100}% Ready
            </span>
          </div>

          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-sky-500 via-teal-400 to-emerald-400 h-full transition-all duration-300 rounded-full"
              style={{
                width: `${totalClips > 0 ? Math.round((loadedCount / totalClips) * 100) : 100}%`,
              }}
            />
          </div>
        </div>

        {/* Video Previews Grid */}
        <div className="p-5 overflow-y-auto flex-1">
          {totalClips === 0 ? (
            <div className="text-center py-16 space-y-3">
              <Film className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-sm text-slate-400 font-['Chakra_Petch']">
                No video clips found in the timeline. Add clips to preview their buffer status.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {clips.map((clip, index) => (
                <VideoBufferCard
                  key={clip.id}
                  clip={clip}
                  index={index}
                  isPlaying={playingClipId === clip.id}
                  onTogglePlay={(play) => setPlayingClipId(play ? clip.id : null)}
                  onMarkLoaded={(loadedClip) => onUpdateClip?.(index, loadedClip)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Pre-buffered videos stream with <strong className="text-white">zero disk latency</strong> for fluid 60 FPS playback.
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleRebufferAll}
              disabled={isRebufferingAll}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRebufferingAll ? 'animate-spin' : ''}`} />
              <span>{isRebufferingAll ? 'Buffering All...' : 'Re-verify All Buffers'}</span>
            </button>

            {onProceedToExport ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onProceedToExport();
                }}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-md transition font-['Chakra_Petch'] uppercase tracking-wider cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Continue to Export</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 transition font-['Chakra_Petch'] uppercase tracking-wider cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Done</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface VideoBufferCardProps {
  clip: VideoClip;
  index: number;
  isPlaying: boolean;
  onTogglePlay: (play: boolean) => void;
  onMarkLoaded: (loadedClip: VideoClip) => void;
}

const VideoBufferCard: React.FC<VideoBufferCardProps> = ({
  clip,
  index,
  isPlaying,
  onTogglePlay,
  onMarkLoaded,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [tileState, setTileState] = useState<VideoTileState>({
    bufferPercent: clip.isLoaded ? 100 : 0,
    readyState: clip.isLoaded ? 4 : 0,
    isReady: Boolean(clip.isLoaded),
    isPlaying: false,
    currentTime: clip.startTime || 0,
    duration: clip.originalDuration || 5,
    width: clip.originalWidth || 0,
    height: clip.originalHeight || 0,
  });

  // Measure buffer progress and frame ready state directly on the video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateBufferMetrics = () => {
      const s = clip.startTime || 0;
      const e = clip.endTime || clip.originalDuration || s + 3.0;
      const coverage = getBufferCoveragePercent(video, s, e);
      const isEnoughData = video.readyState >= 3 || (coverage >= 95 && video.readyState >= 2);

      setTileState((prev) => ({
        ...prev,
        bufferPercent: coverage,
        readyState: video.readyState,
        isReady: isEnoughData || Boolean(clip.isLoaded),
        currentTime: video.currentTime,
        duration: video.duration || clip.originalDuration || 5,
        width: video.videoWidth || clip.originalWidth || 0,
        height: video.videoHeight || clip.originalHeight || 0,
      }));

      if (isEnoughData && !clip.isLoaded) {
        onMarkLoaded({ ...clip, isLoaded: true, isBuffering: false });
      }
    };

    video.addEventListener('progress', updateBufferMetrics);
    video.addEventListener('canplaythrough', updateBufferMetrics);
    video.addEventListener('canplay', updateBufferMetrics);
    video.addEventListener('loadeddata', updateBufferMetrics);
    video.addEventListener('loadedmetadata', updateBufferMetrics);

    // Initial check
    updateBufferMetrics();

    // Small polling interval while actively buffering
    const pollTimer = setInterval(updateBufferMetrics, 200);

    return () => {
      clearInterval(pollTimer);
      if (video) {
        video.removeEventListener('progress', updateBufferMetrics);
        video.removeEventListener('canplaythrough', updateBufferMetrics);
        video.removeEventListener('canplay', updateBufferMetrics);
        video.removeEventListener('loadeddata', updateBufferMetrics);
        video.removeEventListener('loadedmetadata', updateBufferMetrics);
      }
    };
  }, [clip.id, clip.url, clip.startTime, clip.endTime, clip.isLoaded]);

  // Handle play / pause toggle
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => {});
    } else {
      video.pause();
      try {
        video.currentTime = clip.startTime || 0;
      } catch {}
    }
  }, [isPlaying, clip.startTime]);

  const clipSizeMb = clip.blob ? (clip.blob.size / (1024 * 1024)).toFixed(1) : '0.0';

  const getTagColor = (tag?: string) => {
    switch (tag) {
      case 'GOAL':
      case 'OT WINNER':
        return 'bg-red-500 text-white';
      case 'SAVE':
        return 'bg-sky-500 text-white';
      case 'HIT':
        return 'bg-orange-500 text-white';
      case 'DEKE':
        return 'bg-purple-500 text-white';
      default:
        return 'bg-slate-700 text-slate-200';
    }
  };

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden flex flex-col hover:border-slate-700 transition shadow-lg group">
      {/* Tile Header */}
      <div className="px-3 py-2 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-mono font-bold text-sky-400 bg-sky-950/80 px-1.5 py-0.5 rounded border border-sky-800/40 shrink-0">
            #{index + 1}
          </span>
          <span className="text-xs font-bold text-white truncate font-['Chakra_Petch']" title={clip.name}>
            {clip.name}
          </span>
        </div>

        {clip.tag && (
          <span
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-['Chakra_Petch'] shrink-0 ${getTagColor(
              clip.tag,
            )}`}
          >
            {clip.tag}
          </span>
        )}
      </div>

      {/* Video Viewport */}
      <div
        className="relative bg-black aspect-video flex items-center justify-center overflow-hidden cursor-pointer select-none"
        onClick={() => onTogglePlay(!isPlaying)}
      >
        <video
          ref={videoRef}
          src={clip.url}
          muted
          playsInline
          preload="auto"
          className="w-full h-full object-contain"
        />

        {/* Live Status Overlay Badge */}
        <div className="absolute top-2 left-2 z-10">
          {tileState.isReady || clip.isLoaded ? (
            <span className="flex items-center gap-1 text-[10px] font-mono font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 px-2 py-0.5 rounded-full shadow">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              100% IN RAM
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-mono font-bold bg-sky-950/90 text-sky-300 border border-sky-500/50 px-2 py-0.5 rounded-full shadow animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
              BUFFERING...
            </span>
          )}
        </div>

        {/* Decoder ReadyState Badge */}
        <div className="absolute top-2 right-2 z-10">
          <span className="text-[9px] font-mono bg-black/70 text-slate-300 px-1.5 py-0.5 rounded border border-white/10">
            {tileState.readyState >= 4
              ? 'HAVE_ENOUGH_DATA'
              : tileState.readyState === 3
              ? 'HAVE_FUTURE_DATA'
              : tileState.readyState === 2
              ? 'HAVE_CURRENT_DATA'
              : 'LOADING'}
          </span>
        </div>

        {/* Play / Pause Centered Trigger */}
        <div
          className={`absolute inset-0 bg-black/40 flex items-center justify-center transition duration-150 ${
            isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-80 hover:opacity-100'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-slate-900/90 border border-white/20 flex items-center justify-center text-white shadow-lg transform active:scale-95 transition">
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-white" />
            ) : (
              <Play className="w-4 h-4 fill-white ml-0.5" />
            )}
          </div>
        </div>

        {/* Current Time Counter */}
        <div className="absolute bottom-2 right-2 z-10 text-[10px] font-mono text-white/90 bg-black/80 px-1.5 py-0.5 rounded">
          {tileState.currentTime.toFixed(1)}s / {clip.endTime.toFixed(1)}s
        </div>
      </div>

      {/* Buffer Specs & Progress */}
      <div className="p-3 bg-slate-950/90 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400 font-medium">Memory Cache:</span>
          <span className="font-mono font-bold text-white">{clipSizeMb} MB</span>
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400 font-medium">Resolution:</span>
          <span className="font-mono font-semibold text-slate-200">
            {tileState.width > 0 && tileState.height > 0
              ? `${tileState.width} × ${tileState.height}`
              : 'Detecting...'}
          </span>
        </div>

        {/* Buffer Fill Progress Bar */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-slate-400">Buffer Coverage:</span>
            <span
              className={`font-bold ${
                tileState.isReady || clip.isLoaded ? 'text-emerald-400' : 'text-sky-400'
              }`}
            >
              {tileState.isReady || clip.isLoaded ? 100 : tileState.bufferPercent}%
            </span>
          </div>

          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-200 rounded-full ${
                tileState.isReady || clip.isLoaded
                  ? 'bg-emerald-400'
                  : 'bg-gradient-to-r from-sky-500 to-indigo-500'
              }`}
              style={{
                width: `${tileState.isReady || clip.isLoaded ? 100 : tileState.bufferPercent}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
