# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Install curl for health checks and other utilities
RUN apk add --no-cache curl dumb-init

# Set working directory
WORKDIR /usr/src/app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy application code
COPY . .

# Create necessary directories and set permissions
RUN mkdir -p /usr/src/app/logs && \
    mkdir -p /usr/src/app/data && \
    mkdir -p /usr/src/app/backups && \
    chown -R nodejs:nodejs /usr/src/app

# Switch to non-root user
USER nodejs

# Expose port 3003 for health check endpoint
EXPOSE 3003

# Add health check using the bot's built-in health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD node -e "import('./scripts/test-integration.js').then(m => m.quickHealthCheck().then(r => process.exit(r ? 0 : 1)))" || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["npm", "start"]