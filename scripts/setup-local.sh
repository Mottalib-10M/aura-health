#!/usr/bin/env bash
###############################################################################
# Uzavita - Local Development Setup Script
#
# Sets up the complete local development environment:
#   1. Checks prerequisites (node, npm, docker, python)
#   2. Installs all dependencies
#   3. Creates .env files from templates
#   4. Starts Docker services
#   5. Runs database migrations
#   6. Seeds development data
#   7. Prints access URLs
#
# Usage: ./scripts/setup-local.sh [--skip-docker] [--skip-seed] [--reset]
###############################################################################

set -euo pipefail
IFS=$'\n\t'

# =============================================================================
# Configuration
# =============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Flags
SKIP_DOCKER=false
SKIP_SEED=false
RESET=false

# =============================================================================
# Argument Parsing
# =============================================================================
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-docker)
      SKIP_DOCKER=true
      shift
      ;;
    --skip-seed)
      SKIP_SEED=true
      shift
      ;;
    --reset)
      RESET=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --skip-docker  Skip Docker services startup"
      echo "  --skip-seed    Skip database seeding"
      echo "  --reset        Reset everything (removes volumes, reinstalls)"
      echo "  --help, -h     Show this help message"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# =============================================================================
# Helper Functions
# =============================================================================
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

check_command() {
  if command -v "$1" &> /dev/null; then
    local version
    version=$("$1" --version 2>&1 | head -n 1)
    log_success "$1 found: ${version}"
    return 0
  else
    log_error "$1 is not installed"
    return 1
  fi
}

wait_for_service() {
  local service_name="$1"
  local url="$2"
  local max_attempts="${3:-30}"
  local attempt=1

  log_info "Waiting for ${service_name} to be ready..."
  while [[ $attempt -le $max_attempts ]]; do
    if curl -sf "${url}" > /dev/null 2>&1; then
      log_success "${service_name} is ready"
      return 0
    fi
    echo -n "."
    sleep 2
    attempt=$((attempt + 1))
  done
  echo ""
  log_error "${service_name} did not become ready after $((max_attempts * 2)) seconds"
  return 1
}

