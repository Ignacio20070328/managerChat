import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useSesion } from './contexto-sesion';
import type { Configuracion } from './tipos';

const COLOR_POR_DEFECTO = '#a3133f';

interface Negocio {
  config: Configuracion | null;
  /** Color de marca elegido por el negocio (Ajustes). */
  acento: string;
  /** Versión muy clara del color, para fondos de íconos y elementos activos. */
  acentoSuave: string;
  actualizarConfig: (config: Configuracion) => void;
  recargarConfig: () => void;
}

const ContextoNegocio = createContext<Negocio | null>(null);

/** Mezcla un color con blanco: proporcion 0 = el color, 1 = blanco. */
export function aclarar(hex: string, proporcion: number) {
  const n = parseInt(hex.slice(1), 16);
  const canal = (desplazamiento: number) => {
    const c = (n >> desplazamiento) & 255;
    return Math.round(c + (255 - c) * proporcion).toString(16).padStart(2, '0');
  };
  return `#${canal(16)}${canal(8)}${canal(0)}`;
}

/** Nombre y color del negocio, compartidos por todas las pantallas de la app. */
export function ProveedorNegocio({ children }: { children: ReactNode }) {
  const { api } = useSesion();
  const [config, setConfig] = useState<Configuracion | null>(null);

  const recargarConfig = useCallback(() => {
    api<Configuracion>('/configuracion').then(setConfig).catch(() => {});
  }, [api]);

  useEffect(recargarConfig, [recargarConfig]);

  const valor = useMemo(() => {
    const acento = /^#[0-9a-f]{6}$/i.test(config?.color_marca ?? '') ? config!.color_marca : COLOR_POR_DEFECTO;
    return { config, acento, acentoSuave: aclarar(acento, 0.9), actualizarConfig: setConfig, recargarConfig };
  }, [config, recargarConfig]);

  return <ContextoNegocio.Provider value={valor}>{children}</ContextoNegocio.Provider>;
}

export function useNegocio() {
  const negocio = useContext(ContextoNegocio);
  if (!negocio) throw new Error('useNegocio debe usarse dentro de <ProveedorNegocio>');
  return negocio;
}
