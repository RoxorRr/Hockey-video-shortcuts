import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import util from 'util';

const execFileAsync = util.promisify(execFile);

interface ClipMetadata {
  index: number;
  id?: string;
  startTime: number;
  endTime: number;
  playbackRate?: number;
  volume?: number;
}

interface ExportPayload {
  aspectRatio?: '9:16' | '16:9' | '1:1';
  fps?: number;
  qualityPreset?: 'source' | '4k' | '1080p' | '720p';
  clips: ClipMetadata[];
  removeEffectsAndTransitions?: boolean;
  engine?: string;
}

interface ProbeResult {
  width: number;
  height: number;
  duration: number;
  hasAudio: boolean;
  fps: number;
}

async function probeMedia(filePath: string): Promise<ProbeResult> {
  let width = 1920;
  let height = 1080;
  let duration = 0;
  let hasAudio = false;
  let fps = 30;

  try {
    const { stdout } = await execFileAsync('/usr/bin/ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'stream=codec_type,width,height,r_frame_rate:format=duration',
      '-of',
      'json',
      filePath,
    ]);
    const parsed = JSON.parse(stdout);
    if (parsed.format && parsed.format.duration) {
      duration = parseFloat(parsed.format.duration) || 0;
    }
    if (Array.isArray(parsed.streams)) {
      for (const st of parsed.streams) {
        if (st.codec_type === 'video') {
          if (st.width) width = st.width;
          if (st.height) height = st.height;
          if (st.r_frame_rate) {
            const parts = st.r_frame_rate.split('/');
            if (parts.length === 2 && parseFloat(parts[1]) > 0) {
              const calcFps = Math.round(parseFloat(parts[0]) / parseFloat(parts[1]));
              if (calcFps >= 24 && calcFps <= 120) fps = calcFps;
            }
          }
        } else if (st.codec_type === 'audio') {
          hasAudio = true;
        }
      }
    }
  } catch (err) {
    console.warn(`ffprobe failed for ${filePath}, using defaults:`, err);
  }

  return { width, height, duration, hasAudio, fps };
}

