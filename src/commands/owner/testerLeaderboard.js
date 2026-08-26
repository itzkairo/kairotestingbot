const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');

const supabase = require('../../database/supabase');

module.exports = {

    data: new SlashCommandBuilder()
        .setName('testerleaderboard')
        .setDescription('Show the testers with the most completed tests'),

    async execute(interaction) {

        await interaction.deferReply();

        try {

            // =============================================
            // GET ALL RESULTS
            // =============================================

            const {
                data: results,
                error
            } = await supabase
                .from('results')
                .select('tester_id');

            if (error) {

                console.error(
                    'TESTER LEADERBOARD ERROR:',
                    error
                );

                return interaction.editReply({
                    content:
                        '❌ Failed to load the tester leaderboard.'
                });
            }

            // =============================================
            // NO RESULTS
            // =============================================

            if (!results || results.length === 0) {

                const embed = new EmbedBuilder()
                    .setTitle('🏆 Tester Leaderboard')
                    .setColor(0x8B0000)
                    .setDescription(
                        'No tests have been completed yet.'
                    )
                    .setFooter({
                        text:
                            'KairoTiers • Tester Statistics'
                    })
                    .setTimestamp();

                const row =
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(
                                    'tester_leaderboard_reset'
                                )
                                .setLabel(
                                    'Reset Leaderboard'
                                )
                                .setEmoji('🗑️')
                                .setStyle(
                                    ButtonStyle.Danger
                                )
                        );

                return interaction.editReply({
                    embeds: [embed],
                    components: [row]
                });
            }

            // =============================================
            // COUNT TESTS PER TESTER
            // =============================================

            const testerCounts = {};

            for (const result of results) {

                if (!result.tester_id) continue;

                testerCounts[result.tester_id] =
                    (testerCounts[result.tester_id] || 0) + 1;
            }

            // =============================================
            // SORT LEADERBOARD
            // =============================================

            const leaderboard =
                Object.entries(testerCounts)
                    .sort((a, b) => b[1] - a[1]);

            // =============================================
            // BUILD DESCRIPTION
            // =============================================

            let description = '';

            for (
                let i = 0;
                i < leaderboard.length;
                i++
            ) {

                const [
                    testerId,
                    count
                ] = leaderboard[i];

                const position = i + 1;

                let medal;

                if (position === 1) {
                    medal = '🥇';
                } else if (position === 2) {
                    medal = '🥈';
                } else if (position === 3) {
                    medal = '🥉';
                } else {
                    medal = `**${position}.**`;
                }

                description +=
                    `${medal} <@${testerId}> — **${count} ${count === 1 ? 'test' : 'tests'}**\n`;
            }

            // =============================================
            // EMBED
            // =============================================

            const embed =
                new EmbedBuilder()
                    .setTitle('🏆 Tester Leaderboard')
                    .setColor(0x8B0000)
                    .setDescription(
                        description
                    )
                    .addFields({
                        name: '📊 Total Tests',
                        value:
                            `**${results.length}** tests completed`,
                        inline: false
                    })
                    .setFooter({
                        text:
                            'KairoTiers • Tester Statistics'
                    })
                    .setTimestamp();

            // =============================================
            // RESET BUTTON
            // =============================================

            const row =
                new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(
                                'tester_leaderboard_reset'
                            )
                            .setLabel(
                                'Reset Leaderboard'
                            )
                            .setEmoji('🗑️')
                            .setStyle(
                                ButtonStyle.Danger
                            )
                    );

            // =============================================
            // SEND
            // =============================================

            await interaction.editReply({
                embeds: [embed],
                components: [row]
            });

        } catch (error) {

            console.error(
                'TESTER LEADERBOARD COMMAND ERROR:',
                error
            );

            await interaction.editReply({
                content:
                    '❌ Something went wrong while loading the leaderboard.'
            }).catch(() => {});
        }
    }
};