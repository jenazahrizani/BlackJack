/* ==========================================================================
   BLACKJACK 21 — ANIMATION SYSTEM
   --------------------------------------------------------------------------
   Visual-first animation system.

   Designed for:
   - Dealer breathing
   - Dealer head movement
   - Dealer arm / hand motion
   - Card dealing
   - Card flip
   - Card placement
   - Chip placement
   - Chip sliding
   - Chip collection
   - Player idle motion
   - Camera push
   - Smooth cinematic transitions

   Philosophy:
   - Small movement
   - Controlled timing
   - No exaggerated UI motion
   - Physical-feeling easing
   - Deterministic motion where possible
   ========================================================================== */

import {
  clamp,
  easeInOutCubic,
  easeOutCubic,
  lerp,
  lerpVec2,
  type AnimationName,
  type AnimationTrack,
  type Dealer,
  type Player,
  type Vec2,
  type Card,
  type Chip,
} from "./Entities";

/* ==========================================================================
   TYPES
   ========================================================================== */

export type AnimationCallback = () => void;

export type AnimationOptions = {
  duration?: number;
  delay?: number;
  loop?: boolean;
  reverse?: boolean;

  onStart?: AnimationCallback;
  onUpdate?: AnimationCallback;
  onComplete?: AnimationCallback;
};

export type TimelineStep = {
  name: AnimationName;

  duration: number;

  delay?: number;

  run?: (
    progress: number
  ) => void;
};

type ActiveAnimation = {
  track: AnimationTrack;

  options: AnimationOptions;

  callbackStarted: boolean;

  callbackCompleted: boolean;
};

type Vec2Animation = {
  from: Vec2;

  to: Vec2;

  duration: number;

  elapsed: number;

  easing:
    | "linear"
    | "smooth"
    | "out"
    | "in-out";

  onUpdate?: (
    value: Vec2,
    progress: number
  ) => void;

  onComplete?: AnimationCallback;

  finished: boolean;
};

type NumberAnimation = {
  from: number;

  to: number;

  duration: number;

  elapsed: number;

  easing:
    | "linear"
    | "smooth"
    | "out"
    | "in-out";

  onUpdate?: (
    value: number,
    progress: number
  ) => void;

  onComplete?: AnimationCallback;

  finished: boolean;
};

type DealerMotionOptions = {
  duration?: number;

  hand?: "left" | "right" | "both";

  intensity?: number;
};

type CardMotionOptions = {
  duration?: number;

  delay?: number;

  rotation?: number;

  arc?: number;

  flip?: boolean;
};

type ChipMotionOptions = {
  duration?: number;

  rotation?: number;

  bounce?: number;
};

/* ==========================================================================
   CONSTANTS
   ========================================================================== */

const DEFAULT_DURATION = 0.35;

const MAX_DELTA = 0.05;

const EPSILON = 0.00001;

/*
 * The game should feel elegant.
 *
 * These are deliberately restrained.
 */
const MOTION = {
  dealerBreathing: 0.85,

  dealerHead: 0.55,

  dealerReach: 0.42,

  dealerDeal: 0.44,

  dealerReveal: 0.38,

  cardDeal: 0.46,

  cardFlip: 0.30,

  cardPlace: 0.22,

  chipPlace: 0.32,

  chipSlide: 0.40,

  chipCollect: 0.42,

  playerIdle: 1.25,

  cameraPush: 0.52,
};

/* ==========================================================================
   MAIN ANIMATION CLASS
   ========================================================================== */

export class Animation {
  /* ------------------------------------------------------------------------
     CLOCK
     ------------------------------------------------------------------------ */

  time = 0;

  delta = 0;

  frame = 0;

  /* ------------------------------------------------------------------------
     ACTIVE GENERIC ANIMATIONS
     ------------------------------------------------------------------------ */

  private tracks =
    new Map<
      string,
      ActiveAnimation
    >();

  /* ------------------------------------------------------------------------
     DIRECT VECTOR / NUMBER ANIMATIONS
     ------------------------------------------------------------------------ */

  private vectorAnimations: Vec2Animation[] = [];

  private numberAnimations: NumberAnimation[] = [];

  /* ------------------------------------------------------------------------
     TIMELINES
     ------------------------------------------------------------------------ */

  private timelines:
    Array<{
      steps: TimelineStep[];

      currentStep: number;

      elapsed: number;

      started: boolean;

      finished: boolean;

      onComplete?: AnimationCallback;
    }> = [];

  /* ------------------------------------------------------------------------
     RANDOM / IDLE
     ------------------------------------------------------------------------ */

