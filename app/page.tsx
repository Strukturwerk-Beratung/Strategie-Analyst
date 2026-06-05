'use client';
import { useState } from 'react';
import type { AnalysisResult } from '@/lib/analyst';

function ScoreBadge({ value }: { value: number }) {
  const color =
    value >= 7 ? 'bg-green-100 text-green-800' :
    value >= 5 ? 'bg-yellow-100 text-yellow-800' :
                 'bg-red-100 text-red-800';
  return (
    <span className={`inline-block px-2 py-0.5 rounded font-mono font-semibold text-sm ${color}`}>
      {value}/10
    </span>
  );
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ analysis: AnalysisResult; report: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'report' | 'raw'>('report');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Unbekannter Fehler');
      }
      const data = await res.json();
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function downloadReport() {
    if (!result) return;
    const up = result.analysis.unternehmensprofil;
    const name = up.firmenname.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const date = new Date().toISOString().slice(0, 10);
    const filename = `strategie-analyse_${name}_${date}.md`;
    const blob = new Blob([result.report], { type: 'text/markdown' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(href);
  }

  const score = result?.analysis.analyse_score;
  const up = result?.analysis.unternehmensprofil;

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Strategie-Analyst</h1>
        <p className="text-gray-500 mt-1 text-sm">AI-gestützte Unternehmensanalyse aus einer Website-URL</p>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-3 mb-8">
        <input
          type="url"
          required
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://www.beispielunternehmen.de"
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {loading ? 'Analysiere…' : 'Analyse starten'}
        </button>
      </form>

      {/* Loading */}
      {loading && (
        <div className="border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-500">
          <div className="animate-pulse">Website wird gescrapt und analysiert… (ca. 1–2 Minuten)</div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {result && score && up && (
        <div className="space-y-6">
          {/* Score Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Positionierung', key: 'positionierung' },
              { label: 'Zielgruppe', key: 'zielgruppenklarheit' },
              { label: 'Angebot', key: 'angebotsklarheit' },
              { label: 'Differenzierung', key: 'differenzierung' },
            ].map(({ label, key }) => (
              <div key={key} className="border border-gray-200 rounded-lg p-4 bg-white">
                <div className="text-xs text-gray-500 mb-1">{label}</div>
                <ScoreBadge value={score[key as keyof typeof score].wert} />
                <div className="text-xs text-gray-400 mt-2 line-clamp-2">
                  {score[key as keyof typeof score].begruendung}
                </div>
              </div>
            ))}
          </div>

          {/* Download + Tabs */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1 border border-gray-200 rounded-lg p-1 bg-white">
              <button
                onClick={() => setActiveTab('report')}
                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                  activeTab === 'report' ? 'bg-black text-white' : 'text-gray-600 hover:text-black'
                }`}
              >
                Report
              </button>
              <button
                onClick={() => setActiveTab('raw')}
                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                  activeTab === 'raw' ? 'bg-black text-white' : 'text-gray-600 hover:text-black'
                }`}
              >
                Markdown
              </button>
            </div>
            <button
              onClick={downloadReport}
              className="border border-gray-300 rounded-lg px-4 py-1.5 text-sm hover:bg-gray-100 transition-colors"
            >
              ⬇ Export .md
            </button>
          </div>

          {/* Report View */}
          {activeTab === 'report' && (
            <div
              className="border border-gray-200 rounded-lg p-6 bg-white prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(result.report) }}
            />
          )}

          {/* Raw Markdown */}
          {activeTab === 'raw' && (
            <pre className="border border-gray-200 rounded-lg p-4 bg-gray-50 text-xs overflow-x-auto whitespace-pre-wrap">
              {result.report}
            </pre>
          )}
        </div>
      )}
    </main>
  );
}

// Minimal markdown → HTML (no external lib needed)
function markdownToHtml(md: string): string {
  return md
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-6 mb-2">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-semibold mt-5 mb-2 border-b pb-1">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold mt-4 mb-1">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-gray-300 pl-3 text-gray-600 italic my-2">$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/(<li.*<\/li>)/gs, '<ul class="my-2">$1</ul>')
    .replace(/^\|(.+)\|$/gm, (row) => {
      const cells = row.split('|').filter(Boolean).map(c => c.trim());
      const isHeader = false;
      return '<tr>' + cells.map(c => `<td class="border px-2 py-1 text-xs">${c}</td>`).join('') + '</tr>';
    })
    .replace(/(<tr>.*<\/tr>)/gs, '<table class="border-collapse border border-gray-200 my-3 w-full text-xs">$1</table>')
    .replace(/^---$/gm, '<hr class="my-4 border-gray-200" />')
    .replace(/\n{2,}/g, '</p><p class="my-2">')
    .replace(/^(?!<[hbluptr])(.+)$/gm, '<p class="my-1">$1</p>');
}
