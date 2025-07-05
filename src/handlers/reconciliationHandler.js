// src/handlers/reconciliationHandler.js - Reconciliation Integration
import { ReconciliationService } from '../services/ReconciliationService.js';
import { LLMService } from '../services/llm/LLMService.js';
import { ChannelHandler } from './channelHandler.js';
import { logger } from '../utils/logger.js';

export class ReconciliationHandler {
  constructor() {
    this.reconciliationService = new ReconciliationService();
    this.llmService = new LLMService();
    this.channelHandler = new ChannelHandler();
  }

  // Handle manual reconciliation requests
  async handleReconciliationRequest(message) {
    try {
      logger.info(`Manual reconciliation requested by ${message.author.displayName}`);
      
      // Send initial response
      const initialReply = await message.reply('🔄 Running your daily reckoning... prepare yourself.');
      
      // Run reconciliation
      const reconciliationData = await this.reconciliationService.runReconciliation();
      
      // Generate personalized lecture using LLM
      const lectureResponse = await this.llmService.generateReconciliationLecture(reconciliationData);
      
      // Post full results in reviews channel, or current channel if reviews not found
      const reviewsChannel = this.channelHandler.getChannelByType(message.guild, 'reviews');
      const targetChannel = reviewsChannel || message.channel;
      
      if (reviewsChannel && reviewsChannel.id !== message.channel.id) {
        // Post full analysis in reviews channel
        await reviewsChannel.send(`📊 **MANUAL RECONCILIATION REQUESTED**\n\n${lectureResponse}`);
        
        // Update initial reply with pointer to reviews
        await initialReply.edit(`✅ Reconciliation complete. Check ${reviewsChannel} for your verdict.`);
      } else {
        // Post directly in current channel
        await targetChannel.send(`📊 **RECONCILIATION COMPLETE**\n\n${lectureResponse}`);
        await initialReply.delete(); // Remove the loading message
      }
      
      // Add reactions for user response
      const finalMessage = await targetChannel.messages.fetch({ limit: 1 });
      const lastMessage = finalMessage.first();
      await lastMessage.react('😤'); // Defensive
      await lastMessage.react('😔'); // Ashamed
      await lastMessage.react('💪'); // Motivated
      
      logger.info('Manual reconciliation completed successfully');
      
    } catch (error) {
      logger.error('Manual reconciliation failed:', error);
      
      // Send error response with personality
      const errorResponse = this.getErrorResponse(error);
      await message.reply(errorResponse);
    }
  }

  // Handle automatic daily reconciliation
  async handleAutomaticReconciliation(client) {
    try {
      logger.info('Running automatic daily reconciliation...');
      
      // Run reconciliation
      const reconciliationData = await this.reconciliationService.runReconciliation();
      
      // Generate lecture
      const lectureResponse = await this.llmService.generateReconciliationLecture(reconciliationData);
      
      // Post to all guilds' reviews channels
      const results = [];
      
      for (const guild of client.guilds.cache.values()) {
        try {
          const reviewsChannel = this.channelHandler.getChannelByType(guild, 'reviews');
          
          if (reviewsChannel) {
            const message = await reviewsChannel.send(
              `🌙 **DAILY RECKONING - ${new Date().toLocaleDateString()}**\n\n${lectureResponse}`
            );
            
            // Add performance tracking reactions
            await message.react('📈'); // Improving
            await message.react('📉'); // Declining  
            await message.react('💰'); // Financial focus needed
            await message.react('💪'); // Workout focus needed
            
            results.push({ guild: guild.name, success: true, channelId: reviewsChannel.id });
            
            logger.info(`Posted automatic reconciliation to ${guild.name}#${reviewsChannel.name}`);
          } else {
            logger.warn(`No reviews channel found in guild: ${guild.name}`);
            results.push({ guild: guild.name, success: false, reason: 'No reviews channel' });
          }
        } catch (guildError) {
          logger.error(`Failed to post reconciliation to guild ${guild.name}:`, guildError);
          results.push({ guild: guild.name, success: false, reason: guildError.message });
        }
      }
      
      logger.info(`Automatic reconciliation posted to ${results.filter(r => r.success).length} guilds`);
      return results;
      
    } catch (error) {
      logger.error('Automatic reconciliation failed:', error);
      
      // Try to post error to any available reviews channel
      for (const guild of client.guilds.cache.values()) {
        const reviewsChannel = this.channelHandler.getChannelByType(guild, 'reviews');
        if (reviewsChannel) {
          await reviewsChannel.send(
            `❌ **RECONCILIATION FAILED**\n\nYour daily reckoning failed to run. Even your systems are disappointing. Error: ${error.message}`
          );
          break; // Only post error once
        }
      }
      
      throw error;
    }
  }

  // Get error response with personality
  getErrorResponse(error) {
    const errorMessages = [
      "Your reconciliation failed spectacularly. Even your technology is disappointing.",
      "Can't even run a simple reconciliation. This is why you need accountability.",
      "System error detected. Unlike your excuses, this one is actually valid.",
      "Failed to process your pathetic performance data. Try again later.",
      "Even the API is embarrassed by your results and refused to respond."
    ];
    
    const randomMessage = errorMessages[Math.floor(Math.random() * errorMessages.length)];
    
    // Include specific error info for debugging
    let response = randomMessage;
    
    if (error.message.includes('reconciliation API')) {
      response += "\n\n*Reconciliation service is unavailable. Check if your decider app is running.*";
    } else if (error.message.includes('LLM')) {
      response += "\n\n*AI lecture generation failed. Your performance broke the AI.*";
    } else {
      response += `\n\n*Technical details: ${error.message}*`;
    }
    
    return response;
  }

  // Validate reconciliation service health
  async validateReconciliationService() {
    try {
      await this.reconciliationService.testConnection();
      logger.info('✅ Reconciliation service connection validated');
      return true;
    } catch (error) {
      logger.error('❌ Reconciliation service validation failed:', error);
      return false;
    }
  }

  // Get reconciliation history for context
  async getRecentReconciliationHistory(days = 7) {
    try {
      return await this.reconciliationService.getHistory('daily', days);
    } catch (error) {
      logger.error('Failed to get reconciliation history:', error);
      return null;
    }
  }

  // Parse reconciliation trigger from message
  isReconciliationTrigger(message) {
    const content = message.content.toLowerCase();
    const triggers = [
      'reconcile',
      'daily reconciliation', 
      'run reconciliation',
      'daily summary',
      'reconciliation summary',
      'run daily',
      'daily reckoning'
    ];
    
    return triggers.some(trigger => content.includes(trigger));
  }

  // Check if reconciliation is overdue (for warnings)
  async checkReconciliationStatus() {
    try {
      const history = await this.getRecentReconciliationHistory(1);
      
      if (!history || !history.daily_breakdown || history.daily_breakdown.length === 0) {
        return { status: 'overdue', message: 'No reconciliation run today' };
      }
      
      const lastRun = new Date(history.daily_breakdown[0].date);
      const today = new Date();
      const daysDiff = Math.floor((today - lastRun) / (1000 * 60 * 60 * 24));
      
      if (daysDiff > 1) {
        return { 
          status: 'overdue', 
          message: `Last reconciliation was ${daysDiff} days ago`,
          lastRun: lastRun
        };
      }
      
      return { status: 'current', message: 'Reconciliation up to date' };
      
    } catch (error) {
      logger.error('Failed to check reconciliation status:', error);
      return { status: 'unknown', message: 'Could not determine status' };
    }
  }
}