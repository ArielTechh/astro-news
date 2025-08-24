// src/middleware.ts - Version avec vérification intelligente pagination
import { defineMiddleware } from "astro:middleware";
import { getAllCategories, getArticlesByCategory } from "@/lib/sanity";
import { SITE } from "@/lib/config";

// Cache pour éviter de refaire les requêtes Sanity à chaque fois
const categoryCache = new Map<string, { totalPages: number; exists: boolean }>();

// ✨ Configuration des directives robots par type de page
const robotsConfig = {
  // Articles : optimisation maximale pour le SEO
  articles: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",

  // Page d'accueil : priorité haute
  homepage: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",

  // Catégories : bonnes pour l'indexation
  categories: "index, follow, max-image-preview:standard, max-snippet:300",

  // Pages statiques : indexation basique
  static: "index, follow, max-image-preview:standard, max-snippet:200",

  // Pagination : indexation réduite
  pagination: "index, follow, max-image-preview:none, max-snippet:150",

  // Admin et privé : pas d'indexation
  private: "noindex, nofollow",

  // 404 : pas d'indexation
  notfound: "noindex, nofollow",

  // Défaut : sécurisé
  default: "index, follow, max-image-preview:standard"
};

// ✨ Fonction pour vérifier si une page de catégorie existe
async function checkCategoryPageExists(categorySlug: string, pageNum: number): Promise<{ exists: boolean; totalPages: number; shouldRedirect: boolean; redirectTo: string | null }> {
  const cacheKey = `${categorySlug}-info`;

  // Vérifier le cache d'abord
  let categoryInfo = categoryCache.get(cacheKey);

  if (!categoryInfo) {
    try {
      // Récupérer les infos de la catégorie depuis Sanity
      const articles = await getArticlesByCategory(categorySlug);
      const totalPages = Math.ceil(articles.length / SITE.postsPerPage);

      categoryInfo = {
        totalPages,
        exists: articles.length > 0
      };

      // Mettre en cache pour 5 minutes
      categoryCache.set(cacheKey, categoryInfo);

      // Nettoyer le cache après 5 minutes
      setTimeout(() => {
        categoryCache.delete(cacheKey);
      }, 5 * 60 * 1000);

    } catch (error) {
      console.error(`Erreur lors de la vérification de la catégorie ${categorySlug}:`, error);

      // En cas d'erreur, on assume que la catégorie n'existe pas
      categoryInfo = { totalPages: 0, exists: false };
    }
  }

  // Si la catégorie n'existe pas du tout
  if (!categoryInfo.exists) {
    return {
      exists: false,
      totalPages: 0,
      shouldRedirect: true,
      redirectTo: '/'
    };
  }

  // Si c'est la page 1, elle existe toujours (tant que la catégorie existe)
  if (pageNum === 1) {
    return {
      exists: true,
      totalPages: categoryInfo.totalPages,
      shouldRedirect: true, // Rediriger /categories/cat/1 vers /categories/cat
      redirectTo: `/categories/${categorySlug}`
    };
  }

  // Pour les pages > 1, vérifier si la page existe
  if (pageNum > categoryInfo.totalPages) {
    return {
      exists: false,
      totalPages: categoryInfo.totalPages,
      shouldRedirect: true,
      redirectTo: categoryInfo.totalPages > 1 ? `/categories/${categorySlug}/${categoryInfo.totalPages}` : `/categories/${categorySlug}`
    };
  }

  // La page existe et est valide
  return {
    exists: true,
    totalPages: categoryInfo.totalPages,
    shouldRedirect: false,
    redirectTo: null
  };
}

