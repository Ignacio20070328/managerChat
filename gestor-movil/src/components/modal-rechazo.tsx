import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { Boton, COLORES, s as ui, T } from '@/components/ui';

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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={cerrar}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.fondo}>
        <View style={s.hoja}>
          <View style={s.asa} />
          <T variante="titulo">Rechazar pago #{idPedido}</T>
          <T variante="suave">El motivo se le enviará al cliente por WhatsApp.</T>

          <View style={s.chips}>
            {MOTIVOS_FRECUENTES.map((m) => {
              const activo = motivo === m;
              return (
                <TouchableOpacity key={m} style={[s.chip, activo && s.chipActivo]} onPress={() => setMotivo(m)}
                  accessibilityRole="radio" accessibilityState={{ checked: activo }}>
                  <T variante="semi" estilo={{ fontSize: 13, color: activo ? COLORES.rojo : COLORES.textoMedio }}>{m}</T>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            style={[ui.input, { minHeight: 76, textAlignVertical: 'top' }]}
            value={motivo}
            onChangeText={setMotivo}
            placeholder="O escribe otro motivo…"
            placeholderTextColor={COLORES.textoSuave}
            multiline
            maxLength={255}
            accessibilityLabel="Motivo del rechazo"
          />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Boton texto="Cancelar" tipo="secundario" alPresionar={cerrar} estilo={{ flex: 1 }} desactivado={enviando} grande />
            <Boton texto="Rechazar" tipo="peligro" icono="close" alPresionar={confirmar}
              estilo={{ flex: 1 }} desactivado={!valido} cargando={enviando} grande />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  hoja: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, gap: 14, maxWidth: 640, width: '100%', alignSelf: 'center' },
  asa: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: COLORES.bordeFuerte, marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: COLORES.bordeFuerte, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, minHeight: 36, justifyContent: 'center' },
  chipActivo: { borderColor: COLORES.rojo, backgroundColor: COLORES.rojoFondo },
});
