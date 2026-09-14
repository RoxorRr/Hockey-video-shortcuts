import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "hockey-highlight-editor" });
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

      const systemPrompt = `You are a sports music director and audio producer composing an upbeat, instrumental background soundtrack for high-energy hockey highlights.
Return a STRICT valid JSON object with NO surrounding markdown backticks or commentary matching this exact schema:
{
  "title": string (e.g. "Overtime Powerplay Rush"),
  "bpm": number (between 124 and 144),
  "rootKey": string (one of "E2", "A2", "D2", "G2", "C2"),
  "chords": array of strings (e.g. ["E2", "G2", "A2", "C3"]),
  "scale": array of numbers representing semitones (e.g. [0, 3, 5, 7, 10, 12]),
  "melodyNotes": array of 8-12 numbers representing scale indices,
  "rhythmDensity": "standard" | "double_time" | "half_time_heavy",
  "distortionLevel": number between 0.1 and 0.85,
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
