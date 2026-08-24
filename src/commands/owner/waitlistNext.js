const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType
} = require("discord.js");

const config = require("../../config/config");
const supabase = require("../../database/supabase");
const queueRenderer = require("../../queue/queueRenderer");
const perms = require("../../utils/permissions");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("waitlistnext")
        .setDescription("Picks the next player from the queue and creates a ticket"),

    async execute(interaction) {

        if (!perms.isTester(interaction.member)) {
            return interaction.reply({
                content: "Only testers can use this command.",
                flags: 64
            });
        }

        // Acknowledge interaction immediately
        await interaction.deferReply({ flags: 64 });

        const gamemode = config.channels.queues[interaction.channelId];

        if (!gamemode) {
            return interaction.editReply({
                content: "Use this command in a queue channel."
            });
        }

        // Get next player
        const { data: member, error } = await supabase
            .from("queue_members")
            .select("*")
            .eq("gamemode", gamemode)
            .order("priority", { ascending: false })
            .order("joined_at", { ascending: true })
            .limit(1)
            .single();

        if (error || !member) {
            return interaction.editReply({
                content: "Queue is empty."
            });
        }

        // Get player profile
        const { data: player, error: playerError } = await supabase
            .from("players")
            .select("*")
            .eq("discord_id", member.discord_id)
            .single();

        if (playerError || !player) {
            return interaction.editReply({
                content: "Player profile could not be found."
            });
        }

        // Create ticket
        const guild = interaction.guild;

        const ticketChannel = await guild.channels.create({
            name: `test-${player.ign}`,
            type: ChannelType.GuildText,
            parent: config.channels.ticketCategory,

            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel]
                },
                {
                    id: member.discord_id,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages
                    ]
                },
                {
                    id: config.roles.tester,
                    allow: [
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages
                    ]
                }
            ]
        });

        // Save testing session
        await supabase
            .from("testing_sessions")
            .insert({
                player_discord_id: member.discord_id,
                tester_id: interaction.user.id,
                gamemode: gamemode,
                ticket_channel_id: ticketChannel.id
            });

        // Remove player from queue
        await supabase
            .from("queue_members")
            .delete()
            .eq("id", member.id);

        // Update queue panel
        await queueRenderer.updateQueuePanel(
            interaction.client,
            gamemode
        );

        // Get previous result
        const { data: lastResult } = await supabase
            .from("results")
            .select("new_tier")
            .eq("discord_id", member.discord_id)
            .eq("gamemode", gamemode)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        const infoEmbed = {
            title: `Testing Session: ${player.ign}`,
            color: config.colors.primary,

            fields: [
                {
                    name: "Discord",
                    value: `<@${member.discord_id}>`,
                    inline: true
                },
                {
                    name: "IGN",
                    value: player.ign,
                    inline: true
                },
                {
                    name: "Region",
                    value: player.region,
                    inline: true
                },
                {
                    name: "Account",
                    value: player.account_type,
                    inline: true
                },
                {
                    name: "Gamemode",
                    value: gamemode,
                    inline: true
                },
                {
                    name: "Current Tier",
                    value: lastResult?.new_tier || "Unranked",
                    inline: true
                }
            ],

            footer: {
                text: `Tester: ${interaction.user.tag}`
            }
        };

        // Send ticket panel
        await ticketChannel.send({
            content: `<@${member.discord_id}>, your test is ready!`,
            embeds: [infoEmbed]
        });

        // Finish deferred interaction
        await interaction.editReply({
            content: `✅ Ticket created: ${ticketChannel}`
        });
    }
};