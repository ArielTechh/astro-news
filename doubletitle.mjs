// title-checker.js
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import fs from 'fs';

class TitleDuplicateChecker {
  constructor(siteUrl) {
    this.siteUrl = siteUrl;
    this.results = new Map();
    this.duplicates = new Map();
    this.errors = [];
  }

  async getSitemapUrls() {
    try {
      const sitemapUrl = `${this.siteUrl}/sitemap-index.xml`;
      console.log(`📥 Récupération du sitemap: ${sitemapUrl}`);

      const response = await fetch(sitemapUrl);
      const xml = await response.text();

      const $ = cheerio.load(xml, { xmlMode: true });
      const urls = [];

      // Sitemap index - récupérer tous les sitemaps
      $('sitemap loc').each((i, elem) => {
        urls.push($(elem).text());
      });

      // Si pas de sitemap index, récupérer directement les URLs
      if (urls.length === 0) {
        $('url loc').each((i, elem) => {
          urls.push($(elem).text());
        });
        return urls;
      }

      // Si c'est un sitemap index, récupérer chaque sitemap
      const allUrls = [];
      for (const sitemapUrl of urls) {
        console.log(`📥 Récupération du sous-sitemap: ${sitemapUrl}`);
        try {
          const subResponse = await fetch(sitemapUrl);
          const subXml = await subResponse.text();
          const sub$ = cheerio.load(subXml, { xmlMode: true });

          sub$('url loc').each((i, elem) => {
            allUrls.push(sub$(elem).text());
          });
        } catch (error) {
          console.warn(`⚠️ Erreur avec le sitemap ${sitemapUrl}:`, error.message);
        }
      }

      return allUrls;
    } catch (error) {
      console.error('❌ Erreur lors de la récupération du sitemap:', error.message);

      // Fallback: essayer sitemap.xml direct
      try {
        console.log('🔄 Tentative avec sitemap.xml...');
        const fallbackUrl = `${this.siteUrl}/sitemap.xml`;
        const response = await fetch(fallbackUrl);
        const xml = await response.text();
        const $ = cheerio.load(xml, { xmlMode: true });
        const urls = [];

        $('url loc').each((i, elem) => {
          urls.push($(elem).text());
        });

        return urls;
      } catch (fallbackError) {
        console.error('❌ Fallback échoué:', fallbackError.message);
        return [];
      }
    }
  }

