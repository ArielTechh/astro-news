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
  // SITEMAP OPTIMISÉ - EXCLURE /articles/ ET GARDER SEULEMENT LA RACINE
  sitemap({
    // Configuration de base
    changefreq: 'daily',
    priority: 0.7,
    lastmod: new Date(),

    // FILTER : Exclure les anciennes URLs /articles/ du sitemap
    filter: (page) => {
      const url = page.toLowerCase();
      return !url.includes('/authors/') &&
        !url.includes('/admin/') &&
        !url.includes('/preview/') &&
        !url.includes('/api/') &&
        !url.includes('/_astro/') &&
        !url.includes('/404') &&
        !url.includes('/500') &&
        !url.includes('/articles/');  // ← EXCLURE /articles/ du sitemap
    },

    // Personnalisation par type de page - SEULEMENT STRUCTURE RACINE
    serialize(item) {
      const url = item.url;

      // ✅ AJOUT : Enlever le slash final pour TOUT sauf l'accueil
      const cleanUrl = url.endsWith('/') && url !== 'https://techhorizons.co.il/'
        ? url.slice(0, -1)
        : url;

      const path = new URL(cleanUrl).pathname;

      // PAGE D'ACCUEIL - Priorité maximale (garde le slash)
      if (cleanUrl === 'https://techhorizons.co.il/') {
        return {
          url: cleanUrl, // ✅ CHANGÉ : cleanUrl au lieu de url
          changefreq: 'hourly',
          priority: 1.0,
          lastmod: new Date().toISOString()
        };
      }

      // ARTICLES À LA RACINE - Très haute priorité
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

        return {
          url: cleanUrl, // ✅ CHANGÉ : cleanUrl au lieu de url
          changefreq: 'daily',
          priority: 0.9,
          lastmod: new Date().toISOString()
        };
      }

      // CATÉGORIES PRINCIPALES - Haute priorité
      if (cleanUrl.includes('/categories/') && !cleanUrl.match(/\/\d+$/)) {
        return {
          url: cleanUrl, // ✅ CHANGÉ : cleanUrl au lieu de url
          changefreq: 'daily',
          priority: 0.8,
          lastmod: new Date().toISOString()
        };
      }

      // PAGINATION DES CATÉGORIES
      if (cleanUrl.includes('/categories/') && cleanUrl.match(/\/\d+$/)) {
        return {
          url: cleanUrl, // ✅ CHANGÉ : cleanUrl au lieu de url
          changefreq: 'daily',
          priority: 0.6,
          lastmod: new Date().toISOString()
        };
      }

      // PAGINATION ARTICLES À LA RACINE
      if (cleanUrl.match(/\/\d+$/) && !cleanUrl.includes('/categories/')) {
        return {
          url: cleanUrl, // ✅ CHANGÉ : cleanUrl au lieu de url
          changefreq: 'daily',
          priority: 0.5,
          lastmod: new Date().toISOString()
        };
      }

      // PAGES STATIQUES
      if (cleanUrl.includes('/about') || cleanUrl.includes('/contact') ||
        cleanUrl.includes('/accessibility') || cleanUrl.includes('/cookie') ||
        cleanUrl.includes('/privacy') || cleanUrl.includes('/search')) {
        return {
          url: cleanUrl, // ✅ CHANGÉ : cleanUrl au lieu de url
          changefreq: 'monthly',
          priority: 0.3,
          lastmod: new Date().toISOString()
        };
      }

      // AUTRES PAGES
      return {
        url: cleanUrl, // ✅ CHANGÉ : cleanUrl au lieu de url
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
    useCdn: true,
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