const { Client, GatewayIntentBits, Partials, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');

// Initialize Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Channel, Partials.Message],
});

// Add token and channel ID from the environment
const token = process.env.DISCORD_BOT_TOKEN;
const channelId = process.env.DISCORD_CHANNEL_ID;
const muteRole = 'MutedRoleID'; // Replace with your actual Muted role ID

// Express server to keep bot alive
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(port, () => console.log(`HTTP server running on port ${port}`));

// User thread management
const userThreads = new Map();

// Utility function to convert duration strings to milliseconds
function convertDurationToMs(duration) {
    const timeValue = parseInt(duration.slice(0, -1));
    const timeUnit = duration.slice(-1);

    switch (timeUnit) {
        case 's':
            return timeValue * 1000;
        case 'm':
            return timeValue * 60 * 1000;
        case 'h':
            return timeValue * 60 * 60 * 1000;
        case 'd':
            return timeValue * 24 * 60 * 60 * 1000;
        default:
            return 0;
    }
}

// Enhanced logging to track issues
function logError(context, error) {
    console.error(`[ERROR] ${context}:`, error);
}

// Slash commands definition
const commands = [
    new SlashCommandBuilder().setName('add_user').setDescription('Create a new thread with the mentioned user')
        .addUserOption(option => option.setName('user').setDescription('The user to add').setRequired(true)),
    new SlashCommandBuilder().setName('add_role').setDescription('Add a role to a user')
        .addUserOption(option => option.setName('user').setDescription('The user to give the role').setRequired(true))
        .addRoleOption(option => option.setName('role').setDescription('The role to assign').setRequired(true)),
    new SlashCommandBuilder().setName('remove_role').setDescription('Remove a role from a user')
        .addUserOption(option => option.setName('user').setDescription('The user to remove the role from').setRequired(true))
        .addRoleOption(option => option.setName('role').setDescription('The role to remove').setRequired(true)),
    new SlashCommandBuilder().setName('mute').setDescription('Mute a user')
        .addUserOption(option => option.setName('user').setDescription('The user to mute').setRequired(true))
        .addStringOption(option => option.setName('time').setDescription('Duration to mute the user (e.g., 10m, 1h)').setRequired(false)),
    new SlashCommandBuilder().setName('unmute').setDescription('Unmute a user')
        .addUserOption(option => option.setName('user').setDescription('The user to unmute').setRequired(true)),
    new SlashCommandBuilder().setName('warn').setDescription('Warn a user')
        .addUserOption(option => option.setName('user').setDescription('The user to warn').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for warning').setRequired(false)),
    new SlashCommandBuilder().setName('clear').setDescription('Clear messages')
        .addIntegerOption(option => option.setName('amount').setDescription('Number of messages to clear').setRequired(true)),
    new SlashCommandBuilder().setName('tempban').setDescription('Temporarily ban a user')
        .addUserOption(option => option.setName('user').setDescription('The user to tempban').setRequired(true))
        .addStringOption(option => option.setName('time').setDescription('Duration of the tempban (e.g., 10m, 1h)').setRequired(true)),
    new SlashCommandBuilder().setName('softban').setDescription('Softban a user')
        .addUserOption(option => option.setName('user').setDescription('The user to softban').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for softbanning').setRequired(false)),
    new SlashCommandBuilder().setName('serverinfo').setDescription('Displays server information'),
    new SlashCommandBuilder().setName('userinfo').setDescription('Displays information about a user')
        .addUserOption(option => option.setName('user').setDescription('The user to show info about').setRequired(true)),
    new SlashCommandBuilder().setName('lock').setDescription('Lock a channel'),
    new SlashCommandBuilder().setName('unlock').setDescription('Unlock a channel'),
    new SlashCommandBuilder().setName('nick').setDescription('Change a user\'s nickname')
        .addUserOption(option => option.setName('user').setDescription('The user to change nickname').setRequired(true))
        .addStringOption(option => option.setName('new_nickname').setDescription('New nickname').setRequired(true)),
    new SlashCommandBuilder().setName('resetnick').setDescription('Reset a user\'s nickname')
        .addUserOption(option => option.setName('user').setDescription('The user to reset nickname').setRequired(true)),
];

// Register the slash commands with Discord
const rest = new REST({ version: '10' }).setToken(token);
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands.map(command => command.toJSON()) },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        logError('Registering Slash Commands', error);
    }
});

