// src/pages/api/auto-publish.ts
import type { APIRoute } from 'astro'
import { createClient } from '@sanity/client'

// Client spécifique pour l'écriture (différent de votre sanity.js)
const writeClient = createClient({
  projectId: '0lbfqiht',
  dataset: 'production',
  token: 'sk_VOTRE_TOKEN_ICI', // Remplacez par votre vrai token
  apiVersion: '2023-05-03',
  useCdn: false // Important pour l'écriture
})

export const POST: APIRoute = async ({ request }) => {
  console.log('🔄 Vérification des articles programmés...')

  // ✅ Debug des variables d'environnement
  console.log('Project ID:', process.env.SANITY_PROJECT_ID)
  console.log('Dataset:', process.env.SANITY_DATASET)
  console.log('Token présent:', !!process.env.SANITY_TOKEN)
  console.log('Token commence par sk_:', process.env.SANITY_TOKEN?.startsWith('sk_'))

  try {
    const now = new Date()

    // Test de connexion d'abord
    console.log('Test de connexion Sanity...')
    const testQuery = await writeClient.fetch(`*[_type == "article"][0] { _id, title }`)
    console.log('Connexion OK, premier article:', testQuery?.title || 'Aucun article')

    // Trouver articles avec autoPublishAt dans le passé et encore en brouillon
    const toPublish = await writeClient.fetch(`
      *[_type == "article" 
        && defined(autoPublishAt) 
        && autoPublishAt <= $now
        && isDraft == true
      ] {
        _id,
        title,
        autoPublishAt,
        slug
      }
    `, { now: now.toISOString() })

    console.log(`📄 Trouvé ${toPublish.length} article(s) à publier`)

    if (toPublish.length === 0) {
      return new Response(JSON.stringify({
        message: 'Aucun article à publier',
        count: 0
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Publier chaque article
    const results = []
    for (const article of toPublish) {
      await writeClient
        .patch(article._id)
        .set({
          isDraft: false
          // Ne touche pas à publishedTime - vous l'avez déjà pré-rempli !
        })
        .unset(['autoPublishAt']) // Nettoyer le champ programmation
        .commit()

      console.log(`✅ Article publié: "${article.title}"`)
      results.push({
        title: article.title,
        slug: article.slug?.current || 'no-slug',
        publishedAt: article.autoPublishAt
      })
    }

    // Déclencher rebuild du site
    try {
      const webhookUrl = 'https://api.vercel.com/v1/integrations/deploy/prj_H5FKoXn7Nyj5rPnJDukPCPSIN8n4/GqosuEJUTA'
      await fetch(webhookUrl, { method: 'POST' })
      console.log('Site rebuild déclenché')
    } catch (buildError) {
      console.warn('Impossible de déclencher le rebuild:', buildError)
    }

    return new Response(JSON.stringify({
      message: `${toPublish.length} article(s) publié(s) avec succès`,
      count: toPublish.length,
      articles: results,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Erreur lors de la publication:', error)
    return new Response(JSON.stringify({
      error: 'Erreur lors de la publication automatique',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// ✅ Ajout d'une méthode GET pour tester facilement
export const GET: APIRoute = async () => {
  return new Response(`
    <h1>API Auto-Publish</h1>
    <p>Cette API publie automatiquement les articles programmés.</p>
    <button onclick="test()">Tester maintenant</button>
    <div id="result"></div>
    <script>
      async function test() {
        const result = document.getElementById('result');
        result.innerHTML = 'Test en cours...';
        try {
          const response = await fetch('/api/auto-publish', { method: 'POST' });
          const data = await response.text();
          result.innerHTML = '<pre>' + data + '</pre>';
        } catch (error) {
          result.innerHTML = 'Erreur: ' + error.message;
        }
      }
    </script>
  `, {
    headers: { 'Content-Type': 'text/html' }
  });
}