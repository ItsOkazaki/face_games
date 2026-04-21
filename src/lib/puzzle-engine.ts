/**
 * Puzzle Engine for Your Face Puzzle
 * Ported and adapted for TypeScript
 */

export const PINCH_THRESHOLD = 60;
export const COLOR_P1 = "#00FFFF";
export const COLOR_P2 = "#FF00FF";

export interface Point {
  x: number;
  y: number;
  z?: number;
}

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Piece {
  id: number;
  currentSlot: number;
  image: HTMLCanvasElement;
  drawX: number;
  drawY: number;
}

export interface Slot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type GameState = 'CALIBRATING' | 'WAITING' | 'PLAYING' | 'SOLVED' | 'LOSE';

export interface Translations {
  instructionHands: string;
  instructionBox: string;
  instructionSnap: string;
  waitingOpponent: string;
  timeLabel: string;
}

export type GameType = 'puzzle' | 'pop' | 'trace' | 'catch' | 'strike' | 'dodge' | 'sandbox';
export type SandboxTracker = 'hands' | 'face' | 'pose';

export interface Target {
  x: number;
  y: number;
  r: number;
  id: number;
  alive: boolean;
  capturedImage?: string;
  popProgress?: number;
}

export interface CatchItem {
  x: number;
  y: number;
  speed: number;
  id: number;
  size: number;
}

export interface StrikeTarget {
  sector: number;
  active: boolean;
  startTime: number;
}

