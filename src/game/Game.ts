/* ==========================================================================
   BLACKJACK 21 — GAME DIRECTOR
   --------------------------------------------------------------------------
   Responsibilities:
   - Canvas lifecycle
   - Render loop
   - Timing
   - Responsive sizing
   - Camera / visual state
   - Ambient motion
   - Input coordination
   - Blackjack engine coordination
   - Animation coordination
   - Renderer coordination
   - Public gameplay API

   Architecture:

      Browser
         │
         ├── Keyboard / Pointer / HUD
         │
         ▼
       Input.ts
         │
         ▼
       Game.ts
         │
         ├──────────────► Blackjack.ts
         │
         ├──────────────► Animation.ts
         │
         └──────────────► Renderer.ts

   IMPORTANT
   --------------------------------------------------------------------------
   Blackjack.ts is the authority for gameplay state and rules.

   Game.ts is the integration / lifecycle layer.

   Renderer.ts is presentation only.

   CRITICAL STATE RULE
   --------------------------------------------------------------------------
   syncBlackjackState() MUST NEVER mutate Blackjack.ts state.

   The engine transition from "waiting" to "betting" happens only after
   the Game object has completed its complete startup initialization.
   ========================================================================== */

import { Renderer } from "./Renderer";
import { Animation } from "./Animation";
import { Input } from "./Input";

import {
  Blackjack,
  type ActionResult,
  type GameAction,
  type RoundPhase,
  type BlackjackEvent,
} from "./Blackjack";

import type {
  TableVisualState,
} from "./Entities";


/* ==========================================================================
   VISUAL GAME PHASE
   ========================================================================== */

export type GamePhase =
  | "loading"
  | "idle"
  | "betting"
  | "player-turn"
  | "dealer-turn"
  | "settling";


/* ==========================================================================
   RENDER STATE
   ========================================================================== */

export type GameVisualState = {
  phase: GamePhase;

  introComplete: boolean;

  cameraX: number;
  cameraY: number;
  cameraZoom: number;

  pointerX: number;
  pointerY: number;
  pointerInside: boolean;

  time: number;
  delta: number;
  frame: number;

  isFocused: boolean;

  interactionLocked: boolean;

  casino: TableVisualState;

  blackjack: {
    phase: RoundPhase;
    roundNumber: number;
    activeSeat: number;
    activeHandIndex: number;
    dealerHoleCardRevealed: boolean;
    dealerTurnCompleted: boolean;
    roundLocked: boolean;
    settlements: Blackjack["settlements"];
  };
};


/* ==========================================================================
   OPTIONS
   ========================================================================== */

export type GameOptions = {
  logicalWidth?: number;
  logicalHeight?: number;

  maxDpr?: number;
  pixelRatio?: number;

  reducedMotion?: boolean;

  blackjack?: ConstructorParameters<
    typeof Blackjack
  >[0];
};


/* ==========================================================================
   PUBLIC GAME EVENT
   ========================================================================== */

export type GameActionEventDetail = {
  action: GameAction;
  result: ActionResult;
  playerId: string;
};


/* ==========================================================================
   STARTUP ERROR
   ========================================================================== */

export class GameInitializationError
  extends Error {

  readonly stage: string;

  readonly cause: unknown;

  constructor(
    stage: string,
    cause: unknown
  ) {
    const message =
      cause instanceof Error
        ? cause.message
        : String(cause);

    super(
      `[BLACKJACK INIT] ${stage}: ${message}`
    );

    this.name =
      "GameInitializationError";

    this.stage =
      stage;

    this.cause =
      cause;
  }
}


/* ==========================================================================
   GAME CLASS
   ========================================================================== */

export class Game {

  /* ========================================================================
     CORE
     ======================================================================== */

  readonly canvas: HTMLCanvasElement;

  readonly renderer: Renderer;

  readonly animation: Animation;

  readonly input: Input;

  readonly blackjack: Blackjack;

  readonly options: Required<
    Omit<
      GameOptions,
      "blackjack"
    >
  > & {
    blackjack?: GameOptions["blackjack"];
  };

  state: GameVisualState;


  /* ========================================================================
     FRAME LOOP
     ======================================================================== */

  private animationFrame = 0;

  private lastTime = 0;

  private running = false;

  private destroyed = false;


  /* ========================================================================
     RESIZE
     ======================================================================== */

  private resizeObserver:
    ResizeObserver | null =
    null;


  /* ========================================================================
     ATMOSPHERE
     ======================================================================== */

  private ambientPhase = 0;

  private breathingPhase = 0;


  /* ========================================================================
     CAMERA
     ======================================================================== */

  private cameraTargetX = 0;

  private cameraTargetY = 0;

  private cameraTargetZoom = 1;

  private cameraVelocityX = 0;

  private cameraVelocityY = 0;


  /* ========================================================================
     INTRO
     ======================================================================== */

  private introProgress = 0;


  /* ========================================================================
     ENGINE SUBSCRIPTION CLEANUP
     ======================================================================== */

  private blackjackUnsubscribers:
    Array<() => void> =
    [];


  /* ========================================================================
     DOM EVENT HANDLERS
     ======================================================================== */

  private boundResize =
    () => {
      this.resize();
    };


  private boundPointerEnter =
    () => {
      if (
        this.destroyed
      ) {
        return;
      }

      this.state.pointerInside =
        true;
    };


  private boundPointerLeave =
    () => {
      if (
        this.destroyed
      ) {
        return;
      }

      this.state.pointerInside =
        false;
    };


