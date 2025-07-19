// src/services/AdminCommandService.js - Comprehensive Admin Command System
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { ChannelConfigService } from './ChannelConfigService.js';
import { MemoryService } from './MemoryService.js';
import { LLMService } from './llm/LLMService.js';
import { hasAdminAccess, getChannelType } from '../../config/channels.js';
import { logger } from '../utils/logger.js';

export class AdminCommandService {
  constructor() {
    this.channelConfigService = new ChannelConfigService();
    this.memoryService = new MemoryService();
    this.llmService = new LLMService();
    this.pendingConfirmations = new Map(); // Store pending confirmations
    this.confirmationTimeout = 30000; // 30 seconds
  }

  // Get all slash commands for registration
  getSlashCommands() {
    return [
      // Channel Management Commands
      new SlashCommandBuilder()
        .setName('setmodel')
        .setDescription('Change LLM model for a channel')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Target channel')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('model')
            .setDescription('Model name (e.g., gpt-4, gpt-3.5-turbo)')
            .setRequired(true)
            .addChoices(
              { name: 'GPT-4', value: 'gpt-4' },
              { name: 'GPT-4 Turbo', value: 'gpt-4-turbo' },
              { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
              { name: 'Claude 3 Opus', value: 'claude-3-opus' },
              { name: 'Claude 3 Sonnet', value: 'claude-3-sonnet' },
              { name: 'Llama 3 70B', value: 'llama3:70b' },
              { name: 'Custom', value: 'custom' }
            )),

      new SlashCommandBuilder()
        .setName('setprompt')
        .setDescription('Update system prompt for a channel')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Target channel')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('prompt')
            .setDescription('New system prompt')
            .setRequired(true)),

      new SlashCommandBuilder()
        .setName('settemp')
        .setDescription('Adjust temperature for a channel')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Target channel')
            .setRequired(true))
        .addNumberOption(option =>
          option.setName('temperature')
            .setDescription('Temperature (0.0-2.0)')
            .setRequired(true)
            .setMinValue(0.0)
            .setMaxValue(2.0)),

