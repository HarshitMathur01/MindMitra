.PHONY: test-health test-health-full test-health-fast memory-bench backend-up frontend-up help

# Use whichever python is on PATH first (so it picks up your active venv / anaconda).
PYTHON ?= python

help:
	@echo "MindMitra developer targets:"
	@echo "  make test-health-fast   # offline pytest only — quickest sanity check"
	@echo "  make test-health        # offline pytest + frontend build (the default 'is the website healthy?' command)"
	@echo "  make test-health-full   # adds live Supabase/Qdrant integration tests"
	@echo "  make memory-bench       # offline episodic retrieval IR metrics + JSON report (chatbotAgent/evaluations/)"
	@echo "  make backend-up         # run FastAPI dev server on :8000"
	@echo "  make frontend-up        # run Vite dev server on :8080"

# Quickest gate — the offline pytest suite (mocked LLM, mocked auth).
# There is no separate tests/health directory; the offline slice of the
# main suite (everything not marked integration/live_env) is the gate.
test-health-fast:
	@echo "── Backend health (mocked LLM, FastAPI TestClient) ────────────"
	cd chatbotAgent && $(PYTHON) -m pytest -m "not integration and not live_env" --tb=short -x -q
	@echo ""
	@echo "✅ Fast health check passed."

# The default "after-any-change" gate. Adds the frontend build so we
# catch TypeScript / Vite regressions too.
test-health: test-health-fast
	@echo "── Frontend type-check + build (vite) ─────────────────────────"
	npm run build --silent
	@echo ""
	@echo "✅ Health check passed — backend + frontend both green."

# Offline memory architecture benchmark: gold-label Precision@K / Recall@K / MRR / nDCG
# on InMemory Qdrant + stub embeddings. Optional: MEMORY_BENCH_USE_JUDGE=true GROQ_API_KEY=...
memory-bench:
	cd chatbotAgent && $(PYTHON) -m tests.memory_retrieval_benchmark

# Full integration: requires Supabase + Qdrant reachable + RUN_INTEGRATION=1.
test-health-full: test-health
	@echo "── Live Supabase / Qdrant integration smoke ───────────────────"
	cd chatbotAgent && RUN_INTEGRATION=1 $(PYTHON) -m pytest -v --tb=short -m integration
	@echo ""
	@echo "✅ Full health check passed (live services + frontend build)."

backend-up:
	cd chatbotAgent && $(PYTHON) -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

frontend-up:
	npm run dev
