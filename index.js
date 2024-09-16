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
const muteRole = 'MutedRoleID'; // Replace this with your actual Muted role ID from Discord

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

// Command handler functions

async function handleAddUser(interaction) {
    const user = interaction.options.getUser('user');
    const targetChannel = await client.channels.fetch(channelId);

    let thread = await targetChannel.threads.create({
        name: `DM with ${user.tag}`,
        autoArchiveDuration: 60,
        reason: `DM with ${user.tag}`,
    });

    userThreads.set(user.id, thread);
    await interaction.reply({ content: `Thread created with ${user.tag}.`, ephemeral: true });
}

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

async function handleRemoveRole(interaction) {
    const member = interaction.options.getUser('user');
    const role = interaction.options.getRole('role');

    try {
        const guildMember = await interaction.guild.members.fetch(member.id);
        await guildMember.roles.remove(role);
        await interaction.reply({ content: `${role.name} removed from ${guildMember.user.tag}.`, ephemeral: true });
    } catch (error) {
        throw new Error(`Failed to remove role: ${error.message}`);
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

async function handleUnmute(interaction) {
    const member = await interaction.guild.members.fetch(interaction.options.getUser('user').id);

    if (member.roles.cache.has(muteRole)) {
        await member.roles.remove(muteRole);
        await interaction.reply({ content: `${member.user.tag} has been unmuted.`, ephemeral: true });
    } else {
        await interaction.reply({ content: `${member.user.tag} is not muted.`, ephemeral: true });
    }
}

async function handleWarn(interaction) {
    const member = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    // Log warning to a moderator channel or database
    await interaction.reply({ content: `${member.tag} has been warned. Reason: ${reason}`, ephemeral: true });
}

async function handleClear(interaction) {
    const amount = interaction.options.getInteger('amount');

    if (!interaction.channel || !interaction.channel.isTextBased()) {
        return interaction.reply({ content: 'This command can only be used in text channels.', ephemeral: true });
    }

    await interaction.channel.bulkDelete(amount, true);
    await interaction.reply({ content: `Cleared ${amount} messages.`, ephemeral: true });
}

async function handleServerInfo(interaction) {
    const guild = interaction.guild;
    const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('Server Information')
        .addFields(
            { name: 'Server Name', value: guild.name, inline: true },
            { name: 'Total Members', value: `${guild.memberCount}`, inline: true },
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleUserInfo(interaction) {
    const user = interaction.options.getUser('user');
    const member = await interaction.guild.members.fetch(user.id);
    const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('User Information')
        .addFields(
            { name: 'Username', value: user.tag, inline: true },
            { name: 'Joined Server', value: member.joinedAt.toDateString(), inline: true },
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleLock(interaction) {
    const channel = interaction.channel;
    await channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: false });
    await interaction.reply({ content: `Channel ${channel.name} has been locked.`, ephemeral: true });
}

async function handleUnlock(interaction) {
    const channel = interaction.channel;
    await channel.permissionOverwrites.edit(interaction.guild.id, { SendMessages: true });
    await interaction.reply({ content: `Channel ${channel.name} has been unlocked.`, ephemeral: true });
}

async function handleNick(interaction) {
    const member = await interaction.guild.members.fetch(interaction.options.getUser('user').id);
    const newNickname = interaction.options.getString('new_nickname');

    await member.setNickname(newNickname);
    await interaction.reply({ content: `Nickname for ${member.user.tag} has been changed to ${newNickname}`, ephemeral: true });
}

async function handleResetNick(interaction) {
    const member = await interaction.guild.members.fetch(interaction.options.getUser('user').id);

    await member.setNickname(null);
    await interaction.reply({ content: `Nickname for ${member.user.tag} has been reset.`, ephemeral: true });
}

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
