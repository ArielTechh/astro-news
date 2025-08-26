// src/pages/rss.xml.js
import rss from "@astrojs/rss";
import { getAllArticles } from "@/lib/sanity";
import { SITE } from "@/lib/config/index.ts";

export async function GET(context) {
  try {
    const articles = await getAllArticles();
    const siteUrl = String(context.site || SITE.url);

    // Assurer que l'URL se termine par /
    const baseUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;

    const rssContent = rss({
      title: SITE.title,
      description: SITE.description,
      site: baseUrl,
      language: 'he',

      items: articles
        .slice(0, 20)
        .map((article) => {
          const slug = article.slug?.current?.replace(/^\/+/, '');
          const url = `${baseUrl}/${slug}`;

          return {
            title: article.title,
            pubDate: new Date(article._createdAt),
            description: article.description || article.excerpt || '',
            link: url,
            // Remove author field completely to avoid empty tags
            categories: article.categories?.map(cat => cat.title) || [],
            // Use content field with proper CDATA wrapping for HTML content
            content: `<![CDATA[
              <div>
                ${article.description || article.excerpt || ''}
                ${article.featuredImage ? `<br/><img src="${article.featuredImage.asset.url}?w=600&h=400&fit=crop" alt="${article.title}" style="max-width: 100%; height: auto; margin: 20px 0;" />` : ''}
                <p><a href="${url}" style="color: #2563eb; text-decoration: underline;">קרא את המאמר המלא ←</a></p>
              </div>
            ]]>`,
          };
        }),

      customData: `
        <language>he</language>
        <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
        <generator>Astro + Sanity CMS</generator>
        <webMaster>contact@techhorizons.co.il (Tech Horizons)</webMaster>
        <managingEditor>contact@techhorizons.co.il (Tech Horizons)</managingEditor>
        <ttl>60</ttl>
        <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml" />
      `,

      // Add XML namespaces for better compatibility
      xmlns: {
        atom: "http://www.w3.org/2005/Atom"
      }
    });

    // Return with proper RSS content-type header
    return new Response(rssContent.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
      }
    });

  } catch (error) {
    console.error("Erreur RSS:", error);
    const siteUrl = String(context.site || SITE.url);
    const baseUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;

    const errorRss = rss({
      title: SITE.title,
      description: SITE.description,
      site: baseUrl,
      items: [],
      customData: `
        <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml" />
      `,
      xmlns: {
        atom: "http://www.w3.org/2005/Atom"
      }
    });

    return new Response(errorRss.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
      }
    });
  }
}