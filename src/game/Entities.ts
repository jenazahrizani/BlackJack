/* ==========================================================================
   BLACKJACK 21 — ENTITIES
   --------------------------------------------------------------------------
   Single source of truth for:
   - Casino design tokens
   - Table
   - Dealer
   - Players
   - Seats
   - Cards
   - Hands
   - Deck
   - Chips
   - Poses
   - Visual state

   No external assets required.
   Everything is designed to be rendered procedurally.

   FIRST-PERSON VISUAL NOTE
   --------------------------------------------------------------------------
   CharacterVisual still contains head-related fields for compatibility with
   the wider game architecture, but the current first-person renderer does
   not need to draw faces or heads. The renderer may use body / arm / hand
   fields only.
   ========================================================================== */


/* ==========================================================================
   DESIGN / COLORS
   ========================================================================== */

export const COLORS = {
  /*
   * Environment
   */
  black: "#030504",
  blackSoft: "#070A08",
  background: "#050807",

  /*
   * Wood / casino furniture
   */
  woodDeep: "#100A07",
  wood: "#1A100C",
  woodMid: "#24150F",
  woodLight: "#2A1B13",
  woodHighlight: "#3A2519",

  /*
   * Felt
   */
  feltDeep: "#06241C",
  felt: "#0B382C",
  feltMid: "#104635",
  feltLight: "#165340",

  /*
   * Gold / brass
   */
  goldDark: "#72582B",
  gold: "#C5A35C",
  goldLight: "#E1C777",
  goldBright: "#E7D18E",

  /*
   * Cards
   */
  card: "#E7E1D3",
  cardLight: "#F1ECDF",
  cardShadow: "#B8B09E",
  cardEdge: "#4C493F",

  /*
   * Suits
   */
  blackSuit: "#171716",
  red: "#8A272C",

  /*
   * Characters
   */
  skinLight: "#9A8069",
  skin: "#7B6655",
  skinDark: "#59473B",

  hairBlack: "#161514",
  hairBrown: "#2B211B",

  shirt: "#D7D1C2",
  jacket: "#171C19",
  jacketLight: "#252C28",

  /*
   * Chips
   */
  chipRed: "#A33E42",
  chipBlue: "#344F72",
  chipGreen: "#35624D",
  chipBlack: "#252725",
  chipIvory: "#D9D2C0",
  chipGold: "#C7A95C",

  /*
   * Atmosphere
   */
  shadow: "rgba(0, 0, 0, 0.60)",
  deepShadow: "rgba(0, 0, 0, 0.82)",
  softShadow: "rgba(0, 0, 0, 0.32)",

  glass: "rgba(255, 255, 255, 0.035)",

  warmLight: "rgba(225, 199, 119, 0.12)",
  greenLight: "rgba(35, 104, 78, 0.12)",

  /*
   * First-person atmosphere
   */
  vignette:
    "rgba(0, 0, 0, 0.48)",

  tableGlow:
    "rgba(50, 125, 92, 0.08)",

  brassGlow:
    "rgba(231, 209, 142, 0.08)",
};


/* ==========================================================================
   DESIGN / NUMBERS
   ========================================================================== */

export const DESIGN = {
  /*
   * Internal logical resolution.
   *
   * Renderer may use a much lower internal pixel surface and upscale it.
   */
  logicalWidth: 960,
  logicalHeight: 540,

  /*
   * Pixel treatment.
   */
  pixelSize: 2,

  /*
   * First-person composition.
   */
  firstPerson: {
    horizonY: 0.37,

    tableTopY: 0.54,

    playerCardsY: 0.76,

    dealerCardsY: 0.43,

    playerHandsY: 0.88,

    edgeDarkness: 0.24,

    cameraXLimit: 0.08,

    cameraYLimit: 0.05,

    cameraZoomMin: 0.94,

    cameraZoomMax: 1.08,
  },

  /*
   * Card sizing.
   */
  card: {
    width: 74,
    height: 108,

    cornerRadius: 2,

    shadowOffsetX: 4,
    shadowOffsetY: 5,

    rankInsetX: 7,
    rankInsetY: 8,

    suitInsetY: 23,
  },

  /*
   * Chip sizing.
   */
  chip: {
    radius: 20,

    thickness: 7,

    stackSpacing: 5,

    edgeWidth: 2,
  },

  /*
   * Table.
   */
  table: {
    centerX: 0.5,
    centerY: 0.61,

    width: 0.92,
    height: 0.68,

    feltWidth: 0.398,
    feltHeight: 0.363,

    railHeight: 0.08,

    foregroundDepth: 0.29,

    horizonDepth: 0.04,
  },

  /*
   * Dealer.
   */
  dealer: {
    y: 0.30,

    headRadiusX: 23,
    headRadiusY: 27,

    shoulderWidth: 67,
    shoulderHeight: 18,

    bodyWidth: 74,
    bodyHeight: 94,

    handReachDistance: 0.10,
  },

  /*
   * Peripheral player composition.
   */
  peripheralPlayers: {
    bodyDepth: 0.13,

    shoulderScale: 1.0,

    handScale: 0.88,

    cropAmount: 0.54,

    leftBias: -0.02,

    rightBias: 0.02,
  },

  /*
   * Foreground player presence.
   */
  foregroundPlayer: {
    armWidth: 0.095,

    armLength: 0.30,

    handSize: 0.045,

    y: 0.91,

    opacity: 0.96,
  },

  /*
   * Ambient lighting.
   */
  lighting: {
    baseExposure: 0.92,

    warmStrength: 0.12,

    greenStrength: 0.10,

    pulseAmount: 0.035,

    vignetteStrength: 0.52,
  },

  /*
   * Animation speeds.
   */
  animation: {
    breathing: 0.95,
    ambient: 0.18,

    cardDeal: 0.42,
    cardFlip: 0.32,

    chipMove: 0.38,

    camera: 0.035,
  },

  /*
   * Visual depth layers.
   */
  depth: {
    background: 0,
    architecture: 10,
    dealer: 20,
    tableBack: 30,
    cardsBack: 40,
    peripheralPlayers: 50,
    tableFront: 60,
    cardsFront: 70,
    chips: 80,
    foregroundHands: 90,
    vignette: 100,
  },
};


