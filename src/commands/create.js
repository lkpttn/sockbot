import { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { TEMPLATES, DEFAULT_TIMEZONE } from '../config.js';
import { buildEventObject } from '../managers/eventManager.js';
import { buildEventEmbed, buildEventButtons } from '../managers/embedManager.js';
import { scheduleEventCleanup, scheduleEventReminder } from '../schedulers/eventScheduler.js';
import * as chrono from 'chrono-node';

/**
 * Parse GW2 reset time strings (00:00 UTC / midnight UTC)
 * Supports: "reset", "at reset", "reset+1", "reset +2", "tomorrow reset", etc.
 * @param {string} timeString - The time string to parse
 * @returns {Date|null} - Parsed date or null if not a reset time string
 */
function parseResetTime(timeString) {
  const lowerStr = timeString.toLowerCase().trim();

  // Check if string contains "reset"
  if (!lowerStr.includes('reset')) {
    return null;
  }

  // GW2 reset is at 00:00 UTC (midnight UTC)
  const RESET_HOUR_UTC = 0;

  // Extract offset if present (e.g., "reset+2" or "reset +2")
  const offsetMatch = lowerStr.match(/reset\s*\+?\s*(\d+(?:\.\d+)?)/);
  const offsetHours = offsetMatch ? parseFloat(offsetMatch[1]) : 0;

  // Check if "tomorrow" is mentioned
  const isTomorrow = lowerStr.includes('tomorrow');

  // Get current UTC time
  const now = new Date();

  // Calculate next reset time in UTC
  let resetDate = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    RESET_HOUR_UTC,
    0,
    0,
    0
  ));

  // If reset has already passed today and not explicitly "tomorrow", use tomorrow
  if (resetDate <= now && !isTomorrow) {
    resetDate.setUTCDate(resetDate.getUTCDate() + 1);
  } else if (isTomorrow) {
    // Explicitly tomorrow
    resetDate.setUTCDate(resetDate.getUTCDate() + 1);
  }

  // Add offset in hours
  if (offsetHours > 0) {
    resetDate.setUTCHours(resetDate.getUTCHours() + Math.floor(offsetHours));
    resetDate.setUTCMinutes(resetDate.getUTCMinutes() + Math.round((offsetHours % 1) * 60));
  }

  return resetDate;
}

