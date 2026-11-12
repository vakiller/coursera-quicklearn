import { readFileSync } from 'node:fs';
import { vttToMarkdown } from '../src/convert/vtt';

const vtt = (cues: [string, string, string][]) =>
  'WEBVTT\n\n' + cues.map(([s, e, t], i) => `${i + 1}\n${s} --> ${e}\n${t}\n`).join('\n');

describe('vttToMarkdown', () => {
  it('groups cues into ~30-60s paragraphs with timestamp and block id', () => {
    const md = vttToMarkdown(
      vtt([
        ['00:00:01.000', '00:00:20.000', 'First part'],
        ['00:00:20.000', '00:00:40.000', 'second part'],
        ['00:00:40.000', '00:01:05.000', 'end of sentence.'],
        ['00:01:05.000', '00:01:10.000', 'New topic.'],
      ]),
    );
    const paras = md.trim().split(/\n\n+/);
    expect(paras).toHaveLength(2);
    expect(paras[0]).toBe('**[00:01]** First part second part end of sentence. ^t0001');
    expect(paras[1]).toBe('**[01:05]** New topic. ^t0105');
  });

  it('does not duplicate a cue that repeats the previous text', () => {
    const md = vttToMarkdown(
      vtt([
        ['00:00:01.000', '00:00:02.000', 'Hello there.'],
        ['00:00:02.000', '00:00:03.000', 'Hello there.'],
      ]),
    );
    expect(md.match(/Hello there/g)).toHaveLength(1);
  });

  it('strips voice and inline tags', () => {
    const md = vttToMarkdown(vtt([['00:00:01.000', '00:00:02.000', '<v Speaker>Hi <i>you</i>.']]));
    expect(md).toContain('**[00:01]** Hi you. ^t0001');
  });

  it('counts hours into minutes for long videos', () => {
    const md = vttToMarkdown(vtt([['01:02:03.000', '01:02:05.000', 'Late.']]));
    expect(md).toContain('**[62:03]** Late. ^t6203');
  });

  it('converts the real fixture into well-formed paragraphs', () => {
    const md = vttToMarkdown(readFileSync('test/fixtures/subtitle-en.vtt', 'utf8'));
    const paras = md.trim().split(/\n\n+/);
    expect(paras.length).toBeGreaterThan(1);
    for (const p of paras) expect(p).toMatch(/^\*\*\[\d{2,}:\d{2}\]\*\* .+ \^t\d{4,}$/s);
  });
});
