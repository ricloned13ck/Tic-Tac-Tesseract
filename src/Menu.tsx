import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../server/socket';
import { Player, Room } from '../server/types.ts';
import './styles/Main_Menu.css';
import defaultAvatar from '../src/assets/default_avatar.png';
import { v4 as uuidv4 } from 'uuid';

const figures = import.meta.glob('../src/assets/figures/*.{png,jpg,jpeg,gif}', {
    eager: true,
    import: 'default',
}) as Record<string, string>;

const convertImageToBase64 = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = url;

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject('Canvas context not available');
            ctx.drawImage(img, 0, 0);
            const dataURL = canvas.toDataURL('image/png');
            resolve(dataURL);
        };

        img.onerror = (e) => reject(e);
    });
};

const getRandomFigure = (): string => {
    const figureNames = Object.keys(figures).map((path) => path.split('/').pop() || '');
    const randomIndex = Math.floor(Math.random() * figureNames.length);
    return figureNames[randomIndex];
};

const Menu: React.FC = () => {
    const navigate = useNavigate();

    const [nickname, setNickname] = useState('');
    const [room, setRoom] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [selectedFigure, setSelectedFigure] = useState<{ src: string; base64: string } | null>(null);
    // @ts-ignore
    const [avatar, setAvatar] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
    const [newRoomName, setNewRoomName] = useState('');
    const [newRoomPlayers, setNewRoomPlayers] = useState(2);
    const [newRoomPassword, setNewRoomPassword] = useState('');

    const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
    const exampleImages = [
        '1_win.png', '2_win.png', '3_win.png', '4_win.png'
    ];

    const closeModal = () => setSelectedImageIndex(null);

    useEffect(() => {
        let playerId = localStorage.getItem('playerId');
        if (!playerId) {
            playerId = uuidv4();
            localStorage.setItem('playerId', playerId);
        }

        socket.auth = { playerId };
        socket.connect();

        socket.emit('get_rooms');

        socket.on('rooms_list', (roomList: Room[]) => {
            setAvailableRooms(roomList);
        });

        socket.on('room_joined', (room: Room) => {
            navigate(`/room/${room.name}`);
        });

        socket.on('room_error', (message: string) => {
            alert(message);
        });

        return () => {
            socket.off('rooms_list');
            socket.off('room_joined');
            socket.off('room_error');
        };
    }, []);

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatar(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleStart = () => {
        if (!nickname || !room) {
            alert('Введите ник или выберите комнату.');
            return;
        }

        const player: Player = {
            id: localStorage.getItem('playerId') || '',
            name: nickname,
            symbol: selectedFigure?.base64 || getRandomFigure(),
            avatar: avatarPreview || defaultAvatar,
            metaSymbol: selectedFigure?.src || ''
        };

        socket.emit('join_room', {
            name: room,
            password: passwordInput,
            player,
        });
    };

    return (
        <div style={{ display: 'flex', padding: '30px', gap: '30px', justifyContent: 'space-between' }}>
            {}
            <div style={{ width: '28%', background: '#f4f4f4', padding: '20px', borderRadius: '12px' }}>
                <h2>О игре</h2>
                <p style={{ fontSize: '15px', lineHeight: '1.6' }}>
                    Эта стратегическая игра для <strong>3–5 игроков</strong>. Каждый игрок по очереди ходит своей уникальной фигурой.
                    <br /><br />
                    На поле слева отображаются <strong>выигрышные позиции</strong> всех участников.
                    Вы обязаны блокировать чужие потенциальные победы, иначе проиграете.
                    <br /><br />
                    Побеждает тот, <strong>кого не смогут закрыть</strong>. Следите за ситуацией и стройте комбинации!
                </p>
            </div>

            {}
            <div style={{ width: '40%' }}>
                <h1>Крестики-нолики</h1>

                <div className="menu-item">
                    <label>Ваш ник:</label>
                    <input
                        type="text"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="Введите ник"
                    />
                </div>

                <div className="menu-item">
                    <label>Выберите фигуру:</label>
                    <div className="choosing_figure" style={{ display: 'flex', gap: '4px' }}>
                        {Object.entries(figures).map(([path, src], index) => {
                            const figureName = path.split('/').pop();
                            return (
                                <button
                                    key={index}
                                    onClick={async () => {
                                        const base64 = await convertImageToBase64(src);
                                        setSelectedFigure({ src, base64 });
                                    }}
                                    style={{
                                        border: selectedFigure?.src === src ? '2px solid blue' : '1px solid #ccc',
                                        padding: '5px',
                                        borderRadius: '8px',
                                        background: 'white',
                                        cursor: 'pointer',
                                        marginTop: '0',
                                    }}
                                >
                                    <img src={src} alt={figureName} style={{ width: '20px', height: '20px' }} />
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="menu-item">
                    <label>Выберите аватар:</label>
                    <input type="file" accept="image/*" onChange={handleAvatarChange} />
                    {avatarPreview && (
                        <div className="avatar-preview">
                            <img
                                src={avatarPreview}
                                alt="Avatar Preview"
                                style={{ width: '100px', height: '100px', borderRadius: '50%' }}
                            />
                        </div>
                    )}
                </div>

                <div className="menu-item">
                    <label>Выберите комнату:</label>
                    <select
                        value={room}
                        onChange={(e) => setRoom(e.target.value)}
                        className="room-select"
                    >
                        <option value="" disabled>
                            Выберите комнату
                        </option>
                        {availableRooms.map((r, i) => (
                            <option key={i} value={r.name}>
                                {r.name}
                            </option>
                        ))}
                    </select>

                    <input
                        type="password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Пароль комнаты (если есть)"
                        style={{ marginTop: '10px', width: '100%', padding: '8px' }}
                    />
                </div>

                <button onClick={handleStart} style={{ marginTop: '20px' }}>
                    Начать игру
                </button>

                <div className="menu-item" style={{ marginTop: '30px', borderTop: '1px solid #ccc', paddingTop: '20px' }}>
                    <h3>Создать новую комнату</h3>

                    <input
                        type="text"
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        placeholder="Название комнаты"
                        style={{ width: '100%', marginBottom: '10px', padding: '8px' }}
                    />

                    <input
                        type="number"
                        min={3}
                        max={5}
                        value={newRoomPlayers}
                        onChange={(e) => setNewRoomPlayers(Number(e.target.value))}
                        style={{ width: '100%', marginBottom: '10px', padding: '8px' }}
                    />

                    <input
                        type="password"
                        value={newRoomPassword}
                        onChange={(e) => setNewRoomPassword(e.target.value)}
                        placeholder="Пароль (необязательно)"
                        style={{ width: '100%', marginBottom: '10px', padding: '8px' }}
                    />

                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <button
                            style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
                            onClick={() => {
                                if (!nickname || !newRoomName) {
                                    alert('Введите ник и название комнаты');
                                    return;
                                }

                                socket.emit('create_room', {
                                    name: newRoomName,
                                    password: newRoomPassword,
                                    maxPlayers: newRoomPlayers,
                                    player: {
                                        id: localStorage.getItem('playerId') || '',
                                        name: nickname,
                                        symbol: selectedFigure?.base64 || getRandomFigure(),
                                        avatar: avatarPreview || defaultAvatar,
                                        metaSymbol: selectedFigure?.src || '',
                                    },
                                });

                                setNewRoomName('');
                                setNewRoomPassword('');
                            }}
                        >
                            Создать комнату
                        </button>
                    </div>
                </div>
            </div>

            {}
            <div style={{ width: '25%', background: '#f4f4f4', padding: '20px', borderRadius: '12px' }}>
                <h3>Примеры выигрышных позиций</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {exampleImages.map((img, i) => (
                        <img
                            key={i}
                            src={`../src/examples/${img}`}
                            alt={`win example ${i + 1}`}
                            onClick={() => setSelectedImageIndex(i)}
                            style={{
                                width: '70px',
                                height: '70px',
                                objectFit: 'contain',
                                background: '#fff',
                                border: '1px solid #ccc',
                                borderRadius: '8px',
                                cursor: 'pointer'
                            }}
                        />
                    ))}
                </div>
            </div>

            {}
            {selectedImageIndex !== null && (
                <div
                    onClick={closeModal}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        background: 'rgba(0, 0, 0, 0.6)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 1000,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            position: 'relative',
                            background: 'white',
                            padding: '10px',
                            borderRadius: '8px',
                            boxShadow: '0 0 20px rgba(0,0,0,0.3)',
                        }}
                    >
                        <button
                            onClick={closeModal}
                            style={{
                                position: 'absolute',
                                top: '10px',
                                right: '10px',
                                background: 'transparent',
                                border: 'none',
                                fontSize: '24px',
                                cursor: 'pointer',
                            }}
                        >
                            ×
                        </button>
                        <img
                            src={`../src/examples/${exampleImages[selectedImageIndex]}`}
                            alt="enlarged"
                            style={{ maxWidth: '80vw', maxHeight: '80vh' }}
                        />
                        <div style={{ marginTop: '10px', textAlign: 'center' }}>
                            {selectedImageIndex > 0 && (
                                <button onClick={() => setSelectedImageIndex(selectedImageIndex - 1)}>←</button>
                            )}
                            {selectedImageIndex < exampleImages.length - 1 && (
                                <button onClick={() => setSelectedImageIndex(selectedImageIndex + 1)} style={{ marginLeft: '10px' }}>→</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Menu;
