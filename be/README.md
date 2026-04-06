# SentimentX Backend

Backend hien gom 2 phan:

- Express API cho crawler, PostgreSQL va bridge AI
- Python FastAPI service trong `llm_example.py` de goi OpenAI va tra loi cau hoi cua user

Service AI ho tro 2 mode:

- OpenAI mac dinh qua Responses API
- OpenAI-compatible provider qua `OPENAI_BASE_URL` hoac tu dong fallback khi key co dang `nvapi-`

## API hien co

- `GET /api/health`
- `GET /api/meta`
- `GET /api/crawler/sources`
- `POST /api/db/init`
- `POST /api/crawler/run`
- `GET /api/articles`
- `GET /api/sources`
- `GET /api/ai/health`
- `POST /api/ai/chat`

## AI flow

1. Express lay bai viet moi nhat tu PostgreSQL
2. Express gui context bai viet + cau hoi sang Python AI service
3. Python service doc `OPENAI_API_KEY` tu `.env`, goi OpenAI Responses API va tra ve cau tra loi

## Chay local

Node backend:

```bash
cd be
npm install
npm run dev
```

Python AI service:

```bash
cd be
python -m pip install -r requirements-ai.txt
uvicorn llm_example:app --host 0.0.0.0 --port 8000
```

## Env can co

```bash
ADMIN_API_KEY=change_me_in_production
OPENAI_API_KEY=your_openai_api_key
OPENAI_BASE_URL=
OPENAI_MODEL=gpt-4.1-mini
AI_SERVICE_URL=http://localhost:8000
AI_ARTICLE_LIMIT=10
AI_REASONING_EFFORT=low
```

Luu y:

- `POST /api/db/init` va `POST /api/crawler/run` se duoc mo tu do khi `NODE_ENV != production` va chua set `ADMIN_API_KEY`
- trong production, nen bat buoc set `ADMIN_API_KEY` va gui qua header `x-admin-key` hoac `Authorization: Bearer ...`

## Test

```bash
cd be
npm test
```

## Docker

Stack day du duoc chay o root project:

```bash
docker compose up --build
```
