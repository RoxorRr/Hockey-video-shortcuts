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
  clips = [],
  aspectRatio = '16:9',
}) => {
  const [selectedEngine, setSelectedEngine] = useState<ExportEngine>(
    exportOptions.engine || 'ffmpeg',
  );
  const [selectedPreset, setSelectedPreset] = useState<ExportQualityPreset>(
    exportOptions.qualityPreset || '1080p',
  );
  const [selectedFps, setSelectedFps] = useState<60 | 30>(exportOptions.fps || 60);
  const [showSettingsAccordion, setShowSettingsAccordion] = useState(false);

  if (!isOpen) return null;

  const downloadUrl = exportedBlob ? URL.createObjectURL(exportedBlob) : '';

  // Calculate projected resolution
  const getProjectedRes = (preset: ExportQualityPreset) => {
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
    };
    onUpdateOptions(updated);
    onStartExport(updated);
  };

  const getEngineDetails = (engine: ExportEngine) => {
    if (engine === 'ffmpeg') {
      return {
        title: 'Studio Server FFmpeg',
        badge: 'RECOMMENDED • FASTEST',
        desc: 'Processes in cloud server via native FFmpeg. 100% stutter-free, zero browser lag, finishes in seconds.',
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
      title: 'Offline Frame-by-Frame',
      badge: 'OFFLINE STEPPING',
      desc: 'Steps through each frame mathematically with backpressure. Completely decoupled from playback speed.',
      icon: ShieldCheck,
      color: 'text-emerald-400',
      border: 'border-emerald-500',
      bg: 'bg-emerald-950/40',
      pill: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    };
  };

  const activeEngineInfo = getEngineDetails(exportOptions.engine || selectedEngine);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            {isExporting ? (
              <Loader2 className="w-5 h-5 text-sky-400 animate-spin shrink-0" />
            ) : isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <Sliders className="w-5 h-5 text-sky-400 shrink-0" />
            )}
            <div>
              <h3 className="font-bold text-base text-white font-['Chakra_Petch'] tracking-wide flex items-center gap-2">
                <span>
                  {isExporting
                    ? 'EXPORTING HIGHLIGHT SEQUENCE'
                    : isCompleted
                    ? 'HIGHLIGHT VIDEO MASTER READY'
                    : 'SELECT VIDEO EXPORT MODE'}
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${activeEngineInfo.pill} font-bold`}
                >
                  {activeEngineInfo.title}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                {isExporting
                  ? 'Compiling video cuts, audio transitions, and graphics overlays...'
                  : isCompleted
                  ? 'Your exported master video is packaged and ready.'
                  : 'Choose the export engine that best matches your device.'}
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
            <div className="space-y-5">
              {/* STUTTER ADVISORY CALLOUT */}
              <div className="bg-slate-950 border border-purple-500/40 rounded-xl p-3.5 flex items-start gap-3 text-xs text-slate-300">
                <AlertCircle className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-purple-300 block font-['Chakra_Petch'] uppercase tracking-wider text-[12px]">
                    Experiencing stuttering or freezing in exported videos?
                  </span>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Browser video decoders can freeze when handling high-bitrate clips. Select{' '}
                    <strong className="text-white">Studio Server FFmpeg</strong> below to process on the server with{' '}
                    <strong className="text-emerald-300">100% smooth playback</strong> and zero client CPU load!
                  </p>
                </div>
              </div>

              {/* 1. EXPORT ENGINE SELECTOR CARDS */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 font-['Chakra_Petch']">
                  Choose Export Engine
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(['ffmpeg', 'realtime', 'webcodecs'] as ExportEngine[]).map((engine) => {
                    const info = getEngineDetails(engine);
                    const isSelected = selectedEngine === engine;
                    const Icon = info.icon;
                    return (
                      <button
                        key={engine}
                        type="button"
                        onClick={() => setSelectedEngine(engine)}
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
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 font-['Chakra_Petch']">
                  Export Resolution Preset
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: '1080p', label: '1080p Full HD', sub: 'Recommended' },
                    { id: '720p', label: '720p HD', sub: 'Fastest render' },
                    { id: 'source', label: 'Source Quality', sub: 'Matches clips' },
                    { id: '4k', label: '4K Ultra HD', sub: 'High resolution' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedPreset(item.id as ExportQualityPreset)}
                      className={`text-left p-2.5 rounded-xl border text-xs transition cursor-pointer ${
                        selectedPreset === item.id
                          ? 'bg-sky-500/20 border-sky-500 text-white shadow-sm'
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
                  Frame Rate
                </label>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedFps(60)}
                    className={`flex-1 p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      selectedFps === 60
                        ? 'bg-sky-500/20 border-sky-500 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-850'
                    }`}
                  >
                    60 FPS (Ultra Smooth Motion)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFps(30)}
                    className={`flex-1 p-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                      selectedFps === 30
                        ? 'bg-sky-500/20 border-sky-500 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-850'
                    }`}
                  >
                    30 FPS (Maximum Stability & Compact)
                  </button>
                </div>
              </div>

              {/* START EXPORT BUTTON */}
              <div className="pt-2">
                <button
                  id="start-export-modal-btn"
                  type="button"
                  onClick={() => handleStart()}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sky-600 via-indigo-600 to-purple-600 hover:from-sky-500 hover:to-purple-500 text-white py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition font-['Chakra_Petch'] shadow-lg shadow-indigo-950/50 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  Start Export with {getEngineDetails(selectedEngine).title}
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
                    className="text-sky-500 transition-all duration-300 stroke-current"
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
                  {statusMessage || 'Rendering video highlights...'}
                </p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {exportOptions.engine === 'ffmpeg'
                    ? 'Processing on Studio Server FFmpeg transcode pipeline (Zero stutter).'
                    : exportOptions.engine === 'webcodecs'
                    ? 'Stepping through each frame offline at exact timestamps with backpressure.'
                    : 'Recording video stream via hardware acceleration.'}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 h-full transition-all duration-300"
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
                    {exportOptions.fps || 60} FPS
                  </div>
                </div>
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5">
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Resolution</div>
                  <div className="text-xs font-bold text-sky-400 font-['Chakra_Petch'] truncate">
                    {getProjectedRes(exportOptions.qualityPreset || '1080p')}
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
                    Cancel Export & Choose Different Mode
                  </button>
                </div>
              )}
            </div>
          )}

          {/* VIEW 3: COMPLETED OUTPUT PREVIEW & DOWNLOAD */}
          {isCompleted && (
            <div className="space-y-4">
              {/* Preview Player */}
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

              {/* Quality & Specifications Confirmation Banner */}
              <div className="bg-emerald-950/40 border border-emerald-700/60 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-xs font-bold text-emerald-200 uppercase tracking-wider font-['Chakra_Petch']">
                      Export Ready ({activeEngineInfo.title})
                    </span>
                  </div>
                  <span className="text-[10px] bg-emerald-900/60 text-emerald-300 font-mono font-bold px-2 py-0.5 rounded border border-emerald-700/50">
                    Master MP4
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-emerald-900/30 rounded p-1.5 border border-emerald-800/40">
                    <span className="text-[10px] text-emerald-400 block font-semibold">RESOLUTION</span>
                    <span className="font-bold text-white font-['Chakra_Petch']">
                      {getProjectedRes(exportOptions.qualityPreset || '1080p')}
                    </span>
                  </div>
                  <div className="bg-emerald-900/30 rounded p-1.5 border border-emerald-800/40">
                    <span className="text-[10px] text-emerald-400 block font-semibold">FRAMERATE</span>
                    <span className="font-bold text-white font-['Chakra_Petch']">{exportOptions.fps || 60} FPS</span>
                  </div>
                  <div className="bg-emerald-900/30 rounded p-1.5 border border-emerald-800/40">
                    <span className="text-[10px] text-emerald-400 block font-semibold">FILE SIZE</span>
                    <span className="font-bold text-white font-['Chakra_Petch']">
                      {exportedBlob ? (exportedBlob.size / (1024 * 1024)).toFixed(1) : '0'} MB
                    </span>
                  </div>
                  <div className="bg-emerald-900/30 rounded p-1.5 border border-emerald-800/40">
                    <span className="text-[10px] text-emerald-400 block font-semibold">AUDIO TRACK</span>
                    <span className="font-bold text-white font-['Chakra_Petch']">256 kbps Stereo</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <a
                  href={downloadUrl}
                  download={
                    exportedBlob?.type.includes('webm') ? 'hockey_master_highlights.webm' : 'hockey_master_highlights.mp4'
                  }
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition border border-slate-700 shadow"
                >
                  <Download className="w-4 h-4 text-sky-400" />
                  Download Master Video
                </a>

                <button
                  id="export-to-youtube-btn"
                  onClick={() => {
                    onClose();
                    onProceedToYouTube();
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-lg shadow-red-950/50 font-['Chakra_Petch'] cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  Upload to YouTube
                </button>
              </div>

              {/* Re-export with another mode toggle */}
              <div className="border-t border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => setShowSettingsAccordion(!showSettingsAccordion)}
                  className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition py-1"
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                    Re-render with different mode, resolution or framerate?
                  </span>
                  <span className="text-[11px] text-sky-400 font-mono">
                    {showSettingsAccordion ? 'Hide ▲' : 'Change Mode ▼'}
                  </span>
                </button>

                {showSettingsAccordion && (
                  <div className="mt-3 p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-4 animate-in fade-in duration-150">
                    {/* ENGINE PICKER */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 font-['Chakra_Petch']">
                        Select Mode
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {(['ffmpeg', 'realtime', 'webcodecs'] as ExportEngine[]).map((eng) => {
                          const info = getEngineDetails(eng);
                          return (
                            <button
                              key={eng}
                              type="button"
                              onClick={() => setSelectedEngine(eng)}
                              className={`text-left p-2.5 rounded-lg border text-xs transition cursor-pointer ${
                                selectedEngine === eng
                                  ? `${info.bg} ${info.border} text-white`
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850'
                              }`}
                            >
                              <div className="font-bold">{info.title}</div>
                              <div className="text-[10px] text-slate-400">{info.badge}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* RE-RENDER BUTTON */}
                    <button
                      type="button"
                      onClick={() => handleStart()}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition font-['Chakra_Petch'] shadow cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Re-render Highlights with {getEngineDetails(selectedEngine).title}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
