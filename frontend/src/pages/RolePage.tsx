import { useEffect, useState } from "react";
import { Typography, Container, Box, CircularProgress } from "@mui/material";
import { useLocation } from "react-router-dom";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { initializeApp } from "firebase/app";
import { firebaseConfig } from "../firebaseConfig.ts";

// Firebase initialisieren
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const RolePage = () => {
    const { state } = useLocation();
    const [role, setRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (state?.gameId && state?.name) {
            const fetchRole = async () => {
                try {
                    console.log("🔍 gameId:", state.gameId);
                    console.log("🔍 name:", state.name);

                    const docRef = doc(db, "games", state.gameId);
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        const gameData = docSnap.data();
                        console.log("✅ Dokumentinhalt:", gameData);

                        const playerData = gameData.rolesMap?.[state.name]; // <-- Korrektur hier!

                        if (playerData) {
                            setRole(playerData.role);
                        } else {
                            setError(`Spieler "${state.name}" nicht gefunden.`);
                        }
                    } else {
                        console.error("❌ Dokument existiert nicht.");
                        setError(`Spiel mit ID ${state.gameId} nicht gefunden.`);
                    }
                } catch (error) {
                    console.error("Fehler beim Abrufen der Rolle:", error);
                    setError("Fehler beim Abrufen der Rolle.");
                } finally {
                    setLoading(false);
                }
            };

            fetchRole();
        } else {
            setError("Keine Spiel-ID oder kein Name übergeben.");
            setLoading(false);
        }
    }, [state?.gameId, state?.name]);

    return (
        <Container
            style={{
                minHeight: "100vh",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
            }}
        >
            <Box display="flex" flexDirection="column" alignItems="center" gap="20px">
                {loading ? (
                    <CircularProgress />
                ) : error ? (
                    <Typography variant="h6" color="error">
                        {error}
                    </Typography>
                ) : (
                    <Typography
                        variant="h4"
                        align="center"
                        sx={{
                            fontFamily: "'Super Larky', cursive",
                            color: "#393E46",
                            fontSize: "2rem",
                        }}
                    >
                        Deine Rolle: {role ?? "Rolle noch nicht zugewiesen."}
                    </Typography>
                )}
            </Box>
        </Container>
    );
};

export default RolePage;