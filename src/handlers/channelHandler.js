// src/handlers/channelHandler.js - Channel-Specific Behaviors with Dynamic Configuration
import { getChannelType, getChannelConfiguration } from '../../config/channels.js';
import { ChannelConfigService } from '../services/ChannelConfigService.js';
import { logger } from '../utils/logger.js';

export class ChannelHandler {
  constructor() {
    this.channelConfigService = new ChannelConfigService();
  }

  // Determine channel type from channel name
  getChannelType(channelName) {
    return getChannelType(channelName);
  }

  // Handle post-message actions based on channel type
  async handlePostMessageActions(message, channelType, botResponse) {
    try {
      const guildId = message.guild?.id;
      
      // Get dynamic configuration for this channel
      const channelConfig = await this.channelConfigService.getChannelConfig(channelType, guildId);
      const reactions = await this.channelConfigService.getChannelReactions(channelType, guildId);
      const features = await this.channelConfigService.getChannelFeatures(channelType, guildId);
      
      // Add standard reactions based on channel configuration
      if (reactions && reactions.length > 0) {
        for (const emoji of reactions) {
          try {
            await message.react(emoji);
          } catch (error) {
            logger.warn(`Failed to add reaction ${emoji}:`, error.message);
          }
        }
      }

      // Handle channel-specific behaviors
      switch (channelType) {
        case 'coding':
          await this.handleCodingChannel(message, botResponse, features);
          break;
          
        case 'projects':
          await this.handleProjectsChannel(message, botResponse, features);
          break;
          
        case 'planning':
          await this.handlePlanningChannel(message, botResponse, features);
          break;
          
        case 'analysis':
          await this.handleAnalysisChannel(message, botResponse, features);
          break;
          
        case 'admin':
          await this.handleAdminChannel(message, botResponse, features);
          break;
          
        default:
          // Handle general channel with basic reactions
          await this.handleGeneralChannel(message, botResponse, features);
          break;
      }
    } catch (error) {
      logger.error(`Error in post-message actions for ${channelType}:`, error);
    }
  }

  // Handle general channel actions
  async handleGeneralChannel(message, botResponse, features) {
    // Basic general channel handling
    logger.info(`General channel interaction processed`);
  }

  // Handle coding channel actions
  async handleCodingChannel(message, botResponse, features) {
    // Check if it's a code review or solution
    if (message.content.includes('```') || botResponse.includes('```')) {
      // This is likely code - offer to create thread for detailed discussion
      if (features?.threadSupport) {
        try {
          // Auto-create thread for code discussions
          const thread = await message.startThread({
            name: `Code Discussion - ${message.author.username}`,
            autoArchiveDuration: 1440, // 24 hours
            reason: 'Automatic thread for code discussion'
          });
          
          await thread.send('🧵 Thread created for detailed code discussion!');
          logger.info(`Created thread for code discussion: ${thread.name}`);
        } catch (error) {
          logger.warn(`Failed to create code thread:`, error.message);
        }
      }
    }
    
    // Check for file attachments if allowed
    if (features?.allowFiles && message.attachments.size > 0) {
      logger.info(`Code files detected in coding channel`);
    }
    
    logger.info(`Coding channel actions completed`);
  }

  // Handle projects channel actions
  async handleProjectsChannel(message, botResponse, features) {
    // If it seems like a new project idea, suggest creating a thread
    if (message.content.toLowerCase().includes('new project') || 
        message.content.toLowerCase().includes('idea') ||
        message.content.toLowerCase().includes('build')) {
      
      if (features?.threadSupport) {
        try {
          const thread = await message.startThread({
            name: `Project: ${this.extractProjectName(message.content)}`,
            autoArchiveDuration: 10080, // 7 days
            reason: 'Automatic thread for project planning'
          });
          
          await thread.send('🚀 Project planning thread created! Let\'s break this down into actionable steps.');
          logger.info(`Created project planning thread: ${thread.name}`);
        } catch (error) {
          logger.warn(`Failed to create project thread:`, error.message);
        }
      }
    }
    
    logger.info(`Project channel actions completed`);
  }

  // Handle planning channel actions
  async handlePlanningChannel(message, botResponse, features) {
    // For task/workflow discussions, check for thread creation
    if (features?.threadSupport && 
        (message.content.toLowerCase().includes('plan for') || 
         message.content.toLowerCase().includes('workflow for'))) {
      
      try {
        const thread = await message.startThread({
          name: `Planning Session - ${new Date().toLocaleDateString()}`,
          autoArchiveDuration: 1440, // 24 hours
          reason: 'Planning session thread'
        });
        
        await thread.send('📋 Planning session started! Let\'s organize your tasks and priorities.');
        logger.info(`Created planning thread: ${thread.name}`);
      } catch (error) {
        logger.warn(`Failed to create planning thread:`, error.message);
      }
    }
    
    logger.info(`Planning channel actions completed`);
  }

