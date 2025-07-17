import { useState, useEffect } from "react";
import { Box, Button, TextField, Typography, Container, Alert, CircularProgress } from "@mui/material";
import { starBackground } from "../styles/starBackground.ts";
import { useNavigate } from "react-router-dom";
import socket from "../socket.ts";

function JoinRandom() {
    const [name, setName] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [queueData, setQueueData] = useState({
        players: [],
        totalPlayers: 0,
        minPlayers: 3,
        maxPlayers: 11,
        canStart: false,
        isFull: false
    });
    const [isReady, setIsReady] = useState(false);
    const [countdown, setCountdown] = useState<number | null>(null);
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
            setQueueData({
                players: [],
                totalPlayers: 0,
                minPlayers: 3,
                maxPlayers: 11,
                canStart: false,
                isFull: false
            });
            setIsReady(false);
            setCountdown(null);
        };

        // Game event listeners
        const onQueueUpdate = (data: any) => {
            console.log("Queue Update:", data);
            setQueueData(data);

            // Prüfen ob aktueller Spieler bereit ist
            const currentPlayer = data.players.find((p: any) => p.name === name.trim());
            setIsReady(currentPlayer ? currentPlayer.ready : false);
        };

        const onRoleAssigned = ({ gameId, playerName, role }: { gameId: any, playerName: any, role: any }) => {
            navigate("/role", {
                state: {
                    name: playerName,
                    gameId,
                    role
                }
            });
        };

        const onStartCountdown = (data: any) => {
            console.log("Start Countdown:", data);
            setCountdown(data.timeLeft / 1000);

            // Countdown timer
            const timer = setInterval(() => {
                setCountdown((prev: any) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        };

        const onStartTimerCancelled = (data: any) => {
            console.log("Start Timer Cancelled:", data);
            setCountdown(null);
        };

        const onInvalidData = (message: any) => {
            console.error("Ungültige Daten:", message);
            setError(message);
            setSubmitted(false);
        };

        const onGameError = (message: any) => {
            console.error("Spielfehler:", message);
            setError(message);
        };

        const onQueueFull = (message: any) => {
            console.error("Queue voll:", message);
            setError(message);
            setSubmitted(false);
        };

        const onNameTaken = (message: any) => {
            console.error("Name vergeben:", message);
            setError(message);
            setSubmitted(false);
        };

        const onGameStartError = (data: any) => {
            console.error("Game Start Error:", data);
            setError(data.message);
            setSubmitted(false);
            setIsReady(false);
            setCountdown(null);
        };

        // Register listeners
        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("queue-update", onQueueUpdate);
        socket.on("role-assigned", onRoleAssigned);
        socket.on("start-countdown", onStartCountdown);
        socket.on("start-timer-cancelled", onStartTimerCancelled);
        socket.on("invalid-data", onInvalidData);
        socket.on("game-error", onGameError);
        socket.on("queue-full", onQueueFull);
        socket.on("name-taken", onNameTaken);
        socket.on("game-start-error", onGameStartError);

        // Set initial connection state
        setIsConnected(socket.connected);

        // Cleanup
        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("queue-update", onQueueUpdate);
            socket.off("role-assigned", onRoleAssigned);
            socket.off("start-countdown", onStartCountdown);
            socket.off("start-timer-cancelled", onStartTimerCancelled);
            socket.off("invalid-data", onInvalidData);
            socket.off("game-error", onGameError);
            socket.off("queue-full", onQueueFull);
            socket.off("name-taken", onNameTaken);
            socket.off("game-start-error", onGameStartError);
        };
    }, [navigate, name]);

    const handleJoin = () => {
        if (!isConnected) {
            setError("Nicht mit dem Server verbunden. Versuche es erneut.");
            return;
        }

        if (name.trim().length >= 1 && name.trim().length <= 20) {
            setError(null);
            socket.emit("join-random", { name: name.trim(), id: socket.id });
            setSubmitted(true);
        } else {
            setError("Name muss zwischen 1 und 20 Zeichen lang sein");
        }
    };

    const handleReady = () => {
        socket.emit("queue-ready", { name: name.trim() });
    };

    const handleLeaveQueue = () => {
        socket.emit("leave-queue");
        setSubmitted(false);
        setQueueData({
            players: [],
            totalPlayers: 0,
            minPlayers: 3,
            maxPlayers: 11,
            canStart: false,
            isFull: false
        });
        setIsReady(false);
        setCountdown(null);
        setError(null);
    };

    const handleKeyPress = (e: any) => {
        if (e.key === 'Enter' && !submitted && isConnected) {
            handleJoin();
        }
    };

    const allReady = queueData.players.length > 0 && queueData.players.every((p: any) => p.ready);

    return (
        <Container
            style={{
                ...starBackground,
                minHeight: "100vh",
                minWidth: "100vw",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                margin: 0,
                padding: 0,
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
            }}
        >
            <Box display="flex" flexDirection="column" gap="20px" alignItems="center" maxWidth="500px" width="100%">
                {/* Connection Status */}
                {!isConnected && (
                    <Alert
                        severity="warning"
                        sx={{
                            width: "100%",
                            fontFamily: "'Super Larky', cursive",
                            "& .MuiAlert-message": {
                                fontFamily: "'Super Larky', cursive",
                            }
                        }}
                    >
                        Verbindung zum Server unterbrochen. Versuche neu zu verbinden...
                    </Alert>
                )}

                {/* Error Display */}
                {error && (
                    <Alert
                        severity="error"
                        onClose={() => setError(null)}
                        sx={{
                            width: "100%",
                            fontFamily: "'Super Larky', cursive",
                            "& .MuiAlert-message": {
                                fontFamily: "'Super Larky', cursive",
                            }
                        }}
                    >
                        {error}
                    </Alert>
                )}

                {/* Countdown Alert */}
                {countdown !== null && countdown > 0 && (
                    <Alert
                        severity="success"
                        sx={{
                            width: "100%",
                            fontFamily: "'Super Larky', cursive",
                            "& .MuiAlert-message": {
                                fontFamily: "'Super Larky', cursive",
                                fontSize: "1.2rem",
                                fontWeight: "bold"
                            }
                        }}
                    >
                        Spiel startet in {countdown} Sekunden...
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
                            onChange={(e: any) => setName(e.target.value)}
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
                                "& .MuiFormHelperText-root": {
                                    fontFamily: "'Super Larky', cursive",
                                }
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
                            {countdown === null && (
                                <CircularProgress
                                    size={60}
                                    sx={{
                                        color: "#3fc1c9",
                                        mb: 2
                                    }}
                                />
                            )}

                            <Typography
                                variant="h5"
                                align="center"
                                sx={{
                                    fontFamily: "'Super Larky', cursive",
                                    color: "#393E46",
                                    fontSize: "1.8rem",
                                }}
                            >
                                {countdown !== null ? "Spiel startet gleich!" : "Warte auf weitere Spieler"}
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
                                {queueData.totalPlayers}/{queueData.maxPlayers} Spieler
                            </Typography>

                            {/* Spieler Liste */}
                            {queueData.players.length > 0 && (
                                <Box
                                    display="flex"
                                    flexDirection="column"
                                    gap="8px"
                                    alignItems="center"
                                    sx={{
                                        backgroundColor: "rgba(255, 255, 255, 0.1)",
                                        padding: "15px",
                                        borderRadius: "10px",
                                        minWidth: "250px"
                                    }}
                                >
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            fontFamily: "'Super Larky', cursive",
                                            color: "#666",
                                            fontSize: "0.9rem",
                                            fontWeight: "bold"
                                        }}
                                    >
                                        Spieler in der Warteschlange:
                                    </Typography>
                                    {queueData.players.map((player: any, index: number) => (
                                        <Typography
                                            key={index}
                                            variant="body2"
                                            sx={{
                                                fontFamily: "'Super Larky', cursive",
                                                color: player.ready ? "#4caf50" : "#ff9800",
                                                fontSize: "1rem",
                                                fontWeight: player.name === name.trim() ? "bold" : "normal"
                                            }}
                                        >
                                            {player.name} {player.ready ? "✓" : "⏳"}
                                            {player.name === name.trim() && " (Du)"}
                                        </Typography>
                                    ))}
                                </Box>
                            )}

                            <Typography
                                variant="body1"
                                align="center"
                                sx={{
                                    fontFamily: "'Super Larky', cursive",
                                    color: "#666",
                                    fontSize: "1rem",
                                    maxWidth: "350px"
                                }}
                            >
                                {queueData.totalPlayers < queueData.minPlayers
                                    ? `Mindestens ${queueData.minPlayers} Spieler benötigt.`
                                    : allReady && countdown === null
                                        ? "Alle bereit! Spiel startet in Kürze..."
                                        : `${queueData.minPlayers}-${queueData.maxPlayers} Spieler können mitspielen. Drückt "Bereit" wenn ihr startklar seid!`
                                }
                            </Typography>

                            <Box display="flex" gap="15px" flexWrap="wrap" justifyContent="center">
                                {!isReady && countdown === null && (
                                    <Button
                                        variant="contained"
                                        onClick={handleReady}
                                        disabled={queueData.totalPlayers < queueData.minPlayers}
                                        sx={{
                                            fontFamily: "'Super Larky', cursive",
                                            fontSize: "1.1rem",
                                            padding: "10px 25px",
                                            backgroundColor: "#4caf50",
                                            "&:hover": {
                                                backgroundColor: "#45a049",
                                            },
                                            "&:disabled": {
                                                backgroundColor: "#cccccc",
                                            }
                                        }}
                                    >
                                        Bereit
                                    </Button>
                                )}

                                {isReady && countdown === null && (
                                    <Typography
                                        variant="body1"
                                        sx={{
                                            fontFamily: "'Super Larky', cursive",
                                            color: "#4caf50",
                                            fontSize: "1.2rem",
                                            fontWeight: "bold",
                                            padding: "10px 25px",
                                            backgroundColor: "rgba(76, 175, 80, 0.1)",
                                            borderRadius: "4px"
                                        }}
                                    >
                                        ✓ Bereit!
                                    </Typography>
                                )}

                                <Button
                                    variant="outlined"
                                    onClick={handleLeaveQueue}
                                    disabled={countdown !== null}
                                    sx={{
                                        fontFamily: "'Super Larky', cursive",
                                        fontSize: "1rem",
                                        padding: "8px 20px",
                                        borderColor: "#AA6DA3",
                                        color: "#AA6DA3",
                                        "&:hover": {
                                            borderColor: "#8a5089",
                                            backgroundColor: "rgba(170, 109, 163, 0.1)"
                                        },
                                        "&:disabled": {
                                            borderColor: "#cccccc",
                                            color: "#cccccc"
                                        }
                                    }}
                                >
                                    Warteschlange verlassen
                                </Button>
                            </Box>
                        </Box>
                    </>
                )}
            </Box>
        </Container>
    );
}

export default JoinRandom;