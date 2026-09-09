import React from 'react';
import { X, Download, Upload, CheckCircle2, Loader2, Play } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  progressPercent: number;
  statusMessage: string;
  isCompleted: boolean;
  exportedBlob: Blob | null;
  onProceedToYouTube: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  progressPercent,
  statusMessage,
  isCompleted,
  exportedBlob,
  onProceedToYouTube,
}) => {
  if (!isOpen) return null;

  const downloadUrl = exportedBlob ? URL.createObjectURL(exportedBlob) : '';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />
            )}
            <h3 className="font-bold text-base text-white font-['Chakra_Petch'] tracking-wide">
              {isCompleted ? 'VIDEO EXPORT READY!' : 'RENDERING HOCKEY VIDEO...'}
            </h3>
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

        <div className="p-6 space-y-6">
          {!isCompleted ? (
            <div className="space-y-4 text-center py-4">
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
                <p className="text-sm font-semibold text-white mb-1">{statusMessage}</p>
                <p className="text-xs text-slate-400">
                  Stitching clips, transitions, and audio together into high-definition video...
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-sky-500 to-red-500 h-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Preview Player */}
              {downloadUrl && (
                <div className="rounded-xl overflow-hidden bg-black aspect-video max-h-52 mx-auto border border-slate-800 shadow-inner">
                  <video
                    src={downloadUrl}
                    controls
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-3.5 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="text-xs text-emerald-200">
                  <p className="font-bold">Your hockey highlight video was rendered successfully!</p>
                  <p className="text-emerald-300/80">
                    File size: {exportedBlob ? (exportedBlob.size / (1024 * 1024)).toFixed(2) : 0} MB
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <a
                  href={downloadUrl}
                  download="hockey_highlights.webm"
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-750 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition border border-slate-700"
                >
                  <Download className="w-4 h-4 text-sky-400" />
                  Download File
                </a>

                <button
                  id="export-to-youtube-btn"
                  onClick={() => {
                    onClose();
                    onProceedToYouTube();
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-lg shadow-red-950/50 font-['Chakra_Petch']"
                >
                  <Upload className="w-4 h-4" />
                  Upload to YouTube
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
