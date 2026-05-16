import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Chessboard from 'chessboardjsx';
import { Chess } from 'chess.js';
import {
    Button, Typography, Select, MenuItem, Box, Chip,
    Paper, CircularProgress, Divider, FormControl, InputLabel,
    List, ListItem, Slider, Tooltip, Dialog, DialogTitle,
    DialogContent, DialogContentText, DialogActions, Switch, FormControlLabel
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

// const API_URL = 'http://localhost:8000/move';
const API_URL = 'https://chess-backend-1-prqv.onrender.com/move';

// Unicode symbols for each piece type, indexed by the piece's own color
const PIECE_SYMBOLS = {
    w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
    b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
};
// Material point values
const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// ── Theme definitions ───────────────────────────────────────────────────
const getTheme = (isDark) => ({
    bg: isDark ? '#1a1a2e' : '#f0f2f5',
    paper: isDark ? '#16213e' : '#ffffff',
    headerBg: isDark ? '#0f3460' : '#1976d2',
    headerTitle: isDark ? '#e94560' : '#ffffff',
    headerSub: isDark ? '#8899bb' : '#bbdefb',
    textMain: isDark ? '#e0e0e0' : '#1e293b',
    textMuted: isDark ? '#546e7a' : '#64748b',
    primary: isDark ? '#90caf9' : '#1976d2',
    accent: isDark ? '#e94560' : '#d32f2f',
    border: isDark ? '#3a4a6a' : '#cbd5e1',
    menuBg: isDark ? '#1a2744' : '#ffffff',
    activeBg: isDark ? 'rgba(233,69,96,0.07)' : 'rgba(25,118,210,0.07)',
    activeBorder: isDark ? 'rgba(233,69,96,0.28)' : 'rgba(25,118,210,0.28)',
    boardBorder: isDark ? '#0f3460' : '#1976d2',
    boardDark: isDark ? '#1a3a5c' : '#b58863',
    boardLight: isDark ? '#e8d5b7' : '#f0d9b5',
    moveListBg: isDark ? '#0d1b2a' : '#f8fafc',
    moveListHover: isDark ? '#132032' : '#f1f5f9',
    moveListBorder: isDark ? '#1a2a3a' : '#e2e8f0',
    buttonStartBg: isDark ? '#1565c0' : '#1976d2',
    buttonStartHover: isDark ? '#0d47a1' : '#115293',
    buttonStopBg: isDark ? '#c62828' : '#d32f2f',
    buttonStopHover: isDark ? '#b71c1c' : '#b71c1c',
});

function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function CapturedPieces({ pieces, side, t }) {
    if (pieces.length === 0) {
        return <Typography sx={{ color: t.textMuted, fontSize: 13, lineHeight: '24px' }}>—</Typography>;
    }
    const opponentColor = side === 'w' ? 'b' : 'w';
    const sorted = [...pieces].sort((a, b) => (PIECE_VALUES[b] || 0) - (PIECE_VALUES[a] || 0));
    const material = pieces.reduce((s, p) => s + (PIECE_VALUES[p] || 0), 0);
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.2, flexWrap: 'wrap', minHeight: 24 }}>
            {sorted.map((piece, i) => (
                <Typography key={i} sx={{ fontSize: 17, lineHeight: 1, color: t.textMain }}>
                    {PIECE_SYMBOLS[opponentColor][piece]}
                </Typography>
            ))}
            {material > 0 && (
                <Typography sx={{ color: t.primary, fontSize: 11, ml: 0.5, fontWeight: 'bold' }}>
                    +{material}
                </Typography>
            )}
        </Box>
    );
}

