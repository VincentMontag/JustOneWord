import { assignRoles } from "./gameLogic.js";
import { games, startGame, submitGuess, submitWord } from "./GameManager.js";
import { db } from "./firebase.js";
import { doc, updateDoc, getDoc } from "firebase/firestore";

export const socketHandlers = (io) => {
    let queue = [];
    const playerSockets = new Map();
    const readyPlayers = new Map();
    const startTimer = new Map(); // Timer für 3s Countdown nach "alle bereit"

    // Konfiguration
    const MIN_PLAYERS = 3;
    const MAX_PLAYERS = 11;
    const START_DELAY = 3000; // 3 Sekunden nach "alle bereit"

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

            // Prüfen ob Queue bereits voll ist
            if (queue.length >= MAX_PLAYERS) {
                socket.emit("queue-full", "Die Warteschlange ist voll. Bitte versuche es später erneut.");
                return;
            }

            // Prüfen ob Name bereits in Queue existiert
            const nameExists = queue.some(player => player.name === name);
            if (nameExists) {
                socket.emit("name-taken", "Dieser Name ist bereits in der Warteschlange.");
                return;
            }

            queue.push({ id: socket.id, name, ready: false });

            // Queue-Update an alle senden
            broadcastQueueUpdate();

            // Prüfen ob gerade ein Start-Timer läuft und diesen stoppen
            if (startTimer.has('global')) {
                clearTimeout(startTimer.get('global'));
                startTimer.delete('global');
                console.log("Start-Timer gestoppt - neuer Spieler beigetreten");
                io.emit("start-timer-cancelled", { reason: "Neuer Spieler beigetreten" });
            }
        });

        // Spieler in Queue als bereit markieren
        socket.on("queue-ready", (data) => {
            const { name } = data;
            const player = queue.find(p => p.id === socket.id && p.name === name);

            if (player) {
                player.ready = true;
                broadcastQueueUpdate();

                // Prüfen ob alle bereit sind und mindestens MIN_PLAYERS
                checkAndStartGame();
            }
        });

        // Spieler aus Queue entfernen (freiwillig)
        socket.on("leave-queue", () => {
            removePlayerFromQueue(socket.id);
            broadcastQueueUpdate();

            // Start-Timer stoppen falls läuft
            if (startTimer.has('global')) {
                clearTimeout(startTimer.get('global'));
                startTimer.delete('global');
                console.log("Start-Timer gestoppt - Spieler hat Queue verlassen");
                io.emit("start-timer-cancelled", { reason: "Spieler hat Queue verlassen" });
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
                }

                const currentReadySet = readyPlayers.get(gameId);
                currentReadySet.add(playerName);
                sendReadyStatusUpdate(gameId, gameData, io);
                const totalPlayers = Object.keys(gameData.rolesMap).length;
                const readyCount = currentReadySet.size;

                if (readyCount === totalPlayers) {
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

                const result = await submitGuess(gameId, guess);

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

                // Wort einreichen, automatisch zu Firebase synchronisiert
                await submitWord(gameId, playerName, word);

            } catch (error) {
                console.error("Fehler beim Wort einreichen:", error);
                socket.emit("game-error", "Fehler beim Einreichen des Wortes");
            }
        });

        // Disconnect Handler
        socket.on("disconnect", () => {
            console.log("Spieler getrennt:", socket.id);

            // Aus Queue entfernen
            removePlayerFromQueue(socket.id);
            broadcastQueueUpdate();

            // Start-Timer stoppen falls läuft
            if (startTimer.has('global')) {
                clearTimeout(startTimer.get('global'));
                startTimer.delete('global');
                io.emit("start-timer-cancelled", { reason: "Spieler disconnected" });
            }

            for (const [gameId, players] of playerSockets.entries()) {
                for (const [playerName, socketId] of players.entries()) {
                    if (socketId === socket.id) {
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

    function removePlayerFromQueue(socketId) {
        const index = queue.findIndex(p => p.id === socketId);
        if (index !== -1) {
            queue.splice(index, 1);
        }
    }

    function broadcastQueueUpdate() {
        const queueData = {
            players: queue.map(p => ({ name: p.name, ready: p.ready })),
            totalPlayers: queue.length,
            minPlayers: MIN_PLAYERS,
            maxPlayers: MAX_PLAYERS,
            canStart: queue.length >= MIN_PLAYERS,
            isFull: queue.length >= MAX_PLAYERS
        };

        io.emit("queue-update", queueData);
    }

    function checkAndStartGame() {
        if (queue.length >= MIN_PLAYERS) {
            const allReady = queue.every(player => player.ready);

            if (allReady) {

                // Vorhandenen Timer stoppen
                if (startTimer.has('global')) {
                    clearTimeout(startTimer.get('global'));
                }

                // 3s Timer starten
                const timer = setTimeout(() => {
                    startGameWithCurrentQueue();
                }, START_DELAY);

                startTimer.set('global', timer);

                // Countdown an alle senden
                io.emit("start-countdown", {
                    timeLeft: START_DELAY,
                    message: "Spiel startet in 3 Sekunden..."
                });
            }
        }
    }

    async function startGameWithCurrentQueue() {
        if (queue.length < MIN_PLAYERS) {
            return;
        }

        // Timer stoppen
        if (startTimer.has('global')) {
            clearTimeout(startTimer.get('global'));
            startTimer.delete('global');
        }

        try {

            const gameId = await assignRoles(queue, io);
            queue.length = 0;
            broadcastQueueUpdate();

        } catch (error) {
            console.error("Fehler bei Rollenzuteilung:", error);

            // Queue-Status zurücksetzen
            queue.forEach(player => player.ready = false);
            broadcastQueueUpdate();

            // Fehler an Clients senden
            io.emit("game-start-error", { message: "Fehler beim Spielstart. Bitte versucht es erneut." });
        }
    }

    // Bestehende Hilfsfunktionen
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
                    guessSubmitted: false
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

        io.to(gameId).emit("ready-status-update", updateData);
        return updateData;
    }

    async function syncAndBroadcastGameState(gameId, gameData, io, forceRefresh = false) {
        try {
            const players = playerSockets.get(gameId);
            if (!players) {
                console.warn(`[${gameId}] ⚠️ Keine Spieler-Sockets gefunden`);
                return;
            }

            for (const [playerName, socketId] of players.entries()) {
                const socket = io.sockets.sockets.get(socketId);
                if (socket) {
                    if (forceRefresh) {
                        socket.emit("force-refresh", { reason: "Phasenwechsel" });
                    } else {
                        const playerGameState = getGameStateForPlayer(gameId, playerName, gameData);
                        socket.emit("game-state-update", playerGameState);
                    }
                } else {
                    console.warn(`[${gameId}] ⚠️ Socket für ${playerName} nicht gefunden`);
                }
            }

        } catch (error) {
            console.error(`Fehler beim Sync von Spiel ${gameId}:`, error);
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
};