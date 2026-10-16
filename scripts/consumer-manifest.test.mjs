import { describe, expect, it } from 'vitest';
import { getPosts } from '../scripts/gen-rss.mjs';
import { loadManifest, getAllTagsFromManifest } from '../scripts/blog-manifest.mjs';

describe('consumers: shared manifest', () => {
  it('gen-rss getPosts reads from the shared manifest (no independent frontmatter parsing)', () => {
    const posts = getPosts();
    const manifest = loadManifest();
    expect(posts.length).toBe(manifest.length);

    const manifestBySlug = new Map(manifest.map((m) => [m.slug, m]));
    for (const post of posts) {
      const m = manifestBySlug.get(post.slug);
      expect(m).toBeDefined();
      expect(post.title).toBe(m.title);
      expect(post.publishedAt).toBe(m.date);
      expect(post.author).toBeDefined();
      expect(post.url).toBe(`https://usewraith.xyz/blog/${post.slug}`);
      expect(Array.isArray(post.tags)).toBe(true);
    }
  });

  it('getPosts exposes all manifest tags', () => {
    const posts = getPosts();
    const manifestTags = getAllTagsFromManifest(loadManifest());
    const postTags = new Set();
    for (const post of posts) {
      for (const tag of post.tags) postTags.add(tag);
    }
    for (const tag of manifestTags) {
      expect(postTags.has(tag)).toBe(true);
    }
  });

  it('RSS feed built from manifest posts contains all posts', () => {
    const posts = getPosts();
    const xml = require('../scripts/gen-rss.mjs').buildRssFeed(posts);
    for (const post of posts) {
      expect(xml).toContain(post.title);
      expect(xml).toContain(post.url);
    }
  });
});
