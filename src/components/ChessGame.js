import React, { useState, useEffect, useRef, useCallback } from 'react';
import Chessboard from 'chessboardjsx';
import { Chess } from 'chess.js';
import {
    Button, Typography, Select, MenuItem, Box, Chip,
    Paper, CircularProgress, Divider, FormControl, InputLabel,
    List, ListItem, Slider, Tooltip,
} from '@mui/material';

const MODELS = [
    // ── OpenAI ──────────────────────────────────────────────────────────────
    { value: 'gpt-4o-mini',            label: 'GPT-4o Mini (OpenAI)',          provider: 'OpenAI'      },
    { value: 'gpt-3.5-turbo-instruct', label: 'GPT-3.5 Turbo (OpenAI)',        provider: 'OpenAI'      },
    // ── Groq ─────────────────────────────────────────────────────────────────
    { value: 'llama-3.3-70b',          label: 'Llama 3.3 70B (Groq)',          provider: 'Groq'        },
    { value: 'llama-3.1-8b',           label: 'Llama 3.1 8B Instant (Groq)',   provider: 'Groq'        },
    { value: 'mixtral-8x7b-32768',     label: 'Mixtral 8x7B (Groq)',           provider: 'Groq'        },
    { value: 'gemma2-9b-groq',         label: 'Gemma 2 9B (Groq)',             provider: 'Groq'        },
    // ── OpenRouter free ──────────────────────────────────────────────────────
    { value: 'gemma-2-9b',             label: 'Gemma 2 9B (Google / OR)',      provider: 'OpenRouter'  },
    { value: 'llama-3.1-8b-or',        label: 'Llama 3.1 8B (Meta / OR)',      provider: 'OpenRouter'  },
    { value: 'qwen-2-7b',              label: 'Qwen 2 7B (Alibaba / OR)',      provider: 'OpenRouter'  },
    { value: 'phi-3-mini',             label: 'Phi-3 Mini 128k (MS / OR)',     provider: 'OpenRouter'  },
    { value: 'mistral-7b-instruct',    label: 'Mistral 7B Instruct (OR)',      provider: 'OpenRouter'  },
    { value: 'openchat-7b',            label: 'OpenChat 3.5 (OR)',             provider: 'OpenRouter'  },
    { value: 'nous-capybara-7b',       label: 'Nous Capybara 7B (OR)',         provider: 'OpenRouter'  },
    { value: 'gemma-7b-it',            label: 'Gemma 7B IT (Google / OR)',     provider: 'OpenRouter'  },
];

const API_URL = 'http://localhost:8000/move';

// Unicode symbols for each piece type, indexed by the piece's own color
const PIECE_SYMBOLS = {
    w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
    b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
};
// Material point values
const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const SELECT_SX = {
    color: '#e0e0e0',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#3a4a6a' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#90caf9' },
    '& .MuiSvgIcon-root': { color: '#90caf9' },
};
const MENU_PROPS = { PaperProps: { sx: { bgcolor: '#1a2744', color: '#e0e0e0' } } };

function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// Renders a compact row of captured piece symbols with material advantage badge.
// `pieces`  – array of piece-type chars ('p','n','b','r','q') captured BY this side.
// `side`    – 'w' or 'b' (the capturing side); determines opponent's piece color for symbols.
function CapturedPieces({ pieces, side }) {
    if (pieces.length === 0) {
        return <Typography sx={{ color: '#37474f', fontSize: 13, lineHeight: '24px' }}>—</Typography>;
    }
    const opponentColor = side === 'w' ? 'b' : 'w';
    const sorted = [...pieces].sort((a, b) => (PIECE_VALUES[b] || 0) - (PIECE_VALUES[a] || 0));
    const material = pieces.reduce((s, p) => s + (PIECE_VALUES[p] || 0), 0);
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.2, flexWrap: 'wrap', minHeight: 24 }}>
            {sorted.map((piece, i) => (
                <Typography key={i} sx={{ fontSize: 17, lineHeight: 1 }}>
                    {PIECE_SYMBOLS[opponentColor][piece]}
                </Typography>
            ))}
            {material > 0 && (
                <Typography sx={{ color: '#90caf9', fontSize: 11, ml: 0.5, fontWeight: 'bold' }}>
                    +{material}
                </Typography>
            )}
        </Box>
    );
}

