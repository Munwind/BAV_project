# Backend Template

Backend template dung Express cho du an BAV, da co them RSS crawler va PostgreSQL schema cho SentimentX.

## Chuc nang baseline

- `GET /api/health`
- `GET /api/meta`
- `GET /api/crawler/sources`
- `POST /api/db/init`
- `POST /api/crawler/run`
- `GET /api/articles`
- `GET /api/sources`

## Scripts

```bash
npm run dev
npm run start
npm run db:init
npm run crawl
```

## Nguon RSS dang cau hinh

- VnExpress Kinh doanh
- CafeF Doanh nghiep
- Vietstock Hoat dong kinh doanh
- Thanh Nien Doanh nghiep

## Docker

```bash
docker build -t bav-be .
docker run -p 8080:8080 bav-be
```
