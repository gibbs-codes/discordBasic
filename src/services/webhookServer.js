// src/services/webhookServer.js - Webhook Server for Reconciliation Data
import express from 'express';
import { LLMService } from './llm/LLMService.js';
import { ChannelHandler } from '../handlers/channelHandler.js';
import { logger } from '../utils/logger.js';

export class WebhookServer {
  constructor(discordClient) {
    this.app = express();
    this.discordClient = discordClient;
    this.llmService = new LLMService();
    this.channelHandler = new ChannelHandler();
    this.port = process.env.WEBHOOK_PORT || 3004;
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Parse JSON payloads
    this.app.use(express.json({ limit: '10mb' }));
    
    // Basic security headers
    this.app.use((req, res, next) => {
      res.header('X-Powered-By', 'Discord-Coach-Bot');
      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`📡 Webhook: ${req.method} ${req.path} from ${req.ip}`);
      next();
    });
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
        res.json({
        status: 'healthy',
        service: 'discord-coach-bot',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        discord: this.discordClient?.isReady() || false,
        port: this.port,
        environment: process.env.NODE_ENV || 'development'
        });
    });

  // Status endpoint for detailed monitoring
    this.app.get('/status', (req, res) => {
        res.json({
        service: 'accountability-discord-bot',
        status: 'running',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        discord: {
            connected: !!this.discordClient?.isReady(),
            guilds: this.discordClient?.guilds?.cache?.size || 0,
            user: this.discordClient?.user?.tag || 'Not connected'
        },
        webhook: {
            port: this.port,
            endpoints: ['/health', '/status', '/webhook/reconciliation']
        },
        llm: {
            provider: process.env.LLM_PROVIDER || 'not configured',
            model: process.env.LLM_MODEL || 'not configured'
        },
        mongodb: {
            configured: !!process.env.MONGO_URI
        }
        });
    });

    // Main reconciliation webhook endpoint
    this.app.post('/reconciliation', async (req, res) => {
      try {
        await this.handleReconciliationWebhook(req, res);
      } catch (error) {
        logger.error('Reconciliation webhook error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          message: error.message
        });
      }
    });

    // Alternative endpoint names for flexibility
    this.app.post('/reconcile', async (req, res) => {
      await this.handleReconciliationWebhook(req, res);
    });

    this.app.post('/webhook/reconciliation', async (req, res) => {
      await this.handleReconciliationWebhook(req, res);
    });

    // Manual trigger endpoint (for testing)
    this.app.post('/trigger/manual', async (req, res) => {
      try {
        const mockData = {
          type: 'manual_trigger',
          source: 'webhook_test',
          results: {
            date: new Date().toISOString().split('T')[0],
            summary: 'Manual trigger test',
            total_bonus_amount: 25,
            uber_earnings_processed: 15,
            new_punishments: [],
            debt_updates: []
          }
        };

        await this.processReconciliationData(mockData);

        res.json({
          success: true,
          message: 'Manual reconciliation triggered',
          data: mockData
        });
      } catch (error) {
        logger.error('Manual trigger error:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Function calling endpoint (future use)
    this.app.post('/function-call', async (req, res) => {
      try {
        await this.handleFunctionCall(req, res);
      } catch (error) {
        logger.error('Function call error:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        available_endpoints: [
          'GET /health',
          'POST /reconciliation',
          'POST /reconcile',
          'POST /webhook/reconciliation',
          'POST /trigger/manual',
          'POST /function-call'
        ]
      });
    });
  }

  // Main reconciliation webhook handler
  async handleReconciliationWebhook(req, res) {
    const reconciliationData = req.body;

    // Validate incoming data
    if (!reconciliationData || typeof reconciliationData !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid payload',
        message: 'Expected JSON object with reconciliation data'
      });
    }

    logger.info('📊 Received reconciliation data:', {
      type: reconciliationData.type,
      date: reconciliationData.results?.date,
      bonuses: reconciliationData.results?.total_bonus_amount,
      source: reconciliationData.source || 'unknown'
    });

    // Process the reconciliation data
    await this.processReconciliationData(reconciliationData);

    // Respond to sender
    res.json({
      success: true,
      message: 'Reconciliation processed and posted to Discord',
      timestamp: new Date().toISOString()
    });
  }

  // Process reconciliation data and post to Discord
  async processReconciliationData(reconciliationData) {
    if (!this.discordClient || !this.discordClient.isReady()) {
      throw new Error('Discord client not ready');
    }

    // Generate personalized lecture using LLM
    const lectureResponse = await this.llmService.generateReconciliationLecture(reconciliationData);

    // Post to all guilds' reviews channels
    const results = [];

    for (const guild of this.discordClient.guilds.cache.values()) {
      try {
        const reviewsChannel = this.channelHandler.getChannelByType(guild, 'reviews');

        if (reviewsChannel) {
          const embedData = this.createReconciliationEmbed(reconciliationData, lectureResponse);
          
          const message = await reviewsChannel.send(embedData);

          // Add performance tracking reactions
          await message.react('📈'); // Improving
          await message.react('📉'); // Declining  
          await message.react('💰'); // Financial focus needed
          await message.react('💪'); // Workout focus needed

          results.push({ 
            guild: guild.name, 
            success: true, 
            channelId: reviewsChannel.id,
            messageId: message.id
          });

          logger.info(`Posted reconciliation to ${guild.name}#${reviewsChannel.name}`);
        } else {
          logger.warn(`No reviews channel found in guild: ${guild.name}`);
          results.push({ guild: guild.name, success: false, reason: 'No reviews channel' });
        }
      } catch (guildError) {
        logger.error(`Failed to post to guild ${guild.name}:`, guildError);
        results.push({ guild: guild.name, success: false, reason: guildError.message });
      }
    }

    logger.info(`Reconciliation posted to ${results.filter(r => r.success).length} guilds`);
    return results;
  }

  // Create rich embed for reconciliation
  createReconciliationEmbed(reconciliationData, lectureResponse) {
    const results = reconciliationData.results || {};
    const isAutomatic = reconciliationData.type === 'daily';
    
    const embed = {
      embeds: [{
        title: `${isAutomatic ? '🌙 DAILY RECKONING' : '📊 RECONCILIATION COMPLETE'}`,
        description: lectureResponse,
        color: this.getEmbedColor(results),
        fields: this.getEmbedFields(results),
        footer: {
          text: `${reconciliationData.source || 'Decider App'} • ${new Date().toLocaleString()}`
        },
        timestamp: new Date().toISOString()
      }]
    };

    return embed;
  }

  // Get embed color based on performance
  getEmbedColor(results) {
    const bonuses = results.total_bonus_amount || 0;
    const newDebt = results.new_debt_assigned?.length || 0;
    const punishments = results.new_punishments?.length || 0;

    if (bonuses > 30 && newDebt === 0 && punishments === 0) {
      return 0x00FF00; // Green - excellent
    } else if (bonuses > 15 && newDebt <= 1) {
      return 0xFFFF00; // Yellow - decent
    } else if (newDebt > 2 || punishments > 2) {
      return 0xFF0000; // Red - poor
    } else {
      return 0xFF8C00; // Orange - mediocre
    }
  }

  // Get embed fields with key metrics
  getEmbedFields(results) {
    const fields = [];

    if (results.total_bonus_amount) {
      fields.push({
        name: '💰 Bonuses Earned',
        value: `$${results.total_bonus_amount}`,
        inline: true
      });
    }

    if (results.uber_earnings_processed) {
      fields.push({
        name: '🛵 Uber Earnings',
        value: `$${results.uber_earnings_processed}`,
        inline: true
      });
    }

    if (results.new_punishments?.length > 0) {
      fields.push({
        name: '⚡ New Punishments',
        value: `${results.new_punishments.length} assigned`,
        inline: true
      });
    }

    if (results.debt_updates?.length > 0) {
      const totalDebt = results.debt_updates.reduce((sum, debt) => sum + (debt.current_amount || 0), 0);
      fields.push({
        name: '💸 Current Debt',
        value: `$${totalDebt.toFixed(2)}`,
        inline: true
      });
    }

    return fields;
  }

  // Handle function calls from LLM (future feature)
  async handleFunctionCall(req, res) {
    const { function_name, parameters, context } = req.body;

    logger.info(`🔧 Function call: ${function_name}`, parameters);

    // This is where you'd implement LLM function calling
    // For now, just acknowledge the call
    res.json({
      success: true,
      function_name,
      parameters,
      result: 'Function calling not yet implemented',
      timestamp: new Date().toISOString()
    });
  }

  // Start the webhook server
  start() {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, (err) => {
        if (err) {
          logger.error(`Failed to start webhook server on port ${this.port}:`, err);
          reject(err);
        } else {
          logger.info(`🌐 Webhook server listening on port ${this.port}`);
          logger.info(`📡 Reconciliation endpoint: ${process.env.RECONCILIATION_API_URL}`);
          resolve();
        }
      });
    });
  }

  // Stop the webhook server
  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('🛑 Webhook server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Get server info
  getInfo() {
    return {
      port: this.port,
      endpoints: {
        health: `http://localhost:${this.port}/health`,
        reconciliation: `http://localhost:${this.port}/reconciliation`,
        manual_trigger: `http://localhost:${this.port}/trigger/manual`,
        function_call: `http://localhost:${this.port}/function-call`
      },
      isRunning: !!this.server
    };
  }
}