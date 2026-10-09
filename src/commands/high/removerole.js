const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config/config');
const supabase = require('../../database/supabase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removerole')
        .setDescription('Remove a High Test staff role')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Staff role to remove')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (interaction.user.id !== config.roles.ownerId) {
            return interaction.reply({
                content: '❌ Only the bot owner can use this command.',
                flags: MessageFlags.Ephemeral
            });
        }

        const role = interaction.options.getRole('role');

        const { error } = await supabase
            .from('high_test_staff_roles')
            .delete()
            .eq('role_id', role.id);

        if (error) {
            console.error('HIGH TEST REMOVEROLE ERROR:', error);
            return interaction.reply({
                content: '❌ Failed to remove staff role.',
                flags: MessageFlags.Ephemeral
            });
        }

        return interaction.reply({
            content: `✅ ${role} is no longer a High Test staff role.`,
            flags: MessageFlags.Ephemeral
        });
    }
};