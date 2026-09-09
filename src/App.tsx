/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AspectRatio, HockeyOverlaySettings, Transition, VideoClip } from './types';
import { Navbar } from './components/Navbar';
import { VideoPlayer } from './components/VideoPlayer';
import { Timeline } from './components/Timeline';
import { OverlayControls } from './components/OverlayControls';
import { ClipEditorModal } from './components/ClipEditorModal';
import { ExportModal } from './components/ExportModal';
import { YouTubeUploadModal } from './components/YouTubeUploadModal';
import { generateSampleHockeyClips } from './lib/sampleClips';
import { exportCombinedVideo } from './lib/videoRenderer';
import { initAuth, googleSignIn, logout, getAccessToken } from './lib/firebase';
import { getMyYouTubeChannel } from './lib/youtube';
import { saveProjectToStorage, loadProjectFromStorage, clearProjectFromStorage } from './lib/storage';
import type { User } from 'firebase/auth';
import { Plus, Sparkles, UploadCloud } from 'lucide-react';

export default function App() {
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [currentTime, setCurrentTime] = useState(0);

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
    redSirenFlash: true,
    showStamps: true,
  });

  // Modals & Clip Selection
  const [selectedClipIndex, setSelectedClipIndex] = useState<number | null>(null);
  const [isClipEditorOpen, setIsClipEditorOpen] = useState(false);

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatusText, setExportStatusText] = useState('');
  const [isExportCompleted, setIsExportCompleted] = useState(false);
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // YouTube Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

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
        if (savedData && savedData.clips && savedData.clips.length > 0) {
          setClips(savedData.clips);
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

  const handleSignIn = async () => {
    try {
      const { user: signedInUser, accessToken } = await googleSignIn();
      setUser(signedInUser);
      if (accessToken) {
        const info = await getMyYouTubeChannel(accessToken);
        if (info) setChannelTitle(info.title);
      }
    } catch (err: any) {
      console.error('Sign in failed:', err);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setChannelTitle(undefined);
  };

  // Helper to extract duration and thumbnail from user video files
  const processVideoFile = (file: File): Promise<VideoClip> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.src = url;

      video.onloadedmetadata = () => {
        const dur = video.duration || 3.0;
        video.currentTime = Math.min(1.0, dur / 2);
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');

        // Detect default tag
        let tag: VideoClip['tag'] = 'GOAL';
        const lower = nameWithoutExt.toLowerCase();
        if (lower.includes('save') || lower.includes('goalie')) tag = 'SAVE';
        else if (lower.includes('hit') || lower.includes('check')) tag = 'HIT';
        else if (lower.includes('deke') || lower.includes('dangle')) tag = 'DEKE';
        else if (lower.includes('ot') || lower.includes('winner')) tag = 'OT WINNER';

        resolve({
          id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: nameWithoutExt,
          url,
          blob: file,
          originalDuration: video.duration || 3.0,
          startTime: 0,
          endTime: video.duration || 3.0,
          volume: 1.0,
          playbackRate: 1.0,
          thumbnailUrl,
          tag,
        });
      };

      video.onerror = () => {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        resolve({
          id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: nameWithoutExt,
          url,
          blob: file,
          originalDuration: 3.0,
          startTime: 0,
          endTime: 3.0,
          volume: 1.0,
          playbackRate: 1.0,
          tag: 'GOAL',
        });
      };
    });
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
        const updated = [...prev, ...newClips];
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
          return trans;
        });
        return updated;
      });
    }
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
  };

  const handleUpdateTransition = (index: number, updated: Transition) => {
    setTransitions((prev) => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  };

  const handleSelectClipForEdit = (clip: VideoClip, index: number) => {
    setSelectedClipIndex(index);
    setIsClipEditorOpen(true);
  };

  // Export Combined Video Sequence
  const handleExport = async (): Promise<Blob | null> => {
    if (clips.length === 0) return null;

    try {
      setIsExporting(true);
      setIsExportCompleted(false);
      setExportProgress(5);
      setExportStatusText('Initializing video stitcher...');
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
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans'] antialiased relative"
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
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onExport={handleExport}
        onOpenUpload={handleOpenUpload}
        onClearProject={handleClearProject}
        isExporting={isExporting}
        clipsCount={clips.length}
      />

      {/* Main Studio Viewport */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-6 flex flex-col gap-6">
        {/* Top Split: Video Player on the left, Overlays / Controls on the right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Stage Video Player (7 columns on desktop) */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center">
            <VideoPlayer
              clips={clips}
              transitions={transitions}
              overlaySettings={overlaySettings}
              aspectRatio={aspectRatio}
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
              currentTime={currentTime}
              onTimeUpdate={setCurrentTime}
            />
          </div>

          {/* Hockey Overlays, Scorebug, & Sound FX Config (5 columns on desktop) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <OverlayControls
              settings={overlaySettings}
              onChange={setOverlaySettings}
            />

            {/* Quick Tips & YouTube Shortcuts Guide */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 text-xs space-y-2">
              <h4 className="font-bold text-white uppercase tracking-wider font-['Chakra_Petch'] flex items-center gap-1.5 text-sky-400">
                <Sparkles className="w-3.5 h-3.5" />
                Hockey Shortcut Tips
              </h4>
              <ul className="space-y-1.5 text-slate-400 list-disc list-inside">
                <li>
                  <strong className="text-slate-300">9:16 Format</strong> automatically formats your montage as a YouTube Short.
                </li>
                <li>
                  Click the <strong className="text-sky-400">transition nodes</strong> between clips on the timeline to switch between Zamboni Ice Wipe, Goal Flash, Crossfade, or Glitch.
                </li>
                <li>
                  Use <strong className="text-red-400">Trim & Edit</strong> to cut dead air and highlight the exact deke, save, or top shelf goal.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Horizontal Timeline */}
        <div className="w-full">
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
          />
        </div>
      </main>

      {/* Clip Trimming & Properties Modal */}
      {isClipEditorOpen && selectedClipIndex !== null && clips[selectedClipIndex] && (
        <ClipEditorModal
          isOpen={isClipEditorOpen}
          clip={clips[selectedClipIndex]}
          onClose={() => setIsClipEditorOpen(false)}
          onSave={(updated) => {
            if (selectedClipIndex !== null) {
              handleUpdateClip(selectedClipIndex, updated);
            }
          }}
        />
      )}

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
          onSignIn={handleSignIn}
        />
      )}
    </div>
  );
}
