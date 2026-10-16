import blogManifestJson from '../data/blog-manifest.json';

export interface BlogManifestEntry {
  slug: string;
  title: string;
  date: string;
  author: string;
  excerpt: string;
  tags: string[];
  url: string;
  publishedAt: string;
}

export type BlogManifest = BlogManifestEntry[];

export const blogManifest: BlogManifest = (blogManifestJson as unknown as BlogManifest) ?? [];

export function getAllManifestPosts(): BlogManifest {
  return blogManifest;
}

export function getManifestPostBySlug(slug: string): BlogManifestEntry | undefined {
  return blogManifest.find((post) => post.slug === slug);
}

export function getManifestPostsByAuthor(authorId: string): BlogManifestEntry[] {
  return blogManifest.filter((post) => post.author === authorId);
}

export function getAllManifestTags(): string[] {
  const tagSet = new Set<string>();
  blogManifest.forEach((post) => {
    post.tags.forEach((tag) => tagSet.add(tag));
  });
  return Array.from(tagSet).sort();
}

export function getManifestPostsByTag(tag: string): BlogManifestEntry[] {
  return blogManifest.filter((post) => post.tags.includes(tag));
}

export function getManifestTagFromSlug(slug: string): string | undefined {
  return getAllManifestTags().find((tag) => slugifyTag(tag) === slug);
}

export function slugifyTag(tag: string): string {
  return String(tag)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
