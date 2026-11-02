const { chromium } = require('playwright');

const VIEWPORTS = [
  { name: '320px Küçük Telefon (iPhone SE 1. Nesil)', width: 320, height: 568 },
  { name: '375px Standart Telefon (iPhone SE/Mini)', width: 375, height: 667 },
  { name: '390px Modern Telefon (iPhone 13/14/15)', width: 390, height: 844 },
  { name: '430px Büyük Telefon (iPhone Pro Max)', width: 430, height: 932 },
  { name: '768px Tablet Dikey (iPad Mini/Air)', width: 768, height: 1024 },
  { name: '1024px Tablet Yatay / Küçük Laptop', width: 1024, height: 768 },
  { name: '1366px Standart Laptop', width: 1366, height: 768 },
  { name: '1920px Full HD Masaüstü', width: 1920, height: 1080 }
];

async function runDeviceResponsiveAudit() {
  console.log('\n--- [2] MOBİL VE CİHAZ UYUMLULUĞU DENETİMİ (PLAYWRIGHT) ---');
  let failures = [];
  let passes = 0;

  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  } catch (err) {
    console.log('Sistem Chrome bulunamadı, varsayılan Chromium deneniyor...');
    browser = await chromium.launch({ headless: true });
  }

  const context = await browser.newContext();
  const page = await context.newPage();

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);

    // 1. Check for horizontal overflow
    const overflowInfo = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      const scrollW = document.documentElement.scrollWidth;
      const bodyScrollW = document.body.scrollWidth;
      const hasOverflow = scrollW > docW || bodyScrollW > docW;
      
      // Find offending element if any
      let offendingEl = null;
      if (hasOverflow) {
        document.querySelectorAll('*').forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.right > docW + 2) {
            const cls = typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '';
            offendingEl = el.tagName + cls;
          }
        });
      }

      return { docW, scrollW, bodyScrollW, hasOverflow, offendingEl };
    });

    if (!overflowInfo.hasOverflow) {
      console.log(`  ✔ [${vp.name}] Yatay taşma yok (Genişlik: ${vp.width}px, Scroll: ${overflowInfo.scrollW}px)`);
      passes++;
    } else {
      const msg = `[${vp.name}] Yatay taşma tespit edildi! Viewport: ${vp.width}px, ScrollWidth: ${overflowInfo.scrollW}px (Taşan öğe: ${overflowInfo.offendingEl || 'bilinmiyor'})`;
      failures.push(msg);
      console.error(`  ✖ ${msg}`);
    }

    // 2. On mobile screens (<= 768px), verify mobile hamburger menu
    if (vp.width <= 768) {
      const menuBtnVisible = await page.isVisible('#mobileMenuBtn');
      if (menuBtnVisible) {
        // Click to open
        await page.click('#mobileMenuBtn');
        await page.waitForTimeout(150);
        const isOpen = await page.evaluate(() => {
          const d = document.getElementById('mobileDrawer');
          return d && d.classList.contains('open');
        });
        if (isOpen) {
          passes++;
          // Close it
          const closeBtn = await page.$('#mobileDrawerClose');
          if (closeBtn) {
            await closeBtn.click();
            await page.waitForTimeout(150);
          } else {
            await page.click('#mobileMenuBtn');
          }
        } else {
          failures.push(`[${vp.name}] Mobil menü butonu tıklandığında çekmece açılmadı`);
        }
      }
    }
  }

  // 3. Test modal dialog on smallest viewport (320px)
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  
  // Click first product card
  const firstCard = await page.$('.product-card .product-media');
  if (firstCard) {
    await firstCard.click();
    await page.waitForTimeout(400);

    const modalCheck = await page.evaluate(() => {
      const backdrop = document.getElementById('productModalBackdrop');
      const content = document.getElementById('productModalContent');
      const isVisible = backdrop && window.getComputedStyle(backdrop).display !== 'none';
      const cRect = content ? content.getBoundingClientRect() : null;
      return { isVisible, cRect, docW: document.documentElement.clientWidth };
    });

    if (modalCheck.isVisible && modalCheck.cRect && modalCheck.cRect.width <= 320) {
      console.log('  ✔ [320px Modal Testi] Ürün detay modalı dar ekranda taşmadan düzgün açıldı');
      passes++;
    } else {
      failures.push('320px ekranda ürün modalı taşma yaptı veya açılmadı');
    }

    // Close modal via Escape key
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const isClosed = await page.evaluate(() => {
      const backdrop = document.getElementById('productModalBackdrop');
      return !backdrop || window.getComputedStyle(backdrop).display === 'none';
    });
    if (isClosed) {
      console.log('  ✔ [Modal Klavye Erişilebilirliği] Escape tuşuyla modal başarıyla kapandı');
      passes++;
    } else {
      failures.push('Escape tuşu modalı kapatmadı');
    }
  }

  await browser.close();

  console.log(`Mobil & Cihaz Denetim Sonucu: ${passes} Başarılı, ${failures.length} Başarısız`);
  return failures.length === 0;
}

if (require.main === module) {
  runDeviceResponsiveAudit().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runDeviceResponsiveAudit };
