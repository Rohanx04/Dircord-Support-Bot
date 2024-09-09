const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const express = require('express');
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
});

// Add token in the environment
const token = process.env.DISCORD_BOT_TOKEN;
const channelId = process.env.DISCORD_CHANNEL_ID;

// Set up an Express server
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is running!');
});

// Bot run checks
app.listen(port, () => {
    console.log(`HTTP server running on port ${port}`);
});

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// Store user thread references
const userThreads = new Map();

client.on('messageCreate', async (message) => {
    if (message.guild) return; // Ignore messages from guilds (servers)
    if (message.author.bot) return; // Ignore messages from other bots

    // Fetch the target channel
    const targetChannel = await client.channels.fetch(channelId);
    if (!targetChannel.isTextBased()) {
        console.error('The target channel was not found or is not a text-based channel!');
        return;
    }

    const userId = message.author.id;
    let thread = userThreads.get(userId);

    // Check if a thread with the user's name already exists
    if (!thread) {
        const existingThreads = await targetChannel.threads.fetchActive();
        thread = existingThreads.threads.find(t => t.name === `DM from ${message.author.tag}`);

        if (!thread) {
            // Fetch archived threads and check if the user's thread is archived
            const archivedThreads = await targetChannel.threads.fetchArchived();
            thread = archivedThreads.threads.find(t => t.name === `DM from ${message.author.tag}`);

            if (thread) {
                // Unarchive the thread
                await thread.setArchived(false);
                userThreads.set(userId, thread);
                await message.author.send('Your support thread has been reopened.');
            } else {
                // Create a new thread if no existing thread is found
                const threadName = `DM from ${message.author.tag}`;
                try {
                    thread = await targetChannel.threads.create({
                        name: threadName,
                        autoArchiveDuration: 60, // Auto-archive after 1 hour of inactivity
                        reason: `Created for DM from ${message.author.tag}`,
                    });
                    userThreads.set(userId, thread);
                } catch (error) {
                    console.error('Error creating thread:', error);
                    return;
                }
            }
        } else {
            userThreads.set(userId, thread);
        }
    }

    // Send the user's message directly to the thread
    try {
        await thread.send(message.content);
        await message.react('✅'); // React to the user's message with a checkmark emoji
    } catch (error) {
        console.error('Error sending message to thread:', error);
    }
});

// Listen for thread updates to detect when a thread is archived or unarchived
client.on('threadUpdate', async (oldThread, newThread) => {
    const userId = [...userThreads.entries()].find(([, thread]) => thread.id === newThread.id)?.[0];

    if (!userId) return;

    try {
        const user = await client.users.fetch(userId);

        if (!oldThread.archived && newThread.archived) {
            // The thread was just archived
            const embed = new EmbedBuilder()
                .setColor(0xff0000) // Red color
                .setTitle('Support Team')
                .setDescription('The support team has closed this thread.')
                .setTimestamp();

            await user.send({ embeds: [embed] });
        } else if (oldThread.archived && !newThread.archived) {
            // The thread was just unarchived (reopened)
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

// Listen for thread deletion events
client.on('threadDelete', async (thread) => {
    const userId = [...userThreads.entries()].find(([, t]) => t.id === thread.id)?.[0];

    if (userId) {
        try {
            const user = await client.users.fetch(userId);
            await user.send('Your support thread has been deleted or closed by the support team.');
            userThreads.delete(userId); // Remove the thread from the map
        } catch (error) {
            console.error('Error notifying user about thread deletion:', error);
        }
    }
});

// Command to open a thread with a user
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === 'add_user') {
        const userToAdd = options.getUser('user');

        if (!userToAdd) {
            await interaction.reply('User not found!');
            return;
        }

        // Fetch the target channel
        const targetChannel = await client.channels.fetch(channelId);
        if (!targetChannel.isTextBased()) {
            console.error('The target channel was not found or is not a text-based channel!');
            await interaction.reply('Error: Could not find the target channel.');
            return;
        }

        let thread = userThreads.get(userToAdd.id);

        // Check if an existing thread is available
        if (!thread) {
            const existingThreads = await targetChannel.threads.fetchActive();
            thread = existingThreads.threads.find(t => t.name === `DM from ${userToAdd.tag}`);

            if (!thread) {
                const archivedThreads = await targetChannel.threads.fetchArchived();
                thread = archivedThreads.threads.find(t => t.name === `DM from ${userToAdd.tag}`);

                if (thread) {
                    // Unarchive the thread
                    await thread.setArchived(false);
                    userThreads.set(userToAdd.id, thread);
                    await userToAdd.send('Your support thread has been reopened.');
                } else {
                    const threadName = `DM from ${userToAdd.tag}`;
                    try {
                        thread = await targetChannel.threads.create({
                            name: threadName,
                            autoArchiveDuration: 60, // Auto-archive after 1 hour of inactivity
                            reason: `Created for DM from ${userToAdd.tag}`,
                        });
                        userThreads.set(userToAdd.id, thread);
                        await userToAdd.send('A support thread has been created for you.');
                    } catch (error) {
                        console.error('Error creating thread:', error);
                        await interaction.reply('Error creating a new thread for the user.');
                        return;
                    }
                }
            } else {
                userThreads.set(userToAdd.id, thread);
            }
        }

        // Notify the support team
        await interaction.reply(`User ${userToAdd.tag} has been added. A support thread has been opened.`);
    }
});

// Add login token to the environment
client.login(token).catch(error => {
    console.error('Failed to login:', error);
});
