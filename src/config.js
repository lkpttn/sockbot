export const TEMPLATES = {
  fractal: {
    name: 'Fractal',
    capacity: 5,
    duration: 120,
    roles: ['Any', 'DPS', 'Boon DPS', 'Healer', 'Glut'],
    mentionRole: '1365144192149487768' // Fractals role ID
  },
  raid: {
    name: 'Raid',
    capacity: 10,
    duration: 120,
    roles: ['Any', 'DPS', 'Boon DPS', 'Healer', 'Tank', 'Kite'],
    mentionRole: '1364345501813833728' // Raids role ID
  },
  party: {
    name: 'Party',
    capacity: 5,
    duration: 90,
    roles: ['Any', 'DPS', 'Boon DPS', 'Healer'],
    mentionRole: '1391807927358193674' // Content role ID
  },
  squad: {
    name: 'Squad',
    capacity: 10,
    duration: 90,
    roles: ['Any', 'DPS', 'Boon DPS', 'Healer'],
    mentionRole: '1391807927358193674' // Content role ID
  },
  freeform: {
    name: 'Freeform',
    capacity: 20,
    duration: 60,
    roles: ['Any', 'DPS', 'Boon DPS', 'Healer'],
    mentionRole: '1391807927358193674' // Content role ID
  }
};

export const REMINDER_TIME_MINUTES = 15;

// Default timezone for the guild (Eastern Time)
// Users can override by specifying timezone in their input (e.g., "8pm PST")
export const DEFAULT_TIMEZONE = 'America/New_York';

// Role emoji mapping
// To get emoji IDs: Right-click emoji in Discord → "Copy Link" → ID is in the URL
// Format: '<:emoji_name:emoji_id>' for static, '<a:emoji_name:emoji_id>' for animated
export const ROLE_EMOJIS = {
  'Any': '<:flex:1443297786580963440>',
  'DPS': '<:dps:1443359897919029351>',
  'Boon DPS': '<:boondps:1444656305553018990>',
  'Healer': '<:heal:1444658585769476197>',
  'Tank': '<:tank:1443360014516621444>',
  'Kite': '<:special:1444658160068595945>', // TODO: Add custom emoji for Kite
  'Glut': '<:special:1444658160068595945>', // TODO: Add custom emoji for Glut
  'Special': '<:special:1444658160068595945>'
};

// Default emoji for custom roles not in ROLE_EMOJIS
export const DEFAULT_ROLE_EMOJI = '<:special:1444658160068595945>';

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
