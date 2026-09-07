/* ==========================================================================
   BLACKJACK 21 — INPUT SYSTEM
   --------------------------------------------------------------------------
   Unified interaction layer for:

   - Mouse
   - Pointer
   - Touch
   - Keyboard
   - Click / press / release
   - Hover
   - Drag
   - Wheel
   - Pointer capture
   - Normalized coordinates
   - Input zones
   - UI/game event bridge

   ARCHITECTURE
   --------------------------------------------------------------------------

      Hardware / Browser
              │
              ▼
          Input.ts
              │
       ┌──────┴─────────┐
       │                │
       ▼                ▼
     zones          Input events
       │                │
       └──────┬─────────┘
              ▼
            Game.ts
              │
              ▼
         Blackjack.ts

   IMPORTANT
   --------------------------------------------------------------------------
   Game.ts is currently the owner of keyboard gameplay actions.

   Therefore keyboard input in this class:
     - updates key state
     - emits keyboard events
     - does NOT directly execute gameplay actions

   Pointer zones / UI elements MAY trigger InputAction events.

   This avoids duplicate actions between Input.ts and Game.ts.
   ========================================================================== */


/* ==========================================================================
   TYPES
   ========================================================================== */

export type InputMode =
  | "game"
  | "ui"
  | "disabled";


export type PointerButton =
  | "left"
  | "middle"
  | "right";


/*
 * These action names intentionally mirror the Blackjack engine.
 */
export type InputAction =
  | "deal"
  | "hit"
  | "stand"
  | "double"
  | "split"
  | "insurance"
  | "decline-insurance"
  | "surrender"
  | "repeat-bet"
  | "clear-bet"
  | "increase-bet"
  | "decrease-bet"
  | "bet-increase"
  | "bet-decrease"
  | "escape"
  | "confirm"
  | "cancel";


export type InputPoint = {
  /*
   * Screen-relative coordinates.
   */
  x: number;
  y: number;

  /*
   * Normalized coordinates.
   *
   * 0 = left / top
   * 1 = right / bottom
   */
  nx: number;
  ny: number;

  /*
   * Coordinates relative to the rendered canvas.
   */
  canvasX: number;
  canvasY: number;
};


export type InputZone = {
  id: string;

  /*
   * Zone coordinates use canvas CSS pixels.
   */
  x: number;
  y: number;

  width: number;
  height: number;

  enabled?: boolean;

  action?: InputAction;

  cursor?: string;

  onEnter?: () => void;

  onLeave?: () => void;

  onDown?: (
    point: InputPoint
  ) => void;

  onUp?: (
    point: InputPoint
  ) => void;

  onClick?: (
    point: InputPoint
  ) => void;
};


export type InputState = {
  mode: InputMode;

  pointer: InputPoint;

  pointerInside: boolean;

  buttonLeft: boolean;
  buttonMiddle: boolean;
  buttonRight: boolean;

  /*
   * One-frame pointer transitions.
   */
  justPressed: boolean;
  justReleased: boolean;

  wheelX: number;
  wheelY: number;

  dragging: boolean;

  dragStart: InputPoint;

  dragDistance: number;

  keys: Set<string>;
};


export type InputEvent = {
  type:
    | "pointerdown"
    | "pointerup"
    | "pointermove"
    | "pointerenter"
    | "pointerleave"
    | "pointercancel"
    | "click"
    | "wheel"
    | "keydown"
    | "keyup";

  point?: InputPoint;

  button?: PointerButton;

  key?: string;

  deltaX?: number;
  deltaY?: number;

  action?: InputAction;
};


export type InputListener = (
  event: InputEvent
) => void;


/* ==========================================================================
   CONSTANTS
   ========================================================================== */

const DRAG_THRESHOLD =
  4;


const DEFAULT_CURSOR =
  "default";


const POINTER_ACTION_BUTTON =
  0;


/* ==========================================================================
   INPUT CLASS
   ========================================================================== */

export class Input {

  /* ========================================================================
     CORE
     ======================================================================== */

  readonly canvas: HTMLCanvasElement;

  mode: InputMode =
    "game";

  readonly state: InputState;


  /* ========================================================================
     ZONES
     ======================================================================== */

  private zones: InputZone[] =
    [];

  private hoveredZones =
    new Set<string>();

  private pressedZones =
    new Set<string>();


  /* ========================================================================
     LISTENERS
     ======================================================================== */

  private listeners =
    new Map<
      InputEvent["type"],
      Set<InputListener>
    >();


  /* ========================================================================
     LIFECYCLE
     ======================================================================== */

  private destroyed =
    false;


  /* ========================================================================
     POINTER STATE
     ======================================================================== */

  private pointerDownPoint:
    InputPoint | null =
    null;

  private pointerCaptured =
    false;

