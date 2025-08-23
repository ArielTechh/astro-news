// src/lib/sanity.js
import { createClient } from '@sanity/client'
import imageUrlBuilder from '@sanity/image-url'

export const sanityClient = createClient({
  projectId: '0lbfqiht', // Votre vrai project ID
  dataset: 'production',
  useCdn: true, // true pour la production
  apiVersion: '2023-05-03',
  perspective: 'published',
  stega: false
})

// Helper pour les URLs d'images
const builder = imageUrlBuilder(sanityClient)
export const urlFor = (source) => builder.image(source)

// === FONCTIONS POUR RÉCUPÉRER LES DONNÉES ===



// Ajoutez ces fonctions dans votre sanity.js

// Récupérer la configuration des sub-headlines
export async function getSubHeadlinesConfig() {
  return await sanityClient.fetch(`
    *[_type == "subHeadlines"][0] {
      title,
      isActive,
      maxArticles,
      displayMode,
      manualArticles[]-> {
        _id,
        title,
        description,
        slug,
        cover,
        publishedTime,
        categories[]-> {
          title,
          slug
        }
      },
      "excludeArticleIds": excludeArticles[]->_id,
      categoryFilter-> {
        _id,
        slug
      },
      sortOrder,
      showImages,
      showCategories,
      showDates,
      customCSS
    }
  `)
}

// Récupérer les articles pour sub-headlines basé sur la config
export async function getSubHeadlinesArticles() {
  const config = await getSubHeadlinesConfig()

  // Si désactivé, retourner vide
  if (!config || !config.isActive) {
    return []
  }

  // Mode manuel
  if (config.displayMode === 'manual') {
    return config.manualArticles?.slice(0, config.maxArticles) || []
  }

  // Mode automatique
  let query = `*[_type == "article" && !isDraft && defined(publishedTime) && defined(slug.current)`

  // Exclure les articles spécifiés
  if (config.excludeArticleIds?.length > 0) {
    const excludeIds = config.excludeArticleIds.map(id => `"${id}"`).join(', ')
    query += ` && !(_id in [${excludeIds}])`
  }

  // Filtrer par catégorie si spécifié
  if (config.categoryFilter) {
    query += ` && "${config.categoryFilter._id}" in categories[]->_id`
  }

  // Ordre de tri
  const sortOrder = config.sortOrder || 'publishedTime desc'
  query += `] | order(${sortOrder})`

  // Limite
  query += `[0...${config.maxArticles || 4}]`

  // Champs à récupérer
  query += ` {
    _id,
    title,
    description,
    slug,
    cover,
    publishedTime,
    categories[]-> {
      title,
      slug
    }
  }`

  return await sanityClient.fetch(query)
}

// Version simplifiée pour compatibilité
export async function getSubHeadlines() {
  try {
    // Essayer d'abord la nouvelle méthode avec configuration
    const articles = await getSubHeadlinesArticles();
    if (articles && articles.length > 0) {
      return articles;
    }
  } catch (error) {
    // Si erreur ou pas de config, utiliser l'ancienne méthode
    console.log('Utilisation du fallback pour les sub-headlines');
  }

  // Fallback : utiliser l'ancienne méthode avec isSubHeadline
  return await sanityClient.fetch(`
    *[_type == "article" && isSubHeadline == true && !isDraft && defined(publishedTime) && defined(slug.current)] | order(publishedTime desc)[0...4] {
      _id,
      title,
      description,
      slug,
      cover,
      publishedTime,
      categories[]-> {
        title,
        slug
      }
    }
  `)
}

// Tous les articles - ENTIÈREMENT SÉCURISÉ
export async function getAllArticles() {
  return await sanityClient.fetch(`
    *[_type == "article" && !isDraft && defined(publishedTime) && defined(slug.current)] | order(publishedTime desc) {
      _id,
      title,
      description,
      slug,
      cover,
      publishedTime,
      isDraft,
      isMainHeadline,
      isSubHeadline,
      _createdAt,
      _updatedAt,
      categories[]-> {
        _id,           // ✅ AJOUTÉ : _id pour le matching
        title,
        slug,
        parent-> {
          _id,         // ✅ AJOUTÉ : _id du parent aussi
          title,
          slug
        }
      },
      authors[]-> {
        _id,           // ✅ AJOUTÉ : _id pour les auteurs
        name,
        slug
      },
      tags,
    }
  `)
}
// Ajoutez cette fonction mise à jour dans votre sanity.js





