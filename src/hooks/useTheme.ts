import {useEffect, useState} from 'react';
import {loadSavedTheme, saveTheme, theme as defaultTheme} from '../theme';

export default function useTheme() {
  const [palette, setPalette] = useState(defaultTheme);

  useEffect(() => {
    async function loadTheme() {
      await loadSavedTheme();
      setPalette(defaultTheme);
    }

    loadTheme();
  }, []);

  return {
    theme: palette,
    setTheme: async (key: string) => {
      await saveTheme(key);
      setPalette(defaultTheme);
    },
  };
}
