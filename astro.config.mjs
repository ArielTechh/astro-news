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
import { customSitemap } from './src/integrations/custom-sitemap.ts'; // ✅ AJOUT

const { RUN_KEYSTATIC } = loadEnv(import.meta.env.MODE, process.cwd(), "");

const integrations = [
  mdx(),
  customSitemap(),
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