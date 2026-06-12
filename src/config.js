// Each template defines an event type. `toggleRoles` declares optional Yes/No
// fields specific to that template: when set to Yes, the named role is added to
// the event's roles (and gets its own signup button). Add per-template fields
// here and they're wired into the slash command automatically.
export const TEMPLATES = {
  party: {
    name: 'Party',
    capacity: 5,
    duration: 90,
    roles: ['Any', 'DPS', 'Boon DPS', 'Healer'],
    toggleRoles: [
      { option: 'glut', description: 'Include a Glut role', roles: ['Glut'] }
    ]
  },
  squad: {
    name: 'Squad',
    capacity: 10,
    duration: 90,
    roles: ['Any', 'DPS', 'Boon DPS', 'Healer'],
    toggleRoles: [
      { option: 'raid-roles', description: 'Include Raid roles (Kite and Tank)', roles: ['Kite', 'Tank'] }
    ]
  },
  freeform: {
    name: 'Freeform',
    capacity: 20,
    duration: 60,
    roles: ['Any', 'DPS', 'Boon DPS', 'Healer']
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
