// client/src/socket.js
import { io } from 'socket.io-client';

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
const ROOM = import.meta.env.VITE_ROOM_ID || 'main';

const socket = io(SERVER, {
  transports: ['websocket','polling'],
  query: { roomId: ROOM }
});

export { socket };
