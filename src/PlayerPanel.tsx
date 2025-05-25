import React from 'react';
import { Player } from '../server/types.ts';
import '../src/styles/PlayerPanel.css';
import { socket } from '../server/socket';
import backIcon from '../src/assets/back.png'; // ✅ импорт иконки

interface PlayerPanelProps {
    players: Player[];
    currentPlayer: string;
    onExit?: () => void;
}

const PlayerPanel: React.FC<PlayerPanelProps> = ({ players, currentPlayer }) => {

    const handleExit = () => {
        const confirmed = window.confirm('Вы уверены, что хотите выйти из игры?');
        if (confirmed) {
            const roomName = window.location.pathname.split('/').pop();
            const playerId = localStorage.getItem('playerId');
            console.log('exit');
            socket.emit('leave_room', { roomName, playerId });
        }
    };

    return (
        <div className="player-panel-main">
            <div className="back" onClick={handleExit}>
                <img src={backIcon} className="back_icon" alt="Назад" /> {/* ✅ корректно подключено */}
            </div>
            <div className="player-panel">
                {players.filter(p => p?.id && p?.name).map(player => (
                    <div
                        key={player.id}
                        className={`player ${player.id === currentPlayer ? 'active' : ''}`}
                    >
                        <img src={player.avatar} alt={player.name} className="avatar" />
                        <span>{player.name}</span>
                        <img src={player.symbol} alt="symbol" className="symbol" />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PlayerPanel;
