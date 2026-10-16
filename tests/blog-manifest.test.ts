import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseFrontmatter, buildManifest } from '../scripts/gen-blog-manifest.mjs';
import {
  getAllManifestPosts,
  getManifestPostBySlug,
  getManifestPostsByTag,
  getAllManifestTags,
  slugifyTag,
} from '../src/utils/blog-manifest';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'wraith-manifest-test-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function writePost(filename: string, frontmatter: string, body = 'Body content.\n'): string {
  const filePath = join(tmpDir, filename);
  writeFileSync(filePath, `---\n${frontmatter}\n---\n\n${body}`, 'utf8');
  return filePath;
}

describe('blog-manifest: YAML frontmatter parsing', () => {
  it('parses a standard frontmatter block', () => {
    const { data } = parseFrontmatter(
      "---\ntitle: 'Hello'\ndate: '2026-01-01'\nauthor: 'wraith-team'\nexcerpt: 'An excerpt.'\ntags: ['a', 'b']\n---\n\nBody here.",
      'src/content/blog/hello.mdx',
    );
    expect(data.title).toBe('Hello');
    expect(data.date).toBe('2026-01-01');
    expect(data.author).toBe('wraith-team');
    expect(data.excerpt).toBe('An excerpt.');
    expect(data.tags).toEqual(['a', 'b']);
  });

  it('parses YAML arrays inline', () => {
    const { data } = parseFrontmatter(
      "---\ntitle: 'T'\ndate: '2026-01-01'\nauthor: 'wraith-team'\nexcerpt: 'E'\ntags: ['privacy', 'stealth-payments']\n---\n\nBody.",
      'src/content/blog/t.mdx',
    );
    expect(data.tags).toEqual(['privacy', 'stealth-payments']);
  });

  it('parses YAML block-style arrays', () => {
    const { data } = parseFrontmatter(
      '---\ntitle: "T"\ndate: "2026-01-01"\nauthor: "wraith-team"\nexcerpt: "E"\ntags:\n  - privacy\n  - stealth-payments\n---\n\nBody.',
      'src/content/blog/t.mdx',
    );
    expect(data.tags).toEqual(['privacy', 'stealth-payments']);
  });

  it('parses quoted strings with special characters', () => {
    const { data } = parseFrontmatter(
      "---\ntitle: 'How Stealth Addresses Keep Payments Private'\ndate: '2026-08-12'\nauthor: 'lena-vogt'\nexcerpt: \"A look at 'crypto' and stealth.\"\ntags: ['cryptography', 'stealth-payments']\n---\n\nBody.",
      'src/content/blog/t.mdx',
    );
    expect(data.title).toBe('How Stealth Addresses Keep Payments Private');
    expect(data.excerpt).toBe("A look at 'crypto' and stealth.");
  });

  it('parses multiline values (folded YAML)', () => {
    const { data } = parseFrontmatter(
      "---\ntitle: 'T'\ndate: '2026-01-01'\nauthor: 'wraith-team'\nexcerpt: >\n  This is a\n  multiline excerpt.\ntags: ['privacy']\n---\n\nBody.",
      'src/content/blog/t.mdx',
    );
    expect(data.excerpt).toContain('multiline');
  });

  it('rejects malformed YAML with a clear error', () => {
    expect(() =>
      parseFrontmatter(
        "---\ntitle: 'T'\ndate: '2026-01-01'\nauthor: 'wraith-team'\nexcerpt: 'E'\ntags: [unclosed\n---\n\nBody.",
        'src/content/blog/broken.mdx',
      ),
    ).toThrow(/malformed YAML/);
  });

  it('rejects non-mapping frontmatter', () => {
    expect(() =>
      parseFrontmatter('---\n- item1\n- item2\n---\n\nBody.', 'src/content/blog/list.mdx'),
    ).toThrow(/must be a YAML mapping/);
  });

  it('rejects missing frontmatter delimiters', () => {
    expect(() => parseFrontmatter('title: T\n\nBody.', 'src/content/blog/nofm.mdx')).toThrow(
      /missing frontmatter/,
    );
  });
});

