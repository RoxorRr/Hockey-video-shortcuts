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
  Video,
  ShieldCheck,
  AlertTriangle,
  FolderDown,
  Film,
} from 'lucide-react';
import { AspectRatio, ExportOptions, ExportQualityPreset, VideoClip } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  progressPercent: number;
  statusMessage: string;
  isCompleted: boolean;
  isRendering?: boolean;
  exportedBlob: Blob | null;
  onProceedToYouTube: (targetBlob?: Blob) => void;
  exportOptions: ExportOptions;
  onUpdateOptions?: (opts: ExportOptions) => void;
  onReExport?: (opts: ExportOptions) => void;
  onDownloadOriginal?: (clip?: VideoClip) => void;
  onConnectAndExport?: () => void;
  onCancelRender?: () => void;
  clips?: VideoClip[];
  aspectRatio?: AspectRatio;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  progressPercent,
  statusMessage,
  isCompleted,
  isRendering = false,
  exportedBlob,
  onProceedToYouTube,
  exportOptions,
  onUpdateOptions,
  onReExport,
  onDownloadOriginal,
  onConnectAndExport,
  onCancelRender,
  clips = [],
  aspectRatio = '16:9',
}) => {
  const [showRenderOptions, setShowRenderOptions] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<ExportQualityPreset>(exportOptions.qualityPreset || 'source');
  const [selectedFps, setSelectedFps] = useState<60 | 30>(exportOptions.fps || 60);

  if (!isOpen) return null;

  // Active clip & merged preview
  const primaryClip = clips[0];
  const primaryBlob = primaryClip?.blob;
  const primaryUrl = primaryClip?.url || (primaryBlob ? URL.createObjectURL(primaryBlob) : '');
  const mergedBlobUrl = exportedBlob ? URL.createObjectURL(exportedBlob) : '';
  const effectivePreviewUrl = mergedBlobUrl || (clips.length === 1 ? primaryUrl : '');

  // Calculate file sizes
  const totalSourceSizeBytes = clips.reduce((acc, c) => acc + (c.blob?.size || 0), 0);
  const totalSourceSizeMB = (totalSourceSizeBytes / (1024 * 1024)).toFixed(1);
  const finalSizeMB = exportedBlob
    ? (exportedBlob.size / (1024 * 1024)).toFixed(1)
    : totalSourceSizeMB;

  // Inspect source clips to detect maximum native resolution
  const maxSourceW = Math.max(0, ...clips.map((c) => c.originalWidth || 0));
  const maxSourceH = Math.max(0, ...clips.map((c) => c.originalHeight || 0));
  const hasSourceInfo = maxSourceW > 0 && maxSourceH > 0;
  const nativeResolutionDisplay = hasSourceInfo
    ? `${maxSourceW} × ${maxSourceH} (Native Camera)`
    : '1080p Full HD (Native)';

  const handleStartRender = () => {
    const updated: ExportOptions = {
      ...exportOptions,
      qualityPreset: selectedPreset,
      fps: selectedFps,
    };
    onUpdateOptions?.(updated);
    onReExport?.(updated);
  };

  const handleDownloadSingle = (clip: VideoClip) => {
    if (onDownloadOriginal) {
      onDownloadOriginal(clip);
      return;
    }

    const filename = clip.name.includes('.')
      ? clip.name
      : `${clip.name}.${clip.blob?.type?.includes('webm') ? 'webm' : 'mp4'}`;

    if (clip.blob) {
      const url = URL.createObjectURL(clip.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } else if (clip.url) {
      const a = document.createElement('a');
      a.href = clip.url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleDownloadCombined = () => {
    if (exportedBlob) {
      const url = URL.createObjectURL(exportedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = clips.length > 1
        ? `merged-video-${clips.length}-clips-${Date.now()}.mp4`
        : `${clips[0]?.name || 'video'}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return;
    }

    if (clips.length > 1 && onConnectAndExport) {
      onConnectAndExport();
      return;
    }

    if (clips.length > 0) {
      handleDownloadSingle(clips[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2.5">
            {isRendering ? (
              <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            )}
            <div>
              <h3 className="font-bold text-base text-white font-['Chakra_Petch'] tracking-wide flex items-center gap-2">
                {isRendering ? 'CONNECTING CLIPS...' : 'CONNECTED VIDEO'}
                {!isRendering && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60 uppercase">
                    100% Quality
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isRendering
                  ? 'Joining all clips seamlessly into one high-speed connected video'
                  : 'Zero re-encoding & zero compression — exact original video bit-for-bit'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Active Canvas Rendering View */}
          {isRendering ? (
            <div className="space-y-5 text-center py-4">
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
                    className="text-emerald-500 transition-all duration-300 stroke-current"
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
                  {statusMessage}
                </p>
                <p className="text-xs text-emerald-300/80">
                  Joining clips with native high-speed video engine. Zero stutter &amp; 100% original quality.
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Cancel Button */}
              {onCancelRender && (
                <button
                  type="button"
                  onClick={onCancelRender}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
          ) : (
            /* Pristine Original Pass-Through View (Default & Recommended) */
            <div className="space-y-4">
              {/* Native Video Player Preview */}
              {effectivePreviewUrl && (
                <div className="space-y-1.5">
                  {clips.length > 1 && (
                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="font-bold text-emerald-400 font-['Chakra_Petch'] flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {exportedBlob
                          ? `ALL ${clips.length} VIDEOS MERGED TOGETHER (1 SINGLE FILE)`
                          : `ALL ${clips.length} VIDEOS READY TO MERGE`}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {clips.length} Clips Combined
                      </span>
                    </div>
                  )}
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
                      key={effectivePreviewUrl}
                      src={effectivePreviewUrl}
                      controls
                      autoPlay={false}
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              )}

              {/* Quality & Specifications Confirmation Banner */}
              <div className="bg-emerald-950/60 border border-emerald-700/70 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-xs font-bold text-emerald-200 uppercase tracking-wider font-['Chakra_Petch']">
                      {clips.length > 1
                        ? `All ${clips.length} Videos Merged Together (1 File)`
                        : 'Original Pass-Through (Zero Quality Loss)'}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-900/50 px-2 py-0.5 rounded">
                    100% LOSSLESS
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-emerald-900/30 rounded p-1.5 border border-emerald-800/40">
                    <span className="text-[10px] text-emerald-400 block font-semibold">RESOLUTION</span>
                    <span className="font-bold text-white font-['Chakra_Petch'] truncate block">
                      {nativeResolutionDisplay}
                    </span>
                  </div>
                  <div className="bg-emerald-900/30 rounded p-1.5 border border-emerald-800/40">
                    <span className="text-[10px] text-emerald-400 block font-semibold">BITRATE</span>
                    <span className="font-bold text-white font-['Chakra_Petch']">100% Original</span>
                  </div>
                  <div className="bg-emerald-900/30 rounded p-1.5 border border-emerald-800/40">
                    <span className="text-[10px] text-emerald-400 block font-semibold">TOTAL SIZE</span>
                    <span className="font-bold text-white font-['Chakra_Petch']">
                      {finalSizeMB} MB
                    </span>
                  </div>
                  <div className="bg-emerald-900/30 rounded p-1.5 border border-emerald-800/40">
                    <span className="text-[10px] text-emerald-400 block font-semibold">CLIPS</span>
                    <span className="font-bold text-emerald-300 font-['Chakra_Petch']">
                      {clips.length > 1 ? `${clips.length} In 1 Video` : '1 Clip'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Main Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                {/* Download Merged / Original Video Button */}
                <button
                  type="button"
                  onClick={handleDownloadCombined}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-lg shadow-emerald-950/50 cursor-pointer font-['Chakra_Petch']"
                >
                  <Download className="w-4 h-4 text-white" />
                  <span>
                    {clips.length > 1
                      ? `Download All ${clips.length} Videos Together in 1 Video`
                      : `Download Video (${finalSizeMB} MB)`}
                  </span>
                </button>

                {/* Upload to YouTube Button */}
                <button
                  id="export-to-youtube-btn"
                  type="button"
                  onClick={() => {
                    onClose();
                    onProceedToYouTube(exportedBlob || primaryBlob || undefined);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-lg shadow-red-950/50 font-['Chakra_Petch'] cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload to YouTube</span>
                </button>
              </div>

              {/* Optional Canvas Re-encode Section (Secondary & Opt-in) */}
              <div className="border-t border-slate-800/80 pt-3">
                <button
                  type="button"
                  onClick={() => setShowRenderOptions(!showRenderOptions)}
                  className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition py-1 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    <Sliders className="w-3.5 h-3.5 text-slate-400" />
                    Optional: Burn in animated scoreboard overlays &amp; horns?
                  </span>
                  <span className="text-[11px] text-sky-400 font-semibold">
                    {showRenderOptions ? 'Hide Options ▲' : 'Show Options ▼'}
                  </span>
                </button>

                {showRenderOptions && (
                  <div className="mt-3 p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3.5 animate-in fade-in duration-150">
                    <div className="flex items-start gap-2 bg-amber-950/40 border border-amber-800/50 rounded-lg p-2.5 text-xs text-amber-300/90">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Re-encoding Notice</span>
                        Burning in graphic overlays requires browser canvas re-encoding. For large 1 GB+ files, this takes extra time and can compress video quality compared to downloading the pristine original above.
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                        Render Resolution
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'source', label: 'Match Source', sub: 'Native dimensions' },
                          { id: '1080p', label: '1080p Full HD', sub: '1920 × 1080' },
                          { id: '4k', label: '4K Ultra HD', sub: '3840 × 2160' },
                          { id: '720p', label: '720p HD', sub: 'Fast 1280 × 720' },
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedPreset(item.id as ExportQualityPreset)}
                            className={`text-left p-2 rounded-lg border text-xs transition cursor-pointer ${
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

                    <button
                      type="button"
                      onClick={handleStartRender}
                      className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition font-['Chakra_Petch'] border border-amber-800/60 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Start Canvas Re-encode with Overlays
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
