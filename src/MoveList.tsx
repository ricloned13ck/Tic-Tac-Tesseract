import React from 'react';
import '../src/styles/MoveList.css';

interface MoveListProps {
    moves: string[];
}

const MoveList: React.FC<MoveListProps> = ({ moves }) => {
    // Ограничиваем массив moves до последних 7 элементов
    const displayedMoves = moves.slice(-7);

    return (
        <div className="move-list">
            <h2>Ход игры</h2>
            <ul>
                {displayedMoves.map((move, index) => (
                    <li key={index}> <img src={move[0]} className="move_symbol"/><h4 className="moving">{move[1]}</h4></li>
                ))}
            </ul>
        </div>
    );
};

export default MoveList;