// Slash command handling
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    try {
        switch (commandName) {
            case 'add_user':
                await handleAddUser(interaction);
                break;
            case 'add_role':
                await handleAddRole(interaction);
                break;
            case 'remove_role':
                await handleRemoveRole(interaction);
                break;
            case 'mute':
                await handleMute(interaction);
                break;
            case 'unmute':
                await handleUnmute(interaction);
                break;
            case 'warn':
                await handleWarn(interaction);
                break;
            case 'clear':
                await handleClear(interaction);
                break;
            case 'tempban':
                await handleTempban(interaction);
                break;
            case 'softban':
                await handleSoftban(interaction);
                break;
            case 'serverinfo':
                await handleServerInfo(interaction);
                break;
            case 'userinfo':
                await handleUserInfo(interaction);
                break;
            case 'lock':
                await handleLock(interaction);
                break;
            case 'unlock':
                await handleUnlock(interaction);
                break;
            case 'nick':
                await handleNick(interaction);
                break;
            case 'resetnick':
                await handleResetNick(interaction);
                break;
            default:
                await interaction.reply({ content: 'Unknown command!', ephemeral: true });
        }
    } catch (error) {
        logError(`Executing command: ${commandName}`, error);
        await interaction.reply({ content: `There was an error executing the command: ${error.message}`, ephemeral: true });
    }
});

// Slash command handler functions
async function handleAddRole(interaction) {
    const member = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');

    if (!member || !role) {
        throw new Error('Invalid user or role provided.');
    }

    try {
        const guildMember = await interaction.guild.members.fetch(member.id);
        await guildMember.roles.add(role);
        await interaction.reply({ content: `Role ${role.name} has been added to ${guildMember.user.tag}`, ephemeral: true });
    } catch (error) {
        throw new Error(`Failed to add role: ${error.message}`);
    }
}

async function handleMute(interaction) {
    const member = interaction.options.getUser('user');
    const duration = interaction.options.getString('time') || '1h'; // Default to 1 hour

    if (!member) {
        throw new Error('Invalid user provided.');
    }

    try {
        const guildMember = await interaction.guild.members.fetch(member.id);

        if (guildMember.roles.cache.has(muteRole)) {
            await interaction.reply({ content: `${guildMember.user.tag} is already muted.`, ephemeral: true });
            return;
        }

        await guildMember.roles.add(muteRole);
        await interaction.reply({ content: `${guildMember.user.tag} has been muted for ${duration}.`, ephemeral: true });

        const msDuration = convertDurationToMs(duration);

        setTimeout(async () => {
            if (guildMember.roles.cache.has(muteRole)) {
                await guildMember.roles.remove(muteRole);
            }
        }, msDuration);
    } catch (error) {
        throw new Error(`Failed to mute user: ${error.message}`);
    }
}

// Additional command handler functions (similar structure as above)

// Handle messages (for DM to thread and vice versa)
client.on('messageCreate', async message => {
    if (message.author.bot) return; // Ignore messages from bots

    if (message.channel.isThread() && message.channel.parentId === channelId) {
        // If message is in a thread
        const userId = [...userThreads.entries()].find(([, thread]) => thread.id === message.channel.id)?.[0];
        if (!userId) return;

        try {
            const user = await client.users.fetch(userId);
            await user.send(`**Support Team:** ${message.content}`);
        } catch (error) {
            logError('Sending message from thread to user', error);
            await message.channel.send('Could not deliver the message to the user.');
        }
    } else if (!message.guild) {
        // If message is a DM from a user
        const targetChannel = await client.channels.fetch(channelId);
        if (!targetChannel.isTextBased()) return;

        let thread = userThreads.get(message.author.id);
        if (!thread) {
            const existingThreads = await targetChannel.threads.fetchActive();
            thread = existingThreads.threads.find(t => t.name === `DM with ${message.author.tag}`);

            if (!thread) {
                thread = await targetChannel.threads.create({
                    name: `DM with ${message.author.tag}`,
                    autoArchiveDuration: 60,
                    reason: `Created for DM with ${message.author.tag}`,
                });
                userThreads.set(message.author.id, thread);
            }
        }

        try {
            await thread.send(`**${message.author.tag}:** ${message.content}`);
            await message.react('✅'); // React to confirm receipt
        } catch (error) {
            logError('Sending DM to thread', error);
        }
    }
});

// Handle thread updates (archive/unarchive notifications)
client.on('threadUpdate', async (oldThread, newThread) => {
    const userId = [...userThreads.entries()].find(([, thread]) => thread.id === newThread.id)?.[0];
    if (!userId) return;

    try {
        const user = await client.users.fetch(userId);

        if (!oldThread.archived && newThread.archived) {
            const embed = new EmbedBuilder()
                .setColor(0xff0000) // Red color
                .setTitle('Support Team')
                .setDescription('The support team has closed this thread.')
                .setTimestamp();
            await user.send({ embeds: [embed] });
        } else if (oldThread.archived && !newThread.archived) {
            const embed = new EmbedBuilder()
                .setColor(0x00ff00) // Green color
                .setTitle('Support Team')
                .setDescription('The support team has reopened this thread.')
                .setTimestamp();
            await user.send({ embeds: [embed] });
        }
    } catch (error) {
        logError('Thread update notification', error);
    }
});

// Catch unhandled promise rejections globally
process.on('unhandledRejection', (error) => {
    logError('Unhandled promise rejection', error);
});

// Catch uncaught exceptions globally
process.on('uncaughtException', (error) => {
    logError('Uncaught exception', error);
});

// Login with token
client.login(token).catch(error => {
    logError('Bot login failed', error);
});
