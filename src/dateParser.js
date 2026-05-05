import * as chrono from 'chrono-node';
import { DEFAULT_TIMEZONE } from './config.js';

// Timezone abbreviation to IANA timezone mapping
const TIMEZONE_MAP = {
  'UTC': 'UTC',
  'GMT': 'UTC',
  'EST': 'America/New_York',
  'EDT': 'America/New_York',
  'CST': 'America/Chicago',
  'CDT': 'America/Chicago',
  'MST': 'America/Denver',
  'MDT': 'America/Denver',
  'PST': 'America/Los_Angeles',
  'PDT': 'America/Los_Angeles'
};

const TIMEZONE_PATTERN = /\b(UTC|GMT|EST|EDT|CST|CDT|MST|MDT|PST|PDT)\b/i;
const RESET_HOUR_UTC = 0;

/**
 * Extract timezone info from a time string
 * @param {string} timeString - The time string to search
 * @returns {{ abbreviation: string, iana: string } | null}
 */
export function extractTimezone(timeString) {
  const match = timeString.match(TIMEZONE_PATTERN);
  if (!match) return null;

  const abbreviation = match[1].toUpperCase();
  return {
    abbreviation,
    iana: TIMEZONE_MAP[abbreviation]
  };
}

function stripTimezoneAbbreviation(timeString) {
  return timeString.replace(TIMEZONE_PATTERN, '').replace(/\s+/g, ' ').trim();
}

function getTimezoneOffsetMinutes(ianaTimezone, date) {
  if (ianaTimezone === 'UTC') {
    return 0;
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)])
  );

  const localTimeAsUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second
  );

  return Math.round((localTimeAsUtc - date.getTime()) / 60000);
}

function getLocalDateParts(date, ianaTimezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)])
  );
}

function addDaysToDateParts(dateParts, days) {
  const date = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day + days));

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}

function datePartsEqual(a, b) {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

function findResetForLocalDate(dateParts, ianaTimezone) {
  const targetUtcDate = Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day);

  for (let dayOffset = -2; dayOffset <= 2; dayOffset++) {
    const candidate = new Date(targetUtcDate + dayOffset * 24 * 60 * 60 * 1000);
    const candidateLocalDate = getLocalDateParts(candidate, ianaTimezone);

    if (datePartsEqual(candidateLocalDate, dateParts)) {
      return candidate;
    }
  }

  return null;
}

function parseWithTimezone(timeString, ianaTimezone, referenceDate) {
  const referenceOffset = getTimezoneOffsetMinutes(ianaTimezone, referenceDate);
  const firstPass = chrono.parseDate(
    timeString,
    { instant: referenceDate, timezone: referenceOffset },
    { forwardDate: true }
  );

  if (!firstPass) {
    return null;
  }

  const eventOffset = getTimezoneOffsetMinutes(ianaTimezone, firstPass);
  if (eventOffset === referenceOffset) {
    return firstPass;
  }

  return chrono.parseDate(
    timeString,
    { instant: referenceDate, timezone: eventOffset },
    { forwardDate: true }
  );
}

/**
 * Parse GW2 reset time strings (00:00 UTC / midnight UTC)
 * Supports: "reset", "at reset", "reset+1", "reset +2", "tomorrow reset", etc.
 * @param {string} timeString - The time string to parse
 * @param {string} ianaTimezone - IANA timezone for resolving today/tomorrow reset
 * @param {Date} referenceDate - The reference date (defaults to now)
 * @returns {Date|null} - Parsed date or null if not a reset time string
 */
export function parseResetTime(timeString, ianaTimezone = DEFAULT_TIMEZONE, referenceDate = new Date()) {
  const lowerStr = timeString.toLowerCase().trim();

  // Check if string contains "reset"
  if (!lowerStr.includes('reset')) {
    return null;
  }

  // Extract offset if present (e.g., "reset+2" or "reset +2")
  const offsetMatch = lowerStr.match(/reset\s*\+?\s*(\d+(?:\.\d+)?)/);
  const offsetHours = offsetMatch ? parseFloat(offsetMatch[1]) : 0;

  const now = referenceDate;

  const relativeDayMatch = lowerStr.match(/\b(today|tomorrow)\b/);
  if (relativeDayMatch) {
    const localDate = getLocalDateParts(now, ianaTimezone);
    const dayOffset = relativeDayMatch[1] === 'tomorrow' ? 1 : 0;
    const targetLocalDate = addDaysToDateParts(localDate, dayOffset);
    const resetDate = findResetForLocalDate(targetLocalDate, ianaTimezone);

    if (!resetDate) {
      return null;
    }

    if (offsetHours > 0) {
      resetDate.setUTCHours(resetDate.getUTCHours() + Math.floor(offsetHours));
      resetDate.setUTCMinutes(resetDate.getUTCMinutes() + Math.round((offsetHours % 1) * 60));
    }

    return resetDate;
  }

  // Calculate today's reset time first
  let resetDate = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    RESET_HOUR_UTC,
    0,
    0,
    0
  ));

  // Determine the next reset after now.
  if (resetDate <= now) {
    // If today's reset has already passed, use next reset.
    resetDate.setUTCDate(resetDate.getUTCDate() + 1);
  }

  // Add offset in hours
  if (offsetHours > 0) {
    resetDate.setUTCHours(resetDate.getUTCHours() + Math.floor(offsetHours));
    resetDate.setUTCMinutes(resetDate.getUTCMinutes() + Math.round((offsetHours % 1) * 60));
  }

  return resetDate;
}

/**
 * Parse an event time string with full timezone awareness.
 * Uses chrono-node's ReferenceWithTimezone so all relative references
 * (today, tomorrow, day names, "this evening", etc.) resolve correctly
 * in the user's timezone — even when it's past midnight in UTC.
 *
 * @param {string} timeString - The time string to parse
 * @param {string} ianaTimezone - IANA timezone for resolving relative references
 * @param {Date} referenceDate - The reference date (defaults to now)
 * @returns {Date|null} - Parsed date or null if parsing failed
 */
export function parseEventTime(timeString, ianaTimezone = DEFAULT_TIMEZONE, referenceDate = new Date()) {
  // First check if it's a reset time (always UTC-based)
  const resetTime = parseResetTime(timeString, ianaTimezone, referenceDate);
  if (resetTime) return resetTime;

  // Chrono accepts numeric timezone offsets reliably. IANA names are resolved here
  // so parsing behaves the same locally and inside UTC Docker containers.
  const parseString = stripTimezoneAbbreviation(timeString);
  return parseWithTimezone(parseString, ianaTimezone, referenceDate);
}

/**
 * Validate that a parsed date is in the future and reasonable
 * @param {Date} date - The date to validate
 * @param {Date} referenceDate - The reference date (defaults to now)
 * @returns {{valid: boolean, error?: string}} - Validation result
 */
export function validateEventDate(date, referenceDate = new Date()) {
  if (!date || !(date instanceof Date) || isNaN(date)) {
    return { valid: false, error: 'Invalid date' };
  }

  // Check if the date is in the past
  if (date <= referenceDate) {
    return { valid: false, error: 'Event time must be in the future' };
  }

  // Check if the date is too far in the future (e.g., more than 1 year)
  const oneYearFromNow = new Date(referenceDate);
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  if (date > oneYearFromNow) {
    return { valid: false, error: 'Event time is too far in the future (max 1 year)' };
  }

  return { valid: true };
}
