/**
 * Shared blog metadata source — issue #198.
 *
 * Single authoritative parser/validator/generator for blog post frontmatter.
 * Every consumer (app, RSS, both sitemaps, OG) reads the generated manifest
 * instead of independently parsing MDX frontmatter.
 *
 *   • Parses frontmatter with the `yaml` package (no regex/line-splitting)
 *   • Validates required fields, dates, authors, tags before building
 *   • Generates src/data/blog-manifest.json — one validated manifest
 *
 * On validation failure: prints the affected file + field and throws so the
 * build stops.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const contentDir = join(rootDir, 'src', 'content', 'blog');
const manifestPath = join(rootDir, 'src', 'data', 'blog-manifest.json');
const siteUrl = 'https://usewraith.xyz';

const REQUIRED_FIELDS = ['title', 'date', 'author', 'excerpt'];

// ---------------------------------------------------------------------------
// ISO 8601 date validation (mirrors src/utils/date.ts so this module is
// self-contained and runnable by plain Node)
//
// Accepts bare dates, UTC datetimes, offset datetimes. Rejects anything new
// Date() would leniently accept but is not valid ISO 8601.
// ---------------------------------------------------------------------------

const ISO_DATE_RE =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/;

function isIsoDate(v) {
  if (typeof v !== 'string' || v.trim().length === 0) return false;
  const s = v.trim();
  if (!ISO_DATE_RE.test(s)) return false;
  const year = parseInt(s.slice(0, 4), 10);
  const month = parseInt(s.slice(5, 7), 10);
  const day = parseInt(s.slice(8, 10), 10);
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

// ---------------------------------------------------------------------------
// Frontmatter parsing (structured YAML — no regex/line splitting)
// ---------------------------------------------------------------------------

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Extracts and parses the YAML frontmatter block from an MDX source string.
 * Throws a descriptive error (identifying the source) when the YAML is
 * malformed. Returns an empty data object when there is no frontmatter block.
 */
function parseFrontmatter(source, fileHint = '<input>') {
  const match = source.match(FRONTMATTER_RE);
  if (!match) {
    return { data: {}, content: source, raw: '' };
  }

  const raw = match[1];
  const content = source.slice(match[0].length);

  let data;
  try {
    const parsed = parseYaml(raw, { merge: true });
    data = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`[${fileHint}] malformed frontmatter YAML: ${message}`);
  }

  return { data, content, raw };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function requireNonEmpty(file, field, value) {
  const errors = [];
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push({
      file,
      field,
      message: `field "${field}" must be a non-empty string (got ${JSON.stringify(value)})`,
    });
  }
  return errors;
}

/**
 * Validates a single post's frontmatter data. Returns an array of errors
 * (empty when valid). Each error identifies the file and field.
 */
