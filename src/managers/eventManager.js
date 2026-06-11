import { v4 as uuidv4 } from 'uuid';
import { TEMPLATES } from '../config.js';
import { saveEvents, loadEvents } from './persistenceManager.js';

// In-memory event storage
let events = new Map();

// Load events from disk on startup
export async function initializeEventManager() {
  events = await loadEvents();
  return events;
}

export function buildEventObject({
  channelId,
  guildId,
  creatorId,
  creatorName,
  template,
  title,
  description,
  startTime,
  duration,
  timezone,
  extraRoles = [],
  mentionRoleId = null
}) {
  const id = uuidv4();
  const templateConfig = TEMPLATES[template];

  // Build available roles list (base roles + template toggle roles)
  const roles = [...templateConfig.roles, ...extraRoles];

  const event = {
    id,
    messageId: null, // Will be set after message is posted
    threadId: null, // Will be set after thread is created
    channelId,
    guildId,
    creatorId,
    creatorName,
    template,
    title,
    description: description || null,
    startTime,
    duration,
    timezone, // IANA timezone used when creating the event
    mentionRoleId, // Optional per-event ping override; falls back to template default at post time
    capacity: templateConfig.capacity,
    roles,
    signups: [], // Array of {userId, roles: string[], timestamp}
    waitlist: [] // Array of {userId, roles: string[], timestamp}
  };

  return event;
}

export function createEvent(eventData) {
  // Accept either a full config object or a pre-built event object
  const event = eventData.id ? eventData : buildEventObject(eventData);

  events.set(event.id, event);
  saveEvents(events);
  return event;
}

export function getEvent(id) {
  return events.get(id);
}

export function getEventByMessageId(messageId) {
  return Array.from(events.values()).find(e => e.messageId === messageId);
}

export function getAllEvents() {
  return Array.from(events.values());
}

export function deleteEvent(id, skipSave = false) {
  events.delete(id);
  if (!skipSave) {
    saveEvents(events);
  }
}

export function deleteMultipleEvents(ids) {
  for (const id of ids) {
    events.delete(id);
  }
  saveEvents(events);
}

export function updateEvent(id, updates) {
  const event = events.get(id);
  if (!event) return null;

  Object.assign(event, updates);
  saveEvents(events);
  return event;
}

// Save the current in-memory events to disk. Returns the write promise so
// callers (e.g. graceful shutdown) can await durability if they need to.
export function save() {
  return saveEvents(events);
}