  async checkPageTitle(url) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TitleChecker/1.0)'
        },
        timeout: 10000 // 10 secondes timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const title = $('title').text().trim();
      const h1 = $('h1').first().text().trim();
      const metaDescription = $('meta[name="description"]').attr('content') || '';

      return {
        url,
        title,
        h1,
        metaDescription,
        titleLength: title.length,
        status: 'success'
      };
    } catch (error) {
      this.errors.push({ url, error: error.message });
      return {
        url,
        title: '',
        error: error.message,
        status: 'error'
      };
    }
  }

  async checkAllTitles(urls, batchSize = 5, delay = 2000) {
    console.log(`🔍 Vérification de ${urls.length} URLs...`);

    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(urls.length / batchSize);

      console.log(`📊 Traitement du batch ${batchNumber}/${totalBatches} (URLs ${i + 1}-${Math.min(i + batchSize, urls.length)})`);

      const promises = batch.map(url => this.checkPageTitle(url));
      const results = await Promise.all(promises);

      // Stocker les résultats
      results.forEach(result => {
        if (result.status === 'success' && result.title) {
          const title = result.title;

          if (!this.results.has(title)) {
            this.results.set(title, []);
          }
          this.results.get(title).push(result);
        }
      });

      // Afficher le progrès
      const successCount = results.filter(r => r.status === 'success').length;
      console.log(`   ✅ ${successCount}/${batch.length} réussies`);

      // Délai entre les batches
      if (i + batchSize < urls.length) {
        console.log(`⏳ Pause de ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  findDuplicates() {
    this.results.forEach((pages, title) => {
      if (pages.length > 1) {
        this.duplicates.set(title, pages);
      }
    });
  }

  generateReport() {
    const report = {
      summary: {
        totalPages: Array.from(this.results.values()).flat().length,
        uniqueTitles: this.results.size,
        duplicateTitles: this.duplicates.size,
        totalDuplicatePages: Array.from(this.duplicates.values()).flat().length,
        errors: this.errors.length
      },
      duplicates: Array.from(this.duplicates.entries()).map(([title, pages]) => ({
        title,
        count: pages.length,
        pages: pages.map(p => ({
          url: p.url,
          titleLength: p.titleLength,
          h1: p.h1
        }))
      })).sort((a, b) => b.count - a.count), // Trier par nombre de doublons
      errors: this.errors,
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  generateRecommendations() {
    const recommendations = [];

    this.duplicates.forEach((pages, title) => {
      if (title === 'Tech Horizons' || (title.includes('Tech Horizons') && title.split('|').length === 1)) {
        recommendations.push({
          type: 'generic_title',
          title,
          issue: 'Titre trop générique',
          solution: 'Ajouter du contexte spécifique à chaque page',
          pages: pages.map(p => p.url)
        });
      }

      if (pages.some(p => p.titleLength > 60)) {
        recommendations.push({
          type: 'long_title',
          title,
          issue: 'Titre trop long pour les SERP',
          solution: 'Raccourcir à moins de 60 caractères',
          pages: pages.filter(p => p.titleLength > 60).map(p => p.url)
        });
      }

      if (pages.some(p => p.titleLength < 30)) {
        recommendations.push({
          type: 'short_title',
          title,
          issue: 'Titre trop court',
          solution: 'Ajouter plus de contexte (30+ caractères)',
          pages: pages.filter(p => p.titleLength < 30).map(p => p.url)
        });
      }
    });

    return recommendations;
  }

  async saveReport(filename = 'title-audit-report.json') {
    const report = this.generateReport();

    // JSON détaillé
    fs.writeFileSync(filename, JSON.stringify(report, null, 2));

    // CSV simple pour Excel
    const csvData = [];
    csvData.push(['Titre', 'Nombre de pages', 'URLs', 'Longueur titre']);

    this.duplicates.forEach((pages, title) => {
      csvData.push([
        title,
        pages.length,
        pages.map(p => p.url).join('; '),
        title.length
      ]);
    });

    const csvContent = csvData.map(row =>
      row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    fs.writeFileSync(filename.replace('.json', '.csv'), csvContent);

    console.log('\n📄 Rapport sauvegardé:');
    console.log(`   - ${filename}`);
    console.log(`   - ${filename.replace('.json', '.csv')}`);
    console.log('\n📊 Résumé:');
    console.log(`   - ${report.summary.totalPages} pages analysées`);
    console.log(`   - ${report.summary.uniqueTitles} titres uniques`);
    console.log(`   - ${report.summary.duplicateTitles} titres en doublon`);
    console.log(`   - ${report.summary.totalDuplicatePages} pages affectées`);
    console.log(`   - ${report.summary.errors} erreurs`);

    if (report.summary.duplicateTitles > 0) {
      console.log('\n🔥 TOP 5 des doublons:');
      report.duplicates.slice(0, 5).forEach((dup, i) => {
        console.log(`   ${i + 1}. "${dup.title}" (${dup.count} pages)`);
      });
    }

    return report;
  }
}

// FONCTION PRINCIPALE
async function runTitleAudit() {
  // 🔧 CONFIGURATION - MODIFIEZ ICI VOTRE URL
  const SITE_URL = 'https://techhorizons.co.il'; // ← Remplacez par votre vraie URL

  console.log('🚀 Démarrage de l\'audit des titres...');
  console.log(`🌐 Site: ${SITE_URL}`);

  const checker = new TitleDuplicateChecker(SITE_URL);

  try {
    // 1. Récupérer toutes les URLs
    console.log('\n1️⃣ Récupération des URLs du sitemap...');
    const urls = await checker.getSitemapUrls();

    if (urls.length === 0) {
      console.error('❌ Aucune URL trouvée dans le sitemap.');
      console.log('💡 Vérifiez que votre sitemap est accessible:');
      console.log(`   - ${SITE_URL}/sitemap-index.xml`);
      console.log(`   - ${SITE_URL}/sitemap.xml`);
      return;
    }

    console.log(`✅ ${urls.length} URLs trouvées`);

    // 2. Vérifier tous les titres
    console.log('\n2️⃣ Vérification des titres...');
    await checker.checkAllTitles(urls);

    // 3. Identifier les doublons
    console.log('\n3️⃣ Analyse des doublons...');
    checker.findDuplicates();

    // 4. Générer et sauvegarder le rapport
    console.log('\n4️⃣ Génération du rapport...');
    const report = await checker.saveReport();

    console.log('\n✅ Audit terminé avec succès!');

    return report;
  } catch (error) {
    console.error('❌ Erreur durant l\'audit:', error);
  }
}

// Lancer l'audit
runTitleAudit();