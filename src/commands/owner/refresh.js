const {
    SlashCommandBuilder,
    MessageFlags
} = require('discord.js');

const config = require('../../config/config');
const queueRenderer = require('../../queue/queueRenderer');

module.exports = {

    data: new SlashCommandBuilder()
        .setName('refresh')
        .setDescription('Refresh the queue panel in this channel'),

    async execute(interaction) {

        // -----------------------------------------
        // FIND GAMEMODE FROM CURRENT CHANNEL
        // -----------------------------------------

        const gamemode =
            config.channels.queues[interaction.channelId];

        if (!gamemode) {
            return interaction.reply({
                content:
                    '<:Cross:1558553359642918952> This channel is not a KairoTiers queue channel.',
                flags: MessageFlags.Ephemeral
            });
        }

        // -----------------------------------------
        // UPDATE QUEUE PANEL
        // -----------------------------------------

        try {

            await queueRenderer.updateQueuePanel(
                interaction.client,
                gamemode
            );

            await interaction.reply({
                content:
                    `🔄 **${gamemode}** queue panel has been refreshed.`,
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {

            console.error(
                `REFRESH ERROR (${gamemode}):`,
                error
            );

            if (!interaction.replied && !interaction.deferred) {

                await interaction.reply({
                    content:
                        '<:Cross:1558553359642918952> Failed to refresh the queue panel.',
                    flags: MessageFlags.Ephemeral
                });

            }
        }
    }
};