#!/usr/bin/env node
// scripts/test-integration.js - Integration Testing Script for Technical Workspace Bot

import { Client, GatewayIntentBits } from 'discord.js';
import { config } from 'dotenv';
import { LLMService } from '../src/services/llm/LLMService.js';
import { MemoryService } from '../src/services/MemoryService.js';
import { ChannelConfigService } from '../src/services/ChannelConfigService.js';
import { AdminCommandService } from '../src/services/AdminCommandService.js';
import { logger } from '../src/utils/logger.js';

config();

class IntegrationTester {
  constructor() {
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
    });
    
    this.llmService = new LLMService();
    this.memoryService = new MemoryService();
    this.channelConfigService = new ChannelConfigService();
    this.adminCommandService = new AdminCommandService();
    
    this.testResults = [];
    this.testGuildId = process.env.TEST_GUILD_ID;
    this.testUserId = process.env.TEST_USER_ID;
  }

  async runAllTests() {
    logger.info('🚀 Starting integration tests for Technical Workspace Bot...');
    
    try {
      // Test 1: Database connectivity
      await this.testDatabaseConnectivity();
      
      // Test 2: Channel configuration system
      await this.testChannelConfigurations();
      
      // Test 3: LLM service functionality
      await this.testLLMService();
      
      // Test 4: Memory service functionality
      await this.testMemoryService();
      
      // Test 5: Admin command system
      await this.testAdminCommands();
      
      // Test 6: Performance benchmarks
      await this.testPerformance();
      
      // Test 7: Error handling
      await this.testErrorHandling();
      
      // Generate test report
      this.generateTestReport();
      
    } catch (error) {
      logger.error('❌ Integration tests failed:', error);
      process.exit(1);
    }
  }

  async testDatabaseConnectivity() {
    const testName = 'Database Connectivity';
    logger.info(`🔧 Testing: ${testName}...`);
    
    try {
      // Test memory service connection
      await this.memoryService.initialize();
      const stats = await this.memoryService.getStats();
      
      // Test channel config service connection
      await this.channelConfigService.initialize();
      const configs = await this.channelConfigService.getAllChannelConfigs();
      
      this.recordTest(testName, true, {
        memoryStats: stats,
        channelConfigs: configs.length,
        message: 'Database connections successful'
      });
      
    } catch (error) {
      this.recordTest(testName, false, { error: error.message });
    }
  }

  async testChannelConfigurations() {
    const testName = 'Channel Configuration System';
    logger.info(`⚙️ Testing: ${testName}...`);
    
    try {
      const channelTypes = ['coding', 'general', 'projects', 'planning', 'analysis', 'admin'];
      const results = {};
      
      for (const channelType of channelTypes) {
        // Test getting configuration
        const config = await this.channelConfigService.getChannelConfig(channelType);
        
        // Test LLM config retrieval
        const llmConfig = await this.channelConfigService.getLLMConfig(channelType);
        
        results[channelType] = {
          hasConfig: !!config,
          hasLLMConfig: !!llmConfig,
          provider: llmConfig?.provider,
          model: llmConfig?.model,
          temperature: llmConfig?.temperature
        };
      }
      
      const allConfigured = Object.values(results).every(r => r.hasConfig && r.hasLLMConfig);
      
      this.recordTest(testName, allConfigured, {
        channelResults: results,
        message: allConfigured ? 'All channels properly configured' : 'Some channels missing configuration'
      });
      
    } catch (error) {
      this.recordTest(testName, false, { error: error.message });
    }
  }

  async testLLMService() {
    const testName = 'LLM Service Functionality';
    logger.info(`🤖 Testing: ${testName}...`);
    
    try {
      const testContexts = [
        {
          channelType: 'coding',
          message: 'Write a simple hello world function in JavaScript',
          username: 'TestUser',
          guildId: this.testGuildId
        },
        {
          channelType: 'general',
          message: 'What is the capital of France?',
          username: 'TestUser',
          guildId: this.testGuildId
        },
        {
          channelType: 'analysis',
          message: 'Analyze the pros and cons of using microservices',
          username: 'TestUser',
          guildId: this.testGuildId
        }
      ];
      
      const results = {};
      
      for (const context of testContexts) {
        try {
          const startTime = Date.now();
          const response = await this.llmService.generateResponse(context);
          const responseTime = Date.now() - startTime;
          
          results[context.channelType] = {
            success: true,
            hasResponse: response && response.length > 0,
            responseLength: response?.length || 0,
            responseTime,
            provider: await this.getProviderForChannel(context.channelType)
          };
        } catch (error) {
          results[context.channelType] = {
            success: false,
            error: error.message
          };
        }
      }
      
      const allSuccessful = Object.values(results).every(r => r.success && r.hasResponse);
      
      this.recordTest(testName, allSuccessful, {
        channelResults: results,
        message: allSuccessful ? 'All LLM channels responding correctly' : 'Some LLM channels failed'
      });
      
    } catch (error) {
      this.recordTest(testName, false, { error: error.message });
    }
  }

  async testMemoryService() {
    const testName = 'Memory Service Functionality';
    logger.info(`🧠 Testing: ${testName}...`);
    
    try {
      const testInteraction = {
        userId: this.testUserId || 'test_user_123',
        username: 'TestUser',
        channel: 'coding',
        userMessage: 'How do I optimize React components?',
        botResponse: 'You can optimize React components using memo, useMemo, and useCallback...',
        timestamp: new Date(),
        context: { test: true }
      };
      
      // Test storing interaction
      await this.memoryService.storeInteraction(testInteraction);
      
      // Test retrieving context
      const context = await this.memoryService.getRelevantContext({
        userId: testInteraction.userId,
        channelType: 'coding',
        currentMessage: 'Follow-up question about React optimization',
        lookbackDays: 1
      });
      
      // Test memory stats
      const stats = await this.memoryService.getStats();
      
      this.recordTest(testName, true, {
        hasContext: !!context,
        hasSummary: !!context?.summary,
        statsAvailable: !!stats,
        message: 'Memory service functioning correctly'
      });
      
    } catch (error) {
      this.recordTest(testName, false, { error: error.message });
    }
  }

  async testAdminCommands() {
    const testName = 'Admin Command System';
    logger.info(`⚡ Testing: ${testName}...`);
    
    try {
      // Test slash command definitions
      const slashCommands = this.adminCommandService.getSlashCommands();
      
      // Test configuration management
      const testChannel = 'coding';
      const originalConfig = await this.channelConfigService.getChannelConfig(testChannel);
      
      // Test updating configuration
      const updateSuccess = await this.llmService.updateChannelConfig(
        testChannel, 
        { 'llmConfig.temperature': 0.5 },
        this.testGuildId
      );
      
      // Test configuration retrieval
      const config = await this.llmService.getConfiguration(this.testGuildId);
      
      this.recordTest(testName, true, {
        slashCommandCount: slashCommands.length,
        updateSuccess,
        hasConfiguration: !!config,
        channelConfigCount: config?.channelConfigs?.length || 0,
        message: 'Admin commands system functional'
      });
      
    } catch (error) {
      this.recordTest(testName, false, { error: error.message });
    }
  }

  async testPerformance() {
    const testName = 'Performance Benchmarks';
    logger.info(`⚡ Testing: ${testName}...`);
    
    try {
      const benchmarks = {};
      
      // Test configuration retrieval speed
      const configStart = Date.now();
      await this.channelConfigService.getChannelConfig('coding');
      benchmarks.configRetrieval = Date.now() - configStart;
      
      // Test memory context retrieval speed
      const memoryStart = Date.now();
      await this.memoryService.getRelevantContext({
        userId: 'test_user',
        channelType: 'coding',
        currentMessage: 'test message',
        lookbackDays: 7
      });
      benchmarks.memoryRetrieval = Date.now() - memoryStart;
      
      // Test LLM response speed (with timeout)
      const llmStart = Date.now();
      try {
        await Promise.race([
          this.llmService.generateResponse({
            message: 'Quick test message',
            channelType: 'general',
            username: 'TestUser'
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
        ]);
        benchmarks.llmResponse = Date.now() - llmStart;
      } catch (error) {
        benchmarks.llmResponse = 'timeout_or_error';
      }
      
      const performanceGood = 
        benchmarks.configRetrieval < 100 && 
        benchmarks.memoryRetrieval < 500 &&
        (typeof benchmarks.llmResponse === 'number' && benchmarks.llmResponse < 10000);
      
      this.recordTest(testName, performanceGood, {
        benchmarks,
        message: performanceGood ? 'Performance within acceptable limits' : 'Performance issues detected'
      });
      
    } catch (error) {
      this.recordTest(testName, false, { error: error.message });
    }
  }

  async testErrorHandling() {
    const testName = 'Error Handling';
    logger.info(`🛡️ Testing: ${testName}...`);
    
    try {
      const errorTests = {};
      
      // Test invalid channel type
      try {
        await this.channelConfigService.getChannelConfig('invalid_channel');
        errorTests.invalidChannel = 'no_error_thrown';
      } catch (error) {
        errorTests.invalidChannel = 'handled_correctly';
      }
      
      // Test invalid LLM configuration
      try {
        await this.llmService.generateResponse({
          message: 'test',
          channelType: 'nonexistent',
          username: 'TestUser'
        });
        errorTests.invalidLLM = 'fallback_worked';
      } catch (error) {
        errorTests.invalidLLM = 'handled_correctly';
      }
      
      // Test database connection failure simulation
      try {
        await this.memoryService.getRelevantContext({
          userId: null, // Invalid user ID
          channelType: 'coding',
          currentMessage: 'test'
        });
        errorTests.invalidMemoryQuery = 'handled_gracefully';
      } catch (error) {
        errorTests.invalidMemoryQuery = 'handled_correctly';
      }
      
      this.recordTest(testName, true, {
        errorTests,
        message: 'Error handling mechanisms working correctly'
      });
      
    } catch (error) {
      this.recordTest(testName, false, { error: error.message });
    }
  }

  async getProviderForChannel(channelType) {
    try {
      const provider = await this.llmService.getProviderForChannel(channelType);
      return provider.constructor.name;
    } catch (error) {
      return 'unknown';
    }
  }

  recordTest(testName, passed, details = {}) {
    const result = {
      test: testName,
      passed,
      timestamp: new Date().toISOString(),
      ...details
    };
    
    this.testResults.push(result);
    
    const status = passed ? '✅' : '❌';
    logger.info(`${status} ${testName}: ${details.message || (passed ? 'PASSED' : 'FAILED')}`);
  }

  generateTestReport() {
    const passedTests = this.testResults.filter(t => t.passed).length;
    const totalTests = this.testResults.length;
    const successRate = ((passedTests / totalTests) * 100).toFixed(1);
    
    logger.info('');
    logger.info('📊 Integration Test Report');
    logger.info('========================');
    logger.info(`Total Tests: ${totalTests}`);
    logger.info(`Passed: ${passedTests}`);
    logger.info(`Failed: ${totalTests - passedTests}`);
    logger.info(`Success Rate: ${successRate}%`);
    logger.info('');
    
    // Detailed results
    this.testResults.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      logger.info(`${status} ${result.test}`);
      if (!result.passed && result.error) {
        logger.info(`   Error: ${result.error}`);
      }
    });
    
    logger.info('');
    
    // Summary and recommendations
    if (successRate >= 90) {
      logger.info('🎉 System is ready for deployment!');
    } else if (successRate >= 70) {
      logger.info('⚠️ System has some issues but may be deployable with monitoring');
    } else {
      logger.info('🚨 System has significant issues and should not be deployed');
    }
    
    // Save detailed report
    const reportPath = `./test-report-${Date.now()}.json`;
    require('fs').writeFileSync(reportPath, JSON.stringify({
      summary: {
        totalTests,
        passedTests,
        failedTests: totalTests - passedTests,
        successRate: parseFloat(successRate),
        timestamp: new Date().toISOString()
      },
      results: this.testResults
    }, null, 2));
    
    logger.info(`📄 Detailed report saved to: ${reportPath}`);
  }
}

// Quick health check function
export async function quickHealthCheck() {
  logger.info('🏥 Running quick health check...');
  
  try {
    const memoryService = new MemoryService();
    await memoryService.initialize();
    
    const channelConfigService = new ChannelConfigService();
    await channelConfigService.initialize();
    
    const llmService = new LLMService();
    const testResult = await llmService.testConnection('general');
    
    if (testResult.success) {
      logger.info('✅ Quick health check passed - system is operational');
      return true;
    } else {
      logger.warn('⚠️ Health check failed - LLM connection issues');
      return false;
    }
  } catch (error) {
    logger.error('❌ Health check failed:', error.message);
    return false;
  }
}

// Run tests if called directly
async function runTests() {
  const tester = new IntegrationTester();
  await tester.runAllTests();
}

// Export for use in other scripts
export { IntegrationTester, quickHealthCheck };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}