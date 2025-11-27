import { Client, GatewayIntentBits, REST, Routes, MessageFlags } from 'discord.js';
import { config } from 'dotenv';
import { createCommand } from './commands/create.js';
import { handleRoleButton } from './handlers/buttonHandler.js';
import { initializeEventManager, getAllEvents } from './managers/eventManager.js';
import { scheduleEventReminder, scheduleEventCleanup } from './schedulers/eventScheduler.js';

config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

// Register slash commands
const commands = [createCommand.data.toJSON()];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function registerCommands() {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
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

  for (const event of events) {
    // Re-schedule reminders and cleanups for future events
    const now = new Date();
    if (event.startTime > now) {
      scheduleEventReminder(event, client);
      scheduleEventCleanup(event, client);
      console.log(`Re-scheduled timers for event: ${event.title}`);
    } else {
      console.log(`Skipping past event: ${event.title}`);
    }
  }

  console.log('Event restoration complete');
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'create') {
        await createCommand.execute(interaction);
      }
    } else if (interaction.isButton()) {
      if (interaction.customId.startsWith('role_')) {
        await handleRoleButton(interaction);
      }
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'An error occurred processing your request.',
        flags: MessageFlags.Ephemeral
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
