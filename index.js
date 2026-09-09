const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const express = require('express');

dotenv.config();

// =========================
// Express Web Server
// =========================

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.status(200).send('KairoTiers Bot is online!');
});

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'online',
        bot: client?.isReady() ? 'connected' : 'connecting',
        uptime: process.uptime()
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web server running on port ${PORT}`);
});

// =========================
// Discord Client
// =========================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel]
});

client.commands = new Collection();

// =========================
// Load Commands
// =========================

const commandsPath = path.join(__dirname, 'src/commands');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);

    const commandFiles = fs
        .readdirSync(folderPath)
        .filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(folderPath, file);
        const command = require(filePath);

        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        }
    }
}

// =========================
// Load Events
// =========================

const eventsPath = path.join(__dirname, 'src/events');
const eventFiles = fs
    .readdirSync(eventsPath)
    .filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);

    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// =========================
// Login
// =========================

client.login(process.env.TOKEN);