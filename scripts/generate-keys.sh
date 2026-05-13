#!/usr/bin/env bash
###############################################################################
# Aura Health - Key Generation Script
#
# Generates cryptographic keys and secrets for development:
#   - JWT access token secret
#   - JWT refresh token secret
#   - AES-256 encryption key
#   - Database password
#   - Redis password
#   - Recovery codes
#   - API signing key
#
# Usage:
#   ./scripts/generate-keys.sh [options]
#
# Options:
#   --output, -o    Output file path (default: prints to stdout)
#   --format, -f    Output format: env, json, yaml (default: env)
#   --recovery-codes N  Number of recovery codes to generate (default: 10)
###############################################################################

set -euo pipefail
IFS=$'\n\t'

# =============================================================================
# Configuration
# =============================================================================
OUTPUT_FILE=""
OUTPUT_FORMAT="env"
RECOVERY_CODE_COUNT=10

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
    --output|-o)
      OUTPUT_FILE="$2"
      shift 2
      ;;
    --format|-f)
      OUTPUT_FORMAT="$2"
      shift 2
      ;;
    --recovery-codes)
      RECOVERY_CODE_COUNT="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --output, -o         Output file path (default: stdout)"
      echo "  --format, -f         Output format: env, json, yaml (default: env)"
      echo "  --recovery-codes N   Number of recovery codes (default: 10)"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}" >&2
      exit 1
      ;;
  esac
done

# =============================================================================
# Helper Functions
# =============================================================================
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1" >&2
}

log_success() {
  echo -e "${GREEN}[OK]${NC} $1" >&2
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1" >&2
}

# Generate a random hex string of specified byte length
generate_hex() {
  local bytes="${1:-32}"
  openssl rand -hex "${bytes}" 2>/dev/null || \
    head -c "${bytes}" /dev/urandom | xxd -p | tr -d '\n'
}

# Generate a random base64 string of specified byte length
generate_base64() {
  local bytes="${1:-32}"
  openssl rand -base64 "${bytes}" 2>/dev/null || \
    head -c "${bytes}" /dev/urandom | base64 | tr -d '\n'
}

# Generate an alphanumeric password of specified length
generate_password() {
  local length="${1:-32}"
  openssl rand -base64 48 2>/dev/null | tr -dc 'a-zA-Z0-9!@#$%^&*' | head -c "${length}" || \
    head -c 48 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9!@#$%^&*' | head -c "${length}"
}

# Generate alphanumeric-only password (safe for URLs and connection strings)
generate_safe_password() {
  local length="${1:-32}"
  openssl rand -base64 48 2>/dev/null | tr -dc 'a-zA-Z0-9' | head -c "${length}" || \
    head -c 48 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c "${length}"
}

# Generate recovery codes (format: XXXX-XXXX-XXXX)
generate_recovery_code() {
  local part1 part2 part3
  part1=$(openssl rand -hex 2 | tr '[:lower:]' '[:upper:]')
  part2=$(openssl rand -hex 2 | tr '[:lower:]' '[:upper:]')
  part3=$(openssl rand -hex 2 | tr '[:lower:]' '[:upper:]')
  echo "${part1}-${part2}-${part3}"
}