// Ajoutez ces fonctions dans votre sanity.js

// Récupérer la configuration des main headlines
export async function getMainHeadlinesConfig() {
  return await sanityClient.fetch(`
    *[_type == "mainHeadlines"][0] {
      title,
      isActive,
      maxArticles,
      displayMode,
      manualArticles[]{
        articleTitle,
        order
      },
      excludeArticles[]{
        articleTitle
      },
      categoryFilter-> {
        _id,
        slug
      },
      sortOrder,
      showImage,
      showCategory,
      showDate,
      showDescription,
      customCSS
    }
  `)
}

// Récupérer les articles pour main headlines basé sur la config
export async function getMainHeadlinesArticles() {
  const config = await getMainHeadlinesConfig()

  // Si désactivé, retourner vide
  if (!config || !config.isActive) {
    return []
  }

  // Mode manuel - chercher par nom d'article
  if (config.displayMode === 'manual' && config.manualArticles?.length > 0) {
    const articleTitles = config.manualArticles
      .sort((a, b) => (a.order || 1) - (b.order || 1)) // Trier par ordre
      .map(item => item.articleTitle)
      .filter(title => title && title.trim()) // Éliminer les titres vides
      .slice(0, config.maxArticles || 1);

    if (articleTitles.length === 0) return [];

    // Construire la requête pour chercher par titre
    const titleConditions = articleTitles.map(title => `title == "${title}"`).join(' || ');

    const manualArticles = await sanityClient.fetch(`
      *[_type == "article" && (${titleConditions}) && !isDraft && defined(publishedTime) && defined(slug.current)] {
        _id,
        title,
        description,
        slug,
        cover,
        publishedTime,
        categories[]-> {
          title,
          slug
        },
        authors[]-> {
          name,
          slug
        }
      }
    `);

    // Réorganiser selon l'ordre spécifié
    const orderedArticles = [];
    articleTitles.forEach(title => {
      const article = manualArticles.find(a => a.title === title);
      if (article) {
        orderedArticles.push(article);
      }
    });

    return orderedArticles;
  }

  // Mode automatique
  let query = `*[_type == "article" && !isDraft && defined(publishedTime) && defined(slug.current)`

  // Exclure les articles spécifiés par nom
  if (config.excludeArticles && config.excludeArticles.length > 0) {
    const excludeTitles = config.excludeArticles
      .map(item => item.articleTitle)
      .filter(title => title && title.trim())
      .map(title => `title != "${title}"`)
      .join(' && ');

    if (excludeTitles) {
      query += ` && ${excludeTitles}`;
    }
  }

  // Filtrer par catégorie si spécifié
  if (config.categoryFilter && config.categoryFilter._id) {
    query += ` && "${config.categoryFilter._id}" in categories[]->_id`
  }

  // Ordre de tri
  const sortOrder = config.sortOrder || 'publishedTime desc'
  query += `] | order(${sortOrder})`

  // Limite
  query += `[0...${config.maxArticles || 1}]`

  // Champs à récupérer
  query += ` {
    _id,
    title,
    description,
    slug,
    cover,
    publishedTime,
    categories[]-> {
      title,
      slug
    },
    authors[]-> {
      name,
      slug
    }
  }`

  return await sanityClient.fetch(query)
}

// Remplacez votre fonction getMainHeadlines existante par celle-ci :
export async function getMainHeadlines() {
  try {
    // Essayer d'abord la nouvelle méthode avec configuration
    const articles = await getMainHeadlinesArticles();
    if (articles && articles.length > 0) {
      return articles;
    }
  } catch (error) {
    // Si erreur ou pas de config, utiliser l'ancienne méthode
    console.log('Utilisation du fallback pour les main headlines');
  }

  // Fallback : utiliser l'ancienne méthode avec isMainHeadline
  return await sanityClient.fetch(`
    *[_type == "article" && isMainHeadline == true && !isDraft && defined(publishedTime) && defined(slug.current)] | order(publishedTime desc)[0...5] {
      _id,
      title,
      description,
      slug,
      cover,
      publishedTime,
      categories[]-> {
        title,
        slug
      }
    }
  `)
}
























