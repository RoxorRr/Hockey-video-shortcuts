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
  vcodec: string;
  acodec: string;
}

async function probeMedia(filePath: string): Promise<ProbeResult> {
  let width = 1920;
  let height = 1080;
  let duration = 0;
  let hasAudio = false;
  let fps = 30;
  let vcodec = 'h264';
  let acodec = 'aac';

  try {
    const { stdout } = await execFileAsync('/usr/bin/ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'stream=codec_type,codec_name,width,height,r_frame_rate:format=duration',
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
          if (st.codec_name) vcodec = st.codec_name;
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
          if (st.codec_name) acodec = st.codec_name;
        }
      }
    }
  } catch (err) {
    console.warn(`ffprobe failed for ${filePath}, using defaults:`, err);
  }

  return { width, height, duration, hasAudio, fps, vcodec, acodec };
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
      qualityPreset = 'source',
      clips = [],
      removeEffectsAndTransitions = true,
    } = payload;

    if (clips.length === 0 && files.length === 0) {
      cleanupJob(jobDir, files);
      return res.status(400).json({ error: 'No video clips provided for export.' });
    }

    interface ValidatedClip {
      inputPath: string;
      start: number;
      end: number;
      duration: number;
      hasAudio: boolean;
      rate: number;
      volume: number;
      isTrimmed: boolean;
      probe: ProbeResult;
    }

    const validatedClips: ValidatedClip[] = [];
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

      // If untrimmed or invalid bounds, use full file duration
      if (end <= start) {
        start = 0;
        end = fileDuration > 0 && fileDuration < 9000 ? fileDuration : 3.0;
      }

      // Check if user trimmed this clip
      const isTrimmed = start > 0.05 || (fileDuration > 0 && Math.abs(end - fileDuration) > 0.25);
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
        isTrimmed: isTrimmed || rate !== 1.0,
        probe,
      });
    }

    if (validatedClips.length === 0) {
      cleanupJob(jobDir, files);
      return res.status(400).json({ error: 'No valid video clips found on server.' });
    }

    const finalOutputPath = path.join(jobDir, 'stitched_original_video.mp4');

    // 1. FAST-PATH: Lossless Stream Copy Concat (Zero re-encode, 100% original bytes)
    // If user requested clean join, no clips are trimmed, and video/audio formats match:
    const anyTrimmed = validatedClips.some((c) => c.isTrimmed);
    const firstClip = validatedClips[0];
    const canStreamCopy =
      removeEffectsAndTransitions &&
      !anyTrimmed &&
      validatedClips.length > 1 &&
      validatedClips.every(
        (c) =>
          c.probe.vcodec === firstClip.probe.vcodec &&
          c.probe.width === firstClip.probe.width &&
          c.probe.height === firstClip.probe.height &&
          c.probe.hasAudio === firstClip.probe.hasAudio &&
          c.probe.acodec === firstClip.probe.acodec,
      );

    if (canStreamCopy) {
      console.log(`[FFmpeg] Using Lossless Demuxer Stream Copy for ${validatedClips.length} clips...`);
      const listFilePath = path.join(jobDir, 'concat_list.txt');
      const listContent = validatedClips
        .map((c) => `file '${c.inputPath.replace(/'/g, "'\\''")}'`)
        .join('\n');
      fs.writeFileSync(listFilePath, listContent, 'utf-8');

      try {
        await execFileAsync('/usr/bin/ffmpeg', [
          '-y',
          '-f',
          'concat',
          '-safe',
          '0',
          '-i',
          listFilePath,
          '-c',
          'copy',
          '-movflags',
          '+faststart',
          finalOutputPath,
        ]);

        if (fs.existsSync(finalOutputPath) && fs.statSync(finalOutputPath).size > 1000) {
          console.log('[FFmpeg] Lossless stream copy completed successfully!');
          return streamFileResponse(res, finalOutputPath, jobDir, files);
        }
      } catch (streamCopyErr) {
        console.warn('[FFmpeg] Stream copy encountered an issue, falling back to perfect sync transcode:', streamCopyErr);
      }
    }

    // 2. ROCK-SOLID NORMALIZED PIPELINE (Deterministic A/V Sync, Monotonic PTS, Zero Stutter)
    // Determine target canvas dimensions and framerate
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

    targetW = Math.round(targetW / 2) * 2;
    targetH = Math.round(targetH / 2) * 2;

    const ffmpegArgs: string[] = ['-y'];

    // Add all input files
    for (const clip of validatedClips) {
      ffmpegArgs.push('-i', clip.inputPath);
    }

    const filterSections: string[] = [];
    const concatInputs: string[] = [];

    for (let i = 0; i < validatedClips.length; i++) {
      const clip = validatedClips[i];
      const startSec = clip.start.toFixed(3);
      const endSec = clip.end.toFixed(3);
      const durSec = (clip.duration / (clip.rate || 1.0)).toFixed(3);

      // Video Filter:
      // Exact trim -> reset PTS -> rate change -> uniform scale/pad -> force CFR fps ->
      // settb=AVTB -> setpts=N/(FPS*TB) to eliminate all jitter -> trim exact duration
      let vFilter = `[${i}:v]trim=start=${startSec}:end=${endSec},setpts=PTS-STARTPTS`;
      if (clip.rate !== 1.0) {
        vFilter += `,setpts=${(1 / clip.rate).toFixed(4)}*PTS`;
      }
      vFilter += `,scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=${finalFps},settb=AVTB,setpts=N/(${finalFps}*TB),trim=duration=${durSec}[v${i}]`;
      filterSections.push(vFilter);

      // Audio Filter:
      // Exact atrim -> reset audio PTS -> rate change -> volume ->
      // resample to 48000Hz stereo with async sync -> apad with silence to ensure NO early EOF ->
      // atrim to EXACT matching duration down to the millisecond -> asetpts=N/SR/TB
      if (clip.hasAudio) {
        let aFilter = `[${i}:a]atrim=start=${startSec}:end=${endSec},asetpts=PTS-STARTPTS`;
        if (clip.rate !== 1.0) {
          aFilter += `,atempo=${clip.rate.toFixed(2)}`;
        }
        if (clip.volume !== 1.0) {
          aFilter += `,volume=${clip.volume.toFixed(2)}`;
        }
        aFilter += `,aformat=sample_rates=48000:channel_layouts=stereo,aresample=48000:async=1000:first_pts=0,apad,atrim=duration=${durSec},asetpts=N/SR/TB[a${i}]`;
        filterSections.push(aFilter);
      } else {
        // Synthesize silent audio stream with exact duration
        filterSections.push(
          `anullsrc=channel_layout=stereo:sample_rate=48000,atrim=duration=${durSec},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,asetpts=N/SR/TB[a${i}]`,
        );
      }

      concatInputs.push(`[v${i}][a${i}]`);
    }

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
      '18',
      '-pix_fmt',
      'yuv420p',
      '-fps_mode',
      'cfr',
      '-avoid_negative_ts',
      'make_zero',
      '-x264-params',
      'stitch-able=1:open-gop=0:keyint=60:min-keyint=30',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-ar',
      '48000',
      '-ac',
      '2',
      '-max_muxing_queue_size',
      '2048',
      '-movflags',
      '+faststart',
      finalOutputPath,
    );

    console.log(`[FFmpeg] Rendering ${validatedClips.length} clips with perfect A/V sync & monotonic PTS...`);
    await execFileAsync('/usr/bin/ffmpeg', ffmpegArgs);
    console.log('[FFmpeg] Render completed successfully:', finalOutputPath);

    return streamFileResponse(res, finalOutputPath, jobDir, files);
  } catch (error: any) {
    console.error('[FFmpeg] Server export failed:', error);
    cleanupJob(jobDir, files);
    if (!res.headersSent) {
      res.status(500).json({ error: error?.message || 'FFmpeg export failed' });
    }
  }
}

function streamFileResponse(
  res: Response,
  outputPath: string,
  jobDir: string,
  files: Express.Multer.File[],
) {
  const stat = fs.statSync(outputPath);
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Disposition', 'attachment; filename="stitched_original_video.mp4"');

  const readStream = fs.createReadStream(outputPath);
  readStream.pipe(res);

  readStream.on('close', () => {
    cleanupJob(jobDir, files);
  });

  readStream.on('error', (err) => {
    console.warn('ReadStream error during output delivery:', err);
    cleanupJob(jobDir, files);
  });
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
