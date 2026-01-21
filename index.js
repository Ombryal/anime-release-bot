const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
  Collection
} = require("discord.js");

const fetch = require("node-fetch");
const fs = require("fs");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const watchlistFile = "./watchlist.json";
let watchlist = {};

if (fs.existsSync(watchlistFile)) {
  watchlist = JSON.parse(fs.readFileSync(watchlistFile, "utf8"));
} else {
  fs.writeFileSync(watchlistFile, JSON.stringify({}));
}

function saveWatchlist() {
  fs.writeFileSync(watchlistFile, JSON.stringify(watchlist, null, 2));
}

function getDay(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

function getCountdown(airingTime) {
  const now = Date.now();
  const diff = airingTime - now;

  if (diff <= 0) return "Now";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m`;
}

async function fetchSchedule(offset) {
  const date = getDay(offset);
  const url = `https://api.jikan.moe/v4/schedules?filter=${date}`;

  const response = await fetch(url);
  const json = await response.json();

  return json.data || [];
}

async function fetchTrending(page = 1) {
  const url = `https://api.jikan.moe/v4/top/anime?page=${page}`;
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

async function fetchAnimeInfo(id) {
  const url = `https://api.jikan.moe/v4/anime/${id}/full`;
  const response = await fetch(url);
  const json = await response.json();
  return json.data || null;
}

function createScheduleEmbed(date, data) {
  const embed = new EmbedBuilder()
    .setTitle(`🌑 Anime Schedule • ${date}`)
    .setColor(0x2b0b3b)
    .setDescription("Here’s what’s airing today. (Dark Mode Edition)")
    .setFooter({ text: "Powered by Jikan API • Updated daily" })
    .setTimestamp();

  if (!data.length) {
    embed.setDescription("Nothing airing that day.");
    return embed;
  }

  embed.setThumbnail(data[0].images.jpg.image_url);

  const fields = data.slice(0, 10).map((anime) => {
    const time = anime.broadcast?.time || "Unknown time";
    const airingTimestamp = anime.broadcast?.time ? Date.parse(`${getDay(0)}T${time}:00Z`) : null;
    const countdown = airingTimestamp ? getCountdown(airingTimestamp) : "Unknown";

    return {
      name: `🌙 ${anime.title}`,
      value: `Type: **${anime.type}** • Time: **${time}** • Countdown: **${countdown}**`,
      inline: false,
    };
  });

  embed.addFields(fields);
  return embed;
}

function createTrendingEmbed(data, page) {
  const embed = new EmbedBuilder()
    .setTitle("🔥 Trending Anime")
    .setColor(0x2b0b3b)
    .setDescription("Top anime by popularity")
    .setFooter({ text: `Page ${page} • Powered by Jikan API` })
    .setTimestamp();

  const fields = data.slice(0, 10).map((anime) => {
    return {
      name: `• ${anime.title}`,
      value: `Score: ${anime.score || "N/A"} • Episodes: ${anime.episodes || "N/A"} • Type: ${anime.type || "N/A"}`,
      inline: false,
    };
  });

  embed.addFields(fields);
  return embed;
}

function createSearchEmbed(data, query) {
  const embed = new EmbedBuilder()
    .setTitle(`🔍 Search Results for "${query}"`)
    .setColor(0x2b0b3b)
    .setFooter({ text: "Powered by Jikan API" })
    .setTimestamp();

  if (!data.length) {
    embed.setDescription("No results found.");
    return embed;
  }

  const fields = data.map((anime) => {
    return {
      name: anime.title,
      value: `Score: ${anime.score || "N/A"} • Episodes: ${anime.episodes || "N/A"}\nID: ${anime.mal_id} • ${anime.url}`,
      inline: false,
    };
  });

  embed.addFields(fields);
  embed.setThumbnail(data[0].images.jpg.image_url);
  return embed;
}

function createRandomEmbed(anime) {
  const embed = new EmbedBuilder()
    .setTitle(`🎲 Random Anime: ${anime.title}`)
    .setColor(0x2b0b3b)
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

function createInfoEmbed(anime) {
  const embed = new EmbedBuilder()
    .setTitle(`📌 Anime Info: ${anime.title}`)
    .setColor(0x2b0b3b)
    .setDescription(anime.synopsis || "No synopsis available.")
    .setThumbnail(anime.images.jpg.image_url)
    .setFooter({ text: `ID: ${anime.mal_id} • Powered by Jikan API` })
    .addFields(
      { name: "Type", value: anime.type || "N/A", inline: true },
      { name: "Episodes", value: String(anime.episodes || "N/A"), inline: true },
      { name: "Status", value: anime.status || "N/A", inline: true },
      { name: "Score", value: String(anime.score || "N/A"), inline: true },
      { name: "Genres", value: anime.genres.map(g => g.name).slice(0, 6).join(", ") || "N/A", inline: false },
      { name: "Trailer", value: anime.trailer?.url || "N/A", inline: false }
    );

  return embed;
}

function createWatchlistEmbed(userId) {
  const list = watchlist[userId] || [];
  const embed = new EmbedBuilder()
    .setTitle("📚 Your Watchlist")
    .setColor(0x2b0b3b)
    .setFooter({ text: "Powered by Jikan API" })
    .setTimestamp();

  if (!list.length) {
    embed.setDescription("Your watchlist is empty.");
    return embed;
  }

  embed.setDescription(list.map(item => `• ${item.title} (ID: ${item.id})`).join("\n"));
  return embed;
}

async function sendScheduleMessage(channel) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("yesterday").setLabel("⬅️ Yesterday").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("today").setLabel("🟣 Today").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("tomorrow").setLabel("Tomorrow ➡️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("trending").setLabel("🔥 Trending").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("random").setLabel("🎲 Random").setStyle(ButtonStyle.Success)
  );

  const date = getDay(0);
  const data = await fetchSchedule(0);
  const embed = createScheduleEmbed(date, data);

  await channel.send({ embeds: [embed], components: [row] });
}

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Set bot presence
  client.user.setPresence({
    activities: [{ name: "Anime • /search", type: 3 }],
    status: "online",
  });

  // Auto schedule update
  const channel = await client.channels.fetch(CHANNEL_ID);
  await sendScheduleMessage(channel);

  setInterval(async () => {
    const date = getDay(0);
    const data = await fetchSchedule(0);
    const embed = createScheduleEmbed(date, data);

    // send new message every day at midnight UTC
    const now = new Date();
    if (now.getUTCHours() === 0 && now.getUTCMinutes() === 0) {
      await channel.send({ embeds: [embed] });
    }
  }, 60 * 1000);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    if (interaction.customId === "trending") {
      const data = await fetchTrending(1);
      const embed = createTrendingEmbed(data, 1);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("trend_prev_1").setLabel("⬅️ Prev").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("trend_next_1").setLabel("Next ➡️").setStyle(ButtonStyle.Secondary)
      );

      return interaction.update({ embeds: [embed], components: [row] });
    }

    if (interaction.customId === "random") {
      const anime = await fetchRandomAnime();
      const embed = createRandomEmbed(anime);
      return interaction.update({ embeds: [embed] });
    }

    let offset = 0;
    if (interaction.customId === "yesterday") offset = -1;
    if (interaction.customId === "tomorrow") offset = 1;

    const date = getDay(offset);
    const data = await fetchSchedule(offset);
    const embed = createScheduleEmbed(date, data);
    return interaction.update({ embeds: [embed] });
  }

  if (interaction.isChatInputCommand()) {
    const name = interaction.commandName;

    if (name === "search") {
      const query = interaction.options.getString("anime");
      const data = await searchAnime(query);
      const embed = createSearchEmbed(data, query);
      return interaction.reply({ embeds: [embed] });
    }

    if (name === "animeinfo") {
      const id = interaction.options.getInteger("id");
      const anime = await fetchAnimeInfo(id);
      const embed = createInfoEmbed(anime);
      return interaction.reply({ embeds: [embed] });
    }

    if (name === "watchlist") {
      const sub = interaction.options.getSubcommand();

      if (sub === "add") {
        const id = interaction.options.getInteger("id");
        const anime = await fetchAnimeInfo(id);

        if (!watchlist[interaction.user.id]) watchlist[interaction.user.id] = [];
        watchlist[interaction.user.id].push({ id: anime.mal_id, title: anime.title });
        saveWatchlist();

        return interaction.reply({ content: `✅ Added **${anime.title}** to your watchlist.`, ephemeral: true });
      }

      if (sub === "remove") {
        const id = interaction.options.getInteger("id");
        watchlist[interaction.user.id] = (watchlist[interaction.user.id] || []).filter(x => x.id !== id);
        saveWatchlist();
        return interaction.reply({ content: `🗑️ Removed ID **${id}** from your watchlist.`, ephemeral: true });
      }

      if (sub === "list") {
        const embed = createWatchlistEmbed(interaction.user.id);
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }

    if (name === "recommend") {
      const genre = interaction.options.getString("genre");
      const url = `https://api.jikan.moe/v4/anime?genres=${encodeURIComponent(genre)}&order_by=score&sort=desc&limit=5`;
      const res = await fetch(url);
      const json = await res.json();
      const data = json.data || [];

      const embed = new EmbedBuilder()
        .setTitle(`🎯 Recommendations • ${genre}`)
        .setColor(0x2b0b3b)
        .setDescription(data.length ? data.map(a => `• ${a.title} • Score: ${a.score || "N/A"}`).join("\n") : "No results found.")
        .setFooter({ text: "Powered by Jikan API" })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  }
});

client.login(TOKEN);
