// File: src/pages/sitemap-index.xml.js
import { getAllArticles } from '../lib/sanity.js';
import { SITE } from '../lib/config.js';

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

// File: src/pages/sitemap-articles-[page].xml.js
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

// File: src/pages/sitemap-categories.xml.js
import { SITE } from '../lib/config.js';

export async function GET() {
  try {
    const categories = [
      'intelligence-artificielle',
      'cybersecurite',
      'blockchain',
      'programmation',
      'devops',
      'mobile'
    ];

    let urls = [];

    // Main category pages
    categories.forEach(category => {
      urls.push(`
  <url>
    <loc>${SITE.url}/categories/${category}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);

      // Pagination des catégories (jusqu'à 5 pages)
      for (let page = 2; page <= 5; page++) {
        urls.push(`
  <url>
    <loc>${SITE.url}/categories/${category}/${page}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
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
    console.error('Categories sitemap error:', error);
    return new Response('Server error', { status: 500 });
  }
}

// File: src/pages/sitemap-pages.xml.js
import { SITE } from '../lib/config.js';

export async function GET() {
  try {
    const staticPages = [
      { path: '/', priority: 1.0, changefreq: 'hourly', lastmod: new Date().toISOString() },
      { path: '/about', priority: 0.6, changefreq: 'monthly' },
      { path: '/contact', priority: 0.6, changefreq: 'monthly' },
      { path: '/search', priority: 0.5, changefreq: 'monthly' },
      { path: '/accessibility', priority: 0.3, changefreq: 'yearly' },
      { path: '/privacy', priority: 0.3, changefreq: 'yearly' },
      { path: '/cookie', priority: 0.3, changefreq: 'yearly' }
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${staticPages.map(page => {
      const url = page.path === '/' ? SITE.url : `${SITE.url}${page.path}`;
      const lastmod = page.lastmod || '2024-01-01T00:00:00.000Z';

      return `
  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
    }).join('')}
</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=604800', // 7 days
      },
    });
  } catch (error) {
    console.error('Pages sitemap error:', error);
    return new Response('Server error', { status: 500 });
  }
}