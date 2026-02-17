export const TEMPLATES = {
  fractal: {
    name: 'Fractal',
    capacity: 5,
    duration: 120,
    roles: ['Any', 'DPS', 'Boon DPS', 'Healer', 'Glut'],
    mentionRole: process.env.ROLE_ID_FRACTALS
  },
  raid: {
    name: 'Raid',
    capacity: 10,
    duration: 120,
    roles: ['Any', 'DPS', 'Boon DPS', 'Healer', 'Tank', 'Kite'],
    mentionRole: process.env.ROLE_ID_RAIDS
  },
  party: {
    name: 'Party',
    capacity: 5,
    duration: 90,
    roles: ['Any', 'DPS', 'Boon DPS', 'Healer'],
    mentionRole: process.env.ROLE_ID_CONTENT
  },
  squad: {
    name: 'Squad',
    capacity: 10,
    duration: 90,
    roles: ['Any', 'DPS', 'Boon DPS', 'Healer'],
    mentionRole: process.env.ROLE_ID_CONTENT
  },
  freeform: {
    name: 'Freeform',
    capacity: 20,
    duration: 60,
    roles: ['Any', 'DPS', 'Boon DPS', 'Healer'],
    mentionRole: process.env.ROLE_ID_CONTENT
  }
};

export const REMINDER_TIME_MINUTES = 15;

// Default timezone for the guild (Eastern Time)
// Users can override by specifying timezone in their input (e.g., "8pm PST")
export const DEFAULT_TIMEZONE = 'America/New_York';

// Role emoji mapping
// Configure emoji strings in .env file
// Format: '<:emoji_name:emoji_id>' for static, '<a:emoji_name:emoji_id>' for animated
export const ROLE_EMOJIS = {
  'Any': process.env.EMOJI_ANY,
  'DPS': process.env.EMOJI_DPS,
  'Boon DPS': process.env.EMOJI_BOON_DPS,
  'Healer': process.env.EMOJI_HEALER,
  'Tank': process.env.EMOJI_TANK,
  'Kite': process.env.EMOJI_KITE,
  'Glut': process.env.EMOJI_GLUT,
  'Special': process.env.EMOJI_SPECIAL
};

// Default emoji for custom roles not in ROLE_EMOJIS
export const DEFAULT_ROLE_EMOJI = process.env.EMOJI_DEFAULT;

// Role display order (for sorting)
export const ROLE_ORDER = ['Any', 'DPS', 'Boon DPS', 'Healer', 'Tank', 'Kite', 'Glut', 'Special'];

// Helper function to sort roles in standard order
export function sortRoles(roles) {
  return [...roles].sort((a, b) => {
    const indexA = ROLE_ORDER.indexOf(a);
    const indexB = ROLE_ORDER.indexOf(b);

    // If both are in ROLE_ORDER, sort by their position
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }

    // If only A is in ROLE_ORDER, it comes first
    if (indexA !== -1) return -1;

    // If only B is in ROLE_ORDER, it comes first
    if (indexB !== -1) return 1;

    // Both are custom roles, sort alphabetically
    return a.localeCompare(b);
  });
}
