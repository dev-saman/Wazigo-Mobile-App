import { StyleSheet, Text, View } from 'react-native';

import { Config } from '@/constants/config';

// Temporary Stage 1 placeholder so the project boots. Replaced by the Splash
// route in Stage 4.
export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Wazigo</Text>
      <Text style={styles.caption}>Stage 1 setup — API: {Config.apiBaseUrl}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#00603A',
  },
  caption: {
    marginTop: 8,
    fontSize: 13,
    color: '#475467',
    textAlign: 'center',
  },
});
