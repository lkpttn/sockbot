import { SlashCommandBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { TEMPLATES } from '../config.js';
import { buildEventObject } from '../managers/eventManager.js';
import { buildEventEmbed, buildEventButtons } from '../managers/embedManager.js';
import { storePreview, cleanupExpiredPreviews } from '../managers/previewManager.js';
import { parseTimeWithTimezoneFix, validateEventDate } from '../dateParser.js';

/**
 * Helper to build a subcommand with consistent options
 * @param {string} name - Subcommand name
 * @param {string} description - Subcommand description
 * @returns {Function} - Subcommand builder function
 */
function buildEventSubcommand(name, description) {
  return (subcommand) =>
    subcommand
      .setName(name)
      .setDescription(description)
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
          .setRequired(false));
}


export const createCommand = {
  data: new SlashCommandBuilder()
    .setName('create')
    .setDescription('Create a new event')
    .addSubcommand(buildEventSubcommand('fractal', 'Create a Fractal event'))
    .addSubcommand(buildEventSubcommand('party', 'Create a Party event'))
    .addSubcommand(buildEventSubcommand('raid', 'Create a Raid event'))
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
    const customRolesString = interaction.options.getString('custom-roles');

    // Parse the start time with timezone-aware fixing
    const parsedDate = parseTimeWithTimezoneFix(startString);

    if (!parsedDate) {
      // Check if timezone is missing
      if (!/\b(UTC|GMT|EST|EDT|CST|CDT|MST|MDT|PST|PDT)\b/i.test(startString)) {
        return interaction.editReply({
          content: `Please include a timezone in your start time (e.g., "4pm EST", "tomorrow 8pm PST").`
        });
      }

      return interaction.editReply({
        content: `Could not parse start time: "${startString}".\nTry formats like:\n- "reset", "reset+2"\n- "today 4pm EST", "tomorrow 8pm PST"\n- "Wednesday 8pm EST", "4pm EST"`
      });
    }

    // Validate the parsed date
    const validation = validateEventDate(parsedDate);
    if (!validation.valid) {
      return interaction.editReply({
        content: validation.error
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

    // Send preview with both role buttons and accept/delete buttons
    await interaction.editReply({
      content: '**Preview:** Review your event before posting it.',
      embeds: [embed],
      components: [...roleButtons, previewButtons]
    });
  }
};