// Article par slug - AVEC STRUCTURE PORTABLE TEXT COMPLÈTE
export async function getArticleBySlug(slug) {
  return await sanityClient.fetch(`
    *[_type == "article" && slug.current == $slug && defined(publishedTime) && defined(slug.current)][0] {
      _id,
      title,
      description,
      slug,
      cover,
      publishedTime,
      isDraft,
      isMainHeadline,
      isSubHeadline,
      content,
      tags,
      categories[]-> {
        _id,
        title,
        slug,
        parent-> {
          title,
          slug
        }
      },
      authors[]-> {
        _id,
        name,
        slug,
        bio,
        avatar
      }
    }
  `,
    { slug },
    {
      // 🚀 CACHE AJOUTÉ
      cache: 'force-cache',
      next: { revalidate: 300 }
    })
}

// Articles par catégorie - ENTIÈREMENT SÉCURISÉ
export async function getArticlesByCategory(categorySlug) {
  return await sanityClient.fetch(`
    *[_type == "article" && 
      (categories[]->slug.current match $slug || 
       categories[]->parent->slug.current match $slug) && 
      !isDraft && defined(publishedTime) && defined(slug.current)] | order(publishedTime desc) {
      _id,
      title,
      description,
      slug,
      cover,
      publishedTime,
      categories[]-> {
        title,
        slug,
        parent-> {
          title,
          slug
        }
      },
      authors[]-> {
        name,
        slug
      }
    }
  `, { slug: categorySlug })
}

// Articles récents - ENTIÈREMENT SÉCURISÉ
export async function getRecentArticles(limit = 10) {
  return await sanityClient.fetch(`
    *[_type == "article" && !isDraft && defined(publishedTime) && defined(slug.current)] | order(publishedTime desc)[0...${limit}] {
      _id,
      title,
      description,
      slug,
      cover,
      publishedTime,
      categories[]-> {
        title,
        slug
      }
    }
  `)
}

// Toutes les catégories - SÉCURISÉ
export async function getAllCategories() {
  return await sanityClient.fetch(`
    *[_type == "category" && defined(slug.current)] | order(order asc) {
      _id,
      title,
      slug,
      description,
      parent-> {
        title,
        slug
      }
    }
  `)
}

// Tous les auteurs - SÉCURISÉ
export async function getAllAuthors() {
  return await sanityClient.fetch(`
    *[_type == "author" && defined(slug.current)] | order(name asc) {
      _id,
      name,
      slug,
      bio,
      avatar
    }
  `)
}

// === NAVIGATION ===

// Fonction pour récupérer la navigation - SÉCURISÉE
export async function getNavigation() {
  try {
    const navigation = await sanityClient.fetch(`
      *[_type == "navigation"][0]{
        title,
        items[]{
          label,
          linkType,
          internalLink,
          categoryLink->{
            title,
            slug
          },
          articleLink->{
            title,
            slug
          },
          externalLink,
          openInNewTab,
          hasSubItems,
          subItems[]{
            label,
            linkType,
            internalLink,
            categoryLink->{
              title,
              slug
            },
            articleLink->{
              title,
              slug
            },
            externalLink,
            openInNewTab,
            description
          },
          description,
          icon,
          highlighted
        }
      }
    `);

    if (!navigation) {
      return { title: 'Navigation', items: [] };
    }

    // Transformer les données avec vérifications
    const transformedItems = navigation.items?.map(item => {
      let href = '#';

      switch (item.linkType) {
        case 'internal':
          href = item.internalLink || '/';
          break;
        case 'category':
          href = item.categoryLink?.slug?.current ? `/categories/${item.categoryLink.slug.current}` : '#';
          break;
        case 'article':
          href = item.articleLink?.slug?.current ? `/articles/${item.articleLink.slug.current}` : '#';
          break;
        case 'external':
          href = item.externalLink || '#';
          break;
      }

      const transformedItem = {
        text: item.label,
        href: href,
        target: item.openInNewTab ? '_blank' : '_self',
        highlighted: item.highlighted || false
      };

      if (item.hasSubItems && item.subItems) {
        transformedItem.subItems = item.subItems.map(subItem => {
          let subHref = '#';

          switch (subItem.linkType) {
            case 'internal':
              subHref = subItem.internalLink || '/';
              break;
            case 'category':
              subHref = subItem.categoryLink?.slug?.current ? `/categories/${subItem.categoryLink.slug.current}` : '#';
              break;
            case 'article':
              subHref = subItem.articleLink?.slug?.current ? `/articles/${subItem.articleLink.slug.current}` : '#';
              break;
            case 'external':
              subHref = subItem.externalLink || '#';
              break;
          }

          return {
            text: subItem.label,
            href: subHref,
            target: subItem.openInNewTab ? '_blank' : '_self',
            description: subItem.description
          };
        });
      }

      return transformedItem;
    }) || [];

    return {
      title: navigation.title,
      items: transformedItems
    };

  } catch (error) {
    console.error('Erreur navigation:', error);
    return { title: 'Navigation', items: [] };
  }
}