describe('blog-manifest: field validation', () => {
  it('accepts valid frontmatter', () => {
    const entry = buildManifestFrom({
      'valid.mdx':
        "---\ntitle: 'Valid'\ndate: '2026-03-01'\nauthor: 'wraith-team'\nexcerpt: 'An excerpt.'\ntags: ['privacy']\n---\n\nBody.",
    })[0];
    expect(entry.slug).toBe('valid');
    expect(entry.title).toBe('Valid');
    expect(entry.author).toBe('wraith-team');
    expect(entry.tags).toEqual(['privacy']);
    expect(entry.url).toBe('https://usewraith.xyz/blog/valid');
    expect(entry.publishedAt).toBe('2026-03-01T00:00:00.000Z');
  });

  it('rejects missing required fields with file and field', () => {
    const err = buildManifestExpectError({
      'missing.mdx': "---\ntitle: 'T'\ndate: '2026-01-01'\nauthor: 'wraith-team'\n---\n\nBody.",
    });
    expect(err).toContain('missing.mdx');
    expect(err).toContain('excerpt');
    expect(err).toContain('required field "excerpt" is missing');
  });

  it('rejects invalid dates', () => {
    const err = buildManifestExpectError({
      'baddate.mdx':
        "---\ntitle: 'T'\ndate: 'not-a-date'\nauthor: 'wraith-team'\nexcerpt: 'E'\ntags: ['privacy']\n---\n\nBody.",
    });
    expect(err).toContain('baddate.mdx');
    expect(err).toContain('date');
    expect(err).toContain('not a valid date');
  });

  it('rejects empty author', () => {
    const err = buildManifestExpectError({
      'noauthor.mdx':
        "---\ntitle: 'T'\ndate: '2026-01-01'\nauthor: ''\nexcerpt: 'E'\ntags: ['privacy']\n---\n\nBody.",
    });
    expect(err).toContain('author');
    expect(err).toContain('non-empty string');
  });

  it('rejects tags that are not an array', () => {
    const err = buildManifestExpectError({
      'badtags.mdx':
        "---\ntitle: 'T'\ndate: '2026-01-01'\nauthor: 'wraith-team'\nexcerpt: 'E'\ntags: 'privacy'\n---\n\nBody.",
    });
    expect(err).toContain('tags');
    expect(err).toContain('must be an array of strings');
  });

  it('rejects tags containing non-strings', () => {
    const err = buildManifestExpectError({
      'badtags2.mdx':
        "---\ntitle: 'T'\ndate: '2026-01-01'\nauthor: 'wraith-team'\nexcerpt: 'E'\ntags: ['privacy', 5]\n---\n\nBody.",
    });
    expect(err).toContain('must contain only strings');
  });

  it('rejects empty tags array', () => {
    const err = buildManifestExpectError({
      'emptytags.mdx':
        "---\ntitle: 'T'\ndate: '2026-01-01'\nauthor: 'wraith-team'\nexcerpt: 'E'\ntags: []\n---\n\nBody.",
    });
    expect(err).toContain('at least one tag');
  });
});

describe('blog-manifest: sorting and determinism', () => {
  it('sorts posts by date descending', () => {
    const entries = buildManifestFrom({
      'old.mdx':
        "---\ntitle: 'Old'\ndate: '2026-01-01'\nauthor: 'wraith-team'\nexcerpt: 'E'\ntags: ['privacy']\n---\n\nBody.",
      'new.mdx':
        "---\ntitle: 'New'\ndate: '2026-06-01'\nauthor: 'wraith-team'\nexcerpt: 'E'\ntags: ['privacy']\n---\n\nBody.",
      'mid.mdx':
        "---\ntitle: 'Mid'\ndate: '2026-03-01'\nauthor: 'wraith-team'\nexcerpt: 'E'\ntags: ['privacy']\n---\n\nBody.",
    });
    expect(entries.map((e) => e.title)).toEqual(['New', 'Mid', 'Old']);
  });

  it('produces deterministic output across runs', () => {
    const files = {
      'z.mdx':
        "---\ntitle: 'Z'\ndate: '2026-01-01'\nauthor: 'wraith-team'\nexcerpt: 'E'\ntags: ['privacy']\n---\n\nBody.",
      'a.mdx':
        "---\ntitle: 'A'\ndate: '2026-06-01'\nauthor: 'wraith-team'\nexcerpt: 'E'\ntags: ['privacy']\n---\n\nBody.",
    };
    const first = buildManifestFrom(files);
    const second = buildManifestFrom(files);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

describe('blog-manifest: shared manifest consumption', () => {
  it('exposes all manifest posts', () => {
    const posts = getAllManifestPosts();
    expect(posts.length).toBeGreaterThan(0);
    expect(posts.some((p) => p.slug === 'wave-7-kickoff')).toBe(true);
  });

  it('resolves a post by slug', () => {
    const post = getManifestPostBySlug('wave-7-kickoff');
    expect(post).toBeDefined();
    expect(post!.title).toContain('Wave 7 Kick-off');
    expect(post!.author).toBe('wraith-team');
    expect(post!.tags).toContain('stealth-payments');
  });

  it('returns undefined for unknown slugs', () => {
    expect(getManifestPostBySlug('does-not-exist')).toBeUndefined();
  });

  it('lists all tags across posts', () => {
    const tags = getAllManifestTags();
    expect(tags).toContain('stealth-payments');
    expect(tags).toContain('privacy');
    expect(tags).toEqual([...tags].sort());
  });

  it('filters posts by tag', () => {
    const posts = getManifestPostsByTag('stealth-payments');
    expect(posts.length).toBeGreaterThanOrEqual(2);
    expect(posts.every((p) => p.tags.includes('stealth-payments'))).toBe(true);
  });

  it('slugifies tags deterministically', () => {
    expect(slugifyTag('Stealth Payments')).toBe('stealth-payments');
  });
});

function buildManifestFrom(files: Record<string, string>) {
  for (const [filename, content] of Object.entries(files)) {
    writeFileSync(join(tmpDir, filename), content, 'utf8');
  }
  return buildManifest(tmpDir);
}

function buildManifestExpectError(files: Record<string, string>): string | undefined {
  for (const [filename, content] of Object.entries(files)) {
    writeFileSync(join(tmpDir, filename), content, 'utf8');
  }
  try {
    buildManifest(tmpDir);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
