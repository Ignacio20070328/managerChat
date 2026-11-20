import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { login } from '@/lib/api';

export function PantallaLogin({ alIngresar, aviso }: { alIngresar: (token: string) => void; aviso?: string | null }) {
  const [password, setPassword] = useState('');
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
    <View style={styles.contenedor}>
      <Ionicons name="lock-closed" size={48} color="#25D366" />
      <Text style={styles.titulo}>Gestor de Chats</Text>
      <Text style={styles.subtitulo}>Ingresa la contraseña para continuar</Text>
      {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Contraseña"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={ingresar}
        returnKeyType="go"
        editable={!cargando}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={[styles.boton, (!password || cargando) && styles.botonInactivo]} onPress={ingresar} disabled={!password || cargando}>
        {cargando ? <ActivityIndicator color="#fff" /> : <Text style={styles.botonTexto}>Ingresar</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#f4f6f9' },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#111', marginTop: 12 },
  subtitulo: { fontSize: 14, color: '#666', marginTop: 4, marginBottom: 24 },
  aviso: { color: '#9a6700', backgroundColor: '#fff8e5', padding: 10, borderRadius: 8, marginBottom: 12, textAlign: 'center' },
  input: { width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 10, padding: 14, fontSize: 16, borderWidth: 1, borderColor: '#ddd' },
  error: { color: '#b42318', marginTop: 10, textAlign: 'center' },
  boton: { width: '100%', maxWidth: 360, backgroundColor: '#25D366', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  botonInactivo: { opacity: 0.5 },
  botonTexto: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