// Player info strip shown above/below the board:
// circle colour indicator | model name | captured pieces | think clock
function PlayerStrip({ side, modelLabel, captures, thinkMs, isThinking, isActive, gameOver }) {
    const isWhite = side === 'w';
    return (
        <Box sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            px: 1.5, py: 0.75,
            bgcolor: isActive && !gameOver ? 'rgba(233,69,96,0.07)' : 'transparent',
            border: isActive && !gameOver ? '1px solid rgba(233,69,96,0.28)' : '1px solid transparent',
            borderRadius: 1.5, transition: 'all 0.3s',
        }}>
            {/* Left: colour dot + name */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
                <Box sx={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                    bgcolor: isWhite ? '#f5f5f5' : '#212121',
                    border: '2px solid #3a4a6a',
                }} />
                <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 11, color: '#90caf9', fontWeight: 'bold', lineHeight: 1.2 }}>
                        {isWhite ? 'White' : 'Black'}
                    </Typography>
                    <Typography noWrap sx={{ fontSize: 10, color: '#546e7a', lineHeight: 1.2, maxWidth: 130 }}>
                        {modelLabel}
                    </Typography>
                </Box>
            </Box>
            {/* Centre: captured pieces */}
            <Box sx={{ flex: 1, px: 1 }}>
                <CapturedPieces pieces={captures} side={side} />
            </Box>
            {/* Right: clock */}
            <Box sx={{
                display: 'flex', alignItems: 'center', gap: 0.5,
                fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold',
                color: isThinking ? '#ffb74d' : '#546e7a',
                flexShrink: 0,
            }}>
                {isThinking && <CircularProgress size={10} sx={{ color: '#ffb74d' }} />}
                {formatTime(thinkMs)}
            </Box>
        </Box>
    );
}

