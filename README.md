# Discord LLM Workspace Bot

A professional Discord bot that provides AI-powered assistance across multiple specialized channels. Each channel has a unique personality and expertise tailored to specific types of work: coding, project planning, productivity, analysis, and general assistance.

## 🚀 Features

### Multi-Channel Expertise
- **#coding** - Expert software engineer for code review, debugging, and technical guidance
- **#general** - Helpful AI assistant for quick questions and general assistance  
- **#projects** - Project planning specialist for breaking down ideas and implementation strategies
- **#planning** - Productivity advisor for task prioritization and workflow optimization
- **#analysis** - Data analyst and reasoning expert for thorough analysis and insights
- **#admin** - System administrator helper for bot configuration and management

### Dynamic Configuration System
- **Runtime Configuration** - Change models, prompts, and settings without restarting
- **Per-Channel Settings** - Different LLM models and parameters for each channel
- **Guild-Specific Configs** - Customize settings per Discord server
- **MongoDB Persistence** - All configurations stored and cached efficiently

### Advanced Memory & Context
- **Technical Pattern Recognition** - Tracks programming languages, frameworks, and technologies used
- **Project Context Tracking** - Maintains awareness of active projects and their details
- **Skill Progression Monitoring** - Learns from user interactions to provide better assistance
- **Cross-Session Memory** - Remembers previous conversations and preferences

### Comprehensive Admin Interface
- **Slash Commands** - Modern Discord command interface with autocomplete
- **Legacy Commands** - Traditional `!command` syntax for power users
- **Configuration Management** - Real-time settings updates with validation
- **System Monitoring** - Health checks, statistics, and performance monitoring
- **Backup & Restore** - Export/import configurations for deployment

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 16 or higher
- MongoDB (local or cloud instance)
- Discord Bot Token
- OpenAI API Key (or Ollama for local models)

### Quick Start

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd discordBasic
   npm run setup
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your tokens and settings
   ```

3. **Run Database Migration**
   ```bash
   npm run migrate
   ```

4. **Test the System**
   ```bash
   npm run test:health
   npm test
   ```

5. **Start the Bot**
   ```bash
   npm start
   # or for development
   npm run dev
   ```

### Environment Configuration

Key environment variables (see `.env.example` for complete list):

```bash
# Required
DISCORD_TOKEN=your_discord_bot_token_here
MONGO_URI=mongodb://localhost:27017/technical_workspace
OPENAI_API_KEY=your_openai_api_key_here

# Optional - Channel-specific models
CODING_MODEL=gpt-4
GENERAL_MODEL=gpt-3.5-turbo
PROJECTS_MODEL=gpt-4
PLANNING_MODEL=gpt-4
ANALYSIS_MODEL=gpt-4
ADMIN_MODEL=gpt-3.5-turbo

# Admin Access
ADMIN_USER_IDS=123456789012345678,987654321098765432
ADMIN_ROLE_NAME=Administrator
```

## 📋 Channel Configuration

Each channel can be configured with:
- **LLM Provider** (OpenAI, Ollama, future: Anthropic)
- **Model** (gpt-4, gpt-3.5-turbo, llama2, etc.)
- **Temperature** (0.0-2.0, affects creativity vs consistency)
- **System Prompt** (custom personality and instructions)
- **Features** (thread creation, memory tracking, etc.)

### Default Channel Settings

| Channel | Model | Temperature | Focus |
|---------|-------|-------------|-------|
| coding | gpt-4 | 0.3 | Precise, technical responses |
| general | gpt-3.5-turbo | 0.7 | Conversational, helpful |
| projects | gpt-4 | 0.5 | Structured planning |
| planning | gpt-4 | 0.4 | Organized, actionable |
| analysis | gpt-4 | 0.2 | Analytical, data-driven |
| admin | gpt-3.5-turbo | 0.3 | Technical, precise |

## 🎛️ Admin Commands

### Slash Commands (Recommended)

**Channel Management:**
- `/setmodel channel:coding model:gpt-4-turbo` - Change model for a channel
- `/setprompt channel:analysis prompt:"Custom prompt"` - Update system prompt
- `/settemp channel:general temperature:0.8` - Adjust temperature
- `/showconfig` - Display current configuration

**System Management:**
- `/models` - List available models and providers
- `/stats` - Show system statistics and health
- `/backup` - Export configuration backup
- `/restore backup_file` - Restore from backup

**Memory Management:**
- `/resetmemory user:@username` - Clear user's memory (with confirmation)
- `/showmemory user:@username` - Display memory statistics
- `/patterns user:@username` - Show user behavior patterns

**Testing & Health:**
- `/test channel:coding` - Test specific channel functionality
- `/health` - Comprehensive system health check

### Legacy Commands

```bash
!config                           # Show configuration
!update-config coding model gpt-4 # Update channel settings
!test-model projects              # Test specific channel
!memory-stats                     # Memory usage statistics
!help                            # Available commands
```

## 🧠 Memory System

The bot maintains sophisticated memory across sessions:

### Technical Context Tracking
- **Programming Languages** - Tracks languages you use and prefer
- **Frameworks & Technologies** - Remembers your tech stack
- **Project Contexts** - Maintains awareness of active projects
- **Coding Patterns** - Learns your preferred approaches and complexity level

### Behavioral Pattern Analysis
- **Question Types** - Adapts to your most common question patterns
- **Working Hours** - Learns your schedule and peak productivity times
- **Channel Preferences** - Understands which channels you use most
- **Workflow Patterns** - Recognizes your planning and task breakdown style

### Privacy & Control
- Memory is user-specific and not shared between users
- Admin commands allow memory inspection and clearing
- All data is stored securely in MongoDB with proper indexing

## 🔧 Development & Testing

### Development Workflow

```bash
# Health check before development
npm run test:health

