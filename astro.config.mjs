// @ts-check
import { defineConfig } from "astro/config";
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
  // SITEMAP OPTIMISÉ POUR SITE DE NEWS TECH ISRAÉLIEN - NOUVELLE STRUCTURE
  sitemap({
    // Configuration de base
    changefreq: 'daily',
    priority: 0.7,
    lastmod: new Date(),

    // Exclure les pages inutiles pour le SEO
    filter: (page) => {
      const url = page.toLowerCase();
      return !url.includes('/authors/') &&        // Pas d'auteurs pour le moment
        !url.includes('/admin/') &&          // Pas d'admin
        !url.includes('/preview/') &&        // Pas de preview
        !url.includes('/api/') &&            // Pas d'API
        !url.includes('/_astro/') &&         // Pas d'assets Astro
        !url.includes('/404') &&             // Pas de 404
        !url.includes('/500');               // Pas d'erreurs
    },

    // Personnalisation par type de page - ADAPTÉE POUR ARTICLES À LA RACINE
    serialize(item) {
      const url = item.url;
      const path = new URL(url).pathname;

      // PAGE D'ACCUEIL - Priorité maximale, mise à jour très fréquente
      if (url === 'https://techhorizons.co.il/' || url.endsWith('/')) {
        return {
          url: url,
          changefreq: 'hourly',    // News site = màj fréquentes
          priority: 1.0,           // Priorité max
          lastmod: new Date().toISOString()
        };
      }

      // ARTICLES À LA RACINE - Très haute priorité (nouvelle structure /nom-article)
      // Détection par exclusion des pages spéciales
      if (path !== '/' &&
        !path.includes('/categories/') &&
        !path.includes('/about') &&
        !path.includes('/contact') &&
        !path.includes('/accessibility') &&
        !path.includes('/cookie') &&
        !path.includes('/privacy') &&
        !path.match(/\/\d+$/) &&  // Pas de pagination
        !path.includes('/search') &&
        !path.includes('/rss') &&
        !path.includes('/sitemap')) {
        return {
          url: url,
          changefreq: 'daily',     // Articles peuvent être mis à jour
          priority: 0.9,           // Très haute priorité pour les articles
          lastmod: new Date().toISOString()
        };
      }

      // CATÉGORIES PRINCIPALES - Haute priorité
      if (url.includes('/categories/') && !url.match(/\/\d+$/)) {
        return {
          url: url,
          changefreq: 'daily',     // Nouvelles news dans catégories
          priority: 0.8,           // Haute priorité
          lastmod: new Date().toISOString()
        };
      }

      // PAGINATION DES CATÉGORIES (/categories/gaming/2)
      if (url.includes('/categories/') && url.match(/\/\d+$/)) {
        return {
          url: url,
          changefreq: 'daily',
          priority: 0.6,           // Priorité moyenne-haute
          lastmod: new Date().toISOString()
        };
      }

      // PAGINATION ARTICLES À LA RACINE (/2, /3, etc.)
      if (url.match(/\/\d+$/) && !url.includes('/categories/')) {
        return {
          url: url,
          changefreq: 'daily',
          priority: 0.5,           // Priorité moyenne
          lastmod: new Date().toISOString()
        };
      }

      // PAGES STATIQUES (about, contact, etc.)
      if (url.includes('/about') || url.includes('/contact') ||
        url.includes('/accessibility') || url.includes('/cookie') ||
        url.includes('/privacy') || url.includes('/search')) {
        return {
          url: url,
          changefreq: 'monthly',   // Changent rarement
          priority: 0.3,           // Priorité basse
          lastmod: new Date().toISOString()
        };
      }

      // AUTRES PAGES - Configuration par défaut
      return {
        url: url,
        changefreq: 'weekly',
        priority: 0.4,
        lastmod: new Date().toISOString()
      };
    }
  }),
  pagefind(),
  sanity({
    projectId: "0lbfqiht",
    dataset: "production",
    useCdn: false,
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
  },
});