// src/handlers/messageHandler.js - Core Message Processing
import { ChannelHandler } from './channelHandler.js';
import { LLMService } from '../services/llm/LLMService.js';
import { MemoryService } from '../services/MemoryService.js';
import { validateChannelSetup, hasAdminAccess, getChannelType } from '../../config/channels.js';
import { logger } from '../utils/logger.js';

export class MessageHandler {
  constructor() {
    this.channelHandler = new ChannelHandler();
    this.llmService = new LLMService();
    this.memoryService = new MemoryService();
  }

  async handleMessage(message) {
    try {
      const channelType = this.channelHandler.getChannelType(message.channel.name);
      
      logger.info(`Message in ${channelType}: ${message.content.substring(0, 50)}...`);
      
      // Handle admin commands
      if (this.isAdminCommand(message, channelType)) {
        await this.handleAdminCommand(message, channelType);
        return;
      }

      // Check admin-only channel access
      if (channelType === 'admin' && !hasAdminAccess(message.member)) {
        await message.reply('⚠️ This channel is restricted to administrators.');
        return;
      }

      // Get conversation context and memory
      const context = await this.buildMessageContext(message, channelType);
      
      // Generate LLM response with full context
      const response = await this.llmService.generateResponse(context);
      
      // Store this interaction in memory for future reference
      await this.memoryService.storeInteraction({
        userId: message.author.id,
        username: message.author.displayName,
        channel: channelType,
        userMessage: message.content,
        botResponse: response,
        timestamp: new Date(),
        context: context.memoryContext
      });
      
      // Send response
      await message.reply(response);
      
      // Handle channel-specific follow-up actions
      await this.channelHandler.handlePostMessageActions(message, channelType, response);
      
    } catch (error) {
      logger.error('Error handling message:', error);
      await message.reply('⚠️ Something went wrong processing your request. Please try again.');
    }
  }

  async handleReaction(reaction, user) {
    try {
      const channelType = this.channelHandler.getChannelType(reaction.message.channel.name);
      
      // Handle coding channel reactions
      if (channelType === 'coding' && reaction.emoji.name === '✅') {
        const context = {
          message: 'Code solution approved',
          channelType: 'coding',
          username: user.displayName,
          context: 'code_approval'
        };
        
        const response = await this.llmService.generateResponse(context);
        await reaction.message.reply(`✅ ${response}`);
      }
      
      // Handle project reactions
      if (channelType === 'projects' && reaction.emoji.name === '🚀') {
        const context = {
          message: 'Project idea endorsed',
          channelType: 'projects', 
          username: user.displayName,
          context: 'project_endorsement'
        };
        
        const response = await this.llmService.generateResponse(context);
        await reaction.message.reply(`🚀 ${response}`);
      }
    } catch (error) {
      logger.error('Error handling reaction:', error);
    }
  }

  async buildMessageContext(message, channelType) {
    // Get recent message history for immediate context
    const messageHistory = await this.getRecentMessages(message.channel, 5);
    
    // Get relevant memory context from MongoDB logs and past interactions
    const memoryContext = await this.memoryService.getRelevantContext({
      userId: message.author.id,
      channelType,
      currentMessage: message.content,
      lookbackDays: 14 // Look back 2 weeks for patterns
    });

    return {
      message: message.content,
      channelType,
      guildId: message.guild?.id,
      username: message.author.displayName,
      messageHistory,
      memoryContext,
      timestamp: message.createdAt
    };
  }

  async getRecentMessages(channel, limit = 5) {
    try {
      const messages = await channel.messages.fetch({ limit });
      return messages.map(msg => ({
        author: msg.author.displayName,
        content: msg.content,
        timestamp: msg.createdAt,
        isBot: msg.author.bot
      })).reverse();
    } catch (error) {
      logger.error('Error fetching message history:', error);
      return [];
    }
  }

  isAdminCommand(message, channelType) {
    const content = message.content.toLowerCase();
    return content.startsWith('!') && (
      channelType === 'admin' || 
      hasAdminAccess(message.member)
    );
  }

  async handleAdminCommand(message, channelType) {
    const command = message.content.toLowerCase();
    const args = command.split(' ').slice(1);

    try {
      if (command.startsWith('!config')) {
        await this.showConfiguration(message);
      } else if (command.startsWith('!memory-stats')) {
        await this.showMemoryStats(message);
      } else if (command.startsWith('!test-model')) {
        await this.testModelConnection(message, args[0]);
      } else if (command.startsWith('!validate-channels')) {
        await this.validateChannelSetup(message.guild);
      } else if (command.startsWith('!update-config')) {
        await this.updateChannelConfiguration(message, args);
      } else if (command.startsWith('!list-channels')) {
        await this.listChannelConfigurations(message);
      } else if (command.startsWith('!export-config')) {
        await this.exportConfiguration(message);
      } else if (command.startsWith('!help')) {
        await this.showAdminHelp(message);
      } else {
        await message.reply('❓ Unknown admin command. Use `!help` to see available commands.');
      }
    } catch (error) {
      logger.error('Error handling admin command:', error);
      await message.reply('⚠️ Error processing admin command.');
    }
  }

