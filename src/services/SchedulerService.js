// src/services/schedulerService.js - Automated Reconciliation Scheduling
import cron from 'node-cron';
import { ReconciliationHandler } from '../handlers/reconciliationHandler.js';
import { logger } from '../utils/logger.js';

export class SchedulerService {
  constructor() {
    this.reconciliationHandler = new ReconciliationHandler();
    this.scheduledJobs = new Map();
    this.isStarted = false;
  }

  // Start the automatic reconciliation schedule
  startReconciliationSchedule(discordClient) {
    if (this.isStarted) {
      logger.warn('Scheduler already started');
      return;
    }

    this.discordClient = discordClient;
    
    // Daily reconciliation at 11 PM Central Time
    // Using Chicago timezone since you're in Lakeview
    const dailyReconciliationJob = cron.schedule('0 23 * * *', async () => {
      await this.runDailyReconciliation();
    }, {
      scheduled: false,
      timezone: "America/Chicago"
    });

    // Validation check at startup (5 minutes after bot starts)
    const startupValidationJob = cron.schedule('*/5 * * * *', async () => {
      await this.runStartupValidation();
      startupValidationJob.stop(); // Only run once
    }, {
      scheduled: false
    });

    // Health check every 6 hours
    const healthCheckJob = cron.schedule('0 */6 * * *', async () => {
      await this.runHealthCheck();
    }, {
      scheduled: false,
      timezone: "America/Chicago"
    });

    // Start all jobs
    dailyReconciliationJob.start();
    startupValidationJob.start();
    healthCheckJob.start();

    // Store jobs for management
    this.scheduledJobs.set('dailyReconciliation', dailyReconciliationJob);
    this.scheduledJobs.set('startupValidation', startupValidationJob);
    this.scheduledJobs.set('healthCheck', healthCheckJob);

    this.isStarted = true;

    logger.info('✅ Scheduler started');
    logger.info('📅 Daily reconciliation: 11:00 PM Central Time');
    logger.info('🔍 Startup validation: 5 minutes');
    logger.info('💓 Health checks: Every 6 hours');
  }

  // Run automatic daily reconciliation
  async runDailyReconciliation() {
    try {
      logger.info('🌙 Starting automatic daily reconciliation...');
      
      if (!this.discordClient) {
        throw new Error('Discord client not available');
      }

      // Validate client is ready
      if (!this.discordClient.isReady()) {
        logger.warn('Discord client not ready, skipping reconciliation');
        return;
      }

      // Run reconciliation and post to all guilds
      const results = await this.reconciliationHandler.handleAutomaticReconciliation(this.discordClient);
      
      const successCount = results.filter(r => r.success).length;
      const totalGuilds = results.length;
      
      logger.info(`✅ Automatic reconciliation completed: ${successCount}/${totalGuilds} guilds successful`);
      
      // Log any failures
      const failures = results.filter(r => !r.success);
      failures.forEach(failure => {
        logger.warn(`Failed to post to guild ${failure.guild}: ${failure.reason}`);
      });

    } catch (error) {
      logger.error('❌ Automatic daily reconciliation failed:', error);
      
      // Try to post error to any available channel
      await this.postErrorToDiscord('Daily reconciliation failed', error.message);
    }
  }

  // Run startup validation
  async runStartupValidation() {
    try {
      logger.info('🔍 Running startup validation...');
      
      // Test reconciliation service connection
      const isReconciliationHealthy = await this.reconciliationHandler.validateReconciliationService();
      
      if (!isReconciliationHealthy) {
        await this.postErrorToDiscord(
          'Startup Warning', 
          'Reconciliation service is not responding. Check if your decider app is running.'
        );
      }

      // Validate Discord channel setup for each guild
      if (this.discordClient && this.discordClient.isReady()) {
        for (const guild of this.discordClient.guilds.cache.values()) {
          const validation = this.reconciliationHandler.channelHandler.validateChannelSetup(guild);
          
          if (validation.missingChannels.length > 0) {
            logger.warn(`Guild ${guild.name} missing channels: ${validation.missingChannels.join(', ')}`);
          }
        }
      }

      logger.info('✅ Startup validation completed');

    } catch (error) {
      logger.error('❌ Startup validation failed:', error);
    }
  }

