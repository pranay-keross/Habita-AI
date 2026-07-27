import {useState, useEffect} from 'react';
import {authService} from '../features/auth/auth';

export default function useAuth() {
  const [signedIn, setSignedIn] = useState(false);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    async function init() {
      // TODO: restore auth state from storage
      setSignedIn(false);
      setPending(false);
    }

    init();
  }, []);

  return {
    signedIn,
    pending,
    login: async () => {
      const result = await authService.login();
      if (result.success) {
        setSignedIn(true);
      }
      return result;
    },
    logout: () => {
      setSignedIn(false);
    },
  };
}
