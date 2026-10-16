import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { blogManifest } from '../src/utils/blog-manifest';
import authorsData from '../src/data/authors.json';
import authorsOptOutData from '../src/data/authors-optout.json';
import { slugifyTag } from '../src/utils/blog-manifest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const publicDir = join(rootDir, 'public');
const distDir = join(rootDir, 'dist');
const siteUrl = 'https://usewraith.xyz';

const authors = authorsData || {};
const optOutList = authorsOptOutData || [];

const COLLAPSED_NAME = 'Wraith Team';

function resolveAuthorName(authorId) {
  if (!authorId) return COLLAPSED_NAME;
  if (optOutList.includes(authorId)) return COLLAPSED_NAME;
  const author = authors[authorId];
  if (author && author.optIn) return author.name;
  if (author && !author.optIn) return COLLAPSED_NAME;
  return authorId;
}

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

function getPosts() {
  return blogManifest.map((post) => ({
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    publishedAt: post.date,
    author: resolveAuthorName(post.author),
    tags: post.tags,
    url: post.url,
    content: '',
  }));
}

export function buildRssFeed(posts, baseUrl = siteUrl, options = {}) {
  const { tag } = options;
  const title = tag ? `Wraith Protocol Blog — ${tag}` : 'Wraith Protocol Blog';
  const selfPath = tag ? `/feed/tag/${slugifyTag(tag)}.xml` : '/feed.xml';
  const channelLink = tag ? `${baseUrl}/blog/tag/${slugifyTag(tag)}` : `${baseUrl}/blog`;

  const items = posts
    .filter((post) => Boolean(post.publishedAt))
    .map((post) => {
      const link = post.url || `${baseUrl}/blog/${post.slug}`;
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
    <link>${escapeXml(channelLink)}</link>
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
  const tags = new Set();
  posts.forEach((post) => {
    post.tags.forEach((tag) => tags.add(tag));
  });

  for (const tag of tags) {
    const tagPosts = posts.filter((post) => post.tags.includes(tag));
    const feedXml = buildRssFeed(tagPosts, siteUrl, { tag });
    const tagDir = join(targetDir, 'feed', 'tag');
    mkdirSync(tagDir, { recursive: true });
    writeFileSync(join(tagDir, `${slugifyTag(tag)}.xml`), feedXml, 'utf8');
  }

  return tags.size;
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

export { getPosts };
