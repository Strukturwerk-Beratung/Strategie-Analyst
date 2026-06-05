import os
import json
from datetime import datetime
from dotenv import load_dotenv
from firecrawl import FirecrawlApp
import anthropic

load_dotenv()


def scrape_website(url: str) -> dict:
    """Scrape website using Firecrawl. Returns content and list of scraped URLs."""
    app = FirecrawlApp(api_key=os.environ["FIRECRAWL_API_KEY"])

    # Crawl up to 10 pages for richer context
    result = app.crawl_url(
        url,
        params={
            "limit": 10,
            "scrapeOptions": {
                "formats": ["markdown"],
                "onlyMainContent": True,
            },
        },
        poll_interval=3,
    )

    pages = []
    sources = []

    for doc in result.get("data", []):
        page_url = doc.get("metadata", {}).get("sourceURL", "")
        content = doc.get("markdown", "").strip()
        if content and len(content) > 100:
            pages.append({"url": page_url, "content": content})
            sources.append(page_url)

    # Combine content, cap at ~40k chars to stay within context limits
    combined = "\n\n---\n\n".join(
        f"## Seite: {p['url']}\n\n{p['content']}" for p in pages
    )
    combined = combined[:40000]

    return {"content": combined, "sources": sources, "page_count": len(pages)}


ANALYSIS_PROMPT = """
Du bist ein erfahrener Unternehmensberater und Strategieanalyst.
Dir werden die gescrapten Inhalte einer Unternehmenswebseite übergeben.
Deine Aufgabe: Erstelle eine strukturierte, belastbare Strategieanalyse.

Website-Inhalte:
---
{content}
---

Analysierte Seiten:
{sources}

Erstelle den folgenden Report als strukturiertes JSON. Halte dich exakt an das Schema.
Sei präzise und konkret. Vermeide Floskeln. Begründe jede Bewertung.

JSON Schema:
{{
  "unternehmensprofil": {{
    "firmenname": "string",
    "website": "string",
    "branche": "string",
    "standort": "string",
    "unternehmensgroesse": "string (Schätzung: z.B. Kleinstunternehmen 1-9 MA, KMU 10-49 MA, etc.)",
    "leistungen": ["string"],
    "ziel_des_kontakts_hypothese": "string",
    "vermutete_herausforderungen": ["string"],
    "relevante_analysebereiche": ["string"],
    "ansprechpartner": "string oder null",
    "impressum_url": "string oder null"
  }},
  "positionierungsdiagnose": {{
    "zusammenfassung": "string (3-5 Sätze)",
    "kommunikationsstil": "generisch | konkret | gemischt",
    "differenzierungsmerkmale": ["string"]
  }},
  "zielgruppenhypothese": {{
    "kernzielgruppe": "string",
    "kundengruppen": ["string"],
    "spezifitaet": "hoch | mittel | niedrig",
    "begruendung": "string"
  }},
  "differenzierungsgrad": {{
    "bewertung": "Hoch | Mittel | Niedrig",
    "begruendung": "string"
  }},
  "angebotsklarheit": {{
    "bewertung": "Hoch | Mittel | Niedrig",
    "begruendung": "string"
  }},
  "leistungsversprechen": {{
    "hauptversprechen": "string",
    "fokus": "Leistungen | Ergebnisse | Gemischt",
    "begruendung": "string"
  }},
  "wachstumshemmnisse": [
    {{"titel": "string", "beschreibung": "string"}},
    {{"titel": "string", "beschreibung": "string"}},
    {{"titel": "string", "beschreibung": "string"}}
  ],
  "chancen": [
    {{"titel": "string", "beschreibung": "string"}},
    {{"titel": "string", "beschreibung": "string"}},
    {{"titel": "string", "beschreibung": "string"}}
  ],
  "analyse_score": {{
    "positionierung": {{"wert": 0, "begruendung": "string"}},
    "zielgruppenklarheit": {{"wert": 0, "begruendung": "string"}},
    "angebotsklarheit": {{"wert": 0, "begruendung": "string"}},
    "differenzierung": {{"wert": 0, "begruendung": "string"}}
  }},
  "executive_summary": ["string", "string", "string", "string", "string", "string", "string", "string", "string", "string"]
}}

Wichtig:
- Scores zwischen 1-10 (1=sehr schwach, 10=exzellent)
- Executive Summary: genau 10 Bulletpoints, jeder beginnt mit einem Verb oder konkretem Befund
- Beantworte implizit: Was müsste ich wissen, wenn ich morgen mit dem GF spreche?
- Antworte NUR mit dem JSON, kein Text davor oder danach.
"""


