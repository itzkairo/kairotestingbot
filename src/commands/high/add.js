const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config/config');
const supabase = require('../../database/supabase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add')
        .setDescription('Add a player to the High Test allowlist')
        .addUserOption(option =>
            option.setName('player')
                .setDescription('Player to add')
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
            .upsert({
                discord_id: player.id,
                added_by: interaction.user.id
            });

        if (error) {
            console.error('HIGH TEST ADD ERROR:', error);
            return interaction.reply({
                content: '❌ Failed to add player. Check the database.',
                flags: MessageFlags.Ephemeral
            });
        }

        return interaction.reply({
            content: `✅ ${player} has been added to the High Test allowlist.`,
            flags: MessageFlags.Ephemeral
        });
    }
};