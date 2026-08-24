const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits
} = require('discord.js');

const emojis = require('../../config/emojis');

module.exports = {

    data: new SlashCommandBuilder()
        .setName('sendwaitlistpanel')
        .setDescription('Send the KairoTiers testing waitlist panel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {

        const embed = new EmbedBuilder()
            .setTitle('📋 KairoTiers — Testing Waitlist')
            .setColor(0x8B0000)
            .setDescription(
                '**Welcome to the KairoTiers Testing System!**\n\n' +

                '**1️⃣ Register Your Profile**\n' +
                'Click **Register / Update Profile** and enter your Minecraft IGN, Region and Account Type.\n\n' +

                '**2️⃣ Choose Your Waitlist**\n' +
                'After registering, select a gamemode below to receive access to its testing queue.\n\n' +

                '**🌍 Regions:** `NA` • `EU` • `AS/AU` • `SA`\n\n' +

                '🔴 **Important:** You must have a registered profile to join a waitlist.'
            )
            .setFooter({
                text: 'KairoTiers • Minecraft Tier Testing'
            })
            .setTimestamp();

        // -----------------------------------------
        // REGISTER BUTTON
        // -----------------------------------------

        const registerRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('register_profile')
                    .setLabel('Register / Update Profile')
                    .setStyle(ButtonStyle.Primary)
            );

        // -----------------------------------------
        // GAMEMODE BUTTONS
        // -----------------------------------------

        const row1 = new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId('waitlist_nethpot')
                    .setLabel('NethPot')
                    .setEmoji(emojis.gamemodes.NethPot)
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId('waitlist_mace')
                    .setLabel('Mace')
                    .setEmoji(emojis.gamemodes.Mace)
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId('waitlist_sword')
                    .setLabel('Sword')
                    .setEmoji(emojis.gamemodes.Sword)
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId('waitlist_axe')
                    .setLabel('Axe')
                    .setEmoji(emojis.gamemodes.Axe)
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId('waitlist_crystal')
                    .setLabel('Crystal')
                    .setEmoji(emojis.gamemodes.Crystal)
                    .setStyle(ButtonStyle.Success)
            );

        const row2 = new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId('waitlist_diapot')
                    .setLabel('DiaPot')
                    .setEmoji(emojis.gamemodes.DiaPot)
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId('waitlist_smp')
                    .setLabel('SMP')
                    .setEmoji(emojis.gamemodes.SMP)
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId('waitlist_uhc')
                    .setLabel('UHC')
                    .setEmoji(emojis.gamemodes.UHC)
                    .setStyle(ButtonStyle.Success)
            );

        // -----------------------------------------
        // SEND PANEL
        // -----------------------------------------

        await interaction.channel.send({
            embeds: [embed],
            components: [
                registerRow,
                row1,
                row2
            ]
        });

        await interaction.reply({
            content: '✅ Waitlist panel sent.',
            ephemeral: true
        });
    }
};