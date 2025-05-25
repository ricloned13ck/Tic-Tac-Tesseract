import React from 'react';
import '../src/styles/GameBoard.css';
import { Player } from './types.ts';

interface GameBoardProps {
    board: string[][][];
    onMove: (field: number, x: number, y: number) => void;
    closedCells: Set<string>;
    players: Player[];
    winningCells: string[]; // ← добавь это
}

const GameBoard: React.FC<GameBoardProps> = ({ board, onMove, closedCells, players }) => {
    const columnLabels = ['A', 'B', 'C', '', 'D', 'E', 'F', '', 'G', 'H', 'I'];
    const rowLabels = ['1', '2', '3', '', '4', '5', '6', '', '7', '8', '9'];
    return (
        <div className="game-board">
            <div></div>
            <div className="alph">
                {columnLabels.map((label, index) => (
                    <div key={index} className="label">
                        {label}
                    </div>
                ))}
            </div>

            <div className="numbers">
                {rowLabels.map((label, index) => (
                    <div key={index} className="label">
                        {label}
                    </div>
                ))}
            </div>

            <div className="fields">
                {board.map((field, fieldIndex) => (
                    <div key={fieldIndex} className="field">
                        {field.map((row, rowIndex) => (
                            <div key={rowIndex} className="row">
                                {row.map((cell, cellIndex) => {
                                    const player = cell ? players.find((p) => p.id === cell) : null;
                                    const avatarSrc = player ? player.symbol : '';

                                    let cellKey;
                                    if (player) {
                                        cellKey = `${fieldIndex}-${rowIndex}-${cellIndex}-${player.id}`;
                                    }
                                    else {
                                        cellKey = `${fieldIndex}-${rowIndex}-${cellIndex}-${null}`;
                                    }
                                    const isClosed = closedCells.has(cellKey);
                                    const isCenterCell = fieldIndex === 4 && rowIndex === 1 && cellIndex === 1;
                                    return (

                                        <div
                                            key={cellIndex}
                                            className={`cell ${isClosed ? 'closed' : ''} ${isCenterCell ? 'center-closed' : ''}`}
                                            onClick={() => !isClosed && !isCenterCell && onMove(fieldIndex, rowIndex, cellIndex)}
                                        >
                                            {avatarSrc && (
                                                <img src={avatarSrc} className="cell_symbol"  />
                                            )}

                                        </div>
                                    );
                                })}
                            </div>
                        ))}

                    </div>
                ))}
            </div>
        </div>
    );
};

export default GameBoard;