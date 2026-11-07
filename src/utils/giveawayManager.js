const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');

const supabase = require('../database/supabase');

const timers = new Map();

const MAX_TIMEOUT = 2147483647;

// ==========================================
// GIVEAWAY EMBED
// ==========================================

function createEmbed(giveaway, count, ended = false) {
    const embed = new EmbedBuilder()
        .setColor(ended ? 0xED4245 : 0x8B0000)
        .setTitle(`🎉 ${giveaway.name}`)
        .setDescription(
            ended
                ? `${giveaway.description}\n\n**Giveaway has ended!**`
                : giveaway.description
        )
        .addFields(
            {
                name: '📌 Status',
                value: ended ? '**Ended**' : '**Active**',
                inline: true
            },
            {
                name: '👥 Participants',
                value: String(count),
                inline: true
            },
            {
                name: ended ? '<:1471678791821688842:1546946782565769267> Winner' : '⏰ Ends',
                value: ended
                    ? (giveaway.winner_id
                        ? `<@${giveaway.winner_id}>`
                        : 'Unknown')
                    : `<t:${Math.floor(
                        new Date(giveaway.ends_at).getTime() / 1000
                    )}:R>`,
                inline: true
            }
        )
        .setFooter({
            text: 'AsianTiers • Giveaway'
        })
        .setTimestamp();

    return embed;
}

// ==========================================
// JOIN BUTTON
// ==========================================

function createButton(id, disabled = false) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`giveaway_join_${id}`)
            .setLabel('Join Giveaway')
            .setEmoji('🎉')
            .setStyle(ButtonStyle.Success)
            .setDisabled(disabled)
    );
}

// ==========================================
// PARTICIPANT COUNT
// ==========================================

async function getCount(id) {
    const { count, error } = await supabase
        .from('giveaway_entries')
        .select('*', {
            count: 'exact',
            head: true
        })
        .eq('giveaway_id', id);

    if (error) throw error;

    return count || 0;
}

// ==========================================
// END GIVEAWAY
// ==========================================

async function endGiveaway(client, id) {
    const { data: giveaway, error } = await supabase
        .from('giveaways')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error) throw error;

    if (!giveaway || giveaway.status !== 'ACTIVE') {
        return false;
    }

    // Mark as ended (atomic: only one caller can transition ACTIVE -> ENDED)
    const { data: updated, error: updateError } = await supabase
        .from('giveaways')
        .update({
            status: 'ENDED',
            winner_id: giveaway.winner_id
        })
        .eq('id', id)
        .eq('status', 'ACTIVE')
        .select('id')
        .maybeSingle();

    if (updateError) throw updateError;

    if (!updated) return false;

    // Clear timer
    if (timers.has(id)) {
        clearTimeout(timers.get(id));
        timers.delete(id);
    }

    const count = await getCount(id);

    const channel = await client.channels
        .fetch(giveaway.channel_id)
        .catch(() => null);

    if (!channel) {
        console.error('Giveaway channel not found:', giveaway.channel_id);
        return true;
    }

    // Update original giveaway message
    const message = await channel.messages
        .fetch(giveaway.message_id)
        .catch(() => null);

    if (message) {
        await message.edit({
            embeds: [
                createEmbed(giveaway, count, true)
            ],
            components: [
                createButton(id, true)
            ]
        }).catch(console.error);
    }

    // Announce winner (only reached by the caller that won the atomic status update)
    await channel.send({
        content:
            `🎉 Congratulations <@${giveaway.winner_id}>! ` +
            `You have won the giveaway: **${giveaway.name}**!`,
        allowedMentions: {
            users: [giveaway.winner_id]
        }
    });

    return true;
}

// ==========================================
// AUTOMATIC TIMER
// ==========================================

function scheduleGiveaway(client, giveaway) {
    const id = giveaway.id;

    if (timers.has(id)) {
        clearTimeout(timers.get(id));
    }

    async function checkTimer() {
        const remaining =
            new Date(giveaway.ends_at).getTime() - Date.now();

        if (remaining <= 0) {
            timers.delete(id);

            await endGiveaway(client, id).catch(error => {
                console.error('Automatic giveaway end error:', error);
            });

            return;
        }

        const timeout = setTimeout(
            checkTimer,
            Math.min(remaining, MAX_TIMEOUT)
        );

        timers.set(id, timeout);
    }

    checkTimer().catch(console.error);
}

// ==========================================
// RESTORE ACTIVE GIVEAWAYS ON RESTART
// ==========================================

async function resumeActiveGiveaways(client) {
    const { data, error } = await supabase
        .from('giveaways')
        .select('*')
        .eq('status', 'ACTIVE');

    if (error) {
        console.error('Giveaway resume error:', error);
        return;
    }

    for (const giveaway of data || []) {
        scheduleGiveaway(client, giveaway);
    }

    console.log(
        `Resumed ${data?.length || 0} active giveaways.`
    );
}

// ==========================================
// JOIN GIVEAWAY BUTTON HANDLER
// ==========================================

async function handleJoinButton(interaction) {
    const id = interaction.customId.replace(
        'giveaway_join_',
        ''
    );

    await interaction.deferReply({
        flags: MessageFlags.Ephemeral
    });

    // Check giveaway
    const { data: giveaway, error } = await supabase
        .from('giveaways')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error || !giveaway) {
        return interaction.editReply(
            '<:Cross:1558553359642918952> Giveaway not found.'
        );
    }

    if (giveaway.status !== 'ACTIVE') {
        return interaction.editReply(
            '<:Cross:1558553359642918952> This giveaway has already ended.'
        );
    }

    if (new Date(giveaway.ends_at).getTime() <= Date.now()) {
        await endGiveaway(interaction.client, id);

        return interaction.editReply(
            '<:Cross:1558553359642918952> This giveaway has already ended.'
        );
    }

    // Join database
    const { error: joinError } = await supabase
        .from('giveaway_entries')
        .insert({
            giveaway_id: id,
            user_id: interaction.user.id
        });

    if (joinError?.code === '23505') {
        return interaction.editReply(
            '⚠️ You have already joined this giveaway!'
        );
    }

    if (joinError) {
        console.error('Giveaway join error:', joinError);

        return interaction.editReply(
            '<:Cross:1558553359642918952> Could not join the giveaway. Please try again.'
        );
    }

    // Update participant count
    const count = await getCount(id);

    await interaction.message.edit({
        embeds: [
            createEmbed(giveaway, count)
        ],
        components: [
            createButton(id)
        ]
    });

    return interaction.editReply(
        '🎉 You successfully joined the giveaway!'
    );
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    createEmbed,
    createButton,
    scheduleGiveaway,
    resumeActiveGiveaways,
    endGiveaway,
    handleJoinButton
};