  private boundFocus =
    () => {
      if (
        this.destroyed
      ) {
        return;
      }

      this.state.isFocused =
        true;
    };


  private boundBlur =
    () => {
      if (
        this.destroyed
      ) {
        return;
      }

      this.state.isFocused =
        false;
    };


  private boundKeyDown =
    (
      event: KeyboardEvent
    ) => {
      this.handleKeyDown(
        event
      );
    };


  /* ========================================================================
     CONSTRUCTOR
     ======================================================================== */

  constructor(
    canvas: HTMLCanvasElement,
    options: GameOptions = {}
  ) {

    if (
      !canvas
    ) {
      throw new GameInitializationError(
        "canvas",
        new Error(
          "Canvas element was not provided."
        )
      );
    }


    this.canvas =
      canvas;


    /* ----------------------------------------------------------------------
       REDUCED MOTION
       ---------------------------------------------------------------------- */

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function"
        ? window.matchMedia(
            "(prefers-reduced-motion: reduce)"
          ).matches
        : false;


    /* ----------------------------------------------------------------------
       OPTIONS
       ---------------------------------------------------------------------- */

    this.options = {
      logicalWidth:
        Number.isFinite(
          options.logicalWidth
        )
          ? Math.max(
              1,
              options.logicalWidth ??
              960
            )
          : 960,

      logicalHeight:
        Number.isFinite(
          options.logicalHeight
        )
          ? Math.max(
              1,
              options.logicalHeight ??
              540
            )
          : 540,

      maxDpr:
        Number.isFinite(
          options.maxDpr
        )
          ? Math.max(
              1,
              options.maxDpr ??
              2
            )
          : 2,

      pixelRatio:
        Number.isFinite(
          options.pixelRatio
        )
          ? Math.max(
              0.5,
              options.pixelRatio ??
              1
            )
          : 1,

      reducedMotion:
        options.reducedMotion ??
        prefersReducedMotion,

      blackjack:
        options.blackjack,
    };


    /* ----------------------------------------------------------------------
       CANVAS
       ---------------------------------------------------------------------- */

    this.runInitializationStage(
      "canvas preparation",
      () => {
        this.prepareCanvas();
      }
    );


    /* ----------------------------------------------------------------------
       BLACKJACK ENGINE
       ---------------------------------------------------------------------- */

    this.blackjack =
      this.runInitializationStage(
        "blackjack engine",
        () =>
          new Blackjack(
            this.options.blackjack
          )
      );


    /* ----------------------------------------------------------------------
       INITIAL ENGINE SNAPSHOT
       ---------------------------------------------------------------------- */

    const casino =
      this.runInitializationStage(
        "blackjack visual state",
        () =>
          this.blackjack.getVisualState()
      );

    const engineState =
      this.runInitializationStage(
        "blackjack state",
        () =>
          this.blackjack.getState()
      );


    /* ----------------------------------------------------------------------
       INITIAL VISUAL STATE
       ---------------------------------------------------------------------- */

    this.state = {
      phase:
        "loading",

      introComplete:
        false,

      cameraX:
        0,

      cameraY:
        0,

      cameraZoom:
        1,

      pointerX:
        0,

      pointerY:
        0,

      pointerInside:
        false,

      time:
        0,

      delta:
        0,

      frame:
        0,

      isFocused:
        typeof document !== "undefined"
          ? document.hasFocus()
          : true,

      interactionLocked:
        true,

      casino,

      blackjack: {
        phase:
          engineState.phase,

        roundNumber:
          engineState.roundNumber,

        activeSeat:
          engineState.activeSeat,

        activeHandIndex:
          engineState.activeHandIndex,

        dealerHoleCardRevealed:
          engineState.dealerHoleCardRevealed,

        dealerTurnCompleted:
          engineState.dealerTurnCompleted,

        roundLocked:
          engineState.roundLocked,

        settlements:
          [
            ...engineState.settlements,
          ],
      },
    };


    /* ----------------------------------------------------------------------
       VISUAL SERVICES
       ---------------------------------------------------------------------- */

    this.renderer =
      this.runInitializationStage(
        "renderer",
        () =>
          new Renderer(
            this.canvas
          )
      );

    this.animation =
      this.runInitializationStage(
        "animation",
        () =>
          new Animation()
      );

    this.input =
      this.runInitializationStage(
        "input",
        () =>
          new Input(
            this.canvas
          )
      );


    /* ----------------------------------------------------------------------
       ENGINE EVENTS
       ---------------------------------------------------------------------- */

    this.runInitializationStage(
      "blackjack event bindings",
      () => {
        this.bindBlackjackEvents();
      }
    );


    /* ----------------------------------------------------------------------
       DOM EVENTS
       ---------------------------------------------------------------------- */

    this.runInitializationStage(
      "DOM event bindings",
      () => {
        this.bindEvents();
      }
    );


    /* ----------------------------------------------------------------------
       INITIAL SIZE
       ---------------------------------------------------------------------- */

    this.runInitializationStage(
      "initial resize",
      () => {
        this.resize();
      }
    );


    /* ----------------------------------------------------------------------
       INITIAL SYNC
       ---------------------------------------------------------------------- */

    this.runInitializationStage(
      "initial state synchronization",
      () => {
        this.syncBlackjackState();
      }
    );


    /* ----------------------------------------------------------------------
       START LOOP
       ---------------------------------------------------------------------- */

    this.running =
      true;

    this.animationFrame =
      requestAnimationFrame(
        this.loop
      );


    /* ----------------------------------------------------------------------
       INTRO
       ---------------------------------------------------------------------- */

    /*
     * IMPORTANT:
     * The engine remains "waiting" until the entire Game object exists.
     *
     * completeIntro() performs the explicit transition to "betting".
     */
    this.startIntro();
  }


