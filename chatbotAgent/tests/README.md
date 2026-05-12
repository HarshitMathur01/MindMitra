# chatbotAgent Test Suite

The suite is organised by test intent:

- `unit/` covers pure or fully mocked backend behavior. These tests are fast and offline.
- `api/` covers FastAPI request/response and route contracts with downstream providers mocked.
- `integration/` covers live service or slow checks such as Qdrant, deployment env, and the frontend build.
- `factories.py` contains shared model/session builders so tests stay small and readable.

## Daily Commands

Run from `chatbotAgent/`:

```bash
pytest tests/unit tests/api -q
```

Run one area while developing:

```bash
pytest tests/unit/pipeline -q
pytest tests/api/test_chat_http.py -q
pytest tests/unit/pipeline/test_safety_gate.py -q
```

Run everything that does not require live services:

```bash
pytest tests -q -m "not integration and not live_env"
```

Run live integration checks:

```bash
RUN_INTEGRATION=1 pytest tests/integration -q
```

Validate real deployment secrets separately:

```bash
RUN_LIVE_ENV=1 pytest tests/integration/test_env_contract.py -q
```

Useful debugging flags:

```bash
pytest tests/unit/pipeline/test_ingestion.py -vv --tb=short
pytest tests -q -x
pytest tests -q -k "crisis or safety"
```
