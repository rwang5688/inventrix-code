import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  image_url: string;
}

export default function ProductDetail() {
  const { id } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then(res => res.json())
      .then(setProduct);
  }, [id]);

  const handleOrder = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          items: [{ product_id: product?.id, quantity }]
        })
      });

      if (res.ok) {
        setMessage('Order placed successfully!');
        setTimeout(() => navigate('/orders'), 2000);
      } else {
        setMessage('Order failed');
      }
    } catch (err) {
      setMessage('Order failed');
    }
  };

  if (!product) return <div>Loading...</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ background: 'white', borderRadius: '8px', padding: '2rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '400px', objectFit: 'cover', borderRadius: '8px', marginBottom: '2rem' }} />
        <h1 style={{ marginBottom: '1rem' }}>{product.name}</h1>
        <p style={{ color: '#666', marginBottom: '2rem' }}>{product.description}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#007bff' }}>${product.price}</span>
          <span style={{ fontSize: '1rem', color: product.stock > 0 ? '#28a745' : '#dc3545' }}>
            {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
          </span>
        </div>
        {product.stock > 0 && (
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <input type="number" min="1" max={product.stock} value={quantity} onChange={e => setQuantity(Number(e.target.value))} style={{ width: '100px' }} />
            <button onClick={handleOrder} style={{ background: '#007bff', color: 'white', flex: 1 }}>Place Order</button>
          </div>
        )}
        {message && <p style={{ marginTop: '1rem', color: message.includes('success') ? '#28a745' : '#dc3545' }}>{message}</p>}
      </div>
    </div>
  );
}