/* ==========================================================================
   BASIC TYPES
   ========================================================================== */

export type Suit =
  | "spades"
  | "hearts"
  | "diamonds"
  | "clubs";

export type CardRank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export type PlayerType =
  | "human"
  | "npc";

export type GenderPresentation =
  | "masculine"
  | "feminine"
  | "neutral";

export type SeatState =
  | "empty"
  | "waiting"
  | "betting"
  | "playing"
  | "standing"
  | "busted"
  | "blackjack"
  | "winner"
  | "loser";

export type DealerState =
  | "idle"
  | "waiting"
  | "dealing"
  | "looking"
  | "reaching"
  | "holding-card"
  | "placing-card"
  | "revealing"
  | "collecting"
  | "settling";

export type HandState =
  | "empty"
  | "dealing"
  | "playing"
  | "standing"
  | "busted"
  | "blackjack"
  | "winner"
  | "loser"
  | "push";

export type CardState =
  | "deck"
  | "dealing"
  | "hand"
  | "held"
  | "revealing"
  | "discarded";

export type ChipColor =
  | "red"
  | "blue"
  | "green"
  | "black"
  | "ivory"
  | "gold";

export type PlayerMood =
  | "neutral"
  | "focused"
  | "relaxed"
  | "nervous"
  | "happy"
  | "surprised"
  | "disappointed";

export type PlayerBehavior =
  | "conservative"
  | "balanced"
  | "aggressive"
  | "casual"
  | "nervous";

export type DealerPose =
  | "neutral"
  | "hands-down"
  | "left-reach"
  | "right-reach"
  | "deal-left"
  | "deal-center"
  | "deal-right"
  | "hold-card"
  | "reveal"
  | "collect"
  | "settle";


/* ==========================================================================
   VECTOR / TRANSFORM
   ========================================================================== */

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rotation {
  value: number;
}

export interface Transform2D {
  position: Vec2;

  rotation: number;

  scaleX: number;
  scaleY: number;

  opacity: number;
}


/* ==========================================================================
   CARD
   ========================================================================== */

export interface Card {
  id: string;

  rank: CardRank;
  suit: Suit;

  value: number;

  state: CardState;

  faceUp: boolean;

  transform: Transform2D;

  /*
   * Animation helpers.
   */
  target: Vec2;

  targetRotation: number;

  zIndex: number;

  selected: boolean;

  highlighted: boolean;
}


/* ==========================================================================
   HAND
   ========================================================================== */

export interface Hand {
  id: string;

  cards: Card[];

  state: HandState;

  value: number;

  soft: boolean;

  blackjack: boolean;

  busted: boolean;

  bet: number;

  x: number;

  y: number;

  rotation: number;
}


/* ==========================================================================
   CHIP
   ========================================================================== */

export interface Chip {
  id: string;

  value: number;

  color: ChipColor;

  transform: Transform2D;

  target: Vec2;

  targetRotation: number;

  stackIndex: number;

  selected: boolean;

  moving: boolean;
}


/* ==========================================================================
   CHIP STACK
   ========================================================================== */

export interface ChipStack {
  id: string;

  x: number;

  y: number;

  chips: Chip[];

  total: number;

  rotation: number;

  visible: boolean;
}


/* ==========================================================================
   PLAYER VISUAL
   ========================================================================== */

export interface CharacterVisual {
  /*
   * Overall position.
   */
  position: Vec2;

  scale: number;

  rotation: number;

  /*
   * Body.
   */
  bodyWidth: number;