// Gesture Helpers
export function getDistance(p1: Point, p2: Point) {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

export function isPinching(hand: Point[]) {
  return getDistance(hand[4], hand[8]) < PINCH_THRESHOLD;
}

export function isThumbsUp(hand: Point[]) {
  const thumbTip = hand[4];
  const thumbBase = hand[2];
  const indexTip = hand[8];
  const middleTip = hand[12];
  const ringTip = hand[16];
  const pinkyTip = hand[20];
  
  // Thumb is significantly above its base and other fingers are relatively folded
  const isThumbUpArr = thumbTip.y < thumbBase.y - 20;
  const palmBase = hand[0];
  const othersFolded = [indexTip, middleTip, ringTip, pinkyTip].every(tip => getDistance(tip, palmBase) < 120);
  
  return isThumbUpArr && othersFolded;
}

export function isOpenPalm(hand: Point[]) {
  const palmBase = hand[0];
  const tips = [4, 8, 12, 16, 20].map(i => hand[i]);
  // All fingers far from palm base
  return tips.every(tip => getDistance(tip, palmBase) > 130);
}

export function faceMeshToPoint(landmarks?: Point[]): Point | null {
  if (!landmarks || landmarks.length === 0) return null;
  // Use nose tip or average of eye centers
  return landmarks[1]; // Nose tip in FaceMesh (index 1 is approx nose tip)
}

export class Player {
  id: number;
  bounds: Bounds;
  color: string;
  state: GameState = 'CALIBRATING';
  box: Bounds | null = null;
  pieces: Piece[] = [];
  slots: Slot[] = [];
  heldPieceIndex: number = -1;
  startTime: number | null = null;
  elapsedTime: number = 0;
  isPinching: boolean = false;
  mode: 'single' | 'multi';
  translations: Translations;
  gameType: GameType;

  // New game states
  targets: Target[] = [];
  score: number = 0;
  maxScore: number = 10;
  catchItems: CatchItem[] = [];
  tracePath: Point[] = [];
  traceProgress: number = 0;
  activeSector: number = -1;
  sectorTimer: number = 0;
  strikeTargets: StrikeTarget[] = [];
  
  // Laser Dodge state
  lasers: { y: number; speed: number; direction: number; gap: number }[] = [];
  
  // Sandbox state
  sandboxTracker: SandboxTracker = 'hands';

  constructor(id: number, bounds: Bounds, color: string, mode: 'single' | 'multi', translations: Translations, gameType: GameType = 'puzzle') {
    this.id = id;
    this.bounds = bounds;
    this.color = color;
    this.mode = mode;
    this.translations = translations;
    this.gameType = gameType;
  }

  update(handsData: Point[][], ctx: CanvasRenderingContext2D, onWin: (player: Player) => void, faceData?: Point[], poseData?: Point[], onTrackerChange?: (t: SandboxTracker) => void) {
    if (this.state === 'CALIBRATING') {
      this.handleCalibration(handsData, ctx);
    } else if (this.state === 'WAITING') {
      this.drawWaiting(ctx);
    } else if (this.state === 'PLAYING') {
      switch (this.gameType) {
        case 'puzzle':
          this.handleGameplay(handsData, ctx, onWin);
          break;
        case 'pop':
          this.handlePopGame(handsData, ctx, onWin);
          break;
        case 'catch':
          this.handleCatchGame(handsData, ctx, onWin);
          break;
        case 'strike':
          this.handleStrikeGame(handsData, ctx, onWin);
          break;
        case 'trace':
          this.handleTraceGame(handsData, ctx, onWin);
          break;
        case 'dodge':
          this.handleDodgeGame(handsData, ctx, onWin, faceMeshToPoint(faceData));
          break;
        case 'sandbox':
          this.handleSandboxMode(handsData, ctx, faceData, poseData, onTrackerChange);
          break;
      }
    } else if (this.state === 'LOSE') {
      this.drawWaiting(ctx, true);
    }
  }

  handleCalibration(handsData: Point[][], ctx: CanvasRenderingContext2D) {
    // Shared Calibration: Frame Face or Gesture
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.font = "bold 28px 'Orbitron', sans-serif";
    ctx.textAlign = "center";
    const msgX = this.bounds.x + this.bounds.w / 2;
    
    const isPuzzle = this.gameType === 'puzzle';
    
    if (isPuzzle) {
      ctx.fillText(this.translations.instructionHands.replace('{id}', this.id.toString()), msgX, 60);
      ctx.font = "20px sans-serif";
      ctx.shadowBlur = 5;
      ctx.fillText(this.translations.instructionBox, msgX, 95);
      ctx.fillText(this.translations.instructionSnap, msgX, 125);
    } else {
       ctx.fillText(`${this.translations.instructionHands.replace('{id}', this.id.toString())}`, msgX, 60);
       ctx.font = "20px sans-serif";
       const gestureText = this.gameType === 'pop' ? "Thumbs Up 👍 to begin!" : "Open Palm ✋ to begin!";
       ctx.fillText(gestureText, msgX, 100);
    }
    ctx.restore();

    if (handsData.length > 0) {
      if (isPuzzle && handsData.length >= 2) {
        const hA = handsData[0];
        const hB = handsData[1];

        const leftHand = hA[0].x < hB[0].x ? hA : hB;
        const rightHand = hA[0].x < hB[0].x ? hB : hA;

        const pLeftThumb = leftHand[4];
        const pRightIndex = rightHand[8];

        const left = Math.min(pLeftThumb.x, pRightIndex.x);
        const right = Math.max(pLeftThumb.x, pRightIndex.x);
        const top = Math.min(pLeftThumb.y, pRightIndex.y);
        const bottom = Math.max(pLeftThumb.y, pRightIndex.y);

        const w = right - left;
        const h = bottom - top;

        if (w > 50 && h > 50) {
          this.box = { x: left, y: top, w: w, h: h };

          ctx.save();
          ctx.strokeStyle = "white";
          ctx.shadowColor = "white";
          ctx.shadowBlur = 15;
          ctx.lineWidth = 4;
          ctx.strokeRect(this.box.x, this.box.y, this.box.w, this.box.h);
          ctx.restore();

          if (isPinching(leftHand) && isPinching(rightHand)) {
            this.initGame(ctx);
          }
        }
      } else if (!isPuzzle) {
        const h = handsData[0];
        const startGesture = this.gameType === 'pop' ? isThumbsUp(h) : (this.gameType === 'catch' || this.gameType === 'strike' || this.gameType === 'dodge' ? isOpenPalm(h) : true);
        if (startGesture) {
          this.initGame(ctx);
        }
      }
    }
  }

  initGame(ctx: CanvasRenderingContext2D) {
    if (this.gameType === 'puzzle') {
      this.capturePuzzle(ctx);
    } else if (this.gameType === 'pop') {
      this.initPopGame();
    } else if (this.gameType === 'catch') {
      this.initCatchGame();
    } else if (this.gameType === 'strike') {
      this.initStrikeGame();
    } else if (this.gameType === 'trace') {
      this.initTraceGame();
    } else if (this.gameType === 'dodge') {
      this.initDodgeGame();
    } else if (this.gameType === 'sandbox') {
      this.startPlaying();
    }
  }

  initPopGame() {
    this.targets = [];
    this.score = 0;
    this.maxScore = 15;
    this.startPlaying();
  }

  handlePopGame(handsData: Point[][], ctx: CanvasRenderingContext2D, onWin: (player: Player) => void) {
    this.updateTimer();
    this.drawUI(ctx, `THUMBS UP TO POP: ${this.score} / ${this.maxScore}`);

    if (handsData.length > 0) {
      const h = handsData[0];
      if (isThumbsUp(h)) {
        if (!this.isPinching) { // Reuse isPinching for debounce
          this.isPinching = true;
          this.score++;
          
          // Image capture for pop effect
          const snapSize = 150;
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = snapSize;
          tempCanvas.height = snapSize;
          const tctx = tempCanvas.getContext('2d');
          if (tctx) {
            // Draw from video/main canvas if possible
            tctx.drawImage(ctx.canvas, h[0].x - snapSize/2, h[0].y - snapSize/2, snapSize, snapSize, 0, 0, snapSize, snapSize);
          }

          this.targets.push({
            x: h[4].x,
            y: h[4].y,
            r: 60,
            id: Date.now(),
            alive: true,
            capturedImage: tempCanvas.toDataURL(),
            popProgress: 0
          });

          if (this.score >= this.maxScore) {
            this.state = 'SOLVED';
            onWin(this);
          }
        }
      } else {
        this.isPinching = false;
      }
    }

    this.targets.forEach((t, idx) => {
      if (t.alive) {
        t.popProgress! += 0.04;
        if (t.popProgress! >= 1) {
          t.alive = false;
          return;
        }
        
        ctx.save();
        ctx.globalAlpha = 1 - t.popProgress!;
        const s = 1 + t.popProgress! * 0.8;
        ctx.translate(t.x, t.y);
        ctx.scale(s, s);
        
        if (t.capturedImage) {
          const img = new Image();
          img.src = t.capturedImage;
          ctx.drawImage(img, -30, -30, 60, 60);
        }
        
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4;
        ctx.strokeRect(-30, -30, 60, 60);
        ctx.restore();
      }
    });
  }

  initCatchGame() {
    this.catchItems = [];
    this.score = 0;
    this.maxScore = 20;
    this.startPlaying();
  }

  handleCatchGame(handsData: Point[][], ctx: CanvasRenderingContext2D, onWin: (player: Player) => void) {
    this.updateTimer();
    const currentSpeed = 5 + (this.score * 0.5);
    this.drawUI(ctx, `PINCH TO CATCH: ${this.score} / ${this.maxScore}`);

    if (Math.random() < 0.04 + (this.score * 0.003) && this.catchItems.length < 10) {
      this.catchItems.push({
        x: this.bounds.x + 80 + Math.random() * (this.bounds.w - 160),
        y: -100,
        speed: currentSpeed + Math.random() * 3,
        id: Date.now(),
        size: 70 + Math.random() * 40
      });
    }

    let pCursor: Point | null = null;
    let pinching = false;
    if (handsData.length > 0) {
      const h = handsData[0];
      pCursor = { x: (h[4].x + h[8].x) / 2, y: (h[4].y + h[8].y) / 2 };
      pinching = isPinching(h);
      this.drawCursor(ctx, pCursor, pinching);
    }

    this.catchItems.forEach((item, idx) => {
      item.y += item.speed;
      
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate(Date.now() / 250);
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 4;
      ctx.strokeRect(-item.size/2, -item.size/2, item.size, item.size);
      ctx.fillStyle = this.color + "33";
      ctx.fillRect(-item.size/2, -item.size/2, item.size, item.size);
      ctx.restore();

      if (pCursor && pinching && getDistance(pCursor, item) < item.size) {
        this.catchItems.splice(idx, 1);
        this.score++;
        if (this.score >= this.maxScore) {
          this.state = 'SOLVED';
          onWin(this);
        }
      } else if (item.y > this.bounds.h + 150) {
        this.catchItems.splice(idx, 1);
      }
    });
  }

  initStrikeGame() {
    this.score = 0;
    this.maxScore = 20;
    this.strikeTargets = [];
    this.startPlaying();
  }

  handleStrikeGame(handsData: Point[][], ctx: CanvasRenderingContext2D, onWin: (player: Player) => void) {
    this.updateTimer();
    this.drawUI(ctx, `STRIKE NODES: ${this.score} / ${this.maxScore}`);

    if (Math.random() < 0.05 && this.strikeTargets.length < 6) {
      this.strikeTargets.push({
        sector: Math.floor(Math.random() * 9),
        active: true,
        startTime: Date.now()
      });
    }

    const sectorW = this.bounds.w / 3;
    const sectorH = this.bounds.h / 3;

    // Grid Visual
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for(let i=1; i<3; i++) {
      ctx.beginPath();
      ctx.moveTo(this.bounds.x + i * sectorW, 0);
      ctx.lineTo(this.bounds.x + i * sectorW, this.bounds.h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(this.bounds.x, i * sectorH);
      ctx.lineTo(this.bounds.x + this.bounds.w, i * sectorH);
      ctx.stroke();
    }

    this.strikeTargets.forEach((t, idx) => {
      const r = Math.floor(t.sector / 3);
      const c = t.sector % 3;
      const x = this.bounds.x + c * sectorW + sectorW / 2;
      const y = r * sectorH + sectorH / 2;
      
      const life = (Date.now() - t.startTime) / 1800;
      if (life > 1) {
        this.strikeTargets.splice(idx, 1);
        return;
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, 50 * (1 - life), 0, Math.PI * 2);
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 6;
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(x, y, 25, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.restore();

      if (handsData.length > 0) {
        const tip = handsData[0][8];
        if (getDistance(tip, {x, y}) < 60) {
          this.strikeTargets.splice(idx, 1);
          this.score++;
          if (this.score >= this.maxScore) {
            this.state = 'SOLVED';
            onWin(this);
          }
        }
      }
    });
  }

  initTraceGame() {
    this.score = 0;
    this.tracePath = [];
    const centerX = this.bounds.x + this.bounds.w / 2;
    const centerY = this.bounds.h / 2;
    const r = Math.min(this.bounds.w, this.bounds.h) * 0.35;
    
    for(let i=0; i<=50; i++) {
        const angle = (i / 50) * Math.PI * 2;
        const offset = Math.sin(angle * 5) * 40;
        this.tracePath.push({
            x: centerX + Math.cos(angle) * (r + offset),
            y: centerY + Math.sin(angle) * (r + offset)
        });
    }
    this.traceProgress = 0;
    this.startPlaying();
  }

  handleTraceGame(handsData: Point[][], ctx: CanvasRenderingContext2D, onWin: (player: Player) => void) {
    this.updateTimer();
    this.drawUI(ctx, `STAY ON THE PATH: ${Math.floor(this.traceProgress / (this.tracePath.length-1) * 100)}%`);

    ctx.save();
    // Path Guide
    ctx.beginPath();
    ctx.moveTo(this.tracePath[0].x, this.tracePath[0].y);
    this.tracePath.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 30;
    ctx.lineCap = "round";
    ctx.stroke();

    // Progress
    if (this.traceProgress > 0) {
      ctx.beginPath();
      ctx.moveTo(this.tracePath[0].x, this.tracePath[0].y);
      for(let i=0; i<=this.traceProgress; i++) {
        ctx.lineTo(this.tracePath[i].x, this.tracePath[i].y);
      }
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 10;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 15;
      ctx.stroke();
    }

    const next = this.tracePath[this.traceProgress];
    if (next) {
      ctx.beginPath();
      ctx.arc(next.x, next.y, 20 + Math.sin(Date.now() / 150) * 8, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
    }
    ctx.restore();

    if (handsData.length > 0) {
      const tip = handsData[0][8];
      if (next && getDistance(tip, next) < 60) {
        this.traceProgress++;
        if (this.traceProgress >= this.tracePath.length) {
          this.state = 'SOLVED';
          onWin(this);
        }
      }
    }
  }

  initDodgeGame() {
    this.score = 0;
    this.maxScore = 25;
    this.lasers = [];
    for(let i=0; i<3; i++) {
      this.lasers.push({
        y: Math.random() * this.bounds.h,
        speed: 4 + Math.random() * 3,
        direction: Math.random() > 0.5 ? 1 : -1,
        gap: this.bounds.x + 50 + Math.random() * (this.bounds.w - 250)
      });
    }
    this.startPlaying();
  }

  handleDodgeGame(handsData: Point[][], ctx: CanvasRenderingContext2D, onWin: (player: Player) => void, facePoint: Point | null) {
    this.updateTimer();
    this.drawUI(ctx, `DODGE LASERS (FACE): ${this.elapsedTime}s / ${this.maxScore}s`);

    if (!facePoint) {
      ctx.fillStyle = "rgba(255,0,0,0.5)";
      ctx.fillRect(this.bounds.x, 0, this.bounds.w, this.bounds.h);
      ctx.fillStyle = "white";
      ctx.font = "bold 24px Orbitron";
      ctx.textAlign = "center";
      ctx.fillText("FACE NOT DETECTED!", this.bounds.x + this.bounds.w/2, this.bounds.h/2);
      this.startTime = Date.now(); // Exploitation prevention: reset if face is hidden
      return;
    }

    // Face visualization
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(facePoint.x, facePoint.y, 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    this.lasers.forEach((l, idx) => {
      l.y += l.speed * l.direction;
      if (l.y < 50 || l.y > this.bounds.h - 50) l.direction *= -1;

      ctx.save();
      ctx.shadowColor = "#FF3333";
      ctx.shadowBlur = 25;
      ctx.strokeStyle = "#FF3333";
      ctx.lineWidth = 18;
      
      const gapWidth = 180;
      ctx.beginPath();
      ctx.moveTo(this.bounds.x, l.y);
      ctx.lineTo(l.gap, l.y);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(l.gap + gapWidth, l.y);
      ctx.lineTo(this.bounds.x + this.bounds.w, l.y);
      ctx.stroke();
      ctx.restore();

      // Detection
      const onLaserY = Math.abs(facePoint.y - l.y) < 25;
      const inGap = facePoint.x > l.gap && facePoint.x < l.gap + gapWidth;
      
      if (onLaserY && !inGap) {
        this.startTime = Date.now(); // Hit -> reset timer
      }
    });

    if (this.elapsedTime >= this.maxScore) {
      this.state = 'SOLVED';
      onWin(this);
    }
  }

  handleSandboxMode(handsData: Point[][], ctx: CanvasRenderingContext2D, faceData?: Point[], poseData?: Point[], onTrackerChange?: (t: SandboxTracker) => void) {
    this.drawUI(ctx, `CONTROL LAB: SELECT SENSOR`);
    
    const trackers: SandboxTracker[] = ['hands', 'face', 'pose'];
    trackers.forEach((t, i) => {
      const buttonW = 140;
      const x = this.bounds.x + (this.bounds.w - (buttonW * 3 + 40)) / 2 + i * (buttonW + 20);
      const y = this.bounds.h - 100;
      const selected = this.sandboxTracker === t;
      
      ctx.save();
      ctx.fillStyle = selected ? this.color : "rgba(255,255,255,0.1)";
      ctx.shadowBlur = selected ? 15 : 0;
      ctx.shadowColor = this.color;
      ctx.roundRect(x, y, buttonW, 50, 10);
      ctx.fill();
      
      ctx.fillStyle = selected ? "black" : "white";
      ctx.font = "bold 14px Orbitron";
      ctx.textAlign = "center";
      ctx.fillText(t.toUpperCase(), x + buttonW/2, y + 32);
      ctx.restore();

      if (handsData.length > 0) {
        const tip = handsData[0][8];
        if (tip.x > x && tip.x < x + buttonW && tip.y > y && tip.y < y + 50) {
          if (this.sandboxTracker !== t) {
            this.sandboxTracker = t;
            if (onTrackerChange) onTrackerChange(t);
          }
        }
      }
    });

    // Feedback
    if (this.sandboxTracker === 'hands' && handsData.length > 0) {
      handsData.forEach(h => {
        h.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = this.color;
          ctx.fill();
        });
      });
    } else if (this.sandboxTracker === 'face' && faceData) {
      faceData.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = "cyan";
        ctx.fill();
      });
    } else if (this.sandboxTracker === 'pose' && poseData) {
      poseData.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "white";
        ctx.fill();
      });
    }
  }

  updateTimer() {
    if (this.startTime) {
        this.elapsedTime = Math.floor((Date.now() - this.startTime) / 1000);
    }
  }

  drawUI(ctx: CanvasRenderingContext2D, label: string) {
      ctx.save();
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 15;
      ctx.font = "bold 36px 'Orbitron', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, this.bounds.x + this.bounds.w / 2, 60);
      ctx.restore();
  }

  drawCursor(ctx: CanvasRenderingContext2D, cursor: Point, pinching: boolean) {
      ctx.save();
      const pulse = pinching ? Math.abs(Math.sin(Date.now() / 120)) * 6 : 0;
      const radius = pinching ? 12 + pulse : 8;
      ctx.fillStyle = pinching ? this.color : "rgba(255, 255, 255, 0.8)";
      ctx.shadowColor = pinching ? this.color : "white";
      ctx.shadowBlur = pinching ? 20 + pulse * 2 : 10;
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
  }

  capturePuzzle(ctx: CanvasRenderingContext2D) {
    if (!this.box) return;
    const imageData = ctx.getImageData(this.box.x, this.box.y, this.box.w, this.box.h);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.box.w;
    tempCanvas.height = this.box.h;
    tempCanvas.getContext('2d')?.putImageData(imageData, 0, 0);

    const pieceW = this.box.w / 3;
    const pieceH = this.box.h / 3;

    this.pieces = [];
    this.slots = [];

    for (let i = 0; i < 9; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;

      const pX = this.box.x + col * pieceW;
      const pY = this.box.y + row * pieceH;

      this.slots.push({ x: pX, y: pY, w: pieceW, h: pieceH });

      const pieceCanvas = document.createElement('canvas');
      pieceCanvas.width = pieceW;
      pieceCanvas.height = pieceH;
      pieceCanvas.getContext('2d')?.drawImage(tempCanvas, col * pieceW, row * pieceH, pieceW, pieceH, 0, 0, pieceW, pieceH);

      this.pieces.push({ id: i, currentSlot: i, image: pieceCanvas, drawX: pX, drawY: pY });
    }

    this.shufflePuzzle();

    if (this.mode === 'multi') {
      this.state = 'WAITING';
    } else {
      this.startPlaying();
    }
  }

  shufflePuzzle() {
    const slotIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    for (let i = slotIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slotIndices[i], slotIndices[j]] = [slotIndices[j], slotIndices[i]];
    }
    this.pieces.forEach((p, index) => {
      p.currentSlot = slotIndices[index];
      this.snapToSlot(p);
    });
  }

  startPlaying() {
    this.state = 'PLAYING';
    this.startTime = Date.now();
  }

  snapToSlot(piece: Piece) {
    const slot = this.slots[piece.currentSlot];
    piece.drawX = slot.x;
    piece.drawY = slot.y;
  }

  drawWaiting(ctx: CanvasRenderingContext2D, isLose: boolean = false) {
    this.pieces.forEach((p) => {
      ctx.drawImage(p.image, p.drawX, p.drawY);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 1;
      ctx.strokeRect(p.drawX, p.drawY, p.image.width, p.image.height);
    });

    if (!isLose) {
      ctx.save();
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10;
      ctx.font = "bold 26px 'Orbitron', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(this.translations.waitingOpponent, this.bounds.x + this.bounds.w / 2, 60);
      ctx.restore();
    }
  }

  handleGameplay(handsData: Point[][], ctx: CanvasRenderingContext2D, onWin: (player: Player) => void) {
    // Update timer
    if (this.startTime) {
      this.elapsedTime = Math.floor((Date.now() - this.startTime) / 1000);
    }

    // Grid Background
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    this.slots.forEach(slot => ctx.strokeRect(slot.x, slot.y, slot.w, slot.h));
    ctx.restore();

    let cursor: Point | null = null;
    let pinching = false;

    if (handsData.length > 0) {
      const h = handsData[0];
      cursor = { x: (h[4].x + h[8].x) / 2, y: (h[4].y + h[8].y) / 2 };
      pinching = this.getDistance(h[4], h[8]) < PINCH_THRESHOLD;

      ctx.save();
      const pulse = pinching ? Math.abs(Math.sin(Date.now() / 120)) * 6 : 0;
      const radius = pinching ? 12 + pulse : 8;

      ctx.fillStyle = pinching ? this.color : "rgba(255, 255, 255, 0.8)";
      ctx.shadowColor = pinching ? this.color : "white";
      ctx.shadowBlur = pinching ? 20 + pulse * 2 : 10;

      if (pinching) {
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4 + pulse / 2;
        ctx.beginPath();
        ctx.moveTo(h[4].x, h[4].y);
        ctx.lineTo(h[8].x, h[8].y);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, radius + 10, 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (pinching && !this.isPinching) {
      this.isPinching = true;
      if (cursor && this.heldPieceIndex === -1) {
        for (let i = 0; i < this.pieces.length; i++) {
          const p = this.pieces[i];
          const slot = this.slots[p.currentSlot];
          if (cursor.x >= slot.x && cursor.x <= slot.x + slot.w &&
            cursor.y >= slot.y && cursor.y <= slot.y + slot.h) {
            this.heldPieceIndex = i;
            break;
          }
        }
      }
    } else if (pinching && this.isPinching) {
      if (this.heldPieceIndex !== -1 && cursor) {
        const p = this.pieces[this.heldPieceIndex];
        p.drawX = cursor.x - this.slots[0].w / 2;
        p.drawY = cursor.y - this.slots[0].h / 2;
      }
    } else if (!pinching && this.isPinching) {
      this.isPinching = false;
      if (this.heldPieceIndex !== -1 && cursor) {
        const heldPiece = this.pieces[this.heldPieceIndex];
        let targetSlotIndex = -1;
        let minDist = Infinity;

        for (let i = 0; i < this.slots.length; i++) {
          const slot = this.slots[i];
          const cx = slot.x + slot.w / 2;
          const cy = slot.y + slot.h / 2;
          const dist = this.getDistance(cursor, { x: cx, y: cy });
          if (dist < minDist) { minDist = dist; targetSlotIndex = i; }
        }

        if (targetSlotIndex !== -1 && targetSlotIndex !== heldPiece.currentSlot) {
          const pieceInTarget = this.pieces.find(p => p.currentSlot === targetSlotIndex);
          if (pieceInTarget) {
            pieceInTarget.currentSlot = heldPiece.currentSlot;
            this.snapToSlot(pieceInTarget);
          }
          heldPiece.currentSlot = targetSlotIndex;
        }

        this.snapToSlot(heldPiece);
        this.heldPieceIndex = -1;
        this.checkWin(onWin);
      }
    }

    // Render Pieces
    this.pieces.forEach((p, idx) => {
      if (idx !== this.heldPieceIndex) {
        ctx.drawImage(p.image, p.drawX, p.drawY);
        ctx.strokeStyle = "#222";
        ctx.strokeRect(p.drawX, p.drawY, p.image.width, p.image.height);
      }
    });

    // Render Held Piece
    if (this.heldPieceIndex !== -1) {
      const p = this.pieces[this.heldPieceIndex];
      ctx.globalAlpha = 0.85;
      ctx.drawImage(p.image, p.drawX, p.drawY);
      ctx.globalAlpha = 1.0;

      ctx.save();
      const pulseGlow = Math.abs(Math.sin(Date.now() / 150)) * 15;
      ctx.strokeStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 15 + pulseGlow;
      ctx.lineWidth = 4 + pulseGlow / 4;
      ctx.strokeRect(p.drawX, p.drawY, p.image.width, p.image.height);
      ctx.restore();
    }

    // Timer
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 15;
    ctx.font = "bold 36px 'Orbitron', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${this.translations.timeLabel}${this.formatTime(this.elapsedTime)}`, this.bounds.x + this.bounds.w / 2, 60);
    ctx.restore();
  }

  checkWin(onWin: (player: Player) => void) {
    const isWin = this.pieces.every(p => p.id === p.currentSlot);
    if (isWin && this.state !== 'SOLVED') {
      this.state = 'SOLVED';
      onWin(this);
    }
  }

  getDistance(p1: Point, p2: Point) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  }

  formatTime(seconds: number) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
}
