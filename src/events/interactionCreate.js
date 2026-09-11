const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    MessageFlags,
    EmbedBuilder
} = require('discord.js');

const config = require('../config/config');
const supabase = require('../database/supabase');
const queueRenderer = require('../queue/queueRenderer');
const perms = require('../utils/permissions');

module.exports = {
    name: 'interactionCreate',

    async execute(interaction) {
        try {

            // =====================================================
            // SLASH COMMANDS
            // =====================================================

            if (interaction.isChatInputCommand()) {

                const command =
                    interaction.client.commands.get(
                        interaction.commandName
                    );

                if (!command) return;

                try {
                    await command.execute(interaction);
                } catch (error) {

                    console.error(
                        `COMMAND ERROR [${interaction.commandName}]:`,
                        error
                    );

                    if (interaction.replied || interaction.deferred) {
                        await interaction.editReply({
                            content:
                                '❌ An error occurred while executing this command.'
                        }).catch(() => {});
                    } else {
                        await interaction.reply({
                            content:
                                '❌ An error occurred while executing this command.',
                            flags: MessageFlags.Ephemeral
                        }).catch(() => {});
                    }
                }

                return;
            }

            // =====================================================
            // BUTTONS
            // =====================================================

            if (interaction.isButton()) {

                const customId = interaction.customId;

                // =================================================
                // TESTER LEADERBOARD RESET
                // =================================================

                if (customId === 'tester_leaderboard_reset') {

                    if (
                        interaction.user.id !==
                        config.ownerId
                    ) {
                        return await interaction.reply({
                            content:
                                '❌ Only the bot owner can reset the tester leaderboard.',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    try {

                        const { error } = await supabase
                            .from('results')
                            .delete()
                            .not('id', 'is', null);

                        if (error) {

                            console.error(
                                'TESTER LEADERBOARD RESET ERROR:',
                                error
                            );

                            return await interaction.reply({
                                content:
                                    '❌ Failed to reset the tester leaderboard.',
                                flags: MessageFlags.Ephemeral
                            });
                        }

                        return await interaction.reply({
                            content:
                                '✅ Tester leaderboard has been reset successfully.',
                            flags: MessageFlags.Ephemeral
                        });

                    } catch (error) {

                        console.error(
                            'LEADERBOARD RESET ERROR:',
                            error
                        );

                        return await interaction.reply({
                            content:
                                '❌ Something went wrong while resetting the leaderboard.',
                            flags: MessageFlags.Ephemeral
                        });
                    }
                }

                // =================================================
                // REGISTRATION BUTTON
                // =================================================

                if (customId === 'register_profile') {

                    const modal =
                        new ModalBuilder()
                            .setCustomId('registration_modal')
                            .setTitle('Profile Registration');

                    const ignInput =
                        new TextInputBuilder()
                            .setCustomId('ign')
                            .setLabel('Minecraft IGN')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true);

                    const regionInput =
                        new TextInputBuilder()
                            .setCustomId('region')
                            .setLabel('Region (e.g. EU, NA, AS)')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true);

                    const accInput =
                        new TextInputBuilder()
                            .setCustomId('acc_type')
                            .setLabel('Account Type (Premium/Cracked)')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true);

                    modal.addComponents(
                        new ActionRowBuilder().addComponents(ignInput),
                        new ActionRowBuilder().addComponents(regionInput),
                        new ActionRowBuilder().addComponents(accInput)
                    );

                    return await interaction.showModal(modal);
                }

                // =================================================
                // WAITLIST BUTTONS
                // =================================================

                if (customId.startsWith('waitlist_')) {

                    const gamemodeMap = {
                        waitlist_axe: 'Axe',
                        waitlist_sword: 'Sword',
                        waitlist_uhc: 'UHC',
                        waitlist_smp: 'SMP',
                        waitlist_diapot: 'DiaPot',
                        waitlist_mace: 'Mace',
                        waitlist_crystal: 'Crystal',
                        waitlist_nethpot: 'NethPot'
                    };

                    const gamemode = gamemodeMap[customId];

                    if (!gamemode) {
                        return await interaction.reply({
                            content: '❌ Invalid waitlist.',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (perms.isBlacklisted(interaction.member)) {
                        return await interaction.reply({
                            content:
                                '❌ You cannot join the testing waitlist.',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (!perms.isVerified(interaction.member)) {
                        return await interaction.reply({
                            content:
                                '❌ **Register your profile first.**\n\nClick **Register / Update Profile** before selecting a waitlist.',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const roleId =
                        config.roles.waitlist?.[gamemode];

                    if (!roleId) {
                        return await interaction.reply({
                            content:
                                `❌ Waitlist role for **${gamemode}** is not configured.`,
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const role =
                        interaction.guild.roles.cache.get(roleId);

                    if (!role) {
                        return await interaction.reply({
                            content:
                                '❌ The waitlist role could not be found.',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (
                        interaction.member.roles.cache.has(roleId)
                    ) {

                        try {

                            await interaction.member.roles.remove(
                                roleId,
                                `Left ${gamemode} waitlist`
                            );

                            return await interaction.reply({
                                content:
                                    `✅ You left the **${gamemode}** waitlist.`,
                                flags: MessageFlags.Ephemeral
                            });

                        } catch (error) {

                            console.error(
                                'WAITLIST ROLE REMOVE ERROR:',
                                error
                            );

                            return await interaction.reply({
                                content:
                                    '❌ Could not remove the waitlist role.',
                                flags: MessageFlags.Ephemeral
                            });
                        }
                    }

                    try {

                        await interaction.member.roles.add(
                            roleId,
                            `Joined ${gamemode} waitlist`
                        );

                        return await interaction.reply({
                            content:
                                `✅ You joined the **${gamemode}** waitlist!`,
                            flags: MessageFlags.Ephemeral
                        });

                    } catch (error) {

                        console.error(
                            'WAITLIST ROLE ADD ERROR:',
                            error
                        );

                        return await interaction.reply({
                            content:
                                '❌ I could not give you the waitlist role. Please contact staff.',
                            flags: MessageFlags.Ephemeral
                        });
                    }
                }

                // =================================================
                // QUEUE BUTTON PARSER
                // =================================================

                const parts = customId.split('_');

                const action = parts[0];

                const gamemode =
                    parts.slice(2).join('_');

                if (
                    action !== 'join' &&
                    action !== 'leave' &&
                    action !== 'refresh'
                ) {
                    return;
                }

                // =================================================
                // BLACKLIST
                // =================================================

                if (
                    perms.isBlacklisted(
                        interaction.member
                    )
                ) {
                    return await interaction.reply({
                        content:
                            '❌ You are blacklisted from joining KairoTiers testing queues.',
                        flags: MessageFlags.Ephemeral
                    });
                }

                // =================================================
                // VERIFIED
                // =================================================

                if (
                    !perms.isVerified(
                        interaction.member
                    )
                ) {
                    return await interaction.reply({
                        content:
                            '❌ **Register your profile first.**',
                        flags: MessageFlags.Ephemeral
                    });
                }

                // =================================================
                // REFRESH QUEUE
                // =================================================

                if (action === 'refresh') {

                    try {
                        await queueRenderer.updateQueuePanel(
                            interaction.client,
                            gamemode
                        );
                    } catch (error) {
                        console.error(
                            'QUEUE REFRESH ERROR:',
                            error
                        );
                    }

                    return await interaction.reply({
                        content:
                            '🔄 Queue refreshed.',
                        flags: MessageFlags.Ephemeral
                    });
                }

                // =================================================
                // JOIN QUEUE
                // =================================================

                if (action === 'join') {

                    // =============================================
                    // COOLDOWN CHECK
                    // =============================================

                    const {
                        data: cooldown,
                        error: cooldownError
                    } = await supabase
                        .from('testing_cooldowns')
                        .select('cooldown_until')
                        .eq(
                            'discord_id',
                            interaction.user.id
                        )
                        .eq(
                            'gamemode',
                            gamemode
                        )
                        .maybeSingle();

                    if (cooldownError) {

                        console.error(
                            'COOLDOWN CHECK ERROR:',
                            cooldownError
                        );

                        return await interaction.reply({
                            content:
                                '❌ Could not check your testing cooldown. Please contact staff.',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (cooldown) {

                        const cooldownUntil =
                            new Date(
                                cooldown.cooldown_until
                            );

                        if (
                            cooldownUntil >
                            new Date()
                        ) {

                            const unix =
                                Math.floor(
                                    cooldownUntil.getTime() / 1000
                                );

                            return await interaction.reply({
                                content:
                                    `⏳ **You are on ${gamemode} testing cooldown.**\n\n` +
                                    `You can test **${gamemode}** again <t:${unix}:R>.`,
                                flags: MessageFlags.Ephemeral
                            });
                        }

                        await supabase
                            .from('testing_cooldowns')
                            .delete()
                            .eq(
                                'discord_id',
                                interaction.user.id
                            )
                            .eq(
                                'gamemode',
                                gamemode
                            );
                    }

                    // =============================================
                    // ALREADY IN ANY QUEUE
                    // =============================================

                    const {
                        data: existingQueue,
                        error: queueCheckError
                    } = await supabase
                        .from('queue_members')
                        .select('*')
                        .eq(
                            'discord_id',
                            interaction.user.id
                        )
                        .maybeSingle();

                    if (queueCheckError) {

                        console.error(
                            'QUEUE CHECK ERROR:',
                            queueCheckError
                        );

                        return await interaction.reply({
                            content:
                                '❌ Could not check your queue status.',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (existingQueue) {

                        return await interaction.reply({
                            content:
                                '❌ You are already in a queue! Leave your current queue first.',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    // =============================================
                    // ACTIVE SESSION CHECK
                    // =============================================

                    const {
                        data: activeSessions,
                        error: sessionError
                    } = await supabase
                        .from('testing_sessions')
                        .select('*')
                        .eq(
                            'player_discord_id',
                            interaction.user.id
                        )
                        .eq(
                            'status',
                            'ACTIVE'
                        );

                    if (sessionError) {

                        console.error(
                            'SESSION CHECK ERROR:',
                            sessionError
                        );

                        return await interaction.reply({
                            content:
                                '❌ Could not check your testing session.',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    let realActiveSession = null;

                    if (
                        activeSessions &&
                        activeSessions.length > 0
                    ) {

                        for (
                            const session
                            of activeSessions
                        ) {

                            let ticketExists = false;

                            if (
                                session.ticket_channel_id
                            ) {

                                try {

                                    const channel =
                                        await interaction
                                            .guild
                                            .channels
                                            .fetch(
                                                session.ticket_channel_id
                                            );

                                    if (channel) {
                                        ticketExists = true;
                                    }

                                } catch (_) {
                                    ticketExists = false;
                                }
                            }

                            if (ticketExists) {
                                realActiveSession = session;
                                break;
                            }

                            await supabase
                                .from('testing_sessions')
                                .update({
                                    status: 'CLOSED',
                                    closed_at:
                                        new Date().toISOString()
                                })
                                .eq(
                                    'id',
                                    session.id
                                )
                                .eq(
                                    'status',
                                    'ACTIVE'
                                );
                        }
                    }

                    if (realActiveSession) {

                        return await interaction.reply({
                            content:
                                '❌ You already have an active testing session.',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    // =============================================
                    // INSERT INTO QUEUE
                    // =============================================

                    const {
                        data: insertedMember,
                        error: insertError
                    } = await supabase
                        .from('queue_members')
                        .insert({
                            gamemode,
                            discord_id:
                                interaction.user.id,
                            priority:
                                perms.hasPriority(
                                    interaction.member
                                )
                        })
                        .select()
                        .single();

                    if (insertError) {

                        console.error(
                            'QUEUE INSERT ERROR:',
                            insertError
                        );

                        if (
                            insertError.code === '23505'
                        ) {
                            return await interaction.reply({
                                content:
                                    '❌ You are already in a queue! Leave your current queue first.',
                                flags: MessageFlags.Ephemeral
                            });
                        }

                        return await interaction.reply({
                            content:
                                '❌ Failed to join the queue. Please try again.',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    // =============================================
                    // GET CURRENT POSITION
                    // =============================================

                    const {
                        data: currentMembers,
                        error: positionError
                    } = await supabase
                        .from('queue_members')
                        .select('*')
                        .eq(
                            'gamemode',
                            gamemode
                        )
                        .order('priority', {
                            ascending: false
                        })
                        .order('joined_at', {
                            ascending: true
                        });

                    if (positionError) {

                        console.error(
                            'QUEUE POSITION ERROR:',
                            positionError
                        );
                    }

                    let position = null;

                    if (
                        currentMembers &&
                        currentMembers.length > 0
                    ) {

                        const index =
                            currentMembers.findIndex(
                                member =>
                                    member.id ===
                                    insertedMember.id
                            );

                        if (index !== -1) {
                            position = index + 1;
                        }
                    }

                    // =============================================
                    // SUCCESS REPLY
                    // =============================================

                    await interaction.reply({
                        content:
                            `✅ You joined the **${gamemode}** queue.` +
                            (position
                                ? ` You are currently **#${position}**.`
                                : ''),
                        flags: MessageFlags.Ephemeral
                    });

                    // =============================================
                    // POSITION DM
                    // =============================================

                    if (
                        position === 1 ||
                        position === 2
                    ) {

                        try {

                            const dmEmbed =
                                new EmbedBuilder()
                                    .setColor(
                                        config.colors.primary
                                    )
                                    .setTitle(
                                        position === 1
                                            ? '🔔 You are #1'
                                            : '🔔 You are #2'
                                    )
                                    .setDescription(
                                        position === 1
                                            ? `You are currently **#1** in the **${gamemode}** queue.\n\nPlease be ready. Your testing ticket will be opened shortly.`
                                            : `You are currently **#2** in the **${gamemode}** queue.\n\nPlease be ready for your test.`
                                    )
                                    .setFooter({
                                        text:
                                            'KairoTiers • Testing Queue'
                                    });

                            await interaction.user.send({
                                embeds: [dmEmbed]
                            });

                        } catch (dmError) {

                            console.error(
                                `POSITION DM FAILED [${interaction.user.id}]:`,
                                dmError.message
                            );
                        }
                    }

                    // =============================================
                    // UPDATE QUEUE PANEL
                    // =============================================

                    try {

                        await queueRenderer.updateQueuePanel(
                            interaction.client,
                            gamemode
                        );

                    } catch (error) {

                        console.error(
                            'QUEUE PANEL UPDATE ERROR:',
                            error
                        );
                    }

                    return;
                }

                // =================================================
                // LEAVE QUEUE
                // =================================================

                if (action === 'leave') {

                    const {
                        data: leavingMember,
                        error: leavingError
                    } = await supabase
                        .from('queue_members')
                        .select('*')
                        .eq(
                            'discord_id',
                            interaction.user.id
                        )
                        .eq(
                            'gamemode',
                            gamemode
                        )
                        .maybeSingle();

                    if (leavingError) {

                        console.error(
                            'QUEUE LEAVE CHECK ERROR:',
                            leavingError
                        );

                        return await interaction.reply({
                            content:
                                '❌ Failed to check your queue status.',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    const {
                        error: deleteError
                    } = await supabase
                        .from('queue_members')
                        .delete()
                        .eq(
                            'discord_id',
                            interaction.user.id
                        )
                        .eq(
                            'gamemode',
                            gamemode
                        );

                    if (deleteError) {

                        console.error(
                            'QUEUE LEAVE ERROR:',
                            deleteError
                        );

                        return await interaction.reply({
                            content:
                                '❌ Failed to leave the queue.',
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    await interaction.reply({
                        content:
                            '✅ You left the queue.',
                        flags: MessageFlags.Ephemeral
                    });

                    // =============================================
                    // UPDATE POSITIONS AFTER LEAVE
                    // =============================================

                    try {

                        const {
                            data: remainingMembers,
                            error: remainingError
                        } = await supabase
                            .from('queue_members')
                            .select('*')
                            .eq(
                                'gamemode',
                                gamemode
                            )
                            .order('priority', {
                                ascending: false
                            })
                            .order('joined_at', {
                                ascending: true
                            });

                        if (remainingError) {
                            throw remainingError;
                        }

                        // =========================================
                        // DM NEW #1 / #2
                        // =========================================

                        for (
                            let i = 0;
                            i < Math.min(
                                remainingMembers.length,
                                2
                            );
                            i++
                        ) {

                            const member =
                                remainingMembers[i];

                            const newPosition =
                                i + 1;

                            // Get the player's Discord user
                            try {

                                const user =
                                    await interaction.client.users.fetch(
                                        member.discord_id
                                    );

                                const dmEmbed =
                                    new EmbedBuilder()
                                        .setColor(
                                            config.colors.primary
                                        )
                                        .setTitle(
                                            newPosition === 1
                                                ? '🔔 You are #1'
                                                : '🔔 You are #2'
                                        )
                                        .setDescription(
                                            newPosition === 1
                                                ? `You are now **#1** in the **${gamemode}** queue.\n\nPlease be ready. Your testing ticket will be opened shortly.`
                                                : `You are now **#2** in the **${gamemode}** queue.\n\nPlease be ready for your test.`
                                        )
                                        .setFooter({
                                            text:
                                                'KairoTiers • Testing Queue'
                                        });

                                await user.send({
                                    embeds: [dmEmbed]
                                });

                            } catch (dmError) {

                                console.error(
                                    `POSITION DM FAILED [${member.discord_id}]:`,
                                    dmError.message
                                );
                            }
                        }

                    } catch (error) {

                        console.error(
                            'POSITION UPDATE ERROR:',
                            error
                        );
                    }

                    // =============================================
                    // UPDATE QUEUE PANEL
                    // =============================================

                    try {

                        await queueRenderer.updateQueuePanel(
                            interaction.client,
                            gamemode
                        );

                    } catch (error) {

                        console.error(
                            'QUEUE PANEL UPDATE ERROR:',
                            error
                        );
                    }

                    return;
                }

                return;
            }

            // =====================================================
            // MODALS
            // =====================================================

            if (interaction.isModalSubmit()) {

                if (
                    interaction.customId ===
                    'registration_modal'
                ) {

                    const ign =
                        interaction.fields.getTextInputValue(
                            'ign'
                        );

                    const region =
                        interaction.fields.getTextInputValue(
                            'region'
                        );

                    const accType =
                        interaction.fields.getTextInputValue(
                            'acc_type'
                        );

                    const {
                        error: profileError
                    } = await supabase
                        .from('players')
                        .upsert(
                            {
                                discord_id:
                                    interaction.user.id,

                                ign,

                                region,

                                account_type:
                                    accType,

                                verified:
                                    true,

                                updated_at:
                                    new Date()
                            },
                            {
                                onConflict:
                                    'discord_id'
                            }
                        );

                    if (profileError) {

                        console.error(
                            'PROFILE SAVE ERROR:',
                            profileError
                        );

                        return await interaction.reply({
                            content:
                                '❌ Failed to save your profile.',
                            flags:
                                MessageFlags.Ephemeral
                        });
                    }

                    try {

                        await interaction.member.roles.add(
                            config.roles.verified
                        );

                    } catch (error) {

                        console.error(
                            'VERIFIED ROLE ERROR:',
                            error
                        );
                    }

                    return await interaction.reply({
                        content:
                            `✅ Profile updated for **${ign}**.\nYou can now join testing queues.`,
                        flags: MessageFlags.Ephemeral
                    });
                }

                return;
            }

        } catch (error) {

            console.error(
                'INTERACTION CREATE ERROR:',
                error
            );

            if (
                interaction.replied ||
                interaction.deferred
            ) {

                await interaction.editReply({
                    content:
                        '❌ Something went wrong. Please try again.'
                }).catch(() => {});

                return;
            }

            await interaction.reply({
                content:
                    '❌ Something went wrong. Please try again.',
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    }
};