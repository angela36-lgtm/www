import type { ComponentType } from 'react';
import GithubSlugger from 'github-slugger';
import authorsData from '../data/authors.json';
import authorsOptOutData from '../data/authors-optout.json';
import { getAllManifestPosts, getManifestPostBySlug } from './blog-manifest';

export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export interface AuthorLinks {
  website?: string;
  github?: string;
  twitter?: string;
  email?: string;
}

export interface Author {
  name: string;
  bio: string;
  avatar?: string;
  links?: AuthorLinks;
  optIn: boolean;
}

export type AuthorProfile = Author & { id: string };

interface MDXModule {
  default: ComponentType;
  frontmatter: {
    title?: string;
    date?: string;
    author?: string;
    excerpt?: string;
    tags?: unknown;
  };
}

const COLLAPSED_NAME = 'Wraith Team';

const authors = (authorsData ?? {}) as Record<string, Author>;
const optOutList = (authorsOptOutData ?? []) as string[];

/**
 * Returns the public author profile for an id, or undefined if the author
 * opted out (or is unknown). Opted-out and unknown ids never get a page.
 */
export function getAuthorById(id: string): AuthorProfile | undefined {
  const author = authors[id];
  if (!author) return undefined;
  if (optOutList.includes(id) || !author.optIn) return undefined;
  return { ...author, id };
}

/**
 * Resolves a raw frontmatter author id into a display name and an optional
 * page link id. Opted-out authors collapse to "Wraith Team" with no link;
 * unknown ids fall back to the raw string with no link (graceful, no crash).
 */
export function resolveAuthor(authorId: string): { name: string; linkId: string | null } {
  if (optOutList.includes(authorId)) {
    return { name: COLLAPSED_NAME, linkId: null };
  }

  const author = authors[authorId];
  if (author && author.optIn) {
    return { name: author.name, linkId: authorId };
  }
  if (author && !author.optIn) {
    return { name: COLLAPSED_NAME, linkId: null };
  }

  return { name: authorId, linkId: null };
}

const modules = import.meta.glob<MDXModule>('/src/content/blog/*.mdx', { eager: true });
const rawModules = import.meta.glob('/src/content/blog/*.mdx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, unknown>;

function getRawContent(value: unknown): string {
  if (typeof value === 'string') return value;

  if (value && typeof value === 'object' && 'default' in value) {
    const defaultExport = (value as { default?: unknown }).default;
    if (typeof defaultExport === 'string') return defaultExport;
  }

  return '';
}

// Cache posts to avoid re-parsing on every call
let cachedPosts: BlogPost[] | null = null;

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  author: string;
  authorName: string;
  authorId: string | null;
  excerpt: string;
  tags: string[];
  readingTimeMin: number;
  wordCount: number;
  toc: TocItem[];
  Component: ComponentType;
}

function buildPost(slug: string): BlogPost | null {
  const manifestEntry = getManifestPostBySlug(slug);
  if (!manifestEntry) return null;

  const moduleKey = `/src/content/blog/${slug}.mdx`;
  const mod = modules[moduleKey];
  const rawAuthor = manifestEntry.author;
  const { name: authorName, linkId: authorId } = resolveAuthor(rawAuthor);

  const rawContent = getRawContent(rawModules[moduleKey]);
  const body = rawContent.replace(/^---[\s\S]*?^---/m, '');
  const words = body.split(/\s+/).filter(Boolean).length;
  const readingTimeMin = Math.max(1, Math.ceil(words / 200));

  const slugger = new GithubSlugger();
  const toc: TocItem[] = [];
  const headingRegex = /^(##|###)\s+(.+)$/gm;
  let match;
  while ((match = headingRegex.exec(body)) !== null) {
    if (!match[1] || !match[2]) continue;
    const level = match[1].length;
    const text = match[2].trim();
    const cleanText = text.replace(/[*_`]/g, '');
    const id = slugger.slug(cleanText);
    toc.push({ id, text: cleanText, level });
  }

  return {
    slug: manifestEntry.slug,
    title: manifestEntry.title,
    date: manifestEntry.date,
    author: rawAuthor,
    authorName,
    authorId,
    excerpt: manifestEntry.excerpt,
    tags: manifestEntry.tags,
    readingTimeMin,
    wordCount: words,
    toc,
    Component: mod?.default as ComponentType,
  };
}

export function getAllPosts(): BlogPost[] {
  if (cachedPosts) return cachedPosts;

  cachedPosts = getAllManifestPosts()
    .map((post) => buildPost(post.slug))
    .filter((post): post is BlogPost => post !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return cachedPosts;
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  const posts = getAllPosts();
  return posts.find((p) => p.slug === slug);
}

export function getPostsByAuthor(id: string): BlogPost[] {
  return getAllPosts().filter((p) => p.author === id && p.authorId === id);
}

export {
  slugifyTag,
  getAllManifestTags as getAllTags,
  getManifestTagFromSlug as getTagFromSlug,
} from './blog-manifest';

export function getPostsByTag(tag: string): BlogPost[] {
  return getAllPosts().filter((post) => post.tags.includes(tag));
}

export function getRelatedPosts(slug: string, limit = 3): BlogPost[] {
  const all = getAllPosts();
  const current = all.find((post) => post.slug === slug);
  if (!current) return [];

  const currentTags = new Set(current.tags);

  return all
    .filter((post) => post.slug !== slug)
    .map((post) => ({
      post,
      overlap: post.tags.filter((tag) => currentTags.has(tag)).length,
    }))
    .filter((entry) => entry.overlap > 0)
    .sort(
      (a, b) =>
        b.overlap - a.overlap || new Date(b.post.date).getTime() - new Date(a.post.date).getTime(),
    )
    .slice(0, limit)
    .map((entry) => entry.post);
}
