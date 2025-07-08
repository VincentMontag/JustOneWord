// JoinRandom.tsx - Angepasst für neue Socket.IO Integration

import { useState, useEffect } from "react";
import { Box, Button, TextField, Typography, Container, Alert, CircularProgress } from "@mui/material";
import { starBackground } from "../styles/starBackground.ts";
import { useNavigate } from "react-router-dom";
import socket from "../socket.ts";

function JoinRandom() {
    const [name, setName] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [queueSize, setQueueSize] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(socket.connected);
    const navigate = useNavigate();

    useEffect(() => {
        // Connection status listeners
        const onConnect = () => {
            console.log("Socket verbunden");
            setIsConnected(true);
            setError(null);
        };

        const onDisconnect = () => {
            console.log("Socket getrennt");
            setIsConnected(false);
            setSubmitted(false);
            setQueueSize(0);
        };

        // Game event listeners
        const onQueueUpdate = (size: number) => {
            console.log("Queue Update:", size);
            setQueueSize(size);
        };

        const onRoleAssigned = ({ gameId, playerName, role }: {
            gameId: string,
            playerName: string,
            role: string
        }) => {
            console.log("Rolle zugewiesen:", { gameId, playerName, role });
            navigate("/role", {
                state: {
                    name: playerName,
                    gameId,
                    role
                }
            });
        };

        const onInvalidData = (message: string) => {
            console.error("Ungültige Daten:", message);
            setError(message);
            setSubmitted(false);
        };

        const onGameError = (message: string) => {
            console.error("Spielfehler:", message);
            setError(message);
            setSubmitted(false);
        };

        // Register listeners
        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("queue-update", onQueueUpdate);
        socket.on("role-assigned", onRoleAssigned);
        socket.on("invalid-data", onInvalidData);
        socket.on("game-error", onGameError);

        // Set initial connection state
        setIsConnected(socket.connected);

        // Cleanup
        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("queue-update", onQueueUpdate);
            socket.off("role-assigned", onRoleAssigned);
            socket.off("invalid-data", onInvalidData);
            socket.off("game-error", onGameError);
        };
    }, [navigate]);

    const handleJoin = () => {
        if (!isConnected) {
            setError("Nicht mit dem Server verbunden. Versuche es erneut.");
            return;
        }

        if (name.trim().length >= 1 && name.trim().length <= 20) {
            console.log(`Sende Name: ${name.trim()}`);
            setError(null);
            socket.emit("join-random", { name: name.trim(), id: socket.id });
            setSubmitted(true);
        } else {
            setError("Name muss zwischen 1 und 20 Zeichen lang sein");
        }
    };

    const handleLeaveQueue = () => {
        // Disconnect und reconnect um aus der Queue zu gehen
        socket.disconnect();
        socket.connect();
        setSubmitted(false);
        setQueueSize(0);
        setError(null);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !submitted && isConnected) {
            handleJoin();
        }
    };

    return (
        <Container
            style={{
                ...starBackground,
                minHeight: "100vh",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
            }}
        >
            <Box display="flex" flexDirection="column" gap="20px" alignItems="center" maxWidth="400px" width="100%">
                {/* Connection Status */}
                {!isConnected && (
                    <Alert severity="warning" sx={{ width: "100%" }}>
                        Verbindung zum Server unterbrochen. Versuche neu zu verbinden...
                    </Alert>
                )}

                {/* Error Display */}
                {error && (
                    <Alert severity="error" onClose={() => setError(null)} sx={{ width: "100%" }}>
                        {error}
                    </Alert>
                )}

                {!submitted ? (
                    <>
                        <Typography
                            variant="h4"
                            align="center"
                            sx={{
                                fontFamily: "'Super Larky', cursive",
                                color: "#393E46",
                                fontSize: "2rem",
                            }}
                        >
                            Gib deinen Namen ein
                        </Typography>

                        <TextField
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyPress={handleKeyPress}
                            label="Name"
                            variant="outlined"
                            disabled={!isConnected}
                            inputProps={{ maxLength: 20 }}
                            helperText="1-20 Zeichen"
                            sx={{
                                width: "300px",
                                "& .MuiInputBase-input": {
                                    fontFamily: "'Super Larky', cursive",
                                    fontSize: "1.2rem",
                                },
                                "& .MuiOutlinedInput-root": {
                                    "& fieldset": {
                                        borderColor: "#3fc1c9",
                                    },
                                    "&:hover fieldset": {
                                        borderColor: "#33658A",
                                    },
                                    "&.Mui-focused fieldset": {
                                        borderColor: "#AA6DA3",
                                    },
                                },
                            }}
                            InputLabelProps={{
                                sx: {
                                    fontFamily: "'Super Larky', cursive",
                                    fontSize: "1.2rem",
                                    color: "#393E46",
                                },
                            }}
                        />

                        <Button
                            variant="contained"
                            onClick={handleJoin}
                            disabled={!isConnected || !name.trim()}
                            sx={{
                                fontFamily: "'Super Larky', cursive",
                                fontSize: "1.3rem",
                                padding: "10px 30px",
                                backgroundColor: "#3fc1c9",
                                "&:hover": {
                                    backgroundColor: "#33a1a8",
                                },
                                "&:disabled": {
                                    backgroundColor: "#cccccc",
                                }
                            }}
                        >
                            {!isConnected ? "Verbinde..." : "Beitreten"}
                        </Button>
                    </>
                ) : (
                    <>
                        <Box display="flex" flexDirection="column" alignItems="center" gap="20px">
                            <CircularProgress
                                size={60}
                                sx={{
                                    color: "#3fc1c9",
                                    mb: 2
                                }}
                            />

                            <Typography
                                variant="h5"
                                align="center"
                                sx={{
                                    fontFamily: "'Super Larky', cursive",
                                    color: "#393E46",
                                    fontSize: "1.8rem",
                                }}
                            >
                                Warte auf weitere Spieler
                            </Typography>

                            <Typography
                                variant="h6"
                                align="center"
                                sx={{
                                    fontFamily: "'Super Larky', cursive",
                                    color: "#AA6DA3",
                                    fontSize: "1.5rem",
                                    fontWeight: "bold"
                                }}
                            >
                                {queueSize}/3 Spieler
                            </Typography>

                            <Typography
                                variant="body1"
                                align="center"
                                sx={{
                                    color: "#666",
                                    fontSize: "1rem",
                                    maxWidth: "300px"
                                }}
                            >
                                Das Spiel startet automatisch, sobald alle Spieler beigetreten sind.
                            </Typography>

                            <Button
                                variant="outlined"
                                onClick={handleLeaveQueue}
                                sx={{
                                    fontFamily: "'Super Larky', cursive",
                                    fontSize: "1rem",
                                    padding: "8px 20px",
                                    borderColor: "#AA6DA3",
                                    color: "#AA6DA3",
                                    "&:hover": {
                                        borderColor: "#8a5089",
                                        backgroundColor: "rgba(170, 109, 163, 0.1)"
                                    }
                                }}
                            >
                                Warteschlange verlassen
                            </Button>
                        </Box>
                    </>
                )}
            </Box>
        </Container>
    );
}

export default JoinRandom;