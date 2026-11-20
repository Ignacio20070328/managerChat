# TerryChat — Contexto del proyecto

MVP para un emprendimiento que vende productos (mermeladas) por WhatsApp. Los clientes envían
la foto de su comprobante de pago al bot, el backend la guarda y el dueño revisa y aprueba los
pagos desde una app móvil. Proyecto universitario (Universidad Católica de Temuco).

Idioma del proyecto: **español** (código, commits, mensajes al usuario y documentación).

## Arquitectura

```
Cliente (WhatsApp) ──foto + "comprobante"──▶ bot/whatsapp.js ──▶ bot/comprobantes.js ──▶ MySQL + public/uploads/
                                                                                              ▲
App móvil (gestor-movil/, Expo) ◀──── API REST (app.js, Express, puerto 3000) ────────────────┘
```

| Parte | Ubicación | Notas |
|---|---|---|
| API REST | `app.js` | Express 5. Carga `.env` con ruta absoluta. |
| Conexión BD | `config/db.js` | Pool `mysql2/promise`. Lee credenciales del `.env`; falla al arrancar si faltan. **Fechas en UTC** (`timezone: 'Z'` + `time_zone '+00:00'`). |
| Bot WhatsApp | `bot/whatsapp.js` | `whatsapp-web.js` 1.34.8 (no oficial, usa Chromium). Filtra mensajes, obtiene teléfono real y responde al cliente. |
| Registro de comprobantes | `bot/comprobantes.js` | Lógica separada de WhatsApp para poder probarla. Transacción: cliente + pedido + imagen, todo o nada. |
| Esquema BD | `db/schema.sql` | Docker lo carga solo al crear el volumen por primera vez. |
| App móvil | `gestor-movil/` | Expo SDK 58 + Expo Router. Tiene su propio `CLAUDE.md`/`AGENTS.md` (leerlo antes de tocar la app). |

### Base de datos (`gestor_mvp`)
- **Clientes**: `id_cliente`, `telefono` (UNIQUE), `nombre_completo`, `fecha_registro`.
- **Pedidos**: `id_pedido`, `id_cliente` (FK), `ruta_comprobante`, `estado`
  (ENUM `Pendiente|Aprobado|Rechazado|Entregado`), `fecha`, `fecha_aprobacion`. Índice `(estado, fecha)`.

### API
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/pedidos/pendientes` | Pedidos en estado Pendiente con teléfono del cliente. |
| PUT | `/api/pedidos/:id/aprobar` | Aprueba solo si está Pendiente. 200 / 400 ID inválido / 404 / 409 ya no pendiente. |
| GET | `/uploads/<archivo>` | Imágenes de comprobantes (estático). |

### Comportamiento del bot
- Solo chats individuales (`@c.us` / `@lid`); ignora grupos, estados y mensajes propios.
- Exige la palabra "comprobante" en el texto de la foto; si falta, la pide.
- WhatsApp a veces identifica al remitente con un **LID** (id interno, no es un teléfono):
  se convierte con `client.getContactLidAndPhone()`; si no se puede se guarda `lid:<id>`.
- Acepta JPEG/PNG/WebP ≤ 10 MB. Nombre de archivo aleatorio (UUID), **nunca el teléfono**.
- Responde ✅ al registrar, ⚠️ si el formato es inválido o hay un error interno.

## Puesta en marcha

```bash
cp .env.example .env            # completar contraseñas (comando para generarlas dentro del archivo)
npm install                     # backend, en la RAÍZ
docker compose up -d            # MySQL 8 solo en 127.0.0.1:3306, crea tablas y usuario gestor_app
npm start                       # o: npm run dev (reinicia al guardar). Pide escanear QR de WhatsApp.

