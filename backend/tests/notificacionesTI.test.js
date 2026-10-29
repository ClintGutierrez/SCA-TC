import test from 'node:test';
import assert from 'node:assert/strict';
import { processNotificationQueue } from '../utils/notificacionesTI.js';

const fixture = (attempts=0) => {
  const updates=[];let pending=true;
  const tx=async (parts,...values) => {
    const query=parts.join('');
    if(query.includes('SELECT *')) return pending ? [{ id:'8',destinatario:'persona@example.test',asunto:'Alerta',mensaje:'Pedido en almacén',intentos:attempts }] : [];
    updates.push({ query,values });pending=false;return [];
  };
  return { sql:{ begin:async (fn) => fn(tx) },updates };
};
test('correo aceptado registra entrega y utiliza un identificador estable del mensaje',async () => {
  const { sql,updates }=fixture();const sent=[];
  await processNotificationQueue(sql,{ sendMail:async (message) => sent.push(message) },{ smtpReady:true });
  assert.equal(sent.length,1);assert.equal(sent[0].messageId,'<sca-ti-8@notificaciones.sca-tc.local>');
  assert.match(updates[0].query,/enviada_at=now/);
});
test('fallo SMTP conserva el correo pendiente y programa el reintento con espera creciente',async () => {
  const { sql,updates }=fixture(3);
  await processNotificationQueue(sql,{ sendMail:async () => { throw new Error('SMTP temporalmente caído'); } },{ smtpReady:true });
  assert.match(updates[0].query,/proximo_intento/);assert.doesNotMatch(updates[0].query,/enviada_at=/);
  assert.equal(updates[0].values[0],'SMTP temporalmente caído');assert.equal(updates[0].values[1],480);
});
test('sin configuración SMTP no intenta transmitir y conserva un diagnóstico para reintentar',async () => {
  const { sql,updates }=fixture();
  await processNotificationQueue(sql,{ sendMail:async () => assert.fail('No debe enviar sin SMTP') },{ smtpReady:false });
  assert.match(updates[0].values[0],/Configure SMTP/);assert.equal(updates[0].values[1],60);
});
