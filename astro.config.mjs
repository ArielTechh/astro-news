// @ts-check
import { defineConfig } from "astro/config";
import { getAllArticles } from './src/lib/sanity.js';
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { modifiedTime, readingTime } from "./src/lib/utils/remarks.mjs";
import { SITE } from "./src/lib/config";
import keystatic from "@keystatic/astro";
import react from "@astrojs/react";
import { loadEnv } from "vite";
import pagefind from "astro-pagefind";
import sanity from '@sanity/astro';
import vercel from '@astrojs/vercel/serverless';


const { RUN_KEYSTATIC } = loadEnv(import.meta.env.MODE, process.cwd(), "");

// Calculate priority based on article age and sitemap index
function calculatePriority(publishedDate, sitemapIndex = 0) {
  const now = new Date();
  const published = new Date(publishedDate);
  const daysSincePublished = Math.floor((now - published) / (1000 * 60 * 60 * 24));

  let basePriority;
  if (daysSincePublished <= 7) basePriority = 1.0;
  else if (daysSincePublished <= 30) basePriority = 0.9;
  else if (daysSincePublished <= 180) basePriority = 0.8;
  else basePriority = 0.7;

  // Reduce priority by sitemap index (sitemap-1 > sitemap-2, etc.)
  return Math.max(0.5, basePriority - (sitemapIndex * 0.1));
}

// Calculate changefreq based on article age
function calculateChangefreq(publishedDate) {
  const now = new Date();
  const published = new Date(publishedDate);
  const daysSincePublished = Math.floor((now - published) / (1000 * 60 * 60 * 24));

  if (daysSincePublished <= 30) return 'daily';
  if (daysSincePublished <= 180) return 'weekly';
  return 'monthly';
}

// Custom sitemap configuration
const integrations = [
  mdx(),

  // Main sitemap index configuration
  sitemap({
    customPages: async () => {
      const customPages = [];

      try {
        // Fetch and sort articles (reverse chronological order)
        const articles = await getAllArticles();
        const sortedArticles = articles
          .filter(article => article.slug?.current)
          .sort((a, b) => {
            const dateA = new Date(a.publishedTime || a._createdAt);
            const dateB = new Date(b.publishedTime || b._createdAt);
            return dateB - dateA; // Most recent first
          });

        // Split into chunks of 400 articles
        const ARTICLES_PER_SITEMAP = 400;
        const articleChunks = [];
        for (let i = 0; i < sortedArticles.length; i += ARTICLES_PER_SITEMAP) {
          articleChunks.push(sortedArticles.slice(i, i + ARTICLES_PER_SITEMAP));
        }

        // Generate URLs for each chunk
        articleChunks.forEach((chunk, index) => {
          chunk.forEach(article => {
            const publishedDate = article.publishedTime || article._createdAt;
            const priority = calculatePriority(publishedDate, index);
            const changefreq = calculateChangefreq(publishedDate);
            const lastmod = new Date(article._updatedAt || publishedDate).toISOString();

            customPages.push({
              url: `${SITE.url}/${article.slug.current}`,
              changefreq,
              priority,
              lastmod,
              // Tag to identify target sitemap
              _sitemapGroup: `articles-${index + 1}`
            });
          });
        });

        // Add categories
        const categories = [
          'intelligence-artificielle',
          'cybersecurite',
          'blockchain',
          'programmation',
          'devops',
          'mobile'
        ];

        categories.forEach(category => {
          customPages.push({
            url: `${SITE.url}/categories/${category}`,
            changefreq: 'weekly',
            priority: 0.8,
            lastmod: new Date().toISOString(),
            _sitemapGroup: 'categories'
          });

          // Category pagination (example: max 5 pages)
          for (let page = 2; page <= 5; page++) {
            customPages.push({
              url: `${SITE.url}/categories/${category}/${page}`,
              changefreq: 'weekly',
              priority: 0.6,
              lastmod: new Date().toISOString(),
              _sitemapGroup: 'categories'
            });
          }
        });

        // Static pages
        const staticPages = [
          { path: '/about', priority: 0.6, changefreq: 'monthly' },
          { path: '/contact', priority: 0.6, changefreq: 'monthly' },
          { path: '/search', priority: 0.5, changefreq: 'monthly' },
          { path: '/accessibility', priority: 0.3, changefreq: 'yearly' },
          { path: '/privacy', priority: 0.3, changefreq: 'yearly' },
          { path: '/cookie', priority: 0.3, changefreq: 'yearly' }
        ];

        staticPages.forEach(page => {
          customPages.push({
            url: `${SITE.url}${page.path}`,
            changefreq: page.changefreq,
            priority: page.priority,
            lastmod: '2024-01-01T00:00:00.000Z',
            _sitemapGroup: 'pages'
          });
        });

      } catch (error) {
        console.error('Error generating sitemap:', error);
      }

      return customPages;
    },

    // URL filtering and cleaning
    filter: (page) => {
      const url = page.toLowerCase();
      return !url.includes('/admin/') &&
        !url.includes('/preview/') &&
        !url.includes('/api/') &&
        !url.includes('/_astro/') &&
        !url.includes('/404') &&
        !url.includes('/500');
    },

    // Advanced configuration
    serialize: (item) => {
      // Remove trailing slash except for homepage
      const cleanUrl = item.url.endsWith('/') && item.url !== `${SITE.url}/`
        ? item.url.slice(0, -1)
        : item.url;

      return {
        url: cleanUrl,
        changefreq: item.changefreq || 'weekly',
        priority: item.priority || 0.5,
        lastmod: item.lastmod || new Date().toISOString()
      };
    },

    // Manual head link management
    createLinkInHead: false,

    // Hebrew locale configuration
    i18n: {
      defaultLocale: 'he',
      locales: {
        he: 'he-IL'
      }
    }
  }),

  pagefind(),
  sanity({
    projectId: "0lbfqiht",
    dataset: "production",
    useCdn: true,
  }),
];

if (RUN_KEYSTATIC === "true") {
  integrations.push(react());
  integrations.push(keystatic());
}

// https://astro.build/config
export default defineConfig({
  output: 'server', // ou 'hybrid'
  adapter: vercel(), // 👈 AJOUTEZ CECI
  site: SITE.url,
  base: SITE.basePath,
  trailingSlash: 'never',
  markdown: {
    remarkPlugins: [readingTime, modifiedTime],
  },
  experimental: {
    // responsiveImages: true,
  },
  image: {},
  integrations,
  vite: {
    plugins: [tailwindcss()],
    build: {
      minify: 'esbuild',
    },
  },
});