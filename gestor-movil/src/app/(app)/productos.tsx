import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Switch, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Boton, COLORES, Encabezado, EstadoCarga, Pantalla, s as ui, T, Tarjeta } from '@/components/ui';
import { useDatos } from '@/hooks/use-datos';
import { SesionExpiradaError } from '@/lib/api';
import { useNegocio } from '@/lib/contexto-negocio';
import { useSesion } from '@/lib/contexto-sesion';
import { avisar, pesos } from '@/lib/formato';
import type { Producto } from '@/lib/tipos';

/** Catálogo que el bot envía cuando el cliente escribe "menu". */
export default function Productos() {
  const { api } = useSesion();
  const { acento, acentoSuave } = useNegocio();
  const { bottom } = useSafeAreaInsets();
  const { datos, setDatos, error, cargando, refrescando, recargar, actualizar } = useDatos<Producto[]>('/productos');
  // null: cerrado · 'nuevo' · o el producto que se edita
  const [editando, setEditando] = useState<Producto | 'nuevo' | null>(null);
  const [cambiando, setCambiando] = useState<number | null>(null);

  // La API ya entrega el orden del menú del bot: activos primero, luego por nombre
  const enVenta = datos?.filter((p) => p.activo) ?? [];
  const ocultos = datos?.filter((p) => !p.activo) ?? [];

  const alternar = async (producto: Producto) => {
    setCambiando(producto.id_producto);
    try {
      const nuevo = await api<Producto>(`/productos/${producto.id_producto}`, { metodo: 'PUT', cuerpo: { activo: !producto.activo } });
      setDatos((prev) => prev?.map((p) => (p.id_producto === nuevo.id_producto ? nuevo : p)) ?? null);
      actualizar(); // reordena como lo verá el cliente
    } catch (e) {
      if (!(e instanceof SesionExpiradaError)) avisar('No se pudo cambiar', e instanceof Error ? e.message : undefined);
    } finally {
      setCambiando(null);
    }
  };

  const guardado = () => {
    setEditando(null);
    actualizar();
  };

  return (
    <View style={{ flex: 1 }}>
      <Encabezado titulo="Productos"
        subtitulo={datos ? `${enVenta.length} a la venta · ${ocultos.length} ${ocultos.length === 1 ? 'oculto' : 'ocultos'}` : undefined} />
      <Pantalla refrescando={refrescando} alRefrescar={recargar} espacioInferior={bottom + 100}>
        <EstadoCarga cargando={cargando} error={error} alReintentar={recargar}
          vacio={datos?.length === 0} iconoVacio="pricetags-outline"
          textoVacio="Aún no tienes productos. Agrega lo que vendes para que tus clientes puedan pedir por WhatsApp.">
          {enVenta.length > 0 ? (
            <View style={s.vistaWhatsApp}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="logo-whatsapp" size={16} color="#1a6b33" />
                <T variante="fuerte" estilo={{ fontSize: 12, color: '#1a6b33' }}>Así lo ve el cliente al escribir «menu»</T>
              </View>
              <View style={s.burbuja}>
                {enVenta.map((p, i) => (
                  <T key={p.id_producto} estilo={{ fontSize: 13 }}>{i + 1}. {p.nombre} — {pesos(p.precio)}</T>
                ))}
                <T variante="suave" estilo={{ fontSize: 12, marginTop: 4 }}>Para pedir responde, por ejemplo: 1x2, 2x1</T>
              </View>
            </View>
          ) : null}

          {[...enVenta, ...ocultos].map((p) => (
            <TouchableOpacity key={p.id_producto} onPress={() => setEditando(p)} accessibilityRole="button" accessibilityLabel={`Editar ${p.nombre}`}>
              <Tarjeta estilo={[s.fila, !p.activo && { opacity: 0.65 }]}>
                <View style={[s.numero, { backgroundColor: p.activo ? acentoSuave : '#f0ebed' }]}>
                  <T variante="titulo" estilo={{ fontSize: 16, color: p.activo ? acento : COLORES.textoSuave }}>
                    {p.activo ? enVenta.indexOf(p) + 1 : '—'}
                  </T>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T variante="fuerte" lineas={2}>{p.nombre}</T>
                  {p.descripcion ? <T variante="suave" estilo={{ fontSize: 12 }} lineas={1}>{p.descripcion}</T> : null}
                  <T variante="cifra" estilo={{ fontSize: 16 }}>{pesos(p.precio)}</T>
                </View>
                <View style={{ alignItems: 'center', gap: 2 }}>
                  <Switch value={p.activo} onValueChange={() => alternar(p)} disabled={cambiando === p.id_producto}
                    trackColor={{ true: COLORES.verde, false: '#c9bfc3' }} thumbColor="#ffffff"
                    accessibilityLabel={`${p.nombre} a la venta`} />
                  <T variante="semi" estilo={{ fontSize: 11, color: COLORES.textoSuave }}>{p.activo ? 'A la venta' : 'Oculto'}</T>
                </View>
              </Tarjeta>
            </TouchableOpacity>
          ))}
        </EstadoCarga>
      </Pantalla>

      <TouchableOpacity style={[s.flotante, { backgroundColor: acento, bottom: bottom + 20, shadowColor: acento }]}
        onPress={() => setEditando('nuevo')} accessibilityRole="button" accessibilityLabel="Agregar producto">
        <Ionicons name="add" size={22} color="#ffffff" />
        <T variante="fuerte" estilo={{ color: '#ffffff', fontSize: 16 }}>Agregar producto</T>
      </TouchableOpacity>

      {editando ? (
        <FormularioProducto producto={editando === 'nuevo' ? undefined : editando}
          alGuardar={guardado} alCerrar={() => setEditando(null)} />
      ) : null}
    </View>
  );
}