// === PAGES STATIQUES ===

// Récupérer toutes les pages
export async function getAllPages() {
  return await sanityClient.fetch(`
    *[_type == "page" && isPublished == true && defined(slug.current)] {
      _id,
      title,
      slug,
      description
    }
  `)
}

// Récupérer une page par slug
export async function getPageBySlug(slug) {
  return await sanityClient.fetch(`
    *[_type == "page" && slug.current == $slug && isPublished == true][0] {
      _id,
      title,
      slug,
      description,
      content
    }
  `, { slug })
}





// Remplacez votre fonction getSiteSettings par celle-ci :

export async function getSiteSettings() {
  try {
    const settings = await sanityClient.fetch(`  // ✅ CORRIGÉ : sanityClient au lieu de client
      *[_type == "siteSettings"][0] {
        relatedDisplay,
        relatedCount,
        relatedTitle,
        relatedCriteria,
        smartWeighting,
        excludeDrafts,
        prioritizeHeadlines
      }
    `);

    // Si aucun paramètre trouvé, retourner des valeurs par défaut
    if (!settings) {
      return {
        relatedDisplay: 'grid',
        relatedCount: 3,
        relatedTitle: 'Articles similaires',
        relatedCriteria: 'categories',
        excludeDrafts: true,
        prioritizeHeadlines: false
      };
    }

    return settings;
  } catch (error) {
    console.error('Erreur lors de la récupération des paramètres:', error);
    // Valeurs par défaut si erreur
    return {
      relatedDisplay: 'grid',
      relatedCount: 3,
      relatedTitle: 'Articles similaires',
      relatedCriteria: 'categories',
      excludeDrafts: true,
      prioritizeHeadlines: false
    };
  }
}

// Remplacez votre fonction getRelatedArticles par celle-ci (VERSION SIMPLIFIÉE) :

export async function getRelatedArticles(currentArticle, settings) {
  try {
    // Utiliser getAllArticles qui fonctionne déjà
    const allArticles = await getAllArticles();

    // Filtrer l'article actuel
    let relatedArticles = allArticles.filter(article => article._id !== currentArticle._id);

    console.log("Total articles disponibles:", relatedArticles.length);
    console.log("Article actuel catégories:", currentArticle.categories?.map(c => c.title));

    // Filtrer par catégories
    if (settings.relatedCriteria === 'categories' && currentArticle.categories?.length > 0) {
      const categorizedArticles = relatedArticles.filter(article => {
        if (!article.categories || article.categories.length === 0) return false;

        const hasMatch = article.categories.some(cat =>
          currentArticle.categories.some(currentCat => currentCat._id === cat._id)
        );

        if (hasMatch) {
          console.log("MATCH trouvé:", article.title, "catégories:", article.categories.map(c => c.title));
        }

        return hasMatch;
      });

      console.log("Articles par catégorie trouvés:", categorizedArticles.length);

      if (categorizedArticles.length > 0) {
        relatedArticles = categorizedArticles;
      }
    }

    // Limiter et retourner
    return relatedArticles.slice(0, settings.relatedCount || 3);

  } catch (error) {
    console.error('Erreur getRelatedArticles:', error);
    return [];
  }
}


// Récupérer une catégorie par slug
export async function getCategoryBySlug(slug) {
  return await sanityClient.fetch(`
    *[_type == "category" && slug.current == $slug][0] {
      _id,
      title,
      slug,
      description,
      parent-> {
        title,
        slug
      }
    }
  `, { slug })
}











