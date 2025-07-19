#!/bin/bash
# scripts/docker-utils.sh - Docker Management Utilities for Discord LLM Workspace Bot

set -e

PROJECT_NAME="discord-llm-workspace"
CONTAINER_NAME="discord-llm-workspace-bot"
IMAGE_NAME="discord-llm-workspace:latest"
PORT="3003"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if container is running
is_running() {
    docker ps --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"
}

# Function to check if container exists (running or stopped)
container_exists() {
    docker ps -a --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"
}

# Build the Docker image
build() {
    log_info "Building Docker image..."
    docker build -t $IMAGE_NAME .
    log_info "✅ Image built successfully"
}

# Start the container
start() {
    if is_running; then
        log_warn "Container is already running"
        return 0
    fi

    if container_exists; then
        log_info "Starting existing container..."
        docker start $CONTAINER_NAME
    else
        log_info "Creating and starting new container..."
        
        # Ensure network exists
        docker network create gibbs-apps 2>/dev/null || true
        
        # Create necessary directories
        mkdir -p logs data backups
        
        docker run -d \
            --name $CONTAINER_NAME \
            --restart unless-stopped \
            --network gibbs-apps \
            -p $PORT:$PORT \
            -v $(pwd)/logs:/usr/src/app/logs:rw \
            -v $(pwd)/data:/usr/src/app/data:rw \
            -v $(pwd)/backups:/usr/src/app/backups:rw \
            --env-file .env \
            -e NODE_ENV=production \
            -e PORT=$PORT \
            $IMAGE_NAME
    fi
    
    log_info "✅ Container started successfully"
}

# Stop the container
stop() {
    if is_running; then
        log_info "Stopping container..."
        docker stop $CONTAINER_NAME
        log_info "✅ Container stopped"
    else
        log_warn "Container is not running"
    fi
}

# Restart the container
restart() {
    log_info "Restarting container..."
    stop
    sleep 2
    start
}

# Remove the container
remove() {
    if container_exists; then
        if is_running; then
            log_info "Stopping container before removal..."
            docker stop $CONTAINER_NAME
        fi
        log_info "Removing container..."
        docker rm $CONTAINER_NAME
        log_info "✅ Container removed"
    else
        log_warn "Container does not exist"
    fi
}

# Show container logs
logs() {
    if container_exists; then
        docker logs ${1:--f} $CONTAINER_NAME
    else
        log_error "Container does not exist"
        exit 1
    fi
}

# Execute command in container
exec_cmd() {
    if is_running; then
        docker exec -it $CONTAINER_NAME "${@:-bash}"
    else
        log_error "Container is not running"
        exit 1
    fi
}

# Show container status
status() {
    echo "=== Discord LLM Workspace Bot Status ==="
    echo ""
    
    if container_exists; then
        if is_running; then
            log_info "Container is running"
            docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep $CONTAINER_NAME
        else
            log_warn "Container exists but is not running"
            docker ps -a --format "table {{.Names}}\t{{.Status}}" | grep $CONTAINER_NAME
        fi
    else
        log_warn "Container does not exist"
    fi
    
    echo ""
    echo "Image status:"
    docker images | grep discord-llm-workspace || log_warn "No images found"
    
    echo ""
    echo "Network status:"
    docker network ls | grep gibbs-apps || log_warn "Network not found"
}

# Run health check
health() {
    if is_running; then
        log_info "Running health check..."
        if docker exec $CONTAINER_NAME npm run test:health; then
            log_info "✅ Health check passed"
        else
            log_error "❌ Health check failed"
            exit 1
        fi
    else
        log_error "Container is not running"
        exit 1
    fi
}

# Run integration tests
test() {
    if is_running; then
        log_info "Running integration tests..."
        docker exec $CONTAINER_NAME npm test
    else
        log_error "Container is not running"
        exit 1
    fi
}

# Deploy (build and start)
deploy() {
    log_info "Deploying Discord LLM Workspace Bot..."
    
    # Check if .env exists
    if [ ! -f .env ]; then
        log_error ".env file not found. Copy .env.example to .env and configure it."
        exit 1
    fi
    
    # Run migration if needed
    if [ "$1" = "--migrate" ]; then
        log_info "Running database migration..."
        npm run migrate
    fi
    
    # Stop existing container
    if is_running; then
        stop
    fi
    
    # Build new image
    build
    
    # Start container
    start
    
    # Wait for startup
    log_info "Waiting for bot to initialize..."
    sleep 15
    
    # Run health check
    health
    
    log_info "✅ Deployment completed successfully"
    status
}

# Backup data
backup() {
    log_info "Creating backup..."
    timestamp=$(date +%Y%m%d_%H%M%S)
    backup_dir="backup_${timestamp}"
    
    mkdir -p $backup_dir
    
    # Backup data and logs
    cp -r logs $backup_dir/ 2>/dev/null || true
    cp -r data $backup_dir/ 2>/dev/null || true
    
    # Backup configuration if container is running
    if is_running; then
        docker exec $CONTAINER_NAME npm run backup > $backup_dir/config_backup.json 2>/dev/null || true
    fi
    
    # Create tarball
    tar -czf "${backup_dir}.tar.gz" $backup_dir
    rm -rf $backup_dir
    
    log_info "✅ Backup created: ${backup_dir}.tar.gz"
}

# Clean up old images and containers
cleanup() {
    log_info "Cleaning up Docker resources..."
    
    # Remove stopped containers
    docker container prune -f --filter label=app=discord-llm-workspace
    
    # Remove unused images
    docker image prune -f --filter label=app=discord-llm-workspace
    
    # Remove dangling images
    docker rmi $(docker images -f "dangling=true" -q) 2>/dev/null || true
    
    log_info "✅ Cleanup completed"
}

# Show help
help() {
    echo "Docker management utilities for Discord LLM Workspace Bot"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  build                 Build the Docker image"
    echo "  start                 Start the container"
    echo "  stop                  Stop the container"
    echo "  restart               Restart the container"
    echo "  remove                Remove the container"
    echo "  logs [options]        Show container logs (default: -f for follow)"
    echo "  exec [command]        Execute command in container (default: bash)"
    echo "  status                Show container and image status"
    echo "  health                Run health check"
    echo "  test                  Run integration tests"
    echo "  deploy [--migrate]    Build, start, and verify deployment"
    echo "  backup                Create backup of data and configuration"
    echo "  cleanup               Clean up old Docker resources"
    echo "  help                  Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 deploy --migrate   # Deploy with database migration"
    echo "  $0 logs --tail 50     # Show last 50 log lines"
    echo "  $0 exec 'npm run test:health'  # Run health check"
}

# Main script logic
case "${1:-help}" in
    build)
        build
        ;;
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    remove)
        remove
        ;;
    logs)
        shift
        logs "$@"
        ;;
    exec)
        shift
        exec_cmd "$@"
        ;;
    status)
        status
        ;;
    health)
        health
        ;;
    test)
        test
        ;;
    deploy)
        shift
        deploy "$@"
        ;;
    backup)
        backup
        ;;
    cleanup)
        cleanup
        ;;
    help)
        help
        ;;
    *)
        log_error "Unknown command: $1"
        help
        exit 1
        ;;
esac