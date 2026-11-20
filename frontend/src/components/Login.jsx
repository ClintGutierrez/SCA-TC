import { useState } from 'react';
import './Login.css';

export default function Login({ onLogin, forSolicitud, loading, error }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!loading) onLogin(formData.email, formData.password);
  };

  return (
    <main className="login-page">
      <header className="login-identity">
        <div className="login-brand">
          <img src="/sca-tc.svg" alt="" width="44" height="44" />
          <div>
            <p className="login-brand-name">SCA-TC</p>
            <p className="login-institution">Tribunal Constitucional del Perú</p>
          </div>
        </div>
        <p className="login-caption">Gestión de activos informáticos</p>
      </header>

      <section className="login-access" aria-labelledby="login-heading">
        <div className="login-content">
          <h1 id="login-heading">Iniciar sesión</h1>
          {forSolicitud && (
            <p className="login-context">
              Accede con tu cuenta para registrar o consultar solicitudes de TI.
            </p>
          )}

          <form onSubmit={handleSubmit} aria-busy={loading} className="login-form">
            <div>
              <label htmlFor="login-email">Correo electrónico</label>
              <input
                id="login-email"
                type="email"
                name="email"
                autoComplete="username"
                autoCapitalize="none"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label htmlFor="login-password">Contraseña</label>
              <input
                id="login-password"
                type="password"
                name="password"
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            {error && (
              <p role="alert" className="login-error">
                {error}
              </p>
            )}

            {/* Mantiene el foco mientras se valida el acceso. */}
            <button type="submit" aria-disabled={loading || undefined} className="sca-button sca-button-primary login-submit">
              {loading ? 'Ingresando…' : 'Acceder al sistema'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
