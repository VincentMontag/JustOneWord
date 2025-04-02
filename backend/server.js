import express from 'express';
import { Server } from 'socket.io';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

io.on('connection', (socket) => {
    console.log(`🔗 Client verbunden: ${socket.id}`);

    socket.on('send-word', (word) => {
        io.emit('new-word', word); // Broadcast an alle Clients
    });

    socket.on('disconnect', () => {
        console.log(`❌ Client getrennt: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));