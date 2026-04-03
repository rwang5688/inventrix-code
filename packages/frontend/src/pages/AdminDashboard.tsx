import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Analytics {
  summary: {
    totalRevenue: number;
    totalOrders: number;
    totalProducts: number;
    lowStockItems: number;
  };
  recentOrders: any[];
  topProducts: any[];
  ordersByStatus: any[];
}

export default function AdminDashboard() {
  const { token } = useAuth();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  useEffect(() => {
    fetch('/api/analytics/dashboard', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(setAnalytics);
  }, [token]);

  if (!analytics) return <div>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Admin Dashboard</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link to="/admin/products"><button style={{ background: '#007bff', color: 'white' }}>Manage Products</button></Link>
          <Link to="/admin/orders"><button style={{ background: '#007bff', color: 'white' }}>Manage Orders</button></Link>
          <Link to="/admin/inventory"><button style={{ background: '#007bff', color: 'white' }}>Inventory</button></Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h3 style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Total Revenue</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#28a745' }}>${analytics.summary.totalRevenue.toFixed(2)}</p>
        </div>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h3 style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Total Orders</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#007bff' }}>{analytics.summary.totalOrders}</p>
        </div>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h3 style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Total Products</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#17a2b8' }}>{analytics.summary.totalProducts}</p>
        </div>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h3 style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Low Stock Items</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc3545' }}>{analytics.summary.lowStockItems}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginBottom: '1rem' }}>Recent Orders</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Order ID</th>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Customer</th>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Total</th>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {analytics.recentOrders.map(order => (
                <tr key={order.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.5rem' }}>#{order.id}</td>
                  <td style={{ padding: '0.5rem' }}>{order.user_name}</td>
                  <td style={{ padding: '0.5rem' }}>${order.total.toFixed(2)}</td>
                  <td style={{ padding: '0.5rem' }}>{order.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginBottom: '1rem' }}>Top Products</h2>
          {analytics.topProducts.map((product, i) => (
            <div key={i} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #eee' }}>
              <p style={{ fontWeight: 'bold' }}>{product.name}</p>
              <p style={{ fontSize: '0.9rem', color: '#666' }}>Sold: {product.total_sold} | Revenue: ${product.revenue.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
