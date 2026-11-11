import { sanitizeFileName, moduleFolderName, itemFileName } from '../src/vault/naming';

describe('sanitizeFileName', () => {
  it('removes forbidden characters and collapses spaces', () => {
    expect(sanitizeFileName('What is a "project"? / Part #1')).toBe('What is a project Part 1');
  });
  it('truncates to 80 characters', () => {
    expect(sanitizeFileName('a'.repeat(120)).length).toBe(80);
  });
  it('falls back to "untitled" when nothing is left', () => {
    expect(sanitizeFileName('???')).toBe('untitled');
  });
});

describe('moduleFolderName', () => {
  it('pads the index and sanitizes the name', () => {
    expect(moduleFolderName(3, 'Set goals: OKRs')).toBe('M03 - Set goals OKRs');
  });
});

describe('itemFileName', () => {
  it('builds "NN - Title [type].md"', () => {
    expect(itemFileName(7, 'Introduction [Part 1]', 'video')).toBe('07 - Introduction Part 1 [video].md');
  });
  it('stays unique for duplicate titles thanks to the index', () => {
    expect(itemFileName(1, 'Same', 'video')).not.toBe(itemFileName(2, 'Same', 'video'));
  });
});
