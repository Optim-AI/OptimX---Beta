'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { Lock, User, Shield } from 'lucide-react';
import colors from '@/lib/ui/colors';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      // Store token in localStorage
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_username', data.username);

      // Redirect to dashboard
      router.push('/admin/dashboard');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="container">
        <div className="login-card">
          <div className="header">
            <Shield size={48} color={colors.primary} />
            <h1>Admin Login</h1>
            <p>SkalX AI Admin Dashboard</p>
          </div>

          {error && <div className="error-msg">{error}</div>}

          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>
                <User size={18} />
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter admin username"
                required
                autoFocus
              />
            </div>

            <div className="input-group">
              <label>
                <Lock size={18} />
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                required
              />
            </div>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <p className="note">
            Access restricted to authorized administrators only
          </p>
        </div>
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          font-family: Poppins, Inter, system-ui;
        }
        .container {
          width: 100%;
          max-width: 420px;
        }
        .login-card {
          background: white;
          border-radius: 20px;
          padding: 40px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        .header {
          text-align: center;
          margin-bottom: 32px;
        }
        .header h1 {
          font-size: 28px;
          font-weight: 800;
          margin: 16px 0 8px;
          color: #0f172a;
        }
        .header p {
          color: #64748b;
          font-size: 15px;
        }
        .input-group {
          margin-bottom: 20px;
        }
        .input-group label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          margin-bottom: 8px;
        }
        .input-group input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e2e8f0;
          border-radius: 10px;
          font-size: 15px;
          color: #0f172a;
          transition: all 200ms;
        }
        .input-group input:focus {
          outline: none;
          border-color: ${colors.primary};
          box-shadow: 0 0 0 3px ${colors.primary}20;
        }
        .login-btn {
          width: 100%;
          padding: 14px;
          border-radius: 10px;
          background: ${colors.primary};
          color: white;
          font-weight: 700;
          font-size: 16px;
          border: none;
          cursor: pointer;
          transition: all 200ms;
          margin-top: 8px;
        }
        .login-btn:hover:not(:disabled) {
          background: ${colors.primaryHover || '#0073e6'};
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 136, 255, 0.3);
        }
        .login-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .error-msg {
          background: #fef2f2;
          color: #dc2626;
          padding: 12px;
          border-radius: 10px;
          margin-bottom: 20px;
          text-align: center;
          font-weight: 600;
          font-size: 14px;
        }
        .note {
          text-align: center;
          font-size: 12px;
          color: #94a3b8;
          margin-top: 20px;
          margin-bottom: 0;
        }
        @media (max-width: 480px) {
          .login-card {
            padding: 32px 24px;
          }
          .header h1 {
            font-size: 24px;
          }
        }
      `}</style>
    </div>
  );
}
