const { Client, GatewayIntentBits, Partials, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const express = require('express');

// Initialize Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
});

// Add token and channel ID from the environment
const token = process.env.DISCORD_BOT_TOKEN;
const channelId = process.env.DISCORD_CHANNEL_ID;
const muteRole = 'MutedRoleID'; // The role ID for muted members

// Set up an Express server
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(port, () => console.log(`HTTP server running on port ${port}`));

// User thread management
const userThreads = new Map();

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
        .addStringOption(option => option.setName('time').setDescription('Duration to mute the user').setRequired(false)),
    new SlashCommandBuilder().setName('unmute').setDescription('Unmute a user')
        .addUserOption(option => option.setName('user').setDescription('The user to unmute').setRequired(true)),
    new SlashCommandBuilder().setName('warn').setDescription('Warn a user')
        .addUserOption(option => option.setName('user').setDescription('The user to warn').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for warning').setRequired(false)),
    new SlashCommandBuilder().setName('clear').setDescription('Clear messages')
        .addIntegerOption(option => option.setName('amount').setDescription('Number of messages to clear').setRequired(true)),
    new SlashCommandBuilder().setName('tempban').setDescription('Temporarily ban a user')
        .addUserOption(option => option.setName('user').setDescription('The user to tempban').setRequired(true))
        .addStringOption(option => option.setName('time').setDescription('Duration of the tempban').setRequired(true)),
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
(async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands.map(command => command.toJSON()) },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
})();

// Handle bot login
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
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
        }
    } catch (error) {
        console.error('Error handling command:', error);
        await interaction.reply({ content: 'There was an error executing the command.', ephemeral: true });
    }
});

// Additional handlers for mute, unmute, etc.
async function handleMute(interaction) {
    const member = await interaction.guild.members.fetch(interaction.options.getUser('user').id);
    const duration = interaction.options.getString('time'); // e.g., "10m", "1h"

    if (!member.roles.cache.has(muteRole)) {
        await member.roles.add(muteRole);
        interaction.reply({ content: `${member.displayName} has been muted for ${duration}`, ephemeral: true });

        // Convert duration to milliseconds and set a timeout to unmute
        setTimeout(async () => {
            await member.roles.remove(muteRole);
            // Inform in a moderator's log or similar channel
        }, convertDurationToMs(duration)); // You'll need to implement convertDurationToMs
    } else {
        interaction.reply({ content: `${member.displayName} is already muted.`, ephemeral: true });
    }
}

async function handleUnmute(interaction) {
    const member = await interaction.guild.members.fetch(interaction.options.getUser('user').id);

    if (member.roles.cache.has(muteRole)) {
        await member.roles.remove(muteRole);
        interaction.reply({ content: `${member.displayName} has been unmuted.`, ephemeral: true });
    } else {
        interaction.reply({ content: `${member.displayName} is not muted.`, ephemeral: true });
    }
}

// Add implementations for other handlers like handleAddUser, handleAddRole, etc.

// Handle DMs and threads
client.on('messageCreate', async message => {
    if (message.guild || message.author.bot) return; // Ignore messages from servers and bots

    const targetChannel = await client.channels.fetch(channelId);
    if (!targetChannel.isTextBased()) return;

    const userId = message.author.id;
    let thread = userThreads.get(userId);

    if (!thread) {
        const existingThreads = await targetChannel.threads.fetchActive();
        thread = existingThreads.threads.find(t => t.name === `DM with ${message.author.tag}`);

        if (!thread) {
            thread = await targetChannel.threads.create({
                name: `DM with ${message.author.tag}`,
                autoArchiveDuration: 60,
                reason: `Created for DM with ${message.author.tag}`,
            });
            userThreads.set(userId, thread);
        } else {
            userThreads.set(userId, thread);
        }
    }

    try {
        await thread.send(message.content);
        await message.react('✅'); // React with a checkmark to confirm receipt
    } catch (error) {
        console.error('Error sending message to thread:', error);
    }
});

// Listen for thread updates to notify users when a thread is archived or unarchived
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
        } else if (oldThread.archived and !newThread.archived) {
            const embed = new EmbedBuilder()
                .setColor(0x00ff00) // Green color
                .setTitle('Support Team')
                .setDescription('The support team has reopened this thread.')
                .setTimestamp();

            await user.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error('Error notifying user about thread update:', error);
    }
});

// Login with token
client.login(token).catch(error => {
    console.error('Failed to login:', error);
});
