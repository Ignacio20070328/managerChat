import { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Pedido {
  id_pedido: number;
  telefono: string;
  ruta_comprobante: string;
  fecha: string;
}

export default function Index() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [menuVisible, setMenuVisible] = useState(false); // Estado para abrir/cerrar el menú lateral
  const [seccionActiva, setSeccionActiva] = useState<'Inicio' |'comprobantes' | 'ventas' | 'grafico' | 'ajustes'>('Inicio'); 
  
  const IP_COMPUTADORA = '192.168.1.7'; // REEMPLAZA CON TU IP

  useEffect(() => {
    fetch(`http://${IP_COMPUTADORA}:3000/api/pedidos/pendientes`)
      .then(res => res.json())
      .then(data => setPedidos(data))
      .catch(err => console.error("Error conectando a la API: ", err));
  }, []);

  const aprobarPago = async (idPedido: number) => {
    try {
      const response = await fetch(`http://${IP_COMPUTADORA}:3000/api/pedidos/${idPedido}/aprobar`, {
        method: 'PUT',
      });
      if (response.ok) {
        setPedidos(pedidos.filter(pedido => pedido.id_pedido !== idPedido));
        alert('Pago aprobado. El pedido pasó a la sección de entregas.');
      }
    } catch (error) {
      console.error("Error al aprobar el pago: ", error);
      alert('Hubo un error al aprobar el pago');
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. BARRA SUPERIOR FIJA */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => setMenuVisible(true)}>
          <Ionicons name="menu" size={36} color="#333"/>
        </TouchableOpacity>
        <Text style={styles.appTitle}>Gestor de Chats</Text>
        <View style={{ width: 36 }} /> 
      </View>

      {/* 2. MENÚ LATERAL DESLIZANTE (DRAMATIZACIÓN DE TU BOCETO) */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.drawerContainer}>
            {/* Cabecera del Menú: Nombre de la persona */}
            <View style={styles.drawerHeader}>
              <Ionicons name="person-circle" size={60} color="#25D366"/>
              <Text style={styles.drawerOwnerName}>Luis Arriagada</Text>
              <Text style={styles.drawerStore}>Emprendimiento Temuco</Text>
            </View>

            {/* Opciones del Menú basadas en tu boceto */}
            <View style={styles.drawerOptions}>
              <TouchableOpacity 
                style={[styles.drawerItem, seccionActiva === 'Inicio' && styles.drawerItemActive]} 
                onPress={() => { setSeccionActiva('Inicio'); setMenuVisible(false); }}
              >
                <Ionicons name="home-outline" size={22} color={seccionActiva === 'Inicio' ? '#25D366' : '#555'} />
                <Text style={[styles.drawerText, seccionActiva === 'Inicio' && styles.drawerTextActive]}>Inicio</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.drawerItem, seccionActiva === 'comprobantes' && styles.drawerItemActive]} 
                onPress={() => { setSeccionActiva('comprobantes'); setMenuVisible(false); }}
              >
                <Ionicons name="document-text-outline" size={22} color={seccionActiva === 'comprobantes' ? '#25D366' : '#555'} />
                <Text style={[styles.drawerText, seccionActiva === 'comprobantes' && styles.drawerTextActive]}>Comprobantes</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.drawerItem, seccionActiva === 'ventas' && styles.drawerItemActive]} 
                onPress={() => { setSeccionActiva('ventas'); setMenuVisible(false); }}
              >
                <Ionicons name="bag-check-outline" size={22} color={seccionActiva === 'ventas' ? '#25D366' : '#555'} />
                <Text style={[styles.drawerText, seccionActiva === 'ventas' && styles.drawerTextActive]}>Ventas / Entregas</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.drawerItem, seccionActiva === 'grafico' && styles.drawerItemActive]} 
                onPress={() => { setSeccionActiva('grafico'); setMenuVisible(false); }}
              >
                <Ionicons name="bar-chart-outline" size={22} color={seccionActiva === 'grafico' ? '#25D366' : '#555'} />
                <Text style={[styles.drawerText, seccionActiva === 'grafico' && styles.drawerTextActive]}>Gráfico Estadísticas</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.drawerItem, seccionActiva === 'ajustes' && styles.drawerItemActive]} 
                onPress={() => { setSeccionActiva('ajustes'); setMenuVisible(false); }}
              >
                <Ionicons name="settings-outline" size={22} color={seccionActiva === 'ajustes' ? '#25D366' : '#555'} />
                <Text style={[styles.drawerText, seccionActiva === 'ajustes' && styles.drawerTextActive]}>Ajustes</Text>
              </TouchableOpacity>
            </View>

            {/* Botón Cerrar Menú */}
            <TouchableOpacity style={styles.btnCloseDrawer} onPress={() => setMenuVisible(false)}>
              <Text style={styles.btnCloseText}>Cerrar Menú</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 3. CONTENIDO DINÁMICO SEGÚN LA SECCIÓN SELECCIONADA */}
      {seccionActiva === 'Inicio' && (
        <View style={styles.centerSection}>
          <Text style={styles.sectionTitle}>Inicio</Text>
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>Informacion : Luis Arriagada es un genio absoluto es un gran empresario y esta aplicacion fue diseñada para optimizar la gestión de pedidos y pagos.</Text>
            <Text style={styles.cardText}>Estado: Conectado y escuchando mensajes en tiempo real.</Text>
          </View>
          <View>
            <Text style={styles.cardTitle}>Producto Disponibles</Text>
          <View style={styles.infoCard}>
            <Text style={styles.cardText}>Mermelada de Frambuesa</Text>
            <Image
            source={require('@/assets/images/Mermeladas.png')}
            style={styles.productImage}
            resizeMode="contain"
            accessibilityLabel="Mermelada de frambuesa"/>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.cardText}>Mermelada de Cereza</Text>
            <Image
            source={require('@/assets/images/MermeladaDeCereza.png')}
            style={styles.productImage}
            resizeMode="contain"
            accessibilityLabel="Mermelada de cereza"/>
          </View>
          
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.cardText}>Universidad Católica de Temuco</Text>
          </View>
        </View>
      )}
      {seccionActiva === 'comprobantes' && (
        <FlatList 
          data={pedidos}
          keyExtractor={(item) => item.id_pedido.toString()}
          ListHeaderComponent={
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Comprobantes Pendientes</Text>
              <Text style={styles.sectionSub}>Valida los pagos recibidos por WhatsApp</Text>
            </View>
          }
          ListEmptyComponent={<Text style={styles.emptyText}>No hay pagos pendientes por revisar.</Text>}
          renderItem={({ item }) => (
            <View style={styles.pedidoCard}>
              <Text style={styles.phone}>Cliente: +{item.telefono}</Text>
              <Image 
                source={{ uri: `http://${IP_COMPUTADORA}:3000${item.ruta_comprobante}` }} 
                style={styles.image} 
                resizeMode="contain"
              />
              <TouchableOpacity style={styles.btnAprobar} onPress={() => aprobarPago(item.id_pedido)}>
                <Text style={styles.btnText}>Aprobar Pago</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {seccionActiva === 'grafico' && (
        <View style={styles.centerSection}>
          <Text style={styles.sectionTitle}>Estadísticas de Ganancias</Text>
          <View style={styles.chartCard}>
            <View style={styles.chartMockup}>
              <View style={[styles.bar, { height: 40 }]} />
              <View style={[styles.bar, { height: 80 }]} />
              <View style={[styles.bar, { height: 60 }]} />
              <View style={[styles.bar, { height: 120, backgroundColor: '#25D366' }]} />
              <View style={[styles.bar, { height: 90 }]} />
            </View>
            <Text style={styles.chartLabel}>Comportamiento de ventas de la semana</Text>
          </View>
        </View>
      )}

      {seccionActiva === 'ajustes' && (
        <View style={styles.centerSection}>
          <Text style={styles.sectionTitle}>Ajustes de la Aplicación</Text>
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>Conexión Bot WhatsApp</Text>
            <Text style={styles.cardText}>Estado: Conectado y escuchando mensajes en tiempo real.</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>Versión del MVP</Text>
            <Text style={styles.cardText}>v1.0.0 - Universidad Católica de Temuco</Text>
          </View>
        </View>
      )}

      {seccionActiva === 'ventas' && (
        <View style={styles.centerSection}>
          <Text style={styles.sectionTitle}>Ventas por Retirar</Text>
          <Text style={styles.emptyText}>Aquí aparecerán los clientes que ya pagaron y vienen a buscar su producto.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f9' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff', elevation: 2 },
  appTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row' },
  drawerContainer: { width: '75%', backgroundColor: '#fff', height: '100%', padding: 20, justifyContent: 'space-between' },
  drawerHeader: { alignItems: 'center', marginTop: 40, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 20 },
  drawerOwnerName: { fontSize: 20, fontWeight: 'bold', color: '#222', marginTop: 10 },
  drawerStore: { fontSize: 14, color: '#666' },
  drawerOptions: { marginTop: 20, flex: 1 },
  drawerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 10, borderRadius: 8, marginBottom: 5 },
  drawerItemActive: { backgroundColor: '#e8f8f0' },
  drawerText: { fontSize: 16, marginLeft: 15, color: '#444', fontWeight: '500' },
  drawerTextActive: { color: '#25D366', fontWeight: 'bold' },
  btnCloseDrawer: { backgroundColor: '#eee', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 20 },
  btnCloseText: { fontWeight: 'bold', color: '#555' },

  sectionHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  sectionTitle: { fontSize: 22, fontWeight: 'bold', color: '#111' },
  sectionSub: { fontSize: 14, color: '#666', marginTop: 2 },
  
  centerSection: { flex: 1, padding: 20 },
  infoCard: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginTop: 15, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 5, color: '#333' },
  cardText: { fontSize: 14, color: '#666' },

  chartCard: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginTop: 20, elevation: 2 },
  chartMockup: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 140, marginTop: 15, paddingHorizontal: 10 },
  bar: { width: 40, backgroundColor: '#dcdde1', borderRadius: 6 },
  chartLabel: { textAlign: 'center', color: '#888', marginTop: 15, fontSize: 12 },

  pedidoCard: { backgroundColor: 'white', marginHorizontal: 20, padding: 15, borderRadius: 16, marginBottom: 20, elevation: 3 },
  phone: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: '#333' },
  image: { width: '100%', height: 300, borderRadius: 10, backgroundColor: '#f8f9fa' },
  btnAprobar: { backgroundColor: '#25D366', padding: 14, borderRadius: 10, marginTop: 15, alignItems: 'center' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  emptyText: { textAlign: 'center', fontSize: 16, color: 'gray', marginTop: 40 },
  productImage: {width: '100%',height: 180,marginTop: 8,}
});