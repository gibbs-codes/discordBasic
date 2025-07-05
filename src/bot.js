// src/bot.js - Main Discord Bot Entry Point
import { Client, GatewayIntentBits } from 'discord.js';
import { config } from 'dotenv';
import { MessageHandler } from './handlers/messageHandler.js';
import { SchedulerService } from './services/schedulerService.js';
import { logger } from './utils/logger.js';

config();

class AccountabilityBot {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
      ]
    });

    this.messageHandler = new MessageHandler();
    this.scheduler = new SchedulerService();
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.client.once('ready', () => {
      logger.info(`🤖 ${this.client.user.tag} is online and ready to dominate!`);
      this.scheduler.startReconciliationSchedule(this.client);
    });

    this.client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      await this.messageHandler.handleMessage(message);
    });

    this.client.on('messageReactionAdd', async (reaction, user) => {
      if (user.bot) return;
      await this.messageHandler.handleReaction(reaction, user);
    });

    this.client.on('error', (error) => {
      logger.error('Discord client error:', error);
    });
  }

  async start() {
    try {
      logger.info('🚀 Starting accountability coach bot...');
      await this.client.login(process.env.DISCORD_TOKEN);
    } catch (error) {
      logger.error('Failed to start bot:', error);
      process.exit(1);
    }
  }
}

// Error handling
process.on('unhandledRejection', error => {
  logger.error('Unhandled promise rejection:', error);
});

process.on('SIGINT', () => {
  logger.info('Shutting down bot...');
  process.exit(0);
});

// Start the bot
const bot = new AccountabilityBot();
bot.start();