import { useState } from 'react';
import { StyleSheet, Switch, TextInput, TouchableOpacity, View } from 'react-native';
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
          {config.datos ? (
            <FormularioAsistente
              key={[config.datos.asistente_activo, config.datos.direccion_retiro, config.datos.horario_atencion, config.datos.preguntas_frecuentes].join('|')}
              inicial={config.datos}
              ia={resumen.datos?.ia}
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

/** Asistente de IA en WhatsApp: interruptor e información que puede dar a los clientes. */
function FormularioAsistente({ inicial, ia, alGuardar }: {
  inicial: Configuracion; ia?: Resumen['ia']; alGuardar: (c: Configuracion) => void;
}) {
  const { api } = useSesion();
  const [activo, setActivo] = useState(inicial.asistente_activo === 'si');
  const [direccion, setDireccion] = useState(inicial.direccion_retiro);
  const [horario, setHorario] = useState(inicial.horario_atencion);
  const [preguntas, setPreguntas] = useState(inicial.preguntas_frecuentes);
  const [guardando, setGuardando] = useState(false);

  const disponible = !!ia?.puedeConversar;
  const hayCambios = activo !== (inicial.asistente_activo === 'si') || direccion !== inicial.direccion_retiro
    || horario !== inicial.horario_atencion || preguntas !== inicial.preguntas_frecuentes;

  const cambiarActivo = async (valor: boolean) => {
    if (valor && !(await confirmar(
      'Activar el asistente',
      'El asistente responderá automáticamente los mensajes de tus clientes. Úsalo solo con un número de WhatsApp ' +
      'dedicado al negocio: con un número personal, también respondería a tus contactos.',
      'Entiendo, activar',
    ))) return;
    setActivo(valor);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const nuevo = await api<Configuracion>('/configuracion', {
        metodo: 'PUT',
        cuerpo: { asistente_activo: activo ? 'si' : 'no', direccion_retiro: direccion, horario_atencion: horario, preguntas_frecuentes: preguntas },
      });
      alGuardar(nuevo);
      avisar('Guardado', activo ? 'El asistente usará esta información desde el próximo mensaje.' : 'El asistente quedó apagado.');
    } catch (e) {
      if (!(e instanceof SesionExpiradaError)) avisar('No se pudo guardar', e instanceof Error ? e.message : undefined);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <T variante="etiqueta" estilo={{ marginTop: 8 }}>Asistente de WhatsApp (IA)</T>
      <Tarjeta estilo={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Ionicons name="chatbubbles" size={26} color={activo && disponible ? COLORES.verde : COLORES.textoSuave} />
          <View style={{ flex: 1 }}>
            <T variante="fuerte">Responder dudas de los clientes</T>
            <T variante="suave" estilo={{ fontSize: 12 }}>
              Precios, productos, datos de pago, horario, dirección y el estado de su pedido.
            </T>
          </View>
          <Switch value={activo} onValueChange={cambiarActivo} disabled={!disponible && !activo}
            trackColor={{ true: COLORES.verde, false: '#c9bfc3' }} thumbColor="#ffffff" accessibilityLabel="Activar el asistente" />
        </View>

        {!disponible ? (
          <T variante="semi" estilo={{ fontSize: 12, color: COLORES.textoSuave }}>
            La IA no está configurada en el servidor, así que el asistente no puede funcionar.
          </T>
        ) : ia?.soloDemo ? (
          <T variante="semi" estilo={{ fontSize: 12, color: COLORES.ambar }}>
            Modo demostración: solo responde a los clientes de ejemplo. A tus clientes reales no les responde.
          </T>
        ) : null}
        <T variante="suave" estilo={{ fontSize: 12 }}>
          Nunca aprueba pagos, ni cambia pedidos o precios. Si no sabe algo, le dice al cliente que tú le responderás.
          Si escribes tú en un chat, el asistente se calla en ese chat por 30 minutos.
        </T>

        <View style={{ gap: 6 }}>
          <T variante="semi">Dirección para retirar</T>
          <TextInput style={ui.input} value={direccion} onChangeText={setDireccion} maxLength={200}
            placeholder="Ej: Av. Alemania 123, Temuco" placeholderTextColor={COLORES.textoSuave} accessibilityLabel="Dirección para retirar" />
        </View>
        <View style={{ gap: 6 }}>
          <T variante="semi">Horario de atención</T>
          <TextInput style={ui.input} value={horario} onChangeText={setHorario} maxLength={200}
            placeholder="Ej: lunes a viernes de 10:00 a 18:00" placeholderTextColor={COLORES.textoSuave} accessibilityLabel="Horario de atención" />
        </View>
        <View style={{ gap: 6 }}>
          <T variante="semi">Preguntas frecuentes</T>
          <TextInput
            style={[ui.input, { minHeight: 120, textAlignVertical: 'top' }]}
            value={preguntas} onChangeText={setPreguntas} multiline maxLength={1000}
            placeholder={'Ej:\n¿Hacen envíos? Sí, dentro de Temuco por $2.000.\n¿Aceptan efectivo? Sí, al retirar.'}
            placeholderTextColor={COLORES.textoSuave} accessibilityLabel="Preguntas frecuentes"
          />
          <T variante="suave" estilo={{ fontSize: 12 }}>
            Lo que no esté aquí ni en tus productos, el asistente no lo sabe y no lo inventa. {preguntas.length}/1000
          </T>
        </View>

        <Boton texto="Guardar asistente" icono="save-outline" alPresionar={guardar} cargando={guardando} desactivado={!hayCambios} grande />
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
