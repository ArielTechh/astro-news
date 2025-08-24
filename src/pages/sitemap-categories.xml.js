import { getAllCategories, getArticlesByCategory } from '../lib/sanity.js';
import { SITE } from '../lib/config/index.ts';

export async function GET() {
  try {
    // Get categories from Sanity
    const categories = await getAllCategories();

    let urls = [];

    // Process each category
    for (const category of categories) {
      if (!category.slug?.current) continue;

      const categorySlug = category.slug.current;
      const lastmod = new Date(category._updatedAt || new Date()).toISOString();

      // Main category page
      urls.push(`
  <url>
    <loc>${SITE.url}/categories/${categorySlug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);

      // ✨ VÉRIFICATION INTELLIGENTE : Récupérer les articles de cette catégorie
      try {
        const categoryArticles = await getArticlesByCategory(categorySlug);
        const totalPages = Math.ceil(categoryArticles.length / SITE.postsPerPage);

        // ✅ GÉNÉRER SEULEMENT LES PAGES QUI EXISTENT
        if (totalPages > 1) {
          for (let page = 2; page <= totalPages; page++) {
            urls.push(`
  <url>
    <loc>${SITE.url}/categories/${categorySlug}/${page}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`);
          }
        }
      } catch (error) {
        console.error(`Error getting articles for category ${categorySlug}:`, error);
        // En cas d'erreur, ne pas générer de pages de pagination
      }
    }

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