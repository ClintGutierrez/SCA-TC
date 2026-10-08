const getStorageConfig = () => {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'bajas-bienes';

  if (!url || !serviceRoleKey) {
    throw new Error('Faltan SUPABASE_URL y SUPABASE_SECRET_KEY para almacenar evidencias en Supabase Storage');
  }

  return {
    url: url.replace(/\/$/, ''),
    serviceRoleKey,
    bucket,
  };
};

const storageRequest = async (path, options = {}) => {
  const config = getStorageConfig();
  const response = await fetch(`${config.url}/storage/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.serviceRoleKey}`,
      apikey: config.serviceRoleKey,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase Storage respondió ${response.status}: ${detail}`);
  }

  return response;
};

const encodeObjectPath = (path) => path.split('/').map(encodeURIComponent).join('/');

export const uploadEvidence = async ({ file, path }) => {
  const { bucket } = getStorageConfig();
  await storageRequest(`/object/${encodeURIComponent(bucket)}/${encodeObjectPath(path)}`, {
    method: 'POST',
    headers: {
      'Content-Type': file.mimetype,
      'x-upsert': 'false',
    },
    body: file.buffer,
  });

  return path;
};

export const removeEvidence = async (paths) => {
  const { bucket } = getStorageConfig();
  const validPaths = paths.filter(Boolean);
  if (!validPaths.length) return;

  await storageRequest(`/object/${encodeURIComponent(bucket)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: validPaths }),
  });
};

export const createEvidenceUrl = async (path, expiresIn = 3600) => {
  const { bucket } = getStorageConfig();
  const response = await storageRequest(`/object/sign/${encodeURIComponent(bucket)}/${encodeObjectPath(path)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn }),
  });
  const data = await response.json();
  if (!data.signedURL) throw new Error('Supabase Storage no devolvió una URL firmada');
  return data.signedURL.startsWith('http')
    ? data.signedURL
    : `${getStorageConfig().url}${data.signedURL.startsWith('/storage/v1') ? '' : '/storage/v1'}${data.signedURL}`;
};
