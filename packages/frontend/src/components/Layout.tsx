import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '1.5rem 3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', gap: '3rem', alignItems: 'center' }}>
          <Link to="/" style={{ color: 'white', textDecoration: 'none', fontSize: '1.75rem', fontWeight: 'bold', letterSpacing: '-0.5px' }}>✨ Inventrix</Link>
          <Link to="/" style={{ color: 'white', textDecoration: 'none', fontSize: '1rem', opacity: 0.9, transition: 'opacity 0.3s' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.9'}>Store</Link>
          {user && <Link to="/orders" style={{ color: 'white', textDecoration: 'none', fontSize: '1rem', opacity: 0.9, transition: 'opacity 0.3s' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.9'}>My Orders</Link>}
          {user?.role === 'admin' && <Link to="/admin" style={{ color: 'white', textDecoration: 'none', fontSize: '1rem', opacity: 0.9, transition: 'opacity 0.3s' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.9'}>Admin</Link>}
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {user ? (
            <>
              <span style={{ background: 'rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: '20px', fontSize: '0.9rem' }}>👤 {user.name}</span>
              <button onClick={handleLogout} style={{ background: 'white', color: '#667eea', padding: '8px 20px', borderRadius: '20px' }}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" style={{ color: 'white', textDecoration: 'none', padding: '8px 20px', background: 'rgba(255,255,255,0.2)', borderRadius: '20px', transition: 'background 0.3s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}>Login</Link>
              <Link to="/register" style={{ color: '#667eea', textDecoration: 'none', padding: '8px 20px', background: 'white', borderRadius: '20px', fontWeight: '600', transition: 'transform 0.3s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>Register</Link>
            </>
          )}
        </div>
      </nav>
      <main style={{ flex: 1, padding: '3rem', maxWidth: '1400px', width: '100%', margin: '0 auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
