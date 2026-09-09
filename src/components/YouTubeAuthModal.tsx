import React, { useState, useEffect } from 'react';
import {
  Youtube,
  X,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Key,
  ShieldCheck,
  RefreshCw,
  LogOut,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';
import { type User } from 'firebase/auth';
import {
  getAccessToken,
  setManualAccessToken,
  getStoredClientId,
  setStoredClientId,
  hasCustomClientId,
  isExternalDomain,
  googleSignIn,
  logout,
} from '../lib/firebase';
import { getMyYouTubeChannel, type YouTubeChannelInfo } from '../lib/youtube';

interface YouTubeAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onAuthSuccess: (user: User) => void;
  onSignOut: () => void;
}

export const YouTubeAuthModal: React.FC<YouTubeAuthModalProps> = ({
  isOpen,
  onClose,
  user,
  onAuthSuccess,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState<'token' | 'clientid' | 'standard'>('token');
  const [tokenInput, setTokenInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [channelInfo, setChannelInfo] = useState<YouTubeChannelInfo | null>(null);

  const [customClientIdInput, setCustomClientIdInput] = useState(() => getStoredClientId() || '');
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [showDomainHelp, setShowDomainHelp] = useState(false);

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'your-domain';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.vercel.app';
  const isVercelOrExternal = isExternalDomain();

  // On open, test existing token if any
  useEffect(() => {
    if (!isOpen) return;
    const token = getAccessToken();
    if (token) {
      setIsVerifying(true);
      getMyYouTubeChannel(token)
        .then((info) => {
          if (info) {
            setChannelInfo(info);
          }
        })
        .finally(() => setIsVerifying(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApplyToken = async () => {
    const raw = tokenInput.trim();
    if (!raw) {
      setStatusMessage({ type: 'error', text: 'Please paste a valid Google OAuth access token.' });
      return;
    }

    setIsVerifying(true);
    setStatusMessage({ type: 'info', text: 'Verifying token with YouTube Data API...' });

    try {
      const info = await getMyYouTubeChannel(raw);
      if (info) {
        setChannelInfo(info);
        setManualAccessToken(raw, {
          displayName: info.title,
          email: '',
        });
        setStatusMessage({
          type: 'success',
          text: `Successfully connected to YouTube channel: "${info.title}"!`,
        });
        onAuthSuccess({
          displayName: info.title,
          email: info.customUrl || '',
          uid: 'manual-token-user',
        } as any);
      } else {
        // Token accepted even if channel query returns null (e.g. brand accounts)
        setManualAccessToken(raw, {
          displayName: 'Connected YouTube Account',
        });
        setStatusMessage({
          type: 'success',
          text: 'OAuth token accepted and saved. Ready for video upload!',
        });
        onAuthSuccess({
          displayName: 'Connected YouTube Account',
          uid: 'manual-token-user',
        } as any);
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Verification failed: ${err?.message || 'Invalid or expired token'}. Please generate a fresh token.`,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveClientIdAndSignIn = async () => {
    const cleanId = customClientIdInput.trim();
    if (!cleanId) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid Google OAuth Client ID.' });
      return;
    }

    setStoredClientId(cleanId);
    setIsVerifying(true);
    setStatusMessage({ type: 'info', text: 'Opening Google Sign-in with your custom Client ID...' });

    try {
      const res = await googleSignIn({ useGsiOnly: true, clientId: cleanId });
      if (res?.accessToken) {
        const info = await getMyYouTubeChannel(res.accessToken);
        if (info) setChannelInfo(info);
        setStatusMessage({ type: 'success', text: 'Signed in successfully via Google OAuth!' });
        onAuthSuccess(res.user);
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Sign-in failed: ${err?.message || 'Could not complete authorization'}. Make sure ${currentOrigin} is listed in Authorized JavaScript origins.`,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleStandardSignIn = async () => {
    setIsVerifying(true);
    setStatusMessage(null);
    try {
      const res = await googleSignIn();
      if (res?.accessToken) {
        const info = await getMyYouTubeChannel(res.accessToken);
        if (info) setChannelInfo(info);
        setStatusMessage({ type: 'success', text: 'Signed in successfully!' });
        onAuthSuccess(res.user);
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Sign-in failed. Please use Option 1 (OAuth Playground Token) on Vercel.',
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCopyOrigin = () => {
    navigator.clipboard.writeText(currentOrigin);
    setCopiedDomain(true);
    setTimeout(() => setCopiedDomain(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-md shadow-red-950/50">
              <Youtube className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white font-['Chakra_Petch'] tracking-wide">
                CONNECT YOUTUBE
              </h3>
              <p className="text-[11px] text-slate-400">
                Authorize direct hockey shortcut uploads to your YouTube channel
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Status Message Banner */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
                  : statusMessage.type === 'error'
                  ? 'bg-red-950/80 border-red-800 text-red-200'
                  : 'bg-sky-950/80 border-sky-800 text-sky-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : statusMessage.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              ) : (
                <RefreshCw className="w-4 h-4 text-sky-400 shrink-0 mt-0.5 animate-spin" />
              )}
              <div className="flex-1 whitespace-pre-line">{statusMessage.text}</div>
            </div>
          )}

          {/* Connected Account State */}
          {user && getAccessToken() ? (
            <div className="bg-slate-950 border border-emerald-800/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4" />
                  YouTube Channel Connected
                </div>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded font-semibold">
                  Active
                </span>
              </div>

              <div className="flex items-center gap-3 pt-1">
                {channelInfo?.thumbnailUrl ? (
                  <img
                    src={channelInfo.thumbnailUrl}
                    alt="Channel"
                    className="w-12 h-12 rounded-full border-2 border-red-500 shadow"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-red-600/20 border border-red-600/50 flex items-center justify-center text-red-400">
                    <Youtube className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <h4 className="font-bold text-white text-sm">
                    {channelInfo?.title || user.displayName || 'Connected Account'}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {channelInfo?.customUrl || user.email || 'Ready to receive uploaded hockey clips'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={async () => {
                    const token = getAccessToken();
                    if (token) {
                      setIsVerifying(true);
                      try {
                        const info = await getMyYouTubeChannel(token);
                        if (info) {
                          setChannelInfo(info);
                          setStatusMessage({ type: 'success', text: `Verified channel: "${info.title}"` });
                        }
                      } finally {
                        setIsVerifying(false);
                      }
                    }
                  }}
                  disabled={isVerifying}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-700 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
                  Test Channel Connection
                </button>
                <button
                  onClick={() => {
                    logout();
                    setChannelInfo(null);
                    onSignOut();
                    setStatusMessage({ type: 'info', text: 'Disconnected from YouTube.' });
                  }}
                  className="flex items-center gap-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/80 px-3 py-2 rounded-lg text-xs font-semibold transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Notice for Vercel / External Domains explaining the Google Error */}
              {isVercelOrExternal && (
                <div className="bg-amber-950/40 border border-amber-800/70 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-200">
                        Why Google shows &quot;Access blocked: Authorization Error&quot; on Vercel
                      </h4>
                      <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                        Google strictly blocks custom domains (<span className="font-mono text-amber-300 bg-black/40 px-1 py-0.5 rounded">{currentHost}</span>)
                        from opening popup sign-ins unless that domain is authorized in Google Cloud Console.
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-200/90 font-medium pl-6.5">
                    👉 Use <strong className="text-white underline">Option 1 (OAuth Playground Token)</strong> below to connect in 30 seconds with zero setup!
                  </p>
                </div>
              )}

              {/* Method Tabs */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1 text-xs font-medium">
                <button
                  onClick={() => setActiveTab('token')}
                  className={`flex-1 py-2 rounded-lg transition text-center ${
                    activeTab === 'token'
                      ? 'bg-red-600 text-white font-bold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Option 1: OAuth Token (Instant)
                </button>
                <button
                  onClick={() => setActiveTab('clientid')}
                  className={`flex-1 py-2 rounded-lg transition text-center ${
                    activeTab === 'clientid'
                      ? 'bg-slate-800 text-white font-bold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Option 2: Your Google Client ID
                </button>
                {!isVercelOrExternal && (
                  <button
                    onClick={() => setActiveTab('standard')}
                    className={`flex-1 py-2 rounded-lg transition text-center ${
                      activeTab === 'standard'
                        ? 'bg-slate-800 text-white font-bold shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Option 3: Standard Sign-In
                  </button>
                )}
              </div>

              {/* TAB 1: Fast OAuth Playground Token */}
              {activeTab === 'token' && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-red-500" />
                      Instant 0-Setup Connection via Google OAuth Playground
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Generate a temporary Google OAuth access token directly from Google. No developer console setup or API keys required!
                    </p>
                  </div>

                  {/* 3 Step Guide */}
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2 text-[11px]">
                    <div className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-red-600/30 text-red-400 font-bold flex items-center justify-center shrink-0 text-[10px]">
                        1
                      </span>
                      <div className="flex-1">
                        <span>Click to open Google Playground with YouTube scope pre-selected:</span>
                        <div className="mt-1.5">
                          <a
                            href="https://developers.google.com/oauthplayground/#step1&apisSelect=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fyoutube.upload"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs shadow transition"
                          >
                            Open Google OAuth Playground
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 pt-1 border-t border-slate-800/80">
                      <span className="w-4 h-4 rounded-full bg-red-600/30 text-red-400 font-bold flex items-center justify-center shrink-0 text-[10px]">
                        2
                      </span>
                      <span>
                        In Google Playground, click <strong className="text-white">Authorize APIs</strong> and choose your Google account with your YouTube channel.
                      </span>
                    </div>

                    <div className="flex items-start gap-2 pt-1 border-t border-slate-800/80">
                      <span className="w-4 h-4 rounded-full bg-red-600/30 text-red-400 font-bold flex items-center justify-center shrink-0 text-[10px]">
                        3
                      </span>
                      <span>
                        Click <strong className="text-white">Exchange authorization code for tokens</strong>, then copy the generated <strong className="text-white">Access token</strong> (starts with <code className="text-red-400">ya29.a0...</code>).
                      </span>
                    </div>
                  </div>

                  {/* Input Form */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Paste Access Token
                    </label>
                    <input
                      type="password"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      placeholder="ya29.a0AfH6SM..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                    />
                    <button
                      onClick={handleApplyToken}
                      disabled={isVerifying || !tokenInput.trim()}
                      className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2"
                    >
                      {isVerifying ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Verifying with YouTube...</span>
                        </>
                      ) : (
                        <>
                          <Youtube className="w-4 h-4" />
                          <span>Connect YouTube Channel</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: Custom Google Client ID */}
              {activeTab === 'clientid' && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-sky-400" />
                      Configure Your Own Google Cloud OAuth Client ID
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Enables permanent standard one-click &quot;Sign in with Google&quot; on your Vercel deployment.
                    </p>
                  </div>

                  {/* Step Instructions */}
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2 text-[11px] text-slate-300">
                    <p>
                      1. Open <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">Google Cloud Console &gt; Credentials</a> and create an <strong>OAuth 2.0 Client ID (Web Application)</strong>.
                    </p>
                    <p>
                      2. Under <strong>Authorized JavaScript origins</strong>, add your current domain:
                    </p>
                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded font-mono text-[11px] text-white">
                      <span className="truncate flex-1">{currentOrigin}</span>
                      <button
                        onClick={handleCopyOrigin}
                        className="text-sky-400 hover:text-white p-1 rounded shrink-0 flex items-center gap-1 text-[10px]"
                      >
                        {copiedDomain ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedDomain ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p>
                      3. Enable <strong>YouTube Data API v3</strong> in Library and add the scope <code className="text-sky-300">.../auth/youtube.upload</code>.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Google OAuth Web Client ID
                    </label>
                    <input
                      type="text"
                      value={customClientIdInput}
                      onChange={(e) => setCustomClientIdInput(e.target.value)}
                      placeholder="123456789-abcdef.apps.googleusercontent.com"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                    />
                    <button
                      onClick={handleSaveClientIdAndSignIn}
                      disabled={isVerifying || !customClientIdInput.trim()}
                      className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2"
                    >
                      {isVerifying ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Connecting...</span>
                        </>
                      ) : (
                        <>
                          <Youtube className="w-4 h-4" />
                          <span>Save Client ID &amp; Sign In</span>
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-slate-500 text-center">
                      Tip: You can also set environment variable <code className="text-slate-400">VITE_GOOGLE_CLIENT_ID</code> in Vercel Project Settings.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 3: Standard Sign In */}
              {activeTab === 'standard' && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3 text-center">
                  <p className="text-xs text-slate-300">
                    Standard Google Sign-In using Firebase Auth popup for development environments and authorized domains.
                  </p>
                  <button
                    onClick={handleStandardSignIn}
                    disabled={isVerifying}
                    className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-900 px-4 py-2.5 rounded-xl text-xs font-bold shadow transition"
                  >
                    <Youtube className="w-4 h-4 text-red-600" />
                    {isVerifying ? 'Signing in...' : 'Sign in with Google'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Domain: {currentHost}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
