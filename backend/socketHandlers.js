// socketHandlers.js - Komplette Socket.IO Handler mit Firebase Sync

import { assignRoles } from "./gameLogic.js";
import { games, startGame, submitGuess, submitWord } from "./GameManager.js";
import { db } from "./firebase.js"; // Deine Firebase-Konfiguration
import { doc, updateDoc, getDoc } from "firebase/firestore";

export const socketHandlers = (io) => {
    let queue = [];
    const playerSockets = new Map(); // gameId -> { playerName: socketId }
    const readyPlayers = new Map(); // gameId -> Set of ready playerNames

    io.on("connection", (socket) => {
        console.log("Ein Spieler hat sich verbunden:", socket.id);

        // Queue-Management
        socket.on("join-random", async (data) => {
            const { name, id } = data;

            if (!name || typeof name !== "string" || name.trim().length < 1 || name.trim().length > 20) {
                console.log(`Ungültige Daten erhalten: ${JSON.stringify(data)}`);
                socket.emit("invalid-data", "Ungültiger Spielername");
                return;
            }

            queue.push({ id: socket.id, name });
            console.log(`${name} der Lobby beigetreten (${queue.length}/3)`);

            io.emit("queue-update", queue.length);

            if (queue.length === 3) {
                try {
                    const gameId = await assignRoles(queue, io);
                    console.log(`🎮 Spiel ${gameId} erstellt, Rollen zugewiesen`);
                    queue.length = 0;
                } catch (error) {
                    console.error("Fehler bei Rollenzuteilung:", error);
                }
            }
        });

        // Socket-Room beitreten (ohne Spiel zu starten)
        socket.on("join-room", async (data) => {
            const { gameId, playerName } = data;

            try {
                const gameDoc = await getDoc(doc(db, "games", gameId));
                if (!gameDoc.exists()) {
                    socket.emit("game-error", "Spiel nicht gefunden");
                    return;
                }

                const gameData = gameDoc.data();
                if (!gameData.rolesMap[playerName]) {
                    socket.emit("game-error", "Spieler nicht in diesem Spiel");
                    return;
                }

                socket.join(gameId);

                if (!playerSockets.has(gameId)) {
                    playerSockets.set(gameId, new Map());
                }
                playerSockets.get(gameId).set(playerName, socket.id);

                console.log(`${playerName} ist Socket-Room ${gameId} beigetreten`);

                if (!readyPlayers.has(gameId)) {
                    readyPlayers.set(gameId, new Set());
                }

                sendReadyStatusUpdate(gameId, gameData, io);

            } catch (error) {
                console.error("Fehler beim Room beitreten:", error);
                socket.emit("game-error", "Fehler beim Room beitreten");
            }
        });

        // Player Ready Event
        socket.on("player-ready", async (data) => {
            const { gameId, playerName } = data;

            console.log(`🎯 Player Ready Event erhalten:`, { gameId, playerName });

            try {
                const gameDoc = await getDoc(doc(db, "games", gameId));
                if (!gameDoc.exists()) {
                    console.error(`❌ Spiel ${gameId} nicht in Firebase gefunden`);
                    socket.emit("game-error", "Spiel nicht gefunden");
                    return;
                }

                const gameData = gameDoc.data();
                if (!gameData.rolesMap[playerName]) {
                    console.error(`❌ Spieler ${playerName} nicht in Spiel ${gameId} gefunden`);
                    socket.emit("game-error", "Spieler nicht in diesem Spiel");
                    return;
                }

                if (!readyPlayers.has(gameId)) {
                    readyPlayers.set(gameId, new Set());
                    console.log(`🔧 Ready Players Set für ${gameId} initialisiert`);
                }

                const currentReadySet = readyPlayers.get(gameId);
                currentReadySet.add(playerName);

                console.log(`✅ ${playerName} ist bereit für Spiel ${gameId}`);
                console.log(`📋 Aktuell bereite Spieler:`, Array.from(currentReadySet));

                sendReadyStatusUpdate(gameId, gameData, io);

                const totalPlayers = Object.keys(gameData.rolesMap).length;
                const readyCount = currentReadySet.size;

                console.log(`🔢 Ready Count: ${readyCount}/${totalPlayers}`);

                if (readyCount === totalPlayers) {
                    console.log(`🚀 Alle Spieler bereit für Spiel ${gameId}. Starte Spiel!`);

                    setTimeout(async () => {
                        await initializeAndStartGame(gameId, gameData, io);
                    }, 2000);
                }

            } catch (error) {
                console.error("❌ Fehler beim Player Ready:", error);
                socket.emit("game-error", "Fehler beim Bereit-Status");
            }
        });

        // Spiel-spezifische Events
        socket.on("join-game", async (data) => {
            const { gameId, playerName } = data;

            try {
                const game = games[gameId];
                if (!game || !game.phase) {
                    socket.emit("game-error", "Spiel noch nicht gestartet oder nicht gefunden");
                    return;
                }

                const gameDoc = await getDoc(doc(db, "games", gameId));
                if (!gameDoc.exists()) {
                    socket.emit("game-error", "Spiel nicht gefunden");
                    return;
                }

                const gameData = gameDoc.data();
                if (!gameData.rolesMap[playerName]) {
                    socket.emit("game-error", "Spieler nicht in diesem Spiel");
                    return;
                }

                console.log(`${playerName} ist dem gestarteten Spiel ${gameId} beigetreten`);

                const playerGameState = getGameStateForPlayer(gameId, playerName, gameData);
                socket.emit("game-state-update", playerGameState);

            } catch (error) {
                console.error("Fehler beim Spiel beitreten:", error);
                socket.emit("game-error", "Fehler beim Spiel beitreten");
            }
        });

        // Guess einreichen
        socket.on("submit-guess", async (data) => {
            const { gameId, guess, playerName } = data;

            try {
                const game = games[gameId];
                if (!game) {
                    socket.emit("game-error", "Spiel nicht gefunden");
                    return;
                }

                if (game.phase !== "GUESSING_PHASE") {
                    socket.emit("game-error", "Nicht in der Ratephase");
                    return;
                }

                const gameDoc = await getDoc(doc(db, "games", gameId));
                const gameData = gameDoc.data();
                const playerRole = gameData.rolesMap[playerName]?.role;

                if (playerRole !== "GUESSER") {
                    socket.emit("game-error", "Nur der Guesser kann raten");
                    return;
                }

                console.log(`${playerName} rät: "${guess}"`);

                const result = await submitGuess(gameId, guess);

                console.log(`[${gameId}] ✅ Guess verarbeitet (${result}) - Polling wird Phasenwechsel erkennen`);

            } catch (error) {
                console.error("Fehler beim Guess:", error);
                socket.emit("game-error", "Fehler beim Einreichen des Guess");
            }
        });

        // Wort einreichen
        socket.on("submit-word", async (data) => {
            const { gameId, word, playerName } = data;

            try {
                const game = games[gameId];
                if (!game) {
                    socket.emit("game-error", "Spiel nicht gefunden");
                    return;
                }

                if (game.phase !== "SUBMITTING_PHASE") {
                    socket.emit("game-error", "Nicht in der Wort-Einreichungsphase");
                    return;
                }

                const gameDoc = await getDoc(doc(db, "games", gameId));
                const gameData = gameDoc.data();
                const playerRole = gameData.rolesMap[playerName]?.role;

                if (playerRole === "GUESSER") {
                    socket.emit("game-error", "Guesser kann keine Wörter einreichen");
                    return;
                }

                console.log(`${playerName} reicht Wort ein: "${word}"`);

                // Wort einreichen - wird automatisch zu Firebase synchronisiert
                await submitWord(gameId, playerName, word);

                console.log(`[${gameId}] ✅ Wort eingereicht - Firebase automatisch aktualisiert`);

            } catch (error) {
                console.error("Fehler beim Wort einreichen:", error);
                socket.emit("game-error", "Fehler beim Einreichen des Wortes");
            }
        });

        // Disconnect Handler
        socket.on("disconnect", () => {
            console.log("Spieler getrennt:", socket.id);

            const queuePlayer = queue.find((p) => p.id === socket.id);
            if (queuePlayer) {
                console.log(`${queuePlayer.name} hat die Warteschlange verlassen.`);
                queue = queue.filter((p) => p.id !== socket.id);
                io.emit("queue-update", queue.length);
            }

            for (const [gameId, players] of playerSockets.entries()) {
                for (const [playerName, socketId] of players.entries()) {
                    if (socketId === socket.id) {
                        console.log(`${playerName} hat Spiel ${gameId} verlassen`);
                        players.delete(playerName);

                        if (readyPlayers.has(gameId)) {
                            readyPlayers.get(gameId).delete(playerName);
                        }

                        socket.to(gameId).emit("player-disconnected", { playerName });

                        if (players.size === 0) {
                            playerSockets.delete(gameId);
                            readyPlayers.delete(gameId);
                        }
                        break;
                    }
                }
            }
        });
    });

    // Hilfsfunktionen
    async function initializeAndStartGame(gameId, gameData, io) {
        try {
            if (!games[gameId]) {
                games[gameId] = {
                    solutionWord: null,
                    round: 0,
                    revealedLetters: new Set(),
                    phase: null,
                    isFinished: false,
                    submissions: [],
                    submittedPlayers: new Set(),
                    expectedSubmitters: Object.keys(gameData.rolesMap).length - 1,
                    scores: {},
                    guessSubmitted: false,
                    onPhaseChange: async (gameId) => {
                        console.log(`[${gameId}] ✅ Phase-Change durch Zeitablauf - Polling wird es erkennen`);
                    }
                };

                Object.keys(gameData.rolesMap).forEach(playerName => {
                    games[gameId].scores[playerName] = 0;
                });
            }

            await startGame(gameId);

            await syncAndBroadcastGameState(gameId, gameData, io);

        } catch (error) {
            console.error(`Fehler beim Initialisieren von Spiel ${gameId}:`, error);
        }
    }

    function sendReadyStatusUpdate(gameId, gameData, io) {
        if (!gameData || !gameData.rolesMap) {
            console.error(`Keine gültigen gameData für ${gameId}`);
            return;
        }

        const totalPlayers = Object.keys(gameData.rolesMap).length;
        const readyPlayersList = readyPlayers.has(gameId) ? Array.from(readyPlayers.get(gameId)) : [];
        const allReady = readyPlayersList.length === totalPlayers;

        const updateData = {
            readyPlayers: readyPlayersList,
            totalPlayers: totalPlayers,
            allReady: allReady
        };

        console.log(`📊 Ready Status Update für ${gameId}:`, updateData);
        io.to(gameId).emit("ready-status-update", updateData);

        return updateData;
    }

    async function syncAndBroadcastGameState(gameId, gameData, io, forceRefresh = false) {
        try {
            console.log(`[${gameId}] 🔄 Starte syncAndBroadcastGameState... (forceRefresh=${forceRefresh})`);

            // Sync zu Firebase wird automatisch in GameManager gemacht
            // await syncGameStateToFirebase(gameId); // Entfernt - passiert automatisch

            const players = playerSockets.get(gameId);
            if (!players) {
                console.warn(`[${gameId}] ⚠️ Keine Spieler-Sockets gefunden`);
                return;
            }

            console.log(`[${gameId}] 📤 Sende Game State an ${players.size} Spieler`);

            for (const [playerName, socketId] of players.entries()) {
                const socket = io.sockets.sockets.get(socketId);
                if (socket) {
                    if (forceRefresh) {
                        console.log(`[${gameId}] 🔄 Sende Force-Refresh an ${playerName}`);
                        socket.emit("force-refresh", { reason: "Phasenwechsel" });
                    } else {
                        const playerGameState = getGameStateForPlayer(gameId, playerName, gameData);
                        console.log(`[${gameId}] → Sende an ${playerName}: Phase=${playerGameState?.phase}, submissions=${playerGameState?.submissions?.length || 0}`);
                        socket.emit("game-state-update", playerGameState);
                    }
                } else {
                    console.warn(`[${gameId}] ⚠️ Socket für ${playerName} nicht gefunden`);
                }
            }

            console.log(`[${gameId}] ✅ Game State Broadcast abgeschlossen`);

        } catch (error) {
            console.error(`❌ Fehler beim Sync von Spiel ${gameId}:`, error);
        }
    }

    function getGameStateForPlayer(gameId, playerName, gameData) {
        const game = games[gameId];
        if (!game) return null;

        const playerRole = gameData.rolesMap[playerName]?.role;

        let solutionWord = game.solutionWord;
        if (typeof solutionWord !== 'string') {
            console.warn(`[${gameId}] solutionWord ist kein String:`, solutionWord);
            solutionWord = String(solutionWord || "");
        }

        let timeLeft = 0;
        if (game.phase === "GUESSING_PHASE") {
            timeLeft = game.guessSubmitted ? 0 : 60000;
        } else if (game.phase === "SUBMITTING_PHASE") {
            timeLeft = 120000;
        } else if (game.phase === "FINISH_PHASE") {
            timeLeft = 0;
        }

        console.log(`[${gameId}] 🔍 getGameStateForPlayer für ${playerName}:`);
        console.log(`[${gameId}] 📝 submissions im game:`, game.submissions);
        console.log(`[${gameId}] 📝 submissions Länge:`, game.submissions?.length || 0);

        console.log(`[${gameId}] Game State für ${playerName}: Phase=${game.phase}, timeLeft=${timeLeft}, submissions=${game.submissions?.length || 0}`);

        return {
            phase: game.phase,
            round: game.round,
            solutionWord: solutionWord,
            revealedLetters: Array.from(game.revealedLetters),
            submissions: game.submissions || [],
            isFinished: game.isFinished,
            scores: game.scores || {},
            submittedPlayers: Array.from(game.submittedPlayers),
            guessSubmitted: game.guessSubmitted || false,
            playerRole: playerRole,
            timeLeft: timeLeft
        };
    }

    // Diese Funktion ist jetzt redundant, da GameManager selbst zu Firebase synct
    // Aber falls du sie separat brauchst:
    async function syncGameStateToFirebase(gameId) {
        try {
            const game = games[gameId];
            if (!game) return;

            const gameState = {
                phase: game.phase,
                round: game.round,
                solutionWord: game.solutionWord || "",
                revealedLetters: Array.from(game.revealedLetters),
                submissions: game.submissions || [],
                isFinished: game.isFinished,
                scores: game.scores || {},
                submittedPlayers: Array.from(game.submittedPlayers),
                guessSubmitted: game.guessSubmitted || false,
                lastUpdated: Date.now()
            };

            await updateDoc(doc(db, "games", gameId), {
                gameState: gameState
            });

            console.log(`[${gameId}] Spielstand zu Firebase synchronisiert`);

        } catch (error) {
            console.error(`[${gameId}] Fehler beim Synchronisieren zu Firebase:`, error);
        }
    }
};