  /* ==========================================================================
     INITIALIZATION HELPER
     ========================================================================== */

  private runInitializationStage<T>(
    stage: string,
    callback: () => T
  ): T {

    try {
      return callback();
    } catch (error) {

      console.error(
        `[BLACKJACK INIT FAILED] ${stage}`,
        error
      );

      if (
        error instanceof GameInitializationError
      ) {
        throw error;
      }

      throw new GameInitializationError(
        stage,
        error
      );
    }
  }


  /* ==========================================================================
     CANVAS SETUP
     ========================================================================== */

  private prepareCanvas(): void {

    if (
      !(this.canvas instanceof HTMLCanvasElement)
    ) {
      throw new Error(
        "Provided element is not an HTMLCanvasElement."
      );
    }


    this.canvas.style.display =
      "block";

    this.canvas.style.width =
      "100%";

    this.canvas.style.height =
      "100%";

    this.canvas.style.imageRendering =
      "pixelated";

    this.canvas.style.touchAction =
      "none";

    this.canvas.setAttribute(
      "role",
      "img"
    );

    this.canvas.setAttribute(
      "aria-label",
      "Blackjack 21 first-person casino table"
    );
  }


  /* ==========================================================================
     BLACKJACK EVENTS
     ========================================================================== */

  private bindBlackjackEvents(): void {

    const subscribe =
      (
        name:
          Parameters<
            Blackjack["on"]
          >[0]
      ): void => {

        const unsubscribe =
          this.blackjack.on(
            name,
            (
              event
            ) => {
              this.handleBlackjackEvent(
                event
              );
            }
          );

        this.blackjackUnsubscribers.push(
          unsubscribe
        );
      };


    subscribe("round:start");
    subscribe("round:phase");
    subscribe("bet:change");
    subscribe("cards:deal");
    subscribe("card:draw");
    subscribe("card:flip");
    subscribe("player:turn");
    subscribe("player:action");
    subscribe("dealer:turn");
    subscribe("dealer:action");
    subscribe("round:settle");
    subscribe("round:complete");
    subscribe("error");
  }


  private handleBlackjackEvent(
    event: BlackjackEvent
  ): void {

    if (
      this.destroyed
    ) {
      return;
    }


    try {

      this.syncBlackjackState();


      switch (
        event.name
      ) {

        case "card:draw":
          this.onCardDrawEvent(
            event
          );
          break;

        case "card:flip":
          this.onCardFlipEvent(
            event
          );
          break;

        case "player:action":
          this.onPlayerActionEvent(
            event
          );
          break;

        case "dealer:action":
          this.onDealerActionEvent(
            event
          );
          break;

        case "round:settle":
          this.onSettlementEvent(
            event
          );
          break;

        case "round:complete":
          this.onRoundCompleteEvent(
            event
          );
          break;

        default:
          break;
      }


      if (
        typeof window !==
        "undefined"
      ) {

        window.dispatchEvent(
          new CustomEvent(
            `blackjack:engine:${event.name}`,
            {
              detail:
                event.detail,
            }
          )
        );
      }

    } catch (error) {

      console.error(
        "[BLACKJACK EVENT ERROR]",
        event.name,
        error
      );
    }
  }


  /* ==========================================================================
     ENGINE → VISUAL STATE
     ========================================================================== */

  private syncBlackjackState(): void {

    if (
      this.destroyed
    ) {
      return;
    }


    const casino =
      this.blackjack.getVisualState();

    const engineState =
      this.blackjack.getState();


    this.state.casino =
      casino;


    this.state.blackjack = {
      phase:
        engineState.phase,

      roundNumber:
        engineState.roundNumber,

      activeSeat:
        engineState.activeSeat,

      activeHandIndex:
        engineState.activeHandIndex,

      dealerHoleCardRevealed:
        engineState.dealerHoleCardRevealed,

      dealerTurnCompleted:
        engineState.dealerTurnCompleted,

      roundLocked:
        engineState.roundLocked,

      settlements:
        [
          ...engineState.settlements,
        ],
    };


    this.state.phase =
      this.mapRoundPhase(
        engineState.phase
      );


    this.state.interactionLocked =
      this.isInteractionLocked(
        engineState.phase
      );


    if (
      !this.state.introComplete
    ) {

      this.state.phase =
        "loading";

      this.state.interactionLocked =
        true;
    }
  }


  /* ==========================================================================
     PHASE MAPPING
     ========================================================================== */

  private mapRoundPhase(
    phase: RoundPhase
  ): GamePhase {

    switch (
      phase
    ) {

      case "waiting":
      case "betting":
      case "complete":
        return "betting";

      case "initial-deal":
      case "insurance":
      case "player-turn":
        return "player-turn";

      case "dealer-turn":
        return "dealer-turn";

      case "settlement":
        return "settling";

      default:
        return "betting";
    }
  }


  /* ==========================================================================
     INTERACTION LOCK
     ========================================================================== */

