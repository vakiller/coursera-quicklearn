import { XMLParser } from 'fast-xml-parser';

type Node = Record<string, unknown> & { ':@'?: Record<string, string> };

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '',
  trimValues: false,
  processEntities: true,
  htmlEntities: true,
});

const tagOf = (n: Node): string => Object.keys(n).find((k) => k !== ':@') ?? '';
const childrenOf = (n: Node): Node[] => {
  const v = n[tagOf(n)];
  return Array.isArray(v) ? (v as Node[]) : [];
};
const attr = (n: Node, name: string): string => n[':@']?.[name] ?? '';

const clean = (s: string) => s.replace(/ /g, ' ').replace(/[ \t\r\n]+/g, ' ');

function inline(nodes: Node[], bold = true): string {
  let out = '';
  for (const n of nodes) {
    const tag = tagOf(n);
    if (tag === '#text') {
      out += clean(String(n['#text']));
      continue;
    }
    const inner = inline(childrenOf(n), bold);
    const t = inner.trim();
    switch (tag) {
      case 'strong':
      case 'b':
        out += bold && t ? inner.replace(t, `**${t}**`) : inner;
        break;
      case 'em':
      case 'i':
        out += t ? inner.replace(t, `*${t}*`) : inner;
        break;
      case 'code':
        out += t ? `\`${t}\`` : '';
        break;
      case 'a':
        out += attr(n, 'href') ? `[${t}](${attr(n, 'href')})` : inner;
        break;
      case 'text':
        out += inner + ' ';
        break;
      default:
        out += inner;
    }
  }
  return out;
}

const tidy = (s: string) => s.replace(/ +/g, ' ').trim();

function renderList(n: Node, depth: number): string[] {
  const numbered = attr(n, 'bulletType') === 'numbers';
  const lines: string[] = [];
  let i = 0;
  for (const li of childrenOf(n)) {
    if (tagOf(li) !== 'li') continue;
    i++;
    const kids = childrenOf(li);
    const text = tidy(inline(kids.filter((k) => tagOf(k) !== 'list')));
    lines.push(`${'  '.repeat(depth)}${numbered ? `${i}.` : '-'} ${text}`);
    for (const sub of kids.filter((k) => tagOf(k) === 'list')) lines.push(...renderList(sub, depth + 1));
  }
  return lines;
}

function renderTable(n: Node): string {
  const rows = childrenOf(n)
    .flatMap((r) => (tagOf(r) === 'tbody' || tagOf(r) === 'thead' ? childrenOf(r) : [r]))
    .filter((r) => tagOf(r) === 'tr')
    .map((r) => childrenOf(r).filter((c) => ['td', 'th'].includes(tagOf(c))).map((c) => tidy(inline(childrenOf(c))).replace(/\|/g, '\\|')));
  if (rows.length === 0) return '';
  const width = Math.max(...rows.map((r) => r.length));
  const line = (cells: string[]) => `| ${Array.from({ length: width }, (_, k) => cells[k] ?? '').join(' | ')} |`;
  return [line(rows[0]!), line(Array(width).fill('---')), ...rows.slice(1).map(line)].join('\n');
}

export function cmlToMarkdown(cml: string): string {
  const doc = parser.parse(cml) as Node[];
  const blocks: string[] = [];
  let counter = 0;
  const nextId = () => `^p${String(++counter).padStart(2, '0')}`;

  const walk = (nodes: Node[]) => {
    for (const n of nodes) {
      const tag = tagOf(n);
      switch (tag) {
        case 'co-content':
          walk(childrenOf(n));
          break;
        case 'heading': {
          const level = Math.min(Math.max(Number(attr(n, 'level')) || 2, 1), 6);
          const text = tidy(inline(childrenOf(n), false));
          if (text) blocks.push(`${'#'.repeat(level)} ${text}`);
          break;
        }
        case 'text': {
          const text = tidy(inline(childrenOf(n)));
          if (text) blocks.push(`${text} ${nextId()}`);
          break;
        }
        case 'list': {
          const lines = renderList(n, 0);
          if (lines.length) blocks.push(`${lines.join('\n')}\n\n${nextId()}`);
          break;
        }
        case 'table': {
          const table = renderTable(n);
          if (table) blocks.push(`${table}\n\n${nextId()}`);
          break;
        }
        case 'img':
          blocks.push('*(image)*');
          break;
        case 'asset': {
          const ext = attr(n, 'extension');
          blocks.push(`📎 ${attr(n, 'name')}${ext ? `.${ext}` : ''}`);
          break;
        }
        case '#text':
          if (clean(String(n['#text'])).trim()) blocks.push(`${tidy(clean(String(n['#text'])))} ${nextId()}`);
          break;
        default:
          walk(childrenOf(n));
      }
    }
  };
  walk(doc);
  return blocks.join('\n\n') + '\n';
}
