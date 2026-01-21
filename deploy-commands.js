const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const commands = [
  new SlashCommandBuilder()
    .setName("search")
    .setDescription("Search anime")
    .addStringOption(option =>
      option.setName("anime")
        .setDescription("Anime name")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("animeinfo")
    .setDescription("Get anime info by ID")
    .addIntegerOption(option =>
      option.setName("id")
        .setDescription("Anime MAL ID")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("watchlist")
    .setDescription("Manage your watchlist")
    .addSubcommand(sub =>
      sub.setName("add")
        .setDescription("Add anime to watchlist")
        .addIntegerOption(opt => opt.setName("id").setDescription("Anime MAL ID").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("remove")
        .setDescription("Remove anime from watchlist")
        .addIntegerOption(opt => opt.setName("id").setDescription("Anime MAL ID").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("list")
        .setDescription("List your watchlist")
    ),

  new SlashCommandBuilder()
    .setName("recommend")
    .setDescription("Get recommendations by genre")
    .addStringOption(opt =>
      opt.setName("genre")
        .setDescription("Genre name (action, romance, horror...)")
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("Registering commands...");
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("Commands registered!");
  } catch (error) {
    console.error(error);
  }
})();
