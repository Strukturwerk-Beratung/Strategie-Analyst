# Strategie-Analyst

AI-gestützter Unternehmensanalyst. Website-URL eingeben → strukturierte Strategieanalyse in Minuten.

## Lokales Setup

```bash
npm install
cp .env.example .env.local
# API Keys in .env.local eintragen
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000).

## Vercel Deployment

1. Repo in Vercel importieren
2. Unter **Settings → Environment Variables** eintragen:
   - `FIRECRAWL_API_KEY`
   - `ANTHROPIC_API_KEY`
3. Deploy

## API Keys

| Variable | Quelle |
|----------|--------|
| `FIRECRAWL_API_KEY` | [firecrawl.dev](https://www.firecrawl.dev) |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
