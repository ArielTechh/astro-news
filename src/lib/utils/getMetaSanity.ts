// src/lib/utils/getMetaSanity.ts
import { render, type CollectionEntry } from "astro:content";
import { SITE } from "@/lib/config";
import defaultImage from "@/assets/images/default-image.jpg";
import type { ArticleMeta, Meta } from "@/lib/types";
import { capitalizeFirstLetter } from "@/lib/utils/letter";
import { normalizeDate } from "@/lib/utils/date";
import { urlFor } from "@/lib/sanity";

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

type GetMetaCollection = CollectionEntry<"views"> | SanityArticle;

const renderCache = new Map<string, any>();

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
  category?: string
): Promise<Meta | ArticleMeta> => {
  try {
    // Si c'est un article Sanity
    if (isSanityArticle(collection)) {
      const collectionId = `sanity-article-${collection._id}`;

      if (renderCache.has(collectionId)) {
        return renderCache.get(collectionId);
      }

      const meta: ArticleMeta = {
        title: `${capitalizeFirstLetter(collection.title)} - ${SITE.title}`,
        metaTitle: capitalizeFirstLetter(collection.title),
        description: collection.description,
        ogImage: collection.cover ? urlFor(collection.cover).width(1200).height(630).url() : defaultImage.src,
        ogImageAlt: collection.title,
        publishedTime: normalizeDate(collection.publishedTime),
        lastModified: normalizeDate(collection.publishedTime), // Utiliser publishedTime comme lastModified
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
      const cacheKey = category ? `${collectionId}-${category}` : collectionId;

      if (renderCache.has(cacheKey)) {
        return renderCache.get(cacheKey);
      }

      const title = collection.id === "categories" && category
        ? `${capitalizeFirstLetter(category)} - ${SITE.title}`
        : collection.id === "home"
          ? SITE.title
          : `${capitalizeFirstLetter(collection.data.title)} - ${SITE.title}`;

      const meta: Meta = {
        title,
        metaTitle: capitalizeFirstLetter(collection.data.title),
        description: collection.data.description,
        ogImage: defaultImage.src,
        ogImageAlt: SITE.title,
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