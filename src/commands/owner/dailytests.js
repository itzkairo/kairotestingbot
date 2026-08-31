const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const supabase = require("../../database/supabase");
const config = require("../../config/config");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("dailytests")
        .setDescription("View today's testing statistics"),

    async execute(interaction) {

        await interaction.deferReply({ flags: 64 });

        // Start of today
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        // Get today's results
        const { data: results, error } = await supabase
            .from("results")
            .select("tester_id, gamemode")
            .gte("created_at", startOfDay.toISOString());

        if (error) {
            console.error("Daily Tests Error:", error);

            return interaction.editReply({
                content: "❌ Failed to load today's testing statistics."
            });
        }

        if (!results || results.length === 0) {
            return interaction.editReply({
                content: "📊 No tests have been completed today."
            });
        }

        // Tester statistics
        const testers = {};

        for (const result of results) {

            if (!testers[result.tester_id]) {
                testers[result.tester_id] = {
                    total: 0,
                    gamemodes: {}
                };
            }

            testers[result.tester_id].total++;

            testers[result.tester_id].gamemodes[result.gamemode] =
                (testers[result.tester_id].gamemodes[result.gamemode] || 0) + 1;
        }

        // Sort testers by total tests
        const leaderboard = Object.entries(testers)
            .sort((a, b) => b[1].total - a[1].total);

        const leaderboardText = leaderboard
            .map(([testerId, stats], index) => {
                return `**${index + 1}.** <@${testerId}> — **${stats.total} tests**`;
            })
            .join("\n");

        // Gamemode statistics
        const gamemodeStats = {};

        for (const result of results) {
            gamemodeStats[result.gamemode] =
                (gamemodeStats[result.gamemode] || 0) + 1;
        }

        const gamemodeText = Object.entries(gamemodeStats)
            .sort((a, b) => b[1] - a[1])
            .map(([gamemode, count]) =>
                `**${gamemode}** — ${count}`
            )
            .join("\n");

        const embed = new EmbedBuilder()
            .setColor(config.colors.primary)
            .setTitle("📊 Daily Testing Statistics")
            .setDescription(
                `Statistics for **${interaction.guild.name}**`
            )
            .addFields(
                {
                    name: "🧪 Total Tests",
                    value: `**${results.length}**`,
                    inline: true
                },
                {
                    name: "👥 Active Testers",
                    value: `**${leaderboard.length}**`,
                    inline: true
                },
                {
                    name: "🏆 Tester Leaderboard",
                    value: leaderboardText || "No testers.",
                    inline: false
                },
                {
                    name: "🎮 Gamemode Breakdown",
                    value: gamemodeText || "No data.",
                    inline: false
                }
            )
            .setFooter({
                text: "KairoTiers • Daily Tests"
            })
            .setTimestamp();

        await interaction.editReply({
            embeds: [embed]
        });
    }
};