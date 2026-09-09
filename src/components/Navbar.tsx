import React from 'react';
import { AspectRatio } from '../types';
import { Film, Youtube, Volume2, Download, Upload, User as UserIcon, LogOut, CheckCircle2 } from 'lucide-react';
import type { User } from 'firebase/auth';
import { playGoalHorn } from '../lib/audio';

interface NavbarProps {
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  user: User | null;
  channelTitle?: string;
  onSignIn: () => void;
  onSignOut: () => void;
  onExport: () => void;
  onOpenUpload: () => void;
  onClearProject?: () => void;
  isExporting: boolean;
  clipsCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  aspectRatio,
  onAspectRatioChange,
  user,
  channelTitle,
  onSignIn,
  onSignOut,
  onExport,
  onOpenUpload,
  onClearProject,
  isExporting,
  clipsCount,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-600 to-sky-600 flex items-center justify-center text-white shadow-lg shadow-red-950/40">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-xl tracking-wider text-white font-['Chakra_Petch']">
                  PUCK<span className="text-red-500">CUT</span>
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-sky-950/80 text-sky-400 font-semibold border border-sky-800/60">
                  SHORTS
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">Hockey Highlights & Montage Editor</p>
            </div>
          </div>

          {/* Goal horn test sound */}
          <button
            id="nav-goal-horn-btn"
            onClick={() => playGoalHorn(2.5)}
            title="Play Arena Goal Horn sound effect"
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-red-400 bg-slate-800/80 hover:bg-slate-800 px-2.5 py-1.5 rounded-md border border-slate-700 transition"
          >
            <Volume2 className="w-3.5 h-3.5 text-red-500" />
            <span className="hidden sm:inline">Horn FX</span>
          </button>
        </div>

        {/* Aspect Ratio & Format Controls */}
        <div className="flex items-center gap-2 bg-slate-950/60 p-1 rounded-lg border border-slate-800">
          <button
            id="aspect-9-16-btn"
            onClick={() => onAspectRatioChange('9:16')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
              aspectRatio === '9:16'
                ? 'bg-red-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="w-2.5 h-4 border border-current rounded-xs inline-block"></span>
            <span>9:16 Shorts</span>
          </button>

          <button
            id="aspect-16-9-btn"
            onClick={() => onAspectRatioChange('16:9')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
              aspectRatio === '16:9'
                ? 'bg-red-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="w-4 h-2.5 border border-current rounded-xs inline-block"></span>
            <span>16:9 Widescreen</span>
          </button>

          <button
            id="aspect-1-1-btn"
            onClick={() => onAspectRatioChange('1:1')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
              aspectRatio === '1:1'
                ? 'bg-red-600 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="w-3 h-3 border border-current rounded-xs inline-block"></span>
            <span>1:1 Square</span>
          </button>
        </div>

        {/* Action Buttons & Google Account */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {/* YouTube Auth Status */}
          {user ? (
            <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 px-2.5 py-1.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={onSignIn}
                className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer transition"
                title="View or manage YouTube connection"
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate max-w-[120px]" title={channelTitle || user.email || 'YouTube'}>
                  {channelTitle || user.displayName || user.email?.split('@')[0]}
                </span>
              </button>
              <button
                id="sign-out-btn"
                onClick={onSignOut}
                title="Sign out of YouTube"
                className="text-slate-400 hover:text-red-400 ml-1 p-0.5"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              id="google-sign-in-btn"
              onClick={onSignIn}
              className="flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-900 px-3 py-1.5 rounded-lg text-xs font-semibold shadow transition"
            >
              <Youtube className="w-4 h-4 text-red-600" />
              <span>Connect YouTube</span>
            </button>
          )}

          {/* New Project / Clear */}
          {clipsCount > 0 && onClearProject && (
            <button
              id="nav-new-project-btn"
              onClick={onClearProject}
              title="Clear current timeline and start new video"
              className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-red-950/60 text-slate-300 hover:text-red-300 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700/80 hover:border-red-800 transition"
            >
              <span>New Project</span>
            </button>
          )}

          {/* Export Video */}
          <button
            id="export-video-btn"
            onClick={onExport}
            disabled={clipsCount === 0 || isExporting}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 transition shadow"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span>{isExporting ? 'Exporting...' : 'Export'}</span>
          </button>

          {/* Upload to YouTube */}
          <button
            id="open-youtube-upload-btn"
            onClick={onOpenUpload}
            disabled={clipsCount === 0}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide shadow-lg shadow-red-900/30 transition uppercase font-['Chakra_Petch']"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload to YouTube</span>
          </button>
        </div>
      </div>
    </header>
  );
};
