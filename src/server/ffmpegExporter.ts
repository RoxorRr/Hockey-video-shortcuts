import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import util from 'util';

const execFileAsync = util.promisify(execFile);

interface ClipMetadata {
  index: number;
  startTime: number;
  endTime: number;
  playbackRate?: number;
  volume?: number;
}

interface ExportPayload {
  aspectRatio?: '9:16' | '16:9' | '1:1';
  fps?: number;
  qualityPreset?: string;
  clips: ClipMetadata[];
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

    const { aspectRatio = '16:9', fps = 30, clips = [] } = payload;
    let targetW = 1920;
    let targetH = 1080;

    if (aspectRatio === '9:16') {
      targetW = 1080;
      targetH = 1920;
    } else if (aspectRatio === '1:1') {
      targetW = 1080;
      targetH = 1080;
    }

    if (payload.qualityPreset === '720p') {
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
    }

    // Process each uploaded clip
    const processedFiles: string[] = [];

    for (let i = 0; i < clips.length; i++) {
      const meta = clips[i];
      // Match file by fieldname or index
      const matchedFile =
        files.find((f) => f.fieldname === `clip_${meta.index}` || f.fieldname === `clip_${i}`) ||
        files[i];

      if (!matchedFile) {
        console.warn(`No file provided for clip index ${i}, skipping`);
        continue;
      }

      const inputPath = matchedFile.path;
      const outputPath = path.join(jobDir, `norm_clip_${i}.mp4`);

      const start = Math.max(0, meta.startTime || 0);
      const end = meta.endTime > start ? meta.endTime : start + 3.0;
      const duration = Math.max(0.1, end - start);
      const rate = meta.playbackRate && meta.playbackRate > 0 ? meta.playbackRate : 1.0;
      const volume = meta.volume !== undefined ? meta.volume : 1.0;

      // Check if input file has audio stream
      let hasAudio = false;
      try {
        const probe = await execFileAsync('/usr/bin/ffprobe', [
          '-v',
          'error',
          '-select_streams',
          'a',
          '-show_entries',
          'stream=codec_type',
          '-of',
          'csv=p=0',
          inputPath,
        ]);
        hasAudio = Boolean(probe.stdout && probe.stdout.trim().length > 0);
      } catch {}

      // Build video filter
      // setpts for speed, scale & pad for exact target resolution, fps normalization
      let vFilter = `scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:color=0x0a0f1d,fps=${fps},setsar=1`;
      if (rate !== 1.0) {
        vFilter = `setpts=${(1 / rate).toFixed(4)}*PTS,` + vFilter;
      }

      const args = [
        '-y',
        '-ss',
        start.toFixed(3),
        '-t',
        duration.toFixed(3),
        '-i',
        inputPath,
      ];

      if (hasAudio) {
        let aFilter = `volume=${volume.toFixed(2)}`;
        if (rate !== 1.0) {
          aFilter = `atempo=${rate.toFixed(2)},` + aFilter;
        }
        args.push(
          '-vf',
          vFilter,
          '-af',
          aFilter,
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          '-crf',
          '20',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-ar',
          '44100',
          '-ac',
          '2',
          outputPath,
        );
      } else {
        // Synthesize silent audio track so all concatenated segments have matched streams
        args.push(
          '-f',
          'lavfi',
          '-t',
          duration.toFixed(3),
          '-i',
          'anullsrc=channel_layout=stereo:sample_rate=44100',
          '-map',
          '0:v:0',
          '-map',
          '1:a:0',
          '-vf',
          vFilter,
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          '-crf',
          '20',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-ar',
          '44100',
          '-ac',
          '2',
          outputPath,
        );
      }

      await execFileAsync('/usr/bin/ffmpeg', args);
      processedFiles.push(outputPath);
    }

    if (processedFiles.length === 0) {
      return res.status(400).json({ error: 'No clips were successfully processed.' });
    }

    // Write concat file list
    const concatListPath = path.join(jobDir, 'concat_list.txt');
    const concatLines = processedFiles.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
    fs.writeFileSync(concatListPath, concatLines);

    // Final merge
    const finalOutputPath = path.join(jobDir, 'hockey_master_final.mp4');
    const mergeArgs = [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatListPath,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '19',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-movflags',
      '+faststart',
      finalOutputPath,
    ];

    await execFileAsync('/usr/bin/ffmpeg', mergeArgs);

    // Send file back
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'attachment; filename="hockey_master_highlights.mp4"');

    const readStream = fs.createReadStream(finalOutputPath);
    readStream.pipe(res);

    readStream.on('close', () => {
      // Clean up files after stream finishes
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
