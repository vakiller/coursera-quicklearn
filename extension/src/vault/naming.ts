const FORBIDDEN = /[\/\\:*?"<>|#^\[\]]/g;

export function sanitizeFileName(name: string, max = 80): string {
  const cleaned = name.replace(FORBIDDEN, '').replace(/\s+/g, ' ').trim().slice(0, max).trim();
  return cleaned === '' ? 'untitled' : cleaned;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function moduleFolderName(index: number, name: string): string {
  return `M${pad2(index)} - ${sanitizeFileName(name)}`;
}

export function itemFileName(index: number, title: string, type: 'video' | 'reading'): string {
  return `${pad2(index)} - ${sanitizeFileName(title)} (${type}).md`;
}
