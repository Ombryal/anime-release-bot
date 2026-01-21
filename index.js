const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events } = require('discord.js');
const fetch = require('node-fetch');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

function getDayRange(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(0,0,0,0);
  const start = Math.floor(d.getTime() / 1000);

  const e = new Date(d);
  e.setHours(23,59,59,999);
  const end = Math.floor(e.getTime() / 1000);

  return { start, end };
}

async function fetchAniListReleases(offsetDays) {
  const { start, end } = getDayRange(offsetDays);

  const query = `
    query ($start: Int, $end: Int) {
      Page(perPage: 25) {
        media(
          sort: POPULARITY_DESC
          airingBetween: [$start, $end]
          format_in: [TV, TV_SHORT, SPECIAL, OVA, ONA]
        ) {
          id
          title {
            romaji
            english
          }
          nextAiringEpisode {
            airingAt
            episode
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

  return json.data.Page.media.map(a => {
    const time = a.nextAiringEpisode
      ? new Date(a.nextAiringEpisode.airingAt * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      : "TBA";

    return {
      title: a.title.english || a.title.romaji,
      time,
      nextEp: a.nextAiringEpisode?.episode ?? "?"
    };
  });
}

async function createEmbed(offsetDays) {
  const releases = await fetchAniListReleases(offsetDays);

  const embed = new EmbedBuilder()
    .setTitle(`Anime Releases`)
    .setDescription(
      releases.length
        ? releases.map(r => `• **${r.title}** Ep **${r.nextEp}** at **${r.time}**`).join("\n")
        : "Nothing airing that day."
    )
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
  if (!channel) return console.log("Channel not found");

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
