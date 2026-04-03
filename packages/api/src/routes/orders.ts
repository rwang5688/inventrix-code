import { Router } from 'express';
import db from '../db.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, (req: AuthRequest, res) => {
  let orders;
  if (req.user?.role === 'admin') {
    orders = db.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email 
      FROM orders o 
      JOIN users u ON o.user_id = u.id 
      ORDER BY o.created_at DESC
    `).all();
  } else {
    orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user?.id);
  }
  res.json(orders);
});

router.get('/:id', authenticate, (req: AuthRequest, res) => {
  const order = db.prepare(`
    SELECT o.*, u.name as user_name, u.email as user_email 
    FROM orders o 
    JOIN users u ON o.user_id = u.id 
    WHERE o.id = ?
  `).get(req.params.id) as any;

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  if (req.user?.role !== 'admin' && order.user_id !== req.user?.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const items = db.prepare(`
    SELECT oi.*, p.name as product_name 
    FROM order_items oi 
    JOIN products p ON oi.product_id = p.id 
    WHERE oi.order_id = ?
  `).all(req.params.id);

  res.json({ ...order, items });
});

router.post('/', authenticate, (req: AuthRequest, res) => {
  const { items } = req.body;

  let subtotal = 0;
  const productUpdates: any[] = [];

  for (const item of items) {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id) as any;
    if (!product || product.stock < item.quantity) {
      return res.status(400).json({ error: `Insufficient stock for product ${item.product_id}` });
    }
    subtotal += product.price * item.quantity;
    productUpdates.push({ id: item.product_id, quantity: item.quantity, price: product.price });
  }

  const gst = subtotal * 0.1;
  const total = subtotal + gst;

  const orderResult = db.prepare('INSERT INTO orders (user_id, subtotal, gst, total, status) VALUES (?, ?, ?, ?, ?)').run(
    req.user?.id, subtotal, gst, total, 'pending'
  );

  const orderId = orderResult.lastInsertRowid;

  for (const update of productUpdates) {
    db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)').run(
      orderId, update.id, update.quantity, update.price
    );
    db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(update.quantity, update.id);
  }

  res.status(201).json({ id: orderId, subtotal, gst, total, status: 'pending' });
});

router.patch('/:id/status', authenticate, requireAdmin, (req: AuthRequest, res) => {
  const { status } = req.body;
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ id: req.params.id, status });
});

export default router;
