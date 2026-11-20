// frontend/src/services/socket.ts

import { io, Socket } from 'socket.io-client';

const isLocalHost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const SOCKET_URL =
  (import.meta as any).env?.VITE_WS_URL ||
  (isLocalHost ? 'http://localhost:3000' : typeof window !== 'undefined' ? window.location.origin : '');

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('🛰️ Conectado a WebSocket SAME Backend (ID:', socket?.id, ')');
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Desconectado de WebSocket:', reason);
    });
  }
  return socket;
}

export function joinRoom(room: 'scooters' | 'dashboard' | 'client_trips', scooterId?: string) {
  const s = getSocket();
  s.emit('join:room', { room, scooterId });
}

