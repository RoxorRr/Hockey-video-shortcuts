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
}) => {
  const [activeTransitionModalIndex, setActiveTransitionModalIndex] = useState<number | null>(null);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(e.target.files);
    }
  };

  return (
    <div className="w-full bg-slate-900 border-t border-slate-800 p-4 lg:p-6 select-none">
      {/* Header bar */}
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-['Chakra_Petch'] font-bold text-white tracking-wide text-sm uppercase">
            Clips & Transitions Timeline
          </h3>
          <span className="text-xs text-slate-400 font-medium">
            (Connect hockey clips with smooth cuts)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <label className="cursor-pointer flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow shadow-red-950/40">
            <Plus className="w-3.5 h-3.5" />
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
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-sky-400 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>+ Sample Clips</span>
          </button>
        </div>
      </div>

      {/* Horizontal Scrollable Track */}
      <div className="max-w-7xl mx-auto overflow-x-auto pb-4 pt-2 custom-scrollbar">
        {clips.length === 0 ? (
          <div className="border-2 border-dashed border-slate-800 rounded-xl p-8 flex flex-col items-center justify-center text-center">
            <p className="text-sm text-slate-400 mb-2">No videos on the timeline yet.</p>
            <p className="text-xs text-slate-500">
              Drag and drop your hockey video files or click <strong className="text-sky-400 font-semibold">Add Videos</strong> above.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3 min-w-max">
            {clips.map((clip, index) => {
              const trans = transitions[index];
              const isSelected = selectedClipIndex === index;
              const trimmedDuration = Math.max(0.1, clip.endTime - clip.startTime) / clip.playbackRate;

              return (
                <React.Fragment key={clip.id}>
                  {/* Clip Card */}
                  <div
                    onClick={() => onSelectClipForEdit(clip, index)}
                    className={`relative group w-52 bg-slate-950 rounded-xl border p-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-red-500 ring-2 ring-red-500/20 shadow-lg shadow-red-950/40'
                        : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                    }`}
                  >
                    {/* Thumbnail banner */}
                    <div className="relative w-full h-24 bg-slate-900 rounded-lg overflow-hidden mb-2.5 flex items-center justify-center border border-slate-800/80">
                      {clip.thumbnailUrl ? (
                        <img
                          src={clip.thumbnailUrl}
                          alt={clip.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Tv className="w-8 h-8 text-slate-700" />
                      )}

                      {/* Tag pill */}
                      {clip.tag && (
                        <span
                          className={`absolute top-1.5 left-1.5 text-[10px] font-black px-1.5 py-0.5 rounded tracking-wider ${
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

                      {/* Duration stamp */}
                      <span className="absolute bottom-1.5 right-1.5 bg-black/80 backdrop-blur-xs text-[10px] font-mono text-slate-200 px-1.5 py-0.5 rounded">
                        {trimmedDuration.toFixed(1)}s
                      </span>
                    </div>

                    {/* Clip Info */}
                    <div className="flex items-center justify-between mb-2">
                      <h4
                        className="text-xs font-semibold text-white truncate max-w-[130px]"
                        title={clip.name}
                      >
                        {clip.name}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {clip.playbackRate !== 1 ? `${clip.playbackRate}x` : ''}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-850">
                      <div className="flex items-center gap-1">
                        <button
                          id={`move-clip-left-${index}`}
                          disabled={index === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveClip(index, 'left');
                          }}
                          title="Move clip earlier"
                          className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800 transition"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>

                        <button
                          id={`move-clip-right-${index}`}
                          disabled={index === clips.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveClip(index, 'right');
                          }}
                          title="Move clip later"
                          className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800 transition"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          id={`edit-clip-btn-${index}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectClipForEdit(clip, index);
                          }}
                          title="Trim & adjust clip"
                          className="p-1 text-slate-400 hover:text-sky-400 rounded hover:bg-slate-800 transition"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                        </button>

                        <button
                          id={`remove-clip-btn-${index}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveClip(index);
                          }}
                          title="Delete clip"
                          className="p-1 text-slate-400 hover:text-red-400 rounded hover:bg-slate-800 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
