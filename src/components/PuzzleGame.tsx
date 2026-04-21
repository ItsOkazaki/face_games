import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Hands, Results as HandResults, HAND_CONNECTIONS } from '@mediapipe/hands';
import { FaceMesh, Results as FaceResults } from '@mediapipe/face_mesh';
import { Pose, Results as PoseResults } from '@mediapipe/pose';
import { Player, Point, COLOR_P1, COLOR_P2, Translations, GameType } from '../lib/puzzle-engine';

interface PuzzleGameProps {
  mode: 'single' | 'multi';
  onWin: (player: Player) => void;
  onCameraReady: () => void;
  isActive: boolean;
  translations: Translations;
  gameType: GameType;
  gameColor: string;
  sandboxTracker: 'hands' | 'face' | 'pose';
  onSandboxTrackerChange: (tracker: 'hands' | 'face' | 'pose') => void;
}

export default function PuzzleGame({ mode, onWin, onCameraReady, isActive, translations, gameType, gameColor, sandboxTracker, onSandboxTrackerChange }: PuzzleGameProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playersRef = useRef<Player[]>([]);
  const handsRef = useRef<Hands | null>(null);
  const faceMeshRef = useRef<FaceMesh | null>(null);
  const poseRef = useRef<Pose | null>(null);
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

  // Stable state for loop to check isActive without restarting everything
  const isActiveRef = useRef(isActive);
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const drawSkeleton = useCallback((ctx: CanvasRenderingContext2D, landmarks: Point[], color: string) => {
    // ... stays the same
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
    const video = videoRef.current;
    if (!canvas || !ctx || !video) return;

    // Use video element directly if results don't have the image yet
    const image = latestHands.current?.image || latestFace.current?.image || latestPose.current?.image || (video.readyState >= 2 ? video : null);
    if (!image) return;

    if (!isReady && video.readyState >= 2) {
      setIsReady(true);
      onCameraReady();
    }

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const canvasRatio = canvas.width / canvas.height;
    // Handle both HTMLVideoElement and HTMLCanvasElement/ImageBitmap
    const imgWidth = (image as any).videoWidth || (image as any).width;
    const imgHeight = (image as any).videoHeight || (image as any).height;
    
    if (!imgWidth || !imgHeight) {
      ctx.restore();
      return;
    };

    const videoRatio = imgWidth / imgHeight;
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
    const handsResults = latestHands.current;
    if (handsResults?.multiHandLandmarks) {
      for (const landmarks of handsResults.multiHandLandmarks) {
        mappedHands.push(landmarks.map(mapLM));
      }
    }

    // Map Face landmarks
    let mappedFace: Point[] = [];
    const faceResults = latestFace.current;
    if (faceResults?.multiFaceLandmarks?.[0]) {
      mappedFace = faceResults.multiFaceLandmarks[0].map(mapLM);
    }

    // Map Pose landmarks
    let mappedPose: Point[] = [];
    const poseResults = latestPose.current;
    if (poseResults?.poseLandmarks) {
      mappedPose = poseResults.poseLandmarks.map(mapLM);
    }

    const players = playersRef.current;
    
    if (isActiveRef.current && players.length > 0) {
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

      if (players[0]) players[0].update(p1Hands, ctx, onWin, p1Face, p1Pose, onSandboxTrackerChange);
      if (players[1]) players[1].update(p2Hands, ctx, onWin, p2Face, p2Pose, onSandboxTrackerChange);

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
  }, [mode, isReady, onCameraReady, onWin, drawSkeleton, gameColor]);

  const [camError, setCamError] = useState<string | null>(null);
  const processingRef = useRef(false);
  const frameCountRef = useRef(0);

  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;
    setCamError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API not supported in this browser.");
      }

      // Try basic constraints first
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          facingMode: "user"
        } 
      }).catch(() => navigator.mediaDevices.getUserMedia({ video: true }));

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for video to be truly ready
        await new Promise((resolve) => {
          if (!videoRef.current) return resolve(null);
          videoRef.current.onloadedmetadata = () => resolve(null);
        });
        await videoRef.current.play();
        console.log("Cam started");
      }
    } catch (err: any) {
      console.error("Cam error:", err);
      setCamError(err.name === 'NotFoundError' ? "No camera found. Please connect a webcam." : "Camera blocked or unavailable.");
    }
  }, []);

  useEffect(() => {
    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    hands.setOptions({ 
      maxNumHands: mode === 'single' ? 2 : 4, 
      modelComplexity: 1, 
      minDetectionConfidence: 0.5, 
      minTrackingConfidence: 0.5 
    });
    hands.onResults((results) => { latestHands.current = results; });
    handsRef.current = hands;

    const faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });
    faceMesh.setOptions({ 
      maxNumFaces: 1, 
      refineLandmarks: true, 
      minDetectionConfidence: 0.5, 
      minTrackingConfidence: 0.5 
    });
    faceMesh.onResults((results) => { latestFace.current = results; });
    faceMeshRef.current = faceMesh;

    const pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });
    pose.setOptions({ 
      modelComplexity: 1, 
      minDetectionConfidence: 0.5, 
      minTrackingConfidence: 0.5 
    });
    pose.onResults((results) => { latestPose.current = results; });
    poseRef.current = pose;

    let requestRef: number;
    const animate = async () => {
      runLoop();
      
      const video = videoRef.current;
      if (video && video.readyState >= 2 && !processingRef.current) {
        processingRef.current = true;
        try {
          // Dynamic sensor activation: ONLY process what is needed for the current game
          let needsHands = false;
          let needsFace = false;
          let needsPose = false;

          if (gameType === 'sandbox') {
            needsHands = sandboxTracker === 'hands';
            needsFace = sandboxTracker === 'face';
            needsPose = sandboxTracker === 'pose';
          } else {
            needsHands = gameType !== 'dodge';
            needsFace = gameType === 'puzzle' || gameType === 'dodge';
            needsPose = false;
          }

          const tasks = [];
          if (needsHands) tasks.push(hands.send({ image: video }));
          
          frameCountRef.current++;
          
          if (needsFace && (frameCountRef.current % 2 === 0 || gameType === 'dodge')) {
             tasks.push(faceMesh.send({ image: video }));
          }
          
          if (needsPose && frameCountRef.current % 3 === 0) {
             tasks.push(pose.send({ image: video }));
          }

          if (tasks.length > 0) {
            await Promise.all(tasks);
          }
        } catch (e) {
          // console.warn("Sensor lag:", e);
        } finally {
          processingRef.current = false;
        }
      }
      
      requestRef = requestAnimationFrame(animate);
    };

    startCamera();
    requestRef = requestAnimationFrame(animate);

    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      hands.close();
      faceMesh.close();
      pose.close();
      cancelAnimationFrame(requestRef);
    };
  }, [runLoop, startCamera]);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="hidden"
      />
      <canvas
        ref={canvasRef}
        id="game-canvas"
        className="block w-screen h-screen object-cover"
      />
      
      {camError && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-6 text-center">
          <div className="bg-red-500/20 border border-red-500/50 p-8 rounded-3xl max-w-md">
            <h3 className="text-red-400 font-tech text-2xl font-bold mb-4 uppercase tracking-wider">Sensor Error</h3>
            <p className="text-white/80 mb-8 font-tech text-sm leading-relaxed">{camError}</p>
            <button 
              onClick={() => startCamera()}
              className="bg-white text-black font-tech font-black px-10 py-4 rounded-full hover:bg-gray-100 transition-all uppercase tracking-widest"
            >
              Retry Connection
            </button>
          </div>
        </div>
      )}
    </>
  );
}
