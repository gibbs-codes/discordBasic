# Docker Deployment Steps

## 🚀 Manual Deployment (if Docker isn't running locally)

### Option 1: Push to Git and Auto-Deploy
If you have GitHub Actions set up:
```bash
git add .
git commit -m "Fix privileged intents for Docker deployment"
git push origin main
# This will trigger automatic deployment via GitHub Actions
```

### Option 2: Manual Docker Commands (on your deployment server)
```bash
# On your deployment server (Mac Mini), navigate to the project directory
cd ~/deployments/discord-llm-workspace

# Pull latest code
git pull origin main

# Stop existing container
docker stop discord-llm-workspace-bot 2>/dev/null || true
docker rm discord-llm-workspace-bot 2>/dev/null || true

# Build new image
docker build --no-cache -t discord-llm-workspace:latest .

# Run container
docker run -d \
  --name discord-llm-workspace-bot \
  --restart unless-stopped \
  --network gibbs-apps \
  -p 3003:3003 \
  -v $(pwd)/logs:/usr/src/app/logs:rw \
  -v $(pwd)/data:/usr/src/app/data:rw \
  -v $(pwd)/backups:/usr/src/app/backups:rw \
  --env-file .env \
  -e NODE_ENV=production \
  -e PORT=3003 \
  discord-llm-workspace:latest

# Check if it's running
docker ps | grep discord-llm-workspace-bot

# Check logs
docker logs discord-llm-workspace-bot
```

### Option 3: Using Docker Compose (Recommended)
```bash
# On your deployment server
cd ~/deployments/discord-llm-workspace

# Pull latest code
git pull origin main

# Stop and rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs discord-llm-workspace
```

## 🔍 Expected Success Logs
You should see:
```
🚀 Starting LLM Workspace Bot...
🤖 Mr Talky#5789 is online and ready for technical work!
⚠️ MISSING PRIVILEGED INTENTS:
  - MessageContent Intent: Bot cannot read message content
  - GuildMembers Intent: Admin permission checking limited
  - Enable these in Discord Developer Portal for full functionality
  - For now, use SLASH COMMANDS: /help, /health, /setmodel, etc.
Started refreshing application (/) commands.
Successfully reloaded application (/) commands.
✅ LLM Workspace Bot started successfully
💡 Use slash commands for full functionality until intents are enabled
```

## 🎯 Testing After Deployment
In Discord, test these slash commands:
- `/health` - Should show system health
- `/showconfig` - Should display current configuration
- `/models` - Should list available LLM models
- `/stats` - Should show system statistics

## ⚡ Quick Fix Commands
If the container fails to start:

```bash
# Check container logs
docker logs discord-llm-workspace-bot

# Check if MongoDB is accessible
docker exec discord-llm-workspace-bot npm run test:health

# Restart just the bot service
docker restart discord-llm-workspace-bot

# Full rebuild if needed
docker-compose down --remove-orphans
docker-compose build --no-cache
docker-compose up -d
```

## 🔧 Troubleshooting

### Problem: "Used disallowed intents"
**Solution**: The privileged intents are still enabled in the code. Make sure you've pulled the latest code with commented-out intents.

### Problem: "Cannot connect to MongoDB"
**Solution**: 
```bash
# Check if MongoDB is running
docker ps | grep mongo
# Or start MongoDB
docker-compose up -d mongodb
```

### Problem: "Health check failed"
**Solution**:
```bash
# Check what's failing
docker exec discord-llm-workspace-bot npm run test:health
# Check logs for specific errors
docker logs --tail=50 discord-llm-workspace-bot
```

## 📋 Post-Deployment Checklist
- [ ] Container is running: `docker ps | grep discord-llm-workspace`
- [ ] No error logs: `docker logs discord-llm-workspace-bot`
- [ ] Slash commands work in Discord
- [ ] Health check passes: `docker exec discord-llm-workspace-bot npm run test:health`
- [ ] Bot shows as online in Discord server