import React, { useState, useEffect } from 'react';
import { YouTubeUploadMetadata, YouTubeUploadResult } from '../types';
import { uploadVideoToYouTube, getMyYouTubeChannel, YouTubeChannelInfo } from '../lib/youtube';
import { getAccessToken, googleSignIn, setManualAccessToken } from '../lib/firebase';
import type { User } from 'firebase/auth';
import confetti from 'canvas-confetti';
import {
  X,
  Youtube,
  Upload,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  Key,
  Sparkles,
} from 'lucide-react';

interface YouTubeUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoBlob: Blob | null;
  isShorts: boolean;
  user: User | null;
  onSignIn: (options?: { useGsiOnly?: boolean; clientId?: string }) => Promise<void> | void;
  authError?: string | null;
  onClearAuthError?: () => void;
}

export const YouTubeUploadModal: React.FC<YouTubeUploadModalProps> = ({
  isOpen,
  onClose,
  videoBlob,
  isShorts,
  user,
  onSignIn,
  authError,
  onClearAuthError,
}) => {
  const [title, setTitle] = useState(
    isShorts
      ? 'Insane Hockey Highlights & Top Shelf Goals! 🏒🚨 #Shorts #Hockey'
      : 'Epic Hockey Highlights Montage - Best Goals, Saves & Hits',
  );
  const [description, setDescription] = useState(
    `Check out these unbelievable hockey highlight clips edited together with custom transitions and arena sounds!\n\nEdited with Hockey Highlights Video Editor.\n\n#Hockey #NHL #Shorts #HockeyHighlights #Goals #Saves`,
  );
  const [privacyStatus, setPrivacyStatus] = useState<'public' | 'unlisted' | 'private'>('unlisted');
  const [tagsInput, setTagsInput] = useState('hockey, nhl, sports, shorts, goals, saves, highlights');

  const [channelInfo, setChannelInfo] = useState<YouTubeChannelInfo | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<YouTubeUploadResult | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showManualToken, setShowManualToken] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [manualTokenStatus, setManualTokenStatus] = useState<string | null>(null);
  const [customClientId, setCustomClientId] = useState(() => localStorage.getItem('hockey_editor_google_client_id') || '');
  const [showCustomClientId, setShowCustomClientId] = useState(false);

  // Check channel info if token is available
  useEffect(() => {
    if (!isOpen) return;
    const token = getAccessToken();
    if (token) {
      getMyYouTubeChannel(token).then((info) => {
        if (info) setChannelInfo(info);
      });
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  const addTag = (tagToAdd: string) => {
    const current = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    if (!current.includes(tagToAdd)) {
      current.push(tagToAdd);
      setTagsInput(current.join(', '));
    }
  };

  const handleUpload = async () => {
    if (!videoBlob || videoBlob.size === 0) {
      setUploadError('Please render/export your video before uploading. (Video is empty or not yet rendered)');
      return;
    }

    const token = getAccessToken();
    if (!token) {
      setUploadError('Please connect your Google account with YouTube permissions first.');
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);
      setUploadPercent(5);
      setUploadStatusText('Starting YouTube upload...');

      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const metadata: YouTubeUploadMetadata = {
        title,
        description,
        privacyStatus,
        tags,
        isShorts,
      };

      const result = await uploadVideoToYouTube(videoBlob, metadata, token, (progress) => {
        setUploadPercent(progress.percent);
        setUploadStatusText(progress.message);
      });

      setUploadResult(result);
      setIsUploading(false);

      // Trigger celebratory confetti!
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ef4444', '#38bdf8', '#ffffff', '#f59e0b'],
      });
    } catch (err: any) {
      console.error('YouTube upload failed:', err);
      setIsUploading(false);
      setUploadError(err.message || 'Failed to upload video to YouTube.');
    }
  };

  const handleCopyLink = () => {
    if (uploadResult?.url) {
      navigator.clipboard.writeText(uploadResult.url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleApplyManualToken = async () => {
    const raw = manualTokenInput.trim();
    if (!raw) return;
    setManualTokenStatus('Verifying token with YouTube API...');
    setManualAccessToken(raw);
    try {
      const info = await getMyYouTubeChannel(raw);
      if (info) {
        setChannelInfo(info);
        setManualTokenStatus(`Connected to YouTube channel: ${info.title}`);
        setShowManualToken(false);
      } else {
        setManualTokenStatus('Token accepted! (Channel info could not be fetched, but ready for upload)');
        setShowManualToken(false);
      }
    } catch (err: any) {
      setManualTokenStatus(`Token applied. Note: ${err.message || 'Ready for upload attempt'}`);
      setShowManualToken(false);
    }
  };

  const handleSaveCustomClientId = () => {
    const cid = customClientId.trim();
    if (cid) {
      localStorage.setItem('hockey_editor_google_client_id', cid);
    } else {
      localStorage.removeItem('hockey_editor_google_client_id');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white shadow shadow-red-950/50">
              <Youtube className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white font-['Chakra_Petch'] tracking-wide">
                UPLOAD TO YOUTUBE
              </h3>
              <p className="text-[11px] text-slate-400">
                {isShorts ? 'Publishing as YouTube Shorts (9:16)' : 'Publishing to your YouTube channel'}
              </p>
            </div>
          </div>
          {!isUploading && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {uploadResult ? (
            /* Success screen */
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-['Chakra_Petch'] font-black text-xl text-white tracking-wide">
                  UPLOADED TO YOUTUBE!
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Your hockey highlight video is now processing on YouTube.
                </p>
              </div>

              {/* URL Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 text-left">
                <div className="truncate flex-1">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Video Link</span>
                  <a
                    href={uploadResult.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-sky-400 font-mono hover:underline truncate block"
                  >
                    {uploadResult.url}
                  </a>
                </div>
                <button
                  onClick={handleCopyLink}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition shrink-0"
                  title="Copy video link"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex gap-3 pt-2">
                <a
                  href={uploadResult.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-lg shadow-red-950/50 font-['Chakra_Petch']"
                >
                  <ExternalLink className="w-4 h-4" />
                  Watch on YouTube
                </a>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition"
                >
                  Done
                </button>
              </div>
            </div>
          ) : isUploading ? (
            /* Uploading Progress */
            <div className="py-8 space-y-5 text-center">
              <div className="w-16 h-16 rounded-full bg-red-950/60 border border-red-800/60 text-red-500 flex items-center justify-center mx-auto animate-pulse">
                <Upload className="w-7 h-7" />
              </div>

              <div>
                <h4 className="font-['Chakra_Petch'] font-bold text-lg text-white mb-1">
                  UPLOADING TO YOUTUBE...
                </h4>
                <p className="text-xs text-slate-400">{uploadStatusText}</p>
              </div>

              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-red-600 to-sky-500 h-full transition-all duration-300"
                  style={{ width: `${uploadPercent}%` }}
                ></div>
              </div>

              <span className="font-['Chakra_Petch'] text-sm font-bold text-slate-300">
                {uploadPercent}% Complete
              </span>
            </div>
          ) : (
            /* Upload Configuration Form */
            <div className="space-y-4">
              {/* Video File Status Badge */}
              {videoBlob && videoBlob.size > 0 ? (
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-slate-300 font-medium">Rendered Video File</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/50">
                    {(videoBlob.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
              ) : (
                <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-3 flex items-center gap-2.5 text-xs text-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Video has not been exported yet. Click Export first or it will render automatically.</span>
                </div>
              )}

              {/* Account Card / Google Sign-in */}
              {user && getAccessToken() ? (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-600/20 border border-red-500/40 text-red-400 flex items-center justify-center font-bold text-xs">
                      {channelInfo?.title ? channelInfo.title[0] : (user.displayName?.[0] || 'Y')}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">
                        {channelInfo?.title || user.displayName || 'Connected Account'}
                      </p>
                      <p className="text-[11px] text-slate-400">{user.email}</p>
                    </div>
                  </div>
                  <span className="text-[10px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800/60 font-semibold">
                    Ready to Upload
                  </span>
                </div>
              ) : (
                <div className="bg-slate-950 border border-amber-900/60 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-white">YouTube Authorization Required</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Connect your Google account with YouTube permissions to upload your hockey videos directly.
                      </p>
                    </div>
                  </div>

                  {/* Auth Error Banner if sign-in failed */}
                  {authError && (
                    <div className="bg-red-950/80 border border-red-800 rounded-lg p-3 text-xs text-red-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold flex items-center gap-1.5 text-red-300">
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                          Sign-in Notice:
                        </span>
                        {onClearAuthError && (
                          <button
                            onClick={onClearAuthError}
                            className="text-[10px] text-slate-400 hover:text-white"
                          >
                            Dismiss
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] font-mono break-all">{authError}</p>

                      {/* Domain whitelist guidance for Vercel */}
                      <div className="pt-1 text-[11px] text-amber-200/90 border-t border-red-900/60 mt-1">
                        <p className="font-semibold text-amber-300">Fixing on Vercel / Custom Domain:</p>
                        <p className="mt-0.5 text-slate-300">
                          Add your current domain <span className="font-mono text-white bg-black/40 px-1 py-0.5 rounded">{typeof window !== 'undefined' ? window.location.hostname : 'your-domain'}</span> to <strong className="text-white">Firebase Console &gt; Authentication &gt; Settings &gt; Authorized domains</strong>.
                        </p>
                        <p className="mt-1 text-slate-300">
                          Alternatively, use <strong className="text-white">Option B (Direct Google Identity)</strong> or <strong className="text-white">Option C (OAuth Playground Token)</strong> below!
                        </p>
                      </div>
                    </div>
                  )}

                  {manualTokenStatus && (
                    <div className="bg-sky-950/60 border border-sky-800/80 rounded-lg p-2.5 text-xs text-sky-200">
                      {manualTokenStatus}
                    </div>
                  )}

                  {/* Option 1: Standard Firebase Sign in with Google */}
                  <button
                    disabled={isSigningIn}
                    onClick={async () => {
                      setIsSigningIn(true);
                      try {
                        await onSignIn({ clientId: customClientId.trim() || undefined });
                      } finally {
                        setIsSigningIn(false);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-900 px-4 py-2.5 rounded-xl text-xs font-bold shadow transition"
                  >
                    <Youtube className="w-4 h-4 text-red-600" />
                    {isSigningIn ? 'Opening Google Sign-in...' : 'Sign in with Google (Standard)'}
                  </button>

                  {/* Option 2: Direct Google Identity Services (GSI) */}
                  <button
                    disabled={isSigningIn}
                    onClick={async () => {
                      setIsSigningIn(true);
                      try {
                        await onSignIn({ useGsiOnly: true, clientId: customClientId.trim() || undefined });
                      } finally {
                        setIsSigningIn(false);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-750 text-slate-200 px-3 py-2 rounded-xl text-xs font-medium border border-slate-700 transition"
                  >
                    <Key className="w-3.5 h-3.5 text-sky-400" />
                    Direct Google OAuth (Recommended for Vercel)
                  </button>

                  {/* Option 3: Manual OAuth Token Input */}
                  <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
                    <button
                      type="button"
                      onClick={() => setShowManualToken(!showManualToken)}
                      className="text-sky-400 hover:text-sky-300 underline"
                    >
                      {showManualToken ? 'Hide manual token input' : 'Paste OAuth Token (Instant / 0-setup)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCustomClientId(!showCustomClientId)}
                      className="text-slate-400 hover:text-slate-200 underline text-[10px]"
                    >
                      {showCustomClientId ? 'Hide Client ID' : 'Custom Client ID'}
                    </button>
                  </div>

                  {showManualToken && (
                    <div className="space-y-2.5 pt-2 border-t border-slate-800 bg-slate-900/50 p-3 rounded-lg">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-300">Google OAuth Bearer Token</span>
                        <a
                          href="https://developers.google.com/oauthplayground/#step1&apisSelect=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fyoutube.upload"
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-sky-400 hover:text-sky-300 font-medium"
                        >
                          Get Token in Google Playground
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        In OAuth Playground: select &quot;YouTube Data API v3 &gt; .../auth/youtube.upload&quot;, click Authorize APIs, then exchange for tokens and copy the Access token.
                      </p>
                      <input
                        type="password"
                        value={manualTokenInput}
                        onChange={(e) => setManualTokenInput(e.target.value)}
                        placeholder="ya29.a0AfH6SM..."
                        className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-500"
                      />
                      <button
                        type="button"
                        onClick={handleApplyManualToken}
                        className="w-full bg-red-600 hover:bg-red-500 text-xs font-bold text-white py-1.5 rounded transition"
                      >
                        Apply &amp; Verify Token
                      </button>
                    </div>
                  )}

                  {showCustomClientId && (
                    <div className="space-y-2 pt-2 border-t border-slate-800 bg-slate-900/50 p-3 rounded-lg">
                      <label className="block text-[11px] font-semibold text-slate-300">
                        Custom Google OAuth Client ID (Optional)
                      </label>
                      <p className="text-[10px] text-slate-400">
                        If you have your own Google Cloud Web Client ID with authorized origins set to your Vercel URL.
                      </p>
                      <input
                        type="text"
                        value={customClientId}
                        onChange={(e) => setCustomClientId(e.target.value)}
                        placeholder="your-client-id.apps.googleusercontent.com"
                        className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                      />
                      <button
                        type="button"
                        onClick={handleSaveCustomClientId}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-xs text-white py-1 rounded transition"
                      >
                        Save Client ID for this browser
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Title input */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                  Video Title
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  placeholder="e.g. McDavid Top Shelf Laser Snapper #Shorts #Hockey"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>Hashtags like #Shorts help YouTube categorize it as a Short</span>
                  <span>{title.length}/100</span>
                </div>
              </div>

              {/* Quick Hashtag Chips */}
              <div className="flex flex-wrap gap-1.5">
                {['#Shorts', '#Hockey', '#NHL', '#TopShelf', '#Goal', '#Highlights'].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      if (!title.includes(chip)) {
                        setTitle((prev) => `${prev} ${chip}`.slice(0, 100));
                      }
                    }}
                    className="text-[11px] bg-slate-800 hover:bg-slate-750 text-slate-300 px-2 py-0.5 rounded border border-slate-700 transition"
                  >
                    + {chip}
                  </button>
                ))}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none resize-none"
                  placeholder="Tell viewers about this hockey shortcut montage..."
                />
              </div>

              {/* Privacy Status */}
              <div className="grid grid-cols-3 gap-2">
                {(['unlisted', 'public', 'private'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setPrivacyStatus(status)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold capitalize transition ${
                      privacyStatus === status
                        ? 'bg-red-600/20 border-red-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wider">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-red-500 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>

              {uploadError && (
                <div className="bg-red-950/60 border border-red-800/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-red-200">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!uploadResult && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-950/60 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              id="confirm-youtube-upload-btn"
              type="button"
              disabled={isUploading || !videoBlob}
              onClick={handleUpload}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 transition shadow-lg shadow-red-950/50 uppercase tracking-wider font-['Chakra_Petch']"
            >
              <Upload className="w-4 h-4" />
              Upload Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
