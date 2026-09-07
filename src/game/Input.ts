/* ==========================================================================
   BLACKJACK 21 — INPUT SYSTEM
   --------------------------------------------------------------------------
   Handles:
   - Mouse
   - Pointer
   - Touch
   - Keyboard
   - Click / press / release
   - Hover
   - Drag
   - Wheel
   - Normalized coordinates
   - Input zones
   - UI/game event bridge

   Design goal:
   One clean input layer for the whole casino table.
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

export type InputAction =
  | "hit"
  | "stand"
  | "double"
  | "split"
  | "bet-increase"
  | "bet-decrease"
  | "escape"
  | "confirm"
  | "cancel";

export type InputPoint = {
  x: number;
  y: number;

  /*
   * Normalized coordinates.
   * 0 = left/top
   * 1 = right/bottom
   */
  nx: number;
  ny: number;

  /*
   * Coordinates relative to internal canvas.
   */
  canvasX: number;
  canvasY: number;
};

export type InputZone = {
  id: string;

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
    | "click"
    | "wheel"
    | "keydown"
    | "keyup";

  point?: InputPoint;

  button?: PointerButton;

  key?: string;

  deltaX?: number;
  deltaY?: number;
};

/* ==========================================================================
   CONSTANTS
   ========================================================================== */

const DRAG_THRESHOLD = 4;

const DEFAULT_CURSOR =
  "default";

/* ==========================================================================
   INPUT CLASS
   ========================================================================== */

export class Input {
  readonly canvas: HTMLCanvasElement;

  mode: InputMode =
    "game";

  readonly state: InputState;

  private zones: InputZone[] = [];

  private hoveredZones =
    new Set<string>();

  private pressedZones =
    new Set<string>();

  private listeners =
    new Map<
      InputEvent["type"],
      Set<
        (
          event: InputEvent
        ) => void
      >
    >();

  private destroyed =
    false;

  private pointerDownPoint:
    InputPoint | null =
    null;

  private lastPointerPoint:
    InputPoint | null =
    null;

  private pointerCaptured =
    false;

  private touchActive =
    false;

  /* ------------------------------------------------------------------------
     Bound handlers
     ------------------------------------------------------------------------ */

  private boundPointerMove =
    (event: PointerEvent) =>
      this.handlePointerMove(
        event
      );

  private boundPointerDown =
    (event: PointerEvent) =>
      this.handlePointerDown(
        event
      );

  private boundPointerUp =
    (event: PointerEvent) =>
      this.handlePointerUp(
        event
      );

  private boundPointerEnter =
    (event: PointerEvent) =>
      this.handlePointerEnter(
        event
      );

  private boundPointerLeave =
    (event: PointerEvent) =>
      this.handlePointerLeave(
        event
      );

  private boundWheel =
    (event: WheelEvent) =>
      this.handleWheel(
        event
      );

  private boundKeyDown =
    (event: KeyboardEvent) =>
      this.handleKeyDown(
        event
      );

  private boundKeyUp =
    (event: KeyboardEvent) =>
      this.handleKeyUp(
        event
      );

  /* ==========================================================================
     CONSTRUCTOR
     ========================================================================== */

