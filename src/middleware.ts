// src/middleware.ts - Version modifiée avec gestion 404
import { defineMiddleware } from "astro:middleware";

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
    return 'staticc';
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
  const paginationMatch = pathname.match(/^\/([^\/]+)\/page\/\d+\/?$/);
  if (paginationMatch) {
    const [, categorySlug] = paginationMatch;

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

  // ✅ Redirection /categories/category/1 → /categories/category (supprime la page 1)
  if (pathname.match(/^\/categories\/[^\/]+\/1$/)) {
    // Extraire la catégorie : /categories/apple/1 → /categories/apple
    const categoryPath = pathname.replace(/\/1$/, '');

    return new Response(null, {
      status: 301,
      headers: {
        'Location': categoryPath,
        'Cache-Control': 'public, max-age=31536000', // 1 an de cache
      }
    });
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


  // ✨ GESTION DES 404 AVEC EXCEPTIONS
  if (response.status === 404) {
    // 🚫 NE PAS rediriger si c'est une page tags, categories ou autres pages dynamiques
    const isDynamicPage = pathname.startsWith('/tags/') ||
      pathname.startsWith('/categories/') ||
      pathname.startsWith('/authors/');

    if (isDynamicPage) {
      // Laisser Astro gérer l'erreur 404 normalement pour les pages dynamiques
      const pageType = 'notfound';
      const robotsDirective = robotsConfig[pageType];
      response.headers.set('X-Robots-Tag', robotsDirective);
      return response;
    }

    // Pour toutes les autres 404 (pages inexistantes), rediriger vers l'accueil
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

  if (!response.headers.has('Referrer-Policy')) {
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  }

  return response;
});