# Start with testing
npm run dev:test

# Full integration testing
npm test

# Deploy with testing
npm run deploy
```

### Testing Framework

The bot includes comprehensive integration testing:

- **Database Connectivity** - MongoDB connection and collection setup
- **Channel Configuration** - All channels properly configured
- **LLM Service** - Each channel responds with correct personality
- **Memory Service** - Context storage and retrieval
- **Admin Commands** - All commands function correctly
- **Performance** - Response times and resource usage
- **Error Handling** - Graceful failure scenarios

### Performance Monitoring

Built-in monitoring includes:
- Response time tracking
- Memory usage statistics
- Database query performance
- Error rate monitoring
- User interaction patterns

## 🚀 Deployment

Follow the [Deployment Checklist](DEPLOYMENT_CHECKLIST.md) for production deployment.

### Production Considerations

1. **Environment Variables** - Use production-appropriate settings
2. **Database** - Ensure MongoDB is properly secured and backed up
3. **Monitoring** - Set up log aggregation and alerting
4. **Rate Limiting** - Configure appropriate limits for your usage
5. **Security** - Restrict admin access and monitor API usage

### Docker Support (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 📖 Usage Examples

### Coding Channel
```
User: "How can I optimize this React component for performance?"
Bot: [Provides specific optimization techniques with code examples, 
      references user's past React projects, suggests performance 
      monitoring approaches based on their complexity preferences]
```

### Projects Channel
```
User: "I want to build a task management app"
Bot: [Breaks down the project into phases, suggests tech stack based 
      on user's preferences, provides timeline estimates, identifies 
      potential challenges and solutions]
```

### Analysis Channel
```
User: "Analyze the pros and cons of microservices vs monolith"
Bot: [Provides structured analysis with data points, considers user's 
      past architecture discussions, presents balanced perspective 
      with specific recommendations]
```

## 🔧 Troubleshooting

### Common Issues

**Bot Not Responding:**
1. Check Discord permissions (Read/Send Messages, Use Slash Commands)
2. Verify environment variables are set correctly
3. Check MongoDB connection and API key validity
4. Review logs for specific error messages

**Admin Commands Not Working:**
1. Ensure user has admin permissions (role or user ID configured)
2. Try both slash commands and legacy commands
3. Check if bot has necessary Discord permissions
4. Verify slash commands are registered (`/health` should work)

**Memory Context Issues:**
1. Allow time for memory to build (requires multiple interactions)
2. Check MongoDB collections exist and have data
3. Verify memory service initialization in logs
4. Test with `/showmemory` command

**Performance Issues:**
1. Check MongoDB performance and indexing
2. Monitor API rate limits and usage
3. Review memory usage and Node.js performance
4. Consider adjusting cache TTL and memory lookback settings

### Getting Help

1. Check the logs first - they contain detailed error information
2. Run health checks: `npm run test:health`
3. Use `/health` command for system diagnostics
4. Review [Deployment Checklist](DEPLOYMENT_CHECKLIST.md) for setup issues

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add comprehensive tests for new features
4. Ensure all integration tests pass
5. Submit a pull request with detailed description

## 📄 License

MIT License - see LICENSE file for details

## 🔄 Migration from Previous Versions

If migrating from a coaching/accountability bot:

1. **Backup existing data** before migration
2. **Run migration script**: `npm run migrate`
3. **Update environment variables** to new format
4. **Test thoroughly** using the integration test suite
5. **Update Discord channel setup** if needed

The migration script preserves existing interaction data and converts it to the new technical workspace format while cleaning up old coaching-specific collections.

---

**Version:** 2.0.0 - Technical Workspace Edition  
**Last Updated:** 2025-01-19  
**Node.js:** 16+ required  
**Discord.js:** v14.14.1+