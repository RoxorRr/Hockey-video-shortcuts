import { YouTubeUploadMetadata, YouTubeUploadResult } from '../types';

export interface UploadProgressCallback {
  (progress: {
    phase: 'initializing' | 'uploading' | 'processing' | 'completed' | 'error';
    percent: number;
    loadedBytes: number;
    totalBytes: number;
    message: string;
  }): void;
}

export interface YouTubeChannelInfo {
  id: string;
  title: string;
  thumbnailUrl?: string;
  customUrl?: string;
}

/**
 * Fetch the authenticated user's YouTube Channel info
 */
export async function getMyYouTubeChannel(accessToken: string): Promise<YouTubeChannelInfo | null> {
  try {
    const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (data.items && data.items.length > 0) {
      const item = data.items[0];
      return {
        id: item.id,
        title: item.snippet?.title || 'My YouTube Channel',
        thumbnailUrl: item.snippet?.thumbnails?.default?.url,
        customUrl: item.snippet?.customUrl,
      };
    }
    return null;
  } catch (err) {
    console.warn('Failed to fetch YouTube channel info:', err);
    return null;
  }
}

/**
 * Uploads a video blob to YouTube using Google's Resumable Upload protocol.
 */
export async function uploadVideoToYouTube(
  videoBlob: Blob,
  metadata: YouTubeUploadMetadata,
  accessToken: string,
  onProgress?: UploadProgressCallback,
): Promise<YouTubeUploadResult> {
  if (!accessToken) {
    throw new Error('Missing Google access token. Please sign in with Google first.');
  }

  // Ensure tags include hockey and shorts if relevant
  const tags = [...(metadata.tags || [])];
  if (metadata.isShorts && !tags.includes('Shorts')) {
    tags.unshift('Shorts');
  }
  if (!tags.includes('Hockey')) {
    tags.push('Hockey');
  }

  onProgress?.({
    phase: 'initializing',
    percent: 5,
    loadedBytes: 0,
    totalBytes: videoBlob.size,
    message: 'Initiating YouTube upload session...',
  });

  const metadataPayload = {
    snippet: {
      title: metadata.title.slice(0, 100),
      description: metadata.description || 'Created with Hockey Highlights Video Editor',
      tags: tags.slice(0, 30),
      categoryId: '17', // Sports
      defaultLanguage: 'en',
    },
    status: {
      privacyStatus: metadata.privacyStatus,
      selfDeclaredMadeForKids: false,
      embeddable: true,
    },
  };

  // Step 1: Initiate Resumable Upload Session
  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': String(videoBlob.size),
        'X-Upload-Content-Type': videoBlob.type || 'video/webm',
      },
      body: JSON.stringify(metadataPayload),
    },
  );

  if (!initRes.ok) {
    let errorDetail = 'Failed to initiate YouTube upload.';
    try {
      const errJson = await initRes.json();
      errorDetail = errJson.error?.message || errorDetail;
    } catch {
      errorDetail = `${initRes.status} ${initRes.statusText}`;
    }
    throw new Error(`YouTube API error: ${errorDetail}`);
  }

  const uploadLocation = initRes.headers.get('Location');
  if (!uploadLocation) {
    throw new Error('Google did not return an upload session location header.');
  }

  onProgress?.({
    phase: 'uploading',
    percent: 10,
    loadedBytes: 0,
    totalBytes: videoBlob.size,
    message: 'Uploading video bytes to YouTube...',
  });

  // Step 2: Stream video bytes to the resumable upload URL with real-time XHR progress
  return new Promise<YouTubeUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadLocation, true);
    xhr.setRequestHeader('Content-Type', videoBlob.type || 'video/webm');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        // Map 10% -> 95%
        const percent = Math.min(95, Math.round(10 + (event.loaded / event.total) * 85));
        onProgress?.({
          phase: 'uploading',
          percent,
          loadedBytes: event.loaded,
          totalBytes: event.total,
          message: `Uploading: ${(event.loaded / (1024 * 1024)).toFixed(1)} MB / ${(
            event.total /
            (1024 * 1024)
          ).toFixed(1)} MB (${percent}%)`,
        });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          const videoId = response.id;
          const isShorts = metadata.isShorts;
          const url = isShorts
            ? `https://www.youtube.com/shorts/${videoId}`
            : `https://youtu.be/${videoId}`;

          onProgress?.({
            phase: 'completed',
            percent: 100,
            loadedBytes: videoBlob.size,
            totalBytes: videoBlob.size,
            message: 'Video published successfully to YouTube!',
          });

          resolve({
            videoId,
            url,
            title: metadata.title,
          });
        } catch (e: any) {
          reject(new Error(`Failed to parse YouTube upload response: ${e.message}`));
        }
      } else {
        let errMessage = `YouTube upload failed with status ${xhr.status}`;
        try {
          const resJson = JSON.parse(xhr.responseText);
          if (resJson.error?.message) errMessage = resJson.error.message;
        } catch {
          // ignore
        }
        reject(new Error(errMessage));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error occurred during YouTube video upload.'));
    };

    xhr.send(videoBlob);
  });
}
