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
RUN uv pip install --system --no-cache \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    torch==2.5.1+cpu

# Install all other dependencies
RUN uv pip install --system --no-cache -r requirements.txt

# Clean up unnecessary files to reduce image size
RUN find /usr/local/lib/python3.11/site-packages -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true && \
    find /usr/local/lib/python3.11/site-packages -type f -name "*.pyc" -delete && \
    find /usr/local/lib/python3.11/site-packages -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

# Pre-download all-MiniLM-L6-v2 at build time (~90 MB).
# Baking into the image avoids a cold-start HuggingFace download on Railway.
RUN python -c "from sentence_transformers import SentenceTransformer; \
    SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2'); \
    print('Model cached successfully')"

# ──────────────────────────────────────────────────────────────
# Stage 2: Runtime - Lean production image
# ──────────────────────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy pre-baked HuggingFace model cache (all-MiniLM-L6-v2, ~90 MB)
COPY --from=builder /root/.cache/huggingface /root/.cache/huggingface

# Copy application code
COPY . .

# Create runtime directories; chmod rhubarb if a Linux binary is present
RUN mkdir -p logs user_contexts && \
    chmod 755 logs user_contexts && \
    if [ -f bin/rhubarb ]; then chmod +x bin/rhubarb; fi

# Railway sets $PORT dynamically at runtime
EXPOSE 8080

# Force every command through sh so $PORT is always shell-expanded,
# even when Railway's dashboard injects a startCommand in exec form.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --log-level info