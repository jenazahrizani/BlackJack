import { Renderer } from "./Renderer";
import { Animation } from "./Animation";
import { Input } from "./Input";

/* ==========================================================================
   BLACKJACK 21 — GAME DIRECTOR

   Responsibilities:
   - Canvas lifecycle
   - Render loop
   - Timing
   - Responsive sizing
   - Camera / visual state
   - Ambient motion
   - Pointer state
   - Keyboard shortcuts
   - Connection to Renderer / Animation / Input

   Architecture:

      Browser
         │
         ├── Pointer / Touch / Keyboard
         │
         ▼
       Input.ts
         │
         ▼
       Game.ts
         │
         ├── Animation.ts
         │
         ▼
      Renderer.ts

   IMPORTANT:
   Input.ts owns pointer interaction internally.
   Game.ts therefore does NOT call:
     - input.pointerMove()
     - input.pointerDown()
     - input.pointerUp()
   ========================================================================== */

export type GamePhase =
  | "loading"
  | "idle"
  | "betting"
  | "player-turn"
  | "dealer-turn"
  | "settling";

export type GameVisualState = {
  phase: GamePhase;

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
};

export type GameOptions = {
  logicalWidth?: number;
  logicalHeight?: number;
  maxDpr?: number;
  pixelRatio?: number;
  reducedMotion?: boolean;
};

export class Game {
  /* ------------------------------------------------------------------------
     CORE
     ------------------------------------------------------------------------ */

  readonly canvas: HTMLCanvasElement;

  readonly renderer: Renderer;
  readonly animation: Animation;
  readonly input: Input;

  readonly options: Required<GameOptions>;

  state: GameVisualState;

  private animationFrame = 0;
  private lastTime = 0;

  private running = false;
  private destroyed = false;

  private resizeObserver: ResizeObserver | null = null;

  /* ------------------------------------------------------------------------
     VISUAL / ATMOSPHERE
     ------------------------------------------------------------------------ */

  private ambientPhase = 0;
  private breathingPhase = 0;

  private cameraTargetX = 0;
  private cameraTargetY = 0;
  private cameraTargetZoom = 1;

  private cameraVelocityX = 0;
  private cameraVelocityY = 0;

  private introProgress = 0;

  /* ------------------------------------------------------------------------
     EVENTS

     Game owns ONLY the events that represent game-level state.

     Input.ts owns interaction events such as:
       pointermove
       pointerdown
       pointerup
       wheel
       touch
       keyboard action mapping

     We still observe canvas pointerenter / pointerleave here because
     those are purely visual state indicators for the renderer.
     ------------------------------------------------------------------------ */

  private boundResize = () => {
    this.resize();
  };

  private boundPointerEnter = () => {
    this.state.pointerInside = true;
  };

  private boundPointerLeave = () => {
    this.state.pointerInside = false;
  };

  private boundFocus = () => {
    this.state.isFocused = true;
  };

  private boundBlur = () => {
    this.state.isFocused = false;
  };

  private boundKeyDown = (event: KeyboardEvent) => {
    this.handleKeyDown(event);
  };

  /* ========================================================================
     CONSTRUCTOR
     ======================================================================== */

  constructor(
    canvas: HTMLCanvasElement,
    options: GameOptions = {}
  ) {
    this.canvas = canvas;

    this.options = {
      logicalWidth:
        options.logicalWidth ?? 960,

      logicalHeight:
        options.logicalHeight ?? 540,

      maxDpr:
        options.maxDpr ?? 2,

      pixelRatio:
        options.pixelRatio ?? 1,

      reducedMotion:
        options.reducedMotion ??
        window.matchMedia?.(
          "(prefers-reduced-motion: reduce)"
        ).matches ??
        false,
    };

    /* ----------------------------------------------------------------------
       INITIAL STATE
       ---------------------------------------------------------------------- */

    this.state = {
      phase: "loading",

      cameraX: 0,
      cameraY: 0,
      cameraZoom: 1,

      pointerX: 0,
      pointerY: 0,

      pointerInside: false,

      time: 0,
      delta: 0,
      frame: 0,

      isFocused: document.hasFocus(),

      interactionLocked: true,
    };

    /* ----------------------------------------------------------------------
       CANVAS
       ---------------------------------------------------------------------- */

    this.prepareCanvas();

    /* ----------------------------------------------------------------------
       ENGINE SERVICES
       ---------------------------------------------------------------------- */

    this.renderer = new Renderer(this.canvas);

    this.animation = new Animation();

    this.input = new Input(this.canvas);

    /* ----------------------------------------------------------------------
       EVENTS
       ---------------------------------------------------------------------- */

    this.bindEvents();

    /* ----------------------------------------------------------------------
       INITIAL SIZE
       ---------------------------------------------------------------------- */

    this.resize();

    /* ----------------------------------------------------------------------
       INTRO
       ---------------------------------------------------------------------- */

    this.startIntro();

    /* ----------------------------------------------------------------------
       START LOOP
       ---------------------------------------------------------------------- */

    this.running = true;

    this.animationFrame =
      requestAnimationFrame(this.loop);
  }

