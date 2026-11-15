import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import helmet from 'helmet';
import memorystore from 'memorystore';
import nodemailer from 'nodemailer';

dotenv.config();

const root = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.join(root, 'data', 'products.json');
const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const isProduction = process.env.NODE_ENV === 'production';
const trustProxyHops = process.env.TRUST_PROXY_HOPS === undefined
  ? 0
  : Number(process.env.TRUST_PROXY_HOPS);
const sessionCookieName = isProduction ? '__Host-manoucrea.sid' : 'manoucrea.sid';
const categories = new Set([
  'noel', 'bapteme', 'mariage', 'plaisir-offrir',
  'anniversaire', 'deco', 'bien-etre', 'composition'
]);
const publicFiles = new Set([
  'index.html', 'catalogue.html', 'produit.html', 'admin.html',
  'style.css', 'script.js', 'catalogue.js', 'produit.js', 'admin.js'
]);

if (
  !Number.isInteger(port) || port < 0 || port > 65535 ||
  !Number.isInteger(trustProxyHops) || trustProxyHops < 0 ||
  !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32 ||
  process.env.SESSION_SECRET.startsWith('replace-with-') ||
  !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 16 ||
  process.env.ADMIN_PASSWORD.startsWith('replace-with-')
) {
  console.error('Configuration invalide : vérifiez PORT, TRUST_PROXY_HOPS, SESSION_SECRET (32 caractères minimum) et ADMIN_PASSWORD (16 caractères minimum).');
  process.exit(1);
}

const app = express();
const MemoryStore = memorystore(session);
app.disable('x-powered-by');
app.set('trust proxy', trustProxyHops);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
      styleSrcAttr: ["'none'"],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'https:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: isProduction ? [] : null
    }
  },
  hsts: isProduction ? undefined : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xFrameOptions: { action: 'deny' }
}));
app.use((req, res, next) => {
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use(express.json({ limit: '32kb' }));
app.use(session({
  name: sessionCookieName,
  secret: process.env.SESSION_SECRET,
  store: new MemoryStore({
    checkPeriod: 60 * 60 * 1000,
    max: 500,
    ttl: 8 * 60 * 60 * 1000,
    stale: false
  }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProduction,
    path: '/',
    maxAge: 8 * 60 * 60 * 1000
  }
}));
app.use('/api/admin', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});

function sameOrigin(req, res, next) {
  const expectedOrigin = `${req.protocol}://${req.get('host')}`;
  if (req.get('origin') !== expectedOrigin) {
    return res.status(403).json({ error: 'Requête refusée.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.admin) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }
  next();
}

async function readProducts() {
  return JSON.parse(await fs.readFile(dataFile, 'utf8'));
}

async function writeProducts(products) {
  const temporaryFile = `${dataFile}.tmp`;
  await fs.writeFile(temporaryFile, JSON.stringify(products, null, 2), 'utf8');
  await fs.rename(temporaryFile, dataFile);
}

function normalizeProduct(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Les informations du produit sont invalides.');
  }

  const name = String(input.name || '').trim();
  const ref = String(input.ref || '').trim();
  const category = String(input.category || '').trim();
  const description = String(input.description || '').trim();
  const image = String(input.image || '').trim();
  const price = Number(input.price);

  if (!name || name.length > 120) throw new Error('Le nom est obligatoire (120 caractères maximum).');
  if (!ref || ref.length > 40) throw new Error('La référence est obligatoire (40 caractères maximum).');
  if (!categories.has(category)) throw new Error('Choisissez une catégorie valide.');
  if (!Number.isFinite(price) || price < 0 || price > 100000) throw new Error('Le prix est invalide.');
  if (!description || description.length > 5000) throw new Error('La description est obligatoire (5 000 caractères maximum).');

  let imageUrl;
  try {
    imageUrl = new URL(image);
  } catch {
    throw new Error('L’image doit être une adresse URL complète.');
  }
  if (image.length > 2048 || imageUrl.protocol !== 'https:' || imageUrl.username || imageUrl.password) {
    throw new Error('L’image doit être une adresse HTTPS valide (2 048 caractères maximum).');
  }

  return { name, ref, category, price, description, image };
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false
});
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false
});

app.get('/api/products', async (req, res, next) => {
  try {
    res.json(await readProducts());
  } catch (error) {
    next(error);
  }
});

