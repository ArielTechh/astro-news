import { getAllArticles } from '../lib/sanity.js';
import { SITE } from '../lib/config/index.ts';

export async function GET() {
  try {
    const articles = await getAllArticles();
    const ARTICLES_PER_SITEMAP = 400;
    const totalArticles = articles.length;
    const numberOfArticleSitemaps = Math.ceil(totalArticles / ARTICLES_PER_SITEMAP);

    // Calculate last modified date from latest article
    const latestArticle = articles
      .sort((a, b) => new Date(b._updatedAt || b.publishedTime) - new Date(a._updatedAt || a.publishedTime))[0];
    const lastmod = latestArticle
      ? new Date(latestArticle._updatedAt || latestArticle.publishedTime).toISOString()
      : new Date().toISOString();

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${Array.from({ length: numberOfArticleSitemaps }, (_, i) => `
  <sitemap>
    <loc>${SITE.url}/sitemap-articles-${i + 1}.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`).join('')}
  
  <sitemap>
    <loc>${SITE.url}/sitemap-categories.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>
  
  <sitemap>
    <loc>${SITE.url}/sitemap-pages.xml</loc>
    <lastmod>2024-01-01T00:00:00.000Z</lastmod>
  </sitemap>

  <sitemap>
  <loc>${SITE.url}/sitemap-tags.xml</loc>
  <lastmod>${new Date().toISOString()}</lastmod>
</sitemap>

</sitemapindex>`;

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600', // 1 hour
      },
    });
  } catch (error) {
    console.error('Sitemap index error:', error);
    return new Response('Server error', { status: 500 });
  }
}