  constructor(
    canvas: HTMLCanvasElement
  ) {
    this.canvas = canvas;

    this.state = {
      mode: this.mode,

      pointer: {
        x: 0,
        y: 0,

        nx: 0,
        ny: 0,

        canvasX: 0,
        canvasY: 0,
      },

      pointerInside:
        false,

      buttonLeft: false,
      buttonMiddle: false,
      buttonRight: false,

      justPressed: false,
      justReleased: false,

      wheelX: 0,
      wheelY: 0,

      dragging: false,

      dragStart: {
        x: 0,
        y: 0,

        nx: 0,
        ny: 0,

        canvasX: 0,
        canvasY: 0,
      },

      dragDistance: 0,

      keys: new Set<string>(),
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

    this.canvas.setAttribute(
      "tabindex",
      "0"
    );
  }

  /* ==========================================================================
     EVENT BINDING
     ========================================================================== */

  private bindEvents() {
    this.canvas.addEventListener(
      "pointermove",
      this.boundPointerMove,
      { passive: true }
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
      "pointerenter",
      this.boundPointerEnter,
      { passive: true }
    );

    this.canvas.addEventListener(
      "pointerleave",
      this.boundPointerLeave,
      { passive: true }
    );

    this.canvas.addEventListener(
      "wheel",
      this.boundWheel,
      {
        passive: false,
      }
    );

    /*
     * Keyboard is attached to window so
     * shortcuts still work after pointer
     * interaction.
     */
    window.addEventListener(
      "keydown",
      this.boundKeyDown
    );

    window.addEventListener(
      "keyup",
      this.boundKeyUp
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

    return {
      x,

      y,

      nx:
        x / width,

      ny:
        y / height,

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

    this.lastPointerPoint =
      point;
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
     * If we are not dragging,
     * release hover states.
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
     * Pointer capture keeps receiving
     * pointer events while dragging.
     */
    try {
      this.canvas.setPointerCapture(
        event.pointerId
      );

      this.pointerCaptured =
        true;
    } catch {
      this.pointerCaptured =
        false;
    }

    /*
     * Mark zones under pointer.
     */
    const zones =
      this.getZonesAt(
        point
      );

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

      zone.onDown?.(
        point
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
     * Finish drag if active.
     */
    if (
      this.state.dragging
    ) {
      this.state.dragging =
        false;
    }

    const zones =
      this.getZonesAt(
        point
      );

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

      zone.onUp?.(
        point
      );

      /*
       * A click is only produced if
       * the same zone received down
       * and up.
       */
      if (
        wasPressed &&
        this.isInsideZone(
          zone,
          point
        ) &&
        !this.state.dragging
      ) {
        zone.onClick?.(
          point
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

    if (
      this.pointerCaptured
    ) {
      try {
        this.canvas.releasePointerCapture(
          event.pointerId
        );
      } catch {
        /* Pointer may already be released. */
      }

      this.pointerCaptured =
        false;
    }

    this.emit(
      "pointerup",
      {
        type:
          "pointerup",

        point,

        button,
      }
    );

    this.pointerDownPoint =
      null;
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
    switch (button) {
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
    switch (button) {
      case 1:
        return "middle";

      case 2:
        return "right";

      default:
        return "left";
    }
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
     * Prevent page scroll while interacting
     * with the game.
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

    /*
     * Normalize common keyboard values.
     */
    const key =
      this.normalizeKey(
        event.key
      );

    /*
     * Ignore key repeat for actions.
     * Holding H should not fire HIT repeatedly.
     */
    if (
      event.repeat
    ) {
      return;
    }

    this.state.keys.add(
      key
    );

    this.emit(
      "keydown",
      {
        type:
          "keydown",

        key,
      }
    );

    const action =
      this.keyToAction(
        key
      );

    if (
      action
    ) {
      this.triggerAction(
        action
      );
    }
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
     ========================================================================== */

  private keyToAction(
    key: string
  ): InputAction | null {
    switch (key) {
      case "h":
        return "hit";

      case "s":
        return "stand";

      case "d":
        return "double";

      case "p":
        return "split";

      case "+":
      case "=":
      case "up":
        return "bet-increase";

      case "-":
      case "_":
      case "down":
        return "bet-decrease";

      case "enter":
        return "confirm";

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
      this.mode ===
      "disabled"
    ) {
      return;
    }

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

  /* ==========================================================================
     ZONE SYSTEM
     ========================================================================== */

  addZone(
    zone: InputZone
  ) {
    const existing =
      this.zones.find(
        (item) =>
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

      return;
    }

    this.zones.push(
      zone
    );
  }

  removeZone(
    id: string
  ) {
    const index =
      this.zones.findIndex(
        (zone) =>
          zone.id ===
          id
      );

    if (
      index === -1
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
    this.clearHoveredZones();

    this.pressedZones.clear();

    this.zones.length =
      0;
  }

  updateZone(
    id: string,
    patch: Partial<InputZone>
  ) {
    const zone =
      this.zones.find(
        (item) =>
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
  }

  getZone(
    id: string
  ) {
    return this.zones.find(
      (zone) =>
        zone.id ===
        id
    );
  }

  private getZonesAt(
    point: InputPoint
  ) {
    /*
     * Reverse order means newer zones
     * behave visually like top-most layers.
     */
    return [
      ...this.zones,
    ]
      .reverse()
      .filter(
        (zone) =>
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
    const current =
      new Set(
        this.getZonesAt(
          point
        ).map(
          (zone) =>
            zone.id
        )
      );

    /*
     * Left.
     */
    for (
      const id of this
        .hoveredZones
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

        zone?.onLeave?.();

        this.hoveredZones.delete(
          id
        );
      }
    }

    /*
     * Enter.
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

        zone?.onEnter?.();

        this.hoveredZones.add(
          id
        );
      }
    }

    /*
     * Cursor.
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
      const id of this
        .hoveredZones
    ) {
      const zone =
        this.getZone(
          id
        );

      zone?.onLeave?.();
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
    if (!element) {
      return () => {};
    }

    const handler =
      () => {
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
    callback: (
      event: InputEvent
    ) => void
  ) {
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
    callback: (
      event: InputEvent
    ) => void
  ) {
    this.listeners
      .get(type)
      ?.delete(callback);
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

    for (
      const listener of
        listeners
    ) {
      listener(event);
    }
  }

  /* ==========================================================================
     FRAME RESET
     ========================================================================== */

  update() {
    /*
     * justPressed / justReleased should
     * only live for one frame.
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

      this.state.dragging =
        false;
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
    button:
      | PointerButton
  ) {
    switch (button) {
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
        canvasX /
        canvasWidth,

      ny:
        canvasY /
        canvasHeight,

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

    return {
      x:
        nx *
        rect.width,

      y:
        ny *
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
        this.state.pointer,

      pointerInside:
        this.state.pointerInside,

      buttonLeft:
        this.state.buttonLeft,

      buttonMiddle:
        this.state.buttonMiddle,

      buttonRight:
        this.state.buttonRight,

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
    };
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

    this.unbindEvents();

    this.clearZones();

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

    this.pointerDownPoint =
      null;

    this.lastPointerPoint =
      null;
  }
}

/* ==========================================================================
   SMALL VECTOR TYPE
   ========================================================================== */

type VecLike = {
  x: number;
  y: number;
};