const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, 'data', 'products.json');
const UPLOAD_DIR = path.join(__dirname, 'public', 'images', 'uploads');
const PRODUCTS_IMG_DIR = path.join(__dirname, 'public', 'images', 'products');
const INSTAGRAM_MEDIA_DIR = path.join(__dirname, 'instagram_medya');

// Ensure directories exist
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(PRODUCTS_IMG_DIR, { recursive: true });
fs.mkdirSync(INSTAGRAM_MEDIA_DIR, { recursive: true });

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/instagram_medya', express.static(INSTAGRAM_MEDIA_DIR));

// Helper to read and write database safely
function readData() {
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function slugify(text) {
  const trMap = {
    'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ı': 'i', 'İ': 'i',
    'ö': 'o', 'Ö': 'o', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u'
  };
  return String(text || '')
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, m => trMap[m] || m)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Normalize product payload to ensure variants (colors & sizes), feature flags, and images are well-formed
function normalizeProduct(payload, existing = null, allCategories = []) {
  const id = existing ? existing.id : ('prd-' + Date.now());
  const title = (payload.title || 'Yeni Ürün').trim();
  const category = payload.category || 'bluz';
  const defaultCategoryNames = {
    takim: 'Takım',
    bluz: 'Bluz',
    triko: 'Triko & Sweatshirt',
    kaban: 'Ceket & Kaban',
    aksesuar: 'Aksesuar'
  };
  const foundCat = (allCategories || []).find(c => c.id === category || c.slug === category);

  // Feature toggles: allow disabling colors, sizes, fabric info, or description per product
  const hasColors = payload.hasColors !== undefined
    ? Boolean(payload.hasColors)
    : (existing && existing.hasColors !== undefined ? Boolean(existing.hasColors) : true);

  const hasSizes = payload.hasSizes !== undefined
    ? Boolean(payload.hasSizes)
    : (existing && existing.hasSizes !== undefined
        ? Boolean(existing.hasSizes)
        : (foundCat && foundCat.defaultHasSizes !== undefined ? Boolean(foundCat.defaultHasSizes) : category !== 'aksesuar'));

  const hasFabricInfo = payload.hasFabricInfo !== undefined
    ? Boolean(payload.hasFabricInfo)
    : (existing && existing.hasFabricInfo !== undefined
        ? Boolean(existing.hasFabricInfo)
        : Boolean(payload.fabricInfo || (existing && existing.fabricInfo)));

  const hasDescription = payload.hasDescription !== undefined
    ? Boolean(payload.hasDescription)
    : (existing && existing.hasDescription !== undefined
        ? Boolean(existing.hasDescription)
        : Boolean(payload.description || (existing && existing.description)));

  const rawVariants = Array.isArray(payload.variants) && payload.variants.length > 0
    ? payload.variants
    : [
        {
          id: `${id}-var-1`,
          colorName: hasColors ? 'Standart' : '',
          colorHex: '#141210',
          trendyolUrl: (payload.trendyolUrl || '').trim(),
          images: Array.isArray(payload.images) ? payload.images : [],
          sizes: hasSizes ? [{ size: 'S', inStock: true }, { size: 'M', inStock: true }, { size: 'L', inStock: true }] : []
        }
      ];

  // If hasColors is disabled, keep only 1 variant container for the product's photos & sizes
  const effectiveVariants = (hasColors ? rawVariants : [rawVariants[0]]).map((v, idx) => ({
    id: v.id || `${id}-var-${idx + 1}`,
    colorName: hasColors ? (v.colorName || 'Standart').trim() : '',
    colorHex: v.colorHex || '#141210',
    trendyolUrl: (v.trendyolUrl || payload.trendyolUrl || '').trim(),
    images: Array.isArray(v.images)
      ? v.images.map(img => String(img).trim()).filter(Boolean)
      : [],
    sizes: hasSizes
      ? (Array.isArray(v.sizes) && v.sizes.length > 0
          ? v.sizes.map(s => ({
              size: String(s.size || 'Standart').trim(),
              inStock: s.inStock !== false
            }))
          : [])
      : []
  }));

  return {
    id,
    code: (payload.code || (existing && existing.code) || `PB-${Math.floor(100 + Math.random() * 900)}`).trim(),
    title,
    slug: slugify(title),
    category,
    categoryName: payload.categoryName || (foundCat && foundCat.name) || defaultCategoryNames[category] || category,
    price: Number(payload.price) || 0,
    oldPrice: payload.oldPrice ? Number(payload.oldPrice) : null,
    isNew: payload.isNew !== undefined ? Boolean(payload.isNew) : true,
    featured: payload.featured !== undefined ? Boolean(payload.featured) : true,
    hasColors,
    hasSizes,
    hasFabricInfo,
    hasDescription,
    description: hasDescription ? (payload.description || '').trim() : '',
    fabricInfo: hasFabricInfo ? (payload.fabricInfo || '').trim() : '',
    instagramPostUrl: (payload.instagramPostUrl || (existing && existing.instagramPostUrl) || 'https://www.instagram.com/parlaboutiqesamsun/').trim(),
    trendyolUrl: (payload.trendyolUrl || (effectiveVariants[0] && effectiveVariants[0].trendyolUrl) || 'https://www.trendyol.com/magaza/parlaboutuqueee-m-1358216?sst=0&sk=1').trim(),
    variants: effectiveVariants,
    createdAt: existing ? existing.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// GET full catalog
app.get('/api/catalog', (req, res) => {
  try {
    const data = readData();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Veri okunamadı', details: err.message });
  }
});

// GET products with optional filters
app.get('/api/products', (req, res) => {
  try {
    const data = readData();
    let products = data.products || [];
    const { category, search, color, size } = req.query;

    if (category && category !== 'all') {
      products = products.filter(p => p.category === category);
    }
    if (search) {
      const q = search.toLowerCase();
      products = products.filter(p =>
        p.title.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(q))
      );
    }
    if (color) {
      const c = color.toLowerCase();
      products = products.filter(p =>
        (p.variants || []).some(v => v.colorName.toLowerCase().includes(c))
      );
    }
    if (size) {
      const s = size.toLowerCase();
      products = products.filter(p =>
        (p.variants || []).some(v =>
          (v.sizes || []).some(sz => sz.size.toLowerCase() === s && sz.inStock)
        )
      );
    }
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: 'Ürünler listelenemedi', details: err.message });
  }
});