function ChessGame() {
    const gameRef = useRef(new Chess());

    const [fen, setFen]                     = useState('start');
    const [lastMove, setLastMove]           = useState(null);       // { from, to }
    const [isGameStarted, setIsGameStarted] = useState(false);
    const [isLoading, setIsLoading]         = useState(false);
    const [whiteModel, setWhiteModel]       = useState('gpt-3.5-turbo-instruct');
    const [blackModel, setBlackModel]       = useState('gpt-3.5-turbo-instruct');
    const [moveHistory, setMoveHistory]     = useState([]);
    const [status, setStatus]               = useState('White to move');
    const [gameOver, setGameOver]           = useState(false);
    const [retryTrigger, setRetryTrigger]   = useState(0);
    const [moveDelay, setMoveDelay]         = useState(1500);
    // Captured pieces: what each side has taken from the opponent
    const [whiteCaptured, setWhiteCaptured] = useState([]);
    const [blackCaptured, setBlackCaptured] = useState([]);
    // Think-time accumulators (committed when a move resolves)
    const [whiteThinkMs, setWhiteThinkMs]   = useState(0);
    const [blackThinkMs, setBlackThinkMs]   = useState(0);
    const [tickMs, setTickMs]               = useState(0); // live delta during current fetch

    // Stable refs so async callbacks always read fresh values
    const isMovePendingRef   = useRef(false);
    const isGameStartedRef   = useRef(false);
    const gameOverRef        = useRef(false);
    const whiteModelRef      = useRef(whiteModel);
    const blackModelRef      = useRef(blackModel);
    const abortControllerRef = useRef(null);
    const moveDelayRef       = useRef(1500);
    const thinkSideRef       = useRef(null);  // 'w' | 'b' — which side is thinking now
    const thinkStartRef      = useRef(null);  // Date.now() when current think started

    useEffect(() => { isGameStartedRef.current = isGameStarted; }, [isGameStarted]);
    useEffect(() => { gameOverRef.current      = gameOver;       }, [gameOver]);
    useEffect(() => { whiteModelRef.current    = whiteModel;     }, [whiteModel]);
    useEffect(() => { blackModelRef.current    = blackModel;     }, [blackModel]);
    useEffect(() => { moveDelayRef.current     = moveDelay;      }, [moveDelay]);

    // Live clock ticker — increments while a fetch is in-flight
    useEffect(() => {
        if (!isLoading) { setTickMs(0); return; }
        const interval = setInterval(() => {
            setTickMs(thinkStartRef.current ? Date.now() - thinkStartRef.current : 0);
        }, 200);
        return () => clearInterval(interval);
    }, [isLoading]);

    // Auto-scroll move list
    const historyEndRef = useRef(null);
    useEffect(() => {
        historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [moveHistory]);

    const computeStatus = useCallback(() => {
        const g = gameRef.current;
        if (g.isCheckmate())            return `Checkmate! ${g.turn() === 'w' ? 'Black' : 'White'} wins!`;
        if (g.isStalemate())            return 'Draw by Stalemate';
        if (g.isThreefoldRepetition())  return 'Draw by Threefold Repetition';
        if (g.isInsufficientMaterial()) return 'Draw by Insufficient Material';
        if (g.isDraw())                 return 'Draw (50-move rule)';
        if (g.isCheck())                return `Check! ${g.turn() === 'w' ? 'White' : 'Black'} to move`;
        return g.turn() === 'w' ? 'White to move' : 'Black to move';
    }, []);

    const stopGame = useCallback(() => {
        abortControllerRef.current?.abort();
        console.log('%c[Chess] ⏹ Game stopped by user', 'color:#ef9a9a;font-weight:bold');
        setIsGameStarted(false);
        isGameStartedRef.current = false;
    }, []);

    const resetGame = useCallback(() => {
        abortControllerRef.current?.abort();
        gameRef.current          = new Chess();
        isMovePendingRef.current = false;
        gameOverRef.current      = false;
        thinkSideRef.current     = null;
        thinkStartRef.current    = null;
        console.log('%c[Chess] ↺ Game reset', 'color:#80cbc4;font-weight:bold');
        setFen('start');
        setLastMove(null);
        setMoveHistory([]);
        setStatus('White to move');
        setGameOver(false);
        setIsGameStarted(false);
        setIsLoading(false);
        setRetryTrigger(0);
        setWhiteCaptured([]);
        setBlackCaptured([]);
        setWhiteThinkMs(0);
        setBlackThinkMs(0);
        setTickMs(0);
        isGameStartedRef.current = false;
    }, []);

    // Central helper: commit a chess.js MoveResult to all relevant state
    const applyMoveResult = useCallback((result) => {
        setFen(gameRef.current.fen());
        setLastMove({ from: result.from, to: result.to });
        setMoveHistory(prev => [...prev, { san: result.san, color: result.color }]);
        if (result.captured) {
            // result.color = side that moved; captured piece belongs to the opponent
            if (result.color === 'w') {
                setWhiteCaptured(prev => [...prev, result.captured]);
            } else {
                setBlackCaptured(prev => [...prev, result.captured]);
            }
        }
    }, []);

    const makeAutoMove = useCallback(async () => {
        if (isMovePendingRef.current || !isGameStartedRef.current || gameOverRef.current) return;
        const game = gameRef.current;

        if (game.isGameOver()) {
            const finalStatus = computeStatus();
            console.log(`%c[Chess] 🏁 Game already over before move fetch — ${finalStatus}`, 'color:#ef9a9a;font-weight:bold');
            setStatus(finalStatus);
            setGameOver(true);
            gameOverRef.current = true;
            stopGame();
            return;
        }

        isMovePendingRef.current = true;
        const currentTurn = game.turn();
        const turnLabel   = currentTurn === 'w' ? 'WHITE' : 'BLACK';
        const model       = currentTurn === 'w' ? whiteModelRef.current : blackModelRef.current;
        const modelLabel  = MODELS.find(m => m.value === model)?.label || model;
        const moveNum     = parseInt(game.fen().split(' ')[5], 10) || 1;

        thinkSideRef.current  = currentTurn;
        thinkStartRef.current = Date.now();
        setIsLoading(true);

        console.groupCollapsed(
            `%c[Chess] ♟ Move ${moveNum} — ${turnLabel} thinking…  (${modelLabel})`,
            'color:#90caf9;font-weight:bold'
        );
        console.log('FEN       :', game.fen());
        console.log('Model     :', model, `(${modelLabel})`);
        console.log('Legal moves:', game.moves().join(', '));

        abortControllerRef.current = new AbortController();

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fen: game.fen(), turn: currentTurn, model }),
                signal: abortControllerRef.current.signal,
            });
            if (!isGameStartedRef.current) {
                console.log('%c[Chess] Request completed but game was stopped — discarding result', 'color:#78909c');
                console.groupEnd();
                return;
            }
            if (!response.ok) throw new Error(`Server error: ${response.status}`);
            const data = await response.json();

            const elapsed = thinkStartRef.current ? Date.now() - thinkStartRef.current : 0;
            console.log('Server response:', data);
            console.log(`Think time    : ${(elapsed / 1000).toFixed(2)}s`);

            if (data.move) {
                const result = game.move(data.move);
                if (result) {
                    const pieceNames = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
                    const pieceName  = pieceNames[result.piece] || result.piece;
                    const capture    = result.captured ? `  captures ${pieceNames[result.captured] || result.captured}` : '';
                    console.log(
                        `%c  ✅ ${turnLabel} played: ${result.san}  [${pieceName} ${result.from}→${result.to}${capture}]`,
                        'color:#a5d6a7;font-weight:bold'
                    );
                    applyMoveResult(result);
                }
            }

            if (data.gameOver) {
                const finalStatus = computeStatus();
                console.log(`%c[Chess] 🏁 GAME OVER — ${finalStatus}`, 'color:#ef9a9a;font-weight:bold');
                console.groupEnd();
                setStatus(finalStatus);
                setGameOver(true);
                gameOverRef.current = true;
                stopGame();
                return;
            }

            const newStatus = computeStatus();
            setStatus(newStatus);
            console.log('Board status  :', newStatus);

            if (game.isGameOver()) {
                console.log(`%c[Chess] 🏁 GAME OVER (client-detected) — ${newStatus}`, 'color:#ef9a9a;font-weight:bold');
                console.groupEnd();
                setGameOver(true);
                gameOverRef.current = true;
                stopGame();
                return;
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('%c[Chess] ⛔ Fetch aborted (game stopped)', 'color:#78909c');
                console.groupEnd();
                return;
            }
            console.error('%c[Chess] ❌ Fetch error:', 'color:#ef9a9a;font-weight:bold', error.message);
            if (isGameStartedRef.current) {
                setStatus('Error fetching move — retrying…');
                setRetryTrigger(prev => prev + 1);
            }
        } finally {
            if (thinkStartRef.current) {
                const elapsed = Date.now() - thinkStartRef.current;
                if (thinkSideRef.current === 'w') {
                    setWhiteThinkMs(prev => prev + elapsed);
                } else {
                    setBlackThinkMs(prev => prev + elapsed);
                }
            }
            isMovePendingRef.current = false;
            setIsLoading(false);
            console.groupEnd();
        }
    }, [computeStatus, stopGame, applyMoveResult]);

    const makeAutoMoveRef = useRef(makeAutoMove);
    useEffect(() => { makeAutoMoveRef.current = makeAutoMove; }, [makeAutoMove]);

    // Sequential scheduling: next move only fires after fen updates (request completes)
    useEffect(() => {
        if (!isGameStarted || gameOver) return;
        const timer = setTimeout(() => makeAutoMoveRef.current(), moveDelayRef.current);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isGameStarted, gameOver, fen, retryTrigger]);

    // PGN export — creates and auto-clicks a temporary anchor element
    const exportPGN = useCallback(() => {
        const pgn  = gameRef.current.pgn();
        console.log('%c[Chess] ↓ Exporting PGN:', 'color:#80cbc4;font-weight:bold');
        console.log(pgn);
        const blob = new Blob([pgn], { type: 'text/plain' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `ai-chess-${new Date().toISOString().slice(0, 10)}.pgn`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, []);

    // ── Derived values ──────────────────────────────────────────────────────
    const currentTurn = gameRef.current.turn();

    // Show accumulated time + any live ongoing tick for the active side
    const displayWhiteMs = whiteThinkMs + (isLoading && thinkSideRef.current === 'w' ? tickMs : 0);
    const displayBlackMs = blackThinkMs + (isLoading && thinkSideRef.current === 'b' ? tickMs : 0);

    // Yellow highlight on the last moved squares (from → to)
    const squareStyles = lastMove ? {
        [lastMove.from]: { backgroundColor: 'rgba(255, 214, 0, 0.30)' },
        [lastMove.to]:   { backgroundColor: 'rgba(255, 214, 0, 0.55)' },
    } : {};

    // Group moves into pairs for the move list
    const movePairs = [];
    for (let i = 0; i < moveHistory.length; i += 2) {
        movePairs.push({
            number: Math.floor(i / 2) + 1,
            white:  moveHistory[i]?.san     || '',
            black:  moveHistory[i + 1]?.san || '',
        });
    }

    const whiteModelLabel = MODELS.find(m => m.value === whiteModel)?.label || whiteModel;
    const blackModelLabel = MODELS.find(m => m.value === blackModel)?.label || blackModel;

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
            <Paper elevation={12} sx={{ maxWidth: 980, width: '100%', bgcolor: '#16213e', color: '#e0e0e0', borderRadius: 3, overflow: 'hidden' }}>

                {/* ── Header ──────────────────────────────────────────────── */}
                <Box sx={{ bgcolor: '#0f3460', p: 2.5, textAlign: 'center' }}>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#e94560', letterSpacing: 3 }}>
                        ♟ AI Chess Arena
                    </Typography>
                    <Typography variant="subtitle2" sx={{ color: '#8899bb', mt: 0.5 }}>
                        LLM vs LLM · Watch AI models battle on the board
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>

                    {/* ── Left: model selectors, player strips, board, controls ── */}
                    <Box sx={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3, minWidth: 0 }}>

                        {/* Model selectors */}
                        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                            <FormControl size="small" sx={{ minWidth: 210 }}>
                                <InputLabel sx={{ color: '#90caf9' }}>⬜ White Model</InputLabel>
                                <Select value={whiteModel} label="⬜ White Model"
                                    onChange={(e) => setWhiteModel(e.target.value)}
                                    disabled={isGameStarted} sx={SELECT_SX} MenuProps={MENU_PROPS}>
                                    {MODELS.map(m => (
                                        <MenuItem key={m.value} value={m.value}>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                                                <Typography sx={{ fontSize: 13 }}>{m.label}</Typography>
                                                <Typography sx={{ fontSize: 10, color: '#546e7a' }}>{m.provider}</Typography>
                                            </Box>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl size="small" sx={{ minWidth: 210 }}>
                                <InputLabel sx={{ color: '#90caf9' }}>⬛ Black Model</InputLabel>
                                <Select value={blackModel} label="⬛ Black Model"
                                    onChange={(e) => setBlackModel(e.target.value)}
                                    disabled={isGameStarted} sx={SELECT_SX} MenuProps={MENU_PROPS}>
                                    {MODELS.map(m => (
                                        <MenuItem key={m.value} value={m.value}>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                                                <Typography sx={{ fontSize: 13 }}>{m.label}</Typography>
                                                <Typography sx={{ fontSize: 10, color: '#546e7a' }}>{m.provider}</Typography>
                                            </Box>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>

                        {/* Status bar */}
                        <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                            {!gameOver && (
                                <Chip label={currentTurn === 'w' ? '⬜ White' : '⬛ Black'} size="small"
                                    sx={{
                                        bgcolor: currentTurn === 'w' ? '#f5f5f5' : '#212121',
                                        color:   currentTurn === 'w' ? '#000'    : '#fff',
                                        fontWeight: 'bold', border: '1px solid #e94560',
                                    }} />
                            )}
                            <Typography variant="body2" sx={{
                                fontWeight: 'bold',
                                color: gameOver ? '#e94560' : isLoading ? '#ffb74d' : '#90caf9',
                            }}>
                                {status}
                            </Typography>
                            {isLoading && <CircularProgress size={16} sx={{ color: '#ffb74d' }} />}
                        </Box>

                        {/* Black player strip (top — black plays from the top) */}
                        <Box sx={{ width: '100%', maxWidth: 426, mb: 0.5 }}>
                            <PlayerStrip side="b" modelLabel={blackModelLabel}
                                captures={blackCaptured}
                                thinkMs={displayBlackMs}
                                isThinking={isLoading && thinkSideRef.current === 'b'}
                                isActive={currentTurn === 'b' && isGameStarted}
                                gameOver={gameOver} />
                        </Box>

                        {/* Chessboard with last-move highlight */}
                        <Box sx={{ border: '3px solid #0f3460', borderRadius: 1, overflow: 'hidden', boxShadow: '0 0 32px rgba(233,69,96,0.25)' }}>
                            <Chessboard
                                width={420}
                                position={fen}
                                squareStyles={squareStyles}
                                darkSquareStyle={{ backgroundColor: '#1a3a5c' }}
                                lightSquareStyle={{ backgroundColor: '#e8d5b7' }}
                                onDrop={(move) => {
                                    if (isGameStarted) return;
                                    const game = gameRef.current;
                                    const savedFen = game.fen();
                                    try {
                                        const result = game.move({
                                            from: move.sourceSquare,
                                            to: move.targetSquare,
                                            promotion: 'q',
                                        });
                                        if (result) {
                                            const pieceNames = { p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' };
                                            console.log(
                                                `%c[Chess] 🖱 Manual move: ${result.san}  [${pieceNames[result.piece] || result.piece} ${result.from}→${result.to}]`,
                                                'color:#ce93d8;font-weight:bold'
                                            );
                                            applyMoveResult(result);
                                            const newStatus = computeStatus();
                                            setStatus(newStatus);
                                            if (game.isGameOver()) {
                                                console.log(`%c[Chess] 🏁 GAME OVER after manual move — ${newStatus}`, 'color:#ef9a9a;font-weight:bold');
                                                setGameOver(true);
                                                gameOverRef.current = true;
                                            }
                                        } else {
                                            console.log('%c[Chess] ⚠ Illegal drop ignored', 'color:#ffb74d');
                                            setFen(savedFen);
                                        }
                                    } catch {
                                        console.log('%c[Chess] ⚠ Drop threw an exception — reverting', 'color:#ffb74d');
                                        setFen(savedFen);
                                    }
                                }}
                            />
                        </Box>

                        {/* White player strip (bottom) */}
                        <Box sx={{ width: '100%', maxWidth: 426, mt: 0.5 }}>
                            <PlayerStrip side="w" modelLabel={whiteModelLabel}
                                captures={whiteCaptured}
                                thinkMs={displayWhiteMs}
                                isThinking={isLoading && thinkSideRef.current === 'w'}
                                isActive={currentTurn === 'w' && isGameStarted}
                                gameOver={gameOver} />
                        </Box>

                        {/* Action buttons */}
                        <Box sx={{ display: 'flex', gap: 1.5, mt: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                            <Button variant="contained"
                                onClick={() => {
                                    if (gameOver) return;
                                    const next = !isGameStarted;
                                    if (next) {
                                        const wLabel = MODELS.find(m => m.value === whiteModel)?.label || whiteModel;
                                        const bLabel = MODELS.find(m => m.value === blackModel)?.label || blackModel;
                                        console.log('%c[Chess] ▶ Game started', 'color:#a5d6a7;font-weight:bold');
                                        console.log(`  White: ${wLabel}`);
                                        console.log(`  Black: ${bLabel}`);
                                    }
                                    setIsGameStarted(next);
                                }}
                                disabled={gameOver}
                                sx={{
                                    bgcolor: isGameStarted ? '#c62828' : '#1565c0',
                                    '&:hover': { bgcolor: isGameStarted ? '#b71c1c' : '#0d47a1' },
                                    '&.Mui-disabled': { bgcolor: '#2a2a2a', color: '#555' },
                                    minWidth: 120, fontWeight: 'bold', fontSize: 15, py: 1,
                                }}>
                                {isGameStarted ? '⏹ Stop' : '▶ Start'}
                            </Button>
                            <Button variant="outlined" onClick={resetGame}
                                sx={{
                                    borderColor: '#e94560', color: '#e94560', fontWeight: 'bold', py: 1,
                                    '&:hover': { borderColor: '#ff6b6b', color: '#ff6b6b', bgcolor: 'rgba(233,69,96,0.08)' },
                                }}>
                                ↺ Reset
                            </Button>
                            {moveHistory.length > 0 && (
                                <Tooltip title="Download game as .pgn file" arrow>
                                    <Button variant="outlined" onClick={exportPGN}
                                        sx={{
                                            borderColor: '#546e7a', color: '#90caf9', fontWeight: 'bold', py: 1,
                                            '&:hover': { borderColor: '#90caf9', bgcolor: 'rgba(144,202,249,0.08)' },
                                        }}>
                                        ↓ PGN
                                    </Button>
                                </Tooltip>
                            )}
                        </Box>

                        {/* Move delay slider */}
                        <Box sx={{ width: '100%', maxWidth: 426, mt: 2, px: 1 }}>
                            <Typography variant="caption" sx={{ color: '#78909c', display: 'block', mb: 0.5, textAlign: 'center' }}>
                                Delay between moves: {moveDelay >= 1000 ? `${moveDelay / 1000}s` : `${moveDelay}ms`}
                            </Typography>
                            <Slider value={moveDelay} min={500} max={5000} step={500}
                                onChange={(_, v) => setMoveDelay(v)}
                                disabled={isLoading} marks
                                sx={{
                                    color: '#e94560',
                                    '& .MuiSlider-thumb': { bgcolor: '#e94560' },
                                    '& .MuiSlider-track': { bgcolor: '#e94560' },
                                    '& .MuiSlider-rail':  { bgcolor: '#3a4a6a' },
                                }} />
                        </Box>
                    </Box>

                    <Divider orientation="vertical" flexItem sx={{ borderColor: '#0f3460' }} />

                    {/* ── Right: move history + match summary ─────────────── */}
                    <Box sx={{ flex: 1, p: 3, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

                        <Typography variant="h6" sx={{ color: '#e94560', mb: 1.5, fontWeight: 'bold', letterSpacing: 1 }}>
                            📋 Move History
                        </Typography>

                        {/* Column headers */}
                        <Box sx={{ display: 'flex', gap: 1, px: 1, mb: 0.5 }}>
                            <Typography variant="caption" sx={{ color: '#546e7a', minWidth: 32 }}>#</Typography>
                            <Typography variant="caption" sx={{ color: '#546e7a', minWidth: 80 }}>White</Typography>
                            <Typography variant="caption" sx={{ color: '#546e7a' }}>Black</Typography>
                        </Box>

                        {/* Move list */}
                        <Box sx={{ bgcolor: '#0d1b2a', borderRadius: 2, flex: 1, overflow: 'auto', maxHeight: 420 }}>
                            {movePairs.length === 0 ? (
                                <Typography sx={{ color: '#455a64', p: 3, textAlign: 'center', fontStyle: 'italic', fontSize: 14 }}>
                                    No moves yet. Press ▶ Start to begin!
                                </Typography>
                            ) : (
                                <List dense disablePadding>
                                    {movePairs.map((pair) => (
                                        <ListItem key={pair.number}
                                            sx={{
                                                borderBottom: '1px solid #1a2a3a', py: 0.5,
                                                '&:last-child': { borderBottom: 'none' },
                                                '&:hover': { bgcolor: '#132032' },
                                            }}>
                                            <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', gap: 1 }}>
                                                <Typography sx={{ color: '#546e7a', minWidth: 32, fontSize: 12 }}>
                                                    {pair.number}.
                                                </Typography>
                                                <Typography sx={{ color: '#f5f5f5', minWidth: 80, fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold' }}>
                                                    {pair.white}
                                                </Typography>
                                                <Typography sx={{ color: '#b0bec5', fontFamily: 'monospace', fontSize: 14 }}>
                                                    {pair.black}
                                                </Typography>
                                            </Box>
                                        </ListItem>
                                    ))}
                                    <div ref={historyEndRef} />
                                </List>
                            )}
                        </Box>

                        {/* Match summary */}
                        <Box sx={{ mt: 2, p: 1.5, bgcolor: '#0d1b2a', borderRadius: 2 }}>
                            <Typography variant="caption" sx={{ color: '#78909c', display: 'block' }}>
                                ⬜ White: <strong style={{ color: '#90caf9' }}>{whiteModelLabel}</strong>
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#78909c', display: 'block', mt: 0.5 }}>
                                ⬛ Black: <strong style={{ color: '#90caf9' }}>{blackModelLabel}</strong>
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#78909c', display: 'block', mt: 0.5 }}>
                                Total moves: <strong style={{ color: '#90caf9' }}>{moveHistory.length}</strong>
                            </Typography>
                            <Divider sx={{ borderColor: '#1a2a3a', my: 0.75 }} />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption" sx={{ color: '#78909c' }}>
                                    ⬜ Think time: <strong style={{ color: '#90caf9' }}>{formatTime(displayWhiteMs)}</strong>
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#78909c' }}>
                                    ⬛ Think time: <strong style={{ color: '#90caf9' }}>{formatTime(displayBlackMs)}</strong>
                                </Typography>
                            </Box>
                        </Box>

                        <Typography variant="caption" sx={{ color: '#37474f', mt: 1.5, display: 'block', textAlign: 'center', fontSize: 11 }}>
                            Backend on Render.com — first move may take ~30 s (cold start)
                        </Typography>
                    </Box>
                </Box>
            </Paper>
        </Box>
    );
}

export default ChessGame;
