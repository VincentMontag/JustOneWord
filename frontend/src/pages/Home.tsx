import { Button, Typography, Container, Box } from "@mui/material";
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
            </Box>
        </Container>
    );
}

export default Home;
