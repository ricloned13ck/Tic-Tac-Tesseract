export interface Move{
    field: number;
    x: number;
    y: number;
    player: number;
}

export interface Player{
    id: string;
    name: string;
    symbol: string;
    avatar: string;
    metaSymbol?: string;
}

export type Room = {
    name: string;
    players: Player[];
    password?: string;
    maxPlayers?: number;
    currentPlayerId?: string;
};