# =============================================================================
# Key Generation
# =============================================================================
main() {
  log_info "Generating cryptographic keys and secrets..."
  echo "" >&2

  # Check for OpenSSL
  if ! command -v openssl &> /dev/null; then
    log_warn "openssl not found, falling back to /dev/urandom"
  fi

  # Generate all keys
  local jwt_secret
  jwt_secret=$(generate_base64 48)
  log_success "JWT Access Token Secret generated (384-bit)"

  local jwt_refresh_secret
  jwt_refresh_secret=$(generate_base64 48)
  log_success "JWT Refresh Token Secret generated (384-bit)"

  local encryption_key
  encryption_key=$(generate_hex 32)
  log_success "AES-256 Encryption Key generated (256-bit)"

  local audit_encryption_key
  audit_encryption_key=$(generate_hex 32)
  log_success "Audit Log Encryption Key generated (256-bit)"

  local db_password
  db_password=$(generate_safe_password 32)
  log_success "Database Password generated (32 chars)"

  local redis_password
  redis_password=$(generate_safe_password 32)
  log_success "Redis Password generated (32 chars)"

  local api_signing_key
  api_signing_key=$(generate_hex 32)
  log_success "API Signing Key generated (256-bit)"

  local session_secret
  session_secret=$(generate_base64 32)
  log_success "Session Secret generated (256-bit)"

  local webhook_secret
  webhook_secret=$(generate_hex 32)
  log_success "Webhook Secret generated (256-bit)"

  # Generate recovery codes
  local recovery_codes=()
  for ((i = 1; i <= RECOVERY_CODE_COUNT; i++)); do
    recovery_codes+=("$(generate_recovery_code)")
  done
  log_success "${RECOVERY_CODE_COUNT} Recovery Codes generated"

  echo "" >&2

  # -------------------------------------------------------------------------
  # Output
  # -------------------------------------------------------------------------
  local output=""

  case "${OUTPUT_FORMAT}" in
    env)
      output=$(cat << ENVEOF
###############################################################################
# Aura Health - Generated Secrets
# Generated at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
#
# WARNING: Store these securely. Do NOT commit to version control.
###############################################################################

# JWT Secrets
JWT_SECRET=${jwt_secret}
JWT_REFRESH_SECRET=${jwt_refresh_secret}

# Encryption Keys (AES-256, hex-encoded)
ENCRYPTION_KEY=${encryption_key}
AUDIT_ENCRYPTION_KEY=${audit_encryption_key}

# Database
DATABASE_PASSWORD=${db_password}

# Redis
REDIS_PASSWORD=${redis_password}

# API Keys
API_SIGNING_KEY=${api_signing_key}
SESSION_SECRET=${session_secret}
WEBHOOK_SECRET=${webhook_secret}

# Recovery Codes (store securely, provide to admin users)
$(for i in "${!recovery_codes[@]}"; do echo "# RECOVERY_CODE_$((i + 1))=${recovery_codes[$i]}"; done)
ENVEOF
      )
      ;;

    json)
      local recovery_json
      recovery_json=$(printf '"%s",' "${recovery_codes[@]}" | sed 's/,$//')
      output=$(cat << JSONEOF
{
  "generated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "jwt": {
    "access_token_secret": "${jwt_secret}",
    "refresh_token_secret": "${jwt_refresh_secret}"
  },
  "encryption": {
    "aes_256_key": "${encryption_key}",
    "audit_log_key": "${audit_encryption_key}"
  },
  "database": {
    "password": "${db_password}"
  },
  "redis": {
    "password": "${redis_password}"
  },
  "api": {
    "signing_key": "${api_signing_key}",
    "session_secret": "${session_secret}",
    "webhook_secret": "${webhook_secret}"
  },
  "recovery_codes": [${recovery_json}]
}
JSONEOF
      )
      ;;

    yaml)
      output=$(cat << YAMLEOF
# Aura Health - Generated Secrets
# Generated at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# WARNING: Store these securely. Do NOT commit to version control.

jwt:
  access_token_secret: "${jwt_secret}"
  refresh_token_secret: "${jwt_refresh_secret}"

encryption:
  aes_256_key: "${encryption_key}"
  audit_log_key: "${audit_encryption_key}"

database:
  password: "${db_password}"

redis:
  password: "${redis_password}"

api:
  signing_key: "${api_signing_key}"
  session_secret: "${session_secret}"
  webhook_secret: "${webhook_secret}"

recovery_codes:
$(for code in "${recovery_codes[@]}"; do echo "  - \"${code}\""; done)
YAMLEOF
      )
      ;;

    *)
      echo -e "${RED}Unknown format: ${OUTPUT_FORMAT}${NC}" >&2
      exit 1
      ;;
  esac

  # Write output
  if [[ -n "${OUTPUT_FILE}" ]]; then
    echo "${output}" > "${OUTPUT_FILE}"
    chmod 600 "${OUTPUT_FILE}"
    log_success "Secrets written to ${OUTPUT_FILE} (permissions: 600)"
  else
    echo "${output}"
  fi

  echo "" >&2
  echo -e "${YELLOW}[IMPORTANT]${NC} These secrets should be:" >&2
  echo "  1. Stored in a secrets manager (AWS Secrets Manager, Vault, etc.)" >&2
  echo "  2. NEVER committed to version control" >&2
  echo "  3. Rotated regularly in production" >&2
  echo "  4. Different for each environment" >&2
  echo "" >&2
}

main "$@"
