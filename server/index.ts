import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { Player, Move, Room } from '../src/types';

const app = express();
const server = createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
    }
});

const session = require("express-session")({
    secret: "my-secret",
    resave: true,
    saveUninitialized: true
});

const sharedsession = require("express-socket.io-session");

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));

app.use(session);
io.use(sharedsession(session));

const rooms: Record<string, Room> = {};

type GameState = {
    board: string[][][];
    currentPlayerId: string;
    moves: string[][];
    closedCells: string[];
    winningPositions: { playerId: string, position: string[] }[];
};

const gameStates: Record<string, GameState> = {};

io.on('connection', (socket: any) => {
    const playerId = socket.handshake.auth?.playerId;
    socket.data.playerId = playerId;

    console.log(`🔌 Socket подключён: ${socket.id}`);
    // @ts-ignore
    socket.on('player_won', ({ room, winnerName }) => {
        io.to(room).emit('player_won', { winnerName });
    });


    // Создание комнаты
    socket.on('create_room', ({ name, password, player, maxPlayers }: {
        name: string;
        password?: string;
        player: Player;
        maxPlayers?: number;
    }) => {
        if (rooms[name]) {
            socket.emit('room_error', 'Комната уже существует');
            return;
        }

        if (!player?.id) {
            socket.emit('room_error', 'ID игрока не передан');
            return;
        }

        socket.data.playerId = player.id;

        rooms[name] = {
            name,
            password,
            maxPlayers: maxPlayers || 4,
            players: [player],
        };

        socket.join(name);
        console.log(`🛠 Комната "${name}" создана игроком ${player.name} (${player.id})`);
        io.emit('rooms_list', Object.values(rooms));
        socket.emit('room_joined', rooms[name]);
    });

    socket.on('leave_room', ({ roomName, playerId }: { roomName: string, playerId: string }) => {
        const room = rooms[roomName];
        if (!room) return;

        room.players = room.players.filter(p => p.id !== playerId);
        console.log(room.players.length);

        if (room.players.length != 0) {
            io.to(roomName).emit('redirect_to_menu');

            delete rooms[roomName];
            delete gameStates[roomName];
            console.log(`🗑 Комната "${roomName}" удалена`);
        } else {
            io.to(roomName).emit('room_joined', room);
        }
    });

    // @ts-ignore
    socket.on('exit_game', ({ roomName }) => {
        const room = rooms[roomName];
        if (room) {
            io.to(roomName).emit('redirect_to_menu');
            delete rooms[roomName];
            delete gameStates[roomName];
        }
    });


    // Присоединение к комнате
    socket.on('join_room', ({ name, player, password }: {
        name: string;
        player: Player;
        password?: string;
    }) => {
        const room = rooms[name];
        if (!room) {
            socket.emit('room_error', 'Комната не найдена');
            return;
        }
        const existingSymbol = room.players.find(p => p.metaSymbol === player.metaSymbol);
        if (existingSymbol) {
            socket.emit('room_error', 'Этот символ уже используется другим игроком. Пожалуйста, выберите другой.');
            return;
        }

        const alreadyJoined = room.players.some(p => p.id === player.id);
        if (!alreadyJoined) {
            room.players.push(player);
            console.log(`👤 Игрок ${player.name} (${player.id}) присоединился к комнате "${name}"`);
        }

        socket.join(name);
        io.to(name).emit('room_joined', room);

        const game = gameStates[name];
        if (game) {
            socket.emit('sync_state', {
                ...game,
                players: room.players
            });
        }
    });

    // Получение списка комнат
    socket.on('get_rooms', () => {
        socket.emit('rooms_list', Object.values(rooms));
    });

    // Старт игры
    socket.on('start_game', (roomName: string) => {
        const room = rooms[roomName];
        if (!room) return;

        const creatorId = room.players[0]?.id;
        if (creatorId !== socket.data.playerId) {
            socket.emit('room_error', 'Только создатель может начать игру');
            return;
        }

        gameStates[roomName] = {
            board: Array(9).fill(null).map(() => Array(3).fill(null).map(() => Array(3).fill(''))),
            currentPlayerId: creatorId,
            moves: [],
            closedCells: [],
            winningPositions: [],
        };

        io.to(roomName).emit('game_started', {
            players: room.players,
            currentPlayer: creatorId
        });
    });

    // Синхронизация состояния при обновлении страницы
    socket.on('sync_state_request', (roomName: string) => {
        const game = gameStates[roomName];
        const room = rooms[roomName];

        if (game && room) {
            console.log("🔁 sync_state:", game.closedCells);
            socket.emit('sync_state', {
                ...game,
                players: room.players
            });
        }
    });


    // Обработка хода игрока
    socket.on('player_move', ({ room, move }: { room: string; move: Move }) => {
        const roomData = rooms[room];
        const game = gameStates[room];

        if (!roomData || !game) return;

        const { field, x, y, player } = move;

        // Обновляем доску
        const newBoard = game.board.map(f => f.map(row => [...row]));
        newBoard[field][x][y] = String(player); // player — это строка ID

        // Получаем данные для хода
        const col = ['A','B','C','D','E','F','G','H','I'][(field % 3) * 3 + x];
        const rowLabel = (Math.floor(field / 3) * 3 + y + 1).toString();
        const position = `${col}${rowLabel}`;

        const thisPlayer = roomData.players.find(p => p.id === String(player));
        const symbol = thisPlayer?.symbol || '?';

        game.moves.push([symbol, position]);

        // Обновляем закрытые клетки
        const cellKey = `${field}-${x}-${y}-${player}`;
        console.log(cellKey)
        game.closedCells.push(cellKey);

        console.log(game.closedCells)
        io.to(room).emit('move', {
            ...move
        });
        // Победные позиции — оставим на клиенте

        // Вычисляем следующего игрока
        const currentIndex = roomData.players.findIndex(p => p.id === String(player));
        const nextPlayer = roomData.players[(currentIndex + 1) % roomData.players.length];

        // Сохраняем обновлённое состояние
        game.board = newBoard;
        game.currentPlayerId = nextPlayer.id;

        // Рассылаем новое состояние
        io.to(room).emit('sync_state', {
            ...game,
            players: roomData.players,
        });

        io.to(room).emit('update_current_player', nextPlayer.id);
    });
    socket.on('end_game', (roomName: string) => {
        const room = rooms[roomName];
        if (!room) return;

        io.to(roomName).emit('redirect_to_menu');
        delete rooms[roomName];
        delete gameStates[roomName];

        console.log(`🏁 Игра завершена. Комната "${roomName}" удалена.`);
    });


    // Отключение игрока
    socket.on('disconnect', () => {
        console.log(`❌ Socket отключён: ${socket.id}`);
    });
});

server.listen(4000, () => console.log('🚀 Сервер запущен на порту 4000'));
