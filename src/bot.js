// bot.js - LLM-Powered Accountability Coach Discord Bot
import { Client, GatewayIntentBits } from 'discord.js';
import { config } from 'dotenv';
import { LLMService } from './services/llm.js';
import { ReconciliationService } from './services/reconciliation.js';

config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Channel configuration
const CHANNELS = {
  GENERAL: 'general',
  PUNISHMENTS: 'punishments', 
  PROOF: 'proof',
  BEGGING: 'begging',
  REVIEWS: 'reviews'
};

// Initialize services
const llmService = new LLMService({
  provider: process.env.LLM_PROVIDER || 'openai', // 'openai' or 'ollama'
  apiKey: process.env.OPENAI_API_KEY,
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  model: process.env.LLM_MODEL || 'gpt-4'
});

const reconciliationService = new ReconciliationService({
  apiUrl: process.env.RECONCILIATION_API_URL || 'http://localhost:3000'
});

// Bot ready event
client.once('ready', () => {
  console.log(`🤖 ${client.user.tag} is online and ready to dominate!`);
  
  // Schedule daily reconciliation
  scheduleReconciliation();
});

// Handle all messages
client.on('messageCreate', async message => {
  // Ignore bot messages
  if (message.author.bot) return;
  
  // Get channel context
  const channelType = getChannelType(message.channel.name);
  
  try {
    // Handle reconciliation trigger
    if (message.content.toLowerCase().includes('reconcile') && channelType === 'general') {
      await handleReconciliationRequest(message);
      return;
    }
    
    // Get LLM response based on channel context
    const response = await llmService.generateResponse({
      message: message.content,
      channelType,
      username: message.author.displayName,
      messageHistory: await getRecentMessages(message.channel, 10)
    });
    
    // Send response
    await message.reply(response);
    
    // Handle any follow-up actions based on channel type
    await handleChannelSpecificActions(message, channelType, response);
    
  } catch (error) {
    console.error('Error processing message:', error);
    await message.reply('Something went wrong. Even I make mistakes sometimes.');
  }
});

// Determine channel type from name
function getChannelType(channelName) {
  const name = channelName.toLowerCase();
  
  if (name.includes('punishment')) return 'punishments';
  if (name.includes('proof')) return 'proof';
  if (name.includes('beg')) return 'begging';
  if (name.includes('review')) return 'reviews';
  
  return 'general';
}

// Get recent message history for context
async function getRecentMessages(channel, limit = 10) {
  try {
    const messages = await channel.messages.fetch({ limit });
    return messages.map(msg => ({
      author: msg.author.displayName,
      content: msg.content,
      timestamp: msg.createdAt
    })).reverse();
  } catch (error) {
    console.error('Error fetching message history:', error);
    return [];
  }
}

// Handle reconciliation requests
async function handleReconciliationRequest(message) {
  await message.reply('🔄 Running your daily reckoning... prepare yourself.');
  
  try {
    // Get reconciliation data from your API
    const reconciliationData = await reconciliationService.runReconciliation();
    
    // Have LLM process and lecture about the results
    const lectureResponse = await llmService.generateReconciliationLecture(reconciliationData);
    
    // Post in reviews channel
    const reviewsChannel = getChannelByType(message.guild, 'reviews');
    if (reviewsChannel) {
      await reviewsChannel.send(lectureResponse);
    } else {
      await message.channel.send(lectureResponse);
    }
    
  } catch (error) {
    console.error('Reconciliation error:', error);
    await message.reply('Failed to run reconciliation. Even your failures are disappointing.');
  }
}

// Handle channel-specific follow-up actions
async function handleChannelSpecificActions(message, channelType, response) {
  switch (channelType) {
    case 'proof':
      // Add reaction for proof verification
      await message.react('✅');
      await message.react('❌');
      break;
      
    case 'begging':
      // Add voting reactions for community input
      await message.react('👍');
      await message.react('👎');
      await message.react('🤔');
      break;
      
    case 'punishments':
      // This channel is typically bot-only for announcements
      break;
  }
}

// Get channel by type
function getChannelByType(guild, type) {
  return guild.channels.cache.find(channel => 
    channel.name.toLowerCase().includes(type.toLowerCase())
  );
}

// Schedule daily reconciliation
function scheduleReconciliation() {
  // Run at 11 PM daily
  const schedule = '0 23 * * *';
  
  // Using a simple interval for now - replace with node-cron for production
  setInterval(async () => {
    const now = new Date();
    if (now.getHours() === 23 && now.getMinutes() === 0) {
      await runAutomaticReconciliation();
    }
  }, 60000); // Check every minute
}

// Automatic daily reconciliation
async function runAutomaticReconciliation() {
  try {
    console.log('🕚 Running automatic daily reconciliation...');
    
    const reconciliationData = await reconciliationService.runReconciliation();
    const lectureResponse = await llmService.generateReconciliationLecture(reconciliationData);
    
    // Post to reviews channel in all guilds
    client.guilds.cache.forEach(guild => {
      const reviewsChannel = getChannelByType(guild, 'reviews');
      if (reviewsChannel) {
        reviewsChannel.send(`📊 **DAILY RECKONING**\n\n${lectureResponse}`);
      }
    });
    
  } catch (error) {
    console.error('Automatic reconciliation failed:', error);
  }
}

// Handle reaction events for proof verification
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  
  const channelType = getChannelType(reaction.message.channel.name);
  
  if (channelType === 'proof') {
    if (reaction.emoji.name === '✅') {
      const response = await llmService.generateResponse({
        message: 'Proof verified for workout',
        channelType: 'proof',
        username: user.displayName,
        context: 'proof_verification'
      });
      
      await reaction.message.reply(response);
    }
  }
});

// Error handling
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

client.on('error', error => {
  console.error('Discord client error:', error);
});

// Login
console.log('🚀 Starting accountability coach bot...');
client.login(process.env.DISCORD_TOKEN);