export async function handleFfmpegExport(req: Request, res: Response) {
  const files = (req.files as Express.Multer.File[]) || [];
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const jobDir = path.join(os.tmpdir(), 'hockey_ffmpeg', jobId);

  try {
    if (!fs.existsSync(jobDir)) {
      fs.mkdirSync(jobDir, { recursive: true });
    }

    let payload: ExportPayload = { clips: [] };
    if (req.body.metadata) {
      try {
        payload = JSON.parse(req.body.metadata);
      } catch (e) {
        console.warn('Failed to parse metadata JSON:', e);
      }
    }

    const {
      aspectRatio = '16:9',
      fps: requestedFps = 30,
      qualityPreset = '1080p',
      clips = [],
      removeEffectsAndTransitions = true,
    } = payload;

    if (clips.length === 0 && files.length === 0) {
      cleanupJob(jobDir, files);
      return res.status(400).json({ error: 'No video clips provided for export.' });
    }

    // Prepare list of input files matching clip metadata
    interface ValidatedClip {
      inputPath: string;
      start: number;
      end: number;
      duration: number;
      hasAudio: boolean;
      rate: number;
      volume: number;
      probe: ProbeResult;
    }

    const validatedClips: ValidatedClip[] = [];

    // Fallback if no metadata clips array: treat all uploaded files as consecutive clips
    const clipCount = Math.max(clips.length, files.length);

    for (let i = 0; i < clipCount; i++) {
      const meta = clips[i];
      const matchedFile =
        (meta &&
          files.find((f) => f.fieldname === `clip_${meta.index}` || f.fieldname === `clip_${i}`)) ||
        files[i];

      if (!matchedFile || !fs.existsSync(matchedFile.path)) {
        console.warn(`Missing file for clip index ${i}`);
        continue;
      }

      const probe = await probeMedia(matchedFile.path);
      const fileDuration = probe.duration > 0 ? probe.duration : 9999;

      let start = meta && typeof meta.startTime === 'number' ? Math.max(0, meta.startTime) : 0;
      let end =
        meta && typeof meta.endTime === 'number' && meta.endTime > start
          ? Math.min(fileDuration, meta.endTime)
          : fileDuration;

      // If untrimmed or end <= start, use full file duration
      if (end <= start) {
        start = 0;
        end = fileDuration > 0 && fileDuration < 9000 ? fileDuration : 3.0;
      }

      const duration = Math.max(0.1, end - start);
      const rate = meta && meta.playbackRate && meta.playbackRate > 0 ? meta.playbackRate : 1.0;
      const volume = meta && meta.volume !== undefined ? meta.volume : 1.0;

      validatedClips.push({
        inputPath: matchedFile.path,
        start,
        end,
        duration,
        hasAudio: probe.hasAudio,
        rate,
        volume,
        probe,
      });
    }

    if (validatedClips.length === 0) {
      cleanupJob(jobDir, files);
      return res.status(400).json({ error: 'No valid video clips found on server.' });
    }

    // Determine target dimensions and framerate
    let targetW = 1920;
    let targetH = 1080;
    let finalFps = requestedFps || 30;

    const firstProbe = validatedClips[0].probe;

    if (qualityPreset === 'source' && firstProbe.width > 0 && firstProbe.height > 0) {
      targetW = firstProbe.width;
      targetH = firstProbe.height;
      if (firstProbe.fps > 0) finalFps = firstProbe.fps;
    } else if (qualityPreset === '4k') {
      if (aspectRatio === '9:16') {
        targetW = 2160;
        targetH = 3840;
      } else if (aspectRatio === '1:1') {
        targetW = 2160;
        targetH = 2160;
      } else {
        targetW = 3840;
        targetH = 2160;
      }
    } else if (qualityPreset === '720p') {
      if (aspectRatio === '9:16') {
        targetW = 720;
        targetH = 1280;
      } else if (aspectRatio === '1:1') {
        targetW = 720;
        targetH = 720;
      } else {
        targetW = 1280;
        targetH = 720;
      }
    } else {
      // 1080p standard
      if (aspectRatio === '9:16') {
        targetW = 1080;
        targetH = 1920;
      } else if (aspectRatio === '1:1') {
        targetW = 1080;
        targetH = 1080;
      } else {
        targetW = 1920;
        targetH = 1080;
      }
    }

    // Ensure even width and height for H.264 / yuv420p
    targetW = Math.round(targetW / 2) * 2;
    targetH = Math.round(targetH / 2) * 2;

    const finalOutputPath = path.join(jobDir, 'stitched_original_video.mp4');

    // Build FFmpeg command arguments
    const ffmpegArgs: string[] = ['-y'];

    // Add all input files
    for (const clip of validatedClips) {
      ffmpegArgs.push('-i', clip.inputPath);
    }

    // Build filter_complex string:
    // Pure clean join: zero overlays, zero transitions, 100% smooth frame-by-frame exact timestamps
    const filterSections: string[] = [];
    const concatInputs: string[] = [];

    for (let i = 0; i < validatedClips.length; i++) {
      const clip = validatedClips[i];
      const startSec = clip.start.toFixed(3);
      const endSec = clip.end.toFixed(3);

      // Video filter: exact trim, reset presentation timestamp, scale & pad to target aspect ratio, fps
      let vFilter = `[${i}:v]trim=start=${startSec}:end=${endSec},setpts=PTS-STARTPTS`;
      if (clip.rate !== 1.0) {
        vFilter += `,setpts=${(1 / clip.rate).toFixed(4)}*PTS`;
      }
      vFilter += `,scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=${finalFps}[v${i}]`;
      filterSections.push(vFilter);

      // Audio filter: exact atrim, reset audio PTS, volume adjust
      if (clip.hasAudio) {
        let aFilter = `[${i}:a]atrim=start=${startSec}:end=${endSec},asetpts=PTS-STARTPTS`;
        if (clip.rate !== 1.0) {
          aFilter += `,atempo=${clip.rate.toFixed(2)}`;
        }
        if (clip.volume !== 1.0) {
          aFilter += `,volume=${clip.volume.toFixed(2)}`;
        }
        aFilter += `[a${i}]`;
        filterSections.push(aFilter);
      } else {
        // Synthesize silent audio stream matching clip duration so stream mapping matches
        const durationSec = (clip.duration / (clip.rate || 1.0)).toFixed(3);
        filterSections.push(
          `anullsrc=channel_layout=stereo:sample_rate=44100,atrim=duration=${durationSec},asetpts=PTS-STARTPTS[a${i}]`,
        );
      }

      concatInputs.push(`[v${i}][a${i}]`);
    }

    // Concatenate all normalized streams into a unified master output
    filterSections.push(
      `${concatInputs.join('')}concat=n=${validatedClips.length}:v=1:a=1[outv][outa]`,
    );

    const fullFilterString = filterSections.join('; ');

    ffmpegArgs.push(
      '-filter_complex',
      fullFilterString,
      '-map',
      '[outv]',
      '-map',
      '[outa]',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '18', // Visually lossless, crisp original quality
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-ar',
      '44100',
      '-ac',
      '2',
      '-movflags',
      '+faststart',
      finalOutputPath,
    );

    console.log(`Starting FFmpeg join of ${validatedClips.length} clips with 0 effects/transitions...`);
    await execFileAsync('/usr/bin/ffmpeg', ffmpegArgs);
    console.log('FFmpeg join completed successfully:', finalOutputPath);

    // Return the stitched master video directly to client
    const stat = fs.statSync(finalOutputPath);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', stat.size);
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="stitched_original_video.mp4"',
    );

    const readStream = fs.createReadStream(finalOutputPath);
    readStream.pipe(res);

    readStream.on('close', () => {
      cleanupJob(jobDir, files);
    });

    readStream.on('error', (err) => {
      console.warn('ReadStream error during FFmpeg output delivery:', err);
      cleanupJob(jobDir, files);
    });
  } catch (error: any) {
    console.error('Server FFmpeg export failed:', error);
    cleanupJob(jobDir, files);
    if (!res.headersSent) {
      res.status(500).json({ error: error?.message || 'FFmpeg export failed' });
    }
  }
}

function cleanupJob(jobDir: string, uploadedFiles: Express.Multer.File[]) {
  try {
    uploadedFiles.forEach((f) => {
      if (f.path && fs.existsSync(f.path)) {
        try {
          fs.unlinkSync(f.path);
        } catch {}
      }
    });
    if (fs.existsSync(jobDir)) {
      fs.rmSync(jobDir, { recursive: true, force: true });
    }
  } catch (e) {
    console.warn('Error during temp job cleanup:', e);
  }
}
