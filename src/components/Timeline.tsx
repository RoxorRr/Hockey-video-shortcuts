import React, { useState } from 'react';
import { Transition, TransitionType, VideoClip } from '../types';
import {
  Plus,
  Trash2,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Zap,
  Layers,
  ArrowRightLeft,
  Flame,
  Maximize,
  Tv,
  ZoomIn,
  Shield,
  Clock,
} from 'lucide-react';
import { playTransitionWhoosh } from '../lib/audio';

interface TimelineProps {
  clips: VideoClip[];
  transitions: Transition[];
  onAddFiles: (files: FileList | File[]) => void;
  onAddSampleClips: () => void;
  onUpdateClip: (index: number, updated: VideoClip) => void;
  onRemoveClip: (index: number) => void;
  onMoveClip: (index: number, direction: 'left' | 'right') => void;
  onUpdateTransition: (index: number, transition: Transition) => void;
  onSelectClipForEdit: (clip: VideoClip, index: number) => void;
  selectedClipIndex: number | null;
  onSortChronological?: () => void;
}

const TRANSITION_OPTIONS: { type: TransitionType; label: string; icon: React.ReactNode; desc: string }[] = [
  { type: 'crossfade', label: 'Crossfade', icon: <Layers className="w-3.5 h-3.5" />, desc: 'Smooth dissolve blend' },
  { type: 'wipe-left', label: 'Ice Wipe Left', icon: <ChevronLeft className="w-3.5 h-3.5" />, desc: 'Zamboni left sweep' },
  { type: 'wipe-right', label: 'Ice Wipe Right', icon: <ChevronRight className="w-3.5 h-3.5" />, desc: 'Zamboni right sweep' },
  { type: 'slide-push', label: 'Slide Push', icon: <ArrowRightLeft className="w-3.5 h-3.5" />, desc: 'High-speed puck push' },
  { type: 'goal-flash', label: 'Goal Flash', icon: <Flame className="w-3.5 h-3.5 text-amber-400" />, desc: 'Goal light strobe flash' },
  { type: 'zoom', label: 'Zoom Burst', icon: <Maximize className="w-3.5 h-3.5" />, desc: 'Dynamic camera zoom burst' },
  { type: 'glitch', label: 'Puck Glitch', icon: <Zap className="w-3.5 h-3.5 text-sky-400" />, desc: 'High-impact freeze glitch' },
];

