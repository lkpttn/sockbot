import { createCommand } from './create.js';

// Register new slash commands here — index.js builds the registry and
// dispatcher from this list, so no other wiring is needed per command.
// Each command must export { data: SlashCommandBuilder, execute(interaction) }.
export const commands = [
  createCommand
];
