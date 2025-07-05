// src/services/llm/LLMService.js - Enhanced LLM with Memory Integration
import { OpenAIProvider } from './OpenAIProvider.js';
import { OllamaProvider } from './OllamaProvider.js';
import { getSystemPrompts } from './prompts.js';
import { logger } from '../../utils/logger.js';

export class LLMService {
  constructor() {
    this.provider = this.initializeProvider();
  }

  initializeProvider() {
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

  async generateResponse(context) {
    try {
      const systemPrompt = this.buildSystemPrompt(context);
      const userPrompt = this.buildUserPrompt(context);
      
      logger.info(`Generating response for ${context.channelType} channel`);
      
      const response = await this.provider.generateResponse(systemPrompt, userPrompt);
      
      return response.trim();
      
    } catch (error) {
      logger.error('LLM generation error:', error);
      return this.getFallbackResponse(context.channelType);
    }
  }

  async generateReconciliationLecture(reconciliationData) {
    try {
      const systemPrompt = getSystemPrompts().reconciliation;
      const dataPrompt = this.buildReconciliationPrompt(reconciliationData);
      
      logger.info('Generating reconciliation lecture');
      
      const response = await this.provider.generateResponse(systemPrompt, dataPrompt);
      
      return response.trim();
      
    } catch (error) {
      logger.error('Reconciliation lecture error:', error);
      return "Your reconciliation failed spectacularly. Even your technology is disappointing. Check the logs and try again.";
    }
  }

  buildSystemPrompt(context) {
    const basePrompt = getSystemPrompts()[context.channelType] || getSystemPrompts().general;
    
    // Add memory context to make the AI more aware of patterns
    if (context.memoryContext?.summary) {
      return `${basePrompt}\n\n**IMPORTANT MEMORY CONTEXT:**\n${context.memoryContext.summary}\n\nUse this context to call out patterns, reference past commitments, and hold the user accountable for previous behavior. Be specific about their history when relevant.`;
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

  buildReconciliationPrompt(reconciliationData) {
    const results = reconciliationData.results || reconciliationData;
    
    let prompt = `Today's reconciliation data:\n`;
    prompt += `Date: ${results.date}\n`;
    prompt += `Summary: ${results.summary}\n\n`;
    
    // Financial details
    if (results.uber_earnings_processed) {
      prompt += `Uber earnings processed: $${results.uber_earnings_processed}\n`;
    }
    
    if (results.total_bonus_amount) {
      prompt += `Total bonuses earned: $${results.total_bonus_amount}\n`;
    }
    
    // Violations and punishments
    if (results.new_punishments?.length > 0) {
      prompt += `New punishments assigned: ${results.new_punishments.length}\n`;
      results.new_punishments.forEach(punishment => {
        prompt += `- ${punishment.type}: ${punishment.reason}\n`;
      });
    }
    
    // Debt updates
    if (results.debt_updates?.length > 0) {
      prompt += `Debt updates:\n`;
      results.debt_updates.forEach(debt => {
        prompt += `- $${debt.current_amount} (was $${debt.original_amount})\n`;
      });
    }
    
    // Bonuses earned
    if (results.new_bonuses?.length > 0) {
      prompt += `Bonuses earned:\n`;
      results.new_bonuses.forEach(bonus => {
        prompt += `- ${bonus.type}: $${bonus.amount}\n`;
      });
    }
    
    prompt += `\nAnalyze this data and deliver your coaching verdict. Be specific about performance, consequences, and what needs to improve. Use your commanding personality to address their progress.`;
    
    return prompt;
  }

  extractKeyInsights(memoryContext) {
    const insights = [];
    
    // Excuse patterns
    if (memoryContext.discordPatterns?.excusePatterns?.length > 2) {
      insights.push(`You've made ${memoryContext.discordPatterns.excusePatterns.length} excuses recently`);
    }
    
    // Begging frequency
    if (memoryContext.discordPatterns?.beggingFrequency > 3) {
      insights.push(`Excessive begging (${memoryContext.discordPatterns.beggingFrequency} requests)`);
    }
    
    // Mood patterns
    if (memoryContext.morningInsights?.length > 0) {
      const latestMood = memoryContext.morningInsights[0].mood;
      if (latestMood && latestMood !== 'Unknown') {
        insights.push(`Recent mood: ${latestMood}`);
      }
    }
    
    // Behavioral patterns
    if (memoryContext.behaviorPatterns?.channelAvoidance?.proofAvoidance) {
      insights.push('Avoiding proof submissions');
    }
    
    return insights.join(', ');
  }

  getFallbackResponse(channelType) {
    const fallbacks = {
      general: "My AI is down, but my disappointment in you remains constant. Try again later.",
      begging: "The answer is no. My systems might be down but my standards aren't.",
      proof: "I can't process this right now, but I'm sure it's mediocre anyway.",
      reviews: "System error. Your performance is probably disappointing as usual.",
      punishments: "SYSTEM ERROR: Punishment assignment failed. Consider yourself lucky... for now."
    };

    return fallbacks[channelType] || fallbacks.general;
  }

  async testConnection() {
    try {
      const testResponse = await this.generateResponse({
        message: "Test connection",
        channelType: "general",
        username: "System",
        memoryContext: { summary: "Test mode" }
      });
      
      logger.info(`✅ LLM ${process.env.LLM_PROVIDER} connection successful`);
      return true;
    } catch (error) {
      logger.error(`❌ LLM ${process.env.LLM_PROVIDER} connection failed:`, error);
      return false;
    }
  }
}