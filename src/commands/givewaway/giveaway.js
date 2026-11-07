const {
    SlashCommandBuilder,
    ChannelType,
    MessageFlags
} = require('discord.js');

const supabase = require('../../database/supabase');
const giveawayManager = require('../../utils/giveawayManager');

// ==========================================
// DURATION PARSER
// ==========================================

function parseDuration(input) {
    const match = input.trim().match(/^(\d+)(s|m|h|d)$/i);

    if (!match) return null;

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000
    };

    const milliseconds = amount * multipliers[unit];

    if (
        !Number.isSafeInteger(milliseconds) ||
        milliseconds < 1000 ||
        milliseconds > 30 * 24 * 60 * 60 * 1000
    ) {
        return null;
    }

    return milliseconds;
}

// ==========================================
// GIVEAWAY COMMAND
// ==========================================

module.exports = {

    data: new SlashCommandBuilder()

        .setName('giveaway')
        .setDescription('Manage server giveaways')

        // Only server owner by default
        .setDefaultMemberPermissions(0n)

        // ==================================
        // CREATE SUBCOMMAND
        // ==================================

        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new giveaway')

                .addStringOption(option =>
                    option
                        .setName('name')
                        .setDescription('Giveaway name')
                        .setRequired(true)
                        .setMaxLength(100)
                )

                .addStringOption(option =>
                    option
                        .setName('timer')
                        .setDescription('Duration: 30m, 2h, 1d')
                        .setRequired(true)
                )

                .addStringOption(option =>
                    option
                        .setName('description')
                        .setDescription('Giveaway description')
                        .setRequired(true)
                        .setMaxLength(1000)
                )

                .addUserOption(option =>
                    option
                        .setName('winner')
                        .setDescription('Select the giveaway winner')
                        .setRequired(true)
                )

                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('Channel where giveaway will be posted')
                        .addChannelTypes(
                            ChannelType.GuildText,
                            ChannelType.GuildAnnouncement
                        )
                        .setRequired(true)
                )
        )

        // ==================================
        // END SUBCOMMAND
        // ==================================

        .addSubcommand(subcommand =>
            subcommand
                .setName('end')
                .setDescription('End an active giveaway')

                .addStringOption(option =>
                    option
                        .setName('name')
                        .setDescription('Name of the giveaway')
                        .setRequired(true)
                        .setMaxLength(100)
                )
        ),

    // ======================================
    // EXECUTE
    // ======================================

    async execute(interaction) {

        // SERVER OWNER CHECK
        if (
            !interaction.guild ||
            interaction.user.id !== interaction.guild.ownerId
        ) {
            return interaction.reply({
                content: '<:Cross:1558553359642918952> Only the server owner can use giveaway commands.',
                flags: MessageFlags.Ephemeral
            });
        }

        const subcommand = interaction.options.getSubcommand();

        // ==================================
        // CREATE GIVEAWAY
        // ==================================

        if (subcommand === 'create') {

            const name = interaction.options
                .getString('name')
                .trim();

            const timer = interaction.options.getString('timer');

            const description = interaction.options
                .getString('description')
                .trim();

            const winner = interaction.options.getUser('winner');

            const channel = interaction.options.getChannel('channel');

            // Validate duration
            const duration = parseDuration(timer);

            if (!duration) {
                return interaction.reply({
                    content:
                        '<:Cross:1558553359642918952> Invalid timer!\n\n' +
                        'Examples: `30m`, `1h`, `2h`, `1d`\n' +
                        'Maximum duration: 30 days.',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Winner validation
            if (winner.bot) {
                return interaction.reply({
                    content: '<:Cross:1558553359642918952> Bots cannot be selected as giveaway winners.',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (winner.id === interaction.client.user.id) {
                return interaction.reply({
                    content: '<:Cross:1558553359642918952> You cannot select the giveaway bot as winner.',
                    flags: MessageFlags.Ephemeral
                });
            }

            await interaction.deferReply({
                flags: MessageFlags.Ephemeral
            });

            const endsAt = new Date(
                Date.now() + duration
            ).toISOString();

            // SAVE GIVEAWAY
            const { data: giveaway, error } = await supabase
                .from('giveaways')
                .insert({
                    guild_id: interaction.guildId,
                    name,
                    description,
                    winner_id: winner.id,
                    channel_id: channel.id,
                    created_by: interaction.user.id,
                    ends_at: endsAt,
                    status: 'ACTIVE'
                })
                .select()
                .single();

            if (error) {

                console.error('GIVEAWAY CREATE ERROR:', error);

                if (error.code === '23505') {
                    return interaction.editReply(
                        '<:Cross:1558553359642918952> An active giveaway with this name already exists.'
                    );
                }

                return interaction.editReply(
                    '<:Cross:1558553359642918952> Failed to create giveaway. Check Supabase.'
                );
            }

            try {

                // SEND GIVEAWAY EMBED
                const message = await channel.send({
                    embeds: [
                        giveawayManager.createEmbed(giveaway, 0)
                    ],
                    components: [
                        giveawayManager.createButton(giveaway.id)
                    ]
                });

                // SAVE MESSAGE ID
                const { error: messageError } = await supabase
                    .from('giveaways')
                    .update({
                        message_id: message.id
                    })
                    .eq('id', giveaway.id);

                if (messageError) {
                    throw messageError;
                }

                // START TIMER
                giveawayManager.scheduleGiveaway(
                    interaction.client,
                    giveaway
                );

                return interaction.editReply(
                    `<:tick:1558554326887047228> Giveaway **${name}** successfully created!\n` +
                    `📢 Channel: ${channel}\n` +
                    `⏰ Duration: ${timer}`
                );

            } catch (error) {

                console.error('GIVEAWAY MESSAGE ERROR:', error);

                await supabase
                    .from('giveaways')
                    .delete()
                    .eq('id', giveaway.id);

                return interaction.editReply(
                    '<:Cross:1558553359642918952> Could not send giveaway message. Check bot permissions.'
                );
            }
        }

        // ==================================
        // END GIVEAWAY
        // ==================================

        if (subcommand === 'end') {

            const name = interaction.options
                .getString('name')
                .trim();

            await interaction.deferReply({
                flags: MessageFlags.Ephemeral
            });

            const { data: giveaway, error } = await supabase
                .from('giveaways')
                .select('id, name')
                .eq('guild_id', interaction.guildId)
                .ilike('name', name)
                .eq('status', 'ACTIVE')
                .maybeSingle();

            if (error) {

                console.error('GIVEAWAY FIND ERROR:', error);

                return interaction.editReply(
                    '<:Cross:1558553359642918952> Database error while finding giveaway.'
                );
            }

            if (!giveaway) {
                return interaction.editReply(
                    `<:Cross:1558553359642918952> No active giveaway found with the name **${name}**.`
                );
            }

            try {

                const ended = await giveawayManager.endGiveaway(
                    interaction.client,
                    giveaway.id
                );

                if (!ended) {
                    return interaction.editReply(
                        '<:Cross:1558553359642918952> This giveaway has already ended.'
                    );
                }

                return interaction.editReply(
                    `<:tick:1558554326887047228> Giveaway **${giveaway.name}** has been ended successfully!`
                );

            } catch (error) {

                console.error('GIVEAWAY END ERROR:', error);

                return interaction.editReply(
                    '<:Cross:1558553359642918952> Failed to end giveaway. Check console logs.'
                );
            }
        }
    }
};