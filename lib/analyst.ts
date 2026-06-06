import FirecrawlApp from '@mendable/firecrawl-js';
import Anthropic from '@anthropic-ai/sdk';

export interface ScoreDimension {
  wert: number;
  begruendung: string;
}

export interface AnalysisResult {
  unternehmensprofil: {
    firmenname: string;
    website: string;
    branche: string;
    standort: string;
    unternehmensgroesse: string;
    leistungen: string[];
    ziel_des_kontakts_hypothese: string;
    vermutete_herausforderungen: string[];
    relevante_analysebereiche: string[];
    ansprechpartner: string | null;
    impressum_url: string | null;
  };
  positionierungsdiagnose: {
    zusammenfassung: string;
    kommunikationsstil: string;
    differenzierungsmerkmale: string[];
  };
  zielgruppenhypothese: {
    kernzielgruppe: string;
    kundengruppen: string[];
    spezifitaet: string;
    begruendung: string;
  };
  differenzierungsgrad: { bewertung: string; begruendung: string };
  angebotsklarheit: { bewertung: string; begruendung: string };
  leistungsversprechen: { hauptversprechen: string; fokus: string; begruendung: string };
  wachstumshemmnisse: { titel: string; beschreibung: string }[];
  chancen: { titel: string; beschreibung: string }[];
  analyse_score: {
    positionierung: ScoreDimension;
    zielgruppenklarheit: ScoreDimension;
    angebotsklarheit: ScoreDimension;
    differenzierung: ScoreDimension;
  };
  executive_summary: string[];
}

async function scrapeWebsite(
  url: string,
  apiKey: string
): Promise<{ content: string; sources: string[] }> {
  const app = new FirecrawlApp({ apiKey });

  const result = await app.crawlUrl(url, {
    limit: 10,
    scrapeOptions: {
      formats: ['markdown'],
      onlyMainContent: true,
    },
  } as Parameters<typeof app.crawlUrl>[1]);

  const data = (result as { data?: { metadata?: { sourceURL?: string }; markdown?: string }[] }).data ?? [];
  const pages: { url: string; content: string }[] = [];

  for (const doc of data) {
    const pageUrl = doc.metadata?.sourceURL ?? '';
    const content = (doc.markdown ?? '').trim();
    if (content.length > 100) pages.push({ url: pageUrl, content });
  }

  const combined = pages
    .map(p => `## Seite: ${p.url}\n\n${p.content}`)
    .join('\n\n---\n\n')
    .slice(0, 40000);

  return { content: combined, sources: pages.map(p => p.url) };
}

const ANALYSIS_PROMPT = `
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
{
  "unternehmensprofil": {
    "firmenname": "string",
    "website": "string",
    "branche": "string",
    "standort": "string",
    "unternehmensgroesse": "string",
    "leistungen": ["string"],
    "ziel_des_kontakts_hypothese": "string",
    "vermutete_herausforderungen": ["string"],
    "relevante_analysebereiche": ["string"],
    "ansprechpartner": "string or null",
    "impressum_url": "string or null"
  },
  "positionierungsdiagnose": {
    "zusammenfassung": "string (3-5 Sätze)",
    "kommunikationsstil": "generisch | konkret | gemischt",
    "differenzierungsmerkmale": ["string"]
  },
  "zielgruppenhypothese": {
    "kernzielgruppe": "string",
    "kundengruppen": ["string"],
    "spezifitaet": "hoch | mittel | niedrig",
    "begruendung": "string"
  },
  "differenzierungsgrad": { "bewertung": "Hoch | Mittel | Niedrig", "begruendung": "string" },
  "angebotsklarheit": { "bewertung": "Hoch | Mittel | Niedrig", "begruendung": "string" },
  "leistungsversprechen": {
    "hauptversprechen": "string",
    "fokus": "Leistungen | Ergebnisse | Gemischt",
    "begruendung": "string"
  },
  "wachstumshemmnisse": [
    { "titel": "string", "beschreibung": "string" },
    { "titel": "string", "beschreibung": "string" },
    { "titel": "string", "beschreibung": "string" }
  ],
  "chancen": [
    { "titel": "string", "beschreibung": "string" },
    { "titel": "string", "beschreibung": "string" },
    { "titel": "string", "beschreibung": "string" }
  ],
  "analyse_score": {
    "positionierung": { "wert": 0, "begruendung": "string" },
    "zielgruppenklarheit": { "wert": 0, "begruendung": "string" },
    "angebotsklarheit": { "wert": 0, "begruendung": "string" },
    "differenzierung": { "wert": 0, "begruendung": "string" }
  },
  "executive_summary": ["string x10"]
}

Wichtig:
- Scores 1-10 (1=sehr schwach, 10=exzellent)
- Executive Summary: genau 10 konkrete Bulletpoints
- Frage dahinter: Was muss ich wissen, wenn ich morgen mit dem GF spreche?
- Antworte NUR mit dem JSON, kein Text davor oder danach.
`;