def analyze_with_claude(scraped_data: dict) -> dict:
    """Send scraped content to Claude for analysis. Returns parsed JSON."""
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    sources_str = "\n".join(f"- {s}" for s in scraped_data["sources"])
    prompt = ANALYSIS_PROMPT.format(
        content=scraped_data["content"],
        sources=sources_str,
    )

    message = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]
        if raw.endswith("```"):
            raw = raw.rsplit("```", 1)[0]

    return json.loads(raw)


def build_markdown_report(analysis: dict, url: str, sources: list[str]) -> str:
    """Convert analysis JSON to a structured Markdown report."""
    p = analysis
    up = p["unternehmensprofil"]
    score = p["analyse_score"]
    today = datetime.now().strftime("%d.%m.%Y")

    def score_bar(value: int) -> str:
        filled = "█" * value
        empty = "░" * (10 - value)
        return f"{filled}{empty} {value}/10"

    lines = []

    lines.append(f"# Strategieanalyse: {up['firmenname']}")
    lines.append(f"\n*Erstellt am {today} | Analysierte URL: {url}*")
    lines.append("\n---\n")

    # Unternehmensprofil
    lines.append("## 1. Unternehmensprofil\n")
    lines.append(f"| Feld | Wert |")
    lines.append(f"|------|------|")
    lines.append(f"| **Firmenname** | {up['firmenname']} |")
    lines.append(f"| **Website** | {up['website']} |")
    lines.append(f"| **Branche** | {up['branche']} |")
    lines.append(f"| **Standort** | {up['standort']} |")
    lines.append(f"| **Unternehmensgröße** | {up['unternehmensgroesse']} |")
    if up.get("ansprechpartner"):
        lines.append(f"| **Ansprechpartner** | {up['ansprechpartner']} |")
    if up.get("impressum_url"):
        lines.append(f"| **Impressum** | {up['impressum_url']} |")
    lines.append("")
    lines.append("**Leistungen:**")
    for l in up.get("leistungen", []):
        lines.append(f"- {l}")
    lines.append("")
    lines.append(f"**Hypothese Ziel des Kontakts:** {up['ziel_des_kontakts_hypothese']}")
    lines.append("")
    lines.append("**Vermutete Herausforderungen:**")
    for h in up.get("vermutete_herausforderungen", []):
        lines.append(f"- {h}")
    lines.append("")
    lines.append("**Relevante Analysebereiche:**")
    for a in up.get("relevante_analysebereiche", []):
        lines.append(f"- {a}")

    lines.append("\n---\n")

    # Positionierungsdiagnose
    lines.append("## 2. Positionierungsdiagnose\n")
    pos = p["positionierungsdiagnose"]
    lines.append(pos["zusammenfassung"])
    lines.append("")
    lines.append(f"**Kommunikationsstil:** {pos['kommunikationsstil'].capitalize()}")
    lines.append("")
    lines.append("**Differenzierungsmerkmale:**")
    for m in pos.get("differenzierungsmerkmale", []):
        lines.append(f"- {m}")

    lines.append("\n---\n")

    # Zielgruppenhypothese
    lines.append("## 3. Zielgruppenhypothese\n")
    zg = p["zielgruppenhypothese"]
    lines.append(f"**Kernzielgruppe:** {zg['kernzielgruppe']}")
    lines.append("")
    lines.append("**Adressierte Kundengruppen:**")
    for k in zg.get("kundengruppen", []):
        lines.append(f"- {k}")
    lines.append("")
    lines.append(f"**Spezifität:** {zg['spezifitaet'].capitalize()}")
    lines.append(f"\n> {zg['begruendung']}")

    lines.append("\n---\n")

    # Differenzierungsgrad
    lines.append("## 4. Differenzierungsgrad\n")
    diff = p["differenzierungsgrad"]
    lines.append(f"**Bewertung: {diff['bewertung']}**")
    lines.append("")
    lines.append(diff["begruendung"])

    lines.append("\n---\n")

    # Angebotsklarheit
    lines.append("## 5. Angebotsklarheit\n")
    ak = p["angebotsklarheit"]
    lines.append(f"**Bewertung: {ak['bewertung']}**")
    lines.append("")
    lines.append(ak["begruendung"])

    lines.append("\n---\n")

    # Leistungsversprechen
    lines.append("## 6. Leistungsversprechen\n")
    lv = p["leistungsversprechen"]
    lines.append(f"**Hauptversprechen:** {lv['hauptversprechen']}")
    lines.append("")
    lines.append(f"**Fokus:** {lv['fokus']}")
    lines.append(f"\n> {lv['begruendung']}")

    lines.append("\n---\n")

    # Wachstumshemmnisse
    lines.append("## 7. Wachstumshemmnisse\n")
    for i, w in enumerate(p.get("wachstumshemmnisse", []), 1):
        lines.append(f"**{i}. {w['titel']}**")
        lines.append(f"{w['beschreibung']}")
        lines.append("")

    lines.append("---\n")

    # Chancen
    lines.append("## 8. Chancen\n")
    for i, c in enumerate(p.get("chancen", []), 1):
        lines.append(f"**{i}. {c['titel']}**")
        lines.append(f"{c['beschreibung']}")
        lines.append("")

    lines.append("---\n")

    # Analyse-Score
    lines.append("## 9. Analyse-Score\n")
    lines.append("| Dimension | Score | Begründung |")
    lines.append("|-----------|-------|------------|")
    score_dims = [
        ("Positionierung", "positionierung"),
        ("Zielgruppenklarheit", "zielgruppenklarheit"),
        ("Angebotsklarheit", "angebotsklarheit"),
        ("Differenzierung", "differenzierung"),
    ]
    for label, key in score_dims:
        s = score[key]
        lines.append(f"| **{label}** | {score_bar(s['wert'])} | {s['begruendung']} |")

    total = sum(score[k]["wert"] for _, k in score_dims)
    avg = total / len(score_dims)
    lines.append(f"\n**Gesamt-Score: {avg:.1f}/10**")

    lines.append("\n---\n")

    # Executive Summary
    lines.append("## 10. Executive Summary\n")
    lines.append("*Was müsste ich wissen, wenn ich morgen mit dem Geschäftsführer spreche?*\n")
    for bullet in p.get("executive_summary", []):
        lines.append(f"- {bullet}")

    lines.append("\n---\n")

    # Quellenangaben
    lines.append("## Quellenangaben\n")
    lines.append("Folgende Seiten wurden für die Analyse herangezogen:\n")
    for src in sources:
        lines.append(f"- {src}")

    lines.append("\n---")
    lines.append("\n*Generiert mit Strategie-Analyst | strukturwerk-beratung.de*")

    return "\n".join(lines)


def run_analysis(url: str) -> tuple[dict, str]:
    """Full pipeline: scrape → analyze → report. Returns (analysis_dict, markdown_str)."""
    scraped = scrape_website(url)
    analysis = analyze_with_claude(scraped)
    report = build_markdown_report(analysis, url, scraped["sources"])
    return analysis, report
