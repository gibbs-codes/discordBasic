// src/services/memoryService.js - Memory & Context Management
import { MongoClient } from 'mongodb';
import { logger } from '../utils/logger.js';

export class MemoryService {
  constructor() {
    this.client = new MongoClient(process.env.MONGO_URI);
    this.db = null;
    this.morningLogs = null;
    this.discordLogs = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      await this.client.connect();
      this.db = this.client.db('local_coaches');
      this.morningLogs = this.db.collection('logs'); // Your existing morning chat logs
      this.discordLogs = this.db.collection('discord_interactions'); // New collection for Discord interactions
      
      logger.info('✅ Memory service connected to MongoDB');
      this.initialized = true;
    } catch (error) {
      logger.error('❌ Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  // Store Discord interactions for future reference
  async storeInteraction(interaction) {
    await this.initialize();
    
    try {
      await this.discordLogs.insertOne({
        ...interaction,
        createdAt: new Date()
      });
    } catch (error) {
      logger.error('Failed to store interaction:', error);
    }
  }

  // Get relevant context for LLM from both morning chats and Discord history
  async getRelevantContext({ userId, channelType, currentMessage, lookbackDays = 14 }) {
    await this.initialize();
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

    try {
      // Get recent morning chat insights
      const morningInsights = await this.getRecentMorningInsights(cutoffDate);
      
      // Get Discord interaction patterns
      const discordPatterns = await this.getDiscordPatterns(userId, cutoffDate, channelType);
      
      // Get behavioral patterns and excuse tracking
      const behaviorPatterns = await this.analyzeBehaviorPatterns(userId, cutoffDate);
      
      return {
        morningInsights,
        discordPatterns,
        behaviorPatterns,
        summary: this.generateContextSummary(morningInsights, discordPatterns, behaviorPatterns)
      };
      
    } catch (error) {
      logger.error('Error getting context:', error);
      return { summary: 'Memory context unavailable' };
    }
  }

  // Extract insights from your morning chat logs
  async getRecentMorningInsights(cutoffDate) {
    try {
      const recentLogs = await this.morningLogs
        .find({ 
          createdAt: { $gte: cutoffDate },
          type: 'enhanced_coaching_session' // From your morningchats repo
        })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();

      return recentLogs.map(log => {
        const analysis = log.sessionAnalysis || {};
        return {
          date: log.createdAt,
          mood: analysis.mood_energy?.mood || 'Unknown',
          energy: analysis.mood_energy?.energy_level || 'Unknown',
          priorities: analysis.priorities || 'None set',
          goals: analysis.goals || 'No goals mentioned',
          notes: analysis.notes || '',
          duration: log.duration || 0
        };
      });
    } catch (error) {
      logger.error('Error getting morning insights:', error);
      return [];
    }
  }

  // Analyze Discord interaction patterns
  async getDiscordPatterns(userId, cutoffDate, currentChannelType) {
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
      const excusePatterns = [];
      const commitmentPatterns = [];

      recentInteractions.forEach(interaction => {
        const channel = interaction.channel;
        if (!channelBreakdown[channel]) {
          channelBreakdown[channel] = { count: 0, topics: [] };
        }
        channelBreakdown[channel].count++;
        
        // Track excuse patterns
        if (this.detectExcuse(interaction.userMessage)) {
          excusePatterns.push({
            date: interaction.timestamp,
            channel,
            excuse: interaction.userMessage,
            response: interaction.botResponse
          });
        }
        
        // Track commitments
        if (this.detectCommitment(interaction.userMessage)) {
          commitmentPatterns.push({
            date: interaction.timestamp,
            channel,
            commitment: interaction.userMessage
          });
        }
      });

      return {
        totalInteractions: recentInteractions.length,
        channelBreakdown,
        excusePatterns: excusePatterns.slice(0, 5), // Last 5 excuses
        commitmentPatterns: commitmentPatterns.slice(0, 5), // Last 5 commitments
        beggingFrequency: channelBreakdown.begging?.count || 0
      };
    } catch (error) {
      logger.error('Error analyzing Discord patterns:', error);
      return {};
    }
  }

  // Analyze behavioral patterns for coaching insights
  async analyzeBehaviorPatterns(userId, cutoffDate) {
    try {
      // Combine morning logs and Discord patterns
      const morningLogs = await this.morningLogs
        .find({ createdAt: { $gte: cutoffDate } })
        .toArray();
        
      const discordLogs = await this.discordLogs
        .find({ userId, timestamp: { $gte: cutoffDate } })
        .toArray();

      // Pattern analysis
      const moodTrends = this.analyzeMoodTrends(morningLogs);
      const excuseFrequency = this.analyzeExcuseFrequency(discordLogs);
      const channelAvoidance = this.analyzeChannelAvoidance(discordLogs);
      
      return {
        moodTrends,
        excuseFrequency,
        channelAvoidance,
        weeklyPatterns: this.analyzeWeeklyPatterns(morningLogs, discordLogs)
      };
    } catch (error) {
      logger.error('Error analyzing behavior patterns:', error);
      return {};
    }
  }

  // Generate a summary for the LLM to use
  generateContextSummary(morningInsights, discordPatterns, behaviorPatterns) {
    let summary = "RECENT CONTEXT:\n\n";
    
    // Morning chat patterns
    if (morningInsights.length > 0) {
      const latestMood = morningInsights[0];
      summary += `Latest morning session (${latestMood.date?.toDateString()}): Mood was ${latestMood.mood}, energy ${latestMood.energy}. `;
      summary += `Priorities: ${latestMood.priorities}. Goals: ${latestMood.goals}\n\n`;
      
      // Mood trends
      const moodCounts = morningInsights.reduce((acc, log) => {
        acc[log.mood] = (acc[log.mood] || 0) + 1;
        return acc;
      }, {});
      
      summary += `Recent mood trends: ${Object.entries(moodCounts)
        .sort(([,a], [,b]) => b - a)
        .map(([mood, count]) => `${mood} (${count}x)`)
        .join(', ')}\n\n`;
    }
    
    // Discord behavior patterns
    if (discordPatterns.excusePatterns?.length > 0) {
      summary += `EXCUSE PATTERNS: You've made ${discordPatterns.excusePatterns.length} excuses recently. `;
      summary += `Latest: "${discordPatterns.excusePatterns[0].excuse}"\n\n`;
    }
    
    if (discordPatterns.beggingFrequency > 3) {
      summary += `BEGGING ALERT: ${discordPatterns.beggingFrequency} begging requests in the last 2 weeks. Getting needy.\n\n`;
    }
    
    // Behavioral insights
    if (behaviorPatterns.weeklyPatterns) {
      summary += `WEEKLY PATTERNS: ${this.describeWeeklyPatterns(behaviorPatterns.weeklyPatterns)}\n\n`;
    }
    
    return summary.trim() || "No significant patterns detected.";
  }

  // Helper methods for pattern detection
  detectExcuse(message) {
    const excuseKeywords = ['but', 'because', 'couldn\'t', 'too tired', 'too busy', 'forgot', 'sick', 'didn\'t have time'];
    return excuseKeywords.some(keyword => message.toLowerCase().includes(keyword));
  }
  
  detectCommitment(message) {
    const commitmentKeywords = ['will', 'going to', 'promise', 'commit', 'plan to', 'definitely'];
    return commitmentKeywords.some(keyword => message.toLowerCase().includes(keyword));
  }
  
  analyzeMoodTrends(logs) {
    // Analyze mood patterns over time
    return logs.reduce((trends, log) => {
      const mood = log.sessionAnalysis?.mood_energy?.mood || 'Unknown';
      trends[mood] = (trends[mood] || 0) + 1;
      return trends;
    }, {});
  }
  
  analyzeExcuseFrequency(logs) {
    return logs.filter(log => this.detectExcuse(log.userMessage)).length;
  }
  
  analyzeChannelAvoidance(logs) {
    const channelCounts = logs.reduce((counts, log) => {
      counts[log.channel] = (counts[log.channel] || 0) + 1;
      return counts;
    }, {});
    
    // Detect if avoiding certain channels
    return {
      proofAvoidance: (channelCounts.proof || 0) < (channelCounts.begging || 0),
      channelCounts
    };
  }
  
  analyzeWeeklyPatterns(morningLogs, discordLogs) {
    // Analyze patterns by day of week
    const dayPatterns = {};
    
    [...morningLogs, ...discordLogs].forEach(log => {
      const date = log.createdAt || log.timestamp;
      const day = date.toLocaleDateString('en-US', { weekday: 'long' });
      
      if (!dayPatterns[day]) {
        dayPatterns[day] = { morningCheckIns: 0, discordActivity: 0 };
      }
      
      if (log.type === 'enhanced_coaching_session') {
        dayPatterns[day].morningCheckIns++;
      } else {
        dayPatterns[day].discordActivity++;
      }
    });
    
    return dayPatterns;
  }
  
  describeWeeklyPatterns(patterns) {
    const descriptions = [];
    
    Object.entries(patterns).forEach(([day, data]) => {
      if (data.morningCheckIns === 0) {
        descriptions.push(`Skips ${day} morning check-ins`);
      }
      if (data.discordActivity > 10) {
        descriptions.push(`Very chatty on ${day}s`);
      }
    });
    
    return descriptions.join(', ') || 'No clear weekly patterns';
  }
}