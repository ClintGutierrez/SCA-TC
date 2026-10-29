import { useEffect, useMemo, useState } from 'react';
import './App.css';
import * as api from './services/api';
import NavBar from './components/NavBar';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import InventarioList from './components/InventarioList';
import RegistrarBien from './components/RegistrarBien';
import Mantenimiento from './components/Mantenimiento';
import Reportes from './components/Reportes';
import Login from './components/Login';
import Usuarios from './components/Usuarios';
import Personal from './components/Personal';
import Configuracion from './components/Configuracion';
import Auditoria from './components/Auditoria';
import Bajas from './components/Bajas';
import Movimientos from './components/Movimientos';
import LandingSolicitudTI from './components/LandingSolicitudTI';
import SolicitudesTI from './components/SolicitudesTI';
import AlmacenTI from './components/AlmacenTI';
import NotificacionesTI from './components/NotificacionesTI';

const isSolicitudPathname = (pathname = '') => /^\/(solicitud|solicitudes|landing)(\/|$)/i.test(pathname);

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
  auditor: {
    canCreateAssets: false,
    canEditAssets: false,
    canDeleteAssets: false,
    canCreateMaintenance: false,
    canDeleteMaintenance: false,
    canManageUsers: false,
  },
  landing: {
    canCreateAssets: false,
    canEditAssets: false,
    canDeleteAssets: false,
    canCreateMaintenance: false,
    canDeleteMaintenance: false,
    canManageUsers: false,
  },
  almacen: {
    canCreateAssets: false,
    canEditAssets: false,
    canDeleteAssets: false,
    canCreateMaintenance: false,
    canDeleteMaintenance: false,
    canManageUsers: false,
  },
};