  async showConfiguration(message) {
    const guildId = message.guild?.id;
    const config = await this.llmService.getConfiguration(guildId);
    
    // Format for better readability
    const formattedConfig = {
      guild: message.guild?.name || 'Default',
      statistics: config.statistics,
      channels: config.channelConfigs.map(ch => ({
        type: ch.channelType,
        name: ch.name,
        model: `${ch.provider}/${ch.model}`,
        temp: ch.temperature,
        active: ch.isActive
      }))
    };
    
    await message.reply(`\`\`\`json\n${JSON.stringify(formattedConfig, null, 2)}\n\`\`\``);
  }

  async showMemoryStats(message) {
    const stats = await this.memoryService.getStats();
    await message.reply(`📊 **Memory Statistics**\n\`\`\`\n${stats}\n\`\`\``);
  }

  async testModelConnection(message, channelType) {
    if (!channelType) {
      await message.reply('❓ Please specify a channel type: `!test-model <channel>`\nAvailable: coding, general, projects, planning, analysis, admin');
      return;
    }
    
    const guildId = message.guild?.id;
    const result = await this.llmService.testConnection(channelType, guildId);
    
    if (result.success) {
      await message.reply(`✅ **Connection Successful**\nChannel: ${channelType}\nProvider: ${result.provider}\nModel: ${result.model}`);
    } else {
      await message.reply(`❌ **Connection Failed**\nChannel: ${channelType}\nError: ${result.error}`);
    }
  }

  async updateChannelConfiguration(message, args) {
    if (args.length < 3) {
      await message.reply('❓ Usage: `!update-config <channel> <field> <value>`\nExample: `!update-config coding model gpt-4`');
      return;
    }

    const [channelType, field, ...valueParts] = args;
    const value = valueParts.join(' ');
    const guildId = message.guild?.id;

    try {
      const updates = {};
      
      if (field === 'model') {
        updates['llmConfig.model'] = value;
      } else if (field === 'provider') {
        updates['llmConfig.provider'] = value;
      } else if (field === 'temperature') {
        const temp = parseFloat(value);
        if (isNaN(temp) || temp < 0 || temp > 2) {
          await message.reply('❌ Temperature must be a number between 0 and 2');
          return;
        }
        updates['llmConfig.temperature'] = temp;
      } else if (field === 'prompt') {
        updates['llmConfig.systemPrompt'] = value;
      } else {
        await message.reply('❌ Invalid field. Available: model, provider, temperature, prompt');
        return;
      }

      const success = await this.llmService.updateChannelConfig(channelType, updates, guildId);
      
      if (success) {
        await message.reply(`✅ Updated ${field} for ${channelType} channel`);
      } else {
        await message.reply(`❌ Failed to update configuration for ${channelType}`);
      }
    } catch (error) {
      logger.error('Error updating channel config:', error);
      await message.reply('⚠️ Error updating configuration');
    }
  }

  async listChannelConfigurations(message) {
    const guildId = message.guild?.id;
    const configs = await this.llmService.getAllChannelConfigs(guildId);
    
    if (configs.length === 0) {
      await message.reply('📋 No channel configurations found');
      return;
    }

    const configList = configs.map(config => {
      const status = config.isActive ? '🟢' : '🔴';
      return `${status} **${config.channelType}** - ${config.name}\n   Model: ${config.llmConfig.provider}/${config.llmConfig.model}\n   Temp: ${config.llmConfig.temperature}`;
    }).join('\n\n');

    await message.reply(`📋 **Channel Configurations**\n\n${configList}`);
  }

  async exportConfiguration(message) {
    const guildId = message.guild?.id;
    const channelConfigService = this.llmService.channelConfigService;
    
    try {
      const exportData = await channelConfigService.exportConfigurations(guildId);
      const jsonString = JSON.stringify(exportData, null, 2);
      
      // Create a temporary file for download
      const filename = `config-export-${guildId || 'default'}-${Date.now()}.json`;
      
      await message.reply({
        content: '📤 **Configuration Export**\nHere\'s your current configuration:',
        files: [{
          attachment: Buffer.from(jsonString, 'utf8'),
          name: filename
        }]
      });
    } catch (error) {
      logger.error('Error exporting configuration:', error);
      await message.reply('⚠️ Error exporting configuration');
    }
  }

  async showAdminHelp(message) {
    const helpText = `🔧 **Admin Commands**

**Configuration Management:**
\`!config\` - Show current channel configurations
\`!list-channels\` - List all channel configurations
\`!update-config <channel> <field> <value>\` - Update channel settings
\`!export-config\` - Export configuration as JSON file

**System Management:**
\`!test-model <channel>\` - Test LLM connection for channel
\`!validate-channels\` - Check guild channel setup
\`!memory-stats\` - Show memory usage statistics

**Available Channels:** coding, general, projects, planning, analysis, admin
**Available Fields:** model, provider, temperature, prompt

**Examples:**
\`!update-config coding model gpt-4\`
\`!update-config analysis temperature 0.2\`
\`!test-model projects\``;

    await message.reply(helpText);
  }

  async validateChannelSetup(guild) {
    const validation = await this.channelHandler.validateChannelSetup(guild);
    return validation;
  }
}