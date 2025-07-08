// GamePage.tsx - Saubere Version mit Echtzeit-Submissions Polling

import React, { useEffect, useState, useRef } from "react";
import { Typography, Container, Box, TextField, Button, CircularProgress, Card, CardContent, LinearProgress, Chip, Alert } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";

interface GameState {
    phase: "GUESSING_PHASE" | "SUBMITTING_PHASE" | "FINISH_PHASE";
    round: number;
    solutionWord: string;
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

    // VERBESSERTES Polling für Echtzeit-Updates
    useEffect(() => {
        if (!state?.gameId || !gameState) return;

        console.log("🔄 Starte erweiterte Polling für Live-Updates");

        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`http://localhost:5000/api/games/${state.gameId}/status`);
                if (response.ok) {
                    const serverState = await response.json();

                    // Prüfe Phasen-/Rundenwechsel (wie vorher)
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

                    // NEU: Echtzeit-Updates für Submissions und submittedPlayers
                    const submissionsChanged = JSON.stringify(gameState.submissions || []) !== JSON.stringify(serverState.submissions || []);
                    const submittedPlayersChanged = JSON.stringify(gameState.submittedPlayers || []) !== JSON.stringify(serverState.submittedPlayers || []);
                    const scoresChanged = JSON.stringify(gameState.scores || {}) !== JSON.stringify(serverState.scores || {});

                    if (submissionsChanged || submittedPlayersChanged || scoresChanged) {
                        console.log("📝 LIVE-UPDATE erkannt:");
                        if (submissionsChanged) {
                            console.log("   → Submissions:", gameState.submissions?.length || 0, "→", serverState.submissions?.length || 0);
                            console.log("   → Neue Submissions:", serverState.submissions);
                        }
                        if (submittedPlayersChanged) {
                            console.log("   → SubmittedPlayers:", gameState.submittedPlayers?.length || 0, "→", serverState.submittedPlayers?.length || 0);
                        }
                        if (scoresChanged) {
                            console.log("   → Scores aktualisiert");
                        }

                        // State direkt aktualisieren (ohne Reload)
                        setGameState(prevState => ({
                            ...prevState!,
                            submissions: serverState.submissions || [],
                            submittedPlayers: serverState.submittedPlayers || [],
                            scores: serverState.scores || {},
                            // Auch andere potentielle Updates
                            revealedLetters: serverState.revealedLetters || prevState!.revealedLetters,
                            guessSubmitted: serverState.guessSubmitted || prevState!.guessSubmitted
                        }));

                        // hasSubmitted Status bei submittedPlayers-Änderung aktualisieren
                        if (submittedPlayersChanged && gameState.phase === "SUBMITTING_PHASE" && gameState.playerRole !== "GUESSER") {
                            setHasSubmitted(serverState.submittedPlayers?.includes(state.name) || false);
                        }
                    }
                }
            } catch (error) {
                console.warn("⚠️ Polling-Fehler:", error.message);
            }
        }, 1500); // Etwas langsameres Polling für weniger Server-Last

        return () => {
            console.log("🔄 Stoppe erweiterte Polling");
            clearInterval(pollInterval);
        };
    }, [state?.gameId, state?.name, gameState?.phase, gameState?.round, gameState?.isFinished, gameState?.submissions, gameState?.submittedPlayers, gameState?.scores]);

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
            return "";
        }

        return gameState.solutionWord
            .split('')
            .map((letter, index) =>
                gameState.revealedLetters?.includes(index) ? letter.toUpperCase() : '_'
            )
            .join(' ');
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

    // Render States
    if (loading) {
        return (
            <Container style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
                <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                    <CircularProgress />
                    <Typography>Verbinde mit Server...</Typography>
                </Box>
            </Container>
        );
    }

    if (error) {
        return (
            <Container style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
                <Alert severity="error">{error}</Alert>
            </Container>
        );
    }

    if (!gameState) {
        return (
            <Container style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
                <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                    <CircularProgress />
                    <Typography variant="h6">Lade Spielstatus...</Typography>
                </Box>
            </Container>
        );
    }

    // Hauptinhalt
    return (
        <Container maxWidth="md" style={{ minHeight: "100vh", paddingTop: "20px" }}>
            <Box display="flex" flexDirection="column" gap="20px">
                {/* Connection Status */}
                {connectionStatus !== "connected" && (
                    <Alert severity="warning">
                        Verbindung zum Server unterbrochen. Versuche neu zu verbinden...
                    </Alert>
                )}

                {/* Header */}
                <Card>
                    <CardContent>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                            <Typography variant="h4" sx={{ fontFamily: "'Super Larky', cursive" }}>
                                {getPhaseTitle()}
                            </Typography>
                            <Chip
                                label={gameState.playerRole}
                                sx={{
                                    backgroundColor: getRoleColor(gameState.playerRole || ""),
                                    color: "white",
                                    fontWeight: "bold"
                                }}
                            />
                        </Box>

                        <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography variant="h6">Runde {gameState.round}</Typography>
                            <Typography variant="h6" color="primary">
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
                                <Typography variant="h5" color="success.main" gutterBottom>
                                    🎉 Spiel beendet! 🎉
                                </Typography>
                                <Typography variant="h6" gutterBottom>
                                    Das Lösungswort war: <strong>{gameState.solutionWord}</strong>
                                </Typography>

                                {gameState.scores && (
                                    <Box mt={3} mb={4}>
                                        <Typography variant="h6" gutterBottom>🏆 Endpunkte:</Typography>
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
                                                        <Typography variant="body1" fontWeight={player === state.name ? "bold" : "normal"}>
                                                            {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🏅"} {player}
                                                            {player === state.name ? " (Du)" : ""}
                                                        </Typography>
                                                        <Typography variant="h6" fontWeight="bold" color="primary">
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
                                        fontSize: "1.2rem",
                                        padding: "15px 30px",
                                        backgroundColor: "#AA6DA3",
                                        "&:hover": {
                                            backgroundColor: "#8a5089"
                                        }
                                    }}
                                >
                                    🏠 Zurück zum Titelbildschirm
                                </Button>
                            </Box>
                        ) : (
                            <>
                                {/* Lösungswort anzeigen */}
                                <Box textAlign="center" mb={3}>
                                    <Typography variant="h3" sx={{
                                        fontFamily: "monospace",
                                        letterSpacing: "0.5em",
                                        fontWeight: "bold"
                                    }}>
                                        {getMaskedWord()}
                                    </Typography>
                                </Box>

                                {/* VERBESSERTER Hinweise-Bereich - zeigt Live-Updates */}
                                {gameState.round > 1 && (
                                    <Box mb={3} p={2} sx={{ backgroundColor: "#f0f8ff", borderRadius: "8px", border: "2px solid #2196F3" }}>
                                        <Typography variant="h5" gutterBottom sx={{ color: "#1976d2", fontWeight: "bold" }}>
                                            💡 Hinweise von anderen Spielern:
                                        </Typography>

                                        {gameState.submissions && gameState.submissions.length > 0 ? (
                                            <>
                                                <Typography variant="body2" color="text.secondary" mb={2}>
                                                    Diese Wörter sollen dir helfen (oder verwirren) 😉
                                                </Typography>
                                                <Box display="flex" flexWrap="wrap" gap={2}>
                                                    {gameState.submissions.map((word, index) => (
                                                        <Chip
                                                            key={`${word}-${index}`} // Besserer Key für Live-Updates
                                                            label={word}
                                                            sx={{
                                                                fontSize: "1.2rem",
                                                                padding: "8px 12px",
                                                                height: "auto",
                                                                backgroundColor: "#e3f2fd",
                                                                color: "#1565c0",
                                                                fontWeight: "bold",
                                                                "&:hover": {
                                                                    backgroundColor: "#bbdefb"
                                                                }
                                                            }}
                                                        />
                                                    ))}
                                                </Box>
                                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                                                    💡 Tipp: Identische Wörter wurden automatisch entfernt
                                                </Typography>
                                            </>
                                        ) : (
                                            <Typography variant="body1" color="text.secondary" sx={{ fontStyle: "italic" }}>
                                                🤷‍♂️ Alle eingereichten Wörter waren doppelt und wurden entfernt!
                                            </Typography>
                                        )}
                                    </Box>
                                )}

                                {/* GUESSING_PHASE */}
                                {gameState.phase === "GUESSING_PHASE" && (
                                    <Box>
                                        {gameState.playerRole === "GUESSER" ? (
                                            <Box>
                                                <Typography variant="h6" gutterBottom>
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
                                                        />
                                                        <Button
                                                            variant="contained"
                                                            onClick={handleSubmit}
                                                            disabled={!canSubmit()}
                                                            sx={{ minWidth: "120px" }}
                                                        >
                                                            Raten
                                                        </Button>
                                                    </Box>
                                                ) : (
                                                    <Alert severity="info">
                                                        Antwort eingereicht! Warte auf das Ergebnis...
                                                    </Alert>
                                                )}
                                            </Box>
                                        ) : (
                                            <Alert severity="info">
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
                                                <Typography variant="h6" gutterBottom>
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
                                                        />
                                                        <Button
                                                            variant="contained"
                                                            onClick={handleSubmit}
                                                            disabled={!canSubmit()}
                                                            sx={{ minWidth: "120px" }}
                                                        >
                                                            Senden
                                                        </Button>
                                                    </Box>
                                                ) : (
                                                    <Alert severity="success">
                                                        Wort eingereicht! Warte auf andere Spieler...
                                                    </Alert>
                                                )}
                                            </Box>
                                        ) : (
                                            <Alert severity="info">
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
                        <Typography variant="h6" gutterBottom>Spielstatus</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Spiel-ID: {state.gameId}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Spieler: {state.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Verbindung: {connectionStatus === "connected" ? "Verbunden" : "Getrennt"}
                        </Typography>
                        {gameState.submittedPlayers && gameState.submittedPlayers.length > 0 && (
                            <Typography variant="body2" color="text.secondary">
                                Abgegeben: {gameState.submittedPlayers.length} Spieler
                            </Typography>
                        )}
                        {/* Debug Info für Entwicklung */}
                        {process.env.NODE_ENV === 'development' && (
                            <>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                    DEBUG - Submissions: {JSON.stringify(gameState.submissions)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                    DEBUG - SubmittedPlayers: {JSON.stringify(gameState.submittedPlayers)}
                                </Typography>
                            </>
                        )}
                    </CardContent>
                </Card>
            </Box>
        </Container>
    );
};

export default GamePage;