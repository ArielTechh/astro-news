// src/lib/utils/getMetaSanity.ts - VERSION FINALE PROPRE
import { render, type CollectionEntry } from "astro:content";
import { SITE } from "@/lib/config";
import defaultImage from "@/assets/images/default-image.jpg";
import type { ArticleMeta, Meta } from "@/lib/types";
import { capitalizeFirstLetter } from "@/lib/utils/letter";
import { normalizeDate } from "@/lib/utils/date";
import { urlFor, sanityClient } from "@/lib/sanity";

// Types pour Sanity
type SanityArticle = {
  _id: string;
  title: string;
  description: string;
  slug: { current: string };
  cover?: any;
  publishedTime: string;
  authors?: Array<{
    name: string;
    slug: { current: string };
  }>;
};

type SanityCategory = {
  _id: string;
  title: string;
  slug: { current: string };
  description?: string;
};

type GetMetaCollection = CollectionEntry<"views"> | SanityArticle;

const renderCache = new Map<string, any>();

// Fonction pour récupérer une catégorie par slug
async function getCategoryBySlug(slug: string): Promise<SanityCategory | null> {
  try {
    const category = await sanityClient.fetch(`
      *[_type == "category" && slug.current == $slug][0] {
        _id,
        title,
        slug,
        description
      }
    `, { slug });

    return category || null;
  } catch (error) {
    console.error('Erreur lors de la récupération de la catégorie:', error);
    return null;
  }
}

// Fonction pour vérifier si c'est un article Sanity
function isSanityArticle(obj: any): obj is SanityArticle {
  return obj && obj._id && obj.title && obj.slug;
}

// Fonction pour vérifier si c'est une Collection Entry
function isCollectionEntry(obj: any): obj is CollectionEntry<"views"> {
  return obj && obj.collection && obj.id;
}

export const getMeta = async (
  collection: GetMetaCollection,
  category?: string,
  currentPage?: number,
  categoryInfo?: SanityCategory
): Promise<Meta | ArticleMeta> => {
  try {
    // Si c'est un article Sanity
    if (isSanityArticle(collection)) {
      const collectionId = `sanity-article-${collection._id}`;

      if (renderCache.has(collectionId)) {
        return renderCache.get(collectionId);
      }

      const meta: ArticleMeta = {
        title: capitalizeFirstLetter(collection.title),
        metaTitle: capitalizeFirstLetter(collection.title),
        description: collection.description,
        ogImage: collection.cover ? urlFor(collection.cover).width(1200).height(630).url() : defaultImage.src,
        ogImageAlt: collection.title,
        publishedTime: normalizeDate(collection.publishedTime),
        lastModified: normalizeDate(collection.publishedTime),
        authors: collection.authors?.map((author) => ({
          name: author.name,
          link: author.slug.current,
        })) || [],
        type: "article",
      };

      renderCache.set(collectionId, meta);
      return meta;
    }

    // Si c'est une Collection Entry (views)
    if (isCollectionEntry(collection) && collection.collection === "views") {
      const collectionId = `${collection.collection}-${collection.id}`;
      const cacheKey = category ? `${collectionId}-${category}${currentPage ? `-page-${currentPage}` : ''}` : collectionId;

      if (renderCache.has(cacheKey)) {
        return renderCache.get(cacheKey);
      }

      let title: string;
      let description: string;

      if (collection.id === "categories" && category) {
        // Récupérer les vraies données de la catégorie
        let categoryData = categoryInfo;

        if (!categoryData) {
          categoryData = await getCategoryBySlug(category);
        }

        if (categoryData && categoryData.title) {
          const categoryTitle = categoryData.title;

          if (currentPage && currentPage > 1) {
            title = `${categoryTitle} - עמוד ${currentPage}`;
            description = `מאמרים בנושא ${categoryTitle} - עמוד ${currentPage}`;
          } else {
            title = `מאמרים בנושא ${categoryTitle}`;
            description = categoryData.description || `כל המאמרים והביקורות בנושא ${categoryTitle}`;
          }
        } else {
          // Fallback si catégorie non trouvée
          const fallbackTitle = capitalizeFirstLetter(category);

          if (currentPage && currentPage > 1) {
            title = `${fallbackTitle} - עמוד ${currentPage}`;
            description = `מאמרים בנושא ${fallbackTitle} - עמוד ${currentPage}`;
          } else {
            title = `מאמרים בנושא ${fallbackTitle}`;
            description = `כל המאמרים בנושא ${fallbackTitle}`;
          }
        }

      } else if (collection.id === "home") {
        title = "חדשות טכנולוגיה, ביקורות ומדריכים";
        description = "האתר המוביל לחדשות טכנולוגיה, ביקורות מוצרים ומדריכים מעמיקים";
      } else if (collection.id === "categories") {
        // Page principale des catégories
        title = "כל הקטגוריות";
        description = "עיינו בכל הקטגוריות שלנו לחדשות טכנולוגיה וביקורות";
      } else {
        // Autres pages
        title = capitalizeFirstLetter(collection.data.title);
        description = collection.data.description;
      }

      const meta: Meta = {
        title,
        metaTitle: title,
        description,
        ogImage: defaultImage.src,
        ogImageAlt: title,
        type: "website",
      };

      renderCache.set(cacheKey, meta);
      return meta;
    }

    throw new Error(`Invalid collection type or structure`);
  } catch (error) {
    console.error(`Error generating metadata:`, error);
    throw error;
  }
};