import { useEffect, useState } from "react";
import { Typography, Container, Box, CircularProgress } from "@mui/material";
import { useLocation } from "react-router-dom";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { initializeApp } from "firebase/app";
import { firebaseConfig } from "../firebaseConfig.ts"; // Dein Firebase-Konfigurationsimport

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const RolePage = () => {
    const { state } = useLocation();
    console.log("State beim Laden der Rolle:", state);  // Debugging-Ausgabe

    const [role, setRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (state?.name) {
            console.log("Name aus state:", state.name);  // Überprüfen, ob der Name korrekt übergeben wird
            const fetchRole = async () => {
                try {
                    const docRef = doc(db, "roles", state.name);
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        setRole(docSnap.data().role);
                    } else {
                        console.log("Keine Rolle gefunden.");
                        setRole(null);  // Rolle zu null setzen, wenn keine gefunden wurde
                    }
                } catch (error) {
                    console.error("Fehler beim Abrufen der Rolle:", error);
                    setError("Fehler beim Abrufen der Rolle.");  // Fehler setzen
                } finally {
                    setLoading(false); // Ladeprozess beenden
                }
            };

            fetchRole();
        } else {
            setError("Kein Name in state übergeben.");
            setLoading(false);  // Ladeprozess beenden, wenn kein Name übergeben wurde
        }
    }, [state?.name]);  // Nur ausführen, wenn der Name sich ändert

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
                        Deine Rolle: {role ? role : "Rolle noch nicht zugewiesen."}
                    </Typography>
                )}
            </Box>
        </Container>
    );
};

export default RolePage;
