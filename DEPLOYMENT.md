# DESPLIEGUE Y PRODUCCIÓN

## Preparar para Producción

### 1. Optimizar Frontend

```bash
cd frontend
npm run build
```

Esto genera archivos optimizados en `frontend/dist/`

### 2. Configurar Variables de Producción

En el archivo `.env` para producción:

```env
NODE_ENV=production
BACKEND_PORT=5000
DB_HOST=tu_servidor_db
DB_PORT=5432
DB_NAME=inventario_bienes
DB_USER=usuario_db
DB_PASSWORD=contraseña_segura

VITE_API_URL=https://tudominio.com/api
```

### 3. Servir Frontend Estático desde Backend (Opcional)

En `backend/server.js`, después de las rutas de API:

```javascript
import path from 'path';
const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});
```

### 4. Usar un Servidor de Producción

Instalar `pm2` para mantener el servidor corriendo:

```bash
npm install -g pm2

# Iniciar
pm2 start backend/server.js --name "inventario-api"

# Ver logs
pm2 logs inventario-api

# Reiniciar automáticamente
pm2 startup
pm2 save
```

## Despliegue en Heroku

### 1. Preparar Proyecto

```bash
# Instalar Heroku CLI
npm install -g heroku

# Login
heroku login

# Crear app
heroku create tu-app-name

# Agregar PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev
```

### 2. Configurar Variables de Entorno

```bash
heroku config:set NODE_ENV=production
heroku config:set DB_HOST=tu_db_host
heroku config:set DB_USER=tu_usuario
heroku config:set DB_PASSWORD=tu_contraseña
```

### 3. Procfile

Crear archivo `Procfile` en la raíz:

```
web: node backend/server.js
```

### 4. Hacer Deploy

```bash
git push heroku main
```

## Despliegue en AWS EC2

### 1. Crear Instancia

- OS: Ubuntu 20.04 LTS
- Tipo: t2.micro (free tier)
- Almacenamiento: 20GB

### 2. Conectar y Configurar

```bash
# SSH a la instancia
ssh -i tu_key.pem ubuntu@tu_ip

# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Instalar PM2
sudo npm install -g pm2
```

### 3. Clonar Repositorio

```bash
cd /home/ubuntu
git clone https://tu_repo.git proyecto-tcp
cd proyecto-tcp

npm install
cd backend && npm install
cd ../frontend && npm install && npm run build
cd ..
```

### 4. Configurar PostgreSQL

```bash
sudo -u postgres createdb inventario_bienes
sudo -u postgres createuser tu_usuario
```

### 5. Iniciar Aplicación

```bash
pm2 start backend/server.js --name "inventario"
pm2 startup
pm2 save
```

## Monitoreo

### Logs
```bash
pm2 logs inventario
```

### Estadísticas
```bash
pm2 monit
```

## Backup de Base de Datos

### PostgreSQL Dump

```bash
# Backup
pg_dump -U postgres inventario_bienes > backup_$(date +%Y%m%d).sql

# Restore
psql -U postgres inventario_bienes < backup_20240101.sql
```

### Backup Automático (Cron)

```bash
# Editar crontab
crontab -e

# Agregar línea para backup diario
0 2 * * * pg_dump -U postgres inventario_bienes > /backups/backup_$(date +\%Y\%m\%d).sql
```

## Seguridad

### 1. HTTPS con Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot certonly --standalone -d tu_dominio.com
```

### 2. Firewall

```bash
sudo ufw enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5000/tcp  # Backend solo si es necesario
```

### 3. Variables Sensibles

Nunca guardes contraseñas en archivos de configuración:
- Usa archivos `.env` (no versionados)
- Usa servicios de secretos (AWS Secrets Manager, Heroku Config Vars)

## Performance

### 1. Caché

En `backend/server.js`:
```javascript
app.use((req, res, next) => {
  res.set('Cache-Control', 'public, max-age=300');
  next();
});
```

### 2. Compresión

```bash
npm install compression
```

```javascript
import compression from 'compression';
app.use(compression());
```

### 3. Optimización de BD

```sql
-- Indexes ya existen en schema.sql, pero puedes agregar más:
CREATE INDEX idx_bienes_tipo ON bienes_informaticos(tipo);
```

## Checklist de Despliegue

- [ ] Variables de entorno configuradas
- [ ] Database migrada
- [ ] Frontend buildizado
- [ ] PM2 configurado
- [ ] Certificados SSL/HTTPS
- [ ] Firewall habilitado
- [ ] Backups configurados
- [ ] Monitoreo activo
- [ ] Tests pasados
- [ ] Documentación actualizada

---

**Última actualización**: Junio 2026
