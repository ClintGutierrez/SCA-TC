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
export const logout = () => apiClient.post('/auth/logout');

// Usuarios
export const getUsuarios = () => apiClient.get('/usuarios');
export const getUsuarioById = (id) => apiClient.get(`/usuarios/${id}`);
export const createUsuario = (data) => apiClient.post('/usuarios', data);
export const updateUsuario = (id, data) => apiClient.put(`/usuarios/${id}`, data);
export const disableUsuario = (id) => apiClient.delete(`/usuarios/${id}`);

// Bienes
export const getBienes = () => apiClient.get('/bienes');
export const getBienById = (id) => apiClient.get(`/bienes/${id}`);
export const createBien = (data) => apiClient.post('/bienes', data);
export const updateBien = (id, data) => apiClient.put(`/bienes/${id}`, data);
export const deleteBien = (id) => apiClient.delete(`/bienes/${id}`);

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

export default apiClient;
