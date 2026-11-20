# TerryChat — Contexto del proyecto

Gestor de pedidos por WhatsApp para **emprendedores de cualquier rubro** (comida, ropa, artesanía…). El cliente
pide por WhatsApp, el bot calcula el total, el cliente transfiere y envía la foto del comprobante, y el dueño
revisa, aprueba y entrega desde una app móvil. Proyecto universitario (Universidad Católica de Temuco).

**La app es genérica: no asumir un rubro** en textos, íconos ni ejemplos (los datos de ejemplo de `npm run demo:cargar`
son de mermeladas solo como caso de prueba). Cada negocio configura su nombre, color, productos y datos de pago.

Idioma del proyecto: **español** (código, commits, mensajes al usuario y documentación).

## Arquitectura

```
Cliente (WhatsApp) ─▶ bot/whatsapp.js ─▶ bot/conversacion.js (menu, pedidos, estado)
                                      └▶ bot/comprobantes.js (foto + "comprobante")
                                                │
                                   servicios/ (lógica de negocio) ◀── rutas/ ◀── app.js ◀── API REST :3000
                                                │                                              ▲
                                       MySQL + public/uploads/                 App móvil (gestor-movil/)
```

### Backend (raíz)
| Ubicación | Rol |
|---|---|
| `index.js` | Punto de entrada: carga `.env`, valida auth, crea bot y app, escucha. `BOT_DESACTIVADO=1` omite WhatsApp. |
| `app.js` | `crearApp({ db, auth, bot })`: construye Express **sin efectos** (testeable). Login público; todo `/api` y `/uploads` con sesión. |
| `rutas/index.js` | Rutas HTTP autenticadas; delegan en `servicios/`. Express 5 envía los errores async al manejador. |
| `servicios/` | Lógica de negocio y SQL: `pedidos.js` (ciclo de vida, transacciones), `productos.js`, `configuracion.js`, `resumen.js`, `analisis.js` (revisión con IA + reglas). Lanzan `ErrorApi` (`lib/errores.js`) con código y mensaje apto para el usuario. |
| `servicios/ia/` | Cadena de proveedores de IA con respaldo (`index.js`), instrucciones y validación comunes (`esquema.js`) y un archivo por proveedor en `proveedores/`. |
| `config/carpetas.js` | `CARPETA_UPLOADS` (fotos de comprobantes). |
| `bot/whatsapp.js` | `crearBot(db)`: eventos de `whatsapp-web.js` 1.34.8 (no oficial), estado de conexión y `notificar(telefono, texto)`. |
| `bot/conversacion.js` | `procesarTexto(db, telefono, texto)` → respuesta o `null`. No depende de WhatsApp. |
| `bot/comprobantes.js` | Valida la imagen y la registra con el pedido en una transacción (archivo + fila, todo o nada). |
| `bot/mensajes.js` | **Todos** los textos que reciben los clientes. |
| `lib/auth.js` | Hash scrypt, tokens HMAC de 30 días, límite de intentos de login. |
| `config/db.js` | Pool `mysql2/promise`. **Fechas en UTC** (`timezone: 'Z'` + `time_zone '+00:00'`). |
| `db/schema.sql` | Esquema completo. Docker lo carga solo al crear el volumen por primera vez. |
| `scripts/crear-password.js` | `npm run crear-password`: guarda el hash en `.env` y rota `TOKEN_SECRET`. |

### Base de datos (`gestor_mvp`) — montos en CLP enteros
- **Clientes**: `telefono` UNIQUE (`lid:<id>` si WhatsApp oculta el número).
- **Productos**: `nombre` UNIQUE, `precio`, `activo` (no se borran; se desactivan).
- **Pedidos**: `total` (NULL si llegó un comprobante sin pedido previo), `estado`, `motivo_rechazo` y una fecha por
  etapa. Ciclo: `PorPagar` (pidió por el bot) → `Pendiente` (llegó comprobante) → `Aprobado` | `Rechazado`
  → `Entregado`. Máximo un `PorPagar` por cliente (un pedido nuevo lo reemplaza).
