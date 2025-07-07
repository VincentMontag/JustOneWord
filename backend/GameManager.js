import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

export const games = {}; // gameId => game state

const GUESSING_TIME = 60000;   // 1 Minute
const SUBMITTING_TIME = 120000; // 2 Minuten

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dictionaryPath = path.resolve(__dirname, '../backend/data/dictionary.txt');

export async function loadRandomWord() {
    const content = await fs.readFile(dictionaryPath, 'utf-8');
    const words = content.split(/\r?\n/).filter(Boolean);
    const randomIndex = Math.floor(Math.random() * words.length);
    return words[randomIndex].trim();
}

export function startGame(gameId) {
    const game = games[gameId];
    if (!game) {
        console.error(`[${gameId}] Kein Spiel gefunden!`);
        return;
    }

    if (!game.solutionWord) {
        game.solutionWord = loadRandomWord();
    }

    console.log(`[${gameId}] Spiel startet mit Wort: ${game.solutionWord}`);
    game.round = 1;
    game.revealedLetters = new Set();
    game.phase = "GUESSING_PHASE";
    game.isFinished = false;

    startGuessingPhase(gameId);
}

function startGuessingPhase(gameId) {
    const game = games[gameId];
    if (!game || game.isFinished) return;

    console.log(`[${gameId}] Runde ${game.round} - GUESSING_PHASE beginnt`);

    const maskedWord = game.solutionWord
        .split('')
        .map((letter, i) => (game.revealedLetters.has(i) ? letter.toUpperCase() : '_'))
        .join('');

    console.log(`[${gameId}] Ratender sieht: ${maskedWord}`);
    game.phase = "GUESSING_PHASE";
    game.guessSubmitted = false;

    // Timer starten
    game.guessTimer = setTimeout(() => {
        if (!game.guessSubmitted) {
            console.log(`[${gameId}] Zeit vorbei. Ratender hat NICHT richtig geraten.`);
            startSubmittingPhase(gameId);
        }
    }, GUESSING_TIME);
}

export function submitGuess(gameId, guess) {
    const game = games[gameId];
    if (!game || game.phase !== "GUESSING_PHASE" || game.guessSubmitted) return;

    const normalized = guess.trim().toLowerCase();
    game.guessSubmitted = true;
    clearTimeout(game.guessTimer);

    if (normalized === game.solutionWord.toLowerCase()) {
        console.log(`[${gameId}] Ratender hat das Wort korrekt erraten: "${guess}"`);
        console.log(`[${gameId}] Spiel beendet. Unterstützer + Ratender erhalten 300 Punkte.`);
        game.phase = "FINISH_PHASE";
        game.isFinished = true;
        return;
    } else {
        console.log(`[${gameId}] Falsches Wort geraten: "${guess}". SUBMITTING_PHASE startet.`);
        startSubmittingPhase(gameId);
    }
}

function startSubmittingPhase(gameId) {
    const game = games[gameId];
    if (!game || game.isFinished) return;

    game.phase = "SUBMITTING_PHASE";
    game.submissions = [];
    game.submittedPlayers = new Set();

    console.log(`[${gameId}] SUBMITTING_PHASE beginnt – Unterstützer & Saboteure senden Wörter`);

    game.submitTimer = setTimeout(() => {
        processSubmissions(gameId);
    }, SUBMITTING_TIME);
}

export function submitWord(gameId, playerName, word) {
    const game = games[gameId];
    if (!game || game.phase !== "SUBMITTING_PHASE" || game.submittedPlayers.has(playerName)) return;

    console.log(`[${gameId}] ${playerName} hat "${word}" eingereicht`);
    game.submittedPlayers.add(playerName);
    game.submissions.push(word.trim().toLowerCase());

    if (game.submittedPlayers.size >= game.expectedSubmitters) {
        clearTimeout(game.submitTimer);
        processSubmissions(gameId);
    }
}

function processSubmissions(gameId) {
    const game = games[gameId];
    if (!game || game.isFinished) return;

    const freq = {};
    for (const word of game.submissions) {
        freq[word] = (freq[word] || 0) + 1;
    }

    const filtered = game.submissions.filter(w => freq[w] < 2);
    console.log(`[${gameId}] Eindeutige Wörter: ${filtered.join(', ') || 'Keine'}`);

    console.log(`[${gameId}] Saboteure erhalten 50 Punkte`);

    // Einen zufälligen Buchstaben aufdecken
    const unrevealed = game.solutionWord
        .split('')
        .map((_, i) => i)
        .filter(i => !game.revealedLetters.has(i));

    if (unrevealed.length === 0) {
        console.log(`[${gameId}] Alle Buchstaben sind aufgedeckt! Saboteure erhalten 300 Punkte.`);
        game.phase = "FINISH_PHASE";
        game.isFinished = true;
        return;
    }

    const randomIndex = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    game.revealedLetters.add(randomIndex);
    game.round++;

    startGuessingPhase(gameId);
}