  private idleSeeds =
    new Map<
      string,
      number
    >();

  /* ------------------------------------------------------------------------
     UPDATE
     ------------------------------------------------------------------------ */

  update(
    delta: number
  ) {
    this.delta =
      Math.min(
        Math.max(delta, 0),
        MAX_DELTA
      );

    this.time +=
      this.delta;

    this.frame += 1;

    this.updateTracks();

    this.updateVectorAnimations();

    this.updateNumberAnimations();

    this.updateTimelines();
  }

  /* ==========================================================================
     GENERIC TRACK SYSTEM
     ========================================================================== */

  play(
    name: AnimationName,
    options: AnimationOptions = {}
  ): string {
    const id =
      `${name}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

    const duration =
      Math.max(
        EPSILON,
        options.duration ??
          DEFAULT_DURATION
      );

    const track: AnimationTrack = {
      id,

      name,

      startTime:
        this.time,

      duration,

      progress: 0,

      delay:
        Math.max(
          0,
          options.delay ?? 0
        ),

      playing: true,

      finished: false,

      loop:
        options.loop ?? false,

      reverse:
        options.reverse ?? false,
    };

    this.tracks.set(
      id,
      {
        track,

        options,

        callbackStarted:
          false,

        callbackCompleted:
          false,
      }
    );

    return id;
  }

  stop(
    id: string
  ) {
    const animation =
      this.tracks.get(id);

    if (!animation) {
      return;
    }

    animation.track.playing =
      false;

    animation.track.finished =
      true;

    this.tracks.delete(id);
  }

  stopByName(
    name: AnimationName
  ) {
    for (
      const [
        id,
        animation
      ] of this.tracks
    ) {
      if (
        animation.track.name ===
        name
      ) {
        this.stop(id);
      }
    }
  }

  isPlaying(
    name: AnimationName
  ) {
    for (
      const animation of
        this.tracks.values()
    ) {
      if (
        animation.track.name ===
          name &&
        animation.track.playing
      ) {
        return true;
      }
    }

    return false;
  }

  private updateTracks() {
    for (
      const [
        id,
        animation
      ] of this.tracks
    ) {
      const track =
        animation.track;

      if (!track.playing) {
        continue;
      }

      const elapsed =
        this.time -
        track.startTime -
        track.delay;

      if (
        elapsed < 0
      ) {
        continue;
      }

      if (
        !animation.callbackStarted
      ) {
        animation.callbackStarted =
          true;

        animation.options.onStart?.();
      }

      let progress =
        elapsed /
        Math.max(
          track.duration,
          EPSILON
        );

      progress =
        clamp(
          progress,
          0,
          1
        );

      if (
        track.reverse
      ) {
        progress =
          1 - progress;
      }

      track.progress =
        progress;

      animation.options
        .onUpdate?.();

      if (
        progress >=
          1 &&
        !track.loop
      ) {
        track.playing =
          false;

        track.finished =
          true;

        if (
          !animation.callbackCompleted
        ) {
          animation.callbackCompleted =
            true;

          animation.options
            .onComplete?.();
        }

        this.tracks.delete(id);

        continue;
      }

      if (
        track.loop &&
        elapsed >=
          track.duration
      ) {
        track.startTime =
          this.time;

        track.progress =
          0;
      }
    }
  }

  /* ==========================================================================
     VECTOR ANIMATION
     ========================================================================== */

  move(
    from: Vec2,
    to: Vec2,
    options: {
      duration?: number;
      easing?:
        | "linear"
        | "smooth"
        | "out"
        | "in-out";
      onUpdate?: (
        value: Vec2,
        progress: number
      ) => void;
      onComplete?: AnimationCallback;
    } = {}
  ) {
    this.vectorAnimations.push(
      {
        from: {
          x: from.x,
          y: from.y,
        },

        to: {
          x: to.x,
          y: to.y,
        },

        duration:
          Math.max(
            EPSILON,
            options.duration ??
              DEFAULT_DURATION
          ),

        elapsed: 0,

        easing:
          options.easing ??
          "out",

        onUpdate:
          options.onUpdate,

        onComplete:
          options.onComplete,

        finished: false,
      }
    );
  }

  private updateVectorAnimations() {
    for (
      let i =
        this.vectorAnimations.length -
        1;
      i >= 0;
      i--
    ) {
      const animation =
        this.vectorAnimations[i];

      animation.elapsed +=
        this.delta;

      let t =
        animation.elapsed /
        animation.duration;

      t =
        clamp(
          t,
          0,
          1
        );

      const eased =
        this.applyEasing(
          t,
          animation.easing
        );

      const value =
        lerpVec2(
          animation.from,
          animation.to,
          eased
        );

      animation.onUpdate?.(
        value,
        t
      );

      if (
        t >= 1
      ) {
        animation.finished =
          true;

        animation.onComplete?.();

        this.vectorAnimations.splice(
          i,
          1
        );
      }
    }
  }

  /* ==========================================================================
     NUMBER ANIMATION
     ========================================================================== */

  tween(
    from: number,
    to: number,
    options: {
      duration?: number;
      easing?:
        | "linear"
        | "smooth"
        | "out"
        | "in-out";
      onUpdate?: (
        value: number,
        progress: number
      ) => void;
      onComplete?: AnimationCallback;
    } = {}
  ) {
    this.numberAnimations.push(
      {
        from,

        to,

        duration:
          Math.max(
            EPSILON,
            options.duration ??
              DEFAULT_DURATION
          ),

        elapsed: 0,

        easing:
          options.easing ??
          "out",

        onUpdate:
          options.onUpdate,

        onComplete:
          options.onComplete,

        finished: false,
      }
    );
  }

  private updateNumberAnimations() {
    for (
      let i =
        this.numberAnimations.length -
        1;
      i >= 0;
      i--
    ) {
      const animation =
        this.numberAnimations[i];

      animation.elapsed +=
        this.delta;

      let t =
        animation.elapsed /
        animation.duration;

      t =
        clamp(
          t,
          0,
          1
        );

      const eased =
        this.applyEasing(
          t,
          animation.easing
        );

      const value =
        lerp(
          animation.from,
          animation.to,
          eased
        );

      animation.onUpdate?.(
        value,
        t
      );

      if (
        t >= 1
      ) {
        animation.finished =
          true;

        animation.onComplete?.();

        this.numberAnimations.splice(
          i,
          1
        );
      }
    }
  }

  /* ==========================================================================
     TIMELINE
     ========================================================================== */

  timeline(
    steps: TimelineStep[],
    onComplete?: AnimationCallback
  ) {
    if (
      steps.length ===
      0
    ) {
      onComplete?.();

      return;
    }

    this.timelines.push(
      {
        steps,

        currentStep: 0,

        elapsed: 0,

        started: false,

        finished: false,

        onComplete,
      }
    );
  }

  private updateTimelines() {
    for (
      let i =
        this.timelines.length -
        1;
      i >= 0;
      i--
    ) {
      const timeline =
        this.timelines[i];

      if (
        timeline.finished
      ) {
        this.timelines.splice(
          i,
          1
        );

        continue;
      }

      const step =
        timeline.steps[
          timeline.currentStep
        ];

      if (!step) {
        timeline.finished =
          true;

        timeline.onComplete?.();

        this.timelines.splice(
          i,
          1
        );

        continue;
      }

      const delay =
        step.delay ?? 0;

      timeline.elapsed +=
        this.delta;

      if (
        timeline.elapsed <
        delay
      ) {
        continue;
      }

      if (
        !timeline.started
      ) {
        timeline.started =
          true;

        timeline.elapsed =
          0;
      }

      const progress =
        clamp(
          timeline.elapsed /
            Math.max(
              step.duration,
              EPSILON
            ),
          0,
          1
        );

      step.run?.(
        progress
      );

      if (
        progress >= 1
      ) {
        timeline.currentStep +=
          1;

        timeline.elapsed =
          0;

        timeline.started =
          false;
      }
    }
  }

  /* ==========================================================================
     DEALER BREATHING
     ========================================================================== */

  updateDealerBreathing(
    dealer: Dealer,
    intensity = 1
  ) {
    const visual =
      dealer.visual;

    const phase =
      this.time *
      MOTION.dealerBreathing;

    const breath =
      Math.sin(
        phase +
          visual.breathingOffset
      );

    const amount =
      0.75 *
      intensity;

    /*
     * Torso / character vertical breathing.
     */
    visual.position.y +=
      breath *
      amount *
      0.0009;

    /*
     * Very subtle head movement.
     */
    visual.headRotation =
      Math.sin(
        this.time *
          MOTION.dealerHead +
          visual.idleSeed
      ) *
      0.018 *
      intensity;

    /*
     * Natural micro shoulder movement.
     */
    visual.leftShoulder.y +=
      breath *
      0.22 *
      intensity;

    visual.rightShoulder.y +=
      breath *
      0.18 *
      intensity;
  }

  /* ==========================================================================
     DEALER IDLE
     ========================================================================== */

  updateDealerIdle(
    dealer: Dealer,
    intensity = 1
  ) {
    this.updateDealerBreathing(
      dealer,
      intensity
    );

    const seed =
      dealer.visual.idleSeed;

    const sway =
      Math.sin(
        this.time *
          0.31 +
          seed
      );

    const glance =
      Math.sin(
        this.time *
          0.22 +
          seed * 0.7
      );

    dealer.visual.headRotation +=
      glance *
      0.012 *
      intensity;

    /*
     * Hands stay mostly still.
     * Realism comes from tiny movement.
     */
    dealer.visual.leftHand.x +=
      sway *
      0.10 *
      intensity;

    dealer.visual.rightHand.x +=
      sway *
      0.08 *
      intensity;
  }

  /* ==========================================================================
     DEALER REACH
     ========================================================================== */

  dealerReach(
    dealer: Dealer,
    side: "left" | "right",
    target: Vec2,
    options: DealerMotionOptions = {}
  ) {
    const duration =
      options.duration ??
      MOTION.dealerReach;

    const intensity =
      options.intensity ??
      1;

    const hand =
      side === "left"
        ? dealer.visual.leftHand
        : dealer.visual.rightHand;

    const elbow =
      side === "left"
        ? dealer.visual.leftElbow
        : dealer.visual.rightElbow;

    const startHand =
      {
        x: hand.x,
        y: hand.y,
      };

    const startElbow =
      {
        x: elbow.x,
        y: elbow.y,
      };

    const targetHand =
      {
        x: target.x,
        y: target.y,
      };

    const targetElbow =
      {
        x:
          lerp(
            startElbow.x,
            target.x,
            0.48
          ),

        y:
          lerp(
            startElbow.y,
            target.y,
            0.48
          ) -
          9 *
            intensity,
      };

    this.move(
      startHand,
      targetHand,
      {
        duration,

        easing: "in-out",

        onUpdate: (
          value,
          progress
        ) => {
          hand.x =
            value.x;

          hand.y =
            value.y;

          const elbowValue =
            lerpVec2(
              startElbow,
              targetElbow,
              easeInOutCubic(
                progress
              )
            );

          elbow.x =
            elbowValue.x;

          elbow.y =
            elbowValue.y;
        },
      }
    );
  }

  /* ==========================================================================
     DEALER RETURN HAND
     ========================================================================== */

  dealerReturnHand(
    dealer: Dealer,
    side: "left" | "right",
    home: Vec2,
    options: DealerMotionOptions = {}
  ) {
    const duration =
      options.duration ??
      MOTION.dealerReach;

    const hand =
      side === "left"
        ? dealer.visual.leftHand
        : dealer.visual.rightHand;

    const elbow =
      side === "left"
        ? dealer.visual.leftElbow
        : dealer.visual.rightElbow;

    this.move(
      {
        x: hand.x,
        y: hand.y,
      },
      home,
      {
        duration,

        easing: "out",

        onUpdate: (
          value,
          progress
        ) => {
          hand.x =
            value.x;

          hand.y =
            value.y;

          elbow.y +=
            Math.sin(
              progress *
              Math.PI
            ) *
            1.8;
        },
      }
    );
  }

  /* ==========================================================================
     DEALER DEAL SEQUENCE
     ========================================================================== */

  dealerDeal(
    dealer: Dealer,
    target: Vec2,
    side: "left" | "right",
    onComplete?: AnimationCallback
  ) {
    const hand =
      side === "left"
        ? dealer.visual.leftHand
        : dealer.visual.rightHand;

    const elbow =
      side === "left"
        ? dealer.visual.leftElbow
        : dealer.visual.rightElbow;

    const home =
      {
        x: hand.x,
        y: hand.y,
      };

    const startElbow =
      {
        x: elbow.x,
        y: elbow.y,
      };

    const targetElbow =
      {
        x:
          lerp(
            startElbow.x,
            target.x,
            0.42
          ),

        y:
          lerp(
            startElbow.y,
            target.y,
            0.42
          ) -
          10,
      };

    this.timeline(
      [
        {
          name: "dealer-reach",

          duration:
            MOTION.dealerReach,

          run: (
            progress
          ) => {
            const eased =
              easeInOutCubic(
                progress
              );

            const position =
              lerpVec2(
                home,
                target,
                eased
              );

            hand.x =
              position.x;

            hand.y =
              position.y;

            const elbowPosition =
              lerpVec2(
                startElbow,
                targetElbow,
                eased
              );

            elbow.x =
              elbowPosition.x;

            elbow.y =
              elbowPosition.y;
          },
        },

        {
          name: "dealer-deal",

          duration:
            MOTION.dealerDeal,

          run: (
            progress
          ) => {
            /*
             * Small forward continuation.
             */
            hand.x =
              lerp(
                target.x,
                target.x - 3,
                progress
              );

            hand.y =
              lerp(
                target.y,
                target.y + 1,
                progress
              );
          },
        },

        {
          name: "dealer-reveal",

          duration:
            MOTION.dealerReveal,

          run: (
            progress
          ) => {
            /*
             * Tiny wrist / hand retreat.
             */
            hand.x =
              lerp(
                target.x,
                target.x + 2,
                easeOutCubic(
                  progress
                )
              );
          },
        },

        {
          name: "dealer-reach",

          duration:
            MOTION.dealerReach,

          run: (
            progress
          ) => {
            const eased =
              easeOutCubic(
                progress
              );

            const position =
              lerpVec2(
                target,
                home,
                eased
              );

            hand.x =
              position.x;

            hand.y =
              position.y;
          },
        },
      ],
      onComplete
    );
  }

  /* ==========================================================================
     CARD DEAL
     ========================================================================== */

  dealCard(
    card: Card,
    from: Vec2,
    to: Vec2,
    options: CardMotionOptions = {}
  ) {
    const duration =
      options.duration ??
      MOTION.cardDeal;

    const rotation =
      options.rotation ??
      0;

    const arc =
      options.arc ??
      -18;

    const delay =
      options.delay ??
      0;

    const startRotation =
      card.transform.rotation;

    const startPosition = {
      x: from.x,
      y: from.y,
    };

    const endPosition = {
      x: to.x,
      y: to.y,
    };

    card.state =
      "dealing";

    this.tween(
      0,
      1,
      {
        duration,

        easing: "out",

        onUpdate: (
          progress
        ) => {
          const eased =
            easeOutCubic(
              progress
            );

          const position =
            lerpVec2(
              startPosition,
              endPosition,
              eased
            );

          /*
           * Gentle physical arc.
           */
          const arcOffset =
            Math.sin(
              progress *
                Math.PI
            ) *
            arc;

          card.transform.position.x =
            position.x;

          card.transform.position.y =
            position.y +
            arcOffset;

          card.transform.rotation =
            lerp(
              startRotation,
              rotation,
              eased
            );
        },

        onComplete: () => {
          card.transform.position =
            {
              x: to.x,
              y: to.y,
            };

          card.transform.rotation =
            rotation;

          card.state =
            "hand";
        },
      }
    );

    if (
      delay >
      0
    ) {
      /*
       * Hold card at deck position until delay.
       */
      card.transform.position =
        {
          x: from.x,
          y: from.y,
        };
    }
  }

  /* ==========================================================================
     CARD PLACE
     ========================================================================== */

  placeCard(
    card: Card,
    target: Vec2,
    rotation = 0,
    options: CardMotionOptions = {}
  ) {
    const duration =
      options.duration ??
      MOTION.cardPlace;

    const start = {
      x:
        card.transform
          .position.x,

      y:
        card.transform
          .position.y,
    };

    this.tween(
      0,
      1,
      {
        duration,

        easing: "out",

        onUpdate: (
          progress
        ) => {
          const eased =
            easeOutCubic(
              progress
            );

          const position =
            lerpVec2(
              start,
              target,
              eased
            );

          /*
           * Very small settling bounce.
           */
          const settle =
            Math.sin(
              progress *
                Math.PI
            ) *
            1.25;

          card.transform.position.x =
            position.x;

          card.transform.position.y =
            position.y +
            settle;

          card.transform.rotation =
            lerp(
              card.transform
                .rotation,
              rotation,
              eased
            );
        },

        onComplete: () => {
          card.transform.position =
            {
              x: target.x,
              y: target.y,
            };

          card.transform.rotation =
            rotation;

          card.state =
            "hand";
        },
      }
    );
  }

  /* ==========================================================================
     CARD FLIP
     ========================================================================== */

  flipCard(
    card: Card,
    options: {
      duration?: number;
      onHalf?: AnimationCallback;
      onComplete?: AnimationCallback;
    } = {}
  ) {
    const duration =
      options.duration ??
      MOTION.cardFlip;

    const originalScaleX =
      card.transform.scaleX;

    let halfCalled =
      false;

    this.tween(
      0,
      1,
      {
        duration,

        easing: "in-out",

        onUpdate: (
          progress
        ) => {
          /*
           * 0 → 1 → 0
           *
           * This simulates physical
           * card rotation around Y.
           */
          const widthScale =
            Math.abs(
              Math.cos(
                progress *
                  Math.PI
              )
            );

          card.transform.scaleX =
            Math.max(
              0.015,
              widthScale
            );

          if (
            progress >=
              0.5 &&
            !halfCalled
          ) {
            halfCalled =
              true;

            card.faceUp =
              !card.faceUp;

            options.onHalf?.();
          }
        },

        onComplete: () => {
          card.transform.scaleX =
            originalScaleX;

          options.onComplete?.();
        },
      }
    );
  }

  /* ==========================================================================
     CHIP PLACE
     ========================================================================== */

  placeChip(
    chip: Chip,
    from: Vec2,
    to: Vec2,
    options: ChipMotionOptions = {}
  ) {
    const duration =
      options.duration ??
      MOTION.chipPlace;

    const rotation =
      options.rotation ??
      0;

    const bounce =
      options.bounce ??
      2;

    const startRotation =
      chip.transform.rotation;

    chip.moving =
      true;

    this.tween(
      0,
      1,
      {
        duration,

        easing: "out",

        onUpdate: (
          progress
        ) => {
          const eased =
            easeOutCubic(
              progress
            );

          const position =
            lerpVec2(
              from,
              to,
              eased
            );

          const verticalBounce =
            Math.sin(
              progress *
                Math.PI
            ) *
            bounce;

          chip.transform.position.x =
            position.x;

          chip.transform.position.y =
            position.y -
            verticalBounce;

          chip.transform.rotation =
            lerp(
              startRotation,
              rotation,
              eased
            );
        },

        onComplete: () => {
          chip.transform.position =
            {
              x: to.x,
              y: to.y,
            };

          chip.transform.rotation =
            rotation;

          chip.moving =
            false;
        },
      }
    );
  }

  /* ==========================================================================
     CHIP SLIDE
     ========================================================================== */

  slideChip(
    chip: Chip,
    to: Vec2,
    options: ChipMotionOptions = {}
  ) {
    const from = {
      x:
        chip.transform.position.x,

      y:
        chip.transform.position.y,
    };

    this.placeChip(
      chip,
      from,
      to,
      {
        duration:
          options.duration ??
          MOTION.chipSlide,

        rotation:
          options.rotation ??
          chip.transform
            .rotation,

        bounce:
          options.bounce ??
          0.8,
      }
    );
  }

  /* ==========================================================================
     CHIP COLLECT
     ========================================================================== */

  collectChip(
    chip: Chip,
    target: Vec2,
    options: ChipMotionOptions = {}
  ) {
    const duration =
      options.duration ??
      MOTION.chipCollect;

    const from = {
      x:
        chip.transform.position.x,

      y:
        chip.transform.position.y,
    };

    const originalScaleX =
      chip.transform.scaleX;

    const originalScaleY =
      chip.transform.scaleY;

    chip.moving =
      true;

    this.tween(
      0,
      1,
      {
        duration,

        easing: "in-out",

        onUpdate: (
          progress
        ) => {
          const eased =
            easeInOutCubic(
              progress
            );

          const position =
            lerpVec2(
              from,
              target,
              eased
            );

          chip.transform.position.x =
            position.x;

          chip.transform.position.y =
            position.y;

          /*
           * Slight compression toward
           * the destination.
           */
          const scale =
            lerp(
              1,
              0.55,
              eased
            );

          chip.transform.scaleX =
            originalScaleX *
            scale;

          chip.transform.scaleY =
            originalScaleY *
            scale;
        },

        onComplete: () => {
          chip.transform.position =
            {
              x: target.x,
              y: target.y,
            };

          chip.transform.scaleX =
            originalScaleX;

          chip.transform.scaleY =
            originalScaleY;

          chip.moving =
            false;
        },
      }
    );
  }

  /* ==========================================================================
     PLAYER IDLE
     ========================================================================== */

  updatePlayerIdle(
    player: Player,
    intensity = 1
  ) {
    const visual =
      player.visual;

    const seed =
      visual.idleSeed;

    const breath =
      Math.sin(
        this.time *
          MOTION.playerIdle +
          seed
      );

    const slowSway =
      Math.sin(
        this.time *
          0.23 +
          seed * 0.5
      );

    /*
     * Tiny body breathing.
     */
    visual.position.y +=
      breath *
      0.0005 *
      intensity;

    /*
     * Small head movement.
     */
    visual.headRotation =
      slowSway *
      0.016 *
      intensity;

    /*
     * Personality-specific micro motion.
     */
    switch (
      player.behavior
    ) {
      case "nervous":
        this.updateNervousPlayer(
          player,
          intensity
        );

        break;

      case "aggressive":
        this.updateAggressivePlayer(
          player,
          intensity
        );

        break;

      case "conservative":
        this.updateConservativePlayer(
          player,
          intensity
        );

        break;

      case "casual":
        this.updateCasualPlayer(
          player,
          intensity
        );

        break;

      default:
        break;
    }
  }

  private updateNervousPlayer(
    player: Player,
    intensity: number
  ) {
    const visual =
      player.visual;

    const timer =
      Math.sin(
        this.time *
          2.1 +
          visual.idleSeed
      );

    visual.rightHand.x +=
      timer *
      0.11 *
      intensity;
  }

  private updateAggressivePlayer(
    player: Player,
    intensity: number
  ) {
    const visual =
      player.visual;

    const timer =
      Math.sin(
        this.time *
          0.65 +
          visual.idleSeed
      );

    visual.headRotation +=
      timer *
      0.008 *
      intensity;
  }

  private updateConservativePlayer(
    player: Player,
    intensity: number
  ) {
    const visual =
      player.visual;

    const timer =
      Math.sin(
        this.time *
          0.31 +
          visual.idleSeed
      );

    visual.position.x +=
      timer *
      0.00025 *
      intensity;
  }

  private updateCasualPlayer(
    player: Player,
    intensity: number
  ) {
    const visual =
      player.visual;

    const timer =
      Math.sin(
        this.time *
          0.42 +
          visual.idleSeed
      );

    visual.headRotation +=
      timer *
      0.011 *
      intensity;
  }

  /* ==========================================================================
     BLINK
     ========================================================================== */

  updateBlink(
    visual: {
      blinkTimer: number;
    }
  ) {
    visual.blinkTimer -=
      this.delta;

    if (
      visual.blinkTimer >
      0
    ) {
      return false;
    }

    visual.blinkTimer =
      2.2 +
      Math.random() *
        4.6;

    return true;
  }

  /* ==========================================================================
     CAMERA PUSH
     ========================================================================== */

  cameraPush(
    camera: {
      position: Vec2;

      zoom: number;
    },
    targetZoom: number,
    options: {
      duration?: number;
      strength?: number;
      x?: number;
      y?: number;
      onComplete?: AnimationCallback;
    } = {}
  ) {
    const duration =
      options.duration ??
      MOTION.cameraPush;

    const strength =
      options.strength ??
      1;

    const startZoom =
      camera.zoom;

    const startPosition =
      {
        x:
          camera.position.x,

        y:
          camera.position.y,
      };

    const targetPosition =
      {
        x:
          options.x ??
          camera.position.x,

        y:
          options.y ??
          camera.position.y,
      };

    this.tween(
      0,
      1,
      {
        duration,

        easing: "in-out",

        onUpdate: (
          progress
        ) => {
          const eased =
            easeInOutCubic(
              progress
            );

          camera.zoom =
            lerp(
              startZoom,
              targetZoom,
              eased *
                strength
            );

          const position =
            lerpVec2(
              startPosition,
              targetPosition,
              eased
            );

          camera.position.x =
            position.x;

          camera.position.y =
            position.y;
        },

        onComplete:
          options.onComplete,
      }
    );
  }

  /* ==========================================================================
     CAMERA SHAKE
     ========================================================================== */

  cameraShake(
    camera: {
      shakeX: number;
      shakeY: number;
    },
    intensity = 1,
    duration = 0.16
  ) {
    this.tween(
      0,
      1,
      {
        duration,

        easing: "out",

        onUpdate: (
          progress
        ) => {
          const decay =
            1 -
            easeOutCubic(
              progress
            );

          camera.shakeX =
            (
              Math.sin(
                this.time *
                  70
              ) *
              0.45
            ) *
            intensity *
            decay;

          camera.shakeY =
            (
              Math.cos(
                this.time *
                  83
              ) *
              0.35
            ) *
            intensity *
            decay;
        },

        onComplete: () => {
          camera.shakeX =
            0;

          camera.shakeY =
            0;
        },
      }
    );
  }

  /* ==========================================================================
     MICRO MOVEMENT HELPERS
     ========================================================================== */

  breathingOffset(
    seed: number,
    speed = 1,
    amplitude = 1
  ) {
    return (
      Math.sin(
        this.time *
          speed +
          seed
      ) *
      amplitude
    );
  }

  idleSway(
    seed: number,
    speed = 0.3,
    amplitude = 1
  ) {
    return (
      Math.sin(
        this.time *
          speed +
          seed
      ) *
      amplitude
    );
  }

  pulse(
    speed = 1,
    phase = 0
  ) {
    return (
      0.5 +
      0.5 *
        Math.sin(
          this.time *
            speed +
            phase
        )
    );
  }

  /* ==========================================================================
     EASING
     ========================================================================== */

  applyEasing(
    progress: number,
    easing:
      | "linear"
      | "smooth"
      | "out"
      | "in-out"
  ) {
    switch (easing) {
      case "linear":
        return progress;

      case "smooth":
        return (
          progress *
          progress *
          (3 -
            2 *
              progress)
        );

      case "out":
        return easeOutCubic(
          progress
        );

      case "in-out":
        return easeInOutCubic(
          progress
        );
    }
  }

  /* ==========================================================================
     STATIC PHYSICAL CURVES
     ========================================================================== */

  cardArc(
    from: Vec2,
    to: Vec2,
    progress: number,
    arc = -18
  ): Vec2 {
    const position =
      lerpVec2(
        from,
        to,
        progress
      );

    return {
      x: position.x,

      y:
        position.y +
        Math.sin(
          progress *
            Math.PI
        ) *
          arc,
    };
  }

  handReachCurve(
    from: Vec2,
    to: Vec2,
    progress: number,
    lift = -10
  ): Vec2 {
    const position =
      lerpVec2(
        from,
        to,
        easeInOutCubic(
          progress
        )
      );

    return {
      x: position.x,

      y:
        position.y +
        Math.sin(
          progress *
            Math.PI
        ) *
          lift,
    };
  }

  /* ==========================================================================
     PLAYER REACTIONS
     ========================================================================== */

  reaction(
    player: Player,
    type:
      | "hit"
      | "stand"
      | "win"
      | "lose"
      | "blackjack"
      | "bust"
  ) {
    switch (type) {
      case "hit":
        this.playerLean(
          player,
          0.018,
          0.16
        );
        break;

      case "stand":
        this.playerLean(
          player,
          -0.012,
          0.18
        );
        break;

      case "win":
        this.playerCelebration(
          player,
          0.35
        );
        break;

      case "lose":
        this.playerReactionDown(
          player,
          0.28
        );
        break;

      case "blackjack":
        this.playerCelebration(
          player,
          0.48
        );
        break;

      case "bust":
        this.playerReactionDown(
          player,
          0.20
        );
        break;
    }
  }

  private playerLean(
    player: Player,
    angle: number,
    duration: number
  ) {
    const visual =
      player.visual;

    const start =
      visual.rotation;

    this.tween(
      0,
      1,
      {
        duration,

        easing: "out",

        onUpdate: (
          progress
        ) => {
          visual.rotation =
            lerp(
              start,
              start + angle,
              progress
            );
        },

        onComplete: () => {
          visual.rotation =
            start;
        },
      }
    );
  }

  private playerCelebration(
    player: Player,
    intensity: number
  ) {
    const visual =
      player.visual;

    const startY =
      visual.position.y;

    this.tween(
      0,
      1,
      {
        duration:
          0.42,

        easing: "out",

        onUpdate: (
          progress
        ) => {
          const bounce =
            Math.sin(
              progress *
                Math.PI
            ) *
            intensity;

          visual.position.y =
            startY -
            bounce;
        },

        onComplete: () => {
          visual.position.y =
            startY;
        },
      }
    );
  }

  private playerReactionDown(
    player: Player,
    intensity: number
  ) {
    const visual =
      player.visual;

    const start =
      visual.headRotation;

    this.tween(
      0,
      1,
      {
        duration:
          0.28,

        easing: "out",

        onUpdate: (
          progress
        ) => {
          visual.headRotation =
            lerp(
              start,
              0.025 *
                intensity,
              progress
            );
        },

        onComplete: () => {
          visual.headRotation =
            start;
        },
      }
    );
  }

  /* ==========================================================================
     DEBUG / STATUS
     ========================================================================== */

  getActiveCount() {
    return (
      this.tracks.size +
      this.vectorAnimations
        .length +
      this.numberAnimations
        .length +
      this.timelines.length
    );
  }

  clear() {
    this.tracks.clear();

    this.vectorAnimations =
      [];

    this.numberAnimations =
      [];

    this.timelines =
      [];
  }

  /* ==========================================================================
     CLEANUP
     ========================================================================== */

  destroy() {
    this.clear();

    this.idleSeeds.clear();

    this.time = 0;

    this.delta = 0;

    this.frame = 0;
  }
}