import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseFrontmatter,
  validateFrontmatter,
  buildManifest,
  loadManifest,
  isIsoDate,
  getAllTagsFromManifest,
} from './blog-manifest.mjs';

const MANIFEST_PATH = join(__dirname, '..', 'src', 'data', 'blog-manifest.json');

function readManifest() {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
}

describe('blog-manifest: isIsoDate', () => {
  it('accepts bare ISO dates', () => {
    expect(isIsoDate('2026-07-20')).toBe(true);
  });

  it('accepts UTC datetimes with milliseconds', () => {
    expect(isIsoDate('2026-07-20T12:00:00.000Z')).toBe(true);
  });

  it('accepts offset datetimes', () => {
    expect(isIsoDate('2026-07-20T12:00:00+05:30')).toBe(true);
  });

  it('rejects non-ISO date-like strings', () => {
    expect(isIsoDate('1')).toBe(false);
    expect(isIsoDate('August 14')).toBe(false);
    expect(isIsoDate('2026-1-5')).toBe(false);
    expect(isIsoDate('2026-02-31')).toBe(false);
    expect(isIsoDate('')).toBe(false);
    expect(isIsoDate(null)).toBe(false);
    expect(isIsoDate(2026)).toBe(false);
  });
});

describe('blog-manifest: parseFrontmatter', () => {
  it('parses a standard frontmatter block', () => {
    const source =
      "---\ntitle: 'Hello'\ndate: 2026-07-20\nauthor: lena\nexcerpt: A post.\ntags: [a, b]\n---\n\nBody here.";
    const { data, content } = parseFrontmatter(source, 'test.mdx');
    expect(data.title).toBe('Hello');
    expect(data.date).toBe('2026-07-20');
    expect(data.author).toBe('lena');
    expect(data.excerpt).toBe('A post.');
    expect(data.tags).toEqual(['a', 'b']);
    expect(content.trim()).toBe('Body here.');
  });

  it('returns empty data when there is no frontmatter', () => {
    const { data, content } = parseFrontmatter('Just body text.', 'test.mdx');
    expect(data).toEqual({});
    expect(content).toBe('Just body text.');
  });

  it('handles quoted strings with special characters', () => {
    const source =
      "---\ntitle: \"It's a \\\"nice\\\" day\"\ndate: '2026-08-12'\nauthor: 'lena-vogt'\n---\n\nBody.";
    const { data } = parseFrontmatter(source, 'test.mdx');
    expect(data.title).toBe('It\'s a "nice" day');
    expect(data.author).toBe('lena-vogt');
  });

  it('handles YAML arrays (flow and block style)', () => {
    const flow = '---\ntags: [a, b, c]\n---\n\nBody.';
    expect(parseFrontmatter(flow, 'a.mdx').data.tags).toEqual(['a', 'b', 'c']);

    const block = '---\ntags:\n  - a\n  - b\n  - c\n---\n\nBody.';
    expect(parseFrontmatter(block, 'b.mdx').data.tags).toEqual(['a', 'b', 'c']);
  });

  it('handles multiline values (folded block scalars)', () => {
    const source = '---\nexcerpt: >\n  This is a folded\n  multiline value.\n---\n\nBody.';
    const { data } = parseFrontmatter(source, 'a.mdx');
    expect(data.excerpt).toContain('folded');
    expect(data.excerpt).toContain('multiline');
  });

  it('throws a descriptive error on malformed YAML identifying the file', () => {
    const source = "---\ntitle: 'unclosed\n[bad yaml\n---\n\nBody.";
    expect(() => parseFrontmatter(source, 'broken.mdx')).toThrow(/broken.mdx/);
    expect(() => parseFrontmatter(source, 'broken.mdx')).toThrow(/malformed frontmatter/);
  });
});

