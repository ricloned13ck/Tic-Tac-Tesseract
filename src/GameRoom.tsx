import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../server/socket';
import { Room, Player } from '../server/types.ts';

const GameRoom: React.FC = () => {
    const { roomName } = useParams();
    const navigate = useNavigate();
    const [room, setRoom] = useState<Room | null>(null);

    useEffect(() => {
        let playerId = localStorage.getItem("playerId");
        if (!playerId) {
            playerId = crypto.randomUUID();
            localStorage.setItem("playerId", playerId);
        }

        socket.auth = { playerId };

        if (!socket.connected) {
            socket.connect();
        }

        socket.emit('get_rooms');

        socket.on('rooms_list', (rooms: Room[]) => {
            const foundRoom = rooms.find((r) => r.name === roomName);
            if (foundRoom) {
                setRoom(foundRoom);
            }
        });

        socket.on('room_joined', (room: Room) => {
            setRoom(room);
        });

        socket.on('game_started', ({ players}) => {
            navigate(`/game/${roomName}`, { state: { players } });
        });

        return () => {
            socket.off('rooms_list');
            socket.off('room_joined');
            socket.off('game_started');
        };
    }, [roomName, navigate]);

    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
            <h2>Комната: <strong>{roomName}</strong></h2>

            {room && (
                <>
                    <h3>Пароль: {room.password ? '🔒 (установлен)' : '🔓 нет'}</h3>

                    <h3>Игроки в комнате:</h3>
                    {room.players.map((player: Player, index: number) => (
                        <div
                            key={player.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                marginBottom: '10px',
                                padding: '10px',
                                border: '1px solid #ccc',
                                borderRadius: '8px',
                            }}
                        >
                            <img
                                src={player.avatar}
                                alt="avatar"
                                style={{
                                    width: '50px',
                                    height: '50px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    marginRight: '10px',
                                }}
                            />
                            <div>
                                <strong>{player.name}</strong><br />
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    Фигура:
                                    <img src={player.symbol} alt="symbol" style={{ height: '20px', width: '20px', marginLeft: '10px' }} />
                                    {index === 0 && <span style={{ color: 'green', marginLeft: '10px' }}>(Создатель)</span>}
                                </div>
                            </div>
                        </div>
                    ))}

                    {}
                    {[...Array((room.maxPlayers || 2) - room.players.length)].map((_, i) => (
                        <div
                            key={`empty-${i}`}
                            style={{
                                padding: '10px',
                                marginBottom: '10px',
                                border: '1px dashed #999',
                                borderRadius: '8px',
                                color: '#777',
                                textAlign: 'center'
                            }}
                        >
                            Ждём игрока...
                        </div>
                    ))}

                    {room.players.length === room.maxPlayers &&
                        room.players[0]?.id === localStorage.getItem('playerId') && (
                            <button
                                onClick={() => socket.emit('start_game', room.name)}
                                style={{
                                    marginTop: '20px',
                                    padding: '10px 20px',
                                    fontSize: '16px',
                                    backgroundColor: '#4CAF50',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '5px',
                                    cursor: 'pointer',
                                }}
                            >
                                Начать игру
                            </button>
                        )}
                </>
            )}
        </div>
    );
};

export default GameRoom;
