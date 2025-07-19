// config/channels.js - Channel Configuration and Mappings
export const channelConfig = {
  coding: {
    keywords: ['coding', 'dev', 'development', 'code', 'programming'],
    description: 'Software development help and code reviews',
    reactions: ['=', '', 'L', '=¡', '=''],
    allowFiles: true,
    threadSupport: true
  },
  general: {
    keywords: ['general', 'chat', 'main', 'random'],
    description: 'Quick Q&A and random questions',
    reactions: ['=M', '=N', '>', '=­'],
    allowFiles: false,
    threadSupport: false
  },
  projects: {
    keywords: ['projects', 'project', 'ideas', 'brainstorm'],
    description: 'Project idea exploration and planning',
    reactions: ['=€', '=Ë', 'P', '<¯', '=È'],
    allowFiles: true,
    threadSupport: true
  },
  planning: {
    keywords: ['planning', 'tasks', 'workflow', 'productivity', 'todo'],
    description: 'Daily task prioritization and workflow',
    reactions: ['=Å', '', '=', '¡', '=Ê'],
    allowFiles: false,
    threadSupport: true
  },
  analysis: {
    keywords: ['analysis', 'data', 'analytics', 'research', 'insights'],
    description: 'Data analysis and reasoning',
    reactions: ['=Ê', '=,', '=È', '=É', '>î'],
    allowFiles: true,
    threadSupport: true
  },
  admin: {
    keywords: ['admin', 'config', 'settings', 'bot'],
    description: 'Bot configuration commands',
    reactions: ['™', '='', '', 'L'],
    allowFiles: false,
    threadSupport: false,
    adminOnly: true
  }
};

// Default channel mappings (legacy support)
export const channelMappings = {
  'coding': ['coding', 'dev', 'development', 'code', 'programming'],
  'general': ['general', 'chat', 'main', 'random'],
  'projects': ['projects', 'project', 'ideas', 'brainstorm'],
  'planning': ['planning', 'tasks', 'workflow', 'productivity', 'todo'],
  'analysis': ['analysis', 'data', 'analytics', 'research', 'insights'],
  'admin': ['admin', 'config', 'settings', 'bot']
};

// Get channel type from channel name
export function getChannelType(channelName) {
  const name = channelName.toLowerCase();
  
  for (const [type, config] of Object.entries(channelConfig)) {
    if (config.keywords.some(keyword => name.includes(keyword))) {
      return type;
    }
  }
  
  // Default to general if no match
  return 'general';
}

// Get channel configuration
export function getChannelConfiguration(channelType) {
  return channelConfig[channelType] || channelConfig.general;
}

// Validate channel setup for a Discord guild
export function validateChannelSetup(guild) {
  const foundChannels = {};
  const requiredChannels = Object.keys(channelConfig);
  
  guild.channels.cache.forEach(channel => {
    if (channel.type === 0) { // Text channel
      const channelType = getChannelType(channel.name);
      if (!foundChannels[channelType]) {
        foundChannels[channelType] = [];
      }
      foundChannels[channelType].push({
        name: channel.name,
        id: channel.id
      });
    }
  });
  
  const missingChannels = requiredChannels.filter(type => !foundChannels[type]);
  
  return {
    foundChannels,
    missingChannels,
    isComplete: missingChannels.length === 0
  };
}

// Check if user has admin permissions for admin channels
export function hasAdminAccess(member) {
  return member.permissions.has('Administrator') || 
         member.permissions.has('ManageChannels') ||
         member.roles.cache.some(role => role.name.toLowerCase().includes('admin'));
}

// Get recommended channel names for setup
export function getRecommendedChannelNames() {
  return {
    coding: '#coding',
    general: '#general', 
    projects: '#projects',
    planning: '#planning',
    analysis: '#analysis',
    admin: '#admin'
  };
}