  private isInteractionLocked(
    phase: RoundPhase
  ): boolean {

    switch (
      phase
    ) {

      case "initial-deal":
      case "dealer-turn":
      case "settlement":
        return true;

      case "waiting":
      case "betting":
      case "insurance":
      case "player-turn":
      case "complete":
      default:
        return false;
    }
  }


  /* ==========================================================================
     CARD / VISUAL EVENT HOOKS
     ========================================================================== */

  private onCardDrawEvent(
    event: BlackjackEvent
  ): void {

    const card =
      event.detail.card;


    if (
      !card ||
      typeof card !==
      "object"
    ) {
      return;
    }


    this.dispatchVisualEvent(
      "blackjack:visual:card-draw",
      {
        card,
      }
    );
  }


  private onCardFlipEvent(
    event: BlackjackEvent
  ): void {

    this.dispatchVisualEvent(
      "blackjack:visual:card-flip",
      {
        card:
          event.detail.card,
      }
    );
  }


  private onPlayerActionEvent(
    event: BlackjackEvent
  ): void {

    this.dispatchVisualEvent(
      "blackjack:visual:player-action",
      event.detail
    );
  }


  private onDealerActionEvent(
    event: BlackjackEvent
  ): void {

    this.dispatchVisualEvent(
      "blackjack:visual:dealer-action",
      event.detail
    );
  }


  private onSettlementEvent(
    event: BlackjackEvent
  ): void {

    this.dispatchVisualEvent(
      "blackjack:visual:settlement",
      event.detail
    );
  }


  private onRoundCompleteEvent(
    event: BlackjackEvent
  ): void {

    /*
     * Finish event is emitted while Blackjack phase is "complete".
     *
     * Move back to betting explicitly.
     */
    if (
      this.blackjack.phase ===
      "complete"
    ) {

      this.blackjack.setRoundState(
        "betting"
      );
    }


    this.syncBlackjackState();


    this.dispatchVisualEvent(
      "blackjack:visual:round-complete",
      event.detail
    );
  }


  private dispatchVisualEvent(
    name: string,
    detail: Record<string, unknown>
  ): void {

    if (
      typeof window ===
      "undefined"
    ) {
      return;
    }


    window.dispatchEvent(
      new CustomEvent(
        name,
        {
          detail,
        }
      )
    );
  }


  /* ==========================================================================
     DOM EVENTS
     ========================================================================== */

  private bindEvents(): void {

    if (
      typeof window !==
      "undefined"
    ) {

      window.addEventListener(
        "resize",
        this.boundResize,
        {
          passive: true,
        }
      );


      window.addEventListener(
        "keydown",
        this.boundKeyDown
      );


      window.addEventListener(
        "focus",
        this.boundFocus
      );


      window.addEventListener(
        "blur",
        this.boundBlur
      );
    }


    this.canvas.addEventListener(
      "pointerenter",
      this.boundPointerEnter,
      {
        passive: true,
      }
    );


    this.canvas.addEventListener(
      "pointerleave",
      this.boundPointerLeave,
      {
        passive: true,
      }
    );


    if (
      typeof ResizeObserver !==
      "undefined"
    ) {

      this.resizeObserver =
        new ResizeObserver(
          () => {
            this.resize();
          }
        );


      this.resizeObserver.observe(
        this.canvas
      );
    }
  }


  /* ==========================================================================
     DOM EVENT CLEANUP
     ========================================================================== */

  private unbindEvents(): void {

    if (
      typeof window !==
      "undefined"
    ) {

      window.removeEventListener(
        "resize",
        this.boundResize
      );


      window.removeEventListener(
        "keydown",
        this.boundKeyDown
      );


      window.removeEventListener(
        "focus",
        this.boundFocus
      );


      window.removeEventListener(
        "blur",
        this.boundBlur
      );
    }


    this.canvas.removeEventListener(
      "pointerenter",
      this.boundPointerEnter
    );


    this.canvas.removeEventListener(
      "pointerleave",
      this.boundPointerLeave
    );


    this.resizeObserver?.disconnect();

    this.resizeObserver =
      null;
  }


  /* ==========================================================================
     RESIZE
     ========================================================================== */

  resize(): void {

    if (
      this.destroyed
    ) {
      return;
    }


    const rect =
      this.canvas.getBoundingClientRect();


    const width =
      Math.max(
        1,
        Math.floor(
          rect.width
        )
      );


    const height =
      Math.max(
        1,
        Math.floor(
          rect.height
        )
      );


    this.renderer.resize(
      width,
      height
    );


    this.updateCameraViewport(
      width,
      height
    );
  }


  /* ==========================================================================
     CAMERA VIEWPORT
     ========================================================================== */

  private updateCameraViewport(
    width: number,
    height: number
  ): void {

    const aspect =
      width /
      Math.max(
        height,
        1
      );


    if (
      aspect >= 1.65
    ) {

      this.cameraTargetZoom =
        1;

    } else if (
      aspect >= 1.35
    ) {

      this.cameraTargetZoom =
        1.02;

    } else {

      this.cameraTargetZoom =
        1.045;
    }


    this.cameraTargetX =
      0;


    this.cameraTargetY =
      height < 650
        ? -3
        : -1.5;
  }


  /* ==========================================================================
     INTRO
     ========================================================================== */

