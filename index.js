const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js');

const fetch = require('node-fetch');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function getDay(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

async function fetchSchedule(offset) {
  const date = getDay(offset);
  const url = `https://api.jikan.moe/v4/schedules?filter=${date}`;

  const response = await fetch(url);
  const json = await response.json();

  return json.data || [];
}

async function fetchTrending() {
  const url = `https://api.jikan.moe/v4/top/anime?filter=bypopularity&page=1`;
  const response = await fetch(url);
  const json = await response.json();
  return json.data || [];
}

async function searchAnime(query) {
  const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=5`;
  const response = await fetch(url);
  const json = await response.json();
  return json.data || [];
}

async function fetchRandomAnime() {
  const url = `https://api.jikan.moe/v4/random/anime`;
  const response = await fetch(url);
  const json = await response.json();
  return json.data || null;
}

function createScheduleEmbed(date, data) {
  const embed = new EmbedBuilder()
    .setTitle(`🌑 Anime Schedule • ${date}`)
    .setColor(0x2B0B3B)
    .setDescription("Here’s what’s airing today. (Dark Mode Edition)")
    .setFooter({ text: "Powered by Jikan API • Updated daily" })
    .setTimestamp();

  if (!data.length) {
    embed.setDescription("Nothing airing that day.");
    return embed;
  }

  embed.setThumbnail(data[0].images.jpg.image_url);

  const fields = data.slice(0, 10).map(anime => {
    const title = anime.title;
    const time = anime.broadcast?.time || "Unknown time";
    const type = anime.type || "Anime";

    return {
      name: `🌙 ${title}`,
      value: `**${type}** • ${time} UTC`,
      inline: true
    };
  });

  embed.addFields(fields);
  return embed;
}

function createTrendingEmbed(data) {
  const embed = new EmbedBuilder()
    .setTitle("🔥 Trending Anime")
    .setColor(0x2B0B3B)
    .setDescription("Top anime by popularity")
    .setFooter({ text: "Powered by Jikan API" })
    .setTimestamp();

  const fields = data.slice(0, 10).map(anime => {
    return {
      name: `• ${anime.title}`,
      value: `Score: ${anime.score || "N/A"} • Type: ${anime.type || "N/A"}`,
      inline: false
    };
  });

  embed.addFields(fields);
  return embed;
}

function createSearchEmbed(data, query) {
  const embed = new EmbedBuilder()
    .setTitle(`🔍 Search Results for "${query}"`)
    .setColor(0x2B0B3B)
    .setFooter({ text: "Powered by Jikan API" })
    .setTimestamp();

  if (!data.length) {
    embed.setDescription("No results found.");
    return embed;
  }

  const fields = data.map(anime => {
    return {
      name: anime.title,
      value: `Score: ${anime.score || "N/A"} • Episodes: ${anime.episodes || "N/A"}\n${anime.url}`,
      inline: false
    };
  });

  embed.addFields(fields);
  embed.setThumbnail(data[0].images.jpg.image_url);
  return embed;
}

function createRandomEmbed(anime) {
  const embed = new EmbedBuilder()
    .setTitle(`🎲 Random Anime: ${anime.title}`)
    .setColor(0x2B0B3B)
    .setDescription(anime.synopsis || "No synopsis available.")
    .setFooter({ text: "Powered by Jikan API" })
    .setTimestamp()
    .setThumbnail(anime.images.jpg.image_url)
    .addFields(
      { name: "Type", value: anime.type || "N/A", inline: true },
      { name: "Score", value: String(anime.score || "N/A"), inline: true },
      { name: "Episodes", value: String(anime.episodes || "N/A"), inline: true }
    );

  return embed;
}

async function sendScheduleMessage(channel) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('yesterday').setLabel('⬅️ Yesterday').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('today').setLabel('🟣 Today').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('tomorrow').setLabel('Tomorrow ➡️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('trending').setLabel('🔥 Trending').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('random').setLabel('🎲 Random').setStyle(ButtonStyle.Success)
  );

  const date = getDay(0);
  const data = await fetchSchedule(0);
  const embed = createScheduleEmbed(date, data);

  await channel.send({ embeds: [embed], components: [row] });
}

client.on(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const channel = await client.channels.fetch(CHANNEL_ID);
  await sendScheduleMessage(channel);
});

client.on(Events.InteractionCreate, async interaction => {
  // Button click
  if (interaction.isButton()) {
    if (interaction.customId === 'trending') {
      const data = await fetchTrending();
      const embed = createTrendingEmbed(data);
      return interaction.update({ embeds: [embed] });
    }

    if (interaction.customId === 'random') {
      const anime = await fetchRandomAnime();
      const embed = createRandomEmbed(anime);
      return interaction.update({ embeds: [embed] });
    }

    let offset = 0;
    if (interaction.customId === 'yesterday') offset = -1;
    if (interaction.customId === 'tomorrow') offset = 1;

    const date = getDay(offset);
    const data = await fetchSchedule(offset);
    const embed = createScheduleEmbed(date, data);
    return interaction.update({ embeds: [embed] });
  }

  // Slash command
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'search') {
      const query = interaction.options.getString('anime');
      const data = await searchAnime(query);
      const embed = createSearchEmbed(data, query);
      return interaction.reply({ embeds: [embed] });
    }
  }
});

client.login(TOKEN);
