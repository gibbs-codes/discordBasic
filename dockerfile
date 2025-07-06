# Use Node.js 18 Alpine for smaller image
FROM node:18-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Set working directory
WORKDIR /usr/src/app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --only=production && npm cache clean --force

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy application code
COPY . .

# Create necessary directories and set permissions
RUN mkdir -p /usr/src/app/logs && \
    mkdir -p /usr/src/app/data && \
    chown -R nodejs:nodejs /usr/src/app

# Switch to non-root user
USER nodejs

# Expose the port (for health checks, bot doesn't serve HTTP)
EXPOSE 3004

# Health check via a simple file or process check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD pgrep -f "node.*bot.js" || exit 1

# Start the application (main entry point is bot.js)
CMD ["npm", "start"]