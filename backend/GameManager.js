// GameManager.js - Erweiterte Version mit Firebase-Integration

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from "./firebase.js"; // Deine Firebase-Konfiguration
import { doc, updateDoc, getDoc } from "firebase/firestore";

export const games = {}; // gameId => game state

const GUESSING_TIME = 60000;   // 1 Minute
const SUBMITTING_TIME = 120000; // 2 Minuten

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dictionaryPath = path.resolve(__dirname, '../backend/data/dictionary.txt');

export async function loadRandomWord() {
    try {
        const content = await fs.readFile(dictionaryPath, 'utf-8');
        const words = content.split(/\r?\n/).filter(Boolean);

        if (words.length === 0) {
            console.error("Keine Wörter im Dictionary gefunden!");
            return "FALLBACK"; // Notfall-Wort
        }

        const randomIndex = Math.floor(Math.random() * words.length);
        const selectedWord = words[randomIndex].trim();

        console.log(`Wort ausgewählt: "${selectedWord}" (Typ: ${typeof selectedWord})`);

        // Sicherstellen dass es ein String ist
        return String(selectedWord);
    } catch (error) {
        console.error("Fehler beim Laden des Dictionary:", error);
        return "FALLBACK"; // Notfall-Wort
    }
}

// Neue Hilfsfunktion: Synchronisation mit Firebase
async function syncSubmissionsToFirebase(gameId) {
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
            lastUpdated: Date.now() // Timestamp für Polling
        };

        await updateDoc(doc(db, "games", gameId), {
            gameState: gameState
        });

        console.log(`[${gameId}] 📤 Submissions zu Firebase synchronisiert:`, game.submissions);

    } catch (error) {
        console.error(`[${gameId}] ❌ Fehler beim Synchronisieren zu Firebase:`, error);
    }
}

export async function startGame(gameId) {
    const game = games[gameId];
    if (!game) {
        console.error(`[${gameId}] Kein Spiel gefunden!`);
        return;
    }

    if (!game.solutionWord) {
        game.solutionWord = await loadRandomWord();
        console.log(`[${gameId}] Wort geladen:`, typeof game.solutionWord, game.solutionWord);
    }

    // Zusätzliche Validierung
    if (typeof game.solutionWord !== 'string') {
        console.error(`[${gameId}] Fehler: solutionWord ist kein String!`, game.solutionWord);
        game.solutionWord = "FALLBACK";
    }

    console.log(`[${gameId}] Spiel startet mit Wort: ${game.solutionWord}`);
    game.round = 1;
    game.revealedLetters = new Set();
    game.phase = "GUESSING_PHASE";
    game.isFinished = false;
    game.guessSubmitted = false;
    game.submissions = [];
    game.submittedPlayers = new Set();

    // Initial sync zu Firebase
    await syncSubmissionsToFirebase(gameId);

    startGuessingPhase(gameId);
}

function startGuessingPhase(gameId) {
    const game = games[gameId];
    if (!game || game.isFinished) return;

    console.log(`[${gameId}] Runde ${game.round} - GUESSING_PHASE beginnt`);

    // Zusätzliche Validierung
    if (!game.solutionWord || typeof game.solutionWord !== 'string') {
        console.error(`[${gameId}] Fehler: Ungültiges solutionWord beim Masking:`, game.solutionWord);
        return;
    }

    const maskedWord = game.solutionWord
        .split('')
        .map((letter, i) => (game.revealedLetters.has(i) ? letter.toUpperCase() : '_'))
        .join('');

    console.log(`[${gameId}] Ratender sieht: ${maskedWord}`);
    game.phase = "GUESSING_PHASE";
    game.guessSubmitted = false;

    // Reset submissions für neue Runde
    game.submissions = [];
    game.submittedPlayers = new Set();

    // Sync zu Firebase
    syncSubmissionsToFirebase(gameId);

    // Timer starten
    clearTimeout(game.guessTimer);
    game.guessTimer = setTimeout(async () => {
        if (!game.guessSubmitted && !game.isFinished) {
            console.log(`[${gameId}] ⏰ GUESSING_PHASE Zeit abgelaufen! Wechsle zu SUBMITTING_PHASE`);

            game.phase = "SUBMITTING_PHASE";
            game.submissions = [];
            game.submittedPlayers = new Set();

            console.log(`[${gameId}] SUBMITTING_PHASE beginnt durch Zeitablauf`);

            // Sync zu Firebase
            await syncSubmissionsToFirebase(gameId);

            // SUBMITTING_PHASE Timer starten
            clearTimeout(game.submitTimer);
            game.submitTimer = setTimeout(() => {
                processSubmissions(gameId);
            }, SUBMITTING_TIME);

            if (game.onPhaseChange) {
                game.onPhaseChange(gameId);
            }
        }
    }, GUESSING_TIME);
}