  bodyHeight: number;

  /*
   * Head.
   *
   * Kept for architecture compatibility.
   * First-person renderer does not need to draw it.
   */
  headRadius: number;

  headRotation: number;

  /*
   * Arms.
   */
  leftShoulder: Vec2;

  leftElbow: Vec2;

  leftHand: Vec2;

  rightShoulder: Vec2;

  rightElbow: Vec2;

  rightHand: Vec2;

  /*
   * Visual identity.
   */
  skin: string;

  hair: string;

  shirt: string;

  jacket: string;

  /*
   * Animation.
   */
  breathingOffset: number;

  blinkTimer: number;

  idleSeed: number;
}


/* ==========================================================================
   PLAYER
   ========================================================================== */

export interface Player {
  id: string;

  type: PlayerType;

  name: string;

  seat: number;

  state: SeatState;

  mood: PlayerMood;

  behavior: PlayerBehavior;

  presentation: GenderPresentation;

  visual: CharacterVisual;

  hand: Hand;

  secondaryHand: Hand | null;

  chips: ChipStack;

  balance: number;

  bet: number;

  wins: number;

  losses: number;

  active: boolean;

  eliminated: boolean;
}


/* ==========================================================================
   SEAT
   ========================================================================== */

export interface Seat {
  id: number;

  x: number;

  y: number;

  angle: number;

  radius: number;

  occupied: boolean;

  active: boolean;

  playerId: string | null;

  label: string;

  state: SeatState;
}


/* ==========================================================================
   DEALER
   ========================================================================== */

export interface Dealer {
  id: string;

  name: string;

  state: DealerState;

  pose: DealerPose;

  mood: PlayerMood;

  visual: CharacterVisual;

  hand: Hand;

  position: Vec2;

  targetPosition: Vec2;

  attention:
    | "deck"
    | "player"
    | "table"
    | "cards";

  currentSeat: number | null;

  speaking: boolean;

  speechText: string;

  speechUntil: number;
}


/* ==========================================================================
   DECK
   ========================================================================== */

export interface Deck {
  cards: Card[];

  position: Vec2;

  rotation: number;

  visibleCards: number;

  remaining: number;

  discardCount: number;

  shoeCount: number;
}


/* ==========================================================================
   TABLE
   ========================================================================== */

export interface Table {
  x: number;

  y: number;

  width: number;

  height: number;

  rotation: number;

  scale: number;

  feltPatternSeed: number;

  dealerRailHeight: number;

  bettingAreaY: number;

  playerAreaY: number;

  centerAreaY: number;

  /*
   * Table rules.
   */
  minimumBet: number;

  maximumBet: number;

  blackjackPayout: number;

  dealerStandsOn: number;

  dealerHitsSoft17: boolean;

  doubleAfterSplit: boolean;

  surrenderAllowed: boolean;
}


/* ==========================================================================
   CASINO LIGHT
   ========================================================================== */

export interface CasinoLight {
  id: string;

  position: Vec2;

  radius: number;

  intensity: number;

  warmth: number;

  pulseSpeed: number;

  pulsePhase: number;

  enabled: boolean;
}


/* ==========================================================================
   ATMOSPHERE PARTICLE
   ========================================================================== */

export interface AtmosphereParticle {
  id: string;

  x: number;

  y: number;

  size: number;

  opacity: number;

  velocityX: number;

  velocityY: number;

  life: number;

  maxLife: number;
}


/* ==========================================================================
   CAMERA
   ========================================================================== */

export interface Camera {
  position: Vec2;

  target: Vec2;

  zoom: number;

  targetZoom: number;

  rotation: number;

  targetRotation: number;

  shakeX: number;

  shakeY: number;
}


/* ==========================================================================
   ANIMATION
   ========================================================================== */

export type AnimationName =
  | "idle"
  | "dealer-breathe"
  | "dealer-reach"
  | "dealer-deal"
  | "dealer-reveal"
  | "dealer-collect"
  | "card-deal"
  | "card-flip"
  | "card-place"
  | "chip-place"
  | "chip-slide"
  | "chip-collect"
  | "player-idle"
  | "camera-push"
  | "camera-reset";

export interface AnimationTrack {
  id: string;

  name: AnimationName;

  startTime: number;

  duration: number;

  progress: number;

  delay: number;

  playing: boolean;

  finished: boolean;

  loop: boolean;

  reverse: boolean;
}


/* ==========================================================================
   TABLE VISUAL STATE
   ========================================================================== */

export interface TableVisualState {
  table: Table;

  dealer: Dealer;

  deck: Deck;

  seats: Seat[];

  players: Player[];

  activeSeat: number;

  focusedSeat: number | null;

  bettingOpen: boolean;

  cardsVisible: boolean;

  chipsVisible: boolean;
}


/* ==========================================================================
   FACTORIES
   ========================================================================== */

