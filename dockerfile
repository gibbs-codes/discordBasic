# Use Node.js 18 Alpine
FROM node:18-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Set working directory
WORKDIR /usr/src/app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy application code
COPY . .

# Create directories and set permissions
RUN mkdir -p /usr/src/app/logs && \
    mkdir -p /usr/src/app/data && \
    chown -R nodejs:nodejs /usr/src/app

# Switch to non-root user
USER nodejs

# Expose webhook port
EXPOSE 3004

# Health check using webhook endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3004/health || exit 1

# Start the application
CMD ["npm", "start"]