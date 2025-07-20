// src/utils/mongoUri.js - Environment-aware MongoDB URI selection
import { logger } from './logger.js';
import fs from 'fs';

/**
 * Get the appropriate MongoDB URI based on the current environment
 * @returns {string} The MongoDB URI to use
 */
export function getMongoUri() {
  const baseUri = process.env.MONGO_URI;
  const nodeEnv = process.env.NODE_ENV;
  const dockerEnv = process.env.DOCKER_ENV === 'true';


  if (!baseUri) {
    throw new Error('MONGO_URI environment variable is not set');
  }

  // Check if we're in a GitHub Actions or CI environment (build time)
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  
  // If MONGO_URI contains host.docker.internal but we're in CI/build environment, use localhost instead
  if (baseUri.includes('host.docker.internal') && isCI) {
    const dbName = extractDatabaseName(baseUri);
    // For CI, use simple localhost connection without auth
    const ciUri = `mongodb://localhost:27017/${dbName}`;
    logger.info(`🔧 CI environment detected, using localhost without auth: ${maskUri(ciUri)}`);
    return ciUri;
  }
  
  // If MONGO_URI is a complete URI with a specific host, use it as-is
  if (baseUri.includes('://') && (baseUri.includes('host.docker.internal') || baseUri.includes('localhost') || baseUri.includes('mongodb://mongodb:') || baseUri.includes('mongodb+srv://'))) {
    logger.info(`📋 Using explicit MONGO_URI: ${maskUri(baseUri)}`);
    return baseUri;
  }

  // Only do smart detection if MONGO_URI doesn't specify a complete connection string
  const isDockerDetected = isRunningInDocker();
  const isDockerEnvironment = dockerEnv || isDockerDetected;

  // Extract database name from the URI
  const dbName = extractDatabaseName(baseUri);
  
  // Log environment detection for debugging
  logger.info(`🔍 Environment detection - DOCKER_ENV: ${dockerEnv}, NODE_ENV: ${nodeEnv}, Docker detected: ${isDockerDetected}, Final decision: ${isDockerEnvironment ? 'Docker' : 'Local'}`);
  
  if (isDockerEnvironment) {
    // For Docker Compose, use service name; for standalone Docker, use host.docker.internal
    const mongoHost = process.env.MONGO_HOST || 'mongodb';
    const dockerUri = `mongodb://${mongoHost}:27017/${dbName}`;
    logger.info(`🐳 Using Docker MongoDB URI: ${dockerUri} (container environment detected)`);
    return dockerUri;
  } else {
    // Use localhost for local development
    const localUri = `mongodb://localhost:27017/${dbName}`;
    logger.info('🏠 Using local MongoDB URI (development environment detected)');
    return localUri;
  }
}

/**
 * Check if we're running inside a Docker container
 * @returns {boolean} True if running in Docker
 */
function isRunningInDocker() {
  try {
    // Check for .dockerenv file (Docker creates this)
    if (fs.existsSync('/.dockerenv')) {
      logger.debug('Docker detected via .dockerenv file');
      return true;
    }

    // Check cgroup for docker indicators
    if (fs.existsSync('/proc/1/cgroup')) {
      const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8');
      const isDocker = cgroup.includes('docker') || cgroup.includes('kubepods') || cgroup.includes('/docker/');
      if (isDocker) {
        logger.debug('Docker detected via cgroup');
      }
      return isDocker;
    }

    // Check for common Docker environment variables
    if (process.env.KUBERNETES_SERVICE_HOST || 
        process.env.DOCKER_CONTAINER ||
        process.env.container === 'docker') {
      logger.debug('Docker detected via environment variables');
      return true;
    }

    return false;
  } catch (error) {
    // If we can't determine, assume local development
    logger.debug('Could not detect Docker environment, assuming local development:', error.message);
    return false;
  }
}

/**
 * Extract database name from MongoDB URI
 * @param {string} uri - The MongoDB URI
 * @returns {string} The database name
 */
function extractDatabaseName(uri) {
  try {
    // Handle different URI formats
    if (uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://')) {
      // Extract database name from the end of the URI
      const parts = uri.split('/');
      const lastPart = parts[parts.length - 1];
      
      // Remove query parameters if present
      const dbName = lastPart.split('?')[0];
      
      return dbName || 'technical_workspace';
    }
    
    // Fallback to default database name
    return 'technical_workspace';
  } catch (error) {
    logger.warn('Could not extract database name from URI, using default');
    return 'technical_workspace';
  }
}

/**
 * Validate that the MongoDB URI is accessible
 * @param {string} uri - The MongoDB URI to validate
 * @returns {Promise<boolean>} True if the URI is accessible
 */
export async function validateMongoUri(uri) {
  try {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 3000, // 3 second timeout
      connectTimeoutMS: 3000
    });
    
    await client.connect();
    await client.db().admin().ping();
    await client.close();
    
    return true;
  } catch (error) {
    logger.error(`MongoDB URI validation failed for ${maskUri(uri)}:`, error.message);
    return false;
  }
}

/**
 * Mask sensitive information in MongoDB URI for logging
 * @param {string} uri - The URI to mask
 * @returns {string} The masked URI
 */
function maskUri(uri) {
  if (!uri) return 'undefined';
  
  // Replace any credentials with ***
  return uri.replace(/:\/\/[^@]*@/, '://***:***@');
}

/**
 * Get environment info for debugging
 * @returns {object} Environment information
 */
export function getEnvironmentInfo() {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    dockerEnv: process.env.DOCKER_ENV === 'true',
    isDocker: isRunningInDocker(),
    isCI: process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true',
    mongoUri: maskUri(process.env.MONGO_URI),
    resolvedUri: maskUri(getMongoUri())
  };
}