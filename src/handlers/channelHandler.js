// src/handlers/channelHandler.js - Channel-Specific Behaviors
import { logger } from '../utils/logger.js';

export class ChannelHandler {
  constructor() {
    this.channelMappings = {
      'general': ['general', 'chat', 'main'],
      'punishments': ['punishment', 'violations', 'debt'],
      'proof': ['proof', 'evidence', 'verification', 'workout'],
      'begging': ['begging', 'requests', 'permission', 'negotiate'],
      'reviews': ['reviews', 'summary', 'reconciliation', 'performance']
    };
  }

  // Determine channel type from channel name
  getChannelType(channelName) {
    const name = channelName.toLowerCase();
    
    for (const [type, keywords] of Object.entries(this.channelMappings)) {
      if (keywords.some(keyword => name.includes(keyword))) {
        return type;
      }
    }
    
    // Default to general if no match
    return 'general';
  }

  // Handle post-message actions based on channel type
  async handlePostMessageActions(message, channelType, botResponse) {
    try {
      switch (channelType) {
        case 'proof':
          await this.handleProofChannel(message, botResponse);
          break;
          
        case 'begging':
          await this.handleBeggingChannel(message, botResponse);
          break;
          
        case 'punishments':
          await this.handlePunishmentsChannel(message, botResponse);
          break;
          
        case 'reviews':
          await this.handleReviewsChannel(message, botResponse);
          break;
          
        default:
          // No special actions for general channel
          break;
      }
    } catch (error) {
      logger.error(`Error in post-message actions for ${channelType}:`, error);
    }
  }

  // Handle proof channel actions
  async handleProofChannel(message, botResponse) {
    // Add verification reactions for user to respond to
    await message.react('✅'); // Proof verified
    await message.react('❌'); // Proof insufficient
    await message.react('🤔'); // Needs more evidence
    
    logger.info(`Added verification reactions to proof submission`);
  }

  // Handle begging channel actions
  async handleBeggingChannel(message, botResponse) {
    // Add voting reactions (even though it's just you, gives you quick options)
    await message.react('👍'); // Approve request
    await message.react('👎'); // Deny request
    await message.react('⚖️'); // Conditional approval
    
    // If bot response suggests earning something, add workout reaction
    if (botResponse.toLowerCase().includes('earn') || botResponse.toLowerCase().includes('work')) {
      await message.react('💪'); // Get to work
    }
    
    logger.info(`Added begging response reactions`);
  }

  // Handle punishments channel (usually bot-only announcements)
  async handlePunishmentsChannel(message, botResponse) {
    // This channel should primarily be for bot announcements
    // But if user responds, add accountability reactions
    if (!message.author.bot) {
      await message.react('⚡'); // Punishment acknowledged
      await message.react('💸'); // Debt acknowledged
      
      logger.info(`User responded in punishments channel - added acknowledgment reactions`);
    }
  }

  // Handle reviews channel actions
  async handleReviewsChannel(message, botResponse) {
    // For performance discussions, add improvement tracking
    await message.react('📈'); // Improving
    await message.react('📉'); // Declining
    await message.react('🎯'); // On target
    
    // If reconciliation summary, add action reactions
    if (botResponse.toLowerCase().includes('reconciliation') || botResponse.toLowerCase().includes('summary')) {
      await message.react('💰'); // Financial focus
      await message.react('💪'); // Workout focus
      await message.react('🏢'); // Career focus
    }
    
    logger.info(`Added performance tracking reactions to reviews`);
  }

  // Get channel by type helper (for posting automated messages)
  getChannelByType(guild, targetType) {
    return guild.channels.cache.find(channel => {
      const channelType = this.getChannelType(channel.name);
      return channelType === targetType;
    });
  }

  // Validate channel setup (useful for debugging)
  validateChannelSetup(guild) {
    const foundChannels = {};
    const requiredChannels = ['general', 'punishments', 'proof', 'begging', 'reviews'];
    
    guild.channels.cache.forEach(channel => {
      if (channel.type === 0) { // Text channel
        const channelType = this.getChannelType(channel.name);
        if (!foundChannels[channelType]) {
          foundChannels[channelType] = [];
        }
        foundChannels[channelType].push(channel.name);
      }
    });
    
    const missingChannels = requiredChannels.filter(type => !foundChannels[type]);
    
    if (missingChannels.length > 0) {
      logger.warn(`Missing recommended channels: ${missingChannels.join(', ')}`);
      logger.info('Create channels with these keywords in the name:');
      missingChannels.forEach(type => {
        logger.info(`  ${type}: ${this.channelMappings[type].join(', ')}`);
      });
    } else {
      logger.info('✅ All required channel types detected');
    }
    
    return { foundChannels, missingChannels };
  }

  // Check if channel allows user messages (vs bot-only)
  isUserAllowed(channelType) {
    // Punishments channel is typically bot-only for official announcements
    return channelType !== 'punishments';
  }

  // Get channel-specific message limits
  getMessageLimits(channelType) {
    const limits = {
      'general': { maxLength: 2000, rateLimitMinutes: 0 },
      'proof': { maxLength: 500, rateLimitMinutes: 1 }, // Short descriptions
      'begging': { maxLength: 1000, rateLimitMinutes: 5 }, // Limit begging frequency
      'reviews': { maxLength: 2000, rateLimitMinutes: 0 },
      'punishments': { maxLength: 1000, rateLimitMinutes: 0 } // Bot announcements
    };
    
    return limits[channelType] || limits.general;
  }
}