function FormularioProducto({ producto, alGuardar, alCerrar }: {
  producto?: Producto; alGuardar: () => void; alCerrar: () => void;
}) {
  const { api } = useSesion();
  const [nombre, setNombre] = useState(producto?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? '');
  const [precio, setPrecio] = useState(producto ? String(producto.precio) : '');
  const [activo, setActivo] = useState(producto?.activo ?? true);
  const [guardando, setGuardando] = useState(false);

  const precioNumero = Number(precio.replace(/\D/g, ''));
  const valido = nombre.trim().length >= 2 && precioNumero > 0;

  const guardar = async () => {
    setGuardando(true);
    try {
      const cuerpo = { nombre: nombre.trim(), descripcion: descripcion.trim() || null, precio: precioNumero, activo };
      if (producto) await api(`/productos/${producto.id_producto}`, { metodo: 'PUT', cuerpo });
      else await api('/productos', { metodo: 'POST', cuerpo });
      alGuardar();
    } catch (e) {
      if (!(e instanceof SesionExpiradaError)) avisar('No se pudo guardar', e instanceof Error ? e.message : undefined);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={alCerrar}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.fondoHoja}>
        <View style={s.hoja}>
          <View style={s.asa} />
          <T variante="titulo">{producto ? 'Editar producto' : 'Nuevo producto'}</T>

          <View style={{ gap: 6 }}>
            <T variante="semi">Nombre</T>
            <TextInput style={ui.input} value={nombre} onChangeText={setNombre} maxLength={80}
              placeholder="Ej: Torta de chocolate, Polera talla M…" placeholderTextColor={COLORES.textoSuave} accessibilityLabel="Nombre del producto" />
          </View>
          <View style={{ gap: 6 }}>
            <T variante="semi">Descripción <T variante="suave">(opcional)</T></T>
            <TextInput style={ui.input} value={descripcion} onChangeText={setDescripcion} maxLength={255}
              placeholder="Ej: tamaño, sabor, color o talla" placeholderTextColor={COLORES.textoSuave} accessibilityLabel="Descripción" />
          </View>
          <View style={{ gap: 6 }}>
            <T variante="semi">Precio</T>
            <TextInput style={ui.input} value={precio} onChangeText={(t) => setPrecio(t.replace(/\D/g, ''))}
              placeholder="En pesos, sin puntos (ej: 4500)" placeholderTextColor={COLORES.textoSuave}
              keyboardType="number-pad" maxLength={8} accessibilityLabel="Precio en pesos" />
            {precioNumero > 0 ? <T variante="suave">El cliente verá: {pesos(precioNumero)}</T> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
            <T estilo={{ flex: 1 }}>A la venta (visible para los clientes)</T>
            <Switch value={activo} onValueChange={setActivo} trackColor={{ true: COLORES.verde, false: '#c9bfc3' }} thumbColor="#ffffff" />
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Boton texto="Cancelar" tipo="secundario" alPresionar={alCerrar} estilo={{ flex: 1 }} desactivado={guardando} grande />
            <Boton texto="Guardar" icono="checkmark" alPresionar={guardar} estilo={{ flex: 1 }} desactivado={!valido} cargando={guardando} grande />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  vistaWhatsApp: { backgroundColor: '#e7f6ec', borderRadius: 16, padding: 12, gap: 8 },
  burbuja: { backgroundColor: '#ffffff', borderRadius: 12, borderTopLeftRadius: 4, paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  numero: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  flotante: { position: 'absolute', right: 18, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, minHeight: 56, borderRadius: 18, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  fondoHoja: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  hoja: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, gap: 14, maxWidth: 640, width: '100%', alignSelf: 'center' },
  asa: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: COLORES.bordeFuerte, marginBottom: 4 },
});
