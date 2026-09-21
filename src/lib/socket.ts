import { io, Socket } from 'socket.io-client';
import { getToken, SOCKET_URL } from '@/lib/api';

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket) return socket;
  socket = io(SOCKET_URL, {
    auth: { token: getToken() },
    transports: ['websocket'],
  });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
