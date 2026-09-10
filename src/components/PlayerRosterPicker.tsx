import React, { useState, useEffect, useRef } from 'react';
import { SavedPlayer } from '../types';
import {
  getSavedRoster,
  savePlayerToRoster,
  removePlayerFromRoster,
  subscribeToRosterChanges,
} from '../lib/rosterStorage';
import {
  User,
  Bookmark,
  BookmarkCheck,
  Trash2,
  Search,
  Check,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

interface PlayerRosterPickerProps {
  currentName: string;
  currentNumber: string;
  currentAction?: string;
  onSelectPlayer: (player: { name: string; jerseyNumber: string; defaultAction?: string }) => void;
  compact?: boolean;
}

export const PlayerRosterPicker: React.FC<PlayerRosterPickerProps> = ({
  currentName,
  currentNumber,
  currentAction,
  onSelectPlayer,
  compact = false,
}) => {
  const [roster, setRoster] = useState<SavedPlayer[]>(() => getSavedRoster());
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync roster on change
  useEffect(() => {
    const unsub = subscribeToRosterChanges(() => {
      setRoster(getSavedRoster());
    });
    return unsub;
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const isCurrentSaved = Boolean(
    currentName.trim() &&
      roster.some(
        (p) => p.name.toLowerCase() === currentName.trim().toLowerCase(),
      ),
  );

  const handleSaveCurrent = () => {
    if (!currentName.trim()) return;
    const updated = savePlayerToRoster({
      name: currentName.trim(),
      jerseyNumber: currentNumber.trim(),
      defaultAction: currentAction?.trim(),
    });
    setRoster(updated);
  };

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = removePlayerFromRoster(id);
    setRoster(updated);
  };

  const filteredRoster = roster.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.jerseyNumber.includes(q) ||
      (p.defaultAction && p.defaultAction.toLowerCase().includes(q))
    );
  });

  // Recent 4-5 players for fast 1-tap chip row
  const recentChips = roster.slice(0, 5);

  return (
    <div className="space-y-1.5 w-full">
      {/* Top Header with Quick Actions & Dropdown trigger */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-[11px] font-semibold text-slate-300">
            Player Roster &amp; Memory
          </span>
          <span className="text-[10px] bg-slate-800 text-slate-400 font-mono px-1.5 py-0.2 rounded">
            {roster.length} saved
          </span>
        </div>

        <div className="flex items-center gap-1" ref={dropdownRef}>
          {/* Bookmark / Save current button */}
          {currentName.trim() && (
            <button
              type="button"
              onClick={handleSaveCurrent}
              title={isCurrentSaved ? 'Player saved in roster' : 'Save current player to roster'}
              className={`text-[10px] px-2 py-0.5 rounded font-medium flex items-center gap-1 transition cursor-pointer ${
                isCurrentSaved
                  ? 'bg-sky-950 text-sky-400 border border-sky-800/60'
                  : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 hover:text-white'
              }`}
            >
              {isCurrentSaved ? (
                <>
                  <BookmarkCheck className="w-3 h-3 text-sky-400" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Bookmark className="w-3 h-3 text-amber-400" />
                  <span>Remember Player</span>
                </>
              )}
            </button>
          )}

          {/* Open full roster dropdown button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              className="text-[11px] px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-white font-semibold flex items-center gap-1 border border-slate-700 transition cursor-pointer"
            >
              <span>Select Player</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-2 space-y-2 backdrop-blur-md animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-xs font-bold text-white px-1">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    Select from Saved Roster
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    Click to apply
                  </span>
                </div>

                {/* Search bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search player or jersey #..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
                    autoFocus
                  />
                </div>

                {/* Player List */}
                <div className="max-h-52 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {filteredRoster.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-500">
                      No matching players found.
                    </div>
                  ) : (
                    filteredRoster.map((player) => {
                      const isSelected =
                        currentName.toLowerCase() === player.name.toLowerCase();
                      return (
                        <div
                          key={player.id}
                          onClick={() => {
                            onSelectPlayer({
                              name: player.name,
                              jerseyNumber: player.jerseyNumber,
                              defaultAction: player.defaultAction,
                            });
                            setIsOpen(false);
                          }}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition text-xs group ${
                            isSelected
                              ? 'bg-sky-600/30 border border-sky-500 text-white'
                              : 'bg-slate-950/70 hover:bg-slate-800 text-slate-200 border border-slate-850'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="bg-red-600 text-white font-black px-1.5 py-0.5 rounded text-[10px] shrink-0 font-mono">
                              #{player.jerseyNumber}
                            </span>
                            <div className="min-w-0">
                              <p className="font-bold text-white truncate text-xs">
                                {player.name}
                              </p>
                              {player.defaultAction && (
                                <p className="text-[10px] text-slate-400 truncate">
                                  {player.defaultAction}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 ml-1">
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-sky-400" />
                            )}
                            <button
                              type="button"
                              onClick={(e) => handleRemove(player.id, e)}
                              title="Delete player from saved roster"
                              className="p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition rounded hover:bg-slate-700/50"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer status */}
                <div className="pt-1.5 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between px-1">
                  <span>Auto-remembers typed players</span>
                  {currentName.trim() && !isCurrentSaved && (
                    <button
                      type="button"
                      onClick={handleSaveCurrent}
                      className="text-sky-400 hover:underline font-bold"
                    >
                      + Save &ldquo;{currentName}&rdquo;
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Select Chips Bar */}
      {!compact && recentChips.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 custom-scrollbar">
          <span className="text-[10px] text-slate-400 uppercase font-semibold shrink-0">
            Quick Pick:
          </span>
          {recentChips.map((p) => {
            const isSelected =
              currentName.toLowerCase() === p.name.toLowerCase();
            return (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  onSelectPlayer({
                    name: p.name,
                    jerseyNumber: p.jerseyNumber,
                    defaultAction: p.defaultAction,
                  })
                }
                className={`px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 transition flex items-center gap-1 cursor-pointer border ${
                  isSelected
                    ? 'bg-sky-600 text-white border-sky-400 font-bold shadow-xs'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800 hover:text-white'
                }`}
                title={`Select ${p.name} (#${p.jerseyNumber})`}
              >
                <span className="font-black font-mono text-[10px] text-amber-300">
                  #{p.jerseyNumber}
                </span>
                <span className="truncate max-w-[90px]">{p.name.split(' ').pop()}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* HTML Datalist for autocomplete in inputs */}
      <datalist id="hockey-saved-players-datalist">
        {roster.map((p) => (
          <option key={p.id} value={p.name}>
            #{p.jerseyNumber} {p.name}
          </option>
        ))}
      </datalist>

      <datalist id="hockey-popular-teams-datalist">
        <option value="EDMONTON">Edmonton Oilers</option>
        <option value="COLORADO">Colorado Avalanche</option>
        <option value="TORONTO">Toronto Maple Leafs</option>
        <option value="NY RANGERS">New York Rangers</option>
        <option value="BOSTON">Boston Bruins</option>
        <option value="TAMPA BAY">Tampa Bay Lightning</option>
        <option value="VEGAS">Vegas Golden Knights</option>
        <option value="FLORIDA">Florida Panthers</option>
        <option value="DALLAS">Dallas Stars</option>
        <option value="VANCOUVER">Vancouver Canucks</option>
        <option value="MONTREAL">Montreal Canadiens</option>
        <option value="DETROIT">Detroit Red Wings</option>
        <option value="PITTSBURGH">Pittsburgh Penguins</option>
        <option value="WASHINGTON">Washington Capitals</option>
        <option value="CAROLINA">Carolina Hurricanes</option>
        <option value="SLOVAN">HC Slovan Bratislava</option>
        <option value="SPARTA">HC Sparta Praha</option>
        <option value="TŘINEC">HC Oceláři Třinec</option>
      </datalist>
    </div>
  );
};
