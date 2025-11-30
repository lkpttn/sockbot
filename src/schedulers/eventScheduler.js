import { deleteEvent } from '../managers/eventManager.js';
import { REMINDER_TIME_MINUTES } from '../config.js';

const scheduledCleanups = new Map(); // eventId -> timeoutId
const scheduledReminders = new Map(); // eventId -> timeoutId

export function scheduleEventCleanup(event, client) {
  // Calculate cleanup time: 2 hours after event start
  const cleanupTime = new Date(event.startTime.getTime() + 2.5 * 60 * 60 * 1000);
  const delay = cleanupTime.getTime() - Date.now();

  if (delay < 0) {
    // Event is in the past, clean up immediately
    cleanupEvent(event, client);
    return;
  }

  console.log(`Scheduling cleanup for event "${event.title}" at ${cleanupTime.toISOString()}`);

  const timeoutId = setTimeout(() => {
    cleanupEvent(event, client);
  }, delay);

  scheduledCleanups.set(event.id, timeoutId);
}

async function cleanupEvent(event, client) {
  console.log(`Cleaning up event "${event.title}"...`);

  try {
    // Delete the message
    if (event.messageId && event.channelId) {
      const channel = await client.channels.fetch(event.channelId);
      if (channel) {
        const message = await channel.messages.fetch(event.messageId);
        if (message) {
          await message.delete();
        }
      }
    }

    // Delete the thread (this will happen automatically when message is deleted,
    // but we can also delete it explicitly if needed)
    if (event.threadId) {
      try {
        const thread = await client.channels.fetch(event.threadId);
        if (thread && thread.isThread()) {
          await thread.delete();
        }
      } catch (error) {
        console.error('Failed to delete thread:', error);
      }
    }

    // Remove from event storage
    deleteEvent(event.id);
    scheduledCleanups.delete(event.id);

    console.log(`Event "${event.title}" cleaned up successfully.`);
  } catch (error) {
    console.error(`Failed to cleanup event "${event.title}":`, error);
  }
}

export function cancelEventCleanup(eventId) {
  const timeoutId = scheduledCleanups.get(eventId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    scheduledCleanups.delete(eventId);
  }
}

export function scheduleEventReminder(event, client) {
  // Calculate reminder time: REMINDER_TIME_MINUTES before event start
  const reminderTime = new Date(event.startTime.getTime() - REMINDER_TIME_MINUTES * 60 * 1000);
  const delay = reminderTime.getTime() - Date.now();

  if (delay < 0) {
    // Reminder time has passed, don't send
    return;
  }

  console.log(`Scheduling reminder for event "${event.title}" at ${reminderTime.toISOString()}`);

  const timeoutId = setTimeout(() => {
    sendReminder(event, client);
  }, delay);

  scheduledReminders.set(event.id, timeoutId);
}

async function sendReminder(event, client) {
  console.log(`Sending reminder for event "${event.title}"...`);

  try {
    if (event.threadId) {
      const thread = await client.channels.fetch(event.threadId);
      if (thread && thread.isThread()) {
        // Build mentions for all accepted users
        const mentions = event.signups.map(signup => `<@${signup.userId}>`).join(' ');
        const message = mentions
          ? `${mentions} Event "${event.title}" starts in ${REMINDER_TIME_MINUTES} minutes! 🎮`
          : `Event "${event.title}" starts in ${REMINDER_TIME_MINUTES} minutes! 🎮`;

        await thread.send(message);
      }
    }

    scheduledReminders.delete(event.id);
    console.log(`Reminder sent for event "${event.title}".`);
  } catch (error) {
    console.error(`Failed to send reminder for event "${event.title}":`, error);
  }
}

export function cancelEventReminder(eventId) {
  const timeoutId = scheduledReminders.get(eventId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    scheduledReminders.delete(eventId);
  }
}
