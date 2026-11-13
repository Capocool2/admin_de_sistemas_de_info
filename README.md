# ⚡ SAME — Sistema de Alquiler de Monopatines Eléctricos

### Gran Malecón del Río • Barranquilla, Colombia

Plataforma integral de micromovilidad compartida diseñada para operar en el **Gran Malecón del Río (Barranquilla)**. Combina una API REST y gateway en tiempo real con **NestJS + Socket.io**, una aplicación web interactiva en **React + Vite + Leaflet**, persistencia geoespacial en **PostgreSQL + PostGIS (Neon Tech)**, autenticación **JWT + bcrypt** con control de acceso basado en roles (**RBAC**) y un **simulador IoT de hardware**.

---

## 📑 Tabla de Contenidos

- [Stack Tecnológico](#-stack-tecnológico)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Reglas de Negocio y Seguridad Geoespacial](#-reglas-de-negocio-y-seguridad-geoespacial)
- [Requisitos y Variables de Entorno](#-requisitos-y-variables-de-entorno)
- [Instalación y Puesta en Marcha](#-instalación-y-puesta-en-marcha)
- [Credenciales y Control de Roles (RBAC)](#-credenciales-y-control-de-roles-rbac)
- [Referencia de API REST y WebSockets](#-referencia-de-api-rest-y-websockets)
- [Scripts de Diagnóstico y Pruebas](#-scripts-de-diagnóstico-y-pruebas)
- [Diagrama de Flujo del Negocio](#-diagrama-de-flujo-del-negocio)
- [Solución de Problemas Frecuentes](#-solución-de-problemas-frecuentes)

---

## 🧰 Stack Tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| **Backend & IoT Gateway** | NestJS 10, TypeScript, TypeORM, Socket.io, Passport JWT, bcryptjs, class-validator |
| **Frontend Web / Móvil** | React 18, Vite 5, Tailwind CSS 3, Leaflet 1.9 (OpenStreetMap), Lucide React, Socket.io Client |
| **Base de Datos Espacial** | PostgreSQL en **Neon Tech** con extensión **PostGIS** (`SRID 4326`, índices `GIST`) |
| **Simulación Hardware IoT** | Cliente Node/TypeScript (`ts-node`) sobre WebSockets con telemetría GPS cada 5 s |
| **Documentación de Procesos** | Diagrama funcional en formato `draw.io` (`docs/diagrama_flujo_SAME.drawio`) |

---

## 📁 Estructura del Proyecto

```text
admin_de_sistemas_de_info/
├── backend/                          # Servidor NestJS (API REST + WebSockets + TypeORM)
│   ├── src/
│   │   ├── auth/                     # Autenticación JWT, bcrypt, Strategy, Guards y Roles
│   │   ├── trips/                    # Lógica de alquiler, cobro por minuto, parqueo y multas
│   │   ├── telemetry/                # Gateway Socket.io, geocercas PostGIS y alertas IoT
│   │   ├── database/entities/        # Entidades: Usuario, Monopatin, Viaje, Pago, Alerta, ZonaGeocerca
│   │   ├── app.module.ts             # Configuración TypeORM + módulos principales
│   │   └── main.ts                   # Bootstrap HTTP/WS en puerto 3000 y ValidationPipe global
│   ├── scooter-simulator.ts          # Simulador IoT de telemetría GPS, velocidad, batería y candado
│   ├── run-sql.js                    # Utilidad Node para ejecutar scripts SQL en Neon
│   ├── status-neon.js                # Inspección rápida de flota, geocercas, usuarios y viajes
│   ├── inspect-schema.js             # Inspección de tablas y columnas en PostgreSQL
│   ├── inspect-details.js            # Inspección de llaves foráneas, restricciones e índices
│   ├── test-auth-flow.js             # Verificación de hashes bcrypt y roles en BD
│   ├── test-containment.js           # Prueba espacial ST_Contains entre flota y geocercas
│   ├── test-trips-flow.js            # Prueba end-to-end de reglas de viaje en BD
│   ├── .env.example                  # Plantilla de variables de entorno
│   └── package.json
│
├── frontend/                         # Aplicación Web Responsive (React + Vite + Tailwind + Leaflet)
│   ├── src/
│   │   ├── views/
│   │   │   ├── Login.tsx             # Inicio de sesión y registro público de turistas
│   │   │   ├── UserMap.tsx           # Mapa interactivo de alquiler para turistas
│   │   │   └── AdminDashboard.tsx    # Torre de Control en vivo, flota, geocercas y alertas
│   │   ├── components/
│   │   │   ├── ScannerModal.tsx      # Escaneo QR / ingreso manual de monopatín y cierre previo
│   │   │   ├── ActiveTripPanel.tsx   # Cronómetro en vivo, velocidad, batería y costo estimado
│   │   │   ├── EndTripModal.tsx      # Evidencia fotográfica, validación de parqueo y opción de abandono
│   │   │   └── ReceiptModal.tsx      # Recibo digital detallado (tarifa, minutos, multas)
│   │   ├── services/
│   │   │   ├── api.ts                # Cliente REST con inyección automática de Bearer JWT
│   │   │   └── socket.ts             # Cliente Socket.io para telemetría y alertas
│   │   ├── types/index.ts            # Definiciones TypeScript compartidas
│   │   └── App.tsx                   # Enrutamiento protegido por rol (RBAC)
│   ├── vite.config.ts                # Servidor de desarrollo en puerto 5173
│   └── package.json
│
├── database/                         # Scripts DDL, PostGIS y migraciones para Neon
│   ├── complete-neon-setup.sql       # Instalación integral desde cero (tablas, PostGIS y seeds)
│   ├── auth-migration.sql            # Migración de columnas de autenticación y roles (RBAC)
│   ├── init.sql / init_neon_postgis.sql
│   ├── fix-locations.sql             # Corrección de coordenadas de geocercas/flota
│   └── reset-trips.sql               # Limpieza de viajes activos para pruebas
│
├── docs/
│   └── diagrama_flujo_SAME.drawio    # Diagrama de flujo end-to-end del negocio (4 carriles)
│
├── .gitignore
└── README.md
```

---

## 🧭 Reglas de Negocio y Seguridad Geoespacial

El flujo completo se divide en tres etapas operativas validadas tanto en el servidor como en la base de datos espacial:

### 1. Alquiler y Desbloqueo
- El usuario debe tener cuenta en estado `activo` (se asigna `token_pago` automáticamente si no posee uno).
- **Un viaje simultáneo por usuario:** si ya existe un viaje activo, el sistema solicita cerrarlo primero (o permite liquidarlo forzadamente mediante `forzarCierreAnterior: true`). Si el viaje previo supera las **24 horas**, se liquida automáticamente antes de iniciar el nuevo.
- El monopatín seleccionado debe encontrarse en estado `disponible` y contar con **al menos 20% de batería**.
- Al aprobarse, se registra el viaje, el vehículo cambia a `en uso` y se envía la orden WebSocket `scooter:unlock` al candado electrónico.

### 2. Recorrido, Geocercas PostGIS y Seguridad IoT
Cada **5 segundos**, el monopatín reporta su ubicación GPS, velocidad, batería y estado del candado. El servidor evalúa mediante `ST_Contains` en PostGIS:

| Zona / Condición | Regla Operativa |
| :--- | :--- |
| **Ciclorruta Avenida del Río** (`normal`) | Circulación estándar con límite máximo de **20 km/h**. |
| **Paseo Peatonal Caimán del Río** (`peatonal`) | Regulación automática a máximo **10 km/h** para seguridad de peatones. |
| **Estaciones de Parqueo** (`parqueo`: **P1 Puerta de Oro**, **P2 Caimán del Río**, **P3 Manglar**) | Zonas verdes habilitadas para entrega sin penalización (límite **10 km/h**). |
| **Fuera de perímetro / Zona prohibida** | Corte inmediato de tracción (`scooter:emergency_stop`), registro de alerta `fuera_perimetro` y notificación en vivo al Centro de Control. |
| **Intento de robo** | Movimiento `> 2.0 km/h` mientras `locked = true`: corte de motor, alarma acústica de **85 dB** y alerta `robo` al dashboard. |
| **Batería crítica (`< 15%`)** | Emisión de alerta de mantenimiento (`bateria_baja`) para programar recarga. |

### 3. Devolución, Cobro y Sanción por Abandono
- **Tarifa estándar:** **\$500 COP por minuto** (mínimo 1 minuto), con carga automática de transacción aprobada en tabla `pagos` y foto de evidencia obligatoria.
- **Entrega en estación autorizada:** el sistema verifica con PostGIS que el monopatín esté dentro de una zona `parqueo`, bloquea el candado y lo deja `disponible` (o lo pasa a `mantenimiento` si su batería terminó por debajo del **20%**).
- **Abandono fuera de estación:** si el turista deja el vehículo fuera de una estación autorizada:
  1. Puede confirmar voluntariamente el abandono desde el modal (*"Dejar aquí de todos modos"*) asumiendo una **multa de recogida de \$15.000 COP**.
  2. Si el vehículo permanece inmóvil (`speed <= 0.5 km/h`) y desbloqueado fuera de estación durante **6 ciclos consecutivos de telemetría**, el sistema cierra y liquida automáticamente el viaje con la **multa de \$15.000 COP**, bloquea remotamente el vehículo (`bloqueado`) y alerta al Centro de Control para su recogida logística.

---

## ⚙️ Requisitos y Variables de Entorno

### Requisitos Previos
- **Node.js** `v18+` (recomendado `v20+`) y **npm**.
- Base de datos **PostgreSQL** con extensión **PostGIS** habilitada (configurada por defecto para **Neon Tech** con SSL).

### Configuración de Variables de Entorno (`backend/.env`)
El archivo `.env` está excluido de Git por seguridad. Antes de iniciar el backend o los scripts de base de datos, crea tu copia local a partir de la plantilla:

```bash
cp backend/.env.example backend/.env
```
*(En Windows PowerShell: `Copy-Item backend\.env.example backend\.env`)*

Edita `backend/.env` con tus credenciales reales:

| Variable | Descripción | Valor por defecto / Ejemplo |
| :--- | :--- | :--- |
| `PORT` | Puerto HTTP y WebSocket del backend | `3000` |
| `NODE_ENV` | Modo de ejecución (`development` habilita logs SQL) | `development` |
| `DATABASE_URL` | Cadena de conexión PostgreSQL/Neon con SSL | `postgresql://usuario:pass@host/db?sslmode=require` |
| `DATABASE_SSL` | Habilita conexión SSL hacia Neon | `true` |
| `JWT_SECRET` | Clave secreta para firmar y validar tokens JWT | `SAME_SECRET_KEY_MALECON_BARRANQUILLA_2026` |
| `JWT_EXPIRES_IN` | Tiempo de expiración de sesión JWT | `7d` |
| `RATE_PER_MINUTE_COP` | Tarifa operativa de referencia por minuto | `500` |
| `MIN_BATTERY_START_PERCENT` | Batería mínima de referencia para desbloqueo | `20` |
| `NORMAL_SPEED_LIMIT` | Límite de referencia en ciclorruta (km/h) | `20` |
| `PEDESTRIAN_SPEED_LIMIT` | Límite de referencia en zona peatonal (km/h) | `10` |

> **Variables opcionales en Frontend y Simulador IoT:**
> - **Frontend (`frontend/.env`):** `VITE_API_URL` (por defecto `http://localhost:3000`) y `VITE_WS_URL` (por defecto `http://localhost:3000`).
> - **Simulador IoT:** `BACKEND_URL` (por defecto `http://localhost:3000`) y `SCOOTER_ID` (por defecto `SCOOTER-01`).

---

## 🚀 Instalación y Puesta en Marcha

Necesitarás **tres terminales** abiertas para ejecutar el ecosistema completo (Backend, Simulador IoT y Frontend).

### 1. Inicializar / Verificar Base de Datos (Neon + PostGIS)
> Si tu base de datos ya está inicializada y poblada, puedes omitir el DDL y verificar su estado directamente con `node status-neon.js`.

- **Instalación integral desde cero** (crea extensión PostGIS, tablas, índices GIST, geocercas y flota semilla — *nota: limpia historial previo de `viajes`, `pagos` y `alertas`*):
  ```bash
  cd backend
  npm install
  node run-sql.js ../database/complete-neon-setup.sql
  ```
- **Solo migración de autenticación y roles (RBAC)** sobre un esquema existente:
  ```bash
  cd backend
  node run-sql.js ../database/auth-migration.sql
  ```

### 2. Iniciar el Backend (NestJS + WebSockets) — *Terminal 1*
```bash
cd backend
npm install
npm run start:dev
```
- **API REST:** `http://localhost:3000`
- **Gateway WebSocket (Socket.io):** `ws://localhost:3000`

### 3. Iniciar el Simulador IoT — *Terminal 2*
```bash
cd backend
npm run simulate
```
Simula en tiempo real el hardware de `SCOOTER-01` recorriendo 8 waypoints reales del Gran Malecón entre **Puerta de Oro (P1)** y **Caimán del Río (P2)**, reportando coordenadas, velocidad, batería y obedeciendo órdenes remotas de desbloqueo, regulación de velocidad y parada de emergencia.

*(Para simular otra unidad distinta, por ejemplo en PowerShell: `$env:SCOOTER_ID="SCOOTER-02"; npm run simulate`)*

### 4. Iniciar el Frontend (React + Vite) — *Terminal 3*
```bash
cd frontend
npm install
npm run dev
```
- **Aplicación Web:** `http://localhost:5173`
- Al iniciar sesión como `admin`, carga automáticamente la **Torre de Control** con una barra superior para alternar hacia **Inspección Turista**.
- Al iniciar sesión o registrarse como `turista`, queda confinado a **SAME Mobile** con saludo dinámico personalizado (`Hola, <Nombre> 👋`) y sin acceso al panel administrativo.

---

## 🔐 Credenciales y Control de Roles (RBAC)

La pantalla de inicio de sesión incluye pestañas de **Iniciar Sesión / Registro** y botones de autocompletado rápido para pruebas demo:

| Rol | Correo Electrónico | Contraseña | Acceso y Permisos |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin@same.com` | `Admin2026*` | **Torre de Control (`AdminDashboard`)** + vista de *Inspección Turista*, mapa de flota en vivo, alertas de robo/perímetro/abandono y botón de reseteo de flota. |
| **Turista (Pruebas)** | `test@same.com` | `Turista123*` | **Mapa de Alquiler (`UserMap`)**: escaneo QR, inicio/cierre de viaje, evidencia fotográfica y recibo digital. |
| **Turistas Adicionales (Seed)** | `carlos.mendoza@same.com.co`<br>`maria.gomez@same.com.co`<br>`andres.torres@same.com.co` | `Turista123*` | **Mapa de Alquiler (`UserMap`)**. |
| **Nuevo Registro Público** | *(Cualquier correo nuevo)* | *(Mínimo 6 caracteres)* | El backend asigna y fuerza estrictamente el rol `turista`. |

---

## 📡 Referencia de API REST y WebSockets

### Endpoints REST (`http://localhost:3000`)

#### Autenticación (`/api/auth`)
| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Público | Registra un nuevo usuario forzando rol `turista` y retorna JWT. |
| `POST` | `/api/auth/login` | Público | Autentica turistas o administradores y retorna `access_token` + perfil. |
| `GET` | `/api/auth/me` | JWT Bearer | Devuelve los datos del usuario autenticado (`JwtAuthGuard`). |

#### Viajes y Flota (`/api/trips`)
| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `POST` | `/api/trips/start` | Inicia un viaje (`scooterId`, `usuarioId` opcional si hay JWT, `forzarCierreAnterior?`). |
| `POST` | `/api/trips/end` | Valida parqueo en PostGIS con `fotoEvidenciaUrl` (o aplica multa si `forzarAbandono: true`), bloquea candado y genera pago. |
| `GET` | `/api/trips/active/:usuarioId` | Consulta si el usuario tiene un viaje en curso (acepta `'me'` usando el JWT). |
| `GET` | `/api/trips/scooters` | Lista todos los monopatines desde PostgreSQL con coordenadas `lat`/`lng`. |
| `GET` | `/api/trips` | Retorna los últimos 50 viajes registrados con usuario, vehículo y pagos. |
| `POST` | `/api/trips/force-cancel/:viajeId` | Cancela forzosamente un viaje activo y libera el monopatín. |
| `POST` | `/api/trips/reset-dev` | **Solo desarrollo:** trunca `pagos`/`viajes` y reinicia todos los monopatines a `disponible` con 100% de batería. |

### Eventos WebSocket (`ws://localhost:3000`)

| Evento | Dirección | Uso Principal |
| :--- | :--- | :--- |
| `join:room` | Cliente → Servidor | Suscribe clientes a las salas `scooters`, `dashboard`, `client_trips` y/o `scooter_<id>`. |
| `telemetry:update` | IoT → Servidor | Envía `{ scooterId, lat, lng, speed, battery, locked }` cada 5 segundos. |
| `telemetry:broadcast` | Servidor → Apps/Dashboard | Retransmite la posición, velocidad, batería y zona PostGIS actual en vivo. |
| `scooter:unlock` / `scooter:lock` | Servidor → IoT | Órdenes de apertura y cierre del candado electrónico al iniciar o finalizar viaje. |
| `scooter:set_speed_limit` | Servidor → IoT | Ajusta dinámicamente el límite máximo (`20 km/h` o `10 km/h`) según la geocerca. |
| `scooter:emergency_stop` | Servidor → IoT | Corte de motor y activación de alarma (`85 dB`) por robo, fuga de perímetro o abandono. |
| `alert:security` | Servidor → Dashboard | Notifica alertas críticas (`robo`, `fuera_perimetro`, `abandono`). |
| `alert:maintenance` | Servidor → Dashboard | Notifica batería crítica (`< 15%`, tipo `bateria_baja`). |

---

## 🧪 Scripts de Diagnóstico y Pruebas

Dentro de `backend/` existen utilidades listas para validar la conexión con Neon, la extensión espacial PostGIS y los flujos de negocio:

```bash
cd backend

# Ver estado de monopatines, geocercas, usuarios y últimos viajes en Neon
node status-neon.js

# Verificar tablas, columnas, llaves foráneas e índices espaciales GIST
node inspect-schema.js
node inspect-details.js

# Verificar hashes de contraseñas y validación espacial ST_Contains
node test-auth-flow.js
node test-containment.js

# Simular flujo completo de viaje y reglas de negocio directo en BD
node test-trips-flow.js
```

Para compilar y validar TypeScript en ambos proyectos:
```bash
# Backend
cd backend && npm run build

# Frontend (TypeScript + bundle de producción Vite)
cd frontend && npm run build
```

---

## 📊 Diagrama de Flujo del Negocio

El proyecto incluye el archivo [`docs/diagrama_flujo_SAME.drawio`](docs/diagrama_flujo_SAME.drawio), un diagrama de flujo **diseñado en lenguaje cotidiano (sin jerga técnica)** para que cualquier persona del equipo, cliente o evaluador comprenda el ciclo completo de principio a fin.

Está organizado en **4 carriles verticales**:
1. **Turista / Usuario (App en el Celular)**
2. **Sistema Inteligente SAME**
3. **Monopatín Eléctrico (Candado y GPS)**
4. **Centro de Control y Vigilancia**

Puedes visualizarlo o editarlo abriendo [app.diagrams.net](https://app.diagrams.net/) y cargando `docs/diagrama_flujo_SAME.drawio`.

---

## 🛠️ Solución de Problemas Frecuentes

- **Error `EADDRINUSE` en el puerto `3000` al iniciar el backend:**
  Otro servicio local (por ejemplo Grafana u otra instancia previa de Node) está usando el puerto `3000`. En Windows PowerShell puedes identificarlo con:
  ```powershell
  Get-NetTCPConnection -LocalPort 3000 | Select-Object LocalPort, OwningProcess
  ```
  O cambiar el puerto en `backend/.env` (`PORT=3001`) junto con `VITE_API_URL` y `VITE_WS_URL` en el frontend.
- **Errores de módulos faltantes al ejecutar `npm run build` en `backend/`:**
  Asegúrate de haber ejecutado `npm install` dentro de `backend/` después de clonar o actualizar dependencias de autenticación (`@nestjs/passport`, `@nestjs/jwt`, `bcryptjs`).
- **El mapa muestra monopatines en estado `en uso` tras cerrar pestañas bruscamente:**
  Usa el botón de reinicio rápido en la interfaz o ejecuta `POST http://localhost:3000/api/trips/reset-dev`.
