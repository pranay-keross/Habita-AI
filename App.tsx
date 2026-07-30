import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppLayout from './src/app/_layout';

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <AppLayout />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