export function createTransform(
  x = 0,
  y = 0,
  rotation = 0,
  scale = 1,
  opacity = 1
): Transform2D {
  return {
    position: {
      x,
      y,
    },

    rotation,

    scaleX: scale,
    scaleY: scale,

    opacity,
  };
}


/* ==========================================================================
   CARD FACTORY
   ========================================================================== */

export function createCard(
  rank: CardRank,
  suit: Suit,
  options: Partial<
    Omit<Card, "id" | "rank" | "suit" | "value">
  > = {}
): Card {
  const value =
    getCardValue(rank);

  return {
    id:
      createId("card"),

    rank,

    suit,

    value,

    state:
      options.state ??
      "deck",

    faceUp:
      options.faceUp ??
      false,

    transform:
      options.transform ??
      createTransform(),

    target:
      options.target ?? {
        x: 0,
        y: 0,
      },

    targetRotation:
      options.targetRotation ??
      0,

    zIndex:
      options.zIndex ??
      0,

    selected:
      options.selected ??
      false,

    highlighted:
      options.highlighted ??
      false,
  };
}


/* ==========================================================================
   CHIP FACTORY
   ========================================================================== */

export function createChip(
  value: number,
  options: Partial<
    Omit<Chip, "id" | "value">
  > = {}
): Chip {
  return {
    id:
      createId("chip"),

    value,

    color:
      options.color ??
      getChipColor(value),

    transform:
      options.transform ??
      createTransform(),

    target:
      options.target ?? {
        x: 0,
        y: 0,
      },

    targetRotation:
      options.targetRotation ??
      0,

    stackIndex:
      options.stackIndex ??
      0,

    selected:
      options.selected ??
      false,

    moving:
      options.moving ??
      false,
  };
}


/* ==========================================================================
   HAND FACTORY
   ========================================================================== */

export function createHand(
  id = createId("hand")
): Hand {
  return {
    id,

    cards: [],

    state:
      "empty",

    value:
      0,

    soft:
      false,

    blackjack:
      false,

    busted:
      false,

    bet:
      0,

    x:
      0,

    y:
      0,

    rotation:
      0,
  };
}


/* ==========================================================================
   CHARACTER FACTORY
   ========================================================================== */

export function createCharacterVisual(
  options: Partial<CharacterVisual> = {}
): CharacterVisual {
  const seed =
    options.idleSeed ??
    createVisualSeed();

  return {
    position:
      options.position ?? {
        x: 0,
        y: 0,
      },

    scale:
      options.scale ??
      1,

    rotation:
      options.rotation ??
      0,

    bodyWidth:
      options.bodyWidth ??
      54,

    bodyHeight:
      options.bodyHeight ??
      72,

    headRadius:
      options.headRadius ??
      20,

    headRotation:
      options.headRotation ??
      0,

    leftShoulder:
      options.leftShoulder ?? {
        x: -20,
        y: 20,
      },

    leftElbow:
      options.leftElbow ?? {
        x: -42,
        y: 40,
      },

    leftHand:
      options.leftHand ?? {
        x: -58,
        y: 61,
      },

    rightShoulder:
      options.rightShoulder ?? {
        x: 20,
        y: 20,
      },

    rightElbow:
      options.rightElbow ?? {
        x: 42,
        y: 40,
      },

    rightHand:
      options.rightHand ?? {
        x: 58,
        y: 61,
      },

    skin:
      options.skin ??
      COLORS.skin,

    hair:
      options.hair ??
      COLORS.hairBlack,

    shirt:
      options.shirt ??
      COLORS.shirt,

    jacket:
      options.jacket ??
      COLORS.jacket,

    breathingOffset:
      options.breathingOffset ??
      0,

    blinkTimer:
      options.blinkTimer ??
      2,

    idleSeed:
      seed,
  };
}


/* ==========================================================================
   PLAYER FACTORY
   ========================================================================== */

export function createPlayer(
  seat: number,
  name: string,
  type: PlayerType = "npc"
): Player {
  const presentation =
    getPresentationForSeat(
      seat
    );

  const behavior =
    getDefaultBehavior(
      seat
    );

  return {
    id:
      createId("player"),

    type,

    name,

    seat,

    state:
      "waiting",

    mood:
      "neutral",

    behavior,

    presentation,

    visual:
      createCharacterVisual({
        jacket:
          getPlayerJacket(
            seat
          ),

        breathingOffset:
          seat *
          0.13,
      }),

    hand:
      createHand(
        `hand-${seat}`
      ),

    secondaryHand:
      null,

    chips: {
      id:
        createId("stack"),

      x:
        0,

      y:
        0,

      chips: [],

      total:
        0,

      rotation:
        0,

      visible:
        true,
    },

    balance:
      1000,

    bet:
      0,

    wins:
      0,

    losses:
      0,

    active:
      true,

    eliminated:
      false,
  };
}


