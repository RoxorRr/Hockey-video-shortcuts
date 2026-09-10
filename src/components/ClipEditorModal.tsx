import React, { useState, useRef, useEffect, useCallback } from 'react';
import { HockeyTag, VideoClip, GoalHornConfig, HockeyOverlaySettings, ScorebugConfig, PlayerBannerConfig } from '../types';
import { playHornSound } from '../lib/audio';
import { PlayerRosterPicker } from './PlayerRosterPicker';
import { autoRememberPlayer } from '../lib/rosterStorage';
import {
  X,
  Play,
  Pause,
  Gauge,
  Volume2,
  Tag,
  Scissors,
  Clock,
  VolumeX,
  ZoomIn,
  ZoomOut,
  Move,
  RotateCcw,
  Crosshair,
  Square,
  Sparkles,
  Shield,
  User,
  Trophy,
} from 'lucide-react';

interface ClipEditorModalProps {
  clip: VideoClip | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: VideoClip) => void;
  hornConfig?: GoalHornConfig;
  goalHornSound?: boolean;
  overlaySettings?: HockeyOverlaySettings;
}

const HOCKEY_TAGS: HockeyTag[] = [
  'GOAL',
  'SAVE',
  'HIT',
  'DEKE',
  'POWERPLAY',
  'OT WINNER',
  'CELEBRATION',
];

