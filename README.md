# Discord Accountability Coach Bot

A memory-powered, LLM-driven Discord bot that provides personalized accountability coaching with financial incentives, workout tracking, and behavioral pattern analysis.

## 🎯 Key Features

### **🧠 Memory-Powered Intelligence**
- **Pattern Recognition**: Tracks excuses, commitments, and behavioral trends
- **Morning Chat Integration**: Uses your existing MongoDB morning session logs
- **Behavioral Analysis**: "You've made 3 'too tired' excuses this week"
- **Context-Aware Responses**: References your mood, goals, and past commitments

### **💬 Natural Conversation**
- **No Slash Commands**: Just talk naturally in any channel
- **Channel-Aware Personality**: Different coaching styles per Discord channel
- **Condescending Rewards**: "Here's your $10, don't spend it all in one place"
- **Firm Accountability**: Uses your own words against you

### **📊 Reconciliation Integration**
- **Daily Automation**: Automatic reconciliation at 11 PM Central
- **API Integration**: Calls your existing decider app
- **Personalized Lectures**: LLM processes data into coaching feedback
- **Performance Analysis**: "You earned $15 while your debt grew to $85"

### **🔄 Modular Architecture**
- **LLM Provider Switching**: Easy OpenAI ↔ Ollama switching
- **Mac Mini Ready**: Runs locally with Ollama
- **Memory Service**: MongoDB integration with pattern analysis
- **Channel Management**: Smart channel detection and behaviors

## 🚀 Quick Start

### **1. Prerequisites**
```bash
# Required
- Node.js 16+
- MongoDB (local or Atlas)
- Discord Bot Token
- Your decider app running on port 3000

# LLM Provider (choose one)
- OpenAI API key OR
- Ollama running locally
```

### **2. Installation**
```bash
# Clone and install
git clone <your-repo>
cd dicordcoach-bot
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials
```

### **3. Environment Configuration**
```bash
# Required Variables
DISCORD_TOKEN=your_discord_bot_token
MONGO_URI=mongodb://localhost:27017

# LLM Configuration (choose OpenAI or Ollama)
LLM_PROVIDER=openai
OPENAI_API_KEY=your_openai_key
LLM_MODEL=gpt-4

# OR for local Ollama
# LLM_PROVIDER=ollama
# OLLAMA_URL=http://localhost:11434
# LLM_MODEL=llama2

# Reconciliation API
RECONCILIATION_API_URL=http://localhost:3000
```

### **4. Discord Server Setup**
Create channels with these keywords (bot auto-detects):
- `#general` or `#chat` - General coaching conversations
- `#begging` or `#requests` - Permission requests and negotiations
- `#proof` or `#evidence` - Workout proof submissions
- `#reviews` or `#summary` - Performance reviews and reconciliation
- `#punishments` or `#violations` - Official announcements (bot-only)

### **5. Start the Bot**
```bash
# Development with auto-restart
npm run dev

# Production
npm start
```

## 🏗️ Architecture

### **File Structure**
```
src/
├── bot.js                           # Main Discord client
├── handlers/
│   ├── messageHandler.js            # Core message processing
│   ├── channelHandler.js            # Channel-specific behaviors  
│   └── reconciliationHandler.js     # Reconciliation integration
├── services/
│   ├── llm/
│   │   ├── LLMService.js            # Main LLM interface
│   │   ├── OpenAIProvider.js        # OpenAI implementation
│   │   ├── OllamaProvider.js        # Ollama implementation
│   │   └── prompts.js               # Channel-specific prompts
│   ├── MemoryService.js             # MongoDB & pattern analysis
│   ├── ReconciliationService.js     # API integration
│   └── SchedulerService.js          # Automated reconciliation
└── utils/
    ├── logger.js                    # Structured logging
    └── config.js                    # Environment validation
```

### **Data Flow**
```
User Message → Channel Detection → Memory Context → LLM Response → Action Follow-up
                     ↓
              Pattern Analysis ← MongoDB Logs ← Morning Chat History
```

## 💾 Memory Integration

### **MongoDB Collections**
- **`local_coaches.logs`**: Your existing morning chat sessions
- **`local_coaches.discord_interactions`**: New Discord interaction tracking

