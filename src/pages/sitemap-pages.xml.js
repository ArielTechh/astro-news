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