import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { pedirApi, SesionExpiradaError } from './api';
import { borrarToken, guardarToken, leerToken } from './sesion';

interface Sesion {
  token: string | null;
  cargando: boolean;
  /** Aviso para la pantalla de login (por ejemplo, "tu sesión expiró"). */
  aviso: string | null;
  ingresar: (token: string) => Promise<void>;
  cerrarSesion: (aviso?: string) => Promise<void>;
  /** Llama a la API con la sesión actual; si el token expiró, cierra la sesión. */
  api: <T>(ruta: string, opciones?: { metodo?: string; cuerpo?: unknown }) => Promise<T>;
}

const ContextoSesion = createContext<Sesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);

  // Al abrir la app, recupera la sesión guardada (si existe)
  useEffect(() => {
    leerToken()
      .then(setToken)
      .catch(() => setToken(null))
      .finally(() => setCargando(false));
  }, []);

  const cerrarSesion = useCallback(async (nuevoAviso?: string) => {
    await borrarToken().catch(() => {});
    setAviso(nuevoAviso ?? null);
    setToken(null);
  }, []);

  const ingresar = useCallback(async (nuevoToken: string) => {
    await guardarToken(nuevoToken);
    setAviso(null);
    setToken(nuevoToken);
  }, []);

  const api = useCallback(
    async <T,>(ruta: string, opciones?: { metodo?: string; cuerpo?: unknown }) => {
      if (!token) throw new SesionExpiradaError('No hay sesión');
      try {
        return await pedirApi<T>(ruta, token, opciones);
      } catch (error) {
        if (error instanceof SesionExpiradaError) await cerrarSesion(error.message);
        throw error;
      }
    },
    [token, cerrarSesion]
  );

  const valor = useMemo(
    () => ({ token, cargando, aviso, ingresar, cerrarSesion, api }),
    [token, cargando, aviso, ingresar, cerrarSesion, api]
  );
  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}

export function useSesion() {
  const sesion = useContext(ContextoSesion);
  if (!sesion) throw new Error('useSesion debe usarse dentro de <ProveedorSesion>');
  return sesion;
}
