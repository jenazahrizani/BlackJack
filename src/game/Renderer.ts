import type { GameVisualState } from "./Game";

import {
  COLORS,
  getSuitGlyph,
  getSuitColor,
  getChipHex,
  type Card,
  type Hand,
  type Player,
} from "./Entities";


/* ==========================================================================
   BLACKJACK 21 — FIRST PERSON PIXEL CASINO RENDERER

   Visual direction
   --------------------------------------------------------------------------
   - First-person point of view.
   - Player is physically seated at the table.
   - Dealer is visible without head / face.
   - Other players are visible only through body / sleeves / hands.
   - Entire scene is procedurally rendered.
   - Entire scene is rendered internally at low resolution.
   - Final output is nearest-neighbor pixel scaling.
   - Real Blackjack state drives cards / chips / active player.

   Renderer responsibilities
   --------------------------------------------------------------------------
   - Environment
   - Table
   - Dealer body
   - Player silhouettes
   - Actual cards
   - Actual chips
   - Table markings
   - Result atmosphere
   - Pixel treatment

   Renderer does NOT decide gameplay rules.
   ========================================================================== */


/* ==========================================================================
   LOCAL TYPES
   ========================================================================== */

type Suit =
  | "spades"
  | "hearts"
  | "diamonds"
  | "clubs";


type CardVisual = {
  card?: Card;

  rank: string;
  suit: Suit;

  x: number;
  y: number;

  width: number;
  height: number;

  rotation: number;

  faceUp: boolean;

  shadow?: boolean;

  emphasis?: boolean;

  opacity?: number;
};


type ChipVisual = {
  value: number;

  x: number;
  y: number;

  radius: number;

  rotation: number;

  color: string;

  stackIndex?: number;
};


/* ==========================================================================
   CONSTANTS
   ========================================================================== */

const TAU =
  Math.PI * 2;


const FONT = {
  tiny:
    "700 6px 'Courier New', monospace",

  small:
    "700 7px 'Courier New', monospace",

  medium:
    "700 9px 'Courier New', monospace",

  large:
    "700 14px 'Courier New', monospace",
};


/* ==========================================================================
   RENDERER
   ========================================================================== */

export class Renderer {

  /* ========================================================================
     PUBLIC CANVAS
     ======================================================================== */

  readonly canvas:
    HTMLCanvasElement;

  readonly ctx:
    CanvasRenderingContext2D;


  /* ========================================================================
     OUTPUT SIZE
     ======================================================================== */

  width =
    0;

  height =
    0;


  /* ========================================================================
     INTERNAL TIME
     ======================================================================== */

  private time =
    0;

  private delta =
    0;


  /* ========================================================================
     CURRENT STATE
     ======================================================================== */

  private state:
    GameVisualState | null =
    null;


  /* ========================================================================
     INTERNAL LOW-RES CANVAS
     ======================================================================== */

  private internalCanvas:
    HTMLCanvasElement;

  private internalCtx:
    CanvasRenderingContext2D;


  /* ========================================================================
     DEVICE PIXEL RATIO
     ======================================================================== */

  private dpr =
    1;


  /* ========================================================================
     PROCEDURAL SEED
     ======================================================================== */

  private seed =
    872341;


  /* ========================================================================
     INTERNAL RESOLUTION
     ======================================================================== */

  private sceneWidth =
    480;

  private sceneHeight =
    270;


  /* ========================================================================
     CONSTRUCTOR
     ======================================================================== */

