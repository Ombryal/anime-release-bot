const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

function formatDate(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split('T')[0];
}

async function fetchAnimeReleases(date) {
  return [
    { title: "Naruto", time: "08:00" },
    { title: "One Piece", time: "09:00" },
    { title: "Bleach", time: "10:00" }
  ];
}

async function createEmbed(date) {
  const releases = await fetchAnimeReleases(date);

  const embed = new EmbedBuilder()
    .setTitle(`Anime Releases for ${date}`)
    .setDescription(
      releases.map(r => `• **${r.title}** at ${r.time}`).join("\n")
    )
    .setColor(0x00AE86);

  return embed;
}

async function sendInitialMessage(channel) {
  const today = formatDate(0);

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

  const embed = await createEmbed(today);

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

  const date = formatDate(offset);
  const embed = await createEmbed(date);

  await interaction.update({ embeds: [embed] });
});

client.login(TOKEN);
