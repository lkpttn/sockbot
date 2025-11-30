/**
 * Format a date for thread naming
 * @param {Date} date - The date to format
 * @returns {string} - Formatted date (e.g., "Nov 27")
 */
export function formatThreadDate(date) {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[date.getMonth()]} ${date.getDate()}`;
}
