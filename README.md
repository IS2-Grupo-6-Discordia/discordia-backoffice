# discordia-backoffice

Backoffice para el staff de Discordia: gestión de usuarios y servidores de la plataforma.
Mismo stack y sistema de diseño que `discordia-cliente-web` (Expo Router + React Native Web).

## Qué incluye

| Pantalla | Historia | Qué hace |
| --- | --- | --- |
| Login | [Backoffice] Login | Solo entra el staff: una cuenta sin rol `staff` ve "Esta cuenta no tiene acceso al backoffice." y su sesión se cierra en el momento. |
| Recupero | [Backoffice] Recupero de contraseña | Pide el mail de recupero. El link lleva al cliente web (`FRONTEND_BASE_URL` de autenticación). |
| Usuarios | ADMINISTRACIÓN HU-1, HU-2, HU-5 | Búsqueda por nombre o email, filtro Todos / Activos / Suspendidos, suspender y reactivar con confirmación. |
| Servidores | ADMINISTRACIÓN HU-3 | Listado con nombre, cantidad de miembros y fecha de creación, con búsqueda por nombre. |

No hay registro: el staff no se autorregistra. Para dar acceso a alguien, primero se registra
como usuario común en el cliente web y después se le asigna el rol desde autenticación:

```bash
docker compose exec autenticacion python -m scripts.set_role <email> staff
```

## Endpoints que usa (vía gateway)

- `POST /auth/login`, `POST /auth/logout`, `POST /auth/password-reset/request`
- `GET /auth/admin/users`, `POST /auth/admin/users/{id}/suspend`, `POST /auth/admin/users/{id}/reactivate`
- `GET /admin/servers` (microservicio de servidores)

Todas las rutas de admin exigen `role = staff` en el JWT, tanto en el gateway como en cada
microservicio.

## Desarrollo local

```bash
cp .env.example .env
npm install
npx expo start --web --port 8091
```

`EXPO_PUBLIC_API_URL` apunta al gateway. Con el stack del repo `root`, es
`http://localhost:18080/api/v1`, y el origen `http://localhost:8091` tiene que estar en
`CORS_ALLOWED_ORIGIN_*` del gateway.

## Deploy

Cloudflare Pages conectado al repo (rama `main`):

- Build command: `npm run build:web`
- Build output directory: `dist`
- Variables: `EXPO_PUBLIC_API_URL` apuntando al gateway de producción y `NODE_VERSION=22`.

`build:web` corre `expo export` y después `scripts/fix-dist-assets.mjs`, que mueve
`dist/assets/node_modules` a `dist/assets/vendor` y corrige las rutas en el bundle. Hace falta
porque Cloudflare Pages no sube nada que esté dentro de una carpeta `node_modules`, y ahí deja Expo
las fuentes de los íconos: sin ese paso, los íconos se ven como cuadrados vacíos.

Pages ya sirve `index.html` para cualquier ruta que no exista, así que no hace falta configurar
redirecciones. El dominio del backoffice tiene que agregarse a `CORS_ALLOWED_ORIGIN_*` del gateway
en Render.

## Servicios dormidos en Render

En el plan gratuito, Render duerme los servicios tras 15 minutos sin tráfico y **no los despierta
si la request viene de otro servicio de Render** (el gateway): responde `429` con
`x-render-routing: hibernate-rate-limited`. Por eso, al abrir la app, el navegador le pega directo
al health check de cada backend (`api/wake.ts`), que sí los despierta, y el login espera a que
respondan mostrando "Estamos despertando el servidor".

- Si `EXPO_PUBLIC_API_URL` apunta a Render, se usan las URLs de producción de autenticación y
  servidores.
- `EXPO_PUBLIC_WAKE_URLS` (opcional) reemplaza esa lista: URLs separadas por coma. Definida vacía,
  desactiva el despertador. Cuando un servicio nuevo pase a depender del gateway, hay que agregar
  su health check acá.
