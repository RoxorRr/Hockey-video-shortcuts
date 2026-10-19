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
} from 'lucide-react';
import {
  AspectRatio,
  ExportEngine,
  ExportOptions,
  ExportQualityPreset,
  VideoClip,
} from '../types';

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
}) => {
  const [selectedEngine, setSelectedEngine] = useState<ExportEngine>(
    exportOptions.engine || 'direct-stitch',
  );
  const [removeEffects, setRemoveEffects] = useState<boolean>(
    exportOptions.removeEffectsAndTransitions !== false,
  );
  const [selectedPreset, setSelectedPreset] = useState<ExportQualityPreset>(
    exportOptions.qualityPreset || 'source',
  );
  const [selectedFps, setSelectedFps] = useState<60 | 30>(exportOptions.fps || 30);
  const [showAdvancedAccordion, setShowAdvancedAccordion] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string>('');

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
    if (engine === 'direct-stitch') {
      return {
        title: 'Direct Original Stitch',
        badge: 'RECOMMENDED • ZERO STUTTER',
        desc: 'Stitches all video clips directly into one master file. Strips effects and transitions for 100% smooth, stutter-free original playback.',
        icon: Film,
        color: 'text-emerald-400',
        border: 'border-emerald-500',
        bg: 'bg-emerald-950/40',
        pill: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      };
    }
    if (engine === 'ffmpeg') {
      return {
        title: 'Studio Server FFmpeg',
        badge: 'SERVER TRANSCODE',
        desc: 'Processes in cloud server via native FFmpeg with custom overlays and audio normalizer.',
        icon: Server,
        color: 'text-purple-400',
        border: 'border-purple-500',
        bg: 'bg-purple-950/40',
        pill: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      };
    }
    if (engine === 'realtime') {
      return {
        title: 'Real-Time Stream',
        badge: 'HARDWARE ACCELERATED',
        desc: 'Direct canvas recording stream in your browser. Fast on computers with dedicated graphics cards.',
        icon: Zap,
        color: 'text-sky-400',
        border: 'border-sky-500',
        bg: 'bg-sky-950/40',
        pill: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
      };
    }
    return {
      title: 'Offline Frame Stepper',
      badge: 'BROWSER CODECS',
      desc: 'In-browser frame decoder. Encodes MP4 locally using WebCodecs.',
      icon: ShieldCheck,
      color: 'text-cyan-400',
      border: 'border-cyan-500',
      bg: 'bg-cyan-950/40',
      pill: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
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
                  ? 'Stitching clips together directly with zero frame drops...'
                  : isCompleted
                  ? 'Your exported master video is packaged and ready.'
                  : 'Put all videos together seamlessly like original file.'}
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

              {/* PRIMARY ZERO-STUTTER TOGGLE BANNER */}
              <div
                onClick={() => setRemoveEffects(!removeEffects)}
                className={`p-4 rounded-xl border transition cursor-pointer select-none flex items-start gap-3.5 ${
                  removeEffects
                    ? 'bg-emerald-950/40 border-emerald-500/80 text-white shadow-lg shadow-emerald-950/30'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border ${
                    removeEffects
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : 'border-slate-700 bg-slate-900 text-transparent'
                  }`}
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm font-['Chakra_Petch'] tracking-wide text-emerald-300 flex items-center gap-2">
                      <span>Remove all effects & transitions (Put all videos together like original file)</span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/40 font-bold">
                        100% SMOOTH
                      </span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Strips all scorebugs, period timers, graphic overlays, and transition animations. Concatenates the original video and audio streams seamlessly with zero stuttering, zero freezing, and 100% original video clarity.
                  </p>
                </div>
              </div>

              {/* WHY STUTTER ADVISORY CALLOUT */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-start gap-2.5 text-xs text-slate-400">
                <AlertCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong className="text-white">Why did videos stutter mid-timeline (e.g. minute 2 to 3)?</strong> Unaligned audio/video packet timestamps and variable frame rates cause video players to buffer and stall across clip boundaries. The new engine enforces <strong className="text-emerald-300">strictly monotonic frame presentation timestamps (PTS)</strong>, <strong className="text-emerald-300">resampled 48kHz stereo sync</strong>, and <strong className="text-emerald-300">millisecond-exact stream padding</strong> — or lossless bitstream copy when clips match — guaranteeing 100% fluid playback with zero freezes.
                </p>
              </div>

              {/* 1. EXPORT ENGINE SELECTOR CARDS */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 font-['Chakra_Petch']">
                  Export Engine
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(['direct-stitch', 'ffmpeg'] as ExportEngine[]).map((engine) => {
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
                        }}
                        className={`text-left p-3.5 rounded-xl border text-xs transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? `${info.bg} ${info.border} text-white shadow-lg shadow-black/40 ring-1 ring-${info.border}`
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-850 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-bold flex items-center gap-1.5 text-white text-[13px]">
                              <Icon className={`w-4 h-4 ${info.color}`} />
                              {info.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-snug">{info.desc}</p>
                        </div>
                        <span className={`mt-3 inline-block text-[9px] uppercase font-bold ${info.color} tracking-wider`}>
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
                    30 FPS (Standard Original • Maximum Stability)
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
                    Put All {clips.length > 1 ? `${clips.length} Videos` : 'Video'} Together & Export (Zero Stutter)
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* VIEW 2: ACTIVE EXPORT IN PROGRESS */}
          {isExporting && (
            <div className="space-y-5 text-center py-4">
              <div className="relative w-28 h-28 mx-auto">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-800"
                    strokeWidth="3"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-emerald-500 transition-all duration-300 stroke-current"
                    strokeDasharray={`${progressPercent}, 100`}
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-['Chakra_Petch'] font-black text-2xl text-white">
                  {progressPercent}%
                </div>
              </div>

              <div>
                <p className="text-sm font-bold text-white mb-1.5 font-['Chakra_Petch'] tracking-wide">
                  {statusMessage || 'Stitching video files together...'}
                </p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {removeEffects
                    ? 'Direct original concatenation: Zero effects, zero transitions, 100% smooth playback.'
                    : 'Applying FFmpeg transcode pipeline.'}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 h-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>

              {/* Live Specs */}
              <div className="grid grid-cols-3 gap-2.5 pt-2 text-left">
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
                <div className="pt-2">
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
                  MP4 H.264 • 100% Smooth
                </span>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <a
                  href={downloadUrl}
                  download="stitched_original_video.mp4"
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition font-['Chakra_Petch'] shadow-lg shadow-emerald-950/40 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Download Stitched Video (MP4)
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