async function analyzeWithClaude(
  scraped: { content: string; sources: string[] },
  apiKey: string
): Promise<AnalysisResult> {
  const client = new Anthropic({ apiKey });

  const sourcesStr = scraped.sources.map(s => `- ${s}`).join('\n');
  const prompt = ANALYSIS_PROMPT
    .replace('{content}', scraped.content)
    .replace('{sources}', sourcesStr);

  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  let raw = (message.content[0] as { type: string; text: string }).text.trim();
  if (raw.startsWith('```')) {
    raw = raw.split('\n').slice(1).join('\n');
    if (raw.endsWith('```')) raw = raw.slice(0, -3);
  }

  return JSON.parse(raw) as AnalysisResult;
}

function scoreBar(value: number): string {
  return '█'.repeat(value) + '░'.repeat(10 - value) + ` ${value}/10`;
}

function buildMarkdownReport(
  analysis: AnalysisResult,
  url: string,
  sources: string[]
): string {
  const up = analysis.unternehmensprofil;
  const score = analysis.analyse_score;
  const today = new Date().toLocaleDateString('de-DE');
  const lines: string[] = [];

  lines.push(`# Strategieanalyse: ${up.firmenname}`);
  lines.push(`\n*Erstellt am ${today} | Analysierte URL: ${url}*`);
  lines.push('\n---\n');

  lines.push('## 1. Unternehmensprofil\n');
  lines.push('| Feld | Wert |');
  lines.push('|------|------|');
  lines.push(`| **Firmenname** | ${up.firmenname} |`);
  lines.push(`| **Website** | ${up.website} |`);
  lines.push(`| **Branche** | ${up.branche} |`);
  lines.push(`| **Standort** | ${up.standort} |`);
  lines.push(`| **Unternehmensgröße** | ${up.unternehmensgroesse} |`);
  if (up.ansprechpartner) lines.push(`| **Ansprechpartner** | ${up.ansprechpartner} |`);
  if (up.impressum_url) lines.push(`| **Impressum** | ${up.impressum_url} |`);
  lines.push('');
  lines.push('**Leistungen:**');
  up.leistungen.forEach(l => lines.push(`- ${l}`));
  lines.push('');
  lines.push(`**Hypothese Ziel des Kontakts:** ${up.ziel_des_kontakts_hypothese}`);
  lines.push('');
  lines.push('**Vermutete Herausforderungen:**');
  up.vermutete_herausforderungen.forEach(h => lines.push(`- ${h}`));
  lines.push('');
  lines.push('**Relevante Analysebereiche:**');
  up.relevante_analysebereiche.forEach(a => lines.push(`- ${a}`));
  lines.push('\n---\n');

  lines.push('## 2. Positionierungsdiagnose\n');
  const pos = analysis.positionierungsdiagnose;
  lines.push(pos.zusammenfassung);
  lines.push('');
  lines.push(`**Kommunikationsstil:** ${pos.kommunikationsstil}`);
  lines.push('');
  lines.push('**Differenzierungsmerkmale:**');
  pos.differenzierungsmerkmale.forEach(m => lines.push(`- ${m}`));
  lines.push('\n---\n');

  lines.push('## 3. Zielgruppenhypothese\n');
  const zg = analysis.zielgruppenhypothese;
  lines.push(`**Kernzielgruppe:** ${zg.kernzielgruppe}`);
  lines.push('');
  lines.push('**Adressierte Kundengruppen:**');
  zg.kundengruppen.forEach(k => lines.push(`- ${k}`));
  lines.push('');
  lines.push(`**Spezifität:** ${zg.spezifitaet}`);
  lines.push(`\n> ${zg.begruendung}`);
  lines.push('\n---\n');

  lines.push('## 4. Differenzierungsgrad\n');
  lines.push(`**Bewertung: ${analysis.differenzierungsgrad.bewertung}**`);
  lines.push('');
  lines.push(analysis.differenzierungsgrad.begruendung);
  lines.push('\n---\n');

  lines.push('## 5. Angebotsklarheit\n');
  lines.push(`**Bewertung: ${analysis.angebotsklarheit.bewertung}**`);
  lines.push('');
  lines.push(analysis.angebotsklarheit.begruendung);
  lines.push('\n---\n');

  lines.push('## 6. Leistungsversprechen\n');
  const lv = analysis.leistungsversprechen;
  lines.push(`**Hauptversprechen:** ${lv.hauptversprechen}`);
  lines.push('');
  lines.push(`**Fokus:** ${lv.fokus}`);
  lines.push(`\n> ${lv.begruendung}`);
  lines.push('\n---\n');

  lines.push('## 7. Wachstumshemmnisse\n');
  analysis.wachstumshemmnisse.forEach((w, i) => {
    lines.push(`**${i + 1}. ${w.titel}**`);
    lines.push(w.beschreibung);
    lines.push('');
  });
  lines.push('---\n');

  lines.push('## 8. Chancen\n');
  analysis.chancen.forEach((c, i) => {
    lines.push(`**${i + 1}. ${c.titel}**`);
    lines.push(c.beschreibung);
    lines.push('');
  });
  lines.push('---\n');

  lines.push('## 9. Analyse-Score\n');
  lines.push('| Dimension | Score | Begründung |');
  lines.push('|-----------|-------|------------|');
  const dims: [string, keyof typeof score][] = [
    ['Positionierung', 'positionierung'],
    ['Zielgruppenklarheit', 'zielgruppenklarheit'],
    ['Angebotsklarheit', 'angebotsklarheit'],
    ['Differenzierung', 'differenzierung'],
  ];
  dims.forEach(([label, key]) => {
    const s = score[key];
    lines.push(`| **${label}** | ${scoreBar(s.wert)} | ${s.begruendung} |`);
  });
  const avg = dims.reduce((sum, [, key]) => sum + score[key].wert, 0) / dims.length;
  lines.push(`\n**Gesamt-Score: ${avg.toFixed(1)}/10**`);
  lines.push('\n---\n');

  lines.push('## 10. Executive Summary\n');
  lines.push('*Was müsste ich wissen, wenn ich morgen mit dem Geschäftsführer spreche?*\n');
  analysis.executive_summary.forEach(b => lines.push(`- ${b}`));
  lines.push('\n---\n');

  lines.push('## Quellenangaben\n');
  sources.forEach(s => lines.push(`- ${s}`));
  lines.push('\n---');
  lines.push('\n*Generiert mit Strategie-Analyst | strukturwerk-beratung.de*');

  return lines.join('\n');
}

export async function runAnalysis(
  url: string,
  firecrawlKey: string,
  anthropicKey: string
): Promise<{ analysis: AnalysisResult; report: string }> {
  const scraped = await scrapeWebsite(url, firecrawlKey);
  const analysis = await analyzeWithClaude(scraped, anthropicKey);
  const report = buildMarkdownReport(analysis, url, scraped.sources);
  return { analysis, report };
}
