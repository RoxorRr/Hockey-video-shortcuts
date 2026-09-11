import { VideoClip } from '../types';

export interface ExtractedDateResult {
  timestamp: number; // Epoch milliseconds
  display: string; // Formatted date & time e.g. "2026-09-08 20:42:26"
  isFromFilename: boolean;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function formatDateTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  min: number,
  sec: number
): string {
  return `${year}-${pad2(month)}-${pad2(day)} ${pad2(hour)}:${pad2(min)}:${pad2(sec)}`;
}

function isValidDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  min: number,
  sec: number
): boolean {
  if (year < 1990 || year > 2099) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (hour < 0 || hour > 23) return false;
  if (min < 0 || min > 59) return false;
  if (sec < 0 || sec > 59) return false;
  return true;
}

/**
 * Extracts a chronological timestamp from a video filename.
 * Supports:
 * - "last_tour 2026-09-08 20-42-26.mp4" (standard dash/space separated)
 * - "clip 2026-09-08 20:42:26.mp4"
 * - "2026-09-08_20-42-26.mp4" or "2026.09.08 20.42.26"
 * - "20260908_204226.mp4" or "VID_20260908_204226.mp4"
 * - "2026-09-08 at 20.42.26.mp4" (macOS Screen Recording)
 * - "2026-09-08 8-42-26 PM" (12-hour AM/PM)
 * - "2026-09-08.mp4" (date only)
 */
export function extractTimestampFromFilename(filename: string): ExtractedDateResult | null {
  if (!filename) return null;

  // Remove extension for matching
  const name = filename.replace(/\.[^/.]+$/, '');

  // 1. Full Date and Time with separators
  // Matches: 2026-09-08 20-42-26, 2026-09-08 20:42:26, 2026.09.08_20.42.26, 2026-09-08 at 20.42.26
  const fullDateTimeRegex =
    /(?:^|[^0-9])(\d{4})[-_.](\d{2})[-_.](\d{2})(?:[T\s_]+(?:at[\s_]+)?)(\d{1,2})[-_.:](\d{2})(?:[-_.:](\d{2}))?\s*(am|pm)?(?:[^0-9]|$)/i;

  const match1 = name.match(fullDateTimeRegex);
  if (match1) {
    const year = parseInt(match1[1], 10);
    const month = parseInt(match1[2], 10);
    const day = parseInt(match1[3], 10);
    let hour = parseInt(match1[4], 10);
    const minute = parseInt(match1[5], 10);
    const second = match1[6] ? parseInt(match1[6], 10) : 0;
    const ampm = match1[7]?.toLowerCase();

    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;

    if (isValidDate(year, month, day, hour, minute, second)) {
      const date = new Date(year, month - 1, day, hour, minute, second);
      return {
        timestamp: date.getTime(),
        display: formatDateTime(year, month, day, hour, minute, second),
        isFromFilename: true,
      };
    }
  }

  // 2. Compact YYYYMMDD_HHMMSS or YYYYMMDD-HHMMSS
  const compactRegex = /(?:^|[^0-9])(\d{4})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})(?:[^0-9]|$)/;
  const match2 = name.match(compactRegex);
  if (match2) {
    const year = parseInt(match2[1], 10);
    const month = parseInt(match2[2], 10);
    const day = parseInt(match2[3], 10);
    const hour = parseInt(match2[4], 10);
    const minute = parseInt(match2[5], 10);
    const second = parseInt(match2[6], 10);

    if (isValidDate(year, month, day, hour, minute, second)) {
      const date = new Date(year, month - 1, day, hour, minute, second);
      return {
        timestamp: date.getTime(),
        display: formatDateTime(year, month, day, hour, minute, second),
        isFromFilename: true,
      };
    }
  }

  // 3. Date only YYYY-MM-DD or YYYY_MM_DD
  const dateOnlyRegex = /(?:^|[^0-9])(\d{4})[-_.](\d{2})[-_.](\d{2})(?:[^0-9]|$)/;
  const match3 = name.match(dateOnlyRegex);
  if (match3) {
    const year = parseInt(match3[1], 10);
    const month = parseInt(match3[2], 10);
    const day = parseInt(match3[3], 10);

    if (isValidDate(year, month, day, 0, 0, 0)) {
      const date = new Date(year, month - 1, day, 0, 0, 0);
      return {
        timestamp: date.getTime(),
        display: `${year}-${pad2(month)}-${pad2(day)}`,
        isFromFilename: true,
      };
    }
  }

  return null;
}

/**
 * Gets clip timestamp prioritizing filename date/time, falling back to file.lastModified
 */
export function getClipTimestamp(file: File): ExtractedDateResult {
  const fromFilename = extractTimestampFromFilename(file.name);
  if (fromFilename) {
    return fromFilename;
  }

  // Fallback to file.lastModified if valid (after year 2000)
  if (file.lastModified && file.lastModified > 946684800000) {
    const d = new Date(file.lastModified);
    return {
      timestamp: file.lastModified,
      display: formatDateTime(
        d.getFullYear(),
        d.getMonth() + 1,
        d.getDate(),
        d.getHours(),
        d.getMinutes(),
        d.getSeconds()
      ),
      isFromFilename: false,
    };
  }

  return {
    timestamp: Date.now(),
    display: '',
    isFromFilename: false,
  };
}

/**
 * Sorts an array of VideoClips chronologically from oldest to newest.
 * Clips with parsed filename timestamps are sorted by timestamp.
 * In case of tie or missing timestamp, natural alphanumeric filename sorting is used.
 */
export function sortClipsChronologically(clips: VideoClip[]): VideoClip[] {
  return [...clips].sort((a, b) => {
    const aTime = a.recordedAt;
    const bTime = b.recordedAt;

    if (aTime !== undefined && bTime !== undefined) {
      if (aTime !== bTime) {
        return aTime - bTime; // Oldest first (ascending timestamp)
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    }

    if (aTime !== undefined && bTime === undefined) return -1;
    if (aTime === undefined && bTime !== undefined) return 1;

    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
}
