const setAuditUser = async (transaction, user) => {
  const users = await transaction`
    SELECT id FROM usuarios WHERE email = ${user.email} LIMIT 1
  `;
  const userId = users[0]?.id || null;
  await transaction`SELECT set_config('app.audit_user_id', ${userId ? String(userId) : ''}, true)`;
};

export const getBienes = async (req, res, sql) => {
  try {
    const bienes = await sql`SELECT * FROM bienes_informaticos ORDER BY created_at DESC`;
    res.json(bienes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getBienById = async (req, res, sql) => {
  try {
    const { id } = req.params;
    const bien = await sql`SELECT * FROM bienes_informaticos WHERE id = ${id}`;
    if (bien.length === 0) {
      return res.status(404).json({ error: 'Bien no encontrado' });
    }
    res.json(bien[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createBien = async (req, res, sql) => {
  try {
    const { nombre, descripcion, tipo, marca, modelo, numeroSerie, fechaAdquisicion, costo, usuarioAsignado, ubicacion } = req.body;

    if (!nombre?.trim() || !tipo?.trim() || !fechaAdquisicion || costo === undefined || costo === '') {
      return res.status(400).json({ error: 'Nombre, tipo, fecha de adquisición y costo son obligatorios' });
    }

    if (!Number.isFinite(Number(costo)) || Number(costo) < 0) {
      return res.status(400).json({ error: 'El costo debe ser un número mayor o igual a cero' });
    }
    
    const bien = await sql.begin(async (transaction) => {
      await setAuditUser(transaction, req.user);
      return transaction`
        INSERT INTO bienes_informaticos (nombre, descripcion, tipo, marca, modelo, numero_serie, fecha_adquisicion, costo, usuario_asignado, estado, ubicacion)
        VALUES (${nombre.trim()}, ${descripcion || null}, ${tipo.trim()}, ${marca || null}, ${modelo || null}, ${numeroSerie || null}, ${fechaAdquisicion}, ${costo}, ${usuarioAsignado || null}, 'activo', ${ubicacion || null})
        RETURNING *
      `;
    });
    res.status(201).json(bien[0]);
  } catch (error) {
    const isDuplicateSerie = (error.code === '23505' || error.message?.includes('duplicate key')) && (
      error.constraint?.includes('numero_serie') || error.message?.includes('numero_serie')
    );

    if (isDuplicateSerie) {
      return res.status(409).json({ error: 'Ya existe un bien registrado con ese número de serie' });
    }
    if (error.code === '23505' || error.message?.includes('duplicate key')) {
      return res.status(409).json({ error: 'Ya existe un registro duplicado con los datos enviados' });
    }
    res.status(500).json({ error: error.message });
  }
};

export const updateBien = async (req, res, sql) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, tipo, marca, modelo, numeroSerie, costo, usuarioAsignado, ubicacion } = req.body;

    if (!nombre?.trim() || !tipo?.trim() || costo === undefined || costo === '') {
      return res.status(400).json({ error: 'Nombre, tipo y costo son obligatorios' });
    }

    if (!Number.isFinite(Number(costo)) || Number(costo) < 0) {
      return res.status(400).json({ error: 'El costo debe ser un número mayor o igual a cero' });
    }
    
    const bien = await sql.begin(async (transaction) => {
      await setAuditUser(transaction, req.user);
      return transaction`
        UPDATE bienes_informaticos
        SET nombre = ${nombre.trim()},
            descripcion = ${descripcion || null},
            tipo = ${tipo.trim()},
            marca = ${marca || null},
            modelo = ${modelo || null},
            numero_serie = ${numeroSerie || null},
            costo = ${costo},
            usuario_asignado = ${usuarioAsignado || null},
            ubicacion = ${ubicacion || null},
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
    });
    
    if (bien.length === 0) {
      return res.status(404).json({ error: 'Bien no encontrado' });
    }
    res.json(bien[0]);
  } catch (error) {
    if ((error.code === '23505' || error.message?.includes('duplicate key')) && error.constraint?.includes('numero_serie')) {
      return res.status(409).json({ error: 'Ya existe un bien registrado con ese número de serie' });
    }
    if (error.code === '23505' || error.message?.includes('duplicate key')) {
      return res.status(409).json({ error: 'Ya existe un registro duplicado con los datos enviados' });
    }
    res.status(500).json({ error: error.message });
  }
};

export const deleteBien = async (req, res, sql) => {
  try {
    const { id } = req.params;
    const result = await sql.begin(async (transaction) => {
      await setAuditUser(transaction, req.user);
      return transaction`DELETE FROM bienes_informaticos WHERE id = ${id}`;
    });
    if (result.count === 0) {
      return res.status(404).json({ error: 'Bien no encontrado' });
    }
    res.json({ message: 'Bien eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