      new SlashCommandBuilder()
        .setName('showconfig')
        .setDescription('Display current configuration for a channel')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Target channel')
            .setRequired(true)),

      // System Management Commands
      new SlashCommandBuilder()
        .setName('models')
        .setDescription('List available models and providers'),

      new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Show usage statistics by channel'),

      new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Export all configurations'),

      new SlashCommandBuilder()
        .setName('restore')
        .setDescription('Import configuration file')
        .addAttachmentOption(option =>
          option.setName('file')
            .setDescription('Configuration JSON file')
            .setRequired(true)),

      // Memory Management Commands
      new SlashCommandBuilder()
        .setName('resetmemory')
        .setDescription('Clear memory context for a channel (DESTRUCTIVE)')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Target channel')
            .setRequired(true)),

      new SlashCommandBuilder()
        .setName('showmemory')
        .setDescription('Display current memory patterns'),

      new SlashCommandBuilder()
        .setName('patterns')
        .setDescription('Show learned behavioral patterns')
        .addUserOption(option =>
          option.setName('user')
            .setDescription('Specific user (optional)')
            .setRequired(false)),

      // Testing Commands
      new SlashCommandBuilder()
        .setName('test')
        .setDescription('Test channel configuration')
        .addChannelOption(option =>
          option.setName('channel')
            .setDescription('Target channel')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('message')
            .setDescription('Test message')
            .setRequired(true)),

      new SlashCommandBuilder()
        .setName('health')
        .setDescription('System health check'),

      // Utility Commands
      new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show admin command help')
    ];
  }

  // Handle slash command interactions
  async handleSlashCommand(interaction) {
    // Check if user has admin access
    if (!hasAdminAccess(interaction.member)) {
      await interaction.reply({
        content: '❌ **Access Denied**\nYou need administrator permissions to use admin commands.',
        ephemeral: true
      });
      return;
    }

    // Check if command is in admin channel (for non-ephemeral commands)
    const isAdminChannel = getChannelType(interaction.channel.name) === 'admin';
    const commandName = interaction.commandName;

    try {
      switch (commandName) {
        case 'setmodel':
          await this.handleSetModel(interaction);
          break;
        case 'setprompt':
          await this.handleSetPrompt(interaction);
          break;
        case 'settemp':
          await this.handleSetTemperature(interaction);
          break;
        case 'showconfig':
          await this.handleShowConfig(interaction);
          break;
        case 'models':
          await this.handleListModels(interaction);
          break;
        case 'stats':
          await this.handleStats(interaction);
          break;
        case 'backup':
          await this.handleBackup(interaction);
          break;
        case 'restore':
          await this.handleRestore(interaction);
          break;
        case 'resetmemory':
          await this.handleResetMemory(interaction);
          break;
        case 'showmemory':
          await this.handleShowMemory(interaction);
          break;
        case 'patterns':
          await this.handlePatterns(interaction);
          break;
        case 'test':
          await this.handleTest(interaction);
          break;
        case 'health':
          await this.handleHealth(interaction);
          break;
        case 'help':
          await this.handleHelp(interaction);
          break;
        default:
          await interaction.reply({
            content: '❓ Unknown command. Use `/help` for available commands.',
            ephemeral: true
          });
      }
    } catch (error) {
      logger.error(`Error handling slash command ${commandName}:`, error);
      
      const errorReply = {
        content: `⚠️ **Error**\nFailed to execute command: ${error.message}`,
        ephemeral: true
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorReply);
      } else {
        await interaction.reply(errorReply);
      }
    }
  }

  // Handle message-based commands (legacy support)
  async handleMessageCommand(message) {
    const content = message.content.toLowerCase();
    const args = content.split(' ').slice(1);

    // Check admin access and channel
    if (!hasAdminAccess(message.member)) {
      await message.reply('❌ **Access Denied**\nYou need administrator permissions to use admin commands.');
      return;
    }

    const isAdminChannel = getChannelType(message.channel.name) === 'admin';
    if (!isAdminChannel && !content.startsWith('!help')) {
      await message.reply('⚠️ **Wrong Channel**\nAdmin commands can only be used in the #admin channel.');
      return;
    }

    try {
      if (content.startsWith('!setmodel')) {
        await this.handleSetModelMessage(message, args);
      } else if (content.startsWith('!setprompt')) {
        await this.handleSetPromptMessage(message, args);
      } else if (content.startsWith('!settemp')) {
        await this.handleSetTempMessage(message, args);
      } else if (content.startsWith('!showconfig')) {
        await this.handleShowConfigMessage(message, args);
      } else if (content.startsWith('!models')) {
        await this.handleListModelsMessage(message);
      } else if (content.startsWith('!stats')) {
        await this.handleStatsMessage(message);
      } else if (content.startsWith('!backup')) {
        await this.handleBackupMessage(message);
      } else if (content.startsWith('!resetmemory')) {
        await this.handleResetMemoryMessage(message, args);
      } else if (content.startsWith('!showmemory')) {
        await this.handleShowMemoryMessage(message);
      } else if (content.startsWith('!patterns')) {
        await this.handlePatternsMessage(message, args);
      } else if (content.startsWith('!test')) {
        await this.handleTestMessage(message, args);
      } else if (content.startsWith('!health')) {
        await this.handleHealthMessage(message);
      } else if (content.startsWith('!help')) {
        await this.handleHelpMessage(message);
      } else {
        await message.reply('❓ Unknown command. Use `!help` for available commands.');
      }
    } catch (error) {
      logger.error(`Error handling message command:`, error);
      await message.reply(`⚠️ **Error**\nFailed to execute command: ${error.message}`);
    }
  }

  // Channel Management Commands
  async handleSetModel(interaction) {
    const channel = interaction.options.getChannel('channel');
    const model = interaction.options.getString('model');
    
    const channelType = getChannelType(channel.name);
    const guildId = interaction.guild.id;

    if (model === 'custom') {
      await interaction.reply({
        content: '📝 **Custom Model**\nPlease specify the custom model name using the message command:\n`!setmodel #' + channel.name + ' your-custom-model`',
        ephemeral: true
      });
      return;
    }

    const updates = { 'llmConfig.model': model };
    const success = await this.llmService.updateChannelConfig(channelType, updates, guildId);

    const embed = new EmbedBuilder()
      .setColor(success ? 0x00ff00 : 0xff0000)
      .setTitle(success ? '✅ Model Updated' : '❌ Update Failed')
      .addFields(
        { name: 'Channel', value: `${channel}`, inline: true },
        { name: 'Model', value: model, inline: true },
        { name: 'Status', value: success ? 'Success' : 'Failed', inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  async handleSetPrompt(interaction) {
    const channel = interaction.options.getChannel('channel');
    const prompt = interaction.options.getString('prompt');
    
    const channelType = getChannelType(channel.name);
    const guildId = interaction.guild.id;

    const updates = { 'llmConfig.systemPrompt': prompt };
    const success = await this.llmService.updateChannelConfig(channelType, updates, guildId);

    const embed = new EmbedBuilder()
      .setColor(success ? 0x00ff00 : 0xff0000)
      .setTitle(success ? '✅ Prompt Updated' : '❌ Update Failed')
      .addFields(
        { name: 'Channel', value: `${channel}`, inline: true },
        { name: 'Prompt Length', value: `${prompt.length} characters`, inline: true },
        { name: 'Status', value: success ? 'Success' : 'Failed', inline: true }
      )
      .setDescription(success ? `Prompt preview: ${prompt.substring(0, 200)}...` : 'Failed to update prompt')
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  async handleSetTemperature(interaction) {
    const channel = interaction.options.getChannel('channel');
    const temperature = interaction.options.getNumber('temperature');
    
    const channelType = getChannelType(channel.name);
    const guildId = interaction.guild.id;

    const updates = { 'llmConfig.temperature': temperature };
    const success = await this.llmService.updateChannelConfig(channelType, updates, guildId);

    const embed = new EmbedBuilder()
      .setColor(success ? 0x00ff00 : 0xff0000)
      .setTitle(success ? '✅ Temperature Updated' : '❌ Update Failed')
      .addFields(
        { name: 'Channel', value: `${channel}`, inline: true },
        { name: 'Temperature', value: temperature.toString(), inline: true },
        { name: 'Status', value: success ? 'Success' : 'Failed', inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  async handleShowConfig(interaction) {
    const channel = interaction.options.getChannel('channel');
    const channelType = getChannelType(channel.name);
    const guildId = interaction.guild.id;

    const config = await this.llmService.getChannelConfig(channelType, guildId);

    if (!config) {
      await interaction.reply({
        content: `❌ **No Configuration Found**\nNo configuration found for channel ${channel}`,
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`⚙️ Configuration for ${channel}`)
      .addFields(
        { name: 'Channel Type', value: channelType, inline: true },
        { name: 'Provider', value: config.llmConfig.provider, inline: true },
        { name: 'Model', value: config.llmConfig.model, inline: true },
        { name: 'Temperature', value: config.llmConfig.temperature.toString(), inline: true },
        { name: 'Max Tokens', value: config.llmConfig.maxTokens.toString(), inline: true },
        { name: 'Active', value: config.isActive ? '✅' : '❌', inline: true }
      )
      .setDescription(`**System Prompt Preview:**\n${config.llmConfig.systemPrompt.substring(0, 300)}...`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  // System Management Commands
  async handleListModels(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('🤖 Available Models and Providers')
      .addFields(
        {
          name: '🔵 OpenAI Models',
          value: '• `gpt-4` - Most capable, best for complex tasks\n• `gpt-4-turbo` - Faster GPT-4 variant\n• `gpt-3.5-turbo` - Fast and efficient',
          inline: false
        },
        {
          name: '🟣 Anthropic Models',
          value: '• `claude-3-opus` - Most capable Claude model\n• `claude-3-sonnet` - Balanced performance\n• `claude-3-haiku` - Fast responses',
          inline: false
        },
        {
          name: '🟠 Ollama Models (Local)',
          value: '• `llama3:70b` - Large Llama 3 model\n• `llama3:8b` - Smaller Llama 3 model\n• `codellama` - Code-specialized model',
          inline: false
        },
        {
          name: '💡 Usage Tips',
          value: '• Use GPT-4 for coding and analysis\n• Use GPT-3.5-turbo for general chat\n• Local models for privacy-sensitive work',
          inline: false
        }
      )
      .setFooter({ text: 'Use /setmodel to change models for channels' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  async handleStats(interaction) {
    await interaction.deferReply();

    const guildId = interaction.guild.id;
    const memoryStats = await this.memoryService.getStats();
    const channelConfigs = await this.llmService.getAllChannelConfigs(guildId);

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📊 System Statistics')
      .addFields(
        {
          name: '💾 Memory Usage',
          value: memoryStats,
          inline: false
        },
        {
          name: '⚙️ Channel Configurations',
          value: channelConfigs.length > 0 
            ? channelConfigs.map(config => 
                `**${config.channelType}**: ${config.llmConfig.provider}/${config.llmConfig.model}`
              ).join('\n')
            : 'No configurations found',
          inline: false
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  async handleBackup(interaction) {
    await interaction.deferReply();

    const guildId = interaction.guild.id;
    const exportData = await this.channelConfigService.exportConfigurations(guildId);
    const jsonString = JSON.stringify(exportData, null, 2);
    
    const filename = `bot-config-backup-${guildId}-${Date.now()}.json`;
    const buffer = Buffer.from(jsonString, 'utf8');

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('📤 Configuration Backup')
      .setDescription('Your bot configuration has been exported successfully.')
      .addFields(
        { name: 'Guild', value: interaction.guild.name, inline: true },
        { name: 'Export Date', value: new Date().toISOString(), inline: true },
        { name: 'File Size', value: `${Math.round(buffer.length / 1024)} KB`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({
      embeds: [embed],
      files: [{
        attachment: buffer,
        name: filename
      }]
    });
  }

  async handleRestore(interaction) {
    const file = interaction.options.getAttachment('file');
    
    if (!file.name.endsWith('.json')) {
      await interaction.reply({
        content: '❌ **Invalid File**\nPlease upload a JSON configuration file.',
        ephemeral: true
      });
      return;
    }

    // Create confirmation prompt for destructive operation
    const confirmationId = `restore_${Date.now()}`;
    const confirmButton = new ButtonBuilder()
      .setCustomId(`confirm_${confirmationId}`)
      .setLabel('Confirm Restore')
      .setStyle(ButtonStyle.Danger);
    
    const cancelButton = new ButtonBuilder()
      .setCustomId(`cancel_${confirmationId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    const embed = new EmbedBuilder()
      .setColor(0xffaa00)
      .setTitle('⚠️ Confirm Configuration Restore')
      .setDescription('**This operation will:**\n• Replace ALL current channel configurations\n• Cannot be undone\n• May affect bot behavior immediately')
      .addFields(
        { name: 'File', value: file.name, inline: true },
        { name: 'Size', value: `${Math.round(file.size / 1024)} KB`, inline: true }
      )
      .setFooter({ text: 'This confirmation expires in 30 seconds' });

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });

    // Store the file URL for confirmation handler
    this.pendingConfirmations.set(confirmationId, {
      type: 'restore',
      fileUrl: file.url,
      guildId: interaction.guild.id,
      userId: interaction.user.id,
      expires: Date.now() + this.confirmationTimeout
    });

    // Auto-cleanup after timeout
    setTimeout(() => {
      this.pendingConfirmations.delete(confirmationId);
    }, this.confirmationTimeout);
  }

  // Memory Management Commands
  async handleResetMemory(interaction) {
    const channel = interaction.options.getChannel('channel');
    const channelType = getChannelType(channel.name);

    // Create confirmation prompt for destructive operation
    const confirmationId = `resetmemory_${Date.now()}`;
    const confirmButton = new ButtonBuilder()
      .setCustomId(`confirm_${confirmationId}`)
      .setLabel('Confirm Reset')
      .setStyle(ButtonStyle.Danger);
    
    const cancelButton = new ButtonBuilder()
      .setCustomId(`cancel_${confirmationId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    const embed = new EmbedBuilder()
      .setColor(0xffaa00)
      .setTitle('⚠️ Confirm Memory Reset')
      .setDescription('**This operation will:**\n• Delete ALL memory data for this channel\n• Remove conversation history and patterns\n• Cannot be undone')
      .addFields(
        { name: 'Channel', value: `${channel}`, inline: true },
        { name: 'Type', value: channelType, inline: true }
      )
      .setFooter({ text: 'This confirmation expires in 30 seconds' });

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });

    this.pendingConfirmations.set(confirmationId, {
      type: 'resetmemory',
      channelType,
      channelName: channel.name,
      guildId: interaction.guild.id,
      userId: interaction.user.id,
      expires: Date.now() + this.confirmationTimeout
    });

    setTimeout(() => {
      this.pendingConfirmations.delete(confirmationId);
    }, this.confirmationTimeout);
  }

  async handleShowMemory(interaction) {
    await interaction.deferReply();

    const memoryStats = await this.memoryService.getStats();
    const guildId = interaction.guild.id;

    // Get recent activity summary
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    try {
      const recentInteractions = await this.memoryService.discordLogs
        .find({ 
          timestamp: { $gte: cutoffDate }
        })
        .sort({ timestamp: -1 })
        .limit(10)
        .toArray();

      const channelActivity = {};
      recentInteractions.forEach(interaction => {
        channelActivity[interaction.channel] = (channelActivity[interaction.channel] || 0) + 1;
      });

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('🧠 Memory System Status')
        .addFields(
          {
            name: '📊 Overall Statistics',
            value: memoryStats,
            inline: false
          },
          {
            name: '📈 Recent Activity (7 days)',
            value: Object.entries(channelActivity).length > 0
              ? Object.entries(channelActivity)
                  .sort(([,a], [,b]) => b - a)
                  .map(([channel, count]) => `**#${channel}**: ${count} interactions`)
                  .join('\n')
              : 'No recent activity',
            inline: false
          }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('Error getting memory overview:', error);
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Memory System Error')
        .setDescription('Failed to retrieve memory statistics')
        .addFields(
          { name: 'Error', value: error.message, inline: false }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  }

  async handlePatterns(interaction) {
    await interaction.deferReply();

    const user = interaction.options.getUser('user');
    const targetUserId = user?.id || interaction.user.id;
    const guildId = interaction.guild.id;

    try {
      const patterns = await this.memoryService.getTechnicalDiscordPatterns(
        targetUserId, 
        new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days
        null
      );

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`🔍 Behavioral Patterns${user ? ` for ${user.displayName}` : ''}`)
        .addFields(
          {
            name: '💬 Activity Summary',
            value: `Total Interactions: ${patterns.totalInteractions}\nMost Active Channel: #${patterns.mostActiveChannel}`,
            inline: false
          }
        );

      if (patterns.preferredLanguages?.length > 0) {
        embed.addFields({
          name: '💻 Programming Languages',
          value: patterns.preferredLanguages.slice(0, 5).join(', '),
          inline: true
        });
      }

      if (patterns.preferredFrameworks?.length > 0) {
        embed.addFields({
          name: '🛠️ Frameworks & Tools',
          value: patterns.preferredFrameworks.slice(0, 5).join(', '),
          inline: true
        });
      }

      if (patterns.questionTypes && Object.keys(patterns.questionTypes).length > 0) {
        const topQuestions = Object.entries(patterns.questionTypes)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([type, count]) => `${type.replace('-', ' ')}: ${count}`)
          .join('\n');

        embed.addFields({
          name: '❓ Question Patterns',
          value: topQuestions,
          inline: false
        });
      }

      if (patterns.complexityDistribution) {
        const total = Object.values(patterns.complexityDistribution).reduce((a, b) => a + b, 0);
        if (total > 0) {
          const complexity = Object.entries(patterns.complexityDistribution)
            .map(([level, count]) => `${level}: ${Math.round((count/total)*100)}%`)
            .join('\n');

          embed.addFields({
            name: '🎯 Complexity Distribution',
            value: complexity,
            inline: true
          });
        }
      }

      embed.setTimestamp();
      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error getting patterns:', error);
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Pattern Analysis Error')
        .setDescription('Failed to retrieve behavioral patterns')
        .addFields(
          { name: 'Error', value: error.message, inline: false }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  }

  // Testing Commands
  async handleTest(interaction) {
    await interaction.deferReply();

    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');
    const channelType = getChannelType(channel.name);
    const guildId = interaction.guild.id;

    try {
      // Test the channel configuration
      const startTime = Date.now();
      const result = await this.llmService.testConnection(channelType, guildId);
      const responseTime = Date.now() - startTime;

      let embed;
      
      if (result.success) {
        // If connection successful, try generating a response
        try {
          const testContext = {
            message,
            channelType,
            guildId,
            username: interaction.user.displayName,
            memoryContext: { summary: 'Test mode - no historical context' }
          };

          const response = await this.llmService.generateResponse(testContext);
          
          embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('✅ Channel Test Successful')
            .addFields(
              { name: 'Channel', value: `${channel}`, inline: true },
              { name: 'Model', value: `${result.provider}/${result.model}`, inline: true },
              { name: 'Response Time', value: `${responseTime}ms`, inline: true },
              { name: 'Test Message', value: message, inline: false },
              { name: 'AI Response', value: response.length > 1000 ? response.substring(0, 1000) + '...' : response, inline: false }
            );
        } catch (responseError) {
          embed = new EmbedBuilder()
            .setColor(0xffaa00)
            .setTitle('⚠️ Partial Test Success')
            .setDescription('Connection successful but response generation failed')
            .addFields(
              { name: 'Channel', value: `${channel}`, inline: true },
              { name: 'Model', value: `${result.provider}/${result.model}`, inline: true },
              { name: 'Connection Time', value: `${responseTime}ms`, inline: true },
              { name: 'Error', value: responseError.message, inline: false }
            );
        }
      } else {
        embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Channel Test Failed')
          .addFields(
            { name: 'Channel', value: `${channel}`, inline: true },
            { name: 'Channel Type', value: channelType, inline: true },
            { name: 'Response Time', value: `${responseTime}ms`, inline: true },
            { name: 'Error', value: result.error, inline: false }
          );
      }

      embed.setTimestamp();
      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.error('Error testing channel:', error);
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Test Error')
        .setDescription('Failed to test channel configuration')
        .addFields(
          { name: 'Channel', value: `${channel}`, inline: true },
          { name: 'Error', value: error.message, inline: false }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }
  }

  async handleHealth(interaction) {
    await interaction.deferReply();

    const healthChecks = {
      database: false,
      llmService: false,
      channelConfig: false,
      memoryService: false
    };

    const startTime = Date.now();

    try {
      // Test database connection
      await this.memoryService.initialize();
      healthChecks.database = true;
    } catch (error) {
      logger.error('Database health check failed:', error);
    }

    try {
      // Test LLM service
      const testResult = await this.llmService.testConnection('general');
      healthChecks.llmService = testResult.success;
    } catch (error) {
      logger.error('LLM service health check failed:', error);
    }

    try {
      // Test channel config service
      await this.channelConfigService.initialize();
      const configs = await this.channelConfigService.getAllChannelConfigs();
      healthChecks.channelConfig = configs.length > 0;
    } catch (error) {
      logger.error('Channel config health check failed:', error);
    }

    try {
      // Test memory service
      const stats = await this.memoryService.getStats();
      healthChecks.memoryService = !!stats;
    } catch (error) {
      logger.error('Memory service health check failed:', error);
    }

    const totalTime = Date.now() - startTime;
    const overallHealth = Object.values(healthChecks).every(check => check);

    const embed = new EmbedBuilder()
      .setColor(overallHealth ? 0x00ff00 : 0xff0000)
      .setTitle(`${overallHealth ? '✅' : '❌'} System Health Check`)
      .addFields(
        { name: '💾 Database', value: healthChecks.database ? '✅ Connected' : '❌ Failed', inline: true },
        { name: '🤖 LLM Service', value: healthChecks.llmService ? '✅ Working' : '❌ Failed', inline: true },
        { name: '⚙️ Channel Config', value: healthChecks.channelConfig ? '✅ Loaded' : '❌ Failed', inline: true },
        { name: '🧠 Memory Service', value: healthChecks.memoryService ? '✅ Working' : '❌ Failed', inline: true },
        { name: '⏱️ Check Duration', value: `${totalTime}ms`, inline: true },
        { name: '📊 Overall Status', value: overallHealth ? '🟢 Healthy' : '🔴 Issues Detected', inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  async handleHelp(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('🔧 Admin Command Help')
      .setDescription('Comprehensive bot administration commands')
      .addFields(
        {
          name: '⚙️ Channel Management',
          value: '• `/setmodel` - Change LLM model for channel\n• `/setprompt` - Update system prompt\n• `/settemp` - Adjust temperature\n• `/showconfig` - Display configuration',
          inline: false
        },
        {
          name: '🎛️ System Management',
          value: '• `/models` - List available models\n• `/stats` - Show usage statistics\n• `/backup` - Export configurations\n• `/restore` - Import configurations',
          inline: false
        },
        {
          name: '🧠 Memory Management',
          value: '• `/resetmemory` - Clear channel memory (destructive)\n• `/showmemory` - Display memory status\n• `/patterns` - Show behavioral patterns',
          inline: false
        },
        {
          name: '🔍 Testing & Diagnostics',
          value: '• `/test` - Test channel configuration\n• `/health` - System health check',
          inline: false
        },
        {
          name: '💡 Usage Notes',
          value: '• Destructive operations require confirmation\n• Use #admin channel for most commands\n• Slash commands preferred over message commands',
          inline: false
        }
      )
      .setFooter({ text: 'Admin commands require administrator permissions' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // Button interaction handler for confirmations
  async handleButtonInteraction(interaction) {
    const customId = interaction.customId;
    
    if (customId.startsWith('confirm_')) {
      const confirmationId = customId.replace('confirm_', '');
      const confirmation = this.pendingConfirmations.get(confirmationId);
      
      if (!confirmation) {
        await interaction.reply({
          content: '❌ **Confirmation Expired**\nThis confirmation has expired. Please try the command again.',
          ephemeral: true
        });
        return;
      }

      if (confirmation.userId !== interaction.user.id) {
        await interaction.reply({
          content: '❌ **Access Denied**\nOnly the user who initiated this command can confirm it.',
          ephemeral: true
        });
        return;
      }

      // Handle different confirmation types
      switch (confirmation.type) {
        case 'restore':
          await this.executeRestore(interaction, confirmation);
          break;
        case 'resetmemory':
          await this.executeResetMemory(interaction, confirmation);
          break;
      }

      this.pendingConfirmations.delete(confirmationId);

    } else if (customId.startsWith('cancel_')) {
      const confirmationId = customId.replace('cancel_', '');
      this.pendingConfirmations.delete(confirmationId);
      
      await interaction.update({
        embeds: [new EmbedBuilder()
          .setColor(0x808080)
          .setTitle('❌ Operation Cancelled')
          .setDescription('The operation has been cancelled.')
          .setTimestamp()],
        components: []
      });
    }
  }

  async executeRestore(interaction, confirmation) {
    await interaction.deferUpdate();

    try {
      // Fetch the configuration file
      const response = await fetch(confirmation.fileUrl);
      const configData = await response.json();

      // Import the configuration
      const success = await this.channelConfigService.importConfigurations(configData, confirmation.guildId);

      const embed = new EmbedBuilder()
        .setColor(success ? 0x00ff00 : 0xff0000)
        .setTitle(success ? '✅ Configuration Restored' : '❌ Restore Failed')
        .setDescription(success 
          ? 'Configuration has been successfully restored. Changes are effective immediately.'
          : 'Failed to restore configuration. Please check the file format and try again.')
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed],
        components: []
      });

    } catch (error) {
      logger.error('Error executing restore:', error);
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Restore Error')
        .setDescription(`Failed to restore configuration: ${error.message}`)
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed],
        components: []
      });
    }
  }

  async executeResetMemory(interaction, confirmation) {
    await interaction.deferUpdate();

    try {
      // Reset memory for the specified channel
      await this.memoryService.discordLogs.deleteMany({
        channel: confirmation.channelType
      });

      await this.memoryService.projectContexts.deleteMany({
        // Remove projects that were primarily discussed in this channel
      });

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Memory Reset Complete')
        .setDescription(`Memory data for #${confirmation.channelName} has been cleared.`)
        .addFields(
          { name: 'Channel', value: `#${confirmation.channelName}`, inline: true },
          { name: 'Type', value: confirmation.channelType, inline: true }
        )
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed],
        components: []
      });

    } catch (error) {
      logger.error('Error executing memory reset:', error);
      
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Memory Reset Error')
        .setDescription(`Failed to reset memory: ${error.message}`)
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed],
        components: []
      });
    }
  }

  // Message-based command handlers (legacy support)
  async handleSetModelMessage(message, args) {
    if (args.length < 2) {
      await message.reply('❓ Usage: `!setmodel #channel modelname`');
      return;
    }

    const channelMention = args[0];
    const model = args[1];
    
    // Parse channel mention
    const channelId = channelMention.replace(/[<>#]/g, '');
    const channel = message.guild.channels.cache.get(channelId);
    
    if (!channel) {
      await message.reply('❌ Invalid channel. Please mention a valid channel.');
      return;
    }

    const channelType = getChannelType(channel.name);
    const guildId = message.guild.id;

    const updates = { 'llmConfig.model': model };
    const success = await this.llmService.updateChannelConfig(channelType, updates, guildId);

    await message.reply(success 
      ? `✅ Model updated to \`${model}\` for ${channel}`
      : `❌ Failed to update model for ${channel}`);
  }

  async handleSetPromptMessage(message, args) {
    if (args.length < 2) {
      await message.reply('❓ Usage: `!setprompt #channel "new prompt"`');
      return;
    }

    const channelMention = args[0];
    const prompt = args.slice(1).join(' ').replace(/["""]/g, '"');
    
    const channelId = channelMention.replace(/[<>#]/g, '');
    const channel = message.guild.channels.cache.get(channelId);
    
    if (!channel) {
      await message.reply('❌ Invalid channel. Please mention a valid channel.');
      return;
    }

    const channelType = getChannelType(channel.name);
    const guildId = message.guild.id;

    const updates = { 'llmConfig.systemPrompt': prompt };
    const success = await this.llmService.updateChannelConfig(channelType, updates, guildId);

    await message.reply(success 
      ? `✅ System prompt updated for ${channel} (${prompt.length} characters)`
      : `❌ Failed to update prompt for ${channel}`);
  }

  async handleSetTempMessage(message, args) {
    if (args.length < 2) {
      await message.reply('❓ Usage: `!settemp #channel 0.7`');
      return;
    }

    const channelMention = args[0];
    const temperature = parseFloat(args[1]);
    
    if (isNaN(temperature) || temperature < 0 || temperature > 2) {
      await message.reply('❌ Temperature must be a number between 0.0 and 2.0');
      return;
    }

    const channelId = channelMention.replace(/[<>#]/g, '');
    const channel = message.guild.channels.cache.get(channelId);
    
    if (!channel) {
      await message.reply('❌ Invalid channel. Please mention a valid channel.');
      return;
    }

    const channelType = getChannelType(channel.name);
    const guildId = message.guild.id;

    const updates = { 'llmConfig.temperature': temperature };
    const success = await this.llmService.updateChannelConfig(channelType, updates, guildId);

    await message.reply(success 
      ? `✅ Temperature set to \`${temperature}\` for ${channel}`
      : `❌ Failed to update temperature for ${channel}`);
  }

  async handleShowConfigMessage(message, args) {
    if (args.length < 1) {
      await message.reply('❓ Usage: `!showconfig #channel`');
      return;
    }

    const channelMention = args[0];
    const channelId = channelMention.replace(/[<>#]/g, '');
    const channel = message.guild.channels.cache.get(channelId);
    
    if (!channel) {
      await message.reply('❌ Invalid channel. Please mention a valid channel.');
      return;
    }

    const channelType = getChannelType(channel.name);
    const guildId = message.guild.id;
    const config = await this.llmService.getChannelConfig(channelType, guildId);

    if (!config) {
      await message.reply(`❌ No configuration found for ${channel}`);
      return;
    }

    await message.reply(`**Configuration for ${channel}**\n\`\`\`json\n${JSON.stringify({
      channelType,
      provider: config.llmConfig.provider,
      model: config.llmConfig.model,
      temperature: config.llmConfig.temperature,
      maxTokens: config.llmConfig.maxTokens,
      isActive: config.isActive
    }, null, 2)}\n\`\`\``);
  }

  async handleListModelsMessage(message) {
    const modelList = `**🤖 Available Models and Providers**

**🔵 OpenAI Models:**
• \`gpt-4\` - Most capable, best for complex tasks
• \`gpt-4-turbo\` - Faster GPT-4 variant  
• \`gpt-3.5-turbo\` - Fast and efficient

**🟣 Anthropic Models:**
• \`claude-3-opus\` - Most capable Claude model
• \`claude-3-sonnet\` - Balanced performance
• \`claude-3-haiku\` - Fast responses

**🟠 Ollama Models (Local):**
• \`llama3:70b\` - Large Llama 3 model
• \`llama3:8b\` - Smaller Llama 3 model
• \`codellama\` - Code-specialized model

**💡 Usage Tips:**
• Use GPT-4 for coding and analysis
• Use GPT-3.5-turbo for general chat
• Local models for privacy-sensitive work`;

    await message.reply(modelList);
  }

  async handleStatsMessage(message) {
    const guildId = message.guild.id;
    const memoryStats = await this.memoryService.getStats();
    const channelConfigs = await this.llmService.getAllChannelConfigs(guildId);

    const configSummary = channelConfigs.length > 0 
      ? channelConfigs.map(config => 
          `**${config.channelType}**: ${config.llmConfig.provider}/${config.llmConfig.model}`
        ).join('\n')
      : 'No configurations found';

    await message.reply(`**📊 System Statistics**

**💾 Memory Usage:**
\`\`\`
${memoryStats}
\`\`\`

**⚙️ Channel Configurations:**
${configSummary}`);
  }

  async handleBackupMessage(message) {
    const guildId = message.guild.id;
    const exportData = await this.channelConfigService.exportConfigurations(guildId);
    const jsonString = JSON.stringify(exportData, null, 2);
    
    const filename = `bot-config-backup-${guildId}-${Date.now()}.json`;
    const buffer = Buffer.from(jsonString, 'utf8');

    await message.reply({
      content: `📤 **Configuration Backup**\nYour bot configuration has been exported successfully.`,
      files: [{
        attachment: buffer,
        name: filename
      }]
    });
  }

  async handleResetMemoryMessage(message, args) {
    await message.reply('⚠️ **Use Slash Command**\nFor destructive operations like memory reset, please use the slash command `/resetmemory` for better safety and confirmation prompts.');
  }

  async handleShowMemoryMessage(message) {
    const memoryStats = await this.memoryService.getStats();
    await message.reply(`**🧠 Memory System Status**\n\`\`\`\n${memoryStats}\n\`\`\``);
  }

  async handlePatternsMessage(message, args) {
    await message.reply('💡 **Use Slash Command**\nFor detailed pattern analysis, please use the slash command `/patterns` for better formatting and user selection options.');
  }

  async handleTestMessage(message, args) {
    if (args.length < 2) {
      await message.reply('❓ Usage: `!test #channel "test message"`');
      return;
    }

    const channelMention = args[0];
    const testMessage = args.slice(1).join(' ').replace(/["""]/g, '"');
    
    const channelId = channelMention.replace(/[<>#]/g, '');
    const channel = message.guild.channels.cache.get(channelId);
    
    if (!channel) {
      await message.reply('❌ Invalid channel. Please mention a valid channel.');
      return;
    }

    const channelType = getChannelType(channel.name);
    const guildId = message.guild.id;

    try {
      const result = await this.llmService.testConnection(channelType, guildId);
      
      if (result.success) {
        await message.reply(`✅ **Test Successful**\nChannel: ${channel}\nModel: ${result.provider}/${result.model}\nConnection: Working`);
      } else {
        await message.reply(`❌ **Test Failed**\nChannel: ${channel}\nError: ${result.error}`);
      }
    } catch (error) {
      await message.reply(`❌ **Test Error**\nFailed to test ${channel}: ${error.message}`);
    }
  }

  async handleHealthMessage(message) {
    await message.reply('🔍 **Running Health Check...**');
    
    // Use a simplified health check for message commands
    try {
      const memoryStats = await this.memoryService.getStats();
      const testResult = await this.llmService.testConnection('general');
      
      const status = testResult.success ? '🟢 System Healthy' : '🔴 Issues Detected';
      await message.reply(`**${status}**\n\nMemory Service: ✅\nLLM Service: ${testResult.success ? '✅' : '❌'}\n\nFor detailed health check, use \`/health\` slash command.`);
    } catch (error) {
      await message.reply(`❌ **Health Check Failed**\nError: ${error.message}`);
    }
  }

  async handleHelpMessage(message) {
    const helpText = `**🔧 Admin Commands Help**

**⚙️ Channel Management:**
• \`!setmodel #channel modelname\` - Change LLM model
• \`!setprompt #channel "prompt"\` - Update system prompt  
• \`!settemp #channel 0.7\` - Adjust temperature
• \`!showconfig #channel\` - Display configuration

**🎛️ System Management:**
• \`!models\` - List available models
• \`!stats\` - Show usage statistics
• \`!backup\` - Export configurations
• \`!health\` - Quick health check

**🔍 Testing:**
• \`!test #channel "message"\` - Test configuration

**💡 Tips:**
• Use slash commands (/) for advanced features
• Destructive operations require slash commands
• Admin permissions required for all commands`;

    await message.reply(helpText);
  }
}