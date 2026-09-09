import React, { useState, useRef, useEffect } from 'react';
import { HockeyTag, VideoClip } from '../types';
import { X, Play, Pause, Gauge, Volume2, Tag, Scissors } from 'lucide-react';

interface ClipEditorModalProps {
  clip: VideoClip | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: VideoClip) => void;
}

const HOCKEY_TAGS: HockeyTag[] = [
  'GOAL',
  'SAVE',
  'HIT',
  'DEKE',
  'POWERPLAY',
  'OT WINNER',
  'CELEBRATION',
];

export const ClipEditorModal: React.FC<ClipEditorModalProps> = ({
  clip,
  isOpen,
  onClose,
  onSave,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [name, setName] = useState(clip?.name || '');
  const [maxDuration, setMaxDuration] = useState<number>(() => {
    if (clip && Number.isFinite(clip.originalDuration) && clip.originalDuration > 0.1) {
      return clip.originalDuration;
    }
    return 5.0;
  });
  const [startTime, setStartTime] = useState(() => (clip && Number.isFinite(clip.startTime) ? clip.startTime : 0));
  const [endTime, setEndTime] = useState(() => (clip && Number.isFinite(clip.endTime) && clip.endTime > 0 ? clip.endTime : 3.0));
  const [volume, setVolume] = useState(clip?.volume ?? 1);
  const [playbackRate, setPlaybackRate] = useState(clip?.playbackRate ?? 1);
  const [tag, setTag] = useState<HockeyTag | undefined>(clip?.tag);
  const [customTagText, setCustomTagText] = useState(clip?.customTagText || '');

  useEffect(() => {
    if (clip) {
      const dur = Number.isFinite(clip.originalDuration) && clip.originalDuration > 0.1 ? clip.originalDuration : 5.0;
      const s = Number.isFinite(clip.startTime) && clip.startTime >= 0 ? clip.startTime : 0;
      const e = Number.isFinite(clip.endTime) && clip.endTime > s ? clip.endTime : dur;

      setName(clip.name);
      setMaxDuration(dur);
      setStartTime(s);
      setEndTime(e);
      setVolume(clip.volume ?? 1);
      setPlaybackRate(clip.playbackRate ?? 1);
      setTag(clip.tag);
      setCustomTagText(clip.customTagText || '');
    }
  }, [clip]);

  if (!isOpen || !clip) return null;

  const handleVideoLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    let dur = v.duration;
    if (dur === Infinity) {
      // Chromium WebM workaround
      v.currentTime = 1e10;
      v.ontimeupdate = () => {
        v.ontimeupdate = null;
        dur = v.duration;
        if (!Number.isFinite(dur)) dur = v.currentTime;
        v.currentTime = startTime;
        if (Number.isFinite(dur) && dur > 0.1) {
          setMaxDuration(dur);
          if (endTime > dur || endTime <= 0) setEndTime(dur);
        }
      };
      return;
    }

    if (Number.isFinite(dur) && dur > 0.1) {
      setMaxDuration(dur);
      if (!Number.isFinite(endTime) || endTime > dur || endTime <= 0) {
        setEndTime(dur);
      }
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      if (video.currentTime < startTime || video.currentTime >= endTime) {
        video.currentTime = startTime;
      }
      video.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.currentTime >= endTime) {
      video.pause();
      setIsPlaying(false);
      video.currentTime = startTime;
    }
  };

  const handleSeekStart = (val: number) => {
    const clamped = Math.max(0, Math.min(val, endTime - 0.1));
    setStartTime(clamped);
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
  };

  const handleSeekEnd = (val: number) => {
    const clamped = Math.min(maxDuration, Math.max(val, startTime + 0.1));
    setEndTime(clamped);
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
  };

  const handleSave = () => {
    onSave({
      ...clip,
      name,
      originalDuration: maxDuration,
      startTime,
      endTime,
      volume,
      playbackRate,
      tag,
      customTagText,
    });
    onClose();
  };

  const trimmedDuration = Math.max(0.1, (endTime - startTime) / playbackRate);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-red-500" />
            <h3 className="font-bold text-base text-white font-['Chakra_Petch'] tracking-wide">
              TRIM & EDIT HOCKEY CLIP
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[80vh] overflow-y-auto space-y-6">
          {/* Video Preview */}
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-56 mx-auto flex items-center justify-center border border-slate-800">
            <video
              ref={videoRef}
              src={clip.url}
              playsInline
              onLoadedMetadata={handleVideoLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              className="w-full h-full object-contain cursor-pointer"
              onClick={togglePlay}
            />
            <button
              onClick={togglePlay}
              className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/60 text-white flex items-center justify-center hover:scale-110 transition"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
          </div>

          {/* Title input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Clip Title
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              placeholder="e.g. McDavid Top Corner Goal"
            />
          </div>

          {/* Trimming Sliders */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-sky-400" />
                Trim Clip Range
              </span>
              <span className="text-xs font-mono font-bold text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800/60">
                Duration: {Number.isFinite(trimmedDuration) ? trimmedDuration.toFixed(2) : '0.00'}s
              </span>
            </div>

            {/* Start Time */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Start Point: {Number.isFinite(startTime) ? startTime.toFixed(2) : '0.00'}s</span>
                <span>Max: {Number.isFinite(maxDuration) ? maxDuration.toFixed(2) : '0.00'}s</span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(0.2, maxDuration)}
                step={0.05}
                value={Number.isFinite(startTime) ? startTime : 0}
                onChange={(e) => handleSeekStart(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
            </div>

            {/* End Time */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>End Point: {Number.isFinite(endTime) ? endTime.toFixed(2) : '0.00'}s</span>
                <span>Max: {Number.isFinite(maxDuration) ? maxDuration.toFixed(2) : '0.00'}s</span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(0.2, maxDuration)}
                step={0.05}
                value={Number.isFinite(endTime) ? endTime : 0}
                onChange={(e) => handleSeekEnd(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
            </div>
          </div>

          {/* Playback Speed & Volume */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <label className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5 uppercase">
                <Gauge className="w-3.5 h-3.5 text-amber-400" />
                Playback Speed
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[0.5, 0.75, 1.0, 1.5].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => {
                      setPlaybackRate(rate);
                      if (videoRef.current) videoRef.current.playbackRate = rate;
                    }}
                    className={`py-1.5 text-xs font-semibold rounded-lg border transition ${
                      playbackRate === rate
                        ? 'bg-red-600 border-red-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {rate === 0.5 ? '0.5x Slo' : `${rate}x`}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-300 mb-2 uppercase">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  Volume
                </span>
                <span className="font-mono text-emerald-400">{Math.round(volume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setVolume(v);
                  if (videoRef.current) videoRef.current.volume = v;
                }}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </div>

          {/* Hockey Action Tag */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
            <label className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5 uppercase">
              <Tag className="w-3.5 h-3.5 text-purple-400" />
              Hockey Highlight Tag
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {HOCKEY_TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTag(tag === t ? undefined : t)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition uppercase tracking-wider ${
                    tag === t
                      ? 'bg-red-600 text-white shadow'
                      : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition shadow-lg shadow-red-950/40 uppercase tracking-wider font-['Chakra_Petch']"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};
