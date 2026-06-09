#!/usr/bin/env bash
###############################################################################
# Uzavita - Database Migration Runner
#
# Manages database migrations for all environments.
#
# Usage:
#   ./scripts/db-migrate.sh [command] [options]
#
# Commands:
#   up          Run all pending migrations (default)
#   down        Rollback the last migration
#   status      Show migration status
#   create      Create a new migration file
#   reset       Rollback all migrations and re-run (DESTRUCTIVE)
#   seed        Run database seeders
#
# Options:
#   --env, -e   Target environment (local, staging, production)
#   --dry-run   Show what would be executed without running
#   --steps N   Number of migrations to rollback (for 'down' command)
#   --name N    Migration name (for 'create' command)
###############################################################################

set -euo pipefail
IFS=$'\n\t'

# =============================================================================
# Configuration
# =============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/packages/backend"

# Defaults
COMMAND="up"
ENVIRONMENT="local"
DRY_RUN=false
STEPS=1
MIGRATION_NAME=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# =============================================================================
# Argument Parsing
# =============================================================================
while [[ $# -gt 0 ]]; do
  case $1 in
    up|down|status|create|reset|seed)
      COMMAND="$1"
      shift
      ;;
    --env|-e)
      ENVIRONMENT="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --steps)
      STEPS="$2"
      shift 2
      ;;
    --name)
      MIGRATION_NAME="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [command] [options]"
      echo ""
      echo "Commands:"
      echo "  up          Run all pending migrations (default)"
      echo "  down        Rollback the last migration"
      echo "  status      Show migration status"
      echo "  create      Create a new migration file"
      echo "  reset       Rollback all and re-run (DESTRUCTIVE)"
      echo "  seed        Run database seeders"
      echo ""
      echo "Options:"
      echo "  --env, -e   Target environment (local, staging, production)"
      echo "  --dry-run   Show what would be executed"
      echo "  --steps N   Number of migrations to rollback"
      echo "  --name N    Migration name (for 'create')"
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

load_env() {
  local env_file=""

  case "${ENVIRONMENT}" in
    local)
      env_file="${BACKEND_DIR}/.env"
      ;;
    staging)
      env_file="${BACKEND_DIR}/.env.staging"
      ;;
    production)
      env_file="${BACKEND_DIR}/.env.production"
      ;;
    *)
      log_error "Unknown environment: ${ENVIRONMENT}"
      exit 1
      ;;
  esac

  if [[ -f "${env_file}" ]]; then
    log_info "Loading environment from ${env_file}"
    set -a
    # shellcheck disable=SC1090
    source "${env_file}"
    set +a
  else
    log_warn "Environment file not found: ${env_file}"
    if [[ -z "${DATABASE_URL:-}" ]]; then
      log_error "DATABASE_URL is not set. Please create ${env_file} or export DATABASE_URL."
      exit 1
    fi
  fi
}

check_database_connection() {
  log_info "Checking database connection..."

  if ! command -v psql &> /dev/null; then
    # Try connecting via Node.js if psql is not available
    cd "${BACKEND_DIR}"
    if node -e "
      const url = process.env.DATABASE_URL;
      if (!url) { process.exit(1); }
      console.log('Database URL is configured');
    " 2>/dev/null; then
      log_success "Database URL is configured"
      return 0
    else
      log_error "Cannot verify database connection"
      return 1
    fi
  fi

  # Extract connection details from DATABASE_URL
  if psql "${DATABASE_URL}" -c "SELECT 1" > /dev/null 2>&1; then
    log_success "Database connection successful"
    return 0
  else
    log_error "Cannot connect to database"
    return 1
  fi
}

# =============================================================================
# Migration Commands
# =============================================================================
run_migrate_up() {
  log_info "Running pending migrations (environment: ${ENVIRONMENT})..."

  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would execute: npm run db:migrate --workspace=packages/backend"
    return 0
  fi

  cd "${PROJECT_ROOT}"
  npm run db:migrate --workspace=packages/backend

  log_success "Migrations completed successfully"
}

