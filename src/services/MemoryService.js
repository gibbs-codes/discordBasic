// src/services/MemoryService.js - Technical Memory & Context Management
import { MongoClient } from 'mongodb';
import { logger } from '../utils/logger.js';

export class MemoryService {
  constructor() {
    this.client = new MongoClient(process.env.MONGO_URI);
    this.db = null;
    this.technicalLogs = null; // Technical work sessions and insights
    this.discordLogs = null;   // Discord interactions
    this.projectContexts = null; // Project tracking
    this.skillProgressions = null; // Learning and skill development
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      await this.client.connect();
      this.db = this.client.db('technical_workspace');
      this.technicalLogs = this.db.collection('technical_sessions'); // Technical work sessions
      this.discordLogs = this.db.collection('discord_interactions'); // Discord interactions
      this.projectContexts = this.db.collection('project_contexts'); // Project tracking
      this.skillProgressions = this.db.collection('skill_progressions'); // Learning progress
      
      // Create indexes for efficient queries
      await this.discordLogs.createIndex({ userId: 1, timestamp: -1 });
      await this.discordLogs.createIndex({ channel: 1, timestamp: -1 });
      await this.projectContexts.createIndex({ userId: 1, projectName: 1 });
      await this.skillProgressions.createIndex({ userId: 1, skill: 1 });
      
      logger.info('✅ Technical Memory service connected to MongoDB');
      this.initialized = true;
    } catch (error) {
      logger.error('❌ Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  // Store Discord interactions with technical analysis
  async storeInteraction(interaction) {
    await this.initialize();
    
    try {
      const enrichedInteraction = {
        ...interaction,
        technicalContext: this.extractTechnicalContext(interaction),
        createdAt: new Date()
      };
      
      await this.discordLogs.insertOne(enrichedInteraction);
      
      // Also update project and skill contexts if relevant
      await this.updateProjectContext(interaction);
      await this.updateSkillProgression(interaction);
      
    } catch (error) {
      logger.error('Failed to store interaction:', error);
    }
  }

  // Extract technical context from interaction
  extractTechnicalContext(interaction) {
    const context = {
      languages: this.detectProgrammingLanguages(interaction.userMessage + ' ' + interaction.botResponse),
      frameworks: this.detectFrameworks(interaction.userMessage + ' ' + interaction.botResponse),
      technologies: this.detectTechnologies(interaction.userMessage + ' ' + interaction.botResponse),
      codeBlocks: this.extractCodeBlocks(interaction.userMessage + ' ' + interaction.botResponse),
      questionType: this.classifyQuestionType(interaction.userMessage),
      complexity: this.assessComplexity(interaction.userMessage),
      isProjectRelated: this.detectProjectMention(interaction.userMessage)
    };
    
    return context;
  }

  // Update project context based on interaction
  async updateProjectContext(interaction) {
    const projectMention = this.extractProjectName(interaction.userMessage);
    
    if (projectMention) {
      try {
        const update = {
          $set: {
            userId: interaction.userId,
            projectName: projectMention,
            lastActivity: new Date(),
            channel: interaction.channel
          },
          $push: {
            interactions: {
              timestamp: new Date(),
              message: interaction.userMessage,
              response: interaction.botResponse,
              channel: interaction.channel
            }
          },
          $addToSet: {
            technologies: { $each: this.detectTechnologies(interaction.userMessage + ' ' + interaction.botResponse) },
            languages: { $each: this.detectProgrammingLanguages(interaction.userMessage + ' ' + interaction.botResponse) }
          }
        };

        await this.projectContexts.updateOne(
          { userId: interaction.userId, projectName: projectMention },
          update,
          { upsert: true }
        );
      } catch (error) {
        logger.error('Failed to update project context:', error);
      }
    }
  }

  // Update skill progression tracking
  async updateSkillProgression(interaction) {
    const detectedSkills = this.detectSkillsFromInteraction(interaction);
    
    for (const skill of detectedSkills) {
      try {
        const update = {
          $set: {
            userId: interaction.userId,
            skill: skill.name,
            lastPracticed: new Date()
          },
          $inc: {
            interactionCount: 1,
            [`levelProgress.${skill.category}`]: skill.progressValue
          },
          $push: {
            recentInteractions: {
              $each: [{
                timestamp: new Date(),
                channel: interaction.channel,
                context: skill.context,
                difficulty: skill.difficulty
              }],
              $slice: -10 // Keep only last 10 interactions
            }
          }
        };

        await this.skillProgressions.updateOne(
          { userId: interaction.userId, skill: skill.name },
          update,
          { upsert: true }
        );
      } catch (error) {
        logger.error('Failed to update skill progression:', error);
      }
    }
  }

  // Get relevant technical context for LLM from Discord history and projects
  async getRelevantContext({ userId, channelType, currentMessage, lookbackDays = 14 }) {
    await this.initialize();
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

    try {
      // Get technical session insights
      const technicalInsights = await this.getRecentTechnicalInsights(userId, cutoffDate);
      
      // Get Discord interaction patterns
      const discordPatterns = await this.getTechnicalDiscordPatterns(userId, cutoffDate, channelType);
      
      // Get project contexts and progress
      const projectContexts = await this.getRecentProjectContexts(userId, cutoffDate);
      
      // Get skill progression and learning patterns
      const skillPatterns = await this.getSkillProgressionPatterns(userId, cutoffDate);
      
      // Get technical workflow patterns
      const workflowPatterns = await this.analyzeTechnicalWorkflowPatterns(userId, cutoffDate);
      
      return {
        technicalInsights,
        discordPatterns,
        projectContexts,
        skillPatterns,
        workflowPatterns,
        summary: this.generateTechnicalContextSummary(technicalInsights, discordPatterns, projectContexts, skillPatterns, workflowPatterns)
      };
      
    } catch (error) {
      logger.error('Error getting technical context:', error);
      return { summary: 'Technical context unavailable' };
    }
  }

  // Get recent technical work insights
  async getRecentTechnicalInsights(userId, cutoffDate) {
    try {
      const recentSessions = await this.technicalLogs
        .find({ 
          userId,
          createdAt: { $gte: cutoffDate }
        })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();

      return recentSessions.map(session => ({
        date: session.createdAt,
        focusArea: session.focusArea || 'General',
        technologies: session.technologies || [],
        productivity: session.productivity || 'Unknown',
        achievements: session.achievements || [],
        challenges: session.challenges || [],
        nextSteps: session.nextSteps || [],
        duration: session.duration || 0
      }));
    } catch (error) {
      logger.error('Error getting technical insights:', error);
      return [];
    }
  }

  // Analyze technical Discord interaction patterns
  async getTechnicalDiscordPatterns(userId, cutoffDate, currentChannelType) {
    try {
      const recentInteractions = await this.discordLogs
        .find({ 
          userId,
          timestamp: { $gte: cutoffDate }
        })
        .sort({ timestamp: -1 })
        .limit(50)
        .toArray();

      // Analyze patterns by channel
      const channelBreakdown = {};
      const languageUsage = {};
      const frameworkUsage = {};
      const questionTypes = {};
      const complexityDistribution = { simple: 0, medium: 0, complex: 0 };

      recentInteractions.forEach(interaction => {
        const channel = interaction.channel;
        const techContext = interaction.technicalContext || {};
        
        // Channel breakdown
        if (!channelBreakdown[channel]) {
          channelBreakdown[channel] = { count: 0, topics: [] };
        }
        channelBreakdown[channel].count++;
        
        // Language usage tracking
        (techContext.languages || []).forEach(lang => {
          languageUsage[lang] = (languageUsage[lang] || 0) + 1;
        });
        
        // Framework usage tracking
        (techContext.frameworks || []).forEach(framework => {
          frameworkUsage[framework] = (frameworkUsage[framework] || 0) + 1;
        });
        
        // Question type classification
        if (techContext.questionType) {
          questionTypes[techContext.questionType] = (questionTypes[techContext.questionType] || 0) + 1;
        }
        
        // Complexity distribution
        if (techContext.complexity) {
          complexityDistribution[techContext.complexity]++;
        }
      });

      // Get recent coding patterns
      const recentCodingPatterns = recentInteractions
        .filter(i => i.technicalContext?.codeBlocks?.length > 0)
        .slice(0, 5)
        .map(i => ({
          date: i.timestamp,
          channel: i.channel,
          languages: i.technicalContext.languages,
          complexity: i.technicalContext.complexity,
          topic: this.extractTopicFromMessage(i.userMessage)
        }));

      return {
        totalInteractions: recentInteractions.length,
        channelBreakdown,
        languageUsage,
        frameworkUsage,
        questionTypes,
        complexityDistribution,
        recentCodingPatterns,
        mostActiveChannel: Object.entries(channelBreakdown).sort(([,a], [,b]) => b.count - a.count)[0]?.[0] || 'general',
        preferredLanguages: Object.entries(languageUsage).sort(([,a], [,b]) => b - a).slice(0, 3).map(([lang]) => lang),
        preferredFrameworks: Object.entries(frameworkUsage).sort(([,a], [,b]) => b - a).slice(0, 3).map(([fw]) => fw)
      };
    } catch (error) {
      logger.error('Error analyzing technical Discord patterns:', error);
      return {};
    }
  }

  // Get recent project contexts
  async getRecentProjectContexts(userId, cutoffDate) {
    try {
      const recentProjects = await this.projectContexts
        .find({ 
          userId,
          lastActivity: { $gte: cutoffDate }
        })
        .sort({ lastActivity: -1 })
        .limit(5)
        .toArray();

      return recentProjects.map(project => ({
        name: project.projectName,
        lastActivity: project.lastActivity,
        technologies: project.technologies || [],
        languages: project.languages || [],
        interactionCount: project.interactions?.length || 0,
        channels: [...new Set(project.interactions?.map(i => i.channel) || [])],
        recentTopics: project.interactions?.slice(-3).map(i => this.extractTopicFromMessage(i.message)) || []
      }));
    } catch (error) {
      logger.error('Error getting project contexts:', error);
      return [];
    }
  }

  // Get skill progression patterns
  async getSkillProgressionPatterns(userId, cutoffDate) {
    try {
      const skillProgressions = await this.skillProgressions
        .find({ 
          userId,
          lastPracticed: { $gte: cutoffDate }
        })
        .sort({ interactionCount: -1 })
        .limit(10)
        .toArray();

      return skillProgressions.map(skill => ({
        name: skill.skill,
        interactionCount: skill.interactionCount,
        lastPracticed: skill.lastPracticed,
        levelProgress: skill.levelProgress || {},
        recentChannels: [...new Set(skill.recentInteractions?.map(i => i.channel) || [])],
        averageDifficulty: this.calculateAverageDifficulty(skill.recentInteractions || []),
        learningTrend: this.calculateLearningTrend(skill.recentInteractions || [])
      }));
    } catch (error) {
      logger.error('Error getting skill patterns:', error);
      return [];
    }
  }

  // Analyze technical workflow patterns
  async analyzeTechnicalWorkflowPatterns(userId, cutoffDate) {
    try {
      const discordLogs = await this.discordLogs
        .find({ userId, timestamp: { $gte: cutoffDate } })
        .toArray();

      const technicalSessions = await this.technicalLogs
        .find({ userId, createdAt: { $gte: cutoffDate } })
        .toArray();

      // Pattern analysis
      const productivityTrends = this.analyzeProductivityTrends(technicalSessions);
      const requestFrequency = this.analyzeTechnicalRequestFrequency(discordLogs);
      const channelPreferences = this.analyzeChannelPreferences(discordLogs);
      const workingHours = this.analyzeWorkingHourPatterns(discordLogs, technicalSessions);
      const taskBreakdownPatterns = this.analyzeTaskBreakdownPatterns(discordLogs);
      
      return {
        productivityTrends,
        requestFrequency,
        channelPreferences,
        workingHours,
        taskBreakdownPatterns,
        weeklyPatterns: this.analyzeTechnicalWeeklyPatterns(technicalSessions, discordLogs)
      };
    } catch (error) {
      logger.error('Error analyzing technical workflow patterns:', error);
      return {};
    }
  }

  // Generate technical context summary for the LLM
  generateTechnicalContextSummary(technicalInsights, discordPatterns, projectContexts, skillPatterns, workflowPatterns) {
    let summary = "TECHNICAL CONTEXT:\n\n";
    
    // Recent technical work
    if (technicalInsights.length > 0) {
      const latestSession = technicalInsights[0];
      summary += `Latest work session (${latestSession.date?.toDateString()}): Focus area was ${latestSession.focusArea}. `;
      summary += `Technologies: ${latestSession.technologies.join(', ')}. Productivity: ${latestSession.productivity}\n\n`;
    }
    
    // Programming language preferences
    if (discordPatterns.preferredLanguages?.length > 0) {
      summary += `PREFERRED LANGUAGES: ${discordPatterns.preferredLanguages.join(', ')}\n`;
    }
    
    // Framework preferences
    if (discordPatterns.preferredFrameworks?.length > 0) {
      summary += `PREFERRED FRAMEWORKS: ${discordPatterns.preferredFrameworks.join(', ')}\n\n`;
    }
    
    // Active projects
    if (projectContexts.length > 0) {
      summary += `ACTIVE PROJECTS:\n`;
      projectContexts.slice(0, 3).forEach(project => {
        summary += `- ${project.name}: ${project.technologies.join(', ')} (${project.interactionCount} interactions)\n`;
      });
      summary += '\n';
    }
    
    // Skill development focus
    if (skillPatterns.length > 0) {
      const topSkills = skillPatterns.slice(0, 3);
      summary += `SKILL DEVELOPMENT FOCUS: ${topSkills.map(s => s.name).join(', ')}\n`;
      
      const improvingSkills = topSkills.filter(s => s.learningTrend === 'improving');
      if (improvingSkills.length > 0) {
        summary += `Currently improving: ${improvingSkills.map(s => s.name).join(', ')}\n`;
      }
      summary += '\n';
    }
    
    // Complexity preferences
    if (discordPatterns.complexityDistribution) {
      const totalQuestions = Object.values(discordPatterns.complexityDistribution).reduce((a, b) => a + b, 0);
      if (totalQuestions > 0) {
        const complexRatio = discordPatterns.complexityDistribution.complex / totalQuestions;
        if (complexRatio > 0.4) {
          summary += `COMPLEXITY PREFERENCE: Tends to work on complex problems (${Math.round(complexRatio * 100)}% complex questions)\n\n`;
        }
      }
    }
    
    // Question type patterns
    if (discordPatterns.questionTypes) {
      const topQuestionTypes = Object.entries(discordPatterns.questionTypes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 2)
        .map(([type]) => type);
      
      if (topQuestionTypes.length > 0) {
        summary += `QUESTION PATTERNS: Often asks about ${topQuestionTypes.join(' and ')}\n\n`;
      }
    }
    
    // Channel usage patterns
    if (discordPatterns.mostActiveChannel && discordPatterns.mostActiveChannel !== 'general') {
      summary += `WORKFLOW PREFERENCE: Most active in #${discordPatterns.mostActiveChannel} channel\n\n`;
    }
    
    // Working patterns
    if (workflowPatterns.workingHours) {
      summary += `WORKING PATTERNS: ${this.describeTechnicalWorkingPatterns(workflowPatterns)}\n\n`;
    }
    
    return summary.trim() || "No technical patterns detected yet.";
  }

  // Helper methods for technical pattern detection
  detectProgrammingLanguages(text) {
    const languages = [
      'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust', 'php', 'ruby',
      'kotlin', 'swift', 'scala', 'clojure', 'haskell', 'elm', 'dart', 'r', 'matlab', 'sql',
      'html', 'css', 'bash', 'shell', 'powershell', 'lua', 'perl', 'elixir', 'erlang', 'f#'
    ];
    
    const detected = [];
    const lowerText = text.toLowerCase();
    
    languages.forEach(lang => {
      if (lowerText.includes(lang) || lowerText.includes(lang.replace('#', 'sharp'))) {
        detected.push(lang);
      }
    });
    
    return [...new Set(detected)];
  }

  detectFrameworks(text) {
    const frameworks = [
      'react', 'vue', 'angular', 'svelte', 'express', 'fastapi', 'django', 'flask', 'spring',
      'laravel', 'rails', 'nextjs', 'nuxt', 'gatsby', 'astro', 'ember', 'backbone', 'jquery',
      'bootstrap', 'tailwind', 'material-ui', 'ant-design', 'chakra', 'redux', 'mobx', 'vuex',
      'tensorflow', 'pytorch', 'keras', 'scikit-learn', 'pandas', 'numpy', 'matplotlib'
    ];
    
    const detected = [];
    const lowerText = text.toLowerCase();
    
    frameworks.forEach(framework => {
      if (lowerText.includes(framework)) {
        detected.push(framework);
      }
    });
    
    return [...new Set(detected)];
  }

  detectTechnologies(text) {
    const technologies = [
      'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'firebase', 'mongodb', 'postgresql',
      'mysql', 'redis', 'elasticsearch', 'graphql', 'rest', 'api', 'microservices', 'serverless',
      'git', 'github', 'gitlab', 'jenkins', 'ci/cd', 'terraform', 'ansible', 'nginx', 'apache',
      'node.js', 'deno', 'webpack', 'vite', 'babel', 'typescript', 'jest', 'cypress', 'playwright'
    ];
    
    const detected = [];
    const lowerText = text.toLowerCase();
    
    technologies.forEach(tech => {
      if (lowerText.includes(tech)) {
        detected.push(tech);
      }
    });
    
    return [...new Set(detected)];
  }

  extractCodeBlocks(text) {
    const codeBlockRegex = /```[\s\S]*?```/g;
    const inlineCodeRegex = /`[^`]+`/g;
    
    const codeBlocks = text.match(codeBlockRegex) || [];
    const inlineCode = text.match(inlineCodeRegex) || [];
    
    return {
      blocks: codeBlocks.length,
      inline: inlineCode.length,
      hasCode: codeBlocks.length > 0 || inlineCode.length > 0
    };
  }

  classifyQuestionType(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('how to') || lowerMessage.includes('how do')) {
      return 'how-to';
    } else if (lowerMessage.includes('debug') || lowerMessage.includes('error') || lowerMessage.includes('fix')) {
      return 'debugging';
    } else if (lowerMessage.includes('review') || lowerMessage.includes('feedback')) {
      return 'code-review';
    } else if (lowerMessage.includes('best practice') || lowerMessage.includes('recommend')) {
      return 'best-practices';
    } else if (lowerMessage.includes('explain') || lowerMessage.includes('what is')) {
      return 'explanation';
    } else if (lowerMessage.includes('optimize') || lowerMessage.includes('performance')) {
      return 'optimization';
    } else if (lowerMessage.includes('design') || lowerMessage.includes('architecture')) {
      return 'architecture';
    } else {
      return 'general';
    }
  }

  assessComplexity(message) {
    const complexityIndicators = {
      simple: ['hello', 'basic', 'simple', 'quick', 'easy'],
      medium: ['implement', 'create', 'build', 'design', 'integrate'],
      complex: ['architecture', 'scalable', 'optimize', 'refactor', 'complex', 'advanced', 'performance']
    };
    
    const lowerMessage = message.toLowerCase();
    
    if (complexityIndicators.complex.some(indicator => lowerMessage.includes(indicator))) {
      return 'complex';
    } else if (complexityIndicators.medium.some(indicator => lowerMessage.includes(indicator))) {
      return 'medium';
    } else {
      return 'simple';
    }
  }

  detectProjectMention(message) {
    const projectIndicators = ['project', 'app', 'application', 'system', 'platform', 'tool', 'service', 'website'];
    const lowerMessage = message.toLowerCase();
    
    return projectIndicators.some(indicator => lowerMessage.includes(indicator));
  }

  extractProjectName(message) {
    // Try to extract project names from common patterns
    const patterns = [
      /(?:project|app|application)\s+(?:called|named|for)\s+([a-zA-Z0-9\s-]+)/i,
      /working on\s+([a-zA-Z0-9\s-]+)(?:\s+project|\s+app)?/i,
      /building\s+([a-zA-Z0-9\s-]+)/i,
      /my\s+([a-zA-Z0-9\s-]+)\s+(?:project|app|application)/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1].trim().substring(0, 50);
      }
    }
    
    return null;
  }

  detectSkillsFromInteraction(interaction) {
    const skills = [];
    const languages = this.detectProgrammingLanguages(interaction.userMessage + ' ' + interaction.botResponse);
    const frameworks = this.detectFrameworks(interaction.userMessage + ' ' + interaction.botResponse);
    const technologies = this.detectTechnologies(interaction.userMessage + ' ' + interaction.botResponse);
    const complexity = this.assessComplexity(interaction.userMessage);
    
    // Add programming language skills
    languages.forEach(lang => {
      skills.push({
        name: lang,
        category: 'programming',
        context: 'language-usage',
        difficulty: complexity,
        progressValue: complexity === 'complex' ? 3 : complexity === 'medium' ? 2 : 1
      });
    });
    
    // Add framework skills
    frameworks.forEach(framework => {
      skills.push({
        name: framework,
        category: 'framework',
        context: 'framework-usage',
        difficulty: complexity,
        progressValue: complexity === 'complex' ? 3 : complexity === 'medium' ? 2 : 1
      });
    });
    
    // Add technology skills
    technologies.forEach(tech => {
      skills.push({
        name: tech,
        category: 'technology',
        context: 'tech-usage',
        difficulty: complexity,
        progressValue: complexity === 'complex' ? 3 : complexity === 'medium' ? 2 : 1
      });
    });
    
    return skills;
  }

  extractTopicFromMessage(message) {
    // Extract the main topic/subject from a message
    const words = message.toLowerCase().split(' ').filter(word => word.length > 3);
    const commonWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'had', 'have', 'what', 'were'];
    const meaningfulWords = words.filter(word => !commonWords.includes(word));
    
    return meaningfulWords.slice(0, 3).join(' ') || 'general';
  }
  
  // Analyze productivity trends from technical sessions
  analyzeProductivityTrends(sessions) {
    const trends = {
      high: 0,
      medium: 0,
      low: 0,
      unknown: 0
    };
    
    sessions.forEach(session => {
      const productivity = session.productivity?.toLowerCase() || 'unknown';
      if (trends.hasOwnProperty(productivity)) {
        trends[productivity]++;
      } else {
        trends.unknown++;
      }
    });
    
    return trends;
  }
  
  analyzeTechnicalRequestFrequency(logs) {
    const frequencies = {
      debugging: logs.filter(log => this.classifyQuestionType(log.userMessage) === 'debugging').length,
      howTo: logs.filter(log => this.classifyQuestionType(log.userMessage) === 'how-to').length,
      codeReview: logs.filter(log => this.classifyQuestionType(log.userMessage) === 'code-review').length,
      architecture: logs.filter(log => this.classifyQuestionType(log.userMessage) === 'architecture').length,
      optimization: logs.filter(log => this.classifyQuestionType(log.userMessage) === 'optimization').length,
      bestPractices: logs.filter(log => this.classifyQuestionType(log.userMessage) === 'best-practices').length,
      explanation: logs.filter(log => this.classifyQuestionType(log.userMessage) === 'explanation').length
    };
    
    return frequencies;
  }
  
  analyzeChannelPreferences(logs) {
    const channelCounts = logs.reduce((counts, log) => {
      counts[log.channel] = (counts[log.channel] || 0) + 1;
      return counts;
    }, {});
    
    // Find most and least used channels
    const sortedChannels = Object.entries(channelCounts).sort(([,a], [,b]) => b - a);
    
    return {
      mostUsed: sortedChannels[0]?.[0] || 'general',
      leastUsed: sortedChannels[sortedChannels.length - 1]?.[0] || 'admin',
      channelCounts,
      totalChannelsUsed: Object.keys(channelCounts).length
    };
  }

  // Analyze working hour patterns
  analyzeWorkingHourPatterns(discordLogs, technicalSessions) {
    const hourCounts = {};
    const allLogs = [...discordLogs, ...technicalSessions];
    
    allLogs.forEach(log => {
      const hour = (log.timestamp || log.createdAt).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    // Find peak working hours
    const sortedHours = Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));
    
    return {
      hourlyDistribution: hourCounts,
      peakHours: sortedHours,
      preferredWorkingTime: this.categorizeWorkingTime(sortedHours)
    };
  }

  analyzeTaskBreakdownPatterns(logs) {
    const planningLogs = logs.filter(log => log.channel === 'planning');
    const taskBreakdownIndicators = planningLogs.filter(log => 
      log.userMessage.toLowerCase().includes('task') || 
      log.userMessage.toLowerCase().includes('step') ||
      log.userMessage.toLowerCase().includes('plan')
    );
    
    return {
      totalPlanningInteractions: planningLogs.length,
      taskBreakdownFrequency: taskBreakdownIndicators.length,
      averageTasksPerSession: taskBreakdownIndicators.length / Math.max(planningLogs.length, 1),
      planningPreference: taskBreakdownIndicators.length > planningLogs.length * 0.3 ? 'detailed' : 'high-level'
    };
  }

  categorizeWorkingTime(peakHours) {
    const morningHours = peakHours.filter(h => h >= 6 && h < 12);
    const afternoonHours = peakHours.filter(h => h >= 12 && h < 18);
    const eveningHours = peakHours.filter(h => h >= 18 && h < 24);
    const nightHours = peakHours.filter(h => h >= 0 && h < 6);
    
    if (morningHours.length >= afternoonHours.length && morningHours.length >= eveningHours.length) {
      return 'morning-person';
    } else if (eveningHours.length >= afternoonHours.length) {
      return 'evening-person';
    } else {
      return 'afternoon-person';
    }
  }

  calculateAverageDifficulty(interactions) {
    if (interactions.length === 0) return 'unknown';
    
    const difficultyScores = {
      'simple': 1,
      'medium': 2,
      'complex': 3
    };
    
    const totalScore = interactions.reduce((sum, interaction) => {
      return sum + (difficultyScores[interaction.difficulty] || 1);
    }, 0);
    
    const average = totalScore / interactions.length;
    
    if (average < 1.5) return 'simple';
    if (average < 2.5) return 'medium';
    return 'complex';
  }

  calculateLearningTrend(interactions) {
    if (interactions.length < 3) return 'insufficient-data';
    
    const recentInteractions = interactions.slice(-5);
    const olderInteractions = interactions.slice(0, -5);
    
    const recentAvgDifficulty = this.calculateAverageDifficulty(recentInteractions);
    const olderAvgDifficulty = this.calculateAverageDifficulty(olderInteractions);
    
    const difficultyScores = { 'simple': 1, 'medium': 2, 'complex': 3 };
    const recentScore = difficultyScores[recentAvgDifficulty] || 1;
    const olderScore = difficultyScores[olderAvgDifficulty] || 1;
    
    if (recentScore > olderScore) return 'improving';
    if (recentScore < olderScore) return 'declining';
    return 'stable';
  }

  // Add method to get technical memory statistics for admin commands
  async getStats() {
    await this.initialize();
    
    try {
      const discordCount = await this.discordLogs.countDocuments();
      const technicalCount = await this.technicalLogs.countDocuments();
      const projectCount = await this.projectContexts.countDocuments();
      const skillCount = await this.skillProgressions.countDocuments();
      
      const recentDiscordCount = await this.discordLogs.countDocuments({
        timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      });
      
      const recentProjectActivity = await this.projectContexts.countDocuments({
        lastActivity: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      });
      
      return `Discord interactions: ${discordCount}
Technical sessions: ${technicalCount}
Project contexts: ${projectCount}
Skill progressions tracked: ${skillCount}
Recent activity (7 days): ${recentDiscordCount} interactions, ${recentProjectActivity} active projects`;
    } catch (error) {
      logger.error('Error getting technical memory stats:', error);
      return 'Unable to retrieve technical memory statistics';
    }
  }
  
  analyzeTechnicalWeeklyPatterns(technicalSessions, discordLogs) {
    // Analyze technical work patterns by day of week
    const dayPatterns = {};
    
    [...technicalSessions, ...discordLogs].forEach(log => {
      const date = log.createdAt || log.timestamp;
      const day = date.toLocaleDateString('en-US', { weekday: 'long' });
      
      if (!dayPatterns[day]) {
        dayPatterns[day] = { 
          technicalSessions: 0, 
          discordActivity: 0, 
          codingActivity: 0,
          projectActivity: 0
        };
      }
      
      if (log.focusArea) { // Technical session
        dayPatterns[day].technicalSessions++;
      } else { // Discord log
        dayPatterns[day].discordActivity++;
        
        if (log.channel === 'coding' || log.technicalContext?.codeBlocks?.hasCode) {
          dayPatterns[day].codingActivity++;
        }
        
        if (log.channel === 'projects' || log.technicalContext?.isProjectRelated) {
          dayPatterns[day].projectActivity++;
        }
      }
    });
    
    return dayPatterns;
  }
  
  describeTechnicalWorkingPatterns(workflowPatterns) {
    const descriptions = [];
    
    if (workflowPatterns.workingHours?.preferredWorkingTime) {
      descriptions.push(`${workflowPatterns.workingHours.preferredWorkingTime}`);
    }
    
    if (workflowPatterns.taskBreakdownPatterns?.planningPreference) {
      descriptions.push(`${workflowPatterns.taskBreakdownPatterns.planningPreference} planning style`);
    }
    
    if (workflowPatterns.weeklyPatterns) {
      const mostActiveDay = Object.entries(workflowPatterns.weeklyPatterns)
        .sort(([,a], [,b]) => (b.technicalSessions + b.discordActivity) - (a.technicalSessions + a.discordActivity))
        [0]?.[0];
      
      if (mostActiveDay) {
        descriptions.push(`most active on ${mostActiveDay}s`);
      }
    }
    
    return descriptions.join(', ') || 'No clear working patterns';
  }
}