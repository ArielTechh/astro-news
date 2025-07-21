// migrate-articles.js
import { createClient } from '@sanity/client'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const client = createClient({
  projectId: '0lbfqiht',
  dataset: 'production',
  token: 'skELxtwtX5WyXnU3QUmHFs0UdBZreTdJ6ivkKWS46IHTXMGaiTTwuj9obXDxArxkYMPv9qNx2s57nDav5xgjx1JHsFIlzFQqnRzWCbMQEoNXCgscLp7asPSVxkj3X2ZGENAGuzClXa5gAsajwqe1Q8qaWAjqpMY4Sdgcr8DFdlnBQ9ydNl3R',
  useCdn: false,
  apiVersion: '2023-05-03'
})

const articlesDir = 'src/content/articles'

// Mappage des catégories (inchangé)
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

// Cache pour éviter de re-uploader les mêmes images
const imageCache = new Map()

// Fonction pour trouver la référence de catégorie (inchangée)
async function findCategoryRef(categorySlug) {
  const mappedSlug = categoryMapping[categorySlug] || categorySlug
  console.log(`🔍 Recherche catégorie: ${categorySlug} → ${mappedSlug}`)

  let category = await client.fetch(`*[_type == "category" && slug.current == $slug][0]`, {
    slug: mappedSlug
  })

  if (!category) {
    console.log(`⚠️  Catégorie non trouvée, création: ${mappedSlug}`)
    const categoryTitle = mappedSlug.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')

    category = await client.create({
      _type: 'category',
      title: categoryTitle,
      slug: { current: mappedSlug },
      description: `Articles de la catégorie ${categoryTitle}`,
      order: 100
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

// Fonction pour créer/trouver un auteur (inchangée)
async function createOrFindAuthor(authorSlug) {
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

// Fonction améliorée pour uploader une image avec cache
async function uploadImage(imagePath, articleFolder) {
  try {
    const fullImagePath = path.join(articlesDir, articleFolder, imagePath)

    // Vérifier le cache
    if (imageCache.has(fullImagePath)) {
      console.log(`📸 Image en cache: ${imagePath}`)
      return imageCache.get(fullImagePath)
    }

    console.log(`📸 Upload image: ${fullImagePath}`)

    if (!fs.existsSync(fullImagePath)) {
      console.log(`⚠️  Image non trouvée: ${fullImagePath}`)
      return null
    }

    const imageBuffer = fs.readFileSync(fullImagePath)
    const imageAsset = await client.assets.upload('image', imageBuffer, {
      filename: path.basename(imagePath)
    })

    const imageObject = {
      _type: 'image',
      asset: {
        _ref: imageAsset._id
      }
    }

    // Mettre en cache
    imageCache.set(fullImagePath, imageObject)
    console.log(`✅ Image uploadée: ${imagePath}`)

    return imageObject
  } catch (error) {
    console.error(`❌ Erreur upload image ${imagePath}:`, error.message)
    return null
  }
}

// Fonction pour parser le contenu MDX et extraire les images
function parseContentAndImages(content, articleFolder) {
  const blocks = []
  const lines = content.split('\n')
  let currentTextBlock = []

  // Regex pour détecter les images markdown et JSX
  const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  const jsxImageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Détecter les titres
    if (line.startsWith('#')) {
      // Ajouter le bloc de texte précédent s'il existe
      if (currentTextBlock.length > 0) {
        blocks.push(createTextBlock(currentTextBlock.join('\n')))
        currentTextBlock = []
      }

      // Ajouter le titre
      const level = line.match(/^#+/)[0].length
      const title = line.replace(/^#+\s*/, '')
      blocks.push(createHeadingBlock(title, level))
      continue
    }

    // Détecter les images markdown
    let imageMatch = markdownImageRegex.exec(line)
    if (imageMatch) {
      // Ajouter le bloc de texte précédent s'il existe
      if (currentTextBlock.length > 0) {
        blocks.push(createTextBlock(currentTextBlock.join('\n')))
        currentTextBlock = []
      }

      const [fullMatch, alt, src] = imageMatch
      blocks.push({
        _type: 'imageBlock',
        imagePath: src,
        alt: alt || '',
        articleFolder: articleFolder
      })

      // Ajouter le reste de la ligne s'il y en a
      const remainingLine = line.replace(fullMatch, '').trim()
      if (remainingLine) {
        currentTextBlock.push(remainingLine)
      }
      continue
    }

    // Détecter les images JSX
    jsxImageRegex.lastIndex = 0 // Reset regex
    imageMatch = jsxImageRegex.exec(line)
    if (imageMatch) {
      // Ajouter le bloc de texte précédent s'il existe
      if (currentTextBlock.length > 0) {
        blocks.push(createTextBlock(currentTextBlock.join('\n')))
        currentTextBlock = []
      }

      const src = imageMatch[1]
      // Extraire l'alt du JSX si présent
      const altMatch = line.match(/alt=["']([^"']+)["']/i)
      const alt = altMatch ? altMatch[1] : ''

      blocks.push({
        _type: 'imageBlock',
        imagePath: src,
        alt: alt,
        articleFolder: articleFolder
      })

      // Ajouter le reste de la ligne s'il y en a
      const remainingLine = line.replace(imageMatch[0], '').trim()
      if (remainingLine) {
        currentTextBlock.push(remainingLine)
      }
      continue
    }

    // Ligne normale - ajouter au bloc de texte
    if (line.trim()) {
      currentTextBlock.push(line)
    } else if (currentTextBlock.length > 0) {
      // Ligne vide - terminer le bloc de texte actuel
      blocks.push(createTextBlock(currentTextBlock.join('\n')))
      currentTextBlock = []
    }
  }

  // Ajouter le dernier bloc de texte s'il existe
  if (currentTextBlock.length > 0) {
    blocks.push(createTextBlock(currentTextBlock.join('\n')))
  }

  return blocks
}

// Fonction pour créer un bloc de texte
function createTextBlock(text) {
  if (!text.trim()) return null

  return {
    _type: 'block',
    _key: Math.random().toString(36).substring(2, 15),
    style: 'normal',
    markDefs: [],
    children: [
      {
        _type: 'span',
        _key: Math.random().toString(36).substring(2, 15),
        text: text.trim(),
        marks: []
      }
    ]
  }
}

// Fonction pour créer un bloc de titre
function createHeadingBlock(text, level) {
  const styles = {
    1: 'h1',
    2: 'h2',
    3: 'h3',
    4: 'h4',
    5: 'h5',
    6: 'h6'
  }

  return {
    _type: 'block',
    _key: Math.random().toString(36).substring(2, 15),
    style: styles[level] || 'h2',
    markDefs: [],
    children: [
      {
        _type: 'span',
        _key: Math.random().toString(36).substring(2, 15),
        text: text.trim(),
        marks: []
      }
    ]
  }
}

// Fonction pour convertir les blocs parsés en blocs Sanity
async function convertParsedBlocksToSanity(parsedBlocks) {
  const sanityBlocks = []

  for (const block of parsedBlocks) {
    if (!block) continue

    if (block._type === 'imageBlock') {
      // Upload de l'image et création du bloc image
      const imageObject = await uploadImage(block.imagePath, block.articleFolder)
      if (imageObject) {
        sanityBlocks.push({
          _type: 'image',
          _key: Math.random().toString(36).substring(2, 15),
          asset: imageObject.asset,
          alt: block.alt
        })
      } else {
        // Si l'image n'a pas pu être uploadée, créer un bloc de texte avec l'info
        sanityBlocks.push(createTextBlock(`[Image non trouvée: ${block.imagePath}]`))
      }
    } else {
      // Bloc de texte normal
      sanityBlocks.push(block)
    }
  }

  return sanityBlocks.filter(block => block !== null)
}

// Fonction principale de migration (modifiée)
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

      if (!fs.statSync(articlePath).isDirectory()) {
        console.log(`⏭️  Ignoré (pas un dossier): ${folder}`)
        continue
      }

      if (!fs.existsSync(mdxPath)) {
        console.log(`⚠️  Pas de index.mdx dans: ${folder}`)
        continue
      }

      try {
        const fileContent = fs.readFileSync(mdxPath, 'utf-8')
        const { data: frontmatter, content } = matter(fileContent)

        console.log(`📝 Traitement: ${frontmatter.title}`)

        // Vérifier si l'article existe déjà ET s'il est complet
        const existingArticle = await client.fetch(`*[_type == "article" && slug.current == $slug][0]{
          _id,
          title,
          content,
          "hasContent": defined(content) && length(content) > 0
        }`, {
          slug: folder
        })

        if (existingArticle && existingArticle.hasContent) {
          console.log(`⏭️  Article existe déjà et est complet, ignoré: ${frontmatter.title}`)
          skipped++
          continue
        } else if (existingArticle && !existingArticle.hasContent) {
          // Article existe mais incomplet - le supprimer et le recréer
          console.log(`🔄 Article incomplet détecté, suppression et recréation: ${frontmatter.title}`)
          await client.delete(existingArticle._id)
        }

        // Traitement des catégories et auteurs (inchangé)
        const categoryRef = await findCategoryRef(frontmatter.category)
        const authorsRefs = []
        if (frontmatter.authors && Array.isArray(frontmatter.authors)) {
          for (const authorSlug of frontmatter.authors) {
            const authorRef = await createOrFindAuthor(authorSlug)
            authorsRefs.push(authorRef)
          }
        }

        // Upload de l'image de couverture
        let coverImage = null
        if (frontmatter.cover) {
          coverImage = await uploadImage(frontmatter.cover, folder)
        }

        // Parser le contenu et les images
        console.log(`🔍 Parsing du contenu et des images...`)
        const parsedBlocks = parseContentAndImages(content, folder)

        console.log(`📊 ${parsedBlocks.length} blocs trouvés`)
        const imageBlocks = parsedBlocks.filter(b => b._type === 'imageBlock')
        if (imageBlocks.length > 0) {
          console.log(`📸 ${imageBlocks.length} images trouvées dans le contenu`)
        }

        // Convertir en blocs Sanity
        const contentBlocks = await convertParsedBlocksToSanity(parsedBlocks)

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
          categories: [categoryRef],
          authors: authorsRefs,
          content: contentBlocks
        }

        console.log(`🚀 Création de l'article dans Sanity...`)
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
    console.log(`📸 Images en cache: ${imageCache.size}`)

  } catch (error) {
    console.error('❌ Erreur générale:', error)
  }
}

// Lancer la migration
console.log('🚀 Début de la migration des articles avec images...')
migrateArticles()