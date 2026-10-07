import { AspectRatio, ExportOptions, HockeyOverlaySettings, Transition, VideoClip } from '../types';

/**
 * Export highlights using Server-Side FFmpeg:
 * Sends clips and cut metadata to /api/export-ffmpeg where FFmpeg renders
 * a pristine H.264 MP4 sequence with zero client-side frame drops or stutter.
 */
export async function exportWithServerFfmpeg(
  clips: VideoClip[],
  transitions: Transition[],
  overlaySettings: HockeyOverlaySettings,
  aspectRatio: AspectRatio,
  onProgress?: (percent: number, status: string) => void,
  options?: ExportOptions,
): Promise<Blob> {
  if (clips.length === 0) {
    throw new Error('No clips to export.');
  }

  onProgress?.(5, 'Connecting to Studio Server FFmpeg Engine...');

  const formData = new FormData();
  const clipsMetadata: any[] = [];

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    onProgress?.(
      Math.round(5 + (i / clips.length) * 15),
      `Packaging clip ${i + 1} of ${clips.length} for server...`,
    );

    let blob = clip.blob;
    if (!blob && clip.url) {
      try {
        const res = await fetch(clip.url);
        blob = await res.blob();
      } catch (err) {
        console.warn(`Could not fetch blob for clip ${i}:`, err);
      }
    }

    if (blob) {
      formData.append(`clip_${i}`, blob, `clip_${i}.mp4`);
    }

    clipsMetadata.push({
      index: i,
      id: clip.id,
      startTime: clip.startTime,
      endTime: clip.endTime,
      playbackRate: clip.playbackRate || 1.0,
      volume: clip.volume !== undefined ? clip.volume : 1.0,
    });
  }

  const metadata = {
    aspectRatio,
    fps: options?.fps || 30,
    qualityPreset: options?.qualityPreset || '1080p',
    clips: clipsMetadata,
    transitions: transitions.map((t) => ({ type: t.type, duration: t.duration })),
  };

  formData.append('metadata', JSON.stringify(metadata));

  onProgress?.(22, 'Uploading clips to high-performance FFmpeg transcode pipeline...');

  return new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/export-ffmpeg', true);
    xhr.responseType = 'blob';

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const uploadPercent = Math.round((e.loaded / e.total) * 45);
        onProgress?.(
          20 + uploadPercent,
          `Uploading clips: ${Math.round((e.loaded / (1024 * 1024)))}MB / ${Math.round((e.total / (1024 * 1024)))}MB (${Math.round((e.loaded / e.total) * 100)}%)...`,
        );
      }
    };

    xhr.onprogress = () => {
      onProgress?.(75, 'FFmpeg is stitching video frames & normalizing audio with zero frame drops...');
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const responseBlob = xhr.response as Blob;
        onProgress?.(100, 'FFmpeg render complete! Master MP4 ready.');
        resolve(responseBlob);
      } else {
        reject(new Error(`Server FFmpeg export returned status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during server FFmpeg export'));
    };

    if (options?.signal) {
      options.signal.addEventListener('abort', () => {
        xhr.abort();
        reject(new Error('Export cancelled by user.'));
      });
    }

    xhr.send(formData);
  });
}
