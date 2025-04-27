import { useState, useEffect } from "react";
import { Box, Button, TextField, Typography, Container } from "@mui/material";
import { starBackground } from "../styles/starBackground.ts";
import io from "socket.io-client";
import { useNavigate } from "react-router-dom";

const socket = io("http://localhost:5000");

function JoinRandom() {
    const [name, setName] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [queueSize, setQueueSize] = useState(1);
    const navigate = useNavigate();

    useEffect(() => {
        socket.on("queue-update", (size: number) => {
            setQueueSize(size);
        });

        // Wenn Rolle zugewiesen wurde, auf /role weiterleiten
        socket.on("role-assigned", () => {
            navigate("/role", { state: { name } });
        });

        return () => {
            socket.off("queue-update");
            socket.off("role-assigned");
        };
    }, [navigate, name]);

    const handleJoin = () => {
        if (name.trim().length >= 1 && name.trim().length <= 20) {
            console.log(`Sende Name: ${name.trim()}`);  // Debugging: Überprüfe den gesendeten Namen
            socket.emit("join-random", { name: name.trim(), id: socket.id });
            setSubmitted(true);
        } else {
            console.log("Ungültiger Name: Muss zwischen 1 und 20 Zeichen lang sein");
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
            {!submitted ? (
                <Box display="flex" flexDirection="column" gap="20px" alignItems="center">
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
                        label="Name"
                        variant="outlined"
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
                        sx={{
                            fontFamily: "'Super Larky', cursive",
                            fontSize: "1.3rem",
                            padding: "10px 30px",
                        }}
                    >
                        Beitreten
                    </Button>
                </Box>
            ) : (
                <Box display="flex" flexDirection="column" gap="20px" alignItems="center">
                    <Typography
                        variant="h5"
                        align="center"
                        sx={{
                            fontFamily: "'Super Larky', cursive",
                            color: "#393E46",
                            fontSize: "1.8rem",
                        }}
                    >
                        Warte auf weitere Spieler ({queueSize}/3)
                    </Typography>
                </Box>
            )}
        </Container>
    );
}

export default JoinRandom;