export const Timeline: React.FC<TimelineProps> = ({
  clips,
  transitions,
  onAddFiles,
  onAddSampleClips,
  onRemoveClip,
  onMoveClip,
  onUpdateTransition,
  onSelectClipForEdit,
  selectedClipIndex,
  onSortChronological,
}) => {
  const [activeTransitionModalIndex, setActiveTransitionModalIndex] = useState<number | null>(null);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(e.target.files);
    }
  };

  const hasTimestamps = clips.some((c) => c.recordedAt !== undefined);

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
              const trans = transitions[index];
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
                        <Tv className="w-6 h-6 text-slate-700" />
                      )}

                      {/* Tag pill */}
                      {clip.tag && (
                        <span
                          className={`absolute top-1 left-1 text-[9px] font-black px-1 py-0.2 rounded tracking-wider ${
                            clip.tag === 'GOAL'
                              ? 'bg-red-600 text-white'
                              : clip.tag === 'SAVE'
                              ? 'bg-sky-600 text-white'
                              : 'bg-amber-600 text-white'
                          }`}
                        >
                          {clip.tag}
                        </span>
                      )}

                      {/* Zoom badge if clip has zoom > 1.05 */}
                      {clip.zoom && clip.zoom > 1.05 && (
                        <span
                          className="absolute top-1 right-1 bg-amber-500 text-slate-950 font-black text-[9px] px-1 py-0.2 rounded flex items-center gap-0.5 shadow-xs shadow-black/50"
                          title={`Clip zoomed to ${clip.zoom.toFixed(1)}x magnification`}
                        >
                          <ZoomIn className="w-2 h-2 stroke-[2.5]" />
                          {clip.zoom.toFixed(1)}x
                        </span>
                      )}

                      {/* Sequence index badge */}
                      <span className="absolute bottom-1 left-1 bg-black/80 backdrop-blur-xs text-[9px] font-mono text-slate-300 px-1 py-0.2 rounded font-bold">
                        #{index + 1}
                      </span>

                      {/* Duration stamp */}
                      <span className="absolute bottom-1 right-1 bg-black/80 backdrop-blur-xs text-[9px] font-mono text-slate-200 px-1 py-0.2 rounded">
                        {trimmedDuration.toFixed(1)}s
                      </span>
                    </div>

                    {/* Clip Info */}
                    <div className="flex items-center justify-between mb-0.5">
                      <h4
                        className="text-[11px] font-semibold text-white truncate max-w-[110px]"
                        title={clip.name}
                      >
                        {clip.name}
                      </h4>
                      <span className="text-[9px] text-slate-400 font-mono">
                        {clip.playbackRate !== 1 ? `${clip.playbackRate}x` : ''}
                      </span>
                    </div>

                    {/* Timestamp badge if detected from filename or metadata */}
                    {clip.recordedAtDisplay && (
                      <div
                        className="flex items-center gap-1 text-[9px] font-mono text-amber-300/95 bg-amber-950/60 border border-amber-800/50 px-1 py-0.5 rounded mb-1 truncate"
                        title={`Time: ${clip.recordedAtDisplay} ${clip.hasFilenameTimestamp ? '(parsed from filename)' : ''}`}
                      >
                        <Clock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                        <span className="truncate">{clip.recordedAtDisplay}</span>
                      </div>
                    )}

                    {/* Custom Overlay Tag if active */}
                    {clip.useCustomOverlays && (
                      <div
                        className="flex items-center gap-1 text-[9px] text-sky-300 font-medium mb-1 truncate bg-sky-950/60 border border-sky-800/60 px-1 py-0.2 rounded"
                        title={`Player: ${clip.playerBannerOverride?.playerName || 'Custom'} (${clip.scorebugOverride?.awayScore ?? 0}-${clip.scorebugOverride?.homeScore ?? 0})`}
                      >
                        <Shield className="w-2.5 h-2.5 text-sky-400 shrink-0" />
                        <span className="truncate">
                          {clip.playerBannerOverride?.jerseyNumber ? `#${clip.playerBannerOverride.jerseyNumber} ` : ''}
                          {clip.playerBannerOverride?.playerName || 'Custom Overlay'}
                        </span>
                      </div>
                    )}

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

                  {/* Transition connector node between clips */}
                  {index < clips.length - 1 && trans && (
                    <div className="flex flex-col items-center justify-center relative">
                      <div className="w-6 h-0.5 bg-slate-700"></div>

                      <button
                        id={`transition-node-btn-${index}`}
                        onClick={() => {
                          playTransitionWhoosh();
                          setActiveTransitionModalIndex(
                            activeTransitionModalIndex === index ? null : index,
                          );
                        }}
                        className={`my-1 px-2.5 py-1.5 rounded-lg border text-xs flex flex-col items-center gap-1 transition ${
                          activeTransitionModalIndex === index
                            ? 'bg-sky-600 text-white border-sky-400 shadow-lg shadow-sky-950/60'
                            : 'bg-slate-800/90 text-sky-300 border-slate-700 hover:bg-slate-750 hover:border-sky-500'
                        }`}
                        title="Click to change transition effect"
                      >
                        <div className="flex items-center gap-1.5 font-bold tracking-tight">
                          {TRANSITION_OPTIONS.find((t) => t.type === trans.type)?.icon || (
                            <Layers className="w-3.5 h-3.5" />
                          )}
                          <span className="capitalize">{trans.type.replace('-', ' ')}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {trans.duration}s
                        </span>
                      </button>

                      <div className="w-6 h-0.5 bg-slate-700"></div>

                      {/* Transition Selection Popover */}
                      {activeTransitionModalIndex === index && (
                        <div className="absolute top-16 z-40 bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl w-64 text-left backdrop-blur-md">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-white uppercase tracking-wider font-['Chakra_Petch']">
                              Select Transition
                            </span>
                            <button
                              onClick={() => setActiveTransitionModalIndex(null)}
                              className="text-slate-400 hover:text-white text-xs"
                            >
                              ✕
                            </button>
                          </div>

                          <div className="flex flex-col gap-1 mb-3">
                            {TRANSITION_OPTIONS.map((opt) => (
                              <button
                                key={opt.type}
                                onClick={() => {
                                  onUpdateTransition(index, { ...trans, type: opt.type });
                                  playTransitionWhoosh();
                                  setActiveTransitionModalIndex(null);
                                }}
                                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition ${
                                  trans.type === opt.type
                                    ? 'bg-sky-600 text-white font-bold'
                                    : 'text-slate-300 hover:bg-slate-800'
                                }`}
                              >
                                {opt.icon}
                                <div>
                                  <p className="font-semibold">{opt.label}</p>
                                  <p className="text-[10px] text-slate-400">{opt.desc}</p>
                                </div>
                              </button>
                            ))}
                          </div>

                          {/* Duration slider */}
                          <div className="pt-2 border-t border-slate-800">
                            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                              <span>Duration</span>
                              <span className="font-mono text-sky-400 font-bold">
                                {trans.duration}s
                              </span>
                            </div>
                            <input
                              type="range"
                              min={0.3}
                              max={1.8}
                              step={0.1}
                              value={trans.duration}
                              onChange={(e) => {
                                onUpdateTransition(index, {
                                  ...trans,
                                  duration: parseFloat(e.target.value),
                                });
                              }}
                              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                            />
                          </div>
                        </div>
                      )}
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