  private capturedPointerId:
    number | null =
    null;


  /* ========================================================================
     ACTIVE POINTER
     ======================================================================== */

  private activePointerId:
    number | null =
    null;


  /* ========================================================================
     BOUND HANDLERS
     ======================================================================== */

  private boundPointerMove =
    (
      event: PointerEvent
    ) => {
      this.handlePointerMove(
        event
      );
    };


  private boundPointerDown =
    (
      event: PointerEvent
    ) => {
      this.handlePointerDown(
        event
      );
    };


  private boundPointerUp =
    (
      event: PointerEvent
    ) => {
      this.handlePointerUp(
        event
      );
    };


  private boundPointerCancel =
    (
      event: PointerEvent
    ) => {
      this.handlePointerCancel(
        event
      );
    };


  private boundPointerEnter =
    (
      event: PointerEvent
    ) => {
      this.handlePointerEnter(
        event
      );
    };


  private boundPointerLeave =
    (
      event: PointerEvent
    ) => {
      this.handlePointerLeave(
        event
      );
    };


  private boundWheel =
    (
      event: WheelEvent
    ) => {
      this.handleWheel(
        event
      );
    };


  private boundKeyDown =
    (
      event: KeyboardEvent
    ) => {
      this.handleKeyDown(
        event
      );
    };


  private boundKeyUp =
    (
      event: KeyboardEvent
    ) => {
      this.handleKeyUp(
        event
      );
    };


  private boundWindowBlur =
    () => {
      this.releaseAllInput();
    };


  /* ==========================================================================
     CONSTRUCTOR
     ========================================================================== */

  constructor(
    canvas: HTMLCanvasElement
  ) {
    this.canvas =
      canvas;


    this.state = {
      mode:
        this.mode,

      pointer: {
        x:
          0,

        y:
          0,

        nx:
          0,

        ny:
          0,

        canvasX:
          0,

        canvasY:
          0,
      },

      pointerInside:
        false,

      buttonLeft:
        false,

      buttonMiddle:
        false,

      buttonRight:
        false,

      justPressed:
        false,

      justReleased:
        false,

      wheelX:
        0,

      wheelY:
        0,

      dragging:
        false,

      dragStart: {
        x:
          0,

        y:
          0,

        nx:
          0,

        ny:
          0,

        canvasX:
          0,

        canvasY:
          0,
      },

      dragDistance:
        0,

      keys:
        new Set<string>(),
    };


    this.prepareCanvas();

    this.bindEvents();
  }


  /* ==========================================================================
     CANVAS PREPARATION
     ========================================================================== */

  private prepareCanvas() {
    this.canvas.style.touchAction =
      "none";

    this.canvas.style.cursor =
      DEFAULT_CURSOR;

    /*
     * Keyboard focus fallback.
     *
     * Do not overwrite an existing tabindex if one is already provided.
     */
    if (
      !this.canvas.hasAttribute(
        "tabindex"
      )
    ) {
      this.canvas.setAttribute(
        "tabindex",
        "0"
      );
    }


    /*
     * We want pointer events to represent the complete interaction layer.
     */
    this.canvas.style.userSelect =
      "none";

    this.canvas.style.webkitUserSelect =
      "none";
  }


  /* ==========================================================================
     EVENT BINDING
     ========================================================================== */

  private bindEvents() {
    this.canvas.addEventListener(
      "pointermove",
      this.boundPointerMove,
      {
        passive:
          true,
      }
    );


    this.canvas.addEventListener(
      "pointerdown",
      this.boundPointerDown
    );


    this.canvas.addEventListener(
      "pointerup",
      this.boundPointerUp
    );


    this.canvas.addEventListener(
      "pointercancel",
      this.boundPointerCancel
    );


    this.canvas.addEventListener(
      "pointerenter",
      this.boundPointerEnter,
      {
        passive:
          true,
      }
    );


    this.canvas.addEventListener(
      "pointerleave",
      this.boundPointerLeave,
      {
        passive:
          true,
      }
    );


    this.canvas.addEventListener(
      "wheel",
      this.boundWheel,
      {
        passive:
          false,
      }
    );


    /*
     * Game.ts remains the keyboard gameplay owner.
     *
     * Input.ts still tracks and emits keyboard state.
     */
    window.addEventListener(
      "keydown",
      this.boundKeyDown
    );


    window.addEventListener(
      "keyup",
      this.boundKeyUp
    );


    /*
     * Losing focus must never leave a stuck keyboard/pointer state.
     */
    window.addEventListener(
      "blur",
      this.boundWindowBlur
    );
  }


  /* ==========================================================================
     EVENT UNBINDING
     ========================================================================== */

