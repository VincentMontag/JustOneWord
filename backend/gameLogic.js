// gameLogic.js - Angepasst für Socket.IO Integration

import { setDoc, doc } from "firebase/firestore";
import { db } from './firebase.js';
import { v4 as uuidv4 } from "uuid";
import { games } from './GameManager.js';

export async function assignRoles(queue, io) {
    const playersCopy = [...queue];
    const randomIndex = Math.floor(Math.random() * playersCopy.length);
    const guesser = playersCopy[randomIndex];
    playersCopy.splice(randomIndex, 1);
    const numSupporters = Math.ceil(playersCopy.length / 2);

    const supporters = [];
    for (let i = 0; i < numSupporters; i++) {
        const randomSupporterIndex = Math.floor(Math.random() * playersCopy.length);
        supporters.push(playersCopy[randomSupporterIndex]);
        playersCopy.splice(randomSupporterIndex, 1);
    }

    const saboteurs = playersCopy;
    const gameId = uuidv4();
    const rolesMap = {};

    // Rollen zuweisen mit korrekten englischen Namen (für Backend-Kompatibilität)
    for (const player of queue) {
        let role = "";

        if (player === guesser) {
            role = "GUESSER";
        } else if (supporters.includes(player)) {
            role = "SUPPORTER";
        } else if (saboteurs.includes(player)) {
            role = "SABOTEUR";
        }

        rolesMap[player.name] = {
            role,
            socketId: player.id,
        };
    }

    const gameDoc = {
        rolesMap,
        expectedSubmitters: supporters.length + saboteurs.length,
        players: queue.map(p => p.name),
        createdAt: new Date(),
        status: "waiting_for_players"
    };

    try {
        // In Firebase speichern
        await setDoc(doc(db, "games", gameId), gameDoc);
        console.log(`✅ Spiel ${gameId} in Firebase gespeichert`);

        // Im Server-Cache initialisieren (aber noch nicht starten)
        games[gameId] = {
            solutionWord: null,
            round: 0,
            revealedLetters: new Set(),
            phase: null,
            isFinished: false,
            submissions: [],
            submittedPlayers: new Set(),
            expectedSubmitters: supporters.length + saboteurs.length,
            scores: {},
            guessSubmitted: false
        };

        // Scores initialisieren
        queue.forEach(player => {
            games[gameId].scores[player.name] = 0;
        });

        console.log(`🎮 Spiel ${gameId} im Server-Cache initialisiert`);

        // Sofort Events an alle Spieler senden (kein Delay nötig!)
        for (const player of queue) {
            const role = rolesMap[player.name].role;
            const playerSocket = io.sockets.sockets.get(player.id);

            if (playerSocket) {
                console.log(`📤 Sende Rolle "${role}" an Spieler ${player.name}`);
                playerSocket.emit("role-assigned", {
                    role,
                    gameId,
                    playerName: player.name
                });
            } else {
                console.warn(`⚠️ Socket für Spieler ${player.name} nicht gefunden`);
            }
        }

        // Status-Update in Firebase - Spiel wartet auf Spieler-Verbindungen
        await setDoc(doc(db, "games", gameId), {
            ...gameDoc,
            status: "roles_assigned"
        });

        console.log(`🎯 Rollen für Spiel ${gameId} zugewiesen. Warte auf Spieler-Verbindungen...`);

        return gameId;

    } catch (error) {
        console.error("❌ Fehler beim Erstellen des Spiels:", error);

        // Cleanup bei Fehler
        if (games[gameId]) {
            delete games[gameId];
        }

        // Fehler an alle Spieler senden
        for (const player of queue) {
            const playerSocket = io.sockets.sockets.get(player.id);
            if (playerSocket) {
                playerSocket.emit("game-error", "Fehler beim Erstellen des Spiels");
            }
        }

        throw error;
    }
}