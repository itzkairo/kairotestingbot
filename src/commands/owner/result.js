
const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const emojis = require('../../utils/emojis');
const supabase = require('../../database/supabase');
const perms = require('../../utils/perms');
const fetch = require('node-fetch');

const COOLDOWN_DAYS = 7;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rp')
    .setDescription('Submit a player testing result.')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The player who was tested.')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('tier')
        .setDescription('The tier achieved by the player.')
        .setRequired(true)
        .addChoices(
          { name: 'HT3', value: 'HT3' },
          { name: 'LT3', value: 'LT3' },
          { name: 'HT4', value: 'HT4' },
          { name: 'LT4', value: 'LT4' },
          { name: 'HT5', value: 'HT5' },
          { name: 'LT5', value: 'LT5' }
        )
    )
    .addStringOption(option =>
      option
        .setName('gamemode')
        .setDescription('The gamemode tested.')
        .setRequired(true)
        .addChoices(
          { name: 'Sword', value: 'Sword' },
          { name: 'Mace', value: 'Mace' },
          { name: 'Axe', value: 'Axe' },
          { name: 'Crystal', value: 'Crystal' },
          { name: 'NethPot', value: 'NethPot' },
          { name: 'DiaPot', value: 'DiaPot' },
          { name: 'SMP', value: 'SMP' },
          { name: 'UHC', value: 'UHC' }
        )
    ),

  async execute(interaction) {
    // Acknowledge the interaction as early as possible.
    try {
      await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error('[RP] Failed to defer interaction:', error);
      return;
    }

    try {
      // Tester permission check.
      if (!perms.isTester(interaction.member)) {
        return await interaction.editReply({
          content: `${emojis.cross} You do not have permission to submit results.`,
        });
      }

      const player = interaction.options.getUser('user');
      const tier = interaction.options.getString('tier');
      const gamemode = interaction.options.getString('gamemode');
      const gamemodeKey = gamemode.toLowerCase();

      // Find the player's registered profile.
      const { data: playerData, error: playerError } = await supabase
        .from('players')
        .select('*')
        .eq('discord_id', player.id)
        .maybeSingle();

      if (playerError) {
        console.error('[RP] Player lookup failed:', playerError);

        return await interaction.editReply({
          content: `${emojis.cross} Failed to look up the player's profile.`,
        });
      }

      if (!playerData) {
        return await interaction.editReply({
          content: `${emojis.cross} This player does not have a registered profile.`,
        });
      }

      const playerIgn = playerData.ign;

      // Get the previous tier for this gamemode.
      const { data: previousResults, error: previousError } = await supabase
        .from('results')
        .select('new_tier')
        .eq('discord_id', player.id)
        .eq('gamemode', gamemode)
        .order('created_at', { ascending: false })
        .limit(1);

      if (previousError) {
        console.error('[RP] Previous-tier lookup failed:', previousError);

        return await interaction.editReply({
          content: `${emojis.cross} Failed to retrieve the player's previous tier.`,
        });
      }

      const previousTier =
        previousResults?.length > 0
          ? previousResults[0].new_tier
          : 'Unranked';

      // Find the configured Discord role for the new tier.
      const tierRoleId = config.tiers?.[gamemode]?.[tier];

      if (!tierRoleId) {
        console.error(
          `[RP] Missing tier role configuration: gamemode=${gamemode}, tier=${tier}`
        );

        return await interaction.editReply({
          content: `${emojis.cross} The Discord role for **${gamemode} ${tier}** is not configured.`,
        });
      }

      // Fetch the player as a guild member.
      const member = await interaction.guild.members
        .fetch(player.id)
        .catch(() => null);

      if (!member) {
        return await interaction.editReply({
          content: `${emojis.cross} Could not find this player in the server.`,
        });
      }

      // Remove the player's existing tier role for this gamemode.
      const configuredGamemodeTiers = config.tiers?.[gamemode] ?? {};

      const oldTierRoleIds = Object.values(configuredGamemodeTiers)
        .filter(roleId => typeof roleId === 'string' && roleId.length > 0);

      const rolesToRemove = oldTierRoleIds.filter(roleId =>
        member.roles.cache.has(roleId)
      );

      if (rolesToRemove.length > 0) {
        await member.roles.remove(rolesToRemove).catch(error => {
          console.error('[RP] Failed to remove old tier roles:', error);
          throw error;
        });
      }

      // Add the new tier role.
      await member.roles.add(tierRoleId);

      // Save the result to Supabase.
      const { error: resultError } = await supabase
        .from('results')
        .insert({
          discord_id: player.id,
          ign: playerIgn,
          gamemode,
          previous_tier: previousTier,
          new_tier: tier,
          tester_id: interaction.user.id,
        });

      if (resultError) {
        console.error('[RP] Result insert failed:', resultError);

        return await interaction.editReply({
          content: `${emojis.cross} The Discord role was updated, but saving the result failed. Check the console.`,
        });
      }

      // Save/update the testing cooldown.
      const cooldownUntil = new Date(
        Date.now() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000
      );

      const { error: cooldownError } = await supabase
        .from('testing_cooldowns')
        .upsert(
          {
            discord_id: player.id,
            gamemode: 'HighTest',
            cooldown_until: cooldownUntil.toISOString(),
          },
          {
            onConflict: 'discord_id,gamemode',
          }
        );

      if (cooldownError) {
        console.error('[RP] Cooldown upsert failed:', cooldownError);
      }

      // Sync the result to the KairoTiers website.
      const websiteUrl = process.env.WEBSITE_API_URL;
      const websiteSecret = process.env.WEBSITE_BOT_SECRET;

      if (websiteUrl && websiteSecret) {
        try {
          const response = await fetch(websiteUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Bot-Secret': websiteSecret,
            },
            body: JSON.stringify({
              discordId: player.id,
              ign: playerIgn,
              tier,
              gamemode: gamemodeKey,
            }),
          });

          const responseText = await response.text();

          if (!response.ok) {
            console.error(
              '[RP] Website sync failed:',
              response.status,
              responseText
            );
          } else {
            console.log(
              `[RP] Website sync successful for ${playerIgn} (${gamemode} ${tier}).`
            );
          }
        } catch (websiteError) {
          // The Discord result has already been saved.
          console.error('[RP] Website sync error:', websiteError);
        }
      } else {
        console.error(
          '[RP] Website sync skipped: WEBSITE_API_URL or WEBSITE_BOT_SECRET is missing.'
        );
      }

      // Post the result in the configured results channel.
      const resultsChannelId = config.channels?.results;

      if (resultsChannelId) {
        const resultsChannel = await interaction.client.channels
          .fetch(resultsChannelId)
          .catch(error => {
            console.error('[RP] Could not fetch results channel:', error);
            return null;
          });

        if (resultsChannel?.isTextBased()) {
          const gamemodeEmoji =
            emojis.gamemodes?.[gamemode] ?? '';

          const resultEmbed = new EmbedBuilder()
            .setColor('#8B0000')
            .setTitle('Testing Result')
            .setDescription(
              [
                `**Player:** ${playerIgn}`,
                `**Discord:** ${player}`,
                `**Gamemode:** ${gamemodeEmoji} ${gamemode}`,
                `**Previous Tier:** ${previousTier}`,
                `**New Tier:** ${tier}`,
                `**Tester:** ${interaction.user}`,
              ].join('\n')
            )
            .setTimestamp();

          await resultsChannel.send({
            embeds: [resultEmbed],
          }).catch(error => {
            console.error('[RP] Failed to post result embed:', error);
          });
        }
      }

      // Confirm success to the tester.
      const unixCooldown = Math.floor(
        cooldownUntil.getTime() / 1000
      );

      return await interaction.editReply({
        content:
          `${emojis.tick} Result submitted for **${playerIgn}** in **${gamemode}**.\n\n` +
          `Previous Tier: **${previousTier}**\n` +
          `New Tier: **${tier}**\n\n` +
          `⏳ **${gamemode}** cooldown: <t:${unixCooldown}:R>`,
      });
    } catch (error) {
      console.error('[RP] COMMAND ERROR:', error);

      if (interaction.deferred || interaction.replied) {
        return await interaction.editReply({
          content: `${emojis.cross} An error occurred while submitting the result. Check the console.`,
        }).catch(() => {});
      }
    }
  },
};
