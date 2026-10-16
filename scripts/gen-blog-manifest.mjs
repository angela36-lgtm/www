import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { load as parseYaml } from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const contentDir = join(rootDir, 'src', 'content', 'blog');
const outputPath = join(rootDir, 'src', 'data', 'blog-manifest.json');
const siteUrl = 'https://usewraith.xyz';

class ManifestError extends Error {
  constructor(file, field, message) {
    super(`${file}${field ? ` [${field}]` : ''}: ${message}`);
    this.name = 'ManifestError';
    this.file = file;
    this.field = field;
  }
}

function requireField(data, key, file) {
  if (!(key in data) || data[key] === null || data[key] === undefined) {
    throw new ManifestError(file, key, `required field "${key}" is missing`);
  }
  return data[key];
}

function requireNonEmptyString(value, key, file) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ManifestError(file, key, `field "${key}" must be a non-empty string`);
  }
  return value.trim();
}

function requireIsoDate(value, key, file) {
  const str = requireNonEmptyString(value, key, file);
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) {
    throw new ManifestError(file, key, `field "${key}" is not a valid date: ${str}`);
  }
  return str;
}

function requireAuthor(value, key, file) {
  return requireNonEmptyString(value, key, file);
}

function requireTags(value, key, file) {
  if (!Array.isArray(value)) {
    throw new ManifestError(file, key, `field "${key}" must be an array of strings`);
  }
  const tags = value.filter((t) => typeof t === 'string');
  if (tags.length !== value.length) {
    throw new ManifestError(file, key, `field "${key}" must contain only strings`);
  }
  const trimmed = tags.map((t) => t.trim()).filter(Boolean);
  if (trimmed.length === 0) {
    throw new ManifestError(file, key, `field "${key}" must contain at least one tag`);
  }
  return trimmed;
}

export function parseFrontmatter(source, file) {
  const frontmatterMatch = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) {
    throw new ManifestError(file, null, 'missing frontmatter block (expected --- delimiters)');
  }

  const yamlText = frontmatterMatch[1];
  const content = source.slice(frontmatterMatch[0].length);

  let data;
  try {
    const parsed = parseYaml(yamlText);
    if (parsed === null || parsed === undefined) {
      data = {};
    } else if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new ManifestError(file, null, 'frontmatter must be a YAML mapping (object)');
    } else {
      data = parsed;
    }
  } catch (error) {
    if (error instanceof ManifestError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new ManifestError(file, null, `malformed YAML frontmatter: ${message}`);
  }

  return { data, content };
}

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
      if (paragraph) {
        foundBreak = true;
      }
      continue;
    }

    if (!foundBreak && trimmed) {
      if (trimmed.startsWith('---')) {
        continue;
      }
      if (trimmed.startsWith('#') || trimmed.startsWith('>') || trimmed.startsWith('<')) {
        continue;
      }

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
    .replace(/\[([^\]]+)\]\([^)]+\)$/g, '$1')
    .replace(/[*_]/g, '');
}

function getSlug(filename) {
  return filename.replace(/\.mdx?$/, '');
}

export function processMdxFile(filePath, filename) {
  const file = `src/content/blog/${filename}`;
  const source = readFileSync(filePath, 'utf8');
  const { data, content } = parseFrontmatter(source, file);

  const slug = getSlug(filename);

  const title = requireNonEmptyString(requireField(data, 'title', file), 'title', file);
  const date = requireIsoDate(requireField(data, 'date', file), 'date', file);
  const author = requireAuthor(requireField(data, 'author', file), 'author', file);
  const excerpt = requireNonEmptyString(requireField(data, 'excerpt', file), 'excerpt', file);
  const tags = requireTags(requireField(data, 'tags', file), 'tags', file);

  return {
    slug,
    title,
    excerpt,
    date,
    author,
    tags,
    url: `${siteUrl}/blog/${slug}`,
    publishedAt: new Date(date).toISOString(),
  };
}

export function buildManifest(inputDir) {
  const errors = [];
  const files = readdirSync(inputDir)
    .filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))
    .sort();

  const entries = files.map((filename) => {
    const filePath = join(inputDir, filename);
    try {
      return processMdxFile(filePath, filename);
    } catch (error) {
      if (error instanceof ManifestError) {
        errors.push(error.message);
      } else {
        errors.push(
          `src/content/blog/${filename}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return null;
    }
  });

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  const validEntries = entries.filter(Boolean);

  const slugs = new Set();
  for (const entry of validEntries) {
    if (slugs.has(entry.slug)) {
      throw new Error(`duplicate slug "${entry.slug}"`);
    }
    slugs.add(entry.slug);
  }

  validEntries.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  return validEntries;
}

function main() {
  if (!existsSync(contentDir)) {
    writeFileSync(outputPath, JSON.stringify([], null, 2) + '\n');
    console.log('No blog content directory found; wrote empty manifest.');
    return;
  }

  let validEntries;
  try {
    validEntries = buildManifest(contentDir);
  } catch (error) {
    const errors = error instanceof Error ? error.message.split('\n') : [String(error)];
    for (const err of errors) {
      if (err.trim()) console.error(`  ✗  ${err.trim()}`);
    }
    console.error(`\n🚨  Blog manifest generation failed — ${errors.length} error(s).`);
    process.exit(1);
  }

  writeFileSync(outputPath, JSON.stringify(validEntries, null, 2) + '\n');
  console.log(`Generated blog-manifest.json with ${validEntries.length} posts`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
