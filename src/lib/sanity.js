// src/lib/sanity.js
import { createClient } from '@sanity/client'
import imageUrlBuilder from '@sanity/image-url'

export const sanityClient = createClient({
  projectId: '0lbfqiht', // Votre vrai project ID
  dataset: 'production',
  useCdn: true, // true pour la production
  apiVersion: '2023-05-03'
})

// Helper pour les URLs d'images
const builder = imageUrlBuilder(sanityClient)
export const urlFor = (source) => builder.image(source)

// === FONCTIONS POUR RÉCUPÉRER LES DONNÉES ===

// Headlines principaux - ENTIÈREMENT SÉCURISÉ
export async function getMainHeadlines() {
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

// Sub-headlines - ENTIÈREMENT SÉCURISÉ
export async function getSubHeadlines() {
  return await sanityClient.fetch(`
    *[_type == "article" && isSubHeadline == true && !isDraft && defined(publishedTime) && defined(slug.current)] | order(publishedTime desc)[0...10] {
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
  `)
}

// Article par slug - ENTIÈREMENT SÉCURISÉ
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
  `, { slug })
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