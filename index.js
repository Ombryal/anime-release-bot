const fs = require("fs");
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events } = require("discord.js");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const notifyFile = "./notify.json";

function ensureNotifyFile() {
  if (!fs.existsSync(notifyFile)) {
    fs.writeFileSync(notifyFile, JSON.stringify({ users: [] }, null, 2));
  }
}

function loadNotify() {
  ensureNotifyFile();
  return JSON.parse(fs.readFileSync(notifyFile, "utf8"));
}

function saveNotify(data) {
  fs.writeFileSync(notifyFile, JSON.stringify(data, null, 2));
}

function getDay(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function fetchSchedule(offset) {
  const query = `
    query {
      Page(page: 1, perPage: 50) {
        media(sort: POPULARITY_DESC, type: ANIME) {
          id
          title {
            romaji
          }
          coverImage {
            large
          }
          nextAiringEpisode {
            airingAt
            episode
          }
        }
      }
    }
  `;

  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query })
  });

  const data = await response.json();
  return data.data.Page.media.filter(m => m.nextAiringEpisode);
}

function formatTime(unix) {
  const date = new Date(unix * 1000);
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
}

async function getOrCreateThread(channel) {
  const threads = await channel.threads.fetch();
  let thread = threads.threads.find(t => t.name === "anime-notify");

  if (!thread) {
    thread = await channel.threads.create({
      name: "anime-notify",
      autoArchiveDuration: 1440,
      reason: "Anime notify thread"
    });
  }

  return thread;
}

async function sendScheduleMessage(channel, offset, label) {
  const schedule = await fetchSchedule(offset);

  if (!schedule.length) {
    const embed = new EmbedBuilder()
      .setTitle(`${label} Schedule`)
      .setDescription("Nothing airing that day.")
      .setColor("#2f3136");

    await channel.send({ embeds: [embed] });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${label} Schedule`)
    .setDescription(schedule.slice(0, 10).map(anime => `• **${anime.title.romaji}** at ${formatTime(anime.nextAiringEpisode.airingAt)}`).join("\n"))
    .setColor("#2f3136")
    .setThumbnail(schedule[0].coverImage.large);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("notify").setLabel("🔔 Notify Me").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("unnotify").setLabel("🔕 Unsubscribe").setStyle(ButtonStyle.Secondary)
  );

  await channel.send({ embeds: [embed], components: [row] });
}

let lastSchedule = [];

async function checkNewEpisodes() {
  const data = loadNotify();
  const users = data.users;
  if (!users.length) return;

  const channel = await client.channels.fetch(process.env.CHANNEL_ID);
  const thread = await getOrCreateThread(channel);

  const schedule = await fetchSchedule(0);
  const currentIds = schedule.map(a => a.id);

  if (!lastSchedule.length) {
    lastSchedule = currentIds;
    return;
  }

  for (const anime of schedule) {
    if (!lastSchedule.includes(anime.id)) {
      lastSchedule.push(anime.id);

      const mentions = users.map(id => `<@${id}>`).join(" ");
      await thread.send(`${mentions}\n🔔 **${anime.title.romaji}** just released a new episode!`);
    }
  }
}

client.on(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const express = require("express");
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.get("/", (req, res) => res.send("Alive"));
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

  const channel = await client.channels.fetch(process.env.CHANNEL_ID);
  await sendScheduleMessage(channel, 0, "Today");

  setInterval(checkNewEpisodes, 10 * 60 * 1000);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  const data = loadNotify();
  const userId = interaction.user.id;

  if (interaction.customId === "notify") {
    if (data.users.includes(userId)) {
      return interaction.reply({ content: "🔔 You are already subscribed.", ephemeral: true });
    }

    data.users.push(userId);
    saveNotify(data);

    return interaction.reply({ content: "🔔 Subscribed! You will be tagged in the notify thread when a new episode releases.", ephemeral: true });
  }

  if (interaction.customId === "unnotify") {
    data.users = data.users.filter(id => id !== userId);
    saveNotify(data);

    return interaction.reply({ content: "🔕 Unsubscribed.", ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
