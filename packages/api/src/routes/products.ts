import { Router } from 'express';
import db from '../db.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { generateProductImage } from '../services/imageGenerator.js';

const router = Router();

router.get('/', (req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
  res.json(products);
});

router.get('/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
});

router.post('/', authenticate, requireAdmin, (req: AuthRequest, res) => {
  const { name, description, price, stock, image_url } = req.body;
  const result = db.prepare('INSERT INTO products (name, description, price, stock, image_url) VALUES (?, ?, ?, ?, ?)').run(
    name, description, price, stock, image_url
  );
  res.status(201).json({ id: result.lastInsertRowid, name, description, price, stock, image_url });
});

router.put('/:id', authenticate, requireAdmin, (req: AuthRequest, res) => {
  const { name, description, price, stock, image_url } = req.body;
  db.prepare('UPDATE products SET name = ?, description = ?, price = ?, stock = ?, image_url = ? WHERE id = ?').run(
    name, description, price, stock, image_url, req.params.id
  );
  res.json({ id: req.params.id, name, description, price, stock, image_url });
});

router.delete('/:id', authenticate, requireAdmin, (req: AuthRequest, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

router.post('/generate-image', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { productName, description } = req.body;
    const imageUrl = await generateProductImage(productName, description);
    res.json({ imageUrl });
  } catch (error) {
    res.status(500).json({ error: 'Image generation failed' });
  }
});

export default router;
