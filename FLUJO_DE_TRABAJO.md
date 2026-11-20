# Flujo de trabajo con ramas

Regla principal: **nadie trabaja directo en `main`**. `main` es la versión que funciona.
Cada cambio se hace en su propia rama y entra a `main` con un *pull request* que revisa el otro.

```
main ──●────────────●──────────────●──▶   (siempre funciona)
        \          / \            /
         ●──●──●──●   ●──●──●────●        ramas: una por cambio
      ia-gemini       pantalla-ventas
```

## 1. Antes de empezar algo nuevo

```bash
cd ~/Documentos/TerryChat
git switch main
git pull                          # trae lo último que se unió a main
git switch -c nombre-del-cambio   # crea tu rama (ej: ia-gemini, arreglo-login, pantalla-ventas)
```

Nombres de rama: cortos, en minúsculas y con guiones, describiendo el cambio.

## 2. Mientras trabajas

```bash
git status                        # revisa qué cambió
git add <archivo> <archivo>       # agrega solo lo que corresponde
git commit -m "Qué cambiaste y por qué"
git push -u origin nombre-del-cambio   # la primera vez; después basta con: git push
```

Haz commits pequeños y seguidos. Sube la rama aunque no esté terminada: así queda respaldada.

**Nunca deben aparecer en `git status` ni subirse:**
- `.env`, `gestor-movil/.env.local`: contraseñas y claves
- `.wwebjs_auth/`, `.wwebjs_cache/`: la sesión de WhatsApp
- `public/uploads/`: comprobantes de clientes

Revisa también que `.env.example` no tenga una clave real (debe quedar con los valores vacíos).

## 3. Cuando terminas: pull request

```bash
gh pr create --base main --fill   # crea el pull request con tus commits
```

Luego avísale al otro. En la descripción cuenta qué cambiaste y cómo probarlo.

## 4. Revisar el pull request del otro

```bash
gh pr list                        # ver los pendientes
gh pr checkout <número>           # bajar su rama a tu computador para probarla
gh pr diff <número>               # ver los cambios
gh pr review <número> --approve   # aprobar
gh pr review <número> --request-changes -b "Qué falta"   # pedir cambios
```

Si el cambio toca la base de datos o los paquetes, al probarlo corre lo que diga la descripción
(por ejemplo `npm install`, o aplicar un archivo de `db/migraciones/`).

## 5. Unir a main

Quien creó el pull request lo une cuando el otro lo aprobó:

```bash
gh pr merge <número> --squash --delete-branch   # une todo en un commit y borra la rama
git switch main
git pull
```

## Si tu rama quedó atrás de main

Si el otro unió algo mientras trabajabas:

```bash
git switch main && git pull
git switch nombre-del-cambio
git merge main                    # trae lo nuevo de main a tu rama
```

Si aparece `CONFLICT`: abre el archivo, deja la versión correcta entre las marcas `<<<<<<<` y `>>>>>>>`,
y luego `git add <archivo>` y `git commit`.

## Qué NO hacer

- `git push --force` y `git reset --hard`: borran trabajo y reescriben la historia del otro.
- Commitear directo en `main`.
- Unir tu propio pull request sin que el otro lo vea (salvo un arreglo urgente y avisando).

## Recomendado para el dueño del repo

En GitHub → *Settings* → *Branches* → *Add branch ruleset* para `main`: exigir pull request y bloquear
*force push*. Así nadie (ni por error) puede saltarse el flujo.
