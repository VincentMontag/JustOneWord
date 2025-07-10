// GameManager.js - Mit intelligenter Punktevergabe

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from "./firebase.js"; // Deine Firebase-Konfiguration
import { doc, updateDoc, getDoc } from "firebase/firestore";

export const games = {}; // gameId => game state

const GUESSING_TIME = 60000;   // 1 Minute
const SUBMITTING_TIME = 120000; // 2 Minuten

// PUNKTESYSTEM KONSTANTEN
const SCORING = {
    SUPPORTER_START_POINTS: 500,
    GUESSER_START_POINTS: 500,
    SABOTEUR_START_POINTS: 0,
    SUPPORTER_PENALTY_PER_ROUND: 100,  // -100 pro falschem Guess
    SABOTEUR_BONUS_PER_ROUND: 100,     // +100 pro falschem Guess
    CORRECT_GUESS_BONUS: 200,          // Bonus für Gewinner-Team
    SABOTEUR_ROUND_BONUS: 50           // Saboteure bekommen auch pro Runde etwas
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dictionaryPath = path.resolve(__dirname, 'data/dictionary.txt');

export async function loadRandomWord() {
    try {
        const content = await fs.readFile(dictionaryPath, 'utf-8');
        const words = content.split(/\r?\n/).filter(Boolean);

        const randomIndex = Math.floor(Math.random() * words.length);
        const selectedWord = words[randomIndex].trim();

        return String(selectedWord);
    } catch (error) {
        console.error("Fehler beim Laden des Dictionary:", error);
        return "FALLBACK";
    }
}

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
            lastUpdated: Date.now()
        };

        await updateDoc(doc(db, "games", gameId), {
            gameState: gameState
        });

    } catch (error) {
        console.error(`[${gameId}] Fehler beim Synchronisieren zu Firebase:`, error);
    }
}

// Punktevergabe
async function updateScoresBasedOnRoles(gameId, scenario) {
    try {
        const game = games[gameId];
        if (!game) return;

        const gameDoc = await getDoc(doc(db, "games", gameId));
        if (!gameDoc.exists()) {
            console.error(`[${gameId}] ❌ Kann Rollen nicht aus Firebase laden`);
            return;
        }

        const gameData = gameDoc.data();
        const rolesMap = gameData.rolesMap || {};

        Object.keys(game.scores).forEach(playerName => {
            const playerRole = rolesMap[playerName]?.role;
            const oldScore = game.scores[playerName];
            let newScore = oldScore;

            switch (scenario) {
                case 'WRONG_GUESS':
                    if (playerRole === 'SUPPORTER' || playerRole === 'GUESSER') {
                        newScore = Math.max(0, oldScore - SCORING.SUPPORTER_PENALTY_PER_ROUND);
                    } else if (playerRole === 'SABOTEUR') {
                        newScore = oldScore + SCORING.SABOTEUR_BONUS_PER_ROUND;
                    }
                    break;

                case 'CORRECT_GUESS':
                    if (playerRole === 'SUPPORTER' || playerRole === 'GUESSER') {
                        newScore = oldScore + SCORING.CORRECT_GUESS_BONUS;
                    }
                    break;

                case 'ROUND_END':
                    if (playerRole === 'SABOTEUR') {
                        newScore = oldScore + SCORING.SABOTEUR_ROUND_BONUS;
                    }
                    break;
            }

            game.scores[playerName] = newScore;
        });

        // Sync zu Firebase
        await syncSubmissionsToFirebase(gameId);

    } catch (error) {
        console.error(`[${gameId}] ❌ Fehler bei Punkteberechnung:`, error);
    }
}

