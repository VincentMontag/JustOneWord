import { useState } from "react";
import { Button, Typography, Container, Box, Dialog, DialogContent, DialogTitle, IconButton, Divider } from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
// @ts-ignore
import { triangleBackground } from "../styles/triangleBackground.ts"
import { starBackground } from "../styles/starBackground.ts";

const Colors = {
    buttonColor: "#3fc1c9",
    randomGameButton: "#AA6DA3",
    privateGameButton: "#33658a",
    gamePerIdButton: "#f68e5f",
    text: "#393E46",
};

function Home() {
    const [howToPlayOpen, setHowToPlayOpen] = useState(false);

    const handleOpenHowToPlay = () => {
        setHowToPlayOpen(true);
    };

    const handleCloseHowToPlay = () => {
        setHowToPlayOpen(false);
    };

    return (
        <Container
            style={{
                ...starBackground,
                minHeight: "100vh",
                paddingTop: "50px",
                minWidth: "100%",
            }}
        >
            <Typography
                variant="h1"
                align="center"
                sx={{
                    margin: "20px",
                    color: Colors.text,
                    fontFamily: "'Super Larky', cursive",
                    fontWeight: 600,
                }}
            >
                Just One Word
            </Typography>
            <Box display="flex" flexDirection="column" alignItems="center" gap="20px">
                <Button
                    variant="contained"
                    href="/create-game"
                    sx={{
                        backgroundColor: Colors.randomGameButton,
                        color: "#EEEEEE",
                        padding: "20px 40px",
                        borderRadius: "8px",
                        textTransform: "none",
                        fontFamily: "'Super Larky', cursive",
                        fontWeight: "normal",
                        fontSize: "30px",
                        boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                        "&:hover": {
                            backgroundColor: "#8a5089",
                        },
                    }}
                >
                    Spiel erstellen
                </Button>
                <Button
                    variant="contained"
                    href="/random-game"
                    sx={{
                        backgroundColor: Colors.privateGameButton,
                        color: "#EEEEEE",
                        padding: "20px 40px",
                        borderRadius: "8px",
                        textTransform: "none",
                        fontFamily: "'Super Larky', cursive",
                        fontWeight: "normal",
                        fontSize: "30px",
                        boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                        "&:hover": {
                            backgroundColor: "#254e6a",
                        },
                    }}
                >
                    Zufälligem Spiel beitreten
                </Button>
                <Button
                    variant="contained"
                    href="/join-game"
                    sx={{
                        backgroundColor: Colors.gamePerIdButton,
                        color: "#EEEEEE",
                        padding: "20px 40px",
                        borderRadius: "8px",
                        textTransform: "none",
                        fontFamily: "'Super Larky', cursive",
                        fontWeight: "normal",
                        fontSize: "30px",
                        boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                        "&:hover": {
                            backgroundColor: "#d87345",
                        },
                    }}
                >
                    Spiel per ID beitreten
                </Button>

                {/* How To Play Button */}
                <Button
                    variant="outlined"
                    onClick={handleOpenHowToPlay}
                    sx={{
                        marginTop: "30px",
                        borderColor: Colors.buttonColor,
                        color: Colors.buttonColor,
                        padding: "15px 30px",
                        borderRadius: "8px",
                        textTransform: "none",
                        fontFamily: "'Super Larky', cursive",
                        fontWeight: "normal",
                        fontSize: "20px",
                        borderWidth: "2px",
                        "&:hover": {
                            borderColor: "#33a1a8",
                            backgroundColor: "rgba(63, 193, 201, 0.1)",
                            borderWidth: "2px",
                        },
                    }}
                >
                    📖 Wie spielt man?
                </Button>
            </Box>

            {/* How To Play Modal */}
            <Dialog
                open={howToPlayOpen}
                onClose={handleCloseHowToPlay}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: "12px",
                        maxHeight: "80vh",
                        backgroundColor: "#fafafa"
                    }
                }}
            >
                <DialogTitle
                    sx={{
                        fontFamily: "'Super Larky', cursive",
                        fontSize: "2rem",
                        color: Colors.text,
                        textAlign: "center",
                        paddingBottom: "10px",
                        position: "relative"
                    }}
                >
                    🎮 Wie spielt man "Just One Word"?
                    <IconButton
                        onClick={handleCloseHowToPlay}
                        sx={{
                            position: "absolute",
                            right: 8,
                            top: 8,
                            color: "#f44336",
                            "&:hover": {
                                backgroundColor: "rgba(244, 67, 54, 0.1)"
                            }
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent sx={{ paddingTop: "20px !important" }}>
                    <Box sx={{ fontFamily: "'Super Larky', cursive" }}>

                        {/* Spielübersicht */}
                        <Typography variant="h5" gutterBottom sx={{ color: "#2196F3", fontFamily: "'Super Larky', cursive", fontWeight: "bold" }}>
                            🎯 Das Ziel
                        </Typography>
                        <Typography variant="body1" paragraph sx={{ fontFamily: "'Super Larky', cursive", fontSize: "1.1rem", lineHeight: 1.6 }}>
                            Ein Spieler (der <strong style={{ color: "#4CAF50" }}>Ratende</strong>) muss ein deutsches Substantiv/Nomen erraten, das er <strong>nicht kennt</strong>.
                            Die anderen Spieler helfen – oder sabotieren – ihn dabei!
                        </Typography>

                        <Divider sx={{ margin: "20px 0" }} />

                        {/* Die 3 Rollen */}
                        <Typography variant="h5" gutterBottom sx={{ color: "#FF9800", fontFamily: "'Super Larky', cursive", fontWeight: "bold" }}>
                            👥 Die drei Rollen
                        </Typography>

                        <Box sx={{ marginLeft: "20px", marginBottom: "20px" }}>
                            <Typography variant="h6" sx={{ color: "#4CAF50", fontFamily: "'Super Larky', cursive", fontWeight: "bold", marginBottom: "8px" }}>
                                🟢 Der Ratende (Guesser)
                            </Typography>
                            <Typography variant="body1" paragraph sx={{ fontFamily: "'Super Larky', cursive", fontSize: "1rem", lineHeight: 1.5 }}>
                                • Kennt das Lösungswort <strong>nicht</strong><br />
                                • Sieht <strong>nur teilweise aufgedeckte Buchstaben</strong> (anfangs <strong>keine</strong>)<br />
                                • Muss das Wort anhand der Hinweise erraten<br />
                                • Hat pro Raterunde <strong>60 Sekunden</strong> Zeit
                            </Typography>

                            <Typography variant="h6" sx={{ color: "#2196F3", fontFamily: "'Super Larky', cursive", fontWeight: "bold", marginBottom: "8px" }}>
                                🔵 Die Unterstützer (Supporter)
                            </Typography>
                            <Typography variant="body1" paragraph sx={{ fontFamily: "'Super Larky', cursive", fontSize: "1rem", lineHeight: 1.5 }}>
                                • Kennen das Lösungswort<br />
                                • Geben <strong>hilfreiche Hinweise</strong> – <strong>jeweils ein einzelnes Wort</strong><br />
                                • <strong>Wichtig:</strong> Wenn zwei oder mehr Spieler dasselbe Wort eingeben, wird es <strong>automatisch gestrichen</strong><br />
                                • Haben <strong>2 Minuten Zeit</strong>, um ihre Hinweise einzugeben
                            </Typography>

                            <Typography variant="h6" sx={{ color: "#F44336", fontFamily: "'Super Larky', cursive", fontWeight: "bold", marginBottom: "8px" }}>
                                🔴 Die Saboteure (Saboteur)
                            </Typography>
                            <Typography variant="body1" paragraph sx={{ fontFamily: "'Super Larky', cursive", fontSize: "1rem", lineHeight: 1.5 }}>
                                • Kennen das Lösungswort<br />
                                • Wollen den Ratenden <strong>verwirren</strong><br />
                                • Geben <strong>falsche oder irreführende Hinweise</strong> – ebenfalls <strong>ein Wort</strong><br />
                                • Können bewusst Hinweise der Unterstützer nachahmen, um sie <strong>aus dem Spiel zu nehmen</strong><br />
                                • Haben <strong>2 Minuten Zeit</strong>, um ihre Hinweise einzugeben
                            </Typography>
                        </Box>

                        <Divider sx={{ margin: "20px 0" }} />

                        {/* Spielablauf */}
                        <Typography variant="h5" gutterBottom sx={{ color: "#9C27B0", fontFamily: "'Super Larky', cursive", fontWeight: "bold" }}>
                            ⚡ Spielablauf
                        </Typography>

                        <Typography variant="h6" sx={{ color: "#666", fontFamily: "'Super Larky', cursive", fontWeight: "bold", marginBottom: "10px" }}>
                            🔁 Das Spiel besteht aus wechselnden Phasen:
                        </Typography>
                        <Typography variant="body1" paragraph sx={{ fontFamily: "'Super Larky', cursive", fontSize: "1rem", lineHeight: 1.5, marginLeft: "15px", marginBottom: "15px" }}>
                            • <strong>Raten</strong> (1 Minute)<br />
                            • <strong>Hinweise abgeben</strong> (2 Minuten)<br />
                            • <strong>Raten</strong> (nächster Buchstabe erscheint)<br />
                            • usw.
                        </Typography>

                        <Typography variant="h6" sx={{ color: "#666", fontFamily: "'Super Larky', cursive", fontWeight: "bold", marginBottom: "10px" }}>
                            📝 Phase 1: Raten (60 Sekunden)
                        </Typography>
                        <Typography variant="body1" paragraph sx={{ fontFamily: "'Super Larky', cursive", fontSize: "1rem", lineHeight: 1.5, marginLeft: "15px" }}>
                            • Der Ratende <strong>sieht aktuell aufgedeckte Buchstaben</strong> <em>(in der ersten Runde sind <strong>keine Buchstaben sichtbar</strong>)</em><br />
                            • Er hat 60 Sekunden, um das Lösungswort zu erraten<br />
                            • Danach beginnt die nächste Phase
                        </Typography>

                        <Typography variant="h6" sx={{ color: "#666", fontFamily: "'Super Larky', cursive", fontWeight: "bold", marginBottom: "10px" }}>
                            ✍️ Phase 2: Hinweise eingeben (2 Minuten)
                        </Typography>
                        <Typography variant="body1" paragraph sx={{ fontFamily: "'Super Larky', cursive", fontSize: "1rem", lineHeight: 1.5, marginLeft: "15px" }}>
                            • Unterstützer und Saboteure geben <strong>einzelne Wörter</strong> als Hinweise ein<br />
                            • Der Ratende sieht diese Hinweise später<br />
                            • <strong>Identische Wörter werden gestrichen</strong><br />
                            • Danach beginnt wieder die Raterunde – <strong>ein zufälliger Buchstabe wird zusätzlich aufgedeckt</strong>
                        </Typography>

                        <Typography variant="h6" sx={{ color: "#666", fontFamily: "'Super Larky', cursive", fontWeight: "bold", marginBottom: "10px" }}>
                            🔄 Weitere Runden
                        </Typography>
                        <Typography variant="body1" paragraph sx={{ fontFamily: "'Super Larky', cursive", fontSize: "1rem", lineHeight: 1.5, marginLeft: "15px" }}>
                            • Das Spiel geht weiter mit abwechselnden <strong>Hinweis-</strong> und <strong>Ratephasen</strong><br />
                            • In jeder Raterunde wird ein <strong>weiterer Buchstabe des Lösungsworts zufällig aufgedeckt</strong><br />
                            • Das Spiel endet, sobald das Wort erraten wurde
                        </Typography>

                        <Divider sx={{ margin: "20px 0" }} />

                        {/* Strategien */}
                        <Typography variant="h5" gutterBottom sx={{ color: "#795548", fontFamily: "'Super Larky', cursive", fontWeight: "bold" }}>
                            🧠 Tipps & Strategien
                        </Typography>

                        <Typography variant="h6" sx={{ color: "#4CAF50", fontFamily: "'Super Larky', cursive", fontWeight: "bold", marginBottom: "8px" }}>
                            Für Unterstützer:
                        </Typography>
                        <Typography variant="body1" paragraph sx={{ fontFamily: "'Super Larky', cursive", fontSize: "1rem", lineHeight: 1.5, marginLeft: "15px" }}>
                            • Vermeidet offensichtliche Hinweise, die andere auch geben könnten<br />
                            • Nutzt <strong>Synonyme</strong>, verwandte Begriffe oder Assoziationen<br />
                            • Achtet auf <strong>Einzigartigkeit</strong>, um Streichungen zu vermeiden
                        </Typography>

                        <Typography variant="h6" sx={{ color: "#F44336", fontFamily: "'Super Larky', cursive", fontWeight: "bold", marginBottom: "8px" }}>
                            Für Saboteure:
                        </Typography>
                        <Typography variant="body1" paragraph sx={{ fontFamily: "'Super Larky', cursive", fontSize: "1rem", lineHeight: 1.5, marginLeft: "15px" }}>
                            • Wählt Hinweise, die zu anderen möglichen Wörtern passen<br />
                            • Nutzt absichtlich Wörter, die Unterstützer wahrscheinlich auch wählen<br />
                            • Verwirrt subtil – zu plumpe Sabotage ist leicht zu durchschauen
                        </Typography>

                        <Typography variant="h6" sx={{ color: "#2196F3", fontFamily: "'Super Larky', cursive", fontWeight: "bold", marginBottom: "8px" }}>
                            Für Ratende:
                        </Typography>
                        <Typography variant="body1" paragraph sx={{ fontFamily: "'Super Larky', cursive", fontSize: "1rem", lineHeight: 1.5, marginLeft: "15px" }}>
                            • Achtet auf Hinweise, die <strong>thematisch zueinander passen</strong><br />
                            • Ignoriert widersprüchliche oder verdächtige Begriffe<br />
                            • Nutzt die <strong>nach und nach aufgedeckten Buchstaben</strong> als Hilfestellung
                        </Typography>

                        <Divider sx={{ margin: "20px 0" }} />

                        {/* Spieleranzahl */}
                        <Typography variant="h5" gutterBottom sx={{ color: "#E91E63", fontFamily: "'Super Larky', cursive", fontWeight: "bold" }}>
                            👨‍👩‍👧‍👦 Spieleranzahl
                        </Typography>
                        <Typography variant="body1" paragraph sx={{ fontFamily: "'Super Larky', cursive", fontSize: "1.1rem", lineHeight: 1.6 }}>
                            • <strong>Minimum:</strong> 3 Spieler<br />
                            • <strong>Maximum:</strong> 11 Spieler<br />
                            • Rollen werden <strong>automatisch zufällig verteilt</strong><br />
                            • Je mehr Spieler, desto <strong>chaotischer und lustiger</strong> wird es!
                        </Typography>

                        <Box sx={{
                            backgroundColor: "#e8f5e8",
                            padding: "15px",
                            borderRadius: "8px",
                            border: "2px solid #4CAF50",
                            marginTop: "20px"
                        }}>
                            <Typography variant="h6" sx={{ color: "#2e7d32", fontFamily: "'Super Larky', cursive", fontWeight: "bold", marginBottom: "8px" }}>
                                🎉 Viel Spaß beim Spielen!
                            </Typography>
                            <Typography variant="body1" sx={{ fontFamily: "'Super Larky', cursive", fontSize: "1rem", color: "#2e7d32" }}>
                                Das Spiel lebt von <strong>Kreativität</strong>, <strong>Intuition</strong> und einem Hauch <strong>Täuschung</strong>.
                                Lasst eurer Fantasie freien Lauf – und denkt daran: Nicht jeder Hinweis ist dein Freund 😉
                            </Typography>
                        </Box>

                    </Box>
                </DialogContent>
            </Dialog>
        </Container>
    );
}

export default Home;