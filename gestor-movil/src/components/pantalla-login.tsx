import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORES, FUENTES, s as ui, T } from '@/components/ui';
import { login } from '@/lib/api';

// Antes de iniciar sesión todavía no se conoce el color elegido por el negocio
const COLOR = '#a3133f';

export function PantallaLogin({ alIngresar, aviso }: { alIngresar: (token: string) => void; aviso?: string | null }) {
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ingresar = async () => {
    if (!password || cargando) return;
    setCargando(true);
    setError(null);
    try {
      const token = await login(password);
      setPassword('');
      alIngresar(token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión');
    } finally {
      setCargando(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.contenedor}>
      <View style={s.caja}>
        <View style={s.logo}>
          <Ionicons name="storefront" size={34} color="#ffffff" />
        </View>
        <T variante="titulo" estilo={{ fontSize: 26, textAlign: 'center' }}>Gestor de pedidos</T>
        <T variante="suave" estilo={{ textAlign: 'center', fontSize: 15, marginBottom: 12 }}>
          Pedidos y pagos de tu negocio por WhatsApp
        </T>

        {aviso ? (
          <View style={s.aviso}>
            <Ionicons name="time-outline" size={18} color={COLORES.ambar} />
            <T variante="semi" estilo={{ color: COLORES.ambar, flex: 1 }}>{aviso}</T>
          </View>
        ) : null}

        <T variante="semi">Contraseña</T>
        <View style={s.campo}>
          <TextInput
            style={[ui.input, { flex: 1, borderWidth: 0, backgroundColor: 'transparent' }]}
            value={password}
            onChangeText={setPassword}
            placeholder="Tu contraseña"
            placeholderTextColor={COLORES.textoSuave}
            secureTextEntry={!visible}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={ingresar}
            returnKeyType="go"
            editable={!cargando}
            accessibilityLabel="Contraseña"
          />
          <TouchableOpacity onPress={() => setVisible((v) => !v)} style={s.ojo} accessibilityRole="button"
            accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
            <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={COLORES.textoSuave} />
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
            <Ionicons name="alert-circle" size={18} color={COLORES.rojo} />
            <T estilo={{ color: COLORES.rojo, flex: 1, fontSize: 14 }}>{error}</T>
          </View>
        ) : null}

        <TouchableOpacity style={[s.boton, (!password || cargando) && { opacity: 0.5 }]} onPress={ingresar}
          disabled={!password || cargando} accessibilityRole="button" accessibilityLabel="Ingresar">
          {cargando ? <ActivityIndicator color="#ffffff" /> : (
            <T estilo={{ color: '#ffffff', fontFamily: FUENTES.negrita, fontSize: 16 }}>Ingresar</T>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  contenedor: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: COLORES.fondo },
  caja: { width: '100%', maxWidth: 380, alignSelf: 'center', gap: 10 },
  logo: { alignSelf: 'center', width: 72, height: 72, borderRadius: 22, backgroundColor: COLOR, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  aviso: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: COLORES.ambarFondo, padding: 12, borderRadius: 12 },
  campo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#d9cfd3' },
  ojo: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  boton: { backgroundColor: COLOR, minHeight: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});
