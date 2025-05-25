import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Menu from './Menu';
import GameRoom from './GameRoom';
import App from './Game';

const Main = () => (
        <Routes>
            <Route path="/" element={<Menu />} />
            <Route path="/room/:roomName" element={<GameRoom />} />
            <Route path="/game/:roomName" element={<App />} /> {/* <-- ЭТО */}
        </Routes>
);

export default Main;
