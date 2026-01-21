const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events } = require('discord.js');
const fetch = require('node-fetch');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

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

async function createEmbed(offset) {
  const day = getDay(offset);
  const data = await fetchSchedule(offset);

  const embed = new EmbedBuilder()
    .setTitle(`Anime Schedule - ${day}`)
    .setColor(0x00AE86);

  if (!data.length) {
    embed.setDescription("Nothing airing that day.");
    return embed;
  }

  const list = data.slice(0, 20).map(anime => {
    const title = anime.title;
    const time = anime.broadcast.time || "Unknown time";
    return `• **${title}** at **${time}**`;
  });

  embed.setDescription(list.join("\n"));
  return embed;
}

async function sendInitialMessage(channel) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('yesterday').setLabel('Yesterday').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('today').setLabel('Today').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('tomorrow').setLabel('Tomorrow').setStyle(ButtonStyle.Primary),
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