  private unbindEvents() {
    this.canvas.removeEventListener(
      "pointermove",
      this.boundPointerMove
    );


    this.canvas.removeEventListener(
      "pointerdown",
      this.boundPointerDown
    );


    this.canvas.removeEventListener(
      "pointerup",
      this.boundPointerUp
    );


    this.canvas.removeEventListener(
      "pointercancel",
      this.boundPointerCancel
    );


    this.canvas.removeEventListener(
      "pointerenter",
      this.boundPointerEnter
    );


    this.canvas.removeEventListener(
      "pointerleave",
      this.boundPointerLeave
    );


    this.canvas.removeEventListener(
      "wheel",
      this.boundWheel
    );


    window.removeEventListener(
      "keydown",
      this.boundKeyDown
    );


    window.removeEventListener(
      "keyup",
      this.boundKeyUp
    );


    window.removeEventListener(
      "blur",
      this.boundWindowBlur
    );
  }


  /* ==========================================================================
     POINTER POSITION
     ========================================================================== */

  private getPoint(
    event: PointerEvent
  ): InputPoint {
    const rect =
      this.canvas.getBoundingClientRect();


    const width =
      Math.max(
        rect.width,
        1
      );


    const height =
      Math.max(
        rect.height,
        1
      );


    const x =
      event.clientX -
      rect.left;


    const y =
      event.clientY -
      rect.top;


    /*
     * Clamp normalized values.
     *
     * Pointer capture can deliver coordinates slightly outside
     * the canvas rectangle.
     */
    const nx =
      Math.max(
        0,
        Math.min(
          1,
          x /
            width
        )
      );


    const ny =
      Math.max(
        0,
        Math.min(
          1,
          y /
            height
        )
      );


    return {
      x,

      y,

      nx,

      ny,

      canvasX:
        x,

      canvasY:
        y,
    };
  }


  /* ==========================================================================
     POINTER MOVE
     ========================================================================== */

  private handlePointerMove(
    event: PointerEvent
  ) {
    if (
      this.destroyed ||
      this.mode ===
        "disabled"
    ) {
      return;
    }


    const point =
      this.getPoint(
        event
      );


    this.state.pointer =
      point;


    this.updateDragging(
      point
    );


    /*
     * Hover remains available while dragging,
     * but click activation is suppressed while dragging.
     */
    this.updateHoveredZones(
      point
    );


    this.emit(
      "pointermove",
      {
        type:
          "pointermove",

        point,
      }
    );
  }


  /* ==========================================================================
     POINTER ENTER
     ========================================================================== */

  private handlePointerEnter(
    event: PointerEvent
  ) {
    if (
      this.destroyed ||
      this.mode ===
        "disabled"
    ) {
      return;
    }


    const point =
      this.getPoint(
        event
      );


    this.state.pointerInside =
      true;


    this.state.pointer =
      point;


    this.updateHoveredZones(
      point
    );


    this.emit(
      "pointerenter",
      {
        type:
          "pointerenter",

        point,
      }
    );
  }


  /* ==========================================================================
     POINTER LEAVE
     ========================================================================== */

  private handlePointerLeave(
    event: PointerEvent
  ) {
    if (
      this.destroyed
    ) {
      return;
    }


    const point =
      this.getPoint(
        event
      );


    this.state.pointerInside =
      false;


    /*
     * If a pointer is captured for drag,
     * don't kill the active interaction here.
     */
    if (
      !this.state.dragging
    ) {
      this.clearHoveredZones();
    }


    this.emit(
      "pointerleave",
      {
        type:
          "pointerleave",

        point,
      }
    );
  }


  /* ==========================================================================
     POINTER DOWN
     ========================================================================== */

  private handlePointerDown(
    event: PointerEvent
  ) {
    if (
      this.destroyed ||
      this.mode ===
        "disabled"
    ) {
      return;
    }


    /*
     * Ignore additional simultaneous pointers.
     *
     * The blackjack table uses a single active pointer for interaction.
     */
    if (
      this.activePointerId !==
        null &&
      this.activePointerId !==
        event.pointerId
    ) {
      return;
    }


    const point =
      this.getPoint(
        event
      );


    const button =
      this.getPointerButton(
        event.button
      );


    this.activePointerId =
      event.pointerId;


    this.state.pointer =
      point;


    this.state.justPressed =
      true;


    this.pointerDownPoint =
      point;


    this.state.dragStart =
      point;


    this.state.dragDistance =
      0;


    this.state.dragging =
      false;


    this.setButtonState(
      button,
      true
    );


    /*
     * Capture pointer so touch / mouse interaction remains
     * stable if the pointer leaves the canvas.
     */
    try {
      this.canvas.setPointerCapture(
        event.pointerId
      );


      this.pointerCaptured =
        true;


      this.capturedPointerId =
        event.pointerId;
    } catch {
      this.pointerCaptured =
        false;


      this.capturedPointerId =
        null;
    }


    const zones =
      this.getZonesAt(
        point
      );


    /*
     * Press the top-most eligible zones.
     */
    for (
      const zone of zones
    ) {
      if (
        zone.enabled ===
        false
      ) {
        continue;
      }


      this.pressedZones.add(
        zone.id
      );


      this.safeZoneCallback(
        () => {
          zone.onDown?.(
            point
          );
        }
      );
    }


    this.emit(
      "pointerdown",
      {
        type:
          "pointerdown",

        point,

        button,
      }
    );
  }


