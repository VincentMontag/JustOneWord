import { setDoc, doc } from "firebase/firestore";
import { db } from './firebase.js'; // Importiere die Firestore-Datenbankinstanz

// Funktion zur zufälligen Rollenzuweisung
export async function assignRoles(queue, io) {
    // Die verfügbaren Rollen
    const roles = ["Ratender", "Unterstützer", "Saboteur"];
    const playersCopy = [...queue]; // Eine Kopie der Warteschlange
    const randomIndex = Math.floor(Math.random() * playersCopy.length); // Zufälliger Index für den Ratenden
    const ratender = playersCopy[randomIndex];

    // Der Ratende wird aus der Liste entfernt, damit er nicht nochmal als Unterstützer oder Saboteur gewählt wird
    playersCopy.splice(randomIndex, 1);

    // Ermitteln der Anzahl der Unterstützer (aufgerundete Hälfte der verbleibenden Spieler)
    const numSupporters = Math.ceil(playersCopy.length / 2);

    // Zufällig die Unterstützer auswählen
    const supporters = [];
    for (let i = 0; i < numSupporters; i++) {
        const randomSupporterIndex = Math.floor(Math.random() * playersCopy.length);
        supporters.push(playersCopy[randomSupporterIndex]);
        playersCopy.splice(randomSupporterIndex, 1); // Entferne den Unterstützer aus der Liste
    }

    // Der Rest der Spieler sind Saboteure
    const saboteurs = playersCopy;

    // Weisen Sie den Spielern ihre Rollen zu und speichern Sie sie in Firestore
    let i = 0;
    for (const player of queue) {
        let role = "";

        if (player === ratender) {
            role = "Ratender";
        } else if (supporters.includes(player)) {
            role = "Unterstützer";
        } else if (saboteurs.includes(player)) {
            role = "Saboteur";
        }

        // Speichern in Firestore
        await setDoc(doc(db, "roles", player.name), {
            role: role,
            socketId: player.id,
        });

        // Sende die Rolle an den entsprechenden Spieler
        const playerSocket = io.sockets.sockets.get(player.id);
        if (playerSocket) {
            playerSocket.emit("role-assigned", { role: role });
        }
    }

    // Leere die Warteschlange, nachdem die Zuweisung abgeschlossen ist
    queue = [];
}
