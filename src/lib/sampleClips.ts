import { AspectRatio, VideoClip } from '../types';

/**
 * Procedurally generates an action-packed hockey highlight video clip
 * using an offscreen canvas and MediaRecorder.
 */
function createSyntheticHockeyVideo(
  title: string,
  type: 'goal' | 'save' | 'hit' | 'ot',
  durationSec = 3.5,
  aspectRatio: AspectRatio = '9:16',
): Promise<VideoClip> {
  return new Promise((resolve) => {
    let width = 720;
    let height = 1280;
    if (aspectRatio === '16:9') {
      width = 1280;
      height = 720;
    } else if (aspectRatio === '1:1') {
      width = 1080;
      height = 1080;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const stream = canvas.captureStream(30);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 2500000,
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    let thumbnailDataUrl = '';
    const totalFrames = Math.round(durationSec * 30);
    let frame = 0;

    // Background rink elements
    const isShorts = aspectRatio === '9:16';
    const centerX = width / 2;
    const centerY = height / 2;

    const drawFrame = () => {
      const progress = frame / totalFrames;
      const t = progress * durationSec;

      // Draw Ice Rink Surface
      const iceGrad = ctx.createLinearGradient(0, 0, width, height);
      iceGrad.addColorStop(0, '#e8f4f8');
      iceGrad.addColorStop(0.5, '#d9ebf3');
      iceGrad.addColorStop(1, '#c8e2ed');
      ctx.fillStyle = iceGrad;
      ctx.fillRect(0, 0, width, height);

      // Subtle ice skate scratch marks
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        const sx = ((i * 187 + frame * 3) % width);
        const sy = ((i * 231) % height);
        ctx.moveTo(sx - 40, sy - 15);
        ctx.bezierCurveTo(sx, sy + 20, sx + 20, sy - 10, sx + 50, sy + 10);
        ctx.stroke();
      }

      // Hockey Rink Red Line / Blue Line
      ctx.save();
      ctx.strokeStyle = 'rgba(217, 38, 38, 0.6)'; // Red center line
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      // Faceoff circle
      ctx.strokeStyle = 'rgba(217, 38, 38, 0.4)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(centerX, centerY, isShorts ? 140 : 180, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Rink Boards & Glass at the top
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, width, isShorts ? 120 : 70);
      ctx.fillStyle = '#0284c7'; // Blue banner trim
      ctx.fillRect(0, (isShorts ? 120 : 70) - 8, width, 8);

      // Action Scene Rendering based on clip type
      if (type === 'goal') {
        // Hockey Goal Net
        const netW = isShorts ? 320 : 420;
        const netH = isShorts ? 200 : 260;
        const netX = centerX - netW / 2;
        const netY = centerY - (isShorts ? 280 : 180);

        // Goal frame (Red posts)
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 14;
        ctx.strokeRect(netX, netY, netW, netH);

        // Netting lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        for (let x = netX + 20; x < netX + netW; x += 25) {
          ctx.beginPath();
          ctx.moveTo(x, netY);
          ctx.lineTo(x, netY + netH);
          ctx.stroke();
        }
        for (let y = netY + 20; y < netY + netH; y += 25) {
          ctx.beginPath();
          ctx.moveTo(netX, y);
          ctx.lineTo(netX + netW, y);
          ctx.stroke();
        }

        // Puck projectile
        const puckStartX = centerX - 180;
        const puckStartY = height - 200;
        const puckTargetX = netX + netW * 0.82; // Top right shelf!
        const puckTargetY = netY + 45;

        const puckP = Math.min(1, t / 1.6);
        const puckX = puckStartX + (puckTargetX - puckStartX) * puckP;
        const puckY = puckStartY + (puckTargetY - puckStartY) * puckP - Math.sin(puckP * Math.PI) * 40;

        // Puck blur trail
        ctx.fillStyle = 'rgba(15, 23, 42, 0.3)';
        ctx.beginPath();
        ctx.arc(puckX - 15, puckY + 5, 14, 0, Math.PI * 2);
        ctx.fill();

        // Puck
        ctx.fillStyle = '#09090b';
        ctx.beginPath();
        ctx.arc(puckX, puckY, 16, 0, Math.PI * 2);
        ctx.fill();

        // Goal celebration strobe after puck enters net
        if (t > 1.6) {
          const flashPhase = Math.floor((t - 1.6) * 8) % 2 === 0;
          if (flashPhase) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
            ctx.fillRect(0, 0, width, height);

            // Red goal siren icon at top
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(centerX, isShorts ? 220 : 120, 36, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px Chakra Petch, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('🚨', centerX, isShorts ? 228 : 128);
          }

          // "GOAL" dynamic text
          ctx.save();
          ctx.shadowColor = 'rgba(220, 38, 38, 0.8)';
          ctx.shadowBlur = 25;
          ctx.fillStyle = '#dc2626';
          ctx.font = `italic 900 ${isShorts ? '72px' : '64px'} Chakra Petch, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('TOP SHELF GOAL!', centerX, centerY + (isShorts ? 180 : 120));
          ctx.restore();
        }
      } else if (type === 'save') {
        // Goalie Glove Save animation
        const gloveX = centerX + Math.sin(t * 4) * 80;
        const gloveY = centerY - 50;

        // Goalie pad silhouette
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.roundRect(centerX - 100, centerY - 80, 200, 180, 20);
        ctx.fill();

        // Goalie Trapper Glove
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.arc(gloveX, gloveY, 55, 0, Math.PI * 2);
        ctx.fill();

        // Puck trapped
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(gloveX + 10, gloveY - 10, 18, 0, Math.PI * 2);
        ctx.fill();

        // Save banner
        ctx.save();
        ctx.fillStyle = '#0284c7';
        ctx.font = `italic 900 ${isShorts ? '68px' : '56px'} Chakra Petch, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('ROBBERY! GLOVE SAVE', centerX, centerY + (isShorts ? 220 : 160));
        ctx.restore();
      } else if (type === 'hit') {
        // Big open ice hit / collision effect
        const hitP = Math.min(1, t / 1.4);
        const p1X = centerX - 260 + hitP * 200;
        const p2X = centerX + 260 - hitP * 200;

        // Skaters
        ctx.fillStyle = '#b91c1c';
        ctx.beginPath();
        ctx.arc(p1X, centerY, 48, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#1d4ed8';
        ctx.beginPath();
        ctx.arc(p2X, centerY, 48, 0, Math.PI * 2);
        ctx.fill();

        // Impact spark shockwave
        if (t > 1.4) {
          const impactP = (t - 1.4) / (durationSec - 1.4);
          ctx.strokeStyle = `rgba(255, 255, 255, ${1 - impactP})`;
          ctx.lineWidth = 18 * (1 - impactP);
          ctx.beginPath();
          ctx.arc(centerX, centerY, impactP * 300, 0, Math.PI * 2);
          ctx.stroke();

          // Ice spray particles
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          for (let p = 0; p < 25; p++) {
            const angle = (p / 25) * Math.PI * 2;
            const dist = impactP * 240 + (p % 5) * 15;
            ctx.fillRect(
              centerX + Math.cos(angle) * dist,
              centerY + Math.sin(angle) * dist,
              8,
              8,
            );
          }

          ctx.fillStyle = '#e11d48';
          ctx.font = `italic 900 ${isShorts ? '76px' : '64px'} Chakra Petch, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('💥 HUGE HIT!', centerX, centerY + (isShorts ? 200 : 150));
        }
      } else {
        // Overtime winner slapshot
        ctx.fillStyle = '#ea580c';
        ctx.font = `italic 900 ${isShorts ? '68px' : '60px'} Chakra Petch, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('OT GAME WINNER!', centerX, centerY + (isShorts ? 120 : 80));

        // Pulsing puck center
        const scale = 1 + Math.sin(t * 6) * 0.15;
        ctx.save();
        ctx.translate(centerX, centerY - 60);
        ctx.scale(scale, scale);
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(0, 0, 36, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Save mid-frame thumbnail
      if (frame === Math.round(totalFrames / 2)) {
        thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      }

      frame++;
      if (frame < totalFrames) {
        requestAnimationFrame(drawFrame);
      } else {
        recorder.stop();
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const tag = type === 'goal' ? 'GOAL' : type === 'save' ? 'SAVE' : type === 'hit' ? 'HIT' : 'OT WINNER';

      resolve({
        id: `sample-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: title,
        url,
        blob,
        originalDuration: durationSec,
        startTime: 0,
        endTime: durationSec,
        volume: 1,
        playbackRate: 1,
        thumbnailUrl: thumbnailDataUrl,
        tag,
      });
    };

    recorder.start(100);
    drawFrame();
  });
}

/**
 * Generates a default set of 3 exciting hockey clips for instant shortcut creation
 */
export async function generateSampleHockeyClips(aspectRatio: AspectRatio = '9:16'): Promise<VideoClip[]> {
  const [clip1, clip2, clip3] = await Promise.all([
    createSyntheticHockeyVideo('Snipe Goal 2026-09-08 19-30-15', 'goal', 3.2, aspectRatio),
    createSyntheticHockeyVideo('Glove Save 2026-09-08 20-14-40', 'save', 3.0, aspectRatio),
    createSyntheticHockeyVideo('OT Winner 2026-09-08 20-42-26', 'ot', 3.4, aspectRatio),
  ]);

  clip1.recordedAt = new Date(2026, 8, 8, 19, 30, 15).getTime();
  clip1.recordedAtDisplay = '2026-09-08 19:30:15';
  clip1.hasFilenameTimestamp = true;

  clip2.recordedAt = new Date(2026, 8, 8, 20, 14, 40).getTime();
  clip2.recordedAtDisplay = '2026-09-08 20:14:40';
  clip2.hasFilenameTimestamp = true;

  clip3.recordedAt = new Date(2026, 8, 8, 20, 42, 26).getTime();
  clip3.recordedAtDisplay = '2026-09-08 20:42:26';
  clip3.hasFilenameTimestamp = true;

  clip1.useCustomOverlays = true;
  clip1.scorebugOverride = {
    enabled: true,
    awayTeam: 'BOS',
    homeTeam: 'NYR',
    awayScore: 0,
    homeScore: 1,
    period: '1ST',
    timeRemaining: '0:18',
  };
  clip1.playerBannerOverride = {
    enabled: true,
    jerseyNumber: '97',
    playerName: 'Connor McDavid',
    actionText: 'Top Shelf Laser Snapper 🚨',
  };

  clip2.useCustomOverlays = true;
  clip2.scorebugOverride = {
    enabled: true,
    awayTeam: 'BOS',
    homeTeam: 'NYR',
    awayScore: 1,
    homeScore: 1,
    period: '2ND',
    timeRemaining: '14:22',
  };
  clip2.playerBannerOverride = {
    enabled: true,
    jerseyNumber: '31',
    playerName: 'Igor Shesterkin',
    actionText: 'Robbery with the Glove 🧤',
  };

  clip3.useCustomOverlays = true;
  clip3.scorebugOverride = {
    enabled: true,
    awayTeam: 'BOS',
    homeTeam: 'NYR',
    awayScore: 3,
    homeScore: 2,
    period: 'OT',
    timeRemaining: '0:45',
  };
  clip3.playerBannerOverride = {
    enabled: true,
    jerseyNumber: '88',
    playerName: 'David Pastrňák',
    actionText: 'OT Slapshot Rocket 🚨',
  };

  return [clip1, clip2, clip3];
}