// GET single product
app.get('/api/products/:id', (req, res) => {
  try {
    const data = readData();
    const product = (data.products || []).find(p => p.id === req.params.id || p.slug === req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Ürün bulunamadı' });
    }
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Ürün getirilemedi', details: err.message });
  }
});

// POST create product
app.post('/api/products', (req, res) => {
  try {
    const data = readData();
    const newProduct = normalizeProduct(req.body, null, data.categories || []);
    data.products.unshift(newProduct);
    writeData(data);
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(500).json({ error: 'Ürün eklenemedi', details: err.message });
  }
});

// PUT update product (images, variants, colors, sizes, trendyolUrl, details)
app.put('/api/products/:id', (req, res) => {
  try {
    const data = readData();
    const idx = (data.products || []).findIndex(p => p.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Güncellenecek ürün bulunamadı' });
    }
    const updated = normalizeProduct(req.body, data.products[idx], data.categories || []);
    data.products[idx] = updated;
    writeData(data);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Ürün güncellenemedi', details: err.message });
  }
});

// CATEGORIES CRUD ENDPOINTS
app.get('/api/categories', (req, res) => {
  try {
    const data = readData();
    res.json(data.categories || []);
  } catch (err) {
    res.status(500).json({ error: 'Kategoriler okunamadı', details: err.message });
  }
});

app.post('/api/categories', (req, res) => {
  try {
    const data = readData();
    data.categories = data.categories || [];
    const name = (req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ error: 'Kategori adı zorunludur' });
    }
    let slug = slugify(req.body.slug || name);
    if (!slug) slug = 'kategori-' + Date.now();

    // Ensure unique slug/id
    if (data.categories.some(c => c.id === slug || c.slug === slug)) {
      slug = `${slug}-${Date.now().toString().slice(-3)}`;
    }

    const newCat = {
      id: slug,
      name,
      slug,
      image: (req.body.image || '/images/brand/parla-logo.jpg').trim(),
      featured: req.body.featured !== undefined ? Boolean(req.body.featured) : true,
      defaultHasColors: req.body.defaultHasColors !== undefined ? Boolean(req.body.defaultHasColors) : true,
      defaultHasSizes: req.body.defaultHasSizes !== undefined ? Boolean(req.body.defaultHasSizes) : true,
      defaultHasFabricInfo: req.body.defaultHasFabricInfo !== undefined ? Boolean(req.body.defaultHasFabricInfo) : true,
      defaultHasDescription: req.body.defaultHasDescription !== undefined ? Boolean(req.body.defaultHasDescription) : true
    };

    data.categories.push(newCat);
    writeData(data);
    res.status(201).json(newCat);
  } catch (err) {
    res.status(500).json({ error: 'Kategori eklenemedi', details: err.message });
  }
});

