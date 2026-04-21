import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Hands, Results as HandResults, HAND_CONNECTIONS } from '@mediapipe/hands';
import { FaceMesh, Results as FaceResults } from '@mediapipe/face_mesh';
import { Pose, Results as PoseResults } from '@mediapipe/pose';
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
  const faceMeshRef = useRef<FaceMesh | null>(null);
  const poseRef = useRef<Pose | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Latest results
  const latestHands = useRef<HandResults | null>(null);
  const latestFace = useRef<FaceResults | null>(null);
  const latestPose = useRef<PoseResults | null>(null);

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

  const runLoop = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;

    const handsResults = latestHands.current;
    const faceResults = latestFace.current;
    const poseResults = latestPose.current;

    // We still need at least handsResults to get the base image for background
    // but in sandbox it might be different. 
    // Actually results.image is shared if they are from the same frame.
    // For now, if no image, we skip.
    const image = handsResults?.image || faceResults?.image || poseResults?.image;
    if (!image) return;

    if (!isReady) {
      setIsReady(true);
      onCameraReady();
    }

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const canvasRatio = canvas.width / canvas.height;
    const videoRatio = image.width / image.height;
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
    ctx.drawImage(image, dx, dy, dw, dh);
    ctx.filter = "none";
    ctx.restore();

    // Map landmarks helper
    const mapLM = (lm: {x: number, y: number, z?: number}) => {
      let x = lm.x * dw + dx;
      const y = lm.y * dh + dy;
      x = canvas.width - x;
      return { x, y, z: lm.z };
    };

    // Map Hand landmarks
    const mappedHands: Point[][] = [];
    if (handsResults?.multiHandLandmarks) {
      for (const landmarks of handsResults.multiHandLandmarks) {
        mappedHands.push(landmarks.map(mapLM));
      }
    }

    // Map Face landmarks
    let mappedFace: Point[] = [];
    if (faceResults?.multiFaceLandmarks?.[0]) {
      mappedFace = faceResults.multiFaceLandmarks[0].map(mapLM);
    }

    // Map Pose landmarks
    let mappedPose: Point[] = [];
    if (poseResults?.poseLandmarks) {
      mappedPose = poseResults.poseLandmarks.map(mapLM);
    }

    const players = playersRef.current;
    
    if (isActive && players.length > 0) {
      // Divider
      if (mode === 'multi') {
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

      const p1Face = mode === 'single' ? mappedFace : (mappedFace.length > 0 && (mappedFace[1].x < canvas.width / 2) ? mappedFace : []);
      const p2Face = mode === 'multi' && mappedFace.length > 0 && (mappedFace[1].x >= canvas.width / 2) ? mappedFace : [];
      
      const p1Pose = mode === 'single' ? mappedPose : (mappedPose.length > 0 && (mappedPose[0].x < canvas.width / 2) ? mappedPose : []);
      const p2Pose = mode === 'multi' && mappedPose.length > 0 && (mappedPose[0].x >= canvas.width / 2) ? mappedPose : [];

      if (players[0]) players[0].update(p1Hands, ctx, onWin, p1Face, p1Pose);
      if (players[1]) players[1].update(p2Hands, ctx, onWin, p2Face, p2Pose);

      // Synced start
      if (mode === 'multi') {
        const bothReady = players.every(p => p.state !== 'CALIBRATING');
        if (bothReady) players.forEach(p => p.state === 'WAITING' && p.startPlaying());
      }

      // Draw Skeletons
      if (mode === 'single') {
        mappedHands.forEach(hand => drawSkeleton(ctx, hand, gameColor));
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
  }, [mode, isActive, isReady, onCameraReady, onWin, drawSkeleton, gameColor]);

  useEffect(() => {
    // Hands
    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    hands.setOptions({ maxNumHands: 4, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });
    hands.onResults((results) => { latestHands.current = results; });
    handsRef.current = hands;

    // Face Mesh
    const faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });
    faceMesh.setOptions({ maxNumFaces: 2, refineLandmarks: true, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });
    faceMesh.onResults((results) => { latestFace.current = results; });
    faceMeshRef.current = faceMesh;

    // Pose
    const pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });
    pose.setOptions({ modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });
    pose.onResults((results) => { latestPose.current = results; });
    poseRef.current = pose;

    let requestRef: number;
    const animate = () => {
      runLoop();
      requestRef = requestAnimationFrame(animate);
    };

    if (videoRef.current) {
      try {
        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current && videoRef.current.readyState >= 2) {
              try {
                await Promise.all([
                  hands.send({ image: videoRef.current }),
                  faceMesh.send({ image: videoRef.current }),
                  pose.send({ image: videoRef.current })
                ]);
              } catch (e) {
                console.warn("Mediapipe frame drop:", e);
              }
            }
          },
          // Using more standard dimensions or removing strictly forced 1280x720 
          // which can fail on front-facing mobile cameras that only support 480p or 1080p
          width: 640, 
          height: 480
        });
        
        camera.start().catch(err => {
          console.error("Camera.start() failed:", err);
          // Try one more time with zero constraints if previous failed
          if (videoRef.current) {
            navigator.mediaDevices.getUserMedia({ video: true })
              .then(stream => {
                if (videoRef.current) videoRef.current.srcObject = stream;
              })
              .catch(e => console.error("Ultimate camera fallback failed:", e));
          }
        });
        cameraRef.current = camera;
        requestRef = requestAnimationFrame(animate);
      } catch (err) {
        console.error("Critical camera setup error:", err);
      }
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
      faceMeshRef.current?.close();
      poseRef.current?.close();
      cancelAnimationFrame(requestRef);
    };
  }, [runLoop]);

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
