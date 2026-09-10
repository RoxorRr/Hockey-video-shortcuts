import React, { useRef, useState } from 'react';
import { HockeyOverlaySettings, GoalHornConfig, VideoClip, ScorebugConfig, PlayerBannerConfig } from '../types';
import { PlayerRosterPicker } from './PlayerRosterPicker';
import { autoRememberPlayer } from '../lib/rosterStorage';
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

  const updateScorebug = (field: string, val: any) => {
    onChange({
      ...settings,
      scorebug: {
        ...settings.scorebug,
        [field]: val,
      },
    });
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
      onUpdateClip(selectedClipIndex!, {
        ...currentClip,
        useCustomOverlays: true,
        scorebugOverride: {
          ...existingOverride,
          [field]: val,
        },
      });
    } else {
      updateScorebug(field, val);
    }
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
        scorebugOverride: currentClip.scorebugOverride || { ...settings.scorebug },
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

    // Apply immediately so the audio source is active without waiting for event loops
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

    // Detect duration and update config
    const tempAudio = new Audio();
    tempAudio.preload = 'metadata';
    tempAudio.onloadedmetadata = () => {
      const dur = tempAudio.duration;
      if (Number.isFinite(dur) && dur > 0) {
        const roundedDur = Number(dur.toFixed(1));
        const currentDur = hornConfig.hornDuration;
        const keepCurrent = typeof currentDur === 'number' && Number.isFinite(currentDur) && currentDur > 0;
        updateHornConfig({
          customHornDuration: roundedDur,
          hornDuration: keepCurrent ? currentDur : Math.min(5.0, roundedDur),
        });
      }
    };
    tempAudio.src = url;
    tempAudio.load();
  };

  const handleRemoveCustomHorn = () => {
    if (activeHornStopRef.current) {
      activeHornStopRef.current();
      activeHornStopRef.current = null;
    }
    if (hornConfig.customHornUrl && hornConfig.customHornUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(hornConfig.customHornUrl);
      } catch {}
    }
    setIsPlayingHorn(false);
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
      activeHornStopRef.current?.();
      activeHornStopRef.current = null;
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
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-4 lg:p-6 shadow-xl space-y-5">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-red-500" />
          <h3 className="font-['Chakra_Petch'] font-bold text-white tracking-wider text-sm uppercase">
            Hockey Graphics & Overlays
          </h3>
        </div>
        <span className="text-[11px] text-slate-400">Scorebug, Player Card & Horn FX</span>
      </div>

      {/* Scope Selector: Global vs Individual Clips */}
      {clips.length > 0 && (
        <div className="bg-slate-950/90 border border-slate-800/90 rounded-xl p-2.5 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span className="font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-sky-400" />
              Target Scope:
            </span>
            <span className="text-[10px]">
              {isEditingClip
                ? `Customizing Clip ${selectedClipIndex! + 1} of ${clips.length}`
                : 'Editing Global Defaults (All Clips)'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Global Button */}
            <button
              type="button"
              id="scope-global-btn"
              onClick={() => onSelectClipIndex?.(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                !isEditingClip
                  ? 'bg-red-600 text-white shadow-md shadow-red-950/40'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Global Defaults</span>
            </button>

            {/* Clip Buttons */}
            {clips.map((clip, idx) => {
              const isSelected = isEditingClip && selectedClipIndex === idx;
              const hasCustom = Boolean(clip.useCustomOverlays);
              const customName = clip.playerBannerOverride?.playerName;
              const customNum = clip.playerBannerOverride?.jerseyNumber;

              return (
                <button
                  key={clip.id}
                  type="button"
                  id={`scope-clip-btn-${idx}`}
                  onClick={() => onSelectClipIndex?.(idx)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer max-w-[200px] truncate border ${
                    isSelected
                      ? 'bg-sky-600 border-sky-500 text-white shadow-md shadow-sky-950/40 font-bold'
                      : hasCustom
                      ? 'bg-slate-900/90 border-sky-800/80 text-sky-300 hover:bg-slate-850'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850'
                  }`}
                  title={`${clip.name} ${hasCustom ? '(Has custom overlays)' : '(Inherits global)'}`}
                >
                  <span className="shrink-0 font-mono">#{idx + 1}</span>
                  <span className="truncate">{customName || clip.name}</span>
                  {hasCustom && (
                    <span
                      className="w-2 h-2 rounded-full bg-sky-400 shrink-0 shadow-xs shadow-sky-400"
                      title="Custom player/score active"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Clip Banner (When a specific clip is targeted) */}
      {isEditingClip && currentClip && (
        <div
          className={`rounded-xl p-3.5 border transition-all ${
            isClipCustomized
              ? 'bg-sky-950/40 border-sky-700/60'
              : 'bg-slate-950/70 border-slate-800'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-xs">
                  Clip #{selectedClipIndex! + 1}: {currentClip.name}
                </span>
                {isClipCustomized ? (
                  <span className="text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/40 px-2 py-0.5 rounded font-bold uppercase">
                    Custom Overlays Active
                  </span>
                ) : (
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-medium">
                    Inheriting Global Overlays
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                {isClipCustomized
                  ? 'This clip features its own custom player lower third and game score on the timeline.'
                  : 'Turn on custom overlays below to feature a different player and a different score for this highlight!'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isClipCustomized ? (
                <>
                  <button
                    type="button"
                    onClick={handleCopyGlobalToClip}
                    className="text-[11px] px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-700 flex items-center gap-1 transition cursor-pointer"
                    title="Copy current global score and player text into this clip"
                  >
                    <Copy className="w-3 h-3 text-slate-400" />
                    <span>Copy Global</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleClipCustomOverlays(false)}
                    className="text-[11px] px-2.5 py-1 rounded bg-slate-900 hover:bg-red-950/50 text-slate-400 hover:text-red-300 border border-slate-700 hover:border-red-800 flex items-center gap-1 transition cursor-pointer"
                    title="Remove overrides and inherit global overlays"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Revert to Global</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => handleToggleClipCustomOverlays(true)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center gap-1.5 transition shadow shadow-sky-950/40 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Customize for Clip #{selectedClipIndex! + 1}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Overlays Editor Cards (Scorebug & Player Banner) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Scorebug Panel */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-sky-400" />
              Game Scorebug
              {isEditingClip && isClipCustomized && (
                <span className="text-[9px] text-sky-400 font-mono font-bold bg-sky-950/80 px-1.5 py-0.5 rounded border border-sky-800/60">
                  Clip #{selectedClipIndex! + 1}
                </span>
              )}
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="scorebug-toggle-checkbox"
                type="checkbox"
                checked={activeScorebug.enabled}
                onChange={(e) => updateActiveScorebug('enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
            </label>
          </div>

          {activeScorebug.enabled && (
            <div className="space-y-2.5 pt-1 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-semibold">Away Team &amp; Score</label>
                  <div className="flex gap-1.5 mt-0.5">
                    <input
                      type="text"
                      maxLength={24}
                      list="hockey-popular-teams-datalist"
                      value={activeScorebug.awayTeam}
                      onChange={(e) => updateActiveScorebug('awayTeam', e.target.value.toUpperCase())}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-white font-bold"
                      placeholder="e.g. EDMONTON, BOS"
                    />
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={activeScorebug.awayScore}
                      onChange={(e) => updateActiveScorebug('awayScore', parseInt(e.target.value) || 0)}
                      className="w-12 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sky-400 font-black text-center"
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
                      value={activeScorebug.homeTeam}
                      onChange={(e) => updateActiveScorebug('homeTeam', e.target.value.toUpperCase())}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-white font-bold"
                      placeholder="e.g. COLORADO, NYR"
                    />
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={activeScorebug.homeScore}
                      onChange={(e) => updateActiveScorebug('homeScore', parseInt(e.target.value) || 0)}
                      className="w-12 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sky-400 font-black text-center"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-semibold">Period</label>
                  <select
                    value={activeScorebug.period}
                    onChange={(e) => updateActiveScorebug('period', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white text-xs mt-0.5"
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
                    value={activeScorebug.timeRemaining}
                    onChange={(e) => updateActiveScorebug('timeRemaining', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white font-mono text-center mt-0.5"
                    placeholder="0:14"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Player Banner Lower Third */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-red-400" />
              Player Lower Third
              {isEditingClip && isClipCustomized && (
                <span className="text-[9px] text-red-400 font-mono font-bold bg-red-950/80 px-1.5 py-0.5 rounded border border-red-800/60">
                  Clip #{selectedClipIndex! + 1}
                </span>
              )}
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="player-banner-toggle-checkbox"
                type="checkbox"
                checked={activePlayerBanner.enabled}
                onChange={(e) => updateActivePlayerBanner('enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
            </label>
          </div>

          {activePlayerBanner.enabled && (
            <div className="space-y-3 pt-1 text-xs">
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
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white font-black text-center mt-0.5"
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
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-white font-semibold mt-0.5"
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
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-sky-400 font-medium mt-0.5"
                  placeholder="Top Shelf Snapper (Game Winner)"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Goal Horn Sound & Custom Horn Section */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/70 pb-3">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-red-500" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Goal Horn &amp; Arena Sound FX
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
                hornConfig.useCustomHorn && hornConfig.customHornName
                  ? 'bg-purple-950 text-purple-300 border-purple-800'
                  : 'bg-slate-900 text-slate-300 border-slate-700'
              }`}
            >
              {hornConfig.useCustomHorn && hornConfig.customHornName ? 'Custom Horn Audio' : 'Arena Synthesizer Horn'}
            </span>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={hornConfig.enabled}
              onChange={(e) => updateHornConfig({ enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
          </label>
        </div>

        {hornConfig.enabled && (
          <div className="space-y-4 text-xs">
            {/* Audio Source Switcher: Synth vs Custom */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => updateHornConfig({ useCustomHorn: false })}
                className={`p-3 rounded-lg border text-left transition flex items-start gap-2.5 ${
                  !hornConfig.useCustomHorn
                    ? 'bg-slate-900 border-red-600/70 text-white shadow-sm'
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
                  <div className="font-bold text-white text-xs">NHL Arena Synthesizer Horn</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Classic NHL dual-tone stadium brass horn with authentic crowd roar
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => updateHornConfig({ useCustomHorn: true })}
                className={`p-3 rounded-lg border text-left transition flex items-start gap-2.5 ${
                  hornConfig.useCustomHorn
                    ? 'bg-slate-900 border-purple-500/70 text-white shadow-sm'
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
                  <div className="font-bold text-white text-xs">My Custom Horn Audio File</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Upload your own team&apos;s horn recording (MP3, WAV, OGG, M4A)
                  </div>
                </div>
              </button>
            </div>

            {/* Custom Horn File Upload / Management */}
            {hornConfig.useCustomHorn && (
              <div className="bg-slate-900/90 border border-purple-900/40 rounded-xl p-3.5 space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.webm"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadCustomHorn(file);
                    e.target.value = '';
                  }}
                />

                {hornConfig.customHornName ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 border border-slate-800 p-3 rounded-lg">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/50 flex items-center justify-center text-purple-400 shrink-0">
                        <Music className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-white text-xs truncate max-w-[240px]">
                          {hornConfig.customHornName}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {hornConfig.customHornDuration
                            ? `${hornConfig.customHornDuration.toFixed(1)}s duration`
                            : 'Audio ready'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={toggleAuditionHorn}
                        className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow"
                      >
                        {isPlayingHorn ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                        {isPlayingHorn ? 'Stop' : 'Play Horn'}
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg text-xs border border-slate-700 transition"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveCustomHorn}
                        title="Remove custom horn"
                        className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleUploadCustomHorn(file);
                    }}
                    className="border-2 border-dashed border-slate-700 hover:border-purple-500 bg-slate-950/60 p-4 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition text-center group"
                  >
                    <div className="w-10 h-10 rounded-full bg-purple-600/10 group-hover:bg-purple-600/20 text-purple-400 flex items-center justify-center transition">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="font-bold text-white text-xs">Click to upload your goal horn audio</span>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Supports MP3, WAV, OGG, AAC, or M4A arena recordings
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Timing & Trigger Controls */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Horn Trigger Timing in Video Clips
              </div>

              {/* Mode: Every Clip vs Goal Clips Only */}
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold block mb-1.5">
                  Trigger When:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateHornConfig({ triggerMode: 'every_clip' })}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition text-left flex items-center justify-between ${
                      hornConfig.triggerMode === 'every_clip'
                        ? 'bg-red-600/20 border-red-500 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Play in Every Video Clip</span>
                    {hornConfig.triggerMode === 'every_clip' && (
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => updateHornConfig({ triggerMode: 'goal_clips_only' })}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold transition text-left flex items-center justify-between ${
                      hornConfig.triggerMode === 'goal_clips_only'
                        ? 'bg-red-600/20 border-red-500 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Only on Clips Tagged &quot;GOAL&quot;</span>
                    {hornConfig.triggerMode === 'goal_clips_only' && (
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    )}
                  </button>
                </div>
              </div>

              {/* Horn Sound Duration (Extended Limit & Customizable) */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-red-400" />
                    Horn Sound Duration:
                  </span>
                  <span className="font-mono text-red-400 font-bold bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">
                    {(hornConfig.hornDuration ?? 5.0).toFixed(1)}s blare
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1.0}
                    max={30.0}
                    step={0.5}
                    value={hornConfig.hornDuration ?? 5.0}
                    onChange={(e) =>
                      updateHornConfig({ hornDuration: parseFloat(e.target.value) || 5.0 })
                    }
                    className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-red-500"
                  />
                  <input
                    type="number"
                    min={1.0}
                    max={60.0}
                    step={0.5}
                    value={hornConfig.hornDuration ?? 5.0}
                    onChange={(e) =>
                      updateHornConfig({
                        hornDuration: Math.max(0.5, Math.min(60.0, parseFloat(e.target.value) || 5.0)),
                      })
                    }
                    className="w-16 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-center font-mono text-red-400 text-xs font-bold"
                  />
                </div>

                {/* Duration Presets (Extending past the previous 10s cap) */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-500">Duration presets:</span>
                  {[2.0, 3.0, 3.5, 5.0, 8.0, 10.0, 15.0, 20.0, 30.0].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => updateHornConfig({ hornDuration: sec })}
                      className={`text-[10px] px-2 py-0.5 rounded border transition font-mono ${
                        Math.abs((hornConfig.hornDuration ?? 5.0) - sec) < 0.2
                          ? 'bg-red-500/20 border-red-500 text-red-300 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 italic">
                  Extended limit up to 60s. Controls how long the NHL arena synthesizer or custom horn blares.
                </p>
              </div>

              {/* Specific Offset Seconds in Clip (Extended Limit) */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 font-semibold">
                    Trigger Timestamp in Clip:
                  </span>
                  <span className="font-mono text-amber-400 font-bold bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">
                    {hornConfig.clipOffsetSeconds.toFixed(1)}s into clip
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={30.0}
                    step={0.1}
                    value={hornConfig.clipOffsetSeconds}
                    onChange={(e) =>
                      updateHornConfig({ clipOffsetSeconds: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <input
                    type="number"
                    min={0}
                    max={60.0}
                    step={0.1}
                    value={hornConfig.clipOffsetSeconds}
                    onChange={(e) =>
                      updateHornConfig({
                        clipOffsetSeconds: Math.max(0, Math.min(60.0, parseFloat(e.target.value) || 0)),
                      })
                    }
                    className="w-16 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-center font-mono text-amber-400 text-xs font-bold"
                  />
                </div>

                {/* Quick Preset Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-500">Trigger presets:</span>
                  {[0.0, 0.5, 1.0, 2.0, 3.5, 5.0, 10.0].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => updateHornConfig({ clipOffsetSeconds: sec })}
                      className={`text-[10px] px-2 py-0.5 rounded border transition font-mono ${
                        Math.abs(hornConfig.clipOffsetSeconds - sec) < 0.05
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {sec === 0.0 ? '0.0s (Start)' : `${sec.toFixed(1)}s`}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 italic">
                  Horn will sound automatically {hornConfig.clipOffsetSeconds.toFixed(1)} seconds after each clip begins.
                </p>
              </div>

              {/* Native Video Horn & Audio Handling */}
              <div className="space-y-2.5 pt-2 border-t border-slate-800">
                <div className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-sky-400" />
                  Native Video Audio & Conflict Prevention
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer bg-slate-950 p-2.5 rounded-lg border border-slate-800 hover:border-slate-700 transition">
                  <input
                    type="checkbox"
                    checked={hornConfig.skipClipsWithNativeHorn ?? true}
                    onChange={(e) =>
                      updateHornConfig({ skipClipsWithNativeHorn: e.target.checked })
                    }
                    className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer mt-0.5"
                  />
                  <div className="flex-1 text-xs">
                    <span className="font-semibold text-slate-200">
                      Skip overlay horn on clips that have native arena audio
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      If a clip is tagged with native horn in Trim & Edit, the app will suppress the overlay horn to prevent duplicate or clashing sounds.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer bg-slate-950 p-2.5 rounded-lg border border-slate-800 hover:border-slate-700 transition">
                  <input
                    type="checkbox"
                    checked={hornConfig.duckVideoAudio ?? true}
                    onChange={(e) =>
                      updateHornConfig({ duckVideoAudio: e.target.checked })
                    }
                    className="rounded bg-slate-900 border-slate-700 text-red-500 focus:ring-0 w-4 h-4 cursor-pointer mt-0.5"
                  />
                  <div className="flex-1 text-xs">
                    <span className="font-semibold text-slate-200">
                      Duck native video audio while horn sounds
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      Temporarily lowers video background sound so the goal horn blasts with full arena clarity without fighting crowd noise.
                    </p>
                  </div>
                </label>
              </div>

              {/* Volume Slider & Audition */}
              <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                  <Volume2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-[11px] text-slate-300 font-semibold">Volume:</span>
                  <input
                    type="range"
                    min={0}
                    max={1.5}
                    step={0.05}
                    value={hornConfig.volume}
                    onChange={(e) => updateHornConfig({ volume: parseFloat(e.target.value) || 1 })}
                    className="w-24 h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-red-500"
                  />
                  <span className="text-[11px] font-mono text-slate-400">
                    {Math.round(hornConfig.volume * 100)}%
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleAuditionHorn}
                    className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition flex items-center gap-1.5 font-medium"
                  >
                    {isPlayingHorn ? <Square className="w-3 h-3 fill-current text-red-400" /> : <Play className="w-3 h-3 fill-current text-emerald-400" />}
                    {isPlayingHorn ? 'Stop Audio' : 'Audition Horn'}
                  </button>
                  <button
                    type="button"
                    onClick={() => playArenaBuzzer(1.0)}
                    className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg border border-slate-700 transition"
                  >
                    Buzzer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Badges & Stamps toggle */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.showStamps}
            onChange={(e) => onChange({ ...settings, showStamps: e.target.checked })}
            className="rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-0 w-4 h-4 cursor-pointer"
          />
          <span className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            Show Action Badges (GOAL / SAVE / HIT)
          </span>
        </label>
      </div>
    </div>
  );
};
