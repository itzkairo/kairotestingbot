const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config/config');
const supabase = require('../../database/supabase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a player from the High Test allowlist')
        .addUserOption(option =>
            option.setName('player')
                .setDescription('Player to remove')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (interaction.user.id !== config.roles.ownerId) {
            return interaction.reply({
                content: '❌ Only the bot owner can use this command.',
                flags: MessageFlags.Ephemeral
            });
        }

        const player = interaction.options.getUser('player');

        const { error } = await supabase
            .from('high_test_players')
            .delete()
            .eq('discord_id', player.id);

        if (error) {
            console.error('HIGH TEST REMOVE ERROR:', error);
            return interaction.reply({
                content: '❌ Failed to remove player.',
                flags: MessageFlags.Ephemeral
            });
        }

        return interaction.reply({
            content: `✅ ${player} has been removed from the High Test allowlist.`,
            flags: MessageFlags.Ephemeral
        });
    }
};