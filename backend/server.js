import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from 'url';
import { socketHandlers } from "./socketHandlers.js"; // Socket.IO-Handler importieren
import { games } from "./GameManager.js"; // GameManager für Status-Endpoint
import { db } from "./firebase.js"; // Firebase für Fallback
import { doc, getDoc } from "firebase/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production'
            ? true  // Allows all origins in production
            : 'http://localhost:5173', // Die URL des Frontends für Development
        methods: ['GET', 'POST'],
    },
});

app.use(express.json());
app.use(cors());

// Serve React Build Files (für Production)
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'build')));
}

// Socket.IO Handler ZUERST
socketHandlers(io);

// ERWEITETER Status-Endpoint für Polling (mit Submissions und allen Details)
app.get('/api/games/:gameId/status', async (req, res) => {
    try {
        const { gameId } = req.params;
        console.log(`🔍 Status-Abfrage für Spiel ${gameId}`);

        // Erst lokalen GameManager prüfen
        const localGame = games[gameId];

        if (localGame) {
            // Lokale Daten verwenden (aktuellste)
            const status = {
                phase: localGame.phase,
                round: localGame.round,
                solutionWord: localGame.solutionWord || "",
                revealedLetters: Array.from(localGame.revealedLetters || []),
                submissions: localGame.submissions || [], // WICHTIG: Submissions einbeziehen
                isFinished: localGame.isFinished || false,
                scores: localGame.scores || {},
                submittedPlayers: Array.from(localGame.submittedPlayers || []), // WICHTIG: Eingereichte Spieler
                guessSubmitted: localGame.guessSubmitted || false,
                timestamp: new Date().toISOString(),
                lastUpdated: Date.now(),
                source: "local" // Debug-Info
            };

            // Debug-Log mit mehr Details (IMMER loggen für Debug)
            console.log(`📤 Status von lokal für ${gameId}:`, {
                phase: status.phase,
                round: status.round,
                submissionsCount: status.submissions.length,
                submittedPlayersCount: status.submittedPlayers.length,
                submissions: status.submissions
            });

            res.json(status);
            return;
        }

        // Fallback: Firebase prüfen (falls Spiel noch nicht lokal geladen)
        console.log(`⚠️ Spiel ${gameId} nicht lokal gefunden, prüfe Firebase...`);

        try {
            const gameDoc = await getDoc(doc(db, "games", gameId));

            if (!gameDoc.exists()) {
                console.log(`❌ Spiel ${gameId} auch nicht in Firebase gefunden`);
                return res.status(404).json({ error: "Spiel nicht gefunden" });
            }

            const gameData = gameDoc.data();
            const gameState = gameData.gameState || {};

            const status = {
                phase: gameState.phase || "GUESSING_PHASE",
                round: gameState.round || 1,
                solutionWord: gameState.solutionWord || "",
                revealedLetters: gameState.revealedLetters || [],
                submissions: gameState.submissions || [],
                isFinished: gameState.isFinished || false,
                scores: gameState.scores || {},
                submittedPlayers: gameState.submittedPlayers || [],
                guessSubmitted: gameState.guessSubmitted || false,
                timestamp: new Date().toISOString(),
                lastUpdated: gameState.lastUpdated || Date.now(),
                source: "firebase" // Debug-Info
            };

            console.log(`📤 Status von Firebase für ${gameId}:`, {
                phase: status.phase,
                submissionsCount: status.submissions.length,
                submittedPlayersCount: status.submittedPlayers.length
            });

            res.json(status);

        } catch (firebaseError) {
            console.error(`❌ Firebase-Fehler für ${gameId}:`, firebaseError);
            return res.status(500).json({ error: "Fehler beim Abrufen der Spieldaten" });
        }

    } catch (error) {
        console.error(`❌ Allgemeiner Fehler beim Status-Abruf für ${gameId}:`, error);
        res.status(500).json({ error: 'Interner Serverfehler' });
    }
});

// Health Check Endpoint (erweitert mit mehr Debug-Info)
app.get('/api/health', (req, res) => {
    const activeGames = Object.keys(games);
    const gameDetails = {};

    // Sammle Details über aktive Spiele für Debug
    activeGames.forEach(gameId => {
        const game = games[gameId];
        gameDetails[gameId] = {
            phase: game?.phase,
            round: game?.round,
            submissionsCount: game?.submissions?.length || 0,
            playersCount: Object.keys(game?.scores || {}).length
        };
    });

    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        activeGames: activeGames.length,
        gameDetails: gameDetails,
        environment: process.env.NODE_ENV || 'development'
    });
});

// Debug-Endpoint für Entwicklung (optional)
app.get('/api/games/:gameId/debug', (req, res) => {
    try {
        const { gameId } = req.params;
        const game = games[gameId];

        if (!game) {
            return res.status(404).json({ error: 'Spiel nicht gefunden' });
        }

        // Vollständige Debug-Info
        const debugInfo = {
            gameId,
            phase: game.phase,
            round: game.round,
            solutionWord: game.solutionWord,
            revealedLetters: Array.from(game.revealedLetters || []),
            submissions: game.submissions || [],
            submittedPlayers: Array.from(game.submittedPlayers || []),
            scores: game.scores || {},
            isFinished: game.isFinished,
            guessSubmitted: game.guessSubmitted,
            expectedSubmitters: game.expectedSubmitters,
            hasGuessTimer: !!game.guessTimer,
            hasSubmitTimer: !!game.submitTimer,
            timestamp: new Date().toISOString()
        };

        console.log(`🔧 Debug-Info für ${gameId}:`, debugInfo);
        res.json(debugInfo);

    } catch (error) {
        console.error('Fehler beim Debug-Abruf:', error);
        res.status(500).json({ error: 'Debug-Fehler' });
    }
});

// React App für alle anderen Routes (Production only) - GANZ AM ENDE
if (process.env.NODE_ENV === 'production') {
    app.get('/*', (req, res) => {
        // Don't serve React app for API routes
        if (req.path.startsWith('/api/')) {
            return res.status(404).json({ error: 'API route not found' });
        }
        res.sendFile(path.join(__dirname, 'build', 'index.html'));
    });
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server läuft auf Port ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

    if (process.env.NODE_ENV === 'production') {
        console.log(`🎮 React App wird auch von diesem Server gehostet!`);
    }
});