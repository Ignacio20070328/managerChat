import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

import { Boton, COLORES, EstadoCarga, Pantalla, Tarjeta, Titulo, estilos } from '@/components/ui';
import { useDatos } from '@/hooks/use-datos';
import { API_URL, SesionExpiradaError } from '@/lib/api';
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

  return (
    <Pantalla refrescando={config.refrescando} alRefrescar={() => { config.recargar(); resumen.recargar(); }}>
      <Titulo>Ajustes</Titulo>

      <EstadoCarga cargando={config.cargando} error={config.error} alReintentar={config.recargar}>
        {config.datos ? (
          // key: si llegan datos nuevos del servidor, el formulario se reinicia con ellos
          <FormularioNegocio
            key={`${config.datos.nombre_negocio}|${config.datos.datos_transferencia}`}
            inicial={config.datos}
            alGuardar={config.setDatos}
          />
        ) : null}
      </EstadoCarga>

      <Tarjeta estilo={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Ionicons name="logo-whatsapp" size={26} color={bot?.color ?? COLORES.textoSuave} />
        <View style={{ flex: 1 }}>
          <Text style={estilos.etiqueta}>Bot de WhatsApp</Text>
          <Text style={[estilos.texto, { color: bot?.color ?? COLORES.textoSuave }]}>{bot?.texto ?? 'Consultando…'}</Text>
        </View>
      </Tarjeta>

      <Tarjeta>
        <Text style={estilos.etiqueta}>Acerca de</Text>
        <Text style={estilos.texto}>Versión {Constants.expoConfig?.version ?? '—'}</Text>
        <Text style={estilos.subtitulo}>Servidor: {API_URL || 'sin configurar (EXPO_PUBLIC_API_URL)'}</Text>
      </Tarjeta>

      <Boton texto="Cerrar sesión" tipo="peligro" icono="log-out-outline" alPresionar={salir} />
    </Pantalla>
  );
}

function FormularioNegocio({ inicial, alGuardar }: { inicial: Configuracion; alGuardar: (c: Configuracion) => void }) {
  const { api } = useSesion();
  const [nombre, setNombre] = useState(inicial.nombre_negocio);
  const [transferencia, setTransferencia] = useState(inicial.datos_transferencia);
  const [guardando, setGuardando] = useState(false);

  const hayCambios = nombre !== inicial.nombre_negocio || transferencia !== inicial.datos_transferencia;

  const guardar = async () => {
    setGuardando(true);
    try {
      const nuevo = await api<Configuracion>('/configuracion', {
        metodo: 'PUT', cuerpo: { nombre_negocio: nombre, datos_transferencia: transferencia },
      });
      alGuardar(nuevo);
      avisar('Guardado', 'El bot usará estos datos desde el próximo pedido.');
    } catch (e) {
      if (!(e instanceof SesionExpiradaError)) avisar('No se pudo guardar', e instanceof Error ? e.message : undefined);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Tarjeta estilo={{ gap: 10 }}>
      <Text style={estilos.etiqueta}>Nombre del negocio</Text>
      <TextInput style={estilos.input} value={nombre} onChangeText={setNombre} maxLength={80} placeholder="Ej: Mermeladas Terry" />
      <Text style={estilos.subtitulo}>Aparece en el catálogo que envía el bot y en el menú de la app.</Text>

      <Text style={[estilos.etiqueta, { marginTop: 8 }]}>Datos para transferir</Text>
      <TextInput
        style={[estilos.input, { minHeight: 110, textAlignVertical: 'top' }]}
        value={transferencia}
        onChangeText={setTransferencia}
        multiline
        maxLength={1000}
        placeholder={'Banco\nTipo y número de cuenta\nRUT y nombre del titular\nCorreo'}
      />
      <Text style={estilos.subtitulo}>El bot los envía junto con el total de cada pedido.</Text>
      {!transferencia.trim() ? (
        <Text style={[estilos.subtitulo, { color: COLORES.ambar }]}>
          ⚠️ Sin estos datos, los clientes no sabrán a dónde transferir.
        </Text>
      ) : null}
      <Boton texto="Guardar cambios" icono="save-outline" alPresionar={guardar} cargando={guardando} desactivado={!hayCambios} />
    </Tarjeta>
  );
}
