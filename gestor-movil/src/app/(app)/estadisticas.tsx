import { View } from 'react-native';

import { GraficoBarras } from '@/components/grafico-barras';
import { COLORES, Encabezado, EstadoCarga, Pantalla, T, Tarjeta } from '@/components/ui';
import { useDatos } from '@/hooks/use-datos';
import { useNegocio } from '@/lib/contexto-negocio';
import { pesos } from '@/lib/formato';
import type { Resumen } from '@/lib/tipos';

/** Ventas reales: una venta cuenta desde que su pago se aprueba. */
export default function Estadisticas() {
  const { datos, error, cargando, refrescando, recargar } = useDatos<Resumen>('/resumen');
  const { acento } = useNegocio();

  return (
    <View style={{ flex: 1 }}>
      <Encabezado titulo="Estadísticas" subtitulo="Pagos aprobados, incluidos los ya entregados" />
      <Pantalla refrescando={refrescando} alRefrescar={recargar}>
        <EstadoCarga cargando={cargando} error={error} alReintentar={recargar}>
          {datos ? (
            <>
              <Tarjeta estilo={{ gap: 4 }}>
                <T variante="semi" estilo={{ fontSize: 13, color: COLORES.textoSuave }}>Ventas · últimos 7 días</T>
                <T variante="titulo" estilo={{ fontSize: 30, color: COLORES.verde, marginBottom: 14 }}>{pesos(datos.ventasSemana.monto)}</T>
                <GraficoBarras datos={datos.ventasPorDia} />
              </Tarjeta>

              <Tarjeta estilo={{ gap: 12 }}>
                <T variante="etiqueta">Lo más vendido · últimos 30 días</T>
                {datos.productosUltimos30Dias.length === 0 ? (
                  <T variante="suave">Aún no hay ventas de productos del catálogo.</T>
                ) : (
                  datos.productosUltimos30Dias.map((p) => {
                    const maximo = datos.productosUltimos30Dias[0].unidades;
                    return (
                      <View key={p.nombre} style={{ gap: 5 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                          <T estilo={{ flex: 1, fontSize: 14 }} lineas={1}>{p.nombre}</T>
                          <T variante="suave">{p.unidades} u · {pesos(p.monto)}</T>
                        </View>
                        <View style={{ height: 8, backgroundColor: '#f0ebed', borderRadius: 4 }}>
                          <View style={{ height: 8, width: `${(p.unidades / maximo) * 100}%`, backgroundColor: acento, borderRadius: 4 }} />
                        </View>
                      </View>
                    );
                  })
                )}
              </Tarjeta>

              <Tarjeta estilo={{ gap: 4 }}>
                <T variante="etiqueta" estilo={{ marginBottom: 6 }}>Pedidos por etapa (total)</T>
                {([
                  ['Esperando pago', datos.porEstado.PorPagar],
                  ['Comprobante por revisar', datos.porEstado.Pendiente],
                  ['Por entregar', datos.porEstado.Aprobado],
                  ['Entregados', datos.porEstado.Entregado],
                  ['Rechazados', datos.porEstado.Rechazado],
                  ['Cancelados', datos.porEstado.Cancelado ?? 0],
                ] as const).map(([nombre, cantidad]) => (
                  <View key={nombre} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                    <T estilo={{ fontSize: 14 }}>{nombre}</T>
                    <T variante="fuerte">{cantidad}</T>
                  </View>
                ))}
              </Tarjeta>
            </>
          ) : null}
        </EstadoCarga>
      </Pantalla>
    </View>
  );
}
