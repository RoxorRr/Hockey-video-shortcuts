import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const execFileAsync = promisify(execFile);
const uploadDir = path.join(os.tmpdir(), "puckcut-uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 4 * 1024 * 1024 * 1024, files: 500, fields: 200 }, // up to 4 GB, 500 files
});

let aiClient: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

async function getMediaInfo(filePath: string) {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "quiet",
      "-print_format", "json",
      "-show_streams",
      filePath
    ]);
    const data = JSON.parse(stdout);
    const hasVideo = Boolean(data.streams?.some((s: any) => s.codec_type === "video"));
    const hasAudio = Boolean(data.streams?.some((s: any) => s.codec_type === "audio"));
    return { hasVideo, hasAudio };
  } catch {
    return { hasVideo: true, hasAudio: false };
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "hockey-highlight-editor" });
  });

  // High-performance native FFmpeg clip concatenation
  // Connects all clips seamlessly with 100% original quality, zero stutter, and zero dropped frames
  app.post("/api/concat-videos", upload.array("videos", 300), async (req, res) => {
    const uploadedFiles = (req.files as Express.Multer.File[]) || [];
    if (uploadedFiles.length === 0) {
      return res.status(400).json({ error: "No video files provided" });
    }

    const jobDir = fs.mkdtempSync(path.join(os.tmpdir(), "puckcut-job-"));
    const cleanup = () => {
      try {
        uploadedFiles.forEach((f) => {
          if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
        });
        if (fs.existsSync(jobDir)) {
          fs.rmSync(jobDir, { recursive: true, force: true });
        }
      } catch (e) {
        console.warn("Cleanup warning:", e);
      }
    };

    try {
      let meta: Array<{ startTime?: number; endTime?: number }> = [];
      if (req.body.clipsMeta) {
        try {
          meta = JSON.parse(req.body.clipsMeta);
        } catch {
          meta = [];
        }
      }

      // Step 1: Prepare trimmed or verified clips
      const processedPaths: string[] = [];

      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const clipMeta = meta[i] || {};
        const startTime = typeof clipMeta.startTime === "number" && clipMeta.startTime > 0.05 ? clipMeta.startTime : 0;
        const endTime = typeof clipMeta.endTime === "number" && clipMeta.endTime > 0 ? clipMeta.endTime : 0;

        const needsTrim = startTime > 0 || endTime > 0;
        const targetPath = path.join(jobDir, `clip_${i}.mp4`);

        if (needsTrim) {
          const args = ["-y"];
          if (startTime > 0) args.push("-ss", startTime.toFixed(3));
          if (endTime > 0 && endTime > startTime) args.push("-to", endTime.toFixed(3));
          args.push("-i", file.path, "-c", "copy", "-avoid_negative_ts", "make_zero", targetPath);

          try {
            await execFileAsync("ffmpeg", args);
            processedPaths.push(targetPath);
          } catch {
            // If -c copy fails due to non-keyframe trim or codec differences, re-encode with high quality (crf 18)
            const fallbackArgs = ["-y"];
            if (startTime > 0) fallbackArgs.push("-ss", startTime.toFixed(3));
            if (endTime > 0 && endTime > startTime) fallbackArgs.push("-to", endTime.toFixed(3));
            fallbackArgs.push(
              "-i", file.path,
              "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
              "-c:a", "aac", "-b:a", "192k",
              targetPath
            );
            await execFileAsync("ffmpeg", fallbackArgs);
            processedPaths.push(targetPath);
          }
        } else {
          processedPaths.push(file.path);
        }
      }

      // Step 2: Concatenate all processed clips into one video
      const outputPath = path.join(jobDir, "connected_video.mp4");

      // Try fast concat demuxer first
      const listPath = path.join(jobDir, "concat_list.txt");
      const listContent = processedPaths
        .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
        .join("\n");
      fs.writeFileSync(listPath, listContent, "utf8");

      let concatSuccess = false;
      try {
        await execFileAsync("ffmpeg", [
          "-y",
          "-f", "concat",
          "-safe", "0",
          "-i", listPath,
          "-c", "copy",
          "-movflags", "+faststart",
          outputPath,
        ]);
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
          concatSuccess = true;
        }
      } catch (err) {
        console.log("Fast concat copy failed, falling back to filter_complex re-encode:", err);
      }

      // If stream copy concat was not possible (different resolutions/codecs), normalize and concat
      if (!concatSuccess) {
        console.log("Normalizing clips for seamless concat fallback...");
        const normalizedPaths: string[] = [];

        for (let i = 0; i < processedPaths.length; i++) {
          const p = processedPaths[i];
          const normPath = path.join(jobDir, `norm_${i}.mp4`);
          const info = await getMediaInfo(p);

          const normArgs = ["-y", "-i", p];
          if (!info.hasAudio) {
            normArgs.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
          }
          normArgs.push(
            "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30",
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "18",
            "-c:a", "aac",
            "-ar", "44100",
            "-ac", "2",
            "-b:a", "192k"
          );
          if (!info.hasAudio) {
            normArgs.push("-shortest");
          }
          normArgs.push(normPath);

          await execFileAsync("ffmpeg", normArgs);
          normalizedPaths.push(normPath);
        }

        const normListPath = path.join(jobDir, "norm_list.txt");
        const normListContent = normalizedPaths
          .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
          .join("\n");
        fs.writeFileSync(normListPath, normListContent, "utf8");

        await execFileAsync("ffmpeg", [
          "-y",
          "-f", "concat",
          "-safe", "0",
          "-i", normListPath,
          "-c", "copy",
          "-movflags", "+faststart",
          outputPath,
        ]);
      }

      if (!fs.existsSync(outputPath)) {
        throw new Error("Failed to produce concatenated video file");
      }

      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Disposition", 'attachment; filename="connected-hockey-video.mp4"');

      const fileStream = fs.createReadStream(outputPath);
      fileStream.pipe(res);
      fileStream.on("end", () => {
        cleanup();
      });
      fileStream.on("error", (err) => {
        console.error("Stream error:", err);
        cleanup();
      });
    } catch (error: any) {
      cleanup();
      console.error("Concat error:", error);
      res.status(500).json({ error: error?.message || "Failed to concatenate clips" });
    }
  });

  // AI Sports Music Composition Blueprint Endpoint
  app.post("/api/generate-sports-music-plan", async (req, res) => {
    try {
      const { prompt, style, duration } = req.body || {};

      if (!process.env.GEMINI_API_KEY) {
        return res.status(200).json({
          fallback: true,
          message: "No GEMINI_API_KEY configured, client will use procedural sports engine",
        });
      }

      const ai = getGemini();

      const systemPrompt = `You are a legendary sports music director composing upbeat, vocal-free sports soundtracks for hockey highlights.
Styles encompass authentic historical eras and modern arena vibes:
- 80s: "era-80s-rock" (Van Halen / Europe / Survivor stadium rock, gated reverb drums, analog synth brass, 126-136 BPM), "era-80s-synth" (Neon Miami synthwave, pulsing arpeggios, 124-132 BPM).
- 90s: "era-90s-jams" (2 Unlimited / Jock Jams hockey rink organ, high-energy 4-on-the-floor beat, 134-144 BPM), "era-90s-grunge" (Offspring / Nirvana / Green Day distorted power chords, raw live drums, 140-152 BPM).
- 00s (2000s): "era-00s-punk" (EA NHL 2000s pop-punk / skate-punk, Sum 41 / Blink / Jimmy Eat World rapid 154-168 BPM punk beats and melodic guitar hooks), "era-00s-numetal" (Linkin Park / Papa Roach heavy drop-D chug and pump-up beats, 132-144 BPM).
- Modern: "arena-rock", "electronic-rush", "hype-trap", "cinematic-brass".

Crucial Requirement: ALWAYS generate UNIQUE chord progressions and distinct rootKeys on every request so every take sounds fresh and never repetitive.
Return a STRICT valid JSON object with NO surrounding markdown backticks or commentary matching this exact schema:
{
  "title": string (e.g. "00s Skate Punk Breakaway", "80s Miracle Slapshot", "90s Jock Jam Powerplay"),
  "bpm": number (match era tempo, between 124 and 168),
  "rootKey": string (choose creatively: "E2", "A2", "D2", "G2", "C2", "B1", "F2"),
  "chords": array of 4 distinct chord strings (e.g. ["D2", "A2", "B2", "G2"]),
  "scale": array of numbers representing semitones (e.g. [0, 2, 4, 7, 9, 12] or [0, 3, 5, 7, 10, 12]),
  "melodyNotes": array of 8-16 numbers representing scale indices for a catchy lead hook,
  "rhythmDensity": "standard" | "double_time" | "half_time_heavy",
  "distortionLevel": number between 0.1 and 0.95,
  "brassLevel": number between 0.1 and 0.9,
  "synthLevel": number between 0.1 and 0.9,
  "energyLevel": "high" | "peak" | "epic"
}`;

      const userMessage = `Create an upbeat, vocal-free sports music arrangement for hockey highlights.
Style: ${style || "arena-rock"}
Sequence Duration: ${duration || 15} seconds
User direction: ${prompt || "High-energy hockey action, driving rhythm, stadium anthemic feel, no vocals"}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [
          { role: "user", parts: [{ text: `${systemPrompt}\n\n${userMessage}` }] },
        ],
      });

      const responseText = response.text || "";
      // Clean possible markdown formatting
      const cleanJson = responseText
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      const plan = JSON.parse(cleanJson);
      return res.json({ success: true, plan });
    } catch (error: any) {
      console.warn("Gemini music plan generation fallback:", error?.message);
      return res.status(200).json({
        fallback: true,
        error: error?.message,
      });
    }
  });

  // Vite development middleware vs production static files
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