  /* ==========================================================================
     POINTER UP
     ========================================================================== */

  private handlePointerUp(
    event: PointerEvent
  ) {
    if (
      this.destroyed
    ) {
      return;
    }


    /*
     * If this isn't our active pointer,
     * ignore it.
     */
    if (
      this.activePointerId !==
        null &&
      this.activePointerId !==
        event.pointerId
    ) {
      return;
    }


    if (
      this.mode ===
      "disabled"
    ) {
      this.releasePointerCapture(
        event.pointerId
      );


      this.releasePointerState();


      return;
    }


    const point =
      this.getPoint(
        event
      );


    const button =
      this.getPointerButton(
        event.button
      );


    this.state.pointer =
      point;


    this.state.justReleased =
      true;


    this.setButtonState(
      button,
      false
    );


    /*
     * Determine drag state BEFORE releasing it.
     */
    const wasDragging =
      this.state.dragging;


    const zones =
      this.getZonesAt(
        point
      );


    /*
     * Release / click zones.
     */
    for (
      const zone of zones
    ) {
      if (
        zone.enabled ===
        false
      ) {
        continue;
      }


      const wasPressed =
        this.pressedZones.has(
          zone.id
        );


      this.safeZoneCallback(
        () => {
          zone.onUp?.(
            point
          );
        }
      );


      /*
       * Click requires:
       * - same zone received pointer down
       * - pointer released inside
       * - no drag
       * - primary mouse button
       */
      if (
        wasPressed &&
        !wasDragging &&
        event.button ===
          POINTER_ACTION_BUTTON &&
        this.isInsideZone(
          zone,
          point
        )
      ) {
        this.safeZoneCallback(
          () => {
            zone.onClick?.(
              point
            );
          }
        );


        this.emit(
          "click",
          {
            type:
              "click",

            point,

            button,
          }
        );


        this.triggerZoneAction(
          zone
        );
      }
    }


    this.pressedZones.clear();


    this.releasePointerCapture(
      event.pointerId
    );


    this.state.dragging =
      false;


    this.pointerDownPoint =
      null;


    this.activePointerId =
      null;


    this.emit(
      "pointerup",
      {
        type:
          "pointerup",

        point,

        button,
      }
    );
  }


  /* ==========================================================================
     POINTER CANCEL
     ========================================================================== */

  private handlePointerCancel(
    event: PointerEvent
  ) {
    if (
      this.destroyed
    ) {
      return;
    }


    if (
      this.activePointerId !==
        null &&
      this.activePointerId !==
        event.pointerId
    ) {
      return;
    }


    const point =
      this.getPoint(
        event
      );


    this.state.pointer =
      point;


    this.state.justReleased =
      true;


    this.pressedZones.clear();


    this.releasePointerCapture(
      event.pointerId
    );


    this.state.dragging =
      false;


    this.pointerDownPoint =
      null;


    this.activePointerId =
      null;


    this.setButtonState(
      "left",
      false
    );


    this.setButtonState(
      "middle",
      false
    );


    this.setButtonState(
      "right",
      false
    );


    this.emit(
      "pointercancel",
      {
        type:
          "pointercancel",

        point,
      }
    );
  }


  /* ==========================================================================
     DRAG
     ========================================================================== */

  private updateDragging(
    point: InputPoint
  ) {
    const start =
      this.pointerDownPoint;


    if (!start) {
      return;
    }


    const dx =
      point.canvasX -
      start.canvasX;


    const dy =
      point.canvasY -
      start.canvasY;


    const distance =
      Math.sqrt(
        dx * dx +
          dy * dy
      );


    this.state.dragDistance =
      distance;


    if (
      distance >=
      DRAG_THRESHOLD
    ) {
      this.state.dragging =
        true;
    }
  }


  /* ==========================================================================
     BUTTONS
     ========================================================================== */

  private setButtonState(
    button: PointerButton,
    pressed: boolean
  ) {
    switch (
      button
    ) {
      case "left":
        this.state.buttonLeft =
          pressed;
        break;


      case "middle":
        this.state.buttonMiddle =
          pressed;
        break;


      case "right":
        this.state.buttonRight =
          pressed;
        break;
    }
  }


