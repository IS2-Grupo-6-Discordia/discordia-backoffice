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

Igual que el cliente web: proyecto aparte en Vercel con `EXPO_PUBLIC_API_URL` apuntando al
gateway de producción (`vercel.json` ya redirige todas las rutas a `index.html`). El dominio del
backoffice tiene que agregarse a `CORS_ALLOWED_ORIGIN_*` del gateway en Render.
