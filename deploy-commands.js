const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const TOKEN = process.env.DISCORD_TOKEN;

const commands = [
  new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search anime')
    .addStringOption(option =>
      option.setName('anime')
        .setDescription('Anime name')
        .setRequired(true)
    )
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('Registering commands...');
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log('Commands registered!');
  } catch (error) {
    console.error(error);
  }
})();
