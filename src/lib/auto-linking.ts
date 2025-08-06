// src/lib/auto-linking.ts
// Système de linking automatique adapté à votre configuration

import { sanityClient } from './sanity.js';

// Types TypeScript
interface Article {
  title: string;
  slug: string;
  publishedTime: string;
}

interface KeywordMap {
  [keyword: string]: Article;
}

// ✨ Récupérer tous les mots-clés de linking
export async function getKeywordMappings(): Promise<Map<string, Article>> {
  const articles = await sanityClient.fetch(`
    *[_type == "article" && !isDraft && defined(uniqueLinkingKeyword) && uniqueLinkingKeyword != "" && defined(slug.current)] {
      _id,
      title,
      slug,
      uniqueLinkingKeyword,
      publishedTime
    } | order(publishedTime desc)
  `);

  // Créer une map mot-clé → article (1 pour 1)
  const keywordMap = new Map<string, Article>();

  articles.forEach((article: any) => {
    if (article.uniqueLinkingKeyword) {
      const keyword = article.uniqueLinkingKeyword.toLowerCase().trim();

      // Si le mot-clé existe déjà, garder le plus récent
      if (keywordMap.has(keyword)) {
        const existing = keywordMap.get(keyword);
        if (existing && new Date(article.publishedTime) > new Date(existing.publishedTime)) {
          keywordMap.set(keyword, {
            title: article.title,
            slug: article.slug.current,
            publishedTime: article.publishedTime
          });
        }
      } else {
        keywordMap.set(keyword, {
          title: article.title,
          slug: article.slug.current,
          publishedTime: article.publishedTime
        });
      }
    }
  });

  console.log(`🔗 ${keywordMap.size} mots-clés de linking chargés`);
  return keywordMap;
}

// ✨ Traiter les blocs Portable Text
export async function processPortableTextBlocks(blocks: any[], currentSlug: string): Promise<any[]> {
  if (!blocks || !Array.isArray(blocks)) {
    return blocks;
  }

  const processedBlocks: any[] = [];
  let totalLinksAdded = 0;
  const usedKeywords = new Set<string>();

  // Récupérer les mappings une seule fois
  const keywordMap = await getKeywordMappings();

  for (const block of blocks) {
    if (block._type === 'block' && block.children) {
      // Extraire le texte complet du bloc
      const blockText = block.children
        .filter((child: any) => child._type === 'span' && child.text)
        .map((child: any) => child.text)
        .join('');

      if (blockText.trim().length > 0 && totalLinksAdded < 5) {
        // ✨ Appliquer liens avec compteur global
        const result = addAutoLinksToTextWithGlobalCounter(
          blockText,
          currentSlug,
          keywordMap,
          usedKeywords,
          { maxLinks: 5 - totalLinksAdded }
        );

        if (result.linksAdded > 0) {
          // Créer un nouveau bloc avec le HTML transformé
          processedBlocks.push({
            ...block,
            _type: 'autoLinkedBlock',
            html: result.text,
            originalText: blockText
          });
          totalLinksAdded += result.linksAdded;
        } else {
          // Garder le bloc original
          processedBlocks.push(block);
        }
      } else {
        processedBlocks.push(block);
      }
    } else {
      // Blocs non-texte (images, YouTube, etc.)
      processedBlocks.push(block);
    }
  }

  console.log(`🎯 Total liens automatiques ajoutés: ${totalLinksAdded}`);
  console.log(`🔑 Mots-clés utilisés: ${Array.from(usedKeywords).join(', ')}`);
  return processedBlocks;
}

// ✨ FONCTION SYNCHRONE
function addAutoLinksToTextWithGlobalCounter(
  text: string,
  currentSlug: string,
  keywordMap: Map<string, Article>,
  usedKeywords: Set<string>,
  options: { maxLinks?: number; linkClass?: string } = {}
): { text: string; linksAdded: number } {
  const defaultOptions = {
    maxLinks: 5,
    linkClass: 'auto-link'
  };

  const config = { ...defaultOptions, ...options };

  if (!text || typeof text !== 'string') {
    return { text, linksAdded: 0 };
  }

  let modifiedText = text;
  let linksAdded = 0;

  // Trier les mots-clés par longueur (plus longs d'abord)
  const sortedKeywords = Array.from(keywordMap.keys())
    .filter(keyword => keyword.length >= 3)
    .sort((a, b) => b.length - a.length);

  for (const keyword of sortedKeywords) {
    if (linksAdded >= config.maxLinks!) break;

    // ✨ VÉRIFICATION GLOBALE: Si ce mot-clé a déjà été utilisé, passer
    if (usedKeywords.has(keyword)) {
      continue;
    }

    const targetArticle = keywordMap.get(keyword);
    if (!targetArticle) continue;

    // Éviter les liens vers soi-même
    if (targetArticle.slug === currentSlug) continue;

    // Créer la regex pour trouver le mot-clé
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedKeyword}\\b(?![^<]*>|[^<]*<\/)`, 'gi');

    // Vérifier si le mot-clé existe dans le texte
    if (regex.test(modifiedText)) {
      // Créer le lien
      const linkHtml = `<a href="/${targetArticle.slug}" class="${config.linkClass}" title="${targetArticle.title}">${keyword}</a>`;

      // ✨ REMPLACER SEULEMENT LA PREMIÈRE OCCURRENCE
      let replacementCount = 0;
      modifiedText = modifiedText.replace(regex, (match: string) => {
        if (replacementCount === 0 && linksAdded < config.maxLinks!) {
          replacementCount++;
          linksAdded++;
          usedKeywords.add(keyword);
          return linkHtml;
        }
        return match;
      });

      if (replacementCount > 0) {
        console.log(`🔗 Lien ajouté: "${keyword}" → /${targetArticle.slug}`);
      }
    }
  }

  return {
    text: modifiedText,
    linksAdded
  };
}

// ✨ Fonction pour prévisualiser les liens (debug)
export async function previewAutoLinks(text: string, currentSlug: string): Promise<any[]> {
  const keywordMap = await getKeywordMappings();
  const preview: any[] = [];

  for (const [keyword, article] of keywordMap.entries()) {
    if (article.slug === currentSlug) continue;

    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = text.match(regex);

    if (matches) {
      preview.push({
        keyword,
        targetTitle: article.title,
        targetSlug: article.slug,
        occurrences: matches.length
      });
    }
  }

  return preview.sort((a, b) => b.occurrences - a.occurrences);
}