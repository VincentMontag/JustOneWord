import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import CreateGame from "./pages/CreateGame.tsx";
import JoinRandom from "./pages/JoinRandom.tsx";
import RolePage from "./pages/RolePage.tsx";  // Importiere die RolePage
import './assets/fonts/fonts.css';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/random-game" element={<JoinRandom />} />
                <Route path="/create-game" element={<CreateGame />} />
                <Route path="/role" element={<RolePage />} />           </Routes>
        </Router>
    );
}

export default App;
