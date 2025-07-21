// delete-all-articles.js
import { createClient } from '@sanity/client'

const client = createClient({
  projectId: '0lbfqiht', // Remplacez par votre project ID
  dataset: 'production',
  token: 'skELxtwtX5WyXnU3QUmHFs0UdBZreTdJ6ivkKWS46IHTXMGaiTTwuj9obXDxArxkYMPv9qNx2s57nDav5xgjx1JHsFIlzFQqnRzWCbMQEoNXCgscLp7asPSVxkj3X2ZGENAGuzClXa5gAsajwqe1Q8qaWAjqpMY4Sdgcr8DFdlnBQ9ydNl3R', // Token avec permissions d'écriture
  useCdn: false,
  apiVersion: '2023-05-03'
})

async function deleteAllArticles() {
  try {
    console.log('🗑️  Recherche de tous les articles...')

    // Récupérer tous les articles
    const articles = await client.fetch(`*[_type == "article"] { _id, title }`)

    if (articles.length === 0) {
      console.log('📭 Aucun article trouvé!')
      return
    }

    console.log(`📊 ${articles.length} articles trouvés`)

    // Confirmation avant suppression (sécurité)
    console.log('⚠️  ATTENTION: Cette action va supprimer TOUS les articles!')
    console.log('📝 Articles qui seront supprimés:')
    articles.forEach((article, index) => {
      console.log(`   ${index + 1}. ${article.title}`)
    })

    // Supprimer tous les articles
    console.log('\n🚀 Suppression en cours...')

    const mutations = articles.map(article => ({
      delete: { id: article._id }
    }))

    const result = await client.mutate(mutations)

    console.log(`✅ ${articles.length} articles supprimés avec succès!`)
    console.log('🎉 Base de données nettoyée!')

  } catch (error) {
    console.error('❌ Erreur lors de la suppression:', error)
  }
}

// Lancer la suppression
deleteAllArticles()