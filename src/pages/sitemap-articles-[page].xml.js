import { getAllArticles } from '../lib/sanity.js';
import { SITE } from '../lib/config.js';

// Utility functions
function calculatePriority(publishedDate, sitemapIndex = 0) {
  const now = new Date();
  const published = new Date(publishedDate);
  const daysSincePublished = Math.floor((now - published) / (1000 * 60 * 60 * 24));

  let basePriority;
  if (daysSincePublished <= 7) basePriority = 1.0;
  else if (daysSincePublished <= 30) basePriority = 0.9;
  else if (daysSincePublished <= 180) basePriority = 0.8;
  else basePriority = 0.7;

  return Math.max(0.5, basePriority - (sitemapIndex * 0.1));
}

function calculateChangefreq(publishedDate) {
  const now = new Date();
  const published = new Date(publishedDate);
  const daysSincePublished = Math.floor((now - published) / (1000 * 60 * 60 * 24));

  if (daysSincePublished <= 30) return 'daily';
  if (daysSincePublished <= 180) return 'weekly';
  return 'monthly';
}

export async function getStaticPaths() {
  const articles = await getAllArticles();
  const ARTICLES_PER_SITEMAP = 400;
  const numberOfSitemaps = Math.ceil(articles.length / ARTICLES_PER_SITEMAP);

  return Array.from({ length: numberOfSitemaps }, (_, i) => ({
    params: { page: String(i + 1) }
  }));
}

export async function GET({ params }) {
  try {
    const pageNum = parseInt(params.page) - 1;
    const ARTICLES_PER_SITEMAP = 400;

    const articles = await getAllArticles();
    const sortedArticles = articles
      .filter(article => article.slug?.current)
      .sort((a, b) => {
        const dateA = new Date(a.publishedTime || a._createdAt);
        const dateB = new Date(b.publishedTime || b._createdAt);
        return dateB - dateA;
      });

    const startIndex = pageNum * ARTICLES_PER_SITEMAP;
    const endIndex = startIndex + ARTICLES_PER_SITEMAP;
    const pageArticles = sortedArticles.slice(startIndex, endIndex);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${pageArticles.map(article => {
      const publishedDate = article.publishedTime || article._createdAt;
      const priority = calculatePriority(publishedDate, pageNum);
      const changefreq = calculateChangefreq(publishedDate);
      const lastmod = new Date(article._updatedAt || publishedDate).toISOString();
      const url = `${SITE.url}/${article.slug.current}`;

      return `
  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority.toFixed(1)}</priority>
  </url>`;
    }).join('')}
</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error(`Articles sitemap ${params.page} error:`, error);
    return new Response('Server error', { status: 500 });
  }
}