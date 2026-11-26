import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import './LoginPage.css';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm]       = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState({});

  // Already logged in — go straight to dashboard
  if (user) return <Navigate to="/dashboard" replace />;

  const validate = () => {
    const e = {};
    if (!form.username.trim()) e.username = 'Username is required.';
    if (!form.password)        e.password = 'Password is required.';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);

    // Simulate a small network delay
    await new Promise((r) => setTimeout(r, 600));

    const result = login(form.username.trim(), form.password);
    setLoading(false);

    if (result.success) {
      toast.success('Welcome back!');
      navigate('/dashboard');
    } else {
      toast.error(result.message || 'Login failed.');
      setErrors({ form: result.message });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  return (
    <div className="login-page">
      <div className="login-card card fade-in" role="main">
        <div className="login-brand">
          <span className="logo-badge" aria-hidden="true">⚡</span>
          <span>WebTestIQ</span>
        </div>

        <h1 className="login-title">Sign in</h1>
        <p className="login-sub text-secondary">
          Demo credentials: <code>admin</code> / <code>admin123</code>
        </p>

        {errors.form && (
          <div className="form-error-banner" role="alert">{errors.form}</div>
        )}

        <form onSubmit={handleSubmit} noValidate className="login-form">
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={handleChange}
              placeholder="admin"
              aria-describedby={errors.username ? 'username-err' : undefined}
              aria-invalid={!!errors.username}
            />
            {errors.username && (
              <span id="username-err" className="field-error" role="alert">
                {errors.username}
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              aria-describedby={errors.password ? 'password-err' : undefined}
              aria-invalid={!!errors.password}
            />
            {errors.password && (
              <span id="password-err" className="field-error" role="alert">
                {errors.password}
              </span>
            )}
          </div>

          <button
            type="submit"
            className="btn-submit"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? <><span className="spinner" aria-hidden="true" /> Signing in…</> : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
