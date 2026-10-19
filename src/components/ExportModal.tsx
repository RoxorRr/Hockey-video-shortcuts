import React, { useState } from 'react';
import {
  X,
  Download,
  Upload,
  CheckCircle2,
  Loader2,
  Sparkles,
  Sliders,
  RefreshCw,
  Zap,
  Server,
  ShieldCheck,
  AlertCircle,
  Play,
  RotateCcw,
  Film,
  Layers,
  Check,
  Volume2,
  VolumeX,
  Radio,
} from 'lucide-react';
import {
  AspectRatio,
  ExportEngine,
  ExportOptions,
  ExportQualityPreset,
  LiveExportStats,
  VideoClip,
} from '../types';

function formatExportTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  progressPercent: number;
  statusMessage: string;
  isExporting: boolean;
  isCompleted: boolean;
  exportedBlob: Blob | null;
  onProceedToYouTube: () => void;
  exportOptions: ExportOptions;
  onUpdateOptions: (opts: ExportOptions) => void;
  onStartExport: (opts: ExportOptions) => void;
  onCancelExport?: () => void;
  onOpenBufferModal?: () => void;
  clips?: VideoClip[];
  aspectRatio?: AspectRatio;
  liveStats?: LiveExportStats | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  progressPercent,
  statusMessage,
  isExporting,
  isCompleted,
  exportedBlob,
  onProceedToYouTube,
  exportOptions,
  onUpdateOptions,
  onStartExport,
  onCancelExport,
  onOpenBufferModal,
  clips = [],
  aspectRatio = '16:9',
  liveStats,
}) => {
  const [selectedEngine, setSelectedEngine] = useState<ExportEngine>(
    exportOptions.engine || 'realtime',
  );
  const [removeEffects, setRemoveEffects] = useState<boolean>(
    Boolean(exportOptions.removeEffectsAndTransitions),
  );
  const [selectedPreset, setSelectedPreset] = useState<ExportQualityPreset>(
    exportOptions.qualityPreset || 'source',
  );
  const [selectedFps, setSelectedFps] = useState<60 | 30>(exportOptions.fps || 30);
  const [showAdvancedAccordion, setShowAdvancedAccordion] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string>('');
  const [isLiveAudioMuted, setIsLiveAudioMuted] = useState(true);

  const toggleLiveAudio = () => {
    const next = !isLiveAudioMuted;
    setIsLiveAudioMuted(next);
    window.dispatchEvent(
      new CustomEvent('export-toggle-audio', { detail: { enabled: !next } }),
    );
  };

  React.useEffect(() => {
    if (!exportedBlob) {
      setDownloadUrl('');
      return;
    }
    const url = URL.createObjectURL(exportedBlob);
    setDownloadUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [exportedBlob]);

  if (!isOpen) return null;

  // Calculate projected resolution
  const getProjectedRes = (preset: ExportQualityPreset) => {
    if (preset === 'source') return 'Source (Original Resolution & Aspect Ratio)';
    if (preset === '4k') {
      if (aspectRatio === '9:16') return '2160 × 3840 (4K Vertical)';
      if (aspectRatio === '1:1') return '2160 × 2160 (4K Square)';
      return '3840 × 2160 (4K Ultra HD)';
    }
    if (preset === '720p') {
      if (aspectRatio === '9:16') return '720 × 1280 (720p)';
      if (aspectRatio === '1:1') return '720 × 720 (Square)';
      return '1280 × 720 (720p HD)';
    }
    if (preset === '1080p') {
      if (aspectRatio === '9:16') return '1080 × 1920 (1080p Vertical)';
      if (aspectRatio === '1:1') return '1080 × 1080 (1080p Square)';
      return '1920 × 1080 (1080p Full HD)';
    }
    return aspectRatio === '9:16' ? '1080 × 1920' : '1920 × 1080';
  };

  const handleStart = (engineOverride?: ExportEngine) => {
    const activeEngine = engineOverride || selectedEngine;
    const updated: ExportOptions = {
      ...exportOptions,
      engine: activeEngine,
      qualityPreset: selectedPreset,
      fps: selectedFps,
      removeEffectsAndTransitions: removeEffects,
    };
    onUpdateOptions(updated);
    onStartExport(updated);
  };

  const getEngineDetails = (engine: ExportEngine) => {
    if (engine === 'realtime') {
      return {
        title: 'Live Preview & Canvas Stream',
        badge: 'RECOMMENDED • 50+ CLIPS SAFE',
        desc: 'Watch the preview live in real time while recording the master MP4. 100% reliable for 50+ clips (1.5GB+), zero black screens, never hangs.',
        icon: Radio,
        color: 'text-emerald-400',
        border: 'border-emerald-500',
        bg: 'bg-emerald-950/40',
        pill: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      };
    }
    if (engine === 'webcodecs') {
      return {
        title: 'Offline Master (WebCodecs)',
        badge: 'FRAME-BY-FRAME SEEK',
        desc: 'Deterministic frame-by-frame seeking without live playback. Best for small projects (1-5 clips). May stall on 50+ large video files.',
        icon: ShieldCheck,
        color: 'text-sky-400',
        border: 'border-sky-500',
        bg: 'bg-sky-950/40',
        pill: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
      };
    }
    if (engine === 'direct-stitch') {
      return {
        title: 'Clean Video Stitch',
        badge: 'RAW FOOTAGE ONLY',
        desc: 'Merges original video files directly without scorebugs, goal horn, or graphic overlays.',
        icon: Film,
        color: 'text-amber-400',
        border: 'border-amber-500',
        bg: 'bg-amber-950/40',
        pill: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      };
    }
    return {
      title: 'Studio Server FFmpeg',
      badge: 'SERVER TRANSCODE',
      desc: 'Server-side native FFmpeg transcode pipeline.',
      icon: Server,
      color: 'text-purple-400',
      border: 'border-purple-500',
      bg: 'bg-purple-950/40',
      pill: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    };
  };

  const activeEngineInfo = getEngineDetails(exportOptions.engine || selectedEngine);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-3">
            {isExporting ? (
              <Loader2 className="w-5 h-5 text-emerald-400 animate-spin shrink-0" />
            ) : isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <Film className="w-5 h-5 text-emerald-400 shrink-0" />
            )}
            <div>
              <h3 className="font-bold text-base text-white font-['Chakra_Petch'] tracking-wide flex items-center gap-2">
                <span>
                  {isExporting
                    ? 'EXPORTING VIDEO SEQUENCE'
                    : isCompleted
                    ? 'MASTER VIDEO READY'
                    : 'EXPORT VIDEOS TOGETHER'}
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${activeEngineInfo.pill} font-bold`}
                >
                  {activeEngineInfo.title}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                {isExporting
                  ? 'Recording live canvas stream with audio and broadcast overlays...'
                  : isCompleted
                  ? 'Your exported master video is packaged and ready.'
                  : 'Put all videos together seamlessly into a master highlight MP4.'}
              </p>
            </div>
          </div>
          {(!isExporting || isCompleted) && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* VIEW 1: SETUP & ENGINE SELECTION (Shown before exporting or when configuring) */}
          {!isExporting && !isCompleted && (
            <div className="space-y-4">
              {/* ERROR BANNER IF PREVIOUS ATTEMPT FAILED */}
              {statusMessage && (statusMessage.toLowerCase().includes('error') || statusMessage.toLowerCase().includes('failed') || statusMessage.toLowerCase().includes('stopped')) && (
                <div className="p-3.5 bg-red-950/60 border border-red-500/60 rounded-xl text-red-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-red-300 font-['Chakra_Petch']">Export Notice</p>
                    <p className="text-[11px] text-red-200/90 mt-0.5">{statusMessage}</p>
                  </div>
                </div>
              )}

              {/* BROADCAST HIGHLIGHT OVERLAYS TOGGLE */}
              <div
                onClick={() => setRemoveEffects(!removeEffects)}
                className={`p-4 rounded-xl border transition cursor-pointer select-none flex items-start gap-3.5 ${
                  !removeEffects
                    ? 'bg-emerald-950/40 border-emerald-500/80 text-white shadow-lg shadow-emerald-950/30'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border ${
                    !removeEffects
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'border-slate-700 bg-slate-900 text-transparent'
                  }`}
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm font-['Chakra_Petch'] tracking-wide text-emerald-300 flex items-center gap-2">
                      <span>Include Broadcast Overlays, Scorebugs, Goal Horn & Music</span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/40 font-bold">
                        FULL PRODUCTION
                      </span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {!removeEffects
                      ? 'Renders your custom hockey scorebug, period clock, team logos, goal horn, arena music, player spotlight banners, and transition animations into the master MP4.'
                      : 'Clean raw cut: Strips graphic overlays and audio effects, exporting only the pure video and clip audio.'}
                  </p>
                </div>
              </div>

              {/* LIVE CANVAS ARCHITECTURE CALLOUT */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-start gap-2.5 text-xs text-slate-400">
                <Radio className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 animate-pulse" />
                <p className="text-[11px] leading-relaxed">
                  <strong className="text-white">Live Real-Time Canvas Recorder:</strong> Shows an active visual preview monitor while recording the master MP4 directly in your browser. Eliminates frame-by-frame seeking bottlenecks and prevents black screens, making it 100% reliable for 50+ clips and large projects.
                </p>
              </div>

              {/* 1. EXPORT ENGINE SELECTOR CARDS */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 font-['Chakra_Petch']">
                  Export Engine
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(['realtime', 'webcodecs', 'direct-stitch'] as ExportEngine[]).map((engine) => {
                    const info = getEngineDetails(engine);
                    const isSelected = selectedEngine === engine;
                    const Icon = info.icon;
                    return (
                      <button
                        key={engine}
                        type="button"
                        onClick={() => {
                          setSelectedEngine(engine);
                          if (engine === 'direct-stitch') setRemoveEffects(true);
                          else if (engine === 'webcodecs' || engine === 'realtime') setRemoveEffects(false);
                        }}
                        className={`text-left p-3 rounded-xl border text-xs transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? `${info.bg} ${info.border} text-white shadow-lg shadow-black/40 ring-1 ring-${info.border}`
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-850 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-bold flex items-center gap-1.5 text-white text-[12px] truncate">
                              <Icon className={`w-4 h-4 shrink-0 ${info.color}`} />
                              <span className="truncate">{info.title}</span>
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-snug line-clamp-2">{info.desc}</p>
                        </div>
                        <span className={`mt-2.5 inline-block text-[9px] uppercase font-bold ${info.color} tracking-wider`}>
                          {info.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. RESOLUTION PRESETS */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-['Chakra_Petch']">
                    Video Resolution
                  </label>
                  <span className="text-[11px] text-emerald-400 font-mono">
                    {getProjectedRes(selectedPreset)}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'source', label: 'Source Quality', sub: 'Matches original files' },
                    { id: '1080p', label: '1080p Full HD', sub: 'Crisp broadcast' },
                    { id: '720p', label: '720p HD', sub: 'Fastest merge' },
                    { id: '4k', label: '4K Ultra HD', sub: 'Maximum detail' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedPreset(item.id as ExportQualityPreset)}
                      className={`text-left p-2.5 rounded-xl border text-xs transition cursor-pointer ${
                        selectedPreset === item.id
                          ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-sm'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-850'
                      }`}
                    >
                      <div className="font-bold text-[12px]">{item.label}</div>
                      <div className="text-[10px] text-slate-400">{item.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. FRAMERATE SELECTION */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 font-['Chakra_Petch']">
                  Output Frame Rate
                </label>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedFps(30)}
                    className={`flex-1 p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      selectedFps === 30
                        ? 'bg-emerald-500/20 border-emerald-500 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-850'
                    }`}
                  >
                    30 FPS (Standard Broadcast • Maximum Stability)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFps(60)}
                    className={`flex-1 p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      selectedFps === 60
                        ? 'bg-emerald-500/20 border-emerald-500 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-850'
                    }`}
                  >
                    60 FPS (Ultra Smooth Motion)
                  </button>
                </div>
              </div>

              {/* START EXPORT BUTTON */}
              <div className="pt-2">
                <button
                  id="start-export-modal-btn"
                  type="button"
                  onClick={() => handleStart()}
                  className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white py-3.5 rounded-xl text-sm font-bold uppercase tracking-wider transition font-['Chakra_Petch'] shadow-lg shadow-emerald-950/50 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>
                    Export Highlight Video (MP4) • {clips.length > 1 ? `${clips.length} Clips` : '1 Clip'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* VIEW 2: ACTIVE EXPORT IN PROGRESS WITH LIVE PREVIEW */}
          {isExporting && (
            <div className="space-y-4 py-1">
              {/* LIVE BROADCAST PREVIEW MONITOR & CANVAS RECORDER */}
              <div
                className="relative w-full bg-black rounded-2xl overflow-hidden border border-slate-700/80 shadow-2xl flex items-center justify-center select-none"
                style={{
                  aspectRatio:
                    aspectRatio === '9:16'
                      ? '9 / 16'
                      : aspectRatio === '1:1'
                      ? '1 / 1'
                      : '16 / 9',
                  maxHeight: aspectRatio === '9:16' ? '380px' : '300px',
                }}
              >
                {/* Hardware-rendered live preview canvas */}
                <canvas
                  id="export-live-preview-canvas"
                  className="w-full h-full object-contain"
                />

                {/* Top Overlay Bar */}
                <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-auto">
                  {/* LIVE RECORDING BADGE */}
                  <div className="flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-3 py-1 rounded-lg border border-red-500/50 shadow-lg">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                    <span className="text-[11px] font-black uppercase tracking-wider text-red-300 font-['Chakra_Petch']">
                      REC • LIVE PREVIEW
                    </span>
                  </div>

                  {/* LIVE AUDIO MONITOR TOGGLE */}
                  <button
                    type="button"
                    onClick={toggleLiveAudio}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition border cursor-pointer backdrop-blur-md shadow-lg ${
                      !isLiveAudioMuted
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black'
                        : 'bg-slate-950/85 text-slate-300 border-slate-700 hover:text-white hover:border-slate-500'
                    }`}
                    title={
                      !isLiveAudioMuted
                        ? 'Mute live audio monitor'
                        : 'Unmute audio monitor to listen live while recording'
                    }
                  >
                    {!isLiveAudioMuted ? (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-slate-950" />
                        <span>Live Audio ON</span>
                      </>
                    ) : (
                      <>
                        <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                        <span>Audio Muted</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Bottom HUD Overlay */}
                <div className="absolute bottom-2 left-2 right-2 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono shadow-xl pointer-events-auto">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-emerald-400 font-bold font-['Chakra_Petch'] text-xs shrink-0">
                      {liveStats
                        ? `Clip ${liveStats.clipIndex + 1} of ${liveStats.totalClips}`
                        : `Recording sequence...`}
                    </span>
                    {liveStats?.clipName && (
                      <span className="text-slate-400 text-[11px] truncate max-w-[180px]">
                        • {liveStats.clipName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-slate-200 font-mono text-xs font-bold">
                      {liveStats
                        ? `${formatExportTime(liveStats.currentTime)} / ${formatExportTime(liveStats.totalDuration)}`
                        : `${progressPercent}%`}
                    </span>
                    <span className="text-[10px] font-bold text-sky-400 bg-sky-950/80 border border-sky-500/30 px-1.5 py-0.5 rounded font-['Chakra_Petch']">
                      {exportOptions.fps || 30} FPS
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress and status text */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-['Chakra_Petch']">
                  <span className="font-bold text-white tracking-wide truncate max-w-sm text-left">
                    {statusMessage || 'Recording canvas frames live...'}
                  </span>
                  <span className="font-black text-emerald-400 font-mono text-sm">
                    {progressPercent}%
                  </span>
                </div>

                {/* Animated Gradient Progress Bar */}
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-500 h-full transition-all duration-200 shadow-sm shadow-emerald-500/50"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
              </div>

              {/* Live Specs */}
              <div className="grid grid-cols-3 gap-2 pt-1 text-left">
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5">
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Engine</div>
                  <div className={`text-xs font-bold ${activeEngineInfo.color} font-['Chakra_Petch'] truncate`}>
                    {activeEngineInfo.title}
                  </div>
                </div>
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5">
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Framerate</div>
                  <div className="text-xs font-bold text-emerald-400 font-['Chakra_Petch']">
                    {exportOptions.fps || 30} FPS
                  </div>
                </div>
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5">
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Resolution</div>
                  <div className="text-xs font-bold text-sky-400 font-['Chakra_Petch'] truncate">
                    {getProjectedRes(exportOptions.qualityPreset || 'source')}
                  </div>
                </div>
              </div>

              {/* Cancel Button */}
              {onCancelExport && (
                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={onCancelExport}
                    className="text-xs text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-900/60 bg-slate-950/60 px-4 py-2 rounded-xl transition cursor-pointer"
                  >
                    Cancel Export
                  </button>
                </div>
              )}
            </div>
          )}

          {/* VIEW 3: COMPLETED OUTPUT PREVIEW & DOWNLOAD */}
          {isCompleted && (
            <div className="space-y-4">
              {/* Preview Player to verify smooth playback */}
              {downloadUrl && (
                <div
                  className="rounded-xl overflow-hidden bg-black max-h-56 mx-auto border border-slate-800 shadow-inner flex items-center justify-center"
                  style={{
                    aspectRatio: aspectRatio === '9:16' ? '9 / 16' : aspectRatio === '1:1' ? '1 / 1' : '16 / 9',
                    height: '100%',
                    maxHeight: '220px',
                    width: 'auto',
                    maxWidth: '100%',
                  }}
                >
                  <video
                    src={downloadUrl}
                    controls
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-xl p-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Master video packaged successfully! Size:{' '}
                    <strong>{exportedBlob ? (exportedBlob.size / (1024 * 1024)).toFixed(1) : 0} MB</strong>
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                  {exportedBlob?.type?.includes('webm') ? 'WebM VP9 • 100% Fluid' : 'MP4 H.264 • 100% Fluid'}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <a
                  href={downloadUrl}
                  download={exportedBlob?.type?.includes('webm') ? 'hockey_highlights_master.webm' : 'hockey_highlights_master.mp4'}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition font-['Chakra_Petch'] shadow-lg shadow-emerald-950/40 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Download Highlight Video ({exportedBlob?.type?.includes('webm') ? 'WebM' : 'MP4'})
                </a>

                <button
                  type="button"
                  onClick={onProceedToYouTube}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition font-['Chakra_Petch'] shadow-lg shadow-red-950/40 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  Upload to YouTube
                </button>
              </div>

              {/* Re-render button */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    handleStart();
                  }}
                  className="text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1.5 mx-auto transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Re-stitch with different settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
