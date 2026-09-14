import React, { useState, useRef, useEffect } from 'react';
import { BackgroundMusicSettings, SportsMusicStyle, AIMusicTrack } from '../types';
import { generateAIMusicTrack, SPORTS_MUSIC_STYLES } from '../lib/sportsMusicEngine';
import {
  Music,
  Play,
  Square,
  Sparkles,
  Volume2,
  Sliders,
  RefreshCw,
  Radio,
  Clock,
  Flame,
  CheckCircle2,
  Layers,
  Zap,
} from 'lucide-react';

interface AIMusicControlsProps {
  settings: BackgroundMusicSettings;
  onChange: (updated: BackgroundMusicSettings) => void;
  totalVideoDuration: number;
}

export const AIMusicControls: React.FC<AIMusicControlsProps> = ({
  settings,
  onChange,
  totalVideoDuration,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlayingAudition, setIsPlayingAudition] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const auditionAudioRef = useRef<HTMLAudioElement | null>(null);

  const effectiveDuration = Math.max(5, Math.min(180, Math.ceil(totalVideoDuration || 15)));

  const effectiveSettings: BackgroundMusicSettings = {
    enabled: settings?.enabled ?? false,
    volume: settings?.volume ?? 0.75,
    originalVideoVolume: settings?.originalVideoVolume ?? 1.0,
    duckOnGoalHorn: settings?.duckOnGoalHorn ?? true,
    loop: settings?.loop ?? true,
    currentTrack: settings?.currentTrack ?? null,
    selectedStyle: settings?.selectedStyle ?? 'arena-rock',
    customPrompt: settings?.customPrompt ?? '',
  };

  const update = (partial: Partial<BackgroundMusicSettings>) => {
    onChange({
      ...effectiveSettings,
      ...partial,
    });
  };

  // Stop audition audio when unmounting or track changes
  useEffect(() => {
    return () => {
      if (auditionAudioRef.current) {
        try {
          auditionAudioRef.current.pause();
          auditionAudioRef.current.src = '';
        } catch {}
      }
    };
  }, []);

  const handleGenerate = async (overrideStyle?: SportsMusicStyle) => {
    const styleToUse = overrideStyle || effectiveSettings.selectedStyle;
    setIsGenerating(true);
    setFeedback(null);

    // Stop current audition
    if (auditionAudioRef.current) {
      try {
        auditionAudioRef.current.pause();
      } catch {}
      setIsPlayingAudition(false);
    }

    try {
      // Generate upbeat sports music track via procedural synthesizer & AI blueprint
      const track = await generateAIMusicTrack(
        styleToUse,
        effectiveDuration,
        effectiveSettings.customPrompt,
      );

      update({
        enabled: true,
        currentTrack: track,
        selectedStyle: styleToUse,
      });

      setFeedback(`Generated "${track.title}" (${track.bpm} BPM)`);
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      console.error('Failed to generate sports music:', err);
      setFeedback('Generation error. Please try again.');
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleAudition = () => {
    const track = effectiveSettings.currentTrack;
    if (!track) return;

    if (isPlayingAudition) {
      if (auditionAudioRef.current) {
        try {
          auditionAudioRef.current.pause();
          auditionAudioRef.current.currentTime = 0;
        } catch {}
      }
      setIsPlayingAudition(false);
      return;
    }

    let url = track.audioUrl;
    if (!url && track.audioBlob) {
      url = URL.createObjectURL(track.audioBlob);
    }
    if (!url) return;

    if (!auditionAudioRef.current) {
      auditionAudioRef.current = new Audio();
    }

    const audio = auditionAudioRef.current;
    audio.src = url;
    audio.loop = effectiveSettings.loop;
    audio.volume = Math.max(0, Math.min(1.0, effectiveSettings.volume));

    audio.onended = () => {
      setIsPlayingAudition(false);
    };

    audio.play()
      .then(() => {
        setIsPlayingAudition(true);
      })
      .catch((err) => {
        console.warn('Audition play blocked:', err);
        setIsPlayingAudition(false);
      });
  };

  return (
    <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 sm:p-3.5 space-y-3.5">
      {/* Header & Global On/Off Toggle */}
      <div className="flex items-center justify-between border-b border-slate-800/70 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Music className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-['Chakra_Petch'] font-bold text-white text-xs tracking-wider uppercase flex items-center gap-1.5">
              AI Sports Music Generator
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                Vocal-Free
              </span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Upbeat stadium beats & rock soundtracks for the entire video
            </p>
          </div>
        </div>

        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={effectiveSettings.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
        </label>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 text-xs font-semibold animate-pulse">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
          <span className="truncate">{feedback}</span>
        </div>
      )}

      {/* Style Presets Grid */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-slate-300 font-bold uppercase font-['Chakra_Petch']">
          <span className="flex items-center gap-1.5 text-slate-200">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            Sports Music Style
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {totalVideoDuration > 0 ? `Video: ${totalVideoDuration.toFixed(1)}s` : 'Instrumental'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {SPORTS_MUSIC_STYLES.map((preset) => {
            const isSelected = effectiveSettings.selectedStyle === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  update({ selectedStyle: preset.id });
                  // If no track yet, generate right away
                  if (!effectiveSettings.currentTrack) {
                    handleGenerate(preset.id);
                  }
                }}
                className={`text-left p-2 rounded-xl border transition cursor-pointer flex flex-col gap-0.5 ${
                  isSelected
                    ? 'bg-emerald-950/40 border-emerald-500/70 shadow-sm'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`font-['Chakra_Petch'] font-bold text-xs ${
                      isSelected ? 'text-emerald-300' : 'text-white'
                    }`}
                  >
                    {preset.name}
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-950 border border-slate-800 text-slate-400">
                    {preset.defaultBpm} BPM
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 line-clamp-1 leading-tight">
                  {preset.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* AI Direction & Prompt Input */}
      <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
        <label className="flex items-center justify-between text-xs text-slate-300 font-bold uppercase font-['Chakra_Petch']">
          <span className="flex items-center gap-1.5 text-slate-200">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            AI Musical Direction (Optional)
          </span>
          <span className="text-[10px] text-slate-400 font-mono">Custom Vibe</span>
        </label>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={effectiveSettings.customPrompt}
            onChange={(e) => update({ customPrompt: e.target.value })}
            placeholder="e.g. Overtime sudden-death rush, heavy kick, driving guitar riffs..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            disabled={isGenerating}
            onClick={() => handleGenerate()}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow transition cursor-pointer shrink-0"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                <span>Synthesizing...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                <span>Generate</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Current Generated Track Player Card */}
      {effectiveSettings.currentTrack && (
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={toggleAudition}
                className={`p-2 rounded-xl transition cursor-pointer shadow-md flex items-center justify-center shrink-0 ${
                  isPlayingAudition
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
                title={isPlayingAudition ? 'Stop Audition' : 'Play Audition'}
              >
                {isPlayingAudition ? (
                  <Square className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current" />
                )}
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-['Chakra_Petch'] font-bold text-white text-xs truncate">
                    {effectiveSettings.currentTrack.title}
                  </span>
                  <span className="text-[9px] font-mono px-1 rounded bg-slate-950 text-emerald-400 border border-emerald-900/60 shrink-0">
                    {effectiveSettings.currentTrack.bpm} BPM
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                  <span>Upbeat Sports Instrumental</span>
                  <span>•</span>
                  <span>{effectiveSettings.currentTrack.duration.toFixed(1)}s sequence</span>
                </div>
              </div>
            </div>

            {/* Rhythm Visualizer Bars */}
            <div className="flex items-end gap-0.5 h-6 px-2 py-0.5 bg-slate-950 rounded-lg border border-slate-800 shrink-0">
              {[40, 70, 90, 60, 100, 75, 45, 85].map((h, i) => (
                <span
                  key={i}
                  className={`w-1 rounded-xs transition-all duration-150 ${
                    isPlayingAudition ? 'bg-emerald-400 animate-pulse' : 'bg-slate-700'
                  }`}
                  style={{
                    height: isPlayingAudition
                      ? `${Math.max(20, Math.min(100, (h * (i % 2 === 0 ? 1.2 : 0.8))))}%`
                      : '25%',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Dual-Track Audio Mixer & Balance Controls */}
      <div className="space-y-3 bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/80">
        <div className="flex items-center justify-between text-xs text-slate-300 font-bold uppercase font-['Chakra_Petch'] border-b border-slate-800 pb-1.5">
          <span className="flex items-center gap-1.5 text-slate-200">
            <Sliders className="w-3.5 h-3.5 text-sky-400" />
            Audio Mixer & Level Balance
          </span>
          <span className="text-[10px] text-emerald-400 font-mono font-semibold">
            Dual-Track Mixing
          </span>
        </div>

        {/* 1. AI Background Music Volume */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-emerald-400" />
              AI Music Volume
            </span>
            <span className="font-mono text-emerald-400 font-bold text-xs">
              {Math.round(effectiveSettings.volume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.05}
            value={effectiveSettings.volume}
            onChange={(e) => update({ volume: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-slate-950 rounded appearance-none cursor-pointer accent-emerald-500"
          />
        </div>

        {/* 2. Original Video Audio Volume (Preserves native crowd cheers & rink sounds) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-sky-400" />
              Original Video Audio
            </span>
            <span className="font-mono text-sky-400 font-bold text-xs">
              {Math.round(effectiveSettings.originalVideoVolume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.05}
            value={effectiveSettings.originalVideoVolume}
            onChange={(e) => update({ originalVideoVolume: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-slate-950 rounded appearance-none cursor-pointer accent-sky-500"
          />
          <p className="text-[10px] text-slate-400">
            Preserves native video music, crowd cheers, stick hits & commentary in the background
          </p>
        </div>

        {/* 3. Goal Horn Ducking Toggle */}
        <label className="flex items-center justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
          <div className="space-y-0.5">
            <span className="text-slate-200 font-bold text-xs flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-red-500" />
              Duck Music on Goal Horn
            </span>
            <p className="text-[10px] text-slate-400">
              Lowers background music so the goal horn blasts loud & punchy
            </p>
          </div>
          <input
            type="checkbox"
            checked={effectiveSettings.duckOnGoalHorn}
            onChange={(e) => update({ duckOnGoalHorn: e.target.checked })}
            className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer"
          />
        </label>

        {/* 4. Seamless Loop Toggle */}
        <label className="flex items-center justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
          <div className="space-y-0.5">
            <span className="text-slate-200 font-bold text-xs flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Seamless Looping
            </span>
            <p className="text-[10px] text-slate-400">
              Loop upbeat soundtrack smoothly for the full length of the video
            </p>
          </div>
          <input
            type="checkbox"
            checked={effectiveSettings.loop}
            onChange={(e) => update({ loop: e.target.checked })}
            className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer"
          />
        </label>
      </div>
    </div>
  );
};
