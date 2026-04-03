import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface Order {
  id: number;
  user_name: string;
  user_email: string;
  subtotal: number;
  gst: number;
  total: number;
  status: string;
  created_at: string;
}

export default function AdminOrders() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = () => {
    fetch('/api/orders', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(setOrders);
  };

  const updateStatus = async (id: number, status: string) => {
    await fetch(`/api/orders/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });
    loadOrders();
  };

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>Manage Orders</h1>
      <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Order ID</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Customer</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Subtotal</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>GST</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Total</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Status</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Date</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}>#{order.id}</td>
                <td style={{ padding: '0.5rem' }}>{order.user_name}</td>
                <td style={{ padding: '0.5rem' }}>${order.subtotal.toFixed(2)}</td>
                <td style={{ padding: '0.5rem' }}>${order.gst.toFixed(2)}</td>
                <td style={{ padding: '0.5rem' }}>${order.total.toFixed(2)}</td>
                <td style={{ padding: '0.5rem' }}>{order.status}</td>
                <td style={{ padding: '0.5rem' }}>{new Date(order.created_at).toLocaleDateString()}</td>
                <td style={{ padding: '0.5rem' }}>
                  <select value={order.status} onChange={e => updateStatus(order.id, e.target.value)} style={{ padding: '0.25rem' }}>
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