  private startIntro(): void {

    if (
      this.options.reducedMotion
    ) {

      this.introProgress =
        1;

      this.completeIntro();

      return;
    }


    this.introProgress =
      0;

    this.state.introComplete =
      false;


    const duration =
      850;


    const startedAt =
      typeof performance !==
      "undefined"
        ? performance.now()
        : Date.now();


    const introTick =
      (
        now: number
      ): void => {

        if (
          this.destroyed
        ) {
          return;
        }


        this.introProgress =
          Math.min(
            (
              now -
              startedAt
            ) /
            duration,
            1
          );


        if (
          this.introProgress <
          1
        ) {

          requestAnimationFrame(
            introTick
          );

          return;
        }


        this.completeIntro();
      };


    requestAnimationFrame(
      introTick
    );
  }


  private completeIntro(): void {

    if (
      this.destroyed
    ) {
      return;
    }


    this.introProgress =
      1;


    this.state.introComplete =
      true;


    /*
     * FIRST moment where Game is fully initialized.
     *
     * Only now may the engine transition from waiting to betting.
     */
    if (
      this.blackjack.phase ===
      "waiting"
    ) {

      this.blackjack.setRoundState(
        "betting"
      );
    }


    if (
      this.blackjack.phase ===
      "complete"
    ) {

      this.blackjack.setRoundState(
        "betting"
      );
    }


    this.syncBlackjackState();


    this.state.phase =
      this.mapRoundPhase(
        this.blackjack.phase
      );


    this.state.interactionLocked =
      this.isInteractionLocked(
        this.blackjack.phase
      );
  }


  /* ==========================================================================
     MAIN LOOP
     ========================================================================== */

  private loop = (
    time: number
  ): void => {

    if (
      this.destroyed
    ) {
      return;
    }


    this.animationFrame =
      requestAnimationFrame(
        this.loop
      );


    if (
      !this.running
    ) {
      return;
    }


    if (
      this.lastTime === 0
    ) {

      this.lastTime =
        time;

      this.state.delta =
        0;

      this.update(
        0
      );

      this.render();

      return;
    }


    let delta =
      (
        time -
        this.lastTime
      ) /
      1000;


    this.lastTime =
      time;


    delta =
      Math.min(
        Math.max(
          delta,
          0
        ),
        0.05
      );


    this.state.delta =
      delta;


    this.state.time +=
      delta;


    this.state.frame +=
      1;


    this.update(
      delta
    );


    this.render();
  };


  /* ==========================================================================
     UPDATE
     ========================================================================== */

  private update(
    delta: number
  ): void {

    this.updateAmbient(
      delta
    );


    this.updateCamera(
      delta
    );


    this.updateAnimation(
      delta
    );


    this.updateInput();


    /*
     * Pure state mirror.
     */
    this.syncBlackjackState();


    this.renderer.update?.(
      delta,
      this.state
    );
  }


  /* ==========================================================================
     AMBIENT MOTION
     ========================================================================== */

  private updateAmbient(
    delta: number
  ): void {

    if (
      this.options.reducedMotion
    ) {
      return;
    }


    this.ambientPhase +=
      delta *
      0.18;


    this.breathingPhase +=
      delta *
      0.85;
  }


  /* ==========================================================================
     CAMERA UPDATE
     ========================================================================== */

  private updateCamera(
    delta: number
  ): void {

    if (
      delta <=
      0
    ) {
      return;
    }


    const smooth =
      1 -
      Math.pow(
        0.001,
        delta
      );


    const motion =
      this.options.reducedMotion
        ? 0
        : Math.sin(
            this.breathingPhase
          );


    const desiredX =
      this.cameraTargetX +
      motion *
      0.08;


    const desiredY =
      this.cameraTargetY +
      motion *
      0.04;


    this.cameraVelocityX +=
      (
        desiredX -
        this.state.cameraX
      ) *
      0.035;


    this.cameraVelocityY +=
      (
        desiredY -
        this.state.cameraY
      ) *
      0.035;


    this.cameraVelocityX *=
      0.89;


    this.cameraVelocityY *=
      0.89;


    this.state.cameraX +=
      this.cameraVelocityX *
      smooth;


    this.state.cameraY +=
      this.cameraVelocityY *
      smooth;


    this.state.cameraZoom +=
      (
        this.cameraTargetZoom -
        this.state.cameraZoom
      ) *
      smooth *
      0.45;
  }


  /* ==========================================================================
     ANIMATION
     ========================================================================== */

  private updateAnimation(
    delta: number
  ): void {

    if (
      delta <=
      0
    ) {
      return;
    }


    this.animation.update(
      delta
    );
  }


  /* ==========================================================================
     INPUT
     ========================================================================== */

  private updateInput(): void {
    this.input.update();
  }


  /* ==========================================================================
     KEYBOARD
     ========================================================================== */

  private handleKeyDown(
    event: KeyboardEvent
  ): void {

    if (
      this.destroyed
    ) {
      return;
    }


    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) {
      return;
    }


    if (
      event.repeat
    ) {
      return;
    }


    const key =
      event.key.toLowerCase();


    if (
      !this.state.introComplete
    ) {

      if (
        key === " " ||
        key === "enter"
      ) {
        event.preventDefault();
      }

      return;
    }


    /* ----------------------------------------------------------------------
       BETTING
       ---------------------------------------------------------------------- */