### **Pattern Analysis**
```javascript
// What the bot remembers about you:
{
  excusePatterns: ["too tired", "couldn't", "forgot"],
  commitmentTracking: ["will hit 4 workouts", "plan to apply to 25 jobs"],
  moodCorrelations: ["sluggish mornings → skipped workouts"],
  channelBehavior: ["begs 2x more than submits proof"],
  weeklyPatterns: ["skips Monday check-ins", "chatty on Fridays"]
}
```

## 🤖 Channel Behaviors

### **#general - Coaching Conversations**
- Natural conversation with full memory context
- References your patterns and commitments
- Calls out excuses using your history

### **#begging - Permission Requests**
- Skeptical of spending requests
- References recent performance
- Conditional approvals based on behavior

### **#proof - Workout Evidence**
- Condescending acknowledgment of basic effort
- Verification reactions (✅ ❌ 🤔)
- Earnings approval for valid proof

### **#reviews - Performance Analysis**
- Daily reconciliation summaries at 11 PM
- Data-driven performance lectures
- Historical trend analysis

### **#punishments - Official Announcements**
- Bot-only channel for debt/punishment notices
- Authoritative, no-negotiation tone
- Clean, official announcements

## 🔄 Reconciliation Integration

### **Automatic Daily Flow**
```
11:00 PM Central → API Call → Data Processing → LLM Lecture → Discord Post
```

### **API Integration**
```javascript
// Calls your existing endpoint
POST /reconcile → {
  success: true,
  results: {
    total_bonus_amount: 15,
    debt_updates: [...],
    new_punishments: [...],
    summary: "..."
  }
}

// Becomes personalized lecture
"You earned a pathetic $15 while your debt grew to $85. 
Based on your morning energy being 'low' three times this week, 
I'm not surprised."
```

## 🔧 Configuration Options

### **LLM Provider Switching**
```bash
# Switch to Ollama
LLM_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
LLM_MODEL=llama2

# Switch to OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=your_key
LLM_MODEL=gpt-4
```

### **Memory Lookback**
```javascript
// Default: 14 days of context
const memoryContext = await memoryService.getRelevantContext({
  lookbackDays: 14  // Adjustable
});
```

### **Logging Levels**
```bash
LOG_LEVEL=DEBUG  # Verbose logging
LOG_LEVEL=INFO   # Standard logging
LOG_LEVEL=WARN   # Warnings only
LOG_LEVEL=ERROR  # Errors only
```

## 🛠️ Development

### **Testing Connections**
```bash
# Test reconciliation API
curl http://localhost:3000/health

# Test MongoDB connection
# Check logs for "Memory service connected to MongoDB"

# Test LLM provider
# Check logs for "LLM [provider] connection successful"
```

### **Manual Reconciliation**
Send "reconcile" in #general channel to trigger manual reconciliation.

### **Memory Inspection**
```javascript
// Check what the bot remembers
await memoryService.getRelevantContext({
  userId: 'your-discord-id',
  lookbackDays: 7
});
```

## 🔮 Future Enhancements

### **Function Calling (Ready)**
The architecture supports LLM function calling:
```javascript
// LLM can decide to call these functions
await reconciliationService.assignPunishment(type, duration, reason);
await reconciliationService.assignDebt(amount, reason);
await memoryService.flagBehaviorPattern(pattern, severity);
```

### **Additional Integrations**
- Apple Watch workout data
- Notion database queries  
- Calendar integration
- Spending pattern analysis

## 📝 Example Interactions

### **Memory-Powered Accountability**
```
User: "I couldn't make it to the gym today"
Bot: "That's the third 'couldn't' excuse this week. Last Monday you 
     said you'd nail this week after disappointing me. Your morning 
     session showed you were 'focused' and 'high energy' - so what's 
     the real reason?"
```

### **Reconciliation Lecture**
```
🌙 DAILY RECKONING - 2025-07-05

You earned a pathetic $15 in bonuses while your debt grew to $85. 
That scooter isn't going to ride itself. Based on your morning 
energy being 'low' three times this week, I'm not surprised by 
this disappointing performance.

Your Uber earnings of $25 went straight to debt - you keep nothing. 
Two new cardio punishments assigned for missed workouts. Stop making 
excuses and start making progress.
```

### **Begging Response**
```
User: "Can I spend $80 on dinner tonight?"
Bot: "You missed 2 workouts this week and want $80 for dinner? 
     Your recent begging frequency is through the roof. Earn it 
     first with some actual effort."
```

This bot transforms from a simple chatbot into a truly intelligent accountability partner that knows your patterns, uses your history against you, and delivers personalized coaching based on real data and behavioral analysis.