import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppLayout from './src/app/_layout';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppLayout />
    </GestureHandlerRootView>
  );
}