    switch (
      key
    ) {

      case "+":
      case "=":

        event.preventDefault();

        this.increaseBet();

        return;

      case "-":
      case "_":

        event.preventDefault();

        this.decreaseBet();

        return;

      case "c":

        event.preventDefault();

        this.clearBet();

        return;

      case "b":

        event.preventDefault();

        this.repeatBet();

        return;

      case "1":

        event.preventDefault();

        this.increaseBet(
          5
        );

        return;

      case "2":

        event.preventDefault();

        this.increaseBet(
          10
        );

        return;

      case "3":

        event.preventDefault();

        this.increaseBet(
          25
        );

        return;

      case "4":

        event.preventDefault();

        this.increaseBet(
          50
        );

        return;

      case "5":

        event.preventDefault();

        this.increaseBet(
          100
        );

        return;

      case "6":

        event.preventDefault();

        this.increaseBet(
          500
        );

        return;

      default:
        break;
    }


    /* ----------------------------------------------------------------------
       DEAL
       ---------------------------------------------------------------------- */

    if (
      key === " " ||
      key === "enter"
    ) {

      event.preventDefault();


      if (
        this.blackjack.phase ===
        "betting"
      ) {
        this.deal();
      }


      return;
    }


    /* ----------------------------------------------------------------------
       PLAYER ACTIONS
       ---------------------------------------------------------------------- */

