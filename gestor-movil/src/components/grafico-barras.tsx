import { StyleSheet, Text, View } from 'react-native';

import { COLORES } from '@/components/ui';
import { diaCorto, pesos } from '@/lib/formato';

/** Gráfico de barras simple (sin librerías): ventas aprobadas por día. */
export function GraficoBarras({ datos }: { datos: { dia: string; monto: number; pedidos: number }[] }) {
  const maximo = Math.max(...datos.map((d) => d.monto), 1);
  const ultimo = datos.length - 1;

  return (
    <View
      accessible
      accessibilityLabel={`Ventas por día: ${datos.map((d) => `${diaCorto(d.dia)} ${pesos(d.monto)}`).join(', ')}`}>
      <View style={s.zona}>
        {datos.map((d, i) => (
          <View key={d.dia} style={s.columna}>
            {d.monto > 0 ? <Text style={s.valor} numberOfLines={1}>{abreviar(d.monto)}</Text> : null}
            <View
              style={[
                s.barra,
                { height: d.monto > 0 ? Math.max(4, (d.monto / maximo) * 130) : 2 },
                { backgroundColor: i === ultimo ? COLORES.verde : '#b9e9cc' },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={s.ejes}>
        {datos.map((d, i) => (
          <Text key={d.dia} style={[s.dia, i === ultimo && { color: COLORES.texto, fontWeight: 'bold' }]}>
            {i === ultimo ? 'hoy' : diaCorto(d.dia)}
          </Text>
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
  zona: { flexDirection: 'row', alignItems: 'flex-end', height: 160, gap: 6, borderBottomWidth: 1, borderBottomColor: COLORES.borde },
  columna: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barra: { width: '70%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  valor: { fontSize: 10, color: COLORES.textoSuave, marginBottom: 3 },
  ejes: { flexDirection: 'row', gap: 6, marginTop: 6 },
  dia: { flex: 1, textAlign: 'center', fontSize: 12, color: COLORES.textoSuave },
});
