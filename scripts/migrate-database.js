#!/usr/bin/env node
// scripts/migrate-database.js - Database Migration Script for Technical Workspace Conversion

import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
import { logger } from '../src/utils/logger.js';
import { getMongoUri } from '../src/utils/mongoUri.js';

config();

class DatabaseMigration {
  constructor() {
    this.client = new MongoClient(getMongoUri());
    this.db = null;
  }

  async connect() {
    try {
      await this.client.connect();
      this.db = this.client.db('technical_workspace');
      logger.info('✅ Connected to MongoDB for migration');
    } catch (error) {
      logger.error('❌ Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async migrate() {
    logger.info('🚀 Starting database migration to technical workspace...');

    try {
      // Step 1: Migrate existing Discord interactions
      await this.migrateDiscordInteractions();
      
      // Step 2: Create technical collections with proper indexes
      await this.createTechnicalCollections();
      
      // Step 3: Initialize default channel configurations
      await this.initializeChannelConfigurations();
      
      // Step 4: Migrate any existing memory data
      await this.migrateMemoryData();
      
      // Step 5: Clean up old coaching collections
      await this.cleanupOldCollections();
      
      logger.info('✅ Database migration completed successfully');
      
    } catch (error) {
      logger.error('❌ Migration failed:', error);
      throw error;
    }
  }

  async migrateDiscordInteractions() {
    logger.info('📥 Migrating Discord interactions...');
    
    const oldLogs = this.db.collection('logs');
    const newLogs = this.db.collection('discord_interactions');
    
    try {
      const oldInteractions = await oldLogs.find({}).toArray();
      
      if (oldInteractions.length > 0) {
        const migratedInteractions = oldInteractions.map(interaction => ({
          userId: interaction.userId,
          username: interaction.username || interaction.user,
          channel: this.mapOldChannelToNew(interaction.channel),
          userMessage: interaction.message || interaction.userMessage,
          botResponse: interaction.response || interaction.botResponse,
          timestamp: interaction.timestamp || interaction.createdAt || new Date(),
          technicalContext: this.extractTechnicalContextFromOld(interaction),
          migrated: true,
          originalId: interaction._id
        }));

        await newLogs.insertMany(migratedInteractions);
        logger.info(`✅ Migrated ${migratedInteractions.length} Discord interactions`);
      } else {
        logger.info('ℹ️ No existing interactions to migrate');
      }
    } catch (error) {
      logger.warn('⚠️ No old logs collection found or migration skipped:', error.message);
    }
  }

  async createTechnicalCollections() {
    logger.info('🏗️ Creating technical collections and indexes...');

    // Discord interactions collection
    const discordLogs = this.db.collection('discord_interactions');
    await discordLogs.createIndex({ userId: 1, timestamp: -1 });
    await discordLogs.createIndex({ channel: 1, timestamp: -1 });

    // Technical sessions collection
    const technicalSessions = this.db.collection('technical_sessions');
    await technicalSessions.createIndex({ userId: 1, createdAt: -1 });
    await technicalSessions.createIndex({ focusArea: 1, createdAt: -1 });

    // Project contexts collection
    const projectContexts = this.db.collection('project_contexts');
    await projectContexts.createIndex({ userId: 1, projectName: 1 });
    await projectContexts.createIndex({ userId: 1, lastActivity: -1 });

    // Skill progressions collection
    const skillProgressions = this.db.collection('skill_progressions');
    await skillProgressions.createIndex({ userId: 1, skill: 1 });
    await skillProgressions.createIndex({ userId: 1, lastPracticed: -1 });

    // Channel configurations collection
    const channelConfigs = this.db.collection('channel_configurations');
    await channelConfigs.createIndex({ channelType: 1, guildId: 1 });
    await channelConfigs.createIndex({ guildId: 1, isActive: 1 });

    logger.info('✅ Technical collections and indexes created');
  }

  async initializeChannelConfigurations() {
    logger.info('⚙️ Initializing default channel configurations...');

    const channelConfigs = this.db.collection('channel_configurations');
    
    const defaultConfigs = [
      {
        channelType: 'coding',
        name: 'Software Development',
        description: 'Expert coding assistance and technical guidance',
        llmConfig: {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.3,
          maxTokens: 4000,
          systemPrompt: null // Will use default from prompts.js
        },
        features: {
          codeAnalysis: true,
          threadCreation: true,
          reactionTracking: true,
          memoryEnabled: true
        },
        isActive: true,
        guildId: null, // Global default
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        channelType: 'general',
        name: 'General Q&A',
        description: 'Helpful AI assistant for quick questions',
        llmConfig: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          temperature: 0.7,
          maxTokens: 2000,
          systemPrompt: null
        },
        features: {
          threadCreation: false,
          reactionTracking: true,
          memoryEnabled: true
        },
        isActive: true,
        guildId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        channelType: 'projects',
        name: 'Project Planning',
        description: 'Strategic planning and project management',
        llmConfig: {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.5,
          maxTokens: 3000,
          systemPrompt: null
        },
        features: {
          projectTracking: true,
          threadCreation: true,
          reactionTracking: true,
          memoryEnabled: true
        },
        isActive: true,
        guildId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        channelType: 'planning',
        name: 'Productivity & Workflow',
        description: 'Task prioritization and workflow optimization',
        llmConfig: {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.4,
          maxTokens: 2500,
          systemPrompt: null
        },
        features: {
          workflowTracking: true,
          reactionTracking: true,
          memoryEnabled: true
        },
        isActive: true,
        guildId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        channelType: 'analysis',
        name: 'Data Analysis & Reasoning',
        description: 'Analytical reasoning and data interpretation',
        llmConfig: {
          provider: 'openai',
          model: 'gpt-4',
          temperature: 0.2,
          maxTokens: 4000,
          systemPrompt: null
        },
        features: {
          dataAnalysis: true,
          threadCreation: true,
          reactionTracking: true,
          memoryEnabled: true
        },
        isActive: true,
        guildId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        channelType: 'admin',
        name: 'Bot Administration',
        description: 'Bot configuration and system management',
        llmConfig: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          temperature: 0.3,
          maxTokens: 1500,
          systemPrompt: null
        },
        features: {
          adminOnly: true,
          reactionTracking: false,
          memoryEnabled: true
        },
        isActive: true,
        guildId: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Insert default configurations if they don't exist
    for (const config of defaultConfigs) {
      const existing = await channelConfigs.findOne({ 
        channelType: config.channelType, 
        guildId: null 
      });
      
      if (!existing) {
        await channelConfigs.insertOne(config);
        logger.info(`✅ Created default config for ${config.channelType} channel`);
      } else {
        logger.info(`ℹ️ Config for ${config.channelType} already exists`);
      }
    }
  }

  async migrateMemoryData() {
    logger.info('🧠 Migrating memory data...');

    // Look for any existing user data that can be preserved
    try {
      const oldUsers = this.db.collection('users');
      const existingUsers = await oldUsers.find({}).toArray();
      
      if (existingUsers.length > 0) {
        logger.info(`Found ${existingUsers.length} users in old system`);
        // For now, just log this - the new system will build fresh context
        // In the future, we could migrate specific user preferences
      }
    } catch (error) {
      logger.info('ℹ️ No existing user data to migrate');
    }
  }

  async cleanupOldCollections() {
    logger.info('🧹 Cleaning up old coaching collections...');

    const collectionsToRemove = [
      'logs', // Old interaction logs
      'reconciliation_logs',
      'users', // Old user data
      'accountability_sessions',
      'coach_responses',
      'financial_penalties'
    ];

    for (const collectionName of collectionsToRemove) {
      try {
        const collection = this.db.collection(collectionName);
        const count = await collection.countDocuments();
        
        if (count > 0) {
          // Create backup before deletion
          const backupName = `${collectionName}_backup_${Date.now()}`;
          await collection.aggregate([{ $out: backupName }]).toArray();
          logger.info(`📦 Backed up ${count} documents from ${collectionName} to ${backupName}`);
          
          // Optional: Comment out the next line if you want to keep old data
          // await collection.drop();
          // logger.info(`🗑️ Removed old collection: ${collectionName}`);
        }
      } catch (error) {
        logger.info(`ℹ️ Collection ${collectionName} not found or already removed`);
      }
    }
  }

  mapOldChannelToNew(oldChannel) {
    const mapping = {
      'general': 'general',
      'coding': 'coding',
      'projects': 'projects',
      'planning': 'planning',
      'analysis': 'analysis',
      'admin': 'admin',
      // Map any old coaching channels to appropriate new ones
      'accountability': 'planning',
      'check-ins': 'planning',
      'goals': 'projects'
    };
    
    return mapping[oldChannel] || 'general';
  }

  extractTechnicalContextFromOld(interaction) {
    // Extract what technical context we can from old interactions
    const message = interaction.message || interaction.userMessage || '';
    const response = interaction.response || interaction.botResponse || '';
    const fullText = `${message} ${response}`;

    return {
      languages: this.detectProgrammingLanguages(fullText),
      frameworks: this.detectFrameworks(fullText),
      technologies: this.detectTechnologies(fullText),
      codeBlocks: this.extractCodeBlocks(fullText),
      questionType: this.classifyQuestionType(message),
      complexity: this.assessComplexity(message),
      migrated: true
    };
  }

  detectProgrammingLanguages(text) {
    const languages = ['javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust'];
    const detected = [];
    const lowerText = text.toLowerCase();
    
    languages.forEach(lang => {
      if (lowerText.includes(lang)) {
        detected.push(lang);
      }
    });
    
    return detected;
  }

  detectFrameworks(text) {
    const frameworks = ['react', 'vue', 'angular', 'express', 'django', 'flask', 'spring'];
    const detected = [];
    const lowerText = text.toLowerCase();
    
    frameworks.forEach(framework => {
      if (lowerText.includes(framework)) {
        detected.push(framework);
      }
    });
    
    return detected;
  }

  detectTechnologies(text) {
    const technologies = ['docker', 'kubernetes', 'aws', 'mongodb', 'postgresql', 'redis'];
    const detected = [];
    const lowerText = text.toLowerCase();
    
    technologies.forEach(tech => {
      if (lowerText.includes(tech)) {
        detected.push(tech);
      }
    });
    
    return detected;
  }

  extractCodeBlocks(text) {
    const codeBlockCount = (text.match(/```/g) || []).length / 2;
    const inlineCodeCount = (text.match(/`[^`]+`/g) || []).length;
    
    return {
      blocks: Math.floor(codeBlockCount),
      inline: inlineCodeCount,
      hasCode: codeBlockCount > 0 || inlineCodeCount > 0
    };
  }

  classifyQuestionType(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('how to')) return 'how-to';
    if (lowerMessage.includes('debug') || lowerMessage.includes('error')) return 'debugging';
    if (lowerMessage.includes('review')) return 'code-review';
    if (lowerMessage.includes('best practice')) return 'best-practices';
    if (lowerMessage.includes('explain')) return 'explanation';
    return 'general';
  }

  assessComplexity(message) {
    const complexKeywords = ['architecture', 'scalable', 'optimize', 'complex', 'advanced'];
    const mediumKeywords = ['implement', 'create', 'build', 'design'];
    
    const lowerMessage = message.toLowerCase();
    
    if (complexKeywords.some(keyword => lowerMessage.includes(keyword))) return 'complex';
    if (mediumKeywords.some(keyword => lowerMessage.includes(keyword))) return 'medium';
    return 'simple';
  }

  async close() {
    await this.client.close();
    logger.info('✅ Database connection closed');
  }

  async verify() {
    logger.info('🔍 Verifying migration results...');

    const collections = [
      'discord_interactions',
      'technical_sessions',
      'project_contexts',
      'skill_progressions',
      'channel_configurations'
    ];

    for (const collectionName of collections) {
      const collection = this.db.collection(collectionName);
      const count = await collection.countDocuments();
      const indexes = await collection.indexes();
      
      logger.info(`📊 ${collectionName}: ${count} documents, ${indexes.length} indexes`);
    }

    // Verify channel configurations
    const channelConfigs = this.db.collection('channel_configurations');
    const configCount = await channelConfigs.countDocuments({ guildId: null });
    
    if (configCount === 6) {
      logger.info('✅ All default channel configurations created successfully');
    } else {
      logger.warn(`⚠️ Expected 6 default configs, found ${configCount}`);
    }
  }
}

// Run migration if called directly
async function runMigration() {
  const migration = new DatabaseMigration();
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  
  try {
    await migration.connect();
    await migration.migrate();
    await migration.verify();
    
    logger.info('🎉 Migration completed successfully!');
    logger.info('');
    logger.info('Next steps:');
    logger.info('1. Update your .env file with new environment variables');
    logger.info('2. Test the bot with: npm run test:integration');
    logger.info('3. Deploy using the deployment checklist');
    
  } catch (error) {
    if (isCI && (error.message.includes('Authentication failed') || error.message.includes('ECONNREFUSED'))) {
      logger.warn('⚠️ MongoDB not available in CI environment, skipping migration');
      logger.info('Migration will run when the actual container starts');
      process.exit(0); // Exit successfully
    } else {
      logger.error('💥 Migration failed:', error);
      process.exit(1);
    }
  } finally {
    try {
      await migration.close();
    } catch (closeError) {
      // Ignore close errors in CI
      if (!isCI) {
        logger.error('Error closing connection:', closeError);
      }
    }
  }
}

// Export for use in other scripts
export { DatabaseMigration };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration();
}