import { io } from 'socket.io-client';

// Socket-Instanz erstellen
const socket = io(process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:5000', {
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    timeout: 20000,
});

socket.on('connect', () => {
    console.log('🔗 Socket verbunden mit ID:', socket.id);
});

socket.on('disconnect', (reason) => {
    console.log('❌ Socket getrennt:', reason);
});

socket.on('reconnect', (attemptNumber) => {
    console.log('🔄 Socket wiederverbunden nach', attemptNumber, 'Versuchen');
});

socket.on('reconnect_error', (error) => {
    console.error('🚫 Reconnect Fehler:', error);
});

export default socket;