  private getPointerButton(
    button: number
  ): PointerButton {
    switch (
      button
    ) {
      case 1:
        return "middle";


      case 2:
        return "right";


      default:
        return "left";
    }
  }


  private releasePointerCapture(
    pointerId: number
  ) {
    if (
      !this.pointerCaptured
    ) {
      return;
    }


    if (
      this.capturedPointerId !==
      pointerId
    ) {
      return;
    }


    try {
      if (
        this.canvas.hasPointerCapture(
          pointerId
        )
      ) {
        this.canvas.releasePointerCapture(
          pointerId
        );
      }
    } catch {
      /*
       * Pointer may already be released.
       */
    }


    this.pointerCaptured =
      false;


    this.capturedPointerId =
      null;
  }


  private releasePointerState() {
    this.pressedZones.clear();


    this.state.dragging =
      false;


    this.pointerDownPoint =
      null;


    this.activePointerId =
      null;


    this.pointerCaptured =
      false;


    this.capturedPointerId =
      null;


    this.setButtonState(
      "left",
      false
    );


    this.setButtonState(
      "middle",
      false
    );


    this.setButtonState(
      "right",
      false
    );
  }


  private releaseAllInput() {
    if (
      this.destroyed
    ) {
      return;
    }


    /*
     * Keyboard.
     */
    this.state.keys.clear();


    /*
     * Pointer.
     */
    this.releasePointerState();


    /*
     * Treat focus loss as a release transition.
     */
    this.state.justReleased =
      true;


    /*
     * Hover is no longer meaningful after focus loss.
     */
    this.clearHoveredZones();
  }


  /* ==========================================================================
     WHEEL
     ========================================================================== */

  private handleWheel(
    event: WheelEvent
  ) {
    if (
      this.destroyed ||
      this.mode ===
        "disabled"
    ) {
      return;
    }


    /*
     * The table owns wheel interaction.
     */
    event.preventDefault();


    this.state.wheelX =
      event.deltaX;


    this.state.wheelY =
      event.deltaY;


    this.emit(
      "wheel",
      {
        type:
          "wheel",

        deltaX:
          event.deltaX,

        deltaY:
          event.deltaY,
      }
    );
  }


  /* ==========================================================================
     KEYBOARD
     ========================================================================== */

  private handleKeyDown(
    event: KeyboardEvent
  ) {
    if (
      this.destroyed ||
      this.mode ===
        "disabled"
    ) {
      return;
    }


    const key =
      this.normalizeKey(
        event.key
      );


    /*
     * Ignore browser modifier combinations.
     */
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) {
      return;
    }


    /*
     * Store held-key state.
     *
     * We still emit repeated browser keydown events only once from
     * the key state perspective.
     */
    const wasAlreadyDown =
      this.state.keys.has(
        key
      );


    if (
      !wasAlreadyDown
    ) {
      this.state.keys.add(
        key
      );
    }


    this.emit(
      "keydown",
      {
        type:
          "keydown",

        key,
      }
    );


