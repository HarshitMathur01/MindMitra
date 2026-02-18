# ══════════════════════════════════════════════════════════════
# MindMitra Backend - Production Dockerfile with uv pip
# ══════════════════════════════════════════════════════════════

# ──────────────────────────────────────────────────────────────
# Stage 1: Builder - Install dependencies with uv
# ──────────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

# Install uv for fast dependency resolution
RUN pip install --no-cache-dir uv==0.4.30

WORKDIR /build

# Copy requirements and install dependencies
COPY requirements.txt .

# Use uv to install - 10x faster than pip
# --system: install to system Python (no venv needed in Docker)
# --no-cache: don't cache downloads (reduces image size)
RUN uv pip install --system --no-cache -r requirements.txt

# ──────────────────────────────────────────────────────────────
# Stage 2: Runtime - Lean production image
# ──────────────────────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Copy installed packages from builder stage
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application source code
COPY . .

# Create directories for runtime data
RUN mkdir -p logs user_contexts && \
    chmod 755 logs user_contexts

# Railway/Render will set $PORT environment variable
EXPOSE 8000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT:-8000}/health').read()"

# Start FastAPI with uvicorn
# Use $PORT if set (Railway/Render), fallback to 8000
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --log-level info