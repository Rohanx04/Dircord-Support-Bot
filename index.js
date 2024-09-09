const { Client, GatewayIntentBits, Partials, EmbedBuilder, REST, Routes } = require('discord.js');
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

// Initialize slash commands
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // Register slash command
    const rest = new REST({ version: '10' }).setToken(token);
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(Routes.applicationCommands(client.user.id), {
            body: [
                {
                    name: 'add_user',
                    description: 'Creates a new thread and adds the mentioned user',
                    options: [
                        {
                            name: 'user',
                            description: 'The user to add to the thread',
                            type: 6, // 6 is the type for a user mention
                            required: true
                        }
                    ]
                }
            ]
        });
        console.log('Successfully registered application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});

// Handling slash commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'add_user') {
        const user = interaction.options.getUser('user');
        const targetChannel = await client.channels.fetch(channelId);
        if (!targetChannel.isTextBased()) {
            return interaction.reply('The target channel is not a text-based channel!');
        }

        try {
            // Create a thread with the user's tag in the name
            const threadName = `Support Thread with ${user.tag}`;
            const thread = await targetChannel.threads.create({
                name: threadName,
                autoArchiveDuration: 60, // Auto-archive after 1 hour of inactivity
                reason: `Support thread created with ${user.tag}`
            });

            // DM the user
            await user.send('You have been added to a new support thread by the support team.');
            await interaction.reply(`Thread created and ${user.tag} has been notified via DM.`);

        } catch (error) {
            console.error('Error creating thread or sending DM:', error);
            return interaction.reply('There was an error while creating the thread or DMing the user.');
        }
    }
});

// Existing feature: Handle DMs from users
const userThreads = new Map();

client.on('messageCreate', async message => {
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

    if (!thread) {
        // Check if a thread with the user's name already exists
        const existingThreads = await targetChannel.threads.fetchActive();
        thread = existingThreads.threads.find(t => t.name === `DM from ${message.author.tag}`);

        if (!thread) {
            // Create a new thread for the user DM
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
        } else {
            userThreads.set(userId, thread);
        }
    }

    // Send the user's message directly to the thread
    try {
        await thread.send(message.content);
        await message.react('✅'); // React to the user's message with a checkmark emoji

        // Create a message collector to listen for new messages in the thread
        const filter = m => m.channelId === thread.id && m.author.id !== client.user.id;
        const collector = thread.createMessageCollector({ filter, time: 600000 }); // 10 minutes timeout
        collector.on('collect', async collectedMessage => {
            // Send the message back to the original user who initiated the conversation as an embed
            const embed = new EmbedBuilder()
                .setColor(0x00ff00) // Green color
                .setTitle('Support Team')
                .setDescription(collectedMessage.content)
                .setTimestamp()
                .setFooter({ text: `From ${collectedMessage.author.tag}` });

            await message.author.send({ embeds: [embed] });
        });
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

// Add login token to the environment
client.login(token).catch(error => {
    console.error('Failed to login:', error);
});
