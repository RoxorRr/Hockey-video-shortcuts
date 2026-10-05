import React from 'react';
import { VideoClip } from '../types';
import { Plus, Trash2, Download, ArrowUp, ArrowDown } from 'lucide-react';

interface ClipSequencePanelProps {
  clips: VideoClip[];
  selectedClipIndex: number | null;
  onSelectClipIndex: (idx: number) => void;
  onUpdateClip: (idx: number, updated: VideoClip) => void;
  onRemoveClip: (idx: number) => void;
  onMoveClip: (idx: number, dir: 'left' | 'right') => void;
  onConnectAndExport: () => void;
  isExporting: boolean;
  onAddFiles: (files: FileList | File[]) => void;
}

export const ClipSequencePanel: React.FC<ClipSequencePanelProps> = ({
  clips,
  selectedClipIndex,
  onSelectClipIndex,
  onUpdateClip,
  onRemoveClip,
  onMoveClip,
  onConnectAndExport,
  isExporting,
  onAddFiles,
}) => {
  const totalSeconds = clips.reduce((acc, c) => {
    const s = c.startTime || 0;
    const e = c.endTime && c.endTime > s ? c.endTime : c.originalDuration || 0;
    const rate = c.playbackRate || 1;
    return acc + Math.max(0.1, (e - s) / rate);
  }, 0);

  const totalMin = Math.floor(totalSeconds / 60);
  const totalSec = Math.floor(totalSeconds % 60);
  const totalDurationText =
    totalMin > 0 ? `${totalMin}m ${totalSec}s` : `${totalSeconds.toFixed(1)}s`;

  return (
    <div className="flex flex-col h-full bg-slate-900/95 border border-slate-800 rounded-xl overflow-hidden shadow-lg select-none">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 shrink-0">
        <div>
          <h3 className="font-['Chakra_Petch'] font-bold text-sm text-white uppercase tracking-wider flex items-center gap-2">
            <span>Connected Clips</span>
            <span className="text-[10px] font-mono bg-sky-950 text-sky-300 border border-sky-800 px-1.5 py-0.5 rounded">
              {clips.length} {clips.length === 1 ? 'clip' : 'clips'}
            </span>
          </h3>
          <p className="text-[11px] text-slate-400">
            Total length: <strong className="text-slate-200 font-mono">{totalDurationText}</strong>
          </p>
        </div>

        <label className="cursor-pointer flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-sky-400 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 transition">
          <Plus className="w-3.5 h-3.5" />
          <span>Add</span>
          <input
            type="file"
            multiple
            accept="video/mp4,video/webm,video/quicktime,video/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) onAddFiles(e.target.files);
            }}
          />
        </label>
      </div>

      {/* Clip Sequence List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar min-h-0">
        {clips.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-800 rounded-xl text-slate-500 space-y-2">
            <p className="text-xs">No video clips added yet.</p>
            <p className="text-[11px] text-slate-600">
              Drag and drop your video files here or click <strong className="text-sky-400">Add</strong> above.
            </p>
          </div>
        ) : (
          clips.map((clip, index) => {
            const isSelected = selectedClipIndex === index;
            const start = clip.startTime || 0;
            const end = clip.endTime && clip.endTime > start ? clip.endTime : clip.originalDuration || 0;
            const dur = Math.max(0.1, (end - start) / (clip.playbackRate || 1));

            return (
              <div
                key={clip.id || index}
                onClick={() => onSelectClipIndex(index)}
                className={`p-2.5 rounded-xl border transition cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800/90 border-sky-500 shadow-md shadow-sky-950/40 ring-1 ring-sky-500/30'
                    : 'bg-slate-950/60 border-slate-800 hover:bg-slate-900/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>
                    <span className="text-xs font-semibold text-white truncate" title={clip.name}>
                      {clip.name}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-slate-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 shrink-0">
                    {dur.toFixed(1)}s
                  </span>
                </div>

                {/* Trim Settings when selected */}
                {isSelected && (
                  <div
                    className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-2 text-xs bg-slate-900/60 p-2.5 rounded-lg"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>Trim Boundaries</span>
                      <span className="text-sky-300 font-bold">
                        {start.toFixed(1)}s &rarr; {end.toFixed(1)}s
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Start (s)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max={Math.max(0, end - 0.2)}
                          value={start}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            onUpdateClip(index, {
                              ...clip,
                              startTime: Math.max(0, Math.min(val, end - 0.1)),
                            });
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">End (s)</label>
                        <input
                          type="number"
                          step="0.1"
                          min={start + 0.1}
                          max={clip.originalDuration}
                          value={end}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || clip.originalDuration;
                            onUpdateClip(index, {
                              ...clip,
                              endTime: Math.min(clip.originalDuration, Math.max(start + 0.1, val)),
                            });
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-sky-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Reorder and Delete controls */}
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-850/60 text-xs">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveClip(index, 'left');
                      }}
                      title="Move earlier in connected video"
                      className="flex items-center gap-0.5 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300 hover:text-white border border-slate-800 transition cursor-pointer text-[10px] font-bold"
                    >
                      <ArrowUp className="w-3 h-3" />
                      <span>Up</span>
                    </button>
                    <button
                      type="button"
                      disabled={index === clips.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveClip(index, 'right');
                      }}
                      title="Move later in connected video"
                      className="flex items-center gap-0.5 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300 hover:text-white border border-slate-800 transition cursor-pointer text-[10px] font-bold"
                    >
                      <ArrowDown className="w-3 h-3" />
                      <span>Down</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveClip(index);
                    }}
                    title="Remove clip"
                    className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-900 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Primary Connect & Export Button */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/80 shrink-0">
        <button
          type="button"
          onClick={onConnectAndExport}
          disabled={clips.length === 0 || isExporting}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-['Chakra_Petch'] font-bold text-xs uppercase tracking-wider py-3 rounded-xl shadow-lg shadow-emerald-950/60 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          <span>{clips.length > 1 ? `Connect & Export (${clips.length} Clips)` : 'Export Video'}</span>
        </button>
        <p className="text-[10px] text-center text-slate-400 mt-1.5 font-mono">
          Zero transitions &bull; 100% native quality &bull; Instant download
        </p>
      </div>
    </div>
  );
};
