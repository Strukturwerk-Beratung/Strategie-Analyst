import { NextRequest, NextResponse } from 'next/server';
import { runAnalysis } from '@/lib/analyst';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL fehlt' }, { status: 400 });
    }

    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!firecrawlKey || !anthropicKey) {
      return NextResponse.json(
        { error: 'API Keys fehlen. Bitte FIRECRAWL_API_KEY und ANTHROPIC_API_KEY in Vercel Environment Variables setzen.' },
        { status: 500 }
      );
    }

    const { analysis, report } = await runAnalysis(url, firecrawlKey, anthropicKey);
    return NextResponse.json({ analysis, report });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