- **DetallePedido**: copia `precio_unitario` al pedir (cambiar el catálogo no altera pedidos antiguos).
- **Configuracion**: clave/valor (`nombre_negocio`, `datos_transferencia`, `color_marca`). `color_marca` solo acepta
  los de `COLORES_MARCA` (servicios/configuracion.js), todos con contraste ≥ 5:1 con texto blanco; la API los entrega
  en `colores_disponibles`.
- **AnalisisComprobante**: 1:1 con el pedido (reanalizar la reemplaza): `estado` (procesando/completado/fallido),
  `proveedor`, datos leídos (monto, bancos, cuenta, titular, N° de operación, fecha), `alertas` JSON y `sugerencia`.

### API (todo con `Authorization: Bearer <token>` salvo el login)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/login` | `{ password }` → `{ token }`. 429 tras 5 fallos por IP en 15 min. Pública. |
| GET | `/api/pedidos?estado=` | Lista por estado con `items`. Lo que espera acción, más antiguo primero; historial (máx. 100), más reciente primero. |
| GET | `/api/pedidos/:id` | Un pedido con `items`. |
| PUT | `/api/pedidos/:id/aprobar` · `/rechazar` `{ motivo }` · `/entregar` | Transiciones atómicas (409 si el estado no corresponde). Aprobar y rechazar avisan al cliente y devuelven `notificado`. |
| POST | `/api/pedidos/:id/analizar` | Reanaliza el comprobante con IA y espera el resultado. 409 si la IA está desactivada o no hay comprobante. Cada pedido de las listas trae `analisis`. |
| GET/POST/PUT | `/api/productos`, `/api/productos/:id` | Catálogo (activos primero, luego por nombre: ese orden numera el menú del bot). |
| GET/PUT | `/api/configuracion` | Nombre del negocio, datos de transferencia y color de marca (+ `colores_disponibles`). |
| GET | `/api/resumen` | Conteo por estado, pendientes por sugerencia de la IA, productos activos, ventas de 7 días por día local (`ZONA_HORARIA`, por defecto America/Santiago), productos más vendidos (30 días), estado del bot e `ia: { activa, proveedores }`. |
| GET | `/uploads/<archivo>` | Foto del comprobante (con token). |

### Bot (solo chats individuales; ignora grupos, estados y mensajes propios)
- **No responde conversaciones normales** (el número puede ser personal). Solo reacciona a:
  `menu`/`catalogo`/`productos`/`precios`/`pedir`/`comprar` → catálogo numerado; `1x2, 2x1` → crea el pedido
  y envía total + datos de transferencia; `estado` → último pedido; `ayuda`; foto con la palabra "comprobante".
- El comprobante se asocia al pedido `PorPagar` del cliente; si no hay, crea un pedido sin total.
- Convierte los **LID** de WhatsApp a teléfono con `client.getContactLidAndPhone()`.
- Imágenes JPEG/PNG/WebP ≤ 10 MB con nombre aleatorio (nunca el teléfono).

### App móvil (`gestor-movil/`, Expo SDK 58 + Expo Router) — leer su `AGENTS.md` antes de tocarla
- `src/app/_layout.tsx`: carga fuentes + `ProveedorSesion` + `Stack.Protected` (sin sesión solo `login`; con sesión `(app)`).
- `src/app/(app)/_layout.tsx`: `ProveedorNegocio` + menú lateral (`expo-router/drawer`, incluido en expo-router desde
  SDK 56) con cabecera del color del negocio, globos con contadores (se actualizan al abrirlo) y estado del bot.
  Pantallas: `index` (Inicio), `comprobantes/` (Stack: `index` lista + `[id]` detalle), `ventas`, `estadisticas`,
  `productos`, `ajustes`. Cada pantalla dibuja su `<Encabezado>` (el del drawer está oculto).
- Diseño: fondo crema `#fbf7f4`, **color de marca elegido por el negocio** (`useNegocio().acento` / `acentoSuave`),
  verde solo para aprobar, rojo/ámbar solo para alertas. Fuentes Plus Jakarta Sans (títulos, cifras) e Inter (texto)
  vía `<T variante=…>`; con fuentes propias no usar `fontWeight`, usar la familia (`FUENTES`). Importar cada grosor
  por separado (`@expo-google-fonts/inter/400Regular`): el paquete completo suma ~7 MB.
