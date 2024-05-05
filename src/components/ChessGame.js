import React, { useState, useEffect } from 'react';
import Chessboard from 'chessboardjsx';
import { Chess } from 'chess.js';
import { Button, Container, Typography, Select, MenuItem } from '@mui/material';

function ChessGame() {
    const [game] = useState(new Chess());
    const [fen, setFen] = useState("start");
    const [prevFen, setPrevFen] = useState("start");
    const [isGameStarted, setIsGameStarted] = useState(false);
    const [whiteModel, setWhiteModel] = useState("gpt-3.5-turbo-instruct");
    const [blackModel, setBlackModel] = useState("gpt-3.5-turbo-instruct");

    const makeAutoMove = async () => {
        try {
            const model = (game.turn() === 'w') ? whiteModel : blackModel
            const response = await fetch('https://chess-backend-rt09.onrender.com/move', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ fen: game.fen(), turn: game.turn(), model: model })
            });

            if (!response.ok) {
                throw new Error('Network response was not ok.');
            }

            const data = await response.json();
            if (data.gameOver) {
                let winner = '';
                if (game.isCheckmate()) {
                    winner = (game.turn() === 'w') ? 'BLACK' : 'WHITE';
                }
                alert(`Game Over. Winner: ${winner}`);
                setIsGameStarted(false);
                return;
            }
            if (game.isStalemate() || game.isDraw() || game.isThreefoldRepetition()) {
                alert(`Game Over with a DRAW`);
                setIsGameStarted(false);
                return;
            }
            if (game.move(data.move)) {
                setFen(game.fen());
            }
        } catch (error) {
            console.error("Failed to fetch the move: ", error);
            makeAutoMove();
        }
    };

    // Effect to handle automatic moves
    useEffect(() => {
        if (isGameStarted) {
            const timer = setInterval(() => {
                makeAutoMove();
            }, 3000);

            return () => {
                clearInterval(timer); // Clear the timer when the game is stopped
            };
        }
    }, [isGameStarted]);

    useEffect(() => {
        setPrevFen(fen);
    }, [fen]);

    return (
        <Container maxWidth="md" style={{ marginTop: '20px', textAlign: 'center', border: '3px solid black', padding: '0' }}>
            <Typography variant="h4" align="center" gutterBottom>
                Chess Game
            </Typography>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ marginBottom: '10px' }}>
                    Select a LLM model for WHITE:
                    <Select
                        value={whiteModel}
                        onChange={(e) => setWhiteModel(e.target.value)}
                        style={{ marginLeft: '10px' }}
                    >
                        <MenuItem value="gpt-3.5-turbo-instruct">GPT 3.5 Turbo</MenuItem>
                        <MenuItem value="gemma-7b-it">Google: Gemma 7B</MenuItem>
                        <MenuItem value="openchat-7b">OpenChat 3.5</MenuItem>
                        <MenuItem value="mixtral-8x7b-32768">Groq</MenuItem>
                        <MenuItem value="nous-capybara-7b">Nous: Capybara 7B</MenuItem>
                        <MenuItem value="mistral-7b-instruct">Mistral 7B Instruct</MenuItem>
                    </Select>
                </span>
                <span>
                    Select a LLM model for BLACK:
                    <Select
                        value={blackModel}
                        onChange={(e) => setBlackModel(e.target.value)}
                        style={{ marginLeft: '10px' }}
                    >
                        <MenuItem value="gpt-3.5-turbo-instruct">GPT 3.5 Turbo</MenuItem>
                        <MenuItem value="gemma-7b-it">Google: Gemma 7B</MenuItem>
                        <MenuItem value="openchat-7b">OpenChat 3.5</MenuItem>
                        <MenuItem value="mixtral-8x7b-32768">Groq</MenuItem>
                        <MenuItem value="nous-capybara-7b">Nous: Capybara 7B</MenuItem>
                        <MenuItem value="mistral-7b-instruct">Mistral 7B Instruct</MenuItem>
                    </Select>
                </span>
            </div>

            <Typography style={{marginTop: '10px', marginBottom: '10px'}}>NOTE: Due to backend being deployed on render, it might take some time to fetch the moves due to down time. Please be patient. Thankyou :)</Typography>

            <Button
                variant="contained"
                color={isGameStarted ? "secondary" : "primary"}
                onClick={() => setIsGameStarted(!isGameStarted)}
                style={{ marginBottom: '10px', width: '25%' }}
            >
                {isGameStarted ? "Stop Game" : "Start Game"}
            </Button>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                <Chessboard
                    width={400}
                    position={fen}
                    onDrop={(move) => {
                        setPrevFen(fen);
                        const moveObj = { from: move.sourceSquare, to: move.targetSquare, promotion: "q" };
                        try {
                            if (game.move(moveObj)) {
                                setFen(game.fen());
                                makeAutoMove();
                            }
                        } catch (error) {
                            setFen(prevFen);
                        }
                    }}
                />
            </div>

        </Container>
    );
}

export default ChessGame;
