/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import PuzzleGame from './components/PuzzleGame';
import { Player, COLOR_P1 } from './lib/puzzle-engine';
import { Camera, Gamepad, Instagram, RefreshCw, Trophy, Languages, Globe } from 'lucide-react';

type Mode = 'single' | 'multi';
type Language = 'en' | 'ar';
type GameType = 'puzzle' | 'pop' | 'trace' | 'catch' | 'strike' | 'dodge' | 'sandbox';

interface GameInfo {
  id: GameType;
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: string;
}

const TRANSLATIONS = {
  en: {
    titlePart1: "YOUR FACE",
    titlePart2: "PUZZLE",
    modeSingle: "SINGLE PLAYER",
    modeMulti: "MULTIPLAYER",
    modeSingleDesc: "Solve the puzzle of your face as fast as possible.",
    modeMultiDesc: "More fun with two players! Race to see who's fastest.",
    howToPlayTitle: "How to play:",
    howToPlayDesc: "Master your hand gestures to solve puzzles, catch nodes, and survive laser beams! <br/> <span class=\"text-white font-medium\">Pinch & move</span> to interact with the digital world.",
    connectingCamera: "CONNECTING CAMERA...",
    startGame: "START GAME",
    winTitleSingle: "MISSION COMPLETED!",
    winTitleMulti: "PLAYER {id} WINS!",
    timeRecord: "Time Record",
    playAgain: "Play Again",
    instructionHands: "PLAYER {id}: Raise 2 Hands",
    instructionBox: "Form a index & thumb box to frame your face.",
    instructionSnap: "Pinch both hands to snap a photo!",
    waitingOpponent: "Waiting for opponent...",
    timeLabel: "TIME: ",
    devLabel: "Developed by",
    clubLabel: "Club"
  },
  ar: {
    titlePart1: "لغز",
    titlePart2: "وجهك",
    modeSingle: "لاعب واحد",
    modeMulti: "لاعبان",
    modeSingleDesc: "حل لغز وجهك بأسرع ما يمكن.",
    modeMultiDesc: "أكثر متعة مع لاعبين! تسابق لمعرفة من الأسرع.",
    howToPlayTitle: "كيفية اللعب:",
    howToPlayDesc: "أتقن إيماءات يدك لحل الألغاز، والتقاط العقد، والبقاء على قيد الحياة تحت أشعة الليزر! <br/> <span class=\"text-white font-medium\">اقرص وحرك</span> للتفاعل مع العالم الرقمي.",
    connectingCamera: "جاري الاتصال بالكاميرا...",
    startGame: "ابدأ اللعبة",
    winTitleSingle: "تمت المهمة!",
    winTitleMulti: "اللاعب {id} فاز!",
    timeRecord: "سجل الوقت",
    playAgain: "العب مرة أخرى",
    instructionHands: "اللاعب {id}: ارفع يديك",
    instructionBox: "شكل مربعاً بالسبابة والإبهام لتأطير وجهك.",
    instructionSnap: "اقرص بكلتا يديك لالتقاط الصور!",
    waitingOpponent: "بانتظار الخصم...",
    timeLabel: "الوقت: ",
    devLabel: "تطوير",
    clubLabel: "نادي"
  }
};