  /* ========================================================================
     CANVAS SETUP
     ======================================================================== */

  private prepareCanvas() {
    this.canvas.style.display = "block";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";

    /*
     * Pixel-art / pixel-clean rendering.
     */
    this.canvas.style.imageRendering = "pixelated";

    this.canvas.setAttribute(
      "role",
      "img"
    );

    this.canvas.setAttribute(
      "aria-label",
      "Blackjack 21 casino table"
    );

    /*
     * Prevent browser gestures / scrolling
     * while interacting with the table.
     */
    this.canvas.style.touchAction = "none";
  }

  /* ========================================================================
     EVENT BINDING
     ======================================================================== */

  private bindEvents() {
    window.addEventListener(
      "resize",
      this.boundResize,
      { passive: true }
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

    /*
     * These pointer events are intentionally limited
     * to visual state tracking.
     *
     * Input.ts remains the owner of the actual
     * pointer interaction pipeline.
     */
    this.canvas.addEventListener(
      "pointerenter",
      this.boundPointerEnter,
      { passive: true }
    );

    this.canvas.addEventListener(
      "pointerleave",
      this.boundPointerLeave,
      { passive: true }
    );

    /*
     * ResizeObserver keeps the render surface correct
     * if the containing element changes independently
     * of window resize.
     */
    if (
      typeof ResizeObserver !== "undefined"
    ) {
      this.resizeObserver =
        new ResizeObserver(() => {
          this.resize();
        });

      this.resizeObserver.observe(
        this.canvas
      );
    }
  }

  /* ========================================================================
     EVENT UNBINDING
     ======================================================================== */

  private unbindEvents() {
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

    this.canvas.removeEventListener(
      "pointerenter",
      this.boundPointerEnter
    );

    this.canvas.removeEventListener(
      "pointerleave",
      this.boundPointerLeave
    );

    this.resizeObserver?.disconnect();

    this.resizeObserver = null;
  }

  /* ========================================================================
     RESIZE
     ======================================================================== */

  resize() {
    if (this.destroyed) {
      return;
    }

    const rect =
      this.canvas.getBoundingClientRect();

    const width = Math.max(
      1,
      Math.floor(rect.width)
    );

    const height = Math.max(
      1,
      Math.floor(rect.height)
    );

    /*
     * Renderer controls the actual backing buffer
     * and DPR-aware canvas dimensions.
     */
    this.renderer.resize(
      width,
      height
    );

    /*
     * Update camera framing.
     */
    this.updateCameraViewport(
      width,
      height
    );
  }

  /* ========================================================================
     CAMERA VIEWPORT
     ======================================================================== */

  private updateCameraViewport(
    width: number,
    height: number
  ) {
    const aspect =
      width /
      Math.max(height, 1);

    /*
     * Comfortable casino-table framing.

       Wide:
         natural zoom

       Medium:
         slightly closer

       Narrow:
         slightly closer again
     */
    if (aspect >= 1.65) {
      this.cameraTargetZoom = 1;
    } else if (aspect >= 1.35) {
      this.cameraTargetZoom = 1.04;
    } else {
      this.cameraTargetZoom = 1.1;
    }

    /*
     * Keep focus a little above center.
     */
    this.cameraTargetX = 0;

    this.cameraTargetY =
      height < 650
        ? -4
        : -2;
  }

  /* ========================================================================
     INTRO
     ======================================================================== */

  private startIntro() {
    if (this.options.reducedMotion) {
      this.introProgress = 1;

      this.state.phase = "idle";

      this.state.interactionLocked = false;

      return;
    }

    this.introProgress = 0;

    const duration = 900;

    const startedAt =
      performance.now();

    const introTick = (now: number) => {
      if (this.destroyed) {
        return;
      }

      const elapsed =
        now - startedAt;

      this.introProgress =
        Math.min(
          elapsed / duration,
          1
        );

      if (
        this.introProgress < 1
      ) {
        requestAnimationFrame(
          introTick
        );

        return;
      }

      this.state.phase = "idle";

      this.state.interactionLocked = false;
    };

    requestAnimationFrame(
      introTick
    );
  }

  /* ========================================================================
     MAIN LOOP
     ======================================================================== */

  private loop = (time: number) => {
    if (this.destroyed) {
      return;
    }

    /*
     * Schedule the next frame first.
     */
    this.animationFrame =
      requestAnimationFrame(
        this.loop
      );

    if (!this.running) {
      return;
    }

    /*
     * First-frame protection.
     */
    if (!this.lastTime) {
      this.lastTime = time;

      /*
       * Still render the initial frame.
       */
      this.update(0);
      this.render();

      return;
    }

    let delta =
      (time - this.lastTime) /
      1000;

    this.lastTime = time;

    /*
     * Prevent giant time jumps after:
     * - tab switching
     * - devtools
     * - laptop sleep
     * - browser throttling
     */
    delta =
      Math.min(
        Math.max(delta, 0),
        0.05
      );

    this.state.delta = delta;

    this.state.time += delta;

    this.state.frame += 1;

    this.update(delta);

    this.render();
  };

  /* ========================================================================
     UPDATE
     ======================================================================== */

  private update(delta: number) {
    this.updateAmbient(delta);

    this.updateCamera(delta);

    this.updateAnimation(delta);

    this.updateInput();

    /*
     * Renderer can maintain any internal animation
     * or interpolation it needs.
     */
    this.renderer.update?.(
      delta,
      this.state
    );
  }

  /* ========================================================================
     AMBIENT MOTION
     ======================================================================== */

  private updateAmbient(delta: number) {
    if (this.options.reducedMotion) {
      return;
    }

    /*
     * Slow atmosphere movement.
     *
     * The movement is intentionally subtle:
     * a casino table should feel alive,
     * not like a screensaver.
     */
    this.ambientPhase +=
      delta * 0.18;

    this.breathingPhase +=
      delta * 0.85;
  }

  /* ========================================================================
     CAMERA UPDATE
     ======================================================================== */

  private updateCamera(delta: number) {
    /*
     * Stable frame-rate independent smoothing.
     */
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
      motion * 0.16;

    const desiredY =
      this.cameraTargetY +
      motion * 0.08;

    /*
     * Spring-ish camera movement.
     */
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

    /*
     * Damping.
     */
    this.cameraVelocityX *= 0.89;
    this.cameraVelocityY *= 0.89;

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

  /* ========================================================================
     ANIMATION SERVICE
     ======================================================================== */

  private updateAnimation(
    delta: number
  ) {
    if (delta <= 0) {
      return;
    }

    this.animation.update(
      delta
    );
  }

  /* ========================================================================
     INPUT SERVICE
     ======================================================================== */

  private updateInput() {
    /*
     * Input.ts owns:
     * - pointer state
     * - mouse buttons
     * - touch state
     * - drag state
     * - wheel state
     * - transient keyboard state
     * - UI action mapping
     *
     * Its update() method clears one-frame
     * transient values after they have been consumed.
     */
    this.input.update();

    /*
     * Copy the normalized pointer position from Input
     * into Game's visual state when available.
     *
     * We intentionally avoid depending on optional
     * pointer forwarding methods.
     */
    const inputState =
      this.input.state;

    if (inputState) {
      this.state.pointerX =
        inputState.pointer.x;

      this.state.pointerY =
        inputState.pointer.y;
    }
  }

  /* ========================================================================
     KEYBOARD
     ======================================================================== */

  private handleKeyDown(
    event: KeyboardEvent
  ) {
    if (
      this.state.interactionLocked
    ) {
      return;
    }

    /*
     * Never hijack browser / OS shortcuts.
     */
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) {
      return;
    }

    switch (
      event.key.toLowerCase()
    ) {
      case "h":
        this.emitGameAction(
          "hit"
        );
        break;

      case "s":
        this.emitGameAction(
          "stand"
        );
        break;

      case "d":
        this.emitGameAction(
          "double"
        );
        break;

      case "p":
        this.emitGameAction(
          "split"
        );
        break;

      case "escape":
        this.emitGameAction(
          "escape"
        );
        break;

      default:
        break;
    }
  }

  /* ========================================================================
     GAME ACTION BRIDGE
     ======================================================================== */

  emitGameAction(
    action:
      | "hit"
      | "stand"
      | "double"
      | "split"
      | "escape"
  ) {
    /*
     * Temporary visual/game-shell bridge.
     *
     * Later this should become:
     *
     *   Input
     *     ↓
     *   Game
     *     ↓
     *   Blackjack
     *     ↓
     *   GameVisualState
     *
     * For now we preserve the visual shell behaviour.
     */

    switch (action) {
      case "hit": {
        if (
          this.state.phase ===
          "idle"
        ) {
          this.state.phase =
            "player-turn";
        }

        break;
      }

      case "stand": {
        if (
          this.state.phase ===
            "idle" ||
          this.state.phase ===
            "player-turn"
        ) {
          this.state.phase =
            "dealer-turn";
        }

        break;
      }

      case "double": {
        if (
          this.state.phase ===
          "idle"
        ) {
          this.state.phase =
            "player-turn";
        }

        break;
      }

      case "split": {
        if (
          this.state.phase ===
          "idle"
        ) {
          this.state.phase =
            "player-turn";
        }

        break;
      }

      case "escape": {
        this.state.phase = "idle";

        break;
      }

      default:
        break;
    }

    /*
     * Notify Astro / HUD / other UI systems.
     */
    window.dispatchEvent(
      new CustomEvent(
        "blackjack:action",
        {
          detail: {
            action,
            state: this.state,
          },
        }
      )
    );
  }

  /* ========================================================================
     RENDER
     ======================================================================== */

  private render() {
    /*
     * Renderer receives the complete visual state.

       Render order:

       1. casino background
       2. ambience
       3. table
       4. dealer
       5. other players
       6. deck
       7. cards
       8. chips
       9. foreground lighting
      10. pixel pass
     */

    this.renderer.render(
      this.state
    );
  }

  /* ========================================================================
     PUBLIC CONTROL
     ======================================================================== */

  start() {
    if (this.destroyed) {
      return;
    }

    this.running = true;

    this.lastTime =
      performance.now();
  }

  pause() {
    this.running = false;
  }

  resume() {
    if (this.destroyed) {
      return;
    }

    this.running = true;

    this.lastTime =
      performance.now();
  }

  setPhase(
    phase: GamePhase
  ) {
    this.state.phase = phase;

    /*
     * Lock interaction during loading
     * and dealer/settlement transitions.
     */
    this.state.interactionLocked =
      phase === "loading" ||
      phase === "dealer-turn" ||
      phase === "settling";
  }

  setInteractionLocked(
    locked: boolean
  ) {
    this.state.interactionLocked =
      locked;
  }

  setCamera(
    x: number,
    y: number,
    zoom = 1
  ) {
    this.cameraTargetX = x;

    this.cameraTargetY = y;

    this.cameraTargetZoom =
      Math.max(
        0.5,
        Math.min(
          2,
          zoom
        )
      );
  }

  /* ========================================================================
     DEBUG
     ======================================================================== */

  getDebugState() {
    return {
      running:
        this.running,

      phase:
        this.state.phase,

      frame:
        this.state.frame,

      time:
        this.state.time,

      delta:
        this.state.delta,

      camera: {
        x:
          this.state.cameraX,

        y:
          this.state.cameraY,

        zoom:
          this.state.cameraZoom,
      },

      pointer: {
        x:
          this.state.pointerX,

        y:
          this.state.pointerY,

        inside:
          this.state.pointerInside,
      },

      canvas: {
        width:
          this.canvas.width,

        height:
          this.canvas.height,
      },
    };
  }

  /* ========================================================================
     DESTROY
     ======================================================================== */

  destroy() {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;

    this.running = false;

    cancelAnimationFrame(
      this.animationFrame
    );

    this.unbindEvents();

    /*
     * Destroy services safely.
     */
    this.renderer.destroy?.();

    this.animation.destroy?.();

    this.input.destroy?.();
  }
}