// Startpunkte basierend auf Rollen
async function initializeScoresBasedOnRoles(gameId) {
    try {
        const game = games[gameId];
        if (!game) return;

        const gameDoc = await getDoc(doc(db, "games", gameId));
        if (!gameDoc.exists()) {
            console.error(`[${gameId}] ❌ Kann Rollen nicht aus Firebase laden`);
            return;
        }

        const gameData = gameDoc.data();
        const rolesMap = gameData.rolesMap || {};

        Object.keys(rolesMap).forEach(playerName => {
            const playerRole = rolesMap[playerName]?.role;
            let startPoints = 0;

            switch (playerRole) {
                case 'SUPPORTER':
                    startPoints = SCORING.SUPPORTER_START_POINTS;
                    break;
                case 'GUESSER':
                    startPoints = SCORING.GUESSER_START_POINTS;
                    break;
                case 'SABOTEUR':
                    startPoints = SCORING.SABOTEUR_START_POINTS;
                    break;
            }

            game.scores[playerName] = startPoints;
        });

    } catch (error) {
        console.error(`[${gameId}] ❌ Fehler bei Score-Initialisierung:`, error);
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
    }

    if (typeof game.solutionWord !== 'string') {
        console.error(`[${gameId}] Fehler: solutionWord ist kein String!`, game.solutionWord);
        game.solutionWord = "FALLBACK";
    }

    game.round = 1;
    game.revealedLetters = new Set();
    game.phase = "GUESSING_PHASE";
    game.isFinished = false;
    game.guessSubmitted = false;
    game.submissions = [];
    game.submittedPlayers = new Set();

    await initializeScoresBasedOnRoles(gameId);
    await syncSubmissionsToFirebase(gameId);
    startGuessingPhase(gameId);
}

function startGuessingPhase(gameId) {
    const game = games[gameId];
    if (!game || game.isFinished) return;

    if (!game.solutionWord || typeof game.solutionWord !== 'string') {
        console.error(`[${gameId}] Fehler: Ungültiges solutionWord beim Masking:`, game.solutionWord);
        return;
    }

    const maskedWord = game.solutionWord
        .split('')
        .map((letter, i) => (game.revealedLetters.has(i) ? letter.toUpperCase() : '_'))
        .join('');

    game.phase = "GUESSING_PHASE";
    game.guessSubmitted = false;
    game.submittedPlayers = new Set();

    syncSubmissionsToFirebase(gameId);

    // Timer starten
    clearTimeout(game.guessTimer);
    game.guessTimer = setTimeout(async () => {
        if (!game.guessSubmitted && !game.isFinished) {

            game.phase = "SUBMITTING_PHASE";
            game.submittedPlayers = new Set();
            await syncSubmissionsToFirebase(gameId);
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

    if (normalized === game.solutionWord.toLowerCase()) {

        await updateScoresBasedOnRoles(gameId, 'CORRECT_GUESS');
        game.phase = "FINISH_PHASE";
        game.isFinished = true;

        // Sync zu Firebase
        await syncSubmissionsToFirebase(gameId);

        return "correct";
    } else {

        await updateScoresBasedOnRoles(gameId, 'WRONG_GUESS');

        game.phase = "SUBMITTING_PHASE";
        game.submittedPlayers = new Set();

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
        return;
    }

    const normalizedWord = word.trim().toLowerCase();

    game.submittedPlayers.add(playerName);
    game.submissions.push(normalizedWord);

    await syncSubmissionsToFirebase(gameId);

    if (game.submittedPlayers.size >= game.expectedSubmitters) {
        clearTimeout(game.submitTimer);
        processSubmissions(gameId);
    }
}

async function processSubmissions(gameId) {
    const game = games[gameId];
    if (!game || game.isFinished) return;

    // Duplikate entfernen
    const freq = {};
    for (const word of game.submissions) {
        freq[word] = (freq[word] || 0) + 1;
    }

    const filtered = game.submissions.filter(w => freq[w] < 2);
    game.submissions = filtered;

    await syncSubmissionsToFirebase(gameId);
    await updateScoresBasedOnRoles(gameId, 'ROUND_END');

    // Einen zufälligen Buchstaben aufdecken
    const unrevealed = game.solutionWord
        .split('')
        .map((_, i) => i)
        .filter(i => !game.revealedLetters.has(i));

    if (unrevealed.length === 0) {
        await updateScoresBasedOnRoles(gameId, 'CORRECT_GUESS');
        game.phase = "FINISH_PHASE";
        game.isFinished = true;

        // Sync zu Firebase
        await syncSubmissionsToFirebase(gameId);

        return;
    }

    const randomIndex = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    game.revealedLetters.add(randomIndex);
    game.round++;

    await syncSubmissionsToFirebase(gameId);
    startGuessingPhase(gameId);
}
