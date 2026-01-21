const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events } = require('discord.js');
const fetch = require('node-fetch');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

// Convert offset to day name
function getDayName(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[date.getDay()];
}

// Get start and end timestamps for a day (UTC)
function getDayRangeUTC(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);

  // Set to UTC start and end
  const start = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0) / 1000;
  const end = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59) / 1000;

  return { start, end };
}

async function fetchAniListReleases(offsetDays) {
  const { start, end } = getDayRangeUTC(offsetDays);

  const query = `
    query ($start: Int, $end: Int) {
      Page(perPage: 50) {
        airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
          episode
          airingAt
          media {
            title {
              romaji
              english
            }
          }
        }
      }
    }
  `;

  const variables = { start, end };

  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables })
  });

  const json = await response.json();
  if (!json.data || !json.data.Page) return [];

  return json.data.Page.airingSchedules.map(a => {
    const title = a.media.title.english || a.media.title.romaji;
    const timeUTC = new Date(a.airingAt * 1000);
    const time = timeUTC.toISOString().split('T')[1].slice(0,5); // HH:MM

    return {
      title,
      time,
      episode: a.episode,
      hourUTC: timeUTC.getUTCHours()
    };
  });
}

function getMostActiveHour(releases) {
  const hourCount = {};

  releases.forEach(r => {
    hourCount[r.hourUTC] = (hourCount[r.hourUTC] || 0) + 1;
  });

  let maxHour = null;
  let maxCount = 0;

  for (const hour in hourCount) {
    if (hourCount[hour] > maxCount) {
      maxCount = hourCount[hour];
      maxHour = hour;
    }
  }

  return { maxHour, maxCount };
}

async function createEmbed(offsetDays) {
  const releases = await fetchAniListReleases(offsetDays);
  const dayName = getDayName(offsetDays);

  const { maxHour, maxCount } = getMostActiveHour(releases);

  const mostActiveTime = maxHour !== null
    ? `${String(maxHour).padStart(2, '0')}:00 UTC (${maxCount} episodes)`
    : "N/A";

  const embed = new EmbedBuilder()
    .setTitle(`Anime Releases - ${dayName}`)
    .setDescription(
      releases.length
        ? releases.map(r => `• **${r.title}** Ep **${r.episode}** at **${r.time} UTC**`).join("\n")
        : "Nothing airing that day."
    )
    .addFields({ name: "Most Active Time", value: mostActiveTime })
    .setColor(0x00AE86);

  return embed;
}

async function sendInitialMessage(channel) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('yesterday')
      .setLabel('Yesterday')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('today')
      .setLabel('Today')
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId('tomorrow')
      .setLabel('Tomorrow')
      .setStyle(ButtonStyle.Primary),
  );

  const embed = await createEmbed(0);
  channel.send({ embeds: [embed], components: [row] });
}

client.on(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const channel = await client.channels.fetch(CHANNEL_ID);
  await sendInitialMessage(channel);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isButton()) return;

  let offset = 0;
  if (interaction.customId === 'yesterday') offset = -1;
  if (interaction.customId === 'tomorrow') offset = 1;

  const embed = await createEmbed(offset);
  await interaction.update({ embeds: [embed] });
});

client.login(TOKEN);