/* ==========================================================================
   DEALER FACTORY
   ========================================================================== */

export function createDealer(
  name = "EMMA"
): Dealer {
  return {
    id:
      createId("dealer"),

    name,

    state:
      "idle",

    pose:
      "neutral",

    mood:
      "neutral",

    visual:
      createCharacterVisual({
        bodyWidth:
          DESIGN.dealer.bodyWidth,

        bodyHeight:
          DESIGN.dealer.bodyHeight,

        headRadius:
          DESIGN.dealer.headRadiusX,

        skin:
          COLORS.skin,

        hair:
          COLORS.hairBlack,

        shirt:
          COLORS.shirt,

        jacket:
          COLORS.jacket,

        breathingOffset:
          0,
      }),

    hand:
      createHand(
        "dealer-hand"
      ),

    position: {
      x:
        0.5,

      y:
        DESIGN.dealer.y,
    },

    targetPosition: {
      x:
        0.5,

      y:
        DESIGN.dealer.y,
    },

    attention:
      "table",

    currentSeat:
      null,

    speaking:
      false,

    speechText:
      "",

    speechUntil:
      0,
  };
}


/* ==========================================================================
   SEAT FACTORY
   ========================================================================== */

export function createSeat(
  id: number
): Seat {
  const normalized =
    getSeatPosition(
      id
    );

  return {
    id,

    x:
      normalized.x,

    y:
      normalized.y,

    angle:
      normalized.angle,

    radius:
      normalized.radius,

    occupied:
      false,

    active:
      false,

    playerId:
      null,

    label:
      `SEAT ${String(
        id
      ).padStart(
        2,
        "0"
      )}`,

    state:
      "empty",
  };
}


/* ==========================================================================
   TABLE FACTORY
   ========================================================================== */

export function createTable(
  options: Partial<Table> = {}
): Table {
  return {
    x:
      options.x ??
      DESIGN.table.centerX,

    y:
      options.y ??
      DESIGN.table.centerY,

    width:
      options.width ??
      DESIGN.table.width,

    height:
      options.height ??
      DESIGN.table.height,

    rotation:
      options.rotation ??
      0,

    scale:
      options.scale ??
      1,

    feltPatternSeed:
      options.feltPatternSeed ??
      987321,

    dealerRailHeight:
      options.dealerRailHeight ??
      DESIGN.table.railHeight,

    bettingAreaY:
      options.bettingAreaY ??
      0.76,

    playerAreaY:
      options.playerAreaY ??
      0.68,

    centerAreaY:
      options.centerAreaY ??
      0.55,

    minimumBet:
      options.minimumBet ??
      5,

    maximumBet:
      options.maximumBet ??
      500,

    blackjackPayout:
      options.blackjackPayout ??
      1.5,

    dealerStandsOn:
      options.dealerStandsOn ??
      17,

    dealerHitsSoft17:
      options.dealerHitsSoft17 ??
      false,

    doubleAfterSplit:
      options.doubleAfterSplit ??
      true,

    surrenderAllowed:
      options.surrenderAllowed ??
      false,
  };
}


/* ==========================================================================
   DECK FACTORY
   ========================================================================== */

export function createDeck(
  decks = 6
): Deck {
  const safeDeckCount =
    Math.max(
      1,
      Math.floor(
        decks
      )
    );

  const cards: Card[] = [];

  const suits: Suit[] = [
    "spades",
    "hearts",
    "diamonds",
    "clubs",
  ];

  const ranks: CardRank[] = [
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
  ];

  for (
    let deckIndex = 0;
    deckIndex <
    safeDeckCount;
    deckIndex += 1
  ) {
    for (
      const suit of suits
    ) {
      for (
        const rank of ranks
      ) {
        cards.push(
          createCard(
            rank,
            suit
          )
        );
      }
    }
  }

  /*
   * Put cards physically at shoe position.
   *
   * The renderer can use:
   * - position
   * - zIndex
   * - slight rotation
   *
   * to create a layered shoe.
   */
  cards.forEach(
    (
      card,
      index
    ) => {
      card.state =
        "deck";

      card.faceUp =
        false;

      card.transform =
        createTransform(
          0,
          index * -0.04,
          (
            index % 2 ===
            0
              ? -1
              : 1
          ) *
            0.008,
          1,
          1
        );

      card.target = {
        x:
          0,

        y:
          0,
      };

      card.targetRotation =
        card.transform.rotation;

      card.zIndex =
        index;
    }
  );

  return {
    cards,

    /*
     * Deck is placed toward dealer's right side
     * from the player's first-person perspective.
     */
    position: {
      x:
        0.57,

      y:
        0.39,
    },

    rotation:
      0,

    visibleCards:
      4,

    remaining:
      cards.length,

    discardCount:
      0,

    shoeCount:
      safeDeckCount,
  };
}


