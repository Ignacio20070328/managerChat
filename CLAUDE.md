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
| `servicios/ia/` | Cadena de proveedores de IA con respaldo (`index.js`: `analizarImagen` y `conversar`), instrucciones y validación comunes (`esquema.js`) y un archivo por proveedor en `proveedores/`. |
| `servicios/asistente.js` | Asistente de IA de WhatsApp: arma el contexto (catálogo, datos del negocio, pedidos del cliente), limita, pausa y verifica montos y códigos antes de responder. |
| `pruebas/` | `npm test` (`node --test`): sin base de datos ni internet (IA simulada, NVIDIA imitado por un servidor local). `pruebas/manual/` usa la IA real con un cliente de ejemplo. |
| `config/carpetas.js` | `CARPETA_UPLOADS` (fotos de comprobantes). |
| `bot/whatsapp.js` | `crearBot(db)`: eventos de `whatsapp-web.js` (no oficial), estado de conexión y `notificar(telefono, texto)`. Instalado desde el commit oficial `38eb45b` (fix del QR tras el cambio de WhatsApp Web del 2026-11-23, PR #201990); volver a la versión de npm cuando se publique (> 1.34.8). |
| `bot/conversacion.js` | `procesarTexto(db, telefono, texto)` → respuesta o `null`. No depende de WhatsApp. |
| `bot/comprobantes.js` | Valida la imagen y la registra con el pedido en una transacción (archivo + fila, todo o nada). |
| `bot/mensajes.js` | **Todos** los textos que reciben los clientes. |
| `lib/auth.js` | Hash scrypt, tokens HMAC de 30 días, límite de intentos de login. |
| `config/db.js` | Pool `mysql2/promise`. **Fechas en UTC** (`timezone: 'Z'` + `time_zone '+00:00'`). |
| `db/schema.sql` | Esquema completo (con reglas CHECK de cada etapa del pedido). Docker lo carga solo al crear el volumen. |
| `db/init/02-permisos-app.sh` | Al crear la base, deja al usuario de la app con **solo `SELECT, INSERT, UPDATE, DELETE`**. |
| `db/migraciones/` | Cambios para bases ya creadas. Se aplican **como root** y **después de `npm run respaldo`**. |
| `scripts/respaldo.js`, `scripts/restaurar.js` | `npm run respaldo` (base + fotos en `respaldos/`, guarda los últimos 10) y `npm run restaurar -- <nombre>` (respalda el estado actual antes de reemplazar). |
| `scripts/crear-password.js` | `npm run crear-password`: guarda el hash en `.env` y rota `TOKEN_SECRET`. |

### Base de datos (`gestor_mvp`) — montos en CLP enteros
- **Clientes**: `telefono` UNIQUE (`lid:<id>` si WhatsApp oculta el número).
- **Productos**: `nombre` UNIQUE, `precio`, `activo` (no se borran; se desactivan).
- **Pedidos**: `total` (NULL si llegó un comprobante sin pedido previo), `estado`, `motivo_rechazo` y una fecha por
  etapa. Ciclo: `PorPagar` (pidió por el bot) → `Pendiente` (llegó comprobante) → `Aprobado` | `Rechazado`
  → `Entregado`, o `Cancelado` (`cancelado_por` cliente/dueño, `fecha_cancelacion`). Máximo un `PorPagar` por
  cliente (un pedido nuevo lo reemplaza). `cancelacion_solicitada`: el cliente pidió cancelar un pedido ya pagado
  (`Pendiente`/`Aprobado`); el dueño decide en la app (cancelar y devolver el dinero por fuera, o mantenerlo).
- **DetallePedido**: copia `precio_unitario` al pedir (cambiar el catálogo no altera pedidos antiguos).
- **Configuracion**: clave/valor (`nombre_negocio`, `datos_transferencia`, `color_marca`, `asistente_activo` si/no,
  `direccion_retiro`, `horario_atencion`, `preguntas_frecuentes`). `color_marca` solo acepta
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
| PUT | `/api/pedidos/:id/cancelar` · `/mantener` | El dueño cancela (PorPagar/Pendiente/Aprobado) o mantiene un pedido cuya cancelación pidió el cliente. Avisan al cliente. |
| GET | `/api/pedidos?cancelacion=solicitada` | Pedidos pagados cuyo cliente pidió cancelar (`/resumen` trae `cancelacionesSolicitadas`). |
| POST | `/api/pedidos/:id/analizar` | Reanaliza el comprobante con IA y espera el resultado. 409 si la IA está desactivada o no hay comprobante. Cada pedido de las listas trae `analisis`. |
| GET/POST/PUT | `/api/productos`, `/api/productos/:id` | Catálogo (activos primero, luego por nombre: ese orden numera el menú del bot). |
| GET/PUT | `/api/configuracion` | Nombre del negocio, datos de transferencia y color de marca (+ `colores_disponibles`). |
| GET | `/api/resumen` | Conteo por estado, pendientes por sugerencia de la IA, productos activos, ventas de 7 días por día local (`ZONA_HORARIA`, por defecto America/Santiago), productos más vendidos (30 días), estado del bot e `ia: { activa, proveedores }`. |
| GET | `/uploads/<archivo>` | Foto del comprobante (con token). |

### Bot (solo chats individuales; ignora grupos, estados y mensajes propios)
- Comandos: `menu`/`catalogo`/`productos`/`precios`/`pedir`/`comprar` → catálogo numerado; `1x2, 2x1` → crea el
  pedido y envía total + datos de transferencia; `estado` → último pedido; `ayuda`; foto con la palabra "comprobante"; `cancelar` / "cancelar mi pedido" / "ya no
  quiero mi pedido" → sin pagar: pide «sí» y lo cancela; pagado: marca `cancelacion_solicitada` y avisa que el dueño
  lo contactará. Las respuestas «sí»/«no» a una propuesta o cancelación se atienden antes que los comandos.
- Todo lo demás lo responde el **asistente, solo si el dueño lo activó** en Ajustes (apagado por defecto). Con
  el asistente apagado el bot **no responde conversaciones normales** (el número puede ser personal).
  Activo: la IA si se puede usar con ese cliente; si no (sin IA, modo demo con cliente real o la IA falla), el
  **bot guiado sin IA** (`responderSinIa`): entiende "2 de frambuesa y una de mora" por nombre, "2" (número de
  producto → pregunta cuántos), y si no entiende envía la bienvenida con el catálogo (una vez cada 30 min) o una ayuda
  corta. En ambos casos el pedido pasa por la confirmación «sí»/«no».
- El comprobante se asocia al pedido `PorPagar` del cliente, o reabre su último `Rechazado` (≤ 7 días: el aviso de
  rechazo pide reenviarlo). **Sin pedido no se acepta** (`SinPedidoError`): el bot responde con el catálogo y cómo
  pedir. Un pedido sin productos (de antes de esta regla) no se puede aprobar (409), solo rechazar.
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
npm run chat                    # chat simulado como cliente de ejemplo (comandos, pedidos, asistente IA y /foto
                                #   para enviar un comprobante de ejemplo que revisa la IA), sin WhatsApp
npm test                        # pruebas (sin base de datos ni internet)

cd gestor-movil && npm install  # app: dependencias SOLO aquí, nunca en la raíz
cp .env.example .env.local      # poner la IP del computador en EXPO_PUBLIC_API_URL
npx expo start
```

Después: en la app, **Productos** (cargar catálogo) y **Ajustes** (datos de transferencia).

Si el volumen `db_data` ya existía, MySQL **no** ejecuta `schema.sql` ni crea el usuario. Con una base sin datos
importantes: `docker compose down -v && docker compose up -d` (**borra la base**). Con datos: `npm run respaldo` y aplicar
los archivos de `db/migraciones/` que falten, como root:
`docker exec -i mysql-gestor-mvp sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' < db/migraciones/<archivo>.sql`
y los permisos: `docker exec -i mysql-gestor-mvp sh < db/init/02-permisos-app.sh`.

## Reglas del proyecto

- **Flujo con ramas** (ver `FLUJO_DE_TRABAJO.md`): nada directo en `main`; una rama por cambio y pull request
  revisado por el otro integrante.

- **Nunca commitear** `.env`, `.wwebjs_auth/`, `.wwebjs_cache/` ni `public/uploads/` (ya están en `.gitignore`).
  En el pasado se subió la sesión de WhatsApp al repo público y hubo que reescribir el historial.
- **Respaldar antes de cualquier cambio en la base** (`npm run respaldo`). `respaldos/` tiene datos personales: está en
  `.gitignore` y no se comparte.
- El usuario de la app no puede cambiar la estructura (`ALTER`, `DROP`): migraciones y respaldos van como root.
  Las reglas CHECK de `Pedidos` exigen: solo `PorPagar` sin comprobante (y nunca con), `Aprobado`/`Entregado` con
  `fecha_aprobacion`, `Entregado` con `fecha_entrega`, `Rechazado` con motivo y fecha, `total` nulo o > 0.
- En `.env`, `ADMIN_PASSWORD_HASH` va entre comillas simples: contiene `$` y Docker Compose (que también lee `.env`)
  lo interpretaría como variables.
- No escribir credenciales ni IPs en el código: van en `.env` (backend) o `gestor-movil/.env.local` (app).
- **Nunca poner secretos en `EXPO_PUBLIC_*`**: Expo los copia en texto plano dentro de la app compilada.
- En desarrollo, `gestor-movil/.env.local` **manda** sobre una variable `EXPO_PUBLIC_*` pasada por terminal en los
  bundles de cada pantalla. Para apuntar a otro servidor: editar `.env.local` o usar `EXPO_NO_DOTENV=1`.
- Lógica de negocio en `servicios/`, nunca en rutas ni en el bot. Textos al cliente en `bot/mensajes.js`.
- Rutas nuevas: en `rutas/index.js` (quedan bajo sesión automáticamente).
- Errores: lanzar `ErrorApi` (validacion/noEncontrado/conflicto) con un mensaje para el usuario; cualquier otro
  error se registra y responde "Error interno" (nunca exponer `error.message`).
- Cambios de estado de pedidos: condicionar el `UPDATE` al estado actual (`servicios/pedidos.cambiarEstado`).
- **Pruebas: `npm test`** (carpeta `pruebas/`, archivos `*.test.js`). No usan la base ni internet: inyectan una IA
  falsa (`crearCadena([...])`), un `contexto` (`asistente.responder(…, { contexto })`) o un servidor local en lugar
  de NVIDIA (`NVIDIA_URL`). Nunca escribir pruebas que borren tablas. `crearApp()` acepta un `bot` falso; el bot se
  prueba con `crearBot(null).client.listeners('message' | 'message_create')[0]` sin llamar a `iniciar()`.
  Pendiente: una base separada para pruebas que necesiten MySQL.
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

### IA (revisión previa de comprobantes) — NVIDIA NIM activo en MODO DEMO
Proveedor **externo, NO Claude**. Hoy: **NVIDIA** (`servicios/ia/proveedores/nvidia.js`); Gemini de respaldo pendiente.

- Modelo: **`nvidia/nemotron-3.5-super-vl-120b-a12b`** vía `https://integrate.api.nvidia.com/v1/chat/completions`
  (compatible con OpenAI). Verificado el 2026-11-20: acepta la imagen como data URI base64, respeta
  `response_format: json_schema` (estricto, `esquema.ESQUEMA_JSON`), `reasoning_effort: "none"`, ~2-3 s por
  comprobante (~12 s en frío), no obedece instrucciones escritas en la imagen, detecta otras monedas.
  **`nemotron-3.5-parse` NO sirve**: es solo OCR, usa otro endpoint (multipart) y no acepta instrucciones ni JSON.
- ⚠️ **Términos de la clave gratuita (NVIDIA API Trial Terms §1.2, 2.6a, 3.3, 4.3)**: prohíben enviar datos personales
  o financieros, no permiten producción y NVIDIA puede usar lo enviado para mejorar sus modelos. Por eso
  **`IA_SOLO_DEMO=1`**: solo se envían comprobantes de clientes de ejemplo (`config/demo.js`, prefijo `5690000`);
  los reales responden 409 sin llamar a la IA. Para clientes reales hace falta un plan/proveedor con términos de
  producción que no entrene con los datos. **No quitar `IA_SOLO_DEMO` con la clave de prueba.**
- Flujo: el bot registra la foto → `analizarEnSegundoPlano()` la pone en una **cola** (máx. `IA_MAX_SIMULTANEOS`, 2)
  y vuelve de inmediato → la cadena `IA_PROVEEDORES` intenta cada proveedor con **tiempo límite que cancela la
  petición** (`IA_TIEMPO_LIMITE_MS`) y **reintentos** ante 429/5xx/red (`IA_REINTENTOS`, 1; respeta `Retry-After`;
  si no, 2 s, 4 s… máx. 8 s); si falla, pasa al siguiente → `normalizarRespuesta()` valida → las **reglas sin IA**
  (`analisis.evaluar`) generan las alertas → se guarda la sugerencia. Al arrancar, `recuperarPendientes()` reencola
  los análisis que quedaron «procesando».
- **La IA es solo consultiva**: `servicios/analisis.js` solo escribe en `AnalisisComprobante`, nunca en `Pedidos.estado`.
- Reglas: monto menor/mayor/ilegible, sin pedido previo, **moneda distinta de CLP**, cuenta distinta/ilegible,
  **titular distinto**, N° de operación ya usado antes (el original solo recibe aviso), fecha antigua/futura,
  **datos incompletos** (sin N° de operación o fecha), no es comprobante. Sugerencia: `rechazar` (no es comprobante
  u operación ya usada), `revisar` (otra alerta) o `aprobar`.
- **Seguridad de la clave**: solo en `.env` (nunca en `.env.example`, la app ni `EXPO_PUBLIC_*`). Los errores pasan
  por `ocultarSecretos()` (`servicios/ia/errores.js`); nunca se registran cabeceras, cuerpo de la petición ni la imagen.
- `IA_PROVEEDORES=simulado` devuelve datos de ejemplo sin claves. `db/migraciones/` tiene los `ALTER TABLE` para
  bases ya creadas (columna `moneda`).
- Ideas siguientes: Gemini de respaldo (verificar sus términos: el plan gratuito probablemente tiene la misma
  restricción), etapas 2 y 3 del asistente, asistente para el dueño.

### Asistente de WhatsApp (etapa 1) — `servicios/asistente.js`
- Responde dudas con **solo** los datos que le da el servidor: productos (con el código exacto para pedir cada uno),
  datos de transferencia, dirección, horario, preguntas frecuentes (Ajustes) y los **últimos 3 pedidos de ese
  cliente** (el teléfono lo da WhatsApp, nunca el texto). Si no está, dice que no sabe y que el dueño responderá.
- Modelo de texto: **`nvidia/nemotron-3.5-lightning-30b-a3b`** (`NVIDIA_MODELO_TEXTO`), ~0,5-1,2 s. Verificado el
  2026-11-24 con un cliente de ejemplo: rechaza manipulación, descuentos, aprobar pagos y datos de otros clientes.
  Tiende a deducir datos que no tiene y a "contar" mal la lista: por eso reglas estrictas + códigos escritos por el
  servidor + dos **controles sin IA** que descartan la respuesta (y envían `asistenteDatoNoVerificado`): montos que no
  existen en el catálogo/pedidos/configuración y códigos `NxM` que apuntan a otro producto.
- No puede cambiar nada por sí sola (no aprueba, no descuenta; los pedidos solo se crean con el «sí» del cliente). Apagado por defecto
  (`asistente_activo`); con `IA_SOLO_DEMO=1` solo atiende clientes de ejemplo. Límite de 8 mensajes por minuto por
  cliente; historial de 3 intercambios **solo en memoria** (30 min). Si el dueño escribe a mano en un chat
  (`message_create` propio que no registró `responder()`/`notificar()` del bot), se calla ahí 30 minutos.
- Requiere un **número de WhatsApp dedicado** al negocio (con uno personal respondería a todos los contactos).
- Prueba con la IA real: `node pruebas/manual/asistente-real.js` (cliente de ejemplo, no cambia la base).
- **Etapa 2 (hecha): pedidos en lenguaje natural con confirmación.** La IA solo devuelve `pedido_items`
  (número, nombre, cantidad). El servidor (`validarPedido`) identifica el producto **por nombre** contra todo el
  catálogo (el número solo desempata), lee la cantidad del **texto del cliente** cuando la hay (`cantidadEnTexto`),
  decide si es pedido nuevo, agregar o quitar por las palabras del cliente (`tipoDePedido`, sin IA), calcula el
  total y escribe `mensajes.confirmarPedido` (avisa si reemplaza el pedido por pagar). La propuesta vive en memoria
  10 minutos; `manejarConfirmacion` (sin IA) crea el pedido solo ante un «sí» y cancela ante un «no». Un pedido
  directo `NxM` o la intervención del dueño descartan la propuesta. Si la IA dice que "muestra el catálogo", se
  envía el catálogo real.
- Etapa 3 (pendiente): conversaciones "requiere atención" en la app.
- Privacidad: avisar a los clientes que las fotos se analizan con un servicio externo (cuando se use con reales).
