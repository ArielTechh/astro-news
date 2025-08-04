// src/middleware.ts
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
    return 'static';
  }

  return 'default';
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

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

  // ✨ REDIRECTIONS 301 : /categories/{category} vers /categories/{category}/1
  if (pathname.match(/^\/categories\/[^\/]+$/) && !pathname.endsWith('/')) {
    // Redirection 301 vers la page 1
    return new Response(null, {
      status: 301,
      headers: {
        'Location': `${pathname}/1`,
        'Cache-Control': 'public, max-age=31536000', // 1 an de cache
      }
    });
  }

  // Traiter la requête
  const response = await next();

  // Déterminer le type de page
  const pageType = getPageType(context.url.pathname);
  const robotsDirective = robotsConfig[pageType];

  // ✨ Ajouter l'en-tête X-Robots-Tag
  response.headers.set('X-Robots-Tag', robotsDirective);

  // ✨ Ajouter d'autres en-têtes SEO utiles
  if (!response.headers.has('X-Content-Type-Options')) {
    response.headers.set('X-Content-Type-Options', 'nosniff');
  }

  if (!response.headers.has('X-Frame-Options')) {
    response.headers.set('X-Frame-Options', 'DENY');
  }

  if (!response.headers.has('Referrer-Policy')) {
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  }

  // ✨ Log pour debug (enlevez en production)
  if (process.env.NODE_ENV === 'development') {
    console.log(`🤖 ${context.url.pathname} → ${pageType} → ${robotsDirective}`);
  }

  return response;
});