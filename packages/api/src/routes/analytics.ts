import { Router } from 'express';
import db from '../db.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/dashboard', authenticate, requireAdmin, (req: AuthRequest, res) => {
  const totalRevenue = db.prepare("SELECT COALESCE(SUM(total), 0) as revenue FROM orders WHERE status != 'cancelled'").get() as any;
  const totalOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get() as any;
  const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get() as any;
  const lowStock = db.prepare('SELECT COUNT(*) as count FROM products WHERE stock < 10').get() as any;

  const recentOrders = db.prepare(`
    SELECT o.id, o.total, o.status, o.created_at, u.name as user_name 
    FROM orders o 
    JOIN users u ON o.user_id = u.id 
    ORDER BY o.created_at DESC 
    LIMIT 10
  `).all();

  const topProducts = db.prepare(`
    SELECT p.name, SUM(oi.quantity) as total_sold, SUM(oi.quantity * oi.price) as revenue
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    GROUP BY p.id
    ORDER BY total_sold DESC
    LIMIT 5
  `).all();

  const ordersByStatus = db.prepare(`
    SELECT status, COUNT(*) as count 
    FROM orders 
    GROUP BY status
  `).all();

  res.json({
    summary: {
      totalRevenue: totalRevenue.revenue,
      totalOrders: totalOrders.count,
      totalProducts: totalProducts.count,
      lowStockItems: lowStock.count
    },
    recentOrders,
    topProducts,
    ordersByStatus
  });
});

router.get('/inventory', authenticate, requireAdmin, (req: AuthRequest, res) => {
  const inventory = db.prepare(`
    SELECT id, name, stock, price, 
    CASE 
      WHEN stock = 0 THEN 'out_of_stock'
      WHEN stock < 10 THEN 'low_stock'
      ELSE 'in_stock'
    END as status
    FROM products
    ORDER BY stock ASC
  `).all();

  res.json(inventory);
});

export default router;
