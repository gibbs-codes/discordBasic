// src/handlers/messageHandler.js - Core Message Processing
import { ChannelHandler } from './channelHandler.js';
import { ReconciliationHandler } from './reconciliationHandler.js';
import { LLMService } from '../services/llm/LLMService.js';
import { MemoryService } from '../services/memoryService.js';
import { logger } from '../utils/logger.js';

export class MessageHandler {
  constructor() {
    this.channelHandler = new ChannelHandler();
    this.reconciliationHandler = new ReconciliationHandler();
    this.llmService = new LLMService();
    this.memoryService = new MemoryService();
  }

  async handleMessage(message) {
    try {
      const channelType = this.channelHandler.getChannelType(message.channel.name);
      
      logger.info(`Message in ${channelType}: ${message.content.substring(0, 50)}...`);
      
      // Handle reconciliation triggers
      if (this.isReconciliationTrigger(message, channelType)) {
        await this.reconciliationHandler.handleReconciliationRequest(message);
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
      await message.reply('Something went wrong. Even I make mistakes sometimes.');
    }
  }

  async handleReaction(reaction, user) {
    try {
      const channelType = this.channelHandler.getChannelType(reaction.message.channel.name);
      
      if (channelType === 'proof' && reaction.emoji.name === '✅') {
        const context = {
          message: 'Proof verified for workout',
          channelType: 'proof',
          username: user.displayName,
          context: 'proof_verification'
        };
        
        const response = await this.llmService.generateResponse(context);
        await reaction.message.reply(response);
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

  isReconciliationTrigger(message, channelType) {
    const content = message.content.toLowerCase();
    return (
      channelType === 'general' && 
      (content.includes('reconcile') || content.includes('daily summary') || content.includes('run reconciliation'))
    );
  }
}