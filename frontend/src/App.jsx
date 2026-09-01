import { useEffect, useMemo, useState } from 'react';
import './App.css';
import * as api from './services/api';
import NavBar from './components/NavBar';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import InventarioList from './components/InventarioList';
import Mantenimiento from './components/Mantenimiento';
import Reportes from './components/Reportes';
import Login from './components/Login';
import Usuarios from './components/Usuarios';

const rolePermissions = {
  administrador: {
    canCreateAssets: true,
    canEditAssets: true,
    canDeleteAssets: true,
    canCreateMaintenance: true,
    canDeleteMaintenance: true,
    canManageUsers: true,
  },
  jefatura: {
    canCreateAssets: true,
    canEditAssets: true,
    canDeleteAssets: false,
    canCreateMaintenance: true,
    canDeleteMaintenance: true,
    canManageUsers: false,
  },
  tecnico: {
    canCreateAssets: false,
    canEditAssets: false,
    canDeleteAssets: false,
    canCreateMaintenance: true,
    canDeleteMaintenance: false,
    canManageUsers: false,
  },
};

function App() {
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bienes, setBienes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  const role = currentUser?.rol || 'tecnico';
  const permissions = rolePermissions[role] || rolePermissions.tecnico;

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        const response = await api.refreshSession();
        const token = response.data?.token;

        if (token) {
          api.setAuthToken(token);
        }

        setCurrentUser(response.data.user);
      } catch (error) {
        api.clearAuthToken();
        setCurrentUser(null);
      } finally {
        setAuthReady(true);
      }
    };

    bootstrapAuth();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const bienesResponse = await api.getBienes();
        setBienes(bienesResponse.data);

        if (permissions.canManageUsers) {
          const usuariosResponse = await api.getUsuarios();
          setUsuarios(usuariosResponse.data);
        } else {
          setUsuarios([]);
        }
      } catch (error) {
        console.error('Error cargando datos iniciales:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentUser, permissions.canManageUsers]);

  const fetchBienes = async () => {
    const response = await api.getBienes();
    setBienes(response.data);
  };

  const fetchUsuarios = async () => {
    const response = await api.getUsuarios();
    setUsuarios(response.data);
  };

  const handleLogin = async (email, password) => {
    setAuthLoading(true);
    setAuthError('');

    try {
      const response = await api.login({ email, password });
      api.setAuthToken(response.data.token);
      setCurrentUser(response.data.user);
      setCurrentView('dashboard');
      setSidebarOpen(false);
    } catch (error) {
      setAuthError(error?.response?.data?.error || 'No se pudo iniciar sesión');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    api.logout().catch(() => {});
    api.clearAuthToken();
    setCurrentUser(null);
    setBienes([]);
    setUsuarios([]);
    setCurrentView('dashboard');
    setSidebarOpen(false);
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard bienes={bienes} currentUser={currentUser} />;
      case 'inventario':
        return (
          <InventarioList
            bienes={bienes}
            onRefresh={fetchBienes}
            canCreate={permissions.canCreateAssets}
            canEdit={permissions.canEditAssets}
            canDelete={permissions.canDeleteAssets}
          />
        );
      case 'mantenimiento':
        return (
          <Mantenimiento
            bienes={bienes}
            canCreate={permissions.canCreateMaintenance}
            canDelete={permissions.canDeleteMaintenance}
          />
        );
      case 'reportes':
        return <Reportes currentUser={currentUser} />;
      case 'usuarios':
        return <Usuarios usuarios={usuarios} onRefresh={fetchUsuarios} currentUser={currentUser} />;
      default:
        return <Dashboard bienes={bienes} currentUser={currentUser} />;
    }
  };

  const viewLabels = {
    dashboard: {
      title: 'Dashboard ejecutivo',
      description: 'Resumen general del inventario, mantenimiento y reportes',
    },
    inventario: {
      title: 'Inventario de bienes',
      description: 'Alta, edición y control de activos informáticos',
    },
    mantenimiento: {
      title: 'Mantenimiento',
      description: 'Seguimiento de servicios preventivos y correctivos',
    },
    reportes: {
      title: 'Reportes',
      description: 'Indicadores y exportación de información',
    },
    usuarios: {
      title: 'Gestión de usuarios',
      description: 'Administración de accesos, roles y credenciales',
    },
  };

  const currentMeta = viewLabels[currentView] || viewLabels.dashboard;

  const logout = useMemo(() => handleLogout, []);

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-8 py-10 text-center shadow-2xl backdrop-blur">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-cyan-400" />
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Cargando sesión</p>
          <p className="mt-2 text-sm text-slate-300">Preparando el panel de control</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLogin={handleLogin} loading={authLoading} error={authError} />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.16),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] text-slate-900">
      <NavBar
        currentUser={currentUser}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onLogout={logout}
        searchValue={searchValue}
        onSearchValueChange={setSearchValue}
        title={currentMeta.title}
        description={currentMeta.description}
      />

      <div className="mx-auto flex max-w-[1800px] gap-6 px-4 pb-6 pt-4 lg:px-6">
        <Sidebar
          isOpen={sidebarOpen}
          currentView={currentView}
          onViewChange={setCurrentView}
          onCloseSidebar={() => setSidebarOpen(false)}
          currentUser={currentUser}
        />

        <main className="min-w-0 flex-1">
          <div className="mb-6 rounded-[28px] border border-white/70 bg-white/70 px-6 py-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">Tribunal Constitucional del Perú</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 lg:text-3xl">{currentMeta.title}</h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">{currentMeta.description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-emerald-700">
                  {loading ? 'Sincronizando datos' : 'Sistema operativo'}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 shadow-sm">
                  {new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 shadow-sm">
                  {currentUser.nombre} · {currentUser.rol}
                </div>
              </div>
            </div>
          </div>

          <div className="min-h-[calc(100vh-210px)] rounded-[32px] border border-white/70 bg-white/60 p-4 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur lg:p-6">
            {loading ? (
              <div className="flex min-h-[420px] items-center justify-center">
                <div className="rounded-3xl border border-slate-200 bg-white px-8 py-10 text-center shadow-lg">
                  <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
                  <p className="text-sm font-semibold text-slate-700">Cargando datos...</p>
                  <p className="mt-1 text-sm text-slate-500">Actualizando información del inventario</p>
                </div>
              </div>
            ) : (
              renderView()
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;