export default function App() {
  const [language, setLanguage] = useState<Language>('en');
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null);
  const [selectedGame, setSelectedGame] = useState<GameType>('puzzle');
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [winImage, setWinImage] = useState<string | null>(null);

  const t = useMemo(() => TRANSLATIONS[language], [language]);
  const isRTL = language === 'ar';

  const games = useMemo<GameInfo[]>(() => [
    { id: 'puzzle', icon: <Gamepad className="w-6 h-6" />, title: language === 'en' ? 'FACE PUZZLE' : 'لغز الوجه', desc: language === 'en' ? 'Snapshot your face and solve the 3x3 puzzle.' : 'القط صورة لوجهك وحل لغز 3x3.', color: '#00FFFF' },
    { id: 'pop', icon: <Camera className="w-6 h-6" />, title: language === 'en' ? 'QUANTUM POP' : 'فرقعة الكم', desc: language === 'en' ? 'Pinch or touch the glowing nodes as fast as possible.' : 'اقرص أو المس العقد المتوهجة بأسرع ما يمكن.', color: '#FF00FF' },
    { id: 'catch', icon: <RefreshCw className="w-6 h-6" />, title: language === 'en' ? 'DIGITAL CATCH' : 'القبض الرقمي', desc: language === 'en' ? 'Move your hands to catch falling data nodes.' : 'حرك يديك لالتقاط عقد البيانات الساقطة.', color: '#FFFF00' },
    { id: 'strike', icon: <Globe className="w-6 h-6" />, title: language === 'en' ? 'SECTOR STRIKE' : 'ضرب القطاع', desc: language === 'en' ? 'Strike the highlighted sectors of the grid.' : 'اضرب القطاعات المميزة في الشبكة.', color: '#00FF00' },
    { id: 'trace', icon: <Languages className="w-6 h-6" />, title: language === 'en' ? 'NEON TRACE' : 'تتبع النيون', desc: language === 'en' ? 'Follow the neon path accurately with your finger.' : 'اتبع مسار النيون بدقة بإصبعك.', color: '#A020F0' },
    { id: 'dodge', icon: <Trophy className="w-6 h-6" />, title: language === 'en' ? 'LASER DODGE' : 'تفادي الليزر', desc: language === 'en' ? 'Avoid the lethal red laser beams to survive.' : 'تجنب أشعة الليزر الحمراء القاتلة للبقاء على قيد الحياة.', color: '#FF0000' },
    { id: 'sandbox', icon: <Globe className="w-6 h-6" />, title: language === 'en' ? 'SANDBOX' : 'صندوق الرمل', desc: language === 'en' ? 'Interact with particles in a free digital space.' : 'تفاعل مع الجسيمات في مساحة رقمية حرة.', color: '#0000FF' },
  ], [language]);

  const activeGame = useMemo(() => games.find(g => g.id === selectedGame) || games[0], [games, selectedGame]);

  const handleCameraReady = useCallback(() => {
    setIsCameraOn(true);
  }, []);

  const handleStartGame = () => {
    if (isCameraOn && selectedMode) {
      setIsPlaying(true);
    }
  };

  const handleWin = useCallback((winnerPlayer: Player) => {
    if (winnerPlayer.gameType === 'puzzle') {
        const width = winnerPlayer.box?.w || 1;
        const height = winnerPlayer.box?.h || 1;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tctx = tempCanvas.getContext('2d');
        
        if (tctx) {
          winnerPlayer.pieces.forEach(p => {
            tctx.drawImage(p.image, p.drawX - (winnerPlayer.box?.x || 0), p.drawY - (winnerPlayer.box?.y || 0));
          });
          setWinImage(tempCanvas.toDataURL('image/png'));
        }
    } else {
        setWinImage(null);
    }

    setWinner(winnerPlayer);
    setIsPlaying(false);
  }, []);

  const handlePlayAgain = () => {
    setWinner(null);
    setWinImage(null);
    setIsPlaying(false);
    setSelectedMode(null);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'ar' : 'en');
  };

  return (
    <div className={`relative w-screen h-screen bg-[#050505] overflow-hidden select-none ${isRTL ? 'font-sans' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Background Layer: Game & Hands */}
      <PuzzleGame 
        mode={selectedMode || 'single'} 
        onCameraReady={handleCameraReady} 
        onWin={handleWin}
        isActive={isPlaying}
        translations={t}
        gameType={selectedGame}
        gameColor={activeGame.color}
      />

      {/* Language Toggle Overlay (Top Right/Left) */}
      {!isPlaying && !winner && (
        <div className={`absolute top-6 ${isRTL ? 'left-6' : 'right-6'} z-[60]`}>
          <button 
            onClick={toggleLanguage}
            className="flex items-center gap-2 bg-white/5 border border-white/10 text-white px-4 py-2 rounded-full hover:bg-white/10 transition-all font-tech text-xs tracking-wider"
          >
            <Globe className="w-4 h-4" />
            {language === 'en' ? 'العربية' : 'ENGLISH'}
          </button>
        </div>
      )}

      {/* Main Menu Overlay */}
      <AnimatePresence>
        {!isPlaying && !winner && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-start py-10 md:py-20 bg-[#050505]/95 backdrop-blur-sm overflow-y-auto scrollbar-hide"
          >
            <div className="text-center mb-10">
              <h1 className="text-5xl md:text-7xl font-tech font-black tracking-tight uppercase leading-none">
                <span className="text-cyan-400 drop-shadow-[0_0_15px_rgba(0,255,255,0.8)]">{t.titlePart1}</span>
                <br />
                <span className="text-pink-500 drop-shadow-[0_0_15px_rgba(255,0,255,0.8)]">{t.titlePart2}</span>
              </h1>
            </div>

            {/* Game Selection Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 px-6 max-w-5xl">
                {games.map(game => (
                    <div 
                        key={game.id}
                        onClick={() => setSelectedGame(game.id)}
                        className={`cursor-pointer border-2 p-4 rounded-xl flex flex-col items-center text-center transition-all ${
                            selectedGame === game.id 
                                ? 'bg-white/10 scale-105' 
                                : 'bg-black/40 border-white/10 hover:border-white/30'
                        }`}
                        style={{ borderColor: selectedGame === game.id ? game.color : undefined }}
                    >
                        <div 
                          className="p-3 rounded-full mb-3 transition-transform duration-300"
                          style={{ 
                            backgroundColor: `${game.color}22`,
                            color: game.color,
                            boxShadow: selectedGame === game.id ? `0 0 15px ${game.color}66` : undefined,
                            transform: selectedGame === game.id ? 'scale(1.1)' : 'scale(1)'
                          }}
                        >
                            {game.icon}
                        </div>
                        <span className="font-tech font-bold text-xs text-white tracking-wider">{game.title}</span>
                    </div>
                ))}
            </div>

            <div className="flex flex-col md:flex-row gap-6 mb-10">
              {/* Single Player Card */}
              <div 
                onClick={() => setSelectedMode('single')}
                className={`mode-card mode-card-single border-2 rounded-2xl p-6 w-72 flex flex-col items-center text-center bg-black/40 ${selectedMode === 'single' ? 'selected' : ''}`}
              >
                <div className="bg-cyan-950 p-3 rounded-full mb-4">
                  <Gamepad className="w-8 h-8 text-cyan-400" />
                </div>
                <span className="font-tech font-bold text-xl text-cyan-400 mb-2">{t.modeSingle}</span>
                <p className="text-gray-400 text-sm">{t.modeSingleDesc}</p>
              </div>

              {/* Multiplayer Card */}
              <div 
                onClick={() => setSelectedMode('multi')}
                className={`mode-card mode-card-multi border-2 rounded-2xl p-6 w-72 flex flex-col items-center text-center bg-black/40 ${selectedMode === 'multi' ? 'selected' : ''}`}
              >
                <div className="bg-pink-950 p-3 rounded-full mb-4">
                  <Trophy className="w-8 h-8 text-pink-500" />
                </div>
                <span className="font-tech font-bold text-xl text-pink-500 mb-2">{t.modeMulti}</span>
                <p className="text-gray-400 text-sm">{t.modeMultiDesc}</p>
              </div>
            </div>

            <div className="text-center mb-10 max-w-lg px-6">
              <p className="font-tech font-bold text-white mb-2 tracking-widest text-sm uppercase" style={{ color: activeGame.color }}>
                {activeGame.title}
              </p>
              <p className="text-gray-400 text-sm leading-relaxed min-h-[40px]">
                {activeGame.desc}
              </p>
              <div className="mt-4 pt-4 border-t border-white/5 opacity-60">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">{t.howToPlayTitle}</p>
                <p 
                  className="text-gray-500 text-xs italic"
                  dangerouslySetInnerHTML={{ __html: t.howToPlayDesc }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-4 items-center">
              {!isCameraOn ? (
                <div className="flex items-center gap-3 bg-white/10 text-white px-8 py-4 rounded-full border border-white/20 animate-pulse font-tech uppercase text-xs tracking-widest">
                  <Camera className="w-5 h-5" />
                  {t.connectingCamera}
                </div>
              ) : (
                <button
                  onClick={handleStartGame}
                  disabled={!selectedMode}
                  className={`font-tech font-extrabold text-xl px-16 py-4 rounded-full transition-all duration-300 w-80 ${
                    selectedMode 
                      ? 'bg-white text-black btn-glow cursor-pointer' 
                      : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                  }`}
                >
                  {t.startGame}
                </button>
              )}
            </div>

            <div className="absolute bottom-8 flex flex-col items-center text-xs text-gray-500 font-tech tracking-widest">
              <p className="mb-1 opacity-50 uppercase text-[10px]">{t.devLabel}</p>
              <p className="text-white text-sm font-bold tracking-normal mb-1 uppercase">Rahmani Mostapha</p>
              <p className="text-gray-400 font-medium mb-3 uppercase text-[10px]">{t.clubLabel}: <span className="text-cyan-400">Quantum Code</span></p>
              <a href="#" className="flex items-center gap-2 text-white/40 hover:text-cyan-300 transition-colors">
                <Instagram className="w-4 h-4" />
                @ronaldohauw
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Win Screen Overlay */}
      <AnimatePresence>
        {winner && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-[#050505]/95 backdrop-blur-md px-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className={`flex flex-col items-center p-8 md:p-12 border-2 bg-black/60 rounded-[2.5rem] max-w-lg w-full shadow-2xl overflow-hidden`}
              style={{ 
                borderColor: winner.color,
                boxShadow: `0 0 40px ${winner.color}33`,
              }}
            >
              <h2 className="font-tech text-4xl md:text-5xl font-black mb-8 tracking-wider uppercase text-center" style={{ 
                color: winner.color,
                textShadow: `0 0 20px ${winner.color}`,
              }}>
                {selectedMode === 'multi' ? t.winTitleMulti.replace('{id}', winner.id.toString()) : t.winTitleSingle}
              </h2>
              
              <div className="p-2 border border-white/10 bg-white/5 rounded-2xl mb-8 group relative overflow-hidden flex items-center justify-center min-h-[250px]">
                <div 
                  className="absolute inset-0 blur-3xl opacity-20 pointer-events-none group-hover:opacity-40 transition-opacity" 
                  style={{ backgroundColor: winner.color }}
                />
                {winImage ? (
                  <img 
                    src={winImage} 
                    className="w-64 h-64 md:w-80 md:h-80 object-cover rounded-xl shadow-2xl relative z-10" 
                    alt="Win Result" 
                  />
                ) : (
                  <div className="relative z-10 flex flex-col items-center">
                    <Trophy className="w-32 h-32 mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" style={{ color: winner.color }} />
                    <p className="text-white font-tech font-bold text-lg tracking-widest">{activeGame.title}</p>
                  </div>
                )}
              </div>
              
              <div className="flex flex-col items-center mb-10">
                <span className="text-gray-500 uppercase text-xs font-tech tracking-[0.3em] mb-1">{t.timeRecord}</span>
                <p className="font-tech text-4xl md:text-5xl font-black text-white italic drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                  {formatTime(winner.elapsedTime)}
                </p>
              </div>
              
              <button 
                onClick={handlePlayAgain}
                className="group flex items-center justify-center gap-3 font-tech bg-white text-black font-black text-xl px-12 py-5 rounded-full btn-glow w-full hover:bg-gray-100 transition-all uppercase tracking-widest text-center"
              >
                <RefreshCw className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" />
                {t.playAgain}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
