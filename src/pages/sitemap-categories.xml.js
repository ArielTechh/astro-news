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

      // Category pagination (up to 5 pages)
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