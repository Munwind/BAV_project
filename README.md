# BAV Project Template

Project duoc tach thanh 2 phan de de control:

- `fe/`: web product dashboard React + Vite + Tailwind CSS + Framer Motion
- `be/`: backend Express + RSS crawler + PostgreSQL

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

## Docker

Build va run ca 3 service:

```bash
docker compose up --build
```

Tat service:

```bash
docker compose down
```

## Ghi chu

- Frontend hien la product dashboard mock cho `SentimentX`
- Backend da co schema PostgreSQL va crawler RSS thuc dung cho MVP
- Neu can deploy, co the them Redis, worker queue, article full-text extraction, NLP pipeline sau
