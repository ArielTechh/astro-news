// src/pages/rss.xml.js
import rss from "@astrojs/rss";
import { getAllArticles } from "@/lib/sanity";
import { SITE } from "@/lib/config/index.ts";

export async function GET(context) {
  try {
    const articles = await getAllArticles();

    return rss({
      title: SITE.title,
      description: SITE.description,
      site: context.site || SITE.url,
      language: 'he',

      items: articles
        .slice(0, 20)
        .map((article) => {
          const slug = article.slug?.current?.replace(/^\/+/, '');
          const url = `${context.site || SITE.url}/${slug}`;
          const author = article.author?.name || undefined;

          return {
            title: article.title,
            pubDate: new Date(article._createdAt),
            description: article.description || article.excerpt || '',
            link: url,
            author,
            categories: article.categories?.map(cat => cat.title) || [],
            content: `
              ${article.description || article.excerpt || ''}
              ${article.featuredImage ? `<br/><img src="${article.featuredImage.asset.url}?w=600&h=400&fit=crop" alt="${article.title}" style="max-width: 100%; height: auto; margin: 20px 0;" />` : ''}
              <p><a href="${url}" style="color: #2563eb; text-decoration: underline;">קרא את המאמר המלא ←</a></p>
            `.trim(),
          };
        }),

      customData: `
        <language>he</language>
        <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
        <generator>Astro + Sanity CMS</generator>
        <webMaster>contact@techhorizons.co.il</webMaster>
        <managingEditor>contact@techhorizons.co.il</managingEditor>
        <ttl>60</ttl>
      `,
    });

  } catch (error) {
    console.error('Erreur RSS:', error);
    return rss({
      title: SITE.title,
      description: SITE.description,
      site: context.site || SITE.url,
      items: [],
    });
  }
}
