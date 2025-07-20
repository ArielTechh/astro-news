 const fs = require('fs');
const path = require('path');

// Fonction pour capitaliser la première lettre de chaque mot
function capitalizeTitle(folderName) {
    return folderName
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

// Fonction principale pour traiter un dossier
function processFolder(folderPath) {
    const folderName = path.basename(folderPath);
    
    try {
        // Lire le contenu du dossier
        const files = fs.readdirSync(folderPath);
        
        // Supprimer tous les fichiers .md
        files.forEach(file => {
            if (file.endsWith('.md')) {
                const filePath = path.join(folderPath, file);
                fs.unlinkSync(filePath);
                console.log(`✓ Supprimé: ${filePath}`);
            }
        });
        
        // Créer le fichier index.json
        const indexPath = path.join(folderPath, 'index.json');
        const indexContent = {
            title: capitalizeTitle(folderName),
            path: folderName.toLowerCase()
        };
        
        fs.writeFileSync(indexPath, JSON.stringify(indexContent, null, 4));
        console.log(`✓ Créé: ${indexPath}`);
        console.log(`  - Title: ${indexContent.title}`);
        console.log(`  - Path: ${indexContent.path}`);
        
    } catch (error) {
        console.error(`❌ Erreur dans le dossier ${folderName}:`, error.message);
    }
}

// Fonction principale
function cleanupFolders(rootDirectory) {
    console.log(`🚀 Début du nettoyage dans: ${rootDirectory}\n`);
    
    try {
        // Lire tous les éléments du dossier racine
        const items = fs.readdirSync(rootDirectory);
        
        items.forEach(item => {
            const itemPath = path.join(rootDirectory, item);
            
            // Vérifier si c'est un dossier
            if (fs.statSync(itemPath).isDirectory()) {
                console.log(`📁 Traitement du dossier: ${item}`);
                processFolder(itemPath);
                console.log(''); // Ligne vide pour la lisibilité
            }
        });
        
        console.log('✅ Nettoyage terminé !');
        
    } catch (error) {
        console.error('❌ Erreur lors de la lecture du dossier racine:', error.message);
    }
}

// Utilisation du script
// Puisque vous êtes déjà dans le bon dossier via CMD
const rootDirectory = './';

cleanupFolders(rootDirectory);
