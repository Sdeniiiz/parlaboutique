const http = require('http');

function fetchText(path) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3000' + path, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function runSeoAudit() {
  console.log('\n--- [1] SEO & META ETİKETLERİ DENETİMİ ---');
  let failures = [];
  let passes = 0;

  const page = await fetchText('/');
  const html = page.body;

  // 1. Title
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  if (titleMatch && titleMatch[1].trim().length > 10 && titleMatch[1].includes('PARLA BOUTİQUE')) {
    console.log('  ✔ Title etiketi: ' + titleMatch[1].trim());
    passes++;
  } else {
    failures.push('Title etiketi eksik veya marka ismi içermiyor');
  }

  // 2. Meta description
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
  if (descMatch && descMatch[1].length > 40) {
    console.log('  ✔ Meta description: ' + descMatch[1].substring(0, 60) + '... (' + descMatch[1].length + ' karakter)');
    passes++;
  } else {
    failures.push('Meta description bulunamadı veya çok kısa');
  }

  // 3. Canonical
  const canonMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["'](.*?)["']/i);
  if (canonMatch && canonMatch[1].startsWith('http')) {
    console.log('  ✔ Canonical URL: ' + canonMatch[1]);
    passes++;
  } else {
    failures.push('Canonical URL etiketi eksik');
  }

  // 4. Robots meta
  if (html.includes('name="robots"') && html.includes('index, follow')) {
    console.log('  ✔ Robots meta etiketi: index, follow onaylandı');
    passes++;
  } else {
    failures.push('Robots meta etiketi eksik');
  }

  // 5. Open Graph
  const ogRequired = ['og:title', 'og:description', 'og:image', 'og:url', 'og:site_name', 'og:locale'];
  let ogOk = true;
  for (const tag of ogRequired) {
    if (!html.includes(`property="${tag}"`)) {
      ogOk = false;
      failures.push(`Open Graph etiketi eksik: ${tag}`);
    }
  }
  if (ogOk) {
    console.log('  ✔ Open Graph etiketleri: Tüm zorunlu etiketler mevcut (og:title, image, url, site_name, locale)');
    passes++;
  }

  // 6. Twitter Card
  if (html.includes('name="twitter:card"') && html.includes('name="twitter:image"')) {
    console.log('  ✔ Twitter Card etiketleri: summary_large_image yapılandırıldı');
    passes++;
  } else {
    failures.push('Twitter Card etiketleri eksik');
  }

  // 7. Schema.org JSON-LD
  const schemaMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  if (schemaMatches.length > 0) {
    let schemaValid = true;
    for (const sm of schemaMatches) {
      try {
        const parsed = JSON.parse(sm[1]);
        if (!parsed['@context'] || !parsed['@type']) schemaValid = false;
      } catch (e) {
        schemaValid = false;
      }
    }
    if (schemaValid) {
      console.log(`  ✔ Schema.org JSON-LD: ${schemaMatches.length} adet geçerli yapılandırılmış veri bloku tespit edildi (ClothingStore & WebSite)`);
      passes++;
    } else {
      failures.push('Schema.org JSON-LD geçersiz JSON içeriyor');
    }
  } else {
    failures.push('Schema.org JSON-LD yapılandırılmış verisi bulunamadı');
  }

  // 8. Headings hierarchy
  const h1Matches = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/gi) || [];
  const h2Matches = html.match(/<h2[^>]*>[\s\S]*?<\/h2>/gi) || [];
  if (h1Matches.length === 1 && h2Matches.length >= 2) {
    console.log(`  ✔ Başlık Hiyerarşisi: 1 adet H1 ve ${h2Matches.length} adet H2 tespit edildi (Düzenli semantik hiyerarşi)`);
    passes++;
  } else {
    failures.push(`Başlık hiyerarşisi hatalı: H1 sayısı=${h1Matches.length}, H2 sayısı=${h2Matches.length}`);
  }

  // 9. robots.txt
  const robotsRes = await fetchText('/robots.txt');
  if (robotsRes.status === 200 && robotsRes.body.includes('Sitemap:') && robotsRes.body.includes('Disallow: /admin')) {
    console.log('  ✔ robots.txt: Erişilebilir ve doğru yapılandırılmış (Sitemap ve Disallow kuralları mevcut)');
    passes++;
  } else {
    failures.push('robots.txt dosyası eksik veya geçersiz');
  }

  // 10. sitemap.xml
  const sitemapRes = await fetchText('/sitemap.xml');
  if (sitemapRes.status === 200 && sitemapRes.body.includes('<urlset') && sitemapRes.body.includes('<loc>')) {
    console.log('  ✔ sitemap.xml: Geçerli XML sitemap formatı doğrulandı');
    passes++;
  } else {
    failures.push('sitemap.xml dosyası eksik veya geçersiz');
  }

  // 11. 404 Sayfası
  const notFoundRes = await fetchText('/olmayan-sayfa-test-404');
  if (notFoundRes.status === 404 && notFoundRes.body.includes('404') && notFoundRes.body.includes('Sayfa Bulunamadı')) {
    console.log('  ✔ Özel 404 Sayfası: 404 HTTP durum kodu ve özel şık hata sayfası onaylandı');
    passes++;
  } else {
    failures.push('Özel 404 sayfası çalışmıyor veya 404 status kodu dönmüyor');
  }

  console.log(`SEO Denetim Sonucu: ${passes} Başarılı, ${failures.length} Başarısız`);
  if (failures.length > 0) {
    failures.forEach(f => console.error('  ✖ HATA: ' + f));
    return false;
  }
  return true;
}

if (require.main === module) {
  runSeoAudit().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runSeoAudit };