function App() {
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [currentView, setCurrentView] = useState('landing');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bienes, setBienes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mostrarRegistro, setMostrarRegistro] = useState(false);
  const [landingMode, setLandingMode] = useState('new');
  const [solicitud, setSolicitud] = useState({
    dni: '',
    correo: '',
    area: '',
    cargo: '',
    tipo: '',
    beneficiario: '',
    ubicacion: '',
    equipo: '',
    justificacion: '',
    documento: null,
  });
  const [consultaCodigo, setConsultaCodigo] = useState('');
  const [showLanding, setShowLanding] = useState(() => isSolicitudPathname(window.location.pathname));
  const [pedidoSolicitud, setPedidoSolicitud] = useState(null);
  const [focusSolicitud, setFocusSolicitud] = useState(null);
  const [focusPedido, setFocusPedido] = useState(null);

  useEffect(() => {
    const handlePopState = () => {
      setShowLanding(isSolicitudPathname(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openLandingPage = () => {
    if (!isSolicitudPathname(window.location.pathname)) {
      window.history.pushState({}, '', '/solicitud');
    }
    setShowLanding(true);
  };

  const closeLandingToAccess = () => {
    if (isSolicitudPathname(window.location.pathname)) {
      window.history.pushState({}, '', '/');
    }
    setShowLanding(false);
  };

  const closeLandingToInbox = () => {
    if (isSolicitudPathname(window.location.pathname)) {
      window.history.pushState({}, '', '/');
    }
    setCurrentView(currentUser?.rol === 'almacen' && !currentUser?.es_ti ? 'almacen_ti' : 'solicitudes_ti');
    setShowLanding(false);
  };

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
        setCurrentView(
          response.data.user?.rol === 'landing'
            ? 'landing'
            : response.data.user?.rol === 'almacen'
              ? 'almacen_ti'
              : response.data.user?.rol === 'auditor'
                ? 'auditoria'
                : 'dashboard',
        );
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

    if (currentUser.rol === 'landing') {
      setBienes([]);
      setUsuarios([]);
      setPersonal([]);
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        if (!['auditor','almacen'].includes(currentUser.rol)) {
          const bienesResponse = await api.getBienes();
          setBienes(bienesResponse.data);
        }

        if (permissions.canManageUsers) {
          const usuariosResponse = await api.getUsuarios();
          setUsuarios(usuariosResponse.data);
        } else {
          setUsuarios([]);
        }

        if (['administrador', 'jefatura', 'auditor'].includes(currentUser.rol)) {
          const personalResponse = await api.getPersonal();
          setPersonal(personalResponse.data);
        } else {
          setPersonal([]);
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

  const fetchPersonal = async () => {
    const response = await api.getPersonal();
    setPersonal(response.data);
  };

  const handleLogin = async (email, password) => {
    setAuthLoading(true);
    setAuthError('');

    try {
      const response = await api.login({ email, password });
      api.setAuthToken(response.data.token);
      setCurrentUser(response.data.user);
      setCurrentView(
        response.data.user?.rol === 'landing'
          ? 'landing'
          : response.data.user?.rol === 'almacen'
            ? 'almacen_ti'
            : response.data.user?.rol === 'auditor'
              ? 'auditoria'
              : 'dashboard',
      );
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
    setPersonal([]);
    setFocusSolicitud(null);
    setFocusPedido(null);
    setPedidoSolicitud(null);
    setCurrentView('landing');
    setSidebarOpen(false);
  };

  const handleProfileUpdate = async (profile) => {
    const response = await api.updateProfile(profile);
    setCurrentUser(response.data.user);
    return response.data.user;
  };

  const handleSolicitudChange = (event) => {
    const { name, value, files } = event.target;

    if (name === 'documento') {
      setSolicitud((previous) => ({ ...previous, documento: files?.[0] || null }));
      return;
    }

    setSolicitud((previous) => ({ ...previous, [name]: value }));
  };

  const resetSolicitud = () => {
    setSolicitud({
      dni: '',
      correo: '',
      area: '',
      cargo: '',
      tipo: '',
      beneficiario: '',
      ubicacion: '',
      equipo: '',
      justificacion: '',
      documento: null,
    });
  };

  const submitSolicitud = (event) => {
    event.preventDefault();
    console.log('Solicitud enviada', solicitud);
  };

  const renderView = () => {
    switch (currentView) {
      case 'landing':
        return (
          <div className="space-y-6 rounded-[18px] bg-[#edf3f8] p-6 lg:p-8">
            <div className="flex items-center justify-between gap-4 rounded-[18px] border border-slate-200 bg-white/90 px-4 py-3 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white">🏛️</div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-600">TRIBUNAL CONSTITUCIONAL</p>
                  <p className="mt-1 text-lg font-semibold text-slate-800">SISTEMA SCA-TC | PORTAL DE SOLICITUDES DE TI</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-right">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">U</div>
                <div>
                  <div className="text-sm font-bold text-slate-900">usuario</div>
                  <div className="text-[11px] text-slate-500">Landing</div>
                </div>
              </div>
            </div>

            <div className="rounded-[14px] border border-slate-200 bg-[#edf3f8] px-2 py-3">
              <div className="mb-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-blue-400/60" />
                <span className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-700">SERVICIOS TECNOLÓGICOS INSTITUCIONALES</span>
                <span className="h-px flex-1 bg-blue-400/60" />
              </div>

              <h2 className="text-4xl font-black leading-tight tracking-[-0.05em] text-slate-900 lg:text-6xl">
                Mesa de Servicios y Gestión Documentaria de TI
              </h2>
              <p className="mt-4 max-w-4xl text-lg text-slate-600">
                Registre su requerimiento de equipos o servicios adjuntando el documento oficial o consulte el estado de su trámite con su código de seguimiento.
              </p>

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setLandingMode('new')}
                  className={`flex items-center justify-center gap-3 rounded-2xl border px-5 py-4 text-xl font-semibold transition ${landingMode === 'new' ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  <span>📄</span>
                  <span>1. Nueva Solicitud de TI</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLandingMode('consult')}
                  className={`flex items-center justify-center gap-3 rounded-2xl border px-5 py-4 text-xl font-semibold transition ${landingMode === 'consult' ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  <span>🔎</span>
                  <span>2. Consultar Estado de Trámite</span>
                </button>
              </div>
            </div>

            {landingMode === 'new' ? (
              <form onSubmit={submitSolicitud} className="space-y-5 rounded-[18px] border border-slate-200 bg-white px-5 py-6 shadow-sm lg:px-7 lg:py-8">
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-lg text-blue-700">📋</span>
                  <div className="flex items-center gap-2 text-lg font-black uppercase tracking-wide">
                    <span className="text-blue-700">PASO 01</span>
                    <span className="text-slate-900">Identificación del solicitante</span>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-lg font-semibold text-slate-700">DNI <span className="text-red-500">*</span></span>
                    <input name="dni" value={solicitud.dni} onChange={handleSolicitudChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" placeholder="45892103" required />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-lg font-semibold text-slate-700">Correo Institucional <span className="text-red-500">*</span></span>
                    <input type="email" name="correo" value={solicitud.correo} onChange={handleSolicitudChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" placeholder="jvasquez@tc.gob.pe" required />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-lg font-semibold text-slate-700">Área / Oficina <span className="text-red-500">*</span></span>
                    <select name="area" value={solicitud.area} onChange={handleSolicitudChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" required>
                      <option value="">Seleccione su área...</option>
                      <option value="Administración">Administración</option>
                      <option value="Tecnología de la Información">Tecnología de la Información</option>
                      <option value="Secretaría General">Secretaría General</option>
                      <option value="Oficina de Informática">Oficina de Informática</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-lg font-semibold text-slate-700">Cargo <span className="text-red-500">*</span></span>
                    <input name="cargo" value={solicitud.cargo} onChange={handleSolicitudChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" placeholder="Analista / Especialista" required />
                  </label>
                </div>

                <div className="mt-8 rounded-[18px] border border-slate-200 bg-white">
                  <div className="flex items-center gap-3 rounded-t-[18px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-slate-800">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-lg text-blue-700">📝</span>
                    <div className="flex items-center gap-2 text-lg font-black uppercase tracking-wide">
                      <span className="text-blue-700">PASO 02</span>
                      <span className="text-slate-900">Detalle del requerimiento de TI</span>
                    </div>
                  </div>

                  <div className="space-y-5 p-5">
                    <label className="block">
                      <span className="mb-2 block text-lg font-semibold text-slate-700">Tipo de Solicitud <span className="text-red-500">*</span></span>
                      <select name="tipo" value={solicitud.tipo} onChange={handleSolicitudChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" required>
                        <option value="">Seleccione el tipo de solicitud</option>
                        <option value="Hardware">Hardware</option>
                        <option value="Software">Software</option>
                        <option value="Acceso / Usuario">Acceso / Usuario</option>
                        <option value="Servicio">Servicio</option>
                        <option value="Soporte técnico">Soporte técnico</option>
                      </select>
                    </label>

                    <div className="grid gap-5 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-lg font-semibold text-slate-700">Beneficiario del Equipo / Servicio <span className="text-red-500">*</span></span>
                        <input name="beneficiario" value={solicitud.beneficiario} onChange={handleSolicitudChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" placeholder="Nombre completo del usuario final" required />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-lg font-semibold text-slate-700">Ubicación Física / Piso <span className="text-red-500">*</span></span>
                        <select name="ubicacion" value={solicitud.ubicacion} onChange={handleSolicitudChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" required>
                          <option value="">Seleccione el piso</option>
                          <option value="Piso 1">Piso 1</option>
                          <option value="Piso 2">Piso 2</option>
                          <option value="Piso 3">Piso 3</option>
                          <option value="Piso 4">Piso 4</option>
                          <option value="Piso 5">Piso 5</option>
                        </select>
                      </label>
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-lg font-semibold text-slate-700">Equipo o Periférico Solicitado <span className="text-red-500">*</span></span>
                      <select name="equipo" value={solicitud.equipo} onChange={handleSolicitudChange} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" required>
                        <option value="">Seleccione el equipo o periférico</option>
                        <option value="Laptop">Laptop</option>
                        <option value="Desktop">Desktop</option>
                        <option value="Monitor">Monitor</option>
                        <option value="Impresora">Impresora</option>
                        <option value="Cámara / Accesorio">Cámara / Accesorio</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-lg font-semibold text-slate-700">Justificación / Detalle de la Solicitud <span className="text-red-500">*</span></span>
                      <textarea name="justificacion" value={solicitud.justificacion} onChange={handleSolicitudChange} className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" placeholder="Ingrese el motivo del requerimiento o referencia del memorando..." required />
                    </label>
                  </div>
                </div>

                <div className="mt-8 rounded-[18px] border border-slate-200 bg-white">
                  <div className="flex items-center gap-3 rounded-t-[18px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-slate-800">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-lg text-blue-700">📎</span>
                    <div className="flex items-center gap-2 text-lg font-black uppercase tracking-wide">
                      <span className="text-blue-700">PASO 03</span>
                      <span className="text-slate-900">Sustento documentario obligatorio</span>
                    </div>
                  </div>

                  <div className="p-5">
                    <label className="block text-lg font-semibold text-slate-700">
                      Adjuntar Documento Oficial (Memorando / Informe / Oficio firmado) <span className="text-red-500">*</span>
                    </label>

                    <div className="mt-4 rounded-[20px] border-2 border-dashed border-blue-300 bg-blue-50/40 px-4 py-10 text-center">
                      <input id="documento-upload" type="file" name="documento" accept=".pdf" onChange={handleSolicitudChange} className="hidden" required />
                      <label htmlFor="documento-upload" className="flex cursor-pointer flex-col items-center justify-center gap-4 text-blue-700">
                        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow-sm">📤</span>
                        <span className="text-2xl font-semibold">Subir archivo o arrastre su documento aquí</span>
                        <span className="text-base text-slate-500">Formatos permitidos: PDF • Tamaño máximo 10 MB</span>
                      </label>
                    </div>

                    {solicitud.documento && (
                      <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-3 text-slate-700">
                          <span className="text-2xl">📄</span>
                          <div>
                            <p className="text-lg font-semibold">{solicitud.documento.name}</p>
                            <p className="text-sm text-slate-500">Documento PDF • {(solicitud.documento.size / 1024 / 1024).toFixed(1)} MB</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => setSolicitud((previous) => ({ ...previous, documento: null }))} className="text-base font-semibold text-red-600 hover:text-red-700">Quitar</button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-lg text-blue-800">
                  <span className="font-bold">Nota:</span> Toda solicitud generará un N° de seguimiento único y notifica en tiempo real a la Jefatura de TI para su evaluación y asignación.
                </div>

                <div className="mt-8 flex justify-end gap-4">
                  <button type="button" onClick={resetSolicitud} className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-lg font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">Limpiar</button>
                  <button type="submit" className="rounded-xl bg-gradient-to-r from-[#8f1d3d] to-[#aa2f4d] px-6 py-3 text-lg font-semibold text-white shadow-lg shadow-red-200 transition hover:brightness-110">Enviar solicitud de TI →</button>
                </div>
              </form>
            ) : (
              <div className="rounded-[18px] border border-slate-200 bg-white px-5 py-16 shadow-sm lg:px-10">
                <div className="mx-auto flex max-w-xl flex-col items-center text-center">
                  <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-4xl text-blue-700">🔎</div>
                  <h3 className="text-4xl font-black text-slate-900">Consultar estado de trámite</h3>
                  <p className="mt-3 text-lg text-slate-600">Ingrese el código único generado al registrar su solicitud.</p>
                  <div className="mt-8 w-full max-w-md">
                    <input
                      value={consultaCodigo}
                      onChange={(event) => setConsultaCodigo(event.target.value)}
                      placeholder="Ej. SCA-TI-2026-0142"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                  <button type="button" className="mt-8 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-200 transition hover:brightness-110">Consultar</button>
                </div>
              </div>
            )}
          </div>
        );
      case 'dashboard':
        return <Dashboard bienes={bienes} currentUser={currentUser} />;
      case 'inventario':
        return (
          <div className="space-y-6">
            {permissions.canCreateAssets && (
              mostrarRegistro ? (
                <RegistrarBien
                  onSaved={() => { fetchBienes(); setMostrarRegistro(false); }}
                  onCancel={() => setMostrarRegistro(false)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setMostrarRegistro(true)}
                  className="rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white shadow hover:bg-blue-700"
                >
                  ➕ Registrar bien informático
                </button>
              )
            )}
            <InventarioList
              bienes={bienes}
              onRefresh={fetchBienes}
              canCreate={false}
              canEdit={permissions.canEditAssets}
              canDelete={permissions.canDeleteAssets}
            />
          </div>
        );
      case 'mantenimiento':
        return (
          <Mantenimiento
            bienes={bienes}
            canCreate={permissions.canCreateMaintenance}
            canDelete={permissions.canDeleteMaintenance}
          />
        );
      case 'bajas':
        return <Bajas bienes={bienes} canCreate={['administrador', 'jefatura'].includes(role)} />;
      case 'asignaciones':
      case 'movimientos':
        return <Movimientos bienes={bienes} personal={personal} canManage={['administrador', 'jefatura'].includes(role)} canApprove={['administrador', 'jefatura'].includes(role)} />;
      case 'reportes':
        return <Reportes currentUser={currentUser} />;
      case 'usuarios':
        return <Usuarios usuarios={usuarios} onRefresh={fetchUsuarios} currentUser={currentUser} />;
      case 'personal':
        return <Personal personal={personal} onRefresh={fetchPersonal} currentUser={currentUser} />;
      case 'configuracion':
        return <Configuracion />;
      case 'solicitudes_ti':
        return <SolicitudesTI currentUser={currentUser} onOpenLanding={openLandingPage} focusId={focusSolicitud} onCreatePedido={(id) => { setPedidoSolicitud(id);setFocusPedido(null);setCurrentView('almacen_ti'); }} />;
      case 'almacen_ti':
        return <AlmacenTI currentUser={currentUser} initialSolicitudId={pedidoSolicitud} focusId={focusPedido} bienes={bienes} onOpenInventario={() => { setCurrentView('inventario');setMostrarRegistro(true); }} onOpenMovimientos={() => setCurrentView('movimientos')} />;
      case 'notificaciones_ti':
        return <NotificacionesTI onOpen={(entity,id) => { if(entity === 'pedido') { setFocusPedido(id);setPedidoSolicitud(null);setCurrentView('almacen_ti'); } else { setFocusSolicitud(id);setCurrentView('solicitudes_ti'); } }} />;
      case 'auditoria':
        return <Auditoria />;
      default:
        return <Dashboard bienes={bienes} currentUser={currentUser} />;
    }
  };

  const viewLabels = {
    landing: {
      title: 'MESA DE SERVICIOS Y GESTIÓN DOCUMENTARIA DE TI',
      description: 'Inicio general del sistema',
    },
    almacen_ti: {
      title: 'Pedidos y Almacén',
      description: 'Llegada de pedidos, derivación y recepción por TI',
    },
    notificaciones_ti: {
      title: 'Notificaciones',
      description: 'Alertas y seguimiento de solicitudes y pedidos',
    },
    solicitudes_ti: {
      title: 'Solicitudes de TI',
      description: 'Bandeja de requerimientos recibidos desde el formulario público con sustento oficial',
    },
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
    personal: {
      title: 'Personal institucional',
      description: 'Registro del personal que trabaja en la institución',
    },
    configuracion: {
      title: 'Configuración del sistema',
      description: 'Parámetros institucionales, catálogos y reglas operativas',
    },
    auditoria: {
      title: 'Log de auditoría',
      description: 'Trazabilidad de las acciones realizadas en el sistema',
    },
    bajas: {
      title: 'Bajas de bienes',
      description: 'Retiro patrimonial con evidencias fotográficas',
    },
    asignaciones: {
      title: 'Movimientos patrimoniales',
      description: 'Asignaciones, cambios, retiros y préstamos de bienes',
    },
    movimientos: {
      title: 'Movimientos patrimoniales',
      description: 'Asignaciones, cambios, retiros y préstamos de bienes',
    },
  };

  const currentMeta = viewLabels[currentView] || viewLabels.dashboard;

  const logout = useMemo(() => handleLogout, []);

  if (showLanding) {
    return (
      <LandingSolicitudTI
        currentUser={currentUser}
        onGoToAccess={closeLandingToAccess}
        onGoToPanelInbox={closeLandingToInbox}
      />
    );
  }

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
    return <Login onLogin={handleLogin} onOpenSolicitud={openLandingPage} loading={authLoading} error={authError} />;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.16),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] text-slate-900">
      <NavBar
        currentUser={currentUser}
        sidebarOpen={sidebarOpen}
        onProfileUpdate={handleProfileUpdate}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        onLogout={logout}
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
