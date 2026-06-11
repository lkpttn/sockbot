import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use data directory in project root (will be mounted as volume in Docker)
const DATA_DIR = path.join(__dirname, '../../data');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const TMP_FILE = `${EVENTS_FILE}.tmp`;

// Serializes all writes so overlapping saves can't interleave and corrupt the
// file. Each save() chains onto this; the chain never rejects (errors are
// logged) so one failed write doesn't poison later ones.
let writeChain = Promise.resolve();

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create data directory:', error);
  }
}

export function saveEvents(eventsMap) {
  // Snapshot + serialize synchronously so we capture the state at call time,
  // even if the map is mutated before this write reaches the front of the queue.
  let json;
  let count;
  try {
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
    count = eventsArray.length;
    json = JSON.stringify(eventsArray, null, 2);
  } catch (error) {
    console.error('Failed to serialize events:', error);
    return writeChain;
  }

  // Write atomically: write to a temp file, then rename over the target. rename
  // is atomic on POSIX, so a crash mid-write leaves the previous file intact.
  writeChain = writeChain.then(async () => {
    try {
      await ensureDataDir();
      await fs.writeFile(TMP_FILE, json, 'utf-8');
      await fs.rename(TMP_FILE, EVENTS_FILE);
      console.log(`Saved ${count} events to disk`);
    } catch (error) {
      console.error('Failed to save events:', error);
    }
  });

  return writeChain;
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