  // Handle analysis channel actions
  async handleAnalysisChannel(message, botResponse, features) {
    // Check for data analysis or research requests
    if (message.content.toLowerCase().includes('analyze') || 
        message.content.toLowerCase().includes('data')) {
      
      if (features?.threadSupport) {
        try {
          const thread = await message.startThread({
            name: `Analysis: ${this.extractAnalysisSubject(message.content)}`,
            autoArchiveDuration: 4320, // 3 days
            reason: 'Data analysis thread'
          });
          
          await thread.send('📊 Analysis thread created! Let\'s dive deep into your data.');
          logger.info(`Created analysis thread: ${thread.name}`);
        } catch (error) {
          logger.warn(`Failed to create analysis thread:`, error.message);
        }
      }
    }
    
    // Handle file uploads for data analysis
    if (features?.allowFiles && message.attachments.size > 0) {
      const attachments = Array.from(message.attachments.values());
      const dataFiles = attachments.filter(att => 
        att.name.endsWith('.csv') || 
        att.name.endsWith('.json') || 
        att.name.endsWith('.xlsx')
      );
      
      if (dataFiles.length > 0) {
        logger.info(`Data files uploaded for analysis: ${dataFiles.map(f => f.name).join(', ')}`);
      }
    }
    
    logger.info(`Analysis channel actions completed`);
  }

  // Handle admin channel actions
  async handleAdminChannel(message, botResponse, features) {
    // Admin channel is primarily for configuration
    if (!message.author.bot && !message.content.startsWith('!')) {
      logger.info(`Non-command message in admin channel`);
    }
    
    logger.info(`Admin channel actions completed`);
  }

  // Helper methods
  extractProjectName(content) {
    // Try to extract a project name from the message
    const matches = content.match(/project\s+(?:called|named|for)\s+([a-zA-Z0-9\s-]+)/i);
    if (matches && matches[1]) {
      return matches[1].trim().substring(0, 50);
    }
    
    // Fallback to first few words
    const words = content.split(' ').slice(0, 3).join(' ');
    return words.substring(0, 50) || 'New Project';
  }

  extractAnalysisSubject(content) {
    // Try to extract what's being analyzed
    const matches = content.match(/analyz[ie]\s+([a-zA-Z0-9\s-]+)/i);
    if (matches && matches[1]) {
      return matches[1].trim().substring(0, 50);
    }
    
    // Look for "data" mentions
    const dataMatches = content.match(/([a-zA-Z0-9\s-]+)\s+data/i);
    if (dataMatches && dataMatches[1]) {
      return `${dataMatches[1].trim()} Data`.substring(0, 50);
    }
    
    return 'Data Analysis';
  }

  // Get channel by type helper (for posting automated messages)
  getChannelByType(guild, targetType) {
    return guild.channels.cache.find(channel => {
      const channelType = this.getChannelType(channel.name);
      return channelType === targetType;
    });
  }

  // Check if channel allows user messages (vs bot-only)
  async isUserAllowed(channelType, guildId = null) {
    const features = await this.channelConfigService.getChannelFeatures(channelType, guildId);
    return !features?.adminOnly;
  }

  // Get channel-specific message limits from configuration
  async getMessageLimits(channelType, guildId = null) {
    const features = await this.channelConfigService.getChannelFeatures(channelType, guildId);
    
    return {
      maxLength: features?.maxMessageLength || 2000,
      rateLimitMinutes: features?.rateLimitMinutes || 0,
      allowFiles: features?.allowFiles || false,
      threadSupport: features?.threadSupport || false
    };
  }

  // Validate channel setup for a Discord guild
  async validateChannelSetup(guild) {
    const foundChannels = {};
    const availableConfigs = await this.channelConfigService.getAllChannelConfigs(guild.id);
    const requiredChannelTypes = availableConfigs.map(config => config.channelType);
    
    guild.channels.cache.forEach(channel => {
      if (channel.type === 0) { // Text channel
        const channelType = this.getChannelType(channel.name);
        if (!foundChannels[channelType]) {
          foundChannels[channelType] = [];
        }
        foundChannels[channelType].push({
          name: channel.name,
          id: channel.id
        });
      }
    });
    
    const missingChannels = requiredChannelTypes.filter(type => !foundChannels[type]);
    
    const validation = {
      foundChannels,
      missingChannels,
      isComplete: missingChannels.length === 0,
      availableConfigs: availableConfigs.length,
      configuredChannels: Object.keys(foundChannels).length
    };
    
    if (validation.isComplete) {
      logger.info(`✅ All ${availableConfigs.length} configured channel types detected for guild ${guild.name}`);
    } else {
      logger.warn(`⚠️ Missing channels for guild ${guild.name}: ${missingChannels.join(', ')}`);
      logger.info('💡 Create channels with these keywords in the name:', 
        missingChannels.map(type => {
          const config = availableConfigs.find(c => c.channelType === type);
          return `${type}: ${config?.name || type}`;
        }).join(', ')
      );
    }
    
    return validation;
  }
}