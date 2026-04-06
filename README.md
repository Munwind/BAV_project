# BAV Project Template

Project hien duoc tach thanh 3 lop:

- `fe/`: web dashboard React + Vite
- `be/`: backend Express + RSS crawler + PostgreSQL
- `be/llm_example.py`: Python AI service goi OpenAI de phan tich va tra loi cau hoi

## Cau truc

```text
BAV_project/
|-- fe/
|-- be/
|-- docker-compose.yml
|-- README.md
```

## Chay local

### Frontend

```bash
cd fe
npm install
npm run dev
```

### Backend

```bash
cd be
npm install
npm run dev
```

Mac dinh:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8080`
- AI service: `http://localhost:8000`
- Health check: `http://localhost:8080/api/health`
- PostgreSQL: `localhost:55432`

## RSS crawler + PostgreSQL

Backend da co baseline crawler cho:

- VnExpress Kinh doanh
- CafeF Doanh nghiep
- Vietstock Hoat dong kinh doanh
- Thanh Nien Doanh nghiep

API chinh:

- `POST /api/db/init`
- `POST /api/crawler/run`
- `GET /api/articles`
- `GET /api/articles?source_key=vnexpress-business`
- `GET /api/sources`
- `GET /api/crawler/sources`
- `GET /api/ai/health`
- `POST /api/ai/chat`

Payload mau cho AI:

```json
{
  "question": "Tom tat sentiment hien tai cua nganh ngan hang",
  "limit": 8,
  "locale": "vi-VN"
}
```

## Docker

Build va run ca 4 service:

```bash
docker compose up --build
```

Tat service:

```bash
docker compose down
```

## Ghi chu

- Frontend hien la product dashboard mock cho `SentimentX`
- Backend da co schema PostgreSQL, crawler RSS va AI bridge endpoint
- Python AI service doc `OPENAI_API_KEY` tu `be/.env`
- Neu can deploy production, buoc tiep theo nen bo sung auth, rate limit, queue va observability
