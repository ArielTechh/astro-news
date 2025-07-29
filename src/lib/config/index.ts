import type { Link } from "../types";

export const SITE = {
  title: "TechHorizons",
  description: "A news website built with Astro",
  author: "TechHorizons",
  url: "https://techhorizons.co.il", // ← AJOUTEZ www
  locale: "he-IL",
  dir: "RTL",
  charset: "UTF-8",
  basePath: "/",
  postsPerPage: 8,
};


export const OTHER_LINKS: Link[] = [
  {
    href: "/about",
    text: "אודות",
  },
  {
    href: "/contact",
    text: "צור קשר",
  },
  {
    href: "/Accessibility_Statement",
    text: "הצרת נגישות",
  },
  {
    href: "/cookie-policy",
    text: "Cookie Policy",
  },
];


