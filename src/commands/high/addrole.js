const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config/config');
const supabase = require('../../database/supabase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addrole')
        .setDescription('Add a High Test staff role')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Staff role to add')
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
            .upsert({
                role_id: role.id,
                added_by: interaction.user.id
            });

        if (error) {
            console.error('HIGH TEST ADDROLE ERROR:', error);
            return interaction.reply({
                content: '❌ Failed to add staff role.',
                flags: MessageFlags.Ephemeral
            });
        }

        return interaction.reply({
            content: `✅ ${role} is now a High Test staff role.`,
            flags: MessageFlags.Ephemeral
        });
    }
};