import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

import { Boton, COLORES, Encabezado, EstadoCarga, Pantalla, s as ui, T, Tarjeta } from '@/components/ui';
import { useDatos } from '@/hooks/use-datos';
import { API_URL, SesionExpiradaError } from '@/lib/api';
import { useNegocio } from '@/lib/contexto-negocio';
import { useSesion } from '@/lib/contexto-sesion';
import { avisar, confirmar, TEXTO_ESTADO_BOT } from '@/lib/formato';
import type { Configuracion, Resumen } from '@/lib/tipos';

export default function Ajustes() {
  const { cerrarSesion } = useSesion();
  const config = useDatos<Configuracion>('/configuracion');
  const resumen = useDatos<Resumen>('/resumen');

  const salir = async () => {
    if (await confirmar('Cerrar sesión', '¿Quieres salir de la app en este teléfono?', 'Salir')) cerrarSesion();
  };
  const bot = resumen.datos ? TEXTO_ESTADO_BOT[resumen.datos.bot] : null;
  const ia = resumen.datos?.ia;

  return (
    <View style={{ flex: 1 }}>
      <Encabezado titulo="Ajustes" />
      <Pantalla refrescando={config.refrescando} alRefrescar={() => { config.recargar(); resumen.recargar(); }}>
        <EstadoCarga cargando={config.cargando} error={config.error} alReintentar={config.recargar}>
          {config.datos ? (
            // key: si llegan datos nuevos del servidor, el formulario se reinicia con ellos
            <FormularioNegocio
              key={`${config.datos.nombre_negocio}|${config.datos.datos_transferencia}|${config.datos.color_marca}`}
              inicial={config.datos}
              alGuardar={config.setDatos}
            />
          ) : null}
        </EstadoCarga>

        <T variante="etiqueta" estilo={{ marginTop: 8 }}>Conexiones</T>
        <Tarjeta estilo={s.filaEstado}>
          <Ionicons name="logo-whatsapp" size={26} color={bot?.color ?? COLORES.textoSuave} />
          <View style={{ flex: 1 }}>
            <T variante="fuerte">Bot de WhatsApp</T>
            <T estilo={{ fontSize: 14, color: bot?.color ?? COLORES.textoSuave }}>{bot?.texto ?? 'Consultando…'}</T>
          </View>
        </Tarjeta>
        <Tarjeta estilo={s.filaEstado}>
          <Ionicons name="sparkles" size={24} color={ia?.activa ? COLORES.verde : COLORES.textoSuave} />
          <View style={{ flex: 1 }}>
            <T variante="fuerte">Revisión de comprobantes con IA</T>
            <T variante="suave">
              {!ia ? 'Consultando…' : ia.activa ? `Activa: ${ia.proveedores.join(' → ')}` : 'Desactivada (se configura en el servidor)'}
            </T>
            {ia?.activa && ia.soloDemo ? (
              <T variante="semi" estilo={{ fontSize: 12, color: COLORES.ambar }}>
                Modo demostración: solo revisa comprobantes de ejemplo. Los de tus clientes los revisas tú.
              </T>
            ) : null}
          </View>
        </Tarjeta>

        <Tarjeta estilo={{ gap: 2 }}>
          <T variante="fuerte">Acerca de</T>
          <T variante="suave">Versión {Constants.expoConfig?.version ?? '—'} · Servidor: {API_URL || 'sin configurar'}</T>
        </Tarjeta>

        <Boton texto="Cerrar sesión" tipo="peligro" icono="log-out-outline" alPresionar={salir} grande />
      </Pantalla>
    </View>
  );
}

function FormularioNegocio({ inicial, alGuardar }: { inicial: Configuracion; alGuardar: (c: Configuracion) => void }) {
  const { api } = useSesion();
  const { actualizarConfig } = useNegocio();
  const [nombre, setNombre] = useState(inicial.nombre_negocio);
  const [transferencia, setTransferencia] = useState(inicial.datos_transferencia);
  const [color, setColor] = useState(inicial.color_marca);
  const [guardando, setGuardando] = useState(false);

  const hayCambios = nombre !== inicial.nombre_negocio || transferencia !== inicial.datos_transferencia || color !== inicial.color_marca;

  const guardar = async () => {
    setGuardando(true);
    try {
      const nuevo = await api<Configuracion>('/configuracion', {
        metodo: 'PUT', cuerpo: { nombre_negocio: nombre, datos_transferencia: transferencia, color_marca: color },
      });
      alGuardar(nuevo);
      actualizarConfig(nuevo); // el menú, Inicio y los botones toman el nuevo nombre y color
      avisar('Guardado', 'Los cambios ya se ven en la app y el bot los usará desde el próximo pedido.');
    } catch (e) {
      if (!(e instanceof SesionExpiradaError)) avisar('No se pudo guardar', e instanceof Error ? e.message : undefined);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <T variante="etiqueta">Tu negocio</T>
      <Tarjeta estilo={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <T variante="semi">Nombre del negocio</T>
          <TextInput style={ui.input} value={nombre} onChangeText={setNombre} maxLength={80}
            placeholder="Ej: Dulces de la Ana" placeholderTextColor={COLORES.textoSuave} accessibilityLabel="Nombre del negocio" />
          <T variante="suave" estilo={{ fontSize: 12 }}>Aparece en el catálogo que envía el bot y en la app.</T>
        </View>

        <View style={{ gap: 8 }}>
          <T variante="semi">Color de la app</T>
          <View style={s.colores} accessibilityRole="radiogroup">
            {inicial.colores_disponibles.map((c) => {
              const elegido = color === c.valor;
              return (
                <TouchableOpacity key={c.valor} onPress={() => setColor(c.valor)} style={[s.color, elegido && { borderColor: c.valor }]}
                  accessibilityRole="radio" accessibilityState={{ checked: elegido }} accessibilityLabel={c.nombre}>
                  <View style={[s.muestra, { backgroundColor: c.valor }]}>
                    {elegido ? <Ionicons name="checkmark" size={20} color="#ffffff" /> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <T variante="suave" estilo={{ fontSize: 12 }}>
            {inicial.colores_disponibles.find((c) => c.valor === color)?.nombre ?? ''}
          </T>
        </View>

        <View style={{ gap: 6 }}>
          <T variante="semi">Datos para transferir</T>
          <TextInput
            style={[ui.input, { minHeight: 120, textAlignVertical: 'top' }]}
            value={transferencia}
            onChangeText={setTransferencia}
            multiline
            maxLength={1000}
            placeholder={'Banco\nTipo y número de cuenta\nRUT y nombre del titular\nCorreo'}
            placeholderTextColor={COLORES.textoSuave}
            accessibilityLabel="Datos para transferir"
          />
          <T variante="suave" estilo={{ fontSize: 12 }}>El bot los envía junto con el total de cada pedido, y la IA los usa para revisar la cuenta de destino.</T>
          {!transferencia.trim() ? (
            <T variante="semi" estilo={{ color: COLORES.ambar, fontSize: 13 }}>Sin estos datos, tus clientes no sabrán a dónde transferir.</T>
          ) : null}
        </View>

        <Boton texto="Guardar cambios" icono="save-outline" alPresionar={guardar} cargando={guardando} desactivado={!hayCambios} grande />
      </Tarjeta>
    </>
  );
}

const s = StyleSheet.create({
  filaEstado: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  colores: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  color: { padding: 3, borderRadius: 999, borderWidth: 2, borderColor: 'transparent' },
  muestra: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
