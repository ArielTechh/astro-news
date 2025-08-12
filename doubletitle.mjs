// title-checker-fast.js - VERSION RAPIDE
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import fs from 'fs';

class FastTitleChecker {
  constructor(siteUrl) {
    this.siteUrl = siteUrl;
    this.results = new Map();
    this.duplicates = new Map();
    this.errors = [];
  }

  async getSitemapUrls() {
    try {
      // Essayer sitemap-index.xml d'abord
      let sitemapUrl = `${this.siteUrl}/sitemap-index.xml`;
      console.log(`📥 Récupération du sitemap: ${sitemapUrl}`);

      let response = await fetch(sitemapUrl);
      let xml = await response.text();
      let $ = cheerio.load(xml, { xmlMode: true });

      // Si pas de sitemaps trouvés, essayer sitemap.xml direct
      const sitemaps = [];
      $('sitemap loc').each((i, elem) => {
        sitemaps.push($(elem).text());
      });

      if (sitemaps.length === 0) {
        console.log('🔄 Essai sitemap.xml direct...');
        sitemapUrl = `${this.siteUrl}/sitemap.xml`;
        response = await fetch(sitemapUrl);
        xml = await response.text();
        $ = cheerio.load(xml, { xmlMode: true });

        const urls = [];
        $('url loc').each((i, elem) => {
          urls.push($(elem).text());
        });
        return urls;
      }

      // Récupérer toutes les URLs de tous les sitemaps
      const allUrls = [];
      for (const sitemap of sitemaps) {
        try {
          const subResponse = await fetch(sitemap);
          const subXml = await subResponse.text();
          const sub$ = cheerio.load(subXml, { xmlMode: true });

          sub$('url loc').each((i, elem) => {
            allUrls.push(sub$(elem).text());
          });
        } catch (error) {
          console.warn(`⚠️ Erreur sitemap ${sitemap}:`, error.message);
        }
      }

      return allUrls;
    } catch (error) {
      console.error('❌ Erreur sitemap:', error.message);
      return [];
    }
  }

  async checkPageTitle(url) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FastTitleChecker/1.0)'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);
      const title = $('title').text().trim();

      return {
        url,
        title,
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

  async checkAllTitles(urls) {
    // ✅ OPTIMISATIONS MAJEURES
    const BATCH_SIZE = 50; // Plus grand batch
    const DELAY = 500; // Délai plus court
    const MAX_URLS = 1500; // Limiter pour les tests rapides

    // Prendre un échantillon pour test rapide
    const testUrls = urls.slice(0, MAX_URLS);
    console.log(`🔍 Test rapide sur ${testUrls.length} URLs (sur ${urls.length} totales)...`);

    for (let i = 0; i < testUrls.length; i += BATCH_SIZE) {
      const batch = testUrls.slice(i, i + BATCH_SIZE);
      const progress = Math.round((i / testUrls.length) * 100);

      console.log(`📊 Progression: ${progress}% (${i + 1}-${Math.min(i + BATCH_SIZE, testUrls.length)}/${testUrls.length})`);

      // Traitement parallèle du batch
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

      // Petit délai entre batches
      if (i + BATCH_SIZE < testUrls.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY));
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

  generateQuickReport() {
    const report = {
      summary: {
        totalPages: Array.from(this.results.values()).flat().length,
        uniqueTitles: this.results.size,
        duplicateTitles: this.duplicates.size,
        totalDuplicatePages: Array.from(this.duplicates.values()).flat().length,
        errors: this.errors.length
      },
      duplicates: Array.from(this.duplicates.entries())
        .map(([title, pages]) => ({
          title,
          count: pages.length,
          sampleUrls: pages.slice(0, 3).map(p => p.url) // Juste 3 exemples
        }))
        .sort((a, b) => b.count - a.count)
    };

    return report;
  }

  async saveQuickReport() {
    const report = this.generateQuickReport();

    // Affichage console rapide
    console.log('\n📊 RÉSULTAT RAPIDE:');
    console.log(`   - ${report.summary.totalPages} pages analysées`);
    console.log(`   - ${report.summary.uniqueTitles} titres uniques`);
    console.log(`   - ${report.summary.duplicateTitles} titres en doublon`);
    console.log(`   - ${report.summary.totalDuplicatePages} pages affectées`);

    if (report.summary.duplicateTitles > 0) {
      console.log('\n🔥 DOUBLONS DÉTECTÉS:');
      report.duplicates.slice(0, 10).forEach((dup, i) => {
        console.log(`\n${i + 1}. "${dup.title}" (${dup.count} pages)`);
        dup.sampleUrls.forEach(url => console.log(`   - ${url}`));
        if (dup.count > 3) console.log(`   ... et ${dup.count - 3} autres`);
      });
    } else {
      console.log('\n🎉 AUCUN DOUBLON DÉTECTÉ!');
    }

    // Sauvegarder aussi en JSON
    fs.writeFileSync('quick-title-report.json', JSON.stringify(report, null, 2));
    console.log('\n💾 Rapport sauvegardé: quick-title-report.json');

    return report;
  }
}

// FONCTION PRINCIPALE RAPIDE
async function runQuickAudit() {
  const SITE_URL = 'https://techhorizons.co.il';

  console.log('⚡ AUDIT RAPIDE DES TITRES');
  console.log(`🌐 Site: ${SITE_URL}`);

  const checker = new FastTitleChecker(SITE_URL);

  try {
    const startTime = Date.now();

    // 1. URLs
    console.log('\n1️⃣ Récupération URLs...');
    const urls = await checker.getSitemapUrls();

    if (urls.length === 0) {
      console.error('❌ Aucune URL trouvée');
      return;
    }

    console.log(`✅ ${urls.length} URLs trouvées`);

    // 2. Test rapide
    console.log('\n2️⃣ Test rapide des titres...');
    await checker.checkAllTitles(urls);

    // 3. Analyse
    console.log('\n3️⃣ Analyse des doublons...');
    checker.findDuplicates();

    // 4. Rapport
    await checker.saveQuickReport();

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n⏱️ Terminé en ${duration}s`);

  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

// Lancer l'audit rapide
runQuickAudit();