app.put('/api/categories/:id', (req, res) => {
  try {
    const data = readData();
    data.categories = data.categories || [];
    const idx = data.categories.findIndex(c => c.id === req.params.id || c.slug === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Kategori bulunamadı' });
    }
    const existing = data.categories[idx];
    const updatedName = req.body.name !== undefined ? String(req.body.name).trim() : existing.name;
    const updated = {
      ...existing,
      name: updatedName || existing.name,
      image: req.body.image !== undefined ? String(req.body.image).trim() : existing.image,
      featured: req.body.featured !== undefined ? Boolean(req.body.featured) : existing.featured,
      defaultHasColors: req.body.defaultHasColors !== undefined ? Boolean(req.body.defaultHasColors) : (existing.defaultHasColors !== false),
      defaultHasSizes: req.body.defaultHasSizes !== undefined ? Boolean(req.body.defaultHasSizes) : (existing.defaultHasSizes !== false),
      defaultHasFabricInfo: req.body.defaultHasFabricInfo !== undefined ? Boolean(req.body.defaultHasFabricInfo) : (existing.defaultHasFabricInfo !== false),
      defaultHasDescription: req.body.defaultHasDescription !== undefined ? Boolean(req.body.defaultHasDescription) : (existing.defaultHasDescription !== false)
    };
    data.categories[idx] = updated;

    // Also update categoryName in matching products
    (data.products || []).forEach(p => {
      if (p.category === existing.id || p.category === existing.slug) {
        p.categoryName = updated.name;
      }
    });

    writeData(data);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Kategori güncellenemedi', details: err.message });
  }
});

app.delete('/api/categories/:id', (req, res) => {
  try {
    const data = readData();
    data.categories = data.categories || [];
    const initialLen = data.categories.length;
    data.categories = data.categories.filter(c => c.id !== req.params.id && c.slug !== req.params.id);
    if (data.categories.length === initialLen) {
      return res.status(404).json({ error: 'Silinecek kategori bulunamadı' });
    }
    writeData(data);
    res.json({ success: true, deletedId: req.params.id });
  } catch (err) {
    res.status(500).json({ error: 'Kategori silinemedi', details: err.message });
  }
});

// PATCH quick update Trendyol link(s)
app.patch('/api/products/:id/trendyol', (req, res) => {
  try {
    const data = readData();
    const product = (data.products || []).find(p => p.id === req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Ürün bulunamadı' });
    }
    if (typeof req.body.trendyolUrl === 'string') {
      product.trendyolUrl = req.body.trendyolUrl.trim();
    }
    if (Array.isArray(req.body.variantLinks)) {
      req.body.variantLinks.forEach(vl => {
        const v = (product.variants || []).find(item => item.id === vl.variantId);
        if (v && typeof vl.trendyolUrl === 'string') {
          v.trendyolUrl = vl.trendyolUrl.trim();
        }
      });
    }
    product.updatedAt = new Date().toISOString();
    writeData(data);
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Trendyol bağlantısı güncellenemedi', details: err.message });
  }
});

// DELETE product
app.delete('/api/products/:id', (req, res) => {
  try {
    const data = readData();
    const initialLen = (data.products || []).length;
    data.products = (data.products || []).filter(p => p.id !== req.params.id);
    if (data.products.length === initialLen) {
      return res.status(404).json({ error: 'Silinecek ürün bulunamadı' });
    }
    writeData(data);
    res.json({ success: true, deletedId: req.params.id });
  } catch (err) {
    res.status(500).json({ error: 'Ürün silinemedi', details: err.message });
  }
});

// POST upload image (base64 dataUrl)
app.post('/api/upload', (req, res) => {
  try {
    const { filename, dataUrl } = req.body;
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Geçersiz görsel formatı' });
    }
    const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Görsel verisi çözümlenemedi' });
    }
    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const cleanBase = slugify(path.parse(filename || 'urun-gorsel').name) || 'gorsel';
    const finalName = `${cleanBase}-${Date.now()}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, finalName);
    fs.writeFileSync(filePath, buffer);
    res.json({ url: `/images/uploads/${finalName}`, filename: finalName });
  } catch (err) {
    res.status(500).json({ error: 'Görsel yüklenemedi', details: err.message });
  }
});

// GET available media library images
app.get('/api/media', (req, res) => {
  try {
    const listDir = (dir, prefix) => {
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir)
        .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
        .map(f => `${prefix}/${f}`);
    };
    const images = [
      ...listDir(PRODUCTS_IMG_DIR, '/images/products'),
      ...listDir(UPLOAD_DIR, '/images/uploads'),
      ...listDir(INSTAGRAM_MEDIA_DIR, '/instagram_medya')
    ];
    res.json({ images });
  } catch (err) {
    res.status(500).json({ error: 'Görsel kütüphanesi okunamadı', details: err.message });
  }
});

// Update general site settings
app.put('/api/settings', (req, res) => {
  try {
    const data = readData();
    data.settings = { ...data.settings, ...req.body };
    writeData(data);
    res.json(data.settings);
  } catch (err) {
    res.status(500).json({ error: 'Ayarlar kaydedilemedi', details: err.message });
  }
});

// Admin route alias
app.get(['/admin', '/yonetim'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`PARLA BOUTİQUE - Tarzınla Parla sunucusu çalışıyor: http://localhost:${PORT}`);
  console.log(`Yönetim Paneli: http://localhost:${PORT}/admin`);
});