/* ==========================================================================
   GAME / VISUAL STATE FACTORY
   ========================================================================== */

export function createTableVisualState(): TableVisualState {
  const seats =
    Array.from(
      {
        length:
          5,
      },
      (_, index) =>
        createSeat(
          index + 1
        )
    );

  const players: Player[] = [
    createPlayer(
      1,
      "MICHAEL"
    ),

    createPlayer(
      2,
      "OLIVIA"
    ),

    createPlayer(
      3,
      "PLAYER",
      "human"
    ),

    createPlayer(
      4,
      "DANIEL"
    ),

    createPlayer(
      5,
      "JULIA"
    ),
  ];

  /*
   * Connect players to seats.
   */
  players.forEach(
    (
      player
    ) => {
      const seat =
        seats.find(
          (
            item
          ) =>
            item.id ===
            player.seat
        );

      if (!seat) {
        return;
      }

      seat.occupied =
        true;

      seat.playerId =
        player.id;

      seat.state =
        player.state;

      player.visual.position =
        seatToCharacterPosition(
          seat
        );
    }
  );

  /*
   * Human player occupies the central seat.
   */
  const human =
    players.find(
      (
        player
      ) =>
        player.type ===
        "human"
    );

  if (human) {
    const seat =
      seats.find(
        (
          item
        ) =>
          item.id ===
          human.seat
      );

    if (seat) {
      seat.active =
        true;

      seat.state =
        "playing";

      human.active =
        true;

      human.state =
        "playing";
    }
  }

  const table =
    createTable();

  const dealer =
    createDealer();

  const deck =
    createDeck(
      6
    );

  /*
   * Initial dealer visual placement.
   */
  dealer.position = {
    x:
      0.5,

    y:
      DESIGN.dealer.y,
  };

  dealer.targetPosition = {
    x:
      0.5,

    y:
      DESIGN.dealer.y,
  };

  /*
   * Initial hand states.
   */
  players.forEach(
    (
      player
    ) => {
      player.hand.x =
        player.visual.position.x;

      player.hand.y =
        player.visual.position.y -
        0.055;

      player.hand.rotation =
        seatRotation(
          player.seat
        );
    }
  );

  return {
    table,

    dealer,

    deck,

    seats,

    players,

    activeSeat:
      human?.seat ??
      3,

    focusedSeat:
      human?.seat ??
      3,

    bettingOpen:
      true,

    cardsVisible:
      true,

    chipsVisible:
      true,
  };
}


/* ==========================================================================
   CARD UTILITIES
   ========================================================================== */

export function getCardValue(
  rank: CardRank
): number {
  switch (
    rank
  ) {
    case "A":
      return 11;

    case "K":
    case "Q":
    case "J":
      return 10;

    default:
      return Number(
        rank
      );
  }
}


export function getSuitColor(
  suit: Suit
): string {
  return (
    suit === "hearts" ||
    suit === "diamonds"
  )
    ? COLORS.red
    : COLORS.blackSuit;
}


export function getSuitGlyph(
  suit: Suit
): string {
  switch (
    suit
  ) {
    case "spades":
      return "♠";

    case "hearts":
      return "♥";

    case "diamonds":
      return "♦";

    case "clubs":
      return "♣";
  }
}


/* ==========================================================================
   CHIP UTILITIES
   ========================================================================== */

export function getChipColor(
  value: number
): ChipColor {
  if (value <= 5) {
    return "red";
  }

  if (value <= 25) {
    return "green";
  }

  if (value <= 100) {
    return "black";
  }

  if (value <= 500) {
    return "blue";
  }

  return "gold";
}


export function getChipHex(
  color: ChipColor
): string {
  switch (
    color
  ) {
    case "red":
      return COLORS.chipRed;

    case "blue":
      return COLORS.chipBlue;

    case "green":
      return COLORS.chipGreen;

    case "black":
      return COLORS.chipBlack;

    case "ivory":
      return COLORS.chipIvory;

    case "gold":
      return COLORS.chipGold;
  }
}


/* ==========================================================================
   SEAT UTILITIES
   ========================================================================== */

export function getSeatPosition(
  seat: number
): {
  x: number;
  y: number;
  angle: number;
  radius: number;
} {
  switch (
    seat
  ) {
    case 1:
      return {
        x:
          0.16,

        y:
          0.70,

        angle:
          -0.08,

        radius:
          0.04,
      };

    case 2:
      return {
        x:
          0.31,

        y:
          0.75,

        angle:
          -0.04,

        radius:
          0.035,
      };

    case 3:
      return {
        x:
          0.50,

        y:
          0.79,

        angle:
          0,

        radius:
          0.04,
      };

    case 4:
      return {
        x:
          0.69,

        y:
          0.75,

        angle:
          0.04,

        radius:
          0.035,
      };

    case 5:
      return {
        x:
          0.84,

        y:
          0.70,

        angle:
          0.08,

        radius:
          0.04,
      };

    default:
      return {
        x:
          0.5,

        y:
          0.78,

        angle:
          0,

        radius:
          0.04,
      };
  }
}