export const createCommand = {
  data: new SlashCommandBuilder()
    .setName('create')
    .setDescription('Create a new event')
    .addSubcommand(subcommand =>
      subcommand
        .setName('fractal')
        .setDescription('Create a Fractal event')
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Event title')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('start')
            .setDescription('Start time (e.g., "reset", "4pm EST", "Wednesday 8pm EST", "tomorrow 9pm PST")')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('description')
            .setDescription('Event description')
            .setRequired(false))
        .addIntegerOption(option =>
          option.setName('duration')
            .setDescription('Duration in minutes')
            .setRequired(false))
        .addStringOption(option =>
          option.setName('custom-roles')
            .setDescription('Custom roles (comma-separated: "Glutbender, Kiter")')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('party')
        .setDescription('Create a Party event')
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Event title')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('start')
            .setDescription('Start time (e.g., "reset", "4pm EST", "Wednesday 8pm EST", "tomorrow 9pm PST")')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('description')
            .setDescription('Event description')
            .setRequired(false))
        .addIntegerOption(option =>
          option.setName('duration')
            .setDescription('Duration in minutes')
            .setRequired(false))
        .addStringOption(option =>
          option.setName('custom-roles')
            .setDescription('Custom roles (comma-separated: "Glutbender, Kiter")')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('raid')
        .setDescription('Create a Raid event')
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Event title')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('start')
            .setDescription('Start time (e.g., "reset", "4pm EST", "Wednesday 8pm EST", "tomorrow 9pm PST")')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('description')
            .setDescription('Event description')
            .setRequired(false))
        .addIntegerOption(option =>
          option.setName('duration')
            .setDescription('Duration in minutes')
            .setRequired(false))
        .addStringOption(option =>
          option.setName('custom-roles')
            .setDescription('Custom roles (comma-separated: "Glutbender, Kiter")')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('squad')
        .setDescription('Create a Squad event')
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Event title')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('start')
            .setDescription('Start time (e.g., "reset", "4pm EST", "Wednesday 8pm EST", "tomorrow 9pm PST")')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('description')
            .setDescription('Event description')
            .setRequired(false))
        .addIntegerOption(option =>
          option.setName('duration')
            .setDescription('Duration in minutes')
            .setRequired(false))
        .addStringOption(option =>
          option.setName('custom-roles')
            .setDescription('Custom roles (comma-separated: "Glutbender, Kiter")')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('freeform')
        .setDescription('Create a Freeform event')
        .addStringOption(option =>
          option.setName('title')
            .setDescription('Event title')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('start')
            .setDescription('Start time (e.g., "reset", "4pm EST", "Wednesday 8pm EST", "tomorrow 9pm PST")')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('description')
            .setDescription('Event description')
            .setRequired(false))
        .addIntegerOption(option =>
          option.setName('duration')
            .setDescription('Duration in minutes')
            .setRequired(false))
        .addStringOption(option =>
          option.setName('custom-roles')
            .setDescription('Custom roles (comma-separated: "Glutbender, Kiter")')
            .setRequired(false))),

  async execute(interaction) {
    // Defer reply immediately to prevent timeout (non-ephemeral so we can delete it later)
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();
    const title = interaction.options.getString('title');
    const startString = interaction.options.getString('start');
    const description = interaction.options.getString('description');
    const duration = interaction.options.getInteger('duration');
    const customRolesString = interaction.options.getString('custom-roles');

    let parsedDate;

    // Try GW2 reset time parsing first
    parsedDate = parseResetTime(startString);

    if (!parsedDate) {
      // Require explicit timezone in the input for clarity
      if (!/\b(UTC|GMT|EST|EDT|CST|CDT|MST|MDT|PST|PDT)\b/i.test(startString)) {
        return interaction.editReply({
          content: `Please include a timezone in your start time (e.g., "4pm EST", "tomorrow 8pm PST").`
        });
      }

      parsedDate = chrono.parseDate(startString);
      if (!parsedDate) {
        return interaction.editReply({
          content: `Could not parse start time: "${startString}".\nTry formats like:\n- "reset", "reset+2"\n- "4pm EST", "8:30pm PST"\n- "tomorrow 4pm EST", "Wednesday 8pm EST"`
        });
      }
    }

    // Check if start time is in the past
    const now = new Date();
    if (parsedDate < now) {
      return interaction.editReply({
        content: 'Start time must be in the future.'
      });
    }

    // Parse custom roles (now just role names, no capacity)
    const customRoles = [];
    if (customRolesString) {
      customRoles.push(...customRolesString.split(',').map(s => s.trim()));
    }

    // Build preview event (not saved yet)
    const event = buildEventObject({
      channelId: interaction.channelId,
      guildId: interaction.guildId,
      creatorId: interaction.user.id,
      creatorName: interaction.member?.displayName || interaction.user.username,
      template: subcommand,
      title,
      description,
      startTime: parsedDate,
      duration: duration || TEMPLATES[subcommand].duration,
      customRoles
    });

    // Build preview embed and role buttons
    const embed = buildEventEmbed(event, interaction.member || interaction.user);
    const roleButtons = buildEventButtons(event);

    // Create Accept/Delete buttons with event data encoded in custom ID
    const previewId = `${Date.now()}_${interaction.user.id}`;
    const previewButtons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`preview_accept_${previewId}`)
          .setLabel('Accept')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`preview_delete_${previewId}`)
          .setLabel('Delete')
          .setStyle(ButtonStyle.Danger)
      );

    // Store event data temporarily (we'll use a Map in memory)
    if (!global.pendingPreviews) {
      global.pendingPreviews = new Map();
    }
    global.pendingPreviews.set(previewId, {
      event,
      createdAt: Date.now(),
      interaction: {
        channelId: interaction.channelId,
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.member?.displayName || interaction.user.username
      }
    });

    // Clean up old previews (older than 15 minutes)
    const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
    for (const [key, value] of global.pendingPreviews.entries()) {
      if (value.createdAt < fifteenMinutesAgo) {
        global.pendingPreviews.delete(key);
      }
    }

    // Send ephemeral preview with both role buttons and accept/delete buttons
    await interaction.editReply({
      content: '**Preview:** Review your event before posting it.',
      embeds: [embed],
      components: [...roleButtons, previewButtons]
    });
  }
};
