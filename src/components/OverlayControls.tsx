import React, { useRef, useState, useEffect } from 'react';
import { HockeyOverlaySettings, GoalHornConfig, VideoClip, ScorebugConfig, PlayerBannerConfig } from '../types';
import { PlayerRosterPicker } from './PlayerRosterPicker';
import { AIMusicControls } from './AIMusicControls';
import { autoRememberPlayer } from '../lib/rosterStorage';
import { saveRememberedScorebug, getRememberedScorebug } from '../lib/scorebugStorage';
import {
  Shield,
  User,
  Volume2,
  Sparkles,
  Trophy,
  UploadCloud,
  Play,
  Square,
  Music,
  Clock,
  Trash2,
  Globe,
  Film,
  RotateCcw,
  Copy,
  Check,
  Plus,
  Minus,
  Bookmark,
  Layers,
  ArrowRight,
  Flame,
  ZoomIn,
  Move,
  Crosshair,
  Tag,
} from 'lucide-react';
import { playGoalHorn, playArenaBuzzer, playHornSound } from '../lib/audio';

interface OverlayControlsProps {
  settings: HockeyOverlaySettings;
  onChange: (updated: HockeyOverlaySettings) => void;
  clips?: VideoClip[];
  selectedClipIndex?: number | null;
  onSelectClipIndex?: (index: number | null) => void;
  onUpdateClip?: (index: number, updated: VideoClip) => void;
}

