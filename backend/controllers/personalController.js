import { establecerActor, errorVinculo } from '../utils/vinculoLaboral.js';

const PERSONAL_FIELDS = [
  'nombre',
  'apellido',
  'dni',
  'correo_institucional',
  'numero_celular',
  'regimen_laboral',
  'oficina',
  'area',
  'cargo',
  'sede',
  'piso',
  'jefe_inmediato',
  'correo_jefe',
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
  payload.correo_jefe = payload.correo_jefe?.toLowerCase() || null;
  payload.jefe_inmediato = payload.jefe_inmediato ? Number(payload.jefe_inmediato) : null;
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
  if (payload.cargo && payload.cargo.length > 150) return 'El cargo admite como máximo 150 caracteres';
  if (payload.sede && !SEDES.has(payload.sede)) {
    return 'La sede seleccionada no es válida';
  }
  if (payload.numero_celular && !/^[0-9+() -]{7,20}$/.test(payload.numero_celular)) {
    return 'El número celular no tiene un formato válido';
  }
  if (!['activo', 'inactivo'].includes(payload.estado)) {
    return 'El estado del personal no es válido';
  }
  if (payload.correo_jefe && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.correo_jefe)) {
    return 'El correo del jefe inmediato no tiene un formato válido';
  }
  if (payload.jefe_inmediato !== null && (!Number.isInteger(payload.jefe_inmediato) || payload.jefe_inmediato < 1)) {
    return 'El jefe inmediato seleccionado no es válido';
  }
  return null;
};

const selectFields = `
  id, nombre, apellido, dni, correo_institucional, numero_celular,
  COALESCE((SELECT v.tipo_vinculo FROM vinculo_laboral v WHERE v.personal_id=personal.id AND v.vigente=TRUE
    AND v.fecha_inicio <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date
    AND (v.fecha_fin IS NULL OR v.fecha_fin >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date) LIMIT 1), regimen_laboral) AS regimen_laboral,
  oficina, area, cargo, sede, piso, jefe_inmediato, correo_jefe,
  EXISTS(SELECT 1 FROM vinculo_laboral v WHERE v.personal_id=personal.id) AS tiene_vinculos,
  (SELECT json_build_object('id', v.id, 'tipo_vinculo', v.tipo_vinculo, 'fecha_inicio', v.fecha_inicio,
    'fecha_fin', v.fecha_fin, 'vigente', v.vigente) FROM vinculo_laboral v WHERE v.personal_id=personal.id
    ORDER BY CASE WHEN v.vigente AND v.fecha_inicio <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date
      AND (v.fecha_fin IS NULL OR v.fecha_fin >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date) THEN 0 ELSE 1 END,
      v.fecha_inicio DESC, v.id DESC LIMIT 1) AS vinculo_laboral,
  (SELECT CONCAT(jefe.apellido, ', ', jefe.nombre) FROM personal jefe WHERE jefe.id = personal.jefe_inmediato) AS jefe_inmediato_nombre,
  estado, created_at, updated_at
`;