describe('blog-manifest: validateFrontmatter', () => {
  const file = 'post.mdx';

  it('accepts a complete valid post', () => {
    const errors = validateFrontmatter(
      { title: 'T', date: '2026-07-20', author: 'lena-vogt', excerpt: 'E', tags: ['a'] },
      file,
    );
    expect(errors).toEqual([]);
  });

  it('rejects missing required fields with file and field', () => {
    const errors = validateFrontmatter({}, file);
    expect(errors.length).toBe(4);
    for (const e of errors) {
      expect(e.file).toBe(file);
      expect(['title', 'date', 'author', 'excerpt']).toContain(e.field);
      expect(e.message).toContain('must be a non-empty string');
    }
  });

  it('rejects invalid dates', () => {
    const errors = validateFrontmatter(
      { title: 'T', date: 'not-a-date', author: 'lena', excerpt: 'E' },
      file,
    );
    const dateErr = errors.find((e) => e.field === 'date');
    expect(dateErr).toBeDefined();
    expect(dateErr.file).toBe(file);
  });

  it('rejects non-string author', () => {
    const errors = validateFrontmatter(
      { title: 'T', date: '2026-07-20', author: 42, excerpt: 'E' },
      file,
    );
    const authorErr = errors.find((e) => e.field === 'author');
    expect(authorErr).toBeDefined();
    expect(authorErr.file).toBe(file);
  });

  it('rejects tags that are not an array', () => {
    const errors = validateFrontmatter(
      { title: 'T', date: '2026-07-20', author: 'lena', excerpt: 'E', tags: 'not-array' },
      file,
    );
    const tagsErr = errors.find((e) => e.field === 'tags');
    expect(tagsErr).toBeDefined();
    expect(tagsErr.file).toBe(file);
  });

  it('rejects tags containing non-strings', () => {
    const errors = validateFrontmatter(
      { title: 'T', date: '2026-07-20', author: 'lena', excerpt: 'E', tags: ['a', 1, ''] },
      file,
    );
    const tagsErr = errors.find((e) => e.field === 'tags');
    expect(tagsErr).toBeDefined();
    expect(tagsErr.message).toContain('tags[');
  });

  it('accepts absent tags (optional)', () => {
    const errors = validateFrontmatter(
      { title: 'T', date: '2026-07-20', author: 'lena', excerpt: 'E' },
      file,
    );
    expect(errors).toEqual([]);
  });
});

describe('blog-manifest: manifest generation', () => {
  it('generates a valid manifest from MDX posts sorted by date desc', () => {
    const entries = buildManifest();
    expect(entries.length).toBeGreaterThan(0);
    const dates = entries.map((e) => new Date(e.date).getTime());
    expect(dates.every((d, i) => i === 0 || dates[i - 1] >= d)).toBe(true);
    for (const e of entries) {
      expect(e.slug).toBeDefined();
      expect(e.title).toBeDefined();
      expect(e.excerpt).toBeDefined();
      expect(e.date).toBeDefined();
      expect(e.author).toBeDefined();
      expect(e.url).toBe(`https://usewraith.xyz/blog/${e.slug}`);
      expect(Array.isArray(e.tags)).toBe(true);
    }
  });

  it('produces deterministic output across runs', () => {
    const first = buildManifest();
    const second = buildManifest();
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('throws on malformed YAML identifying the file', () => {
    const source = "---\ntitle: 'unclosed\n---\n\nbody\n";
    expect(() => parseFrontmatter(source, 'bad.mdx')).toThrow(/bad.mdx/);
    expect(() => parseFrontmatter(source, 'bad.mdx')).toThrow(/malformed frontmatter/);
  });

  it('throws on missing required fields identifying the file and field', () => {
    const source = '---\ndate: 2026-01-01\n---\n\nbody\n';
    const { data } = parseFrontmatter(source, 'missing.mdx');
    const errors = validateFrontmatter(data, 'missing.mdx');
    const titleErr = errors.find((e) => e.field === 'title');
    expect(titleErr).toBeDefined();
    expect(titleErr.file).toBe('missing.mdx');
  });

  it('loadManifest returns the committed manifest', () => {
    const manifest = loadManifest();
    expect(Array.isArray(manifest)).toBe(true);
    expect(manifest.length).toBe(3);
    const slugs = manifest.map((m) => m.slug);
    expect(slugs).toContain('wave-7-kickoff');
    expect(slugs).toContain('stealth-addresses-explained');
    expect(slugs).toContain('privacy-by-default');
  });

  it('getAllTagsFromManifest returns deduplicated sorted tags', () => {
    const manifest = loadManifest();
    const tags = getAllTagsFromManifest(manifest);
    expect(tags).toEqual(Array.from(new Set(tags)).sort());
    expect(tags).toContain('stealth-payments');
    expect(tags).toContain('privacy');
  });
});
