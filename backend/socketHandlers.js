import { assignRoles } from "./gameLogic.js";  // Die Spiel-Logik hier importieren

export const socketHandlers = (io) => {
    let queue = [];

    io.on("connection", (socket) => {
        console.log("Ein Spieler hat sich verbunden.");

        socket.on("join-random", (data) => {
            const { name, id } = data;

            // Validierung
            if (!name || typeof name !== "string" || name.trim().length < 1 || name.trim().length > 20) {
                console.log(`Ungültige Daten erhalten: ${JSON.stringify(data)}`);
                socket.emit("invalid-data", "Ungültiger Spielername");
                return;
            }

            // Spieler in Warteschlange einfügen
            queue.push({ id: socket.id, name });
            console.log(`${name} der Lobby beigetreten (${queue.length}/3)`);

            io.emit("queue-update", queue.length);

            if (queue.length === 3) {
                assignRoles(queue, io);
            }
        });

        socket.on("disconnect", () => {
            const player = queue.find((p) => p.id === socket.id);
            if (player) {
                console.log(`${player.name} hat die Verbindung getrennt.`);
                queue = queue.filter((p) => p.id !== socket.id);
                io.emit("queue-update", queue.length);
            }
        });
    });
};
