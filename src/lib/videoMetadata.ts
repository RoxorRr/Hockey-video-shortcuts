/**
 * Reliable video metadata and duration extraction
 * Handles browser differences (e.g. Chromium WebM duration Infinity bug,
 * Safari unattached element throttling, and invalid duration metadata).
 */

export interface VideoMetadataResult {
  duration: number;
  thumbnailUrl: string;
  width?: number;
  height?: number;
}

export function extractVideoMetadata(file: File): Promise<VideoMetadataResult> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');

    // Attach temporarily to DOM so mobile browsers and Safari don't throttle metadata parsing
    video.style.position = 'fixed';
    video.style.top = '-9999px';
    video.style.left = '-9999px';
    video.style.width = '160px';
    video.style.height = '90px';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    document.body.appendChild(video);

    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    let hasResolved = false;
    let fallbackTimer: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      video.onloadedmetadata = null;
      video.ondurationchange = null;
      video.onseeked = null;
      video.onerror = null;
      video.ontimeupdate = null;
      video.pause();
      video.src = '';
      if (video.parentNode) {
        document.body.removeChild(video);
      }
    };

    const finish = (rawDur: number) => {
      if (hasResolved) return;
      hasResolved = true;

      // Ensure duration is always a finite positive number
      let safeDuration = 3.0;
      if (Number.isFinite(rawDur) && rawDur > 0.05) {
        safeDuration = Math.round(rawDur * 100) / 100;
      }

      // Generate thumbnail
      let thumbnailUrl = '';
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext('2d');
        if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
        }
      } catch (err) {
        console.warn('Could not generate video thumbnail:', err);
      }

      cleanup();
      resolve({
        duration: safeDuration,
        thumbnailUrl,
        width: video.videoWidth > 0 ? video.videoWidth : undefined,
        height: video.videoHeight > 0 ? video.videoHeight : undefined,
      });
    };

    // Handle Chromium / WebM / fragmented MP4 Infinity duration bug
    const resolveInfinityDuration = () => {
      let isChecking = false;
      const onTimeUpdate = () => {
        if (!isChecking) return;
        video.ontimeupdate = null;
        let corrected = video.duration;
        if (!Number.isFinite(corrected) || corrected === Infinity) {
          corrected = video.currentTime > 0 ? video.currentTime : 5.0;
        }
        // Rewind slightly for thumbnail capture
        video.currentTime = Math.min(1.0, Math.max(0, corrected / 4));
        video.onseeked = () => {
          finish(corrected);
        };
        setTimeout(() => finish(corrected), 500);
      };

      isChecking = true;
      video.ontimeupdate = onTimeUpdate;
      // Seek far into future to trigger browser index recalculation
      video.currentTime = 1e10;
    };

    const processMetadata = () => {
      const dur = video.duration;
      if (dur === Infinity) {
        resolveInfinityDuration();
        return;
      }

      if (Number.isFinite(dur) && dur > 0.05) {
        // Seek to 1/3 of the video or 1 sec for a representative thumbnail
        const seekTarget = Math.min(1.0, Math.max(0, dur / 3));
        video.onseeked = () => {
          finish(dur);
        };
        video.currentTime = seekTarget;

        // In case onseeked does not fire
        setTimeout(() => finish(dur), 800);
      }
    };

    video.onloadedmetadata = processMetadata;
    video.ondurationchange = processMetadata;

    video.onerror = () => {
      console.warn('Video element reported error loading:', file.name);
      finish(5.0);
    };

    // Safety fallback: if metadata events are delayed, don't freeze the app
    fallbackTimer = setTimeout(() => {
      let dur = video.duration;
      if (!Number.isFinite(dur) || dur <= 0) {
        dur = 5.0;
      }
      finish(dur);
    }, 3500);

    video.src = url;
  });
}
