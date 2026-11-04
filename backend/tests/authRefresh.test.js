import test from 'node:test';
import assert from 'node:assert/strict';
import { refresh } from '../controllers/authController.js';
import { verifyAccessToken } from '../utils/auth.js';

test('renovar sesión mantiene el ID del usuario y su pertenencia a TI', async () => {
  const previous=process.env.JWT_SECRET;process.env.JWT_SECRET='prueba-local-secret-para-refresh';
  try {
    const session={ id:99,user_id:7,expires_at:new Date(Date.now()+60000),revoked_at:null,nombre:'Técnico',email:'ti@example.test',rol:'tecnico',es_ti:true,estado:'activo',activo_login:true };
    let body;let updateValues;
    const sql=async (parts,...values) => {
      if(parts.join('').includes('FROM auth_sessions')) return [session];
      updateValues=values;return [];
    };
    const res={ cookie:() => res,json:(data) => { body=data;return res; },status:() => res,clearCookie:() => res };
    await refresh({ cookies:{ inventario_refresh_token:'refresh-test' } },res,sql);
    assert.equal(body.user.id,7);assert.equal(body.user.es_ti,true);
    assert.equal(verifyAccessToken(body.token).sub,7);
    assert.equal(updateValues.at(-1),99);
  } finally { if(previous === undefined) delete process.env.JWT_SECRET;else process.env.JWT_SECRET=previous; }
});
