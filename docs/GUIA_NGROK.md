# Guía rápida para ejecutar SAME con ngrok

Esta guía explica cómo levantar el proyecto completo y exponerlo por HTTPS con **ngrok** para probarlo desde un celular (cámara QR, joystick táctil, alertas en vivo) o desde otro equipo.

> **Solo necesitas abrir 1 túnel (puerto `5173`)**: `frontend/vite.config.ts` ya tiene configurado `allowedHosts: true` y proxy de `/api` y `/socket.io` (`ws: true`) hacia el backend en `http://localhost:3000`. Cuando entras desde la URL de ngrok, `frontend/src/services/api.ts` y `frontend/src/services/socket.ts` usan automáticamente el mismo origen HTTPS.

---

## 1. Levantar los servicios del proyecto

Abre **3 terminales** en la raíz del repositorio (`admin_de_sistemas_de_info`):

### Terminal 1 — Backend (NestJS + Socket.io en `:3000`)
```powershell
cd backend
npm run start:dev
```
Espera a ver: `Sistema SAME Backend iniciado exitosamente en puerto: 3000`.

### Terminal 2 — Simulador IoT (`SCOOTER-01`)
```powershell
cd backend
npm run simulate
```
Espera a ver: `[IoT CONECTADO] Enlace WebSocket establecido`.

### Terminal 3 — Frontend (Vite + React en `:5173`)
```powershell
cd frontend
npm run dev
```
Espera a ver: `Local: http://localhost:5173/`.

---

## 2. Iniciar el túnel con ngrok (Terminal 4)

En este equipo `ngrok` ya está instalado (`winget`) y tu `authtoken` quedó guardado en `%LOCALAPPDATA%\ngrok\ngrok.yml`, así que normalmente basta con ejecutar:

```powershell
ngrok http 5173
```

Si la terminal todavía no reconoce el alias `ngrok` (por ejemplo, si no se ha reiniciado la sesión de terminal), ejecútalo directamente con la ruta del paquete WinGet:

```powershell
& "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe" http 5173
```

Para ver la URL en texto plano sin interfaz interactiva:

```powershell
ngrok http 5173 --log=stdout
```

- **Enlace público:** ngrok imprimirá una URL tipo `https://<subdominio>.ngrok-free.dev` (en plan gratuito la URL puede cambiar en cada inicio).
- **Inspector de peticiones local:** `http://127.0.0.1:4040`

---

## 3. Cómo probar Admin y Turista al mismo tiempo

Como la sesión (`same_auth_token` y `same_user`) se guarda en `localStorage`, dos pestañas normales del mismo navegador en la misma URL compartirán sesión. Para tener **Admin** y **Turista** abiertos a la vez, usa cualquiera de estas opciones:

1. **PC + Celular:** abre la URL de ngrok en el PC como **Admin** y en el celular como **Turista**.
2. **Normal + Incógnito:** abre la URL de ngrok en una ventana normal (**Admin**) y en una ventana privada/incógnito (**Turista**).
3. **Dos orígenes en el mismo PC:** abre `http://localhost:5173/` en una pestaña (**Admin**) y `https://<subdominio>.ngrok-free.dev/` en otra (**Turista**).

---

## 4. Configuración en otro equipo (solo la primera vez)

> **Seguridad:** nunca guardes tu `authtoken` real dentro del repositorio ni en archivos subidos a GitHub. Obtén tu token desde https://dashboard.ngrok.com/get-started/your-authtoken.

```powershell
# 1. Instalar ngrok en Windows
winget install --id Ngrok.Ngrok -e --source winget --accept-source-agreements --accept-package-agreements

# 2. Actualizar el agente si winget instaló una versión antigua (evita ERR_NGROK_121)
ngrok update

# 3. Guardar tu authtoken localmente (solo una vez por equipo)
ngrok config add-authtoken <TU_AUTHTOKEN>

# 4. Abrir el túnel al frontend
ngrok http 5173
```

---

## 5. Solución rápida de problemas

| Problema | Causa | Solución |
| --- | --- | --- |
| `ERR_NGROK_121` (versión muy antigua) | El binario instalado es inferior a `3.30.0`. | Ejecuta `ngrok update` y vuelve a correr `ngrok http 5173`. |
| `ngrok` no se reconoce en PowerShell | El `PATH` no se ha recargado tras instalar con `winget`. | Cierra y abre la terminal, o usa la ruta completa dentro de `%LOCALAPPDATA%\Microsoft\WinGet\Packages\Ngrok.Ngrok*`. |
| `Blocked request. This host is not allowed` | `server.allowedHosts` bloquea el dominio externo. | Verifica que `allowedHosts: true` siga activo en `frontend/vite.config.ts`. |
| La página carga, pero el login falla desde el celular | El backend `:3000` no está encendido o falta el proxy en Vite. | Confirma que `npm run start:dev` corre en `:3000` y que el proxy `/api` y `/socket.io` está en `frontend/vite.config.ts`. |
