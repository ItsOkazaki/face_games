import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Hands, Results, HAND_CONNECTIONS } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { Player, Point, COLOR_P1, COLOR_P2, Translations, GameType } from '../lib/puzzle-engine';

interface PuzzleGameProps {
  mode: 'single' | 'multi';
  onWin: (player: Player) => void;
  onCameraReady: () => void;
  isActive: boolean;
  translations: Translations;
  gameType: GameType;
  gameColor: string;
}

export default function PuzzleGame({ mode, onWin, onCameraReady, isActive, translations, gameType, gameColor }: PuzzleGameProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playersRef = useRef<Player[]>([]);
  const handsRef = useRef<Hands | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Initialize players
  useEffect(() => {
    if (!isActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const players: Player[] = [];
    if (mode === 'single') {
      players.push(new Player(1, { x: 0, y: 0, w: width, h: height }, gameColor, 'single', translations, gameType));
    } else {
      const halfW = width / 2;
      players.push(new Player(1, { x: 0, y: 0, w: halfW, h: height }, COLOR_P1, 'multi', translations, gameType));
      players.push(new Player(2, { x: halfW, y: 0, w: halfW, h: height }, COLOR_P2, 'multi', translations, gameType));
    }
    playersRef.current = players;
  }, [mode, isActive, translations, gameType, gameColor]);

  const drawSkeleton = useCallback((ctx: CanvasRenderingContext2D, landmarks: Point[], color: string) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 3;

    HAND_CONNECTIONS.forEach((conn) => {
      const p1 = landmarks[conn[0]];
      const p2 = landmarks[conn[1]];
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    });

    landmarks.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
      ctx.fill();
    });
    ctx.restore();
  }, []);

  const onResults = useCallback((results: Results) => {
    if (!isReady) {
      setIsReady(true);
      onCameraReady();
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const canvasRatio = canvas.width / canvas.height;
    const videoRatio = results.image.width / results.image.height;
    let dw, dh, dx, dy;

    if (canvasRatio > videoRatio) {
      dw = canvas.width;
      dh = canvas.width / videoRatio;
      dx = 0;
      dy = (canvas.height - dh) / 2;
    } else {
      dw = canvas.height * videoRatio;
      dh = canvas.height;
      dx = (canvas.width - dw) / 2;
      dy = 0;
    }

    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.filter = "brightness(0.5)";
    ctx.drawImage(results.image, dx, dy, dw, dh);
    ctx.filter = "none";
    ctx.restore();

    // Map landmarks
    const mappedHands: Point[][] = [];
    if (results.multiHandLandmarks) {
      for (const landmarks of results.multiHandLandmarks) {
        const mapped = landmarks.map((lm) => {
          let x = lm.x * dw + dx;
          const y = lm.y * dh + dy;
          x = canvas.width - x;
          return { x, y, z: lm.z };
        });
        mappedHands.push(mapped);
      }
    }

    const players = playersRef.current;
    
    // Draw central divider for multiplayer
    if (mode === 'multi' && isActive) {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.shadowColor = "white";
      ctx.shadowBlur = 10;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.stroke();
      ctx.restore();
    }

    if (isActive && players.length > 0) {
      let p1Hands: Point[][] = [];
      let p2Hands: Point[][] = [];

      if (mode === 'single') {
        p1Hands = mappedHands;
      } else {
        mappedHands.forEach((hand) => {
          const avgX = hand.reduce((sum, lm) => sum + lm.x, 0) / hand.length;
          if (avgX < canvas.width / 2) {
            p1Hands.push(hand);
          } else {
            p2Hands.push(hand);
          }
        });
      }

      if (players[0]) players[0].update(p1Hands, ctx, onWin);
      if (players[1]) players[1].update(p2Hands, ctx, onWin);

      // Synced start for multi
      if (mode === 'multi') {
        const bothReady = players.every(p => p.state !== 'CALIBRATING');
        if (bothReady) {
          players.forEach(p => {
            if (p.state === 'WAITING') p.startPlaying();
          });
        }
      }
    }

    // Draw Skeletons
    if (isActive && players.length > 0) {
      if (mode === 'single') {
        mappedHands.forEach(hand => drawSkeleton(ctx, hand, COLOR_P1));
      } else {
        mappedHands.forEach(hand => {
          const avgX = hand.reduce((sum, lm) => sum + lm.x, 0) / hand.length;
          if (avgX < canvas.width / 2) drawSkeleton(ctx, hand, COLOR_P1);
          else drawSkeleton(ctx, hand, COLOR_P2);
        });
      }
    } else {
      mappedHands.forEach(hand => drawSkeleton(ctx, hand, "#FFFFFF"));
    }
  }, [mode, isActive, isReady, onCameraReady, onWin, drawSkeleton]);

  useEffect(() => {
    const hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    hands.setOptions({
      maxNumHands: 4,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7
    });

    hands.onResults(onResults);
    handsRef.current = hands;

    if (videoRef.current) {
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current) {
            await hands.send({ image: videoRef.current });
          }
        },
        width: 1280,
        height: 720
      });
      camera.start();
      cameraRef.current = camera;
    }

    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cameraRef.current?.stop();
      handsRef.current?.close();
    };
  }, [onResults]);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="hidden"
      />
      <canvas
        ref={canvasRef}
        id="game-canvas"
        className="block w-screen h-screen object-cover"
      />
    </>
  );
}