- `src/components/ui.tsx`: `COLORES`, `FUENTES`, `T`, `Encabezado`, `Pantalla`, `Tarjeta`, `Boton` (primario/exito/
  peligro/secundario), `Insignia`, `EstadoCarga`. `src/lib/sugerencias.ts`: textos y colores de las sugerencias de la
  IA y la tabla «Pedido vs. Comprobante». `src/hooks/use-acciones-pedido.ts`: aprobar/rechazar con confirmación.
- `src/lib/`: `api.ts`, `contexto-sesion.tsx` (`useSesion().api` cierra la sesión ante un 401), `contexto-negocio.tsx`,
  `sesion.ts` (token en `expo-secure-store`; web: `localStorage`), `formato.ts`, `tipos.ts`.
- `src/hooks/use-datos.ts`: carga datos, los recarga al volver a la pantalla; `recargar` (con indicador) y `actualizar` (silencioso).

## Puesta en marcha

```bash
cp .env.example .env            # completar contraseñas de la BD (comando para generarlas dentro del archivo)
npm install                     # backend, en la RAÍZ
npm run crear-password          # contraseña de acceso a la app (se guarda solo su hash)
docker compose up -d            # MySQL 8 solo en 127.0.0.1:3306, crea tablas y usuario gestor_app
npm start                       # API + bot (pide escanear el QR). npm run dev: reinicia al guardar.
npm run api                     # solo la API, SIN WhatsApp (para trabajar en la app)
npm run demo:cargar             # datos de ejemplo (pedidos en todas las etapas, comprobantes, análisis IA simulado)
npm run demo:borrar             # borra SOLO los de ejemplo (teléfonos 5690000…, productos "(ejemplo)")

cd gestor-movil && npm install  # app: dependencias SOLO aquí, nunca en la raíz
cp .env.example .env.local      # poner la IP del computador en EXPO_PUBLIC_API_URL
npx expo start
```

Después: en la app, **Productos** (cargar catálogo) y **Ajustes** (datos de transferencia).

Si el volumen `db_data` ya existía, MySQL **no** ejecuta `schema.sql` ni crea el usuario. Con una base vacía:
`docker compose down -v && docker compose up -d`. Con datos, aplicar `db/schema.sql` a mano y migrar las tablas viejas.

## Reglas del proyecto

- **Nunca commitear** `.env`, `.wwebjs_auth/`, `.wwebjs_cache/` ni `public/uploads/` (ya están en `.gitignore`).
  En el pasado se subió la sesión de WhatsApp al repo público y hubo que reescribir el historial.
- No escribir credenciales ni IPs en el código: van en `.env` (backend) o `gestor-movil/.env.local` (app).
- **Nunca poner secretos en `EXPO_PUBLIC_*`**: Expo los copia en texto plano dentro de la app compilada.
- En desarrollo, `gestor-movil/.env.local` **manda** sobre una variable `EXPO_PUBLIC_*` pasada por terminal en los
  bundles de cada pantalla. Para apuntar a otro servidor: editar `.env.local` o usar `EXPO_NO_DOTENV=1`.
- Lógica de negocio en `servicios/`, nunca en rutas ni en el bot. Textos al cliente en `bot/mensajes.js`.
- Rutas nuevas: en `rutas/index.js` (quedan bajo sesión automáticamente).
- Errores: lanzar `ErrorApi` (validacion/noEncontrado/conflicto) con un mensaje para el usuario; cualquier otro
  error se registra y responde "Error interno" (nunca exponer `error.message`).
- Cambios de estado de pedidos: condicionar el `UPDATE` al estado actual (`servicios/pedidos.cambiarEstado`).
- **Las pruebas actuales borran tablas completas**: no correrlas contra una base con datos que importen. Pendiente:
  una base de datos separada para pruebas.
- Pruebas: `crearApp()` acepta un `bot` falso (`{ estado, notificar }`) y escucha en un puerto libre; el bot se
  prueba con `crearBot(db).client.listeners('message')[0]` sin llamar a `iniciar()`. No hay suite en el repo todavía.
- App: correr `npx tsc --noEmit` y `npx expo lint` dentro de `gestor-movil/` (hoy: 0 errores, 0 avisos).

