import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
});

let accessToken = null;
let refreshPromise = null;

const isAuthEndpoint = (url = '') => url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/logout');

const syncAuthorizationHeader = () => {
  if (accessToken) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
};

export const setAuthToken = (token) => {
  accessToken = token || null;
  syncAuthorizationHeader();
};

export const clearAuthToken = () => {
  accessToken = null;
  syncAuthorizationHeader();
};

export const refreshSession = async () => {
  if (!refreshPromise) {
    refreshPromise = apiClient
      .post('/auth/refresh')
      .then((response) => {
        if (response.data?.token) {
          setAuthToken(response.data.token);
        }

        return response;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};

    if (error?.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint(originalRequest.url)) {
      originalRequest._retry = true;

      try {
        const response = await refreshSession();
        const newToken = response.data?.token;

        if (newToken) {
          originalRequest.headers = {
            ...(originalRequest.headers || {}),
            Authorization: `Bearer ${newToken}`,
          };
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        clearAuthToken();
        return Promise.reject(refreshError);
      }

      clearAuthToken();
    }

    return Promise.reject(error);
  },
);

// Auth
export const login = (credentials) => apiClient.post('/auth/login', credentials);
export const getMe = () => apiClient.get('/auth/me');
export const updateProfile = (profile) => apiClient.put('/auth/profile', profile);
export const logout = () => apiClient.post('/auth/logout');

// Usuarios
export const getUsuarios = () => apiClient.get('/usuarios');
export const getUsuarioById = (id) => apiClient.get(`/usuarios/${id}`);
export const createUsuario = (data) => apiClient.post('/usuarios', data);
export const updateUsuario = (id, data) => apiClient.put(`/usuarios/${id}`, data);
export const disableUsuario = (id) => apiClient.delete(`/usuarios/${id}`);

// Personal de la institución
export const getPersonal = () => apiClient.get('/personal');
export const getPersonalById = (id) => apiClient.get(`/personal/${id}`);
export const createPersonal = (data) => apiClient.post('/personal', data);
export const updatePersonal = (id, data) => apiClient.put(`/personal/${id}`, data);
export const disablePersonal = (id) => apiClient.delete(`/personal/${id}`);
export const getVinculosLaborales = (id) => apiClient.get(`/personal/${id}/vinculos`);
export const createVinculoLaboral = (id, data) => apiClient.post(`/personal/${id}/vinculos`, data);
export const updateVinculoLaboral = (id, vinculoId, data) => apiClient.put(`/personal/${id}/vinculos/${vinculoId}`, data);
export const getConfiguracion = () => apiClient.get('/configuracion');
export const saveConfiguracion = (data) => apiClient.put('/configuracion', data);

// Bienes
export const getBienes = () => apiClient.get('/bienes');
export const getBienById = (id) => apiClient.get(`/bienes/${id}`);
export const createBien = (data) => apiClient.post('/bienes', data);
export const updateBien = (id, data) => apiClient.put(`/bienes/${id}`, data);
export const deleteBien = (id) => apiClient.delete(`/bienes/${id}`);
export const getHistorialBien = (id) => apiClient.get(`/bienes/${id}/historial`);
export const createBaja = (bienId, data) => apiClient.post(`/bajas/${bienId}`, data, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
export const getBajas = () => apiClient.get('/bajas');

// Asignaciones
export const getAsignaciones = (params = {}) => apiClient.get('/asignaciones', { params });
export const createAsignacion = (data) => apiClient.post('/asignaciones', data);
export const devolverAsignacion = (id, data) => apiClient.post(`/asignaciones/${id}/devolucion`, data);
export const getMovimientos = (params = {}) => apiClient.get('/movimientos', { params });
export const createMovimiento = (data) => apiClient.post('/movimientos', data);
export const resolverMovimiento = (id, data) => apiClient.post(`/movimientos/${id}/aprobacion`, data);
export const getMovimientoDocumento = (id) => apiClient.get(`/movimientos/${id}/documento`, { responseType: 'text' });
export const registrarRetornoPrestamo = (id, data) => apiClient.post(`/movimientos/${id}/retorno`, data);

// Mantenimiento
export const getMantenimiento = () => apiClient.get('/mantenimiento');
export const getMantenimientoPorBien = (bienId) => apiClient.get(`/mantenimiento/bien/${bienId}`);
export const createMantenimiento = (data) => apiClient.post('/mantenimiento', data);
export const deleteMantenimiento = (id) => apiClient.delete(`/mantenimiento/${id}`);

// Depreciación
export const getDepreciacion = () => apiClient.get('/depreciacion');
export const getDepreciacionPorBien = (bienId) => apiClient.get(`/depreciacion/${bienId}`);
export const createDepreciacion = (data) => apiClient.post('/depreciacion', data);
export const updateDepreciacion = (bienId) => apiClient.put(`/depreciacion/${bienId}`);

// Reportes
export const getReporteInventario = () => apiClient.get('/reportes/inventario');
export const getReporteDepreciacion = () => apiClient.get('/reportes/depreciacion');
export const getReporteAsignaciones = () => apiClient.get('/reportes/asignaciones');
export const getReporteMantenimiento = () => apiClient.get('/reportes/mantenimiento');
export const getAuditoria = (filtros = {}) => apiClient.get('/auditoria', { params: { limit: 200, ...filtros } });

export default apiClient;

// Las consultas públicas no intentan renovar una sesión del panel.
const publicTI = axios.create({ baseURL: `${API_URL}/api/gestion-ti` });
const tiChanged = (response) => { window.dispatchEvent(new Event('sca-ti-updated')); return response; };
export const registrarSolicitudTI = (datos, documento) => {
  const form = new FormData(); form.append('datos', JSON.stringify(datos)); form.append('documento', documento);
  return publicTI.post('/solicitudes', form).then(tiChanged);
};
export const solicitarAccesoTI = (datos) => publicTI.post('/consulta/acceso', datos);
export const consultarSolicitudTI = (datos) => publicTI.post('/consulta', datos);
export const descargarDocumentoPublicoTI = (id, datos) => publicTI.post(`/consulta/documentos/${id}`, datos, { responseType: 'blob' });
export const getSolicitudesTI = () => apiClient.get('/gestion-ti/solicitudes');
export const getSolicitudTI = (id) => apiClient.get(`/gestion-ti/solicitudes/${id}`);
export const getPersonalTI = () => apiClient.get('/gestion-ti/personal-ti');
export const accionSolicitudTI = (id, datos, archivos = []) => {
  const form = new FormData(); form.append('datos', JSON.stringify(datos));
  archivos.forEach((file) => form.append('adjuntos', file));
  return apiClient.post(`/gestion-ti/solicitudes/${id}/acciones`, form).then(tiChanged);
};
export const descargarDocumentoTI = (id) => apiClient.get(`/gestion-ti/documentos/${id}`, { responseType: 'blob' });
export const getPedidosTI = () => apiClient.get('/gestion-ti/pedidos');
export const vincularBienPedidoTI = (id, bienId) => apiClient.post(`/gestion-ti/pedidos/${id}/bienes`, { bienId }).then(tiChanged);
export const crearPedidoTI = (data) => apiClient.post('/gestion-ti/pedidos', data).then(tiChanged);
export const accionPedidoTI = (id, data) => apiClient.post(`/gestion-ti/pedidos/${id}/acciones`, data).then(tiChanged);
export const getHistorialPedidoTI = (id) => apiClient.get(`/gestion-ti/pedidos/${id}/historial`);
export const getNotificacionesTI = () => apiClient.get('/gestion-ti/notificaciones');
export const leerNotificacionTI = (id) => apiClient.post(`/gestion-ti/notificaciones/${id}/leida`).then(tiChanged);

export const guardarDescargaTI = (response, nombre) => {
  const url = URL.createObjectURL(response.data);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = nombre; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
