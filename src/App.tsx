/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AspectRatio, ExportOptions, FramingMode, HockeyOverlaySettings, Transition, VideoClip } from './types';
import { Navbar } from './components/Navbar';
import { VideoPlayer } from './components/VideoPlayer';
import { Timeline } from './components/Timeline';
import { OverlayControls } from './components/OverlayControls';
import { ExportModal } from './components/ExportModal';
import { YouTubeUploadModal } from './components/YouTubeUploadModal';
import { YouTubeAuthModal } from './components/YouTubeAuthModal';
import { generateSampleHockeyClips } from './lib/sampleClips';
import { exportCombinedVideo } from './lib/videoRenderer';
import { initAuth, googleSignIn, logout, getAccessToken } from './lib/firebase';
import { getMyYouTubeChannel } from './lib/youtube';
import { saveProjectToStorage, loadProjectFromStorage, clearProjectFromStorage } from './lib/storage';
import { extractVideoMetadata } from './lib/videoMetadata';
import { getClipTimestamp, sortClipsChronologically } from './lib/timeSort';
import type { User } from 'firebase/auth';
import { Plus, Sparkles, UploadCloud } from 'lucide-react';

export default function App() {
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [currentTime, setCurrentTime] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);

  // Hockey Overlays
  const [overlaySettings, setOverlaySettings] = useState<HockeyOverlaySettings>({
    scorebug: {
      enabled: true,
      homeTeam: 'NYR',
      awayTeam: 'BOS',
      homeScore: 3,
      awayScore: 2,
      period: '3RD',
      timeRemaining: '0:18',
    },
    playerBanner: {
      enabled: true,
      playerName: 'Connor McDavid',
      jerseyNumber: '97',
      actionText: 'Top Shelf Laser Snapper 🚨',
    },
    goalHornSound: true,
    hornConfig: {
      enabled: true,
      useCustomHorn: false,
      triggerMode: 'every_clip',
      clipOffsetSeconds: 0.5,
      volume: 1.0,
      hornDuration: 5.0,
      skipClipsWithNativeHorn: true,
      duckVideoAudio: true,
    },
    redSirenFlash: true,
    showStamps: true,
    backgroundMusic: {
      enabled: false,
      volume: 0.75,
      originalVideoVolume: 1.0,
      duckOnGoalHorn: true,
      loop: true,
      currentTrack: null,
      selectedStyle: 'arena-rock',
      customPrompt: '',
    },
  });

  // Active Clip Selection for Instant Main-Stage Editing
  const [selectedClipIndex, setSelectedClipIndex] = useState<number | null>(null);

  // Auto-select first clip if none is selected
  useEffect(() => {
    if (clips.length > 0) {
      if (selectedClipIndex === null || selectedClipIndex >= clips.length) {
        setSelectedClipIndex(0);
      }
    } else {
      setSelectedClipIndex(null);
    }
  }, [clips.length, selectedClipIndex]);

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatusText, setExportStatusText] = useState('');
  const [isExportCompleted, setIsExportCompleted] = useState(false);
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    qualityPreset: 'source',
    fps: 60,
  });

  // YouTube Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Google User / Auth
  const [user, setUser] = useState<User | null>(null);
  const [channelTitle, setChannelTitle] = useState<string | undefined>();
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Initialize Auth
  useEffect(() => {
    const unsubscribe = initAuth((currentUser, token) => {
      setUser(currentUser);
      if (token) {
        getMyYouTubeChannel(token).then((info) => {
          if (info) setChannelTitle(info.title);
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const [isStorageLoaded, setIsStorageLoaded] = useState(false);

  // Restore project from IndexedDB on page load so videos don't disappear on refresh
  useEffect(() => {
    let mounted = true;
    loadProjectFromStorage().then((savedData) => {
      if (mounted) {
        if (savedData) {
          if (savedData.clips && savedData.clips.length > 0) {
            setClips(savedData.clips);
          }
          if (savedData.transitions) setTransitions(savedData.transitions);
          if (savedData.overlaySettings) setOverlaySettings(savedData.overlaySettings);
          if (savedData.aspectRatio) setAspectRatio(savedData.aspectRatio);
        }
        setIsStorageLoaded(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Persist project changes to IndexedDB
  useEffect(() => {
    if (!isStorageLoaded) return;
    saveProjectToStorage(clips, transitions, overlaySettings, aspectRatio);
  }, [clips, transitions, overlaySettings, aspectRatio, isStorageLoaded]);

  const handleClearProject = async () => {
    if (window.confirm('Clear current timeline and start a new video?')) {
      setClips([]);
      setTransitions([]);
      setExportedBlob(null);
      setCurrentTime(0);
      setSelectedClipIndex(null);
      await clearProjectFromStorage();
    }
  };

  const handleSignIn = async (options?: { useGsiOnly?: boolean; clientId?: string }) => {
    setAuthError(null);
    try {
      const { user: signedInUser, accessToken } = await googleSignIn(options);
      setUser(signedInUser);
      if (accessToken) {
        const info = await getMyYouTubeChannel(accessToken);
        if (info) setChannelTitle(info.title);
      }
    } catch (err: any) {
      console.error('Sign in failed:', err);
      setAuthError(err?.message || 'Sign in failed. Check domain authorization or use direct token.');
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setChannelTitle(undefined);
  };

  // Helper to extract duration, thumbnail, and timestamp reliably from user video files
  const processVideoFile = async (file: File): Promise<VideoClip> => {
    const url = URL.createObjectURL(file);
    const { duration, thumbnailUrl, width, height } = await extractVideoMetadata(file);
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');

    // Extract chronological timestamp from filename (e.g. "last_tour 2026-09-08 20-42-26.mp4")
    const timeInfo = getClipTimestamp(file);

    // Detect default tag
    let tag: VideoClip['tag'] = 'GOAL';
    const lower = nameWithoutExt.toLowerCase();
    if (lower.includes('save') || lower.includes('goalie')) tag = 'SAVE';
    else if (lower.includes('hit') || lower.includes('check')) tag = 'HIT';
    else if (lower.includes('deke') || lower.includes('dangle')) tag = 'DEKE';
    else if (lower.includes('ot') || lower.includes('winner')) tag = 'OT WINNER';

    const safeDuration = Number.isFinite(duration) && duration > 0.1 ? duration : 5.0;

    return {
      id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: nameWithoutExt,
      url,
      blob: file,
      originalDuration: safeDuration,
      startTime: 0,
      endTime: safeDuration,
      originalWidth: width,
      originalHeight: height,
      volume: 1.0,
      playbackRate: 1.0,
      thumbnailUrl,
      tag,
      recordedAt: timeInfo.timestamp,
      recordedAtDisplay: timeInfo.display,
      hasFilenameTimestamp: timeInfo.isFromFilename,
    };
  };

  const handleAddFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newClips: VideoClip[] = [];

    for (const file of fileArray) {
      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|mkv|avi|qt)$/i.test(file.name);
      if (isVideo) {
        const clip = await processVideoFile(file);
        newClips.push(clip);
      }
    }

    if (newClips.length > 0) {
      setClips((prev) => {
        const currentlySelectedId =
          selectedClipIndex !== null && prev[selectedClipIndex] ? prev[selectedClipIndex].id : null;

        const combined = [...prev, ...newClips];
        // Sort chronologically from oldest to newest if any clip has a recordedAt timestamp
        const anyHasTimestamp = combined.some((c) => c.recordedAt !== undefined);
        const updated = anyHasTimestamp ? sortClipsChronologically(combined) : combined;

        // Restore selected clip index to correct position after sorting
        if (currentlySelectedId) {
          const newIndex = updated.findIndex((c) => c.id === currentlySelectedId);
          if (newIndex !== -1) setSelectedClipIndex(newIndex);
        }

        // Ensure transition list matches updated length - 1
        setTransitions((prevTrans) => {
          const trans = [...prevTrans];
          const transitionStyles: Transition['type'][] = [
            'wipe-left',
            'crossfade',
            'goal-flash',
            'slide-push',
            'zoom',
            'glitch',
          ];
          while (trans.length < updated.length - 1) {
            const nextType = transitionStyles[trans.length % transitionStyles.length];
            trans.push({ type: nextType, duration: 0.8 });
          }
          return trans.slice(0, Math.max(0, updated.length - 1));
        });
        return updated;
      });
    }
  };

  const handleSortChronological = () => {
    setClips((prev) => {
      const currentlySelectedId =
        selectedClipIndex !== null && prev[selectedClipIndex] ? prev[selectedClipIndex].id : null;

      const sorted = sortClipsChronologically(prev);

      if (currentlySelectedId) {
        const newIndex = sorted.findIndex((c) => c.id === currentlySelectedId);
        if (newIndex !== -1) setSelectedClipIndex(newIndex);
      }

      setTransitions((prevTrans) => {
        const trans = [...prevTrans];
        while (trans.length < sorted.length - 1) {
          trans.push({ type: 'wipe-left', duration: 0.8 });
        }
        return trans.slice(0, Math.max(0, sorted.length - 1));
      });
      return sorted;
    });
  };

  const handleAddSampleClips = async () => {
    const samples = await generateSampleHockeyClips(aspectRatio);
    setClips((prev) => {
      const updated = [...prev, ...samples];
      setTransitions((prevTrans) => {
        const trans = [...prevTrans];
        while (trans.length < updated.length - 1) {
          trans.push({ type: 'wipe-left', duration: 0.8 });
        }
        return trans;
      });
      return updated;
    });
  };

  const handleUpdateClip = (index: number, updated: VideoClip) => {
    setClips((prev) => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  };

  const handleApplyFramingModeToAll = (mode: FramingMode) => {
    setClips((prev) => prev.map((c) => ({ ...c, framingMode: mode })));
  };

  const handleRemoveClip = (index: number) => {
    setClips((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // Adjust transitions
      setTransitions((prevTrans) => {
        const trans = [...prevTrans];
        if (trans.length > Math.max(0, next.length - 1)) {
          trans.splice(Math.min(index, trans.length - 1), 1);
        }
        return trans;
      });

      // Update selected clip index safely based on the NEW clips length
      setSelectedClipIndex((currentSelected) => {
        if (currentSelected === null) return null;
        if (next.length === 0) return null;
        if (currentSelected === index) {
          return Math.min(index, next.length - 1);
        }
        if (currentSelected > index) {
          return currentSelected - 1;
        }
        return currentSelected;
      });

      if (next.length === 0) {
        setExportedBlob(null);
        setCurrentTime(0);
      }

      return next;
    });
  };

  const handleMoveClip = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= clips.length) return;

    setClips((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });

    if (selectedClipIndex === index) {
      setSelectedClipIndex(targetIndex);
    } else if (selectedClipIndex === targetIndex) {
      setSelectedClipIndex(index);
    }
  };

  const handleUpdateTransition = (index: number, updated: Transition) => {
    setTransitions((prev) => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  };

  const handleSelectClipForEdit = (_clip: VideoClip, index: number) => {
    setSelectedClipIndex(index);
  };

  // Export Combined Video Sequence with Original Source Quality
  const handleExport = async (overrideOptions?: ExportOptions): Promise<Blob | null> => {
    if (clips.length === 0) return null;

    const activeOptions = overrideOptions || exportOptions;

    try {
      setIsExporting(true);
      setIsExportCompleted(false);
      setExportProgress(5);
      setExportStatusText('Analyzing source clips & preparing full-quality timeline...');
      setIsExportModalOpen(true);

      const blob = await exportCombinedVideo(
        clips,
        transitions,
        overlaySettings,
        aspectRatio,
        (percent, status) => {
          setExportProgress(percent);
          setExportStatusText(status);
        },
        activeOptions,
      );

      setExportedBlob(blob);
      setIsExportCompleted(true);
      setIsExporting(false);
      return blob;
    } catch (err: any) {
      console.error('Export error:', err);
      setIsExporting(false);
      setExportStatusText(`Export error: ${err.message}`);
      return null;
    }
  };

  // Direct YouTube Upload action
  const handleOpenUpload = async () => {
    // If no exported blob yet or 0 MB, export first!
    if (!exportedBlob || exportedBlob.size === 0) {
      const freshBlob = await handleExport();
      if (!freshBlob || freshBlob.size === 0) return;
    }
    setIsUploadModalOpen(true);
  };

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleAddFiles(e.dataTransfer.files);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="h-screen max-h-screen h-[100dvh] w-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans'] antialiased relative overflow-hidden"
    >
      {/* Drag & drop overlay indicator */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-50 bg-sky-950/80 backdrop-blur-sm border-4 border-dashed border-sky-400 flex flex-col items-center justify-center pointer-events-none">
          <UploadCloud className="w-16 h-16 text-sky-400 animate-bounce mb-3" />
          <h3 className="font-['Chakra_Petch'] font-black text-2xl text-white tracking-wider">
            DROP YOUR HOCKEY VIDEOS HERE
          </h3>
          <p className="text-sm text-sky-200 mt-1">MP4, WebM, and MOV supported</p>
        </div>
      )}

      {/* Header Navigation */}
      <Navbar
        aspectRatio={aspectRatio}
        onAspectRatioChange={setAspectRatio}
        user={user}
        channelTitle={channelTitle}
        onSignIn={() => setIsAuthModalOpen(true)}
        onSignOut={handleSignOut}
        onExport={handleExport}
        onOpenUpload={handleOpenUpload}
        onClearProject={handleClearProject}
        isExporting={isExporting}
        clipsCount={clips.length}
      />

      {/* Main Studio Viewport - strictly fits 100% monitor viewport without vertical scrolling */}
      <main className="flex-1 min-h-0 w-full px-2.5 sm:px-3 py-2 flex flex-col gap-2 overflow-hidden">
        {/* Top Split: Video Player on the left, Overlays / Controls on the right */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2.5 overflow-hidden">
          {/* Main Stage Video Player (7 columns on desktop) */}
          <div className="lg:col-span-7 xl:col-span-7 flex flex-col min-h-0 h-full overflow-hidden">
            <VideoPlayer
              clips={clips}
              selectedClipIndex={selectedClipIndex}
              onSelectClipIndex={setSelectedClipIndex}
              onUpdateClip={handleUpdateClip}
              onRemoveClip={handleRemoveClip}
              onMoveClip={handleMoveClip}
              overlaySettings={overlaySettings}
              aspectRatio={aspectRatio}
              onAspectRatioChange={setAspectRatio}
              onApplyFramingModeToAll={handleApplyFramingModeToAll}
              onAddSampleClips={handleAddSampleClips}
              onOpenUploadDialog={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.accept = 'video/*';
                input.onchange = (e) => {
                  const target = e.target as HTMLInputElement;
                  if (target.files) handleAddFiles(target.files);
                };
                input.click();
              }}
              transitions={transitions}
              currentTime={currentTime}
              onTimeUpdate={setCurrentTime}
            />
          </div>

          {/* Hockey Overlays, Scorebug, & Sound FX Config (5 columns on desktop) */}
          <div className="lg:col-span-5 xl:col-span-5 flex flex-col min-h-0 h-full overflow-hidden">
            <OverlayControls
              settings={overlaySettings}
              onChange={setOverlaySettings}
              clips={clips}
              selectedClipIndex={selectedClipIndex}
              onSelectClipIndex={setSelectedClipIndex}
              onUpdateClip={handleUpdateClip}
            />
          </div>
        </div>

        {/* Bottom Horizontal Timeline */}
        <div className="shrink-0 w-full overflow-hidden">
          <Timeline
            clips={clips}
            transitions={transitions}
            onAddFiles={handleAddFiles}
            onAddSampleClips={handleAddSampleClips}
            onUpdateClip={handleUpdateClip}
            onRemoveClip={handleRemoveClip}
            onMoveClip={handleMoveClip}
            onUpdateTransition={handleUpdateTransition}
            onSelectClipForEdit={handleSelectClipForEdit}
            selectedClipIndex={selectedClipIndex}
            onSortChronological={handleSortChronological}
          />
        </div>
      </main>

      {/* Export / Render Progress Modal */}
      {isExportModalOpen && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          progressPercent={exportProgress}
          statusMessage={exportStatusText}
          isCompleted={isExportCompleted}
          exportedBlob={exportedBlob}
          onProceedToYouTube={() => setIsUploadModalOpen(true)}
          exportOptions={exportOptions}
          onUpdateOptions={(opts) => setExportOptions(opts)}
          onReExport={(opts) => handleExport(opts)}
          clips={clips}
          aspectRatio={aspectRatio}
        />
      )}

      {/* YouTube Direct Upload Modal */}
      {isUploadModalOpen && (
        <YouTubeUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          videoBlob={exportedBlob}
          isShorts={aspectRatio === '9:16'}
          user={user}
          onSignIn={() => setIsAuthModalOpen(true)}
          authError={authError}
          onClearAuthError={() => setAuthError(null)}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
        />
      )}

      {/* Dedicated YouTube Auth & Connection Modal */}
      {isAuthModalOpen && (
        <YouTubeAuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          user={user}
          onAuthSuccess={(authedUser) => {
            setUser(authedUser);
            if (authedUser.displayName) setChannelTitle(authedUser.displayName);
            setIsAuthModalOpen(false);
          }}
          onSignOut={handleSignOut}
        />
      )}
    </div>
  );
}
