import { setDoc, doc } from "firebase/firestore";
import { db } from './firebase.js';
import { v4 as uuidv4 } from "uuid";
import { startGame, games, loadRandomWord } from './GameManager.js'; // loadRandomWord importieren

export async function assignRoles(queue, io) {
    const playersCopy = [...queue];
    const randomIndex = Math.floor(Math.random() * playersCopy.length);
    const ratender = playersCopy[randomIndex];
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

    for (const player of queue) {
        let role = "";

        if (player === ratender) {
            role = "Ratender";
        } else if (supporters.includes(player)) {
            role = "Unterstützer";
        } else if (saboteurs.includes(player)) {
            role = "Saboteur";
        }

        rolesMap[player.name] = {
            role,
            socketId: player.id,
        };

        const playerSocket = io.sockets.sockets.get(player.id);
        if (playerSocket) {
            // gameId und Rolle mitgeben
            playerSocket.emit("role-assigned", { role, gameId });
        }
    }

    const solutionWord = await loadRandomWord();

    const gameDoc = {
        rolesMap,
        solutionWord,
        expectedSubmitters: supporters.length + saboteurs.length,
        players: queue.map(p => p.name),
    };

    await setDoc(doc(db, "games", gameId), gameDoc);

    // Spielzustand auch im Server-Cache halten
    games[gameId] = {
        ...gameDoc,
        phase: null,
        round: 0,
        revealedLetters: new Set(),
        isFinished: false,
    };

    startGame(gameId);
    queue.length = 0;

    return gameId;
}
