import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  AspectRatio,
  FramingMode,
  HockeyOverlaySettings,
  HockeyTag,
  ScorebugConfig,
  PlayerBannerConfig,
  Transition,
  VideoClip,
} from '../types';
import { playHornSound } from '../lib/audio';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Sparkles,
  Plus,
  ZoomIn,
  ZoomOut,
  Crosshair,
  SlidersHorizontal,
  Move,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Clock,
  Tv,
  Scissors,
  Flame,
  Check,
  Trash2,
  Maximize2,
} from 'lucide-react';

interface VideoPlayerProps {
  clips: VideoClip[];
  selectedClipIndex: number | null;
  onSelectClipIndex?: (index: number) => void;
  onUpdateClip?: (index: number, updated: VideoClip) => void;
  onRemoveClip?: (index: number) => void;
  onMoveClip?: (index: number, direction: 'left' | 'right') => void;
  overlaySettings: HockeyOverlaySettings;
  aspectRatio: AspectRatio;
  onAspectRatioChange?: (ratio: AspectRatio) => void;
  onApplyFramingModeToAll?: (mode: FramingMode) => void;
  onAddSampleClips: () => void;
  onOpenUploadDialog: () => void;
  // Optional backwards-compat props from earlier full-timeline implementation
  transitions?: Transition[];
  currentTime?: number;
  onTimeUpdate?: (time: number) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  clips,
  selectedClipIndex,
  onSelectClipIndex,
  onUpdateClip,
  onRemoveClip,
  onMoveClip,
  overlaySettings,
  aspectRatio,
  onAspectRatioChange,
  onApplyFramingModeToAll,
  onAddSampleClips,
  onOpenUploadDialog,
}) => {
  // Determine active clip index
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayTime, setCurrentPlayTime] = useState(0);
  const [isAuditioningHorn, setIsAuditioningHorn] = useState(false);
  const [showOverlaysPreview, setShowOverlaysPreview] = useState(true);
  const [isHornFiring, setIsHornFiring] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  // Framing mode: for 9:16 Shorts, default to 'fit-blur' so 100% of 16:9 widescreen hockey is preserved!
  const effectiveFramingMode: FramingMode =
    clip?.framingMode ?? (aspectRatio === '9:16' ? 'fit-blur' : 'fit-blur');

  const handleApplyFramingToAll = (mode: FramingMode) => {
    if (onApplyFramingModeToAll) {
      onApplyFramingModeToAll(mode);
    } else if (onUpdateClip) {
      clips.forEach((c, idx) => {
        onUpdateClip(idx, { ...c, framingMode: mode });
      });
    }
  };

  // Audio & Horn refs
  const activeHornStopRef = useRef<(() => void) | null>(null);
  const activeAuditionStopRef = useRef<(() => void) | null>(null);
  const hornTriggeredRef = useRef(false);
  const isDuckedRef = useRef(false);
  const duckTimeoutRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);

  // Interactive Horn Drag state
  const [isDraggingHornMarker, setIsDraggingHornMarker] = useState(false);
  const [isDraggingTimelineHorn, setIsDraggingTimelineHorn] = useState(false);
  const scrubberRef = useRef<HTMLDivElement>(null);
  const timelineBarRef = useRef<HTMLDivElement>(null);

  // Pointer drag state for video pan
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; startPanX: number; startPanY: number }>({
    x: 0,
    y: 0,
    startPanX: 0,
    startPanY: 0,
  });
  const hasDraggedRef = useRef(false);

  // Clip state parameters
  const [maxDuration, setMaxDuration] = useState<number>(() => {
    if (clip && Number.isFinite(clip.originalDuration) && clip.originalDuration > 0.1) {
      return clip.originalDuration;
    }
    return 5.0;
  });

  const startTime = clip && Number.isFinite(clip.startTime) ? clip.startTime : 0;
  const endTime =
    clip && Number.isFinite(clip.endTime) && clip.endTime > startTime
      ? clip.endTime
      : maxDuration;
  const volume = clip?.volume ?? 1;
  const playbackRate = clip?.playbackRate ?? 1;
  const zoom = clip?.zoom ?? 1.0;
  const panX = clip?.panX ?? 0;
  const panY = clip?.panY ?? 0;
  const tag = clip?.tag;
  const customTagText = clip?.customTagText || '';
  const hornDisabled = Boolean(clip?.hornDisabled);
  const hasNativeHorn = Boolean(clip?.hasNativeHorn);
  const useCustomTiming = clip?.hornTimingOverride !== undefined;
  const hornTimingOverride = clip?.hornTimingOverride ?? 0.5;

  // Effective horn settings
  const effectiveHornConfig = overlaySettings.hornConfig || {
    enabled: overlaySettings.goalHornSound,
    useCustomHorn: false,
    triggerMode: 'every_clip',
    clipOffsetSeconds: 0.5,
    volume: 1.0,
    hornDuration: 5.0,
    skipClipsWithNativeHorn: true,
    duckVideoAudio: true,
  };

  const isHornGloballyEnabled =
    overlaySettings.goalHornSound !== false && effectiveHornConfig.enabled !== false;
  const isNativeHornSkipped =
    hasNativeHorn && effectiveHornConfig.skipClipsWithNativeHorn !== false;
  const isEligibleForHorn = isHornGloballyEnabled && !hornDisabled && !isNativeHornSkipped;

  // Background Music configuration
  const bgMusic = overlaySettings.backgroundMusic;
  const bgMusicAudioRef = useRef<HTMLAudioElement | null>(null);

  const trimmedDuration = Math.max(0.1, (endTime - startTime) / playbackRate);
  const activeTriggerOffset = useCustomTiming
    ? Math.max(0, Math.min(trimmedDuration, hornTimingOverride))
    : Math.max(0, Math.min(trimmedDuration, effectiveHornConfig.clipOffsetSeconds ?? 0.5));
  const targetVideoTimestamp = startTime + activeTriggerOffset * playbackRate;

  // Effective live overlays
  const effectiveScorebug: ScorebugConfig =
    clip?.useCustomOverlays && clip?.scorebugOverride
      ? {
          ...overlaySettings.scorebug,
          ...clip.scorebugOverride,
          enabled:
            clip.scorebugOverride.enabled !== undefined
              ? clip.scorebugOverride.enabled
              : overlaySettings.scorebug.enabled,
        }
      : overlaySettings.scorebug;

  const effectivePlayerBanner: PlayerBannerConfig =
    clip?.useCustomOverlays && clip?.playerBannerOverride
      ? {
          ...overlaySettings.playerBanner,
          ...clip.playerBannerOverride,
          enabled:
            clip.playerBannerOverride.enabled !== undefined
              ? clip.playerBannerOverride.enabled
              : overlaySettings.playerBanner.enabled,
        }
      : overlaySettings.playerBanner;

  const effectiveTag = tag;
  const effectiveTagText = customTagText || (effectiveTag ? effectiveTag : '');

  // Helper to update clip fields
  const updateClipField = useCallback(
    (updates: Partial<VideoClip>) => {
      if (activeIndex !== null && clip && onUpdateClip) {
        onUpdateClip(activeIndex, {
          ...clip,
          ...updates,
        });
      }
    },
    [activeIndex, clip, onUpdateClip],
  );

  // Stop active horn playback
  const stopActiveHorn = useCallback(() => {
    if (duckTimeoutRef.current) {
      clearTimeout(duckTimeoutRef.current);
      duckTimeoutRef.current = null;
    }
    if (activeHornStopRef.current) {
      try {
        activeHornStopRef.current();
      } catch {}
      activeHornStopRef.current = null;
    }
    setIsHornFiring(false);
    const origFactor = bgMusic?.originalVideoVolume ?? 1.0;
    if (videoRef.current && isDuckedRef.current) {
      videoRef.current.volume = volume * origFactor;
      isDuckedRef.current = false;
    }
    if (bgMusicAudioRef.current && bgMusic?.enabled) {
      bgMusicAudioRef.current.volume = Math.max(0, Math.min(1.0, bgMusic.volume ?? 0.75));
    }
  }, [volume, bgMusic?.originalVideoVolume, bgMusic?.enabled, bgMusic?.volume]);

  // Stop audition audio
  const stopAudition = useCallback(() => {
    if (activeAuditionStopRef.current) {
      try {
        activeAuditionStopRef.current();
      } catch {}
      activeAuditionStopRef.current = null;
    }
    setIsAuditioningHorn(false);
    setIsHornFiring(false);
  }, []);

  // When active clip changes, pause and reset
  useEffect(() => {
    stopActiveHorn();
    stopAudition();
    setIsPlaying(false);
    setCurrentPlayTime(0);
    hornTriggeredRef.current = false;

    if (clip) {
      const dur =
        Number.isFinite(clip.originalDuration) && clip.originalDuration > 0.1
          ? clip.originalDuration
          : 5.0;
      setMaxDuration(dur);
      if (videoRef.current) {
        videoRef.current.currentTime = clip.startTime || 0;
        videoRef.current.playbackRate = clip.playbackRate || 1;
        videoRef.current.volume = clip.volume ?? 1;
      }
    }
  }, [activeIndex, clip?.id, stopActiveHorn, stopAudition]);

  // Sync volume & playback rate to video element (preserving original video audio balance)
  useEffect(() => {
    if (videoRef.current && !isDuckedRef.current) {
      const origFactor = bgMusic?.originalVideoVolume ?? 1.0;
      videoRef.current.volume = Math.max(0, Math.min(1.0, volume * origFactor));
    }
  }, [volume, bgMusic?.originalVideoVolume]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Synchronize AI background music track playback and volume
  useEffect(() => {
    const isEnabled = Boolean(bgMusic?.enabled && bgMusic?.currentTrack);
    if (!isEnabled) {
      if (bgMusicAudioRef.current) {
        try {
          bgMusicAudioRef.current.pause();
          bgMusicAudioRef.current.src = '';
        } catch {}
      }
      return;
    }

    const track = bgMusic!.currentTrack!;
    let url = track.audioUrl;
    if (!url && track.audioBlob) {
      url = URL.createObjectURL(track.audioBlob);
    }
    if (!url) return;

    if (!bgMusicAudioRef.current) {
      bgMusicAudioRef.current = new Audio();
    }
    const audio = bgMusicAudioRef.current;
    if (audio.src !== url) {
      audio.src = url;
      audio.currentTime = track.startTimeOffset || 0;
    }
    audio.loop = bgMusic?.loop !== false;
    const baseVol = bgMusic?.volume ?? 0.75;
    audio.volume = Math.max(0, Math.min(1.0, baseVol * (isDuckedRef.current ? 0.25 : 1.0)));

    if (isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [bgMusic?.enabled, bgMusic?.currentTrack, bgMusic?.volume, bgMusic?.loop, isPlaying]);

  // Cleanup background music audio element on unmount
  useEffect(() => {
    return () => {
      if (bgMusicAudioRef.current) {
        try {
          bgMusicAudioRef.current.pause();
          bgMusicAudioRef.current.src = '';
        } catch {}
      }
    };
  }, []);

  // Playback & Goal Horn Check Loop
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const checkPlayback = () => {
      const video = videoRef.current;
      if (!video) return;

      const curTime = video.currentTime;
      const progressInTrim = Math.max(0, (curTime - startTime) / playbackRate);
      setCurrentPlayTime(progressInTrim);

      // Sync blurred background video if active
      if (bgVideoRef.current) {
        if (Math.abs(bgVideoRef.current.currentTime - curTime) > 0.15) {
          bgVideoRef.current.currentTime = curTime;
        }
        if (bgVideoRef.current.paused && !video.paused) {
          bgVideoRef.current.play().catch(() => {});
        }
      }

      // Loop or pause at trim end
      if (curTime >= endTime - 0.04) {
        video.currentTime = startTime;
        if (bgVideoRef.current) bgVideoRef.current.currentTime = startTime;
        setCurrentPlayTime(0);
        hornTriggeredRef.current = false;
        return;
      }

      // Check horn trigger
      const shouldTriggerMode =
        effectiveHornConfig.triggerMode === 'every_clip' || tag === 'GOAL' || useCustomTiming;

      if (isEligibleForHorn && shouldTriggerMode && !hornTriggeredRef.current) {
        if (curTime >= targetVideoTimestamp) {
          hornTriggeredRef.current = true;
          setIsHornFiring(true);

          playHornSound(effectiveHornConfig)
            .then(({ stop }) => {
              activeHornStopRef.current = () => {
                try {
                  stop();
                } catch {}
                setIsHornFiring(false);
              };

              const durMs =
                (effectiveHornConfig.hornDuration ??
                  effectiveHornConfig.customHornDuration ??
                  5.0) * 1000;

              const origFactor = bgMusic?.originalVideoVolume ?? 1.0;
              const baseVidVol = volume * origFactor;

              if (effectiveHornConfig.duckVideoAudio && videoRef.current) {
                videoRef.current.volume = baseVidVol * 0.15;
                isDuckedRef.current = true;

                // Duck AI Background Music concurrently
                if (bgMusicAudioRef.current && bgMusic?.enabled && bgMusic?.duckOnGoalHorn !== false) {
                  bgMusicAudioRef.current.volume = Math.max(
                    0,
                    Math.min(1.0, (bgMusic.volume ?? 0.75) * 0.25),
                  );
                }

                duckTimeoutRef.current = setTimeout(() => {
                  setIsHornFiring(false);
                  if (videoRef.current && isDuckedRef.current) {
                    videoRef.current.volume = baseVidVol;
                    isDuckedRef.current = false;
                  }
                  if (bgMusicAudioRef.current && bgMusic?.enabled) {
                    bgMusicAudioRef.current.volume = Math.max(
                      0,
                      Math.min(1.0, bgMusic.volume ?? 0.75),
                    );
                  }
                }, durMs);
              } else {
                duckTimeoutRef.current = setTimeout(() => {
                  setIsHornFiring(false);
                }, durMs);
              }
            })
            .catch((err) => {
              setIsHornFiring(false);
              console.warn('Horn playback error:', err);
            });
        }
      }

      rafRef.current = requestAnimationFrame(checkPlayback);
    };

    rafRef.current = requestAnimationFrame(checkPlayback);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [
    isPlaying,
    startTime,
    endTime,
    playbackRate,
    isEligibleForHorn,
    targetVideoTimestamp,
    tag,
    useCustomTiming,
    effectiveHornConfig,
    volume,
    stopActiveHorn,
  ]);

  // Video metadata loaded
  const handleVideoLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    let dur = v.duration;
    if (dur === Infinity) {
      v.currentTime = 1e10;
      v.ontimeupdate = () => {
        v.ontimeupdate = null;
        dur = v.duration;
        if (!Number.isFinite(dur)) dur = v.currentTime;
        v.currentTime = startTime;
        if (Number.isFinite(dur) && dur > 0.1) {
          setMaxDuration(dur);
          if (endTime > dur || endTime <= 0) {
            updateClipField({ endTime: dur, originalDuration: dur });
          }
        }
      };
      return;
    }

    if (Number.isFinite(dur) && dur > 0.1) {
      setMaxDuration(dur);
      if (!Number.isFinite(endTime) || endTime > dur || endTime <= 0) {
        updateClipField({ endTime: dur, originalDuration: dur });
      }
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      bgVideoRef.current?.pause();
      setIsPlaying(false);
      stopActiveHorn();
    } else {
      stopAudition();
      if (video.currentTime < startTime || video.currentTime >= endTime - 0.05) {
        video.currentTime = startTime;
        if (bgVideoRef.current) bgVideoRef.current.currentTime = startTime;
        hornTriggeredRef.current = false;
        setCurrentPlayTime(0);
      } else if (video.currentTime < targetVideoTimestamp) {
        hornTriggeredRef.current = false;
      }
      video
        .play()
        .then(() => {
          if (bgVideoRef.current) {
            bgVideoRef.current.currentTime = video.currentTime;
            bgVideoRef.current.playbackRate = video.playbackRate;
            bgVideoRef.current.play().catch(() => {});
          }
        })
        .catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSeekPlayhead = (targetOffsetSeconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    const mediaTime = startTime + targetOffsetSeconds * playbackRate;
    const clampedTime = Math.max(startTime, Math.min(endTime, mediaTime));
    video.currentTime = clampedTime;
    if (bgVideoRef.current) {
      bgVideoRef.current.currentTime = clampedTime;
    }
    setCurrentPlayTime(targetOffsetSeconds);
    if (mediaTime < targetVideoTimestamp) {
      hornTriggeredRef.current = false;
    }
    stopActiveHorn();
  };

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetOffset = ratio * trimmedDuration;
    handleSeekPlayhead(targetOffset);
  };

  // Draggable Goal Horn Marker on Scrubber
  const handleHornScrubberPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    setIsDraggingHornMarker(true);
    updateClipField({ hornTimingOverride: activeTriggerOffset });

    const scrubber = scrubberRef.current;
    if (!scrubber) return;
    const rect = scrubber.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newOffset = Math.round(ratio * trimmedDuration * 10) / 10;
    updateClipField({ hornTimingOverride: newOffset });
    handleSeekPlayhead(newOffset);
  };

  const handleHornScrubberPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingHornMarker) return;
    e.stopPropagation();
    e.preventDefault();
    const scrubber = scrubberRef.current;
    if (!scrubber) return;

    const rect = scrubber.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newOffset = Math.round(ratio * trimmedDuration * 10) / 10;
    updateClipField({ hornTimingOverride: newOffset });
    handleSeekPlayhead(newOffset);
  };

  const handleHornScrubberPointerUp = (e: React.PointerEvent) => {
    if (isDraggingHornMarker) {
      e.stopPropagation();
      e.preventDefault();
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setIsDraggingHornMarker(false);
    }
  };

  // Draggable Goal Horn Marker on Timeline Bar
  const handleHornTimelinePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    setIsDraggingTimelineHorn(true);

    const bar = timelineBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const rawTimestamp = ratio * maxDuration;
    const newOffset = Math.max(
      0,
      Math.min(trimmedDuration, Math.round((rawTimestamp - startTime) * 10) / 10),
    );
    updateClipField({ hornTimingOverride: newOffset });
    handleSeekPlayhead(newOffset);
  };

  const handleHornTimelinePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingTimelineHorn) return;
    e.stopPropagation();
    e.preventDefault();
    const bar = timelineBarRef.current;
    if (!bar) return;

    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const rawTimestamp = ratio * maxDuration;
    const newOffset = Math.max(
      0,
      Math.min(trimmedDuration, Math.round((rawTimestamp - startTime) * 10) / 10),
    );
    updateClipField({ hornTimingOverride: newOffset });
    handleSeekPlayhead(newOffset);
  };

  const handleHornTimelinePointerUp = (e: React.PointerEvent) => {
    if (isDraggingTimelineHorn) {
      e.stopPropagation();
      e.preventDefault();
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setIsDraggingTimelineHorn(false);
    }
  };

  // Snap Horn to Current Frame
  const handleSnapHornToCurrent = () => {
    const offset = Math.round(currentPlayTime * 10) / 10;
    updateClipField({ hornTimingOverride: offset });
  };

  // Audition Horn
  const handleToggleAudition = async () => {
    if (isAuditioningHorn) {
      stopAudition();
    } else {
      stopActiveHorn();
      setIsAuditioningHorn(true);
      setIsHornFiring(true);
      try {
        const { stop } = await playHornSound(effectiveHornConfig);
        activeAuditionStopRef.current = () => {
          try {
            stop();
          } catch {}
          setIsAuditioningHorn(false);
          setIsHornFiring(false);
        };
        const durMs =
          (effectiveHornConfig.hornDuration ??
            effectiveHornConfig.customHornDuration ??
            5.0) * 1000;
        setTimeout(() => {
          if (activeAuditionStopRef.current) {
            stopAudition();
          }
        }, durMs);
      } catch (err) {
        setIsAuditioningHorn(false);
        setIsHornFiring(false);
      }
    }
  };

  // Preview Horn Sync
  const handlePreviewFromBeforeHorn = () => {
    const video = videoRef.current;
    if (!video) return;
    stopActiveHorn();
    stopAudition();

    const startOffset = Math.max(0, activeTriggerOffset - 1.5);
    handleSeekPlayhead(startOffset);
    video.play().catch(() => {});
    setIsPlaying(true);
  };

  // Mouse pan drag for zoomed video
  const handlePointerDown = (e: React.PointerEvent) => {
    if (zoom <= 1) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startPanX: panX,
      startPanY: panY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasDraggedRef.current = true;
    }
    const sensitivity = 0.5 / zoom;
    const newPanX = Math.max(
      -100,
      Math.min(100, dragStartRef.current.startPanX - dx * sensitivity),
    );
    const newPanY = Math.max(
      -100,
      Math.min(100, dragStartRef.current.startPanY - dy * sensitivity),
    );
    updateClipField({ panX: Math.round(newPanX), panY: Math.round(newPanY) });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handlePreviewContainerClick = () => {
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
    togglePlay();
  };

  // Aspect ratio styling for both empty state and player container
  const getAspectStyle = (ratio: AspectRatio): React.CSSProperties => {
    return {
      aspectRatio: ratio === '9:16' ? '9 / 16' : ratio === '1:1' ? '1 / 1' : '16 / 9',
      height: '100%',
      width: 'auto',
      maxWidth: '100%',
      maxHeight: '100%',
    };
  };

  // If no clips exist, show framed studio with live aspect ratio canvas
  if (!clip || activeIndex === null || clips.length === 0) {
    return (
      <div className="relative w-full h-full flex flex-col bg-slate-950/90 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
        {/* 1. STUDIO HEADER (Empty state with live format switcher) */}
        <div className="shrink-0 flex items-center justify-between px-3.5 py-2 border-b border-slate-800 bg-slate-900/80 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="bg-slate-800 border border-slate-700 text-slate-400 font-mono text-[10px] px-2 py-0.5 rounded font-bold uppercase">
              0 Clips
            </span>
            <span className="text-xs font-bold font-['Chakra_Petch'] text-slate-300 uppercase tracking-wider">
              Canvas Studio
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Format selector buttons */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 shadow-xs">
              {(['9:16', '16:9', '1:1'] as AspectRatio[]).map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => onAspectRatioChange?.(ratio)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono transition cursor-pointer ${
                    aspectRatio === ratio
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title={`Switch to ${ratio} format (${ratio === '9:16' ? 'Vertical Shorts' : ratio === '16:9' ? 'YouTube Widescreen' : 'Square Feed'})`}
                >
                  {ratio} {ratio === '9:16' ? 'Shorts' : ratio === '16:9' ? 'Wide' : 'Square'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2. STAGE: Aspect Ratio Framed Canvas */}
        <div className="flex-1 min-h-0 relative flex items-center justify-center bg-black p-3 overflow-hidden select-none">
          <div
            style={getAspectStyle(aspectRatio)}
            className="relative rounded-2xl overflow-hidden bg-slate-950 border-2 border-dashed border-slate-800 flex flex-col items-center justify-center p-6 text-center shadow-2xl transition-all duration-300 group"
          >
            {/* Aspect watermark badge */}
            <div className="absolute top-3 left-3 bg-slate-900/90 border border-slate-800 backdrop-blur-xs px-2 py-1 rounded-md text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span>
                {aspectRatio === '9:16'
                  ? '9:16 Vertical Shorts (1080×1920)'
                  : aspectRatio === '16:9'
                  ? '16:9 Widescreen (1920×1080)'
                  : '1:1 Square (1080×1080)'}
              </span>
            </div>

            {/* Ice rink guideline lines */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-red-500/10 pointer-events-none" />
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 border-l border-blue-500/10 pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center max-w-xs">
              <div className="w-14 h-14 rounded-2xl bg-red-600/10 border border-red-500/20 flex items-center justify-center mb-3 shadow-inner">
                <Tv className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="font-['Chakra_Petch'] text-base font-bold text-white uppercase tracking-wider mb-1">
                {aspectRatio === '9:16'
                  ? '9:16 Shorts Canvas'
                  : aspectRatio === '16:9'
                  ? '16:9 Widescreen Canvas'
                  : '1:1 Square Canvas'}
              </h3>
              <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
                Add video clips or load instant NHL samples. They will be framed for this canvas.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-2 w-full justify-center">
                <button
                  id="empty-state-upload-btn"
                  type="button"
                  onClick={onOpenUploadDialog}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-950/40 transition cursor-pointer uppercase tracking-wider font-['Chakra_Petch']"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Videos</span>
                </button>
                <button
                  id="empty-state-sample-btn"
                  type="button"
                  onClick={onAddSampleClips}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white font-bold text-xs border border-slate-700 transition cursor-pointer font-['Chakra_Petch']"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Sample Clips</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 3. STUDIO FOOTER (Empty state) */}
        <div className="shrink-0 px-3.5 py-1.5 border-t border-slate-800/80 bg-slate-900/60 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Canvas ready &bull; Frame format: <strong className="text-white font-mono">{aspectRatio}</strong>
          </span>
          <span className="text-slate-500 text-[10px]">
            Switch format anytime using the buttons above
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950/90 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
      {/* 1. STUDIO HEADER: Clip Navigator, Timestamp Badge, and Name */}
      <div className="shrink-0 flex items-center justify-between px-3.5 py-2 border-b border-slate-800 bg-slate-900/80 gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {/* Previous / Next Clip Navigation */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 shrink-0 shadow-xs">
            <button
              id="prev-clip-btn"
              type="button"
              disabled={activeIndex <= 0}
              onClick={() => onSelectClipIndex && onSelectClipIndex(activeIndex - 1)}
              className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-800 transition"
              title="Previous Clip"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-[11px] font-bold font-['Chakra_Petch'] text-slate-300 select-none">
              {activeIndex + 1} / {clips.length}
            </span>
            <button
              id="next-clip-btn"
              type="button"
              disabled={activeIndex >= clips.length - 1}
              onClick={() => onSelectClipIndex && onSelectClipIndex(activeIndex + 1)}
              className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-800 transition"
              title="Next Clip"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Sequence badge */}
          <span className="bg-red-600 text-white font-mono font-black text-[10px] px-1.5 py-0.5 rounded shrink-0 shadow-xs">
            #{activeIndex + 1}
          </span>

          {/* Recorded Timestamp Badge */}
          {clip.recordedAtDisplay && (
            <span
              className="hidden md:flex items-center gap-1 text-[11px] font-mono text-amber-300 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded shrink-0"
              title={`Detected from filename: ${clip.name}`}
            >
              <Clock className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="truncate">{clip.recordedAtDisplay}</span>
            </span>
          )}

          {/* Editable Clip Name */}
          <div className="flex items-center min-w-0 max-w-[200px] sm:max-w-xs">
            <input
              type="text"
              value={clip.name}
              onChange={(e) => updateClipField({ name: e.target.value })}
              className="bg-transparent text-white font-semibold text-xs px-1 py-0.5 rounded hover:bg-slate-800/50 focus:bg-slate-900 focus:border focus:border-slate-700 focus:outline-none truncate w-full"
              title="Click to edit clip name"
            />
          </div>
        </div>

        {/* Header Right: Overlay Toggle, Aspect Ratio Badge, Delete */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowOverlaysPreview(!showOverlaysPreview)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition shadow cursor-pointer ${
              showOverlaysPreview
                ? 'bg-sky-950/80 border-sky-500/60 text-sky-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Toggle Hockey Scorebug, Player Lower Third, and Highlight Tag"
          >
            {showOverlaysPreview ? (
              <Eye className="w-3.5 h-3.5 text-sky-400" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span className="hidden sm:inline">Overlays</span>
          </button>

          {/* Framing Mode Selector (16:9 into 9:16 Shorts fit-blur / fit-bars / cover) */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 shadow-xs">
            <span className="text-[9px] font-bold uppercase font-['Chakra_Petch'] text-slate-400 px-1.5 hidden xl:inline">
              Framing:
            </span>
            <button
              type="button"
              onClick={() => updateClipField({ framingMode: 'fit-blur' })}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
                effectiveFramingMode === 'fit-blur'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Fit 100% of 16:9 video in 9:16 Shorts with dynamic blurred background (zero cropped pixels!)"
            >
              <Sparkles className="w-2.5 h-2.5 text-sky-300" />
              <span>Fit + Blur</span>
            </button>
            <button
              type="button"
              onClick={() => updateClipField({ framingMode: 'fit-bars' })}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                effectiveFramingMode === 'fit-bars'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Fit 100% of 16:9 video with clean dark arena matte bars"
            >
              <span>Fit + Matte</span>
            </button>
            <button
              type="button"
              onClick={() => updateClipField({ framingMode: 'cover' })}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                effectiveFramingMode === 'cover'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Fill entire frame (crops sides of 16:9)"
            >
              <span>Fill (Crop)</span>
            </button>
          </div>

          {clips.length > 1 && (
            <button
              type="button"
              onClick={() => handleApplyFramingToAll(effectiveFramingMode)}
              className="text-[9px] font-medium text-slate-400 hover:text-sky-300 hover:bg-slate-800/80 px-1.5 py-1 rounded transition border border-slate-800 hidden sm:inline cursor-pointer"
              title={`Apply current framing mode (${effectiveFramingMode}) to all clips in project`}
            >
              All Clips
            </button>
          )}

          {/* Interactive Aspect Ratio Switcher */}
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
                title={`Switch to ${ratio} format (${ratio === '9:16' ? 'Vertical Shorts' : ratio === '16:9' ? 'YouTube Widescreen' : 'Square Feed'})`}
              >
                {ratio}
              </button>
            ))}
          </div>

          {onRemoveClip && (
            <button
              type="button"
              onClick={() => onRemoveClip(activeIndex)}
              className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-850 transition cursor-pointer"
              title="Delete this clip"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. VIDEO STAGE: Native Hardware Accelerated Video Player & Live WYSIWYG Overlays */}
      <div className="flex-1 min-h-0 relative flex items-center justify-center bg-black p-2 overflow-hidden select-none">
        <div
          style={getAspectStyle(aspectRatio)}
          className={`relative rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-850 shadow-2xl select-none transition-all duration-200 ${
            zoom > 1.02 ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={handlePreviewContainerClick}
        >
          {/* Dynamic Blurred Video Background for 16:9 in 9:16 Framing */}
          {effectiveFramingMode === 'fit-blur' && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
              <video
                ref={bgVideoRef}
                src={clip.url}
                playsInline
                muted
                aria-hidden="true"
                className="w-full h-full object-cover blur-2xl scale-125 opacity-65 brightness-[0.55] transition-opacity duration-300"
              />
              {/* Vignette Depth Gradient */}
              <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/10 to-slate-950/70 pointer-events-none" />
            </div>
          )}

          {/* Clean Dark Arena Matte for fit-bars mode */}
          {effectiveFramingMode === 'fit-bars' && (
            <div className="absolute inset-0 bg-[#060913] pointer-events-none select-none">
              <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-[#060913] to-slate-950 pointer-events-none" />
            </div>
          )}

          {/* Hardware-accelerated Video Element with CSS Zoom/Pan transform */}
          <div
            className="w-full h-full flex items-center justify-center transition-transform duration-75 ease-out will-change-transform relative z-10"
            style={{
              transform: `scale(${zoom}) translate(${-panX * 0.35}%, ${-panY * 0.35}%)`,
              transformOrigin: 'center center',
            }}
          >
            <video
              ref={videoRef}
              src={clip.url}
              playsInline
              onLoadedMetadata={handleVideoLoadedMetadata}
              className={`pointer-events-none ${
                effectiveFramingMode === 'cover'
                  ? 'w-full h-full object-cover'
                  : 'w-full h-auto max-h-full object-contain shadow-2xl drop-shadow-[0_16px_36px_rgba(0,0,0,0.85)] border-y border-white/10'
              }`}
            />
          </div>

          {/* LIVE BROADCAST OVERLAYS (WYSIWYG) */}
          {showOverlaysPreview && (
            <>
              {/* Scorebug - Top Left */}
              {effectiveScorebug.enabled && (
                <div className="absolute top-2.5 left-2.5 z-20 pointer-events-none bg-slate-950/92 backdrop-blur-md border border-sky-400/50 rounded-lg px-2.5 py-1 shadow-2xl flex items-center gap-2 text-xs font-['Chakra_Petch'] select-none animate-in fade-in duration-100">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-white tracking-wider text-[11px] max-w-[65px] truncate">
                      {effectiveScorebug.awayTeam || 'AWAY'}
                    </span>
                    <span className="bg-sky-500/25 text-sky-300 font-black px-1.5 py-0.5 rounded text-[11px] border border-sky-400/40 min-w-[20px] text-center shadow-xs">
                      {effectiveScorebug.awayScore ?? 0}
                    </span>
                  </div>

                  <span className="text-slate-600 font-bold">|</span>

                  <div className="flex items-center gap-1.5">
                    <span className="bg-sky-500/25 text-sky-300 font-black px-1.5 py-0.5 rounded text-[11px] border border-sky-400/40 min-w-[20px] text-center shadow-xs">
                      {effectiveScorebug.homeScore ?? 0}
                    </span>
                    <span className="font-black text-white tracking-wider text-[11px] max-w-[65px] truncate">
                      {effectiveScorebug.homeTeam || 'HOME'}
                    </span>
                  </div>

                  <div className="border-l border-slate-700/80 pl-2 flex items-center gap-1.5 text-[10px]">
                    <span className="font-black text-amber-400">
                      {effectiveScorebug.period || '1ST'}
                    </span>
                    <span className="font-mono text-slate-200">
                      {effectiveScorebug.timeRemaining || '0:18'}
                    </span>
                  </div>
                </div>
              )}

              {/* Highlight Action Tag - Top Right */}
              {Boolean(effectiveTag || effectiveTagText) &&
                overlaySettings.showStamps !== false &&
                overlaySettings.showHighlightTags !== false && (
                <div className="absolute top-2.5 right-2.5 z-20 pointer-events-none select-none flex flex-col items-end gap-1 animate-in fade-in duration-100">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-black italic tracking-wider px-2.5 py-1 rounded-md shadow-2xl border ${
                      effectiveTag === 'GOAL'
                        ? 'bg-red-600 text-white border-red-400 shadow-red-950/80 animate-pulse'
                        : effectiveTag === 'SAVE'
                        ? 'bg-sky-600 text-white border-sky-400 shadow-sky-950/80'
                        : effectiveTag === 'HIT'
                        ? 'bg-orange-600 text-white border-orange-400 shadow-orange-950/80'
                        : 'bg-amber-600 text-white border-amber-400 shadow-amber-950/80'
                    }`}
                  >
                    <span>
                      {effectiveTag === 'GOAL'
                        ? '🚨'
                        : effectiveTag === 'SAVE'
                        ? '🧤'
                        : effectiveTag === 'HIT'
                        ? '💥'
                        : '⚡'}
                    </span>
                    <span>{effectiveTagText || effectiveTag}</span>
                  </span>

                  {isEligibleForHorn &&
                    overlaySettings.goalHornSound !== false &&
                    overlaySettings.hornConfig?.enabled !== false && (
                    <div className="bg-slate-950/90 backdrop-blur-xs border border-amber-500/60 text-amber-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow flex items-center gap-1">
                      <Volume2 className="w-3 h-3 text-amber-400 animate-pulse" />
                      <span>Horn: {activeTriggerOffset.toFixed(1)}s</span>
                    </div>
                  )}
                </div>
              )}

              {/* Standalone Horn Marker if tag is hidden/off */}
              {(!effectiveTag ||
                !effectiveTagText ||
                overlaySettings.showStamps === false ||
                overlaySettings.showHighlightTags === false) &&
                isEligibleForHorn &&
                overlaySettings.goalHornSound !== false &&
                overlaySettings.hornConfig?.enabled !== false && (
                <div className="absolute top-2.5 right-2.5 z-20 pointer-events-none select-none animate-in fade-in duration-100">
                  <div className="bg-slate-950/90 backdrop-blur-xs border border-amber-500/60 text-amber-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow flex items-center gap-1">
                    <Volume2 className="w-3 h-3 text-amber-400 animate-pulse" />
                    <span>Horn: {activeTriggerOffset.toFixed(1)}s</span>
                  </div>
                </div>
              )}

              {/* Player Lower Third - Bottom Left */}
              {effectivePlayerBanner.enabled && (
                <div className="absolute bottom-2.5 left-2.5 z-20 pointer-events-none bg-slate-950/92 backdrop-blur-md border border-sky-500/40 rounded-lg p-1.5 shadow-2xl flex items-center gap-2 max-w-[75%] select-none animate-in fade-in duration-100">
                  <div className="w-7 h-7 bg-red-600 rounded flex items-center justify-center font-['Chakra_Petch'] font-black text-white text-xs shadow-md shrink-0 border border-red-400/40">
                    {effectivePlayerBanner.jerseyNumber
                      ? `#${effectivePlayerBanner.jerseyNumber.replace('#', '')}`
                      : '#'}
                  </div>
                  <div className="min-w-0 pr-1">
                    <div className="font-bold text-white text-xs leading-tight truncate font-['Chakra_Petch']">
                      {effectivePlayerBanner.playerName || 'Player Name'}
                    </div>
                    <div className="text-[10px] text-sky-400 font-medium truncate">
                      {effectivePlayerBanner.actionText || 'Highlight Play'}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Goal Siren Firing Alert */}
          {isHornFiring && overlaySettings.redSirenFlash !== false && (overlaySettings as any).sirenFlash !== false && (
            <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center bg-red-600/20 border-4 border-red-500/90 rounded-xl animate-pulse">
              <div className="bg-slate-950/95 border-2 border-amber-400 text-amber-300 font-['Chakra_Petch'] font-black px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2.5 text-sm tracking-wider uppercase shadow-amber-500/50">
                <span className="text-xl animate-bounce">🚨</span>
                <span className="text-white font-extrabold">GOAL HORN SOUNDING!</span>
                <span className="text-xl animate-bounce">🚨</span>
              </div>
            </div>
          )}

          {/* Zoom Overlay Badges & Full Rink Radar */}
          {zoom > 1.02 && (
            <>
              <div className="absolute top-10 left-2.5 bg-black/80 backdrop-blur-xs border border-amber-500/50 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1.5 pointer-events-none shadow z-10">
                <ZoomIn className="w-3 h-3 text-amber-400" />
                <span>{zoom.toFixed(2)}x Zoom</span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-300 font-mono">
                  X: {panX > 0 ? `+${panX}` : panX}% Y: {panY > 0 ? `+${panY}` : panY}%
                </span>
              </div>

              {/* Rink Radar / Minimap */}
              <div
                className="absolute bottom-2.5 right-2.5 bg-slate-950/95 border border-amber-500/60 rounded-md overflow-hidden p-0.5 shadow-2xl z-20 backdrop-blur-md cursor-crosshair"
                title="Full Ice Radar: Click anywhere to snap zoom framing"
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = (e.clientX - rect.left) / rect.width;
                  const clickY = (e.clientY - rect.top) / rect.height;
                  const pX = Math.round((clickX - 0.5) * 200);
                  const pY = Math.round((clickY - 0.5) * 200);
                  updateClipField({
                    panX: Math.max(-100, Math.min(100, pX)),
                    panY: Math.max(-100, Math.min(100, pY)),
                  });
                }}
              >
                <div className="relative w-24 h-14 bg-slate-900 rounded overflow-hidden flex items-center justify-center">
                  <video
                    src={clip.url}
                    className="w-full h-full object-cover opacity-50 pointer-events-none"
                    muted
                    playsInline
                  />
                  {(() => {
                    const boxW = Math.max(15, Math.min(100, 100 / zoom));
                    const boxH = Math.max(15, Math.min(100, 100 / zoom));
                    const maxOffsetX = (100 - boxW) / 2;
                    const maxOffsetY = (100 - boxH) / 2;
                    const left = 50 - boxW / 2 + (panX / 100) * maxOffsetX;
                    const top = 50 - boxH / 2 + (panY / 100) * maxOffsetY;
                    return (
                      <div
                        className="absolute border-2 border-amber-400 bg-amber-400/30 rounded-xs pointer-events-none shadow-sm shadow-black"
                        style={{
                          left: `${left}%`,
                          top: `${top}%`,
                          width: `${boxW}%`,
                          height: `${boxH}%`,
                        }}
                      >
                        <div className="w-1.5 h-1.5 bg-amber-400 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ring-1 ring-black" />
                      </div>
                    );
                  })()}
                  <span className="absolute bottom-0.5 left-1 text-[7px] font-mono text-amber-300 font-bold bg-black/80 px-1 rounded border border-amber-500/30">
                    Radar
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Center Play/Pause button on video hover/click */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/60 text-white flex items-center justify-center hover:scale-110 transition z-10 shadow-lg cursor-pointer"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
        </div>
      </div>

      {/* 3. SCRUBBER TRACK WITH DRAGGABLE 🚨 GOAL HORN PIN & TRANSPORT BAR */}
      <div className="shrink-0 bg-slate-900/90 border-t border-slate-800 p-2.5 sm:p-3 space-y-2">
        {/* Scrubber Bar Track */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-white font-bold">
              {currentPlayTime.toFixed(1)}s / {trimmedDuration.toFixed(1)}s
            </span>
            <div className="flex items-center gap-2">
              {isEligibleForHorn && (
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <span>🚨 Horn Trigger:</span>
                  <span className="bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-800/60">
                    {activeTriggerOffset.toFixed(1)}s
                  </span>
                </span>
              )}
              <span className="text-slate-400 text-[10px]">
                Trim: {startTime.toFixed(1)}s – {endTime.toFixed(1)}s
              </span>
            </div>
          </div>

          {/* Interactive Scrubber with Draggable Horn Marker */}
          <div
            ref={scrubberRef}
            onClick={handleScrubberClick}
            className="relative w-full h-4 bg-slate-950 rounded-full cursor-pointer flex items-center border border-slate-800 select-none group"
            title="Click or drag to scrub playhead. Drag the 🚨 pin to reposition goal horn!"
          >
            {/* Played Progress Bar */}
            <div
              className="h-full bg-red-600 rounded-full transition-all pointer-events-none"
              style={{
                width: `${Math.min(100, (currentPlayTime / trimmedDuration) * 100)}%`,
              }}
            />

            {/* Current Playhead Handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow border-2 border-red-600 pointer-events-none"
              style={{
                left: `calc(${Math.min(100, (currentPlayTime / trimmedDuration) * 100)}% - 6px)`,
              }}
            />

            {/* DRAGGABLE GOAL HORN PIN */}
            {isEligibleForHorn && (
              <div
                onPointerDown={handleHornScrubberPointerDown}
                onPointerMove={handleHornScrubberPointerMove}
                onPointerUp={handleHornScrubberPointerUp}
                className="absolute top-1/2 -translate-y-1/2 z-30 cursor-grab active:cursor-grabbing hover:scale-125 transition-transform select-none"
                style={{
                  left: `calc(${Math.min(
                    100,
                    Math.max(0, (activeTriggerOffset / trimmedDuration) * 100),
                  )}% - 10px)`,
                }}
                title={`Draggable Goal Horn Pin: fires at ${activeTriggerOffset.toFixed(
                  1,
                )}s. Drag anywhere along clip!`}
              >
                <div className="w-5 h-5 rounded-full bg-amber-400 border-2 border-black shadow-lg shadow-amber-500/50 flex items-center justify-center text-[10px]">
                  🚨
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Transport Controls Row */}
        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
          {/* Play / Pause / Replay */}
          <div className="flex items-center gap-1.5">
            <button
              id="player-toggle-play-btn"
              type="button"
              onClick={togglePlay}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition flex items-center gap-1.5 shadow-md shadow-red-950/40 cursor-pointer uppercase font-['Chakra_Petch']"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>

            <button
              id="player-replay-btn"
              type="button"
              onClick={() => handleSeekPlayhead(0)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white transition"
              title="Replay from clip start"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Horn Actions: Snap Horn to Frame & Preview Sync */}
          {isEligibleForHorn && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSnapHornToCurrent}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-amber-300 text-[11px] font-bold border border-slate-700 transition"
                title="Places the goal horn at the current video frame"
              >
                <Crosshair className="w-3 h-3 text-amber-400" />
                <span>Snap Horn Here</span>
              </button>

              <button
                type="button"
                onClick={handlePreviewFromBeforeHorn}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold transition shadow"
                title="Rewinds 1.5s before horn fires and plays"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Preview Sync</span>
              </button>

              <button
                type="button"
                onClick={handleToggleAudition}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border transition ${
                  isAuditioningHorn
                    ? 'bg-red-600 text-white border-red-500 animate-pulse'
                    : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
                }`}
                title="Test arena horn sound now"
              >
                <Volume2 className="w-3 h-3 text-amber-400" />
                <span>{isAuditioningHorn ? 'Stop' : 'Audition'}</span>
              </button>
            </div>
          )}

          {/* Playback Rate & Volume */}
          <div className="flex items-center gap-2">
            {/* Speed buttons */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
              {[0.5, 0.75, 1.0, 1.5].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => updateClipField({ playbackRate: rate })}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
                    playbackRate === rate
                      ? 'bg-red-600 text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Volume slider */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
              <button
                type="button"
                onClick={() => updateClipField({ volume: volume === 0 ? 1 : 0 })}
                className="text-slate-400 hover:text-white"
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

        {/* 4. MULTI-TRACK TIMELINE & TRIMMING RANGE CONTROLS */}
        <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-850 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-300 font-bold uppercase font-['Chakra_Petch']">
              <Scissors className="w-3.5 h-3.5 text-red-400" />
              <span>Trim Range (Source: {maxDuration.toFixed(1)}s)</span>
            </div>
            <div className="text-[11px] font-mono text-sky-400 font-bold">
              Duration: {trimmedDuration.toFixed(1)}s
            </div>
          </div>

          {/* Visual Multi-Track Bar showing full video, trim range, and horn placement */}
          <div
            ref={timelineBarRef}
            className="relative w-full h-5 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 select-none cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              const rawTimestamp = ratio * maxDuration;
              const targetOffset = Math.max(
                0,
                Math.min(trimmedDuration, (rawTimestamp - startTime) / playbackRate),
              );
              handleSeekPlayhead(targetOffset);
            }}
          >
            {/* Highlighted Trim Region */}
            <div
              className="absolute top-0 bottom-0 bg-sky-500/25 border-x-2 border-sky-400 rounded-xs pointer-events-none"
              style={{
                left: `${(startTime / maxDuration) * 100}%`,
                width: `${Math.max(2, ((endTime - startTime) / maxDuration) * 100)}%`,
              }}
            />

            {/* Playhead in source timeline */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-sm pointer-events-none"
              style={{
                left: `${((startTime + currentPlayTime * playbackRate) / maxDuration) * 100}%`,
              }}
            />

            {/* Goal Horn Marker on Source Timeline */}
            {isEligibleForHorn && (
              <div
                onPointerDown={handleHornTimelinePointerDown}
                onPointerMove={handleHornTimelinePointerMove}
                onPointerUp={handleHornTimelinePointerUp}
                className="absolute top-0 bottom-0 w-3 -ml-1.5 z-20 cursor-grab active:cursor-grabbing flex items-center justify-center group/hornPin"
                style={{
                  left: `${(targetVideoTimestamp / maxDuration) * 100}%`,
                }}
                title={`Horn position: ${activeTriggerOffset.toFixed(1)}s into clip`}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-black" />
              </div>
            )}
          </div>

          {/* Sliders for Start Time & End Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {/* Start Time Slider */}
            <div className="flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-lg border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase font-['Chakra_Petch'] shrink-0">
                Start
              </span>
              <button
                type="button"
                onClick={() =>
                  updateClipField({
                    startTime: Math.max(0, Math.round((startTime - 0.1) * 10) / 10),
                  })
                }
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px]"
              >
                -0.1
              </button>
              <input
                type="range"
                min={0}
                max={Math.max(0.1, endTime - 0.1)}
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
              <button
                type="button"
                onClick={() =>
                  updateClipField({
                    startTime: Math.min(endTime - 0.1, Math.round((startTime + 0.1) * 10) / 10),
                  })
                }
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px]"
              >
                +0.1
              </button>
              <span className="font-mono text-sky-400 font-bold text-[10px] w-8 text-right">
                {startTime.toFixed(1)}s
              </span>
            </div>

            {/* End Time Slider */}
            <div className="flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-lg border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase font-['Chakra_Petch'] shrink-0">
                End
              </span>
              <button
                type="button"
                onClick={() =>
                  updateClipField({
                    endTime: Math.max(startTime + 0.1, Math.round((endTime - 0.1) * 10) / 10),
                  })
                }
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px]"
              >
                -0.1
              </button>
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
              <button
                type="button"
                onClick={() =>
                  updateClipField({
                    endTime: Math.min(maxDuration, Math.round((endTime + 0.1) * 10) / 10),
                  })
                }
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px]"
              >
                +0.1
              </button>
              <span className="font-mono text-sky-400 font-bold text-[10px] w-8 text-right">
                {endTime.toFixed(1)}s
              </span>
            </div>
          </div>
        </div>

        {/* 5. QUICK ZOOM & FRAMING PRESETS BAR */}
        <div className="flex flex-col gap-2 bg-slate-950/60 p-2 rounded-lg border border-slate-850">
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-slate-400 uppercase font-['Chakra_Petch'] flex items-center gap-1">
                <ZoomIn className="w-3 h-3 text-amber-400" />
                Zoom:
              </span>
              {[
                { label: '1.0x Full Ice', val: 1.0 },
                { label: '1.25x Wide', val: 1.25 },
                { label: '1.5x Action', val: 1.5 },
                { label: '1.8x Close', val: 1.8 },
                { label: '2.0x Tight', val: 2.0 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => updateClipField({ zoom: preset.val })}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                    Math.abs(zoom - preset.val) < 0.05
                      ? 'bg-amber-500 text-slate-950 font-bold shadow'
                      : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Vertical Positioning when in Fit Mode (16:9 in 9:16 Shorts) */}
            {effectiveFramingMode !== 'cover' && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase font-['Chakra_Petch'] flex items-center gap-1">
                  <Move className="w-2.5 h-2.5 text-sky-400" />
                  Position:
                </span>
                {[
                  { label: 'Top', y: -45 },
                  { label: 'Center', y: 0 },
                  { label: 'Bottom', y: 45 },
                ].map((pos) => (
                  <button
                    key={pos.label}
                    type="button"
                    onClick={() => updateClipField({ panY: pos.y })}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                      Math.abs(panY - pos.y) < 15
                        ? 'bg-sky-600 text-white font-bold shadow-xs'
                        : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                    }`}
                    title={`Place 16:9 video frame at the ${pos.label.toLowerCase()}`}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            )}

            {zoom > 1.02 && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500">Pan Focus:</span>
                {[
                  { label: 'Left', x: -50, y: 0 },
                  { label: 'Center', x: 0, y: 0 },
                  { label: 'Right', x: 50, y: 0 },
                  { label: 'Net', x: 0, y: 40 },
                ].map((pan) => (
                  <button
                    key={pan.label}
                    type="button"
                    onClick={() => updateClipField({ panX: pan.x, panY: pan.y })}
                    className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 font-medium cursor-pointer"
                  >
                    {pan.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => updateClipField({ zoom: 1.0, panX: 0, panY: 0 })}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-[10px] transition cursor-pointer"
                >
                  Reset
                </button>
              </div>
            )}
          </div>

          {/* Reassurance banner when in 9:16 Shorts with Fit Mode */}
          {aspectRatio === '9:16' && effectiveFramingMode !== 'cover' && (
            <div className="flex items-center justify-between text-[10px] bg-sky-950/40 border border-sky-500/25 rounded px-2 py-1 text-sky-200">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-sky-400 shrink-0" />
                <span>
                  <strong>16:9 Widescreen to 9:16 Shorts Fit:</strong> 100% of your hockey video is preserved with zero side cropping.
                </span>
              </span>
              <span className="text-[9px] text-sky-300/70 font-mono hidden sm:inline">
                {effectiveFramingMode === 'fit-blur' ? 'Blurred Arena Background' : 'Arena Matte Bars'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