// ✨ Fonction pour déterminer le type de page
function getPageType(pathname: string): keyof typeof robotsConfig {
  // Page d'accueil
  if (pathname === '/') {
    return 'homepage';
  }

  // Articles (à la racine, pas dans /articles/)
  if (pathname !== '/' &&
    !pathname.includes('/categories/') &&
    !pathname.includes('/about') &&
    !pathname.includes('/contact') &&
    !pathname.includes('/accessibility') &&
    !pathname.includes('/cookie') &&
    !pathname.includes('/privacy') &&
    !pathname.includes('/search') &&
    !pathname.match(/\/\d+$/) &&
    !pathname.includes('/admin') &&
    !pathname.includes('/api') &&
    !pathname.includes('/_')) {
    return 'articles';
  }

  // Catégories
  if (pathname.includes('/categories/')) {
    return pathname.match(/\/\d+$/) ? 'pagination' : 'categories';
  }

  // Pagination générale
  if (pathname.match(/\/\d+$/)) {
    return 'pagination';
  }

  // Pages privées/admin
  if (pathname.includes('/admin') ||
    pathname.includes('/api') ||
    pathname.includes('/preview') ||
    pathname.includes('/_astro')) {
    return 'private';
  }

  // Pages statiques
  if (pathname.includes('/about') ||
    pathname.includes('/contact') ||
    pathname.includes('/accessibility') ||
    pathname.includes('/cookie') ||
    pathname.includes('/privacy') ||
    pathname.includes('/search')) {
    return 'static';
  }

  return 'default';
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // ✅ Liste des catégories à rediriger
  const categoryRedirects = [
    'technology', 'apple', 'gaming', 'smartphones', 'mobile',
    'news', 'streaming', 'netflix', 'amazon-prime-video',
    'playstation-5', 'nintendo-switch', 'computers', 'ia',
    'google', 'honor', 'audio', 'cinema', 'apps', 'crunchyroll',
    'hbo-max', 'desktop-game', 'buying-guide', 'productivity',
    'health', 'wellness', 'test', 'finance', 'apple-tv'
  ];

  // 🆕 VÉRIFICATION INTELLIGENTE DES PAGES DE PAGINATION
  // Pattern : /categories/category/page (où page est un nombre)
  const paginationMatch = pathname.match(/^\/categories\/([^\/]+)\/(\d+)$/);
  if (paginationMatch) {
    const [, categorySlug, pageNum] = paginationMatch;
    const pageNumber = parseInt(pageNum);

    try {
      const checkResult = await checkCategoryPageExists(categorySlug, pageNumber);

      if (checkResult.shouldRedirect && checkResult.redirectTo) {
        return new Response(null, {
          status: 301,
          headers: {
            'Location': checkResult.redirectTo,
            'Cache-Control': 'public, max-age=3600', // Cache 1h pour pagination
          }
        });
      }
    } catch (error) {
      console.error('Erreur lors de la vérification de pagination:', error);
      // En cas d'erreur, laisser Astro gérer normalement
    }
  }

  // ✨ NOUVELLES REDIRECTIONS : /category/* → /categories/category
  // Gère tous les cas : /streaming, /streaming/, /streaming/page/1, /streaming/anything
  for (const category of categoryRedirects) {
    // Pattern pour détecter /category ou /category/* (avec ou sans slash final)
    const categoryPattern = new RegExp(`^\\/${category}(?:\\/.*)?$`);

    if (categoryPattern.test(pathname)) {
      return new Response(null, {
        status: 301,
        headers: {
          'Location': `/categories/${category}`,
          'Cache-Control': 'public, max-age=31536000', // 1 an de cache
        }
      });
    }
  }

  // ✅ Redirection catégories avec pagination : /category/page/N/ → /categories/category (page 1)
  const oldPaginationMatch = pathname.match(/^\/([^\/]+)\/page\/\d+\/?$/);
  if (oldPaginationMatch) {
    const [, categorySlug] = oldPaginationMatch;

    if (categoryRedirects.includes(categorySlug)) {
      return new Response(null, {
        status: 301,
        headers: {
          'Location': `/categories/${categorySlug}`,
          'Cache-Control': 'public, max-age=31536000',
        }
      });
    }
  }

  // ✨ REDIRECTIONS 301 : /page/* vers l'accueil
  if (pathname.startsWith('/page/')) {
    return new Response(null, {
      status: 301,
      headers: {
        'Location': '/',
        'Cache-Control': 'public, max-age=31536000', // 1 an de cache
      }
    });
  }

  // ✨ REDIRECTIONS 301 : Suppression des /feed/ des articles
  if (pathname.endsWith('/feed/') || pathname.endsWith('/feed')) {
    // Supprimer /feed ou /feed/ de la fin
    const cleanPath = pathname.replace(/\/feed\/?$/, '');

    return new Response(null, {
      status: 301,
      headers: {
        'Location': cleanPath,
        'Cache-Control': 'public, max-age=31536000', // 1 an de cache
      }
    });
  }

  // ✨ REDIRECTIONS 301 : /articles/* vers /*
  if (pathname.startsWith('/articles/') && pathname !== '/articles/') {
    // Extraire le slug après /articles/
    const slug = pathname.replace('/articles/', '');

    // Redirection 301 vers la racine
    return new Response(null, {
      status: 301,
      headers: {
        'Location': `/${slug}`,
        'Cache-Control': 'public, max-age=31536000', // 1 an de cache
      }
    });
  }

  // Traiter la requête
  const response = await next();

  // ✨ GESTION DES 404 SIMPLIFIÉE
  if (response.status === 404) {
    // 🚫 NE PAS rediriger si c'est une page tags ou authors
    const isDynamicPage = pathname.startsWith('/tags/') ||
      pathname.startsWith('/authors/');

    if (isDynamicPage) {
      // Laisser Astro gérer l'erreur 404 normalement pour les pages dynamiques
      const pageType = 'notfound';
      const robotsDirective = robotsConfig[pageType];
      response.headers.set('X-Robots-Tag', robotsDirective);
      return response;
    }

    // Pour toutes les autres 404 (y compris les catégories inexistantes), rediriger vers l'accueil
    return new Response(null, {
      status: 301,
      headers: {
        'Location': '/',
        'Cache-Control': 'no-cache',
      }
    });
  }

  // Déterminer le type de page pour les réponses valides
  const pageType = getPageType(context.url.pathname);
  const robotsDirective = robotsConfig[pageType];

  // Appliquer les directives robots
  response.headers.set('X-Robots-Tag', robotsDirective);

  if (!response.headers.has('Referrer-Policy')) {
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  }

  return response;
});