import * as chrono from 'chrono-node';

// Timezone name to IANA timezone mapping
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

/**
 * Parse GW2 reset time strings (00:00 UTC / midnight UTC)
 * Supports: "reset", "at reset", "reset+1", "reset +2", "tomorrow reset", etc.
 * @param {string} timeString - The time string to parse
 * @param {Date} referenceDate - The reference date (defaults to now)
 * @returns {Date|null} - Parsed date or null if not a reset time string
 */
export function parseResetTime(timeString, referenceDate = new Date()) {
  const lowerStr = timeString.toLowerCase().trim();

  // Check if string contains "reset"
  if (!lowerStr.includes('reset')) {
    return null;
  }

  // GW2 reset is at 00:00 UTC (midnight UTC)
  const RESET_HOUR_UTC = 0;

  // Extract offset if present (e.g., "reset+2" or "reset +2")
  const offsetMatch = lowerStr.match(/reset\s*\+?\s*(\d+(?:\.\d+)?)/);
  const offsetHours = offsetMatch ? parseFloat(offsetMatch[1]) : 0;

  // Check if "tomorrow" is mentioned
  const isTomorrow = lowerStr.includes('tomorrow');

  // Use the reference date instead of current time
  const now = referenceDate;

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

  // Determine which reset to use
  if (isTomorrow) {
    // "tomorrow reset" means the reset on tomorrow's date
    // Always add 1 day to get tomorrow's reset
    resetDate.setUTCDate(resetDate.getUTCDate() + 1);
  } else if (resetDate <= now) {
    // If today's reset has already passed and not "tomorrow", use next reset
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
 * Fix timezone-aware parsing for "today" and "tomorrow" keywords
 * Chrono-node interprets "today" based on UTC date, which causes issues
 * when it's after midnight UTC but still the previous day in US timezones
 *
 * @param {string} timeString - The time string to parse
 * @param {Date} referenceDate - The reference date (defaults to now)
 * @returns {Date|null} - Parsed date or null if parsing failed
 */
export function parseTimeWithTimezoneFix(timeString, referenceDate = new Date()) {
  // First check if it's a reset time (pass referenceDate to it)
  const resetTime = parseResetTime(timeString, referenceDate);
  if (resetTime) {
    return resetTime;
  }

  // Extract timezone from the input
  const tzMatch = timeString.match(/\b(UTC|GMT|EST|EDT|CST|CDT|MST|MDT|PST|PDT)\b/i);
  if (!tzMatch) {
    // No timezone specified, require it
    return null;
  }

  const timezone = tzMatch[1].toUpperCase();
  const ianaTimezone = TIMEZONE_MAP[timezone];

  // Check if the string contains "today" or "tomorrow"
  const hasToday = /\btoday\b/i.test(timeString);
  const hasTomorrow = /\btomorrow\b/i.test(timeString);

  if (hasToday || hasTomorrow) {
    // Get the current date in the specified timezone
    const localDateStr = referenceDate.toLocaleDateString('en-US', {
      timeZone: ianaTimezone,
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let replacementDate = localDateStr;

    // If "tomorrow" is specified, we need to add a day
    if (hasTomorrow) {
      const tomorrow = new Date(referenceDate);
      tomorrow.setDate(tomorrow.getDate() + 1);
      replacementDate = tomorrow.toLocaleDateString('en-US', {
        timeZone: ianaTimezone,
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    // Replace "today" or "tomorrow" with the actual date in the target timezone
    const fixedTimeString = timeString
      .replace(/\btoday\b/i, replacementDate)
      .replace(/\btomorrow\b/i, replacementDate);

    // Parse with chrono using the fixed string
    return chrono.parseDate(fixedTimeString, referenceDate);
  }

  // No "today" or "tomorrow", parse normally
  return chrono.parseDate(timeString, referenceDate);
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