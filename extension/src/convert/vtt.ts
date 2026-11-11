interface Cue {
  start: number;
  end: number;
  text: string;
}

const TIME = /(\d+):(\d{2}):(\d{2})[.,](\d{3})|(\d{2}):(\d{2})[.,](\d{3})/;

function toSeconds(stamp: string): number {
  const m = TIME.exec(stamp);
  if (!m) return 0;
  if (m[1] !== undefined) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return Number(m[5]) * 60 + Number(m[6]);
}

function parseCues(vtt: string): Cue[] {
  const cues: Cue[] = [];
  for (const block of vtt.replace(/\r/g, '').split(/\n{2,}/)) {
    const lines = block.split('\n');
    const timingIdx = lines.findIndex((l) => l.includes('-->'));
    if (timingIdx < 0) continue;
    const [startStr, endStr] = lines[timingIdx]!.split('-->');
    const text = lines
      .slice(timingIdx + 1)
      .join(' ')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) cues.push({ start: toSeconds(startStr ?? ''), end: toSeconds(endStr ?? ''), text });
  }
  return cues;
}

function stamp(seconds: number): { label: string; id: string } {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(Math.floor(seconds % 60)).padStart(2, '0');
  return { label: `${mm}:${ss}`, id: `${mm}${ss}` };
}

export function vttToMarkdown(vtt: string, opts: { minSeconds?: number; maxSeconds?: number } = {}): string {
  const min = opts.minSeconds ?? 30;
  const max = opts.maxSeconds ?? 60;
  const paragraphs: { start: number; texts: string[] }[] = [];
  let current: { start: number; end: number; texts: string[] } | null = null;
  let previousText = '';

  for (const cue of parseCues(vtt)) {
    if (cue.text === previousText) continue;
    previousText = cue.text;
    if (current) {
      const last = current.texts[current.texts.length - 1] ?? '';
      const longEnough = current.end - current.start >= min && /[.?!]["')]?$/.test(last);
      if (cue.start - current.start >= max || longEnough) {
        paragraphs.push(current);
        current = null;
      }
    }
    if (!current) current = { start: cue.start, end: cue.end, texts: [] };
    current.texts.push(cue.text);
    current.end = cue.end;
  }
  if (current) paragraphs.push(current);

  return (
    paragraphs
      .map((p) => {
        const { label, id } = stamp(p.start);
        return `**[${label}]** ${p.texts.join(' ')} ^t${id}`;
      })
      .join('\n\n') + '\n'
  );
}
