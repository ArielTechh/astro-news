// migrate-simple.js - VERSION ULTRA SIMPLE
import { createClient } from '@sanity/client';

const client = createClient({
  projectId: '0lbfqiht',
  dataset: 'production',
  useCdn: false,
  apiVersion: '2023-05-03',
  token: 'skELxtwtX5WyXnU3QUmHFs0UdBZreTdJ6ivkKWS46IHTXMGaiTTwuj9obXDxArxkYMPv9qNx2s57nDav5xgjx1JHsFIlzFQqnRzWCbMQEoNXCgscLp7asPSVxkj3X2ZGENAGuzClXa5gAsajwqe1Q8qaWAjqpMY4Sdgcr8DFdlnBQ9ydNl3R'
});

const OLD_CATEGORY_ID = '2PCPB5HkL6rMdjjwwBErlp';
const NEW_CATEGORY_ID = 'gaming-main';

async function simpleMigration() {
  // 1. Trouver les articles
  const articles = await client.fetch(`
    *[_type == "article" && references("${OLD_CATEGORY_ID}")] {
      _id,
      title,
      categories[]-> {
        _id,
        title
      }
    }
  `);

  console.log(`📊 ${articles.length} articles à migrer`);

  // 2. Migrer un par un
  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];

    console.log(`${i + 1}/${articles.length} - ${article.title}`);

    // Remplacer l'ancienne catégorie par la nouvelle
    const newCategories = article.categories.map(cat => ({
      _type: 'reference',
      _ref: cat._id === OLD_CATEGORY_ID ? NEW_CATEGORY_ID : cat._id
    }));

    // Sauvegarder
    await client
      .patch(article._id)
      .set({ categories: newCategories })
      .commit();

    console.log('✅ Mis à jour');
  }

  console.log('🎉 Terminé !');
}

simpleMigration().catch(console.error);