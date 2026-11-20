import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';

import { COLORES, EstadoCarga, Pantalla, Tarjeta, Titulo, estilos } from '@/components/ui';
import { useDatos } from '@/hooks/use-datos';
import { pesos, TEXTO_ESTADO_BOT } from '@/lib/formato';
import type { Resumen } from '@/lib/tipos';

/** Panel del día: qué requiere atención y cómo va la semana. */
export default function Inicio() {
  const { datos, error, cargando, refrescando, recargar } = useDatos<Resumen>('/resumen');
  const bot = datos ? TEXTO_ESTADO_BOT[datos.bot] : null;

  return (
    <Pantalla refrescando={refrescando} alRefrescar={recargar}>
      <Titulo sub="Desliza hacia abajo para actualizar">Inicio</Titulo>
      <EstadoCarga cargando={cargando} error={error} alReintentar={recargar}>
        {datos && bot ? (
          <>
            <Accion
              icono="document-text"
              color={COLORES.ambar}
              fondo={COLORES.ambarFondo}
              cantidad={datos.porEstado.Pendiente}
              texto={datos.porEstado.Pendiente === 1 ? 'comprobante por revisar' : 'comprobantes por revisar'}
              destino="/comprobantes"
            />
            <Accion
              icono="bag-check"
              color={COLORES.azul}
              fondo={COLORES.azulFondo}
              cantidad={datos.porEstado.Aprobado}
              texto={datos.porEstado.Aprobado === 1 ? 'pedido por entregar' : 'pedidos por entregar'}
              destino="/ventas"
            />
            <Tarjeta>
              <Text style={estilos.etiqueta}>Esperando pago</Text>
              <Text style={estilos.texto}>
                {datos.porEstado.PorPagar} {datos.porEstado.PorPagar === 1 ? 'cliente pidió' : 'clientes pidieron'} por WhatsApp y aún no envían comprobante.
              </Text>
            </Tarjeta>

            <Tarjeta>
              <Text style={estilos.etiqueta}>Ventas de los últimos 7 días</Text>
              <Text style={s.monto}>{pesos(datos.ventasSemana.monto)}</Text>
              <Text style={estilos.subtitulo}>
                {datos.ventasSemana.pedidos} {datos.ventasSemana.pedidos === 1 ? 'pedido aprobado' : 'pedidos aprobados'}
              </Text>
            </Tarjeta>

            <Tarjeta estilo={s.filaBot}>
              <Ionicons name="logo-whatsapp" size={26} color={bot.color} />
              <View style={{ flex: 1 }}>
                <Text style={estilos.etiqueta}>Bot de WhatsApp</Text>
                <Text style={[estilos.texto, { color: bot.color }]}>{bot.texto}</Text>
              </View>
            </Tarjeta>
          </>
        ) : null}
      </EstadoCarga>
    </Pantalla>
  );
}

function Accion({ icono, color, fondo, cantidad, texto, destino }: {
  icono: keyof typeof Ionicons.glyphMap; color: string; fondo: string; cantidad: number; texto: string; destino: Href;
}) {
  return (
    <TouchableOpacity onPress={() => router.navigate(destino)} accessibilityRole="button" accessibilityLabel={`${cantidad} ${texto}`}>
      <Tarjeta estilo={[s.accion, cantidad > 0 && { borderColor: color, backgroundColor: fondo }]}>
        <Ionicons name={icono} size={28} color={cantidad > 0 ? color : COLORES.textoSuave} />
        <Text style={[s.cantidad, { color: cantidad > 0 ? color : COLORES.textoSuave }]}>{cantidad}</Text>
        <Text style={[estilos.texto, { flex: 1 }]}>{texto}</Text>
        <Ionicons name="chevron-forward" size={20} color={COLORES.textoSuave} />
      </Tarjeta>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  accion: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cantidad: { fontSize: 28, fontWeight: 'bold', minWidth: 32, textAlign: 'center' },
  monto: { fontSize: 28, fontWeight: 'bold', color: COLORES.verdeOscuro },
  filaBot: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
