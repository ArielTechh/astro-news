import type { Link } from "../types";

export const SITE = {
  title: "TechHorizon",
  description: "A news website built with Astro",
  author: "TechHorizon",
  url: "https://astro-news-six.vercel.app",
  locale: "he-IL",
  dir: "RTL",
  charset: "UTF-8",
  basePath: "/",
  postsPerPage: 8,
};


export const OTHER_LINKS: Link[] = [
  {
    href: "/about",
    text: "About us",
  },
  {
    href: "/contact",
    text: "Contact",
  },
  {
    href: "/privacy",
    text: "Privacy",
  },
  {
    href: "/terms",
    text: "Terms",
  },
  {
    href: "/cookie-policy",
    text: "Cookie Policy",
  },
  {
    href: "https://astro-news-six.vercel.app/rss.xml",
    text: "RSS",
  },
  {
    href: "https://astro-news-six.vercel.app/sitemap-index.xml",
    text: "Sitemap",
  },
];