export async function submitGuess(gameId, guess) {
    const game = games[gameId];
    if (!game || game.phase !== "GUESSING_PHASE" || game.guessSubmitted) return;

    if (!game.solutionWord || typeof game.solutionWord !== 'string') {
        console.error(`[${gameId}] Fehler: Ungültiges solutionWord:`, game.solutionWord);
        return;
    }

    const normalized = guess.trim().toLowerCase();
    game.guessSubmitted = true;
    clearTimeout(game.guessTimer);

    console.log(`[${gameId}] Vergleiche "${normalized}" mit "${game.solutionWord.toLowerCase()}"`);

    if (normalized === game.solutionWord.toLowerCase()) {
        console.log(`[${gameId}] Ratender hat das Wort korrekt erraten: "${guess}"`);
        console.log(`[${gameId}] Spiel beendet. Unterstützer + Ratender erhalten 300 Punkte.`);

        Object.keys(game.scores).forEach(playerName => {
            game.scores[playerName] += 300;
        });

        game.phase = "FINISH_PHASE";
        game.isFinished = true;

        // Sync zu Firebase
        await syncSubmissionsToFirebase(gameId);

        return "correct";
    } else {
        console.log(`[${gameId}] Falsches Wort geraten: "${guess}". SUBMITTING_PHASE startet SOFORT.`);

        game.phase = "SUBMITTING_PHASE";
        game.submissions = [];
        game.submittedPlayers = new Set();

        console.log(`[${gameId}] SUBMITTING_PHASE beginnt – Unterstützer & Saboteure senden Wörter`);

        // Sync zu Firebase
        await syncSubmissionsToFirebase(gameId);

        clearTimeout(game.submitTimer);
        game.submitTimer = setTimeout(() => {
            processSubmissions(gameId);
        }, SUBMITTING_TIME);

        return "incorrect";
    }
}

export async function submitWord(gameId, playerName, word) {
    const game = games[gameId];
    if (!game || game.phase !== "SUBMITTING_PHASE" || game.submittedPlayers.has(playerName)) {
        console.log(`[${gameId}] ⚠️ submitWord abgelehnt für ${playerName}: Phase=${game?.phase}, bereits submitted=${game?.submittedPlayers.has(playerName)}`);
        return;
    }

    const normalizedWord = word.trim().toLowerCase();
    console.log(`[${gameId}] 📝 ${playerName} reicht Wort ein: "${word}" → normalisiert: "${normalizedWord}"`);

    game.submittedPlayers.add(playerName);
    game.submissions.push(normalizedWord);

    console.log(`[${gameId}] 📊 Aktuelle submissions:`, game.submissions);
    console.log(`[${gameId}] 👥 Eingereicht von:`, Array.from(game.submittedPlayers));

    // WICHTIG: Sofort zu Firebase synchronisieren für Live-Updates
    await syncSubmissionsToFirebase(gameId);

    if (game.submittedPlayers.size >= game.expectedSubmitters) {
        clearTimeout(game.submitTimer);
        console.log(`[${gameId}] ✅ Alle ${game.expectedSubmitters} Spieler haben eingereicht`);
        processSubmissions(gameId);
    } else {
        console.log(`[${gameId}] ⏳ Warte noch auf ${game.expectedSubmitters - game.submittedPlayers.size} Spieler`);
    }
}

async function processSubmissions(gameId) {
    const game = games[gameId];
    if (!game || game.isFinished) return;

    console.log(`[${gameId}] 🔄 Verarbeite Submissions vor Filtering:`, game.submissions);

    // Duplikate entfernen
    const freq = {};
    for (const word of game.submissions) {
        freq[word] = (freq[word] || 0) + 1;
    }

    const filtered = game.submissions.filter(w => freq[w] < 2);
    game.submissions = filtered;

    console.log(`[${gameId}] 📋 Häufigkeiten:`, freq);
    console.log(`[${gameId}] ✅ Eindeutige Wörter nach Filtering:`, filtered);

    // Sync zu Firebase NACH dem Filtering
    await syncSubmissionsToFirebase(gameId);

    // Saboteure erhalten 50 Punkte (hier müsstest du die Rollen prüfen)
    Object.keys(game.scores).forEach(playerName => {
        // Hier würdest du prüfen: if (playerRole === 'SABOTEUR')
        // game.scores[playerName] += 50;
    });

    console.log(`[${gameId}] Saboteure erhalten 50 Punkte`);

    // Einen zufälligen Buchstaben aufdecken
    const unrevealed = game.solutionWord
        .split('')
        .map((_, i) => i)
        .filter(i => !game.revealedLetters.has(i));

    if (unrevealed.length === 0) {
        console.log(`[${gameId}] Alle Buchstaben sind aufgedeckt! Saboteure erhalten 300 Punkte.`);

        Object.keys(game.scores).forEach(playerName => {
            // Hier würdest du prüfen: if (playerRole === 'SABOTEUR')
            // game.scores[playerName] += 300;
        });

        game.phase = "FINISH_PHASE";
        game.isFinished = true;

        // Sync zu Firebase
        await syncSubmissionsToFirebase(gameId);

        return;
    }

    const randomIndex = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    game.revealedLetters.add(randomIndex);
    game.round++;

    // Sync zu Firebase vor nächster Runde
    await syncSubmissionsToFirebase(gameId);

    startGuessingPhase(gameId);
}

// Hilfsfunktion: Spiel cleanup
export function cleanupGame(gameId) {
    const game = games[gameId];
    if (game) {
        clearTimeout(game.guessTimer);
        clearTimeout(game.submitTimer);
        delete games[gameId];
        console.log(`[${gameId}] Spiel bereinigt`);
    }
}