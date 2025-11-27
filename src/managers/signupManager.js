import { saveEvents } from './persistenceManager.js';
import { getAllEvents } from './eventManager.js';

export async function toggleRole(event, userId, roleName, user) {
  // Check if user is signed up
  let signup = event.signups.find(s => s.userId === userId);
  let isWaitlisted = false;

  if (!signup) {
    signup = event.waitlist.find(s => s.userId === userId);
    isWaitlisted = true;
  }

  if (signup) {
    // User exists - toggle the role
    const roleIndex = signup.roles.indexOf(roleName);

    if (roleIndex !== -1) {
      // Role exists - remove it
      signup.roles.splice(roleIndex, 1);

      // If no roles left, remove user entirely
      if (signup.roles.length === 0) {
        if (isWaitlisted) {
          event.waitlist = event.waitlist.filter(s => s.userId !== userId);
        } else {
          event.signups = event.signups.filter(s => s.userId !== userId);

          // Remove user from thread
          if (event.threadId) {
            try {
              const channel = await user.client.channels.fetch(event.threadId);
              if (channel && channel.isThread()) {
                await channel.members.remove(userId);
              }
            } catch (error) {
              console.error('Failed to remove user from thread:', error);
            }
          }

          // Promote from waitlist
          if (event.waitlist.length > 0) {
            const promoted = event.waitlist.shift();
            event.signups.push(promoted);

            // Add promoted user to thread
            if (event.threadId) {
              try {
                const channel = await user.client.channels.fetch(event.threadId);
                if (channel && channel.isThread()) {
                  await channel.members.add(promoted.userId);
                }
              } catch (error) {
                console.error('Failed to add promoted user to thread:', error);
              }
            }
          }
        }
      }
    } else {
      // Role doesn't exist - add it
      signup.roles.push(roleName);
    }
  } else {
    // New signup
    const newSignup = {
      userId,
      roles: [roleName],
      timestamp: new Date()
    };

    // Check capacity
    if (event.signups.length >= event.capacity) {
      // Add to waitlist
      event.waitlist.push(newSignup);
    } else {
      // Add to accepted
      event.signups.push(newSignup);

      // Add user to thread if it exists
      if (event.threadId) {
        try {
          const channel = await user.client.channels.fetch(event.threadId);
          if (channel && channel.isThread()) {
            await channel.members.add(userId);
          }
        } catch (error) {
          console.error('Failed to add user to thread:', error);
        }
      }
    }
  }

  // Save events after any signup changes
  const eventsMap = new Map(getAllEvents().map(e => [e.id, e]));
  await saveEvents(eventsMap);
}
