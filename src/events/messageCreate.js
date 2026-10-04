const { EmbedBuilder } = require('discord.js');
const supabase = require('../database/supabase');
const config = require('../config/config');

module.exports = {
    name: 'messageCreate',

    async execute(message) {
        try {
            // Ignore bots
            if (message.author.bot) return;

            const content = message.content.trim();

            // Must start with: info
            if (!content.toLowerCase().startsWith('info')) return;

            const args = content.split(/\s+/);

            // info @user
            if (args[0].toLowerCase() !== 'info') return;

            if (!message.mentions.users.size) {
                return message.reply({
                    content: '❌ Usage: `info @username`'
                });
            }

            const user = message.mentions.users.first();

            // ==========================================
            // GET PLAYER PROFILE
            // ==========================================

            const {
                data: player,
                error
            } = await supabase
                .from('players')
                .select('discord_id, ign, region, account_type')
                .eq('discord_id', user.id)
                .maybeSingle();

            if (error) {
                console.error('INFO COMMAND DB ERROR:', error);

                return message.reply({
                    content: '❌ Failed to fetch player information.'
                });
            }

            if (!player) {
                return message.reply({
                    content:
                        `❌ <@${user.id}> does not have a registered profile.`
                });
            }

            // ==========================================
            // EMBED
            // ==========================================

            const embed = new EmbedBuilder()
                .setColor(config.colors.primary)
                .setTitle('📋 Player Information')
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    {
                        name: 'IGN',
                        value: `\`${player.ign || 'Not set'}\``,
                        inline: false
                    },
                    {
                        name: 'Account Type',
                        value: `\`${player.account_type || 'Not set'}\``,
                        inline: false
                    },
                    {
                        name: 'Region',
                        value: `\`${player.region || 'Not set'}\``,
                        inline: false
                    }
                )
                .setFooter({
                    text: 'KairoTiers • Player Information'
                })
                .setTimestamp();

            return message.reply({
                embeds: [embed]
            });

        } catch (error) {
            console.error('INFO MESSAGE ERROR:', error);

            return message.reply({
                content: '❌ Something went wrong while fetching the profile.'
            }).catch(() => {});
        }
    }
};