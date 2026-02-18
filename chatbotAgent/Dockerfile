# ══════════════════════════════════════════════════════════════
# MindMitra Backend - Production Dockerfile
# CPU-only PyTorch, optimized for Railway deployment
# ══════════════════════════════════════════════════════════════

# ──────────────────────────────────────────────────────────────
# Stage 1: Builder - Install dependencies
# ──────────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

# Install uv for fast dependency resolution
RUN pip install --no-cache-dir uv==0.4.30

WORKDIR /build

# Copy requirements
COPY requirements.txt .

# Install PyTorch CPU-only FIRST (prevents CUDA packages)
RUN uv pip install --system --no-cache "torch>=2.2,<3.0"

# Install all other dependencies
RUN uv pip install --system --no-cache -r requirements.txt

# Clean up unnecessary files to reduce image size
RUN find /usr/local/lib/python3.11/site-packages -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true && \
    find /usr/local/lib/python3.11/site-packages -type f -name "*.pyc" -delete && \
    find /usr/local/lib/python3.11/site-packages -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

# ──────────────────────────────────────────────────────────────
# Stage 2: Runtime - Lean production image
# ──────────────────────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY . .

# Create runtime directories
RUN mkdir -p logs user_contexts && \
    chmod 755 logs user_contexts

# Railway sets $PORT dynamically at runtime
EXPOSE 8000

# Start FastAPI with uvicorn
# Railway provides $PORT environment variable
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --log-level info --timeout-keep-alive 75