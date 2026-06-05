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

## Output-Struktur

1. Unternehmensprofil
2. Positionierungsdiagnose
3. Zielgruppenhypothese
4. Differenzierungsgrad
5. Angebotsklarheit
6. Leistungsversprechen
7. Top 3 Wachstumshemmnisse
8. Top 3 Chancen
9. Analyse-Score (4 Dimensionen, je /10)
10. Executive Summary (10 Bulletpoints)
11. Quellenangaben
