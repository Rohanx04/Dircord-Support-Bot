// Include necessary modules
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
    new SlashCommandBuilder().setName('nick').setDescription('Change a user's nickname')
        .addUserOption(option => option.setName('user').setDescription('The user to change nickname').setRequired(true))
        .addStringOption(option => option.setName('new_nickname').setDescription('New nickname').setRequired(true)),
    new SlashCommandBuilder().setName('resetnick').setDescription('Reset a user's nickname')
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
        console.error('Error registering commands:', error);
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
        console.error('Error handling command:', error);
        await interaction.reply({ content: 'There was an error executing the command.', ephemeral: true });
    }
});

// Handler functions
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
    const member = await interaction.guild.members.fetch(interaction.options.getUser('user').id);
    const role = interaction.options.getRole('role');

    await member.roles.add(role);
    await interaction.reply({ content: `${role.name} added to ${member.user.tag}`, ephemeral: true });
}

async function handleRemoveRole(interaction) {
    const member = await interaction.guild.members.fetch(interaction.options.getUser('user').id);
    const role = interaction.options.getRole('role');

    await member.roles.remove(role);
    await interaction.reply({ content: `${role.name} removed from ${member.user.tag}`, ephemeral: true });
}

async function handleMute(interaction) {
    const member = await interaction.guild.members.fetch(interaction.options.getUser('user').id);
    const duration = interaction.options.getString('time') || '1h'; // Default to 1 hour

    if (!member.roles.cache.has(muteRole)) {
        await member.roles.add(muteRole);
        await interaction.reply({ content: `${member.user.tag} has been muted for ${duration}`, ephemeral: true });

        const msDuration = convertDurationToMs(duration);

        setTimeout(async () => {
            if (member.roles.cache.has(muteRole)) {
                await member.roles.remove(muteRole);
            }
        }, msDuration);
    } else {
        await interaction.reply({ content: `${member.user.tag} is already muted.`, ephemeral: true });
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
    const member = await interaction.guild.members.fetch(interaction.options.getUser('user').id);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    // You can log the warning to a database or a specific channel
    await interaction.reply({ content: `${member.user.tag} has been warned. Reason: ${reason}`, ephemeral: true });
}

async function handleClear(interaction) {
    const amount = interaction.options.getInteger('amount');

    if (!interaction.channel || !interaction.channel.isTextBased()) {
        return interaction.reply({ content: 'This command can only be used in text channels.', ephemeral: true });
    }

    await interaction.channel.bulkDelete(amount, true);
    await interaction.reply({ content: `Cleared ${amount} messages.`, ephemeral: true });
}

async function handleTempban(interaction) {
    const member = interaction.options.getUser('user');
    const duration = interaction.options.getString('time');

    await interaction.guild.members.ban(member, { reason: 'Temporary ban' });
    await interaction.reply({ content: `${member.tag} has been temporarily banned for ${duration}.`, ephemeral: true });

    const msDuration = convertDurationToMs(duration);

    setTimeout(async () => {
        await interaction.guild.members.unban(member.id);
    }, msDuration);
}

async function handleSoftban(interaction) {
    const member = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    // Softban: Ban and immediately unban to delete messages
    await interaction.guild.members.ban(member, { days: 7, reason });
    await interaction.guild.members.unban(member.id);

    await interaction.reply({ content: `${member.tag} has been softbanned. Reason: ${reason}`, ephemeral: true });
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

// Utility function to convert duration string to milliseconds
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

// Handle messages
client.on('messageCreate', async message => {
    // Ignore messages from bots
    if (message.author.bot) return;

    // If message is in a thread in the target channel
    if (message.channel.isThread() && message.channel.parentId === channelId) {
        // Get the user associated with this thread
        const userId = [...userThreads.entries()].find(([, thread]) => thread.id === message.channel.id)?.[0];

        if (!userId) return;

        try {
            const user = await client.users.fetch(userId);
            await user.send(`**Support Team:** ${message.content}`);
        } catch (error) {
            console.error('Error sending message to user:', error);
            message.channel.send(`Couldn't deliver the message to the user.`);
        }
    }
    // If message is a DM from a user
    else if (!message.guild) {
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
            await thread.send(`**${message.author.tag}:** ${message.content}`);
            await message.react('✅'); // React to confirm receipt
        } catch (error) {
            console.error('Error sending message to thread:', error);
        }
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
        } else if (oldThread.archived && !newThread.archived) {
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
