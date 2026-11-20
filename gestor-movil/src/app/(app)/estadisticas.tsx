import { Text, View } from 'react-native';

import { GraficoBarras } from '@/components/grafico-barras';
import { COLORES, EstadoCarga, Pantalla, Tarjeta, Titulo, estilos } from '@/components/ui';
import { useDatos } from '@/hooks/use-datos';
import { pesos } from '@/lib/formato';
import type { Resumen } from '@/lib/tipos';

/** Ventas reales: una venta cuenta desde que su pago se aprueba. */
export default function Estadisticas() {
  const { datos, error, cargando, refrescando, recargar } = useDatos<Resumen>('/resumen');

  return (
    <Pantalla refrescando={refrescando} alRefrescar={recargar}>
      <Titulo sub="Pagos aprobados (incluye los ya entregados)">Estadísticas</Titulo>
      <EstadoCarga cargando={cargando} error={error} alReintentar={recargar}>
        {datos ? (
          <>
            <Tarjeta>
              <Text style={estilos.etiqueta}>Ventas por día · últimos 7 días</Text>
              <Text style={{ fontSize: 26, fontWeight: 'bold', color: COLORES.verdeOscuro, marginBottom: 12 }}>
                {pesos(datos.ventasSemana.monto)}
              </Text>
              <GraficoBarras datos={datos.ventasPorDia} />
            </Tarjeta>

            <Tarjeta>
              <Text style={estilos.etiqueta}>Productos más vendidos · últimos 30 días</Text>
              {datos.productosUltimos30Dias.length === 0 ? (
                <Text style={estilos.subtitulo}>Aún no hay ventas de productos del catálogo.</Text>
              ) : (
                datos.productosUltimos30Dias.map((p) => {
                  const maximo = datos.productosUltimos30Dias[0].unidades;
                  return (
                    <View key={p.nombre} style={{ marginTop: 10 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={estilos.texto}>{p.nombre}</Text>
                        <Text style={estilos.subtitulo}>{p.unidades} u · {pesos(p.monto)}</Text>
                      </View>
                      <View style={{ height: 8, backgroundColor: '#eef0f3', borderRadius: 4, marginTop: 4 }}>
                        <View style={{ height: 8, width: `${(p.unidades / maximo) * 100}%`, backgroundColor: COLORES.verde, borderRadius: 4 }} />
                      </View>
                    </View>
                  );
                })
              )}
            </Tarjeta>

            <Tarjeta>
              <Text style={estilos.etiqueta}>Pedidos por etapa (total histórico)</Text>
              {([
                ['Por pagar', datos.porEstado.PorPagar],
                ['Comprobante por revisar', datos.porEstado.Pendiente],
                ['Por entregar', datos.porEstado.Aprobado],
                ['Entregados', datos.porEstado.Entregado],
                ['Rechazados', datos.porEstado.Rechazado],
              ] as const).map(([nombre, cantidad]) => (
                <View key={nombre} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                  <Text style={estilos.texto}>{nombre}</Text>
                  <Text style={[estilos.texto, { fontWeight: 'bold' }]}>{cantidad}</Text>
                </View>
              ))}
            </Tarjeta>
          </>
        ) : null}
      </EstadoCarga>
    </Pantalla>
  );
}
