import React, { useState, useRef, useEffect, useMemo } from 'react';
import { BackgroundMusicSettings, AIMusicTrack } from '../types';
import {
  REAL_MUSIC_TRACKS,
  RealLibraryTrack,
  convertLibraryTrackToAIMusicTrack,
  createUploadedMusicTrack,
  createUrlMusicTrack,
} from '../lib/realMusicLibrary';
import {
  Music,
  Play,
  Square,
  Volume2,
  Sliders,
  CheckCircle2,
  Flame,
  UploadCloud,
  Globe,
  Disc3,
  Search,
  Scissors,
  Check,
  FileAudio,
} from 'lucide-react';

interface AIMusicControlsProps {
  settings: BackgroundMusicSettings;
  onChange: (updated: BackgroundMusicSettings) => void;
  totalVideoDuration: number;
}

type ModeTab = 'library' | 'upload' | 'url';
type EraFilter = 'all' | '80s' | '90s' | '00s' | 'modern';

export const AIMusicControls: React.FC<AIMusicControlsProps> = ({
  settings,
  onChange,
  totalVideoDuration,
}) => {
  const [activeTab, setActiveTab] = useState<ModeTab>('library');
  const [activeEra, setActiveEra] = useState<EraFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [isPlayingAudition, setIsPlayingAudition] = useState(false);
  const [auditionCurrentTime, setAuditionCurrentTime] = useState(0);
  const [previewingTrackId, setPreviewingTrackId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const auditionAudioRef = useRef<HTMLAudioElement | null>(null);
  const libraryPreviewAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveDuration = Math.max(5, Math.min(300, Math.ceil(totalVideoDuration || 15)));

  const effectiveSettings: BackgroundMusicSettings = useMemo(
    () => ({
      enabled: settings?.enabled ?? false,
      volume: settings?.volume ?? 0.75,
      originalVideoVolume: settings?.originalVideoVolume ?? 1.0,
      duckOnGoalHorn: settings?.duckOnGoalHorn ?? true,
      loop: settings?.loop ?? true,
      currentTrack: settings?.currentTrack ?? null,
      selectedStyle: settings?.selectedStyle ?? 'era-80s-rock',
      customPrompt: settings?.customPrompt ?? '',
    }),
    [settings],
  );

  const update = (partial: Partial<BackgroundMusicSettings>) => {
    onChange({
      ...effectiveSettings,
      ...partial,
    });
  };

  // Ensure default track is loaded if enabled but no track yet
  useEffect(() => {
    if (effectiveSettings.enabled && !effectiveSettings.currentTrack) {
      const defaultTrack = REAL_MUSIC_TRACKS[0];
      const converted = convertLibraryTrackToAIMusicTrack(defaultTrack, effectiveDuration);
      update({ currentTrack: converted, selectedStyle: defaultTrack.style });
    }
  }, [effectiveSettings.enabled, effectiveSettings.currentTrack, effectiveDuration]);

  // Clean up all audio elements on unmount
  useEffect(() => {
    return () => {
      if (auditionAudioRef.current) {
        try {
          auditionAudioRef.current.pause();
          auditionAudioRef.current.src = '';
        } catch {}
      }
      if (libraryPreviewAudioRef.current) {
        try {
          libraryPreviewAudioRef.current.pause();
          libraryPreviewAudioRef.current.src = '';
        } catch {}
      }
    };
  }, []);

  // Filter library tracks by era and search query
  const filteredTracks = useMemo(() => {
    return REAL_MUSIC_TRACKS.filter((t) => {
      const matchesEra = activeEra === 'all' || t.era === activeEra;
      if (!matchesEra) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.genre.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [activeEra, searchQuery]);

  // Select a real track from the library
  const handleSelectLibraryTrack = (libTrack: RealLibraryTrack) => {
    // Stop library preview if playing
    if (libraryPreviewAudioRef.current) {
      libraryPreviewAudioRef.current.pause();
      setPreviewingTrackId(null);
    }
    // Stop main audition if playing
    if (auditionAudioRef.current) {
      auditionAudioRef.current.pause();
      setIsPlayingAudition(false);
    }

    const converted = convertLibraryTrackToAIMusicTrack(libTrack, effectiveDuration);
    update({
      enabled: true,
      currentTrack: converted,
      selectedStyle: libTrack.style,
    });

    setFeedback(`Selected "${libTrack.title}" as video soundtrack`);
    setTimeout(() => setFeedback(null), 3500);
  };

  // Preview an individual track directly in the library list
  const toggleLibraryPreview = (libTrack: RealLibraryTrack, e: React.MouseEvent) => {
    e.stopPropagation();

    if (previewingTrackId === libTrack.id) {
      if (libraryPreviewAudioRef.current) {
        libraryPreviewAudioRef.current.pause();
      }
      setPreviewingTrackId(null);
      return;
    }

    // Stop main audition if playing
    if (auditionAudioRef.current) {
      auditionAudioRef.current.pause();
      setIsPlayingAudition(false);
    }

    if (!libraryPreviewAudioRef.current) {
      libraryPreviewAudioRef.current = new Audio();
    }
    const audio = libraryPreviewAudioRef.current;
    audio.src = libTrack.audioUrl;
    audio.currentTime = 0;
    audio.volume = Math.max(0, Math.min(1.0, effectiveSettings.volume));
    audio.onended = () => setPreviewingTrackId(null);
    audio.onerror = () => setPreviewingTrackId(null);

    audio
      .play()
      .then(() => setPreviewingTrackId(libTrack.id))
      .catch((err) => {
        console.warn('Preview blocked or failed:', err);
        setPreviewingTrackId(null);
      });
  };

  // Upload a real music file (MP3, WAV, AAC, M4A, OGG)
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsProcessingUpload(true);
    setFeedback(null);

    try {
      const track = await createUploadedMusicTrack(file);
      update({
        enabled: true,
        currentTrack: track,
        selectedStyle: 'arena-rock',
      });
      setFeedback(`Loaded custom track: "${track.title}" (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      console.error('Failed to parse uploaded audio:', err);
      setFeedback('Error loading audio file. Please try standard MP3 or WAV.');
      setTimeout(() => setFeedback(null), 3500);
    } finally {
      setIsProcessingUpload(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Load a track from custom URL
  const handleLoadCustomUrl = () => {
    const url = customUrlInput.trim();
    if (!url) return;
    try {
      const track = createUrlMusicTrack(url);
      update({
        enabled: true,
        currentTrack: track,
        selectedStyle: 'arena-rock',
      });
      setFeedback(`Loaded audio stream: "${track.title}"`);
      setTimeout(() => setFeedback(null), 3500);
    } catch (err) {
      console.error('Error loading URL track:', err);
      setFeedback('Failed to load audio URL.');
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  // Audition player for the currently active track
  const toggleAudition = () => {
    const track = effectiveSettings.currentTrack;
    if (!track) return;

    if (isPlayingAudition) {
      if (auditionAudioRef.current) {
        try {
          auditionAudioRef.current.pause();
        } catch {}
      }
      setIsPlayingAudition(false);
      return;
    }

    // Stop library preview if playing
    if (libraryPreviewAudioRef.current) {
      libraryPreviewAudioRef.current.pause();
      setPreviewingTrackId(null);
    }

    let url = track.audioUrl;
    if (!url && track.audioBlob) {
      url = URL.createObjectURL(track.audioBlob);
    }
    if (!url) return;

    if (!auditionAudioRef.current) {
      auditionAudioRef.current = new Audio();
    }
    const audio = auditionAudioRef.current;
    if (audio.src !== url) {
      audio.src = url;
    }
    audio.currentTime = track.startTimeOffset || 0;
    audio.loop = effectiveSettings.loop;
    audio.volume = Math.max(0, Math.min(1.0, effectiveSettings.volume));

    audio.ontimeupdate = () => {
      setAuditionCurrentTime(audio.currentTime);
    };
    audio.onended = () => {
      setIsPlayingAudition(false);
      setAuditionCurrentTime(track.startTimeOffset || 0);
    };

    audio
      .play()
      .then(() => {
        setIsPlayingAudition(true);
      })
      .catch((err) => {
        console.warn('Audition play blocked:', err);
        setIsPlayingAudition(false);
      });
  };

  // Update start time offset (cue point / trim)
  const handleOffsetChange = (offset: number) => {
    const track = effectiveSettings.currentTrack;
    if (!track) return;
    const updatedTrack: AIMusicTrack = {
      ...track,
      startTimeOffset: offset,
    };
    update({ currentTrack: updatedTrack });

    if (auditionAudioRef.current) {
      auditionAudioRef.current.currentTime = offset;
      setAuditionCurrentTime(offset);
    }
  };

  const currentTrack = effectiveSettings.currentTrack;
  const isSelectedTrack = (trackId: string) => currentTrack?.id === trackId;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 sm:p-3.5 space-y-3.5">
      {/* Header & Global On/Off Toggle */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/40 text-emerald-400 shadow-xs">
            <Music className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-['Chakra_Petch'] font-bold text-white text-xs tracking-wider uppercase flex items-center gap-1.5">
              Real Sports Music & Soundtracks
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold uppercase">
                Master Audio
              </span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Real 80s, 90s & 00s arena rock, Eurodance jock jams, or upload your own favorite song
            </p>
          </div>
        </div>

        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={effectiveSettings.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
        </label>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 text-xs font-semibold animate-fadeIn">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
          <span className="truncate">{feedback}</span>
        </div>
      )}

      {/* Mode Navigation Tabs: Real Library vs Upload Custom Song vs URL */}
      <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('library')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-['Chakra_Petch'] font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'library'
              ? 'bg-slate-700 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Disc3 className="w-3.5 h-3.5 text-amber-400" />
          <span>Real Music Library</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-['Chakra_Petch'] font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'upload'
              ? 'bg-slate-700 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5 text-sky-400" />
          <span>Upload Your Song</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('url')}
          className={`py-1.5 px-2.5 rounded-lg text-xs font-['Chakra_Petch'] font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
            activeTab === 'url'
              ? 'bg-slate-700 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Direct audio link"
        >
          <Globe className="w-3.5 h-3.5 text-teal-400" />
          <span className="hidden sm:inline">Web Link</span>
        </button>
      </div>

      {/* ================= TAB 1: REAL MUSIC LIBRARY ================= */}
      {activeTab === 'library' && (
        <div className="space-y-2.5">
          {/* Era Filter Pills */}
          <div className="flex flex-wrap gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800/80">
            <button
              type="button"
              onClick={() => setActiveEra('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-['Chakra_Petch'] font-bold transition cursor-pointer ${
                activeEra === 'all'
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Eras ({REAL_MUSIC_TRACKS.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveEra('80s')}
              className={`px-2 py-1 rounded-lg text-xs font-['Chakra_Petch'] font-bold transition cursor-pointer flex items-center gap-1 ${
                activeEra === '80s'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-amber-300'
              }`}
            >
              <span>🎸</span>
              <span>80s Arena Rock (3)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveEra('90s')}
              className={`px-2 py-1 rounded-lg text-xs font-['Chakra_Petch'] font-bold transition cursor-pointer flex items-center gap-1 ${
                activeEra === '90s'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-emerald-300'
              }`}
            >
              <span>🏒</span>
              <span>90s Jock Jams (3)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveEra('00s')}
              className={`px-2 py-1 rounded-lg text-xs font-['Chakra_Petch'] font-bold transition cursor-pointer flex items-center gap-1 ${
                activeEra === '00s'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-rose-300'
              }`}
            >
              <span>🛹</span>
              <span>00s EA NHL Rock (3)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveEra('modern')}
              className={`px-2 py-1 rounded-lg text-xs font-['Chakra_Petch'] font-bold transition cursor-pointer flex items-center gap-1 ${
                activeEra === 'modern'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-sky-300'
              }`}
            >
              <span>⚡</span>
              <span>Modern (1)</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search real songs by title, artist, or style..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Real Tracks List */}
          <div className="grid grid-cols-1 gap-1.5 max-h-72 overflow-y-auto pr-1">
            {filteredTracks.map((track) => {
              const isSelected = isSelectedTrack(track.id);
              const isPreviewing = previewingTrackId === track.id;

              return (
                <div
                  key={track.id}
                  onClick={() => handleSelectLibraryTrack(track)}
                  className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2.5 ${
                    isSelected
                      ? 'bg-emerald-950/30 border-emerald-500/80 ring-1 ring-emerald-500/50 shadow-md'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Inline Preview Button */}
                    <button
                      type="button"
                      onClick={(e) => toggleLibraryPreview(track, e)}
                      title={isPreviewing ? 'Stop Preview' : 'Audition Track'}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition ${
                        isPreviewing
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                      }`}
                    >
                      {isPreviewing ? (
                        <Square className="w-3.5 h-3.5 fill-current" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      )}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm">{track.icon}</span>
                        <span
                          className={`font-['Chakra_Petch'] font-bold text-xs truncate ${
                            isSelected ? 'text-emerald-300' : 'text-white'
                          }`}
                        >
                          {track.title}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate">
                          • {track.artist}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                        {track.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                        track.era === '80s'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : track.era === '90s'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : track.era === '00s'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : 'bg-sky-950 text-sky-300 border border-sky-800'
                      }`}
                    >
                      {track.era}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                      {track.bpm} BPM
                    </span>
                    {isSelected && (
                      <span className="p-1 rounded-md bg-emerald-500 text-slate-950">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= TAB 2: UPLOAD YOUR OWN SONG ================= */}
      {activeTab === 'upload' && (
        <div className="space-y-3">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.[0]) {
                handleFileUpload(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-xl p-5 text-center cursor-pointer transition bg-slate-900/40 hover:bg-slate-900/80 group space-y-2"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.aac,.m4a,.ogg,.flac"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />

            <div className="w-10 h-10 rounded-full bg-slate-800 group-hover:bg-emerald-500/20 text-slate-400 group-hover:text-emerald-400 flex items-center justify-center mx-auto transition">
              <UploadCloud className="w-5 h-5" />
            </div>

            <div>
              <p className="font-['Chakra_Petch'] font-bold text-xs text-white">
                {isProcessingUpload ? 'Decoding Audio Track...' : 'Drop Any Music File Here'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Supports MP3, WAV, AAC, M4A, OGG (Your favorite NHL anthem or team fight song)
              </p>
            </div>

            <button
              type="button"
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-slate-700"
            >
              Browse Audio Files
            </button>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
            <FileAudio className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Uploaded tracks are saved into your browser storage so they stay attached to your project!
            </span>
          </div>
        </div>
      )}

      {/* ================= TAB 3: STREAM AUDIO URL ================= */}
      {activeTab === 'url' && (
        <div className="space-y-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
          <label className="text-xs font-['Chakra_Petch'] font-bold text-slate-200 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-teal-400" />
            Direct Audio Link / Stream URL
          </label>
          <div className="flex gap-1.5">
            <input
              type="url"
              value={customUrlInput}
              onChange={(e) => setCustomUrlInput(e.target.value)}
              placeholder="https://example.com/audio/hockey_anthem.mp3"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={handleLoadCustomUrl}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition cursor-pointer"
            >
              Load
            </button>
          </div>
          <p className="text-[10px] text-slate-500">
            Paste any direct HTTPS audio stream link or hosted MP3 track.
          </p>
        </div>
      )}

      {/* ================= ACTIVE TRACK PLAYER & CUE TRIMMER ================= */}
      {currentTrack && (
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/80 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={toggleAudition}
                className={`p-2.5 rounded-xl transition cursor-pointer shadow-md flex items-center justify-center shrink-0 ${
                  isPlayingAudition
                    ? 'bg-amber-500 text-slate-950 font-bold ring-2 ring-amber-400/40'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
                title={isPlayingAudition ? 'Stop Audition' : 'Play Audition'}
              >
                {isPlayingAudition ? (
                  <Square className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-['Chakra_Petch'] font-bold text-white text-xs truncate">
                    {currentTrack.title}
                  </span>
                  {currentTrack.era && (
                    <span
                      className={`text-[9px] font-mono px-1 rounded uppercase font-bold shrink-0 ${
                        currentTrack.era === '80s'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : currentTrack.era === '90s'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : currentTrack.era === '00s'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : 'bg-sky-950 text-sky-300 border border-sky-800'
                      }`}
                    >
                      {currentTrack.era} ERA
                    </span>
                  )}
                  {currentTrack.isCustomUpload && (
                    <span className="text-[9px] font-mono px-1 rounded bg-sky-950 text-sky-300 border border-sky-800 font-bold uppercase shrink-0">
                      User File
                    </span>
                  )}
                  <span className="text-[9px] font-mono px-1 rounded bg-slate-950 text-emerald-400 border border-emerald-900/60 shrink-0">
                    {currentTrack.bpm} BPM
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                  <span className="text-slate-300 font-semibold">{currentTrack.artist || 'Master Track'}</span>
                  <span>•</span>
                  <span>
                    {formatTime(auditionCurrentTime)} / {formatTime(currentTrack.duration)}
                  </span>
                </div>
              </div>
            </div>

            {/* Waveform Visualizer */}
            <div className="flex items-end gap-0.5 h-6 px-1.5 py-0.5 bg-slate-950 rounded-lg border border-slate-800 shrink-0">
              {[40, 70, 90, 60, 100, 75, 45, 85, 95, 60, 80, 50].map((h, i) => (
                <span
                  key={i}
                  className={`w-1 rounded-xs transition-all duration-150 ${
                    isPlayingAudition ? 'bg-emerald-400 animate-pulse' : 'bg-slate-700'
                  }`}
                  style={{
                    height: isPlayingAudition
                      ? `${Math.max(20, Math.min(100, h * (i % 2 === 0 ? 1.1 : 0.85)))}%`
                      : '25%',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Cue Point / Start Time Offset (Skip Intro) */}
          <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-semibold flex items-center gap-1">
                <Scissors className="w-3 h-3 text-amber-400" />
                Music Start Cue Point (Skip Intro)
              </span>
              <span className="font-mono text-amber-400 font-bold">
                Start at {formatTime(currentTrack.startTimeOffset || 0)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.min(60, Math.floor(currentTrack.duration * 0.8))}
              step={1}
              value={currentTrack.startTimeOffset || 0}
              onChange={(e) => handleOffsetChange(parseFloat(e.target.value))}
              className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-[9px] text-slate-500 font-mono">
              <span>0:00 (Track Beginning)</span>
              <span>Jump straight to chorus / drop</span>
            </div>
          </div>
        </div>
      )}

      {/* ================= DUAL-TRACK AUDIO MIXER & BALANCE CONTROLS ================= */}
      <div className="space-y-3 bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/80">
        <div className="flex items-center justify-between text-xs text-slate-300 font-bold uppercase font-['Chakra_Petch'] border-b border-slate-800 pb-1.5">
          <span className="flex items-center gap-1.5 text-slate-200">
            <Sliders className="w-3.5 h-3.5 text-sky-400" />
            Audio Mixer & Level Balance
          </span>
          <span className="text-[10px] text-emerald-400 font-mono font-semibold">
            Dual-Track Mixing
          </span>
        </div>

        {/* 1. Soundtrack Volume */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-emerald-400" />
              Soundtrack Volume
            </span>
            <span className="font-mono text-emerald-400 font-bold text-xs">
              {Math.round(effectiveSettings.volume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.05}
            value={effectiveSettings.volume}
            onChange={(e) => update({ volume: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-slate-950 rounded appearance-none cursor-pointer accent-emerald-500"
          />
        </div>

        {/* 2. Original Video Audio Volume */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-sky-400" />
              Original On-Ice Video Sound
            </span>
            <span className="font-mono text-sky-400 font-bold text-xs">
              {Math.round(effectiveSettings.originalVideoVolume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.05}
            value={effectiveSettings.originalVideoVolume}
            onChange={(e) => update({ originalVideoVolume: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-slate-950 rounded appearance-none cursor-pointer accent-sky-500"
          />
          <p className="text-[10px] text-slate-400">
            Preserves native rink sounds, skate cuts, stick checks, referee whistles & crowd cheers
          </p>
        </div>

        {/* 3. Goal Horn Ducking Toggle */}
        <label className="flex items-center justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
          <div className="space-y-0.5">
            <span className="text-slate-200 font-bold text-xs flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Auto-Duck Music on Goal Horn
            </span>
            <p className="text-[10px] text-slate-400">
              Lowers background music to 20% volume while goal horn & siren blast
            </p>
          </div>
          <input
            type="checkbox"
            checked={effectiveSettings.duckOnGoalHorn}
            onChange={(e) => update({ duckOnGoalHorn: e.target.checked })}
            className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-emerald-500/20 w-4 h-4"
          />
        </label>
      </div>
    </div>
  );
};
