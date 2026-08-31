const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const supabase = require("../../database/supabase");
const config = require("../../config/config");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("testerstats")
        .setDescription("View a tester's complete testing statistics")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The tester")
                .setRequired(true)
        ),

    async execute(interaction) {

        const user = interaction.options.getUser("user");

        await interaction.deferReply({ flags: 64 });

        // Get all results submitted by this tester
        const { data: results, error } = await supabase
            .from("results")
            .select("discord_id, ign, gamemode, new_tier, tester_id, created_at")
            .eq("tester_id", user.id)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Tester Stats Error:", error);

            return interaction.editReply({
                content: "❌ Failed to load tester statistics."
            });
        }

        if (!results || results.length === 0) {
            return interaction.editReply({
                content: `📊 **${user.username}** has not completed any tests yet.`
            });
        }

        // -------------------------
        // Total Tests
        // -------------------------

        const totalTests = results.length;

        // -------------------------
        // Gamemode Statistics
        // -------------------------

        const gamemodeStats = {};

        for (const result of results) {

            if (!gamemodeStats[result.gamemode]) {
                gamemodeStats[result.gamemode] = 0;
            }

            gamemodeStats[result.gamemode]++;
        }

        const gamemodeText = Object.entries(gamemodeStats)
            .sort((a, b) => b[1] - a[1])
            .map(([gamemode, count]) =>
                `**${gamemode}** — ${count} tests`
            )
            .join("\n");

        // -------------------------
        // Tier Statistics
        // -------------------------

        const tierStats = {};

        for (const result of results) {

            if (!tierStats[result.new_tier]) {
                tierStats[result.new_tier] = 0;
            }

            tierStats[result.new_tier]++;
        }

        const tierOrder = [
            "HT1",
            "LT1",
            "HT2",
            "LT2",
            "HT3",
            "LT3",
            "HT4",
            "LT4",
            "HT5",
            "LT5",
            "Unranked"
        ];

        const tierText = tierOrder
            .filter(tier => tierStats[tier])
            .map(tier =>
                `**${tier}** — ${tierStats[tier]}`
            )
            .join("\n");

        // -------------------------
        // Gamemode + Tier Breakdown
        // -------------------------

        const detailedStats = {};

        for (const result of results) {

            if (!detailedStats[result.gamemode]) {
                detailedStats[result.gamemode] = {};
            }

            if (!detailedStats[result.gamemode][result.new_tier]) {
                detailedStats[result.gamemode][result.new_tier] = 0;
            }

            detailedStats[result.gamemode][result.new_tier]++;
        }

        const detailedText = Object.entries(detailedStats)
            .map(([gamemode, tiers]) => {

                const tiersText = tierOrder
                    .filter(tier => tiers[tier])
                    .map(tier => `${tier}: **${tiers[tier]}**`)
                    .join(" • ");

                return `**${gamemode}**\n${tiersText}`;

            })
            .join("\n\n");

        // -------------------------
        // Embed
        // -------------------------

        const embed = new EmbedBuilder()
            .setColor(config.colors.primary)
            .setTitle("🧪 Tester Statistics")
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .setDescription(
                `Statistics for <@${user.id}>`
            )
            .addFields(
                {
                    name: "🧪 Total Tests",
                    value: `**${totalTests}**`,
                    inline: true
                },
                {
                    name: "🎮 Gamemodes",
                    value: `**${Object.keys(gamemodeStats).length}**`,
                    inline: true
                },
                {
                    name: "🏆 Tiers Given",
                    value: `**${Object.keys(tierStats).length}** different tiers`,
                    inline: true
                },
                {
                    name: "🎮 Tests By Gamemode",
                    value: gamemodeText || "No data.",
                    inline: false
                },
                {
                    name: "🏆 Tiers Given",
                    value: tierText || "No data.",
                    inline: false
                },
                {
                    name: "📋 Detailed Breakdown",
                    value: detailedText || "No data.",
                    inline: false
                }
            )
            .setFooter({
                text: "KairoTiers • Tester Statistics"
            })
            .setTimestamp();

        await interaction.editReply({
            embeds: [embed]
        });
    }
};