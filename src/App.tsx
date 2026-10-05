/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AspectRatio, ExportOptions, FramingMode, HockeyOverlaySettings, Transition, VideoClip } from './types';
import { Navbar } from './components/Navbar';
import { VideoPlayer } from './components/VideoPlayer';
import { Timeline } from './components/Timeline';
import { ClipSequencePanel } from './components/ClipSequencePanel';
import { ExportModal } from './components/ExportModal';
import { YouTubeUploadModal } from './components/YouTubeUploadModal';
import { YouTubeAuthModal } from './components/YouTubeAuthModal';
import { generateSampleHockeyClips } from './lib/sampleClips';
import { exportCombinedVideo } from './lib/videoRenderer';
import { loadBlobIntoMemory, bufferClipIntoMemory, ensureAllClipsLoaded } from './lib/videoLoader';
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

  // Overlay Settings (disabled for simple and clean video connection)
  const [overlaySettings, setOverlaySettings] = useState<HockeyOverlaySettings>({
    scorebug: {
      enabled: false,
      homeTeam: 'NYR',
      awayTeam: 'BOS',
      homeScore: 0,
      awayScore: 0,
      period: '1ST',
      timeRemaining: '20:00',
    },
    playerBanner: {
      enabled: false,
      playerName: '',
      jerseyNumber: '',
      actionText: '',
    },
    goalHornSound: false,
    hornConfig: {
      enabled: false,
      useCustomHorn: false,
      triggerMode: 'every_clip',
      clipOffsetSeconds: 0.5,
      volume: 0,
      hornDuration: 0,
      skipClipsWithNativeHorn: true,
      duckVideoAudio: false,
    },
    redSirenFlash: false,
    showStamps: false,
    showHighlightTags: false,
    backgroundMusic: {
      enabled: false,
      volume: 0.75,
      originalVideoVolume: 1.0,
      duckOnGoalHorn: false,
      loop: false,
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
            savedData.clips.forEach(async (c) => {
              try {
                const ready = await bufferClipIntoMemory(c);
                if (mounted) {
                  setClips((curr) =>
                    curr.map((item) => (item.id === ready.id ? { ...item, isLoaded: true, isBuffering: false } : item))
                  );
                }
              } catch {}
            });
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
    // Read file into memory RAM so browser doesn't have disk I/O stalls during playback
    let memoryBlob: Blob = file;
    let url = URL.createObjectURL(file);
    try {
      const res = await loadBlobIntoMemory(file);
      memoryBlob = res.memoryBlob;
      url = res.memoryUrl;
    } catch (e) {
      console.warn('Could not read blob into memory:', e);
    }

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
      blob: memoryBlob,
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
      isLoaded: false,
      isBuffering: true,
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

        // Set transitions to 0s (direct clean cuts without transitions)
        setTransitions((prevTrans) => {
          const trans = [...prevTrans];
          while (trans.length < updated.length - 1) {
            trans.push({ type: 'crossfade', duration: 0 });
          }
          return trans.slice(0, Math.max(0, updated.length - 1));
        });
        return updated;
      });

      // Asynchronously pre-buffer each newly added clip into browser memory
      newClips.forEach(async (c) => {
        try {
          const bufferedClip = await bufferClipIntoMemory(c);
          setClips((current) =>
            current.map((item) => (item.id === bufferedClip.id ? { ...item, isLoaded: true, isBuffering: false } : item))
          );
        } catch (err) {
          console.warn('Memory pre-buffering completed with warning:', err);
          setClips((current) =>
            current.map((item) => (item.id === c.id ? { ...item, isLoaded: true, isBuffering: false } : item))
          );
        }
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
          trans.push({ type: 'crossfade', duration: 0 });
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
          trans.push({ type: 'crossfade', duration: 0 });
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

  // Download video: merges all clips into 1 single video if multiple, or downloads single file
  const handleDownloadOriginal = (targetClip?: VideoClip) => {
    if (!targetClip && clips.length > 1) {
      handleConnectAndExport();
      return;
    }

    const clip = targetClip || clips[0];
    if (!clip) return;

    let filename = clip.name || 'original-video';
    if (!filename.includes('.')) {
      const mime = clip.blob?.type || '';
      const ext = mime.includes('webm') ? 'webm' : mime.includes('quicktime') ? 'mov' : 'mp4';
      filename = `${filename}.${ext}`;
    }

    if (clip.blob) {
      const url = URL.createObjectURL(clip.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    } else if (clip.url) {
      const a = document.createElement('a');
      a.href = clip.url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Connect all clips and export as a single seamless MP4 video
  const handleConnectAndExport = async () => {
    if (clips.length === 0) return;

    // Single clip -> instant download of original
    if (clips.length === 1) {
      handleDownloadOriginal(clips[0]);
      return;
    }

    setIsExporting(true);
    setIsExportCompleted(false);
    setExportProgress(5);
    setExportStatusText(`Preparing ${clips.length} clips for high-speed merge...`);
    setIsExportModalOpen(true);

    try {
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const clipsMeta = clips.map((c) => ({
        startTime: c.startTime || 0,
        endTime: c.endTime && c.endTime > (c.startTime || 0) ? c.endTime : c.originalDuration || 0,
      }));

      // Upload each clip in 4MB chunks (100% resilient to Cloud Run 32MB payload limit)
      const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB chunk size

      for (let i = 0; i < clips.length; i++) {
        const c = clips[i];
        let fileBlob = c.blob;
        if (!fileBlob && c.url) {
          const r = await fetch(c.url);
          fileBlob = await r.blob();
        }

        if (!fileBlob) {
          throw new Error(`Clip #${i + 1} (${c.name}) data not available.`);
        }

        const fileSize = fileBlob.size;
        const totalChunks = Math.max(1, Math.ceil(fileSize / CHUNK_SIZE));

        for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
          const start = chunkIdx * CHUNK_SIZE;
          const end = Math.min(fileSize, start + CHUNK_SIZE);
          const chunkBlob = fileBlob.slice(start, end);

          const chunkForm = new FormData();
          chunkForm.append('sessionId', sessionId);
          chunkForm.append('clipIndex', String(i));
          chunkForm.append('chunkIndex', String(chunkIdx));
          chunkForm.append('totalChunks', String(totalChunks));
          chunkForm.append('chunk', chunkBlob, `chunk_${chunkIdx}.bin`);

          const upRes = await fetch('/api/upload-chunk', {
            method: 'POST',
            body: chunkForm,
          });

          if (!upRes.ok) {
            const errText = await upRes.text();
            throw new Error(`Upload error on clip #${i + 1} (${c.name}, chunk ${chunkIdx + 1}/${totalChunks}): ${errText}`);
          }

          const clipFraction = (chunkIdx + 1) / totalChunks;
          const overallPct = Math.round(5 + ((i + clipFraction) / clips.length) * 75);
          setExportProgress(overallPct);
          setExportStatusText(
            totalChunks > 1
              ? `Uploading clip ${i + 1} of ${clips.length} (${c.name} • part ${chunkIdx + 1}/${totalChunks})...`
              : `Uploading clip ${i + 1} of ${clips.length} (${c.name})...`
          );
        }
      }

      // Trigger high-speed server merge
      setExportProgress(82);
      setExportStatusText(`Merging all ${clips.length} clips into 1 video with FFmpeg (zero stutter, 100% native quality)...`);

      const mergeRes = await fetch('/api/merge-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          totalClips: clips.length,
          clipsMeta,
        }),
      });

      if (!mergeRes.ok) {
        const errText = await mergeRes.text();
        throw new Error(`Video merge failed: ${errText}`);
      }

      setExportProgress(96);
      setExportStatusText('Finalizing merged video file...');

      const connectedBlob = await mergeRes.blob();
      setExportedBlob(connectedBlob);
      setIsExportCompleted(true);
      setIsExporting(false);
      setExportProgress(100);
      setExportStatusText(`Merged all ${clips.length} clips into 1 video successfully!`);

      // Trigger download immediately of the ONE merged video
      const downloadUrl = URL.createObjectURL(connectedBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `merged-hockey-video-${clips.length}-clips-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 15000);
      return connectedBlob;
    } catch (err: any) {
      console.error('Merge export error:', err);
      setIsExporting(false);
      setExportStatusText(`Error: ${err?.message || 'Failed to merge clips'}. Please try again.`);
      return null;
    }
  };

  // Open Export / Save Modal with original untouched video (NO auto-rendering)
  const handleOpenExportModal = () => {
    if (clips.length === 0) return;
    setIsExporting(false);
    setIsExportCompleted(true);
    setIsExportModalOpen(true);
  };

  // Optional manual re-render with overlays (strictly opt-in, only if user explicitly clicks render in options)
  const handleStartCanvasRender = async (overrideOptions?: ExportOptions): Promise<Blob | null> => {
    if (clips.length === 0) return null;

    const activeOptions = overrideOptions || exportOptions;

    try {
      setIsExporting(true);
      setIsExportCompleted(false);
      setIsExportModalOpen(true);

      // Guarantee that all video files are fully loaded and buffered into memory before recording
      setExportProgress(6);
      setExportStatusText('Loading video files into browser memory to eliminate export stutter...');

      const renderClips = await ensureAllClipsLoaded(clips, (percent, status) => {
        setExportProgress(Math.min(18, Math.max(6, Math.round(6 + (percent / 100) * 12))));
        setExportStatusText(status);
      });
      setClips(renderClips);

      setExportProgress(18);
      setExportStatusText('Preparing video assets and full-quality timeline...');

      const blob = await exportCombinedVideo(
        renderClips,
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

  const handleCancelRender = () => {
    setIsExporting(false);
    setExportStatusText('Cancelled render — original video preserved.');
  };

  // Direct YouTube Upload action (merges all clips together if multiple)
  const handleOpenUpload = async () => {
    if (clips.length === 0) return;
    if (clips.length > 1 && !exportedBlob) {
      const merged = await handleConnectAndExport();
      if (merged) {
        setExportedBlob(merged);
        setIsUploadModalOpen(true);
      }
      return;
    }
    const blobToUpload = exportedBlob || clips[0]?.blob || null;
    if (blobToUpload) {
      setExportedBlob(blobToUpload);
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
        onDownloadOriginal={() => handleDownloadOriginal()}
        onExport={handleConnectAndExport}
        onOpenUpload={handleOpenUpload}
        onClearProject={handleClearProject}
        isExporting={isExporting}
        clipsCount={clips.length}
        isBufferingClips={clips.some((c) => c.isBuffering || !c.isLoaded)}
        unbufferedClipsCount={clips.filter((c) => !c.isLoaded).length}
      />

      {/* Main Studio Viewport - strictly fits 100% monitor viewport without vertical scrolling */}
      <main className="flex-1 min-h-0 w-full px-2.5 sm:px-3 py-2 flex flex-col gap-2 overflow-hidden">
        {/* Top Split: Video Player on the left, Connected Clips Sequence on the right */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2.5 overflow-hidden">
          {/* Main Stage Video Player (8 columns on desktop) */}
          <div className="lg:col-span-8 xl:col-span-8 flex flex-col min-h-0 h-full overflow-hidden">
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

          {/* Connected Clips Sequence Panel (4 columns on desktop) */}
          <div className="lg:col-span-4 xl:col-span-4 flex flex-col min-h-0 h-full overflow-hidden">
            <ClipSequencePanel
              clips={clips}
              selectedClipIndex={selectedClipIndex}
              onSelectClipIndex={setSelectedClipIndex}
              onUpdateClip={handleUpdateClip}
              onRemoveClip={handleRemoveClip}
              onMoveClip={handleMoveClip}
              onConnectAndExport={handleConnectAndExport}
              isExporting={isExporting}
              onAddFiles={handleAddFiles}
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
            onConnectAndExport={handleConnectAndExport}
          />
        </div>
      </main>

      {/* Export / Save Modal */}
      {isExportModalOpen && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          progressPercent={exportProgress}
          statusMessage={exportStatusText}
          isCompleted={isExportCompleted}
          isRendering={isExporting}
          exportedBlob={exportedBlob}
          onProceedToYouTube={(targetBlob) => {
            if (targetBlob) setExportedBlob(targetBlob);
            setIsUploadModalOpen(true);
          }}
          exportOptions={exportOptions}
          onUpdateOptions={(opts) => setExportOptions(opts)}
          onReExport={() => handleConnectAndExport()}
          onDownloadOriginal={handleDownloadOriginal}
          onConnectAndExport={handleConnectAndExport}
          onCancelRender={handleCancelRender}
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