function validateFrontmatter(data, file) {
  const errors = [];

  for (const field of REQUIRED_FIELDS) {
    errors.push(...requireNonEmpty(file, field, data[field]));
  }

  // date must be a valid ISO 8601 string
  if (
    'date' in data &&
    data['date'] != null &&
    data['date'] !== '' &&
    typeof data['date'] === 'string'
  ) {
    if (!isIsoDate(data['date'])) {
      errors.push({
        file,
        field: 'date',
        message: `field "date" must be a valid ISO 8601 date string (got ${JSON.stringify(data['date'])})`,
      });
    }
  }

  // tags: when present must be an array of strings
  if ('tags' in data && data['tags'] != null) {
    if (!Array.isArray(data['tags'])) {
      errors.push({
        file,
        field: 'tags',
        message: `field "tags" must be an array of strings (got ${JSON.stringify(data['tags'])})`,
      });
    } else {
      for (const [i, tag] of data['tags'].entries()) {
        if (typeof tag !== 'string' || tag.trim().length === 0) {
          errors.push({
            file,
            field: 'tags',
            message: `field "tags[${i}]" must be a non-empty string (got ${JSON.stringify(tag)})`,
          });
        }
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Manifest entry construction
// ---------------------------------------------------------------------------

function getSlug(filename) {
  return filename.replace(/\.mdx?$/, '');
}

function processMdxFile(filePath, filename) {
  const source = readFileSync(filePath, 'utf8');
  const { data, content } = parseFrontmatter(source, filename);
  const slug = getSlug(filename);

  const errors = validateFrontmatter(data, filename);
  if (errors.length > 0) {
    const details = errors.map((e) => `  ${e.field}: ${e.message}`).join('\n');
    throw new Error(`Invalid frontmatter in ${filename}:\n${details}`);
  }

  const tags = Array.isArray(data['tags']) ? data['tags'] : [];
  const excerpt =
    typeof data['excerpt'] === 'string' && data['excerpt'].trim().length > 0
      ? data['excerpt']
      : extractFirstParagraph(content);

  return {
    slug,
    title: String(data['title']),
    excerpt,
    date: String(data['date']),
    author: String(data['author']),
    url: `${siteUrl}/blog/${slug}`,
    tags,
  };
}

/**
 * Returns the first real paragraph of the MDX body, used as a fallback excerpt.
 */
function extractFirstParagraph(content) {
  const lines = content.split('\n');
  let inCode = false;
  let foundBreak = false;
  let paragraph = '';

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;

    const trimmed = line.trim();

    if (trimmed === '' && !foundBreak) {
      if (paragraph) foundBreak = true;
      continue;
    }

    if (!foundBreak && trimmed) {
      if (trimmed.startsWith('---')) continue;
      if (trimmed.startsWith('#') || trimmed.startsWith('>') || trimmed.startsWith('<')) continue;
      if (trimmed.match(/^\[[^\]]+\]\([^)]+\)$/)) {
        foundBreak = true;
        continue;
      }
      paragraph += (paragraph ? ' ' : '') + trimmed;
      foundBreak = true;
    }
  }

  return paragraph
    .slice(0, 160)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_]/g, '');
}

// ---------------------------------------------------------------------------
// Manifest generation
// ---------------------------------------------------------------------------

/**
 * Parses every MDX post's frontmatter once, validates it, and writes the
 * single authoritative manifest to src/data/blog-manifest.json.
 *
 * Throws on the first malformed/invalid post (file + field identified).
 * Returns the validated manifest entries.
 */
function buildManifest() {
  if (!existsSync(contentDir)) {
    writeFileSync(manifestPath, stringifyYaml([], { indent: 2 }) + '\n', 'utf8');
    console.log('No blog content directory found — wrote empty manifest');
    return [];
  }

  const files = readdirSync(contentDir)
    .filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))
    .sort();

  const entries = [];
  for (const filename of files) {
    const filePath = join(contentDir, filename);
    entries.push(processMdxFile(filePath, filename));
  }

  // Check for duplicate slugs
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.slug)) {
      throw new Error(
        `Duplicate blog slug "${entry.slug}" (file produces a manifest entry that collides with an earlier post)`,
      );
    }
    seen.add(entry.slug);
  }

  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  writeFileSync(manifestPath, JSON.stringify(entries, null, 2) + '\n', 'utf8');
  console.log(`Generated blog-manifest.json with ${entries.length} post(s)`);
  return entries;
}

/**
 * Loads the generated manifest. Throws a descriptive error if it is missing
 * (callers should run `buildManifest` / the build step first).
 */
function loadManifest() {
  if (!existsSync(manifestPath)) {
    throw new Error(
      `Blog manifest not found at ${manifestPath}. Run "node scripts/blog-manifest.mjs" (or the full build) to generate it.`,
    );
  }
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

/**
 * All tag strings across the manifest, deduplicated and sorted.
 */
function getAllTagsFromManifest(entries) {
  const tagSet = new Set();
  for (const entry of entries) {
    for (const tag of entry.tags) tagSet.add(tag);
  }
  return Array.from(tagSet).sort();
}

function main() {
  try {
    buildManifest();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

// Allow direct execution: `node scripts/blog-manifest.mjs`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export {
  buildManifest,
  loadManifest,
  parseFrontmatter,
  validateFrontmatter,
  isIsoDate,
  getAllTagsFromManifest,
};
