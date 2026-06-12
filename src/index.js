import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, MessageFlags } from 'discord.js';
import { commands } from './commands/index.js';
import { handleRoleButton, handlePreviewAccept, handlePreviewDelete } from './handlers/buttonHandler.js';
import { initializeEventManager, getAllEvents } from './managers/eventManager.js';
import { scheduleEventReminder, scheduleEventCleanup, shouldCleanupEvent } from './schedulers/eventScheduler.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

// Build a name -> command lookup for dispatch, and the JSON payload for registration.
const commandMap = new Map(commands.map(command => [command.data.name, command]));
const commandData = commands.map(command => command.data.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function registerCommands() {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commandData }
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
}

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();

  // Load events from disk and re-schedule reminders/cleanups
  console.log('Loading events from disk...');
  await initializeEventManager();

  const events = getAllEvents();
  console.log(`Restoring ${events.length} events`);

  let cleanedUpCount = 0;
  let restoredCount = 0;
  let skippedCount = 0;

  const now = new Date();

  for (const event of events) {
    if (shouldCleanupEvent(event)) {
      // Past cleanup window - clean up immediately (deletes Discord messages + storage)
      console.log(`Cleaning up old event: ${event.title}`);
      scheduleEventCleanup(event, client);
      cleanedUpCount++;
    } else if (event.startTime > now) {
      // Future event - re-schedule timers
      scheduleEventReminder(event, client);
      scheduleEventCleanup(event, client);
      console.log(`Re-scheduled timers for event: ${event.title}`);
      restoredCount++;
    } else {
      // Past event but within cleanup window
      console.log(`Skipping past event: ${event.title}`);
      scheduleEventCleanup(event, client);
      skippedCount++;
    }
  }

  console.log(`Event restoration complete: ${restoredCount} restored, ${skippedCount} skipped, ${cleanedUpCount} cleaned up`);
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commandMap.get(interaction.commandName);
      if (command) {
        await command.execute(interaction);
      }
    } else if (interaction.isButton()) {
      if (interaction.customId.startsWith('role_')) {
        await handleRoleButton(interaction);
      } else if (interaction.customId.startsWith('preview_accept_')) {
        await handlePreviewAccept(interaction);
      } else if (interaction.customId.startsWith('preview_delete_')) {
        await handlePreviewDelete(interaction);
      }
    }
  } catch (error) {
    console.error('Error handling interaction:', error);

    // Only try to respond if the interaction hasn't been handled yet
    // and hasn't expired (code 10062 = Unknown interaction)
    if (error.code === 10062) {
      // Interaction expired, can't respond
      return;
    }

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'An error occurred processing your request.',
        flags: MessageFlags.Ephemeral
      }).catch(console.error);
    } else if (interaction.deferred) {
      // Interaction was deferred but not replied to yet
      await interaction.editReply({
        content: 'An error occurred processing your request.'
      }).catch(console.error);
    }
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing Discord client');
  client.destroy();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing Discord client');
  client.destroy();
  process.exit(0);
});

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

client.login(process.env.DISCORD_TOKEN);
