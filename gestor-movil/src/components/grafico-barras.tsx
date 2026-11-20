import { StyleSheet, View } from 'react-native';

import { COLORES, T } from '@/components/ui';
import { aclarar, useNegocio } from '@/lib/contexto-negocio';
import { diaCorto, pesos } from '@/lib/formato';

/**
 * Gráfico de barras simple (sin librerías): ventas aprobadas por día.
 * `compacto`: versión baja para Inicio, sin montos sobre las barras.
 */
export function GraficoBarras({ datos, compacto = false }: {
  datos: { dia: string; monto: number; pedidos: number }[]; compacto?: boolean;
}) {
  const { acento } = useNegocio();
  const maximo = Math.max(...datos.map((d) => d.monto), 1);
  const ultimo = datos.length - 1;
  const altura = compacto ? 56 : 140;

  return (
    <View
      accessible
      accessibilityLabel={`Ventas por día: ${datos.map((d, i) => `${i === ultimo ? 'hoy' : diaCorto(d.dia)} ${pesos(d.monto)}`).join(', ')}`}>
      <View style={[s.zona, { height: altura + (compacto ? 0 : 18) }]}>
        {datos.map((d, i) => (
          <View key={d.dia} style={s.columna}>
            {!compacto && d.monto > 0 ? <T variante="suave" estilo={s.valor} lineas={1}>{abreviar(d.monto)}</T> : null}
            <View
              style={[
                s.barra,
                { height: d.monto > 0 ? Math.max(4, (d.monto / maximo) * altura) : 3 },
                { backgroundColor: i === ultimo ? acento : aclarar(acento, 0.72) },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={s.ejes}>
        {datos.map((d, i) => (
          <T key={d.dia} variante={i === ultimo ? 'fuerte' : 'suave'} estilo={[s.dia, i === ultimo && { color: COLORES.texto }]}>
            {i === ultimo ? 'hoy' : diaCorto(d.dia)}
          </T>
        ))}
      </View>
    </View>
  );
}

/** 12500 → "12,5 mil" */
function abreviar(monto: number) {
  if (monto >= 1_000_000) return `${(monto / 1_000_000).toLocaleString('es-CL', { maximumFractionDigits: 1 })} M`;
  if (monto >= 1000) return `${(monto / 1000).toLocaleString('es-CL', { maximumFractionDigits: 1 })} mil`;
  return String(monto);
}

const s = StyleSheet.create({
  zona: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  columna: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barra: { width: '100%', borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  valor: { fontSize: 10, marginBottom: 3 },
  ejes: { flexDirection: 'row', gap: 8, marginTop: 6 },
  dia: { flex: 1, textAlign: 'center', fontSize: 11, color: COLORES.textoSuave },
});
