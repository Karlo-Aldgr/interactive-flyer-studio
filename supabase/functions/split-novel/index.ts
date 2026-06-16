import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Chapter {
  number: number;
  title: string;
  body: string;
}

/**
 * Deterministic splitter on `# Chapter ...` markers (case-insensitive).
 * Also accepts:  Chapter 1, Chapter One, CHAPTER I, Ch. 3, # 1, ## Chapter Two
 * Returns chapters in order. If no markers are found, returns one chapter
 * containing the entire text.
 */
function splitByMarkers(text: string): Chapter[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const headerRe = /^\s*#{0,6}\s*(?:chapter|ch\.?|chap\.?)\s*([0-9]+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b\s*[:.\-—]?\s*(.*)$/i;
  const altRe = /^\s*#\s+(.+)$/; // bare # heading fallback

  const chapters: Chapter[] = [];
  let current: Chapter | null = null;
  let counter = 0;

  for (const raw of lines) {
    const m = raw.match(headerRe) || raw.match(altRe);
    if (m) {
      if (current) chapters.push(current);
      counter += 1;
      const titleRaw = (m[2] !== undefined ? m[2] : m[1] || '').trim();
      current = {
        number: counter,
        title: titleRaw || `Chapter ${counter}`,
        body: '',
      };
    } else {
      if (current) current.body += raw + '\n';
    }
  }
  if (current) chapters.push(current);

  // Trim bodies
  for (const c of chapters) c.body = c.body.trim();

  if (chapters.length === 0 && text.trim().length > 0) {
    return [{ number: 1, title: 'Chapter 1', body: text.trim() }];
  }
  return chapters;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const text: string = typeof body?.text === 'string' ? body.text : '';
    if (!text.trim()) {
      return new Response(JSON.stringify({ error: 'No text provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const chapters = splitByMarkers(text);
    const usedAI = false;
    const warning = chapters.length <= 1 && text.length > 2000
      ? 'No "# Chapter" markers were found. Add markers like "# Chapter 1: The Beginning" to split your text into multiple chapters.'
      : undefined;

    return new Response(
      JSON.stringify({ chapters, usedAI, warning }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Failed to split' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
