// src/pages/Home.tsx
import { Button, Typography, Container, Box } from "@mui/material";

const pastelColors = {
    lightBlue: "#A2C8FC",
    lightGreen: "#A3D9A5",
    lightYellow: "#F6E06D",
    backgroundStart: "#F0F8FF",  // Anfangsfarbe des Farbverlaufs
    backgroundEnd: "#A3D9A5",    // Endfarbe des Farbverlaufs
    text: "#333",
};

function Home() {
    return (
        <Container
            style={{
                background: `linear-gradient(to bottom right, ${pastelColors.backgroundStart}, ${pastelColors.backgroundEnd})`,
                minHeight: "100vh",
                paddingTop: "50px",
            }}
        >
            <Typography
                variant="h3"
                align="center"
                style={{
                    margin: "20px",
                    color: pastelColors.text,
                    fontFamily: "'Super Larky', cursive",
                    fontWeight: 600,
                }}
            >
                Just One Word
            </Typography>
            <Box display="flex" flexDirection="column" alignItems="center" gap="20px">
                <Button
                    variant="contained"
                    style={{
                        backgroundColor: pastelColors.lightBlue,
                        color: "#FFF",
                        padding: "15px 30px",
                        borderRadius: "8px",
                        textTransform: "none",
                        fontFamily: "'Super Larky', cursive",
                        fontWeight: "normal",
                        fontSize: "1.2rem",
                        boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                    }}
                    href="/random-game"
                >
                    Zufälliges Spiel beitreten
                </Button>
                <Button
                    variant="contained"
                    style={{
                        backgroundColor: pastelColors.lightGreen,
                        color: "#FFF",
                        padding: "15px 30px",
                        borderRadius: "8px",
                        textTransform: "none",
                        fontFamily: "'Super Larky', cursive",
                        fontWeight: "normal",
                        fontSize: "1.2rem",
                        boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                    }}
                    href="/create-game"
                >
                    Privates Spiel erstellen
                </Button>
                <Button
                    variant="contained"
                    style={{
                        backgroundColor: pastelColors.lightYellow,
                        color: "#FFF",
                        padding: "15px 30px",
                        borderRadius: "8px",
                        textTransform: "none",
                        fontFamily: "'Super Larky', cursive",
                        fontWeight: "normal",
                        fontSize: "1.2rem",
                        boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                    }}
                    href="/join-game"
                >
                    Spiel per ID beitreten
                </Button>
            </Box>
        </Container>
    );
}

export default Home;
