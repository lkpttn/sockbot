import { getEventByMessageId } from '../managers/eventManager.js';
import { toggleRole } from '../managers/signupManager.js';
import { buildEventEmbed } from '../managers/embedManager.js';

export async function handleRoleButton(interaction) {
  // Parse button custom ID: role_{eventId}_{roleName}
  const [, eventId, ...roleNameParts] = interaction.customId.split('_');
  const roleName = roleNameParts.join('_'); // Handle role names with underscores

  const event = getEventByMessageId(interaction.message.id);

  if (!event) {
    return interaction.reply({
      content: 'Event not found. It may have been deleted.',
      ephemeral: true
    });
  }

  const userId = interaction.user.id;

  // Toggle the role
  const result = await toggleRole(event, userId, roleName, interaction.user);

  // Update the embed
  const updatedEmbed = buildEventEmbed(event);
  await interaction.message.edit({ embeds: [updatedEmbed] });

  // Acknowledge the interaction without sending a message
  return interaction.deferUpdate();
}
