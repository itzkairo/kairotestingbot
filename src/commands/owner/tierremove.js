const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

const config = require("../../config/config");
const supabase = require("../../database/supabase");
const perms = require("../../utils/permissions");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("tierremove")
        .setDescription("Remove a player's tier")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Player")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("gamemode")
                .setDescription("Gamemode")
                .setRequired(true)
                .addChoices(
                    { name: "Sword", value: "Sword" },
                    { name: "Mace", value: "Mace" },
                    { name: "Axe", value: "Axe" },
                    { name: "Crystal", value: "Crystal" },
                    { name: "NethPot", value: "NethPot" },
                    { name: "DiaPot", value: "DiaPot" },
                    { name: "SMP", value: "SMP" },
                    { name: "UHC", value: "UHC" }
                )
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
        const gamemode = interaction.options.getString("gamemode");

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

        const gamemodeTiers = config.tiers?.[gamemode];

        if (!gamemodeTiers) {
            return interaction.editReply({
                content: `❌ Tier roles for **${gamemode}** are not configured.`
            });
        }

        const member = await interaction.guild.members.fetch(user.id);

        // Remove every tier role for this gamemode
        const tierRoles = Object.values(gamemodeTiers)
            .filter(roleId => roleId);

        for (const roleId of tierRoles) {
            if (member.roles.cache.has(roleId)) {
                await member.roles.remove(roleId);
            }
        }

        // Record removal without deleting history
        const { error } = await supabase
            .from("results")
            .insert({
                discord_id: user.id,
                ign: player.ign,
                gamemode,
                previous_tier: "Removed",
                new_tier: "Unranked",
                tester_id: interaction.user.id
            });

        if (error) {
            console.error("Tier Remove DB Error:", error);
        }

        await interaction.editReply({
            content:
                `✅ Removed **${gamemode}** tier from **${player.ign}**.\n` +
                `The player is now **Unranked** for this gamemode.`
        });
    }
};