export const OverlayControls: React.FC<OverlayControlsProps> = ({
  settings,
  onChange,
  clips = [],
  selectedClipIndex = null,
  onSelectClipIndex,
  onUpdateClip,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPlayingHorn, setIsPlayingHorn] = useState(false);
  const activeHornStopRef = useRef<(() => void) | null>(null);
  const [activeTab, setActiveTab] = useState<'scorebug' | 'player' | 'horn' | 'music' | 'fx'>('scorebug');
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Remembered game scorebug state
  const [rememberedGame, setRememberedGame] = useState<ScorebugConfig | null>(() => getRememberedScorebug());

  useEffect(() => {
    const handleScorebugChange = (e: Event) => {
      const custom = (e as CustomEvent<ScorebugConfig>).detail;
      if (custom) setRememberedGame(custom);
    };
    window.addEventListener('hockey_scorebug_changed', handleScorebugChange);
    return () => window.removeEventListener('hockey_scorebug_changed', handleScorebugChange);
  }, []);

  const isEditingClip =
    selectedClipIndex !== null &&
    selectedClipIndex !== undefined &&
    clips.length > 0 &&
    selectedClipIndex >= 0 &&
    selectedClipIndex < clips.length;

  const currentClip = isEditingClip ? clips[selectedClipIndex!] : null;
  const isClipCustomized = Boolean(currentClip?.useCustomOverlays);

  // Active Scorebug config for the current scope (clip or global)
  const activeScorebug: ScorebugConfig =
    isEditingClip && isClipCustomized && currentClip?.scorebugOverride
      ? {
          ...settings.scorebug,
          ...currentClip.scorebugOverride,
          enabled:
            currentClip.scorebugOverride.enabled !== undefined
              ? currentClip.scorebugOverride.enabled
              : settings.scorebug.enabled,
        }
      : settings.scorebug;

  // Active Player Banner config for the current scope (clip or global)
  const activePlayerBanner: PlayerBannerConfig =
    isEditingClip && isClipCustomized && currentClip?.playerBannerOverride
      ? {
          ...settings.playerBanner,
          ...currentClip.playerBannerOverride,
          enabled:
            currentClip.playerBannerOverride.enabled !== undefined
              ? currentClip.playerBannerOverride.enabled
              : settings.playerBanner.enabled,
        }
      : settings.playerBanner;

  // Scorebug reference from First Clip (Primary Game Anchor)
  const firstClip = clips.length > 0 ? clips[0] : null;
  const firstClipScorebug: ScorebugConfig =
    firstClip?.useCustomOverlays && firstClip?.scorebugOverride
      ? { ...settings.scorebug, ...firstClip.scorebugOverride }
      : settings.scorebug;

  // Scorebug from previous sequential clip (for score carry-over)
  const prevClip =
    isEditingClip && selectedClipIndex! > 0 ? clips[selectedClipIndex! - 1] : null;
  const prevClipScorebug: ScorebugConfig =
    prevClip?.useCustomOverlays && prevClip?.scorebugOverride
      ? { ...settings.scorebug, ...prevClip.scorebugOverride }
      : settings.scorebug;

  const updateScorebug = (field: string, val: any) => {
    const updatedScorebug = {
      ...settings.scorebug,
      [field]: val,
    };
    onChange({
      ...settings,
      scorebug: updatedScorebug,
    });
    // Auto remember teams when editing global
    if (field === 'awayTeam' || field === 'homeTeam') {
      saveRememberedScorebug(updatedScorebug);
    }
  };

  const updatePlayerBanner = (field: string, val: any) => {
    onChange({
      ...settings,
      playerBanner: {
        ...settings.playerBanner,
        [field]: val,
      },
    });
  };

  // Update Scorebug for active scope
  const updateActiveScorebug = (field: string, val: any) => {
    if (isEditingClip && currentClip && onUpdateClip) {
      const existingOverride = currentClip.scorebugOverride || { ...settings.scorebug };
      const updatedOverride = {
        ...existingOverride,
        [field]: val,
      };

      onUpdateClip(selectedClipIndex!, {
        ...currentClip,
        useCustomOverlays: true,
        scorebugOverride: updatedOverride,
      });

      // If updating Clip #1: automatically remember and update game defaults
      if (selectedClipIndex === 0) {
        saveRememberedScorebug(updatedOverride);
        if (field === 'awayTeam' || field === 'homeTeam') {
          onChange({
            ...settings,
            scorebug: {
              ...settings.scorebug,
              [field]: val,
            },
          });
        }
      }
    } else {
      updateScorebug(field, val);
    }
  };

  // Helper to safely step score
  const stepScore = (team: 'awayScore' | 'homeScore', delta: number) => {
    const currentVal = (activeScorebug[team] as number) ?? 0;
    const nextVal = Math.max(0, Math.min(99, currentVal + delta));
    updateActiveScorebug(team, nextVal);
  };

  // Apply Clip #1 Game Data (teams and clock) across all clips & set as global defaults
  const handleApplyClip1AsGameDefault = () => {
    saveRememberedScorebug(firstClipScorebug);

    // Update global settings
    onChange({
      ...settings,
      scorebug: {
        ...settings.scorebug,
        awayTeam: firstClipScorebug.awayTeam,
        homeTeam: firstClipScorebug.homeTeam,
        period: firstClipScorebug.period,
        timeRemaining: firstClipScorebug.timeRemaining,
      },
    });

    // Propagate team names to other clips if they have custom scorebugs
    if (onUpdateClip && clips.length > 1) {
      clips.forEach((c, idx) => {
        if (idx !== 0 && c.useCustomOverlays && c.scorebugOverride) {
          onUpdateClip(idx, {
            ...c,
            scorebugOverride: {
              ...c.scorebugOverride,
              awayTeam: firstClipScorebug.awayTeam,
              homeTeam: firstClipScorebug.homeTeam,
            },
          });
        }
      });
    }

    setSyncFeedback('Clip #1 teams synced across all clips & saved!');
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  // Copy Scorebug settings directly from Clip #1
  const handleCopyFromClip1 = () => {
    if (isEditingClip && currentClip && onUpdateClip) {
      const currentOverride = currentClip.scorebugOverride || { ...settings.scorebug };
      onUpdateClip(selectedClipIndex!, {
        ...currentClip,
        useCustomOverlays: true,
        scorebugOverride: {
          ...currentOverride,
          awayTeam: firstClipScorebug.awayTeam,
          homeTeam: firstClipScorebug.homeTeam,
          period: firstClipScorebug.period,
          timeRemaining: firstClipScorebug.timeRemaining,
          enabled: true,
        },
      });
    } else {
      onChange({
        ...settings,
        scorebug: {
          ...settings.scorebug,
          awayTeam: firstClipScorebug.awayTeam,
          homeTeam: firstClipScorebug.homeTeam,
          period: firstClipScorebug.period,
          timeRemaining: firstClipScorebug.timeRemaining,
        },
      });
    }
    setSyncFeedback('Teams & Clock copied from Clip #1!');
    setTimeout(() => setSyncFeedback(null), 2500);
  };

  // Carry Over Ending Score from Previous Clip
  const handleCarryOverFromPrevClip = () => {
    if (!isEditingClip || !currentClip || !onUpdateClip || selectedClipIndex! <= 0) return;
    const currentOverride = currentClip.scorebugOverride || { ...settings.scorebug };
    onUpdateClip(selectedClipIndex!, {
      ...currentClip,
      useCustomOverlays: true,
      scorebugOverride: {
        ...currentOverride,
        awayTeam: prevClipScorebug.awayTeam,
        homeTeam: prevClipScorebug.homeTeam,
        awayScore: prevClipScorebug.awayScore,
        homeScore: prevClipScorebug.homeScore,
        period: prevClipScorebug.period,
        timeRemaining: prevClipScorebug.timeRemaining,
        enabled: true,
      },
    });
    setSyncFeedback(`Carried over score (${prevClipScorebug.awayScore}-${prevClipScorebug.homeScore}) from Clip #${selectedClipIndex!}!`);
    setTimeout(() => setSyncFeedback(null), 2500);
  };

  // Restore saved game teams from localStorage
  const handleRestoreRememberedGame = () => {
    if (!rememberedGame) return;
    updateActiveScorebug('awayTeam', rememberedGame.awayTeam);
    updateActiveScorebug('homeTeam', rememberedGame.homeTeam);
    updateActiveScorebug('period', rememberedGame.period || '1ST');
    updateActiveScorebug('timeRemaining', rememberedGame.timeRemaining || '20:00');
    setSyncFeedback(`Restored ${rememberedGame.awayTeam} vs ${rememberedGame.homeTeam}!`);
    setTimeout(() => setSyncFeedback(null), 2500);
  };

  // Update Player Banner for active scope
  const updateActivePlayerBanner = (field: string, val: any) => {
    if (isEditingClip && currentClip && onUpdateClip) {
      const existingOverride = currentClip.playerBannerOverride || { ...settings.playerBanner };
      onUpdateClip(selectedClipIndex!, {
        ...currentClip,
        useCustomOverlays: true,
        playerBannerOverride: {
          ...existingOverride,
          [field]: val,
        },
      });
    } else {
      updatePlayerBanner(field, val);
    }
  };

  // Toggle custom overlays for the selected clip
  const handleToggleClipCustomOverlays = (enabled: boolean) => {
    if (!isEditingClip || !currentClip || !onUpdateClip) return;
    if (enabled) {
      onUpdateClip(selectedClipIndex!, {
        ...currentClip,
        useCustomOverlays: true,
        scorebugOverride: currentClip.scorebugOverride || { ...firstClipScorebug },
        playerBannerOverride: currentClip.playerBannerOverride || { ...settings.playerBanner },
      });
    } else {
      onUpdateClip(selectedClipIndex!, {
        ...currentClip,
        useCustomOverlays: false,
      });
    }
  };

  // Reset clip overlays back to current global defaults
  const handleCopyGlobalToClip = () => {
    if (!isEditingClip || !currentClip || !onUpdateClip) return;
    onUpdateClip(selectedClipIndex!, {
      ...currentClip,
      useCustomOverlays: true,
      scorebugOverride: { ...settings.scorebug },
      playerBannerOverride: { ...settings.playerBanner },
    });
  };

  const updateCurrentClipField = (updates: Partial<VideoClip>) => {
    if (isEditingClip && currentClip && onUpdateClip) {
      onUpdateClip(selectedClipIndex!, {
        ...currentClip,
        ...updates,
      });
    }
  };

  const hornConfig: GoalHornConfig = settings.hornConfig || {
    enabled: settings.goalHornSound,
    useCustomHorn: false,
    triggerMode: 'every_clip',
    clipOffsetSeconds: 0.5,
    volume: 1.0,
    hornDuration: 5.0,
    skipClipsWithNativeHorn: true,
    duckVideoAudio: true,
  };

  const updateHornConfig = (partial: Partial<GoalHornConfig>) => {
    const nextHorn: GoalHornConfig = {
      ...hornConfig,
      ...partial,
    };
    onChange({
      ...settings,
      goalHornSound: nextHorn.enabled,
      hornConfig: nextHorn,
    });
  };

  const handleUploadCustomHorn = (file: File) => {
    if (!file) return;

    if (hornConfig.customHornUrl && hornConfig.customHornUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(hornConfig.customHornUrl);
      } catch {}
    }

    const url = URL.createObjectURL(file);

    const nextHornConfig: GoalHornConfig = {
      ...hornConfig,
      enabled: true,
      useCustomHorn: true,
      customHornName: file.name,
      customHornBlob: file,
      customHornUrl: url,
    };

    onChange({
      ...settings,
      goalHornSound: true,
      hornConfig: nextHornConfig,
    });

    const tempAudio = new Audio();
    tempAudio.preload = 'metadata';
    tempAudio.onloadedmetadata = () => {
      const dur = tempAudio.duration;
      if (Number.isFinite(dur) && dur > 0) {
        updateHornConfig({
          customHornDuration: dur,
          hornDuration: Math.min(60.0, Math.max(1.0, dur)),
        });
      }
    };
    tempAudio.src = url;
  };

  const handleRemoveCustomHorn = () => {
    if (hornConfig.customHornUrl && hornConfig.customHornUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(hornConfig.customHornUrl);
      } catch {}
    }
    updateHornConfig({
      useCustomHorn: false,
      customHornName: undefined,
      customHornBlob: undefined,
      customHornUrl: undefined,
      customHornDuration: undefined,
    });
  };

  const toggleAuditionHorn = async () => {
    if (isPlayingHorn) {
      if (activeHornStopRef.current) {
        activeHornStopRef.current();
        activeHornStopRef.current = null;
      }
      setIsPlayingHorn(false);
      return;
    }

    setIsPlayingHorn(true);
    try {
      const { stop } = await playHornSound(hornConfig);
      activeHornStopRef.current = stop;

      const timeoutDur =
        (hornConfig.hornDuration ?? hornConfig.customHornDuration ?? 5.0) * 1000;

      setTimeout(() => {
        setIsPlayingHorn(false);
        activeHornStopRef.current = null;
      }, timeoutDur);
    } catch (err) {
      console.error('Failed to audition goal horn:', err);
      setIsPlayingHorn(false);
      activeHornStopRef.current = null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-900/90 border border-slate-800/90 rounded-2xl p-2.5 sm:p-3.5 shadow-xl select-none overflow-hidden">
      {/* Header bar */}
      <div className="shrink-0 flex items-center justify-between border-b border-slate-800 pb-2 mb-2 gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-red-500" />
          <h3 className="font-['Chakra_Petch'] font-bold text-white tracking-wider text-xs uppercase">
            Broadcast Overlays & FX
          </h3>
        </div>
        {syncFeedback ? (
          <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1 animate-pulse">
            <Check className="w-3 h-3" />
            {syncFeedback}
          </span>
        ) : (
          <span className="text-[10px] text-slate-400">Scorebug, Lower Third & FX</span>
        )}
      </div>

      {/* Scope Selector: Global vs Individual Clips */}
      {clips.length > 0 && (
        <div className="shrink-0 bg-slate-950/80 border border-slate-800/80 rounded-xl p-2 mb-2 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-400 px-0.5">
            <span className="font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1">
              <Film className="w-3 h-3 text-sky-400" />
              Scope:
            </span>
            <span className="text-[10px] font-mono">
              {isEditingClip
                ? `Clip ${selectedClipIndex! + 1} of ${clips.length}`
                : 'Global Defaults'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1 max-h-16 overflow-y-auto custom-scrollbar">
            {/* Global Button */}
            <button
              type="button"
              id="scope-global-btn"
              onClick={() => onSelectClipIndex?.(null)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                !isEditingClip
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800'
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>Global</span>
            </button>

            {/* Clip Buttons */}
            {clips.map((clip, idx) => {
              const isSelected = isEditingClip && selectedClipIndex === idx;
              const hasCustom = Boolean(clip.useCustomOverlays);
              const isFirst = idx === 0;

              return (
                <button
                  key={clip.id}
                  type="button"
                  id={`scope-clip-btn-${idx}`}
                  onClick={() => onSelectClipIndex?.(idx)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer truncate border ${
                    isSelected
                      ? 'bg-sky-600 border-sky-500 text-white font-bold shadow-xs'
                      : hasCustom
                      ? 'bg-slate-900 border-sky-800/80 text-sky-300 hover:bg-slate-850'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850'
                  }`}
                  title={`Clip #${idx + 1}: ${clip.name} ${isFirst ? '(Primary Game Anchor)' : ''}`}
                >
                  <span className="font-mono">#{idx + 1}</span>
                  {isFirst && <span className="text-amber-400 text-[9px]">★</span>}
                  {hasCustom && (
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0 shadow-xs" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Clip Customization Bar (If editing a clip) */}
      {isEditingClip && currentClip && (
        <div
          className={`shrink-0 rounded-xl px-3 py-2 border mb-2 transition-all flex items-center justify-between gap-2 text-xs ${
            isClipCustomized
              ? 'bg-sky-950/40 border-sky-700/60 text-sky-200'
              : 'bg-slate-950/70 border-slate-800 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-white truncate text-[11px]">
              Clip #{selectedClipIndex! + 1}
            </span>
            {isClipCustomized ? (
              <span className="text-[9px] bg-sky-500/20 text-sky-300 border border-sky-500/40 px-1.5 py-0.2 rounded font-bold uppercase shrink-0">
                Custom Overlays
              </span>
            ) : (
              <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-medium shrink-0">
                Using Global
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isClipCustomized ? (
              <>
                <button
                  type="button"
                  onClick={handleCopyGlobalToClip}
                  className="text-[10px] px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1 transition"
                  title="Copy global defaults into this clip"
                >
                  <Copy className="w-2.5 h-2.5" />
                  <span>Copy Global</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleClipCustomOverlays(false)}
                  className="text-[10px] px-2 py-0.5 rounded bg-slate-900 hover:bg-red-950/40 text-slate-400 hover:text-red-300 border border-slate-700 hover:border-red-800 flex items-center gap-1 transition"
                  title="Revert to inheriting global settings"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>Revert</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => handleToggleClipCustomOverlays(true)}
                className="text-[10px] px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center gap-1 transition shadow-xs"
              >
                <Sparkles className="w-3 h-3" />
                <span>Customize Clip</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Inspector Tab Bar */}
      <div className="shrink-0 flex items-center gap-1 bg-slate-950/90 p-1 rounded-xl border border-slate-800 mb-2.5">
        <button
          type="button"
          onClick={() => setActiveTab('scorebug')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'scorebug'
              ? 'bg-red-600 text-white shadow-sm shadow-red-950/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Shield className="w-3.5 h-3.5 text-sky-400" />
          <span>Scorebug</span>
          <span className="text-[10px] font-mono text-white/80 hidden sm:inline">
            ({activeScorebug.awayScore ?? 0}-{activeScorebug.homeScore ?? 0})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('player')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'player'
              ? 'bg-red-600 text-white shadow-sm shadow-red-950/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <User className="w-3.5 h-3.5 text-red-400" />
          <span>Player Card</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('horn')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'horn'
              ? 'bg-red-600 text-white shadow-sm shadow-red-950/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5 text-amber-400" />
          <span>Horn</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('music')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'music'
              ? 'bg-red-600 text-white shadow-sm shadow-red-950/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
          title="Real Sports Music & Soundtracks (80s, 90s, 00s, Custom Uploads)"
        >
          <Music className="w-3.5 h-3.5 text-emerald-400" />
          <span>Music</span>
          {settings.backgroundMusic?.enabled && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 shadow-xs animate-pulse" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('fx')}
          className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'fx'
              ? 'bg-red-600 text-white shadow-sm shadow-red-950/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
          title="Red Siren Light and Broadcast Stamps"
        >
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden sm:inline">FX</span>
        </button>
      </div>

      {/* Tab Panels: Scrollable within pane without expanding overall page height */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 space-y-3">
        {/* ==================== TAB 1: SCOREBUG ==================== */}
        {activeTab === 'scorebug' && (
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 sm:p-3.5 space-y-3">
            {/* Header & On/Off Toggle */}
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Game Scorebug
                </span>
                {isEditingClip && isClipCustomized && (
                  <span className="text-[9px] text-sky-400 font-mono font-bold bg-sky-950/80 px-1.5 py-0.5 rounded border border-sky-800/60">
                    Clip #{selectedClipIndex! + 1}
                  </span>
                )}
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="scorebug-toggle-checkbox"
                  type="checkbox"
                  checked={activeScorebug.enabled}
                  onChange={(e) => updateActiveScorebug('enabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>

            {activeScorebug.enabled && (
              <div className="space-y-3 pt-0.5 text-xs">
                {/* Scorebug Memory & Quick Inheritance Bar */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1">
                      <Bookmark className="w-3 h-3 text-amber-400" />
                      Game Scorebug Memory:
                    </span>
                    {selectedClipIndex === 0 && (
                      <span className="text-amber-400 font-bold bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-800/60">
                        Primary Game Anchor
                      </span>
                    )}
                  </div>

                  {/* Actions depending on scope */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Clip #1: Button to save / set as game default for all clips */}
                    {selectedClipIndex === 0 && (
                      <button
                        type="button"
                        id="save-clip1-as-game-default-btn"
                        onClick={handleApplyClip1AsGameDefault}
                        className="text-[11px] bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/60 px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition cursor-pointer"
                        title="Save Clip #1 teams & clock as the master default for the entire highlight video"
                      >
                        <Check className="w-3 h-3 text-amber-400" />
                        <span>Sync Clip #1 Teams as Game Default</span>
                      </button>
                    )}

                    {/* Clip #2, #3, etc.: Copy from Clip #1 */}
                    {isEditingClip && selectedClipIndex! > 0 && (
                      <button
                        type="button"
                        id="copy-from-clip1-btn"
                        onClick={handleCopyFromClip1}
                        className="text-[11px] bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 px-2.5 py-1 rounded-md font-medium flex items-center gap-1 transition cursor-pointer"
                        title="Copy game teams and clock from Clip #1"
                      >
                        <Copy className="w-3 h-3 text-sky-400" />
                        <span>
                          Copy Teams from Clip #1 ({firstClipScorebug.awayTeam} vs {firstClipScorebug.homeTeam})
                        </span>
                      </button>
                    )}

                    {/* Clip #2, #3, etc.: Carry over ending score from preceding clip */}
                    {isEditingClip && selectedClipIndex! > 0 && (
                      <button
                        type="button"
                        id="carry-over-score-btn"
                        onClick={handleCarryOverFromPrevClip}
                        className="text-[11px] bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/60 px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition cursor-pointer"
                        title="Carry over the score from Clip #{selectedClipIndex} so you can just increment the new goal (+1)"
                      >
                        <ArrowRight className="w-3 h-3 text-sky-400" />
                        <span>
                          Carry Over Score from Clip #{selectedClipIndex} ({prevClipScorebug.awayScore}-{prevClipScorebug.homeScore})
                        </span>
                      </button>
                    )}

                    {/* Global Scope: Option to sync with Clip #1 if Clip #1 is customized */}
                    {!isEditingClip && clips.length > 0 && (
                      <button
                        type="button"
                        onClick={handleCopyFromClip1}
                        className="text-[11px] bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 px-2.5 py-1 rounded-md font-medium flex items-center gap-1 transition cursor-pointer"
                      >
                        <Copy className="w-3 h-3 text-sky-400" />
                        <span>Copy Teams from Clip #1 ({firstClipScorebug.awayTeam} vs {firstClipScorebug.homeTeam})</span>
                      </button>
                    )}

                    {/* Restore saved game teams from storage if available */}
                    {rememberedGame && (
                      <button
                        type="button"
                        onClick={handleRestoreRememberedGame}
                        className="text-[10px] bg-slate-800/80 hover:bg-slate-750 text-slate-300 border border-slate-700/80 px-2 py-0.5 rounded flex items-center gap-1 transition cursor-pointer"
                        title={`Restore saved game: ${rememberedGame.awayTeam} vs ${rememberedGame.homeTeam}`}
                      >
                        <RotateCcw className="w-2.5 h-2.5 text-slate-400" />
                        <span>Restore Saved Game ({rememberedGame.awayTeam} vs {rememberedGame.homeTeam})</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Score Controls with + and - Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Away Team & Stepper */}
                  <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                        Away Team &amp; Score
                      </label>
                      <span className="text-[10px] text-slate-500 font-mono">Visitor</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={24}
                        list="hockey-popular-teams-datalist"
                        value={activeScorebug.awayTeam}
                        onChange={(e) => updateActiveScorebug('awayTeam', e.target.value.toUpperCase())}
                        className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-black text-sm tracking-wider"
                        placeholder="BOS, EDMONTON"
                      />

                      {/* Score Stepper (- and +) */}
                      <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 shrink-0 shadow-inner">
                        <button
                          type="button"
                          id="away-score-minus-btn"
                          onClick={() => stepScore('awayScore', -1)}
                          className="w-7 h-7 rounded-md bg-slate-850 hover:bg-slate-750 active:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-sm transition cursor-pointer border border-slate-700/50 select-none"
                          title="Decrease away score (-1)"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={99}
                          value={activeScorebug.awayScore ?? 0}
                          onChange={(e) =>
                            updateActiveScorebug('awayScore', Math.max(0, parseInt(e.target.value) || 0))
                          }
                          className="w-10 bg-transparent text-sky-400 font-black text-center text-sm font-mono focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          id="away-score-plus-btn"
                          onClick={() => stepScore('awayScore', 1)}
                          className="w-7 h-7 rounded-md bg-slate-850 hover:bg-slate-750 active:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-sm transition cursor-pointer border border-slate-700/50 select-none"
                          title="Increase away score (+1)"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Home Team & Stepper */}
                  <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                        Home Team &amp; Score
                      </label>
                      <span className="text-[10px] text-slate-500 font-mono">Host</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        maxLength={24}
                        list="hockey-popular-teams-datalist"
                        value={activeScorebug.homeTeam}
                        onChange={(e) => updateActiveScorebug('homeTeam', e.target.value.toUpperCase())}
                        className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-black text-sm tracking-wider"
                        placeholder="NYR, FLORIDA"
                      />

                      {/* Score Stepper (- and +) */}
                      <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 shrink-0 shadow-inner">
                        <button
                          type="button"
                          id="home-score-minus-btn"
                          onClick={() => stepScore('homeScore', -1)}
                          className="w-7 h-7 rounded-md bg-slate-850 hover:bg-slate-750 active:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-sm transition cursor-pointer border border-slate-700/50 select-none"
                          title="Decrease home score (-1)"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={99}
                          value={activeScorebug.homeScore ?? 0}
                          onChange={(e) =>
                            updateActiveScorebug('homeScore', Math.max(0, parseInt(e.target.value) || 0))
                          }
                          className="w-10 bg-transparent text-sky-400 font-black text-center text-sm font-mono focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          id="home-score-plus-btn"
                          onClick={() => stepScore('homeScore', 1)}
                          className="w-7 h-7 rounded-md bg-slate-850 hover:bg-slate-750 active:bg-slate-700 text-slate-200 flex items-center justify-center font-bold text-sm transition cursor-pointer border border-slate-700/50 select-none"
                          title="Increase home score (+1)"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Period & Clock Controls */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-semibold">Period</label>
                    <select
                      value={activeScorebug.period}
                      onChange={(e) => updateActiveScorebug('period', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white text-xs mt-0.5 font-bold"
                    >
                      <option value="1ST">1st Period</option>
                      <option value="2ND">2nd Period</option>
                      <option value="3RD">3rd Period</option>
                      <option value="OT">Overtime (OT)</option>
                      <option value="2OT">2nd OT</option>
                      <option value="SO">Shootout (SO)</option>
                      <option value="FINAL">Final</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-semibold">Game Clock</label>
                    <input
                      type="text"
                      value={activeScorebug.timeRemaining}
                      onChange={(e) => updateActiveScorebug('timeRemaining', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono text-center mt-0.5 font-bold"
                      placeholder="0:14"
                    />
                  </div>
                </div>

                {/* Datalist of common NHL team abbreviations */}
                <datalist id="hockey-popular-teams-datalist">
                  <option value="EDMONTON" />
                  <option value="FLORIDA" />
                  <option value="NYR" />
                  <option value="BOS" />
                  <option value="TOR" />
                  <option value="COL" />
                  <option value="DAL" />
                  <option value="VGK" />
                  <option value="CAR" />
                  <option value="TBL" />
                  <option value="VAN" />
                  <option value="WPG" />
                  <option value="LAK" />
                  <option value="NSH" />
                  <option value="DET" />
                  <option value="MTL" />
                </datalist>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 2: PLAYER LOWER THIRD ==================== */}
        {activeTab === 'player' && (
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 sm:p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
              <div className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-red-400" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Player Lower Third
                </span>
                {isEditingClip && isClipCustomized && (
                  <span className="text-[9px] text-red-400 font-mono font-bold bg-red-950/80 px-1.5 py-0.5 rounded border border-red-800/60">
                    Clip #{selectedClipIndex! + 1}
                  </span>
                )}
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="player-banner-toggle-checkbox"
                  type="checkbox"
                  checked={activePlayerBanner.enabled}
                  onChange={(e) => updateActivePlayerBanner('enabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>

            {activePlayerBanner.enabled && (
              <div className="space-y-3 pt-0.5 text-xs">
                {/* Roster Picker & Memory */}
                <PlayerRosterPicker
                  currentName={activePlayerBanner.playerName}
                  currentNumber={activePlayerBanner.jerseyNumber}
                  currentAction={activePlayerBanner.actionText}
                  onSelectPlayer={({ name, jerseyNumber, defaultAction }) => {
                    updateActivePlayerBanner('playerName', name);
                    updateActivePlayerBanner('jerseyNumber', jerseyNumber);
                    if (defaultAction) {
                      updateActivePlayerBanner('actionText', defaultAction);
                    }
                  }}
                />

                <div className="grid grid-cols-4 gap-2">
                  <div className="col-span-1">
                    <label className="text-[10px] text-slate-400 uppercase font-semibold">No.</label>
                    <input
                      type="text"
                      maxLength={3}
                      value={activePlayerBanner.jerseyNumber}
                      onChange={(e) => {
                        updateActivePlayerBanner('jerseyNumber', e.target.value);
                        if (activePlayerBanner.playerName) {
                          autoRememberPlayer(activePlayerBanner.playerName, e.target.value, activePlayerBanner.actionText);
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-white font-black text-center mt-0.5 font-mono"
                      placeholder="97"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="text-[10px] text-slate-400 uppercase font-semibold">Player Name</label>
                    <input
                      type="text"
                      list="hockey-saved-players-datalist"
                      value={activePlayerBanner.playerName}
                      onChange={(e) => updateActivePlayerBanner('playerName', e.target.value)}
                      onBlur={(e) => {
                        if (e.target.value.trim()) {
                          autoRememberPlayer(e.target.value, activePlayerBanner.jerseyNumber, activePlayerBanner.actionText);
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-semibold mt-0.5"
                      placeholder="e.g. Connor McDavid"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-semibold">Action Highlight Text</label>
                  <input
                    type="text"
                    value={activePlayerBanner.actionText}
                    onChange={(e) => updateActivePlayerBanner('actionText', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-sky-400 font-medium mt-0.5"
                    placeholder="Top Shelf Snapper (Game Winner)"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 3: GOAL HORN & SOUND FX ==================== */}
        {activeTab === 'horn' && (
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 sm:p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
              <div className="flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Goal Horn &amp; Arena Audio
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={hornConfig.enabled}
                  onChange={(e) => updateHornConfig({ enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-8 h-4.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>

            {hornConfig.enabled && (
              <div className="space-y-3 pt-0.5 text-xs">
                {/* Selected Clip Goal Horn Override */}
                {isEditingClip && currentClip && (
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-400 text-xs flex items-center gap-1.5 uppercase font-['Chakra_Petch']">
                        <Volume2 className="w-3.5 h-3.5" />
                        Clip #{selectedClipIndex! + 1} Horn Trigger
                      </span>
                      {currentClip.hornTimingOverride !== undefined && (
                        <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800/60">
                          {currentClip.hornTimingOverride.toFixed(1)}s into clip
                        </span>
                      )}
                    </div>

                    {/* Timing Offset Slider */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>Trigger Offset</span>
                        <span className="font-mono text-amber-300">
                          {(currentClip.hornTimingOverride ?? hornConfig.clipOffsetSeconds ?? 0.5).toFixed(1)}s
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(3.0, (currentClip.endTime || currentClip.originalDuration || 5.0) - (currentClip.startTime || 0))}
                        step={0.1}
                        value={currentClip.hornTimingOverride ?? hornConfig.clipOffsetSeconds ?? 0.5}
                        onChange={(e) => updateCurrentClipField({ hornTimingOverride: parseFloat(e.target.value) || 0 })}
                        className="w-full h-1.5 bg-slate-950 rounded appearance-none cursor-pointer accent-amber-400"
                      />
                      <div className="flex items-center gap-1 pt-1 flex-wrap">
                        {[0.0, 0.5, 1.0, 1.5, 2.0].map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => updateCurrentClipField({ hornTimingOverride: sec })}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
                              (currentClip.hornTimingOverride ?? hornConfig.clipOffsetSeconds) === sec
                                ? 'bg-amber-500 text-slate-950 font-bold'
                                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                          >
                            {sec.toFixed(1)}s
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Clip Horn Checkboxes */}
                    <div className="space-y-1 pt-1 border-t border-slate-800/80">
                      <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-300 hover:text-white">
                        <input
                          type="checkbox"
                          checked={Boolean(currentClip.hornDisabled)}
                          onChange={(e) => updateCurrentClipField({ hornDisabled: e.target.checked })}
                          className="rounded bg-slate-950 border-slate-700 text-red-500 focus:ring-0 w-3.5 h-3.5"
                        />
                        <span>Mute goal horn on this clip</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-300 hover:text-white">
                        <input
                          type="checkbox"
                          checked={Boolean(currentClip.hasNativeHorn)}
                          onChange={(e) => updateCurrentClipField({ hasNativeHorn: e.target.checked })}
                          className="rounded bg-slate-950 border-slate-700 text-sky-500 focus:ring-0 w-3.5 h-3.5"
                        />
                        <span>Original clip already has native arena horn</span>
                      </label>
                    </div>
                  </div>
                )}
                {/* Audio Source Switcher: Synth vs Custom */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateHornConfig({ useCustomHorn: false })}
                    className={`p-2.5 rounded-lg border text-left transition flex items-start gap-2 cursor-pointer ${
                      !hornConfig.useCustomHorn
                        ? 'bg-slate-900 border-red-600/70 text-white shadow-xs'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                        !hornConfig.useCustomHorn ? 'border-red-500 bg-red-600' : 'border-slate-600'
                      }`}
                    >
                      {!hornConfig.useCustomHorn && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-white">NHL Synth Horn</div>
                      <div className="text-[10px] text-slate-400">Authentic brass horn</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateHornConfig({ useCustomHorn: true })}
                    className={`p-2.5 rounded-lg border text-left transition flex items-start gap-2 cursor-pointer ${
                      hornConfig.useCustomHorn
                        ? 'bg-slate-900 border-purple-500/70 text-white shadow-xs'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                        hornConfig.useCustomHorn ? 'border-purple-500 bg-purple-600' : 'border-slate-600'
                      }`}
                    >
                      {hornConfig.useCustomHorn && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-white">Custom Horn File</div>
                      <div className="text-[10px] text-slate-400">Upload your arena MP3</div>
                    </div>
                  </button>
                </div>

                {/* Custom file uploader if custom is selected */}
                {hornConfig.useCustomHorn && (
                  <div className="bg-purple-950/30 border border-purple-900/50 rounded-lg p-2.5 space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadCustomHorn(file);
                      }}
                      className="hidden"
                    />

                    {hornConfig.customHornName ? (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Music className="w-4 h-4 text-purple-400 shrink-0" />
                          <span className="truncate text-purple-200 font-semibold text-xs">
                            {hornConfig.customHornName}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveCustomHorn}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-2 border border-dashed border-purple-500/50 hover:border-purple-400 rounded-lg text-purple-300 font-semibold flex items-center justify-center gap-1.5 text-xs transition"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Choose MP3 / WAV Audio File</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Duration Slider */}
                <div className="space-y-1 pt-1 border-t border-slate-800">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3 text-red-400" />
                      Horn Duration:
                    </span>
                    <span className="font-mono text-red-400 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {(hornConfig.hornDuration ?? 5.0).toFixed(1)}s blare
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={1.0}
                      max={30.0}
                      step={0.5}
                      value={hornConfig.hornDuration ?? 5.0}
                      onChange={(e) =>
                        updateHornConfig({ hornDuration: parseFloat(e.target.value) || 5.0 })
                      }
                      className="w-full h-1.5 bg-slate-950 rounded appearance-none cursor-pointer accent-red-500"
                    />
                  </div>
                </div>

                {/* Volume Slider & Audition */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <Volume2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="range"
                      min={0}
                      max={1.5}
                      step={0.05}
                      value={hornConfig.volume}
                      onChange={(e) => updateHornConfig({ volume: parseFloat(e.target.value) || 1 })}
                      className="w-20 h-1.5 bg-slate-950 rounded appearance-none cursor-pointer accent-red-500"
                    />
                    <span className="text-[10px] font-mono text-slate-400">
                      {Math.round(hornConfig.volume * 100)}%
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={toggleAuditionHorn}
                      className="text-[11px] bg-slate-800 hover:bg-slate-750 text-slate-200 px-2.5 py-1 rounded-lg border border-slate-700 transition flex items-center gap-1 font-medium cursor-pointer"
                    >
                      {isPlayingHorn ? (
                        <Square className="w-3 h-3 fill-current text-red-400" />
                      ) : (
                        <Play className="w-3 h-3 fill-current text-emerald-400" />
                      )}
                      <span>{isPlayingHorn ? 'Stop' : 'Audition'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => playArenaBuzzer(1.0)}
                      className="text-[11px] bg-slate-800 hover:bg-slate-750 text-slate-300 px-2 py-1 rounded-lg border border-slate-700 transition cursor-pointer"
                    >
                      Buzzer
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 4: FX, FRAMING & HIGHLIGHT TAGS ==================== */}
        {activeTab === 'fx' && (
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 sm:p-3.5 space-y-3 text-xs">
            {/* Clip Highlight Tag & Zoom (If clip is selected) */}
            {isEditingClip && currentClip ? (
              <div className="space-y-3">
                {/* Highlight Tag Selector */}
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs uppercase font-['Chakra_Petch'] flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-red-500" />
                      Clip #{selectedClipIndex! + 1} Highlight Tag
                    </span>
                    {currentClip.tag && (
                      <button
                        type="button"
                        onClick={() => updateCurrentClipField({ tag: undefined, customTagText: '' })}
                        className="text-[10px] text-slate-400 hover:text-red-400 transition cursor-pointer"
                      >
                        Clear Tag
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {[
                      { id: 'GOAL', label: 'Goal', emoji: '🚨', color: 'bg-red-600 hover:bg-red-500 text-white' },
                      { id: 'SAVE', label: 'Save', emoji: '🧤', color: 'bg-sky-600 hover:bg-sky-500 text-white' },
                      { id: 'HIT', label: 'Big Hit', emoji: '💥', color: 'bg-orange-600 hover:bg-orange-500 text-white' },
                      { id: 'DEKE', label: 'Deke', emoji: '⚡', color: 'bg-amber-600 hover:bg-amber-500 text-white' },
                      { id: 'POWERPLAY', label: 'Powerplay', emoji: '🏒', color: 'bg-indigo-600 hover:bg-indigo-500 text-white' },
                      { id: 'OT WINNER', label: 'OT Goal', emoji: '🏆', color: 'bg-emerald-600 hover:bg-emerald-500 text-white' },
                      { id: 'CELEBRATION', label: 'Celly', emoji: '🎉', color: 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white' },
                    ].map((tagItem) => {
                      const isSelected = currentClip.tag === tagItem.id;
                      return (
                        <button
                          key={tagItem.id}
                          type="button"
                          onClick={() => updateCurrentClipField({ tag: tagItem.id as any })}
                          className={`p-1.5 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer border ${
                            isSelected
                              ? `${tagItem.color} border-white/40 shadow-md`
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850'
                          }`}
                        >
                          <span>{tagItem.emoji}</span>
                          <span>{tagItem.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Highlight Text */}
                  <div className="pt-1.5">
                    <input
                      type="text"
                      placeholder="Custom tag banner text (optional)..."
                      value={currentClip.customTagText || ''}
                      onChange={(e) => updateCurrentClipField({ customTagText: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                    />
                  </div>
                </div>

                {/* Player Zoom & Reframing */}
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs uppercase font-['Chakra_Petch'] flex items-center gap-1.5">
                      <ZoomIn className="w-3.5 h-3.5 text-amber-400" />
                      Zoom Magnification
                    </span>
                    <span className="font-mono text-amber-300 font-bold text-xs">
                      {(currentClip.zoom ?? 1.0).toFixed(2)}x
                    </span>
                  </div>

                  <input
                    type="range"
                    min={1.0}
                    max={3.0}
                    step={0.05}
                    value={currentClip.zoom ?? 1.0}
                    onChange={(e) => updateCurrentClipField({ zoom: parseFloat(e.target.value) || 1.0 })}
                    className="w-full h-1.5 bg-slate-950 rounded appearance-none cursor-pointer accent-amber-400"
                  />

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[1.0, 1.25, 1.5, 1.8, 2.0, 2.5].map((z) => (
                      <button
                        key={z}
                        type="button"
                        onClick={() => updateCurrentClipField({ zoom: z })}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                          Math.abs((currentClip.zoom ?? 1.0) - z) < 0.05
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {z.toFixed(2)}x
                      </button>
                    ))}
                  </div>

                  {(currentClip.zoom ?? 1.0) > 1.02 && (
                    <div className="pt-2 border-t border-slate-800/80 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-300">
                        <span className="flex items-center gap-1 font-semibold">
                          <Move className="w-3 h-3 text-sky-400" />
                          Pan Reframe Focus
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          X: {currentClip.panX ?? 0}% | Y: {currentClip.panY ?? 0}%
                        </span>
                      </div>

                      <div className="grid grid-cols-5 gap-1">
                        {[
                          { label: 'Left', x: -50, y: 0, resetZoom: false },
                          { label: 'Center', x: 0, y: 0, resetZoom: false },
                          { label: 'Right', x: 50, y: 0, resetZoom: false },
                          { label: 'Net', x: 0, y: 40, resetZoom: false },
                          { label: 'Reset', x: 0, y: 0, resetZoom: true },
                        ].map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => {
                              if (item.resetZoom) {
                                updateCurrentClipField({ zoom: 1.0, panX: 0, panY: 0 });
                              } else {
                                updateCurrentClipField({ panX: item.x, panY: item.y });
                              }
                            }}
                            className="py-1 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 hover:text-white font-medium text-center cursor-pointer"
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-center text-slate-400 text-xs">
                Select a clip on the timeline to configure zoom, pan, and highlight tags.
              </div>
            )}

            {/* Global Broadcast Toggles */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-['Chakra_Petch']">
                Global Effects
              </div>

              <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                <div className="space-y-0.5">
                  <span className="text-slate-200 font-bold flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-red-500" />
                    Red Siren Goal Light Flash
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Flashes stadium red alert flare when a goal is scored
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.sirenFlash}
                  onChange={(e) => onChange({ ...settings, sirenFlash: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-700 text-red-500 focus:ring-0 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                <div className="space-y-0.5">
                  <span className="text-slate-200 font-bold flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-sky-400" />
                    Action Badges (GOAL / SAVE / HIT)
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Shows high-impact broadcast action badges on screen
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showStamps}
                  onChange={(e) => onChange({ ...settings, showStamps: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-700 text-sky-500 focus:ring-0 w-4 h-4 cursor-pointer"
                />
              </label>
            </div>
          </div>
        )}

        {/* ==================== TAB 4: AI SPORTS MUSIC ==================== */}
        {activeTab === 'music' && (
          <AIMusicControls
            settings={
              settings.backgroundMusic || {
                enabled: false,
                volume: 0.75,
                originalVideoVolume: 1.0,
                duckOnGoalHorn: true,
                loop: true,
                currentTrack: null,
                selectedStyle: 'arena-rock',
                customPrompt: '',
              }
            }
            onChange={(updated) => onChange({ ...settings, backgroundMusic: updated })}
            totalVideoDuration={clips.reduce((acc, c) => {
              const dur = Math.max(
                0.1,
                ((c.endTime || c.originalDuration || 5) - (c.startTime || 0)) / (c.playbackRate || 1),
              );
              return acc + dur;
            }, 0)}
          />
        )}
      </div>
    </div>
  );
};
