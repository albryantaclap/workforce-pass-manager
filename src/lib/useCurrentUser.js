import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

let cachedUser = null;

export function useCurrentUser() {
  const [user, setUser] = useState(cachedUser);

  useEffect(() => {
    if (!cachedUser) {
      base44.auth.me().then(u => {
        cachedUser = u;
        setUser(u);
      }).catch(() => {});
    }
  }, []);

  return user;
}