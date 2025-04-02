import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Game from "./pages/Game";
import JoinGame from "./pages/JoinGame";
import './assets/fonts/fonts.css';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/random-game" element={<Game />} />
                <Route path="/create-game" element={<Game />} />
                <Route path="/join-game" element={<JoinGame />} />
            </Routes>
        </Router>
    );
}

export default App;