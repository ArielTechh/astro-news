// src/pages/sitemap-tags.xml.js
import { getAllTags } from '../lib/sanity.js';
import { SITE } from '../lib/config/index.ts';

export async function GET() {
  try {
    // Get tags from Sanity
    const tags = await getAllTags();

    let urls = [];

    // Main tag pages
    tags.forEach(tag => {
      if (!tag.url || tag.count === 0) return;

      const tagSlug = tag.url;
      const lastmod = new Date().toISOString(); // Tags don't have updatedAt, use current date

      // Priority based on number of articles
      let priority = 0.6;
      if (tag.count >= 10) priority = 0.8;
      else if (tag.count >= 5) priority = 0.7;

      urls.push(`
  <url>
    <loc>${SITE.url}/tags/${tagSlug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`);

      // Tag pagination (only if more than 10 articles per page)
      const articlesPerPage = 10; // Ajustez selon votre config
      const totalPages = Math.ceil(tag.count / articlesPerPage);

      for (let page = 2; page <= Math.min(totalPages, 5); page++) {
        urls.push(`
  <url>
    <loc>${SITE.url}/tags/${tagSlug}/${page}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${Math.max(0.4, priority - 0.2)}</priority>
  </url>`);
      }
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls.join('')}
</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=86400', // 24 hours
      },
    });
  } catch (error) {
    console.error('Tags sitemap error:', error);
    return new Response('Server error', { status: 500 });
  }
}