## Estado y hoja de ruta

Hecho:
1. ✅ Credenciales a `.env`, usuario MySQL propio, MySQL solo local, Expo fuera de la raíz.
2. ✅ Esquema de BD, aprobar pagos, corrección de fechas (UTC).
3. ✅ Bot robusto: teléfono real (LID), transacciones, sin duplicados, validación de imagen.
4. ✅ Autenticación: login con contraseña, tokens, `/uploads` protegido, límite de intentos, CORS restringido.
5. ✅ Reestructuración: catálogo y ciclo completo del pedido, pedidos por WhatsApp con total, avisos al cliente,
   backend en módulos, app con menú lateral y una pantalla por sección, plantilla de Expo eliminada.
6. ✅ Estructura de IA (proveedores reales pendientes) y datos de ejemplo.
7. ✅ Rediseño de la app según la propuesta visual aprobada; genérica para cualquier rubro, color de marca configurable.

Pendiente:
- Sin HTTPS: en la wifi local la contraseña y el token viajan sin cifrar. Android bloquea HTTP en builds de release.
- El límite de intentos vive en memoria y es por IP. Hay una sola contraseña compartida (sin usuarios).
- Fotos de comprobantes en la **versión web** de la app: `Image` de react-native-web no envía cabeceras, así que
  no se verificó que carguen con el token en web (en Android/iOS sí se envían).
- La app no se probó en un teléfono real tras la reestructuración (solo TypeScript, lint y compilación de Android).
- Seguridad del repo (lo hace el dueño): cerrar la sesión vinculada de WhatsApp, repo privado, pedir a GitHub
  Support borrar los commits cacheados `ce928bd` y `6b50a41`, proteger `main`.
- 16 vulnerabilidades de `npm audit`, todas vía `whatsapp-web.js` → puppeteer. No usar `npm audit fix --force`.
- Si se cae la sesión de WhatsApp, el bot no se reconecta solo (la app lo muestra en Inicio y Ajustes).

### IA (revisión previa de comprobantes) — estructura lista, proveedores reales pendientes
Proveedor **externo, NO Claude**: **NVIDIA principal y Gemini de respaldo** (modelos por definir; deben leer imágenes).

- Flujo: el bot registra la foto → `analizarEnSegundoPlano()` (no demora la respuesta al cliente) → la cadena
  `IA_PROVEEDORES` (p. ej. `nvidia,gemini`) prueba cada proveedor; ante cuota agotada, 429, caída, tiempo límite,
  falta de configuración o respuesta ilegible pasa al siguiente → `esquema.normalizarRespuesta()` valida → las
  **reglas sin IA** de `analisis.evaluar()` comparan con el pedido → se guarda la sugerencia.
- Reglas: monto menor/mayor al total, N° de operación ya usado (solo el comprobante que llegó **después** es
  sospechoso; el original recibe un aviso), cuenta de destino distinta de los datos de transferencia, fecha
  antigua (> 3 días), no es comprobante. Sugerencia: `rechazar` (no es comprobante u operación ya usada),
  `revisar` (cualquier otra alerta) o `aprobar`.
- **La IA solo sugiere: la aprobación siempre la hace una persona.** Las instrucciones piden ignorar texto
  escrito dentro de la imagen (las fotos pueden estar editadas o traer instrucciones inyectadas).
- `IA_PROVEEDORES=simulado` devuelve datos de ejemplo sin claves (para desarrollar la app).
- **Pendiente:** implementar `servicios/ia/proveedores/nvidia.js` y `gemini.js` (hoy son esqueletos que lanzan
  `ErrorProveedor`) según la documentación oficial del modelo elegido; claves en `.env`
  (`NVIDIA_API_KEY`, `NVIDIA_MODELO`, `GEMINI_API_KEY`, `GEMINI_MODELO`), nunca en el código ni en la app.
- Ideas siguientes: asistente para clientes en WhatsApp (y pedidos en texto libre: "2 de frambuesa"; solo puede
  consultar pedidos del número que escribe) y asistente para el dueño en la app.
- Privacidad: avisar a los clientes que las fotos se analizan con un servicio externo; revisar si el proveedor
  usa los datos para entrenar (sobre todo en planes gratuitos).
