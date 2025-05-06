const { Client, GatewayIntentBits } = require('discord.js');
const Handler = require('./handlers/Handler');
const config = require('./config.json');
const TicketManager = require('./modules/TicketManager');
const WelcomeManager = require('./modules/WelcomeManager');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping
    ],
    partials: ['CHANNEL', 'MESSAGE', 'REACTION']
});

client.config = config;

client.handler = new Handler(client);
client.ticketManager = new TicketManager(client);
client.welcomeManager = new WelcomeManager(client);

async function initialize() {
    try {
        await client.login(config.token);

        await new Promise(resolve => {
            if (client.isReady()) resolve();
            else client.once('ready', resolve);
        });

        client.handler.logger.log('NORMAL', 'Synchronizacja cache kanałów...');
        const guilds = await client.guilds.fetch();
        for (const [guildId] of guilds) {
            const guild = await client.guilds.fetch(guildId);
            await guild.channels.fetch();
            client.handler.logger.log('DEBUG', `Zsynchronizowano kanały dla serwera: ${guild.name}`);
        }
        
        await client.handler.loadCommands();
        await client.handler.loadEvents();
        await client.handler.loadComponents();
        await client.handler.loadButtons();

        client.handler.logger.log('NORMAL', 'Bot został pomyślnie zainicjalizowany!');
    } catch (error) {
        client.handler.logger.log('NORMAL', `Initialization error: ${error.message}`);
        process.exit(1);
    }
}

initialize();

process.on('unhandledRejection', error => {
    client.handler.logger.log('NORMAL', `Unhandled rejection: ${error.message}`);
});

process.on('uncaughtException', error => {
    client.handler.logger.log('NORMAL', `Uncaught exception: ${error.message}`);
}); 