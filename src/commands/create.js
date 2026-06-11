import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { TEMPLATES, DEFAULT_TIMEZONE } from '../config.js';
import { buildEventObject } from '../managers/eventManager.js';
import { buildEventEmbed, buildEventButtons } from '../managers/embedManager.js';
import { storePreview, cleanupExpiredPreviews } from '../managers/previewManager.js';
import { extractTimezone, parseEventTime, validateEventDate } from '../dateParser.js';

/**
 * Helper to build a subcommand with consistent options
 * @param {string} name - Subcommand name
 * @param {string} description - Subcommand description
 * @returns {Function} - Subcommand builder function
 */
function buildEventSubcommand(name, description) {
  return (subcommand) => {
    subcommand
      .setName(name)
      .setDescription(description)
      .addStringOption(option =>
        option.setName('title')
          .setDescription('Event title (max 256 characters)')
          .setMaxLength(256)
          .setRequired(true))
      .addRoleOption(option =>
        option.setName('mention')
          .setDescription('Role to ping when the event is posted')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('start')
          .setDescription('Start time (e.g., "reset", "4pm EST", "Wednesday 8pm EST", "tomorrow 9pm PST")')
          .setRequired(true));

    // Add this template's required Yes/No toggle-role fields (e.g. squad's Kite).
    // These must come before the optional fields below (Discord requires required-first).
    for (const toggle of TEMPLATES[name].toggleRoles ?? []) {
      subcommand.addBooleanOption(option =>
        option.setName(toggle.option)
          .setDescription(toggle.description)
          .setRequired(true));
    }

    subcommand
      .addStringOption(option =>
        option.setName('description')
          .setDescription('Event description (max 1024 characters)')
          .setMaxLength(1024)
          .setRequired(false))
      .addIntegerOption(option =>
        option.setName('duration')
          .setDescription('Duration in minutes')
          .setMinValue(1)
          .setMaxValue(1440)
          .setRequired(false));

    return subcommand;
  };
}

export const createCommand = {
  data: new SlashCommandBuilder()
    .setName('create')
    .setDescription('Create a new event')
    .addSubcommand(buildEventSubcommand('party', 'Create a Party event'))
    .addSubcommand(buildEventSubcommand('squad', 'Create a Squad event'))
    .addSubcommand(buildEventSubcommand('freeform', 'Create a Freeform event')),

  async execute(interaction) {
    // Defer reply immediately to prevent timeout (non-ephemeral so we can delete it later)
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();
    const title = interaction.options.getString('title');
    const startString = interaction.options.getString('start');
    const description = interaction.options.getString('description');
    const duration = interaction.options.getInteger('duration');
    const mentionRoleId = interaction.options.getRole('mention').id;

    // Additional validation for title length (Discord's setMaxLength should handle this, but being safe)
    if (title.length > 256) {
      return interaction.editReply({
        content: `Event title is too long (${title.length}/256 characters). Please shorten it by ${title.length - 256} characters.`
      });
    }

    // Validate description length if provided
    if (description && description.length > 1024) {
      return interaction.editReply({
        content: `Event description is too long (${description.length}/1024 characters). Please shorten it by ${description.length - 1024} characters.`
      });
    }

    // Extract timezone from input, fall back to guild default
    const tz = extractTimezone(startString);
    const ianaTimezone = tz?.iana ?? DEFAULT_TIMEZONE;

    // Parse the start time with timezone-aware reference
    const parsedDate = parseEventTime(startString, ianaTimezone);

    if (!parsedDate) {
      return interaction.editReply({
        content: `Could not parse start time: "${startString}".\nTry formats like:\n- "reset", "reset+2"\n- "today 4pm EST", "tomorrow 8pm PST"\n- "Wednesday 8pm EST", "4pm EST"\n- "8pm" (defaults to ${DEFAULT_TIMEZONE})`
      });
    }

    // Validate the parsed date
    const validation = validateEventDate(parsedDate);
    if (!validation.valid) {
      return interaction.editReply({
        content: validation.error
      });
    }

    const templateConfig = TEMPLATES[subcommand];

    // Apply this template's toggle-role fields (e.g. squad's Kite): each Yes adds its role.
    const toggledRoles = (templateConfig.toggleRoles ?? [])
      .filter(toggle => interaction.options.getBoolean(toggle.option))
      .map(toggle => toggle.role);

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
      duration: duration || templateConfig.duration,
      timezone: ianaTimezone,
      extraRoles: toggledRoles,
      mentionRoleId
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

    // Store event data temporarily using preview manager
    storePreview(previewId, {
      event,
      interaction: {
        channelId: interaction.channelId,
        guildId: interaction.guildId,
        userId: interaction.user.id,
        username: interaction.member?.displayName || interaction.user.username
      }
    });

    // Clean up old expired previews
    cleanupExpiredPreviews();

    // Show the role that will be pinged so the creator can confirm it in the
    // preview. Suppress the actual ping here.
    // Send preview with both role buttons and accept/delete buttons
    await interaction.editReply({
      content: `**Preview:** Review your event before posting it.\nWill notify: <@&${event.mentionRoleId}>`,
      embeds: [embed],
      components: [...roleButtons, previewButtons],
      allowedMentions: { parse: [] }
    });
  }
};
