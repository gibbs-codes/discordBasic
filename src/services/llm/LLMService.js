// src/services/llm/LLMService.js - Enhanced LLM with Dynamic Channel Configuration
import { OpenAIProvider } from './OpenAIProvider.js';
import { OllamaProvider } from './OllamaProvider.js';
import { getSystemPrompts, getChannelConfig } from './prompts.js';
import { ChannelConfigService } from '../ChannelConfigService.js';
import { logger } from '../../utils/logger.js';

export class LLMService {
  constructor() {
    this.providers = new Map(); // Cache providers by configuration
    this.channelConfigService = new ChannelConfigService();
    this.defaultProvider = this.initializeDefaultProvider();
  }

  initializeDefaultProvider() {
    const providerType = process.env.LLM_PROVIDER || 'openai';
    
    if (providerType === 'openai') {
      return new OpenAIProvider({
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.LLM_MODEL || 'gpt-4'
      });
    } else if (providerType === 'ollama') {
      return new OllamaProvider({
        url: process.env.OLLAMA_URL || 'http://localhost:11434',
        model: process.env.LLM_MODEL || 'llama2'
      });
    } else {
      throw new Error(`Unsupported LLM provider: ${providerType}`);
    }
  }

  // Get or create provider for specific configuration
  async getProviderForChannel(channelType, guildId = null) {
    const llmConfig = await this.channelConfigService.getLLMConfig(channelType, guildId);
    const configKey = `${llmConfig.provider}_${llmConfig.model}`;
    
    // Return cached provider if available
    if (this.providers.has(configKey)) {
      return this.providers.get(configKey);
    }
    
    // Create new provider based on configuration
    let provider;
    
    try {
      if (llmConfig.provider === 'openai') {
        provider = new OpenAIProvider({
          apiKey: process.env.OPENAI_API_KEY,
          model: llmConfig.model
        });
      } else if (llmConfig.provider === 'ollama') {
        provider = new OllamaProvider({
          url: process.env.OLLAMA_URL || 'http://localhost:11434',
          model: llmConfig.model
        });
      } else if (llmConfig.provider === 'anthropic') {
        // Add Anthropic provider support if needed
        throw new Error('Anthropic provider not yet implemented');
      } else {
        logger.warn(`Unknown provider ${llmConfig.provider}, falling back to default`);
        provider = this.defaultProvider;
      }
      
      // Cache the provider
      this.providers.set(configKey, provider);
      return provider;
      
    } catch (error) {
      logger.error(`Error creating provider for ${channelType}:`, error);
      return this.defaultProvider;
    }
  }

  async generateResponse(context) {
    try {
      const provider = await this.getProviderForChannel(context.channelType, context.guildId);
      const systemPrompt = await this.buildSystemPrompt(context);
      const userPrompt = this.buildUserPrompt(context);
      
      logger.info(`Generating response for ${context.channelType} channel using ${provider.constructor.name}`);
      
      const response = await provider.generateResponse(systemPrompt, userPrompt);
      
      return response.trim();
      
    } catch (error) {
      logger.error('LLM generation error:', error);
      return this.getFallbackResponse(context.channelType);
    }
  }

  // Get configuration for admin commands
  async getConfiguration(guildId = null) {
    const channelConfigs = await this.channelConfigService.getAllChannelConfigs(guildId);
    const stats = await this.channelConfigService.getConfigurationStats();
    
    return {
      defaultProvider: process.env.LLM_PROVIDER || 'openai',
      defaultModel: process.env.LLM_MODEL || 'gpt-4',
      channelConfigs: channelConfigs.map(config => ({
        channelType: config.channelType,
        name: config.name,
        provider: config.llmConfig.provider,
        model: config.llmConfig.model,
        temperature: config.llmConfig.temperature,
        isActive: config.isActive
      })),
      statistics: stats
    };
  }

  async buildSystemPrompt(context) {
    // Get channel-specific system prompt from configuration
    const llmConfig = await this.channelConfigService.getLLMConfig(context.channelType, context.guildId);
    const basePrompt = llmConfig.systemPrompt || getSystemPrompts()[context.channelType] || getSystemPrompts().general;
    
    // Add memory context to make the AI more aware of patterns
    if (context.memoryContext?.summary) {
      return `${basePrompt}\n\n**IMPORTANT MEMORY CONTEXT:**\n${context.memoryContext.summary}\n\nUse this context to understand user patterns, reference past interactions, and provide contextually relevant assistance. Be specific about their history when it helps provide better guidance.`;
    }
    
    return basePrompt;
  }

