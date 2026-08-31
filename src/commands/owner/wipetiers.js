const {
    SlashCommandBuilder
} = require("discord.js");

const config = require("../../config/config");
const supabase = require("../../database/supabase");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("wipetiers")
        .setDescription("Remove all tiers from a player")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Player")
                .setRequired(true)
        ),

    async execute(interaction) {

        if (interaction.user.id !== process.env.OWNER_ID) {
            return interaction.reply({
                content: "❌ Only the bot owner can use this command.",
                flags: 64
            });
        }

        await interaction.deferReply({ flags: 64 });

        const user = interaction.options.getUser("user");

        const { data: player } = await supabase
            .from("players")
            .select("*")
            .eq("discord_id", user.id)
            .single();

        if (!player) {
            return interaction.editReply({
                content: "❌ Player profile not found."
            });
        }

        const member = await interaction.guild.members.fetch(user.id);

        let removed = 0;

        // Go through every gamemode
        for (const gamemode of Object.keys(config.tiers || {})) {

            const tierRoles = Object.values(config.tiers[gamemode])
                .filter(roleId => roleId);

            for (const roleId of tierRoles) {

                if (member.roles.cache.has(roleId)) {
                    await member.roles.remove(roleId);
                    removed++;
                }

            }
        }

        // Keep result history intact.
        // Only remove Discord tier roles.

        await interaction.editReply({
            content:
                `🧹 **Tier Wipe Complete**\n\n` +
                `Player: **${player.ign}**\n` +
                `Removed tier roles: **${removed}**\n\n` +
                `All gamemodes are now **Unranked**.`
        });
    }
};