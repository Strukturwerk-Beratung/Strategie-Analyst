# Strategie-Analyst

AI-gestützter Unternehmensanalyst. Gibt eine Website-URL ein und erzeugt innerhalb von Minuten eine strukturierte Unternehmens- und Strategieanalyse.

## Setup

```bash
# 1. Repository klonen
git clone <repo-url>
cd strategie-analyst

# 2. Virtuelle Umgebung erstellen
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 3. Abhängigkeiten installieren
pip install -r requirements.txt

# 4. API Keys konfigurieren
cp .env.example .env
# .env öffnen und API Keys eintragen

# 5. App starten
streamlit run app.py
```

## API Keys

| Key | Bezugsquelle |
|-----|--------------|
| `FIRECRAWL_API_KEY` | https://www.firecrawl.dev |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com |

## Output

Der generierte Report enthält:
- **Unternehmensprofil** – Branche, Standort, Größe, Leistungen
- **Positionierungsdiagnose** – Wie klar ist die Marktpositionierung?
- **Zielgruppenhypothese** – Wer wird adressiert?
- **Differenzierungsgrad** – Hoch / Mittel / Niedrig mit Begründung
- **Angebotsklarheit** – Hoch / Mittel / Niedrig mit Begründung
- **Wachstumshemmnisse** – Top 3 erkennbare Herausforderungen
- **Chancen** – Top 3 erkennbare Wachstumschancen
- **Analyse-Score** – Bewertung in 4 Dimensionen (je /10)
- **Executive Summary** – 10 Bulletpoints für das GF-Gespräch
- **Quellenangaben** – Alle analysierten Seiten
