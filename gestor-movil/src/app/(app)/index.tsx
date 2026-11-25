import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation, type Href } from 'expo-router';
import { DrawerActions } from 'expo-router/react-navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GraficoBarras } from '@/components/grafico-barras';
import { COLORES, EstadoCarga, T, Tarjeta, type NombreIcono } from '@/components/ui';
import { useDatos } from '@/hooks/use-datos';
import { useNegocio } from '@/lib/contexto-negocio';
import { fechaLarga, pesos, TEXTO_ESTADO_BOT } from '@/lib/formato';
import type { Resumen } from '@/lib/tipos';

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Panel del día: lo urgente primero, luego cómo va la semana. */
export default function Inicio() {
  const { datos, error, cargando, refrescando, recargar } = useDatos<Resumen>('/resumen');
  const { config, acento, acentoSuave } = useNegocio();
  const navegacion = useNavigation();
  const { top } = useSafeAreaInsets();
  const bot = datos ? TEXTO_ESTADO_BOT[datos.bot] : null;

  const sinProductos = datos?.productosActivos === 0;
  const sinDatosPago = config ? !config.datos_transferencia.trim() : false;
  const sospechas = datos?.pendientesPorSugerencia;
  const detalleComprobantes = sospechas
    ? [sospechas.rechazar && plural(sospechas.rechazar, 'sospechoso', 'sospechosos'),
       sospechas.revisar && plural(sospechas.revisar, 'para revisar', 'para revisar')].filter(Boolean).join(' · ')
    : '';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORES.fondo }}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refrescando} onRefresh={recargar} tintColor="#ffffff" colors={[acento]} />}>

      <View style={[s.cabecera, { backgroundColor: acento, paddingTop: top + 12 }]}>
        <View style={s.filaCabecera}>
          <TouchableOpacity style={s.botonCabecera} onPress={() => navegacion.dispatch(DrawerActions.openDrawer())}
            accessibilityRole="button" accessibilityLabel="Abrir menú">
            <Ionicons name="menu" size={24} color="#ffffff" />
          </TouchableOpacity>
          {bot ? (
            <View style={s.estadoBot}>
              <View style={[s.punto, { backgroundColor: datos?.bot === 'conectado' ? '#7ee2a0' : '#ffd27a' }]} />
              <T variante="semi" estilo={{ color: '#ffffff', fontSize: 13 }}>{bot.textoCorto}</T>
            </View>
          ) : null}
        </View>
        <T estilo={{ color: '#ffffff', opacity: 0.85, fontSize: 14 }}>{fechaLarga()}</T>
        <T variante="titulo" estilo={{ color: '#ffffff', fontSize: 28 }} lineas={2}>{config?.nombre_negocio ?? ' '}</T>
      </View>

      <View style={s.contenido}>
        <EstadoCarga cargando={cargando} error={error} alReintentar={recargar}>
          {datos ? (
            <>
              {sinProductos || sinDatosPago ? (
                <Tarjeta estilo={{ gap: 10, borderColor: acento, borderWidth: 2 }}>
                  <T variante="fuerte" estilo={{ fontSize: 17 }}>Primeros pasos</T>
                  <T variante="suave">Completa esto para que tus clientes puedan pedir y pagar por WhatsApp.</T>
                  <Paso hecho={!sinProductos} texto="Agrega los productos que vendes" destino="/productos" />
                  <Paso hecho={!sinDatosPago} texto="Escribe tus datos para transferencias" destino="/ajustes" />
                </Tarjeta>
              ) : null}

              <T variante="etiqueta">Para hacer hoy</T>

              {datos.cancelacionesSolicitadas > 0 ? (
                <TouchableOpacity onPress={() => router.navigate({ pathname: '/ventas', params: { pestana: 'cancelar' } })}
                  accessibilityRole="button" accessibilityLabel={`${plural(datos.cancelacionesSolicitadas, 'cliente pidió', 'clientes pidieron')} cancelar`}>
                  <Tarjeta estilo={[s.tareaPrincipal, { borderColor: COLORES.ambar, borderWidth: 2, backgroundColor: COLORES.ambarFondo }]}>
                    <Ionicons name="warning" size={30} color={COLORES.ambar} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <T variante="fuerte" estilo={{ fontSize: 17, color: COLORES.ambar }}>
                        {datos.cancelacionesSolicitadas === 1 ? 'Un cliente pidió cancelar' : `${datos.cancelacionesSolicitadas} clientes pidieron cancelar`}
                      </T>
                      <T variante="suave">Ya pagaron: decide si cancelas (y devuelves el dinero) o sigues con el pedido.</T>
                    </View>
                    <Ionicons name="chevron-forward" size={22} color={COLORES.ambar} />
                  </Tarjeta>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity onPress={() => router.navigate('/comprobantes')} accessibilityRole="button"
                accessibilityLabel={`${plural(datos.porEstado.Pendiente, 'comprobante', 'comprobantes')} por revisar`}>
                <Tarjeta estilo={[s.tareaPrincipal, datos.porEstado.Pendiente > 0 && { borderColor: acento, borderWidth: 2 }]}>
                  <View style={[s.numeroGrande, { backgroundColor: acentoSuave }]}>
                    <T variante="titulo" estilo={{ color: acento, fontSize: 26 }}>{datos.porEstado.Pendiente}</T>
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <T variante="fuerte" estilo={{ fontSize: 17 }}>
                      {datos.porEstado.Pendiente === 1 ? 'Comprobante por revisar' : 'Comprobantes por revisar'}
                    </T>
                    {detalleComprobantes ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        {sospechas?.rechazar ? <Ionicons name="warning" size={14} color={COLORES.rojo} /> : null}
                        <T variante="semi" estilo={{ fontSize: 13, color: sospechas?.rechazar ? COLORES.rojo : COLORES.ambar }}>{detalleComprobantes}</T>
                      </View>
                    ) : (
                      <T variante="suave">{datos.porEstado.Pendiente ? 'Revisa y aprueba los pagos' : 'Todo al día'}</T>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={22} color={COLORES.textoSuave} />
                </Tarjeta>
              </TouchableOpacity>

              <View style={s.fila}>
                <Mosaico icono="bag-check-outline" color={COLORES.verde} fondo={COLORES.verdeFondo}
                  cantidad={datos.porEstado.Aprobado} texto="Listos para entregar" destino="/ventas" />
                <Mosaico icono="time-outline" color={COLORES.ambar} fondo={COLORES.ambarFondo}
                  cantidad={datos.porEstado.PorPagar} texto="Esperando pago" destino="/ventas" />
              </View>

              <Tarjeta estilo={{ gap: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <View style={{ gap: 2 }}>
                    <T variante="semi" estilo={{ fontSize: 13, color: COLORES.textoSuave }}>Ventas · últimos 7 días</T>
                    <T variante="titulo" estilo={{ color: COLORES.verde, fontSize: 28 }}>{pesos(datos.ventasSemana.monto)}</T>
                  </View>
                  <T variante="suave">{plural(datos.ventasSemana.pedidos, 'pedido', 'pedidos')}</T>
                </View>
                <GraficoBarras datos={datos.ventasPorDia} compacto />
              </Tarjeta>
            </>
          ) : null}
        </EstadoCarga>
      </View>
    </ScrollView>
  );
}

function Mosaico({ icono, color, fondo, cantidad, texto, destino }: {
  icono: NombreIcono; color: string; fondo: string; cantidad: number; texto: string; destino: Href;
}) {
  return (
    <TouchableOpacity style={{ flex: 1 }} onPress={() => router.navigate(destino)} accessibilityRole="button" accessibilityLabel={`${cantidad} ${texto}`}>
      <Tarjeta estilo={{ gap: 10 }}>
        <View style={[s.iconoMosaico, { backgroundColor: fondo }]}>
          <Ionicons name={icono} size={22} color={color} />
        </View>
        <T variante="titulo" estilo={{ fontSize: 26 }}>{cantidad}</T>
        <T variante="semi">{texto}</T>
      </Tarjeta>
    </TouchableOpacity>
  );
}

function Paso({ hecho, texto, destino }: { hecho: boolean; texto: string; destino: Href }) {
  return (
    <TouchableOpacity onPress={() => router.navigate(destino)} style={s.paso} accessibilityRole="button" disabled={hecho}>
      <Ionicons name={hecho ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={hecho ? COLORES.verde : COLORES.textoSuave} />
      <T variante={hecho ? 'suave' : 'fuerte'} estilo={[{ flex: 1 }, hecho && { textDecorationLine: 'line-through' }]}>{texto}</T>
      {!hecho ? <Ionicons name="chevron-forward" size={20} color={COLORES.textoSuave} /> : null}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  cabecera: { paddingHorizontal: 20, paddingBottom: 26, gap: 4, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 },
  filaCabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  botonCabecera: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  estadoBot: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  punto: { width: 8, height: 8, borderRadius: 4 },
  contenido: { padding: 16, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  tareaPrincipal: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  numeroGrande: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  fila: { flexDirection: 'row', gap: 12 },
  iconoMosaico: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  paso: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
});
