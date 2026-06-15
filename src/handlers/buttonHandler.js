import {
  MessageFlags,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { getEventByMessageId, getEvent, createEvent, updateEvent, deleteEvent } from '../managers/eventManager.js';
import { toggleRole } from '../managers/signupManager.js';
import { buildEventEmbed, buildEventButtons, buildEventComponents } from '../managers/embedManager.js';
import {
  scheduleEventReminder,
  scheduleEventCleanup,
  cancelEventReminder,
  cancelEventCleanup
} from '../schedulers/eventScheduler.js';
import { DEFAULT_TIMEZONE } from '../config.js';
import { extractTimezone, parseEventTime, validateEventDate } from '../dateParser.js';
import { getPreview, deletePreview, hasPreview } from '../managers/previewManager.js';

/**
 * Format a date for thread naming in the event's timezone
 * @param {Date} date - The date to format
 * @param {string} timezone - IANA timezone (e.g., 'America/New_York')
 * @returns {string} - Formatted date (e.g., "Nov 27")
 */
function formatThreadDate(date, timezone = DEFAULT_TIMEZONE) {
  return date.toLocaleDateString('en-US', {
    timeZone: timezone,
    month: 'short',
    day: 'numeric'
  });
}

export async function handleRoleButton(interaction) {
  // Parse button custom ID: role_{eventId}_{roleName}
  const [, _eventId, ...roleNameParts] = interaction.customId.split('_');
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
  // Use interaction.update() instead of deferUpdate() + message.edit()
  // This updates the message AND acknowledges the interaction in one call
  const updatedEmbed = buildEventEmbed(event);
  return interaction.update({ embeds: [updatedEmbed] });
}

export async function handlePreviewAccept(interaction) {
  // Parse preview ID from custom ID: preview_accept_{timestamp}_{userId}
  const previewId = interaction.customId.replace('preview_accept_', '');

  // Check if preview exists and hasn't expired
  if (!hasPreview(previewId)) {
    return interaction.reply({
      content: 'This preview has expired (15 minute timeout). Please create the event again.',
      flags: MessageFlags.Ephemeral
    });
  }

  const { event, interaction: storedInteraction } = getPreview(previewId);

  if (interaction.user.id !== storedInteraction.userId) {
    return interaction.reply({
      content: 'Only the creator can accept this preview.',
      flags: MessageFlags.Ephemeral
    });
  }

  // Remove from pending previews
  deletePreview(previewId);

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
  const buttons = buildEventComponents(event);

  // Build content with the required role mention
  const mentionRoleId = event.mentionRoleId;
  const content = mentionRoleId ? `<@&${mentionRoleId}>` : undefined;

  // Post the real event message
  const message = await channel.send({
    content,
    embeds: [embed],
    components: buttons,
    allowedMentions: mentionRoleId ? { roles: [mentionRoleId] } : { parse: [] }
  });

  // Store message ID and save event to disk
  event.messageId = message.id;

  // Create a thread attached to the event message
  try {
    const formattedDate = formatThreadDate(event.startTime, event.timezone);
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

  // Delete the preview message (non-ephemeral messages can be deleted)
  try {
    await interaction.message.delete();
  } catch (error) {
    // Message may already be deleted - ignore
    console.log('Preview message already deleted or inaccessible');
  }
}

export async function handlePreviewDelete(interaction) {
  // Parse preview ID from custom ID: preview_delete_{timestamp}_{userId}
  const previewId = interaction.customId.replace('preview_delete_', '');

  if (hasPreview(previewId)) {
    const { interaction: storedInteraction } = getPreview(previewId);

    if (interaction.user.id !== storedInteraction.userId) {
      return interaction.reply({
        content: 'Only the creator can delete this preview.',
        flags: MessageFlags.Ephemeral
      });
    }
  }

  // Remove from pending previews if it exists
  deletePreview(previewId);

  // Delete the preview message (non-ephemeral messages can be deleted)
  try {
    await interaction.message.delete();
  } catch (error) {
    // Message may already be deleted - ignore
    console.log('Preview message already deleted or inaccessible');
  }
}

/**
 * Whether the interacting user may edit/manage this event.
 * The creator always can; server managers (Manage Server) can too, as an
 * escape hatch when a creator is unavailable.
 * @param {import('discord.js').Interaction} interaction
 * @param {object} event
 * @returns {boolean}
 */
function canManageEvent(interaction, event) {
  if (interaction.user.id === event.creatorId) return true;
  return interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
}

/**
 * Format an event's stored start time back into a human, re-parseable string
 * for pre-filling the edit modal (e.g. "Wed, Jun 18, 2026, 8:00 PM EDT").
 * The short timezone name round-trips through extractTimezone/parseEventTime.
 * @param {Date} date
 * @param {string} timezone - IANA timezone
 * @returns {string}
 */
function formatStartForInput(date, timezone) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  }).format(date);
}