    switch (
      key
    ) {

      case "h":

        event.preventDefault();

        this.hit();

        break;

      case "s":

        event.preventDefault();

        this.stand();

        break;

      case "d":

        event.preventDefault();

        this.double();

        break;

      case "p":

        event.preventDefault();

        this.split();

        break;

      case "i":

        event.preventDefault();

        this.insurance();

        break;

      case "n":

        event.preventDefault();

        this.declineInsurance();

        break;

      case "r":

        event.preventDefault();

        this.surrender();

        break;

      case "escape":

        event.preventDefault();

        if (
          this.blackjack.phase ===
          "insurance"
        ) {
          this.declineInsurance();
        }

        break;

      default:
        break;
    }
  }


  /* ==========================================================================
     HUMAN PLAYER
     ========================================================================== */

  getHumanPlayerId(): string {
    return (
      this.blackjack
        .getHumanPlayer()
        ?.id ??
      ""
    );
  }


  /* ==========================================================================
     PLAYER ACTION DISPATCH
     ========================================================================== */

  private performAction(
    action: GameAction
  ): ActionResult {

    const playerId =
      this.getHumanPlayerId();


    if (
      !playerId
    ) {

      return {
        success:
          false,

        action,

        reason:
          "Human player not found.",
      };
    }


    if (
      !this.state.introComplete &&
      (
        action === "deal" ||
        action === "hit" ||
        action === "stand" ||
        action === "double" ||
        action === "split" ||
        action === "insurance" ||
        action === "decline-insurance" ||
        action === "surrender"
      )
    ) {

      return {
        success:
          false,

        action,

        reason:
          "Game introduction is still running.",
      };
    }


    const result =
      this.blackjack.execute(
        playerId,
        action
      );


    this.syncBlackjackState();


    this.emitActionEvent(
      action,
      result,
      playerId
    );


    this.render();


    return result;
  }


  /* ==========================================================================
     DEAL
     ========================================================================== */

  deal(): ActionResult {

    if (
      !this.state.introComplete
    ) {

      return {
        success:
          false,

        action:
          "deal",

        reason:
          "Game introduction is still running.",
      };
    }


    if (
      this.blackjack.phase ===
      "waiting"
    ) {

      this.blackjack.setRoundState(
        "betting"
      );
    }


    if (
      this.blackjack.phase ===
      "complete"
    ) {

      this.blackjack.setRoundState(
        "betting"
      );
    }


    if (
      this.blackjack.phase !==
      "betting"
    ) {

      return {
        success:
          false,

        action:
          "deal",

        reason:
          `Cannot deal during ${this.blackjack.phase} phase.`,
      };
    }


    return this.performAction(
      "deal"
    );
  }


  /* ==========================================================================
     HIT
     ========================================================================== */

  hit(): ActionResult {
    return this.performAction(
      "hit"
    );
  }


  /* ==========================================================================
     STAND
     ========================================================================== */

  stand(): ActionResult {
    return this.performAction(
      "stand"
    );
  }


  /* ==========================================================================
     DOUBLE
     ========================================================================== */

  double(): ActionResult {
    return this.performAction(
      "double"
    );
  }


  /* ==========================================================================
     SPLIT
     ========================================================================== */

  split(): ActionResult {
    return this.performAction(
      "split"
    );
  }


  /* ==========================================================================
     INSURANCE
     ========================================================================== */

  insurance(
    amount?: number
  ): ActionResult {

    const playerId =
      this.getHumanPlayerId();


    if (
      !playerId
    ) {

      return {
        success:
          false,

        action:
          "insurance",

        reason:
          "Human player not found.",
      };
    }


    if (
      !this.state.introComplete
    ) {

      return {
        success:
          false,

        action:
          "insurance",

        reason:
          "Game introduction is still running.",
      };
    }


    if (
      amount ===
      undefined
    ) {

      return this.performAction(
        "insurance"
      );
    }


    const result =
      this.blackjack.takeInsurance(
        playerId,
        amount
      );


    this.syncBlackjackState();


    this.emitActionEvent(
      "insurance",
      result,
      playerId
    );


    this.render();


    return result;
  }


  /* ==========================================================================
     DECLINE INSURANCE
     ========================================================================== */

  declineInsurance(): ActionResult {

    const playerId =
      this.getHumanPlayerId();


    if (
      !playerId
    ) {

      return {
        success:
          false,

        action:
          "decline-insurance",

        reason:
          "Human player not found.",
      };
    }


    if (
      !this.state.introComplete
    ) {

      return {
        success:
          false,

        action:
          "decline-insurance",

        reason:
          "Game introduction is still running.",
      };
    }


    const result =
      this.blackjack.declineInsurance(
        playerId
      );


    this.syncBlackjackState();


    this.emitActionEvent(
      "decline-insurance",
      result,
      playerId
    );


    this.render();


    return result;
  }


  /* ==========================================================================
     SURRENDER
     ========================================================================== */

  surrender(): ActionResult {
    return this.performAction(
      "surrender"
    );
  }


  /* ==========================================================================
     BETTING — INCREASE
     ========================================================================== */

  increaseBet(
    amount = 5
  ): ActionResult {

    const playerId =
      this.getHumanPlayerId();


    if (
      !playerId
    ) {

      return {
        success:
          false,

        action:
          "increase-bet",

        reason:
          "Human player not found.",
      };
    }


    const result =
      this.blackjack.increaseBet(
        playerId,
        amount
      );


    this.syncBlackjackState();


    this.emitActionEvent(
      "increase-bet",
      result,
      playerId
    );


    this.render();


    return result;
  }


  /* ==========================================================================
     BETTING — DECREASE
     ========================================================================== */

  decreaseBet(
    amount = 5
  ): ActionResult {

    const playerId =
      this.getHumanPlayerId();


    if (
      !playerId
    ) {

      return {
        success:
          false,

        action:
          "decrease-bet",

        reason:
          "Human player not found.",
      };
    }


    const result =
      this.blackjack.decreaseBet(
        playerId,
        amount
      );


    this.syncBlackjackState();


    this.emitActionEvent(
      "decrease-bet",
      result,
      playerId
    );


    this.render();


    return result;
  }


  /* ==========================================================================
     BETTING — CLEAR
     ========================================================================== */

  clearBet(): ActionResult {

    const playerId =
      this.getHumanPlayerId();


    if (
      !playerId
    ) {

      return {
        success:
          false,

        action:
          "clear-bet",

        reason:
          "Human player not found.",
      };
    }


    const result =
      this.blackjack.clearBet(
        playerId
      );


    this.syncBlackjackState();


    this.emitActionEvent(
      "clear-bet",
      result,
      playerId
    );


    this.render();


    return result;
  }


  /* ==========================================================================
     BETTING — REPEAT
     ========================================================================== */

  repeatBet(): ActionResult {

    const playerId =
      this.getHumanPlayerId();


    if (
      !playerId
    ) {

      return {
        success:
          false,

        action:
          "repeat-bet",

        reason:
          "Human player not found.",
      };
    }


    const result =
      this.blackjack.execute(
        playerId,
        "repeat-bet"
      );


    this.syncBlackjackState();


    this.emitActionEvent(
      "repeat-bet",
      result,
      playerId
    );


    this.render();


    return result;
  }


  /* ==========================================================================
     BETTING — SET
     ========================================================================== */

  setBet(
    amount: number
  ): ActionResult {

    const playerId =
      this.getHumanPlayerId();


    if (
      !playerId
    ) {

      return {
        success:
          false,

        action:
          "increase-bet",

        reason:
          "Human player not found.",
      };
    }


    const result =
      this.blackjack.setBet(
        playerId,
        amount
      );


    this.syncBlackjackState();


    this.emitActionEvent(
      "increase-bet",
      result,
      playerId
    );


    this.render();


    return result;
  }


  /* ==========================================================================
     ACTION EVENT
     ========================================================================== */

  private emitActionEvent(
    action: GameAction,
    result: ActionResult,
    playerId: string
  ): void {

    if (
      typeof window ===
      "undefined"
    ) {
      return;
    }


    const detail:
      GameActionEventDetail = {
      action,
      result,
      playerId,
    };


    window.dispatchEvent(
      new CustomEvent(
        "blackjack:action",
        {
          detail,
        }
      )
    );
  }


  /* ==========================================================================
     TABLE AVAILABILITY
     ========================================================================== */

  isTableAvailable(): boolean {

    if (
      this.destroyed
    ) {
      return false;
    }


    if (
      !this.state.introComplete
    ) {
      return false;
    }


    if (
      this.blackjack.phase !==
      "betting"
    ) {
      return false;
    }


    return (
      this.blackjack
        .getHumanPlayer() !==
      undefined
    );
  }


  /* ==========================================================================
     RENDER
     ========================================================================== */

  private render(): void {

    if (
      this.destroyed
    ) {
      return;
    }


    this.renderer.render(
      this.state
    );
  }


  /* ==========================================================================
     LOOP CONTROL
     ========================================================================== */

  start(): void {

    if (
      this.destroyed
    ) {
      return;
    }


    this.running =
      true;


    this.lastTime =
      typeof performance !==
      "undefined"
        ? performance.now()
        : Date.now();
  }


  pause(): void {

    if (
      this.destroyed
    ) {
      return;
    }


    this.running =
      false;
  }


  resume(): void {

    if (
      this.destroyed
    ) {
      return;
    }


    this.running =
      true;


    this.lastTime =
      typeof performance !==
      "undefined"
        ? performance.now()
        : Date.now();
  }


  /* ==========================================================================
     PUBLIC PHASE COMPATIBILITY
     ========================================================================== */

  setPhase(
    phase: GamePhase
  ): void {

    if (
      this.destroyed
    ) {
      return;
    }


    this.state.phase =
      phase;


    this.state.interactionLocked =
      phase === "loading" ||
      phase === "dealer-turn" ||
      phase === "settling";
  }


  setInteractionLocked(
    locked: boolean
  ): void {

    if (
      this.destroyed
    ) {
      return;
    }


    this.state.interactionLocked =
      locked;
  }


  /* ==========================================================================
     CAMERA
     ========================================================================== */

  setCamera(
    x: number,
    y: number,
    zoom = 1
  ): void {

    if (
      this.destroyed
    ) {
      return;
    }


    this.cameraTargetX =
      Number.isFinite(x)
        ? x
        : 0;


    this.cameraTargetY =
      Number.isFinite(y)
        ? y
        : 0;


    this.cameraTargetZoom =
      Number.isFinite(zoom)
        ? Math.max(
            0.5,
            Math.min(
              2,
              zoom
            )
          )
        : 1;
  }


  /* ==========================================================================
     CURRENT GAME DATA
     ========================================================================== */

  getGameState() {

    this.syncBlackjackState();


    return {
      visual:
        this.state,

      blackjack:
        this.blackjack.getState(),

      casino:
        this.blackjack.getVisualState(),

      human:
        this.blackjack.getHumanPlayer(),
    };
  }


  getPlayerBalance(): number {
    return (
      this.blackjack
        .getHumanPlayer()
        ?.balance ??
      0
    );
  }


  getPlayerBet(): number {
    return (
      this.blackjack
        .getHumanPlayer()
        ?.bet ??
      0
    );
  }


  getPlayerHand() {
    return (
      this.blackjack
        .getHumanPlayer()
        ?.hand ??
      null
    );
  }


  getDealerHand() {
    return this.blackjack.dealer.hand;
  }


  /* ==========================================================================
     DEBUG
     ========================================================================== */

  getDebugState() {

    const engineState =
      this.blackjack.getState();

    const human =
      this.blackjack.getHumanPlayer();

    const dealerHand =
      this.blackjack
        .dealer
        .hand;


    this.syncBlackjackState();


    return {
      running:
        this.running,

      destroyed:
        this.destroyed,

      tableAvailable:
        this.isTableAvailable(),

      phase:
        this.state.phase,

      enginePhase:
        engineState.phase,

      introComplete:
        this.state.introComplete,

      introProgress:
        this.introProgress,

      interactionLocked:
        this.state.interactionLocked,

      frame:
        this.state.frame,

      time:
        this.state.time,

      delta:
        this.state.delta,

      roundNumber:
        engineState.roundNumber,

      activeSeat:
        engineState.activeSeat,

      activeHandIndex:
        engineState.activeHandIndex,

      roundLocked:
        engineState.roundLocked,

      dealerHoleCardRevealed:
        engineState.dealerHoleCardRevealed,

      dealerTurnCompleted:
        engineState.dealerTurnCompleted,

      camera: {
        x:
          this.state.cameraX,

        y:
          this.state.cameraY,

        zoom:
          this.state.cameraZoom,
      },

      cameraTarget: {
        x:
          this.cameraTargetX,

        y:
          this.cameraTargetY,

        zoom:
          this.cameraTargetZoom,
      },

      pointer: {
        x:
          this.state.pointerX,

        y:
          this.state.pointerY,

        inside:
          this.state.pointerInside,
      },

      focus:
        this.state.isFocused,

      human: {
        exists:
          !!human,

        id:
          human?.id ?? "",

        balance:
          human?.balance ?? 0,

        bet:
          human?.bet ?? 0,

        handValue:
          human?.hand.value ?? 0,

        handState:
          human?.hand.state ??
          "empty",
      },

      dealer: {
        value:
          dealerHand.value,

        hidden:
          dealerHand.cards.some(
            card =>
              !card.faceUp
          ),
      },

      canvas: {
        width:
          this.canvas.width,

        height:
          this.canvas.height,

        clientWidth:
          this.widthSafe(
            this.canvas.clientWidth
          ),

        clientHeight:
          this.widthSafe(
            this.canvas.clientHeight
          ),
      },
    };
  }


  /* ==========================================================================
     NUMBER SAFETY
     ========================================================================== */

  private widthSafe(
    value: number
  ): number {

    return Number.isFinite(
      value
    )
      ? value
      : 0;
  }


  /* ==========================================================================
     DESTROY
     ========================================================================== */

  destroy(): void {

    if (
      this.destroyed
    ) {
      return;
    }


    this.destroyed =
      true;


    this.running =
      false;


    cancelAnimationFrame(
      this.animationFrame
    );


    this.animationFrame =
      0;


    this.unbindEvents();


    for (
      const unsubscribe of
        this.blackjackUnsubscribers
    ) {

      try {
        unsubscribe();
      } catch {
        /*
         * Ignore individual cleanup failures.
         */
      }
    }


    this.blackjackUnsubscribers =
      [];


    try {
      this.renderer.destroy?.();
    } catch {
      /* ignore cleanup error */
    }


    try {
      this.animation.destroy?.();
    } catch {
      /* ignore cleanup error */
    }


    try {
      this.input.destroy?.();
    } catch {
      /* ignore cleanup error */
    }


    try {
      this.blackjack.destroy();
    } catch {
      /* ignore cleanup error */
    }


    this.state.phase =
      "loading";

    this.state.interactionLocked =
      true;

    this.state.introComplete =
      false;
  }
}


/* ==========================================================================
   DEFAULT EXPORT
   ========================================================================== */

export default Game;