  // Run periodic health checks
  async runHealthCheck() {
    try {
      logger.info('💓 Running health check...');
      
      // Check reconciliation service
      const isReconciliationHealthy = await this.reconciliationHandler.validateReconciliationService();
      
      // Check Discord client status
      const isDiscordHealthy = this.discordClient && this.discordClient.isReady();
      
      // Check recent reconciliation status
      const reconciliationStatus = await this.reconciliationHandler.checkReconciliationStatus();
      
      const healthReport = {
        timestamp: new Date().toISOString(),
        reconciliationService: isReconciliationHealthy ? 'healthy' : 'unhealthy',
        discordClient: isDiscordHealthy ? 'healthy' : 'unhealthy',
        lastReconciliation: reconciliationStatus.status,
        uptime: process.uptime()
      };

      logger.info('Health check results:', healthReport);

      // Alert if reconciliation is overdue
      if (reconciliationStatus.status === 'overdue') {
        await this.postErrorToDiscord(
          'Reconciliation Overdue', 
          reconciliationStatus.message
        );
      }

    } catch (error) {
      logger.error('❌ Health check failed:', error);
    }
  }

  // Post error messages to Discord
  async postErrorToDiscord(title, message) {
    try {
      if (!this.discordClient || !this.discordClient.isReady()) {
        return;
      }

      // Find a reviews channel in any guild to post errors
      for (const guild of this.discordClient.guilds.cache.values()) {
        const reviewsChannel = this.reconciliationHandler.channelHandler.getChannelByType(guild, 'reviews');
        
        if (reviewsChannel) {
          await reviewsChannel.send(`⚠️ **${title}**\n\n${message}`);
          logger.info(`Posted error to ${guild.name}#${reviewsChannel.name}`);
          break; // Only post to one channel
        }
      }
    } catch (error) {
      logger.error('Failed to post error to Discord:', error);
    }
  }

  // Stop all scheduled jobs
  stopScheduler() {
    if (!this.isStarted) {
      logger.warn('Scheduler not started');
      return;
    }

    this.scheduledJobs.forEach((job, name) => {
      job.stop();
      logger.info(`Stopped ${name} job`);
    });

    this.scheduledJobs.clear();
    this.isStarted = false;

    logger.info('🛑 Scheduler stopped');
  }

  // Manual trigger for testing
  async triggerManualReconciliation() {
    if (!this.discordClient) {
      throw new Error('Discord client not available');
    }

    logger.info('🔧 Manual reconciliation triggered');
    return await this.reconciliationHandler.handleAutomaticReconciliation(this.discordClient);
  }

  // Get scheduler status
  getStatus() {
    return {
      isStarted: this.isStarted,
      activeJobs: Array.from(this.scheduledJobs.keys()),
      nextReconciliation: this.getNextReconciliationTime(),
      uptime: process.uptime()
    };
  }

  // Get next reconciliation time
  getNextReconciliationTime() {
    if (!this.isStarted) {
      return null;
    }

    const now = new Date();
    const next = new Date();
    
    // Set to 11 PM today
    next.setHours(23, 0, 0, 0);
    
    // If it's already past 11 PM, set to tomorrow
    if (now.getHours() >= 23) {
      next.setDate(next.getDate() + 1);
    }

    return next.toISOString();
  }

  // Add custom scheduled job
  addCustomJob(name, cronExpression, jobFunction, options = {}) {
    if (this.scheduledJobs.has(name)) {
      logger.warn(`Job ${name} already exists`);
      return false;
    }

    const job = cron.schedule(cronExpression, jobFunction, {
      scheduled: false,
      timezone: "America/Chicago",
      ...options
    });

    job.start();
    this.scheduledJobs.set(name, job);

    logger.info(`Added custom job: ${name}`);
    return true;
  }

  // Remove custom job
  removeCustomJob(name) {
    const job = this.scheduledJobs.get(name);
    
    if (job) {
      job.stop();
      this.scheduledJobs.delete(name);
      logger.info(`Removed job: ${name}`);
      return true;
    }

    return false;
  }
}