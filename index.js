const { Client, GatewayIntentBits, Partials, EmbedBuilder, REST, Routes, PermissionsBitField, SlashCommandBuilder } = require('discord.js');
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

// Set up an Express server
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is running!');
});

app.listen(port, () => {
    console.log(`HTTP server running on port ${port}`);
});

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
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
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

    if (commandName === 'add_user') {
        const user = options.getUser('user');
        const targetChannel = await client.channels.fetch(channelId);

        let thread = await targetChannel.threads.create({
            name: `DM with ${user.tag}`,
            autoArchiveDuration: 60,
            reason: `DM with ${user.tag}`,
        });

        userThreads.set(user.id, thread);
        await interaction.reply({ content: `Thread created with ${user.tag}.`, ephemeral: true });
    }

    if (commandName === 'add_role') {
        const member = options.getUser('user');
        const role = options.getRole('role');

        const guildMember = await interaction.guild.members.fetch(member.id);
        await guildMember.roles.add(role);
        await interaction.reply({ content: `${role.name} added to ${member.tag}`, ephemeral: true });
    }

    if (commandName === 'remove_role') {
        const member = options.getUser('user');
        const role = options.getRole('role');

        const guildMember = await interaction.guild.members.fetch(member.id);
        await guildMember.roles.remove(role);
        await interaction.reply({ content: `${role.name} removed from ${member.tag}`, ephemeral: true });
    }

    if (commandName === 'mute') {
        const member = options.getUser('user');
        const time = options.getString('time') || '1h'; // Default mute time if not specified

        // Mute implementation here (requires managing mute role and logic)
        await interaction.reply({ content: `${member.tag} has been muted for ${time}`, ephemeral: true });
    }

    if (commandName === 'unmute') {
        const member = options.getUser('user');

        // Unmute implementation here (requires managing mute role and logic)
        await interaction.reply({ content: `${member.tag} has been unmuted`, ephemeral: true });
    }

    if (commandName === 'warn') {
        const member = options.getUser('user');
        const reason = options.getString('reason') || 'No reason provided';

        // Warn implementation here (e.g., log to a database or channel)
        await interaction.reply({ content: `${member.tag} has been warned. Reason: ${reason}`, ephemeral: true });
    }

    if (commandName === 'clear') {
        const amount = options.getInteger('amount');

        // Clear messages implementation here
        await interaction.reply({ content: `Cleared ${amount} messages.`, ephemeral: true });
    }

    if (commandName === 'tempban') {
        const member = options.getUser('user');
        const time = options.getString('time');

        // Tempban implementation here
        await interaction.reply({ content: `${member.tag} has been temporarily banned for ${time}`, ephemeral: true });
    }

    if (commandName === 'softban') {
        const member = options.getUser('user');
        const reason = options.getString('reason') || 'No reason provided';

        // Softban implementation here
        await interaction.reply({ content: `${member.tag} has been softbanned. Reason: ${reason}`, ephemeral: true });
    }

    if (commandName === 'serverinfo') {
        // Display server information
        const serverInfo = `Server name: ${interaction.guild.name}\nTotal members: ${interaction.guild.memberCount}`;
        await interaction.reply({ content: serverInfo, ephemeral: true });
    }

    if (commandName === 'userinfo') {
        const user = options.getUser('user');
        const member = await interaction.guild.members.fetch(user.id);

        const userInfo = `Username: ${user.tag}\nJoined at: ${member.joinedAt}`;
        await interaction.reply({ content: userInfo, ephemeral: true });
    }

    if (commandName === 'lock') {
        const channel = interaction.channel;
        await channel.permissionOverwrites.edit(interaction.guild.id, { SEND_MESSAGES: false });
        await interaction.reply({ content: `Channel ${channel.name} has been locked.`, ephemeral: true });
    }

    if (commandName === 'unlock') {
        const channel = interaction.channel;
        await channel.permissionOverwrites.edit(interaction.guild.id, { SEND_MESSAGES: true });
        await interaction.reply({ content: `Channel ${channel.name} has been unlocked.`, ephemeral: true });
    }

    if (commandName === 'nick') {
        const member = options.getUser('user');
        const newNickname = options.getString('new_nickname');

        const guildMember = await interaction.guild.members.fetch(member.id);
        await guildMember.setNickname(newNickname);
        await interaction.reply({ content: `Nickname for ${member.tag} has been changed to ${newNickname}`, ephemeral: true });
    }

    if (commandName === 'resetnick') {
        const member = options.getUser('user');

        const guildMember = await interaction.guild.members.fetch(member.id);
        await guildMember.setNickname(null);
        await interaction.reply({ content: `Nickname for ${member.tag} has been reset.`, ephemeral: true });
    }
});

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