export async function handleEditOpen(interaction) {
  // Custom ID: edit_open_{eventId}
  const eventId = interaction.customId.replace('edit_open_', '');
  const event = getEvent(eventId) || getEventByMessageId(interaction.message.id);

  if (!event) {
    return interaction.reply({
      content: 'Event not found. It may have been deleted.',
      flags: MessageFlags.Ephemeral
    });
  }

  if (!canManageEvent(interaction, event)) {
    return interaction.reply({
      content: 'Only the event creator or a server manager can edit this event.',
      flags: MessageFlags.Ephemeral
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`edit_submit_${event.id}`)
    .setTitle('Edit Event');

  const titleInput = new TextInputBuilder()
    .setCustomId('title')
    .setLabel('Title')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(256)
    .setRequired(true)
    .setValue(event.title);

  const descriptionInput = new TextInputBuilder()
    .setCustomId('description')
    .setLabel('Description')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(1024)
    .setRequired(false)
    .setValue(event.description ?? '');

  const startInput = new TextInputBuilder()
    .setCustomId('start')
    .setLabel('Start time')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(formatStartForInput(event.startTime, event.timezone));

  const durationInput = new TextInputBuilder()
    .setCustomId('duration')
    .setLabel('Duration (minutes)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(String(event.duration));

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(descriptionInput),
    new ActionRowBuilder().addComponents(startInput),
    new ActionRowBuilder().addComponents(durationInput)
  );

  return interaction.showModal(modal);
}

export async function handleEditSubmit(interaction) {
  // Custom ID: edit_submit_{eventId}
  const eventId = interaction.customId.replace('edit_submit_', '');
  const event = getEvent(eventId);

  if (!event) {
    return interaction.reply({
      content: 'Event not found. It may have been deleted.',
      flags: MessageFlags.Ephemeral
    });
  }

  // Re-check permissions (defense in depth — the button gate is not enough on its own)
  if (!canManageEvent(interaction, event)) {
    return interaction.reply({
      content: 'Only the event creator or a server manager can edit this event.',
      flags: MessageFlags.Ephemeral
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const title = interaction.fields.getTextInputValue('title').trim();
  const descriptionRaw = interaction.fields.getTextInputValue('description').trim();
  const description = descriptionRaw.length > 0 ? descriptionRaw : null;
  const startString = interaction.fields.getTextInputValue('start').trim();
  const durationString = interaction.fields.getTextInputValue('duration').trim();

  if (title.length > 256) {
    return interaction.editReply({
      content: `Title is too long (${title.length}/256 characters).`
    });
  }
  if (description && description.length > 1024) {
    return interaction.editReply({
      content: `Description is too long (${description.length}/1024 characters).`
    });
  }

  // Parse duration
  const duration = Number.parseInt(durationString, 10);
  if (!Number.isInteger(duration) || duration < 1 || duration > 1440) {
    return interaction.editReply({
      content: `Duration must be a whole number of minutes between 1 and 1440 (got "${durationString}").`
    });
  }

  // Parse start time the same way /create does
  const tz = extractTimezone(startString);
  const ianaTimezone = tz?.iana ?? event.timezone ?? DEFAULT_TIMEZONE;
  const parsedDate = parseEventTime(startString, ianaTimezone);

  if (!parsedDate) {
    return interaction.editReply({
      content: `Could not parse start time: "${startString}".\nTry formats like "Wednesday 8pm EST", "tomorrow 9pm PST", or "reset".`
    });
  }

  // Treat the start time as changed only if it moved by more than a minute —
  // the modal prefill only carries minute precision, so an untouched field
  // round-trips to (approximately) the original instant.
  const startChanged = Math.abs(parsedDate.getTime() - event.startTime.getTime()) > 60_000;

  // Only enforce the future/range check when the start time actually changed,
  // so cosmetic edits to an already-started event aren't blocked.
  if (startChanged) {
    const validation = validateEventDate(parsedDate);
    if (!validation.valid) {
      return interaction.editReply({ content: validation.error });
    }
  }

  // Capture what changed for the thread notice
  const changes = [];
  if (title !== event.title) {
    changes.push(`**Title:** ${event.title} → ${title}`);
  }
  if (description !== event.description) {
    changes.push(`**Description:** ${description ?? '*(removed)*'}`);
  }
  if (startChanged) {
    const newTs = Math.floor(parsedDate.getTime() / 1000);
    changes.push(`**Start:** <t:${newTs}:F>`);
  }
  if (duration !== event.duration) {
    changes.push(`**Duration:** ${duration} minutes`);
  }

  if (changes.length === 0) {
    return interaction.editReply({ content: 'No changes were made.' });
  }

  // Apply the update
  const updates = { title, description, duration };
  if (startChanged) {
    updates.startTime = parsedDate;
    updates.timezone = ianaTimezone;
  }
  updateEvent(event.id, updates);

  // If the start moved, re-arm the reminder/cleanup timers — otherwise they
  // fire at the old time.
  if (startChanged) {
    cancelEventReminder(event.id);
    cancelEventCleanup(event.id);
    scheduleEventReminder(event, interaction.client);
    scheduleEventCleanup(event, interaction.client);
  }

  // Re-render the event message in place (content/components preserved by
  // editing embeds only — this keeps the role ping from firing again).
  try {
    const channel = await interaction.client.channels.fetch(event.channelId);
    const message = await channel.messages.fetch(event.messageId);
    await message.edit({ embeds: [buildEventEmbed(event)] });
  } catch (error) {
    console.error('Failed to update event message after edit:', error);
  }

  // Keep the thread name in sync with the (possibly new) title/date
  if (event.threadId) {
    try {
      const thread = await interaction.client.channels.fetch(event.threadId);
      if (thread?.isThread()) {
        const formattedDate = formatThreadDate(event.startTime, event.timezone);
        await thread.setName(`${event.title} - ${formattedDate}`);
      }
    } catch (error) {
      console.error('Failed to rename thread after edit:', error);
    }
  }

  // Post an "event updated" notice in the thread
  if (event.threadId) {
    try {
      const thread = await interaction.client.channels.fetch(event.threadId);
      if (thread?.isThread()) {
        await thread.send({
          content: `✏️ Event updated by <@${interaction.user.id}>:\n${changes.map(c => `- ${c}`).join('\n')}`,
          allowedMentions: { parse: [] }
        });
      }
    } catch (error) {
      console.error('Failed to post update notice to thread:', error);
    }
  }

  return interaction.editReply({ content: 'Event updated.' });
}

export async function handleDeleteOpen(interaction) {
  // Custom ID: delete_open_{eventId}
  const eventId = interaction.customId.replace('delete_open_', '');
  const event = getEvent(eventId) || getEventByMessageId(interaction.message.id);

  if (!event) {
    return interaction.reply({
      content: 'Event not found. It may have been deleted.',
      flags: MessageFlags.Ephemeral
    });
  }

  if (!canManageEvent(interaction, event)) {
    return interaction.reply({
      content: 'Only the event creator or a server manager can delete this event.',
      flags: MessageFlags.Ephemeral
    });
  }

  // Ask for confirmation before the destructive action — deleting removes the
  // event message and its thread (and any discussion in it).
  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`delete_confirm_${event.id}`)
      .setLabel('Delete event')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`delete_cancel_${event.id}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
  );

  return interaction.reply({
    content: `Delete **${event.title}**? This removes the event message and its thread, and can't be undone.`,
    components: [confirmRow],
    flags: MessageFlags.Ephemeral
  });
}

export async function handleDeleteConfirm(interaction) {
  // Custom ID: delete_confirm_{eventId}
  const eventId = interaction.customId.replace('delete_confirm_', '');
  const event = getEvent(eventId);

  if (!event) {
    return interaction.update({
      content: 'Event not found. It may have already been deleted.',
      components: []
    });
  }

  // Re-check permissions (defense in depth)
  if (!canManageEvent(interaction, event)) {
    return interaction.update({
      content: 'Only the event creator or a server manager can delete this event.',
      components: []
    });
  }

  // Cancel pending timers so they don't fire on a deleted event
  cancelEventReminder(event.id);
  cancelEventCleanup(event.id);

  // Delete the event message (this also removes its thread)
  try {
    const channel = await interaction.client.channels.fetch(event.channelId);
    const message = await channel.messages.fetch(event.messageId);
    await message.delete();
  } catch (error) {
    console.error('Failed to delete event message:', error);
  }

  // Delete the thread explicitly in case it outlived the message
  if (event.threadId) {
    try {
      const thread = await interaction.client.channels.fetch(event.threadId);
      if (thread?.isThread()) {
        await thread.delete();
      }
    } catch (error) {
      // Thread is usually gone once the message is deleted — ignore
    }
  }

  // Remove from storage
  deleteEvent(event.id);

  return interaction.update({
    content: `Deleted **${event.title}**.`,
    components: []
  });
}

export async function handleDeleteCancel(interaction) {
  return interaction.update({
    content: 'Deletion cancelled. The event is unchanged.',
    components: []
  });
}
