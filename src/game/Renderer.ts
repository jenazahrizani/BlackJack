import type { GameVisualState } from "./Game";

import {
  COLORS,
  DESIGN,
  getSuitGlyph,
  getSuitColor,
} from "./Entities";

/* ==========================================================================
   BLACKJACK 21 — CASINO RENDERER

   Procedural Canvas 2D renderer.

   No image assets.
   No external textures.
   No PNG/JPG dependencies.

   Rendering order:
   01. Casino background
   02. Background atmosphere
   03. Table shadow
   04. Wooden table body
   05. Gold trim
   06. Felt
   07. Table markings
   08. Dealer body
   09. Dealer arms / hands
   10. Other players
   11. Deck
   12. Dealer cards
   13. Player cards
   14. Chips
   15. Foreground light / vignette
   16. Pixel treatment
   ========================================================================== */

type Suit =
  | "spades"
  | "hearts"
  | "diamonds"
  | "clubs";

type CardVisual = {
  rank: string;
  suit: Suit;

  x: number;
  y: number;

  width: number;
  height: number;

  rotation: number;

  faceUp: boolean;

  shadow?: boolean;
};

type ChipVisual = {
  value: number;

  x: number;
  y: number;

  radius: number;

  rotation: number;

  color?: string;
};

type SeatVisual = {
  x: number;
  y: number;

  occupied: boolean;
  active: boolean;

  name: string;
};

const TAU = Math.PI * 2;

