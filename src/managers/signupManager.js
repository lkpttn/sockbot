import { save } from './eventManager.js';

const MAX_ROLES_PER_USER = 2;

/**
 * Fetch the thread channel for an event, if it exists
 * @param {Object} user - Discord user object (has .client)
 * @param {string} threadId - Thread ID to fetch
 * @returns {Object|null} - Thread channel or null
 */
async function fetchThread(user, threadId) {
  if (!threadId) return null;
  try {
    const channel = await user.client.channels.fetch(threadId);
    return (channel && channel.isThread()) ? channel : null;
  } catch (error) {
    console.error('Failed to fetch thread:', error);
    return null;
  }
}

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

          const thread = await fetchThread(user, event.threadId);

          // Remove user from thread
          if (thread) {
            try {
              await thread.members.remove(userId);
            } catch (error) {
              console.error('Failed to remove user from thread:', error);
            }
          }

          // Promote from waitlist
          if (event.waitlist.length > 0) {
            const promoted = event.waitlist.shift();
            event.signups.push(promoted);

            // Add promoted user to thread (reuse fetched thread)
            if (thread) {
              try {
                await thread.members.add(promoted.userId);
              } catch (error) {
                console.error('Failed to add promoted user to thread:', error);
              }
            }
          }
        }
      }
    } else {
      // Role doesn't exist - check if user has reached role limit
      if (signup.roles.length >= MAX_ROLES_PER_USER) {
        return { success: false, error: `You can only sign up for ${MAX_ROLES_PER_USER} roles per event.` };
      }
      // Add the role
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
      const thread = await fetchThread(user, event.threadId);
      if (thread) {
        try {
          await thread.members.add(userId);
        } catch (error) {
          console.error('Failed to add user to thread:', error);
        }
      }
    }
  }

  // Save events after any signup changes
  save();

  return { success: true };
}
