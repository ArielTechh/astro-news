// src/pages/api/auto-publish.ts
import type { APIRoute } from 'astro'
import { createClient } from '@sanity/client'

const writeClient = createClient({
  projectId: process.env.SANITY_PROJECT_ID || '0lbfqiht',
  dataset: process.env.SANITY_DATASET || 'production',
  token: process.env.SANITY_TOKEN,
  apiVersion: '2023-05-03',
  useCdn: false
});

export const GET: APIRoute = async () => {
  return new Response(`
    <html>
    <head>
        <title>Auto-Publish Test</title>
        <style>
            body { font-family: Arial; padding: 40px; max-width: 800px; margin: 0 auto; }
            button { padding: 15px 30px; font-size: 16px; background: #0070f3; color: white; border: none; border-radius: 5px; cursor: pointer; }
            button:hover { background: #0051cc; }
            pre { background: #f5f5f5; padding: 20px; border-radius: 5px; overflow-x: auto; }
            .loading { color: #666; }
            .success { color: #28a745; }
            .error { color: #dc3545; }
        </style>
    </head>
    <body>
        <h1>API Auto-Publish - Test</h1>
        <p>Cette API publie automatiquement les articles programmés.</p>
        <button onclick="test()">Tester maintenant</button>
        <div id="result"></div>
        
        <script>
        async function test() {
            const result = document.getElementById('result');
            result.innerHTML = '<div class="loading">Test en cours...</div>';
            
            try {
                const response = await fetch('/api/auto-publish', { method: 'POST' });
                const data = await response.text();
                
                if (response.ok) {
                    result.innerHTML = '<div class="success">Succès !</div><pre>' + data + '</pre>';
                } else {
                    result.innerHTML = '<div class="error">Erreur HTTP ' + response.status + '</div><pre>' + data + '</pre>';
                }
            } catch (error) {
                result.innerHTML = '<div class="error">Erreur réseau: ' + error.message + '</div>';
            }
        }
        </script>
    </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' }
  })
}

export const POST: APIRoute = async () => {
  try {
    const now = new Date()

    console.log('Vérification des articles programmés...')

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

    console.log(`Trouvé ${toPublish.length} article(s) à publier`)

    if (toPublish.length === 0) {
      return new Response(JSON.stringify({
        message: 'Aucun article à publier',
        count: 0,
        timestamp: now.toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const results = []
    for (const article of toPublish) {
      await writeClient
        .patch(article._id)
        .set({ isDraft: false })
        .unset(['autoPublishAt'])
        .commit()

      console.log(`Article publié: "${article.title}"`)
      results.push({
        title: article.title,
        slug: article.slug?.current,
        scheduledTime: article.autoPublishAt
      })
    }

    // Déclencher rebuild
    try {
      const webhookUrl = 'https://api.vercel.com/v1/integrations/deploy/prj_H5FKoXn7Nyj5rPnJDukPCPSIN8n4/GqosuEJUTA'
      await fetch(webhookUrl, { method: 'POST' })
      console.log('Rebuild déclenché')
    } catch (error) {
      console.warn('Erreur rebuild:', error)
    }

    return new Response(JSON.stringify({
      success: true,
      message: `${toPublish.length} article(s) publié(s)`,
      count: toPublish.length,
      articles: results,
      timestamp: now.toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Erreur:', error)
    return new Response(JSON.stringify({
      success: false,
      error: 'Erreur lors de la publication',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}