const FONT = {
  tiny: "700 8px 'Courier New', monospace",
  small: "700 10px 'Courier New', monospace",
  medium: "700 13px 'Courier New', monospace",
  large: "700 20px 'Courier New', monospace",
};

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  width = 0;
  height = 0;

  private time = 0;
  private delta = 0;

  private state: GameVisualState | null = null;

  /*
   * Low-resolution procedural render target.
   */
  private internalCanvas: HTMLCanvasElement;
  private internalCtx: CanvasRenderingContext2D;

  /*
   * Calculated layout values.
   */
  private tableScale = 1;

  private tableCenterX = 0;
  private tableCenterY = 0;

  private tableWidth = 0;
  private tableHeight = 0;

  /*
   * Deterministic procedural texture seed.
   */
  private seed = 872341;

  /*
   * Actual display device pixel ratio.
   */
  private dpr = 1;

  /* ========================================================================
     CONSTRUCTOR
     ======================================================================== */

  constructor(
    canvas: HTMLCanvasElement
  ) {
    this.canvas = canvas;

    const ctx =
      canvas.getContext(
        "2d",
        {
          alpha: false,
          desynchronized: true,
        }
      );

    if (!ctx) {
      throw new Error(
        "Blackjack Renderer: Canvas 2D context unavailable."
      );
    }

    this.ctx = ctx;

    this.ctx.imageSmoothingEnabled =
      false;

    /*
     * Internal scene.
     */
    this.internalCanvas =
      document.createElement(
        "canvas"
      );

    const internalCtx =
      this.internalCanvas.getContext(
        "2d",
        {
          alpha: false,
          desynchronized: true,
        }
      );

    if (!internalCtx) {
      throw new Error(
        "Blackjack Renderer: Internal Canvas 2D context unavailable."
      );
    }

    this.internalCtx =
      internalCtx;

    this.internalCtx.imageSmoothingEnabled =
      false;
  }

  /* ========================================================================
     RESIZE
     ======================================================================== */

  resize(
    width: number,
    height: number
  ) {
    this.width =
      Math.max(
        1,
        Math.floor(width)
      );

    this.height =
      Math.max(
        1,
        Math.floor(height)
      );

    /*
     * Clamp device pixel ratio.
     */
    const deviceDpr =
      typeof window !== "undefined"
        ? window.devicePixelRatio || 1
        : 1;

    this.dpr =
      Math.min(
        Math.max(
          1,
          deviceDpr
        ),
        2
      );

    /*
     * Real canvas backing resolution.
     */
    this.canvas.width =
      Math.max(
        1,
        Math.floor(
          this.width *
            this.dpr
        )
      );

    this.canvas.height =
      Math.max(
        1,
        Math.floor(
          this.height *
            this.dpr
        )
      );

    this.canvas.style.width =
      `${this.width}px`;

    this.canvas.style.height =
      `${this.height}px`;

    /*
     * CSS-pixel drawing coordinates.
     */
    this.ctx.setTransform(
      this.dpr,
      0,
      0,
      this.dpr,
      0,
      0
    );

    this.ctx.imageSmoothingEnabled =
      false;

    /*
     * Internal resolution.
     */
    const targetAspect =
      DESIGN.logicalWidth /
      Math.max(
        DESIGN.logicalHeight,
        1
      );

    const currentAspect =
      this.width /
      Math.max(
        this.height,
        1
      );

    let internalWidth =
      480;

    let internalHeight =
      270;

    if (
      currentAspect < 1.35
    ) {
      internalWidth = 400;
      internalHeight = 300;
    } else if (
      currentAspect < 1.55
    ) {
      internalWidth = 448;
      internalHeight = 280;
    } else if (
      currentAspect > targetAspect
    ) {
      internalWidth = 512;
      internalHeight = 288;
    }

    this.internalCanvas.width =
      internalWidth;

    this.internalCanvas.height =
      internalHeight;

    this.internalCtx.setTransform(
      1,
      0,
      0,
      1,
      0,
      0
    );

    this.internalCtx.imageSmoothingEnabled =
      false;

    this.calculateTableLayout();
  }

  /* ========================================================================
     UPDATE
     ======================================================================== */

  update(
    delta: number,
    state?: GameVisualState
  ) {
    this.delta =
      Number.isFinite(delta)
        ? Math.max(
            0,
            delta
          )
        : 0;

    this.time +=
      this.delta;

    if (state) {
      this.state = state;
    }

    this.calculateTableLayout();
  }

  /* ========================================================================
     LAYOUT
     ======================================================================== */

  private calculateTableLayout() {
    const aspect =
      this.width /
      Math.max(
        this.height,
        1
      );

    if (
      aspect >= 1.65
    ) {
      this.tableScale = 1;
    } else if (
      aspect >= 1.4
    ) {
      this.tableScale = 0.94;
    } else {
      this.tableScale = 0.78;
    }

    this.tableCenterX =
      this.width *
      0.5;

    this.tableCenterY =
      this.height *
      0.61;

    this.tableWidth =
      Math.min(
        this.width *
          0.92,
        1460
      ) *
      this.tableScale;

    this.tableHeight =
      Math.min(
        this.height *
          0.67,
        620
      ) *
      this.tableScale;
  }

  /* ========================================================================
     MAIN RENDER
     ======================================================================== */

  render(
    state?: GameVisualState
  ) {
    if (state) {
      this.state = state;
    }

    const ctx =
      this.internalCtx;

    const w =
      this.internalCanvas.width;

    const h =
      this.internalCanvas.height;

    /* ----------------------------------------------------------------------
       WORLD
       ---------------------------------------------------------------------- */

    ctx.save();

    ctx.setTransform(
      1,
      0,
      0,
      1,
      0,
      0
    );

    ctx.clearRect(
      0,
      0,
      w,
      h
    );

    /*
     * Camera.
     */
    const cameraX =
      this.state?.cameraX ?? 0;

    const cameraY =
      this.state?.cameraY ?? 0;

    const cameraZoom =
      this.state?.cameraZoom ?? 1;

    const safeCameraX =
      Number.isFinite(
        cameraX
      )
        ? cameraX
        : 0;

    const safeCameraY =
      Number.isFinite(
        cameraY
      )
        ? cameraY
        : 0;

    const safeCameraZoom =
      Number.isFinite(
        cameraZoom
      )
        ? Math.max(
            0.5,
            Math.min(
              2,
              cameraZoom
            )
          )
        : 1;

    ctx.translate(
      w * 0.5,
      h * 0.5
    );

    ctx.translate(
      safeCameraX * 0.02,
      safeCameraY * 0.02
    );

    ctx.scale(
      safeCameraZoom,
      safeCameraZoom
    );

    ctx.translate(
      -w * 0.5,
      -h * 0.5
    );

    /*
     * Scene.
     */
    this.drawBackground(
      ctx,
      w,
      h
    );

    this.drawCasinoAtmosphere(
      ctx,
      w,
      h
    );

    this.drawTable(
      ctx,
      w,
      h
    );

    this.drawDealer(
      ctx,
      w,
      h
    );

    this.drawSeats(
      ctx,
      w,
      h
    );

    this.drawDeck(
      ctx,
      w,
      h
    );

    this.drawDealerCards(
      ctx,
      w,
      h
    );

    this.drawPlayerCards(
      ctx,
      w,
      h
    );

    this.drawBetAndChips(
      ctx,
      w,
      h
    );

    this.drawTableDetails(
      ctx,
      w,
      h
    );

    ctx.restore();

    /* ----------------------------------------------------------------------
       FOREGROUND
       ---------------------------------------------------------------------- */

    ctx.save();

    ctx.setTransform(
      1,
      0,
      0,
      1,
      0,
      0
    );

    this.drawForegroundLighting(
      ctx,
      w,
      h
    );

    ctx.restore();

    /* ----------------------------------------------------------------------
       INTERNAL -> DISPLAY
       ---------------------------------------------------------------------- */

    this.ctx.save();

    this.ctx.setTransform(
      this.dpr,
      0,
      0,
      this.dpr,
      0,
      0
    );

    this.ctx.clearRect(
      0,
      0,
      this.width,
      this.height
    );

    this.ctx.imageSmoothingEnabled =
      false;

    this.ctx.drawImage(
      this.internalCanvas,
      0,
      0,
      this.width,
      this.height
    );

    this.ctx.restore();
  }

  /* ========================================================================
     BACKGROUND
     ======================================================================== */

  private drawBackground(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ) {
    const gradient =
      ctx.createLinearGradient(
        0,
        0,
        0,
        h
      );

    gradient.addColorStop(
      0,
      COLORS.black
    );

    gradient.addColorStop(
      0.42,
      COLORS.blackSoft
    );

    gradient.addColorStop(
      1,
      COLORS.background
    );

    ctx.fillStyle =
      gradient;

    ctx.fillRect(
      0,
      0,
      w,
      h
    );

    /*
     * Architectural planes.
     */
    ctx.fillStyle =
      "rgba(255,255,255,0.012)";

    ctx.fillRect(
      0,
      h * 0.08,
      w,
      1
    );

    ctx.fillStyle =
      "rgba(255,255,255,0.008)";

    ctx.fillRect(
      0,
      h * 0.27,
      w,
      1
    );

    /*
     * Background columns.
     */
    this.drawBackgroundColumn(
      ctx,
      w * 0.08,
      h * 0.11,
      w * 0.08,
      h * 0.51
    );

    this.drawBackgroundColumn(
      ctx,
      w * 0.84,
      h * 0.14,
      w * 0.08,
      h * 0.48
    );

    /*
     * Far floor.
     */
    const floorY =
      h * 0.57;

    const floorGradient =
      ctx.createLinearGradient(
        0,
        floorY,
        0,
        h
      );

    floorGradient.addColorStop(
      0,
      "#080D0A"
    );

    floorGradient.addColorStop(
      1,
      COLORS.background
    );

    ctx.fillStyle =
      floorGradient;

    ctx.fillRect(
      0,
      floorY,
      w,
      h - floorY
    );
  }

  private drawBackgroundColumn(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    ctx.fillStyle =
      "rgba(4,7,6,0.84)";

    ctx.fillRect(
      x,
      y,
      width,
      height
    );

    ctx.fillStyle =
      "rgba(197,163,92,0.025)";

    ctx.fillRect(
      x + width * 0.18,
      y,
      1,
      height
    );
  }

  /* ========================================================================
     CASINO ATMOSPHERE
     ======================================================================== */

  private drawCasinoAtmosphere(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ) {
    const pulse =
      0.5 +
      Math.sin(
        this.time * 0.42
      ) *
        0.5;

    /*
     * Distant tables.
     */
    this.drawDistantTable(
      ctx,
      w * 0.04,
      h * 0.31,
      w * 0.31,
      h * 0.09
    );

    this.drawDistantTable(
      ctx,
      w * 0.96,
      h * 0.29,
      w * 0.31,
      h * 0.09
    );

    /*
     * Overhead lights.
     */
    const lightPositions = [
      w * 0.12,
      w * 0.27,
      w * 0.50,
      w * 0.73,
      w * 0.88,
    ];

    for (
      let i = 0;
      i < lightPositions.length;
      i++
    ) {
      const x =
        lightPositions[i];

      const intensity =
        0.14 +
        Math.sin(
          this.time *
            (0.18 + i * 0.03) +
            i
        ) *
          0.025;

      ctx.fillStyle =
        `rgba(215,186,119,${intensity})`;

      ctx.fillRect(
        Math.round(x),
        Math.round(
          h * 0.075
        ),
        3,
        2
      );

      ctx.fillStyle =
        `rgba(215,186,119,${intensity * 0.15})`;

      ctx.fillRect(
        Math.round(
          x - 3
        ),
        Math.round(
          h * 0.075 - 2
        ),
        9,
        6
      );
    }

    /*
     * Distant guests.
     */
    this.drawDistantPerson(
      ctx,
      w * 0.13,
      h * 0.40,
      0.8
    );

    this.drawDistantPerson(
      ctx,
      w * 0.88,
      h * 0.41,
      0.75
    );

    /*
     * Central atmospheric bloom.
     */
    const bloom =
      ctx.createRadialGradient(
        w * 0.5,
        h * 0.36,
        0,
        w * 0.5,
        h * 0.36,
        h * 0.48
      );

    bloom.addColorStop(
      0,
      `rgba(25,73,55,${0.07 + pulse * 0.018})`
    );

    bloom.addColorStop(
      0.65,
      "rgba(11,37,29,0.018)"
    );

    bloom.addColorStop(
      1,
      "rgba(0,0,0,0)"
    );

    ctx.fillStyle =
      bloom;

    ctx.fillRect(
      0,
      0,
      w,
      h
    );
  }

  private drawDistantTable(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    ctx.save();

    ctx.globalAlpha =
      0.18;

    ctx.fillStyle =
      COLORS.feltDeep;

    ctx.beginPath();

    ctx.ellipse(
      x,
      y,
      width * 0.5,
      height * 0.5,
      0,
      0,
      TAU
    );

    ctx.fill();

    ctx.strokeStyle =
      "rgba(197,163,92,0.18)";

    ctx.lineWidth =
      1;

    ctx.stroke();

    ctx.restore();
  }

  private drawDistantPerson(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number
  ) {
    ctx.save();

    ctx.globalAlpha =
      0.20;

    ctx.fillStyle =
      COLORS.blackSoft;

    ctx.beginPath();

    ctx.arc(
      x,
      y,
      7 * scale,
      0,
      TAU
    );

    ctx.fill();

    ctx.beginPath();

    ctx.ellipse(
      x,
      y + 14 * scale,
      13 * scale,
      17 * scale,
      0,
      0,
      TAU
    );

    ctx.fill();

    ctx.restore();
  }

  /* ========================================================================
     TABLE
     ======================================================================== */

  private drawTable(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ) {
    const cx =
      w * 0.5;

    const cy =
      h * 0.61;

    const outerW =
      w * 0.93;

    const outerH =
      h * 0.68;

    /*
     * Deep shadow.
     */
    ctx.fillStyle =
      "rgba(0,0,0,0.68)";

    ctx.beginPath();

    ctx.ellipse(
      cx + 7,
      cy + 14,
      outerW * 0.46,
      outerH * 0.45,
      0,
      0,
      TAU
    );

    ctx.fill();

    /*
     * Black separation.
     */
    ctx.fillStyle =
      COLORS.blackSoft;

    ctx.beginPath();

    ctx.ellipse(
      cx,
      cy + 5,
      outerW * 0.49,
      outerH * 0.48,
      0,
      0,
      TAU
    );

    ctx.fill();

    /*
     * Deep wood.
     */
    ctx.fillStyle =
      COLORS.woodDeep;

    ctx.beginPath();

    ctx.ellipse(
      cx,
      cy,
      outerW * 0.485,
      outerH * 0.47,
      0,
      0,
      TAU
    );

    ctx.fill();

    /*
     * Main wood.
     */
    ctx.fillStyle =
      COLORS.wood;

    ctx.beginPath();

    ctx.ellipse(
      cx,
      cy - 2,
      outerW * 0.465,
      outerH * 0.448,
      0,
      0,
      TAU
    );

    ctx.fill();

    /*
     * Wood highlight.
     */
    ctx.strokeStyle =
      "rgba(79,51,31,0.55)";

    ctx.lineWidth =
      3;

    ctx.beginPath();

    ctx.ellipse(
      cx,
      cy - 2,
      outerW * 0.452,
      outerH * 0.435,
      0,
      0,
      TAU
    );

    ctx.stroke();

    /*
     * Gold trim.
     */
    ctx.strokeStyle =
      COLORS.goldDark;

    ctx.lineWidth =
      7;

    ctx.beginPath();

    ctx.ellipse(
      cx,
      cy - 4,
      outerW * 0.425,
      outerH * 0.40,
      0,
      0,
      TAU
    );

    ctx.stroke();

    ctx.strokeStyle =
      COLORS.goldLight;

    ctx.lineWidth =
      1;

    ctx.globalAlpha =
      0.70;

    ctx.beginPath();

    ctx.ellipse(
      cx,
      cy - 4,
      outerW * 0.419,
      outerH * 0.394,
      0,
      0,
      TAU
    );

    ctx.stroke();

    ctx.globalAlpha =
      1;

    /*
     * Felt.
     */
    ctx.fillStyle =
      COLORS.felt;

    ctx.beginPath();

    ctx.ellipse(
      cx,
      cy - 7,
      outerW * 0.398,
      outerH * 0.363,
      0,
      0,
      TAU
    );

    ctx.fill();

    /*
     * Felt lighting.
     */
    const feltLight =
      ctx.createRadialGradient(
        cx,
        cy - h * 0.08,
        0,
        cx,
        cy,
        outerW * 0.41
      );

    feltLight.addColorStop(
      0,
      "rgba(38,100,76,0.20)"
    );

    feltLight.addColorStop(
      0.42,
      "rgba(18,65,50,0.07)"
    );

    feltLight.addColorStop(
      1,
      "rgba(0,0,0,0.34)"
    );

    ctx.fillStyle =
      feltLight;

    ctx.beginPath();

    ctx.ellipse(
      cx,
      cy - 7,
      outerW * 0.398,
      outerH * 0.363,
      0,
      0,
      TAU
    );

    ctx.fill();

    /*
     * Felt grain.
     */
    this.drawFeltTexture(
      ctx,
      cx,
      cy,
      outerW * 0.39,
      outerH * 0.355
    );

    /*
     * Dealer rail.
     */
    this.drawTableRail(
      ctx,
      cx,
      cy - outerH * 0.19,
      outerW * 0.30,
      outerH * 0.08
    );
  }

  private drawFeltTexture(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    rx: number,
    ry: number
  ) {
    const count =
      230;

    let seed =
      this.seed;

    for (
      let i = 0;
      i < count;
      i++
    ) {
      seed =
        (
          seed * 1664525 +
          1013904223
        ) >>> 0;

      const unitX =
        (
          seed & 0xffff
        ) /
        0xffff;

      seed =
        (
          seed * 1664525 +
          1013904223
        ) >>> 0;

      const unitY =
        (
          seed & 0xffff
        ) /
        0xffff;

      const dx =
        unitX * 2 - 1;

      const dy =
        unitY * 2 - 1;

      if (
        dx * dx +
          dy * dy >
        1
      ) {
        continue;
      }

      const x =
        cx +
        dx * rx;

      const y =
        cy +
        dy * ry;

      const bright =
        i % 3 === 0;

      ctx.fillStyle =
        bright
          ? "rgba(72,126,99,0.055)"
          : "rgba(0,0,0,0.055)";

      ctx.fillRect(
        Math.round(x),
        Math.round(y),
        1,
        1
      );
    }
  }

  private drawTableRail(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    ctx.fillStyle =
      "rgba(5,22,17,0.55)";

    ctx.fillRect(
      x - width * 0.5,
      y - height * 0.5,
      width,
      height
    );

    ctx.strokeStyle =
      "rgba(197,163,92,0.23)";

    ctx.lineWidth =
      1;

    ctx.strokeRect(
      x - width * 0.5,
      y - height * 0.5,
      width,
      height
    );

    ctx.fillStyle =
      "rgba(197,163,92,0.55)";

    ctx.font =
      FONT.tiny;

    ctx.textAlign =
      "center";

    ctx.textBaseline =
      "middle";

    ctx.fillText(
      "BLACKJACK",
      x,
      y - 2
    );
  }

  /* ========================================================================
     DEALER
     ======================================================================== */

  private drawDealer(
    ctx: CanvasRenderingContext2D,
    _w: number,
    h: number
  ) {
    const cx =
      this.internalCanvas.width *
      0.5;

    const baseY =
      h * 0.30;

    const breathing =
      this.state?.phase ===
      "loading"
        ? 0
        : Math.sin(
            this.time * 0.95
          ) * 1.1;

    ctx.save();

    /*
     * Back shadow.
     */
    ctx.fillStyle =
      "rgba(0,0,0,0.50)";

    ctx.beginPath();

    ctx.ellipse(
      cx,
      baseY + 50,
      67,
      18,
      0,
      0,
      TAU
    );

    ctx.fill();

    /*
     * Jacket / torso.
     */
    ctx.fillStyle =
      COLORS.jacket;

    ctx.beginPath();

    ctx.moveTo(
      cx - 48,
      baseY + 69 + breathing
    );

    ctx.lineTo(
      cx - 35,
      baseY + 28 + breathing
    );

    ctx.lineTo(
      cx - 18,
      baseY + 14 + breathing
    );

    ctx.lineTo(
      cx + 18,
      baseY + 14 + breathing
    );

    ctx.lineTo(
      cx + 35,
      baseY + 28 + breathing
    );

    ctx.lineTo(
      cx + 48,
      baseY + 69 + breathing
    );

    ctx.closePath();

    ctx.fill();

    /*
     * Jacket highlight.
     */
    ctx.strokeStyle =
      "rgba(231,225,211,0.08)";

    ctx.lineWidth =
      2;

    ctx.beginPath();

    ctx.moveTo(
      cx - 30,
      baseY + 28 + breathing
    );

    ctx.lineTo(
      cx - 4,
      baseY + 66 + breathing
    );

    ctx.lineTo(
      cx + 30,
      baseY + 28 + breathing
    );

    ctx.stroke();

    /*
     * Shirt.
     */
    ctx.fillStyle =
      COLORS.cardLight;

    ctx.beginPath();

    ctx.moveTo(
      cx - 15,
      baseY + 23 + breathing
    );

    ctx.lineTo(
      cx,
      baseY + 14 + breathing
    );

    ctx.lineTo(
      cx + 15,
      baseY + 23 + breathing
    );

    ctx.lineTo(
      cx + 9,
      baseY + 48 + breathing
    );

    ctx.lineTo(
      cx - 9,
      baseY + 48 + breathing
    );

    ctx.closePath();

    ctx.fill();

    /*
     * Tie.
     */
    ctx.fillStyle =
      COLORS.red;

    ctx.beginPath();

    ctx.moveTo(
      cx - 3,
      baseY + 24 + breathing
    );

    ctx.lineTo(
      cx + 3,
      baseY + 24 + breathing
    );

    ctx.lineTo(
      cx + 4,
      baseY + 47 + breathing
    );

    ctx.lineTo(
      cx,
      baseY + 52 + breathing
    );

    ctx.lineTo(
      cx - 4,
      baseY + 47 + breathing
    );

    ctx.closePath();

    ctx.fill();

    /*
     * Neck.
     */
    ctx.fillStyle =
      COLORS.skinDark;

    ctx.fillRect(
      cx - 7,
      baseY + 6 + breathing,
      14,
      12
    );

    /*
     * Head.
     */
    ctx.fillStyle =
      COLORS.skin;

    ctx.beginPath();

    ctx.ellipse(
      cx,
      baseY - 5 + breathing,
      23,
      27,
      0,
      0,
      TAU
    );

    ctx.fill();

    /*
     * Hair.
     */
    ctx.fillStyle =
      COLORS.hairBlack;

    ctx.beginPath();

    ctx.arc(
      cx,
      baseY - 16 + breathing,
      23,
      Math.PI,
      TAU
    );

    ctx.fill();

    /*
     * Face shadow.
     */
    ctx.fillStyle =
      "rgba(33,24,20,0.20)";

    ctx.beginPath();

    ctx.ellipse(
      cx + 4,
      baseY + 1 + breathing,
      18,
      18,
      0,
      0,
      TAU
    );

    ctx.fill();

    /*
     * Eyes.
     */
    ctx.fillStyle =
      "rgba(48,40,32,0.85)";

    ctx.fillRect(
      cx - 9,
      baseY - 4 + breathing,
      3,
      2
    );

    ctx.fillRect(
      cx + 6,
      baseY - 4 + breathing,
      3,
      2
    );

    /*
     * Face highlight.
     */
    ctx.fillStyle =
      "rgba(255,236,210,0.14)";

    ctx.fillRect(
      cx - 11,
      baseY + 10 + breathing,
      20,
      1
    );

    /*
     * Left arm.
     */
    this.drawDealerArm(
      ctx,
      cx - 34,
      baseY + 33 + breathing,
      cx - 75,
      baseY + 78 + breathing,
      -0.32
    );

    /*
     * Right arm.
     */
    this.drawDealerArm(
      ctx,
      cx + 34,
      baseY + 33 + breathing,
      cx + 75,
      baseY + 78 + breathing,
      0.32
    );

    ctx.restore();
  }

  private drawDealerArm(
    ctx: CanvasRenderingContext2D,
    shoulderX: number,
    shoulderY: number,
    handX: number,
    handY: number,
    bend: number
  ) {
    const midX =
      (
        shoulderX +
        handX
      ) /
        2 +
      bend * 18;

    const midY =
      (
        shoulderY +
        handY
      ) /
        2 -
      2;

    /*
     * Upper arm.
     */
    ctx.strokeStyle =
      COLORS.jacket;

    ctx.lineWidth =
      14;

    ctx.lineCap =
      "round";

    ctx.beginPath();

    ctx.moveTo(
      shoulderX,
      shoulderY
    );

    ctx.lineTo(
      midX,
      midY
    );

    ctx.stroke();

    /*
     * Forearm.
     */
    ctx.lineWidth =
      11;

    ctx.strokeStyle =
      COLORS.jacketLight;

    ctx.beginPath();

    ctx.moveTo(
      midX,
      midY
    );

    ctx.lineTo(
      handX,
      handY
    );

    ctx.stroke();

    /*
     * Hand.
     */
    ctx.fillStyle =
      COLORS.skin;

    ctx.beginPath();

    ctx.arc(
      handX,
      handY,
      8,
      0,
      TAU
    );

    ctx.fill();

    /*
     * Finger plane.
     */
    ctx.fillStyle =
      "rgba(46,35,28,0.20)";

    ctx.fillRect(
      handX - 4,
      handY + 1,
      8,
      2
    );
  }

  /* ========================================================================
     SEATS / PLAYERS
     ======================================================================== */

  private drawSeats(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ) {
    const tableY =
      h * 0.63;

    const seats: SeatVisual[] = [
      {
        x: w * 0.16,
        y: tableY - 18,
        occupied: true,
        active: false,
        name: "MICHAEL",
      },
      {
        x: w * 0.31,
        y: tableY + 13,
        occupied: true,
        active: false,
        name: "OLIVIA",
      },
      {
        x: w * 0.50,
        y: tableY + 31,
        occupied: true,
        active: true,
        name: "PLAYER",
      },
      {
        x: w * 0.69,
        y: tableY + 13,
        occupied: true,
        active: false,
        name: "DANIEL",
      },
      {
        x: w * 0.84,
        y: tableY - 18,
        occupied: true,
        active: false,
        name: "JULIA",
      },
    ];

    for (
      const seat of seats
    ) {
      if (!seat.occupied) {
        continue;
      }

      this.drawSeat(
        ctx,
        seat
      );
    }
  }

  private drawSeat(
    ctx: CanvasRenderingContext2D,
    seat: SeatVisual
  ) {
    /*
     * Shadow.
     */
    ctx.fillStyle =
      "rgba(0,0,0,0.35)";

    ctx.beginPath();

    ctx.ellipse(
      seat.x,
      seat.y + 28,
      37,
      12,
      0,
      0,
      TAU
    );

    ctx.fill();

    /*
     * Shoulders.
     */
    ctx.fillStyle =
      seat.active
        ? COLORS.jacketLight
        : COLORS.jacket;

    ctx.beginPath();

    ctx.ellipse(
      seat.x,
      seat.y + 15,
      34,
      27,
      0,
      0,
      TAU
    );

    ctx.fill();

    /*
     * Head.
     */
    ctx.fillStyle =
      COLORS.skin;

    ctx.beginPath();

    ctx.arc(
      seat.x,
      seat.y - 4,
      14,
      0,
      TAU
    );

    ctx.fill();

    /*
     * Hair.
     */
    ctx.fillStyle =
      COLORS.hairBlack;

    ctx.beginPath();

    ctx.arc(
      seat.x,
      seat.y - 10,
      14,
      Math.PI,
      TAU
    );

    ctx.fill();

    /*
     * Face light.
     */
    ctx.fillStyle =
      "rgba(235,215,190,0.08)";

    ctx.fillRect(
      seat.x - 5,
      seat.y - 1,
      10,
      2
    );

    /*
     * Name plate.
     */
    if (
      seat.active
    ) {
      ctx.strokeStyle =
        "rgba(225,199,119,0.35)";

      ctx.lineWidth =
        1;

      ctx.strokeRect(
        seat.x - 34,
        seat.y + 38,
        68,
        12
      );

      ctx.fillStyle =
        "rgba(225,199,119,0.82)";
    } else {
      ctx.fillStyle =
        "rgba(231,225,211,0.30)";
    }

    ctx.font =
      FONT.tiny;

    ctx.textAlign =
      "center";

    ctx.textBaseline =
      "middle";

    ctx.fillText(
      seat.name,
      seat.x,
      seat.y + 44
    );
  }

  /* ========================================================================
     DECK
     ======================================================================== */

  private drawDeck(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ) {
    const x =
      w * 0.57;

    const y =
      h * 0.39;

    /*
     * Shadow.
     */
    ctx.fillStyle =
      "rgba(0,0,0,0.55)";

    ctx.fillRect(
      x + 4,
      y + 5,
      25,
      36
    );

    /*
     * Stacked cards.
     */
    for (
      let i = 0;
      i < 4;
      i++
    ) {
      ctx.fillStyle =
        i % 2 === 0
          ? COLORS.cardLight
          : COLORS.card;

      ctx.fillRect(
        x - i,
        y - i,
        24,
        35
      );

      ctx.strokeStyle =
        "rgba(20,20,18,0.38)";

      ctx.lineWidth =
        1;

      ctx.strokeRect(
        x - i,
        y - i,
        24,
        35
      );
    }

    /*
     * Top card back.
     */
    this.drawCardBack(
      ctx,
      x - 3,
      y - 3,
      24,
      35,
      0
    );
  }

  /* ========================================================================
     CARD BACK
     ======================================================================== */

  private drawCardBack(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    rotation = 0
  ) {
    ctx.save();

    ctx.translate(
      x + width / 2,
      y + height / 2
    );

    ctx.rotate(
      rotation
    );

    ctx.translate(
      -width / 2,
      -height / 2
    );

    /*
     * Shadow.
     */
    ctx.fillStyle =
      "rgba(0,0,0,0.52)";

    ctx.fillRect(
      3,
      3,
      width,
      height
    );

    /*
     * Card stock.
     */
    ctx.fillStyle =
      COLORS.cardLight;

    ctx.fillRect(
      0,
      0,
      width,
      height
    );

    /*
     * Back field.
     */
    ctx.fillStyle =
      COLORS.feltMid;

    ctx.fillRect(
      2,
      2,
      width - 4,
      height - 4
    );

    /*
     * Gold border.
     */
    ctx.strokeStyle =
      "rgba(206,177,101,0.72)";

    ctx.lineWidth =
      1;

    ctx.strokeRect(
      4,
      4,
      width - 8,
      height - 8
    );

    /*
     * Center geometry.
     */
    ctx.fillStyle =
      "rgba(220,193,119,0.68)";

    for (
      let row = 0;
      row < 5;
      row++
    ) {
      for (
        let col = 0;
        col < 3;
        col++
      ) {
        const px =
          6 +
          col * 5;

        const py =
          5 +
          row * 6;

        if (
          (
            row +
            col
          ) %
            2 ===
          0
        ) {
          ctx.fillRect(
            px,
            py,
            2,
            2
          );
        }
      }
    }

    ctx.restore();
  }

  /* ========================================================================
     DEALER CARDS
     ======================================================================== */

  private drawDealerCards(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ) {
    const centerX =
      w * 0.50;

    const y =
      h * 0.39;

    const cardW =
      35;

    const cardH =
      52;

    /*
     * Hole card.
     */
    this.drawCard(
      ctx,
      {
        rank: "A",
        suit: "spades",
        x: centerX - 30,
        y,
        width: cardW,
        height: cardH,
        rotation: -0.035,
        faceUp: false,
        shadow: true,
      }
    );

    /*
     * Up card.
     */
    this.drawCard(
      ctx,
      {
        rank: "10",
        suit: "hearts",
        x: centerX + 5,
        y,
        width: cardW,
        height: cardH,
        rotation: 0.035,
        faceUp: true,
        shadow: true,
      }
    );
  }

  /* ========================================================================
     PLAYER CARDS
     ======================================================================== */

  private drawPlayerCards(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ) {
    const centerX =
      w * 0.50;

    const y =
      h * 0.68;

    const cardW =
      43;

    const cardH =
      62;

    /*
     * First card.
     */
    this.drawCard(
      ctx,
      {
        rank: "10",
        suit: "spades",
        x:
          centerX -
          cardW -
          8,
        y,
        width: cardW,
        height: cardH,
        rotation: -0.055,
        faceUp: true,
        shadow: true,
      }
    );

    /*
     * Second card.
     */
    this.drawCard(
      ctx,
      {
        rank: "8",
        suit: "hearts",
        x:
          centerX +
          8,
        y,
        width: cardW,
        height: cardH,
        rotation: 0.055,
        faceUp: true,
        shadow: true,
      }
    );
  }

  /* ========================================================================
     CARD RENDERER
     ======================================================================== */

  private drawCard(
    ctx: CanvasRenderingContext2D,
    card: CardVisual
  ) {
    const {
      x,
      y,
      width,
      height,
      rotation,
      faceUp,
      rank,
      suit,
    } = card;

    ctx.save();

    ctx.translate(
      x + width / 2,
      y + height / 2
    );

    ctx.rotate(
      rotation
    );

    ctx.translate(
      -width / 2,
      -height / 2
    );

    /*
     * Shadow.
     */
    if (
      card.shadow !== false
    ) {
      ctx.fillStyle =
        "rgba(0,0,0,0.48)";

      ctx.fillRect(
        3,
        4,
        width,
        height
      );
    }

    /*
     * Main card.
     */
    ctx.fillStyle =
      COLORS.card;

    this.roundRect(
      ctx,
      0,
      0,
      width,
      height,
      2
    );

    ctx.fill();

    /*
     * Card edge.
     */
    ctx.strokeStyle =
      COLORS.cardEdge;

    ctx.lineWidth =
      1;

    this.roundRect(
      ctx,
      0.5,
      0.5,
      width - 1,
      height - 1,
      2
    );

    ctx.stroke();

    /*
     * Hole card.
     */
    if (!faceUp) {
      ctx.restore();

      this.drawCardBack(
        ctx,
        x,
        y,
        width,
        height,
        rotation
      );

      return;
    }

    /*
     * Suit color from Entities.ts.
     */
    ctx.fillStyle =
      getSuitColor(
        suit
      );

    /*
     * Top rank.
     */
    ctx.font =
      width < 40
        ? "700 11px 'Courier New', monospace"
        : "700 13px 'Courier New', monospace";

    ctx.textAlign =
      "left";

    ctx.textBaseline =
      "top";

    ctx.fillText(
      rank,
      5,
      4
    );

    /*
     * Top suit.
     */
    ctx.font =
      width < 40
        ? "700 9px serif"
        : "700 11px serif";

    ctx.fillText(
      getSuitGlyph(
        suit
      ),
      6,
      17
    );

    /*
     * Center pip.
     */
    ctx.textAlign =
      "center";

    ctx.textBaseline =
      "middle";

    ctx.font =
      width < 40
        ? "700 20px serif"
        : "700 26px serif";

    ctx.fillText(
      getSuitGlyph(
        suit
      ),
      width / 2,
      height / 2 + 1
    );

    /*
     * Bottom rank.
     */
    ctx.textAlign =
      "right";

    ctx.textBaseline =
      "bottom";

    ctx.font =
      width < 40
        ? "700 10px 'Courier New', monospace"
        : "700 12px 'Courier New', monospace";

    ctx.fillText(
      rank,
      width - 5,
      height - 4
    );

    /*
     * Bottom suit.
     */
    ctx.font =
      width < 40
        ? "700 8px serif"
        : "700 10px serif";

    ctx.fillText(
      getSuitGlyph(
        suit
      ),
      width - 6,
      height - 16
    );

    /*
     * Card highlight.
     */
    ctx.fillStyle =
      "rgba(255,255,255,0.16)";

    ctx.fillRect(
      2,
      2,
      width - 4,
      1
    );

    ctx.restore();
  }

  /* ========================================================================
     BET / CHIPS
     ======================================================================== */

  private drawBetAndChips(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ) {
    const cx =
      w * 0.50;

    const cy =
      h * 0.77;

    /*
     * Bet area shadow.
     */
    ctx.fillStyle =
      "rgba(0,0,0,0.24)";

    ctx.beginPath();

    ctx.arc(
      cx,
      cy,
      35,
      0,
      TAU
    );

    ctx.fill();

    /*
     * Outer betting ring.
     */
    ctx.strokeStyle =
      "rgba(197,163,92,0.32)";

    ctx.lineWidth =
      1;

    ctx.beginPath();

    ctx.arc(
      cx,
      cy,
      34,
      0,
      TAU
    );

    ctx.stroke();

    /*
     * Inner ring.
     */
    ctx.strokeStyle =
      "rgba(197,163,92,0.11)";

    ctx.beginPath();

    ctx.arc(
      cx,
      cy,
      28,
      0,
      TAU
    );

    ctx.stroke();

    /*
     * Label.
     */
    ctx.fillStyle =
      "rgba(231,225,211,0.44)";

    ctx.font =
      "700 6px 'Courier New', monospace";

    ctx.textAlign =
      "center";

    ctx.textBaseline =
      "middle";

    ctx.fillText(
      "YOUR BET",
      cx,
      cy - 7
    );

    /*
     * Current bet.
     */
    ctx.fillStyle =
      COLORS.goldLight;

    ctx.font =
      FONT.medium;

    ctx.fillText(
      "$25",
      cx,
      cy + 6
    );

    /*
     * Chips.
     */
    const chips: ChipVisual[] = [
      {
        value: 5,
        x: cx + 50,
        y: cy + 12,
        radius: 11,
        rotation: -0.08,
        color: COLORS.chipRed,
      },
      {
        value: 5,
        x: cx + 50,
        y: cy + 7,
        radius: 11,
        rotation: 0.04,
        color: COLORS.chipRed,
      },
      {
        value: 5,
        x: cx + 50,
        y: cy + 2,
        radius: 11,
        rotation: -0.03,
        color: COLORS.chipRed,
      },
      {
        value: 10,
        x: cx + 50,
        y: cy - 3,
        radius: 11,
        rotation: 0.07,
        color: COLORS.chipBlue,
      },
    ];

    for (
      const chip of chips
    ) {
      this.drawChip(
        ctx,
        chip
      );
    }
  }

  private drawChip(
    ctx: CanvasRenderingContext2D,
    chip: ChipVisual
  ) {
    ctx.save();

    ctx.translate(
      chip.x,
      chip.y
    );

    ctx.rotate(
      chip.rotation
    );

    /*
     * Shadow.
     */
    ctx.fillStyle =
      "rgba(0,0,0,0.52)";

    ctx.beginPath();

    ctx.ellipse(
      2,
      3,
      chip.radius,
      chip.radius * 0.82,
      0,
      0,
      TAU
    );

    ctx.fill();

    /*
     * Main chip.
     */
    ctx.fillStyle =
      chip.color ??
      COLORS.chipRed;

    ctx.beginPath();

    ctx.arc(
      0,
      0,
      chip.radius,
      0,
      TAU
    );

    ctx.fill();

    /*
     * Gold outline.
     */
    ctx.strokeStyle =
      "rgba(235,210,139,0.70)";

    ctx.lineWidth =
      1;

    ctx.beginPath();

    ctx.arc(
      0,
      0,
      chip.radius - 1,
      0,
      TAU
    );

    ctx.stroke();

    /*
     * Inner field.
     */
    ctx.fillStyle =
      "rgba(20,20,20,0.26)";

    ctx.beginPath();

    ctx.arc(
      0,
      0,
      chip.radius * 0.65,
      0,
      TAU
    );

    ctx.fill();

    /*
     * Edge notches.
     *
     * IMPORTANT:
     * Do not use COLORS.ivory because that key does not exist
     * in the shared Entities.ts color table.
     */
    ctx.fillStyle =
      COLORS.cardLight;

    for (
      let i = 0;
      i < 8;
      i++
    ) {
      const a =
        (
          i / 8
        ) *
        TAU;

      const nx =
        Math.cos(a) *
        chip.radius *
        0.80;

      const ny =
        Math.sin(a) *
        chip.radius *
        0.80;

      ctx.fillRect(
        Math.round(
          nx - 1
        ),
        Math.round(
          ny - 1
        ),
        2,
        2
      );
    }

    /*
     * Denomination.
     */
    ctx.fillStyle =
      COLORS.cardLight;

    ctx.font =
      "700 6px 'Courier New', monospace";

    ctx.textAlign =
      "center";

    ctx.textBaseline =
      "middle";

    ctx.fillText(
      `$${chip.value}`,
      0,
      0
    );

    ctx.restore();
  }

  /* ========================================================================
     TABLE DETAILS
     ======================================================================== */

  private drawTableDetails(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ) {
    const cx =
      w * 0.50;

    const cy =
      h * 0.61;

    /*
     * Dealer rule.
     */
    ctx.fillStyle =
      "rgba(197,163,92,0.50)";

    ctx.font =
      "700 6px 'Courier New', monospace";

    ctx.textAlign =
      "center";

    ctx.textBaseline =
      "middle";

    ctx.fillText(
      "DEALER STANDS ON 17",
      cx,
      cy - h * 0.055
    );

    /*
     * Blackjack payout.
     */
    ctx.fillStyle =
      "rgba(231,225,211,0.30)";

    ctx.fillText(
      "BLACKJACK PAYS 3 : 2",
      cx,
      cy + h * 0.10
    );

    /*
     * Minimum.
     */
    ctx.textAlign =
      "left";

    ctx.fillText(
      "MIN $5",
      w * 0.16,
      h * 0.81
    );

    /*
     * Maximum.
     */
    ctx.textAlign =
      "right";

    ctx.fillText(
      "MAX $500",
      w * 0.84,
      h * 0.81
    );
  }

  /* ========================================================================
     FOREGROUND LIGHTING
     ======================================================================== */

  private drawForegroundLighting(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ) {
    /*
     * Top vignette.
     */
    const top =
      ctx.createLinearGradient(
        0,
        0,
        0,
        h * 0.42
      );

    top.addColorStop(
      0,
      "rgba(0,0,0,0.50)"
    );

    top.addColorStop(
      0.65,
      "rgba(0,0,0,0.08)"
    );

    top.addColorStop(
      1,
      "rgba(0,0,0,0)"
    );

    ctx.fillStyle =
      top;

    ctx.fillRect(
      0,
      0,
      w,
      h * 0.44
    );

    /*
     * Main vignette.
     */
    const centerX =
      w * 0.50;

    const centerY =
      h * 0.56;

    const vignette =
      ctx.createRadialGradient(
        centerX,
        centerY,
        h * 0.17,
        centerX,
        centerY,
        w * 0.64
      );

    vignette.addColorStop(
      0,
      "rgba(0,0,0,0)"
    );

    vignette.addColorStop(
      0.73,
      "rgba(0,0,0,0.08)"
    );

    vignette.addColorStop(
      1,
      "rgba(0,0,0,0.58)"
    );

    ctx.fillStyle =
      vignette;

    ctx.fillRect(
      0,
      0,
      w,
      h
    );

    /*
     * Subtle scanlines.
     */
    ctx.fillStyle =
      "rgba(255,255,255,0.006)";

    for (
      let y = 0;
      y < h;
      y += 3
    ) {
      ctx.fillRect(
        0,
        y,
        w,
        1
      );
    }
  }

  /* ========================================================================
     GEOMETRY
     ======================================================================== */

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) {
    const r =
      Math.max(
        0,
        Math.min(
          radius,
          width / 2,
          height / 2
        )
      );

    ctx.beginPath();

    ctx.moveTo(
      x + r,
      y
    );

    ctx.lineTo(
      x + width - r,
      y
    );

    ctx.quadraticCurveTo(
      x + width,
      y,
      x + width,
      y + r
    );

    ctx.lineTo(
      x + width,
      y + height - r
    );

    ctx.quadraticCurveTo(
      x + width,
      y + height,
      x + width - r,
      y + height
    );

    ctx.lineTo(
      x + r,
      y + height
    );

    ctx.quadraticCurveTo(
      x,
      y + height,
      x,
      y + height - r
    );

    ctx.lineTo(
      x,
      y + r
    );

    ctx.quadraticCurveTo(
      x,
      y,
      x + r,
      y
    );

    ctx.closePath();
  }

  /* ========================================================================
     CLEANUP
     ======================================================================== */

  destroy() {
    this.ctx.save();

    this.ctx.setTransform(
      this.dpr,
      0,
      0,
      this.dpr,
      0,
      0
    );

    this.ctx.clearRect(
      0,
      0,
      this.width,
      this.height
    );

    this.ctx.restore();

    this.internalCtx.save();

    this.internalCtx.setTransform(
      1,
      0,
      0,
      1,
      0,
      0
    );

    this.internalCtx.clearRect(
      0,
      0,
      this.internalCanvas.width,
      this.internalCanvas.height
    );

    this.internalCtx.restore();

    this.state = null;

    this.time = 0;
    this.delta = 0;
  }
}