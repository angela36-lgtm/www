import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { loadManifest, getAllTagsFromManifest } from './blog-manifest.mjs';
import { slugifyTag } from './feed-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(dirname(__filename));
const rootDir = join(__dirname, '..');
const publicDir = join(rootDir, 'public');
const distDir = join(rootDir, 'dist');
const siteUrl = 'https://usewraith.xyz';

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toRfc822(date) {
  return new Date(date).toUTCString();
}

let authorsCache = null;
let optOutCache = null;

function resolveAuthorName(authorId) {
  if (!authorId) return 'Wraith Team';
  try {
    if (!authorsCache) {
      const aPath = join(rootDir, 'src', 'data', 'authors.json');
      authorsCache = existsSync(aPath) ? JSON.parse(readFileSync(aPath, 'utf8')) : {};
    }
    if (!optOutCache) {
      const oPath = join(rootDir, 'src', 'data', 'authors-optout.json');
      optOutCache = existsSync(oPath) ? JSON.parse(readFileSync(oPath, 'utf8')) : [];
    }
  } catch {
    return authorId;
  }
  if (optOutCache.includes(authorId)) return 'Wraith Team';
  const author = authorsCache[authorId];
  if (author && author.optIn) return author.name;
  if (author && !author.optIn) return 'Wraith Team';
  return authorId;
}

/**
 * Reads posts from the single validated blog manifest. No frontmatter parsing
 * happens here — the manifest is the authoritative source.
 */
export function getPosts() {
  const entries = loadManifest();

  return entries
    .map((post) => ({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt ?? '',
      content: '',
      publishedAt: post.date,
      author: resolveAuthorName(post.author),
      tags: post.tags ?? [],
      url: post.url ?? `${siteUrl}/blog/${post.slug}`,
    }))
    .filter((post) => Boolean(post.publishedAt))
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt));
}

export function buildRssFeed(posts, baseUrl = siteUrl, options = {}) {
  const { tag } = options;
  const title = tag ? `Wraith Protocol Blog — ${tag}` : 'Wraith Protocol Blog';
  const selfPath = tag ? `/feed/tag/${slugifyTag(tag)}.xml` : '/feed.xml';
  const channelLink = tag ? `${baseUrl}/blog/tag/${slugifyTag(tag)}` : `${baseUrl}/blog`;

  const items = posts
    .filter((post) => Boolean(post.publishedAt))
    .map((post) => {
      const link = post.url ?? `${baseUrl}/blog/${post.slug}`;
      const description =
        post.excerpt || post.content || 'Read the latest update from Wraith Protocol.';
      return `  <item>
    <title>${escapeXml(post.title)}</title>
    <link>${escapeXml(link)}</link>
    <guid>${escapeXml(link)}</guid>
    <pubDate>${toRfc822(post.publishedAt)}</pubDate>
    <description>${escapeXml(description)}</description>
    <author>${escapeXml(post.author)}</author>
  </item>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${channelLink}</link>
    <description>Notes on stealth payments, private infrastructure, and the Wraith ecosystem.</description>
    <language>en-us</language>
    <lastBuildDate>${toRfc822(new Date().toISOString())}</lastBuildDate>
    <atom:link href="${baseUrl}${selfPath}" rel="self" type="application/rss+xml" />
${items ? `\n${items}\n` : ''}  </channel>
</rss>`;
}

function writeFeedFile(targetDir) {
  const posts = getPosts();
  const feedXml = buildRssFeed(posts, siteUrl);
  mkdirSync(targetDir, { recursive: true });
  writeFileSync(join(targetDir, 'feed.xml'), feedXml, 'utf8');
}

function writeTagFeeds(targetDir) {
  const posts = getPosts();
  const tags = getAllTagsFromManifest(posts);

  for (const tag of tags) {
    const tagPosts = posts.filter((post) => (post.tags || []).includes(tag));
    const feedXml = buildRssFeed(tagPosts, siteUrl, { tag });
    const tagDir = join(targetDir, 'feed', 'tag');
    mkdirSync(tagDir, { recursive: true });
    writeFileSync(join(tagDir, `${slugifyTag(tag)}.xml`), feedXml, 'utf8');
  }

  return tags.length;
}

function main() {
  const posts = getPosts();
  writeFeedFile(publicDir);
  const tagCount = writeTagFeeds(publicDir);
  if (existsSync(distDir)) {
    writeFeedFile(distDir);
    writeTagFeeds(distDir);
  }
  console.log(
    `feed.xml generated successfully with ${posts.length} posts across ${tagCount} tag feeds.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