run_migrate_down() {
  log_info "Rolling back ${STEPS} migration(s) (environment: ${ENVIRONMENT})..."

  if [[ "${ENVIRONMENT}" == "production" ]]; then
    log_warn "You are rolling back migrations in PRODUCTION!"
    read -r -p "Are you sure? Type 'yes' to confirm: " confirm
    if [[ "$confirm" != "yes" ]]; then
      log_info "Rollback cancelled"
      exit 0
    fi
  fi

  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would execute: npm run db:migrate:down --workspace=packages/backend"
    return 0
  fi

  cd "${PROJECT_ROOT}"
  for ((i = 1; i <= STEPS; i++)); do
    log_info "Rolling back migration ${i} of ${STEPS}..."
    npm run db:migrate:down --workspace=packages/backend
  done

  log_success "Rollback completed successfully"
}

run_migrate_status() {
  log_info "Checking migration status (environment: ${ENVIRONMENT})..."

  cd "${PROJECT_ROOT}"
  npm run db:migrate:status --workspace=packages/backend 2>/dev/null || \
    log_warn "db:migrate:status command not available. Check migrations manually."
}

run_migrate_create() {
  if [[ -z "${MIGRATION_NAME}" ]]; then
    log_error "Migration name is required. Use --name <name>"
    exit 1
  fi

  log_info "Creating new migration: ${MIGRATION_NAME}"

  cd "${PROJECT_ROOT}"

  local timestamp
  timestamp=$(date +%Y%m%d%H%M%S)
  local migration_dir="${BACKEND_DIR}/migrations"

  mkdir -p "${migration_dir}"

  local migration_file="${migration_dir}/${timestamp}_${MIGRATION_NAME}.ts"

  cat > "${migration_file}" << 'MIGEOF'
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // TODO: Implement migration
}

export async function down(knex: Knex): Promise<void> {
  // TODO: Implement rollback
}
MIGEOF

  log_success "Created migration: ${migration_file}"
}

run_migrate_reset() {
  log_warn "This will DESTROY all data and re-run all migrations!"

  if [[ "${ENVIRONMENT}" == "production" ]]; then
    log_error "Cannot reset production database! Use 'down' to rollback specific migrations."
    exit 1
  fi

  read -r -p "Are you sure? Type 'RESET' to confirm: " confirm
  if [[ "$confirm" != "RESET" ]]; then
    log_info "Reset cancelled"
    exit 0
  fi

  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would reset database and re-run all migrations"
    return 0
  fi

  cd "${PROJECT_ROOT}"

  log_info "Rolling back all migrations..."
  npm run db:migrate:rollback-all --workspace=packages/backend 2>/dev/null || true

  log_info "Running all migrations..."
  npm run db:migrate --workspace=packages/backend

  log_success "Database reset and migrations completed"
}

run_seed() {
  log_info "Running database seeders (environment: ${ENVIRONMENT})..."

  if [[ "${ENVIRONMENT}" == "production" ]]; then
    log_error "Cannot seed production database!"
    exit 1
  fi

  if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would execute: npm run db:seed --workspace=packages/backend"
    return 0
  fi

  cd "${PROJECT_ROOT}"
  npm run db:seed --workspace=packages/backend

  log_success "Seeding completed successfully"
}

# =============================================================================
# Main
# =============================================================================
main() {
  echo ""
  echo "======================================================================"
  echo "  Uzavita - Database Migration Runner"
  echo "  Environment: ${ENVIRONMENT} | Command: ${COMMAND}"
  echo "======================================================================"
  echo ""

  # Load environment
  load_env

  # Check connection (skip for 'create' command)
  if [[ "${COMMAND}" != "create" ]]; then
    check_database_connection
  fi

  echo ""

  # Execute command
  case "${COMMAND}" in
    up)      run_migrate_up ;;
    down)    run_migrate_down ;;
    status)  run_migrate_status ;;
    create)  run_migrate_create ;;
    reset)   run_migrate_reset ;;
    seed)    run_seed ;;
    *)
      log_error "Unknown command: ${COMMAND}"
      exit 1
      ;;
  esac

  echo ""
}

main "$@"
