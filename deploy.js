
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const TOKEN = process.env.TOKEN?.trim();
const CLIENT_ID = process.env.CLIENT_ID?.trim();
const GUILD_ID = process.env.GUILD_ID?.trim();

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
    console.error('<:Cross:1558553359642918952> Missing TOKEN, CLIENT_ID, or GUILD_ID in .env');
    process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');

if (!fs.existsSync(commandsPath)) {
    console.error(`<:Cross:1558553359642918952> Commands folder not found: ${commandsPath}`);
    process.exit(1);
}

for (const folder of fs.readdirSync(commandsPath)) {
    const folderPath = path.join(commandsPath, folder);

    if (!fs.statSync(folderPath).isDirectory()) continue;

    for (const file of fs.readdirSync(folderPath).filter(f => f.endsWith('.js'))) {
        const filePath = path.join(folderPath, file);

        try {
            const command = require(filePath);

            if (!command.data || typeof command.data.toJSON !== 'function') {
                console.error(`<:Cross:1558553359642918952> Invalid command file: ${filePath}`);
                continue;
            }

            if (typeof command.execute !== 'function') {
                console.error(`<:Cross:1558553359642918952> Missing execute(): ${filePath}`);
                continue;
            }

            commands.push(command.data.toJSON());
            console.log(`<:tick:1558554326887047228> Loaded command: ${command.data.name}`);
        } catch (error) {
            console.error(`<:Cross:1558553359642918952> Failed loading command: ${filePath}`);
            console.error(error);
        }
    }
}

console.log(`\n📦 Total commands ready to deploy: ${commands.length}`);
console.log(`🔑 Application ID: ${CLIENT_ID}`);
console.log(`🏠 Guild ID: ${GUILD_ID}\n`);

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('🚀 Deploying commands...');

        const data = await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );

        console.log(`<:tick:1558554326887047228> Successfully deployed ${data.length} commands.`);
    } catch (error) {
        console.error('<:Cross:1558553359642918952> Command deployment failed:');
        console.error(`API Error Code: ${error.code}`);
        console.error(`HTTP Status: ${error.status}`);
        console.error(error.message);

        if (error.code === 20012) {
            console.error(
                '\nCheck that TOKEN belongs to the Discord application whose ID is CLIENT_ID.'
            );
        }
    }
})();
