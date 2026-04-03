import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface InventoryItem {
  id: number;
  name: string;
  stock: number;
  price: number;
  status: string;
}

export default function AdminInventory() {
  const { token } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  useEffect(() => {
    fetch('/api/analytics/inventory', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(setInventory);
  }, [token]);

  const statusColors: Record<string, string> = {
    out_of_stock: '#dc3545',
    low_stock: '#ffc107',
    in_stock: '#28a745'
  };

  const statusLabels: Record<string, string> = {
    out_of_stock: 'Out of Stock',
    low_stock: 'Low Stock',
    in_stock: 'In Stock'
  };

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>Inventory Management</h1>
      <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Product</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Stock</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Price</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}>{item.name}</td>
                <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{item.stock}</td>
                <td style={{ padding: '0.5rem' }}>${item.price.toFixed(2)}</td>
                <td style={{ padding: '0.5rem' }}>
                  <span style={{ padding: '0.25rem 0.75rem', borderRadius: '4px', fontSize: '0.9rem', background: statusColors[item.status], color: 'white' }}>
                    {statusLabels[item.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
