import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { Boton, COLORES, Encabezado, EstadoCarga, Insignia, Pantalla, T, Tarjeta } from '@/components/ui';
import { useAccionesPedido } from '@/hooks/use-acciones-pedido';
import { useDatos } from '@/hooks/use-datos';
import { imagenProtegida } from '@/lib/api';
import { useSesion } from '@/lib/contexto-sesion';
import { hace, pesos, telefonoBonito } from '@/lib/formato';
import { motivoDe, sugerenciaDe, SUGERENCIAS, type Sugerencia } from '@/lib/sugerencias';
import type { Pedido } from '@/lib/tipos';

const FILTROS: { id: Sugerencia | 'todos'; nombre: string }[] = [
  { id: 'todos', nombre: 'Todos' },
  { id: 'rechazar', nombre: 'Sospechosos' },
  { id: 'revisar', nombre: 'Revisar' },
  { id: 'aprobar', nombre: 'Coinciden' },
];
const SEGUNDOS_ACTUALIZAR = 4;

/** Comprobantes recibidos por WhatsApp que esperan revisión, los sospechosos primero. */
export default function ListaComprobantes() {
  const { datos, setDatos, error, cargando, refrescando, recargar, actualizar } = useDatos<Pedido[]>('/pedidos?estado=Pendiente');
  const { aprobar, procesando } = useAccionesPedido();
  const [filtro, setFiltro] = useState<Sugerencia | 'todos'>('todos');

  // Mientras la IA analiza en el servidor, la lista se actualiza sola
  const hayAnalisisEnCurso = !!datos?.some((p) => p.analisis?.estado === 'procesando');
  useEffect(() => {
    if (!hayAnalisisEnCurso) return;
    const temporizador = setTimeout(actualizar, SEGUNDOS_ACTUALIZAR * 1000);
    return () => clearTimeout(temporizador);
  }, [hayAnalisisEnCurso, datos, actualizar]);

  const ordenados = [...(datos ?? [])].sort((a, b) => SUGERENCIAS[sugerenciaDe(a)].orden - SUGERENCIAS[sugerenciaDe(b)].orden);
  const visibles = filtro === 'todos' ? ordenados : ordenados.filter((p) => sugerenciaDe(p) === filtro);
  const cantidad = (id: Sugerencia | 'todos') => (id === 'todos' ? ordenados.length : ordenados.filter((p) => sugerenciaDe(p) === id).length);

  const aprobarRapido = async (pedido: Pedido) => {
    if (await aprobar(pedido)) setDatos((prev) => prev?.filter((p) => p.id_pedido !== pedido.id_pedido) ?? null);
  };

  return (
    <View style={{ flex: 1 }}>
      <Encabezado titulo="Comprobantes" subtitulo={datos ? `${datos.length} por revisar` : undefined} />
      {datos && datos.length > 0 ? (
        <View style={s.barraFiltros}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            {FILTROS.map((f) => {
              const activo = filtro === f.id;
              return (
                <TouchableOpacity key={f.id} onPress={() => setFiltro(f.id)} accessibilityRole="tab" accessibilityState={{ selected: activo }}
                  style={[s.filtro, activo && s.filtroActivo]}>
                  <T variante="semi" estilo={{ color: activo ? '#ffffff' : COLORES.textoMedio, fontSize: 13 }}>
                    {f.nombre} <T estilo={{ color: activo ? '#ffffff' : COLORES.textoSuave, fontSize: 13 }}>{cantidad(f.id)}</T>
                  </T>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
      <Pantalla refrescando={refrescando} alRefrescar={recargar}>
        <EstadoCarga cargando={cargando} error={error} alReintentar={recargar}
          vacio={visibles.length === 0}
          textoVacio={datos?.length ? 'No hay comprobantes en este filtro.' : 'No hay pagos por revisar. Cuando un cliente envíe su comprobante por WhatsApp, aparecerá aquí.'}>
          {visibles.map((pedido) => (
            <FilaComprobante key={pedido.id_pedido} pedido={pedido}
              procesando={procesando === pedido.id_pedido} bloqueado={procesando !== null}
              alAprobar={() => aprobarRapido(pedido)} />
          ))}
        </EstadoCarga>
      </Pantalla>
    </View>
  );
}

function FilaComprobante({ pedido, procesando, bloqueado, alAprobar }: {
  pedido: Pedido; procesando: boolean; bloqueado: boolean; alAprobar: () => void;
}) {
  const { token } = useSesion();
  const sugerencia = sugerenciaDe(pedido);
  const estilo = SUGERENCIAS[sugerencia];
  const montoLeido = pedido.analisis?.monto;
  const abrir = () => router.push({ pathname: '/comprobantes/[id]', params: { id: String(pedido.id_pedido) } });
  const cuando = hace(pedido.fecha_comprobante);

  return (
    <Tarjeta estilo={{ gap: 10, padding: 12 }}>
      <TouchableOpacity onPress={abrir} style={s.fila} accessibilityRole="button"
        accessibilityLabel={`Revisar comprobante de ${telefonoBonito(pedido.telefono)}, ${estilo.etiqueta}`}>
        {pedido.ruta_comprobante && token ? (
          <Image source={imagenProtegida(pedido.ruta_comprobante, token)} style={s.miniatura} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : (
          <View style={[s.miniatura, { alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="image-outline" size={22} color={COLORES.textoSuave} />
          </View>
        )}
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <T variante="fuerte" lineas={1} estilo={{ flex: 1 }}>{telefonoBonito(pedido.telefono)}</T>
            <T variante="cifra">{pesos(montoLeido ?? pedido.total)}</T>
          </View>
          <T variante="suave" estilo={{ fontSize: 12 }} lineas={1}>
            {pedido.total ? `Pedido #${pedido.id_pedido} de ${pesos(pedido.total)}` : 'Sin pedido por WhatsApp'} · {cuando}
          </T>
          <View style={{ marginTop: 3 }}>
            <Insignia texto={estilo.etiqueta} color={estilo.color} fondo={estilo.fondo} punto />
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORES.textoSuave} />
      </TouchableOpacity>
      <View style={s.motivo}>
        <T variante="semi" estilo={{ fontSize: 13 }}>{motivoDe(pedido)}</T>
      </View>
      {sugerencia === 'aprobar' ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Boton texto="Ver detalle" tipo="secundario" alPresionar={abrir} estilo={{ flex: 1 }} desactivado={bloqueado} />
          <Boton texto="Aprobar" tipo="exito" icono="checkmark" alPresionar={alAprobar} estilo={{ flex: 1 }}
            cargando={procesando} desactivado={bloqueado} />
        </View>
      ) : null}
    </Tarjeta>
  );
}

const s = StyleSheet.create({
  barraFiltros: { backgroundColor: '#ffffff', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORES.borde },
  filtro: { minHeight: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: COLORES.bordeFuerte, justifyContent: 'center', backgroundColor: '#ffffff' },
  filtroActivo: { backgroundColor: COLORES.texto, borderColor: COLORES.texto },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  miniatura: { width: 52, height: 64, borderRadius: 10, backgroundColor: '#f3eef0', borderWidth: 1, borderColor: COLORES.bordeFuerte },
  motivo: { backgroundColor: COLORES.superficie, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
});