  constructor(
    canvas: HTMLCanvasElement
  ) {
    this.canvas =
      canvas;


    const ctx =
      canvas.getContext(
        "2d",
        {
          alpha:
            false,

          desynchronized:
            true,
        }
      );


    if (!ctx) {
      throw new Error(
        "Blackjack Renderer: Canvas 2D context unavailable."
      );
    }


    this.ctx =
      ctx;


    this.ctx.imageSmoothingEnabled =
      false;


    this.internalCanvas =
      document.createElement(
        "canvas"
      );


    const internalCtx =
      this.internalCanvas.getContext(
        "2d",
        {
          alpha:
            false,

          desynchronized:
            true,
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


  /* ==========================================================================
     RESIZE
     ========================================================================== */

  resize(
    width: number,
    height: number
  ): void {

    this.width =
      Math.max(
        1,
        Math.floor(
          Number.isFinite(
            width
          )
            ? width
            : 1
        )
      );


    this.height =
      Math.max(
        1,
        Math.floor(
          Number.isFinite(
            height
          )
            ? height
            : 1
        )
      );


    const deviceDpr =
      typeof window !==
        "undefined"
        ? window.devicePixelRatio ||
          1
        : 1;


    this.dpr =
      Math.min(
        Math.max(
          1,
          deviceDpr
        ),
        2
      );


    /* ----------------------------------------------------------------------
       PHYSICAL CANVAS
       ---------------------------------------------------------------------- */

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


    /* ----------------------------------------------------------------------
       INTERNAL RESOLUTION
       ---------------------------------------------------------------------- */

    const aspect =
      this.width /
      Math.max(
        this.height,
        1
      );


    if (
      aspect <
      1.2
    ) {

      this.sceneWidth =
        360;

      this.sceneHeight =
        300;

    } else if (
      aspect <
      1.45
    ) {

      this.sceneWidth =
        400;

      this.sceneHeight =
        300;

    } else if (
      aspect <
      1.7
    ) {

      this.sceneWidth =
        448;

      this.sceneHeight =
        280;

    } else {

      this.sceneWidth =
        480;

      this.sceneHeight =
        270;
    }


    this.internalCanvas.width =
      this.sceneWidth;


    this.internalCanvas.height =
      this.sceneHeight;


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
  }


  /* ==========================================================================
     UPDATE
     ========================================================================== */

  update(
    delta: number,
    state?: GameVisualState
  ): void {

    this.delta =
      Number.isFinite(
        delta
      )
        ? Math.min(
            Math.max(
              delta,
              0
            ),
            0.05
          )
        : 0;


    this.time +=
      this.delta;


    if (
      state
    ) {
      this.state =
        state;
    }
  }


  /* ==========================================================================
     MAIN RENDER
     ========================================================================== */

  render(
    state?: GameVisualState
  ): void {

    if (
      state
    ) {
      this.state =
        state;
    }


    const ctx =
      this.internalCtx;


    const w =
      this.sceneWidth;


    const h =
      this.sceneHeight;


    /* ----------------------------------------------------------------------
       RESET INTERNAL FRAME
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


    /* ----------------------------------------------------------------------
       CAMERA
       ---------------------------------------------------------------------- */

    const cameraX =
      this.safeNumber(
        this.state?.cameraX,
        0
      );


    const cameraY =
      this.safeNumber(
        this.state?.cameraY,
        0
      );


    const cameraZoom =
      this.clamp(
        this.safeNumber(
          this.state?.cameraZoom,
          1
        ),
        0.96,
        1.06
      );


    const driftX =
      cameraX *
      0.015;


    const driftY =
      cameraY *
      0.01;


    ctx.translate(
      driftX,
      driftY
    );


    /* ----------------------------------------------------------------------
       WORLD
       ---------------------------------------------------------------------- */

    this.drawRoom(
      ctx,
      w,
      h
    );


    this.drawCasinoLights(
      ctx,
      w,
      h
    );


    this.drawPeripheralPlayers(
      ctx,
      w,
      h
    );


    this.drawDealer(
      ctx,
      w,
      h
    );


    this.drawFirstPersonTable(
      ctx,
      w,
      h,
      cameraZoom
    );


    /* ----------------------------------------------------------------------
       REAL GAME OBJECTS
       ---------------------------------------------------------------------- */

    this.drawDealerCards(
      ctx,
      w,
      h
    );


    this.drawPeripheralCards(
      ctx,
      w,
      h
    );


    this.drawPlayerCards(
      ctx,
      w,
      h,
      cameraZoom
    );


    this.drawPlayerChips(
      ctx,
      w,
      h,
      cameraZoom
    );


    this.drawTableMarkings(
      ctx,
      w,
      h
    );


    this.drawGameStatusAtmosphere(
      ctx,
      w,
      h
    );


    this.drawForegroundPresence(
      ctx,
      w,
      h
    );


    ctx.restore();


    /* ----------------------------------------------------------------------
       FINAL PIXEL TREATMENT
       ---------------------------------------------------------------------- */

    this.drawFinalPixelTreatment(
      ctx,
      w,
      h
    );


    /* ----------------------------------------------------------------------
       UPSCALE
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


  /* ==========================================================================
     ROOM
     ========================================================================== */

  private drawRoom(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ): void {

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
      0.72,
      "#07100C"
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


    /* Architectural seams. */

    ctx.fillStyle =
      "rgba(255,255,255,0.012)";


    ctx.fillRect(
      0,
      Math.round(
        h *
        0.15
      ),
      w,
      1
    );


    ctx.fillStyle =
      "rgba(255,255,255,0.008)";


    ctx.fillRect(
      0,
      Math.round(
        h *
        0.32
      ),
      w,
      1
    );


    /* Left wall. */

    ctx.fillStyle =
      "rgba(0,0,0,0.34)";


    ctx.fillRect(
      0,
      Math.round(
        h *
        0.19
      ),
      Math.round(
        w *
        0.11
      ),
      Math.round(
        h *
        0.46
      )
    );


    /* Right wall. */

    ctx.fillRect(
      Math.round(
        w *
        0.89
      ),
      Math.round(
        h *
        0.18
      ),
      Math.round(
        w *
        0.11
      ),
      Math.round(
        h *
        0.48
      )
    );


    /* Horizon. */

    const horizonY =
      Math.round(
        h *
        0.48
      );


    ctx.fillStyle =
      "rgba(0,0,0,0.16)";


    ctx.fillRect(
      0,
      horizonY,
      w,
      1
    );


    /* Floor. */

    const floorGradient =
      ctx.createLinearGradient(
        0,
        horizonY,
        0,
        h
      );


    floorGradient.addColorStop(
      0,
      "#07100D"
    );


    floorGradient.addColorStop(
      1,
      "#020302"
    );


    ctx.fillStyle =
      floorGradient;


    ctx.fillRect(
      0,
      horizonY,
      w,
      h -
        horizonY
    );
  }


  /* ==========================================================================
     CASINO LIGHTS
     ========================================================================== */

  private drawCasinoLights(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ): void {

    const lightPulse =
      0.5 +
      Math.sin(
        this.time *
        0.45
      ) *
      0.5;


    const lamps = [
      {
        x:
          w *
          0.12,

        y:
          h *
          0.085,

        size:
          2,
      },

      {
        x:
          w *
          0.27,

        y:
          h *
          0.065,

        size:
          3,
      },

      {
        x:
          w *
          0.50,

        y:
          h *
          0.05,

        size:
          3,
      },

      {
        x:
          w *
          0.73,

        y:
          h *
          0.065,

        size:
          3,
      },

      {
        x:
          w *
          0.88,

        y:
          h *
          0.085,

        size:
          2,
      },
    ];


    for (
      let i = 0;
      i <
      lamps.length;
      i += 1
    ) {

      const lamp =
        lamps[i];


      const intensity =
        0.16 +
        Math.sin(
          this.time *
          (
            0.16 +
            i *
            0.025
          ) +
          i
        ) *
        0.025;


      ctx.fillStyle =
        `rgba(225,198,125,${intensity})`;


      ctx.fillRect(
        Math.round(
          lamp.x
        ),
        Math.round(
          lamp.y
        ),
        lamp.size,
        lamp.size
      );


      ctx.fillStyle =
        `rgba(225,198,125,${intensity * 0.12})`;


      ctx.fillRect(
        Math.round(
          lamp.x -
          3
        ),
        Math.round(
          lamp.y -
          2
        ),
        lamp.size +
        6,
        lamp.size +
        4
      );
    }


    this.drawDistantTableHint(
      ctx,
      w *
      0.055,
      h *
      0.39,
      w *
      0.22
    );


    this.drawDistantTableHint(
      ctx,
      w *
      0.945,
      h *
      0.39,
      w *
      0.22
    );


    const bloom =
      ctx.createRadialGradient(
        w *
        0.5,
        h *
        0.40,
        0,
        w *
        0.5,
        h *
        0.40,
        h *
        0.50
      );


    bloom.addColorStop(
      0,
      `rgba(28,80,60,${0.065 + lightPulse * 0.012})`
    );


    bloom.addColorStop(
      0.55,
      "rgba(11,40,31,0.018)"
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


  private drawDistantTableHint(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number
  ): void {

    ctx.save();


    ctx.globalAlpha =
      0.18;


    ctx.strokeStyle =
      "rgba(197,163,92,0.20)";


    ctx.lineWidth =
      1;


    ctx.beginPath();


    ctx.ellipse(
      x,
      y,
      width *
      0.5,
      10,
      0,
      0,
      TAU
    );


    ctx.stroke();


    ctx.restore();
  }


  /* ==========================================================================
     PERIPHERAL PLAYERS
     ========================================================================== */

  private drawPeripheralPlayers(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ): void {

    const players =
      this.state?.casino
        ?.players ??
      [];


    const leftPlayer =
      players.find(
        (
          player
        ) =>
          player.seat ===
          1
      );


    const rightPlayer =
      players.find(
        (
          player
        ) =>
          player.seat ===
          5
      );


    this.drawPeripheralPlayerSide(
      ctx,
      w,
      h,
      "left",
      leftPlayer
    );


    this.drawPeripheralPlayerSide(
      ctx,
      w,
      h,
      "right",
      rightPlayer
    );
  }


  private drawPeripheralPlayerSide(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    side: "left" | "right",
    player?: Player
  ): void {

    const left =
      side ===
      "left";


    const active =
      player?.active ??
      true;


    const jacket =
      player?.visual
        ?.jacket ??
      COLORS.jacket;


    const jacketLight =
      COLORS.jacketLight;


    ctx.save();


    ctx.globalAlpha =
      active
        ? 0.72
        : 0.32;


    /*
     * Shoulder silhouette.
     */
    ctx.fillStyle =
      jacket;


    ctx.beginPath();


    if (
      left
    ) {

      ctx.moveTo(
        0,
        h *
        0.48
      );


      ctx.lineTo(
        w *
        0.075,
        h *
        0.43
      );


      ctx.lineTo(
        w *
        0.145,
        h *
        0.46
      );


      ctx.lineTo(
        w *
        0.17,
        h *
        0.62
      );


      ctx.lineTo(
        0,
        h *
        0.70
      );

    } else {

      ctx.moveTo(
        w,
        h *
        0.47
      );


      ctx.lineTo(
        w *
        0.925,
        h *
        0.43
      );


      ctx.lineTo(
        w *
        0.855,
        h *
        0.46
      );


      ctx.lineTo(
        w *
        0.83,
        h *
        0.62
      );


      ctx.lineTo(
        w,
        h *
        0.70
      );
    }


    ctx.closePath();


    ctx.fill();


    /*
     * Forearm.
     */
    ctx.fillStyle =
      jacketLight;


    ctx.beginPath();


    if (
      left
    ) {

      ctx.moveTo(
        w *
        0.10,
        h *
        0.59
      );


      ctx.lineTo(
        w *
        0.25,
        h *
        0.62
      );


      ctx.lineTo(
        w *
        0.31,
        h *
        0.71
      );


      ctx.lineTo(
        w *
        0.26,
        h *
        0.75
      );


      ctx.lineTo(
        w *
        0.09,
        h *
        0.67
      );

    } else {

      ctx.moveTo(
        w *
        0.90,
        h *
        0.59
      );


      ctx.lineTo(
        w *
        0.75,
        h *
        0.62
      );


      ctx.lineTo(
        w *
        0.69,
        h *
        0.71
      );


      ctx.lineTo(
        w *
        0.74,
        h *
        0.75
      );


      ctx.lineTo(
        w *
        0.91,
        h *
        0.67
      );
    }


    ctx.closePath();


    ctx.fill();


    /*
     * Hand.
     */
    ctx.fillStyle =
      player?.visual
        ?.skin ??
      COLORS.skinDark;


    if (
      left
    ) {

      ctx.fillRect(
        Math.round(
          w *
          0.245
        ),
        Math.round(
          h *
          0.69
        ),
        12,
        5
      );

    } else {

      ctx.fillRect(
        Math.round(
          w *
          0.735
        ),
        Math.round(
          h *
          0.69
        ),
        12,
        5
      );
    }


    ctx.restore();
  }


  /* ==========================================================================
     DEALER
     ========================================================================== */

  private drawDealer(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ): void {

    const dealer =
      this.state?.casino
        ?.dealer;


    const cx =
      w *
      0.50;


    const topY =
      h *
      0.235;


    const breathing =
      this.state?.phase ===
        "loading"
        ? 0
        : Math.sin(
            this.time *
            0.80
          ) *
          0.7;


    const jacket =
      dealer?.visual
        ?.jacket ??
      COLORS.jacket;


    const jacketLight =
      COLORS.jacketLight;


    const shirt =
      dealer?.visual
        ?.shirt ??
      COLORS.cardLight;


    ctx.save();


    /*
     * Dealer shadow.
     */
    ctx.fillStyle =
      "rgba(0,0,0,0.54)";


    ctx.beginPath();


    ctx.ellipse(
      cx,
      h *
      0.47,
      w *
      0.16,
      h *
      0.06,
      0,
      0,
      TAU
    );


    ctx.fill();


    /*
     * Torso.
     */
    ctx.fillStyle =
      jacket;


    ctx.beginPath();


    ctx.moveTo(
      cx -
      w *
      0.15,
      h *
      0.56
    );


    ctx.lineTo(
      cx -
      w *
      0.115,
      h *
      0.33 +
      breathing
    );


    ctx.lineTo(
      cx -
      w *
      0.065,
      topY +
      breathing
    );


    ctx.lineTo(
      cx +
      w *
      0.065,
      topY +
      breathing
    );


    ctx.lineTo(
      cx +
      w *
      0.115,
      h *
      0.33 +
      breathing
    );


    ctx.lineTo(
      cx +
      w *
      0.15,
      h *
      0.56
    );


    ctx.closePath();


    ctx.fill();


    /*
     * Jacket side shadow.
     */
    ctx.fillStyle =
      "rgba(0,0,0,0.22)";


    ctx.beginPath();


    ctx.moveTo(
      cx -
      w *
      0.15,
      h *
      0.56
    );


    ctx.lineTo(
      cx -
      w *
      0.115,
      h *
      0.33 +
      breathing
    );


    ctx.lineTo(
      cx -
      w *
      0.055,
      h *
      0.39 +
      breathing
    );


    ctx.lineTo(
      cx -
      w *
      0.045,
      h *
      0.56
    );


    ctx.closePath();


    ctx.fill();


    ctx.beginPath();


    ctx.moveTo(
      cx +
      w *
      0.15,
      h *
      0.56
    );


    ctx.lineTo(
      cx +
      w *
      0.115,
      h *
      0.33 +
      breathing
    );


    ctx.lineTo(
      cx +
      w *
      0.055,
      h *
      0.39 +
      breathing
    );


    ctx.lineTo(
      cx +
      w *
      0.045,
      h *
      0.56
    );


    ctx.closePath();


    ctx.fill();


    /*
     * Shirt.
     */
    ctx.fillStyle =
      shirt;


    ctx.beginPath();


    ctx.moveTo(
      cx -
      w *
      0.042,
      h *
      0.32 +
      breathing
    );


    ctx.lineTo(
      cx,
      h *
      0.275 +
      breathing
    );


    ctx.lineTo(
      cx +
      w *
      0.042,
      h *
      0.32 +
      breathing
    );


    ctx.lineTo(
      cx +
      w *
      0.028,
      h *
      0.47
    );


    ctx.lineTo(
      cx -
      w *
      0.028,
      h *
      0.47
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
      cx - 4,
      h *
      0.32 +
      breathing
    );


    ctx.lineTo(
      cx + 4,
      h *
      0.32 +
      breathing
    );


    ctx.lineTo(
      cx + 5,
      h *
      0.45 +
      breathing
    );


    ctx.lineTo(
      cx,
      h *
      0.48 +
      breathing
    );


    ctx.lineTo(
      cx - 5,
      h *
      0.45 +
      breathing
    );


    ctx.closePath();


    ctx.fill();


    /*
     * Jacket seam.
     */
    ctx.strokeStyle =
      "rgba(231,209,142,0.16)";


    ctx.lineWidth =
      1;


    ctx.beginPath();


    ctx.moveTo(
      cx,
      h *
      0.31 +
      breathing
    );


    ctx.lineTo(
      cx,
      h *
      0.56
    );


    ctx.stroke();


    /*
     * Arms.
     */
    this.drawDealerArm(
      ctx,
      cx -
      w *
      0.085,
      h *
      0.38 +
      breathing,
      cx -
      w *
      0.235,
      h *
      0.62 +
      breathing,
      -1,
      jacket,
      jacketLight,
      dealer?.visual
        ?.skin ??
      COLORS.skin
    );


    this.drawDealerArm(
      ctx,
      cx +
      w *
      0.085,
      h *
      0.38 +
      breathing,
      cx +
      w *
      0.235,
      h *
      0.62 +
      breathing,
      1,
      jacket,
      jacketLight,
      dealer?.visual
        ?.skin ??
      COLORS.skin
    );


    /*
     * Extremely subtle dealer state marker.
     */
    if (
      dealer?.state ===
      "reaching"
    ) {

      ctx.fillStyle =
        "rgba(231,209,142,0.10)";


      ctx.fillRect(
        Math.round(
          cx -
          18
        ),
        Math.round(
          h *
          0.45
        ),
        36,
        1
      );
    }


    ctx.restore();
  }


  private drawDealerArm(
    ctx: CanvasRenderingContext2D,
    shoulderX: number,
    shoulderY: number,
    handX: number,
    handY: number,
    side: -1 | 1,
    jacket: string,
    jacketLight: string,
    skin: string
  ): void {

    const midX =
      (
        shoulderX +
        handX
      ) *
      0.5 +
      side *
      8;


    const midY =
      (
        shoulderY +
        handY
      ) *
      0.5 -
      2;


    ctx.strokeStyle =
      jacket;


    ctx.lineWidth =
      17;


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


    ctx.strokeStyle =
      jacketLight;


    ctx.lineWidth =
      12;


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
     * Cuff.
     */
    ctx.strokeStyle =
      COLORS.cardLight;


    ctx.lineWidth =
      5;


    ctx.beginPath();


    const cuffX =
      handX -
      side *
      5;


    const cuffY =
      handY -
      5;


    ctx.moveTo(
      cuffX,
      cuffY
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
      skin;


    ctx.beginPath();


    ctx.ellipse(
      handX,
      handY,
      9,
      6,
      side *
      0.18,
      0,
      TAU
    );


    ctx.fill();


    /*
     * Finger block.
     */
    ctx.fillStyle =
      COLORS.skinDark;


    ctx.fillRect(
      Math.round(
        handX -
        side *
        5
      ),
      Math.round(
        handY -
        2
      ),
      5,
      3
    );
  }


  /* ==========================================================================
     TABLE
     ========================================================================== */

  private drawFirstPersonTable(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    zoom: number
  ): void {

    const horizonY =
      h *
      0.51;


    /*
     * Table body.
     */
    ctx.fillStyle =
      COLORS.woodDeep;


    ctx.beginPath();


    ctx.moveTo(
      w *
      0.16,
      horizonY +
      14
    );


    ctx.quadraticCurveTo(
      w *
      0.50,
      horizonY -
      24,
      w *
      0.84,
      horizonY +
      14
    );


    ctx.lineTo(
      w *
      0.98,
      h
    );


    ctx.lineTo(
      w *
      0.02,
      h
    );


    ctx.closePath();


    ctx.fill();


    /*
     * Gold rail.
     */
    ctx.strokeStyle =
      COLORS.goldDark;


    ctx.lineWidth =
      8;


    ctx.beginPath();


    ctx.moveTo(
      w *
      0.14,
      horizonY +
      16
    );


    ctx.quadraticCurveTo(
      w *
      0.50,
      horizonY -
      28,
      w *
      0.86,
      horizonY +
      16
    );


    ctx.stroke();


    /*
     * Gold highlight.
     */
    ctx.strokeStyle =
      COLORS.goldLight;


    ctx.lineWidth =
      1;


    ctx.globalAlpha =
      0.65;


    ctx.beginPath();


    ctx.moveTo(
      w *
      0.15,
      horizonY +
      14
    );


    ctx.quadraticCurveTo(
      w *
      0.50,
      horizonY -
      24,
      w *
      0.85,
      horizonY +
      14
    );


    ctx.stroke();


    ctx.globalAlpha =
      1;


    /*
     * Felt.
     */
    const feltTop =
      horizonY +
      19;


    ctx.fillStyle =
      COLORS.felt;


    ctx.beginPath();


    ctx.moveTo(
      w *
      0.18,
      feltTop
    );


    ctx.quadraticCurveTo(
      w *
      0.50,
      horizonY -
      17,
      w *
      0.82,
      feltTop
    );


    ctx.lineTo(
      w *
      0.95,
      h
    );


    ctx.lineTo(
      w *
      0.05,
      h
    );


    ctx.closePath();


    ctx.fill();


    /*
     * Felt glow.
     */
    const feltGlow =
      ctx.createRadialGradient(
        w *
        0.50,
        h *
        0.55,
        0,
        w *
        0.50,
        h *
        0.68,
        h *
        0.64
      );


    feltGlow.addColorStop(
      0,
      "rgba(34,95,71,0.17)"
    );


    feltGlow.addColorStop(
      0.52,
      "rgba(15,57,44,0.06)"
    );


    feltGlow.addColorStop(
      1,
      "rgba(0,0,0,0.32)"
    );


    ctx.fillStyle =
      feltGlow;


    ctx.beginPath();


    ctx.moveTo(
      w *
      0.18,
      feltTop
    );


    ctx.quadraticCurveTo(
      w *
      0.50,
      horizonY -
      17,
      w *
      0.82,
      feltTop
    );


    ctx.lineTo(
      w *
      0.95,
      h
    );


    ctx.lineTo(
      w *
      0.05,
      h
    );


    ctx.closePath();


    ctx.fill();


    this.drawPerspectiveFeltTexture(
      ctx,
      w,
      h,
      feltTop
    );


    /*
     * Front wood rail.
     */
    ctx.fillStyle =
      COLORS.woodDeep;


    ctx.beginPath();


    ctx.moveTo(
      w *
      0.02,
      h *
      0.92
    );


    ctx.quadraticCurveTo(
      w *
      0.50,
      h *
      0.81,
      w *
      0.98,
      h *
      0.92
    );


    ctx.lineTo(
      w,
      h
    );


    ctx.lineTo(
      0,
      h
    );


    ctx.closePath();


    ctx.fill();


    /*
     * Front rail highlight.
     */
    ctx.strokeStyle =
      "rgba(197,163,92,0.34)";


    ctx.lineWidth =
      2;


    ctx.beginPath();


    ctx.moveTo(
      w *
      0.02,
      h *
      0.92
    );


    ctx.quadraticCurveTo(
      w *
      0.50,
      h *
      0.81,
      w *
      0.98,
      h *
      0.92
    );


    ctx.stroke();


    /*
     * Camera zoom shading.
     */
    if (
      zoom >
      1.001
    ) {

      ctx.globalAlpha =
        Math.min(
          0.10,
          (
            zoom -
            1
          ) *
          1.5
        );


      ctx.fillStyle =
        COLORS.black;


      ctx.fillRect(
        0,
        h *
        0.58,
        w,
        h *
        0.42
      );


      ctx.globalAlpha =
        1;
    }
  }


  private drawPerspectiveFeltTexture(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    top: number
  ): void {

    const count =
      420;


    let seed =
      this.seed;


    for (
      let i = 0;
      i <
      count;
      i += 1
    ) {

      seed =
        (
          seed *
          1664525 +
          1013904223
        ) >>> 0;


      const ux =
        (
          seed &
          0xffff
        ) /
        0xffff;


      seed =
        (
          seed *
          1664525 +
          1013904223
        ) >>> 0;


      const uy =
        (
          seed &
          0xffff
        ) /
        0xffff;


      const y =
        top +
        Math.pow(
          uy,
          0.72
        ) *
        (
          h -
          top
        );


      const perspective =
        (
          y -
          top
        ) /
        Math.max(
          h -
          top,
          1
        );


      const widthAtY =
        w *
        (
          0.64 +
          perspective *
          0.33
        );


      const x =
        w *
        0.50 +
        (
          ux -
          0.5
        ) *
        widthAtY;


      const center =
        w *
        0.50;


      const normalizedX =
        Math.abs(
          x -
          center
        ) /
        Math.max(
          widthAtY *
          0.52,
          1
        );


      if (
        normalizedX >
        1
      ) {
        continue;
      }


      ctx.fillStyle =
        i %
          4 ===
        0
          ? "rgba(83,139,108,0.050)"
          : "rgba(0,0,0,0.045)";


      ctx.fillRect(
        Math.round(
          x
        ),
        Math.round(
          y
        ),
        1,
        1
      );
    }
  }


  /* ==========================================================================
     DEALER CARDS
     ========================================================================== */

  private drawDealerCards(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ): void {

    const dealerHand =
      this.state?.casino
        ?.dealer
        ?.hand;


    if (
      !dealerHand ||
      dealerHand.cards.length ===
      0
    ) {
      return;
    }


    const cards =
      dealerHand.cards;


    const centerX =
      w *
      0.50;


    const y =
      h *
      0.465;


    const width =
      29;


    const height =
      43;


    const spacing =
      17;


    const totalWidth =
      (
        cards.length -
        1
      ) *
      spacing +
      width;


    const startX =
      centerX -
      totalWidth /
      2;


    for (
      let i = 0;
      i <
      cards.length;
      i += 1
    ) {

      const card =
        cards[i];


      if (
        !card
      ) {
        continue;
      }


      this.drawCard(
        ctx,
        this.cardToVisual(
          card,
          startX +
          i *
          spacing,
          y,
          width,
          height,
          this.getDealerCardRotation(
            i,
            cards.length
          ),
          false
        )
      );
    }
  }


  private getDealerCardRotation(
    index: number,
    count: number
  ): number {

    if (
      count <=
      1
    ) {
      return 0;
    }


    const center =
      (
        count -
        1
      ) /
      2;


    return (
      index -
      center
    ) *
    0.025;
  }


  /* ==========================================================================
     PERIPHERAL CARDS
     ========================================================================== */

  private drawPeripheralCards(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ): void {

    const players =
      this.state?.casino
        ?.players ??
      [];


    const leftPlayers =
      players.filter(
        (
          player
        ) =>
          player.seat ===
          1 ||
          player.seat ===
          2
      );


    const rightPlayers =
      players.filter(
        (
          player
        ) =>
          player.seat ===
          4 ||
          player.seat ===
          5
      );


    if (
      leftPlayers.length >
      0
    ) {

      const left =
        leftPlayers.find(
          (
            player
          ) =>
            player.hand.cards.length >
            0
        );


      if (
        left
      ) {

        this.drawSidePlayerHand(
          ctx,
          left,
          w,
          h,
          "left"
        );
      }
    }


    if (
      rightPlayers.length >
      0
    ) {

      const right =
        rightPlayers.find(
          (
            player
          ) =>
            player.hand.cards.length >
            0
        );


      if (
        right
      ) {

        this.drawSidePlayerHand(
          ctx,
          right,
          w,
          h,
          "right"
        );
      }
    }
  }


  private drawSidePlayerHand(
    ctx: CanvasRenderingContext2D,
    player: Player,
    w: number,
    h: number,
    side: "left" | "right"
  ): void {

    const cards =
      player.hand.cards;


    if (
      cards.length ===
      0
    ) {
      return;
    }


    const width =
      24;


    const height =
      36;


    const spacing =
      17;


    const left =
      side ===
      "left";


    const visibleCards =
      cards.slice(
        Math.max(
          0,
          cards.length -
          4
        )
      );


    const baseX =
      left
        ? w *
          0.145
        : w *
          0.855 -
          Math.min(
            visibleCards.length *
            spacing,
            72
          );


    const y =
      h *
      0.645;


    for (
      let i = 0;
      i <
      visibleCards.length;
      i += 1
    ) {

      const card =
        visibleCards[i];


      if (
        !card
      ) {
        continue;
      }


      const x =
        baseX +
        i *
        spacing;


      const centerOffset =
        i -
        (
          visibleCards.length -
          1
        ) /
        2;


      const rotation =
        left
          ? centerOffset *
            0.045
          : -centerOffset *
            0.045;


      this.drawCard(
        ctx,
        this.cardToVisual(
          card,
          x,
          y,
          width,
          height,
          rotation,
          false
        )
      );
    }
  }


  /* ==========================================================================
     PLAYER CARDS
     ========================================================================== */

  private drawPlayerCards(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    zoom: number
  ): void {

    const human =
      this.state?.casino
        ?.players
        ?.find(
          (
            player
          ) =>
            player.type ===
            "human"
        );


    if (
      !human
    ) {
      return;
    }


    const centerX =
      w *
      0.50;


    const baseY =
      h *
      0.70;


    const width =
      Math.round(
        48 *
        zoom
      );


    const height =
      Math.round(
        70 *
        zoom
      );


    const spread =
      Math.round(
        width *
        0.70
      );


    this.drawHandNearCamera(
      ctx,
      human.hand,
      centerX,
      baseY,
      width,
      height,
      spread,
      0
    );


    if (
      human.secondaryHand
    ) {

      const secondary =
        human.secondaryHand;


      this.drawHandNearCamera(
        ctx,
        secondary,
        centerX +
        width *
        0.68,
        baseY +
        3,
        Math.max(
          32,
          Math.round(
            width *
            0.84
          )
        ),
        Math.max(
          48,
          Math.round(
            height *
            0.84
          )
        ),
        Math.max(
          20,
          Math.round(
            spread *
            0.70
          )
        ),
        1
      );
    }
  }


  private drawHandNearCamera(
    ctx: CanvasRenderingContext2D,
    hand: Hand,
    centerX: number,
    baseY: number,
    width: number,
    height: number,
    spread: number,
    handIndex: number
  ): void {

    const cards =
      hand.cards;


    if (
      cards.length ===
      0
    ) {
      return;
    }


    const spacing =
      cards.length <=
      2
        ? spread
        : Math.max(
            Math.round(
              spread *
              0.62
            ),
            Math.round(
              width *
              0.38
            )
          );


    const totalWidth =
      (
        cards.length -
        1
      ) *
      spacing +
      width;


    const startX =
      centerX -
      totalWidth /
      2;


    for (
      let i = 0;
      i <
      cards.length;
      i += 1
    ) {

      const card =
        cards[i];


      if (
        !card
      ) {
        continue;
      }


      const centerOffset =
        i -
        (
          cards.length -
          1
        ) /
        2;


      const rotation =
        centerOffset *
        0.065 +
        hand.rotation *
        0.25;


      const x =
        startX +
        i *
        spacing;


      const y =
        baseY +
        Math.abs(
          centerOffset
        ) *
        1.4;


      this.drawCard(
        ctx,
        this.cardToVisual(
          card,
          x,
          y,
          width,
          height,
          rotation,
          true
        )
      );
    }


    /*
     * Split-hand divider.
     */
    if (
      handIndex ===
      1
    ) {

      ctx.fillStyle =
        "rgba(197,163,92,0.22)";


      ctx.fillRect(
        Math.round(
          centerX -
          width *
          0.58
        ),
        Math.round(
          baseY -
          8
        ),
        1,
        Math.round(
          height *
          0.72
        )
      );
    }
  }


  /* ==========================================================================
     CARD CONVERSION
     ========================================================================== */

  private cardToVisual(
    card: Card,
    x: number,
    y: number,
    width: number,
    height: number,
    rotation: number,
    emphasis: boolean
  ): CardVisual {

    return {
      card,

      rank:
        String(
          card.rank
        ),

      suit:
        card.suit,

      x,

      y,

      width,

      height,

      rotation,

      faceUp:
        card.faceUp,

      shadow:
        true,

      emphasis,

      opacity:
        this.safeNumber(
          card.transform.opacity,
          1
        ),
    };
  }


  /* ==========================================================================
     CARD RENDERING
     ========================================================================== */

  private drawCard(
    ctx: CanvasRenderingContext2D,
    visual: CardVisual
  ): void {

    const {
      x,
      y,
      width,
      height,
      rotation,
      faceUp,
      rank,
      suit,
    } = visual;


    ctx.save();


    ctx.globalAlpha =
      this.clamp(
        visual.opacity ??
        1,
        0,
        1
      );


    ctx.translate(
      x +
      width /
      2,
      y +
      height /
      2
    );


    ctx.rotate(
      rotation
    );


    ctx.translate(
      -width /
      2,
      -height /
      2
    );


    /* Shadow. */

    if (
      visual.shadow !==
      false
    ) {

      ctx.fillStyle =
        "rgba(0,0,0,0.54)";


      ctx.fillRect(
        3,
        5,
        width,
        height
      );


      if (
        visual.emphasis
      ) {

        ctx.fillStyle =
          "rgba(0,0,0,0.20)";


        ctx.fillRect(
          6,
          height +
          4,
          Math.max(
            1,
            width -
            10
          ),
          3
        );
      }
    }


    /* Card body. */

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


    /* Border. */

    ctx.strokeStyle =
      COLORS.cardEdge;


    ctx.lineWidth =
      1;


    this.roundRect(
      ctx,
      0.5,
      0.5,
      width -
      1,
      height -
      1,
      2
    );


    ctx.stroke();


    /* Highlight. */

    ctx.fillStyle =
      "rgba(255,255,255,0.12)";


    ctx.fillRect(
      2,
      2,
      Math.max(
        1,
        width -
        4
      ),
      1
    );


    /* Card back. */

    if (
      !faceUp
    ) {

      this.drawCardBackInside(
        ctx,
        width,
        height
      );


      ctx.restore();


      return;
    }


    /* Suit / rank color. */

    ctx.fillStyle =
      getSuitColor(
        suit
      );


    /* Rank. */

    ctx.font =
      width >=
      42
        ? FONT.medium
        : FONT.small;


    ctx.textAlign =
      "left";


    ctx.textBaseline =
      "top";


    ctx.fillText(
      rank,
      4,
      4
    );


    /* Small suit. */

    ctx.font =
      width >=
      42
        ? "700 10px serif"
        : "700 8px serif";


    ctx.fillText(
      getSuitGlyph(
        suit
      ),
      5,
      width >=
      42
        ? 15
        : 13
    );


    /* Main suit pip. */

    ctx.textAlign =
      "center";


    ctx.textBaseline =
      "middle";


    ctx.font =
      width >=
      42
        ? "700 27px serif"
        : "700 18px serif";


    ctx.fillText(
      getSuitGlyph(
        suit
      ),
      width /
      2,
      height /
      2
    );


    /* Bottom rank. */

    ctx.textAlign =
      "right";


    ctx.textBaseline =
      "bottom";


    ctx.font =
      width >=
      42
        ? FONT.small
        : "700 6px 'Courier New', monospace";


    ctx.fillText(
      rank,
      width -
      4,
      height -
      4
    );


    /* Bottom suit. */

    ctx.font =
      width >=
      42
        ? "700 8px serif"
        : "700 6px serif";


    ctx.fillText(
      getSuitGlyph(
        suit
      ),
      width -
      5,
      height -
      14
    );


    /* Active emphasis. */

    if (
      visual.emphasis
    ) {

      ctx.strokeStyle =
        "rgba(231,209,142,0.28)";


      ctx.lineWidth =
        1;


      this.roundRect(
        ctx,
        1.5,
        1.5,
        width -
        3,
        height -
        3,
        2
      );


      ctx.stroke();
    }


    ctx.restore();
  }


  private drawCardBackInside(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {

    ctx.fillStyle =
      COLORS.feltMid;


    ctx.fillRect(
      2,
      2,
      Math.max(
        1,
        width -
        4
      ),
      Math.max(
        1,
        height -
        4
      )
    );


    ctx.strokeStyle =
      "rgba(206,177,101,0.74)";


    ctx.lineWidth =
      1;


    ctx.strokeRect(
      3,
      3,
      Math.max(
        1,
        width -
        6
      ),
      Math.max(
        1,
        height -
        6
      )
    );


    /*
     * Diamond lattice.
     */
    ctx.fillStyle =
      "rgba(226,199,119,0.63)";


    const stepX =
      Math.max(
        5,
        Math.floor(
          width /
          5
        )
      );


    const stepY =
      Math.max(
        6,
        Math.floor(
          height /
          6
        )
      );


    for (
      let y = 6;
      y <
      height -
      6;
      y += stepY
    ) {

      for (
        let x = 6;
        x <
        width -
        6;
        x += stepX
      ) {

        ctx.fillRect(
          x,
          y,
          2,
          2
        );
      }
    }
  }


  /* ==========================================================================
     PLAYER CHIPS
     ========================================================================== */

  private drawPlayerChips(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    zoom: number
  ): void {

    const human =
      this.state?.casino
        ?.players
        ?.find(
          (
            player
          ) =>
            player.type ===
            "human"
        );


    if (
      !human
    ) {
      return;
    }


    if (
      !this.state?.casino
        ?.chipsVisible
    ) {
      return;
    }


    const stack =
      human.chips;


    if (
      !stack ||
      !stack.visible ||
      stack.chips.length ===
      0
    ) {
      return;
    }


    const cx =
      w *
      0.50;


    const baseY =
      h *
      0.82;


    const radius =
      Math.max(
        10,
        Math.round(
          11 *
          zoom
        )
      );


    const visible =
      stack.chips.slice(
        -12
      );


    for (
      let i = 0;
      i <
      visible.length;
      i += 1
    ) {

      const chip =
        visible[i];


      if (
        !chip
      ) {
        continue;
      }


      const chipX =
        cx +
        57 +
        (
          i %
          2
        ) *
        2;


      const chipY =
        baseY +
        9 -
        (
          visible.length -
          1 -
          i
        ) *
        5;


      this.drawChip(
        ctx,
        {
          value:
            chip.value,

          x:
            chipX,

          y:
            chipY,

          radius,

          rotation:
            this.safeNumber(
              chip.transform.rotation,
              0
            ),

          color:
            getChipHex(
              chip.color
            ),

          stackIndex:
            chip.stackIndex,
        }
      );
    }


    /*
     * Real bet display.
     */
    ctx.fillStyle =
      "rgba(225,199,119,0.58)";


    ctx.font =
      FONT.tiny;


    ctx.textAlign =
      "center";


    ctx.textBaseline =
      "middle";


    ctx.fillText(
      `BET $${Math.max(
        0,
        Math.floor(
          this.safeNumber(
            human.bet,
            0
          )
        )
      )}`,
      cx,
      baseY +
      27
    );
  }


  private drawChip(
    ctx: CanvasRenderingContext2D,
    chip: ChipVisual
  ): void {

    const r =
      chip.radius;


    ctx.save();


    ctx.translate(
      chip.x,
      chip.y
    );


    ctx.rotate(
      chip.rotation
    );


    /* Shadow. */

    ctx.fillStyle =
      "rgba(0,0,0,0.58)";


    ctx.beginPath();


    ctx.ellipse(
      2,
      3,
      r,
      r *
      0.76,
      0,
      0,
      TAU
    );


    ctx.fill();


    /* Main chip. */

    ctx.fillStyle =
      chip.color;


    ctx.beginPath();


    ctx.arc(
      0,
      0,
      r,
      0,
      TAU
    );


    ctx.fill();


    /* Outer ring. */

    ctx.strokeStyle =
      "rgba(238,216,152,0.70)";


    ctx.lineWidth =
      1;


    ctx.stroke();


    /* Inner field. */

    ctx.fillStyle =
      "rgba(15,20,17,0.24)";


    ctx.beginPath();


    ctx.arc(
      0,
      0,
      r *
      0.64,
      0,
      TAU
    );


    ctx.fill();


    /* Notches. */

    ctx.fillStyle =
      COLORS.cardLight;


    for (
      let i = 0;
      i <
      8;
      i += 1
    ) {

      const angle =
        (
          i /
          8
        ) *
        TAU;


      const x =
        Math.cos(
          angle
        ) *
        r *
        0.79;


      const y =
        Math.sin(
          angle
        ) *
        r *
        0.79;


      ctx.fillRect(
        Math.round(
          x -
          1
        ),
        Math.round(
          y -
          1
        ),
        2,
        2
      );
    }


    /* Value. */

    ctx.fillStyle =
      COLORS.cardLight;


    ctx.font =
      "700 5px 'Courier New', monospace";


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


  /* ==========================================================================
     TABLE MARKINGS
     ========================================================================== */

  private drawTableMarkings(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ): void {

    const table =
      this.state?.casino
        ?.table;


    if (
      !table
    ) {
      return;
    }


    const cx =
      w *
      0.50;


    /*
     * Dealer rule.
     */
    ctx.fillStyle =
      "rgba(197,163,92,0.44)";


    ctx.font =
      FONT.tiny;


    ctx.textAlign =
      "center";


    ctx.textBaseline =
      "middle";


    const dealerRule =
      table.dealerHitsSoft17
        ? "DEALER HITS SOFT 17"
        : "DEALER STANDS ON 17";


    ctx.fillText(
      dealerRule,
      cx,
      h *
      0.585
    );


    /*
     * Blackjack payout.
     */
    ctx.fillStyle =
      "rgba(231,225,211,0.26)";


    ctx.fillText(
      `BLACKJACK PAYS ${
        table.blackjackPayout ===
        1.5
          ? "3 : 2"
          : `${table.blackjackPayout} : 1`
      }`,
      cx,
      h *
      0.61
    );


    /*
     * Minimum / maximum.
     */
    ctx.fillStyle =
      "rgba(197,163,92,0.20)";


    ctx.font =
      "700 5px 'Courier New', monospace";


    ctx.fillText(
      `MIN $${table.minimumBet}  MAX $${table.maximumBet}`,
      cx,
      h *
      0.645
    );
  }


  /* ==========================================================================
     GAME STATUS ATMOSPHERE
     ========================================================================== */

  private drawGameStatusAtmosphere(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ): void {

    const blackjack =
      this.state?.blackjack;


    if (
      !blackjack
    ) {
      return;
    }


    const cx =
      w *
      0.50;


    let text:
      | string
      | null =
      null;


    switch (
      blackjack.phase
    ) {

      case "betting":
        text =
          "PLACE YOUR BET";
        break;


      case "insurance":
        text =
          "INSURANCE";
        break;


      case "player-turn":

        if (
          blackjack.activeSeat ===
          this.getHumanSeat()
        ) {
          text =
            "YOUR TURN";
        }

        break;


      case "dealer-turn":
        text =
          "DEALER";
        break;


      case "settlement":
        text =
          "SETTLING";
        break;


      case "complete":
        text =
          this.getHumanResultText();
        break;


      default:
        break;
    }


    if (
      !text
    ) {
      return;
    }


    const y =
      h *
      0.535;


    ctx.fillStyle =
      this.getStatusAlpha(
        blackjack.phase
      );


    ctx.font =
      FONT.tiny;


    ctx.textAlign =
      "center";


    ctx.textBaseline =
      "middle";


    ctx.fillText(
      text,
      cx,
      y
    );
  }


  private getStatusAlpha(
    phase: string
  ): string {

    switch (
      phase
    ) {

      case "player-turn":
        return "rgba(231,209,142,0.72)";

      case "dealer-turn":
        return "rgba(216,225,211,0.48)";

      case "complete":
        return "rgba(231,209,142,0.65)";

      default:
        return "rgba(197,163,92,0.45)";
    }
  }


  private getHumanSeat(): number {

    return (
      this.state?.casino
        ?.players
        ?.find(
          (
            player
          ) =>
            player.type ===
            "human"
        )
        ?.seat ??
      3
    );
  }


  private getHumanResultText(): string {

    const settlements =
      this.state?.blackjack
        ?.settlements ??
      [];


    const human =
      this.state?.casino
        ?.players
        ?.find(
          (
            player
          ) =>
            player.type ===
            "human"
        );


    if (
      !human
    ) {
      return "ROUND OVER";
    }


    const result =
      settlements.find(
        (
          settlement
        ) => {

          if (
            settlement.playerId !==
            human.id
          ) {
            return false;
          }


          return (
            typeof settlement.handId ===
            "string" &&
            !settlement.handId.startsWith(
              "insurance-"
            )
          );
        }
      );


    if (
      !result
    ) {
      return "ROUND OVER";
    }


    switch (
      result.result
    ) {

      case "blackjack":
        return "BLACKJACK";

      case "win":
        return "YOU WIN";

      case "loss":
      case "bust":
        return "YOU LOSE";

      case "push":
        return "PUSH";

      case "surrender":
        return "SURRENDER";

      default:
        return "ROUND OVER";
    }
  }


  /* ==========================================================================
     FOREGROUND PRESENCE
     ========================================================================== */

  private drawForegroundPresence(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ): void {

    ctx.fillStyle =
      "rgba(2,4,3,0.58)";


    ctx.beginPath();


    ctx.moveTo(
      0,
      h
    );


    ctx.lineTo(
      0,
      h *
      0.93
    );


    ctx.quadraticCurveTo(
      w *
      0.18,
      h *
      0.87,
      w *
      0.32,
      h *
      0.91
    );


    ctx.quadraticCurveTo(
      w *
      0.50,
      h *
      0.96,
      w *
      0.68,
      h *
      0.91
    );


    ctx.quadraticCurveTo(
      w *
      0.82,
      h *
      0.87,
      w,
      h *
      0.93
    );


    ctx.lineTo(
      w,
      h
    );


    ctx.closePath();


    ctx.fill();


    /*
     * Abstract foreground cuffs / hands.
     */
    ctx.fillStyle =
      "rgba(65,54,44,0.24)";


    ctx.fillRect(
      Math.round(
        w *
        0.27
      ),
      Math.round(
        h *
        0.91
      ),
      18,
      4
    );


    ctx.fillRect(
      Math.round(
        w *
        0.69
      ),
      Math.round(
        h *
        0.91
      ),
      18,
      4
    );
  }


  /* ==========================================================================
     FINAL PIXEL TREATMENT
     ========================================================================== */

  private drawFinalPixelTreatment(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ): void {

    /*
     * Top darkness.
     */
    const top =
      ctx.createLinearGradient(
        0,
        0,
        0,
        h *
        0.36
      );


    top.addColorStop(
      0,
      "rgba(0,0,0,0.34)"
    );


    top.addColorStop(
      0.72,
      "rgba(0,0,0,0.035)"
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
      h *
      0.40
    );


    /*
     * Vignette.
     */
    const vignette =
      ctx.createRadialGradient(
        w *
        0.50,
        h *
        0.52,
        h *
        0.15,
        w *
        0.50,
        h *
        0.52,
        w *
        0.76
      );


    vignette.addColorStop(
      0,
      "rgba(0,0,0,0)"
    );


    vignette.addColorStop(
      0.72,
      "rgba(0,0,0,0.055)"
    );


    vignette.addColorStop(
      1,
      "rgba(0,0,0,0.42)"
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
     * Subtle scan structure.
     */
    ctx.fillStyle =
      "rgba(255,255,255,0.012)";


    for (
      let y = 0;
      y <
      h;
      y += 4
    ) {

      ctx.fillRect(
        0,
        y,
        w,
        1
      );
    }


    /*
     * Pixel frame.
     */
    ctx.strokeStyle =
      "rgba(0,0,0,0.44)";


    ctx.lineWidth =
      2;


    ctx.strokeRect(
      1,
      1,
      w -
      2,
      h -
      2
    );
  }


  /* ==========================================================================
     ROUND RECT
     ========================================================================== */

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {

    const r =
      Math.max(
        0,
        Math.min(
          radius,
          width /
          2,
          height /
          2
        )
      );


    ctx.beginPath();


    ctx.moveTo(
      x +
      r,
      y
    );


    ctx.lineTo(
      x +
      width -
      r,
      y
    );


    ctx.quadraticCurveTo(
      x +
      width,
      y,
      x +
      width,
      y +
      r
    );


    ctx.lineTo(
      x +
      width,
      y +
      height -
      r
    );


    ctx.quadraticCurveTo(
      x +
      width,
      y +
      height,
      x +
      width -
      r,
      y +
      height
    );


    ctx.lineTo(
      x +
      r,
      y +
      height
    );


    ctx.quadraticCurveTo(
      x,
      y +
      height,
      x,
      y +
      height -
      r
    );


    ctx.lineTo(
      x,
      y +
      r
    );


    ctx.quadraticCurveTo(
      x,
      y,
      x +
      r,
      y
    );


    ctx.closePath();
  }


  /* ==========================================================================
     NUMBER SAFETY
     ========================================================================== */

  private safeNumber(
    value:
      | number
      | undefined,
    fallback: number
  ): number {

    return Number.isFinite(
      value
    )
      ? value as number
      : fallback;
  }


  private clamp(
    value: number,
    min: number,
    max: number
  ): number {

    return Math.max(
      min,
      Math.min(
        max,
        value
      )
    );
  }


  /* ==========================================================================
     CLEANUP
     ========================================================================== */

  destroy(): void {

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
      this.sceneWidth,
      this.sceneHeight
    );


    this.internalCtx.restore();


    this.state =
      null;


    this.time =
      0;


    this.delta =
      0;
  }
}