// Récupérer tous les tags uniques avec compteurs - VERSION CORRIGÉE
export async function getAllTags() {

  try {
    const articles = await sanityClient.fetch(`
      *[_type == "article" && !isDraft && defined(tags) && defined(publishedTime) && defined(slug.current)] {
        tags
      }
    `);


    if (articles.length === 0) {
      return [];
    }

    // Compter les occurrences de chaque tag
    const tagCounts = new Map();

    articles.forEach(article => {
      if (article.tags && Array.isArray(article.tags)) {
        article.tags.forEach(tag => {
          if (tag && typeof tag === 'string' && tag.trim()) {
            const cleanTag = tag.trim();
            const urlTag = cleanTag
              .toLowerCase()
              .replace(/\s+/g, '-')
              .replace(/[^\w\u0590-\u05FF-]/g, ''); // Supporte l'hébreu

            const current = tagCounts.get(urlTag) || {
              name: cleanTag,
              count: 0,
              url: urlTag
            };
            tagCounts.set(urlTag, { ...current, count: current.count + 1 });
          }
        });
      }
    });

    const result = Array.from(tagCounts.values()).sort((a, b) => b.count - a.count);

    return result;

  } catch (error) {
    console.error("❌ Erreur getAllTags:", error);
    return [];
  }
}












// === SOLUTION FINALE : NETTOYER LES ESPACES ===
// Remplacez votre fonction getArticlesByTag dans sanity.js par celle-ci :

export async function getArticlesByTag(tagSlug) {
  console.log(`🔍 Recherche articles pour tag: "${tagSlug}"`);

  try {
    // Convertir rtx-50 -> rtx 50
    const baseTag = tagSlug.replace(/-/g, ' ');

    // ✅ RÉCUPÉRER TOUS LES ARTICLES ET FILTRER EN JAVASCRIPT
    const articles = await sanityClient.fetch(`
      *[_type == "article" && 
        !isDraft && 
        defined(publishedTime) && 
        defined(slug.current) && 
        defined(tags)
      ] | order(publishedTime desc) {
        _id,
        title,
        description,
        slug,
        cover,
        publishedTime,
        categories[]-> {
          _id,
          title,
          slug,
          parent-> {
            title,
            slug
          }
        },
        authors[]-> {
          _id,
          name,
          slug
        },
        tags
      }
    `);

    // ✅ FILTRAGE UNIVERSEL INSENSIBLE À LA CASSE EN JAVASCRIPT
    const filteredArticles = articles.filter(article => {
      if (!article.tags || !Array.isArray(article.tags)) return false;

      return article.tags.some(tag => {
        if (!tag || typeof tag !== 'string') return false;

        // Nettoyer les deux chaînes : supprimer espaces, convertir minuscule
        const cleanTag = tag.trim().toLowerCase();
        const cleanSearch = baseTag.trim().toLowerCase();

        // Match exact OU contient
        return cleanTag === cleanSearch || cleanTag.includes(cleanSearch);
      });
    });

    console.log(`📄 Articles trouvés pour "${tagSlug}":`, filteredArticles.length);

    if (filteredArticles.length > 0) {
      console.log("Premier article trouvé:", filteredArticles[0].title);
      // Afficher les tags qui ont matché
      const matchedTags = filteredArticles[0].tags?.filter(tag => {
        const cleanTag = tag.trim().toLowerCase();
        const cleanSearch = baseTag.trim().toLowerCase();
        return cleanTag === cleanSearch || cleanTag.includes(cleanSearch);
      });
      console.log("Tags qui ont matché:", matchedTags);
    }

    return filteredArticles;

  } catch (error) {
    console.error(`❌ Erreur recherche tag "${tagSlug}":`, error);
    return [];
  }
}

// === FONCTION DE TEST POUR VÉRIFIER LA CORRECTION ===
export async function testSpacesFix() {
  console.log("🧪 === TEST DE LA CORRECTION DES ESPACES ===");

  // Tester les tags qui avaient 0 résultats avant
  const tagsToTest = [
    'dune',           // devrait trouver "Dune " 
    'mac',            // devrait trouver "Mac "
    'nintendo',       // devrait trouver "Nintendo "
    'openai',         // devrait trouver "OpenAI " ou "Open AI"
    'amd',            // devrait trouver "AMD " ou "AMD"
    'ryzen',          // devrait trouver "Ryzen "
    'iphone'          // devrait trouver "iPhone" (déjà marchait)
  ];

  for (const tagSlug of tagsToTest) {
    console.log(`\n🔍 Test: "${tagSlug}"`);
    const articles = await getArticlesByTag(tagSlug);
    console.log(`   📊 Résultat: ${articles.length} articles`);

    if (articles.length > 0) {
      console.log(`   ✅ SUCCESS: Trouve maintenant des articles !`);
    } else {
      console.log(`   ❌ Toujours 0 articles`);
    }
  }

  console.log("\n✅ Test terminé.");
}