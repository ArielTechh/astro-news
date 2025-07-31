// src/integrations/custom-sitemap.ts
// Plugin personnalisé pour créer des sitemaps nommés par type

import fs from 'fs';
import path from 'path';

export function customSitemap() {
  return {
    name: 'custom-sitemap',
    hooks: {
      'astro:build:done': async ({ dir, pages }) => {
        console.log('🗺️  Génération des sitemaps personnalisés...');

        const SITE_URL = 'https://techhorizons.co.il';
        const distPath = dir.pathname;

        // Collecter toutes les pages par type
        const staticPages = [];
        const categoryPages = [];
        const articlePages = [];

        for (const page of pages) {
          const url = new URL(page.pathname, SITE_URL).href;
          const cleanUrl = url.endsWith('/') && url !== `${SITE_URL}/`
            ? url.slice(0, -1)
            : url;

          const pathname = page.pathname;

          // Filtrer les pages indésirables
          if (pathname.includes('/admin/') ||
            pathname.includes('/api/') ||
            pathname.includes('/_astro/') ||
            pathname.includes('/404') ||
            pathname.includes('/500') ||
            pathname.includes('/articles/')) {
            continue;
          }

          // Classer par type
          if (pathname === '/' ||
            pathname.includes('/about') ||
            pathname.includes('/contact') ||
            pathname.includes('/accessibility') ||
            pathname.includes('/cookie') ||
            pathname.includes('/privacy') ||
            pathname.includes('/search')) {

            staticPages.push({
              url: cleanUrl,
              lastmod: new Date().toISOString(),
              changefreq: pathname === '/' ? 'hourly' : 'monthly',
              priority: pathname === '/' ? '1.0' : '0.3'
            });

          } else if (pathname.includes('/categories/')) {

            categoryPages.push({
              url: cleanUrl,
              lastmod: new Date().toISOString(),
              changefreq: 'daily',
              priority: pathname.match(/\/\d+$/) ? '0.6' : '0.8'
            });

          } else if (pathname !== '/' &&
            !pathname.includes('/categories/') &&
            !pathname.match(/\/\d+$/)) {

            articlePages.push({
              url: cleanUrl,
              lastmod: new Date().toISOString(),
              changefreq: 'daily',
              priority: '0.9'
            });
          }
        }

        // Fonction pour créer un sitemap XML
        function createSitemapXML(urls) {
          const urlsXML = urls.map(urlData => `
  <url>
    <loc>${urlData.url}</loc>
    <lastmod>${urlData.lastmod}</lastmod>
    <changefreq>${urlData.changefreq}</changefreq>
    <priority>${urlData.priority}</priority>
  </url>`).join('');

          return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXML}
</urlset>`;
        }

        const sitemapFiles = [];

        // 1. Créer sitemap-static.xml
        if (staticPages.length > 0) {
          const staticXML = createSitemapXML(staticPages);
          fs.writeFileSync(path.join(distPath, 'sitemap-static.xml'), staticXML);
          sitemapFiles.push('sitemap-static.xml');
          console.log(`✅ sitemap-static.xml créé avec ${staticPages.length} pages`);
        }

        // 2. Créer sitemap-categories.xml
        if (categoryPages.length > 0) {
          const categoriesXML = createSitemapXML(categoryPages);
          fs.writeFileSync(path.join(distPath, 'sitemap-categories.xml'), categoriesXML);
          sitemapFiles.push('sitemap-categories.xml');
          console.log(`✅ sitemap-categories.xml créé avec ${categoryPages.length} catégories`);
        }

        // 3. Créer sitemap-articles-X.xml (par groupes de 300)
        const articlesPerSitemap = 300;
        for (let i = 0; i < articlePages.length; i += articlesPerSitemap) {
          const chunk = articlePages.slice(i, i + articlesPerSitemap);
          const sitemapNumber = Math.floor(i / articlesPerSitemap) + 1;
          const filename = `sitemap-articles-${sitemapNumber}.xml`;

          const articlesXML = createSitemapXML(chunk);
          fs.writeFileSync(path.join(distPath, filename), articlesXML);
          sitemapFiles.push(filename);
          console.log(`✅ ${filename} créé avec ${chunk.length} articles`);
        }

        // 4. Créer sitemap-index.xml
        const sitemapsXML = sitemapFiles.map(filename => `
  <sitemap>
    <loc>${SITE_URL}/${filename}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>`).join('');

        const indexXML = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapsXML}
</sitemapindex>`;

        fs.writeFileSync(path.join(distPath, 'sitemap-index.xml'), indexXML);
        sitemapFiles.push('sitemap-index.xml');

        console.log(`🎉 sitemap-index.xml créé avec ${sitemapFiles.length - 1} sitemaps`);
        console.log(`📊 Total: ${staticPages.length} pages statiques, ${categoryPages.length} catégories, ${articlePages.length} articles`);
      }
    }
  };
}