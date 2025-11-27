import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use data directory in project root (will be mounted as volume in Docker)
const DATA_DIR = path.join(__dirname, '../../data');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create data directory:', error);
  }
}

export async function saveEvents(eventsMap) {
  try {
    await ensureDataDir();

    // Convert Map to array of events, serializing dates as ISO strings
    const eventsArray = Array.from(eventsMap.values()).map(event => ({
      ...event,
      startTime: event.startTime.toISOString(),
      signups: event.signups.map(signup => ({
        ...signup,
        timestamp: signup.timestamp.toISOString()
      })),
      waitlist: event.waitlist.map(signup => ({
        ...signup,
        timestamp: signup.timestamp.toISOString()
      }))
    }));

    await fs.writeFile(EVENTS_FILE, JSON.stringify(eventsArray, null, 2), 'utf-8');
    console.log(`Saved ${eventsArray.length} events to disk`);
  } catch (error) {
    console.error('Failed to save events:', error);
  }
}

export async function loadEvents() {
  try {
    await ensureDataDir();

    const data = await fs.readFile(EVENTS_FILE, 'utf-8');
    const eventsArray = JSON.parse(data);

    // Convert array back to Map, parsing ISO strings back to Date objects
    const eventsMap = new Map();
    eventsArray.forEach(event => {
      eventsMap.set(event.id, {
        ...event,
        startTime: new Date(event.startTime),
        signups: event.signups.map(signup => ({
          ...signup,
          timestamp: new Date(signup.timestamp)
        })),
        waitlist: event.waitlist.map(signup => ({
          ...signup,
          timestamp: new Date(signup.timestamp)
        }))
      });
    });

    console.log(`Loaded ${eventsMap.size} events from disk`);
    return eventsMap;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('No existing events file found, starting fresh');
      return new Map();
    }
    console.error('Failed to load events:', error);
    return new Map();
  }
}
