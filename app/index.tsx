import { View, Text, StyleSheet } from 'react-native'

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🐾 Huellitas</Text>
      <Text style={styles.sub}>Bienvenido</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: '700', color: '#1D9E75' },
  sub: { fontSize: 16, color: '#5F5E5A', marginTop: 8 },
})