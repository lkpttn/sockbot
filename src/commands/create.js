import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { TEMPLATES, DEFAULT_TIMEZONE } from '../config.js';
import { createEvent } from '../managers/eventManager.js';
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
            .setDescription('Start time (e.g., "reset", "reset+2", "tomorrow 8pm EST")')
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
            .setDescription('Start time (e.g., "reset", "reset+2", "tomorrow 8pm EST")')
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
            .setDescription('Start time (e.g., "reset", "reset+2", "tomorrow 8pm EST")')
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
            .setDescription('Start time (e.g., "reset", "reset+2", "tomorrow 8pm EST")')
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
            .setDescription('Start time (e.g., "reset", "reset+2", "tomorrow 8pm EST")')
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
    const subcommand = interaction.options.getSubcommand();
    const title = interaction.options.getString('title');
    const startString = interaction.options.getString('start');
    const description = interaction.options.getString('description');
    const duration = interaction.options.getInteger('duration');
    const customRolesString = interaction.options.getString('custom-roles');

    // Parse start time - handle GW2 reset time (7pm EDT)
    let parsedDate = parseResetTime(startString);

    if (!parsedDate) {
      // If not a reset time, try regular parsing with chrono using guild timezone
      // Users can override by specifying timezone (e.g., "8pm PST", "11am UTC")
      const reference = {
        instant: new Date(),
        timezone: DEFAULT_TIMEZONE
      };

      parsedDate = chrono.parseDate(startString, reference);
      if (!parsedDate) {
        return interaction.reply({
          content: `Could not parse start time: "${startString}". Try formats like "reset", "reset+2", "tomorrow at 8pm EST", "11am PST", or "2024-01-15 20:00"`,
          flags: MessageFlags.Ephemeral
        });
      }
    }

    // Check if start time is in the past
    if (parsedDate < new Date()) {
      return interaction.reply({
        content: 'Start time must be in the future.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Parse custom roles (now just role names, no capacity)
    const customRoles = [];
    if (customRolesString) {
      customRoles.push(...customRolesString.split(',').map(s => s.trim()));
    }

    // Create event
    const event = createEvent({
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

    // Send embed with buttons
    const embed = buildEventEmbed(event, interaction.member || interaction.user);
    const buttons = buildEventButtons(event);

    // Build content with role mention if configured
    const template = TEMPLATES[subcommand];
    const content = template.mentionRole ? `<@&${template.mentionRole}>` : undefined;

    await interaction.reply({
      content,
      embeds: [embed],
      components: buttons
    });

    // Fetch the reply message
    const message = await interaction.fetchReply();

    // Store message ID in event
    event.messageId = message.id;

    // Create a thread attached to the event message
    try {
      // Format: "Event title - Nov 27"
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const eventDate = parsedDate;
      const formattedDate = `${monthNames[eventDate.getMonth()]} ${eventDate.getDate()}`;
      const threadName = `${title} - ${formattedDate}`;

      const thread = await message.startThread({
        name: threadName,
        autoArchiveDuration: 1440, // Archive after 24 hours of inactivity
        reason: 'Event discussion thread'
      });
      event.threadId = thread.id;
    } catch (error) {
      console.error('Failed to create thread:', error);
    }

    // Schedule reminder for 15 minutes before event start
    scheduleEventReminder(event, interaction.client);

    // Schedule cleanup for 2 hours after event start
    scheduleEventCleanup(event, interaction.client);
  }
};