const validateManager = async (payload, sql, currentId = null) => {
  if (!payload.jefe_inmediato && !payload.correo_jefe) return null;
  if (!payload.jefe_inmediato || !payload.correo_jefe) {
    return 'Registra tanto el jefe inmediato como su correo institucional';
  }
  if (currentId && Number(currentId) === payload.jefe_inmediato) {
    return 'El personal no puede ser su propio jefe inmediato';
  }
  const [manager] = await sql`
    SELECT id, correo_institucional FROM personal
    WHERE id = ${payload.jefe_inmediato} AND estado = 'activo'
  `;
  if (!manager) return 'El jefe inmediato debe existir y estar activo en Personal';
  if (manager.correo_institucional.toLowerCase() !== payload.correo_jefe) {
    return 'El correo del jefe debe coincidir con el correo institucional registrado en Personal';
  }
  return null;
};

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
    const managerError = await validateManager(payload, sql);
    if (managerError) return res.status(400).json({ error: managerError });

    const duplicate = await sql`
      SELECT id FROM personal
      WHERE dni = ${payload.dni} OR LOWER(correo_institucional) = LOWER(${payload.correo_institucional})
      LIMIT 1
    `;
    if (duplicate.length > 0) return res.status(409).json({ error: 'El DNI o correo institucional ya está registrado' });

    const rows = await sql.begin(async (tx) => {
      await establecerActor(tx, req.user);
      return tx`
      INSERT INTO personal (
        nombre, apellido, dni, correo_institucional, numero_celular,
        regimen_laboral, oficina, area, cargo, sede, piso, jefe_inmediato, correo_jefe, estado
      ) VALUES (
        ${payload.nombre}, ${payload.apellido}, ${payload.dni}, ${payload.correo_institucional},
        ${payload.numero_celular || null}, ${payload.regimen_laboral}, ${payload.oficina || null},
        ${payload.area || null}, ${payload.cargo || null}, ${payload.sede || null}, ${payload.piso || null},
        ${payload.jefe_inmediato}, ${payload.correo_jefe}, ${payload.estado}
      )
      RETURNING id, nombre, apellido, dni, correo_institucional, numero_celular,
        regimen_laboral, oficina, area, cargo, sede, piso, jefe_inmediato, correo_jefe, estado, created_at, updated_at
      `;
    });
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
    const managerError = await validateManager(payload, sql, req.params.id);
    if (managerError) return res.status(400).json({ error: managerError });

    const duplicate = await sql`
      SELECT id FROM personal
      WHERE (dni = ${payload.dni} OR LOWER(correo_institucional) = LOWER(${payload.correo_institucional}))
        AND id <> ${req.params.id}
      LIMIT 1
    `;
    if (duplicate.length > 0) return res.status(409).json({ error: 'El DNI o correo institucional ya está registrado' });

    const rows = await sql.begin(async (tx) => {
      await establecerActor(tx, req.user);
      const [existing] = await tx`SELECT id, regimen_laboral FROM personal WHERE id=${req.params.id} FOR UPDATE`;
      if (!existing) throw errorVinculo('Personal no encontrado', 404);
      const [current] = await tx`SELECT tipo_vinculo FROM vinculo_laboral WHERE personal_id=${existing.id} AND vigente=TRUE
        AND fecha_inicio <= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date
        AND (fecha_fin IS NULL OR fecha_fin >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date) LIMIT 1`;
      if (payload.regimen_laboral !== (current?.tipo_vinculo || existing.regimen_laboral)) {
        throw errorVinculo('Actualiza el régimen desde Vínculo laboral para conservar sus fechas e historial');
      }
      return tx`
      UPDATE personal
      SET nombre = ${payload.nombre}, apellido = ${payload.apellido}, dni = ${payload.dni},
          correo_institucional = ${payload.correo_institucional}, numero_celular = ${payload.numero_celular || null},
          regimen_laboral = ${payload.regimen_laboral}, oficina = ${payload.oficina || null},
          area = ${payload.area || null}, cargo = ${payload.cargo || null}, sede = ${payload.sede || null}, piso = ${payload.piso || null},
          jefe_inmediato = ${payload.jefe_inmediato}, correo_jefe = ${payload.correo_jefe},
          estado = ${payload.estado}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${req.params.id}
      RETURNING id, nombre, apellido, dni, correo_institucional, numero_celular,
        regimen_laboral, oficina, area, cargo, sede, piso, jefe_inmediato, correo_jefe, estado, created_at, updated_at
      `;
    });
    if (rows.length === 0) return res.status(404).json({ error: 'Personal no encontrado' });
    res.json(rows[0]);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error al actualizar personal:', error);
    res.status(500).json({ error: 'No se pudo actualizar el personal' });
  }
};

export const disablePersonal = async (req, res, sql) => {
  try {
    const rows = await sql.begin(async (tx) => {
      await establecerActor(tx, req.user);
      return tx`
      UPDATE personal SET estado = 'inactivo', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${req.params.id}
      RETURNING id, nombre, apellido, dni, correo_institucional, numero_celular,
        regimen_laboral, oficina, area, cargo, sede, piso, jefe_inmediato, correo_jefe, estado, created_at, updated_at
      `;
    });
    if (rows.length === 0) return res.status(404).json({ error: 'Personal no encontrado' });
    res.json({ message: 'Personal deshabilitado correctamente', personal: rows[0] });
  } catch (error) {
    console.error('Error al deshabilitar personal:', error);
    res.status(500).json({ error: 'No se pudo deshabilitar el personal' });
  }
};
