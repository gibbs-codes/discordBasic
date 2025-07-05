// src/utils/config.js - Environment Configuration Validation
import { logger } from './logger.js';

class ConfigValidator {
  constructor() {
    this.requiredVars = [
      'DISCORD_TOKEN',
      'MONGO_URI'
    ];
    
    this.optionalVars = [
      'OPENAI_API_KEY',
      'LLM_PROVIDER',
      'LLM_MODEL',
      'OLLAMA_URL',
      'RECONCILIATION_API_URL',
      'LOG_LEVEL'
    ];
  }

  validate() {
    logger.info('🔧 Validating configuration...');
    
    const missing = this.requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      logger.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
      logger.error('Please check your .env file and ensure all required variables are set.');
      process.exit(1);
    }

    // Validate LLM configuration
    this.validateLLMConfig();
    
    // Validate MongoDB URI
    this.validateMongoConfig();
    
    // Log configuration summary
    this.logConfigSummary();
    
    logger.info('✅ Configuration validation passed');
  }

  validateLLMConfig() {
    const provider = process.env.LLM_PROVIDER || 'openai';
    
    if (provider === 'openai') {
      if (!process.env.OPENAI_API_KEY) {
        logger.error('❌ OPENAI_API_KEY is required when using OpenAI provider');
        process.exit(1);
      }
    } else if (provider === 'ollama') {
      // Ollama doesn't require API key, but warn about URL
      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
      if (!ollamaUrl.startsWith('http')) {
        logger.warn('⚠️ OLLAMA_URL should start with http:// or https://');
      }
    } else {
      logger.error(`❌ Unknown LLM_PROVIDER: ${provider}. Use 'openai' or 'ollama'`);
      process.exit(1);
    }
  }

  validateMongoConfig() {
    const mongoUri = process.env.MONGO_URI;
    
    if (!mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://')) {
      logger.error('❌ MONGO_URI must start with mongodb:// or mongodb+srv://');
      process.exit(1);
    }

    // Check if using default MongoDB without authentication (development)
    if (mongoUri === 'mongodb://localhost:27017' || mongoUri.includes('localhost:27017')) {
      logger.warn('⚠️ Using local MongoDB without authentication. Fine for development.');
    }
  }

  logConfigSummary() {
    const config = {
      llm: {
        provider: process.env.LLM_PROVIDER || 'openai',
        model: process.env.LLM_MODEL || (process.env.LLM_PROVIDER === 'ollama' ? 'llama2' : 'gpt-4'),
        hasApiKey: process.env.LLM_PROVIDER === 'ollama' ? 'N/A' : !!process.env.OPENAI_API_KEY
      },
      database: {
        mongo: this.maskSensitive(process.env.MONGO_URI)
      },
      services: {
        reconciliationApi: process.env.RECONCILIATION_API_URL || 'http://localhost:3000'
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        logLevel: process.env.LOG_LEVEL || 'INFO'
      }
    };

    logger.info('📋 Configuration Summary:');
    logger.info(`   LLM Provider: ${config.llm.provider} (${config.llm.model})`);
    logger.info(`   API Key: ${config.llm.hasApiKey}`);
    logger.info(`   MongoDB: ${config.database.mongo}`);
    logger.info(`   Reconciliation API: ${config.services.reconciliationApi}`);
    logger.info(`   Environment: ${config.environment.nodeEnv}`);
    logger.info(`   Log Level: ${config.environment.logLevel}`);
  }

  maskSensitive(value) {
    if (!value) return 'Not set';
    
    // Mask everything except the protocol and last 4 characters
    if (value.length <= 8) return '***';
    
    const start = value.substring(0, 10); // mongodb://
    const end = value.substring(value.length - 4);
    const masked = '*'.repeat(Math.max(0, value.length - 14));
    
    return `${start}${masked}${end}`;
  }

  getConfig() {
    return {
      discord: {
        token: process.env.DISCORD_TOKEN
      },
      llm: {
        provider: process.env.LLM_PROVIDER || 'openai',
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.LLM_MODEL || (process.env.LLM_PROVIDER === 'ollama' ? 'llama2' : 'gpt-4'),
        ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434'
      },
      database: {
        mongoUri: process.env.MONGO_URI
      },
      services: {
        reconciliationApiUrl: process.env.RECONCILIATION_API_URL || 'http://localhost:3000'
      },
      logging: {
        level: process.env.LOG_LEVEL || 'INFO'
      }
    };
  }
}

export const configValidator = new ConfigValidator();

// Auto-validate on import
configValidator.validate();