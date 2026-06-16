const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Chapter {
  number: number;
  title: string;
  body: string;
}

function splitByMarkers(text: string): Chapter[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const headerRe = /^\s*#{0,6}\s*(?:chapter|ch\.?|chap\.?)\s*([0-9]+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b\s*[:.\-—]?\s*(.*)$/i;
  const altRe = /^\s*#\s+(.+)$/;

  const chapters: Chapter[] = [];
  let current: Chapter | null = null;
  let counter = 0;

  for (const raw of lines) {
    const m = raw.match(headerRe) || raw.match(altRe);
    if (m) {
      if (current) chapters.push(current);
      counter += 1;
      const titleRaw = (m[2] !== undefined ? m[2] : m[1] || '').trim();
      current = { number: counter, title: titleRaw || `Chapter ${counter}`, body: '' };
    } else {
      if (current) current.body += raw + '\n';
    }
  }
  if (current) chapters.push(current);
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
    const warning = chapters.length <= 1 && text.length > 2000
      ? 'No "# Chapter" markers were found. Add markers like "# Chapter 1: The Beginning" to split your text into multiple chapters.'
      : undefined;

    return new Response(
      JSON.stringify({ chapters, usedAI: false, warning }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to split';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