# =============================================================================
# Main
# =============================================================================
main() {
  echo ""
  echo "======================================================================"
  echo "  Uzavita - Local Development Setup"
  echo "======================================================================"
  echo ""

  cd "${PROJECT_ROOT}"

  # ---------------------------------------------------------------------------
  # Step 1: Check Prerequisites
  # ---------------------------------------------------------------------------
  echo "----------------------------------------------------------------------"
  echo "  Step 1: Checking Prerequisites"
  echo "----------------------------------------------------------------------"
  echo ""

  local prereq_failed=false

  if ! check_command "node"; then
    log_error "Please install Node.js 22+ (https://nodejs.org)"
    prereq_failed=true
  else
    local node_major
    node_major=$(node -v | sed 's/v//' | cut -d. -f1)
    if [[ "$node_major" -lt 22 ]]; then
      log_warn "Node.js 22+ recommended (found v$(node -v | sed 's/v//'))"
    fi
  fi

  if ! check_command "npm"; then
    prereq_failed=true
  fi

  if ! check_command "docker"; then
    log_error "Please install Docker (https://docs.docker.com/get-docker/)"
    prereq_failed=true
  fi

  if ! docker compose version &> /dev/null; then
    log_error "Docker Compose V2 is required. Please update Docker."
    prereq_failed=true
  else
    log_success "Docker Compose found: $(docker compose version --short)"
  fi

  if ! check_command "python3"; then
    log_warn "Python 3 is not installed - ML service will not work locally"
  fi

  if ! check_command "git"; then
    prereq_failed=true
  fi

  if [[ "$prereq_failed" == true ]]; then
    log_error "Prerequisites check failed. Please install missing tools."
    exit 1
  fi

  echo ""
  log_success "All prerequisites satisfied"
  echo ""

  # ---------------------------------------------------------------------------
  # Step 1.5: Reset if requested
  # ---------------------------------------------------------------------------
  if [[ "$RESET" == true ]]; then
    echo "----------------------------------------------------------------------"
    echo "  Resetting Environment"
    echo "----------------------------------------------------------------------"
    echo ""
    log_warn "Stopping all Docker services and removing volumes..."
    docker compose down -v --remove-orphans 2>/dev/null || true
    log_info "Removing node_modules..."
    rm -rf node_modules packages/*/node_modules
    log_info "Removing .env files..."
    rm -f .env packages/*/.env
    log_success "Reset complete"
    echo ""
  fi

  # ---------------------------------------------------------------------------
  # Step 2: Install Dependencies
  # ---------------------------------------------------------------------------
  echo "----------------------------------------------------------------------"
  echo "  Step 2: Installing Dependencies"
  echo "----------------------------------------------------------------------"
  echo ""

  log_info "Installing npm dependencies (this may take a few minutes)..."
  npm ci
  log_success "npm dependencies installed"

  # Install Python dependencies if python3 is available
  if command -v python3 &> /dev/null && [[ -f "packages/ml-service/requirements.txt" ]]; then
    log_info "Installing Python dependencies for ML service..."
    if [[ ! -d "packages/ml-service/.venv" ]]; then
      python3 -m venv packages/ml-service/.venv
    fi
    source packages/ml-service/.venv/bin/activate
    pip install -q -r packages/ml-service/requirements.txt
    pip install -q -r packages/ml-service/requirements-dev.txt 2>/dev/null || true
    deactivate
    log_success "Python dependencies installed"
  fi

  echo ""

  # ---------------------------------------------------------------------------
  # Step 3: Create .env Files
  # ---------------------------------------------------------------------------
  echo "----------------------------------------------------------------------"
  echo "  Step 3: Creating Environment Files"
  echo "----------------------------------------------------------------------"
  echo ""

  # Root .env
  if [[ ! -f ".env" ]]; then
    if [[ -f ".env.example" ]]; then
      cp .env.example .env
      log_success "Created .env from .env.example"
    else
      cat > .env << 'ENVEOF'
# Uzavita - Root Environment Variables
NODE_ENV=development
LOG_LEVEL=debug
ENVEOF
      log_success "Created .env with defaults"
    fi
  else
    log_info ".env already exists, skipping"
  fi

  # Backend .env
  if [[ ! -f "packages/backend/.env" ]]; then
    if [[ -f "packages/backend/.env.example" ]]; then
      cp packages/backend/.env.example packages/backend/.env
    else
      cat > packages/backend/.env << 'ENVEOF'
# Uzavita Backend - Local Development
NODE_ENV=development
PORT=4000
LOG_LEVEL=debug

# Database
DATABASE_URL=postgresql://uzavita_admin:uzavita_dev_password@localhost:5432/uzavita

# Redis
REDIS_URL=redis://localhost:6379

# Kafka
KAFKA_BROKERS=localhost:9092

# Elasticsearch
ELASTICSEARCH_URL=http://localhost:9200

# S3 (MinIO)
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=uzavita_minio_admin
S3_SECRET_KEY=uzavita_minio_secret
S3_BUCKET=uzavita-dev
S3_FORCE_PATH_STYLE=true

# Auth
JWT_SECRET=dev-jwt-secret-replace-in-production-at-least-32-chars
JWT_REFRESH_SECRET=dev-jwt-refresh-secret-replace-in-production-32-chars
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:8081

# GraphQL
GRAPHQL_PLAYGROUND=true
ENVEOF
    fi
    log_success "Created packages/backend/.env"
  else
    log_info "packages/backend/.env already exists, skipping"
  fi

  # ML Service .env
  if [[ ! -f "packages/ml-service/.env" ]]; then
    if [[ -f "packages/ml-service/.env.example" ]]; then
      cp packages/ml-service/.env.example packages/ml-service/.env
    else
      cat > packages/ml-service/.env << 'ENVEOF'
# Uzavita ML Service - Local Development
PORT=8000
LOG_LEVEL=debug
ENVIRONMENT=development

# Database
DATABASE_URL=postgresql://uzavita_admin:uzavita_dev_password@localhost:5432/uzavita

# Redis
REDIS_URL=redis://localhost:6379

# Kafka
KAFKA_BROKERS=localhost:9092

# Model paths
MODEL_CACHE_DIR=./models
TRIAGE_MODEL_PATH=./models/triage
NLP_MODEL_PATH=./models/nlp
ENVEOF
    fi
    log_success "Created packages/ml-service/.env"
  else
    log_info "packages/ml-service/.env already exists, skipping"
  fi

  echo ""

  # ---------------------------------------------------------------------------
  # Step 4: Start Docker Services
  # ---------------------------------------------------------------------------
  if [[ "$SKIP_DOCKER" == false ]]; then
    echo "----------------------------------------------------------------------"
    echo "  Step 4: Starting Docker Services"
    echo "----------------------------------------------------------------------"
    echo ""

    log_info "Starting infrastructure services..."
    docker compose up -d postgres redis elasticsearch zookeeper kafka minio

    # Wait for critical services
    wait_for_service "PostgreSQL" "http://localhost:5432" 30 2>/dev/null || \
      log_info "PostgreSQL health check via HTTP not available, checking via docker..."

    # Use docker to verify postgres is ready
    local pg_attempts=0
    while [[ $pg_attempts -lt 30 ]]; do
      if docker compose exec -T postgres pg_isready -U uzavita_admin -d uzavita > /dev/null 2>&1; then
        log_success "PostgreSQL is ready"
        break
      fi
      echo -n "."
      sleep 2
      pg_attempts=$((pg_attempts + 1))
    done

    if [[ $pg_attempts -ge 30 ]]; then
      log_error "PostgreSQL failed to start"
      exit 1
    fi

    # Wait for Redis
    local redis_attempts=0
    while [[ $redis_attempts -lt 15 ]]; do
      if docker compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        log_success "Redis is ready"
        break
      fi
      sleep 2
      redis_attempts=$((redis_attempts + 1))
    done

    echo ""
  else
    log_info "Skipping Docker services (--skip-docker)"
    echo ""
  fi

  # ---------------------------------------------------------------------------
  # Step 5: Run Database Migrations
  # ---------------------------------------------------------------------------
  echo "----------------------------------------------------------------------"
  echo "  Step 5: Running Database Migrations"
  echo "----------------------------------------------------------------------"
  echo ""

  if [[ -f "packages/backend/package.json" ]]; then
    log_info "Running database migrations..."
    if npm run db:migrate --workspace=packages/backend 2>/dev/null; then
      log_success "Database migrations completed"
    else
      log_warn "Migration command not found or failed - you may need to run migrations manually"
    fi
  fi

  echo ""

  # ---------------------------------------------------------------------------
  # Step 6: Seed Development Data
  # ---------------------------------------------------------------------------
  if [[ "$SKIP_SEED" == false ]]; then
    echo "----------------------------------------------------------------------"
    echo "  Step 6: Seeding Development Data"
    echo "----------------------------------------------------------------------"
    echo ""

    if [[ -f "packages/backend/package.json" ]]; then
      log_info "Seeding development data..."
      if npm run db:seed --workspace=packages/backend 2>/dev/null; then
        log_success "Development data seeded"
      else
        log_warn "Seed command not found or failed - you may need to seed manually"
      fi
    fi

    echo ""
  else
    log_info "Skipping seed (--skip-seed)"
    echo ""
  fi

  # ---------------------------------------------------------------------------
  # Step 7: Print Access URLs
  # ---------------------------------------------------------------------------
  echo "======================================================================"
  echo "  Setup Complete! Access URLs:"
  echo "======================================================================"
  echo ""
  echo -e "  ${GREEN}Backend API:${NC}         http://localhost:4000"
  echo -e "  ${GREEN}GraphQL Playground:${NC}  http://localhost:4000/graphql"
  echo -e "  ${GREEN}Web Frontend:${NC}        http://localhost:3000"
  echo -e "  ${GREEN}ML Service:${NC}          http://localhost:8000"
  echo -e "  ${GREEN}ML Service Docs:${NC}     http://localhost:8000/docs"
  echo ""
  echo -e "  ${BLUE}PostgreSQL:${NC}          localhost:5432 (uzavita_admin/uzavita_dev_password)"
  echo -e "  ${BLUE}Redis:${NC}               localhost:6379"
  echo -e "  ${BLUE}Elasticsearch:${NC}       http://localhost:9200"
  echo -e "  ${BLUE}Kafka:${NC}               localhost:9092"
  echo -e "  ${BLUE}MinIO Console:${NC}       http://localhost:9001 (uzavita_minio_admin/uzavita_minio_secret)"
  echo ""
  echo "----------------------------------------------------------------------"
  echo "  Quick Start Commands:"
  echo "----------------------------------------------------------------------"
  echo ""
  echo "  Start backend:     npm run dev --workspace=packages/backend"
  echo "  Start web:         npm run dev --workspace=packages/web"
  echo "  Start ML service:  cd packages/ml-service && source .venv/bin/activate && uvicorn src.main:app --reload --port 8000"
  echo "  Start mobile:      npm run start --workspace=packages/mobile"
  echo ""
  echo "  Run all tests:     npm test --workspaces"
  echo "  Stop Docker:       docker compose down"
  echo "  View logs:         docker compose logs -f [service]"
  echo ""
}

# Run main
main "$@"