export const ClipEditorModal: React.FC<ClipEditorModalProps> = ({
  clip,
  isOpen,
  onClose,
  onSave,
  hornConfig,
  goalHornSound,
  overlaySettings,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayTime, setCurrentPlayTime] = useState(0);
  const [isAuditioningHorn, setIsAuditioningHorn] = useState(false);
  const [name, setName] = useState(clip?.name || '');
  const [maxDuration, setMaxDuration] = useState<number>(() => {
    if (clip && Number.isFinite(clip.originalDuration) && clip.originalDuration > 0.1) {
      return clip.originalDuration;
    }
    return 5.0;
  });
  const [startTime, setStartTime] = useState(() => (clip && Number.isFinite(clip.startTime) ? clip.startTime : 0));
  const [endTime, setEndTime] = useState(() => (clip && Number.isFinite(clip.endTime) && clip.endTime > 0 ? clip.endTime : 3.0));
  const [volume, setVolume] = useState(clip?.volume ?? 1);
  const [playbackRate, setPlaybackRate] = useState(clip?.playbackRate ?? 1);
  const [tag, setTag] = useState<HockeyTag | undefined>(clip?.tag);
  const [customTagText, setCustomTagText] = useState(clip?.customTagText || '');
  const [hornDisabled, setHornDisabled] = useState<boolean>(clip?.hornDisabled || false);
  const [hasNativeHorn, setHasNativeHorn] = useState<boolean>(clip?.hasNativeHorn || false);
  const [useCustomTiming, setUseCustomTiming] = useState<boolean>(clip?.hornTimingOverride !== undefined);
  const [hornTimingOverride, setHornTimingOverride] = useState<number>(clip?.hornTimingOverride ?? 0.5);

  // Per-Clip Hockey Overlays (Scorebug & Player Lower Third)
  const [useCustomOverlays, setUseCustomOverlays] = useState<boolean>(clip?.useCustomOverlays || false);
  const [scorebugOverride, setScorebugOverride] = useState<ScorebugConfig>(() => ({
    enabled: true,
    awayTeam: clip?.scorebugOverride?.awayTeam || overlaySettings?.scorebug.awayTeam || 'BOS',
    homeTeam: clip?.scorebugOverride?.homeTeam || overlaySettings?.scorebug.homeTeam || 'NYR',
    awayScore: clip?.scorebugOverride?.awayScore ?? overlaySettings?.scorebug.awayScore ?? 0,
    homeScore: clip?.scorebugOverride?.homeScore ?? overlaySettings?.scorebug.homeScore ?? 1,
    period: clip?.scorebugOverride?.period || overlaySettings?.scorebug.period || '1ST',
    timeRemaining: clip?.scorebugOverride?.timeRemaining || overlaySettings?.scorebug.timeRemaining || '0:18',
  }));
  const [playerBannerOverride, setPlayerBannerOverride] = useState<PlayerBannerConfig>(() => ({
    enabled: true,
    jerseyNumber: clip?.playerBannerOverride?.jerseyNumber || overlaySettings?.playerBanner.jerseyNumber || '97',
    playerName: clip?.playerBannerOverride?.playerName || overlaySettings?.playerBanner.playerName || 'Connor McDavid',
    actionText: clip?.playerBannerOverride?.actionText || overlaySettings?.playerBanner.actionText || 'Highlight Play',
  }));

  // Audio Playback Refs
  const activeHornStopRef = useRef<(() => void) | null>(null);
  const activeAuditionStopRef = useRef<(() => void) | null>(null);
  const hornTriggeredRef = useRef(false);
  const isDuckedRef = useRef(false);
  const duckTimeoutRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);

  // Zoom and Framing
  const [zoom, setZoom] = useState<number>(clip?.zoom ?? 1.0);
  const [panX, setPanX] = useState<number>(clip?.panX ?? 0);
  const [panY, setPanY] = useState<number>(clip?.panY ?? 0);

  // Pointer drag state for video pan
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; startPanX: number; startPanY: number }>({
    x: 0,
    y: 0,
    startPanX: 0,
    startPanY: 0,
  });
  const hasDraggedRef = useRef(false);

  // Effective horn settings
  const effectiveHornConfig: GoalHornConfig = hornConfig || {
    enabled: true,
    useCustomHorn: false,
    triggerMode: 'every_clip',
    clipOffsetSeconds: 0.5,
    volume: 1.0,
    hornDuration: 5.0,
    skipClipsWithNativeHorn: true,
    duckVideoAudio: true,
  };

  const isHornGloballyEnabled = goalHornSound !== false && (effectiveHornConfig.enabled !== false);
  const isNativeHornSkipped = hasNativeHorn && (effectiveHornConfig.skipClipsWithNativeHorn !== false);
  const isEligibleForHorn = isHornGloballyEnabled && !hornDisabled && !isNativeHornSkipped;

  const trimmedDuration = Math.max(0.1, (endTime - startTime) / playbackRate);
  const activeTriggerOffset = useCustomTiming
    ? Math.max(0, Math.min(trimmedDuration, hornTimingOverride))
    : Math.max(0, Math.min(trimmedDuration, effectiveHornConfig.clipOffsetSeconds ?? 0.5));
  // In media time within source video
  const targetVideoTimestamp = startTime + activeTriggerOffset * playbackRate;

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
    if (videoRef.current && isDuckedRef.current) {
      videoRef.current.volume = volume;
      isDuckedRef.current = false;
    }
  }, [volume]);

  const stopAudition = useCallback(() => {
    if (activeAuditionStopRef.current) {
      try {
        activeAuditionStopRef.current();
      } catch {}
      activeAuditionStopRef.current = null;
    }
    setIsAuditioningHorn(false);
  }, []);

  const handleModalClose = useCallback(() => {
    stopActiveHorn();
    stopAudition();
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setIsPlaying(false);
    onClose();
  }, [stopActiveHorn, stopAudition, onClose]);

  useEffect(() => {
    if (clip) {
      const dur = Number.isFinite(clip.originalDuration) && clip.originalDuration > 0.1 ? clip.originalDuration : 5.0;
      const s = Number.isFinite(clip.startTime) && clip.startTime >= 0 ? clip.startTime : 0;
      const e = Number.isFinite(clip.endTime) && clip.endTime > s ? clip.endTime : dur;

      setName(clip.name);
      setMaxDuration(dur);
      setStartTime(s);
      setEndTime(e);
      setVolume(clip.volume ?? 1);
      setPlaybackRate(clip.playbackRate ?? 1);
      setTag(clip.tag);
      setCustomTagText(clip.customTagText || '');
      setHornDisabled(clip.hornDisabled || false);
      setHasNativeHorn(clip.hasNativeHorn || false);
      setUseCustomTiming(clip.hornTimingOverride !== undefined);
      setHornTimingOverride(clip.hornTimingOverride ?? 0.5);
      setZoom(clip.zoom ?? 1.0);
      setPanX(clip.panX ?? 0);
      setPanY(clip.panY ?? 0);
      setCurrentPlayTime(0);
      hornTriggeredRef.current = false;

      // Sync overlay state
      setUseCustomOverlays(Boolean(clip.useCustomOverlays));
      if (clip.scorebugOverride) {
        setScorebugOverride({
          enabled: clip.scorebugOverride.enabled !== false,
          awayTeam: clip.scorebugOverride.awayTeam || overlaySettings?.scorebug.awayTeam || 'BOS',
          homeTeam: clip.scorebugOverride.homeTeam || overlaySettings?.scorebug.homeTeam || 'NYR',
          awayScore: clip.scorebugOverride.awayScore ?? overlaySettings?.scorebug.awayScore ?? 0,
          homeScore: clip.scorebugOverride.homeScore ?? overlaySettings?.scorebug.homeScore ?? 1,
          period: clip.scorebugOverride.period || overlaySettings?.scorebug.period || '1ST',
          timeRemaining: clip.scorebugOverride.timeRemaining || overlaySettings?.scorebug.timeRemaining || '0:18',
        });
      } else if (overlaySettings?.scorebug) {
        setScorebugOverride({ ...overlaySettings.scorebug });
      }

      if (clip.playerBannerOverride) {
        setPlayerBannerOverride({
          enabled: clip.playerBannerOverride.enabled !== false,
          jerseyNumber: clip.playerBannerOverride.jerseyNumber || overlaySettings?.playerBanner.jerseyNumber || '97',
          playerName: clip.playerBannerOverride.playerName || overlaySettings?.playerBanner.playerName || 'Connor McDavid',
          actionText: clip.playerBannerOverride.actionText || overlaySettings?.playerBanner.actionText || 'Highlight Play',
        });
      } else if (overlaySettings?.playerBanner) {
        setPlayerBannerOverride({ ...overlaySettings.playerBanner });
      }
    }
  }, [clip, overlaySettings]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopActiveHorn();
      stopAudition();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [stopActiveHorn, stopAudition]);

  // Playback monitoring and horn triggering loop
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
      const outputSec = Math.max(0, (curTime - startTime) / playbackRate);
      setCurrentPlayTime(outputSec);

      // Check if clip reached end
      if (curTime >= endTime - 0.04) {
        video.pause();
        setIsPlaying(false);
        stopActiveHorn();
        video.currentTime = startTime;
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
          // Fire goal horn!
          playHornSound(effectiveHornConfig)
            .then(({ stop }) => {
              activeHornStopRef.current = stop;

              if (effectiveHornConfig.duckVideoAudio && videoRef.current) {
                videoRef.current.volume = volume * 0.15;
                isDuckedRef.current = true;
                const durMs =
                  (effectiveHornConfig.hornDuration ??
                    effectiveHornConfig.customHornDuration ??
                    5.0) * 1000;
                duckTimeoutRef.current = setTimeout(() => {
                  if (videoRef.current && isDuckedRef.current) {
                    videoRef.current.volume = volume;
                    isDuckedRef.current = false;
                  }
                }, durMs);
              }
            })
            .catch((err) => {
              console.warn('Clip editor horn playback error:', err);
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

  if (!isOpen || !clip) return null;

  const handleVideoLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    let dur = v.duration;
    if (dur === Infinity) {
      // Chromium WebM workaround
      v.currentTime = 1e10;
      v.ontimeupdate = () => {
        v.ontimeupdate = null;
        dur = v.duration;
        if (!Number.isFinite(dur)) dur = v.currentTime;
        v.currentTime = startTime;
        if (Number.isFinite(dur) && dur > 0.1) {
          setMaxDuration(dur);
          if (endTime > dur || endTime <= 0) setEndTime(dur);
        }
      };
      return;
    }

    if (Number.isFinite(dur) && dur > 0.1) {
      setMaxDuration(dur);
      if (!Number.isFinite(endTime) || endTime > dur || endTime <= 0) {
        setEndTime(dur);
      }
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
      stopActiveHorn();
    } else {
      stopAudition();
      if (video.currentTime < startTime || video.currentTime >= endTime - 0.05) {
        video.currentTime = startTime;
        hornTriggeredRef.current = false;
        setCurrentPlayTime(0);
      } else if (video.currentTime < targetVideoTimestamp) {
        hornTriggeredRef.current = false;
      }
      video.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.currentTime >= endTime - 0.04) {
      video.pause();
      setIsPlaying(false);
      stopActiveHorn();
      video.currentTime = startTime;
      setCurrentPlayTime(0);
      hornTriggeredRef.current = false;
    }
  };

  const handleSeekStart = (val: number) => {
    const clamped = Math.max(0, Math.min(val, endTime - 0.1));
    setStartTime(clamped);
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
      setCurrentPlayTime(0);
      stopActiveHorn();
      hornTriggeredRef.current = false;
    }
  };

  const handleSeekEnd = (val: number) => {
    const clamped = Math.min(maxDuration, Math.max(val, startTime + 0.1));
    setEndTime(clamped);
    if (videoRef.current) {
      if (videoRef.current.currentTime > clamped) {
        videoRef.current.currentTime = clamped;
        setCurrentPlayTime(Math.max(0, (clamped - startTime) / playbackRate));
      }
    }
  };

  const handleSeekPlayhead = (newOffsetSec: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clampedOffset = Math.max(0, Math.min(trimmedDuration, newOffsetSec));
    const newCurTime = startTime + clampedOffset * playbackRate;
    video.currentTime = newCurTime;
    setCurrentPlayTime(clampedOffset);
    if (newCurTime < targetVideoTimestamp) {
      hornTriggeredRef.current = false;
    }
    stopActiveHorn();
  };

  const handlePreviewFromBeforeHorn = () => {
    const video = videoRef.current;
    if (!video) return;
    stopAudition();
    stopActiveHorn();
    // Seek to 1.5s before horn trigger or start of clip
    const preRoll = 1.5;
    const previewStartOffset = Math.max(0, activeTriggerOffset - preRoll);
    const previewVideoTime = startTime + previewStartOffset * playbackRate;
    video.currentTime = previewVideoTime;
    setCurrentPlayTime(previewStartOffset);
    hornTriggeredRef.current = false;
    video.play().catch(() => {});
    setIsPlaying(true);
  };

  const handleToggleAudition = async () => {
    if (isAuditioningHorn) {
      stopAudition();
      return;
    }

    if (isPlaying) {
      videoRef.current?.pause();
      setIsPlaying(false);
      stopActiveHorn();
    }

    setIsAuditioningHorn(true);
    try {
      const { stop } = await playHornSound(effectiveHornConfig);
      activeAuditionStopRef.current = stop;
      const durMs =
        (effectiveHornConfig.hornDuration ?? effectiveHornConfig.customHornDuration ?? 5.0) * 1000;
      setTimeout(() => {
        setIsAuditioningHorn(false);
        activeAuditionStopRef.current = null;
      }, durMs);
    } catch (err) {
      console.warn('Failed to audition goal horn in modal:', err);
      setIsAuditioningHorn(false);
      activeAuditionStopRef.current = null;
    }
  };

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
    const newPanX = Math.max(-100, Math.min(100, dragStartRef.current.startPanX - dx * sensitivity));
    const newPanY = Math.max(-100, Math.min(100, dragStartRef.current.startPanY - dy * sensitivity));
    setPanX(Math.round(newPanX));
    setPanY(Math.round(newPanY));
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

  const handleSave = () => {
    stopActiveHorn();
    stopAudition();
    onSave({
      ...clip,
      name,
      originalDuration: maxDuration,
      startTime,
      endTime,
      volume,
      playbackRate,
      tag,
      customTagText,
      hornTimingOverride: useCustomTiming ? hornTimingOverride : undefined,
      hornDisabled,
      hasNativeHorn,
      zoom,
      panX,
      panY,
      useCustomOverlays,
      scorebugOverride: useCustomOverlays ? scorebugOverride : undefined,
      playerBannerOverride: useCustomOverlays ? playerBannerOverride : undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-red-500" />
            <h3 className="font-bold text-base text-white font-['Chakra_Petch'] tracking-wide">
              TRIM & EDIT HOCKEY CLIP
            </h3>
          </div>
          <button
            onClick={handleModalClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[80vh] overflow-y-auto space-y-6">
          {/* Video Preview with Zoom & Pan */}
          <div
            className={`relative rounded-xl overflow-hidden bg-black aspect-video max-h-56 mx-auto flex items-center justify-center border border-slate-800 select-none ${
              zoom > 1.02 ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
            }`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onClick={handlePreviewContainerClick}
          >
            {/* Scaled & Panned video element */}
            <div
              className="w-full h-full flex items-center justify-center transition-transform duration-75 ease-out will-change-transform"
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
                onTimeUpdate={handleTimeUpdate}
                className="w-full h-full object-contain pointer-events-none"
              />
            </div>

            {/* Overlay Badges */}
            {zoom > 1.02 && (
              <>
                <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-xs border border-amber-500/50 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1.5 pointer-events-none shadow">
                  <ZoomIn className="w-3 h-3 text-amber-400" />
                  <span>{zoom.toFixed(2)}x Zoom</span>
                  <span className="text-slate-500">|</span>
                  <span className="text-slate-300 font-mono">
                    X: {panX > 0 ? `+${panX}` : panX}% Y: {panY > 0 ? `+${panY}` : panY}%
                  </span>
                </div>
                <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-xs text-sky-300 text-[10px] font-medium px-2 py-0.5 rounded flex items-center gap-1 pointer-events-none border border-sky-500/30 shadow">
                  <Move className="w-2.5 h-2.5 text-sky-400" />
                  <span>Drag preview to reframe</span>
                </div>

                {/* Full Ice Radar / Minimap when zoomed */}
                <div
                  className="absolute bottom-2 right-2 bg-slate-950/95 border border-amber-500/60 rounded-md overflow-hidden p-0.5 shadow-2xl z-20 backdrop-blur-md cursor-crosshair group/radar"
                  title="Full Ice Radar: Click anywhere to snap zoom focus"
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = (e.clientX - rect.left) / rect.width;
                    const clickY = (e.clientY - rect.top) / rect.height;
                    const pX = Math.round((clickX - 0.5) * 200);
                    const pY = Math.round((clickY - 0.5) * 200);
                    setPanX(Math.max(-100, Math.min(100, pX)));
                    setPanY(Math.max(-100, Math.min(100, pY)));
                  }}
                >
                  <div className="relative w-28 h-16 bg-slate-900 rounded overflow-hidden flex items-center justify-center">
                    <video
                      src={clip.url}
                      className="w-full h-full object-cover opacity-50 pointer-events-none"
                      muted
                      playsInline
                    />
                    {/* Framing rectangle showing current zoom window */}
                    {(() => {
                      const boxW = Math.max(15, Math.min(100, 100 / zoom));
                      const boxH = Math.max(15, Math.min(100, 100 / zoom));
                      const maxOffsetX = (100 - boxW) / 2;
                      const maxOffsetY = (100 - boxH) / 2;
                      const left = 50 - boxW / 2 + (panX / 100) * maxOffsetX;
                      const top = 50 - boxH / 2 + (panY / 100) * maxOffsetY;
                      return (
                        <div
                          className="absolute border-2 border-amber-400 bg-amber-400/30 rounded-xs transition-all duration-75 pointer-events-none shadow-sm shadow-black"
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
                    <span className="absolute bottom-0.5 left-1 text-[8px] font-mono text-amber-300 font-bold bg-black/80 px-1 rounded border border-amber-500/30">
                      Full Rink
                    </span>
                  </div>
                </div>
              </>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/60 text-white flex items-center justify-center hover:scale-110 transition z-10"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
          </div>

          {/* Interactive Playback Scrubber & Horn Timeline */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold transition flex items-center gap-1.5 shadow cursor-pointer"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>
                <span className="font-mono text-slate-300 font-bold">
                  {currentPlayTime.toFixed(1)}s <span className="text-slate-500">/</span> {trimmedDuration.toFixed(1)}s
                </span>
              </div>

              {isEligibleForHorn && (
                <button
                  type="button"
                  onClick={handlePreviewFromBeforeHorn}
                  className="flex items-center gap-1 text-[11px] font-mono text-amber-300 hover:text-amber-200 bg-amber-950/60 hover:bg-amber-900/60 px-2.5 py-1 rounded border border-amber-700/60 transition cursor-pointer"
                  title="Play from 1.5s before goal horn fires"
                >
                  <Play className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span>Preview Horn Sync</span>
                </button>
              )}
            </div>

            {/* Scrubber Track with Goal Horn Marker */}
            <div
              className="relative w-full h-5 flex items-center cursor-pointer group"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                handleSeekPlayhead(ratio * trimmedDuration);
              }}
            >
              {/* Base track */}
              <div className="w-full h-2 bg-slate-800 group-hover:bg-slate-700 rounded-full relative overflow-hidden">
                {/* Progress fill */}
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-amber-500 transition-all duration-75"
                  style={{ width: `${Math.min(100, Math.max(0, (currentPlayTime / trimmedDuration) * 100))}%` }}
                />
              </div>

              {/* Goal Horn Marker on Scrubber */}
              {isEligibleForHorn && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 flex flex-col items-center pointer-events-none"
                  style={{
                    left: `${Math.min(100, Math.max(0, (activeTriggerOffset / trimmedDuration) * 100))}%`,
                  }}
                >
                  <div
                    className="w-3.5 h-3.5 bg-amber-400 rounded-full border-2 border-black shadow-md shadow-amber-500/50 flex items-center justify-center animate-pulse"
                    title={`Goal horn fires at ${activeTriggerOffset.toFixed(1)}s`}
                  >
                    <div className="w-1 h-1 bg-black rounded-full" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>0.0s</span>
              {isEligibleForHorn && (
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <Volume2 className="w-2.5 h-2.5" /> Horn: {activeTriggerOffset.toFixed(1)}s
                </span>
              )}
              <span>{trimmedDuration.toFixed(1)}s</span>
            </div>
          </div>

          {/* Zoom & Action Framing Directly Below Video */}
          <div className="bg-slate-950/90 p-3.5 rounded-xl border border-slate-800 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ZoomIn className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider font-['Chakra_Petch']">
                  Player Zoom &amp; Action Framing
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                    zoom > 1.02
                      ? 'bg-amber-950/90 text-amber-300 border-amber-700/80'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  {zoom > 1.02 ? `${zoom.toFixed(2)}x Zoomed` : '1.0x Full Ice'}
                </span>
              </div>

              {(zoom > 1.02 || panX !== 0 || panY !== 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1.0);
                    setPanX(0);
                    setPanY(0);
                  }}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 px-2.5 py-1 rounded border border-slate-800 transition"
                >
                  <RotateCcw className="w-3 h-3 text-slate-400" />
                  Reset Framing
                </button>
              )}
            </div>

            {/* Slider & Presets Row */}
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  title="Zoom Out (-0.2x)"
                  onClick={() => setZoom(Math.max(1.0, zoom - 0.2))}
                  className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <input
                  type="range"
                  min={1.0}
                  max={3.5}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value) || 1.0)}
                  className="flex-1 h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <button
                  type="button"
                  title="Zoom In (+0.2x)"
                  onClick={() => setZoom(Math.min(3.5, zoom + 0.2))}
                  className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-xs text-amber-400 font-bold bg-slate-900 px-2.5 py-1 rounded border border-slate-800 min-w-[56px] text-center">
                  {zoom.toFixed(2)}x
                </span>
              </div>

              {/* Quick Zoom Presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-slate-500 mr-1">Magnification:</span>
                {[
                  { label: '1.0x Full Ice', val: 1.0 },
                  { label: '1.25x Wide', val: 1.25 },
                  { label: '1.5x Action', val: 1.5 },
                  { label: '1.8x Close', val: 1.8 },
                  { label: '2.0x Tight', val: 2.0 },
                  { label: '2.5x Focus', val: 2.5 },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => setZoom(preset.val)}
                    className={`text-[11px] px-2.5 py-0.5 rounded-md border font-mono transition ${
                      Math.abs(zoom - preset.val) < 0.03
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pan & Framing position (when zoomed in) */}
            {zoom > 1.02 && (
              <div className="pt-2.5 border-t border-slate-800 space-y-2.5 bg-slate-900/60 p-3 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Crosshair className="w-3.5 h-3.5 text-sky-400" />
                    Player Focal Point / Framing
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    X: {panX > 0 ? `+${panX}` : panX}% | Y: {panY > 0 ? `+${panY}` : panY}%
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Horizontal Pan */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Horizontal Pan (X)</span>
                      <span className="font-mono text-sky-400">{panX > 0 ? `+${panX}` : panX}%</span>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={2}
                      value={panX}
                      onChange={(e) => setPanX(parseInt(e.target.value) || 0)}
                      className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-sky-500"
                    />
                    <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                      <span>Left Wing</span>
                      <span>Center</span>
                      <span>Right Wing</span>
                    </div>
                  </div>

                  {/* Vertical Pan */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Vertical Pan (Y)</span>
                      <span className="font-mono text-sky-400">{panY > 0 ? `+${panY}` : panY}%</span>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={2}
                      value={panY}
                      onChange={(e) => setPanY(parseInt(e.target.value) || 0)}
                      className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-sky-500"
                    />
                    <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                      <span>Far Boards</span>
                      <span>Center</span>
                      <span>Near Net</span>
                    </div>
                  </div>
                </div>

                {/* Quick Framing Presets */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-[10px] text-slate-500">Quick Framing:</span>
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
                        onClick={() => {
                          setPanX(f.x);
                          setPanY(f.y);
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded border transition ${
                          panX === f.x && panY === f.y
                            ? 'bg-sky-500/20 border-sky-500 text-sky-300 font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Title input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Clip Title
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              placeholder="e.g. McDavid Top Corner Goal"
            />
          </div>

          {/* Trimming Sliders */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-sky-400" />
                Trim Clip Range
              </span>
              <span className="text-xs font-mono font-bold text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800/60">
                Duration: {Number.isFinite(trimmedDuration) ? trimmedDuration.toFixed(2) : '0.00'}s
              </span>
            </div>

            {/* Start Time */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Start Point: {Number.isFinite(startTime) ? startTime.toFixed(2) : '0.00'}s</span>
                <span>Max: {Number.isFinite(maxDuration) ? maxDuration.toFixed(2) : '0.00'}s</span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(0.2, maxDuration)}
                step={0.05}
                value={Number.isFinite(startTime) ? startTime : 0}
                onChange={(e) => handleSeekStart(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
            </div>

            {/* End Time */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>End Point: {Number.isFinite(endTime) ? endTime.toFixed(2) : '0.00'}s</span>
                <span>Max: {Number.isFinite(maxDuration) ? maxDuration.toFixed(2) : '0.00'}s</span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(0.2, maxDuration)}
                step={0.05}
                value={Number.isFinite(endTime) ? endTime : 0}
                onChange={(e) => handleSeekEnd(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
            </div>
          </div>

          {/* Playback Speed & Volume */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <label className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5 uppercase">
                <Gauge className="w-3.5 h-3.5 text-amber-400" />
                Playback Speed
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[0.5, 0.75, 1.0, 1.5].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => {
                      setPlaybackRate(rate);
                      if (videoRef.current) videoRef.current.playbackRate = rate;
                    }}
                    className={`py-1.5 text-xs font-semibold rounded-lg border transition ${
                      playbackRate === rate
                        ? 'bg-red-600 border-red-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {rate === 0.5 ? '0.5x Slo' : `${rate}x`}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-300 mb-2 uppercase">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  Volume
                </span>
                <span className="font-mono text-emerald-400">{Math.round(volume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setVolume(v);
                  if (videoRef.current) videoRef.current.volume = v;
                }}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </div>

          {/* Hockey Action Tag */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <label className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5 uppercase">
              <Tag className="w-3.5 h-3.5 text-purple-400" />
              Hockey Highlight Tag
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {HOCKEY_TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTag(tag === t ? undefined : t)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition uppercase tracking-wider ${
                    tag === t
                      ? 'bg-red-600 text-white shadow'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Hockey Overlays & Player Lower Third Override */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-red-500" />
                <span className="text-xs font-bold text-white uppercase tracking-wider font-['Chakra_Petch']">
                  Hockey Graphics &amp; Player Lower Third
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCustomOverlays}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setUseCustomOverlays(checked);
                    if (checked && !clip?.scorebugOverride && overlaySettings?.scorebug) {
                      setScorebugOverride({ ...overlaySettings.scorebug });
                    }
                    if (checked && !clip?.playerBannerOverride && overlaySettings?.playerBanner) {
                      setPlayerBannerOverride({ ...overlaySettings.playerBanner });
                    }
                  }}
                  className="rounded bg-slate-900 border-slate-700 text-red-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-300">
                  Custom for this clip
                </span>
              </label>
            </div>

            {!useCustomOverlays ? (
              <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Using global overlays ({overlaySettings?.playerBanner.playerName || 'Player'}, {overlaySettings?.scorebug.awayTeam || 'AWAY'} {overlaySettings?.scorebug.awayScore ?? 0} - {overlaySettings?.scorebug.homeScore ?? 0} {overlaySettings?.scorebug.homeTeam || 'HOME'}).
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setUseCustomOverlays(true);
                    if (overlaySettings?.scorebug) setScorebugOverride({ ...overlaySettings.scorebug });
                    if (overlaySettings?.playerBanner) setPlayerBannerOverride({ ...overlaySettings.playerBanner });
                  }}
                  className="text-[11px] font-bold text-sky-400 hover:text-sky-300 underline cursor-pointer shrink-0 ml-2"
                >
                  Customize for this clip
                </button>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                {/* Scorebug fields */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-sky-400" />
                      Scorebug for this clip
                    </span>
                    <label className="text-[11px] text-slate-400 flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={scorebugOverride.enabled !== false}
                        onChange={(e) => setScorebugOverride(prev => ({ ...prev, enabled: e.target.checked }))}
                        className="rounded bg-slate-950 border-slate-700 text-sky-500 w-3 h-3"
                      />
                      Show
                    </label>
                  </div>

                  {scorebugOverride.enabled !== false && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase font-semibold">Away Team &amp; Score</label>
                        <div className="flex gap-1.5 mt-0.5">
                          <input
                            type="text"
                            maxLength={24}
                            list="hockey-popular-teams-datalist"
                            value={scorebugOverride.awayTeam || 'BOS'}
                            onChange={(e) => setScorebugOverride(prev => ({ ...prev, awayTeam: e.target.value.toUpperCase() }))}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white font-bold"
                            placeholder="e.g. EDMONTON, BOS"
                          />
                          <input
                            type="number"
                            min={0}
                            max={99}
                            value={scorebugOverride.awayScore ?? 0}
                            onChange={(e) => setScorebugOverride(prev => ({ ...prev, awayScore: parseInt(e.target.value) || 0 }))}
                            className="w-12 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-sky-400 font-black text-center"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 uppercase font-semibold">Home Team &amp; Score</label>
                        <div className="flex gap-1.5 mt-0.5">
                          <input
                            type="text"
                            maxLength={24}
                            list="hockey-popular-teams-datalist"
                            value={scorebugOverride.homeTeam || 'NYR'}
                            onChange={(e) => setScorebugOverride(prev => ({ ...prev, homeTeam: e.target.value.toUpperCase() }))}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white font-bold"
                            placeholder="e.g. COLORADO, NYR"
                          />
                          <input
                            type="number"
                            min={0}
                            max={99}
                            value={scorebugOverride.homeScore ?? 1}
                            onChange={(e) => setScorebugOverride(prev => ({ ...prev, homeScore: parseInt(e.target.value) || 0 }))}
                            className="w-12 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-sky-400 font-black text-center"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 uppercase font-semibold">Period</label>
                        <select
                          value={scorebugOverride.period || '1ST'}
                          onChange={(e) => setScorebugOverride(prev => ({ ...prev, period: e.target.value }))}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-xs mt-0.5"
                        >
                          <option value="1ST">1st Period</option>
                          <option value="2ND">2nd Period</option>
                          <option value="3RD">3rd Period</option>
                          <option value="OT">Overtime</option>
                          <option value="SO">Shootout</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 uppercase font-semibold">Clock</label>
                        <input
                          type="text"
                          value={scorebugOverride.timeRemaining || '0:18'}
                          onChange={(e) => setScorebugOverride(prev => ({ ...prev, timeRemaining: e.target.value }))}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white font-mono text-center mt-0.5"
                          placeholder="0:18"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Player Lower Third fields */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-red-400" />
                      Player Lower Third for this clip
                    </span>
                    <label className="text-[11px] text-slate-400 flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={playerBannerOverride.enabled !== false}
                        onChange={(e) => setPlayerBannerOverride(prev => ({ ...prev, enabled: e.target.checked }))}
                        className="rounded bg-slate-950 border-slate-700 text-red-500 w-3 h-3"
                      />
                      Show
                    </label>
                  </div>

                  {playerBannerOverride.enabled !== false && (
                    <div className="space-y-3 text-xs">
                      {/* Roster Picker & Memory */}
                      <PlayerRosterPicker
                        currentName={playerBannerOverride.playerName || ''}
                        currentNumber={playerBannerOverride.jerseyNumber || ''}
                        currentAction={playerBannerOverride.actionText || ''}
                        onSelectPlayer={({ name, jerseyNumber, defaultAction }) => {
                          setPlayerBannerOverride(prev => ({
                            ...prev,
                            playerName: name,
                            jerseyNumber,
                            actionText: defaultAction || prev.actionText,
                          }));
                        }}
                      />

                      <div className="grid grid-cols-4 gap-2">
                        <div className="col-span-1">
                          <label className="text-[10px] text-slate-400 uppercase font-semibold">No.</label>
                          <input
                            type="text"
                            maxLength={3}
                            value={playerBannerOverride.jerseyNumber || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPlayerBannerOverride(prev => ({ ...prev, jerseyNumber: val }));
                              if (playerBannerOverride.playerName) {
                                autoRememberPlayer(playerBannerOverride.playerName, val, playerBannerOverride.actionText);
                              }
                            }}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white font-black text-center mt-0.5"
                            placeholder="97"
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="text-[10px] text-slate-400 uppercase font-semibold">Player Name</label>
                          <input
                            type="text"
                            list="hockey-saved-players-datalist"
                            value={playerBannerOverride.playerName || ''}
                            onChange={(e) => setPlayerBannerOverride(prev => ({ ...prev, playerName: e.target.value }))}
                            onBlur={(e) => {
                              if (e.target.value.trim()) {
                                autoRememberPlayer(e.target.value, playerBannerOverride.jerseyNumber || '', playerBannerOverride.actionText);
                              }
                            }}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-white font-semibold mt-0.5"
                            placeholder="e.g. Connor McDavid"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 uppercase font-semibold">Action Highlight Text</label>
                        <input
                          type="text"
                          value={playerBannerOverride.actionText || ''}
                          onChange={(e) => setPlayerBannerOverride(prev => ({ ...prev, actionText: e.target.value }))}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-sky-400 font-medium mt-0.5"
                          placeholder="Top Shelf Snapper (Game Winner)"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Goal Horn Timing for this Clip */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 uppercase font-['Chakra_Petch']">
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                Goal Horn For This Clip
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-400 hover:text-slate-200">
                <input
                  type="checkbox"
                  checked={hornDisabled}
                  onChange={(e) => setHornDisabled(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-red-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                />
                <span className="flex items-center gap-1">
                  <VolumeX className="w-3 h-3 text-red-400" />
                  Mute horn on this clip
                </span>
              </label>
            </div>

            {/* Native Video Horn Option */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-2.5">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasNativeHorn}
                  onChange={(e) => setHasNativeHorn(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer mt-0.5"
                />
                <div className="flex-1 text-xs">
                  <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                    Clip has native goal horn in its video audio
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    Check this if the original recording already includes a stadium horn. The added overlay horn will be skipped for this clip to avoid duplicate or clashing sounds.
                  </p>
                </div>
              </label>
            </div>

            {!hornDisabled && !hasNativeHorn && (
              <div className="pt-2 space-y-3 border-t border-slate-800/60">
                {/* Active Horn Sound Banner & Audition Actions */}
                <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      <span className="text-xs font-bold text-white">
                        {effectiveHornConfig.useCustomHorn
                          ? `Custom: ${effectiveHornConfig.customHornName || 'Uploaded Audio'}`
                          : 'NHL Arena Synthesizer Horn'}
                      </span>
                      <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                        {(effectiveHornConfig.hornDuration ?? effectiveHornConfig.customHornDuration ?? 5.0).toFixed(1)}s blast
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleToggleAudition}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition shadow cursor-pointer ${
                          isAuditioningHorn
                            ? 'bg-red-600 text-white animate-pulse'
                            : 'bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-slate-700'
                        }`}
                        title="Test horn sound right now"
                      >
                        {isAuditioningHorn ? (
                          <>
                            <Square className="w-3 h-3 fill-current" />
                            <span>Stop Audio</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3 h-3 text-amber-400" />
                            <span>Audition Horn</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handlePreviewFromBeforeHorn}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-black transition shadow cursor-pointer"
                        title="Plays video 1.5s before horn fires"
                      >
                        <Play className="w-3 h-3 fill-black" />
                        <span>Preview Sync</span>
                      </button>
                    </div>
                  </div>

                  {effectiveHornConfig.duckVideoAudio && (
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      <span className="text-amber-400 font-bold">Audio Ducking:</span> Clip audio automatically dips to 15% during horn blast so the goal horn punches cleanly.
                    </p>
                  )}
                </div>

                {/* Custom Trigger Timing Toggle & Slider */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={useCustomTiming}
                      onChange={(e) => setUseCustomTiming(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Custom trigger time for this clip (override global default)</span>
                  </label>
                  {useCustomTiming && (
                    <span className="font-mono text-amber-400 font-bold text-xs bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {hornTimingOverride.toFixed(1)}s
                    </span>
                  )}
                </div>

                {useCustomTiming && (
                  <div className="space-y-2 pl-5">
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={Math.max(1, Number(trimmedDuration.toFixed(1)))}
                        step={0.1}
                        value={hornTimingOverride}
                        onChange={(e) => setHornTimingOverride(parseFloat(e.target.value) || 0)}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                      <input
                        type="number"
                        min={0}
                        max={Math.max(1, Number(trimmedDuration.toFixed(1)))}
                        step={0.1}
                        value={hornTimingOverride}
                        onChange={(e) =>
                          setHornTimingOverride(
                            Math.max(0, Math.min(trimmedDuration, parseFloat(e.target.value) || 0)),
                          )
                        }
                        className="w-16 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-center font-mono text-amber-400 text-xs font-bold"
                      />
                    </div>

                    {/* Quick Presets for Horn Timing */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <span className="text-[10px] text-slate-500">Quick offsets:</span>
                      {[
                        { label: '0.0s (Start)', val: 0 },
                        { label: '0.5s', val: 0.5 },
                        { label: '1.0s', val: 1.0 },
                        { label: '1.5s', val: 1.5 },
                        { label: '2.0s', val: 2.0 },
                        { label: 'Mid-clip', val: Number((trimmedDuration / 2).toFixed(1)) },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setHornTimingOverride(Math.min(trimmedDuration, preset.val))}
                          className={`text-[10px] px-2 py-0.5 rounded border transition font-mono cursor-pointer ${
                            Math.abs(hornTimingOverride - preset.val) < 0.05
                              ? 'bg-amber-500 text-black border-amber-400 font-bold'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <p className="text-[10px] text-slate-500 italic">
                      Horn will trigger {hornTimingOverride.toFixed(1)}s into this specific clip (clip duration: {trimmedDuration.toFixed(1)}s). Watch the amber pin on the scrubber above!
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/60">
          <button
            type="button"
            onClick={handleModalClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition shadow-lg shadow-red-950/40 uppercase tracking-wider font-['Chakra_Petch']"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};