export function seatToCharacterPosition(
  seat: Seat
): Vec2 {
  return {
    x:
      seat.x,

    y:
      seat.y -
      0.075,
  };
}


export function seatRotation(
  seat: number
): number {
  switch (
    seat
  ) {
    case 1:
      return -0.08;

    case 2:
      return -0.04;

    case 3:
      return 0;

    case 4:
      return 0.04;

    case 5:
      return 0.08;

    default:
      return 0;
  }
}


/* ==========================================================================
   PLAYER VISUAL UTILITIES
   ========================================================================== */

export function getPresentationForSeat(
  seat: number
): GenderPresentation {
  switch (
    seat
  ) {
    case 2:
    case 5:
      return "feminine";

    case 1:
    case 4:
      return "masculine";

    case 3:
    default:
      return "neutral";
  }
}


export function getPlayerJacket(
  seat: number
): string {
  switch (
    seat
  ) {
    case 2:
      return "#25201D";

    case 4:
      return "#1D2630";

    case 1:
      return "#171C19";

    case 5:
      return "#20231F";

    case 3:
    default:
      return COLORS.jacket;
  }
}


/* ==========================================================================
   BEHAVIOR UTILITIES
   ========================================================================== */

export function getDefaultBehavior(
  seat: number
): PlayerBehavior {
  switch (
    seat
  ) {
    case 1:
      return "conservative";

    case 2:
      return "nervous";

    case 3:
      return "balanced";

    case 4:
      return "aggressive";

    case 5:
      return "casual";

    default:
      return "balanced";
  }
}


/* ==========================================================================
   ID
   ========================================================================== */

let entityCounter = 0;

export function createId(
  prefix: string
): string {
  entityCounter +=
    1;

  return (
    `${prefix}-` +
    `${Date.now().toString(36)}-` +
    `${entityCounter.toString(36)}`
  );
}


/* ==========================================================================
   VISUAL SEED
   ========================================================================== */

export function createVisualSeed(): number {
  /*
   * Keep the visual seed bounded and easy to use in procedural renderers.
   */
  return Math.floor(
    Math.random() *
      1_000_000
  );
}


/* ==========================================================================
   MATH
   ========================================================================== */

