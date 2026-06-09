###############################################################################
# Uzavita ML Service -- Production Dockerfile
###############################################################################
# Multi-stage build for minimal image size.
# Stage 1: Install Python dependencies
# Stage 2: Copy application code and run

# ---------------------------------------------------------------------------
# Stage 1: Builder -- install dependencies
# ---------------------------------------------------------------------------
FROM python:3.11-slim AS builder

WORKDIR /build

# System dependencies for scientific packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies into a virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r requirements.txt

# ---------------------------------------------------------------------------
# Stage 2: Runtime -- minimal image with app code
# ---------------------------------------------------------------------------
FROM python:3.11-slim AS runtime

LABEL maintainer="Uzavita Engineering <engineering@uzavita.com>"
LABEL description="Uzavita AI/ML Model Serving Service"
LABEL org.opencontainers.image.source="https://github.com/uzavita/uzavita"

# Runtime system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    libgl1-mesa-glx \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN groupadd --gid 1000 uzavita \
    && useradd --uid 1000 --gid uzavita --shell /bin/bash --create-home uzavita

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Set working directory
WORKDIR /app

# Copy application source
COPY pyproject.toml .
COPY src/ ./src/

# Create model cache directory
RUN mkdir -p /tmp/uzavita-models && chown -R uzavita:uzavita /tmp/uzavita-models

# Set environment defaults
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    LOG_LEVEL=INFO \
    ENVIRONMENT=production \
    MODEL_CACHE_DIR=/tmp/uzavita-models

# Switch to non-root user
USER uzavita

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run the application
CMD ["uvicorn", "src.api.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8080", \
     "--workers", "2", \
     "--loop", "uvloop", \
     "--http", "httptools", \
     "--access-log", \
     "--log-level", "info"]
