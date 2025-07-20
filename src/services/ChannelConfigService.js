// src/services/ChannelConfigService.js - Dynamic Channel Configuration Management
import { MongoClient } from 'mongodb';
import { logger } from '../utils/logger.js';
import { getMongoUri } from '../utils/mongoUri.js';

export class ChannelConfigService {
  constructor() {
    this.client = new MongoClient(getMongoUri());
    this.db = null;
    this.channelConfigs = null;
    this.initialized = false;
    this.configCache = new Map();
    this.lastCacheUpdate = 0;
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      await this.client.connect();
      this.db = this.client.db('local_coaches');
      this.channelConfigs = this.db.collection('channel_configurations');
      
      // Create indexes for efficient queries
      await this.channelConfigs.createIndex({ 'channelType': 1 });
      await this.channelConfigs.createIndex({ 'guildId': 1, 'channelType': 1 });
      
      // Initialize with default configurations if empty
      await this.initializeDefaultConfigurations();
      
      logger.info('✅ ChannelConfigService initialized');
      this.initialized = true;
    } catch (error) {
      logger.error('❌ Failed to initialize ChannelConfigService:', error);
      throw error;
    }
  }

  async initializeDefaultConfigurations() {
    const existingConfigs = await this.channelConfigs.countDocuments();
    
    if (existingConfigs === 0) {
      logger.info('📝 Creating default channel configurations');
      await this.createDefaultConfigurations();
    }
  }

  async createDefaultConfigurations() {
    const defaultConfigs = [
      {
        channelType: 'coding',
        name: 'Software Development',
        description: 'Programming help, code reviews, and technical guidance',
        llmConfig: {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.3,
          maxTokens: 4000,
          systemPrompt: `You are a senior software engineer providing expert coding assistance and technical guidance. You excel at:

- Code review and optimization suggestions
- Debugging and troubleshooting complex issues
- Architecture and design pattern recommendations
- Security best practices and vulnerability analysis
- Performance optimization techniques
- Technology stack recommendations

Communication Style:
- Provide specific, actionable code suggestions with examples
- Explain the reasoning behind recommendations
- Reference relevant documentation and industry standards
- Offer multiple solution approaches when appropriate
- Include comprehensive code examples and snippets
- Be thorough but concise in technical explanations
- Focus on maintainable, scalable solutions`
        },
        memoryCategories: ['code_reviews', 'debugging_sessions', 'architecture_discussions', 'technology_preferences'],
        reactions: ['🔍', '✅', '❌', '💡', '🔧', '⚡', '🚀'],
        features: {
          allowFiles: true,
          threadSupport: true,
          codeHighlighting: true,
          maxMessageLength: 4000
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        channelType: 'general',
        name: 'General Q&A',
        description: 'Quick questions and general assistance',
        llmConfig: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          temperature: 0.7,
          maxTokens: 2000,
          systemPrompt: `You are a knowledgeable AI assistant for quick questions and general discussions. You provide:

- Quick, accurate answers to varied questions
- Clear explanations and clarifications
- General problem-solving guidance
- Resource recommendations and next steps
- Brief but comprehensive responses

Communication Style:
- Keep responses concise but complete
- Ask clarifying questions when context is needed
- Provide helpful background information when relevant
- Suggest actionable next steps or additional resources
- Maintain a friendly, conversational tone
- Be direct and efficient in your responses`
        },
        memoryCategories: ['quick_questions', 'general_topics', 'resource_requests'],
        reactions: ['👍', '👎', '🤔', '💭', '📚'],
        features: {
          allowFiles: false,
          threadSupport: false,
          codeHighlighting: false,
          maxMessageLength: 2000
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        channelType: 'projects',
        name: 'Project Planning',
        description: 'Project ideation, planning, and exploration',
        llmConfig: {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.5,
          maxTokens: 3000,
          systemPrompt: `You are a project management and strategic planning expert specializing in:

- Project ideation and concept exploration
- Requirements gathering and analysis
- Technical feasibility assessment
- Timeline and milestone planning
- Risk assessment and mitigation strategies
- Resource planning and allocation
- Agile and traditional project methodologies

Communication Style:
- Break down complex projects into manageable components
- Ask probing questions to clarify scope and requirements
- Provide structured planning frameworks and templates
- Identify potential challenges and propose solutions
- Suggest iterative development approaches
- Focus on practical, actionable next steps
- Encourage realistic timeline and resource estimates`
        },
        memoryCategories: ['project_ideas', 'planning_sessions', 'milestone_tracking', 'resource_discussions'],
        reactions: ['🚀', '📋', '⭐', '🎯', '📈', '⚖️', '🔄'],
        features: {
          allowFiles: true,
          threadSupport: true,
          codeHighlighting: false,
          maxMessageLength: 3000
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        channelType: 'planning',
        name: 'Task & Workflow Planning',
        description: 'Daily task prioritization and workflow optimization',
        llmConfig: {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.4,
          maxTokens: 2500,
          systemPrompt: `You are a productivity and workflow optimization expert helping with:

- Daily and weekly task prioritization
- Workflow design and process optimization
- Time management strategies and techniques
- Goal setting and progress tracking
- Process improvement and automation
- Work-life balance considerations
- Productivity tool recommendations

Communication Style:
- Provide actionable prioritization frameworks (Eisenhower Matrix, MoSCoW, etc.)
- Suggest specific workflow improvements and optimizations
- Help identify bottlenecks and inefficiencies in current processes
- Recommend productivity tools and techniques tailored to specific needs
- Focus on sustainable and realistic approaches
- Encourage regular review and adjustment of systems
- Emphasize measurable outcomes and progress tracking`
        },
        memoryCategories: ['task_priorities', 'workflow_discussions', 'productivity_goals', 'time_management'],
        reactions: ['📅', '✅', '🔄', '⚡', '📊', '🎯', '⏰'],
        features: {
          allowFiles: false,
          threadSupport: true,
          codeHighlighting: false,
          maxMessageLength: 2500
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        channelType: 'analysis',
        name: 'Data Analysis & Research',
        description: 'Data analysis, reasoning, and research assistance',
        llmConfig: {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.2,
          maxTokens: 4000,
          systemPrompt: `You are a data analysis and analytical reasoning expert specializing in:

- Data interpretation and insight generation
- Statistical analysis and methodology guidance
- Research design and evaluation
- Critical thinking and logical reasoning
- Problem decomposition and analysis
- Evidence-based decision making
- Data visualization recommendations

Communication Style:
- Present findings clearly with supporting evidence and methodology
- Explain analytical methods, assumptions, and limitations
- Identify patterns, trends, correlations, and anomalies in data
- Suggest additional data sources or analysis when needed
- Provide balanced perspectives on complex analytical questions
- Use clear visualizations and examples to illustrate concepts
- Focus on actionable insights and data-driven recommendations
- Maintain scientific rigor and objectivity in analysis`
        },
        memoryCategories: ['data_analysis', 'research_projects', 'statistical_discussions', 'insights_generated'],
        reactions: ['📊', '🔬', '📈', '📉', '🧮', '💡', '🎯'],
        features: {
          allowFiles: true,
          threadSupport: true,
          codeHighlighting: true,
          maxMessageLength: 4000
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        channelType: 'admin',
        name: 'Bot Administration',
        description: 'Bot configuration and management commands',
        llmConfig: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          temperature: 0.3,
          maxTokens: 1500,
          systemPrompt: `You are a bot configuration and administration assistant helping with:

- Bot configuration and settings management
- Channel setup and optimization
- Command usage and troubleshooting
- Performance monitoring and tuning
- Integration setup and maintenance
- User access control and permissions
- System health and diagnostics

Communication Style:
- Provide clear, step-by-step configuration instructions
- Explain the impact and implications of different settings
- Suggest best practices for bot management and security
- Help troubleshoot issues systematically with diagnostic steps
- Document changes and configurations for future reference
- Ensure security and access controls are properly implemented
- Focus on system stability and optimal performance`
        },
        memoryCategories: ['configuration_changes', 'admin_commands', 'system_issues', 'performance_metrics'],
        reactions: ['⚙️', '🔧', '✅', '❌', '📝', '🔒'],
        features: {
          allowFiles: false,
          threadSupport: false,
          codeHighlighting: true,
          maxMessageLength: 1500,
          adminOnly: true
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    await this.channelConfigs.insertMany(defaultConfigs);
    logger.info(`📁 Created ${defaultConfigs.length} default channel configurations`);
  }

  // Get configuration for a specific channel type
  async getChannelConfig(channelType, guildId = null) {
    await this.initialize();
    
    // Check cache first
    const cacheKey = `${guildId || 'default'}_${channelType}`;
    if (this.isCacheValid() && this.configCache.has(cacheKey)) {
      return this.configCache.get(cacheKey);
    }

    try {
      // Look for guild-specific config first, then fall back to default
      let config = null;
      
      if (guildId) {
        config = await this.channelConfigs.findOne({ 
          guildId, 
          channelType, 
          isActive: true 
        });
      }
      
      if (!config) {
        config = await this.channelConfigs.findOne({ 
          channelType, 
          guildId: { $exists: false },
          isActive: true 
        });
      }
      
      if (config) {
        this.configCache.set(cacheKey, config);
        this.lastCacheUpdate = Date.now();
      }
      
      return config;
    } catch (error) {
      logger.error(`Error getting config for ${channelType}:`, error);
      return null;
    }
  }

  // Get all active channel configurations
  async getAllChannelConfigs(guildId = null) {
    await this.initialize();
    
    try {
      const query = { isActive: true };
      if (guildId) {
        query.$or = [
          { guildId },
          { guildId: { $exists: false } }
        ];
      } else {
        query.guildId = { $exists: false };
      }
      
      return await this.channelConfigs.find(query).sort({ channelType: 1 }).toArray();
    } catch (error) {
      logger.error('Error getting all channel configs:', error);
      return [];
    }
  }

  // Update channel configuration
  async updateChannelConfig(channelType, updates, guildId = null) {
    await this.initialize();
    
    try {
      const filter = { channelType };
      if (guildId) {
        filter.guildId = guildId;
      } else {
        filter.guildId = { $exists: false };
      }
      
      const updateDoc = {
        $set: {
          ...updates,
          updatedAt: new Date()
        }
      };
      
      const result = await this.channelConfigs.updateOne(filter, updateDoc);
      
      if (result.modifiedCount > 0) {
        this.clearCache();
        logger.info(`✅ Updated configuration for ${channelType}`);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error(`Error updating config for ${channelType}:`, error);
      return false;
    }
  }

  // Create guild-specific configuration
  async createGuildConfig(guildId, channelType, config) {
    await this.initialize();
    
    try {
      const newConfig = {
        ...config,
        guildId,
        channelType,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      };
      
      await this.channelConfigs.insertOne(newConfig);
      this.clearCache();
      
      logger.info(`✅ Created guild-specific config for ${guildId}/${channelType}`);
      return true;
    } catch (error) {
      logger.error(`Error creating guild config for ${channelType}:`, error);
      return false;
    }
  }

  // Get LLM configuration for a channel
  async getLLMConfig(channelType, guildId = null) {
    const config = await this.getChannelConfig(channelType, guildId);
    return config?.llmConfig || this.getDefaultLLMConfig();
  }

  // Get default LLM configuration fallback
  getDefaultLLMConfig() {
    return {
      provider: process.env.LLM_PROVIDER || 'openai',
      model: process.env.LLM_MODEL || 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 2000,
      systemPrompt: 'You are a helpful AI assistant.'
    };
  }

  // Get memory categories for a channel
  async getMemoryCategories(channelType, guildId = null) {
    const config = await this.getChannelConfig(channelType, guildId);
    return config?.memoryCategories || ['general'];
  }

  // Get channel features
  async getChannelFeatures(channelType, guildId = null) {
    const config = await this.getChannelConfig(channelType, guildId);
    return config?.features || {
      allowFiles: false,
      threadSupport: false,
      codeHighlighting: false,
      maxMessageLength: 2000
    };
  }

  // Get channel reactions
  async getChannelReactions(channelType, guildId = null) {
    const config = await this.getChannelConfig(channelType, guildId);
    return config?.reactions || ['👍', '👎'];
  }

  // Cache management
  isCacheValid() {
    return Date.now() - this.lastCacheUpdate < this.cacheExpiry;
  }

  clearCache() {
    this.configCache.clear();
    this.lastCacheUpdate = 0;
  }

  // Get configuration statistics
  async getConfigurationStats() {
    await this.initialize();
    
    try {
      const totalConfigs = await this.channelConfigs.countDocuments({ isActive: true });
      const channelTypes = await this.channelConfigs.distinct('channelType', { isActive: true });
      const guildSpecificConfigs = await this.channelConfigs.countDocuments({ 
        guildId: { $exists: true }, 
        isActive: true 
      });
      
      return {
        totalConfigs,
        channelTypes: channelTypes.length,
        availableChannels: channelTypes,
        guildSpecificConfigs
      };
    } catch (error) {
      logger.error('Error getting configuration stats:', error);
      return null;
    }
  }

  // Validate channel configuration
  validateChannelConfig(config) {
    const required = ['channelType', 'name', 'llmConfig'];
    const missing = required.filter(field => !config[field]);
    
    if (missing.length > 0) {
      return { valid: false, errors: [`Missing required fields: ${missing.join(', ')}`] };
    }
    
    // Validate LLM config
    if (!config.llmConfig.provider || !config.llmConfig.model) {
      return { valid: false, errors: ['LLM config must include provider and model'] };
    }
    
    return { valid: true, errors: [] };
  }

  // Export configuration for backup
  async exportConfigurations(guildId = null) {
    const configs = await this.getAllChannelConfigs(guildId);
    return {
      exportDate: new Date(),
      guildId,
      configurations: configs
    };
  }

  // Import configuration from backup
  async importConfigurations(configData, guildId = null) {
    await this.initialize();
    
    try {
      const configs = configData.configurations.map(config => ({
        ...config,
        _id: undefined, // Remove existing ID
        guildId: guildId || undefined,
        updatedAt: new Date(),
        createdAt: config.createdAt || new Date()
      }));
      
      // Remove existing configs for this guild/global
      const deleteFilter = guildId ? { guildId } : { guildId: { $exists: false } };
      await this.channelConfigs.deleteMany(deleteFilter);
      
      // Insert new configs
      await this.channelConfigs.insertMany(configs);
      this.clearCache();
      
      logger.info(`✅ Imported ${configs.length} configurations`);
      return true;
    } catch (error) {
      logger.error('Error importing configurations:', error);
      return false;
    }
  }
}