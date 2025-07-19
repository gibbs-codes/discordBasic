// src/utils/intents.js - Smart Intent Configuration
import { GatewayIntentBits } from 'discord.js';
import { logger } from './logger.js';

/**
 * Determines which intents to use based on environment and configuration
 * @returns {Array} Array of Discord intents
 */
export function getDiscordIntents() {
  const baseIntents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions
  ];

  // Check environment variables for intent control
  const enablePrivilegedIntents = process.env.ENABLE_PRIVILEGED_INTENTS === 'true';
  const forceBasicIntents = process.env.FORCE_BASIC_INTENTS === 'true';
  
  if (forceBasicIntents) {
    logger.info('🔒 Using basic intents only (FORCE_BASIC_INTENTS=true)');
    return baseIntents;
  }

  if (enablePrivilegedIntents) {
    logger.info('🔑 Using privileged intents (ENABLE_PRIVILEGED_INTENTS=true)');
    return [
      ...baseIntents,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers
    ];
  }

  // Default: try privileged intents in development, basic in production
  if (process.env.NODE_ENV === 'development') {
    logger.info('🔧 Development mode: attempting privileged intents');
    return [
      ...baseIntents,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers
    ];
  } else {
    logger.info('🏭 Production mode: using basic intents (safer for deployment)');
    return baseIntents;
  }
}

/**
 * Check if privileged intents are available
 * @param {Client} client Discord client instance
 * @returns {Object} Intent availability status
 */
export function checkIntentAvailability(client) {
  const hasMessageContent = client.options.intents.has(GatewayIntentBits.MessageContent);
  const hasGuildMembers = client.options.intents.has(GatewayIntentBits.GuildMembers);
  
  return {
    hasMessageContent,
    hasGuildMembers,
    hasAllPrivileged: hasMessageContent && hasGuildMembers,
    missingIntents: {
      messageContent: !hasMessageContent,
      guildMembers: !hasGuildMembers
    }
  };
}

/**
 * Log intent status and provide guidance
 * @param {Object} intentStatus Result from checkIntentAvailability
 */
export function logIntentStatus(intentStatus) {
  if (intentStatus.hasAllPrivileged) {
    logger.info('✅ All privileged intents are available');
    return;
  }

  logger.warn('⚠️ MISSING PRIVILEGED INTENTS:');
  
  if (intentStatus.missingIntents.messageContent) {
    logger.warn('  - MessageContent Intent: Bot cannot read message content');
  }
  
  if (intentStatus.missingIntents.guildMembers) {
    logger.warn('  - GuildMembers Intent: Admin permission checking limited');
  }
  
  logger.warn('  - Enable these in Discord Developer Portal for full functionality');
  logger.warn('  - For now, use SLASH COMMANDS: /help, /health, /setmodel, etc.');
  
  // Provide specific guidance
  logger.info('💡 QUICK FIX:');
  logger.info('  1. Go to: https://discord.com/developers/applications');
  logger.info('  2. Select your bot → Bot → Privileged Gateway Intents');
  logger.info('  3. Enable: MESSAGE CONTENT INTENT & SERVER MEMBERS INTENT');
  logger.info('  4. Set ENABLE_PRIVILEGED_INTENTS=true in your .env');
  logger.info('  5. Restart the bot');
}