import AsyncStorage from '@react-native-async-storage/async-storage';

export async function getItem<T>(key: string, fallback: T): Promise<T> {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function setItem<T>(key: string, value: T) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export async function removeItem(key: string) {
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
}

export async function clearAll() {
  try {
    await AsyncStorage.clear();
  } catch {}
}