    /*
     * IMPORTANT:
     *
     * We deliberately do NOT call triggerAction() here.
     *
     * Game.ts currently owns keyboard gameplay routing.
     *
     * This prevents:
     *
     * Input.ts -> H -> HIT
     * Game.ts  -> H -> HIT
     *
     * from executing twice.
     */
  }


  /* ==========================================================================
     KEY UP
     ========================================================================== */

  private handleKeyUp(
    event: KeyboardEvent
  ) {
    if (
      this.destroyed
    ) {
      return;
    }


    const key =
      this.normalizeKey(
        event.key
      );


    this.state.keys.delete(
      key
    );


    this.emit(
      "keyup",
      {
        type:
          "keyup",

        key,
      }
    );
  }


  /* ==========================================================================
     KEY NORMALIZATION
     ========================================================================== */

  private normalizeKey(
    key: string
  ) {
    const normalized =
      key.toLowerCase();


    switch (
      normalized
    ) {
      case " ":
        return "space";


      case "arrowup":
        return "up";


      case "arrowdown":
        return "down";


      case "arrowleft":
        return "left";


      case "arrowright":
        return "right";


      case "escape":
        return "escape";


      case "enter":
        return "enter";


      default:
        return normalized;
    }
  }


  /* ==========================================================================
     KEY → ACTION
     --------------------------------------------------------------------------
     This helper remains available to the rest of the app, but keyboard
     events do not automatically execute it inside Input.ts.
     ========================================================================== */

  keyToAction(
    key: string
  ): InputAction | null {
    switch (
      this.normalizeKey(
        key
      )
    ) {
      case "space":
      case "enter":
        return "deal";


      case "h":
        return "hit";


      case "s":
        return "stand";


      case "d":
        return "double";


      case "p":
        return "split";


      case "i":
        return "insurance";


      case "n":
        return "decline-insurance";


      case "r":
        return "surrender";


      case "+":
      case "=":
      case "up":
        return "increase-bet";


      case "-":
      case "_":
      case "down":
        return "decrease-bet";


      case "escape":
        return "escape";


      default:
        return null;
    }
  }


  /* ==========================================================================
     ACTION TRIGGER
     ========================================================================== */

  triggerAction(
    action: InputAction
  ) {
    if (
      this.destroyed ||
      this.mode ===
        "disabled"
    ) {
      return;
    }


    /*
     * Emit through the input event system.
     */
    this.emit(
      "click",
      {
        type:
          "click",

        action,
      }
    );


    /*
     * Browser-level bridge.
     *
     * Game.ts / HUD may consume this event.
     *
     * Existing project code expects "blackjack:action".
     */
    if (
      typeof window !==
      "undefined"
    ) {
      window.dispatchEvent(
        new CustomEvent(
          "blackjack:action",
          {
            detail: {
              action,
            },
          }
        )
      );
    }
  }


  /* ==========================================================================
     ZONE SYSTEM
     ========================================================================== */

  addZone(
    zone: InputZone
  ) {
    if (
      this.destroyed
    ) {
      return;
    }


    const existing =
      this.zones.find(
        (
          item
        ) =>
          item.id ===
          zone.id
      );


    if (
      existing
    ) {
      Object.assign(
        existing,
        zone
      );


      /*
       * If the zone was disabled while hovered,
       * clean its hover state.
       */
      if (
        zone.enabled ===
        false
      ) {
        if (
          this.hoveredZones.has(
            zone.id
          )
        ) {
          this.safeZoneCallback(
            () => {
              zone.onLeave?.();
            }
          );
        }


        this.hoveredZones.delete(
          zone.id
        );
      }


      return;
    }


    this.zones.push(
      {
        ...zone,
      }
    );
  }


  removeZone(
    id: string
  ) {
    if (
      this.destroyed
    ) {
      return;
    }


    const zone =
      this.getZone(
        id
      );


    if (
      zone &&
      this.hoveredZones.has(
        id
      )
    ) {
      this.safeZoneCallback(
        () => {
          zone.onLeave?.();
        }
      );
    }


    const index =
      this.zones.findIndex(
        (
          item
        ) =>
          item.id ===
          id
      );


    if (
      index ===
      -1
    ) {
      return;
    }


    this.zones.splice(
      index,
      1
    );


    this.hoveredZones.delete(
      id
    );


    this.pressedZones.delete(
      id
    );
  }


  clearZones() {
    if (
      this.destroyed
    ) {
      return;
    }


    this.clearHoveredZones();


    this.pressedZones.clear();


    this.zones.length =
      0;
  }


  updateZone(
    id: string,
    patch: Partial<InputZone>
  ) {
    if (
      this.destroyed
    ) {
      return;
    }


    const zone =
      this.zones.find(
        (
          item
        ) =>
          item.id ===
          id
      );


    if (!zone) {
      return;
    }


    Object.assign(
      zone,
      patch
    );


    if (
      zone.enabled ===
      false
    ) {
      this.hoveredZones.delete(
        id
      );


      this.pressedZones.delete(
        id
      );
    }
  }


  getZone(
    id: string
  ) {
    return this.zones.find(
      (
        zone
      ) =>
        zone.id ===
        id
    );
  }


  getZones() {
    return [
      ...this.zones,
    ];
  }


  /* ==========================================================================
     ZONE HIT TEST
     ========================================================================== */

  private getZonesAt(
    point: InputPoint
  ) {
    /*
     * Reverse order means last-added zones sit visually above earlier zones.
     */
    return [
      ...this.zones,
    ]
      .reverse()
      .filter(
        (
          zone
        ) =>
          zone.enabled !==
            false &&
          this.isInsideZone(
            zone,
            point
          )
      );
  }


  private isInsideZone(
    zone: InputZone,
    point: InputPoint
  ) {
    return (
      point.canvasX >=
        zone.x &&
      point.canvasX <=
        zone.x +
          zone.width &&
      point.canvasY >=
        zone.y &&
      point.canvasY <=
        zone.y +
          zone.height
    );
  }


  /* ==========================================================================
     HOVER
     ========================================================================== */

  private updateHoveredZones(
    point: InputPoint
  ) {
    if (
      this.mode ===
      "disabled"
    ) {
      return;
    }


    const current =
      new Set(
        this.getZonesAt(
          point
        ).map(
          (
            zone
          ) =>
            zone.id
        )
      );


    /*
     * LEAVE
     */
    for (
      const id of [
        ...this.hoveredZones,
      ]
    ) {
      if (
        !current.has(
          id
        )
      ) {
        const zone =
          this.getZone(
            id
          );


        this.safeZoneCallback(
          () => {
            zone?.onLeave?.();
          }
        );


        this.hoveredZones.delete(
          id
        );
      }
    }


    /*
     * ENTER
     */
    for (
      const id of current
    ) {
      if (
        !this.hoveredZones.has(
          id
        )
      ) {
        const zone =
          this.getZone(
            id
          );


        this.safeZoneCallback(
          () => {
            zone?.onEnter?.();
          }
        );


        this.hoveredZones.add(
          id
        );
      }
    }


    /*
     * Cursor follows the highest priority zone.
     */
    const topZone =
      this.getZonesAt(
        point
      )[0];


    this.canvas.style.cursor =
      topZone?.cursor ??
      DEFAULT_CURSOR;
  }


  private clearHoveredZones() {
    for (
      const id of [
        ...this.hoveredZones,
      ]
    ) {
      const zone =
        this.getZone(
          id
        );


      this.safeZoneCallback(
        () => {
          zone?.onLeave?.();
        }
      );
    }


    this.hoveredZones.clear();


    this.canvas.style.cursor =
      DEFAULT_CURSOR;
  }


  /* ==========================================================================
     ZONE ACTION
     ========================================================================== */

  private triggerZoneAction(
    zone: InputZone
  ) {
    if (
      !zone.action
    ) {
      return;
    }


    this.triggerAction(
      zone.action
    );
  }


  /* ==========================================================================
     UI BRIDGE
     ========================================================================== */

  bindElement(
    element:
      | HTMLElement
      | null,
    action: InputAction
  ) {
    if (
      !element ||
      this.destroyed
    ) {
      return () => {};
    }


    const handler =
      (
        event: Event
      ) => {
        /*
         * Buttons / UI controls should not accidentally submit
         * a form while acting as game controls.
         */
        if (
          element instanceof
            HTMLButtonElement &&
          element.type !==
            "button"
        ) {
          event.preventDefault();
        }


        this.triggerAction(
          action
        );
      };


    element.addEventListener(
      "click",
      handler
    );


    return () => {
      element.removeEventListener(
        "click",
        handler
      );
    };
  }


  bindAction(
    element:
      | HTMLElement
      | null,
    action: InputAction
  ) {
    return this.bindElement(
      element,
      action
    );
  }


  /* ==========================================================================
     EVENT LISTENERS
     ========================================================================== */

  on(
    type: InputEvent["type"],
    callback: InputListener
  ) {
    if (
      this.destroyed
    ) {
      return () => {};
    }


    let set =
      this.listeners.get(
        type
      );


    if (!set) {
      set =
        new Set();


      this.listeners.set(
        type,
        set
      );
    }


    set.add(
      callback
    );


    return () => {
      set?.delete(
        callback
      );
    };
  }


  off(
    type: InputEvent["type"],
    callback: InputListener
  ) {
    this.listeners
      .get(
        type
      )
      ?.delete(
        callback
      );
  }


  private emit(
    type: InputEvent["type"],
    event: InputEvent
  ) {
    const listeners =
      this.listeners.get(
        type
      );


    if (!listeners) {
      return;
    }


    /*
     * Copy first so listeners may unsubscribe themselves
     * while processing the event.
     */
    for (
      const listener of [
        ...listeners,
      ]
    ) {
      try {
        listener(
          event
        );
      } catch {
        /*
         * One broken listener should never break the input system.
         */
      }
    }
  }


  /* ==========================================================================
     FRAME UPDATE
     ========================================================================== */

  update() {
    if (
      this.destroyed
    ) {
      return;
    }


    /*
     * These fields are intentionally one-frame state.
     */
    this.state.justPressed =
      false;


    this.state.justReleased =
      false;


    this.state.wheelX =
      0;


    this.state.wheelY =
      0;
  }


  /* ==========================================================================
     MODE
     ========================================================================== */

  setMode(
    mode: InputMode
  ) {
    if (
      this.destroyed
    ) {
      return;
    }


    this.mode =
      mode;


    this.state.mode =
      mode;


    if (
      mode ===
      "disabled"
    ) {
      this.clearHoveredZones();


      this.pressedZones.clear();


      this.pointerDownPoint =
        null;


      this.activePointerId =
        null;


      this.state.dragging =
        false;


      this.setButtonState(
        "left",
        false
      );


      this.setButtonState(
        "middle",
        false
      );


      this.setButtonState(
        "right",
        false
      );
    }
  }


  enable() {
    this.setMode(
      "game"
    );
  }


  disable() {
    this.setMode(
      "disabled"
    );
  }


  useUI() {
    this.setMode(
      "ui"
    );
  }


  /* ==========================================================================
     STATE HELPERS
     ========================================================================== */

  isKeyDown(
    key: string
  ) {
    return this.state.keys.has(
      this.normalizeKey(
        key
      )
    );
  }


  isButtonDown(
    button: PointerButton
  ) {
    switch (
      button
    ) {
      case "left":
        return this.state.buttonLeft;


      case "middle":
        return this.state.buttonMiddle;


      case "right":
        return this.state.buttonRight;
    }
  }


  getPointer() {
    return {
      ...this.state.pointer,
    };
  }


  getPointerNormalized() {
    return {
      x:
        this.state.pointer.nx,

      y:
        this.state.pointer.ny,
    };
  }


  isDragging() {
    return this.state.dragging;
  }


  getDragDistance() {
    return this.state.dragDistance;
  }


  /* ==========================================================================
     COORDINATE UTILITIES
     ========================================================================== */

  screenToCanvas(
    x: number,
    y: number
  ): InputPoint {
    const rect =
      this.canvas.getBoundingClientRect();


    const canvasWidth =
      Math.max(
        rect.width,
        1
      );


    const canvasHeight =
      Math.max(
        rect.height,
        1
      );


    const canvasX =
      x -
      rect.left;


    const canvasY =
      y -
      rect.top;


    return {
      x:
        canvasX,

      y:
        canvasY,

      nx:
        Math.max(
          0,
          Math.min(
            1,
            canvasX /
              canvasWidth
          )
        ),

      ny:
        Math.max(
          0,
          Math.min(
            1,
            canvasY /
              canvasHeight
          )
        ),

      canvasX,

      canvasY,
    };
  }


  normalizedToCanvas(
    nx: number,
    ny: number
  ): VecLike {
    const rect =
      this.canvas.getBoundingClientRect();


    const safeX =
      Number.isFinite(
        nx
      )
        ? nx
        : 0;


    const safeY =
      Number.isFinite(
        ny
      )
        ? ny
        : 0;


    return {
      x:
        safeX *
        rect.width,

      y:
        safeY *
        rect.height,
    };
  }


  /* ==========================================================================
     DEBUG
     ========================================================================== */

  getDebugState() {
    return {
      mode:
        this.state.mode,

      pointer:
        {
          ...this.state.pointer,
        },

      pointerInside:
        this.state.pointerInside,

      buttonLeft:
        this.state.buttonLeft,

      buttonMiddle:
        this.state.buttonMiddle,

      buttonRight:
        this.state.buttonRight,

      justPressed:
        this.state.justPressed,

      justReleased:
        this.state.justReleased,

      dragging:
        this.state.dragging,

      dragDistance:
        this.state.dragDistance,

      wheelX:
        this.state.wheelX,

      wheelY:
        this.state.wheelY,

      keys:
        [
          ...this.state.keys,
        ],

      zones:
        this.zones.length,

      hoveredZones:
        [
          ...this.hoveredZones,
        ],

      pressedZones:
        [
          ...this.pressedZones,
        ],

      activePointerId:
        this.activePointerId,

      pointerCaptured:
        this.pointerCaptured,

      destroyed:
        this.destroyed,
    };
  }


  /* ==========================================================================
     SAFE ZONE CALLBACK
     ========================================================================== */

  private safeZoneCallback(
    callback: () => void
  ) {
    try {
      callback();
    } catch {
      /*
       * A zone callback belongs to application/UI code.
       * It must never crash the input infrastructure.
       */
    }
  }


  /* ==========================================================================
     CLEANUP
     ========================================================================== */

  destroy() {
    if (
      this.destroyed
    ) {
      return;
    }


    this.destroyed =
      true;


    /*
     * Stop all browser events.
     */
    this.unbindEvents();


    /*
     * Release pointer capture if possible.
     */
    if (
      this.capturedPointerId !==
      null
    ) {
      try {
        if (
          this.canvas.hasPointerCapture(
            this.capturedPointerId
          )
        ) {
          this.canvas.releasePointerCapture(
            this.capturedPointerId
          );
        }
      } catch {
        /* Pointer capture may already be gone. */
      }
    }


    this.clearHoveredZones();


    this.zones.length =
      0;


    this.pressedZones.clear();


    this.listeners.clear();


    this.state.keys.clear();


    this.state.buttonLeft =
      false;


    this.state.buttonMiddle =
      false;


    this.state.buttonRight =
      false;


    this.state.dragging =
      false;


    this.state.justPressed =
      false;


    this.state.justReleased =
      false;


    this.pointerDownPoint =
      null;


    this.activePointerId =
      null;


    this.capturedPointerId =
      null;


    this.pointerCaptured =
      false;


    this.canvas.style.cursor =
      DEFAULT_CURSOR;
  }
}


/* ==========================================================================
   SMALL VECTOR TYPE
   ========================================================================== */

type VecLike = {
  x: number;
  y: number;
};