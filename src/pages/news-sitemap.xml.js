// src/pages/news-sitemap.xml.js
import { getAllArticles } from '../lib/sanity.js';
import { SITE } from '../lib/config/index.ts';

// Fonction utilitaire pour échapper les caractères XML
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// Fonction pour extraire les mots-clés à partir des tags et catégories
function extractKeywords(article) {
  const keywords = [];

  // Ajouter les tags si disponibles
  if (article.tags && Array.isArray(article.tags)) {
    keywords.push(...article.tags);
  }

  // Ajouter les catégories si disponibles
  if (article.categories && Array.isArray(article.categories)) {
    article.categories.forEach(category => {
      if (category.title) {
        keywords.push(category.title);
      }
      // Ajouter aussi la catégorie parent si elle existe
      if (category.parent?.title) {
        keywords.push(category.parent.title);
      }
    });
  }

  // Ajouter le mot-clé unique de linking s'il existe
  if (article.uniqueLinkingKeyword) {
    keywords.push(article.uniqueLinkingKeyword);
  }

  // ✅ NOUVEAU: Ajouter des mots-clés génériques tech
  keywords.push('technologie', 'high-tech', 'innovation');

  // Retourner les mots-clés uniques, limités à 10 max
  return [...new Set(keywords)].slice(0, 10).join(', ');
}

// Fonction pour déterminer si un article est "actualités"
function isNewsArticle(article) {
  // Vérifier si l'article n'est pas un brouillon
  if (article.isDraft) return false;

  // ✅ MODIFIÉ: Articles publiés dans les dernières 2 jours (Google News requirement)
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2); // Plus précis que setHours
  const publishedDate = new Date(article.publishedTime || article._createdAt);

  // ✅ NOUVEAU: Être moins strict sur la date pour debug
  if (publishedDate < twoDaysAgo) {
    console.log(`Article ${article.title} trop ancien: ${publishedDate} < ${twoDaysAgo}`);
    return false;
  }

  // Exclure certaines catégories qui ne sont pas de l'actualité
  const nonNewsCategories = [
    'tutoriel', 'guide', 'review', 'test', 'comparatif',
    'how-to', 'tips', 'astuce', 'conseil', 'manuel'
  ];

  if (article.categories && Array.isArray(article.categories)) {
    const hasNonNewsCategory = article.categories.some(category =>
      nonNewsCategories.some(nonNews =>
        category.slug?.current?.toLowerCase().includes(nonNews) ||
        category.title?.toLowerCase().includes(nonNews)
      )
    );
    if (hasNonNewsCategory) {
      console.log(`Article ${article.title} exclu: catégorie non-news`);
      return false;
    }
  }

  // ✅ NOUVEAU: Vérifier que l'article a un titre et une description
  if (!article.title || article.title.trim().length < 10) {
    console.log(`Article exclu: titre trop court`);
    return false;
  }

  return true;
}

export async function GET() {
  try {
    console.log('🗞️ Génération du Google News sitemap...');

    // Récupérer tous les articles
    const allArticles = await getAllArticles();
    console.log(`📄 ${allArticles.length} articles récupérés`);

    // Filtrer pour ne garder que les articles "actualités" récents
    const newsArticles = allArticles
      .filter(article => {
        const isValid = article.slug?.current && isNewsArticle(article);
        if (!isValid && article.slug?.current) {
          console.log(`❌ Article "${article.title}" exclu`);
        }
        return isValid;
      })
      .sort((a, b) => {
        const dateA = new Date(a.publishedTime || a._createdAt);
        const dateB = new Date(b.publishedTime || b._createdAt);
        return dateB - dateA; // Plus récent en premier
      })
      .slice(0, 1000); // Limiter à 1000 articles max pour Google News

    console.log(`📰 ${newsArticles.length} articles d'actualité trouvés`);

    // Si aucun article récent, retourner un sitemap vide valide
    if (newsArticles.length === 0) {
      console.log('⚠️ Aucun article récent trouvé, sitemap vide généré');

      const emptySitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <!-- Aucun article récent trouvé -->
</urlset>`;

      return new Response(emptySitemap, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=1800', // 30 minutes
        },
      });
    }

    // Générer le XML du sitemap
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${newsArticles.map(article => {
      const publishedDate = article.publishedTime || article._createdAt;
      const formattedDate = new Date(publishedDate).toISOString();
      const articleUrl = `${SITE.url}/${article.slug.current}`;
      const keywords = extractKeywords(article);

      // ✅ NOUVEAU: Log pour debug
      console.log(`✅ Ajout: ${article.title} (${formattedDate})`);

      return `  <url>
    <loc>${escapeXml(articleUrl)}</loc>
    <news:news>
      <news:publication>
        <news:name>TechHorizons</news:name>
        <news:language>he</news:language>
      </news:publication>
      <news:publication_date>${formattedDate}</news:publication_date>
      <news:title>${escapeXml(article.title)}</news:title>${keywords ? `
      <news:keywords>${escapeXml(keywords)}</news:keywords>` : ''}
    </news:news>
  </url>`;
    }).join('\n')}
</urlset>`;

    console.log(`✅ Google News sitemap généré avec ${newsArticles.length} articles`);

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=1800', // 30 minutes - plus court pour les news
        // ✅ NOUVEAU: Headers additionnels
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex', // Le sitemap lui-même ne doit pas être indexé
      },
    });

  } catch (error) {
    console.error('❌ Google News sitemap error:', error);

    // Retourner un sitemap vide en cas d'erreur pour éviter les erreurs 500
    const errorSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <!-- Erreur lors de la génération: ${error.message} -->
</urlset>`;

    return new Response(errorSitemap, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
      },
    });
  }
}