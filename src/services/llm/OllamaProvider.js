// src/services/llm/OllamaProvider.js - Ollama Implementation
import axios from 'axios';
import { logger } from '../../utils/logger.js';

export class OllamaProvider {
  constructor(config) {
    this.baseUrl = config.url || 'http://localhost:11434';
    this.model = config.model || 'llama2';
    this.defaultOptions = {
      temperature: 0.8,
      max_tokens: 500
    };
  }

  async generateResponse(systemPrompt, userPrompt, options = {}) {
    try {
      const requestOptions = {
        ...this.defaultOptions,
        ...options
      };

      // Combine system and user prompts for Ollama
      const combinedPrompt = `${systemPrompt}\n\nUser: ${userPrompt}\nAssistant:`;

      logger.info(`Ollama request: model=${this.model}, temp=${requestOptions.temperature}`);

      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model: this.model,
        prompt: combinedPrompt,
        stream: false,
        options: {
          temperature: requestOptions.temperature,
          num_predict: requestOptions.max_tokens
        }
      }, {
        timeout: 30000 // 30 second timeout
      });

      const generatedText = response.data.response.trim();
      
      logger.info(`Ollama response: ${generatedText.length} characters`);
      
      return generatedText;

    } catch (error) {
      logger.error('Ollama API error:', error);
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Ollama service not running. Start Ollama first.');
      } else if (error.response?.status === 404) {
        throw new Error(`Ollama model '${this.model}' not found. Pull the model first.`);
      } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        throw new Error('Ollama request timed out. Model may be loading.');
      } else {
        throw new Error(`Ollama API error: ${error.message}`);
      }
    }
  }

  async testConnection() {
    try {
      // Test if Ollama is running
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000
      });

      // Check if our model exists
      const models = response.data.models || [];
      const modelExists = models.some(model => model.name.includes(this.model));

      if (!modelExists) {
        logger.warn(`Model '${this.model}' not found in Ollama. Available models:`, 
          models.map(m => m.name));
        return false;
      }

      // Test generation
      const testResponse = await this.generateResponse(
        'You are a test assistant.',
        'Say "connection test successful"',
        { max_tokens: 10 }
      );

      return testResponse.toLowerCase().includes('successful');
    } catch (error) {
      logger.error('Ollama connection test failed:', error);
      return false;
    }
  }

  async listAvailableModels() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      return response.data.models?.map(model => model.name) || [];
    } catch (error) {
      logger.error('Failed to list Ollama models:', error);
      return [];
    }
  }

  getModelInfo() {
    return {
      provider: 'ollama',
      model: this.model,
      baseUrl: this.baseUrl,
      maxTokens: this.defaultOptions.max_tokens,
      temperature: this.defaultOptions.temperature
    };
  }
}