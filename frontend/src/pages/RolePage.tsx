// RolePage.tsx - Saubere Version mit "Bereit" Button System

import { useEffect, useState } from "react";
import { Typography, Container, Box, CircularProgress, Button } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { starBackground } from "../styles/starBackground.ts";
import socket from "../socket.ts";

const RolePage = () => {
    const { state } = useLocation();
    const navigate = useNavigate();

    // State Management
    const [role, setRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [gameStarted, setGameStarted] = useState(false);
    const [countdown, setCountdown] = useState(3);
    const [isReady, setIsReady] = useState(false);
    const [readyPlayers, setReadyPlayers] = useState<string[]>([]);
    const [totalPlayers, setTotalPlayers] = useState(3);

    // Initialisierung und Socket Setup
    useEffect(() => {
        // Validiere State-Daten
        if (!state?.role || !state?.gameId || !state?.name) {
            setError("Keine Spieldaten gefunden. Bitte starte ein neues Spiel.");
            setLoading(false);
            return;
        }

        // Setze Rolle und beende Loading
        setRole(state.role);
        setLoading(false);

        console.log("RolePage geladen:", {
            role: state.role,
            gameId: state.gameId,
            name: state.name
        });

        // Socket Event Handlers
        const handleGameStateUpdate = (gameState: any) => {
            console.log("Game State Update erhalten:", gameState);
            if (gameState?.phase) {
                setGameStarted(true);
            }
        };

        const handleGameError = (errorMessage: string) => {
            console.error("Spielfehler:", errorMessage);
            // Ignoriere "noch nicht gestartet" Fehler (sind normal für RolePage)
            if (!errorMessage.includes("noch nicht gestartet")) {
                setError(errorMessage);
            }
        };

        const handleReadyUpdate = (data: { readyPlayers: string[], totalPlayers: number, allReady: boolean }) => {
            console.log("Ready Status Update:", data);
            setReadyPlayers(data.readyPlayers);
            setTotalPlayers(data.totalPlayers);

            if (data.allReady) {
                setGameStarted(true);
            }
        };

        // Event Listener registrieren
        socket.on("game-state-update", handleGameStateUpdate);
        socket.on("game-error", handleGameError);
        socket.on("ready-status-update", handleReadyUpdate);

        // Socket-Room beitreten (NICHT das Spiel starten!)
        const joinTimer = setTimeout(() => {
            console.log("Trete Socket-Room bei:", { gameId: state.gameId, playerName: state.name });
            socket.emit("join-room", {
                gameId: state.gameId,
                playerName: state.name
            });
        }, 1000);

        // Cleanup
        return () => {
            clearTimeout(joinTimer);
            socket.off("game-state-update", handleGameStateUpdate);
            socket.off("game-error", handleGameError);
            socket.off("ready-status-update", handleReadyUpdate);
        };
    }, [state]);

    // Countdown Timer für Spielstart
    useEffect(() => {
        if (!gameStarted || countdown <= 0) return;

        const timer = setTimeout(() => {
            setCountdown(countdown - 1);
        }, 1000);

        return () => clearTimeout(timer);
    }, [gameStarted, countdown]);

    // Navigation zur GamePage
    useEffect(() => {
        if (gameStarted && countdown === 0) {
            navigate("/game", {
                state: {
                    gameId: state.gameId,
                    name: state.name,
                    role: state.role
                }
            });
        }
    }, [gameStarted, countdown, navigate, state]);

    // Event Handlers
    const handleReady = () => {
        if (isReady || !state?.gameId || !state?.name) return;

        console.log("Spieler ist bereit");
        setIsReady(true);
        socket.emit("player-ready", {
            gameId: state.gameId,
            playerName: state.name
        });
    };

    const handleStartGameManually = () => {
        navigate("/game", {
            state: {
                gameId: state.gameId,
                name: state.name,
                role: state.role
            }
        });
    };

    const handleBackToHome = () => {
        socket.disconnect();
        socket.connect();
        navigate("/");
    };

    // Helper Functions
    const getRoleDescription = (role: string): string => {
        switch (role) {
            case "GUESSER":
                return "Du bist der Ratender! Ein deutsches Substantiv wartet auf dich – ohne Umlaute und Sonderzeichen. Kannst du die richtigen Tipps erkennen oder führt man dich hinters Licht?";
            case "SUPPORTER":
                return "Gib clevere Hinweise, damit der Ratende das Wort knackt! Aber Vorsicht: Wenn du das gleiche Wort wie ein anderer nennst, fliegt es raus. Und die Saboteure? Die spielen auch mit ...";
            case "SABOTEUR":
                return "Täusche den Ratenden mit falschen Tipps! Und wenn du das gleiche Wort wie ein Supporter nennst, wird’s gestrichen – perfekt für Verwirrung!";
            default:
                return "";
        }
    };

    const getRoleDisplayName = (role: string): string => {
        switch (role) {
            case "GUESSER": return "Ratender";
            case "SUPPORTER": return "Unterstützer";
            case "SABOTEUR": return "Saboteur";
            default: return role;
        }
    };

    const getRoleColor = (role: string): string => {
        switch (role) {
            case "GUESSER": return "#4CAF50";
            case "SUPPORTER": return "#2196F3";
            case "SABOTEUR": return "#F44336";
            default: return "#757575";
        }
    };

    // Container Style für konsistenten Sternenhintergrund
    const containerStyle = {
        ...starBackground,
        minHeight: "100vh",
        minWidth: "100vw",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        margin: 0,
        padding: 0,
        position: "fixed" as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    };

    // Render Loading State
    if (loading) {
        return (
            <Container style={containerStyle}>
                <CircularProgress sx={{ color: "#3fc1c9" }} />
            </Container>
        );
    }

    // Render Error State
    if (error) {
        return (
            <Container style={containerStyle}>
                <Box display="flex" flexDirection="column" alignItems="center" gap={3}>
                    <Typography
                        variant="h6"
                        color="error"
                        align="center"
                        sx={{ fontFamily: "'Super Larky', cursive" }}
                    >
                        {error}
                    </Typography>
                    <Button
                        variant="contained"
                        onClick={handleBackToHome}
                        sx={{
                            fontFamily: "'Super Larky', cursive",
                            fontSize: "1.2rem",
                            backgroundColor: "#3fc1c9",
                            "&:hover": {
                                backgroundColor: "#33a1a8",
                            },
                        }}
                    >
                        Zurück zur Startseite
                    </Button>
                </Box>
            </Container>
        );
    }

    // Render Game Starting State
    if (gameStarted) {
        return (
            <Container style={containerStyle}>
                <Box display="flex" flexDirection="column" alignItems="center" gap="20px">
                    <Typography
                        variant="h4"
                        align="center"
                        sx={{
                            fontFamily: "'Super Larky', cursive",
                            color: "#393E46",
                            fontSize: "2rem",
                        }}
                    >
                        🎮 Spiel startet!
                    </Typography>

                    <Typography
                        variant="h6"
                        color="primary"
                        sx={{ fontFamily: "'Super Larky', cursive" }}
                    >
                        Weiterleitung in {countdown} Sekunden...
                    </Typography>

                    <CircularProgress sx={{ color: "#3fc1c9" }} />

                    <Button
                        variant="contained"
                        onClick={handleStartGameManually}
                        size="large"
                        sx={{
                            mt: 2,
                            fontFamily: "'Super Larky', cursive",
                            fontSize: "1.2rem",
                            backgroundColor: "#3fc1c9",
                            "&:hover": {
                                backgroundColor: "#33a1a8",
                            },
                        }}
                    >
                        Jetzt beitreten
                    </Button>
                </Box>
            </Container>
        );
    }

    // Render Main Role Display
    return (
        <Container style={containerStyle}>
            <Box display="flex" flexDirection="column" alignItems="center" gap="30px" textAlign="center">
                {/* Titel */}
                <Typography
                    variant="h4"
                    align="center"
                    sx={{
                        fontFamily: "'Super Larky', cursive",
                        color: "#393E46",
                        fontSize: "2rem",
                    }}
                >
                    Deine Rolle
                </Typography>

                {/* Rollen-Badge */}
                <Box
                    sx={{
                        backgroundColor: getRoleColor(role || ""),
                        color: "white",
                        padding: "20px 40px",
                        borderRadius: "12px",
                        minWidth: "200px",
                    }}
                >
                    <Typography
                        variant="h3"
                        sx={{
                            fontFamily: "'Super Larky', cursive",
                            fontWeight: "bold",
                            fontSize: "2.5rem",
                        }}
                    >
                        {getRoleDisplayName(role || "")}
                    </Typography>
                </Box>

                {/* Rollenbeschreibung */}
                {role && (
                    <Box
                        sx={{
                            backgroundColor: "rgba(245, 245, 245, 0.9)",
                            padding: "20px",
                            borderRadius: "8px",
                            maxWidth: "500px",
                            backdropFilter: "blur(5px)",
                        }}
                    >
                        <Typography
                            variant="h6"
                            gutterBottom
                            sx={{ fontFamily: "'Super Larky', cursive" }}
                        >
                            Deine Aufgabe:
                        </Typography>
                        <Typography
                            variant="body1"
                            sx={{ fontFamily: "'Super Larky', cursive" }}
                        >
                            {getRoleDescription(role)}
                        </Typography>
                    </Box>
                )}

                {/* Ready Status */}
                <Box textAlign="center">
                    <Typography
                        variant="h6"
                        color="text.secondary"
                        gutterBottom
                        sx={{
                            fontFamily: "'Super Larky', cursive",
                            color: "#393E46"
                        }}
                    >
                        {readyPlayers.length === totalPlayers ?
                            "🎯 Alle Spieler sind bereit!" :
                            "⏳ Warte auf andere Spieler..."
                        }
                    </Typography>

                    <Typography
                        variant="body1"
                        color="text.secondary"
                        sx={{
                            mb: 2,
                            fontFamily: "'Super Larky', cursive",
                            color: "#666"
                        }}
                    >
                        Bereite Spieler: {readyPlayers.length}/{totalPlayers}
                    </Typography>

                    {/* Liste der bereiten Spieler */}
                    {readyPlayers.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                    fontFamily: "'Super Larky', cursive",
                                    color: "#666"
                                }}
                            >
                                Bereit: {readyPlayers.join(", ")}
                            </Typography>
                        </Box>
                    )}
                </Box>

                {/* Action Buttons */}
                <Box display="flex" gap={2} flexWrap="wrap" justifyContent="center">
                    <Button
                        variant="contained"
                        onClick={handleReady}
                        disabled={isReady}
                        size="large"
                        sx={{
                            fontFamily: "'Super Larky', cursive",
                            fontSize: "1.3rem",
                            padding: "15px 30px",
                            backgroundColor: isReady ? "#4CAF50" : "#3fc1c9",
                            "&:hover": {
                                backgroundColor: isReady ? "#4CAF50" : "#33a1a8",
                            },
                            "&:disabled": {
                                backgroundColor: "#4CAF50",
                                color: "white"
                            }
                        }}
                    >
                        {isReady ? "✓ Bereit!" : "Bereit"}
                    </Button>

                    <Button
                        variant="outlined"
                        onClick={handleBackToHome}
                        sx={{
                            fontFamily: "'Super Larky', cursive",
                            fontSize: "1rem",
                            padding: "15px 20px",
                            borderColor: "#AA6DA3",
                            color: "#AA6DA3",
                            "&:hover": {
                                borderColor: "#8a5089",
                                backgroundColor: "rgba(170, 109, 163, 0.1)"
                            }
                        }}
                    >
                        Zurück zur Startseite
                    </Button>
                </Box>

                {/* Spiel-Info */}
                <Box sx={{ mt: 2 }}>
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                            fontFamily: "'Super Larky', cursive",
                            color: "#666"
                        }}
                    >
                        Spiel-ID: {state?.gameId} | Spieler: {state?.name}
                    </Typography>
                </Box>
            </Box>
        </Container>
    );
};

export default RolePage;