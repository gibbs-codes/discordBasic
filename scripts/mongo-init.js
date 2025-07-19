// scripts/mongo-init.js - MongoDB Initialization Script for Docker
// This script runs when the MongoDB container starts for the first time

// Switch to the technical_workspace database
db = db.getSiblingDB('technical_workspace');

// Create collections with proper indexes for optimal performance
print('Creating technical_workspace collections...');

// Discord interactions collection
db.createCollection('discord_interactions');
db.discord_interactions.createIndex({ userId: 1, timestamp: -1 });
db.discord_interactions.createIndex({ channel: 1, timestamp: -1 });
db.discord_interactions.createIndex({ timestamp: -1 });

// Technical sessions collection
db.createCollection('technical_sessions');
db.technical_sessions.createIndex({ userId: 1, createdAt: -1 });
db.technical_sessions.createIndex({ focusArea: 1, createdAt: -1 });

// Project contexts collection
db.createCollection('project_contexts');
db.project_contexts.createIndex({ userId: 1, projectName: 1 }, { unique: true });
db.project_contexts.createIndex({ userId: 1, lastActivity: -1 });

// Skill progressions collection
db.createCollection('skill_progressions');
db.skill_progressions.createIndex({ userId: 1, skill: 1 }, { unique: true });
db.skill_progressions.createIndex({ userId: 1, lastPracticed: -1 });

// Channel configurations collection
db.createCollection('channel_configurations');
db.channel_configurations.createIndex({ channelType: 1, guildId: 1 }, { unique: true });
db.channel_configurations.createIndex({ guildId: 1, isActive: 1 });

print('Collections and indexes created successfully');

// Insert default channel configurations
print('Inserting default channel configurations...');

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
      systemPrompt: null
    },
    features: {
      codeAnalysis: true,
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

// Insert default configurations
db.channel_configurations.insertMany(defaultConfigs);

print('Default channel configurations inserted successfully');

// Create admin user for database operations (optional)
// db.createUser({
//   user: 'discord_workspace_admin',
//   pwd: 'secure_password_here',
//   roles: [
//     { role: 'readWrite', db: 'technical_workspace' }
//   ]
// });

print('MongoDB initialization completed successfully for Discord LLM Workspace Bot');
print('Database: technical_workspace');
print('Collections: discord_interactions, technical_sessions, project_contexts, skill_progressions, channel_configurations');
print('Default channel configurations: 6 channels configured (coding, general, projects, planning, analysis, admin)');