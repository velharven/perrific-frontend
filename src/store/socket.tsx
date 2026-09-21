import { createContext, useEffect, type ReactNode } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';
import { getToken } from '@/lib/api';

const SocketContext = createContext<null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const token = getToken();

  useEffect(() => {
    if (!token) return;
    connectSocket();
    const socket = getSocket();

    socket?.on('notification', (payload: unknown) => {
      console.log('[socket] notification', payload);
    });

    socket?.on('task:updated', (payload: unknown) => {
      console.log('[socket] task updated', payload);
    });

    return () => {
      disconnectSocket();
    };
  }, [token]);

  return <SocketContext.Provider value={null}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return { socket: getSocket() };
}
