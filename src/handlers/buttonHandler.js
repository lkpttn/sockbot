import { MessageFlags } from 'discord.js';
import { getEventByMessageId, createEvent } from '../managers/eventManager.js';
import { toggleRole } from '../managers/signupManager.js';
import { buildEventEmbed, buildEventButtons } from '../managers/embedManager.js';
import { scheduleEventReminder, scheduleEventCleanup } from '../schedulers/eventScheduler.js';
import { TEMPLATES } from '../config.js';

export async function handleRoleButton(interaction) {
  // Parse button custom ID: role_{eventId}_{roleName}
  const [, eventId, ...roleNameParts] = interaction.customId.split('_');
  const roleName = roleNameParts.join('_'); // Handle role names with underscores

  const event = getEventByMessageId(interaction.message.id);

  if (!event) {
    return interaction.reply({
      content: 'Event not found. It may have been deleted.',
      flags: MessageFlags.Ephemeral
    });
  }

  const userId = interaction.user.id;

  // Toggle the role
  const result = await toggleRole(event, userId, roleName, interaction.user);

  // Check if there was an error (e.g., role limit reached)
  if (!result.success) {
    return interaction.reply({
      content: result.error,
      flags: MessageFlags.Ephemeral
    });
  }

  // Update the embed
  const updatedEmbed = buildEventEmbed(event);
  await interaction.message.edit({ embeds: [updatedEmbed] });

  // Acknowledge the interaction without sending a message
  return interaction.deferUpdate();
}

export async function handlePreviewAccept(interaction) {
  // Parse preview ID from custom ID: preview_accept_{timestamp}_{userId}
  const previewId = interaction.customId.replace('preview_accept_', '');

  // Check if preview exists and hasn't expired
  if (!global.pendingPreviews || !global.pendingPreviews.has(previewId)) {
    return interaction.reply({
      content: 'This preview has expired (15 minute timeout). Please create the event again.',
      flags: MessageFlags.Ephemeral
    });
  }

  const { event, interaction: storedInteraction } = global.pendingPreviews.get(previewId);

  // Remove from pending previews
  global.pendingPreviews.delete(previewId);

  // Get the channel to post the real event
  const channel = await interaction.client.channels.fetch(storedInteraction.channelId);

  if (!channel) {
    return interaction.reply({
      content: 'Could not find the channel to post the event.',
      flags: MessageFlags.Ephemeral
    });
  }

  // Build the real event message
  const embed = buildEventEmbed(event, interaction.member || interaction.user);
  const buttons = buildEventButtons(event);

  // Build content with role mention if configured
  const template = TEMPLATES[event.template];
  const content = template.mentionRole ? `<@&${template.mentionRole}>` : undefined;

  // Post the real event message
  const message = await channel.send({
    content,
    embeds: [embed],
    components: buttons,
    allowedMentions: { roles: [template.mentionRole] }
  });

  // Store message ID and save event to disk
  event.messageId = message.id;

  // Create a thread attached to the event message
  try {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const eventDate = new Date(event.startTime);
    const formattedDate = `${monthNames[eventDate.getMonth()]} ${eventDate.getDate()}`;
    const threadName = `${event.title} - ${formattedDate}`;

    const thread = await message.startThread({
      name: threadName,
      autoArchiveDuration: 1440,
      reason: 'Event discussion thread'
    });
    event.threadId = thread.id;
  } catch (error) {
    console.error('Failed to create thread:', error);
  }

  // Save event to disk now that we have messageId and threadId
  createEvent(event);

  // Schedule reminder and cleanup
  scheduleEventReminder(event, interaction.client);
  scheduleEventCleanup(event, interaction.client);

  // Delete the preview message
  await interaction.message.delete();

  // Acknowledge (no reply needed as we deleted the message)
  return interaction.deferUpdate().catch(() => {
    // Ignore errors if message is already deleted
  });
}

export async function handlePreviewDelete(interaction) {
  // Parse preview ID from custom ID: preview_delete_{timestamp}_{userId}
  const previewId = interaction.customId.replace('preview_delete_', '');

  // Remove from pending previews if it exists
  if (global.pendingPreviews && global.pendingPreviews.has(previewId)) {
    global.pendingPreviews.delete(previewId);
  }

  // Delete the preview message
  await interaction.message.delete();

  // Acknowledge (no reply needed as we deleted the message)
  return interaction.deferUpdate().catch(() => {
    // Ignore errors if message is already deleted
  });
}
