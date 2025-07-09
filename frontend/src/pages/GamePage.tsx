// GamePage.tsx - Komplette Version mit einfachem Polling

// @ts-ignore
import React, { useEffect, useState, useRef } from "react";
import { Typography, Container, Box, TextField, Button, CircularProgress, Card, CardContent, LinearProgress, Chip, Alert } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { starBackground } from "../styles/starBackground.ts";
import { io, Socket } from "socket.io-client";

interface GameState {
    phase: "GUESSING_PHASE" | "SUBMITTING_PHASE" | "FINISH_PHASE";
    round: number;
    solutionWord: string;
    showFullSolution?: boolean; // Neu: Zeigt an ob Extra-Feld angezeigt werden soll
    revealedLetters: number[];
    submissions: string[];
    isFinished: boolean;
    scores: { [playerName: string]: number };
    timeLeft: number;
    guessSubmitted: boolean;
    submittedPlayers: string[];
    playerRole: "GUESSER" | "SUPPORTER" | "SABOTEUR";
}

const GamePage = () => {
    const { state } = useLocation();
    const navigate = useNavigate();

    // State Management
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [inputValue, setInputValue] = useState("");
    const [timeLeft, setTimeLeft] = useState(0);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");

    const socketRef = useRef<Socket | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Redirect if no state
    useEffect(() => {
        if (!state?.gameId || !state?.name) {
            navigate("/");
            return;
        }
    }, [state, navigate]);

    // Socket.IO Setup
    useEffect(() => {
        if (!state?.gameId || !state?.name) return;

        socketRef.current = io("http://localhost:5000");
        const socket = socketRef.current;

        socket.on("connect", () => {
            console.log("Mit Server verbunden");
            setConnectionStatus("connected");
            setLoading(false);

            socket.emit("join-game", {
                gameId: state.gameId,
                playerName: state.name
            });
        });

        socket.on("disconnect", () => {
            console.log("Verbindung zum Server getrennt");
            setConnectionStatus("disconnected");
        });

        socket.on("game-state-update", (newGameState: GameState) => {
            console.log("🎮 Spielstand aktualisiert:", newGameState.phase, "Runde", newGameState.round);
            console.log("📝 Submissions erhalten:", newGameState.submissions);
            console.log("🔍 SolutionWord erhalten:", newGameState.solutionWord);
            console.log("🔍 RevealedLetters erhalten:", newGameState.revealedLetters);
            console.log("🔍 PlayerRole:", newGameState.playerRole);

            // TEST: Direkt hier die Striche berechnen
            if (newGameState.solutionWord && newGameState.revealedLetters) {
                const testMask = newGameState.solutionWord
                    .split('')
                    .map((letter, index) =>
                        newGameState.revealedLetters.includes(index) ? letter.toUpperCase() : '_'
                    )
                    .join(' ');
                console.log("🔍 Berechnete Striche:", testMask);
            }

            setGameState(newGameState);

            // hasSubmitted Status setzen
            if (newGameState.phase === "GUESSING_PHASE") {
                if (newGameState.playerRole === "GUESSER") {
                    setHasSubmitted(newGameState.guessSubmitted || false);
                } else {
                    setHasSubmitted(false);
                }
            } else if (newGameState.phase === "SUBMITTING_PHASE") {
                if (newGameState.playerRole === "GUESSER") {
                    setHasSubmitted(true);
                } else {
                    setHasSubmitted(newGameState.submittedPlayers?.includes(state.name) || false);
                }
            }

            // Timer starten
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            startTimer(newGameState.phase, newGameState.timeLeft);
        });

        socket.on("game-error", (errorMessage: string) => {
            console.error("Spielfehler:", errorMessage);
            setError(errorMessage);
        });

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            socket.disconnect();
        };
    }, [state?.gameId, state?.name, navigate]);

    // EINFACHES Polling für alle Updates
    useEffect(() => {
        if (!state?.gameId || !gameState) return;

        console.log("🔄 Starte einfaches Polling für alle Updates");

        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`http://localhost:5000/api/games/${state.gameId}/status`);
                if (response.ok) {
                    const serverState = await response.json();

                    console.log("📥 Polling Update erhalten:", {
                        phase: serverState.phase,
                        round: serverState.round,
                        submissionsCount: serverState.submissions?.length || 0,
                        submissions: serverState.submissions
                    });

                    // Prüfe Phasen-/Rundenwechsel (komplett neu laden)
                    if (gameState.phase !== serverState.phase) {
                        console.log(`🔄 PHASENWECHSEL: ${gameState.phase} → ${serverState.phase}`);
                        window.location.reload();
                        return;
                    }

                    if (gameState.round !== serverState.round) {
                        console.log(`🔄 RUNDENWECHSEL: ${gameState.round} → ${serverState.round}`);
                        window.location.reload();
                        return;
                    }

                    if (!gameState.isFinished && serverState.isFinished) {
                        console.log("🔄 SPIELENDE erkannt");
                        window.location.reload();
                        return;
                    }

                    // EINFACH: Aktualisiere ALLE Daten bei jeder Abfrage
                    setGameState(prevState => ({
                        ...prevState!,
                        solutionWord: serverState.solutionWord || prevState!.solutionWord, // WICHTIG: solutionWord auch updaten!
                        submissions: serverState.submissions || [],
                        submittedPlayers: serverState.submittedPlayers || [],
                        scores: serverState.scores || {},
                        revealedLetters: serverState.revealedLetters || prevState!.revealedLetters,
                        guessSubmitted: serverState.guessSubmitted || prevState!.guessSubmitted
                    }));

                    // hasSubmitted Status aktualisieren
                    if (gameState.phase === "SUBMITTING_PHASE" && gameState.playerRole !== "GUESSER") {
                        setHasSubmitted(serverState.submittedPlayers?.includes(state.name) || false);
                    }
                }
            } catch (error) {
                // @ts-ignore
                console.warn("⚠️ Polling-Fehler:", error.message);
            }
        }, 1500); // Jede 1,5 Sekunden

        return () => {
            console.log("🔄 Stoppe einfaches Polling");
            clearInterval(pollInterval);
        };
    }, [state?.gameId, state?.name, gameState?.phase, gameState?.round, gameState?.isFinished]);

    // Timer für Anzeige
    const startTimer = (phase: string, customDuration?: number) => {
        if (phase === "FINISH_PHASE") {
            setTimeLeft(0);
            return;
        }

        const duration = customDuration !== undefined ? customDuration :
            (phase === "GUESSING_PHASE" ? 60000 : 120000);
        setTimeLeft(duration);

        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1000) {
                    if (timerRef.current) {
                        clearInterval(timerRef.current);
                    }
                    return 0;
                }
                return prev - 1000;
            });
        }, 1000);
    };

    // Event Handlers
    const handleSubmit = () => {
        if (!gameState || !socketRef.current || !canSubmit()) return;

        if (gameState.phase === "GUESSING_PHASE" && gameState.playerRole === "GUESSER") {
            console.log("📤 Sende Guess:", inputValue);
            socketRef.current.emit("submit-guess", {
                gameId: state.gameId,
                guess: inputValue,
                playerName: state.name
            });
            setHasSubmitted(true);
        } else if (gameState.phase === "SUBMITTING_PHASE" && gameState.playerRole !== "GUESSER") {
            console.log("📤 Sende Word:", inputValue);
            socketRef.current.emit("submit-word", {
                gameId: state.gameId,
                word: inputValue,
                playerName: state.name
            });
            setHasSubmitted(true);
        }

        setInputValue("");
    };

    // Helper Functions
    const canSubmit = (): boolean => {
        if (!gameState || inputValue.trim() === "" || connectionStatus !== "connected") return false;

        if (gameState.phase === "GUESSING_PHASE" && gameState.playerRole === "GUESSER") {
            return !hasSubmitted;
        }

        if (gameState.phase === "SUBMITTING_PHASE" && gameState.playerRole !== "GUESSER") {
            return !hasSubmitted && timeLeft > 0;
        }

        return false;
    };

    const getMaskedWord = (): string => {
        if (!gameState?.solutionWord || typeof gameState.solutionWord !== 'string') {
            console.log("🔍 getMaskedWord: Kein solutionWord verfügbar:", gameState?.solutionWord);
            return "";
        }

        console.log("🔍 getMaskedWord Input:", {
            solutionWord: gameState.solutionWord,
            revealedLetters: gameState.revealedLetters
        });

        const result = gameState.solutionWord
            .split('')
            .map((letter, index) => {
                const isRevealed = gameState.revealedLetters?.includes(index);
                console.log(`🔍 Buchstabe ${index}: "${letter}" -> ${isRevealed ? 'AUFGEDECKT' : 'VERSTECKT'}`);
                return isRevealed ? letter.toUpperCase() : '_';
            })
            .join(' ');

        console.log("🔍 getMaskedWord Result:", result);
        return result;
    };

    const getRoleColor = (role: string) => {
        switch (role) {
            case "GUESSER": return "#4CAF50";
            case "SUPPORTER": return "#2196F3";
            case "SABOTEUR": return "#F44336";
            default: return "#757575";
        }
    };

    const getPhaseTitle = () => {
        switch (gameState?.phase) {
            case "GUESSING_PHASE": return "Ratephase";
            case "SUBMITTING_PHASE": return "Wörter einreichen";
            case "FINISH_PHASE": return "Spiel beendet";
            default: return "Lade...";
        }
    };

    const formatTime = (milliseconds: number): string => {
        const seconds = Math.ceil(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    // Container Style für konsistenten Sternenhintergrund
    const containerStyle = {
        ...starBackground,
        minHeight: "100vh",
        minWidth: "100vw",
        margin: 0,
        padding: 0,
        position: "fixed" as const,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: "auto",
    };

    // Render States
    if (loading) {
        return (
            <Box style={containerStyle}>
                <Container style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
                    <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                        <CircularProgress sx={{ color: "#3fc1c9" }} />
                        <Typography sx={{ fontFamily: "'Super Larky', cursive", color: "#393E46" }}>
                            Verbinde mit Server...
                        </Typography>
                    </Box>
                </Container>
            </Box>
        );
    }

    if (error) {
        return (
            <Box style={containerStyle}>
                <Container style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
                    <Alert
                        severity="error"
                        sx={{
                            fontFamily: "'Super Larky', cursive",
                            "& .MuiAlert-message": {
                                fontFamily: "'Super Larky', cursive",
                            }
                        }}
                    >
                        {error}
                    </Alert>
                </Container>
            </Box>
        );
    }

    if (!gameState) {
        return (
            <Box style={containerStyle}>
                <Container style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
                    <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                        <CircularProgress sx={{ color: "#3fc1c9" }} />
                        <Typography
                            variant="h6"
                            sx={{ fontFamily: "'Super Larky', cursive", color: "#393E46" }}
                        >
                            Lade Spielstatus...
                        </Typography>
                    </Box>
                </Container>
            </Box>
        );
    }

    // Submissions für Anzeige (einfach)
    const displaySubmissions = gameState?.submissions || [];

    // Hauptinhalt
    return (
        <Box style={containerStyle}>
            <Container maxWidth="md" style={{ minHeight: "100vh", paddingTop: "20px", paddingBottom: "20px" }}>
                <Box display="flex" flexDirection="column" gap="20px">
                    {/* Connection Status */}
                    {connectionStatus !== "connected" && (
                        <Alert
                            severity="warning"
                            sx={{
                                fontFamily: "'Super Larky', cursive",
                                "& .MuiAlert-message": {
                                    fontFamily: "'Super Larky', cursive",
                                }
                            }}
                        >
                            Verbindung zum Server unterbrochen. Versuche neu zu verbinden...
                        </Alert>
                    )}

                    {/* Header */}
                    <Card>
                        <CardContent>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                <Typography
                                    variant="h6"
                                    sx={{
                                        fontFamily: "'Super Larky', cursive",
                                        color: "#393E46"
                                    }}
                                >
                                    {getPhaseTitle()}
                                </Typography>
                                <Chip
                                    label={gameState.playerRole}
                                    sx={{
                                        backgroundColor: getRoleColor(gameState.playerRole || ""),
                                        color: "white",
                                        fontWeight: "bold",
                                        fontFamily: "'Super Larky', cursive"
                                    }}
                                />
                            </Box>

                            <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography
                                    variant="body2"
                                    sx={{ fontFamily: "'Super Larky', cursive" }}
                                >
                                    Runde {gameState.round}
                                </Typography>
                                <Typography
                                    variant="body2"
                                    color="primary"
                                    sx={{ fontFamily: "'Super Larky', cursive" }}
                                >
                                    {formatTime(timeLeft)}
                                </Typography>
                            </Box>

                            <LinearProgress
                                variant="determinate"
                                value={(timeLeft / (gameState.phase === "GUESSING_PHASE" ? 60000 : 120000)) * 100}
                                sx={{ mt: 1 }}
                            />
                        </CardContent>
                    </Card>

                    {/* Game Content */}
                    <Card>
                        <CardContent>
                            {gameState.phase === "FINISH_PHASE" ? (
                                <Box textAlign="center">
                                    <Typography
                                        variant="h5"
                                        color="success.main"
                                        gutterBottom
                                        sx={{ fontFamily: "'Super Larky', cursive" }}
                                    >
                                        Spiel beendet!
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        gutterBottom
                                        sx={{ fontFamily: "'Super Larky', cursive" }}
                                    >
                                        Das Lösungswort war: <strong>{gameState.solutionWord}</strong>
                                    </Typography>

                                    {gameState.scores && (
                                        <Box mt={3} mb={4}>
                                            <Typography
                                                variant="body2"
                                                gutterBottom
                                                sx={{ fontFamily: "'Super Larky', cursive" }}
                                            >
                                                Endpunkte:
                                            </Typography>
                                            <Box display="flex" flexDirection="column" gap={1}>
                                                {Object.entries(gameState.scores)
                                                    .sort(([,a], [,b]) => b - a)
                                                    .map(([player, score], index) => (
                                                        <Box
                                                            key={player}
                                                            sx={{
                                                                display: "flex",
                                                                justifyContent: "space-between",
                                                                alignItems: "center",
                                                                p: 2,
                                                                backgroundColor: player === state.name ? "#e8f5e8" : "#f5f5f5",
                                                                borderRadius: "8px",
                                                                border: player === state.name ? "2px solid #4CAF50" : "1px solid #ddd"
                                                            }}
                                                        >
                                                            <Typography
                                                                variant="caption"
                                                                fontWeight={player === state.name ? "bold" : "normal"}
                                                                sx={{ fontFamily: "'Super Larky', cursive" }}
                                                            >
                                                                {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🏅"} {player}
                                                                {player === state.name ? " (Du)" : ""}
                                                            </Typography>
                                                            <Typography
                                                                variant="body2"
                                                                fontWeight="bold"
                                                                color="primary"
                                                                sx={{ fontFamily: "'Super Larky', cursive" }}
                                                            >
                                                                {score} Punkte
                                                            </Typography>
                                                        </Box>
                                                    ))}
                                            </Box>
                                        </Box>
                                    )}

                                    <Button
                                        variant="contained"
                                        size="large"
                                        onClick={() => {
                                            socketRef.current?.disconnect();
                                            navigate("/");
                                        }}
                                        sx={{
                                            mt: 2,
                                            fontFamily: "'Super Larky', cursive",
                                            fontSize: "0.9rem",
                                            padding: "10px 20px",
                                            backgroundColor: "#AA6DA3",
                                            "&:hover": {
                                                backgroundColor: "#8a5089"
                                            }
                                        }}
                                    >
                                        Zurück zum Titelbildschirm
                                    </Button>
                                </Box>
                            ) : (
                                <>
                                    {/* Lösungswort anzeigen */}
                                    <Box textAlign="center" mb={3}>
                                        <Typography variant="h5" sx={{
                                            fontFamily: "monospace",
                                            letterSpacing: "0.5em",
                                            fontWeight: "bold"
                                        }}>
                                            {getMaskedWord()}
                                        </Typography>

                                        {/* NEUES EXTRA-FELD: Lösungswort für Unterstützer/Saboteure */}
                                        {(gameState.playerRole === "SUPPORTER" || gameState.playerRole === "SABOTEUR") && (
                                            <Box mt={2} p={2} sx={{
                                                backgroundColor: gameState.playerRole === "SUPPORTER" ? "#e8f5e8" : "#ffebee",
                                                borderRadius: "8px",
                                                border: gameState.playerRole === "SUPPORTER" ? "2px solid #4CAF50" : "2px solid #F44336",
                                                display: "inline-block"
                                            }}>
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    sx={{
                                                        display: "block",
                                                        mb: 1,
                                                        fontFamily: "'Super Larky', cursive"
                                                    }}
                                                >
                                                    {gameState.playerRole === "SUPPORTER" ? "Lösungswort (Hilf dem Ratenden!):" : "😈 Lösungswort (Verwirre den Ratenden!):"}
                                                </Typography>
                                                <Typography variant="body1" sx={{
                                                    fontFamily: "'Super Larky', cursive",
                                                    color: gameState.playerRole === "SUPPORTER" ? "#2e7d32" : "#c62828"
                                                }}>
                                                    "{gameState.solutionWord || 'Lade...'}"
                                                </Typography>
                                            </Box>
                                        )}
                                    </Box>

                                    {/* Hinweise-Bereich für alle Runden ab Runde 2 */}
                                    {gameState.round > 1 && (
                                        <Box mb={3} p={2} sx={{ backgroundColor: "#f0f8ff", borderRadius: "8px", border: "2px solid #2196F3" }}>
                                            <Typography
                                                variant="body1"
                                                gutterBottom
                                                sx={{
                                                    color: "#1976d2",
                                                    fontFamily: "'Super Larky', cursive"
                                                }}
                                            >
                                                Hinweise von anderen Spielern:
                                            </Typography>

                                            {displaySubmissions && displaySubmissions.length > 0 ? (
                                                <>
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                        mb={2}
                                                        sx={{ fontFamily: "'Super Larky', cursive" }}
                                                    >
                                                        Diese Wörter sollen dir helfen (oder verwirren) 😉
                                                    </Typography>
                                                    <Box display="flex" flexWrap="wrap" gap={2}>
                                                        {displaySubmissions.map((word, index) => (
                                                            <Chip
                                                                key={`${word}-${index}`}
                                                                label={word}
                                                                sx={{
                                                                    fontSize: "1rem",
                                                                    padding: "8px 12px",
                                                                    height: "auto",
                                                                    backgroundColor: "#e3f2fd",
                                                                    color: "#1565c0",
                                                                    fontFamily: "'Super Larky', cursive",
                                                                    "&:hover": {
                                                                        backgroundColor: "#bbdefb"
                                                                    }
                                                                }}
                                                            />
                                                        ))}
                                                    </Box>
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                        sx={{
                                                            mt: 1,
                                                            display: "block",
                                                            fontFamily: "'Super Larky', cursive"
                                                        }}
                                                    >
                                                        Tipp: Identische Wörter wurden automatisch entfernt
                                                    </Typography>
                                                </>
                                            ) : (
                                                <Typography
                                                    variant="body1"
                                                    color="text.secondary"
                                                    sx={{
                                                        fontStyle: "italic",
                                                        fontFamily: "'Super Larky', cursive"
                                                    }}
                                                >
                                                    Alle eingereichten Wörter waren doppelt und wurden entfernt!
                                                </Typography>
                                            )}
                                        </Box>
                                    )}

                                    {/* AKTUELLE RUNDE: Zeige Submissions auch in Runde 1 während SUBMITTING_PHASE */}
                                    {gameState.phase === "SUBMITTING_PHASE" && displaySubmissions.length > 0 && (
                                        <Box mb={3} p={2} sx={{ backgroundColor: "#f9f9f9", borderRadius: "8px", border: "2px solid #9E9E9E" }}>
                                            <Typography
                                                variant="body1"
                                                gutterBottom
                                                sx={{
                                                    color: "#424242",
                                                    fontFamily: "'Super Larky', cursive"
                                                }}
                                            >
                                                Aktuelle Eingaben (Runde {gameState.round}):
                                            </Typography>
                                            <Box display="flex" flexWrap="wrap" gap={2}>
                                                {displaySubmissions.map((word, index) => (
                                                    <Chip
                                                        key={`current-${word}-${index}`}
                                                        label={word}
                                                        sx={{
                                                            fontSize: "1rem",
                                                            padding: "6px 10px",
                                                            height: "auto",
                                                            backgroundColor: "#e0e0e0",
                                                            color: "#424242",
                                                            fontFamily: "'Super Larky', cursive"
                                                        }}
                                                    />
                                                ))}
                                            </Box>
                                        </Box>
                                    )}

                                    {/* GUESSING_PHASE */}
                                    {gameState.phase === "GUESSING_PHASE" && (
                                        <Box>
                                            {gameState.playerRole === "GUESSER" ? (
                                                <Box>
                                                    <Typography
                                                        variant="h6"
                                                        gutterBottom
                                                        sx={{ fontFamily: "'Super Larky', cursive" }}
                                                    >
                                                        Du bist am Zug! Rate das Wort:
                                                    </Typography>
                                                    {!hasSubmitted ? (
                                                        <Box display="flex" gap={2}>
                                                            <TextField
                                                                fullWidth
                                                                variant="outlined"
                                                                placeholder="Gib dein Lösungswort ein..."
                                                                value={inputValue}
                                                                onChange={(e) => setInputValue(e.target.value)}
                                                                onKeyPress={(e) => e.key === 'Enter' && canSubmit() && handleSubmit()}
                                                                disabled={connectionStatus !== "connected"}
                                                                sx={{
                                                                    "& .MuiInputBase-input": {
                                                                        fontFamily: "'Super Larky', cursive",
                                                                    },
                                                                    "& .MuiInputLabel-root": {
                                                                        fontFamily: "'Super Larky', cursive",
                                                                    }
                                                                }}
                                                            />
                                                            <Button
                                                                variant="contained"
                                                                onClick={handleSubmit}
                                                                disabled={!canSubmit()}
                                                                sx={{
                                                                    minWidth: "120px",
                                                                    fontFamily: "'Super Larky', cursive",
                                                                    backgroundColor: "#3fc1c9",
                                                                    "&:hover": {
                                                                        backgroundColor: "#33a1a8",
                                                                    }
                                                                }}
                                                            >
                                                                Raten
                                                            </Button>
                                                        </Box>
                                                    ) : (
                                                        <Alert
                                                            severity="info"
                                                            sx={{
                                                                fontFamily: "'Super Larky', cursive",
                                                                "& .MuiAlert-message": {
                                                                    fontFamily: "'Super Larky', cursive",
                                                                }
                                                            }}
                                                        >
                                                            Antwort eingereicht! Warte auf das Ergebnis...
                                                        </Alert>
                                                    )}
                                                </Box>
                                            ) : (
                                                <Alert
                                                    severity="info"
                                                    sx={{
                                                        fontFamily: "'Super Larky', cursive",
                                                        "& .MuiAlert-message": {
                                                            fontFamily: "'Super Larky', cursive",
                                                        }
                                                    }}
                                                >
                                                    Der Ratende überlegt... Warte ab!
                                                </Alert>
                                            )}
                                        </Box>
                                    )}

                                    {/* SUBMITTING_PHASE */}
                                    {gameState.phase === "SUBMITTING_PHASE" && (
                                        <Box>
                                            {gameState.playerRole !== "GUESSER" ? (
                                                <Box>
                                                    <Typography
                                                        variant="body2"
                                                        gutterBottom
                                                        sx={{ fontFamily: "'Super Larky', cursive" }}
                                                    >
                                                        {gameState.playerRole === "SUPPORTER"
                                                            ? "Hilf dem Ratenden mit einem Hinweis:"
                                                            : "Verwirre den Ratenden mit einem falschen Wort:"
                                                        }
                                                    </Typography>

                                                    {!hasSubmitted ? (
                                                        <Box display="flex" gap={2}>
                                                            <TextField
                                                                fullWidth
                                                                variant="outlined"
                                                                placeholder={gameState.playerRole === "SUPPORTER" ?
                                                                    "Gib einen hilfreichen Hinweis..." :
                                                                    "Gib einen verwirrenden Hinweis..."}
                                                                value={inputValue}
                                                                onChange={(e) => setInputValue(e.target.value)}
                                                                onKeyPress={(e) => e.key === 'Enter' && canSubmit() && handleSubmit()}
                                                                disabled={connectionStatus !== "connected"}
                                                                sx={{
                                                                    "& .MuiInputBase-input": {
                                                                        fontFamily: "'Super Larky', cursive",
                                                                    },
                                                                    "& .MuiInputLabel-root": {
                                                                        fontFamily: "'Super Larky', cursive",
                                                                    }
                                                                }}
                                                            />
                                                            <Button
                                                                variant="contained"
                                                                onClick={handleSubmit}
                                                                disabled={!canSubmit()}
                                                                sx={{
                                                                    minWidth: "120px",
                                                                    fontFamily: "'Super Larky', cursive",
                                                                    backgroundColor: "#3fc1c9",
                                                                    "&:hover": {
                                                                        backgroundColor: "#33a1a8",
                                                                    }
                                                                }}
                                                            >
                                                                Senden
                                                            </Button>
                                                        </Box>
                                                    ) : (
                                                        <Alert
                                                            severity="success"
                                                            sx={{
                                                                fontFamily: "'Super Larky', cursive",
                                                                "& .MuiAlert-message": {
                                                                    fontFamily: "'Super Larky', cursive",
                                                                }
                                                            }}
                                                        >
                                                            Wort eingereicht! Warte auf andere Spieler...
                                                        </Alert>
                                                    )}
                                                </Box>
                                            ) : (
                                                <Alert
                                                    severity="info"
                                                    sx={{
                                                        fontFamily: "'Super Larky', cursive",
                                                        "& .MuiAlert-message": {
                                                            fontFamily: "'Super Larky', cursive",
                                                        }
                                                    }}
                                                >
                                                    Andere Spieler reichen Wörter ein... Warte ab!
                                                </Alert>
                                            )}
                                        </Box>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Game Info */}
                    <Card>
                        <CardContent>
                            <Typography
                                gutterBottom
                                sx={{ fontSize: "0.6rem", fontFamily: "'Super Larky', cursive" }}
                            >
                                Spielstatus
                            </Typography>
                            <Typography
                                color="text.secondary"
                                sx={{ fontSize: "0.6rem", fontFamily: "'Super Larky', cursive" }}
                            >
                                Spiel-ID: {state.gameId}
                            </Typography>
                            <Typography
                                color="text.secondary"
                                sx={{ fontSize: "0.6rem", fontFamily: "'Super Larky', cursive" }}
                            >
                                Spieler: {state.name}
                            </Typography>
                            <Typography
                                color="text.secondary"
                                sx={{ fontSize: "0.6rem", fontFamily: "'Super Larky', cursive" }}
                            >
                                Verbindung: {connectionStatus === "connected" ? "Verbunden" : "Getrennt"}
                            </Typography>
                            {gameState.submittedPlayers && gameState.submittedPlayers.length > 0 && (
                                <Typography
                                    color="text.secondary"
                                    sx={{ fontSize: "0.5rem", fontFamily: "'Super Larky', cursive" }}
                                >
                                    Abgegeben: {gameState.submittedPlayers.length} Spieler
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                </Box>
            </Container>
        </Box>
    );
};

export default GamePage;