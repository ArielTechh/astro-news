// src/pages/api/auto-publish.ts
import type { APIRoute } from 'astro'
import { createClient } from '@sanity/client'

// ✅ Client configuré pour l'écriture
const client = createClient({
  projectId: '0lbfqiht', // Votre project ID
  dataset: 'production',
  token: process.env.SANITY_TOKEN, // ⚠️ process.env dans les API routes, pas import.meta.env
  apiVersion: '2023-05-03',
  useCdn: false // Important pour l'écriture
})

export const POST: APIRoute = async ({ request }) => {
  console.log('🔄 Vérification des articles programmés...')

  try {
    const now = new Date()

    // Trouver articles avec autoPublishAt dans le passé et encore en brouillon
    const toPublish = await client.fetch(`
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
      await client
        .patch(article._id)
        .set({
          isDraft: false,
          publishedTime: article.autoPublishAt // Utiliser l'heure programmée
        })
        .unset(['autoPublishAt']) // Nettoyer le champ
        .commit()

      console.log(`✅ Article publié: "${article.title}"`)
      results.push({
        title: article.title,
        slug: article.slug?.current || 'no-slug',
        publishedAt: article.autoPublishAt
      })
    }

    // Optionnel: déclencher rebuild du site
    if (process.env.VERCEL_BUILD_HOOK) {
      try {
        await fetch(process.env.VERCEL_BUILD_HOOK, { method: 'POST' })
        console.log('🔄 Site rebuild déclenché')
      } catch (buildError) {
        console.warn('⚠️ Impossible de déclencher le rebuild:', buildError)
      }
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