import React from 'react';
import { Transition, VideoClip } from '../types';
import {
  Plus,
  Trash2,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Clock,
  Download,
  Film,
} from 'lucide-react';

interface TimelineProps {
  clips: VideoClip[];
  transitions?: Transition[];
  onAddFiles: (files: FileList | File[]) => void;
  onAddSampleClips: () => void;
  onUpdateClip: (index: number, updated: VideoClip) => void;
  onRemoveClip: (index: number) => void;
  onMoveClip: (index: number, direction: 'left' | 'right') => void;
  onUpdateTransition?: (index: number, transition: Transition) => void;
  onSelectClipForEdit: (clip: VideoClip, index: number) => void;
  selectedClipIndex: number | null;
  onSortChronological?: () => void;
  onDownloadOriginalClip?: (clip: VideoClip) => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  clips,
  onAddFiles,
  onAddSampleClips,
  onRemoveClip,
  onMoveClip,
  onSelectClipForEdit,
  selectedClipIndex,
  onSortChronological,
  onDownloadOriginalClip,
}) => {
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(e.target.files);
    }
  };

  const hasTimestamps = clips.some((c) => c.recordedAt !== undefined);
  const totalDuration = clips.reduce(
    (sum, c) =>
      sum +
      Math.max(
        0.1,
        ((c.endTime && c.endTime > (c.startTime || 0) ? c.endTime : c.originalDuration) - (c.startTime || 0)) /
          (c.playbackRate || 1),
      ),
    0,
  );

  return (
    <div className="w-full bg-slate-900/95 border-t border-slate-800 px-3 py-1.5 select-none shrink-0">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <h3 className="font-['Chakra_Petch'] font-bold text-white tracking-wide text-xs uppercase flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-red-500" />
            Timeline
          </h3>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            ({clips.length} {clips.length === 1 ? 'clip' : 'clips'} &bull; Click clip to edit)
          </span>

          {hasTimestamps && (
            <span
              className="hidden md:inline-flex items-center gap-1 text-[10px] font-mono text-amber-300 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded"
              title="Files are sorted chronologically from oldest to newest based on timestamps"
            >
              <Clock className="w-2.5 h-2.5 text-amber-400" />
              Chronological (Oldest &rarr; Newest)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {clips.length > 0 && onDownloadOriginalClip && (
            <button
              id="timeline-download-original-btn"
              type="button"
              onClick={() => {
                if (clips.length === 1) {
                  onDownloadOriginalClip(clips[0]);
                } else {
                  clips.forEach((c, idx) => {
                    setTimeout(() => onDownloadOriginalClip(c), idx * 300);
                  });
                }
              }}
              title="Download untouched original video (100% Quality • Zero re-encoding • Bit-for-bit)"
              className="flex items-center gap-1 bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 hover:text-emerald-200 px-2 py-1 rounded text-xs font-semibold border border-emerald-700/60 transition shadow-xs cursor-pointer"
            >
              <Download className="w-3 h-3 text-emerald-400" />
              <span className="hidden sm:inline">
                {clips.length === 1 ? 'Download Original' : 'Download All Originals'}
              </span>
              <span className="text-[10px] text-emerald-400/80 font-mono hidden md:inline">
                (100% Quality)
              </span>
            </button>
          )}

          {clips.length > 1 && onSortChronological && (
            <button
              id="timeline-sort-chronological-btn"
              onClick={onSortChronological}
              title="Sort timeline chronologically (oldest to newest) by filename timestamp"
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 px-2 py-1 rounded text-xs font-semibold border border-slate-700 transition shadow-xs"
            >
              <Clock className="w-3 h-3 text-amber-400" />
              <span className="hidden sm:inline">Sort by Time</span>
              <span className="text-[10px] text-amber-400/80 font-mono hidden md:inline">(Oldest &rarr; Newest)</span>
            </button>
          )}

          <label className="cursor-pointer flex items-center gap-1 bg-red-600 hover:bg-red-500 text-white px-2.5 py-1 rounded text-xs font-bold transition shadow shadow-red-950/40">
            <Plus className="w-3 h-3" />
            <span>Add Videos</span>
            <input
              type="file"
              multiple
              accept="video/mp4,video/webm,video/quicktime,video/*"
              className="hidden"
              onChange={handleFileInput}
            />
          </label>

          <button
            id="timeline-add-samples-btn"
            onClick={onAddSampleClips}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-sky-400 px-2 py-1 rounded text-xs font-semibold border border-slate-700 transition"
          >
            <Sparkles className="w-3 h-3" />
            <span>+ Samples</span>
          </button>
        </div>
      </div>

      {/* Horizontal Scrollable Track */}
      <div className="overflow-x-auto pb-1 pt-0.5 custom-scrollbar">
        {clips.length === 0 ? (
          <div className="border border-dashed border-slate-800 rounded-lg py-3 px-4 flex items-center justify-center text-center gap-2">
            <p className="text-xs text-slate-400">No videos on timeline yet.</p>
            <p className="text-xs text-slate-500">
              Drag &amp; drop hockey video files or click <strong className="text-sky-400 font-semibold">Add Videos</strong>.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-max">
            {clips.map((clip, index) => {
              const isSelected = selectedClipIndex === index;
              const s = Number.isFinite(clip.startTime) && clip.startTime >= 0 ? clip.startTime : 0;
              const e = Number.isFinite(clip.endTime) && clip.endTime > s ? clip.endTime : s + 3.0;
              const r = Number.isFinite(clip.playbackRate) && clip.playbackRate > 0 ? clip.playbackRate : 1.0;
              const trimmedDuration = Math.max(0.1, (e - s) / r);

              return (
                <React.Fragment key={clip.id}>
                  {/* Clip Card */}
                  <div
                    onClick={() => onSelectClipForEdit(clip, index)}
                    className={`relative group w-44 bg-slate-950 rounded-lg border p-1.5 cursor-pointer transition-all shrink-0 ${
                      isSelected
                        ? 'border-red-500 ring-1 ring-red-500/30 shadow-md shadow-red-950/40'
                        : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                    }`}
                  >
                    {/* Thumbnail banner */}
                    <div className="relative w-full h-14 bg-slate-900 rounded overflow-hidden mb-1 flex items-center justify-center border border-slate-800/80">
                      {clip.thumbnailUrl ? (
                        <img
                          src={clip.thumbnailUrl}
                          alt={clip.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Film className="w-6 h-6 text-slate-700" />
                      )}

                      {/* Sequence index badge */}
                      <span className="absolute bottom-1 left-1 bg-black/80 backdrop-blur-xs text-[9px] font-mono text-emerald-400 px-1.5 py-0.5 rounded font-bold border border-emerald-900/60">
                        #{index + 1}
                      </span>

                      {/* Duration stamp */}
                      <span className="absolute bottom-1 right-1 bg-black/80 backdrop-blur-xs text-[9px] font-mono text-slate-200 px-1 py-0.5 rounded">
                        {trimmedDuration.toFixed(1)}s
                      </span>
                    </div>

                    {/* Clip Info */}
                    <div className="flex items-center justify-between mb-1">
                      <h4
                        className="text-xs font-semibold text-white truncate max-w-[110px]"
                        title={clip.name}
                      >
                        {clip.name}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {clip.playbackRate !== 1 ? `${clip.playbackRate}x` : ''}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between pt-0.5 border-t border-slate-850 text-xs">
                      <div className="flex items-center gap-0.5">
                        <button
                          id={`move-clip-left-${index}`}
                          disabled={index === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveClip(index, 'left');
                          }}
                          title="Move clip earlier"
                          className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800 transition"
                        >
                          <ChevronLeft className="w-3 h-3" />
                        </button>

                        <button
                          id={`move-clip-right-${index}`}
                          disabled={index === clips.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveClip(index, 'right');
                          }}
                          title="Move clip later"
                          className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800 transition"
                        >
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="flex items-center gap-0.5">
                        {onDownloadOriginalClip && (
                          <button
                            id={`download-clip-btn-${index}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDownloadOriginalClip(clip);
                            }}
                            title="Download untouched original video (100% native quality • no re-encoding)"
                            className="p-0.5 text-slate-400 hover:text-emerald-400 rounded hover:bg-slate-800 transition cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                        )}

                        <button
                          id={`edit-clip-btn-${index}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectClipForEdit(clip, index);
                          }}
                          title="Trim & adjust clip"
                          className="p-0.5 text-slate-400 hover:text-sky-400 rounded hover:bg-slate-800 transition"
                        >
                          <SlidersHorizontal className="w-3 h-3" />
                        </button>

                        <button
                          id={`remove-clip-btn-${index}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveClip(index);
                          }}
                          title="Delete clip"
                          className="p-0.5 text-slate-400 hover:text-red-400 rounded hover:bg-slate-800 transition"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Clean Direct Connection between clips */}
                  {index < clips.length - 1 && (
                    <div className="flex items-center justify-center px-1 shrink-0 text-slate-500">
                      <div
                        className="flex items-center gap-1 bg-slate-850 hover:bg-slate-800 px-2 py-1 rounded text-xs font-mono text-slate-400 border border-slate-700/80 transition"
                        title="Clips connect seamlessly back-to-back with clean direct cut"
                      >
                        <span className="text-emerald-400 font-bold">&rarr;</span>
                        <span className="text-[10px] text-slate-400 font-['Chakra_Petch']">CONNECT</span>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
