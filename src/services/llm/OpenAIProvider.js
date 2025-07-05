// src/services/llm/OpenAIProvider.js - OpenAI Implementation
import OpenAI from 'openai';
import { logger } from '../../utils/logger.js';

export class OpenAIProvider {
  constructor(config) {
    this.openai = new OpenAI({
      apiKey: config.apiKey
    });
    this.model = config.model || 'gpt-4';
    this.defaultOptions = {
      max_tokens: 500,
      temperature: 0.8
    };
  }

  async generateResponse(systemPrompt, userPrompt, options = {}) {
    try {
      const requestOptions = {
        ...this.defaultOptions,
        ...options
      };

      logger.info(`OpenAI request: model=${this.model}, max_tokens=${requestOptions.max_tokens}`);

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        ...requestOptions
      });

      const generatedText = response.choices[0].message.content.trim();
      
      logger.info(`OpenAI response: ${generatedText.length} characters`);
      
      return generatedText;

    } catch (error) {
      logger.error('OpenAI API error:', error);
      
      if (error.status === 401) {
        throw new Error('OpenAI API key is invalid or missing');
      } else if (error.status === 429) {
        throw new Error('OpenAI rate limit exceeded. Try again later.');
      } else if (error.status === 500) {
        throw new Error('OpenAI service temporarily unavailable');
      } else {
        throw new Error(`OpenAI API error: ${error.message}`);
      }
    }
  }

  async testConnection() {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a test assistant.' },
          { role: 'user', content: 'Say "connection test successful"' }
        ],
        max_tokens: 10
      });

      return response.choices[0].message.content.includes('successful');
    } catch (error) {
      logger.error('OpenAI connection test failed:', error);
      return false;
    }
  }

  getModelInfo() {
    return {
      provider: 'openai',
      model: this.model,
      maxTokens: this.defaultOptions.max_tokens,
      temperature: this.defaultOptions.temperature
    };
  }
}