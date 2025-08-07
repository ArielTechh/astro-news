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

const { RUN_KEYSTATIC } = loadEnv(import.meta.env.MODE, process.cwd(), "");

const integrations = [
  mdx(),
  // SITEMAP OPTIMISÉ - AVEC CACHE
  sitemap({
    changefreq: 'daily',
    priority: 0.7,
    lastmod: new Date(),

    // FILTER OPTIMISÉ
    filter: (page) => {
      const url = page.toLowerCase();
      return !url.includes('/authors/') &&
        !url.includes('/admin/') &&
        !url.includes('/preview/') &&
        !url.includes('/api/') &&
        !url.includes('/_astro/') &&
        !url.includes('/404') &&
        !url.includes('/500') &&
        !url.includes('/articles/');
    },

    // SERIALIZATION OPTIMISÉE AVEC CACHE
    serialize: async (item) => {
      const url = item.url;
      const cleanUrl = url.endsWith('/') && url !== 'https://techhorizons.co.il/'
        ? url.slice(0, -1)
        : url;

      const path = new URL(cleanUrl).pathname;

      // PAGE D'ACCUEIL
      if (cleanUrl === 'https://techhorizons.co.il/') {
        return {
          url: cleanUrl,
          changefreq: 'hourly',
          priority: 1.0,
          lastmod: new Date().toISOString()
        };
      }

      // ARTICLES À LA RACINE avec cache
      if (path !== '/' &&
        !path.includes('/categories/') &&
        !path.includes('/about') &&
        !path.includes('/contact') &&
        !path.includes('/accessibility') &&
        !path.includes('/cookie') &&
        !path.includes('/privacy') &&
        !path.match(/\/\d+$/) &&
        !path.includes('/search') &&
        !path.includes('/rss') &&
        !path.includes('/sitemap')) {

        try {
          const slug = path.replace('/', '');

          // CACHE ARTICLES pour éviter requêtes répétées
          if (!global.articlesCache) {
            global.articlesCache = await getAllArticles();
          }

          const article = global.articlesCache.find(a => a.slug?.current === slug);

          if (article) {
            const articleDate = new Date(
              article._updatedAt ||
              article.publishedTime ||
              article._createdAt ||
              new Date()
            ).toISOString();

            return {
              url: cleanUrl,
              changefreq: 'daily',
              priority: 0.9,
              lastmod: articleDate
            };
          }
        } catch (error) {
          console.error(`Erreur Sanity pour ${path}:`, error);
        }

        return {
          url: cleanUrl,
          changefreq: 'daily',
          priority: 0.9,
          lastmod: new Date().toISOString()
        };
      }

      // CATÉGORIES PRINCIPALES
      if (cleanUrl.includes('/categories/') && !cleanUrl.match(/\/\d+$/)) {
        return {
          url: cleanUrl,
          changefreq: 'daily',
          priority: 0.8,
          lastmod: new Date().toISOString()
        };
      }

      // AUTRES PAGES
      return {
        url: cleanUrl,
        changefreq: 'weekly',
        priority: 0.4,
        lastmod: new Date().toISOString()
      };
    }
  }),

  // PAGEFIND OPTIMISÉ
  pagefind({
    // Configuration pour de meilleures performances
    forceLanguage: "he",
    highlightParam: "highlight"
  }),

  // SANITY OPTIMISÉ
  sanity({
    projectId: "0lbfqiht",
    dataset: "production",
    useCdn: true,
    // NOUVELLES OPTIMISATIONS
    apiVersion: '2024-01-01',
    perspective: 'published',
    stega: false, // Désactiver stega en production pour de meilleures performances
  }),
];

if (RUN_KEYSTATIC === "true") {
  integrations.push(react());
  integrations.push(keystatic());
}

// https://astro.build/config
export default defineConfig({
  site: SITE.url,
  base: SITE.basePath,
  trailingSlash: 'never',

  // 🚀 OPTIMISATIONS BUILD
  build: {
    // Optimisation des assets
    assets: '_astro',
    // Inlining des petits assets
    inlineStylesheets: 'auto',
    // Compression
    split: true,
  },

  // 🚀 OPTIMISATIONS OUTPUT
  output: 'static',
  adapter: undefined, // Assurez-vous qu'aucun adapter n'est configuré pour du static

  // 🚀 OPTIMISATIONS IMAGES
  image: {
    // Configuration pour de meilleures performances
    service: {
      entrypoint: 'astro/assets/services/sharp',
      config: {
        limitInputPixels: 268402689,
      }
    },
    domains: ["cdn.sanity.io"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        pathname: "/images/**",
      }
    ]
  },

  markdown: {
    remarkPlugins: [readingTime, modifiedTime],
    // Optimisation syntaxHighlighter
    shikiConfig: {
      theme: 'github-light',
      langs: ['javascript', 'typescript', 'python', 'bash'],
      wrap: true
    }
  },

  experimental: {
    // Optimisations expérimentales
    contentCollectionCache: true,
  },

  integrations,

  // 🚀 VITE OPTIMISÉ POUR BUILD RAPIDE
  vite: {
    plugins: [tailwindcss()],

    // OPTIMISATIONS BUILD
    build: {
      // Optimisation des chunks
      rollupOptions: {
        output: {
          // Meilleure stratégie de chunking
          manualChunks: {
            'vendor': ['astro'],
            'sanity': ['@sanity/client', '@sanity/image-url'],
            'ui': ['react', 'react-dom']
          }
        }
      },
      // Optimisation CSS
      cssCodeSplit: true,
      // Compression
      minify: 'esbuild',
      // Réduire les warnings
      chunkSizeWarningLimit: 1000
    },

    // OPTIMISATION CSS
    css: {
      postcss: {
        plugins: [
          // Optimisations PostCSS si nécessaire
        ]
      }
    },

    // OPTIMISATIONS DEV (pour tester)
    server: {
      // Améliorer la vitesse de dev
      fs: {
        strict: false
      }
    },

    // CACHE ET OPTIMISATIONS
    optimizeDeps: {
      include: [
        'astro',
        '@sanity/client',
        '@sanity/image-url',
        'react',
        'react-dom'
      ],
      exclude: []
    }
  }
});