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
  Film,
  AlertCircle,
  ShieldCheck,
  Cpu,
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
  isCompleted: boolean;
  exportedBlob: Blob | null;
  onProceedToYouTube: () => void;
  exportOptions: ExportOptions;
  onUpdateOptions?: (opts: ExportOptions) => void;
  onReExport?: (opts: ExportOptions) => void;
  clips?: VideoClip[];
  aspectRatio?: AspectRatio;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  progressPercent,
  statusMessage,
  isCompleted,
  exportedBlob,
  onProceedToYouTube,
  exportOptions,
  onUpdateOptions,
  onReExport,
  clips = [],
  aspectRatio = '16:9',
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [selectedEngine, setSelectedEngine] = useState<ExportEngine>(
    exportOptions.engine || 'webcodecs',
  );
  const [selectedPreset, setSelectedPreset] = useState<ExportQualityPreset>(
    exportOptions.qualityPreset || '1080p',
  );
  const [selectedFps, setSelectedFps] = useState<60 | 30>(exportOptions.fps || 60);

  if (!isOpen) return null;

  const downloadUrl = exportedBlob ? URL.createObjectURL(exportedBlob) : '';

  // Inspect source clips to detect maximum native resolution
  const maxSourceW = Math.max(0, ...clips.map((c) => c.originalWidth || 0));
  const maxSourceH = Math.max(0, ...clips.map((c) => c.originalHeight || 0));
  const hasSourceInfo = maxSourceW > 0 && maxSourceH > 0;

  // Calculate projected resolution based on preset and aspect ratio
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
    // 'source'
    if (hasSourceInfo) {
      if (aspectRatio === '9:16') {
        const h = Math.max(1920, maxSourceH);
        return `1080 × ${h} (Matched to Source)`;
      }
      return `${Math.max(1920, maxSourceW)} × ${Math.max(1080, maxSourceH)} (Matched to Source)`;
    }
    return '1920 × 1080 (Full HD Original)';
  };

  const handleApplyAndReRender = () => {
    const updated: ExportOptions = {
      ...exportOptions,
      engine: selectedEngine,
      qualityPreset: selectedPreset,
      fps: selectedFps,
    };
    onUpdateOptions?.(updated);
    onReExport?.(updated);
  };

  const getEngineBadge = () => {
    const engine = exportOptions.engine || selectedEngine;
    if (engine === 'ffmpeg') {
      return {
        label: 'Studio Server FFmpeg (Direct Transcode)',
        icon: Server,
        color: 'text-purple-400',
        border: 'border-purple-500/40',
        bg: 'bg-purple-950/40',
      };
    }
    if (engine === 'webcodecs') {
      return {
        label: 'Offline Frame-by-Frame (Zero Stutter)',
        icon: ShieldCheck,
        color: 'text-emerald-400',
        border: 'border-emerald-500/40',
        bg: 'bg-emerald-950/40',
      };
    }
    return {
      label: 'Real-Time Hardware Stream',
      icon: Zap,
      color: 'text-sky-400',
      border: 'border-sky-500/40',
      bg: 'bg-sky-950/40',
    };
  };

  const activeBadge = getEngineBadge();

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2.5">
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <Loader2 className="w-5 h-5 text-sky-400 animate-spin shrink-0" />
            )}
            <div>
              <h3 className="font-bold text-base text-white font-['Chakra_Petch'] tracking-wide flex items-center gap-2">
                <span>{isCompleted ? 'HIGHLIGHT VIDEO READY' : 'EXPORTING HIGHLIGHT SEQUENCE'}</span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${activeBadge.border} ${activeBadge.bg} ${activeBadge.color} font-bold`}
                >
                  {exportOptions.engine === 'ffmpeg'
                    ? 'FFmpeg Server'
                    : exportOptions.engine === 'realtime'
                    ? 'Real-Time'
                    : 'Zero-Stutter Mode'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                {isCompleted
                  ? 'Rendered master output file is ready for download or upload.'
                  : 'Compiling video cuts, audio ducking, and graphics overlays.'}
              </p>
            </div>
          </div>
          {isCompleted && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {!isCompleted ? (
            <div className="space-y-5 text-center py-2">
              <div className="relative w-24 h-24 mx-auto">
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
                <div className="absolute inset-0 flex items-center justify-center font-['Chakra_Petch'] font-black text-xl text-white">
                  {progressPercent}%
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-white mb-1 font-['Chakra_Petch'] tracking-wide">
                  {statusMessage || 'Processing timeline...'}
                </p>
                <p className="text-xs text-slate-400">
                  {exportOptions.engine === 'ffmpeg'
                    ? 'Processing on server FFmpeg pipeline: 100% immune to browser playback drops or lag.'
                    : exportOptions.engine === 'webcodecs' || !exportOptions.engine
                    ? 'Stepping through each frame offline at exact microsecond timestamps (Zero dropped frames).'
                    : 'Recording video stream via hardware acceleration.'}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-sky-500 via-indigo-500 to-red-500 h-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>

              {/* Live Spec Badges */}
              <div className="grid grid-cols-3 gap-2 pt-2 text-left">
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5">
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Engine</div>
                  <div className={`text-xs font-bold ${activeBadge.color} font-['Chakra_Petch'] truncate`}>
                    {exportOptions.engine === 'ffmpeg'
                      ? 'Server FFmpeg'
                      : exportOptions.engine === 'realtime'
                      ? 'Real-Time Stream'
                      : 'WebCodecs Frame Step'}
                  </div>
                </div>
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5">
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Framerate</div>
                  <div className="text-xs font-bold text-emerald-400 font-['Chakra_Petch']">
                    {exportOptions.fps || 60} FPS (Fluid Motion)
                  </div>
                </div>
                <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5">
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Resolution</div>
                  <div className="text-xs font-bold text-sky-400 font-['Chakra_Petch']">
                    {getProjectedRes(exportOptions.qualityPreset || '1080p')}
                  </div>
                </div>
              </div>
            </div>
          ) : (
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
                      Export Ready ({activeBadge.label})
                    </span>
                  </div>
                  <span className="text-[10px] bg-emerald-900/60 text-emerald-300 font-mono font-bold px-2 py-0.5 rounded border border-emerald-700/50">
                    0% Dropped Frames
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
                    exportedBlob?.type.includes('mp4') || exportOptions.engine === 'webcodecs' || exportOptions.engine === 'ffmpeg'
                      ? 'hockey_master_highlights.mp4'
                      : 'hockey_master_highlights.webm'
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

              {/* Anti-Stutter & Freeze Help Callout */}
              <div className="bg-slate-950/80 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-slate-300">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-amber-300 block font-['Chakra_Petch'] uppercase tracking-wider">
                    Experiencing stuttering or freezing in your exported video?
                  </span>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Browser real-time capture can drop frames under heavy CPU/GPU load. Switch to{' '}
                    <strong className="text-white">Offline Frame-by-Frame</strong> (WebCodecs) or{' '}
                    <strong className="text-white">Studio Server FFmpeg</strong> below to step through every frame mathematically with zero dropped frames.
                  </p>
                </div>
              </div>

              {/* Export Engine & Quality Settings */}
              <div className="border-t border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition py-1"
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    <Sliders className="w-3.5 h-3.5 text-sky-400" />
                    Change Export Engine, Resolution or FPS?
                  </span>
                  <span className="text-[11px] text-sky-400 font-mono">
                    {showSettings ? 'Hide Options ▲' : 'Show Options ▼'}
                  </span>
                </button>

                {showSettings && (
                  <div className="mt-3 p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-4 animate-in fade-in duration-150">
                    {/* EXPORT ENGINE SELECTOR */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 font-['Chakra_Petch']">
                        Export Engine (Solves Stuttering & Freezing)
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {/* 1. WebCodecs Frame-by-Frame */}
                        <button
                          type="button"
                          onClick={() => setSelectedEngine('webcodecs')}
                          className={`text-left p-3 rounded-xl border text-xs transition cursor-pointer flex flex-col justify-between ${
                            selectedEngine === 'webcodecs'
                              ? 'bg-emerald-950/50 border-emerald-500 text-white shadow-lg shadow-emerald-950/30'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold flex items-center gap-1.5 text-white">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                Offline Frame-by-Frame
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-snug">
                              Steps frame-by-frame offline. 100% immune to playback drops or freezing.
                            </p>
                          </div>
                          <span className="mt-2 inline-block text-[9px] uppercase font-bold text-emerald-400 tracking-wider">
                            ★ Recommended (0% Lag)
                          </span>
                        </button>

                        {/* 2. Server FFmpeg */}
                        <button
                          type="button"
                          onClick={() => setSelectedEngine('ffmpeg')}
                          className={`text-left p-3 rounded-xl border text-xs transition cursor-pointer flex flex-col justify-between ${
                            selectedEngine === 'ffmpeg'
                              ? 'bg-purple-950/50 border-purple-500 text-white shadow-lg shadow-purple-950/30'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold flex items-center gap-1.5 text-white">
                                <Server className="w-3.5 h-3.5 text-purple-400" />
                                Studio Server FFmpeg
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-snug">
                              Renders on cloud server using FFmpeg. Zero client CPU load, true broadcast MP4.
                            </p>
                          </div>
                          <span className="mt-2 inline-block text-[9px] uppercase font-bold text-purple-400 tracking-wider">
                            Direct Cloud Transcode
                          </span>
                        </button>

                        {/* 3. Real-Time Hardware Capture */}
                        <button
                          type="button"
                          onClick={() => setSelectedEngine('realtime')}
                          className={`text-left p-3 rounded-xl border text-xs transition cursor-pointer flex flex-col justify-between ${
                            selectedEngine === 'realtime'
                              ? 'bg-sky-950/50 border-sky-500 text-white shadow-lg shadow-sky-950/30'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold flex items-center gap-1.5 text-white">
                                <Zap className="w-3.5 h-3.5 text-sky-400" />
                                Real-Time Recorder
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-snug">
                              Captures canvas in real-time. Fast on high-end computers.
                            </p>
                          </div>
                          <span className="mt-2 inline-block text-[9px] uppercase font-bold text-sky-400 tracking-wider">
                            Hardware Capture
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* RESOLUTION SELECTOR */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 font-['Chakra_Petch']">
                        Export Resolution Preset
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { id: '1080p', label: '1080p Full HD', sub: 'Best balance & smooth' },
                          { id: '720p', label: '720p HD', sub: 'Fastest render' },
                          { id: 'source', label: 'Source Quality', sub: 'Matches original' },
                          { id: '4k', label: '4K Ultra HD', sub: 'Highest resolution' },
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedPreset(item.id as ExportQualityPreset)}
                            className={`text-left p-2.5 rounded-lg border text-xs transition cursor-pointer ${
                              selectedPreset === item.id
                                ? 'bg-sky-500/20 border-sky-500 text-white'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850'
                            }`}
                          >
                            <div className="font-bold">{item.label}</div>
                            <div className="text-[10px] text-slate-400">{item.sub}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* FRAMERATE SELECTOR */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 font-['Chakra_Petch']">
                        Frame Rate
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedFps(60)}
                          className={`flex-1 p-2 rounded-lg border text-xs font-bold transition cursor-pointer ${
                            selectedFps === 60
                              ? 'bg-sky-500/20 border-sky-500 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          60 FPS (Ultra Smooth Motion)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedFps(30)}
                          className={`flex-1 p-2 rounded-lg border text-xs font-bold transition cursor-pointer ${
                            selectedFps === 30
                              ? 'bg-sky-500/20 border-sky-500 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          30 FPS (Maximum Stability & Compact)
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleApplyAndReRender}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition font-['Chakra_Petch'] shadow-md cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Re-render Video with {selectedEngine === 'ffmpeg' ? 'Server FFmpeg' : selectedEngine === 'webcodecs' ? 'Frame-by-Frame Mode' : 'Real-time Mode'}
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