cd gestor-movil && npm install  # app: dependencias SOLO aquí, nunca en la raíz
npx expo start
```

Si el volumen `db_data` ya existía de antes, MySQL **no** ejecuta `schema.sql` ni crea el usuario.
Aplicar el esquema a mano (no borra datos):
`docker exec -i mysql-gestor-mvp sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < db/schema.sql`

## Reglas del proyecto

- **Nunca commitear** `.env`, `.wwebjs_auth/`, `.wwebjs_cache/` ni `public/uploads/` (ya están en `.gitignore`).
  En el pasado se subió la sesión de WhatsApp al repo público y hubo que reescribir el historial.
- No escribir credenciales ni IPs en el código: van en `.env` (backend) o `EXPO_PUBLIC_*` (app).
- No instalar dependencias de Expo/React Native en la raíz: van en `gestor-movil/`.
- Errores de la API: registrar el detalle con `console.error` y responder un mensaje genérico (no `error.message`).
- Cambios de estado de pedidos: condicionar el `UPDATE` al estado actual (evita carreras y dobles aprobaciones).
- Para probar el backend sin abrir WhatsApp: precargar un stub de `bot/whatsapp.js` en `require.cache`
  y usar `bot/comprobantes.js` directamente. No existen tests automatizados en el repo todavía.
- App móvil: correr `npx tsc --noEmit` y `npx expo lint` dentro de `gestor-movil/` antes de dar algo por terminado.
  Hay 3 errores de TypeScript previos en archivos de la plantilla de Expo (no relacionados).

## Estado y hoja de ruta

Hecho (auditoría inicial → pasos):
1. ✅ Credenciales a `.env`, usuario MySQL propio, MySQL solo local, Expo fuera de la raíz.
2. ✅ `db/schema.sql`, endpoint `PUT /aprobar`, corrección de fechas (desfase de 3 h por zona horaria).
3. ✅ Bot: teléfono real (LID), transacción sin huérfanos, sin clientes duplicados, respuestas al cliente,
   filtro de grupos, validación de imagen, nombres aleatorios, rutas absolutas.

Pendiente:
4. **Autenticación de la API** — hoy cualquiera en la red puede ver comprobantes y aprobar pagos.
   Clave compartida app↔backend en `.env`; servir `/uploads` solo autenticado; no filtrar `error.message`
   en `GET /pendientes` y ordenarlo por fecha.
5. **App móvil** — IP a `EXPO_PUBLIC_API_URL`; separar secciones en rutas de Expo Router (hoy todo vive en
   `src/app/index.tsx` con `useState`); quitar restos de plantilla (`explore.tsx`, logos de Expo/React);
   pull-to-refresh y estados de carga/error; `expo-image`; comprimir imágenes; `Alert.alert`;
   `GET /api/pedidos/aprobados` para "Ventas / Entregas"; estado real del bot en vez de texto fijo.
- Seguridad del repo (lo hace el dueño del repo): cerrar la sesión vinculada de WhatsApp, repo privado,
  pedir a GitHub Support borrar los commits cacheados `ce928bd` y `6b50a41`, proteger `main`.
- 16 vulnerabilidades de `npm audit`, todas vía `whatsapp-web.js` → puppeteer. No aplicar
  `npm audit fix --force` (baja whatsapp-web.js de versión); esperar una versión nueva.
- Si se cae la sesión de WhatsApp, el bot no se reconecta solo (solo lo informa en consola).

### Plan de IA (propuesto, aún no implementado)
Usar la API de Claude (`@anthropic-ai/sdk`, modelo `claude-opus-5-5`, API key en `.env`). Requiere el paso 4 antes.
1. **Revisión previa de comprobantes** (primero): leer la imagen y extraer monto, fecha, banco, N° de operación
   y cuenta de destino; alertas por operación repetida, cuenta equivocada, fecha antigua, monto distinto o
   imagen que no es comprobante. Guardar los campos en `Pedidos`; analizar en segundo plano.
   **La IA solo sugiere: la aprobación siempre la hace una persona** (fotos editadas, texto inyectado en la imagen).
   Falta definir la cuenta bancaria de destino del negocio.
2. **Asistente para clientes en WhatsApp**: responde el estado de sus pedidos. Solo puede consultar pedidos del
   número que escribe (tomado de WhatsApp por código, nunca del texto). Más respuestas automáticas = más
   riesgo de bloqueo del número → usar un número dedicado.
3. **Asistente para el dueño en la app** (ventas, pendientes, estadísticas) — más adelante.
- Privacidad: avisar a los clientes que las fotos se analizan con un servicio externo.