  buildUserPrompt(context) {
    let prompt = `User ${context.username} says: "${context.message}"`;
    
    // Add recent conversation context
    if (context.messageHistory?.length > 0) {
      const recentHistory = context.messageHistory
        .slice(-3)
        .filter(msg => !msg.isBot) // Only include user messages for context
        .map(msg => `${msg.author}: ${msg.content}`)
        .join('\n');
      
      if (recentHistory) {
        prompt += `\n\nRecent conversation:\n${recentHistory}`;
      }
    }
    
    // Add specific memory insights if available
    if (context.memoryContext) {
      const insights = this.extractKeyInsights(context.memoryContext);
      if (insights) {
        prompt += `\n\nKey behavioral insights: ${insights}`;
      }
    }
    
    return prompt;
  }


  extractKeyInsights(memoryContext) {
    const insights = [];
    
    // Programming language preferences
    if (memoryContext.discordPatterns?.preferredLanguages?.length > 0) {
      insights.push(`Uses ${memoryContext.discordPatterns.preferredLanguages.slice(0, 2).join(', ')}`);
    }
    
    // Framework preferences
    if (memoryContext.discordPatterns?.preferredFrameworks?.length > 0) {
      insights.push(`Works with ${memoryContext.discordPatterns.preferredFrameworks.slice(0, 2).join(', ')}`);
    }
    
    // Active projects
    if (memoryContext.projectContexts?.length > 0) {
      const activeProjects = memoryContext.projectContexts.slice(0, 2).map(p => p.name);
      insights.push(`Active projects: ${activeProjects.join(', ')}`);
    }
    
    // Skill development focus
    if (memoryContext.skillPatterns?.length > 0) {
      const topSkills = memoryContext.skillPatterns.slice(0, 2).map(s => s.name);
      insights.push(`Developing: ${topSkills.join(', ')}`);
    }
    
    // Question patterns
    if (memoryContext.discordPatterns?.questionTypes) {
      const topQuestionType = Object.entries(memoryContext.discordPatterns.questionTypes)
        .sort(([,a], [,b]) => b - a)[0]?.[0];
      if (topQuestionType && topQuestionType !== 'general') {
        insights.push(`Often asks about ${topQuestionType.replace('-', ' ')}`);
      }
    }
    
    // Complexity preference
    if (memoryContext.discordPatterns?.complexityDistribution) {
      const total = Object.values(memoryContext.discordPatterns.complexityDistribution).reduce((a, b) => a + b, 0);
      const complexRatio = memoryContext.discordPatterns.complexityDistribution.complex / total;
      if (complexRatio > 0.4) {
        insights.push('Prefers complex problems');
      }
    }
    
    // Working patterns
    if (memoryContext.workflowPatterns?.workingHours?.preferredWorkingTime) {
      insights.push(`${memoryContext.workflowPatterns.workingHours.preferredWorkingTime}`);
    }
    
    return insights.join(', ');
  }

  getFallbackResponse(channelType) {
    const fallbacks = {
      general: "⚠️ LLM service temporarily unavailable. Please try again in a moment.",
      coding: "🔧 Code analysis service is down. Please retry your request.",
      projects: "📋 Project planning service is temporarily unavailable.",
      planning: "📅 Planning assistance is temporarily down. Please try again.",
      analysis: "📊 Analysis service is currently unavailable.",
      admin: "⚙️ Admin functions are temporarily unavailable."
    };

    return fallbacks[channelType] || fallbacks.general;
  }

  async testConnection(channelType = 'general', guildId = null) {
    try {
      const provider = await this.getProviderForChannel(channelType, guildId);
      const llmConfig = await this.channelConfigService.getLLMConfig(channelType, guildId);
      
      const testResponse = await this.generateResponse({
        message: "Test connection",
        channelType,
        guildId,
        username: "System",
        memoryContext: { summary: "Test mode" }
      });
      
      logger.info(`✅ LLM connection successful for ${channelType} (${llmConfig.provider}/${llmConfig.model})`);
      return { success: true, provider: llmConfig.provider, model: llmConfig.model };
    } catch (error) {
      logger.error(`❌ LLM connection failed for ${channelType}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Update channel configuration
  async updateChannelConfig(channelType, updates, guildId = null) {
    try {
      const success = await this.channelConfigService.updateChannelConfig(channelType, updates, guildId);
      
      if (success) {
        // Clear provider cache to force recreation with new config
        this.providers.clear();
        logger.info(`✅ Updated LLM configuration for ${channelType}`);
      }
      
      return success;
    } catch (error) {
      logger.error(`Error updating channel config for ${channelType}:`, error);
      return false;
    }
  }

  // Get channel configuration
  async getChannelConfig(channelType, guildId = null) {
    return await this.channelConfigService.getChannelConfig(channelType, guildId);
  }

  // Get all channel configurations
  async getAllChannelConfigs(guildId = null) {
    return await this.channelConfigService.getAllChannelConfigs(guildId);
  }

  // Create guild-specific configuration
  async createGuildConfig(guildId, channelType, config) {
    return await this.channelConfigService.createGuildConfig(guildId, channelType, config);
  }
}