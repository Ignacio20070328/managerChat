import { useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Boton, COLORES, EstadoCarga, Insignia, Pantalla, Tarjeta, Titulo, estilos } from '@/components/ui';
import { useDatos } from '@/hooks/use-datos';
import { SesionExpiradaError } from '@/lib/api';
import { useSesion } from '@/lib/contexto-sesion';
import { avisar, pesos } from '@/lib/formato';
import type { Producto } from '@/lib/tipos';

/** Catálogo que el bot muestra cuando el cliente escribe "menu". */
export default function Productos() {
  const { datos, setDatos, error, cargando, refrescando, recargar } = useDatos<Producto[]>('/productos');
  const [editando, setEditando] = useState<number | 'nuevo' | null>(null);

  const guardado = (producto: Producto) => {
    setDatos((prev) => {
      const lista = prev ?? [];
      const existe = lista.some((p) => p.id_producto === producto.id_producto);
      return existe ? lista.map((p) => (p.id_producto === producto.id_producto ? producto : p)) : [...lista, producto];
    });
    setEditando(null);
  };

  const activos = datos?.filter((p) => p.activo) ?? [];

  return (
    <Pantalla refrescando={refrescando} alRefrescar={recargar}>
      <Titulo sub="El bot muestra los productos activos, en este orden, cuando el cliente escribe «menu»">Productos</Titulo>

      {editando === 'nuevo' ? (
        <FormularioProducto alGuardar={guardado} alCancelar={() => setEditando(null)} />
      ) : (
        <Boton texto="Agregar producto" icono="add" alPresionar={() => setEditando('nuevo')} />
      )}

      <EstadoCarga cargando={cargando} error={error} alReintentar={recargar}
        vacio={datos?.length === 0} textoVacio="Aún no hay productos. Agrega el primero para que los clientes puedan pedir.">
        {datos?.map((producto) =>
          editando === producto.id_producto ? (
            <FormularioProducto key={producto.id_producto} producto={producto} alGuardar={guardado} alCancelar={() => setEditando(null)} />
          ) : (
            <Tarjeta key={producto.id_producto} estilo={[s.fila, !producto.activo && { opacity: 0.6 }]}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[estilos.texto, { fontWeight: 'bold' }]}>
                  {producto.activo ? `${activos.indexOf(producto) + 1}. ` : ''}{producto.nombre}
                </Text>
                {producto.descripcion ? <Text style={estilos.subtitulo}>{producto.descripcion}</Text> : null}
                {!producto.activo ? <Insignia texto="Oculto para los clientes" color={COLORES.textoSuave} fondo="#eef0f3" /> : null}
              </View>
              <Text style={s.precio}>{pesos(producto.precio)}</Text>
              <Boton texto="Editar" tipo="secundario" icono="create-outline" alPresionar={() => setEditando(producto.id_producto)} />
            </Tarjeta>
          )
        )}
      </EstadoCarga>
    </Pantalla>
  );
}

function FormularioProducto({ producto, alGuardar, alCancelar }: {
  producto?: Producto; alGuardar: (p: Producto) => void; alCancelar: () => void;
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
      const resultado = producto
        ? await api<Producto>(`/productos/${producto.id_producto}`, { metodo: 'PUT', cuerpo })
        : await api<Producto>('/productos', { metodo: 'POST', cuerpo });
      alGuardar(resultado);
    } catch (e) {
      if (!(e instanceof SesionExpiradaError)) avisar('No se pudo guardar', e instanceof Error ? e.message : undefined);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Tarjeta estilo={{ gap: 10, borderColor: COLORES.verde }}>
      <Text style={estilos.etiqueta}>{producto ? 'Editar producto' : 'Nuevo producto'}</Text>
      <TextInput style={estilos.input} value={nombre} onChangeText={setNombre} placeholder="Nombre (ej: Mermelada de frambuesa)" maxLength={80} />
      <TextInput style={estilos.input} value={descripcion} onChangeText={setDescripcion} placeholder="Descripción (opcional, ej: frasco 250 g)" maxLength={255} />
      <TextInput style={estilos.input} value={precio} onChangeText={(t) => setPrecio(t.replace(/\D/g, ''))}
        placeholder="Precio en pesos (ej: 4500)" keyboardType="number-pad" maxLength={8} />
      {precioNumero > 0 ? <Text style={estilos.subtitulo}>Se mostrará como {pesos(precioNumero)}</Text> : null}
      <View style={s.fila}>
        <Text style={[estilos.texto, { flex: 1 }]}>Visible para los clientes</Text>
        <Switch value={activo} onValueChange={setActivo} trackColor={{ true: COLORES.verde }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Boton texto="Cancelar" tipo="secundario" alPresionar={alCancelar} estilo={{ flex: 1 }} desactivado={guardando} />
        <Boton texto="Guardar" icono="checkmark" alPresionar={guardar} estilo={{ flex: 1 }} desactivado={!valido} cargando={guardando} />
      </View>
    </Tarjeta>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  precio: { fontSize: 16, fontWeight: 'bold', color: COLORES.verdeOscuro },
});
