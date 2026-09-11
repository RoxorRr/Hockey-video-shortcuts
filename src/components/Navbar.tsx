import React, { useState, useEffect, useRef } from 'react';
import { AspectRatio } from '../types';
import {
  Film,
  Youtube,
  Volume2,
  Download,
  Upload,
  LogOut,
  CheckCircle2,
  Maximize2,
  Minimize2,
  ChevronDown,
  Plus,
  Check,
  Clapperboard,
} from 'lucide-react';
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const logoMenuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (logoMenuRef.current && !logoMenuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 shrink-0 z-30 px-3 lg:px-4 py-2 select-none">
      <div className="w-full flex items-center justify-between gap-2 lg:gap-4">
        {/* Logo & Dropdown Menu Trigger */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative" ref={logoMenuRef}>
            <button
              id="nav-logo-menu-btn"
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className={`flex items-center gap-2.5 p-1.5 rounded-xl border transition cursor-pointer select-none group ${
                isMenuOpen
                  ? 'bg-slate-800 border-sky-500/60 shadow-lg shadow-sky-950/40'
                  : 'hover:bg-slate-800/80 border-transparent hover:border-slate-700'
              }`}
              aria-expanded={isMenuOpen}
              aria-haspopup="true"
              title="Click logo icon for Project actions, Export & Aspect Ratios"
            >
              {/* Logo Icon with Menu Badge */}
              <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-red-600 to-sky-600 flex items-center justify-center text-white shadow-md shadow-red-950/40 group-hover:scale-105 transition-transform">
                <Film className="w-4 h-4" />
                <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-slate-900 border border-slate-700 rounded-full flex items-center justify-center text-slate-300 shadow">
                  <ChevronDown
                    className={`w-2.5 h-2.5 transition-transform duration-200 ${
                      isMenuOpen ? 'rotate-180 text-sky-400' : 'text-slate-400'
                    }`}
                  />
                </span>
              </div>

              {/* Brand Label */}
              <div className="text-left">
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-black text-lg tracking-wider text-white font-['Chakra_Petch']">
                    PUCK<span className="text-red-500">CUT</span>
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950/80 text-sky-400 font-bold border border-sky-800/60">
                    PRO
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                  <span className="text-amber-400 font-bold font-mono">{aspectRatio}</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-300 group-hover:text-white flex items-center gap-0.5">
                    Studio Menu
                    <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
                  </span>
                </div>
              </div>
            </button>

            {/* Menu Dropdown anchored inside the logo icon */}
            {isMenuOpen && (
              <div className="absolute top-full left-0 mt-2 w-80 bg-slate-950/98 backdrop-blur-xl border border-slate-700/90 rounded-2xl shadow-2xl z-50 p-4 space-y-4 animate-in fade-in zoom-in-95 duration-150">
                {/* Header inside logo menu */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-red-600 flex items-center justify-center text-white text-xs font-black shadow">
                      <Clapperboard className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider font-['Chakra_Petch']">
                        PuckCut Studio Menu
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        {clipsCount} {clipsCount === 1 ? 'clip' : 'clips'} on timeline
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800/60">
                    {aspectRatio}
                  </span>
                </div>

                {/* 1. Aspect Ratio Controls (9:16, 16:9, 1:1) */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-['Chakra_Petch'] flex items-center justify-between">
                    <span>Aspect Ratio</span>
                    <span className="text-[10px] text-slate-500 font-normal lowercase">canvas format</span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800">
                    {/* 9:16 Shorts */}
                    <button
                      id="aspect-9-16-btn"
                      type="button"
                      onClick={() => onAspectRatioChange('9:16')}
                      className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        aspectRatio === '9:16'
                          ? 'bg-red-600 text-white shadow-md shadow-red-950/60'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                      }`}
                      title="9:16 Vertical Shorts, TikTok & Reels"
                    >
                      <div className="w-3 h-5 border-2 border-current rounded-xs mb-1 flex items-center justify-center">
                        {aspectRatio === '9:16' && <div className="w-1 h-1 bg-current rounded-full" />}
                      </div>
                      <span className="text-[11px] font-bold">9:16</span>
                      <span className="text-[9px] opacity-75 font-normal">Shorts</span>
                    </button>

                    {/* 16:9 Widescreen */}
                    <button
                      id="aspect-16-9-btn"
                      type="button"
                      onClick={() => onAspectRatioChange('16:9')}
                      className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        aspectRatio === '16:9'
                          ? 'bg-red-600 text-white shadow-md shadow-red-950/60'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                      }`}
                      title="16:9 Standard Landscape / YouTube Widescreen"
                    >
                      <div className="w-5 h-3 border-2 border-current rounded-xs mb-2 flex items-center justify-center">
                        {aspectRatio === '16:9' && <div className="w-1 h-1 bg-current rounded-full" />}
                      </div>
                      <span className="text-[11px] font-bold">16:9</span>
                      <span className="text-[9px] opacity-75 font-normal">Wide</span>
                    </button>

                    {/* 1:1 Square */}
                    <button
                      id="aspect-1-1-btn"
                      type="button"
                      onClick={() => onAspectRatioChange('1:1')}
                      className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        aspectRatio === '1:1'
                          ? 'bg-red-600 text-white shadow-md shadow-red-950/60'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                      }`}
                      title="1:1 Square Feed Format"
                    >
                      <div className="w-3.5 h-3.5 border-2 border-current rounded-xs mb-1.5 flex items-center justify-center">
                        {aspectRatio === '1:1' && <div className="w-1 h-1 bg-current rounded-full" />}
                      </div>
                      <span className="text-[11px] font-bold">1:1</span>
                      <span className="text-[9px] opacity-75 font-normal">Square</span>
                    </button>
                  </div>
                </div>

                {/* 2. Export & Project Actions */}
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-['Chakra_Petch']">
                    Export &amp; Project
                  </div>

                  {/* Export Video Button */}
                  <button
                    id="export-video-btn"
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onExport();
                    }}
                    disabled={clipsCount === 0 || isExporting}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800/90 text-slate-200 hover:text-white border border-slate-700/80 hover:border-slate-600 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer group shadow"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-sky-950 border border-sky-800/80 text-sky-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Download className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-bold font-['Chakra_Petch'] tracking-wide">
                          {isExporting ? 'Exporting Video...' : 'Export'}
                        </div>
                        <div className="text-[10px] text-slate-400">Render and download MP4 video</div>
                      </div>
                    </div>
                  </button>

                  {/* Export to YouTube Button */}
                  <button
                    id="open-youtube-upload-btn"
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenUpload();
                    }}
                    disabled={clipsCount === 0}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white border border-red-500 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer group shadow-lg shadow-red-950/50"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-black/30 border border-white/20 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Youtube className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-extrabold font-['Chakra_Petch'] tracking-wide uppercase">
                          Export to YouTube
                        </div>
                        <div className="text-[10px] text-red-100">Publish clip directly to channel</div>
                      </div>
                    </div>
                    <Upload className="w-3.5 h-3.5 text-red-200" />
                  </button>

                  {/* New Project Button */}
                  {onClearProject && (
                    <button
                      id="nav-new-project-btn"
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onClearProject();
                      }}
                      disabled={clipsCount === 0}
                      className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-900/60 hover:bg-red-950/40 text-slate-400 hover:text-red-300 border border-slate-800 hover:border-red-800/60 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Clear timeline and start fresh project"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center text-slate-400">
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-semibold">New Project</span>
                      </div>
                      <span className="text-[10px] text-slate-500">Clear Timeline</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Goal horn sound test button */}
          <button
            id="nav-goal-horn-btn"
            type="button"
            onClick={() => playGoalHorn(2.5)}
            title="Play Arena Goal Horn sound effect"
            className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-red-400 bg-slate-800/80 hover:bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 transition cursor-pointer ml-1"
          >
            <Volume2 className="w-3.5 h-3.5 text-red-500" />
            <span className="hidden xl:inline">Horn FX</span>
          </button>
        </div>

        {/* Right Side: Account connection & Fullscreen toggle */}
        <div className="flex items-center gap-2 justify-end">
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
                type="button"
                onClick={onSignOut}
                title="Sign out of YouTube"
                className="text-slate-400 hover:text-red-400 ml-1 p-0.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              id="google-sign-in-btn"
              type="button"
              onClick={onSignIn}
              className="flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-900 px-3 py-1.5 rounded-lg text-xs font-semibold shadow transition cursor-pointer"
            >
              <Youtube className="w-4 h-4 text-red-600" />
              <span className="hidden sm:inline">Connect YouTube</span>
              <span className="sm:hidden">YouTube</span>
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            id="fullscreen-toggle-btn"
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Full Screen' : 'View Full Screen Studio (No Scroll)'}
            className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-sky-400" />
            ) : (
              <Maximize2 className="w-4 h-4 text-slate-300" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

