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

const token = process.env.DISCORD_BOT_TOKEN;
const channelId = process.env.DISCORD_CHANNEL_ID;
const rest = new REST({ version: '10' }).setToken(token);

// Set up an Express server
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is running!');
});
app.listen(port, () => {
    console.log(`HTTP server running on port ${port}`);
});

// Handle bot login
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    await registerSlashCommands(); // Register the slash commands
});

// Map to store user thread info
const userThreads = new Map();

client.on('messageCreate', async message => {
    if (message.guild || message.author.bot) return;

    let thread = await findOrCreateThread(message.author);
    
    if (!thread) return; // If no thread is found or created, return
    try {
        await thread.send(message.content);
        await message.react('✅'); // React with a checkmark
    } catch (error) {
        console.error('Error sending message to thread:', error);
    }
});

client.on('threadUpdate', async (oldThread, newThread) => {
    const userId = [...userThreads.entries()].find(([, thread]) => thread.id === newThread.id)?.[0];

    if (!userId) return;
    const user = await client.users.fetch(userId);

    try {
        if (!oldThread.archived && newThread.archived) {
            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('Support Team')
                .setDescription('The support team has closed this thread.')
                .setTimestamp();
            await user.send({ embeds: [embed] });
        } else if (oldThread.archived && !newThread.archived) {
            const embed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('Support Team')
                .setDescription('The support team has reopened this thread.')
                .setTimestamp();
            await user.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error('Error notifying user about thread update:', error);
    }
});

// Function to find or create a thread for a user
async function findOrCreateThread(user) {
    const targetChannel = await client.channels.fetch(channelId);
    if (!targetChannel.isTextBased()) {
        console.error('The target channel is not a text-based channel!');
        return null;
    }

    let thread = userThreads.get(user.id);

    if (!thread) {
        const existingThreads = await targetChannel.threads.fetchActive();
        thread = existingThreads.threads.find(t => t.name === `DM from ${user.tag}`);

        if (!thread) {
            try {
                thread = await targetChannel.threads.create({
                    name: `DM from ${user.tag}`,
                    autoArchiveDuration: 60, // Auto-archive after 1 hour of inactivity
                    reason: `Created for DM from ${user.tag}`,
                });
                userThreads.set(user.id, thread);
            } catch (error) {
                console.error('Error creating thread:', error);
                return null;
            }
        } else {
            userThreads.set(user.id, thread);
        }
    }

    return thread;
}

// Slash commands handler
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'add_role') {
        const member = interaction.options.getMember('user');
        const role = interaction.options.getRole('role');

        if (member && role) {
            try {
                await member.roles.add(role);
                await interaction.reply(`Added role ${role.name} to ${member.user.tag}`);
            } catch (error) {
                await interaction.reply('Failed to add role.');
                console.error(error);
            }
        }
    } else if (commandName === 'remove_role') {
        const member = interaction.options.getMember('user');
        const role = interaction.options.getRole('role');

        if (member && role) {
            try {
                await member.roles.remove(role);
                await interaction.reply(`Removed role ${role.name} from ${member.user.tag}`);
            } catch (error) {
                await interaction.reply('Failed to remove role.');
                console.error(error);
            }
        }
    } else if (commandName === 'kick') {
        const member = interaction.options.getMember('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (member) {
            try {
                await member.kick(reason);
                await interaction.reply(`${member.user.tag} has been kicked. Reason: ${reason}`);
            } catch (error) {
                await interaction.reply('Failed to kick the user.');
                console.error(error);
            }
        }
    } else if (commandName === 'ban') {
        const member = interaction.options.getMember('user');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (member) {
            try {
                await member.ban({ reason });
                await interaction.reply(`${member.user.tag} has been banned. Reason: ${reason}`);
            } catch (error) {
                await interaction.reply('Failed to ban the user.');
                console.error(error);
            }
        }
    } else if (commandName === 'unban') {
        const user = interaction.options.getUser('user');
        if (user) {
            try {
                await interaction.guild.bans.remove(user);
                await interaction.reply(`${user.tag} has been unbanned.`);
            } catch (error) {
                await interaction.reply('Failed to unban the user.');
                console.error(error);
            }
        }
    }
});

// Slash commands registration
async function registerSlashCommands() {
    const commands = [
        {
            name: 'add_role',
            description: 'Add a role to a user',
            options: [
                {
                    name: 'user',
                    type: 6, // USER type
                    description: 'The user to whom the role will be added',
                    required: true,
                },
                {
                    name: 'role',
                    type: 8, // ROLE type
                    description: 'The role to add',
                    required: true,
                },
            ],
        },
        {
            name: 'remove_role',
            description: 'Remove a role from a user',
            options: [
                {
                    name: 'user',
                    type: 6, // USER type
                    description: 'The user from whom the role will be removed',
                    required: true,
                },
                {
                    name: 'role',
                    type: 8, // ROLE type
                    description: 'The role to remove',
                    required: true,
                },
            ],
        },
        {
            name: 'kick',
            description: 'Kick a user from the server',
            options: [
                {
                    name: 'user',
                    type: 6, // USER type
                    description: 'The user to kick',
                    required: true,
                },
                {
                    name: 'reason',
                    type: 3, // STRING type
                    description: 'The reason for kicking',
                    required: false,
                },
            ],
        },
        {
            name: 'ban',
            description: 'Ban a user from the server',
            options: [
                {
                    name: 'user',
                    type: 6, // USER type
                    description: 'The user to ban',
                    required: true,
                },
                {
                    name: 'reason',
                    type: 3, // STRING type
                    description: 'The reason for banning',
                    required: false,
                },
            ],
        },
        {
            name: 'unban',
            description: 'Unban a user',
            options: [
                {
                    name: 'user',
                    type: 6, // USER type
                    description: 'The user to unban',
                    required: true,
                },
            ],
        },
    ];

    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
}

client.login(token).catch(error => {
    console.error('Failed to login:', error);
});
