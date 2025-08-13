// src/middleware.ts - Version optimisée
import { defineMiddleware } from "astro:middleware";

// ✨ Configuration des directives robots par type de page
const robotsConfig = {
  articles: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
  homepage: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
  categories: "index, follow, max-image-preview:standard, max-snippet:300",
  static: "index, follow, max-image-preview:standard, max-snippet:200",
  pagination: "index, follow, max-image-preview:none, max-snippet:150",
  private: "noindex, nofollow",
  notfound: "noindex, nofollow",
  default: "index, follow, max-image-preview:standard"
};

// ✨ Liste des catégories (beaucoup plus propre qu'une répétition)
const categories = [
  'technology', 'apple', 'gaming', 'smartphones', 'mobile',
  'news', 'streaming', 'netflix', 'amazon-prime-video',
  'playstation-5', 'nintendo-switch', 'computers', 'ia',
  'google', 'honor', 'audio', 'cinema', 'apps', 'crunchyroll',
  'hbo-max', 'desktop-game', 'buying-guide', 'productivity',
  'health', 'wellness', 'test', 'finance', 'apple-tv'
];

// ✨ Fonction pour créer une redirection 301
function redirect301(location: string) {
  return new Response(null, {
    status: 301,
    headers: {
      'Location': location,
      'Cache-Control': 'public, max-age=31536000',
    }
  });
}

// ✨ Fonction pour déterminer le type de page
function getPageType(pathname: string): keyof typeof robotsConfig {
  if (pathname === '/') return 'homepage';
  if (pathname.includes('/categories/')) {
    return pathname.match(/\/\d+$/) ? 'pagination' : 'categories';
  }
  if (pathname.match(/\/\d+$/)) return 'pagination';
  if (pathname.includes('/admin') || pathname.includes('/api') || pathname.includes('/preview') || pathname.includes('/_astro')) {
    return 'private';
  }
  if (pathname.includes('/about') || pathname.includes('/contact') || pathname.includes('/accessibility') ||
    pathname.includes('/cookie') || pathname.includes('/privacy') || pathname.includes('/search')) {
    return 'static';
  }
  return 'articles';
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // 🚀 REDIRECTIONS (dans l'ordre de priorité)

  // 1. Pages /page/* → accueil
  if (pathname.startsWith('/page/')) {
    return redirect301('/');
  }

  // 2. Suppression des /feed
  if (pathname.endsWith('/feed') || pathname.endsWith('/feed/')) {
    const cleanPath = pathname.replace(/\/feed\/?$/, '');
    return redirect301(cleanPath);
  }

  // 3. Catégories : /category/* → /categories/category
  for (const category of categories) {
    const categoryRegex = new RegExp(`^\\/${category}(?:\\/.*)?$`);
    if (categoryRegex.test(pathname)) {
      return redirect301(`/categories/${category}`);
    }
  }

  // 4. Suppression page 1 des catégories : /categories/category/1 → /categories/category
  if (pathname.match(/^\/categories\/[^\/]+\/1$/)) {
    const categoryPath = pathname.replace(/\/1$/, '');
    return redirect301(categoryPath);
  }

  // 5. Articles /articles/* → /*
  if (pathname.startsWith('/articles/') && pathname !== '/articles/') {
    const slug = pathname.replace('/articles/', '');
    return redirect301(`/${slug}`);
  }

  // Traiter la requête normale
  const response = await next();

  // Gestion des 404 → redirection vers accueil
  if (response.status === 404) {
    return redirect301('/');
  }

  // Ajouter les headers SEO
  const pageType = getPageType(pathname);
  const robotsDirective = robotsConfig[pageType];
  response.headers.set('X-Robots-Tag', robotsDirective);

  if (!response.headers.has('Referrer-Policy')) {
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  }

  return response;
});