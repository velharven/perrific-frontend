import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';
import { getToken } from '@/lib/api';
import { useAuth } from './auth';

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const token = user ? getToken() : null;
  const [activeSocket, setActiveSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token) return;
    const connected = connectSocket();
    setActiveSocket(connected);
    const socket = getSocket();

    socket?.on('notification', (payload: unknown) => {
      console.log('[socket] notification', payload);
    });

    socket?.on('task:updated', (payload: unknown) => {
      console.log('[socket] task updated', payload);
    });

    socket?.on('task:assigned', (payload: unknown) => {
      console.log('[socket] task assigned/unassigned', payload);
    });

    return () => {
      disconnectSocket();
      setActiveSocket(null);
    };
  }, [token]);

  return <SocketContext.Provider value={activeSocket}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return { socket: useContext(SocketContext) };
}
