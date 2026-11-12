import { readFileSync } from 'node:fs';
import { cmlToMarkdown } from '../src/convert/cml';

const wrap = (s: string) => `<co-content>${s}</co-content>`;

describe('cmlToMarkdown', () => {
  it('renders a paragraph with inline bold and a block id', () => {
    expect(cmlToMarkdown(wrap('<text>Hello <strong>world</strong></text>')).trim()).toBe('Hello **world** ^p01');
  });

  it('renders headings without block ids and without inner bold', () => {
    expect(cmlToMarkdown(wrap('<heading level="2"><strong>Title</strong></heading>')).trim()).toBe('## Title');
  });

  it('renders numbered lists followed by a standalone block id', () => {
    const md = cmlToMarkdown(wrap('<list bulletType="numbers"><li><text>A</text></li><li><text>B</text></li></list>'));
    expect(md.trim()).toBe('1. A\n2. B\n\n^p01');
  });

  it('indents nested lists', () => {
    const md = cmlToMarkdown(
      wrap('<list bulletType="bullets"><li><text>A</text><list bulletType="bullets"><li><text>A1</text></li></list></li></list>'),
    );
    expect(md).toContain('- A\n  - A1');
  });

  it('renders links, emphasis and underline text', () => {
    const md = cmlToMarkdown(wrap('<text><em>x</em> <a href="https://x.y"><u>link</u></a></text>'));
    expect(md.trim()).toBe('*x* [link](https://x.y) ^p01');
  });

  it('renders images (no URL available) and file assets as placeholders', () => {
    const md = cmlToMarkdown(wrap('<img assetId="abc" /><asset id="d" name="Course Glossary" extension="docx" assetType="generic" />'));
    expect(md).toContain('*(image)*');
    expect(md).toContain('📎 Course Glossary.docx');
  });

  it('renders a 2x2 table with a header row', () => {
    const md = cmlToMarkdown(
      wrap('<table><tr><th><text>H1</text></th><th><text>H2</text></th></tr><tr><td><text>a</text></td><td><text>b</text></td></tr></table>'),
    );
    expect(md).toContain('| H1 | H2 |\n| --- | --- |\n| a | b |');
  });

  it('keeps text of unknown tags, normalises nbsp and skips empty paragraphs', () => {
    const md = cmlToMarkdown(wrap('<text></text><mystery><text>Kept&#xa0;text</text></mystery>'));
    expect(md.trim()).toBe('Kept text ^p01');
  });

  it('converts the real fixture', () => {
    const md = cmlToMarkdown(readFileSync('test/fixtures/supplement-cml.xml', 'utf8'));
    expect(md).toContain('# Essential Sheets features for project management');
    expect(md).toContain('- **editing**, which allows others');
    expect(md).toContain('^p01');
    expect(md).not.toMatch(/<\/?[a-z]/);
  });
});
