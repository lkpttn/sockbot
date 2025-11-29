import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { TEMPLATES, ROLE_EMOJIS, DEFAULT_ROLE_EMOJI, sortRoles } from '../config.js';

export function buildEventEmbed(event, creator = null) {
  const template = TEMPLATES[event.template];
  const startTimestamp = Math.floor(event.startTime.getTime() / 1000);

  const embed = new EmbedBuilder()
    .setColor('#1cd8e5')
    .setTitle(event.title)
    .setDescription(event.description || `${template.name} Event`)
    .addFields(
      { name: 'Type', value: template.name, inline: true },
      { name: 'Start', value: `<t:${startTimestamp}:F>`, inline: true },
      { name: 'Duration', value: `${event.duration} minutes`, inline: true }
    );

  // Add footer with creator name (from member/user object or stored creatorName)
  if (creator) {
    const displayName = creator.displayName || creator.username;
    embed.setFooter({ text: `Created by ${displayName}` });
  } else if (event.creatorName) {
    embed.setFooter({ text: `Created by ${event.creatorName}` });
  }

  // Accepted signups with overflow handling
  const signupCount = event.signups.length;
  const FIELD_CHAR_LIMIT = 1024;
  const acceptedFields = [];
  let currentFieldValue = '';
  let fieldIndex = 0;

  if (signupCount > 0) {
    for (const signup of event.signups) {
      const mention = `<@${signup.userId}>`;
      // Sort roles in standard order, then map to emojis
      const sortedRoles = sortRoles(signup.roles);
      const roleEmojis = sortedRoles.map(r => ROLE_EMOJIS[r] || DEFAULT_ROLE_EMOJI).join(' ');
      const line = `- ${mention} ${roleEmojis}\n`;

      // Check if adding this line would exceed the limit
      if (currentFieldValue.length + line.length > FIELD_CHAR_LIMIT) {
        // Save current field and start a new one
        acceptedFields.push({
          name: fieldIndex === 0 ? `Accepted (${signupCount}/${event.capacity})` : `Accepted (cont.)`,
          value: currentFieldValue,
          inline: false
        });
        currentFieldValue = line;
        fieldIndex++;
      } else {
        currentFieldValue += line;
      }
    }

    // Add the last field
    acceptedFields.push({
      name: fieldIndex === 0 ? `Accepted (${signupCount}/${event.capacity})` : `Accepted (cont.)`,
      value: currentFieldValue,
      inline: false
    });
  } else {
    acceptedFields.push({
      name: `Accepted (${signupCount}/${event.capacity})`,
      value: '*No signups yet*',
      inline: false
    });
  }

  embed.addFields(...acceptedFields);

  // Waitlist with overflow handling
  if (event.waitlist.length > 0) {
    const waitlistFields = [];
    let currentFieldValue = '';
    let fieldIndex = 0;

    for (const signup of event.waitlist) {
      const mention = `<@${signup.userId}>`;
      // Sort roles in standard order, then map to emojis
      const sortedRoles = sortRoles(signup.roles);
      const roleEmojis = sortedRoles.map(r => ROLE_EMOJIS[r] || DEFAULT_ROLE_EMOJI).join(' ');
      const line = `- ${mention} ${roleEmojis}\n`;

      // Check if adding this line would exceed the limit
      if (currentFieldValue.length + line.length > FIELD_CHAR_LIMIT) {
        // Save current field and start a new one
        waitlistFields.push({
          name: fieldIndex === 0 ? `Waitlist (${event.waitlist.length})` : `Waitlist (cont.)`,
          value: currentFieldValue,
          inline: false
        });
        currentFieldValue = line;
        fieldIndex++;
      } else {
        currentFieldValue += line;
      }
    }

    // Add the last field
    waitlistFields.push({
      name: fieldIndex === 0 ? `Waitlist (${event.waitlist.length})` : `Waitlist (cont.)`,
      value: currentFieldValue,
      inline: false
    });

    embed.addFields(...waitlistFields);
  }

  return embed;
}

export function buildEventButtons(event) {
  const buttons = [];

  // Role-specific button styles
  const roleStyles = {
    'DPS': ButtonStyle.Danger,
    'Boon DPS': ButtonStyle.Primary,
    'Healer': ButtonStyle.Success
  };

  for (const roleName of event.roles) {
    // Create a button ID that encodes the event ID and role
    const customId = `role_${event.id}_${roleName}`;

    // Get emoji ID for the role
    // Custom emoji format: <:name:id> or <a:name:id>
    const emojiString = ROLE_EMOJIS[roleName] || DEFAULT_ROLE_EMOJI;
    const emojiMatch = emojiString.match(/<a?:(\w+):(\d+)>/);

    // Get style for the role (custom roles use Secondary)
    const style = roleStyles[roleName] || ButtonStyle.Secondary;

    const button = new ButtonBuilder()
      .setCustomId(customId)
      .setLabel(roleName)
      .setStyle(style);

    // Set emoji using the ID extracted from the string
    if (emojiMatch) {
      button.setEmoji(emojiMatch[2]); // Use just the emoji ID
    }

    buttons.push(button);
  }

  // Discord limits to 5 buttons per row, so we might need multiple rows
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    const row = new ActionRowBuilder().addComponents(buttons.slice(i, i + 5));
    rows.push(row);
  }

  return rows;
}
