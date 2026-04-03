import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';

const db = new Database('inventrix.db');

export const initDb = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'customer')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      gst REAL NOT NULL,
      total REAL NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  
  if (userCount.count === 0) {
    const adminPassword = bcrypt.hashSync('admin123', 10);
    const customerPassword = bcrypt.hashSync('customer123', 10);
    
    db.prepare('INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)').run(
      'admin@inventrix.com', adminPassword, 'Admin User', 'admin'
    );
    db.prepare('INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)').run(
      'customer@inventrix.com', customerPassword, 'Customer User', 'customer'
    );

    const products = [
      ['Laptop Pro 15"', 'High-performance laptop with 16GB RAM', 1299.99, 25, '/images/laptop.png'],
      ['Wireless Mouse', 'Ergonomic wireless mouse with precision tracking', 29.99, 150, '/images/wireless-mouse.png'],
      ['Mechanical Keyboard', 'RGB backlit mechanical keyboard', 89.99, 75, '/images/mechanical-keyboard.png'],
      ['USB-C Hub', '7-in-1 USB-C hub with HDMI and card reader', 49.99, 100, '/images/usb-hub.png'],
      ['Webcam HD', '1080p HD webcam with auto-focus', 79.99, 60, '/images/webcam.png'],
      ['Monitor 27" 4K', 'Ultra HD 4K monitor with HDR support', 449.99, 40, '/images/monitor.png'],
      ['Desk Lamp LED', 'Adjustable LED desk lamp with touch control', 39.99, 120, '/images/desk-lamp.png'],
      ['Headphones Wireless', 'Noise-cancelling wireless headphones', 199.99, 85, '/images/headphones.png'],
      ['External SSD 1TB', 'Portable solid state drive with USB 3.2', 129.99, 95, '/images/external-ssd.png'],
      ['Laptop Stand', 'Aluminum laptop stand with cooling', 54.99, 110, '/images/laptop-stand.png'],
      ['Tablet 10"', 'Android tablet with stylus support', 349.99, 65, '/images/tablet.png'],
      ['Wireless Charger', 'Fast wireless charging pad 15W', 34.99, 140, '/images/wireless-charger.png'],
      ['Smartwatch', 'Fitness tracking smartwatch with GPS', 249.99, 70, '/images/smartwatch.png'],
      ['Bluetooth Speaker', 'Waterproof portable speaker', 69.99, 90, '/images/bluetooth-speaker.png'],
      ['Smartphone', '5G smartphone with triple camera', 799.99, 50, '/images/smartphone.png'],
      ['Gaming Mouse Pad', 'Extended RGB gaming mouse pad', 24.99, 130, '/images/gaming-mousepad.png'],
      ['Cable Organizer', 'Desktop cable management system', 19.99, 200, '/images/cable-organizer.png'],
      ['Phone Case', 'Protective phone case with kickstand', 14.99, 180, '/images/phone-case.png'],
      ['Screen Protector', 'Tempered glass screen protector', 9.99, 250, '/images/screen-protector.png'],
      ['Power Bank 20000mAh', 'High-capacity portable charger', 44.99, 105, '/images/power-bank.png'],
      ['Gaming Controller', 'Wireless gaming controller with haptic feedback', 59.99, 80, '/images/gaming-controller.png'],
      ['Network Router', 'Dual-band WiFi 6 router with high-speed connectivity', 129.99, 55, '/images/network-router.png'],
      ['Tablet 10"', '10-inch tablet with stylus support and HD display', 299.99, 45, '/images/tablet-10-inch.png'],
      ['Laser Printer', 'Wireless laser printer with duplex printing', 249.99, 35, '/images/laser-printer.png']
    ];

    const insertProduct = db.prepare('INSERT INTO products (name, description, price, stock, image_url) VALUES (?, ?, ?, ?, ?)');
    products.forEach(p => insertProduct.run(...p));
  }
};

export default db;
