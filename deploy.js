const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];

const commandsPath = path.join(__dirname, 'src/commands');

const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {

    const folderPath = path.join(commandsPath, folder);

    // Sirf folders process karo
    if (!fs.statSync(folderPath).isDirectory()) {
        continue;
    }

    const commandFiles = fs
        .readdirSync(folderPath)
        .filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {

        const filePath = path.join(folderPath, file);

        try {

            const command = require(filePath);

            if (!command.data || typeof command.data.toJSON !== 'function') {

                console.error(
                    `❌ INVALID COMMAND FILE: ${filePath}`
                );

                console.error(
                    '   This file must export { data, execute }'
                );

                continue;
            }

            if (typeof command.execute !== 'function') {

                console.error(
                    `❌ MISSING execute(): ${filePath}`
                );

                continue;
            }

            commands.push(command.data.toJSON());

            console.log(`✅ Loaded command: ${command.data.name}`);

        } catch (error) {

            console.error(
                `❌ Failed loading command: ${filePath}`
            );

            console.error(error);
        }
    }
}

console.log(
    `\n📦 Total commands ready to deploy: ${commands.length}\n`
);

const rest = new REST({ version: '10' })
    .setToken(process.env.TOKEN);

(async () => {

    try {

        console.log('🚀 Deploying commands...');

        const data = await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
            ),
            {
                body: commands
            }
        );

        console.log(
            `✅ Successfully deployed ${data.length} commands.`
        );

    } catch (error) {

        console.error('❌ Command deployment failed:');
        console.error(error);

    }

})();