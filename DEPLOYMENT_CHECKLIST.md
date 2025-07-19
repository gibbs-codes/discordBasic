# Discord LLM Workspace Bot - Deployment Checklist

## Pre-Deployment Setup

### 1. Environment Configuration
- [ ] Copy `.env.example` to `.env` and configure all required variables
- [ ] Set `DISCORD_TOKEN` with your bot token
- [ ] Configure `MONGO_URI` for your MongoDB instance
- [ ] Set `OPENAI_API_KEY` and/or `OLLAMA_URL` for LLM providers
- [ ] Configure admin access with `ADMIN_USER_IDS` or `ADMIN_ROLE_NAME`
- [ ] Set appropriate `LOG_LEVEL` for your environment
- [ ] Configure test settings if running integration tests

### 2. Database Setup
- [ ] Ensure MongoDB is running and accessible
- [ ] Database name should match the one in `MONGO_URI` (default: `technical_workspace`)
- [ ] Run database migration: `node scripts/migrate-database.js`
- [ ] Verify migration completed successfully (check logs)
- [ ] Confirm default channel configurations were created

### 3. Dependencies
- [ ] Run `npm install` to install all dependencies
- [ ] Verify Node.js version compatibility (Node 16+ recommended)
- [ ] Check that all service imports resolve correctly
- [ ] Ensure MongoDB driver is properly installed

### 4. Discord Bot Setup
- [ ] Bot has been created in Discord Developer Portal
- [ ] Bot token is valid and configured in environment
- [ ] Bot has necessary permissions in your Discord server:
  - [ ] Read Messages
  - [ ] Send Messages
  - [ ] Use Slash Commands
  - [ ] Add Reactions
  - [ ] Create Threads (if thread creation enabled)
  - [ ] Manage Messages (for admin functions)
- [ ] Bot has been invited to your Discord server
- [ ] Required channels exist: `#coding`, `#general`, `#projects`, `#planning`, `#analysis`, `#admin`

## Testing Phase

### 5. Integration Testing
- [ ] Run health check: `npm run test:health` (or `node -e "import('./scripts/test-integration.js').then(m => m.quickHealthCheck())"`)
- [ ] Run full integration tests: `node scripts/test-integration.js`
- [ ] Verify all tests pass (90%+ success rate recommended)
- [ ] Check test report for any performance issues
- [ ] Resolve any failed tests before proceeding

### 6. Manual Functionality Testing
- [ ] Bot starts successfully without errors
- [ ] Bot responds in each channel type with appropriate personality:
  - [ ] `#coding` - Technical, code-focused responses
  - [ ] `#general` - Conversational, helpful responses
  - [ ] `#projects` - Project planning focused
  - [ ] `#planning` - Productivity and workflow focused
  - [ ] `#analysis` - Analytical, data-driven responses
  - [ ] `#admin` - Administrative, technical guidance
- [ ] Memory context works across sessions (test by referencing previous conversations)
- [ ] Admin commands function correctly (test with admin user)
- [ ] Configuration changes persist after restart

### 7. Performance Testing
- [ ] Response times are acceptable (< 10 seconds for most requests)
- [ ] Memory usage is within acceptable limits
- [ ] Database queries complete efficiently
- [ ] No memory leaks during extended operation
- [ ] Rate limiting works correctly

## Admin Command Testing

### 8. Slash Commands (test each)
- [ ] `/setmodel` - Changes channel model configuration
- [ ] `/setprompt` - Updates channel system prompt
- [ ] `/settemp` - Modifies temperature settings
- [ ] `/showconfig` - Displays current configuration
- [ ] `/models` - Lists available models
- [ ] `/stats` - Shows system statistics
- [ ] `/backup` - Creates configuration backup
- [ ] `/restore` - Restores from backup
- [ ] `/resetmemory` - Clears memory (with confirmation)
- [ ] `/showmemory` - Displays memory statistics
- [ ] `/patterns` - Shows user behavior patterns
- [ ] `/test` - Tests system functionality
- [ ] `/health` - System health check

### 9. Legacy Commands (test sample)
- [ ] `!config` - Shows configuration
- [ ] `!memory-stats` - Memory statistics
- [ ] `!test-model <channel>` - Tests specific channel
- [ ] `!update-config <channel> <field> <value>` - Updates configuration
- [ ] `!help` - Shows available commands

## Production Readiness

### 10. Security Validation
- [ ] No API keys or secrets in code or logs
- [ ] Admin access properly restricted
- [ ] Input validation working correctly
- [ ] Error messages don't expose sensitive information
- [ ] Rate limiting configured appropriately
- [ ] Database access is secured

### 11. Monitoring Setup
- [ ] Logging configured for production environment
- [ ] Log rotation set up if needed
- [ ] Error alerting configured
- [ ] Performance monitoring in place
- [ ] Database monitoring enabled

### 12. Backup and Recovery
- [ ] Database backup strategy in place
- [ ] Configuration backup tested
- [ ] Recovery procedures documented
- [ ] Rollback plan prepared

## Deployment

### 13. Production Deployment
- [ ] Deploy to production environment
- [ ] Verify environment variables are set correctly
- [ ] Start the bot: `npm start` or your process manager
- [ ] Monitor startup logs for errors
- [ ] Test basic functionality in production

### 14. Post-Deployment Verification
- [ ] Bot appears online in Discord server
- [ ] Slash commands are registered and visible
- [ ] Test message in each channel type
- [ ] Verify admin commands work
- [ ] Check memory context functionality
- [ ] Monitor logs for any errors
- [ ] Verify performance is acceptable

### 15. Documentation and Handoff
- [ ] Update README with deployment-specific information
- [ ] Document any environment-specific configurations
- [ ] Provide admin users with command reference
- [ ] Create monitoring and maintenance procedures
- [ ] Document troubleshooting steps

## Rollback Plan

### 16. Emergency Procedures
- [ ] Know how to quickly stop the bot if needed
- [ ] Have database rollback procedure ready
- [ ] Keep previous version available for quick restore
- [ ] Document emergency contacts and procedures
- [ ] Test rollback procedure in non-production environment

## Success Criteria

The deployment is considered successful when:
- ✅ All integration tests pass (90%+ success rate)
- ✅ Bot responds appropriately in all channel types
- ✅ Memory context persists across sessions
- ✅ Admin commands function correctly
- ✅ Performance is within acceptable limits
- ✅ No critical errors in production logs
- ✅ Users can successfully interact with the bot
- ✅ Configuration changes can be made and persist

## Troubleshooting Common Issues

### Bot Won't Start
1. Check environment variables are set correctly
2. Verify Discord token is valid
3. Ensure MongoDB is running and accessible
4. Check Node.js version compatibility
5. Review startup logs for specific errors

### LLM Not Responding
1. Verify API keys are correct and have credit/access
2. Check network connectivity to LLM providers
3. Test with different models or providers
4. Review LLM service logs for errors
5. Check rate limiting settings

### Database Connection Issues
1. Verify MongoDB is running
2. Check connection string format
3. Ensure database exists and is accessible
4. Check network connectivity and firewalls
5. Verify MongoDB credentials if using authentication

### Admin Commands Not Working
1. Ensure user has admin permissions
2. Check if slash commands are registered
3. Verify bot has necessary Discord permissions
4. Test with legacy commands as alternative
5. Check admin command service logs

### Memory Context Issues
1. Verify MongoDB collections exist and have data
2. Check memory service initialization
3. Test with fresh user interactions
4. Review memory service logs for errors
5. Ensure lookback days setting is appropriate

For additional support, check the logs and refer to the README troubleshooting section.