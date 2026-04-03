import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  image_url: string;
}

export default function AdminProducts() {
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: '', description: '', price: 0, stock: 0, image_url: '' });
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = () => {
    fetch('/api/products')
      .then(res => res.json())
      .then(setProducts);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editing ? `/api/products/${editing.id}` : '/api/products';
    const method = editing ? 'PUT' : 'POST';

    await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(form)
    });

    setForm({ name: '', description: '', price: 0, stock: 0, image_url: '' });
    setEditing(null);
    loadProducts();
  };

  const handleEdit = (product: Product) => {
    setEditing(product);
    setForm(product);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this product?')) return;
    await fetch(`/api/products/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    loadProducts();
  };

  const generateImage = async () => {
    if (!form.name) {
      alert('Please enter a product name first');
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/products/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ productName: form.name, description: form.description })
      });
      const data = await res.json();
      setForm({ ...form, image_url: data.imageUrl });
    } catch (err) {
      alert('Image generation failed');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>Manage Products</h1>

      <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>{editing ? 'Edit Product' : 'Add Product'}</h2>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required />
          <input type="number" step="0.01" placeholder="Price" value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} required />
          <input type="number" placeholder="Stock" value={form.stock} onChange={e => setForm({ ...form, stock: Number(e.target.value) })} required />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input placeholder="Image URL" value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} required style={{ flex: 1 }} />
            <button type="button" onClick={generateImage} disabled={generating} style={{ background: '#28a745', color: 'white', whiteSpace: 'nowrap' }}>
              {generating ? 'Generating...' : 'Generate Image'}
            </button>
          </div>
          {form.image_url && <img src={form.image_url} alt="Preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px' }} />}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="submit" style={{ background: '#007bff', color: 'white', flex: 1 }}>{editing ? 'Update' : 'Add'} Product</button>
            {editing && <button type="button" onClick={() => { setEditing(null); setForm({ name: '', description: '', price: 0, stock: 0, image_url: '' }); }} style={{ background: '#6c757d', color: 'white' }}>Cancel</button>}
          </div>
        </form>
      </div>

      <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Name</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Price</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Stock</th>
              <th style={{ padding: '0.5rem', textAlign: 'left' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map(product => (
              <tr key={product.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}>{product.name}</td>
                <td style={{ padding: '0.5rem' }}>${product.price}</td>
                <td style={{ padding: '0.5rem' }}>{product.stock}</td>
                <td style={{ padding: '0.5rem' }}>
                  <button onClick={() => handleEdit(product)} style={{ background: '#ffc107', marginRight: '0.5rem' }}>Edit</button>
                  <button onClick={() => handleDelete(product.id)} style={{ background: '#dc3545', color: 'white' }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
