// migrate-articles.js
import { createClient } from '@sanity/client'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const client = createClient({
  projectId: '0lbfqiht', // Remplacez par votre project ID
  dataset: 'production',
  token: 'skELxtwtX5WyXnU3QUmHFs0UdBZreTdJ6ivkKWS46IHTXMGaiTTwuj9obXDxArxkYMPv9qNx2s57nDav5xgjx1JHsFIlzFQqnRzWCbMQEoNXCgscLp7asPSVxkj3X2ZGENAGuzClXa5gAsajwqe1Q8qaWAjqpMY4Sdgcr8DFdlnBQ9ydNl3R', // Token avec permissions d'écriture
  useCdn: false,
  apiVersion: '2023-05-03'
})



const articlesDir = 'src/content/articles'

// Mappage complet de toutes vos catégories
const categoryMapping = {
  'amazon-prime-video': 'amazon-prime-video',
  'apple': 'apple',
  'apple-tv': 'apple-tv',
  'apps': 'apps',
  'audio': 'audio-main',
  'cinema': 'cinema',
  'computers': 'computers-main',
  'crunchyroll': 'crunchyroll',
  'deals-promotions': 'deals-promotions',
  'desktop-game': 'desktop-game',
  'disney': 'disney',
  'finance': 'finance',
  'gaming': 'gaming-main',
  'gaming-laptops': 'gaming-laptops',
  'google': 'google',
  'graphic-cards': 'graphic-cards',
  'hbo-max': 'hbo-max',
  'health': 'health',
  'honor': 'honor',
  'huawei': 'huawei',
  'ia': 'ia',
  'lifestyle': 'lifestyle-main',
  'movies-tv-shows': 'movies-tv-shows',
  'netflix': 'netflix',
  'news': 'news',
  'news-video-games': 'news-video-games',
  'nintendo-switch': 'nintendo-switch',
  'oneplus': 'oneplus',
  'oppo': 'oppo',
  'playstation-5': 'playstation-5',
  'processors': 'processors',
  'productivity': 'productivity',
  'programming': 'programming',
  'ram': 'ram',
  'samsung': 'samsung',
  'smartphones': 'smartphones',
  'technology': 'technology-main',
  'vpn': 'vpn',
  'wellness': 'wellness',
  'wireless-earbuds': 'wireless-earbuds',
  'wireless-headphones': 'wireless-headphones',
  'xbox-series-x-s': 'xbox-series-x-s'
}

// Fonction pour trouver la référence de catégorie
async function findCategoryRef(categorySlug) {
  const mappedSlug = categoryMapping[categorySlug] || categorySlug

  console.log(`🔍 Recherche catégorie: ${categorySlug} → ${mappedSlug}`)

  let category = await client.fetch(`*[_type == "category" && slug.current == $slug][0]`, {
    slug: mappedSlug
  })

  if (!category) {
    console.log(`⚠️  Catégorie non trouvée, création: ${mappedSlug}`)

    // Créer la catégorie si elle n'existe pas
    const categoryTitle = mappedSlug.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')

    category = await client.create({
      _type: 'category',
      title: categoryTitle,
      slug: { current: mappedSlug },
      description: `Articles de la catégorie ${categoryTitle}`,
      order: 100 // Mettre à la fin
    })

    console.log(`✅ Catégorie créée: ${categoryTitle}`)
  } else {
    console.log(`✅ Catégorie trouvée: ${category.title}`)
  }

  return {
    _ref: category._id,
    _key: Math.random().toString(36).substring(2, 15)
  }
}

// Fonction pour créer/trouver un auteur
async function createOrFindAuthor(authorSlug) {
  // Forcer "Ariel" pour tous les auteurs
  const authorName = "Ariel"
  const authorSlugFixed = "ariel"

  let author = await client.fetch(`*[_type == "author" && slug.current == $slug][0]`, {
    slug: authorSlugFixed
  })

  if (!author) {
    author = await client.create({
      _type: 'author',
      name: authorName,
      slug: { current: authorSlugFixed },
      bio: "Rédacteur principal"
    })
    console.log(`✅ Auteur créé: ${authorName}`)
  } else {
    console.log(`✅ Auteur trouvé: ${authorName}`)
  }

  return {
    _ref: author._id,
    _key: Math.random().toString(36).substring(2, 15)
  }
}

// Fonction pour uploader une image
async function uploadImage(imagePath, articleFolder) {
  try {
    const fullImagePath = path.join(articlesDir, articleFolder, imagePath)

    console.log(`📸 Upload image: ${fullImagePath}`)

    if (!fs.existsSync(fullImagePath)) {
      console.log(`⚠️  Image non trouvée: ${fullImagePath}`)
      return null
    }

    const imageBuffer = fs.readFileSync(fullImagePath)
    const imageAsset = await client.assets.upload('image', imageBuffer, {
      filename: path.basename(imagePath)
    })

    console.log(`✅ Image uploadée: ${imagePath}`)

    return {
      _type: 'image',
      asset: {
        _ref: imageAsset._id
      }
    }
  } catch (error) {
    console.error(`❌ Erreur upload image ${imagePath}:`, error.message)
    return null
  }
}

