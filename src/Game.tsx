import React, {useState, useEffect, useRef} from 'react';
import {useLocation, useParams, useNavigate} from 'react-router-dom';
import GameBoard from '../src/GameBoard';
import PlayerPanel from '../src/PlayerPanel';
import MoveList from '../src/MoveList';
import {Player} from './types';
import {socket} from '../server/socket';
import './styles/App.css';

const Game: React.FC = () => {
    const {roomName} = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [players, setPlayers] = useState<Player[]>(location.state?.players || []);
    const playersRef = useRef<Player[]>([]);

    const [winnerId, setWinnerId] = useState<string | null>(null);
    const [winningCells, setWinningCells] = useState<string[]>([]);


    let freshSet;

    const [board, setBoard] = useState<string[][][]>(Array(9).fill(null).map(() =>
        Array(3).fill(null).map(() => Array(3).fill(''))
    ));
    const boardRef = useRef<string[][][]>(board);

    const localWinsRef = useRef<{ playerId: string; position: string[] }[]>([]);

    const [currentPlayer, setCurrentPlayer] = useState<string>('');
    const [moves, setMoves] = useState<string[][]>([]);
    const [closedCells, setClosedCells] = useState<Set<string>>(new Set());
    const [winningPositions, setWinningPositions] = useState<{ playerId: string; position: string[] }[]>([]);

    const columnLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
    const [myPlayerId, setMyPlayerId] = useState<string>('');

    useEffect(() => {
        console.log(closedCells);

        const playerId = localStorage.getItem('playerId') || '';
        const playerName = localStorage.getItem('playerName') || '';
        const playerSymbol = localStorage.getItem('playerSymbol') || '';
        const avatar = localStorage.getItem('playerAvatar') || '';

        socket.on('player_won', ({ winnerName }) => {
            alert(`🎉 Игрок ${winnerName} победил! Через 10 секунд Вы окажетесь в меню`);

            setTimeout(() => {
                socket.emit('end_game', roomName);
            }, 10000);
        });
        if (socket.connected) {
            socket.disconnect();
        }

        socket.auth = {playerId};  // Устанавливаем ID игрока
        socket.connect();

        setMyPlayerId(playerId);

        socket.emit('join_room', {
            name: roomName,
            player: {
                id: playerId,
                name: playerName,
                symbol: playerSymbol,
                avatar
            }
        });

        socket.on('redirect_to_menu', () => {
            navigate('/');
        });

        socket.emit('get_rooms');
        socket.emit('sync_state_request', roomName);

        socket.on('sync_state', (state) => {
            console.log("📥 Получена доска:", state.board);

            freshSet = new Set(state.closedCells || []);

            setClosedCells(freshSet);

            setBoard(state.board);
            boardRef.current = state.board;
            setMoves(state.moves);
            setCurrentPlayer(state.currentPlayerId);
            setWinningPositions(state.winningPositions);

            const allWins = [
                ...(state.winningPositions || []),
                ...localWinsRef.current
            ];
            const deduped = removeDuplicateWins(allWins);
            setWinningPositions(deduped);

            if (state.players && Array.isArray(state.players)) {
                setPlayers(state.players);
                playersRef.current = state.players;
            }
        });
        const removeDuplicateWins = (wins: { playerId: string; position: string[] }[]) => {
            const seen = new Set();
            return wins.filter(win => {
                const key = win.playerId + ':' + win.position.join(',');
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        };


        socket.on('move', (move) => {
            if (!move) return;
            const { field, x, y, player } = move;

            const key = `${field}-${x}-${y}-${player}`;
            setClosedCells(prev => {
                const updated = new Set(prev);
                updated.add(key);
                return updated;
            });

            const col = columnLabels[(field % 3) * 3 + x];
            const row = (Math.floor(field / 3) * 3 + y + 1).toString();
            const posLabel = `${col}${row}`;

            const thisPlayer = playersRef.current.find(p => p.id === player);
            if (thisPlayer) {
                setMoves(prev => [...prev, [thisPlayer.symbol, posLabel]]);
            }

            const ans = checking_winning_position(player, field, x, y, freshSet);
            const newWins = ans.map(cell => ({ playerId: player, position: [cell] }));

            setWinningPositions(prev => {
                const filtered = prev.filter(win => isWinningPositionStillValid(win.playerId, win.position));
                return [...filtered, ...newWins];
            });

            localWinsRef.current = localWinsRef.current.filter(win =>
                !(win.position.includes(posLabel) && win.playerId !== player)
            );
            if (ans.length > 0) {
                localWinsRef.current.push(...newWins);
            }

            // Показываем победу
            if (ans.length > 0) {
                setWinnerId(player);
                setWinningCells(ans);
            }

            const index = playersRef.current.findIndex(p => p.id === player);
            setCurrentPlayer(playersRef.current[(index + 1) % playersRef.current.length]?.id || '');
        });



        socket.on('rooms_list', (roomList) => {
            const room = roomList.find((r) => r.name === roomName);
            if (room && Array.isArray(room.players)) {
                setPlayers(room.players);
                playersRef.current = room.players;
            }
        });

        socket.on('game_started', ({players: serverPlayers, currentPlayer}) => {
            setPlayers(serverPlayers);
            playersRef.current = serverPlayers;
            setCurrentPlayer(currentPlayer);
        });

        socket.on('update_current_player', (playerId: string) => {
            setCurrentPlayer(playerId);
        });

        return () => {
            socket.off('sync_state');
            socket.off('move');
            socket.off('rooms_list');
            socket.off('game_started');
            socket.off('update_current_player');
            socket.off('redirect_to_menu');
            socket.disconnect();
        };
    }, [roomName]);


    const handleMove = (field: number, x: number, y: number) => {
        if (!myPlayerId || !currentPlayer) return;

        const isMyTurn = myPlayerId === currentPlayer;

        if (!isMyTurn) {
            console.warn('🚫 Это не ваш ход!');
            return;
        }

        // Центр нельзя
        if (field === 4 && x === 1 && y === 1) return;

        // Уже занята
        if (board[field][x][y] !== '') return;

        // Генерируем координату в формате A1..I9
        const col = columnLabels[(field % 3) * 3 + x];
        const row = (Math.floor(field / 3) * 3 + y + 1).toString();
        const cellLabel = `${col}${row}`;

        // Проверяем, есть ли эта клетка в списке выигрышных позиций текущего игрока
        const possibleWins = winningPositions
            .filter(w => w.playerId === myPlayerId)
            .map(w => w.position)
            .flat();

        socket.emit('player_move', {
            room: roomName,
            move: {
                field,
                x,
                y,
                player: myPlayerId,
            }
        });
        if (possibleWins.includes(cellLabel)) {
            const me = playersRef.current.find(p => p.id === myPlayerId);
            if (me) {
                socket.emit('player_won', {
                    room: roomName,
                    winnerName: me.name
                });
            }
            return;
        }
    };


    const isWinningPositionStillValid = (playerId: string, positions: string[]): boolean => {
        for (const pos of positions) {
            const colIndex = columnLabels.indexOf(pos[0]);
            const rowIndex = parseInt(pos.slice(1)) - 1;

            const field = Math.floor(rowIndex / 3) * 3 + Math.floor(colIndex / 3);
            const x = colIndex % 3;
            const y = rowIndex % 3;

            if (boardRef.current[field][x][y] !== playerId) return false;
        }
        return true;
    };


    const checking_winning_position = (player_id: string, field: number, x: number, y: number, closedCells: Set<string>) => {
        let flat_board = getFlatBoard();
        let now = y * 3 + x;
        let ans = [];
        console.log('check win clossed cells: ', closedCells)
        console.log(flat_board)

        // podpole 3x3
        for (let i = 0; i < 9; i++) {
            if (flat_board[field][i] == player_id) {
                if (now == 0) {
                    ans[ans.length] = checking_podpole([4, 8], field, i);
                    ans[ans.length] = checking_podpole([1, 2], field, i);
                    ans[ans.length] = checking_podpole([3, 6], field, i);
                }
                if (now == 1) {
                    ans[ans.length] = checking_podpole([0, 2], field, i);
                    ans[ans.length] = checking_podpole([4, 7], field, i);
                }
                if (now == 2) {
                    ans[ans.length] = checking_podpole([4, 6], field, i);
                    ans[ans.length] = checking_podpole([0, 1], field, i);
                    ans[ans.length] = checking_podpole([5, 8], field, i);
                }
                if (now == 3) {
                    ans[ans.length] = checking_podpole([4, 5], field, i);
                    ans[ans.length] = checking_podpole([0, 6], field, i);
                }
                if (now == 4) {
                    ans[ans.length] = checking_podpole([0, 2, 6, 8], field, i);
                    ans[ans.length] = checking_podpole([3, 5], field, i);
                    ans[ans.length] = checking_podpole([1, 7], field, i);
                }
                if (now == 5) {
                    ans[ans.length] = checking_podpole([3, 4], field, i);
                    ans[ans.length] = checking_podpole([2, 8], field, i);
                }
                if (now == 6) {
                    ans[ans.length] = checking_podpole([2, 4], field, i);
                    ans[ans.length] = checking_podpole([7, 8], field, i);
                    ans[ans.length] = checking_podpole([0, 3], field, i);
                }
                if (now == 7) {
                    ans[ans.length] = checking_podpole([6, 8], field, i);
                    ans[ans.length] = checking_podpole([1, 4], field, i);
                }
                if (now == 8) {
                    ans[ans.length] = checking_podpole([0, 4], field, i);
                    ans[ans.length] = checking_podpole([6, 7], field, i);
                    ans[ans.length] = checking_podpole([2, 5], field, i);
                }
            }
        }
        // checking down lines without diags
        const exclusions: { [key: number]: number[] } = {
            0: [1, 2, 3, 6],
            1: [0, 2, 4, 7],
            2: [0, 1, 5, 8],
            3: [4, 5, 0, 6],
            4: [3, 5, 1, 7],
            5: [3, 4, 2, 8],
            6: [7, 8, 0, 3],
            7: [6, 8, 1, 4],
            8: [6, 7, 2, 5],
        };
        const exclusions_diags: { [key: number]: number[] } = {
            0: [4, 8],
            1: [],
            2: [4, 6],
            3: [],
            4: [0, 2, 6, 8],
            5: [],
            6: [2, 4],
            7: [],
            8: [0, 4],
        };
        // линии вниз
        for (let j = 0; j < 9; j++) {
            if (boardRef.current[j][x][y] == player_id) {
                ans[ans.length] = checking_in_lines_without_diags(exclusions[field], j, x, y, player_id);
                ans[ans.length] = checking_in_lines_with_diags(exclusions_diags[field], j, x, y, player_id);
            }
        }

        delete ans[ans.indexOf('E5')]
        removeDups(ans)
        ans = ans.filter(pos => pos !== undefined && pos !== '');
        console.log(ans);
        return ans;

    }

    function removeDups<T>(array: T[]): T[] {
        return [...new Set(array)];
    }

    const checking_podpole = (ways: number[], field: number, i: number): string => {
        let way = ways;
        let win;
        if (way.includes(i)) {
            if (way.length == 4) {
                win = 8 - i;
            } else {
                win = way.find(element => element !== i);
            }
            if (boardRef.current[field][win % 3][Math.floor(win / 3)] == '')
                return (columnLabels[(field % 3) * 3 + win % 3] + (Math.floor(field / 3) * 3 + Math.floor(win / 3) + 1).toString())
            else return '';
        }
    }

    const checking_in_lines_without_diags = (ways: number[], field: number, x: number, y: number, player_id: string): string => {
        let way = ways;
        let win;
        let a = way.indexOf(field);
        console.log(a)

        if (a == 0) win = way[1];
        else if (a == 1) win = way[0];
        else if (a == 2) win = way[3];
        else if (a == 3) win = way[2];
        else return '';

        if (boardRef.current[win][x][y] == '')
            return (columnLabels[(win % 3) * 3 + x] + (Math.floor(win / 3) * 3 + y + 1).toString())
        else return '';
    };

    const checking_in_lines_with_diags = (ways: number[], field: number, x: number, y: number, player_id: string): string => {
        let way = ways;
        let win;
        if (way.length == 4) {
            win = 8 - field;
        } else if (way.includes(field)) {
            win = way.find(element => element !== field);
        } else return ''

        if (boardRef.current[win][x][y] == '')
            return (columnLabels[(win % 3) * 3 + x] + (Math.floor(win / 3) * 3 + y + 1).toString())
        else return '';
    };

    const getFlatBoard = (): string[][] => {
        const flatBoard: string[][] = Array(9).fill(0).map(() => Array(9).fill(''));
        let y = 0;
        for (let field = 0; field < 9; field++) {
            for (let x = 0; x < 9; x++) {
                flatBoard[field][x] = boardRef.current[field][x % 3][y];
                if (x % 3 == 2) y++;
            }
            y = 0;
        }
        return flatBoard;
    };


    return (
        <div className="app">
            <PlayerPanel players={players} currentPlayer={currentPlayer}/>
            <div className="main-content">
                <div className="winning-positions">
                    <h2>Выигрышные позиции</h2>
                    <ul>
                        {Array.isArray(players) && players.map((player) => {
                            const wins = winningPositions.filter(w => w.playerId === player.id);
                            return (
                                <li key={player.id}>
                                    <div style={{display: 'flex', alignItems: 'center', height: '34px'}} className={'centered-flex'}>
                                        <img className="symbol" src={player.symbol} alt={player.name}/>
                                        <ul style={{alignItems: 'center', display: 'flex'}}>
                                            {wins.map((win, idx) => (
                                                <li style={{margin: 'auto auto auto 5px'}} key={idx}>
                                                    {win.position}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
                <GameBoard board={board} onMove={handleMove} closedCells={closedCells} players={players} winningCells={winningCells}/>
                <MoveList moves={moves}/>
            </div>
        </div>
    );
};

export default Game;

