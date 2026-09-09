import React from 'react';
import { HockeyOverlaySettings } from '../types';
import { Shield, User, Volume2, Sparkles, Trophy } from 'lucide-react';
import { playGoalHorn, playArenaBuzzer } from '../lib/audio';

interface OverlayControlsProps {
  settings: HockeyOverlaySettings;
  onChange: (updated: HockeyOverlaySettings) => void;
}

export const OverlayControls: React.FC<OverlayControlsProps> = ({ settings, onChange }) => {
  const updateScorebug = (field: string, val: any) => {
    onChange({
      ...settings,
      scorebug: {
        ...settings.scorebug,
        [field]: val,
      },
    });
  };

  const updatePlayerBanner = (field: string, val: any) => {
    onChange({
      ...settings,
      playerBanner: {
        ...settings.playerBanner,
        [field]: val,
      },
    });
  };

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-4 lg:p-6 shadow-xl space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-red-500" />
          <h3 className="font-['Chakra_Petch'] font-bold text-white tracking-wider text-sm uppercase">
            Hockey Graphics & Overlays
          </h3>
        </div>
        <span className="text-[11px] text-slate-400">Scorebug, Player Card & Horn FX</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Scorebug Panel */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-sky-400" />
              Game Scorebug
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="scorebug-toggle-checkbox"
                type="checkbox"
                checked={settings.scorebug.enabled}
                onChange={(e) => updateScorebug('enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
            </label>
          </div>

          {settings.scorebug.enabled && (
            <div className="space-y-2.5 pt-1 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-semibold">Away Team</label>
                  <div className="flex gap-1 mt-0.5">
                    <input
                      type="text"
                      maxLength={4}
                      value={settings.scorebug.awayTeam}
                      onChange={(e) => updateScorebug('awayTeam', e.target.value.toUpperCase())}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white font-bold text-center"
                      placeholder="BOS"
                    />
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={settings.scorebug.awayScore}
                      onChange={(e) => updateScorebug('awayScore', parseInt(e.target.value) || 0)}
                      className="w-12 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sky-400 font-black text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-semibold">Home Team</label>
                  <div className="flex gap-1 mt-0.5">
                    <input
                      type="text"
                      maxLength={4}
                      value={settings.scorebug.homeTeam}
                      onChange={(e) => updateScorebug('homeTeam', e.target.value.toUpperCase())}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white font-bold text-center"
                      placeholder="NYR"
                    />
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={settings.scorebug.homeScore}
                      onChange={(e) => updateScorebug('homeScore', parseInt(e.target.value) || 0)}
                      className="w-12 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sky-400 font-black text-center"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-semibold">Period</label>
                  <select
                    value={settings.scorebug.period}
                    onChange={(e) => updateScorebug('period', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white text-xs mt-0.5"
                  >
                    <option value="1ST">1st Period</option>
                    <option value="2ND">2nd Period</option>
                    <option value="3RD">3rd Period</option>
                    <option value="OT">Overtime</option>
                    <option value="SO">Shootout</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 uppercase font-semibold">Clock</label>
                  <input
                    type="text"
                    value={settings.scorebug.timeRemaining}
                    onChange={(e) => updateScorebug('timeRemaining', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white font-mono text-center mt-0.5"
                    placeholder="0:14"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Player Banner Lower Third */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-red-400" />
              Player Lower Third
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="player-banner-toggle-checkbox"
                type="checkbox"
                checked={settings.playerBanner.enabled}
                onChange={(e) => updatePlayerBanner('enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
            </label>
          </div>

          {settings.playerBanner.enabled && (
            <div className="space-y-2.5 pt-1 text-xs">
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-1">
                  <label className="text-[10px] text-slate-400 uppercase font-semibold">No.</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={settings.playerBanner.jerseyNumber}
                    onChange={(e) => updatePlayerBanner('jerseyNumber', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white font-black text-center mt-0.5"
                    placeholder="97"
                  />
                </div>
                <div className="col-span-3">
                  <label className="text-[10px] text-slate-400 uppercase font-semibold">Player Name</label>
                  <input
                    type="text"
                    value={settings.playerBanner.playerName}
                    onChange={(e) => updatePlayerBanner('playerName', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-white font-semibold mt-0.5"
                    placeholder="Connor McDavid"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase font-semibold">Action Highlight Text</label>
                <input
                  type="text"
                  value={settings.playerBanner.actionText}
                  onChange={(e) => updatePlayerBanner('actionText', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-sky-400 font-medium mt-0.5"
                  placeholder="Top Shelf Snapper (Game Winner)"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Audio & Stamps toggles */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800/80">
        <div className="flex items-center gap-6">
          {/* Goal Horn sound effect */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.goalHornSound}
              onChange={(e) => onChange({ ...settings, goalHornSound: e.target.checked })}
              className="rounded bg-slate-900 border-slate-700 text-red-600 focus:ring-0 w-4 h-4 cursor-pointer"
            />
            <span className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-red-500" />
              Include Goal Horn Sound FX in Video
            </span>
          </label>

          {/* Action Stamps */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showStamps}
              onChange={(e) => onChange({ ...settings, showStamps: e.target.checked })}
              className="rounded bg-slate-900 border-slate-700 text-sky-500 focus:ring-0 w-4 h-4 cursor-pointer"
            />
            <span className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              Show Action Badges (GOAL / SAVE / HIT)
            </span>
          </label>
        </div>

        {/* Quick Audio audition */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => playGoalHorn(2.5)}
            className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded border border-slate-700 transition"
          >
            Audition Goal Horn
          </button>
          <button
            onClick={() => playArenaBuzzer(1.0)}
            className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded border border-slate-700 transition"
          >
            Audition Buzzer
          </button>
        </div>
      </div>
    </div>
  );
};