// Fonction pour convertir le contenu MDX en blocs Sanity
function convertContentToBlocks(content) {
  // Pour l'instant, on met tout le contenu dans un seul bloc
  // Plus tard on pourra améliorer pour parser le MDX proprement
  return [
    {
      _type: 'block',
      _key: 'content',
      style: 'normal',
      markDefs: [],
      children: [
        {
          _type: 'span',
          _key: 'span1',
          text: content,
          marks: []
        }
      ]
    }
  ]
}

// Fonction principale de migration
async function migrateArticles() {
  try {
    console.log(`📁 Lecture du dossier: ${path.resolve(articlesDir)}`)

    if (!fs.existsSync(articlesDir)) {
      console.error(`❌ Dossier non trouvé: ${articlesDir}`)
      return
    }

    const articleFolders = fs.readdirSync(articlesDir)
    console.log(`📚 ${articleFolders.length} dossiers d'articles trouvés`)

    let migrated = 0
    let skipped = 0
    let errors = 0

    for (const folder of articleFolders) {
      console.log(`\n📂 Traitement du dossier: ${folder}`)

      const articlePath = path.join(articlesDir, folder)
      const mdxPath = path.join(articlePath, 'index.mdx')

      // Vérifier si c'est bien un dossier
      if (!fs.statSync(articlePath).isDirectory()) {
        console.log(`⏭️  Ignoré (pas un dossier): ${folder}`)
        continue
      }

      // Vérifier si le fichier MDX existe
      if (!fs.existsSync(mdxPath)) {
        console.log(`⚠️  Pas de index.mdx dans: ${folder}`)
        continue
      }

      try {
        // Lire et parser le fichier MDX
        console.log(`📖 Lecture: ${mdxPath}`)
        const fileContent = fs.readFileSync(mdxPath, 'utf-8')
        const { data: frontmatter, content } = matter(fileContent)

        console.log(`📝 Traitement: ${frontmatter.title}`)

        // Vérifier si l'article existe déjà
        const existingArticle = await client.fetch(`*[_type == "article" && slug.current == $slug][0]`, {
          slug: folder
        })

        if (existingArticle) {
          console.log(`⏭️  Article existe déjà, ignoré: ${frontmatter.title}`)
          skipped++
          continue
        }

        console.log(`📊 Catégorie source: ${frontmatter.category}`)

        // Trouver la catégorie (création automatique si inexistante)
        const categoryRef = await findCategoryRef(frontmatter.category)

        // Créer/trouver les auteurs
        const authorsRefs = []
        if (frontmatter.authors && Array.isArray(frontmatter.authors)) {
          for (const authorSlug of frontmatter.authors) {
            console.log(`👤 Traitement auteur: ${authorSlug}`)
            const authorRef = await createOrFindAuthor(authorSlug)
            authorsRefs.push(authorRef)
          }
        }

        // Upload de l'image de couverture
        let coverImage = null
        if (frontmatter.cover) {
          coverImage = await uploadImage(frontmatter.cover, folder)
        }

        // Convertir le contenu
        const contentBlocks = convertContentToBlocks(content)

        // Créer le document article
        const articleDoc = {
          _type: 'article',
          title: frontmatter.title || 'Sans titre',
          description: frontmatter.description || '',
          slug: { current: folder },
          isDraft: frontmatter.isDraft || false,
          isMainHeadline: frontmatter.isMainHeadline || false,
          isSubHeadline: frontmatter.isSubHeadline || false,
          publishedTime: frontmatter.publishedTime || new Date().toISOString(),
          cover: coverImage,
          categories: [categoryRef], // Toujours une catégorie maintenant
          authors: authorsRefs,
          content: contentBlocks
        }

        console.log(`🚀 Création de l'article dans Sanity...`)

        // Créer l'article dans Sanity
        const result = await client.create(articleDoc)
        console.log(`✅ Article migré avec succès: ${frontmatter.title}`)
        migrated++

      } catch (error) {
        console.error(`❌ Erreur pour ${folder}:`, error.message)
        errors++
      }
    }

    console.log(`\n🎉 Migration terminée!`)
    console.log(`✅ Articles migrés: ${migrated}`)
    console.log(`⏭️  Articles ignorés (existants): ${skipped}`)
    console.log(`❌ Erreurs: ${errors}`)

  } catch (error) {
    console.error('❌ Erreur générale:', error)
  }
}

// Lancer la migration
console.log('🚀 Début de la migration des articles...')
migrateArticles()
