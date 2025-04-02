import { useEffect, useState } from "react";
import io, { Socket } from "socket.io-client";
import { Container, Typography, Button, TextField } from "@mui/material";

type Word = string;

const socket: Socket = io("http://localhost:5000"); // Backend-Adresse

function App() {
    const [word, setWord] = useState<string>("");
    const [words, setWords] = useState<Word[]>([]);

    useEffect(() => {
        socket.on("new-word", (newWord: Word) => {
            setWords((prev) => [...prev, newWord]);
        });

        return () => {
            socket.off("new-word");
        };
    }, []);

    const sendWord = () => {
        if (word.trim()) {
            socket.emit("send-word", word);
            setWord("");
        }
    };

    return (
        <Container>
            <Typography variant="h4">Just One – Multiplayer</Typography>
            <TextField
                label="Gib ein Substantiv ein"
                value={word}
                onChange={(e) => setWord(e.target.value)}
            />
            <Button variant="contained" color="primary" onClick={sendWord}>
                Senden
            </Button>

            <Typography variant="h6">Gesendete Wörter:</Typography>
            <ul>
                {words.map((w, i) => (
                    <li key={i}>{w}</li>
                ))}
            </ul>
        </Container>
    );
}

export default App;
