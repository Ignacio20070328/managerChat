import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { SesionExpiradaError } from '@/lib/api';
import { useSesion } from '@/lib/contexto-sesion';

/**
 * Carga datos de la API y los vuelve a pedir cada vez que la pantalla
 * queda visible (por ejemplo, al volver desde el menú).
 */
export function useDatos<T>(ruta: string) {
  const { api } = useSesion();
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const peticionActual = useRef(0);

  const cargar = useCallback(
    async (esRefresco = false) => {
      const numero = ++peticionActual.current;
      if (esRefresco) setRefrescando(true);
      try {
        const resultado = await api<T>(ruta);
        // Ignora respuestas viejas si se pidió otra cosa mientras tanto
        if (numero !== peticionActual.current) return;
        setDatos(resultado);
        setError(null);
      } catch (e) {
        if (numero !== peticionActual.current || e instanceof SesionExpiradaError) return;
        setError(e instanceof Error ? e.message : 'Error al cargar');
      } finally {
        if (numero === peticionActual.current) {
          setCargando(false);
          setRefrescando(false);
        }
      }
    },
    [api, ruta]
  );

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  return { datos, setDatos, error, cargando, refrescando, recargar: () => cargar(true) };
}
