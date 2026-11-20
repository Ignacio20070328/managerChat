import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Boton, COLORES, estilos } from '@/components/ui';

const MOTIVOS_FRECUENTES = [
  'El monto no coincide con el pedido',
  'La transferencia fue a otra cuenta',
  'No se ve bien el comprobante',
  'Este comprobante ya fue usado',
];

/** Pide el motivo del rechazo, que se le envía al cliente por WhatsApp. */
export function ModalRechazo({ visible, idPedido, alCancelar, alConfirmar }: {
  visible: boolean;
  idPedido: number | null;
  alCancelar: () => void;
  alConfirmar: (motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const valido = motivo.trim().length >= 3;

  const cerrar = () => {
    setMotivo('');
    alCancelar();
  };

  const confirmar = async () => {
    setEnviando(true);
    try {
      await alConfirmar(motivo.trim());
      setMotivo('');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cerrar}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.fondo}>
        <View style={s.caja}>
          <Text style={estilos.titulo}>Rechazar pago #{idPedido}</Text>
          <Text style={estilos.subtitulo}>El motivo se le enviará al cliente por WhatsApp.</Text>

          <View style={s.chips}>
            {MOTIVOS_FRECUENTES.map((m) => (
              <TouchableOpacity key={m} style={[s.chip, motivo === m && s.chipActivo]} onPress={() => setMotivo(m)}>
                <Text style={[s.chipTexto, motivo === m && { color: COLORES.rojo }]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={[estilos.input, { minHeight: 70, textAlignVertical: 'top' }]}
            value={motivo}
            onChangeText={setMotivo}
            placeholder="O escribe otro motivo…"
            multiline
            maxLength={255}
          />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Boton texto="Cancelar" tipo="secundario" alPresionar={cerrar} estilo={{ flex: 1 }} desactivado={enviando} />
            <Boton texto="Rechazar" tipo="peligro" icono="close-circle" alPresionar={confirmar}
              estilo={{ flex: 1 }} desactivado={!valido} cargando={enviando} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  caja: { backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 14, maxWidth: 520, width: '100%', alignSelf: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: COLORES.borde, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipActivo: { borderColor: COLORES.rojo, backgroundColor: COLORES.rojoFondo },
  chipTexto: { fontSize: 13, color: COLORES.texto },
});