app.get('/api/products/:id', async (req, res, next) => {
  try {
    const product = (await readProducts()).find(item => item.id === req.params.id);
    if (!product) return res.status(404).json({ error: 'Produit introuvable.' });
    res.json(product);
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/session', (req, res) => {
  res.json({ authenticated: Boolean(req.session.admin) });
});

app.post('/api/admin/login', sameOrigin, loginLimiter, (req, res, next) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (password.length > 1024) return res.status(400).json({ error: 'Mot de passe invalide.' });
  const submittedDigest = crypto.createHash('sha256').update(password).digest();
  const configuredDigest = crypto.createHash('sha256').update(process.env.ADMIN_PASSWORD).digest();
  if (!crypto.timingSafeEqual(submittedDigest, configuredDigest)) {
    return res.status(401).json({ error: 'Mot de passe incorrect.' });
  }

  req.session.regenerate(error => {
    if (error) return next(error);
    req.session.admin = true;
    req.session.save(saveError => {
      if (saveError) return next(saveError);
      res.json({ authenticated: true });
    });
  });
});

app.post('/api/admin/logout', sameOrigin, requireAdmin, (req, res, next) => {
  req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie(sessionCookieName, {
      httpOnly: true,
      sameSite: 'strict',
      secure: isProduction,
      path: '/'
    });
    res.json({ authenticated: false });
  });
});

app.post('/api/admin/products', sameOrigin, requireAdmin, async (req, res, next) => {
  try {
    const product = { id: crypto.randomUUID(), ...normalizeProduct(req.body) };
    const products = await readProducts();
    products.unshift(product);
    await writeProducts(products);
    res.status(201).json(product);
  } catch (error) {
    if (error instanceof Error && !error.code) return res.status(400).json({ error: error.message });
    next(error);
  }
});

app.put('/api/admin/products/:id', sameOrigin, requireAdmin, async (req, res, next) => {
  try {
    const products = await readProducts();
    const index = products.findIndex(item => item.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Produit introuvable.' });
    products[index] = { id: req.params.id, ...normalizeProduct(req.body) };
    await writeProducts(products);
    res.json(products[index]);
  } catch (error) {
    if (error instanceof Error && !error.code) return res.status(400).json({ error: error.message });
    next(error);
  }
});

app.delete('/api/admin/products/:id', sameOrigin, requireAdmin, async (req, res, next) => {
  try {
    const products = await readProducts();
    const remaining = products.filter(item => item.id !== req.params.id);
    if (remaining.length === products.length) return res.status(404).json({ error: 'Produit introuvable.' });
    await writeProducts(remaining);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post('/api/contact', sameOrigin, contactLimiter, async (req, res) => {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const message = String(body.message || '').trim();
  if (
    !name || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name) ||
    !email || email.length > 254 || !message || message.length > 5000
  ) {
    return res.status(400).json({ error: 'Vérifiez les champs du formulaire.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Adresse e-mail invalide.' });
  }

  const requiredMailSettings = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'CONTACT_TO'];
  if (requiredMailSettings.some(key => !process.env[key])) {
    return res.status(503).json({ error: 'L’envoi du formulaire n’est pas encore configuré.' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      disableFileAccess: true,
      disableUrlAccess: true,
      tls: { rejectUnauthorized: true }
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: process.env.CONTACT_TO,
      replyTo: { name, address: email },
      subject: 'Nouveau message reçu via le site ManouCréa',
      text: `Nom : ${name}\nE-mail : ${email}\n\n${message}`
    });
    res.json({ sent: true, message: 'Votre message a bien été envoyé.' });
  } catch (error) {
    console.error('Échec de l’envoi SMTP :', error.message);
    res.status(502).json({ error: 'Le message n’a pas pu être envoyé. Réessayez plus tard.' });
  }
});

app.get(['/','/index.html','/catalogue.html','/produit.html','/admin.html','/style.css','/script.js','/catalogue.js','/produit.js','/admin.js'], (req, res, next) => {
  const requestedFile = req.path === '/' ? 'index.html' : req.path.slice(1);
  if (!publicFiles.has(requestedFile)) return next();
  if (requestedFile === 'admin.html') {
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex, nofollow');
  }
  res.sendFile(path.join(root, requestedFile));
});
app.use('/images', express.static(path.join(root, 'images'), { index: false, dotfiles: 'deny' }));

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  if (error.status === 413) return res.status(413).json({ error: 'La requête est trop volumineuse.' });
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'Le corps JSON de la requête est invalide.' });
  }
  res.status(500).json({ error: 'Une erreur serveur est survenue.' });
});

const server = app.listen(port, '0.0.0.0', () => {
  const address = server.address();
  console.log(`ManouCréa disponible sur http://localhost:${address.port}`);
});
