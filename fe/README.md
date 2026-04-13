# Frontend Template

Frontend cho du an `SentimentX`.

## Stack

- React
- Vite
- Tailwind CSS
- Framer Motion
- Lucide React

## Scripts

```bash
npm run dev
npm run build
npm run lint
```

## Env

```bash
VITE_API_BASE_URL=http://localhost:8080/api
VITE_ENABLE_CRAWLER=true
```

Production khuyen nghi:

- Netlify: set `VITE_API_BASE_URL=https://<render-backend>.onrender.com/api`
- Netlify: set `VITE_ENABLE_CRAWLER=false` de frontend public khong goi admin endpoint
- `netlify.toml` da co san SPA redirect ve `index.html`

## Muc tieu

- Landing page dep, responsive
- Hieu ung scroll, reveal, hover, parallax
- San sang mo rong thanh dashboard product

## Docker

```bash
docker build -t bav-fe .
docker run -p 5173:5173 bav-fe
```
