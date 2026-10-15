# MAHAK API

The Application/API layer of the MAHAK platform. In R01 it exists to hold the
API boundary and expose exactly one stable contract route.

## Scope (R01)

- `GET /api/v1/shell` — declares shell mode, feature availability, and locale
  direction metadata.
- No authentication, no module endpoints, no AI calls, no secrets
  (FR-046, FR-055, NFR-006).

## Layout

```text
apps/api/
├── src/mahak_api/
│   ├── main.py              # FastAPI bootstrap, versioned /api/v1 prefix
│   ├── routes/shell.py      # the shell contract endpoint
│   └── contracts/shell.py   # api-side mirror of packages/contracts values
├── tests/test_shell_contract.py
└── pyproject.toml
```

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux / macOS
pip install -e ".[test]"
```

## Run

```bash
uvicorn mahak_api.main:app --reload   # from the activated venv
```

Then `GET http://localhost:8000/api/v1/shell`.

## Validation

```bash
pytest                                   # api contract tests
python -m compileall apps/api            # constitution Principle V Python gate
```

Both commands require no credentials, secrets, or live external services
(NFR-006).

## Contract stability

The endpoint path and response shape are stable. Later features may update
only the carried *values* (for example flipping a `features` entry to
`available`) and must add their own versioned business routes under
`/api/v1/...` rather than extending this endpoint (FR-053, FR-054).
