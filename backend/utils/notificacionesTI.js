import nodemailer from 'nodemailer';

export const queueNotice = async (tx, { key, userId = null, email = null, subject, message, entity, id }) => {
  await tx`INSERT INTO notificaciones_ti (evento_clave,usuario_id,destinatario,asunto,mensaje,entidad,entidad_id)
    VALUES (${key},${userId},${email},${subject},${message},${entity},${id}) ON CONFLICT (evento_clave) DO NOTHING`;
};

export const notifyHeads = async (tx, notice) => {
  let heads = await tx`SELECT id,email FROM usuarios WHERE rol='jefatura' AND estado='activo' AND activo_login=TRUE`;
  if (!heads.length) heads = await tx`SELECT id,email FROM usuarios WHERE rol='administrador' AND estado='activo' AND activo_login=TRUE`;
  for (const user of heads) await queueNotice(tx, { ...notice, key: `${notice.key}:usuario:${user.id}`, userId: user.id, email: user.email });
};

export const processNotificationQueue = async (sql, transport, { smtpReady = Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM), limit = 10 } = {}) => {
  for (let i = 0; i < limit; i++) {
    const found = await sql.begin(async (tx) => {
      const [notice] = await tx`SELECT * FROM notificaciones_ti WHERE enviada_at IS NULL AND destinatario IS NOT NULL
        AND proximo_intento <= now() ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`;
      if (!notice) return false;
      try {
        if (!smtpReady) throw new Error('Configure SMTP_HOST y SMTP_FROM para enviar correos');
        await transport.sendMail({ from: process.env.SMTP_FROM, to: notice.destinatario, subject: notice.asunto, text: notice.mensaje,
          messageId: `<sca-ti-${notice.id}@notificaciones.sca-tc.local>` });
        await tx`UPDATE notificaciones_ti SET enviada_at=now(), ultimo_error=NULL, intentos=intentos+1 WHERE id=${notice.id}`;
      } catch (error) {
        const wait = Math.min(3600, 60 * (2 ** Math.min(notice.intentos, 6)));
        await tx`UPDATE notificaciones_ti SET intentos=intentos+1, ultimo_error=${String(error.message).slice(0,500)},
          proximo_intento=now()+${wait}*interval '1 second' WHERE id=${notice.id}`;
      }
      return true;
    });
    if (!found) break;
  }
};

// Un envío por fila, bloqueado entre procesos; los fallos se reintentan con espera creciente.
export const startNotificationWorker = (sql) => {
  let running = false;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } } : {}),
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  });
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await processNotificationQueue(sql,transport);
    } catch (error) { console.error('Notificaciones TI:', error.message); }
    finally { running = false; }
  };
  const timer = setInterval(tick, 15000);
  timer.unref();
  void tick();
  return () => { clearInterval(timer); transport.close(); };
};
