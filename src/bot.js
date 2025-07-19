// src/bot.js - Main Discord Bot Entry Point
import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { MessageHandler } from './handlers/messageHandler.js';
import { AdminCommandService } from './services/AdminCommandService.js';
import { logger } from './utils/logger.js';
import { getDiscordIntents, checkIntentAvailability, logIntentStatus } from './utils/intents.js';

config();

class LLMWorkspaceBot {
  constructor() {
    this.client = new Client({
      intents: getDiscordIntents()
    });

    this.messageHandler = new MessageHandler();
    this.adminCommandService = new AdminCommandService();
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.client.once('ready', async () => {
      logger.info(`🤖 ${this.client.user.tag} is online and ready for technical work!`);
      
      // Check intent availability and provide guidance
      const intentStatus = checkIntentAvailability(this.client);
      logIntentStatus(intentStatus);
      
      // Register slash commands
      await this.registerSlashCommands();
      
      // Validate channel setup
      this.client.guilds.cache.forEach(guild => {
        this.messageHandler.validateChannelSetup(guild);
      });
      
      logger.info('✅ LLM Workspace Bot started successfully');
      if (!intentStatus.hasAllPrivileged) {
        logger.info('💡 Use slash commands for full functionality until intents are enabled');
      }
    });

    this.client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      await this.messageHandler.handleMessage(message);
    });

    this.client.on('messageReactionAdd', async (reaction, user) => {
      if (user.bot) return;
      await this.messageHandler.handleReaction(reaction, user);
    });

    this.client.on('interactionCreate', async (interaction) => {
      if (interaction.isCommand()) {
        await this.adminCommandService.handleSlashCommand(interaction);
      } else if (interaction.isButton()) {
        await this.adminCommandService.handleButtonInteraction(interaction);
      }
    });

    this.client.on('error', (error) => {
      logger.error('Discord client error:', error);
    });
  }

  async registerSlashCommands() {
    try {
      const commands = this.adminCommandService.getSlashCommands();
      const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

      logger.info('Started refreshing application (/) commands.');

      // Register commands globally
      await rest.put(
        Routes.applicationCommands(this.client.user.id),
        { body: commands }
      );

      logger.info('Successfully reloaded application (/) commands.');
    } catch (error) {
      logger.error('Error registering slash commands:', error);
    }
  }

  async start() {
    try {
      logger.info('🚀 Starting LLM Workspace Bot...');
      await this.client.login(process.env.DISCORD_TOKEN);
    } catch (error) {
      logger.error('Failed to start bot:', error);
      process.exit(1);
    }
  }

  async shutdown() {
    logger.info('🛑 Shutting down bot...');
    
    // Logout from Discord
    await this.client.destroy();
    
    logger.info('✅ Bot shutdown complete');
  }
}

// Error handling
process.on('unhandledRejection', error => {
  logger.error('Unhandled promise rejection:', error);
});

process.on('SIGINT', async () => {
  if (global.bot) {
    await global.bot.shutdown();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (global.bot) {
    await global.bot.shutdown();
  }
  process.exit(0);
});

// Start the bot
const bot = new LLMWorkspaceBot();
global.bot = bot; // For shutdown handling
bot.start();