export function clamp(
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


export function lerp(
  a: number,
  b: number,
  t: number
): number {
  return (
    a +
    (b - a) * t
  );
}


export function smoothstep(
  t: number
): number {
  const x =
    clamp(
      t,
      0,
      1
    );

  return (
    x *
    x *
    (3 - 2 * x)
  );
}


export function easeOutCubic(
  t: number
): number {
  const x =
    clamp(
      t,
      0,
      1
    );

  return (
    1 -
    Math.pow(
      1 - x,
      3
    )
  );
}


export function easeInOutCubic(
  t: number
): number {
  const x =
    clamp(
      t,
      0,
      1
    );

  return x <
    0.5
    ? 4 *
        x *
        x *
        x
    : 1 -
        Math.pow(
          -2 * x + 2,
          3
        ) /
          2;
}


/* ==========================================================================
   VECTOR HELPERS
   ========================================================================== */

export function distance(
  a: Vec2,
  b: Vec2
): number {
  const dx =
    b.x - a.x;

  const dy =
    b.y - a.y;

  return Math.sqrt(
    dx * dx +
      dy * dy
  );
}


export function angleBetween(
  a: Vec2,
  b: Vec2
): number {
  return Math.atan2(
    b.y - a.y,
    b.x - a.x
  );
}


export function lerpVec2(
  a: Vec2,
  b: Vec2,
  t: number
): Vec2 {
  return {
    x:
      lerp(
        a.x,
        b.x,
        t
      ),

    y:
      lerp(
        a.y,
        b.y,
        t
      ),
  };
}


/* ==========================================================================
   VISUAL HELPERS
   ========================================================================== */

export function normalizeCardRank(
  rank: string
): CardRank {
  switch (
    rank.toUpperCase()
  ) {
    case "A":
      return "A";

    case "J":
      return "J";

    case "Q":
      return "Q";

    case "K":
      return "K";

    case "10":
      return "10";

    case "2":
    case "3":
    case "4":
    case "5":
    case "6":
    case "7":
    case "8":
    case "9":
      return rank as CardRank;

    default:
      return "A";
  }
}


/* ==========================================================================
   HAND VALUE HELPER
   --------------------------------------------------------------------------
   Useful for later blackjack logic and visual state updates.
   ========================================================================== */

export function calculateHandValue(
  cards: Card[]
): {
  value: number;
  soft: boolean;
  blackjack: boolean;
  busted: boolean;
} {
  let value =
    0;

  let aces =
    0;

  for (
    const card of cards
  ) {
    value +=
      card.value;

    if (
      card.rank ===
      "A"
    ) {
      aces +=
        1;
    }
  }

  while (
    value > 21 &&
    aces > 0
  ) {
    value -=
      10;

    aces -=
      1;
  }

  const soft =
    cards.some(
      (
        card
      ) =>
        card.rank ===
        "A"
    ) &&
    value <= 21 &&
    cards.reduce(
      (
        total,
        card
      ) =>
        total +
        card.value,
      0
    ) !== value;

  const blackjack =
    cards.length ===
      2 &&
    value ===
      21;

  return {
    value,

    soft,

    blackjack,

    busted:
      value > 21,
  };
}


/* ==========================================================================
   RESET HELPERS
   ========================================================================== */

export function resetHand(
  hand: Hand
) {
  hand.cards =
    [];

  hand.state =
    "empty";

  hand.value =
    0;

  hand.soft =
    false;

  hand.blackjack =
    false;

  hand.busted =
    false;

  hand.bet =
    0;

  hand.x =
    0;

  hand.y =
    0;

  hand.rotation =
    0;
}


export function resetPlayer(
  player: Player
) {
  resetHand(
    player.hand
  );

  if (
    player.secondaryHand
  ) {
    resetHand(
      player.secondaryHand
    );
  }

  player.secondaryHand =
    null;

  player.bet =
    0;

  player.state =
    "waiting";

  player.mood =
    "neutral";

  player.active =
    true;

  player.eliminated =
    false;
}


/* ==========================================================================
   CHIP STACK FACTORY
   ========================================================================== */

export function createChipStack(
  amount: number,
  x = 0,
  y = 0
): ChipStack {
  const denominations = [
    {
      value:
        100,

      count:
        0,
    },

    {
      value:
        25,

      count:
        0,
    },

    {
      value:
        5,

      count:
        0,
    },

    {
      value:
        1,

      count:
        0,
    },
  ];

  let remaining =
    Math.max(
      0,
      Math.floor(
        amount
      )
    );

  for (
    const denomination of
      denominations
  ) {
    if (
      remaining >=
      denomination.value
    ) {
      denomination.count =
        Math.floor(
          remaining /
            denomination.value
        );

      remaining -=
        denomination.count *
        denomination.value;
    }
  }

  const chips: Chip[] =
    [];

  for (
    const denomination of
      denominations
  ) {
    for (
      let i = 0;
      i <
      denomination.count;
      i += 1
    ) {
      const index =
        chips.length;

      const horizontalOffset =
        (
          index %
          2
        ) *
        0.003;

      const verticalOffset =
        index *
        0.004;

      const rotation =
        (
          index %
            2 ===
          0
            ? -1
            : 1
        ) *
        0.03;

      const chip =
        createChip(
          denomination.value,
          {
            stackIndex:
              index,
          }
        );

      chip.transform =
        createTransform(
          x +
            horizontalOffset,

          y -
            verticalOffset,

          rotation,

          1,

          1
        );

      chip.target = {
        x:
          chip.transform
            .position.x,

        y:
          chip.transform
            .position.y,
      };

      chip.targetRotation =
        rotation;

      chips.push(
        chip
      );
    }
  }

  return {
    id:
      createId(
        "stack"
      ),

    x,

    y,

    chips,

    total:
      amount,

    rotation:
      0,

    visible:
      true,
  };
}


/* ==========================================================================
   FACTORY: COMPLETE CASINO
   ========================================================================== */

export function createCasinoScene(): TableVisualState {
  const scene =
    createTableVisualState();

  /*
   * Initial player chip stacks.
   */
  scene.players.forEach(
    (
      player,
      index
    ) => {
      const defaultBet =
        index === 2
          ? 25
          : index % 2 ===
              0
            ? 15
            : 10;

      player.bet =
        defaultBet;

      player.hand.bet =
        defaultBet;

      player.chips =
        createChipStack(
          defaultBet,

          player.visual.position.x,

          player.visual.position.y +
            0.045
        );

      player.chips.rotation =
        seatRotation(
          player.seat
        );
    }
  );

  /*
   * Dealer begins without visible cards.
   */
  scene.dealer.hand =
    createHand(
      "dealer-hand"
    );

  scene.dealer.hand.x =
    scene.dealer.position.x;

  scene.dealer.hand.y =
    scene.dealer.position.y +
    0.09;

  scene.dealer.hand.rotation =
    0;

  /*
   * Empty initial player hands.
   */
  scene.players.forEach(
    (
      player
    ) => {
      player.hand.state =
        "empty";

      player.hand.cards =
        [];

      player.secondaryHand =
        null;
    }
  );

  return scene;
}


/* ==========================================================================
   EXPORT DEFAULT COLOR / CONFIG PACKAGE
   ========================================================================== */

export const CASINO = {
  COLORS,

  DESIGN,
};