function PlayerStrip({ side, modelLabel, captures, thinkMs, isThinking, isActive, gameOver, t }) {
    const isWhite = side === 'w';
    return (
        <Box sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            px: 1.5, py: 0.75,
            bgcolor: isActive && !gameOver ? t.activeBg : 'transparent',
            border: isActive && !gameOver ? `1px solid ${t.activeBorder}` : '1px solid transparent',
            borderRadius: 1.5, transition: 'all 0.3s',
        }}>
            {/* Left: colour dot + name */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
                <Box sx={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                    bgcolor: isWhite ? '#f5f5f5' : '#212121',
                    border: `2px solid ${t.border}`,
                }} />
                <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 11, color: t.primary, fontWeight: 'bold', lineHeight: 1.2 }}>
                        {isWhite ? 'White' : 'Black'}
                    </Typography>
                    <Typography noWrap sx={{ fontSize: 10, color: t.textMuted, lineHeight: 1.2, maxWidth: 130 }}>
                        {modelLabel}
                    </Typography>
                </Box>
            </Box>
            {/* Centre: captured pieces */}
            <Box sx={{ flex: 1, px: 1 }}>
                <CapturedPieces pieces={captures} side={side} t={t} />
            </Box>
            {/* Right: clock */}
            <Box sx={{
                display: 'flex', alignItems: 'center', gap: 0.5,
                fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold',
                color: isThinking ? '#ffb74d' : t.textMuted,
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
    
    // UI states
    const [isDarkMode, setIsDarkMode]       = useState(true);
    const [resetDialogOpen, setResetDialogOpen] = useState(false);

    // Captured pieces
    const [whiteCaptured, setWhiteCaptured] = useState([]);
    const [blackCaptured, setBlackCaptured] = useState([]);
    // Think-time accumulators
    const [whiteThinkMs, setWhiteThinkMs]   = useState(0);
    const [blackThinkMs, setBlackThinkMs]   = useState(0);
    const [tickMs, setTickMs]               = useState(0); 

    // Stable refs
    const isMovePendingRef   = useRef(false);
    const isGameStartedRef   = useRef(false);
    const gameOverRef        = useRef(false);
    const whiteModelRef      = useRef(whiteModel);
    const blackModelRef      = useRef(blackModel);
    const abortControllerRef = useRef(null);
    const moveDelayRef       = useRef(1500);
    const thinkSideRef       = useRef(null); 
    const thinkStartRef      = useRef(null); 

    useEffect(() => { isGameStartedRef.current = isGameStarted; }, [isGameStarted]);
    useEffect(() => { gameOverRef.current      = gameOver;       }, [gameOver]);
    useEffect(() => { whiteModelRef.current    = whiteModel;     }, [whiteModel]);
    useEffect(() => { blackModelRef.current    = blackModel;     }, [blackModel]);
    useEffect(() => { moveDelayRef.current     = moveDelay;      }, [moveDelay]);

    const t = useMemo(() => getTheme(isDarkMode), [isDarkMode]);

    const getSelectSx = useCallback((t) => ({
        color: t.textMain,
        '& .MuiOutlinedInput-notchedOutline': { borderColor: t.border },
        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: t.primary },
        '& .MuiSvgIcon-root': { color: t.primary },
    }), []);
    const getMenuProps = useCallback((t) => ({
        PaperProps: { sx: { bgcolor: t.menuBg, color: t.textMain } }
    }), []);

    // Live clock ticker
    useEffect(() => {
        if (!isLoading) { setTickMs(0); return; }
        const interval = setInterval(() => {
            setTickMs(thinkStartRef.current ? Date.now() - thinkStartRef.current : 0);
        }, 200);
        return () => clearInterval(interval);
    }, [isLoading]);

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

    const handleResetClick = () => {
        if (isGameStarted) {
            setResetDialogOpen(true);
        } else {
            resetGame();
        }
    };

    const confirmReset = () => {
        setResetDialogOpen(false);
        resetGame();
    };

    const applyMoveResult = useCallback((result) => {
        setFen(gameRef.current.fen());
        setLastMove({ from: result.from, to: result.to });
        setMoveHistory(prev => [...prev, { san: result.san, color: result.color }]);
        if (result.captured) {
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
            setStatus(finalStatus);
            setGameOver(true);
            gameOverRef.current = true;
            stopGame();
            return;
        }

        isMovePendingRef.current = true;
        const currentTurn = game.turn();
        const model       = currentTurn === 'w' ? whiteModelRef.current : blackModelRef.current;
        
        thinkSideRef.current  = currentTurn;
        thinkStartRef.current = Date.now();
        setIsLoading(true);

        abortControllerRef.current = new AbortController();

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fen: game.fen(), turn: currentTurn, model }),
                signal: abortControllerRef.current.signal,
            });
            if (!isGameStartedRef.current) return;
            if (!response.ok) throw new Error(`Server error: ${response.status}`);
            const data = await response.json();

            if (data.move) {
                const result = game.move(data.move);
                if (result) applyMoveResult(result);
            }

            if (data.gameOver) {
                const finalStatus = computeStatus();
                setStatus(finalStatus);
                setGameOver(true);
                gameOverRef.current = true;
                stopGame();
                return;
            }

            const newStatus = computeStatus();
            setStatus(newStatus);

            if (game.isGameOver()) {
                setGameOver(true);
                gameOverRef.current = true;
                stopGame();
                return;
            }
        } catch (error) {
            if (error.name === 'AbortError') return;
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
        }
    }, [computeStatus, stopGame, applyMoveResult]);

    const makeAutoMoveRef = useRef(makeAutoMove);
    useEffect(() => { makeAutoMoveRef.current = makeAutoMove; }, [makeAutoMove]);

    useEffect(() => {
        if (!isGameStarted || gameOver) return;
        const timer = setTimeout(() => makeAutoMoveRef.current(), moveDelayRef.current);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isGameStarted, gameOver, fen, retryTrigger]);

    const exportPGN = useCallback(() => {
        const pgn  = gameRef.current.pgn();
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

    const currentTurn = gameRef.current.turn();
    const displayWhiteMs = whiteThinkMs + (isLoading && thinkSideRef.current === 'w' ? tickMs : 0);
    const displayBlackMs = blackThinkMs + (isLoading && thinkSideRef.current === 'b' ? tickMs : 0);

    const squareStyles = lastMove ? {
        [lastMove.from]: { backgroundColor: 'rgba(255, 214, 0, 0.30)' },
        [lastMove.to]:   { backgroundColor: 'rgba(255, 214, 0, 0.55)' },
    } : {};

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
        <Box sx={{ minHeight: '100vh', bgcolor: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, transition: 'background-color 0.3s' }}>
            <Paper elevation={12} sx={{ maxWidth: 980, width: '100%', bgcolor: t.paper, color: t.textMain, borderRadius: 3, overflow: 'hidden', transition: 'background-color 0.3s' }}>

                {/* ── Header ──────────────────────────────────────────────── */}
                <Box sx={{ bgcolor: t.headerBg, p: 2.5, textAlign: 'center', position: 'relative' }}>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: t.headerTitle, letterSpacing: 3 }}>
                        ♟ AI Chess Arena
                    </Typography>
                    <Typography variant="subtitle2" sx={{ color: t.headerSub, mt: 0.5 }}>
                        LLM vs LLM · Watch AI models battle on the board
                    </Typography>
                    
                    {/* Theme Toggle Button */}
                    <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
                        <FormControlLabel
                            control={<Switch checked={isDarkMode} onChange={(e) => setIsDarkMode(e.target.checked)} color="default" />}
                            label={isDarkMode ? "🌙" : "☀️"}
                            sx={{ color: t.headerTitle, m: 0 }}
                        />
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>

                    {/* ── Left: model selectors, player strips, board, controls ── */}
                    <Box sx={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3, minWidth: 0 }}>

                        {/* Model selectors */}
                        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                            <FormControl size="small" sx={{ minWidth: 210 }}>
                                <InputLabel sx={{ color: t.primary }}>⬜ White Model</InputLabel>
                                <Select value={whiteModel} label="⬜ White Model"
                                    onChange={(e) => setWhiteModel(e.target.value)}
                                    disabled={isGameStarted} sx={getSelectSx(t)} MenuProps={getMenuProps(t)}>
                                    {MODELS.map(m => (
                                        <MenuItem key={m.value} value={m.value}>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                                                <Typography sx={{ fontSize: 13 }}>{m.label}</Typography>
                                                <Typography sx={{ fontSize: 10, color: t.textMuted }}>{m.provider}</Typography>
                                            </Box>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl size="small" sx={{ minWidth: 210 }}>
                                <InputLabel sx={{ color: t.primary }}>⬛ Black Model</InputLabel>
                                <Select value={blackModel} label="⬛ Black Model"
                                    onChange={(e) => setBlackModel(e.target.value)}
                                    disabled={isGameStarted} sx={getSelectSx(t)} MenuProps={getMenuProps(t)}>
                                    {MODELS.map(m => (
                                        <MenuItem key={m.value} value={m.value}>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                                                <Typography sx={{ fontSize: 13 }}>{m.label}</Typography>
                                                <Typography sx={{ fontSize: 10, color: t.textMuted }}>{m.provider}</Typography>
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
                                        fontWeight: 'bold', border: `1px solid ${t.accent}`,
                                    }} />
                            )}
                            <Typography variant="body2" sx={{
                                fontWeight: 'bold',
                                color: gameOver ? t.accent : isLoading ? '#ffb74d' : t.primary,
                            }}>
                                {status}
                            </Typography>
                            {isLoading && <CircularProgress size={16} sx={{ color: '#ffb74d' }} />}
                        </Box>

                        {/* Black player strip */}
                        <Box sx={{ width: '100%', maxWidth: 426, mb: 0.5 }}>
                            <PlayerStrip side="b" modelLabel={blackModelLabel}
                                captures={blackCaptured}
                                thinkMs={displayBlackMs}
                                isThinking={isLoading && thinkSideRef.current === 'b'}
                                isActive={currentTurn === 'b' && isGameStarted}
                                gameOver={gameOver} t={t} />
                        </Box>

                        {/* Chessboard */}
                        <Box sx={{ border: `3px solid ${t.boardBorder}`, borderRadius: 1, overflow: 'hidden', boxShadow: isDarkMode ? '0 0 32px rgba(233,69,96,0.25)' : '0 0 32px rgba(25,118,210,0.15)' }}>
                            <Chessboard
                                width={420}
                                position={fen}
                                squareStyles={squareStyles}
                                darkSquareStyle={{ backgroundColor: t.boardDark }}
                                lightSquareStyle={{ backgroundColor: t.boardLight }}
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
                                            applyMoveResult(result);
                                            const newStatus = computeStatus();
                                            setStatus(newStatus);
                                            if (game.isGameOver()) {
                                                setGameOver(true);
                                                gameOverRef.current = true;
                                            }
                                        } else {
                                            setFen(savedFen);
                                        }
                                    } catch {
                                        setFen(savedFen);
                                    }
                                }}
                            />
                        </Box>

                        {/* White player strip */}
                        <Box sx={{ width: '100%', maxWidth: 426, mt: 0.5 }}>
                            <PlayerStrip side="w" modelLabel={whiteModelLabel}
                                captures={whiteCaptured}
                                thinkMs={displayWhiteMs}
                                isThinking={isLoading && thinkSideRef.current === 'w'}
                                isActive={currentTurn === 'w' && isGameStarted}
                                gameOver={gameOver} t={t} />
                        </Box>

                        {/* Action buttons */}
                        <Box sx={{ display: 'flex', gap: 1.5, mt: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                            <Button variant="contained"
                                onClick={() => setIsGameStarted(!isGameStarted)}
                                disabled={gameOver}
                                sx={{
                                    bgcolor: isGameStarted ? t.buttonStopBg : t.buttonStartBg,
                                    '&:hover': { bgcolor: isGameStarted ? t.buttonStopHover : t.buttonStartHover },
                                    '&.Mui-disabled': { bgcolor: isDarkMode ? '#2a2a2a' : '#e0e0e0', color: isDarkMode ? '#555' : '#9e9e9e' },
                                    minWidth: 120, fontWeight: 'bold', fontSize: 15, py: 1,
                                }}>
                                {isGameStarted ? '⏹ Stop' : '▶ Start'}
                            </Button>
                            
                            <Button variant="outlined" onClick={handleResetClick}
                                sx={{
                                    borderColor: t.accent, color: t.accent, fontWeight: 'bold', py: 1,
                                    '&:hover': { borderColor: t.accent, color: t.accent, bgcolor: t.activeBg },
                                }}>
                                ↺ Reset
                            </Button>
                            
                            {moveHistory.length > 0 && (
                                <Tooltip title={isGameStarted ? "Cannot download PGN while game is running" : "Download game as .pgn file"} arrow>
                                    <span>
                                        <Button variant="outlined" onClick={exportPGN} disabled={isGameStarted}
                                            sx={{
                                                borderColor: t.textMuted, color: t.primary, fontWeight: 'bold', py: 1,
                                                '&:hover': { borderColor: t.primary, bgcolor: isDarkMode ? 'rgba(144,202,249,0.08)' : 'rgba(25,118,210,0.08)' },
                                                '&.Mui-disabled': { borderColor: isDarkMode ? '#555' : '#ccc', color: isDarkMode ? '#555' : '#aaa' }
                                            }}>
                                            ↓ PGN
                                        </Button>
                                    </span>
                                </Tooltip>
                            )}
                        </Box>

                        {/* Move delay slider */}
                        <Box sx={{ width: '100%', maxWidth: 426, mt: 2, px: 1 }}>
                            <Typography variant="caption" sx={{ color: t.textMuted, display: 'block', mb: 0.5, textAlign: 'center' }}>
                                Delay between moves: {moveDelay >= 1000 ? `${moveDelay / 1000}s` : `${moveDelay}ms`}
                            </Typography>
                            <Slider value={moveDelay} min={500} max={5000} step={500}
                                onChange={(_, v) => setMoveDelay(v)}
                                disabled={isLoading} marks
                                sx={{
                                    color: t.accent,
                                    '& .MuiSlider-thumb': { bgcolor: t.accent },
                                    '& .MuiSlider-track': { bgcolor: t.accent },
                                    '& .MuiSlider-rail':  { bgcolor: t.border },
                                }} />
                        </Box>
                    </Box>

                    <Divider orientation="vertical" flexItem sx={{ borderColor: t.border }} />

                    {/* ── Right: move history + match summary ─────────────── */}
                    <Box sx={{ flex: 1, p: 3, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

                        <Typography variant="h6" sx={{ color: t.accent, mb: 1.5, fontWeight: 'bold', letterSpacing: 1 }}>
                            📋 Move History
                        </Typography>

                        {/* Column headers */}
                        <Box sx={{ display: 'flex', gap: 1, px: 1, mb: 0.5 }}>
                            <Typography variant="caption" sx={{ color: t.textMuted, minWidth: 32 }}>#</Typography>
                            <Typography variant="caption" sx={{ color: t.textMuted, minWidth: 80 }}>White</Typography>
                            <Typography variant="caption" sx={{ color: t.textMuted }}>Black</Typography>
                        </Box>

                        {/* Move list */}
                        <Box sx={{ bgcolor: t.moveListBg, borderRadius: 2, flex: 1, overflow: 'auto', maxHeight: 420 }}>
                            {movePairs.length === 0 ? (
                                <Typography sx={{ color: t.textMuted, p: 3, textAlign: 'center', fontStyle: 'italic', fontSize: 14 }}>
                                    No moves yet. Press ▶ Start to begin!
                                </Typography>
                            ) : (
                                <List dense disablePadding>
                                    {movePairs.map((pair) => (
                                        <ListItem key={pair.number}
                                            sx={{
                                                borderBottom: `1px solid ${t.moveListBorder}`, py: 0.5,
                                                '&:last-child': { borderBottom: 'none' },
                                                '&:hover': { bgcolor: t.moveListHover },
                                            }}>
                                            <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', gap: 1 }}>
                                                <Typography sx={{ color: t.textMuted, minWidth: 32, fontSize: 12 }}>
                                                    {pair.number}.
                                                </Typography>
                                                <Typography sx={{ color: t.textMain, minWidth: 80, fontFamily: 'monospace', fontSize: 14, fontWeight: 'bold' }}>
                                                    {pair.white}
                                                </Typography>
                                                <Typography sx={{ color: t.textMuted, fontFamily: 'monospace', fontSize: 14 }}>
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
                        <Box sx={{ mt: 2, p: 1.5, bgcolor: t.moveListBg, borderRadius: 2 }}>
                            <Typography variant="caption" sx={{ color: t.textMuted, display: 'block' }}>
                                ⬜ White: <strong style={{ color: t.primary }}>{whiteModelLabel}</strong>
                            </Typography>
                            <Typography variant="caption" sx={{ color: t.textMuted, display: 'block', mt: 0.5 }}>
                                ⬛ Black: <strong style={{ color: t.primary }}>{blackModelLabel}</strong>
                            </Typography>
                            <Typography variant="caption" sx={{ color: t.textMuted, display: 'block', mt: 0.5 }}>
                                Total moves: <strong style={{ color: t.primary }}>{moveHistory.length}</strong>
                            </Typography>
                            <Divider sx={{ borderColor: t.moveListBorder, my: 0.75 }} />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption" sx={{ color: t.textMuted }}>
                                    ⬜ Think time: <strong style={{ color: t.primary }}>{formatTime(displayWhiteMs)}</strong>
                                </Typography>
                                <Typography variant="caption" sx={{ color: t.textMuted }}>
                                    ⬛ Think time: <strong style={{ color: t.primary }}>{formatTime(displayBlackMs)}</strong>
                                </Typography>
                            </Box>
                        </Box>

                        <Typography variant="caption" sx={{ color: t.textMuted, mt: 1.5, display: 'block', textAlign: 'center', fontSize: 11 }}>
                            Backend on Render.com — first move may take ~30 s (cold start)
                        </Typography>
                    </Box>
                </Box>
            </Paper>

            {/* Confirmation Dialog for Reset */}
            <Dialog 
                open={resetDialogOpen} 
                onClose={() => setResetDialogOpen(false)}
                PaperProps={{ sx: { bgcolor: t.paper, color: t.textMain } }}
            >
                <DialogTitle sx={{ color: t.accent }}>Reset Game?</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ color: t.textMuted }}>
                        Are you sure you want to reset the game? All current progress will be lost.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setResetDialogOpen(false)} sx={{ color: t.primary }}>Cancel</Button>
                    <Button onClick={confirmReset} color="error" variant="contained">Reset</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default ChessGame;