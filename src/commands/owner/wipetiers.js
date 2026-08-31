const {
    SlashCommandBuilder
} = require("discord.js");

const config = require("../../config/config");
const supabase = require("../../database/supabase");
const fetch = require("node-fetch");

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

        // OWNER ONLY
        if (interaction.user.id !== process.env.OWNER_ID) {
            return interaction.reply({
                content: "❌ Only the bot owner can use this command.",
                flags: 64
            });
        }

        await interaction.deferReply({ flags: 64 });

        const user = interaction.options.getUser("user");

        // Get player
        const { data: player, error: playerError } = await supabase
            .from("players")
            .select("*")
            .eq("discord_id", user.id)
            .single();

        if (playerError || !player) {
            return interaction.editReply({
                content: "❌ Player profile not found."
            });
        }

        // Get Discord member
        const member = await interaction.guild.members.fetch(user.id);

        let removed = 0;

        // Remove tier roles from every gamemode
        for (const gamemode of Object.keys(config.tiers || {})) {

            const tierRoles = Object.values(config.tiers[gamemode])
                .filter(Boolean);

            for (const roleId of tierRoles) {

                if (member.roles.cache.has(roleId)) {
                    await member.roles.remove(roleId);
                    removed++;
                }
            }
        }

        // Sync EVERY gamemode with website
        const gamemodes = Object.keys(config.tiers || {});

        for (const gamemode of gamemodes) {

            try {

                if (!process.env.WEBSITE_API_URL) {
                    console.error("❌ WEBSITE_API_URL is missing from .env");
                    break;
                }

                if (!process.env.WEBSITE_BOT_SECRET) {
                    console.error("❌ WEBSITE_BOT_SECRET is missing from .env");
                    break;
                }

                const response = await fetch(
                    process.env.WEBSITE_API_URL,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-Bot-Secret": process.env.WEBSITE_BOT_SECRET
                        },
                        body: JSON.stringify({
                            ign: player.ign,
                            tier: "Unranked",
                            gamemode: gamemode.toLowerCase(),
                            userId: user.id,
                            guildId: interaction.guildId
                        })
                    }
                );

                if (!response.ok) {
                    console.error(
                        `❌ Website Sync Failed for ${gamemode}:`,
                        response.status,
                        await response.text()
                    );
                } else {
                    console.log(
                        `✅ Website synced: ${player.ign} → ${gamemode} → Unranked`
                    );
                }

            } catch (error) {
                console.error(
                    `❌ Website Sync Error (${gamemode}):`,
                    error
                );
            }
        }

        // Final response
        await interaction.editReply({
            content:
                `🧹 **Tier Wipe Complete**\n\n` +
                `Player: **${player.ign}**\n` +
                `Removed tier roles: **${removed}**\n` +
                `Gamemodes reset: **${gamemodes.length}**\n\n` +
                `All gamemodes are now **Unranked** on Discord and the website.`
        });
    }
};