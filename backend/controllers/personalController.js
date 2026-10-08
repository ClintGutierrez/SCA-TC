const PERSONAL_FIELDS = [
  'nombre',
  'apellido',
  'dni',
  'correo_institucional',
  'numero_celular',
  'regimen_laboral',
  'oficina',
  'area',
  'sede',
  'piso',
  'estado',
];
const REGIMENES_LABORALES = new Set(['Practicante', 'Locador de servicios', 'CAS', 'CAP', 'Personal de confianza', 'Servir']);
const SEDES = new Set(['Centro de Lima', 'Sede Central', 'Centro de estudios constitucionales', 'Sede Arequipa']);

const normalizePayload = (body = {}) => {
  const payload = Object.fromEntries(
    PERSONAL_FIELDS.map((field) => [field, typeof body[field] === 'string' ? body[field].trim() : body[field]]),
  );
  payload.estado = payload.estado || 'activo';
  payload.dni = payload.dni?.replace(/\s/g, '');
  payload.correo_institucional = payload.correo_institucional?.toLowerCase();
  return payload;
};

const validatePayload = (payload) => {
  const required = ['nombre', 'apellido', 'dni', 'correo_institucional', 'regimen_laboral'];
  if (required.some((field) => !payload[field])) {
    return 'Nombre, apellido, DNI, correo institucional y régimen laboral son obligatorios';
  }
  if (!/^\d{8}$/.test(payload.dni)) {
    return 'El DNI debe tener exactamente 8 dígitos';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.correo_institucional)) {
    return 'El correo institucional no tiene un formato válido';
  }
  if (!REGIMENES_LABORALES.has(payload.regimen_laboral)) {
    return 'El régimen laboral seleccionado no es válido';
  }
  if (payload.sede && !SEDES.has(payload.sede)) {
    return 'La sede seleccionada no es válida';
  }
  if (payload.numero_celular && !/^[0-9+() -]{7,20}$/.test(payload.numero_celular)) {
    return 'El número celular no tiene un formato válido';
  }
  if (!['activo', 'inactivo'].includes(payload.estado)) {
    return 'El estado del personal no es válido';
  }
  return null;
};

const selectFields = `
  id, nombre, apellido, dni, correo_institucional, numero_celular,
  regimen_laboral, oficina, area, sede, piso, estado, created_at, updated_at
`;

export const getPersonal = async (req, res, sql) => {
  try {
    const rows = await sql.unsafe(`SELECT ${selectFields} FROM personal ORDER BY apellido ASC, nombre ASC`);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener personal:', error);
    res.status(500).json({ error: 'No se pudo obtener el personal' });
  }
};

export const getPersonalById = async (req, res, sql) => {
  try {
    const rows = await sql.unsafe(
      `SELECT ${selectFields} FROM personal WHERE id = $1 LIMIT 1`,
      [req.params.id],
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Personal no encontrado' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener personal:', error);
    res.status(500).json({ error: 'No se pudo obtener el personal' });
  }
};

export const createPersonal = async (req, res, sql) => {
  try {
    const payload = normalizePayload(req.body);
    const validationError = validatePayload(payload);
    if (validationError) return res.status(400).json({ error: validationError });

    const duplicate = await sql`
      SELECT id FROM personal
      WHERE dni = ${payload.dni} OR LOWER(correo_institucional) = LOWER(${payload.correo_institucional})
      LIMIT 1
    `;
    if (duplicate.length > 0) return res.status(409).json({ error: 'El DNI o correo institucional ya está registrado' });

    const rows = await sql`
      INSERT INTO personal (
        nombre, apellido, dni, correo_institucional, numero_celular,
        regimen_laboral, oficina, area, sede, piso, estado
      ) VALUES (
        ${payload.nombre}, ${payload.apellido}, ${payload.dni}, ${payload.correo_institucional},
        ${payload.numero_celular || null}, ${payload.regimen_laboral}, ${payload.oficina || null},
        ${payload.area || null}, ${payload.sede || null}, ${payload.piso || null}, ${payload.estado}
      )
      RETURNING id, nombre, apellido, dni, correo_institucional, numero_celular,
        regimen_laboral, oficina, area, sede, piso, estado, created_at, updated_at
    `;
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Error al crear personal:', error);
    res.status(500).json({ error: 'No se pudo registrar el personal' });
  }
};

export const updatePersonal = async (req, res, sql) => {
  try {
    const payload = normalizePayload(req.body);
    const validationError = validatePayload(payload);
    if (validationError) return res.status(400).json({ error: validationError });

    const duplicate = await sql`
      SELECT id FROM personal
      WHERE (dni = ${payload.dni} OR LOWER(correo_institucional) = LOWER(${payload.correo_institucional}))
        AND id <> ${req.params.id}
      LIMIT 1
    `;
    if (duplicate.length > 0) return res.status(409).json({ error: 'El DNI o correo institucional ya está registrado' });

    const rows = await sql`
      UPDATE personal
      SET nombre = ${payload.nombre}, apellido = ${payload.apellido}, dni = ${payload.dni},
          correo_institucional = ${payload.correo_institucional}, numero_celular = ${payload.numero_celular || null},
          regimen_laboral = ${payload.regimen_laboral}, oficina = ${payload.oficina || null},
          area = ${payload.area || null}, sede = ${payload.sede || null}, piso = ${payload.piso || null},
          estado = ${payload.estado}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${req.params.id}
      RETURNING id, nombre, apellido, dni, correo_institucional, numero_celular,
        regimen_laboral, oficina, area, sede, piso, estado, created_at, updated_at
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Personal no encontrado' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Error al actualizar personal:', error);
    res.status(500).json({ error: 'No se pudo actualizar el personal' });
  }
};

export const disablePersonal = async (req, res, sql) => {
  try {
    const rows = await sql`
      UPDATE personal SET estado = 'inactivo', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${req.params.id}
      RETURNING id, nombre, apellido, dni, correo_institucional, numero_celular,
        regimen_laboral, oficina, area, sede, piso, estado, created_at, updated_at
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Personal no encontrado' });
    res.json({ message: 'Personal deshabilitado correctamente', personal: rows[0] });
  } catch (error) {
    console.error('Error al deshabilitar personal:', error);
    res.status(500).json({ error: 'No se pudo deshabilitar el personal' });
  }
};
