import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import cors from "cors";
import { socketHandlers } from "./socketHandlers.js"; // Socket.IO-Handler importieren

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173', // Die URL des Frontends
        methods: ['GET', 'POST'],
    },
});

app.use(express.json());
app.use(cors());

// Socket.IO-Logik in eigene Datei auslagern
socketHandlers(io);

const PORT = 5000;
server.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
