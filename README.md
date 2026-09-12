# listam-visualizer-front

Analytics dashboard that reads scraped data from the Railway backend API.

## Setup

```bash
npm install
cp .env.example .env
```

Set `VITE_API_URL` to your Railway backend URL.

## Run locally

```bash
npm run dev
```

Open http://localhost:5175

## Deploy (Vercel)

Connect this folder as a Vercel project and set `VITE_API_URL` in Vercel environment variables.
