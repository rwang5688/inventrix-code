import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface Order {
  id: number;
  subtotal: number;
  gst: number;
  total: number;
  status: string;
  created_at: string;
}

export default function Orders() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    fetch('/api/orders', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(setOrders);
  }, [token]);

  const statusColors: Record<string, string> = {
    pending: '#ffc107',
    processing: '#17a2b8',
    shipped: '#007bff',
    delivered: '#28a745',
    cancelled: '#dc3545'
  };

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>My Orders</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {orders.map(order => (
          <div key={order.id} style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3>Order #{order.id}</h3>
                <p style={{ color: '#666', fontSize: '0.9rem' }}>{new Date(order.created_at).toLocaleDateString()}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '0.9rem', color: '#666', margin: '0.25rem 0' }}>Subtotal: ${order.subtotal.toFixed(2)}</p>
                <p style={{ fontSize: '0.9rem', color: '#666', margin: '0.25rem 0' }}>GST (10%): ${order.gst.toFixed(2)}</p>
                <p style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Total: ${order.total.toFixed(2)}</p>
                <span style={{ padding: '0.25rem 0.75rem', borderRadius: '4px', fontSize: '0.9rem', background: statusColors[order.status], color: 'white' }}>
                  {order.status}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
