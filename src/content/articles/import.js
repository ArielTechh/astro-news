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

// Fonction pour trouver la référence de catégorie
async function findCategoryRef(categorySlug) {
  const category = await client.fetch(`*[_type == "category" && slug.current == $slug][0]`, {
    slug: categorySlug
  })
  return category ? { _ref: category._id } : null
}

// Fonction pour créer/trouver un auteur
async function createOrFindAuthor(authorSlug) {
  // Vérifier si l'auteur existe
  let author = await client.fetch(`*[_type == "author" && slug.current == $slug][0]`, {
    slug: authorSlug
  })

  if (!author) {
    // Créer l'auteur s'il n'existe pas
    const authorName = authorSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    author = await client.create({
      _type: 'author',
      name: authorName,
      slug: { current: authorSlug }
    })
    console.log(`✅ Auteur créé: ${authorName}`)
  }

  return { _ref: author._id }
}

// Fonction pour uploader une image
async function uploadImage(imagePath, articleFolder) {
  try {
    const fullImagePath = path.join(articlesDir, articleFolder, imagePath)

    if (!fs.existsSync(fullImagePath)) {
      console.log(`⚠️  Image non trouvée: ${fullImagePath}`)
      return null
    }

    const imageBuffer = fs.readFileSync(fullImagePath)
    const imageAsset = await client.assets.upload('image', imageBuffer, {
      filename: path.basename(imagePath)
    })

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

// Fonction principale de migration
async function migrateArticles() {
  try {
    const articleFolders = fs.readdirSync(articlesDir)
    console.log(`📁 ${articleFolders.length} dossiers d'articles trouvés`)

    let migrated = 0
    let errors = 0

    for (const folder of articleFolders) {
      const articlePath = path.join(articlesDir, folder)
      const mdxPath = path.join(articlePath, 'index.mdx')

      // Vérifier si le fichier MDX existe
      if (!fs.existsSync(mdxPath)) {
        console.log(`⚠️  Pas de index.mdx dans ${folder}`)
        continue
      }

      try {
        // Lire et parser le fichier MDX
        const fileContent = fs.readFileSync(mdxPath, 'utf-8')
        const { data: frontmatter, content } = matter(fileContent)

        console.log(`📝 Migration: ${frontmatter.title}`)

        // Trouver la catégorie
        const categoryRef = await findCategoryRef(frontmatter.category)
        if (!categoryRef) {
          console.log(`⚠️  Catégorie non trouvée: ${frontmatter.category}`)
        }

        // Créer/trouver les auteurs
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

        // Créer le document article
        const articleDoc = {
          _type: 'article',
          title: frontmatter.title,
          description: frontmatter.description,
          slug: { current: folder }, // Le nom du dossier comme slug
          isDraft: frontmatter.isDraft || false,
          isMainHeadline: frontmatter.isMainHeadline || false,
          isSubHeadline: frontmatter.isSubHeadline || false,
          publishedTime: frontmatter.publishedTime,
          cover: coverImage,
          categories: categoryRef ? [categoryRef] : [],
          authors: authorsRefs,
          content: [
            {
              _type: 'block',
              _key: 'content',
              style: 'normal',
              children: [
                {
                  _type: 'span',
                  text: content
                }
              ]
            }
          ]
        }

        // Créer l'article dans Sanity
        await client.create(articleDoc)
        console.log(`✅ Migré: ${frontmatter.title}`)
        migrated++

      } catch (error) {
        console.error(`❌ Erreur pour ${folder}:`, error.message)
        errors++
      }
    }

    console.log(`\n🎉 Migration terminée!`)
    console.log(`✅ Articles migrés: ${migrated}`)
    console.log(`❌ Erreurs: ${errors}`)

  } catch (error) {
    console.error('❌ Erreur générale:', error)
  }
}

// Lancer la migration
migrateArticles()