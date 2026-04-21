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

export interface Target {
  x: number;
  y: number;
  r: number;
  id: number;
  alive: boolean;
}

export interface CatchItem {
  x: number;
  y: number;
  speed: number;
  id: number;
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

  constructor(id: number, bounds: Bounds, color: string, mode: 'single' | 'multi', translations: Translations, gameType: GameType = 'puzzle') {
    this.id = id;
    this.bounds = bounds;
    this.color = color;
    this.mode = mode;
    this.translations = translations;
    this.gameType = gameType;
  }

  update(handsData: Point[][], ctx: CanvasRenderingContext2D, onWin: (player: Player) => void) {
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
          this.handleDodgeGame(handsData, ctx, onWin);
          break;
        case 'sandbox':
          this.handleSandboxMode(handsData, ctx);
          break;
      }
    } else if (this.state === 'LOSE') {
      this.drawWaiting(ctx, true);
    }
  }

  handleCalibration(handsData: Point[][], ctx: CanvasRenderingContext2D) {
    // Shared Calibration: Frame Face
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.font = "bold 28px 'Orbitron', sans-serif";
    ctx.textAlign = "center";
    const msgX = this.bounds.x + this.bounds.w / 2;
    
    const showHeader = this.gameType === 'puzzle' || this.gameType === 'pop' || this.gameType === 'strike';
    
    if (showHeader) {
      ctx.fillText(this.translations.instructionHands.replace('{id}', this.id.toString()), msgX, 60);
      ctx.font = "20px sans-serif";
      ctx.shadowBlur = 5;
      ctx.fillText(this.translations.instructionBox, msgX, 95);
      ctx.fillText(this.translations.instructionSnap, msgX, 125);
    } else {
       ctx.fillText(`${this.translations.instructionHands.replace('{id}', this.id.toString())}`, msgX, 60);
       ctx.font = "20px sans-serif";
       ctx.fillText("Pinch both hands to start mission!", msgX, 100);
    }
    ctx.restore();

    if (handsData.length >= 2) {
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

        const pinchLeft = this.getDistance(leftHand[4], leftHand[8]) < PINCH_THRESHOLD;
        const pinchRight = this.getDistance(rightHand[4], rightHand[8]) < PINCH_THRESHOLD;

        if (pinchLeft && pinchRight) {
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
    this.maxScore = 12;
    for(let i=0; i<this.maxScore; i++) {
        this.targets.push({
            x: this.bounds.x + 100 + Math.random() * (this.bounds.w - 200),
            y: 100 + Math.random() * (this.bounds.h - 200),
            r: 30 + Math.random() * 20,
            id: i,
            alive: false
        });
    }
    this.targets[0].alive = true;
    this.startPlaying();
  }

  handlePopGame(handsData: Point[][], ctx: CanvasRenderingContext2D, onWin: (player: Player) => void) {
      this.updateTimer();
      this.drawUI(ctx, `POPS: ${this.score} / ${this.maxScore}`);

      let cursor: Point | null = null;
      let pinching = false;

      if (handsData.length > 0) {
          const h = handsData[0];
          cursor = { x: (h[4].x + h[8].x) / 2, y: (h[4].y + h[8].y) / 2 };
          pinching = this.getDistance(h[4], h[8]) < PINCH_THRESHOLD;
          this.drawCursor(ctx, cursor, pinching);
      }

      this.targets.forEach(t => {
          if (!t.alive) return;
          
          ctx.save();
          const pulse = Math.abs(Math.sin(Date.now() / 200)) * 10;
          ctx.beginPath();
          ctx.arc(t.x, t.y, t.r + pulse, 0, Math.PI * 2);
          ctx.strokeStyle = this.color;
          ctx.lineWidth = 3;
          ctx.stroke();
          
          ctx.beginPath();
          ctx.arc(t.x, t.y, t.r - 5, 0, Math.PI * 2);
          ctx.fillStyle = this.color + "44";
          ctx.fill();
          ctx.restore();

          if (cursor && (pinching || this.getDistance(cursor, t) < t.r)) {
              t.alive = false;
              this.score++;
              if (this.score < this.maxScore) {
                  this.targets[this.score].alive = true;
              } else {
                  this.state = 'SOLVED';
                  onWin(this);
              }
          }
      });
  }

  initCatchGame() {
      this.catchItems = [];
      this.score = 0;
      this.maxScore = 15;
      this.startPlaying();
  }

  handleCatchGame(handsData: Point[][], ctx: CanvasRenderingContext2D, onWin: (player: Player) => void) {
      this.updateTimer();
      this.drawUI(ctx, `COLLECTED: ${this.score} / ${this.maxScore}`);

      if (Math.random() < 0.05 && this.catchItems.length < 5) {
          this.catchItems.push({
              x: this.bounds.x + 50 + Math.random() * (this.bounds.w - 100),
              y: -50,
              speed: 3 + Math.random() * 5,
              id: Date.now()
          });
      }

      let handCenter: Point | null = null;
      if (handsData.length > 0) {
          const h = handsData[0];
          handCenter = h[9]; // Middle finger base
      }

      this.catchItems.forEach((item, idx) => {
          item.y += item.speed;
          
          ctx.save();
          ctx.translate(item.x, item.y);
          ctx.rotate(Date.now() / 500);
          ctx.strokeStyle = this.color;
          ctx.lineWidth = 2;
          ctx.strokeRect(-15, -15, 30, 30);
          ctx.restore();

          if (handCenter && this.getDistance(handCenter, item) < 60) {
              this.catchItems.splice(idx, 1);
              this.score++;
              if (this.score >= this.maxScore) {
                  this.state = 'SOLVED';
                  onWin(this);
              }
          } else if (item.y > this.bounds.h + 50) {
              this.catchItems.splice(idx, 1);
          }
      });
  }

  initStrikeGame() {
      this.score = 0;
      this.maxScore = 10;
      this.activeSector = Math.floor(Math.random() * 9);
      this.startPlaying();
  }

  handleStrikeGame(handsData: Point[][], ctx: CanvasRenderingContext2D, onWin: (player: Player) => void) {
      this.updateTimer();
      this.drawUI(ctx, `STRIKES: ${this.score} / ${this.maxScore}`);

      const sectorW = this.bounds.w / 3;
      const sectorH = this.bounds.h / 3;

      for (let i = 0; i < 9; i++) {
          const r = Math.floor(i / 3);
          const c = i % 3;
          const x = this.bounds.x + c * sectorW;
          const y = r * sectorH;

          ctx.save();
          ctx.strokeStyle = i === this.activeSector ? this.color : "rgba(255,255,255,0.1)";
          ctx.lineWidth = i === this.activeSector ? 4 : 1;
          ctx.strokeRect(x + 10, y + 10, sectorW - 20, sectorH - 20);
          if (i === this.activeSector) {
              ctx.fillStyle = this.color + "22";
              ctx.fillRect(x + 10, y + 10, sectorW - 20, sectorH - 20);
          }
          ctx.restore();
      }

      if (handsData.length > 0) {
          const h = handsData[0];
          const tip = h[8];
          const col = Math.floor((tip.x - this.bounds.x) / sectorW);
          const row = Math.floor(tip.y / sectorH);
          const sector = row * 3 + col;

          if (sector === this.activeSector) {
              this.score++;
              this.activeSector = Math.floor(Math.random() * 9);
              if (this.score >= this.maxScore) {
                  this.state = 'SOLVED';
                  onWin(this);
              }
          }
      }
  }

  initTraceGame() {
      this.score = 0;
      this.tracePath = [];
      const centerX = this.bounds.x + this.bounds.w / 2;
      const centerY = this.bounds.h / 2;
      const r = Math.min(this.bounds.w, this.bounds.h) * 0.3;
      
      for(let i=0; i<=20; i++) {
          const angle = (i / 20) * Math.PI * 2;
          this.tracePath.push({
              x: centerX + Math.cos(angle) * r,
              y: centerY + Math.sin(angle) * r
          });
      }
      this.traceProgress = 0;
      this.startPlaying();
  }

  handleTraceGame(handsData: Point[][], ctx: CanvasRenderingContext2D, onWin: (player: Player) => void) {
      this.updateTimer();
      this.drawUI(ctx, `TRACING: ${Math.floor(this.traceProgress / this.tracePath.length * 100)}%`);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(this.tracePath[0].x, this.tracePath[0].y);
      this.tracePath.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 10;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(this.tracePath[0].x, this.tracePath[0].y);
      for(let i=0; i<=this.traceProgress; i++) {
          ctx.lineTo(this.tracePath[i].x, this.tracePath[i].y);
      }
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.restore();

      if (handsData.length > 0) {
          const tip = handsData[0][8];
          const target = this.tracePath[this.traceProgress];
          if (this.getDistance(tip, target) < 40) {
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
      this.maxScore = 20; // survive 20s
      this.startPlaying();
  }

  handleDodgeGame(handsData: Point[][], ctx: CanvasRenderingContext2D, onWin: (player: Player) => void) {
      this.updateTimer();
      this.drawUI(ctx, `SURVIVE: ${this.elapsedTime}s / ${this.maxScore}s`);

      const time = Date.now() / 1000;
      const laserX = this.bounds.x + this.bounds.w / 2 + Math.sin(time * 2) * (this.bounds.w / 2 - 50);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(laserX, 0);
      ctx.lineTo(laserX, this.bounds.h);
      ctx.strokeStyle = "#FF0000";
      ctx.lineWidth = 4 + Math.sin(time * 10) * 2;
      ctx.shadowColor = "#FF0000";
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.restore();

      if (handsData.length > 0) {
          const h = handsData[0];
          const hit = h.some(p => Math.abs(p.x - laserX) < 20);
          if (hit) {
              this.startTime = Date.now(); // Reset time on hit
          }
      }

      if (this.elapsedTime >= this.maxScore) {
          this.state = 'SOLVED';
          onWin(this);
      }
  }

  handleSandboxMode(handsData: Point[][], ctx: CanvasRenderingContext2D) {
      this.drawUI(ctx, "SANDBOX MODE - HAVE FUN");
      if (handsData.length > 0) {
          handsData.forEach(h => {
             this.drawCursor(ctx, h[8], false);
             // Leave trail
             ctx.beginPath();
             ctx.arc(h[8].x, h[8].y, 2, 0, Math.PI*2);
             ctx.fillStyle = this.color;
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
