/* ==========================================================================
   BLACKJACK 21 — GAME LOGIC
   --------------------------------------------------------------------------
   Real playable blackjack engine.

   Responsibilities:
   - Shoe / deck management
   - Shuffle
   - Card dealing
   - Hand scoring
   - Blackjack detection
   - Bust detection
   - Hit
   - Stand
   - Double
   - Split
   - Insurance
   - Surrender
   - Dealer rules
   - NPC decisions
   - Round settlement
   - Payout calculation
   - Game action events

   Visual rendering belongs to Renderer.ts.
   Physical animation belongs to Animation.ts.
   Input belongs to Input.ts.

   IMPORTANT
   --------------------------------------------------------------------------
   Entities.ts contains:
     - player.hand
     - player.secondaryHand

   Therefore:
     - normal hand
     - one split
     - maximum 2 simultaneous hands
   ========================================================================== */

import {
  createHand,
  createPlayer,
  createDealer,
  createDeck,
  createChipStack,
  getCardValue,

  type Card,
  type Dealer,
  type Deck,
  type Hand,
  type Player,
  type PlayerBehavior,
  type Table,
  type TableVisualState,
} from "./Entities";


/* ==========================================================================
   TYPES
   ========================================================================== */

export type GameAction =
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
  | "decrease-bet";

export type RoundPhase =
  | "waiting"
  | "betting"
  | "initial-deal"
  | "insurance"
  | "player-turn"
  | "dealer-turn"
  | "settlement"
  | "complete";

export type ResultType =
  | "blackjack"
  | "win"
  | "loss"
  | "push"
  | "bust"
  | "surrender"
  | "insurance-win"
  | "insurance-loss";

export type HandEvaluation = {
  value: number;
  hardValue: number;
  soft: boolean;
  blackjack: boolean;
  bust: boolean;
  cardCount: number;
};

export type Settlement = {
  playerId: string;
  handId: string;

  result: ResultType;

  wager: number;
  payout: number;
  profit: number;

  dealerValue: number;
  playerValue: number;
};

export type ActionResult = {
  success: boolean;
  action: GameAction;
  reason?: string;
  card?: Card;
  hand?: Hand;
  createdHand?: Hand;
  settlement?: Settlement[];
};

export type BlackjackEventName =
  | "round:start"
  | "round:phase"
  | "bet:change"
  | "cards:deal"
  | "card:draw"
  | "card:flip"
  | "player:turn"
  | "player:action"
  | "dealer:turn"
  | "dealer:action"
  | "round:settle"
  | "round:complete"
  | "error";

export type BlackjackEvent = {
  name: BlackjackEventName;
  timestamp: number;
  detail: Record<string, unknown>;
};

export type BlackjackListener = (
  event: BlackjackEvent
) => void;


/* ==========================================================================
   CONSTANTS
   ========================================================================== */

const DEFAULT_DECKS = 6;

const DEFAULT_MIN_BET = 5;

const DEFAULT_MAX_BET = 500;

const DEFAULT_BANKROLL = 1250;

const DEFAULT_DEALER_STANDS_ON = 17;

const DEFAULT_BLACKJACK_PAYOUT = 1.5;

const INSURANCE_PAYOUT_MULTIPLIER = 2;

const SURRENDER_RETURN_MULTIPLIER = 0.5;

const MAX_SPLIT_HANDS = 2;

const DEFAULT_DOUBLE_AFTER_SPLIT = true;

const DEFAULT_ALLOW_INSURANCE = true;

const DEFAULT_ALLOW_SURRENDER = false;

const DEFAULT_SPLIT_ACES_ONE_CARD = true;


/* ==========================================================================
   MAIN CLASS
   ========================================================================== */

export class Blackjack {

  /* ------------------------------------------------------------------------
     TABLE
     ------------------------------------------------------------------------ */

  readonly table: Table;


  /* ------------------------------------------------------------------------
     PARTICIPANTS
     ------------------------------------------------------------------------ */

  readonly dealer: Dealer;

  readonly players: Player[];


  /* ------------------------------------------------------------------------
     SHOE
     ------------------------------------------------------------------------ */

  deck: Deck;

  discardPile: Card[] = [];


  /* ------------------------------------------------------------------------
     ROUND
     ------------------------------------------------------------------------ */

  phase: RoundPhase = "waiting";

  activeSeat = -1;

  activeHandIndex = 0;

  roundNumber = 0;


  /* ------------------------------------------------------------------------
     BETTING
     ------------------------------------------------------------------------ */

  pendingBets =
    new Map<string, number>();


  /* ------------------------------------------------------------------------
     INSURANCE
     ------------------------------------------------------------------------ */

  insuranceBets =
    new Map<string, number>();

  insuranceDecisions =
    new Set<string>();


  /* ------------------------------------------------------------------------
     SPECIAL HAND STATE
     ------------------------------------------------------------------------ */

  surrenderedHands =
    new Set<string>();


  /* ------------------------------------------------------------------------
     RESULT
     ------------------------------------------------------------------------ */

  settlements: Settlement[] = [];


  /* ------------------------------------------------------------------------
     SETTINGS
     ------------------------------------------------------------------------ */

  readonly decks: number;

  readonly minimumBet: number;

  readonly maximumBet: number;

  readonly allowInsurance: boolean;

  readonly allowSurrender: boolean;

  readonly allowDoubleAfterSplit: boolean;

  readonly dealerHitsSoft17: boolean;

  readonly maxSplitHands: number;

  readonly blackjackPayout: number;

  readonly splitAcesOneCard: boolean;


  /* ------------------------------------------------------------------------
     EVENT BUS
     ------------------------------------------------------------------------ */

  private listeners =
    new Map<
      BlackjackEventName,
      Set<BlackjackListener>
    >();


  /* ------------------------------------------------------------------------
     RANDOM
     ------------------------------------------------------------------------ */

  private random: () => number;


  /* ------------------------------------------------------------------------
     STATE FLAGS
     ------------------------------------------------------------------------ */

  private dealerHoleCardRevealed = false;

  private dealerTurnCompleted = false;

  private roundLocked = false;


  /* ==========================================================================
     CONSTRUCTOR
     ========================================================================== */

  constructor(
    options: {
      decks?: number;

      minimumBet?: number;

      maximumBet?: number;

      allowInsurance?: boolean;

      allowSurrender?: boolean;

      allowDoubleAfterSplit?: boolean;

      dealerHitsSoft17?: boolean;

      maxSplitHands?: number;

      blackjackPayout?: number;

      splitAcesOneCard?: boolean;

      random?: () => number;

      table?: Partial<Table>;

      players?: Player[];

      dealerName?: string;
    } = {}
  ) {

    /* ------------------------------------------------------------------------
       TABLE
       ------------------------------------------------------------------------ */

    const tableMinimumBet =
      options.table?.minimumBet ??
      DEFAULT_MIN_BET;

    const tableMaximumBet =
      options.table?.maximumBet ??
      DEFAULT_MAX_BET;

    const tableBlackjackPayout =
      options.table?.blackjackPayout ??
      DEFAULT_BLACKJACK_PAYOUT;

    this.table = {
      x:
        options.table?.x ??
        0.5,

      y:
        options.table?.y ??
        0.61,

      width:
        options.table?.width ??
        0.92,

      height:
        options.table?.height ??
        0.68,

      rotation:
        options.table?.rotation ??
        0,

      scale:
        options.table?.scale ??
        1,

      feltPatternSeed:
        options.table?.feltPatternSeed ??
        987321,

      dealerRailHeight:
        options.table?.dealerRailHeight ??
        0.08,

      bettingAreaY:
        options.table?.bettingAreaY ??
        0.76,

      playerAreaY:
        options.table?.playerAreaY ??
        0.68,

      centerAreaY:
        options.table?.centerAreaY ??
        0.55,

      minimumBet:
        tableMinimumBet,

      maximumBet:
        tableMaximumBet,

      blackjackPayout:
        tableBlackjackPayout,

      dealerStandsOn:
        options.table?.dealerStandsOn ??
        DEFAULT_DEALER_STANDS_ON,

      dealerHitsSoft17:
        options.table?.dealerHitsSoft17 ??
        false,

      doubleAfterSplit:
        options.table?.doubleAfterSplit ??
        DEFAULT_DOUBLE_AFTER_SPLIT,

      surrenderAllowed:
        options.table?.surrenderAllowed ??
        DEFAULT_ALLOW_SURRENDER,
    };


    /* ------------------------------------------------------------------------
       SETTINGS
       ------------------------------------------------------------------------ */

    this.decks =
      Math.max(
        1,
        Math.floor(
          options.decks ??
          DEFAULT_DECKS
        )
      );

    this.minimumBet =
      Math.max(
        1,
        Math.floor(
          options.minimumBet ??
          tableMinimumBet
        )
      );

    this.maximumBet =
      Math.max(
        this.minimumBet,
        Math.floor(
          options.maximumBet ??
          tableMaximumBet
        )
      );

    this.allowInsurance =
      options.allowInsurance ??
      DEFAULT_ALLOW_INSURANCE;

    this.allowSurrender =
      options.allowSurrender ??
      (
        options.table?.surrenderAllowed ??
        DEFAULT_ALLOW_SURRENDER
      );

    this.allowDoubleAfterSplit =
      options.allowDoubleAfterSplit ??
      (
        options.table?.doubleAfterSplit ??
        DEFAULT_DOUBLE_AFTER_SPLIT
      );

    this.dealerHitsSoft17 =
      options.dealerHitsSoft17 ??
      (
        options.table?.dealerHitsSoft17 ??
        false
      );

    /*
     * Entities.ts currently supports only two hands:
     * primary + secondary.
     */
    this.maxSplitHands =
      Math.min(
        2,
        Math.max(
          2,
          Math.floor(
            options.maxSplitHands ??
            MAX_SPLIT_HANDS
          )
        )
      );

    this.blackjackPayout =
      Number.isFinite(
        options.blackjackPayout
      )
        ? Math.max(
            1,
            options.blackjackPayout ??
            tableBlackjackPayout
          )
        : tableBlackjackPayout;

    this.splitAcesOneCard =
      options.splitAcesOneCard ??
      DEFAULT_SPLIT_ACES_ONE_CARD;

    this.random =
      typeof options.random === "function"
        ? options.random
        : Math.random;


    /* ------------------------------------------------------------------------
       DEALER
       ------------------------------------------------------------------------ */

    this.dealer =
      createDealer(
        options.dealerName ??
        "EMMA"
      );


    /* ------------------------------------------------------------------------
       PLAYERS
       ------------------------------------------------------------------------ */

    this.players =
      options.players ?? [
        createPlayer(
          1,
          "MICHAEL",
          "npc"
        ),

        createPlayer(
          2,
          "OLIVIA",
          "npc"
        ),

        createPlayer(
          3,
          "PLAYER",
          "human"
        ),

        createPlayer(
          4,
          "DANIEL",
          "npc"
        ),

        createPlayer(
          5,
          "JULIA",
          "npc"
        ),
      ];


    /* ------------------------------------------------------------------------
       SHOE
       ------------------------------------------------------------------------ */

    this.deck =
      createDeck(
        this.decks
      );

    this.shuffleShoe();


    /* ------------------------------------------------------------------------
       INITIAL PLAYER STATE
       ------------------------------------------------------------------------ */

    for (
      const player of this.players
    ) {

      if (
        !Number.isFinite(
          player.balance
        ) ||
        player.balance < 0
      ) {
        player.balance =
          DEFAULT_BANKROLL;
      }

      if (
        player.balance === 0
      ) {
        player.active = false;
        player.eliminated = true;
        player.state = "loser";
      } else {
        player.active = true;
        player.eliminated = false;
        player.state = "waiting";
      }

      player.hand =
        createHand(
          `hand-${player.seat}-1`
        );

      player.secondaryHand =
        null;

      player.bet =
        0;

      player.chips =
        createChipStack(
          0
        );

      this.pendingBets.set(
        player.id,
        0
      );

      this.insuranceBets.set(
        player.id,
        0
      );
    }


    this.dealer.hand =
      createHand(
        "dealer-hand"
      );
  }


  /* ==========================================================================
     EVENT SYSTEM
     ========================================================================== */

  on(
    name: BlackjackEventName,
    listener: BlackjackListener
  ) {
    let bucket =
      this.listeners.get(
        name
      );

    if (!bucket) {
      bucket =
        new Set();

      this.listeners.set(
        name,
        bucket
      );
    }

    bucket.add(
      listener
    );

    return () => {
      bucket?.delete(
        listener
      );
    };
  }


  off(
    name: BlackjackEventName,
    listener: BlackjackListener
  ) {
    this.listeners
      .get(name)
      ?.delete(
        listener
      );
  }


  private emit(
    name: BlackjackEventName,
    detail: Record<string, unknown> = {}
  ) {
    const event: BlackjackEvent = {
      name,
      timestamp: Date.now(),
      detail,
    };

    this.listeners
      .get(name)
      ?.forEach(
        listener => {
          try {
            listener(event);
          } catch {
            /*
             * Listener failure must never break the engine.
             */
          }
        }
      );

    if (
      typeof window !==
      "undefined"
    ) {
      window.dispatchEvent(
        new CustomEvent(
          `blackjack:${name}`,
          {
            detail,
          }
        )
      );
    }
  }


  /* ==========================================================================
     SHOE
     ========================================================================== */

  shuffleShoe() {
    const cards =
      this.deck.cards;

    for (
      let i =
        cards.length - 1;
      i > 0;
      i -= 1
    ) {
      const randomValue =
        this.random();

      const normalizedRandom =
        Number.isFinite(
          randomValue
        )
          ? Math.min(
              0.999999999999,
              Math.max(
                0,
                randomValue
              )
            )
          : Math.random();

      const j =
        Math.floor(
          normalizedRandom *
          (i + 1)
        );

      const temp =
        cards[i];

      cards[i] =
        cards[j];

      cards[j] =
        temp;
    }

    this.deck.remaining =
      cards.length;

    this.emit(
      "round:phase",
      {
        phase:
          this.phase,

        shoeRemaining:
          this.deck.remaining,
      }
    );
  }


  private rebuildShoe() {
    this.deck =
      createDeck(
        this.decks
      );

    this.discardPile =
      [];

    this.shuffleShoe();
  }


  private needsShuffle() {
    const totalCards =
      this.decks *
      52;

    return (
      this.deck.remaining <=
      Math.floor(
        totalCards *
        0.25
      )
    );
  }


  /* ==========================================================================
     DRAW / DISCARD
     ========================================================================== */

  drawCard(
    faceUp = true
  ): Card {
    /*
     * If the shoe is low, rebuild before drawing.
     */
    if (
      this.needsShuffle()
    ) {
      this.rebuildShoe();
    }

    /*
     * Defensive fallback.
     */
    if (
      this.deck.cards.length ===
      0
    ) {
      this.rebuildShoe();
    }

    const card =
      this.deck.cards.pop();

    if (!card) {
      throw new Error(
        "Blackjack shoe is empty."
      );
    }

    card.faceUp =
      faceUp;

    card.state =
      "dealing";

    card.selected =
      false;

    card.highlighted =
      false;

    this.deck.remaining =
      this.deck.cards.length;

    this.emit(
      "card:draw",
      {
        card,
        faceUp,
        remaining:
          this.deck.remaining,
      }
    );

    return card;
  }


  private discardCard(
    card: Card
  ) {
    card.state =
      "discarded";

    this.discardPile.push(
      card
    );

    this.deck.discardCount =
      this.discardPile.length;
  }


  /* ==========================================================================
     HAND EVALUATION
     ========================================================================== */

  evaluateHand(
    hand: Hand
  ): HandEvaluation {
    let total =
      0;

    let aceCount =
      0;

    for (
      const card of hand.cards
    ) {
      const value =
        getCardValue(
          card.rank
        );

      total +=
        value;

      if (
        card.rank ===
        "A"
      ) {
        aceCount +=
          1;
      }
    }

    /*
     * Convert aces from 11 to 1 when required.
     */
    let value =
      total;

    let acesToReduce =
      aceCount;

    while (
      value > 21 &&
      acesToReduce > 0
    ) {
      value -=
        10;

      acesToReduce -=
        1;
    }

    /*
     * Hard value means every ace is valued as 1.
     */
    const hardValue =
      Math.max(
        0,
        total -
        aceCount * 10
      );

    /*
     * Soft means at least one ace is still being counted as 11.
     */
    const soft =
      aceCount > 0 &&
      value <= 21 &&
      value >
        hardValue;

    const blackjack =
      hand.cards.length ===
        2 &&
      value ===
        21;

    const bust =
      value >
      21;

    return {
      value,

      hardValue,

      soft,

      blackjack,

      bust,

      cardCount:
        hand.cards.length,
    };
  }


  calculateHandValue(
    hand: Hand
  ) {
    return this.evaluateHand(
      hand
    ).value;
  }


  isBlackjack(
    hand: Hand
  ) {
    return this.evaluateHand(
      hand
    ).blackjack;
  }


  isBust(
    hand: Hand
  ) {
    return this.evaluateHand(
      hand
    ).bust;
  }


  isSoft(
    hand: Hand
  ) {
    return this.evaluateHand(
      hand
    ).soft;
  }


  updateHandEvaluation(
    hand: Hand
  ) {
    const evaluation =
      this.evaluateHand(
        hand
      );

    hand.value =
      evaluation.value;

    hand.soft =
      evaluation.soft;

    hand.blackjack =
      evaluation.blackjack;

    hand.busted =
      evaluation.bust;

    if (
      evaluation.bust
    ) {
      hand.state =
        "busted";

      return;
    }

    if (
      evaluation.blackjack
    ) {
      hand.state =
        "blackjack";

      return;
    }

    /*
     * Don't overwrite finished states.
     */
    if (
      hand.state ===
        "standing" ||
      hand.state ===
        "winner" ||
      hand.state ===
        "loser" ||
      hand.state ===
        "push"
    ) {
      return;
    }

    hand.state =
      "playing";
  }


  /* ==========================================================================
     RESET HELPERS
     ========================================================================== */

  private resetHandsOnly() {
    for (
      const player of this.players
    ) {
      player.hand.cards =
        [];

      player.hand.state =
        "empty";

      player.hand.value =
        0;

      player.hand.soft =
        false;

      player.hand.blackjack =
        false;

      player.hand.busted =
        false;

      player.hand.bet =
        player.bet;

      player.secondaryHand =
        null;

      /*
       * Player may be part of current round if they have a valid bet.
       */
      if (
        player.bet >=
          this.minimumBet &&
        player.active &&
        !player.eliminated
      ) {
        player.state =
          "playing";
      } else {
        player.state =
          "waiting";
      }
    }

    this.dealer.hand.cards =
      [];

    this.dealer.hand.state =
      "empty";

    this.dealer.hand.value =
      0;

    this.dealer.hand.soft =
      false;

    this.dealer.hand.blackjack =
      false;

    this.dealer.hand.busted =
      false;
  }


  private resetDealerForRound() {
    this.dealer.hand =
      createHand(
        "dealer-hand"
      );

    this.dealer.state =
      "idle";

    this.dealer.pose =
      "neutral";

    this.dealer.position = {
      x:
        0.5,

      y:
        0.30,
    };

    this.dealer.targetPosition = {
      x:
        0.5,

      y:
        0.30,
    };

    this.dealer.currentSeat =
      null;

    this.dealer.attention =
      "table";

    this.dealerHoleCardRevealed =
      false;

    this.dealerTurnCompleted =
      false;

    this.dealer.speaking =
      false;

    this.dealer.speechText =
      "";

    this.dealer.speechUntil =
      0;
  }


  /* ==========================================================================
     BETTING
     ========================================================================== */

  setBet(
    playerId: string,
    amount: number
  ): ActionResult {
    const player =
      this.getPlayer(
        playerId
      );

    if (!player) {
      return this.fail(
        "increase-bet",
        "Player not found."
      );
    }

    if (
      this.phase !==
        "waiting" &&
      this.phase !==
        "betting" &&
      this.phase !==
        "complete"
    ) {
      return this.fail(
        "increase-bet",
        "Betting is closed."
      );
    }

    if (
      !player.active ||
      player.eliminated
    ) {
      return this.fail(
        "increase-bet",
        "Player is not active."
      );
    }

    if (
      player.balance <
      this.minimumBet
    ) {
      return this.fail(
        "increase-bet",
        "Insufficient balance."
      );
    }

    const safeAmount =
      this.clampBet(
        amount,
        player.balance
      );

    /*
     * allow clearing through clearBet(), not through setBet().
     */
    if (
      safeAmount <
      this.minimumBet
    ) {
      return this.fail(
        "increase-bet",
        `Minimum bet is ${this.minimumBet}.`
      );
    }

    player.bet =
      safeAmount;

    player.hand.bet =
      safeAmount;

    player.chips =
      createChipStack(
        safeAmount
      );

    this.pendingBets.set(
      player.id,
      safeAmount
    );

    this.emit(
      "bet:change",
      {
        playerId:
          player.id,

        amount:
          safeAmount,

        balance:
          player.balance,
      }
    );

    return {
      success:
        true,

      action:
        "increase-bet",
    };
  }


  increaseBet(
    playerId: string,
    step = 5
  ): ActionResult {
    const player =
      this.getPlayer(
        playerId
      );

    if (!player) {
      return this.fail(
        "increase-bet",
        "Player not found."
      );
    }

    const safeStep =
      Number.isFinite(
        step
      )
        ? Math.max(
            1,
            Math.floor(
              step
            )
          )
        : 5;

    const current =
      player.bet >=
      this.minimumBet
        ? player.bet
        : 0;

    const next =
      current +
      safeStep;

    return this.setBet(
      player.id,
      next
    );
  }


  decreaseBet(
    playerId: string,
    step = 5
  ): ActionResult {
    const player =
      this.getPlayer(
        playerId
      );

    if (!player) {
      return this.fail(
        "decrease-bet",
        "Player not found."
      );
    }

    if (
      this.phase !==
        "waiting" &&
      this.phase !==
        "betting" &&
      this.phase !==
        "complete"
    ) {
      return this.fail(
        "decrease-bet",
        "Betting is closed."
      );
    }

    const safeStep =
      Number.isFinite(
        step
      )
        ? Math.max(
            1,
            Math.floor(
              step
            )
          )
        : 5;

    const next =
      Math.max(
        0,
        player.bet -
        safeStep
      );

    if (
      next ===
      0
    ) {
      player.bet =
        0;

      player.hand.bet =
        0;

      player.chips =
        createChipStack(
          0
        );

      this.pendingBets.set(
        player.id,
        0
      );

      this.emit(
        "bet:change",
        {
          playerId:
            player.id,

          amount:
            0,

          balance:
            player.balance,
        }
      );

      return {
        success:
          true,

        action:
          "decrease-bet",
      };
    }

    return this.setBet(
      player.id,
      next
    );
  }


  clearBet(
    playerId: string
  ): ActionResult {
    const player =
      this.getPlayer(
        playerId
      );

    if (!player) {
      return this.fail(
        "clear-bet",
        "Player not found."
      );
    }

    if (
      this.phase !==
        "waiting" &&
      this.phase !==
        "betting" &&
      this.phase !==
        "complete"
    ) {
      return this.fail(
        "clear-bet",
        "Betting is closed."
      );
    }

    player.bet =
      0;

    player.hand.bet =
      0;

    player.chips =
      createChipStack(
        0
      );

    this.pendingBets.set(
      player.id,
      0
    );

    this.emit(
      "bet:change",
      {
        playerId:
          player.id,

        amount:
          0,

        balance:
          player.balance,
      }
    );

    return {
      success:
        true,

      action:
        "clear-bet",
    };
  }


  private clampBet(
    amount: number,
    balance: number
  ) {
    if (
      !Number.isFinite(
        amount
      )
    ) {
      return 0;
    }

    const max =
      Math.min(
        this.maximumBet,
        Math.max(
          0,
          Math.floor(
            balance
          )
        )
      );

    return Math.floor(
      Math.max(
        0,
        Math.min(
          amount,
          max
        )
      )
    );
  }


  /* ==========================================================================
     ROUND START
     ========================================================================== */

  startRound(): ActionResult {
    if (
      this.roundLocked
    ) {
      return this.fail(
        "deal",
        "Round is already in progress."
      );
    }

    if (
      this.phase !==
        "waiting" &&
      this.phase !==
        "betting" &&
      this.phase !==
        "complete"
    ) {
      return this.fail(
        "deal",
        "The table is currently busy."
      );
    }

    /*
     * NPCs choose their wagers first.
     */
    this.prepareNPCBets();

    const human =
      this.getHumanPlayer();

    if (!human) {
      return this.fail(
        "deal",
        "Human player not found."
      );
    }

    if (
      !human.active ||
      human.eliminated
    ) {
      return this.fail(
        "deal",
        "Human player is eliminated."
      );
    }

    if (
      human.bet <
      this.minimumBet
    ) {
      this.phase =
        "betting";

      this.setRoundState(
        "betting"
      );

      return this.fail(
        "deal",
        `Place at least a ${this.minimumBet} bet.`
      );
    }

    if (
      human.bet >
      human.balance
    ) {
      return this.fail(
        "deal",
        "Bet exceeds available balance."
      );
    }

    /*
     * A round is now locked.
     */
    this.roundLocked =
      true;

    this.roundNumber +=
      1;

    this.resetHandsOnly();

    this.resetDealerForRound();

    this.insuranceBets.clear();

    this.insuranceDecisions.clear();

    this.surrenderedHands.clear();

    this.setRoundState(
      "initial-deal"
    );

    this.emit(
      "round:start",
      {
        round:
          this.roundNumber,

        humanBet:
          human.bet,

        playerCount:
          this.getBettingPlayers().length,
      }
    );

    this.initialDeal();

    return {
      success:
        true,

      action:
        "deal",
    };
  }


  private prepareNPCBets() {
    for (
      const player of this.players
    ) {
      if (
        player.type !==
        "npc"
      ) {
        continue;
      }

      if (
        !player.active ||
        player.eliminated
      ) {
        continue;
      }

      if (
        player.balance <
        this.minimumBet
      ) {
        player.active =
          false;

        player.eliminated =
          true;

        player.bet =
          0;

        player.hand.bet =
          0;

        player.chips =
          createChipStack(
            0
          );

        player.state =
          "loser";

        continue;
      }

      const existing =
        player.bet;

      if (
        existing >=
          this.minimumBet &&
        existing <=
          this.maximumBet &&
        existing <=
          player.balance
      ) {
        this.pendingBets.set(
          player.id,
          existing
        );

        continue;
      }

      const bet =
        this.chooseNPCBet(
          player.balance,
          player.behavior
        );

      player.bet =
        bet;

      player.hand.bet =
        bet;

      player.chips =
        createChipStack(
          bet
        );

      this.pendingBets.set(
        player.id,
        bet
      );

      this.emit(
        "bet:change",
        {
          playerId:
            player.id,

          amount:
            bet,

          balance:
            player.balance,
        }
      );
    }
  }


  private chooseNPCBet(
    balance: number,
    behavior: PlayerBehavior
  ) {
    if (
      balance <
      this.minimumBet
    ) {
      return 0;
    }

    let base =
      this.minimumBet;

    switch (
      behavior
    ) {
      case "conservative":
        base =
          this.minimumBet;
        break;

      case "balanced":
        base =
          this.minimumBet *
          3;
        break;

      case "aggressive":
        base =
          this.minimumBet *
          6;
        break;

      case "casual":
        base =
          this.minimumBet *
          2;
        break;

      case "nervous":
        base =
          this.minimumBet;
        break;
    }

    base =
      Math.min(
        base,
        this.maximumBet,
        balance
      );

    if (
      base <
      this.minimumBet
    ) {
      return 0;
    }

    return Math.floor(
      base
    );
  }


  /* ==========================================================================
     PLAYER GROUP HELPERS
     ========================================================================== */

  /*
   * Players eligible to place a bet before a round.
   */
  private getBettingPlayers() {
    return this.players.filter(
      player =>
        player.active &&
        !player.eliminated &&
        player.bet >=
          this.minimumBet &&
        player.bet <=
          player.balance
    );
  }


  /*
   * Players that are actually participating in the current round.
   *
   * IMPORTANT:
   * Their balance has already had the wager deducted,
   * therefore we MUST NOT use `player.bet <= player.balance` here.
   */
  private getRoundPlayers() {
    return this.players.filter(
      player =>
        player.active &&
        !player.eliminated &&
        player.hand.cards.length >
          0 &&
        player.hand.bet >=
          this.minimumBet
    );
  }


  /* ==========================================================================
     INITIAL DEAL
     ========================================================================== */

  private initialDeal() {
    const activePlayers =
      this.getBettingPlayers();

    if (
      activePlayers.length ===
      0
    ) {
      this.roundLocked =
        false;

      this.setRoundState(
        "betting"
      );

      this.fail(
        "deal",
        "No eligible players."
      );

      return;
    }

    /*
     * Deduct wagers.
     */
    for (
      const player of activePlayers
    ) {
      player.balance -=
        player.bet;

      player.hand.bet =
        player.bet;

      player.chips =
        createChipStack(
          player.bet
        );

      player.state =
        "playing";
    }

    /*
     * Round-robin:
     *
     * P1
     * P2
     * P3
     * Dealer up
     * P1
     * P2
     * P3
     * Dealer hole
     */
    for (
      const player of activePlayers
    ) {
      this.dealToPlayer(
        player
      );
    }

    this.dealToDealer(
      true
    );

    for (
      const player of activePlayers
    ) {
      this.dealToPlayer(
        player
      );
    }

    this.dealToDealer(
      false
    );

    this.emit(
      "cards:deal",
      {
        playerCount:
          activePlayers.length,

        dealerCards:
          this.dealer.hand.cards.length,
      }
    );

    /*
     * Detect player natural blackjacks.
     */
    for (
      const player of activePlayers
    ) {
      this.updateHandEvaluation(
        player.hand
      );

      if (
        player.hand.blackjack
      ) {
        player.state =
          "blackjack";
      }
    }

    /*
     * Evaluate dealer including hidden card.
     */
    this.updateHandEvaluation(
      this.dealer.hand
    );

    /*
     * Insurance only when dealer upcard is an ace.
     */
    if (
      this.allowInsurance &&
      this.isDealerUpcardAce()
    ) {
      this.beginInsuranceWindow(
        activePlayers
      );

      return;
    }

    /*
     * Dealer blackjack before normal player turns.
     */
    if (
      this.isBlackjack(
        this.dealer.hand
      )
    ) {
      this.beginDealerTurn(
        true
      );

      return;
    }

    this.beginPlayerTurns(
      activePlayers
    );
  }


  private dealToPlayer(
    player: Player
  ) {
    const card =
      this.drawCard(
        true
      );

    player.hand.cards.push(
      card
    );

    card.state =
      "dealing";

    card.zIndex =
      player.hand.cards.length;

    this.updateHandEvaluation(
      player.hand
    );
  }


  private dealToDealer(
    faceUp: boolean
  ) {
    const card =
      this.drawCard(
        faceUp
      );

    this.dealer.hand.cards.push(
      card
    );

    card.state =
      "dealing";

    card.zIndex =
      this.dealer.hand.cards.length;

    this.updateHandEvaluation(
      this.dealer.hand
    );

    if (
      !faceUp
    ) {
      this.dealerHoleCardRevealed =
        false;
    }
  }


  /* ==========================================================================
     INSURANCE
     ========================================================================== */

  private beginInsuranceWindow(
    activePlayers: Player[]
  ) {
    this.insuranceBets.clear();

    this.insuranceDecisions.clear();

    for (
      const player of activePlayers
    ) {
      this.insuranceBets.set(
        player.id,
        0
      );

      /*
       * Natural blackjack cannot meaningfully take insurance here.
       */
      if (
        player.hand.blackjack
      ) {
        this.insuranceDecisions.add(
          player.id
        );
      }
    }

    this.setRoundState(
      "insurance"
    );

    /*
     * NPC decisions.
     */
    for (
      const player of activePlayers
    ) {
      if (
        player.type !==
        "npc" ||
        player.hand.blackjack
      ) {
        continue;
      }

      this.resolveNPCInsurance(
        player
      );
    }

    this.tryFinishInsuranceWindow();
  }


  private resolveNPCInsurance(
    player: Player
  ) {
    if (
      this.phase !==
      "insurance"
    ) {
      return;
    }

    if (
      this.insuranceDecisions.has(
        player.id
      )
    ) {
      return;
    }

    const maximum =
      Math.min(
        Math.floor(
          player.bet / 2
        ),
        Math.max(
          0,
          Math.floor(
            player.balance
          )
        )
      );

    /*
     * Aggressive NPCs take insurance.
     * Others decline.
     */
    if (
      player.behavior ===
        "aggressive" &&
      maximum > 0
    ) {
      this.takeInsurance(
        player.id,
        maximum
      );

      return;
    }

    this.declineInsurance(
      player.id
    );
  }


  takeInsurance(
    playerId: string,
    amount?: number
  ): ActionResult {
    if (
      this.phase !==
      "insurance"
    ) {
      return this.fail(
        "insurance",
        "Insurance is not available."
      );
    }

    const player =
      this.getPlayer(
        playerId
      );

    if (!player) {
      return this.fail(
        "insurance",
        "Player not found."
      );
    }

    if (
      !this.allowInsurance
    ) {
      return this.fail(
        "insurance",
        "Insurance is disabled."
      );
    }

    if (
      this.insuranceDecisions.has(
        player.id
      )
    ) {
      return this.fail(
        "insurance",
        "Insurance decision already made."
      );
    }

    if (
      player.hand.blackjack
    ) {
      return this.fail(
        "insurance",
        "A natural blackjack does not require insurance."
      );
    }

    const maximum =
      Math.min(
        Math.floor(
          player.bet / 2
        ),
        Math.max(
          0,
          Math.floor(
            player.balance
          )
        )
      );

    const safeAmount =
      Math.min(
        maximum,
        Math.max(
          0,
          Math.floor(
            amount ??
            maximum
          )
        )
      );

    if (
      safeAmount <=
      0
    ) {
      return this.fail(
        "insurance",
        "Insufficient balance for insurance."
      );
    }

    player.balance -=
      safeAmount;

    this.insuranceBets.set(
      player.id,
      safeAmount
    );

    this.insuranceDecisions.add(
      player.id
    );

    this.emit(
      "player:action",
      {
        action:
          "insurance",

        playerId:
          player.id,

        amount:
          safeAmount,
      }
    );

    this.tryFinishInsuranceWindow();

    return {
      success:
        true,

      action:
        "insurance",
    };
  }


  declineInsurance(
    playerId: string
  ): ActionResult {
    if (
      this.phase !==
      "insurance"
    ) {
      return this.fail(
        "decline-insurance",
        "Insurance is not available."
      );
    }

    const player =
      this.getPlayer(
        playerId
      );

    if (!player) {
      return this.fail(
        "decline-insurance",
        "Player not found."
      );
    }

    if (
      this.insuranceDecisions.has(
        player.id
      )
    ) {
      return this.fail(
        "decline-insurance",
        "Insurance decision already made."
      );
    }

    this.insuranceBets.set(
      player.id,
      0
    );

    this.insuranceDecisions.add(
      player.id
    );

    this.emit(
      "player:action",
      {
        action:
          "decline-insurance",

        playerId:
          player.id,
      }
    );

    this.tryFinishInsuranceWindow();

    return {
      success:
        true,

      action:
        "decline-insurance",
    };
  }


  private tryFinishInsuranceWindow() {
    /*
     * IMPORTANT:
     * Use players actually in the round.
     * Do NOT use getActivePlayers(), because balances
     * have already been reduced by the original wagers.
     */
    const eligible =
      this.getRoundPlayers().filter(
        player =>
          !player.hand.blackjack
      );

    const allResolved =
      eligible.every(
        player =>
          this.insuranceDecisions.has(
            player.id
          )
      );

    if (
      !allResolved
    ) {
      return;
    }

    const dealerBlackjack =
      this.isBlackjack(
        this.dealer.hand
      );

    if (
      dealerBlackjack
    ) {
      this.beginDealerTurn(
        true
      );

      return;
    }

    this.beginPlayerTurns(
      this.getRoundPlayers()
    );
  }


  /* ==========================================================================
     PLAYER TURN SYSTEM
     ========================================================================== */

  private beginPlayerTurns(
    activePlayers: Player[]
  ) {
    const playable =
      this.getPlayableEntries(
        activePlayers
      );

    if (
      playable.length ===
      0
    ) {
      this.beginDealerTurn();

      return;
    }

    const first =
      playable[0];

    this.activeSeat =
      first.player.seat;

    this.activeHandIndex =
      first.handIndex;

    this.setRoundState(
      "player-turn"
    );

    this.emit(
      "player:turn",
      {
        playerId:
          first.player.id,

        seat:
          first.player.seat,

        handIndex:
          first.handIndex,
      }
    );

    if (
      first.player.type ===
      "npc"
    ) {
      this.resolveNPCPlayer(
        first.player
      );
    }
  }


  private finishCurrentPlayerTurn(
    player: Player
  ) {
    const currentHand =
      this.getActivePlayerHand(
        player
      );

    if (
      currentHand &&
      !this.handIsFinished(
        currentHand
      )
    ) {
      currentHand.state =
        "standing";
    }

    this.syncPlayerState(
      player
    );

    const next =
      this.nextPlayableEntry();

    if (next) {
      this.activeSeat =
        next.player.seat;

      this.activeHandIndex =
        next.handIndex;

      this.setRoundState(
        "player-turn"
      );

      this.emit(
        "player:turn",
        {
          playerId:
            next.player.id,

          seat:
            next.player.seat,

          handIndex:
            next.handIndex,
        }
      );

      if (
        next.player.type ===
        "npc"
      ) {
        this.resolveNPCPlayer(
          next.player
        );
      }

      return;
    }

    this.beginDealerTurn();
  }


  private getPlayableEntries(
    players: Player[]
  ) {
    const ordered =
      [...players]
        .sort(
          (a, b) =>
            a.seat -
            b.seat
        );

    const entries: Array<{
      player: Player;
      handIndex: number;
    }> = [];

    for (
      const player of ordered
    ) {
      if (
        !player.active ||
        player.eliminated
      ) {
        continue;
      }

      if (
        this.handIsPlayable(
          player.hand
        )
      ) {
        entries.push({
          player,
          handIndex:
            0,
        });
      }

      if (
        player.secondaryHand &&
        this.handIsPlayable(
          player.secondaryHand
        )
      ) {
        entries.push({
          player,
          handIndex:
            1,
        });
      }
    }

    return entries;
  }


  private nextPlayableEntry():
    | {
        player: Player;
        handIndex: number;
      }
    | null {
    const entries =
      this.getPlayableEntries(
        this.getRoundPlayers()
      );

    if (
      entries.length ===
      0
    ) {
      return null;
    }

    const currentIndex =
      entries.findIndex(
        entry =>
          entry.player.seat ===
            this.activeSeat &&
          entry.handIndex ===
            this.activeHandIndex
      );

    if (
      currentIndex >=
      0
    ) {
      return (
        entries[
          currentIndex + 1
        ] ??
        null
      );
    }

    /*
     * Find next seat after current active seat.
     */
    const afterCurrent =
      entries
        .filter(
          entry =>
            entry.player.seat >
            this.activeSeat
        )
        .sort(
          (a, b) =>
            a.player.seat -
            b.player.seat
        );

    if (
      afterCurrent.length >
      0
    ) {
      return afterCurrent[0];
    }

    return entries[0];
  }


  /* ==========================================================================
     HIT
     ========================================================================== */

  hit(
    playerId: string
  ): ActionResult {
    const player =
      this.getPlayer(
        playerId
      );

    if (!player) {
      return this.fail(
        "hit",
        "Player not found."
      );
    }

    if (
      !this.canPlayerAct(
        player,
        "hit"
      )
    ) {
      return this.fail(
        "hit",
        "It is not this player's turn."
      );
    }

    const hand =
      this.getActivePlayerHand(
        player
      );

    if (!hand) {
      return this.fail(
        "hit",
        "No active hand."
      );
    }

    const card =
      this.drawCard(
        true
      );

    hand.cards.push(
      card
    );

    card.state =
      "dealing";

    card.zIndex =
      hand.cards.length;

    this.updateHandEvaluation(
      hand
    );

    this.emit(
      "player:action",
      {
        action:
          "hit",

        playerId:
          player.id,

        handId:
          hand.id,

        card,

        value:
          hand.value,

        bust:
          hand.busted,
      }
    );

    if (
      hand.busted
    ) {
      player.state =
        "busted";

      this.syncPlayerState(
        player
      );

      this.finishCurrentPlayerTurn(
        player
      );
    }

    return {
      success:
        true,

      action:
        "hit",

      card,

      hand,
    };
  }


  /* ==========================================================================
     STAND
     ========================================================================== */

  stand(
    playerId: string
  ): ActionResult {
    const player =
      this.getPlayer(
        playerId
      );

    if (!player) {
      return this.fail(
        "stand",
        "Player not found."
      );
    }

    if (
      !this.canPlayerAct(
        player,
        "stand"
      )
    ) {
      return this.fail(
        "stand",
        "It is not this player's turn."
      );
    }

    const hand =
      this.getActivePlayerHand(
        player
      );

    if (!hand) {
      return this.fail(
        "stand",
        "No active hand."
      );
    }

    hand.state =
      "standing";

    this.syncPlayerState(
      player
    );

    this.emit(
      "player:action",
      {
        action:
          "stand",

        playerId:
          player.id,

        handId:
          hand.id,

        value:
          hand.value,
      }
    );

    this.finishCurrentPlayerTurn(
      player
    );

    return {
      success:
        true,

      action:
        "stand",

      hand,
    };
  }


  /* ==========================================================================
     DOUBLE
     ========================================================================== */

  double(
    playerId: string
  ): ActionResult {
    const player =
      this.getPlayer(
        playerId
      );

    if (!player) {
      return this.fail(
        "double",
        "Player not found."
      );
    }

    if (
      !this.canPlayerAct(
        player,
        "double"
      )
    ) {
      return this.fail(
        "double",
        "Double is not available."
      );
    }

    const hand =
      this.getActivePlayerHand(
        player
      );

    if (!hand) {
      return this.fail(
        "double",
        "No active hand."
      );
    }

    if (
      hand.cards.length !==
      2
    ) {
      return this.fail(
        "double",
        "Double is only available on the first two cards."
      );
    }

    if (
      hand.bet <=
      0
    ) {
      return this.fail(
        "double",
        "No wager."
      );
    }

    if (
      player.balance <
      hand.bet
    ) {
      return this.fail(
        "double",
        "Insufficient balance."
      );
    }

    if (
      this.activeHandIndex ===
        1 &&
      !this.allowDoubleAfterSplit
    ) {
      return this.fail(
        "double",
        "Double after split is disabled."
      );
    }

    const additionalWager =
      hand.bet;

    player.balance -=
      additionalWager;

    hand.bet *=
      2;

    this.updatePlayerTotalBet(
      player
    );

    const card =
      this.drawCard(
        true
      );

    hand.cards.push(
      card
    );

    card.state =
      "dealing";

    card.zIndex =
      hand.cards.length;

    this.updateHandEvaluation(
      hand
    );

    if (
      !hand.busted
    ) {
      hand.state =
        "standing";
    }

    this.emit(
      "player:action",
      {
        action:
          "double",

        playerId:
          player.id,

        handId:
          hand.id,

        card,

        wager:
          hand.bet,

        value:
          hand.value,

        bust:
          hand.busted,
      }
    );

    this.syncPlayerState(
      player
    );

    this.finishCurrentPlayerTurn(
      player
    );

    return {
      success:
        true,

      action:
        "double",

      card,

      hand,
    };
  }


  /* ==========================================================================
     SPLIT
     ========================================================================== */

  split(
    playerId: string
  ): ActionResult {
    const player =
      this.getPlayer(
        playerId
      );

    if (!player) {
      return this.fail(
        "split",
        "Player not found."
      );
    }

    if (
      !this.canPlayerAct(
        player,
        "split"
      )
    ) {
      return this.fail(
        "split",
        "Split is not available."
      );
    }

    const hand =
      this.getActivePlayerHand(
        player
      );

    if (!hand) {
      return this.fail(
        "split",
        "No active hand."
      );
    }

    if (
      hand.cards.length !==
      2
    ) {
      return this.fail(
        "split",
        "Split requires exactly two cards."
      );
    }

    if (
      !this.cardsCanSplit(
        hand.cards
      )
    ) {
      return this.fail(
        "split",
        "These cards cannot be split."
      );
    }

    if (
      player.secondaryHand
    ) {
      return this.fail(
        "split",
        "Additional split levels are not supported."
      );
    }

    if (
      this.countPlayerHands(
        player
      ) >=
      this.maxSplitHands
    ) {
      return this.fail(
        "split",
        "Maximum split hands reached."
      );
    }

    if (
      player.balance <
      hand.bet
    ) {
      return this.fail(
        "split",
        "Insufficient balance."
      );
    }

    const firstCard =
      hand.cards.shift();

    const secondCard =
      hand.cards.shift();

    if (
      !firstCard ||
      !secondCard
    ) {
      return this.fail(
        "split",
        "Unable to split cards."
      );
    }

    const originalBet =
      hand.bet;

    player.balance -=
      originalBet;

    const newHand =
      createHand(
        `hand-${player.seat}-2`
      );

    newHand.bet =
      originalBet;

    hand.cards.push(
      firstCard
    );

    newHand.cards.push(
      secondCard
    );

    hand.state =
      "playing";

    newHand.state =
      "playing";

    firstCard.state =
      "hand";

    secondCard.state =
      "hand";

    player.secondaryHand =
      newHand;

    this.updatePlayerTotalBet(
      player
    );

    const firstAdditional =
      this.drawCard(
        true
      );

    const secondAdditional =
      this.drawCard(
        true
      );

    hand.cards.push(
      firstAdditional
    );

    newHand.cards.push(
      secondAdditional
    );

    firstAdditional.state =
      "dealing";

    secondAdditional.state =
      "dealing";

    firstAdditional.zIndex =
      hand.cards.length;

    secondAdditional.zIndex =
      newHand.cards.length;

    this.updateHandEvaluation(
      hand
    );

    this.updateHandEvaluation(
      newHand
    );

    /*
     * Split aces receive one card each.
     */
    const splitAces =
      firstCard.rank ===
        "A" &&
      secondCard.rank ===
        "A";

    if (
      splitAces &&
      this.splitAcesOneCard
    ) {
      if (
        !hand.busted &&
        !hand.blackjack
      ) {
        hand.state =
          "standing";
      }

      if (
        !newHand.busted &&
        !newHand.blackjack
      ) {
        newHand.state =
          "standing";
      }
    }

    this.emit(
      "player:action",
      {
        action:
          "split",

        playerId:
          player.id,

        originalHand:
          hand,

        createdHand:
          newHand,

        splitAces,
      }
    );

    if (
      splitAces &&
      this.splitAcesOneCard
    ) {
      this.syncPlayerState(
        player
      );

      this.finishCurrentPlayerTurn(
        player
      );
    }

    return {
      success:
        true,

      action:
        "split",

      hand,

      createdHand:
        newHand,
    };
  }


  /* ==========================================================================
     SURRENDER
     ========================================================================== */

  surrender(
    playerId: string
  ): ActionResult {
    const player =
      this.getPlayer(
        playerId
      );

    if (!player) {
      return this.fail(
        "surrender",
        "Player not found."
      );
    }

    if (
      !this.allowSurrender
    ) {
      return this.fail(
        "surrender",
        "Surrender is disabled."
      );
    }

    if (
      !this.canPlayerAct(
        player,
        "surrender"
      )
    ) {
      return this.fail(
        "surrender",
        "Surrender is not available."
      );
    }

    const hand =
      this.getActivePlayerHand(
        player
      );

    if (!hand) {
      return this.fail(
        "surrender",
        "No active hand."
      );
    }

    if (
      hand.cards.length !==
      2
    ) {
      return this.fail(
        "surrender",
        "Surrender is only available before drawing another card."
      );
    }

    if (
      hand.blackjack
    ) {
      return this.fail(
        "surrender",
        "A blackjack cannot be surrendered."
      );
    }

    this.surrenderedHands.add(
      hand.id
    );

    hand.state =
      "loser";

    player.state =
      "loser";

    this.emit(
      "player:action",
      {
        action:
          "surrender",

        playerId:
          player.id,

        handId:
          hand.id,
      }
    );

    this.finishCurrentPlayerTurn(
      player
    );

    return {
      success:
        true,

      action:
        "surrender",

      hand,
    };
  }


  /* ==========================================================================
     ACTION ROUTER
     ========================================================================== */

  execute(
    playerId: string,
    action: GameAction
  ): ActionResult {
    switch (
      action
    ) {
      case "deal":
        return this.startRound();

      case "hit":
        return this.hit(
          playerId
        );

      case "stand":
        return this.stand(
          playerId
        );

      case "double":
        return this.double(
          playerId
        );

      case "split":
        return this.split(
          playerId
        );

      case "insurance":
        return this.takeInsurance(
          playerId
        );

      case "decline-insurance":
        return this.declineInsurance(
          playerId
        );

      case "surrender":
        return this.surrender(
          playerId
        );

      case "repeat-bet": {
        const previous =
          this.pendingBets.get(
            playerId
          ) ??
          0;

        if (
          previous <
          this.minimumBet
        ) {
          return this.fail(
            "repeat-bet",
            "No valid previous bet."
          );
        }

        return this.setBet(
          playerId,
          previous
        );
      }

      case "clear-bet":
        return this.clearBet(
          playerId
        );

      case "increase-bet":
        return this.increaseBet(
          playerId
        );

      case "decrease-bet":
        return this.decreaseBet(
          playerId
        );
    }
  }


  /* ==========================================================================
     NPC PLAYER DECISION
     ========================================================================== */

  private resolveNPCPlayer(
    player: Player
  ) {
    if (
      this.phase !==
      "player-turn"
    ) {
      return;
    }

    if (
      player.state !==
        "playing" &&
      player.state !==
        "waiting"
    ) {
      return;
    }

    const hand =
      this.getActivePlayerHand(
        player
      );

    if (!hand) {
      return;
    }

    if (
      hand.blackjack ||
      hand.busted ||
      hand.state ===
        "standing"
    ) {
      this.finishCurrentPlayerTurn(
        player
      );

      return;
    }

    let safety =
      0;

    while (
      this.phase ===
        "player-turn" &&
      this.activeSeat ===
        player.seat &&
      safety <
        12
    ) {
      safety +=
        1;

      const currentHand =
        this.getActivePlayerHand(
          player
        );

      if (
        !currentHand ||
        !this.handIsPlayable(
          currentHand
        )
      ) {
        this.finishCurrentPlayerTurn(
          player
        );

        break;
      }

      const action =
        this.chooseNPCAction(
          player,
          currentHand
        );

      this.emit(
        "dealer:action",
        {
          source:
            "npc",

          playerId:
            player.id,

          handId:
            currentHand.id,

          action,
        }
      );

      let result:
        ActionResult;

      switch (
        action
      ) {
        case "hit":
          result =
            this.hit(
              player.id
            );
          break;

        case "stand":
          result =
            this.stand(
              player.id
            );
          break;

        case "double":
          result =
            this.double(
              player.id
            );
          break;

        case "split":
          result =
            this.split(
              player.id
            );
          break;
      }

      if (
        !result.success
      ) {
        /*
         * Prevent NPC deadlocks.
         */
        this.stand(
          player.id
        );

        break;
      }
    }
  }


  private chooseNPCAction(
    player: Player,
    hand: Hand
  ):
    | "hit"
    | "stand"
    | "double"
    | "split" {
    const evaluation =
      this.evaluateHand(
        hand
      );

    const dealerValue =
      this.getDealerUpcardValue();

    const behavior =
      player.behavior;

    /*
     * Split.
     */
    if (
      hand.cards.length ===
        2 &&
      !player.secondaryHand &&
      this.cardsCanSplit(
        hand.cards
      ) &&
      player.balance >=
        hand.bet
    ) {
      const splitValue =
        getCardValue(
          hand.cards[0].rank
        );

      if (
        hand.cards[0].rank ===
          "A" ||
        splitValue ===
          8
      ) {
        return "split";
      }

      if (
        behavior ===
          "aggressive" &&
        (
          splitValue ===
            9 ||
          splitValue ===
            7
        )
      ) {
        return "split";
      }
    }

    /*
     * Double.
     */
    if (
      hand.cards.length ===
        2 &&
      player.balance >=
        hand.bet &&
      (
        this.activeHandIndex ===
          0 ||
        this.allowDoubleAfterSplit
      )
    ) {
      if (
        evaluation.value ===
          11 &&
        dealerValue <=
          9
      ) {
        return "double";
      }

      if (
        evaluation.value ===
          10 &&
        dealerValue <=
          9 &&
        behavior !==
          "nervous"
      ) {
        return "double";
      }

      if (
        evaluation.value ===
          9 &&
        dealerValue >=
          3 &&
        dealerValue <=
          6 &&
        behavior ===
          "aggressive"
      ) {
        return "double";
      }
    }

    /*
     * Soft hand.
     */
    if (
      evaluation.soft
    ) {
      if (
        evaluation.value <=
        17
      ) {
        return "hit";
      }

      if (
        evaluation.value ===
        18
      ) {
        return dealerValue >=
          9
          ? "hit"
          : "stand";
      }

      return "stand";
    }

    /*
     * Hard hand.
     */
    if (
      evaluation.value <=
      11
    ) {
      return "hit";
    }

    if (
      evaluation.value >=
      17
    ) {
      return "stand";
    }

    switch (
      behavior
    ) {
      case "aggressive":
        return this.basicStrategyAction(
          evaluation.value,
          dealerValue
        );

      case "conservative":
        return evaluation.value >=
          15
          ? "stand"
          : "hit";

      case "nervous":
        return evaluation.value >=
          14
          ? "stand"
          : "hit";

      case "casual":
        return evaluation.value >=
          16
          ? "stand"
          : "hit";

      case "balanced":
      default:
        return this.basicStrategyAction(
          evaluation.value,
          dealerValue
        );
    }
  }


  private basicStrategyAction(
    playerValue: number,
    dealerValue: number
  ):
    | "hit"
    | "stand" {
    if (
      playerValue >=
      17
    ) {
      return "stand";
    }

    if (
      playerValue <=
      11
    ) {
      return "hit";
    }

    if (
      playerValue >=
        13 &&
      dealerValue <=
        6
    ) {
      return "stand";
    }

    if (
      playerValue ===
        12 &&
      dealerValue >=
        4 &&
      dealerValue <=
        6
    ) {
      return "stand";
    }

    return "hit";
  }


  /* ==========================================================================
     DEALER TURN
     ========================================================================== */

  private beginDealerTurn(
    alreadyKnownBlackjack = false
  ) {
    if (
      this.dealerTurnCompleted
    ) {
      return;
    }

    this.setRoundState(
      "dealer-turn"
    );

    this.dealer.state =
      "revealing";

    this.dealer.pose =
      "reveal";

    this.dealer.attention =
      "cards";

    this.revealDealerHoleCard();

    this.emit(
      "dealer:turn",
      {
        action:
          "reveal",

        blackjack:
          alreadyKnownBlackjack ||
          this.isBlackjack(
            this.dealer.hand
          ),
      }
    );

    if (
      alreadyKnownBlackjack ||
      this.isBlackjack(
        this.dealer.hand
      )
    ) {
      this.dealer.state =
        "settling";

      this.dealerTurnCompleted =
        true;

      this.setRoundState(
        "settlement"
      );

      this.settleRound();

      return;
    }

    this.resolveDealerHand();
  }


  private resolveDealerHand() {
    this.dealer.state =
      "dealing";

    this.dealer.pose =
      "deal-center";

    this.updateHandEvaluation(
      this.dealer.hand
    );

    let safety =
      0;

    while (
      this.dealerShouldHit() &&
      safety <
        20
    ) {
      safety +=
        1;

      const card =
        this.drawCard(
          true
        );

      this.dealer.hand.cards.push(
        card
      );

      card.state =
        "dealing";

      card.zIndex =
        this.dealer.hand.cards.length;

      this.updateHandEvaluation(
        this.dealer.hand
      );

      this.emit(
        "dealer:action",
        {
          action:
            "hit",

          card,

          value:
            this.dealer.hand.value,

          soft:
            this.dealer.hand.soft,
        }
      );
    }

    this.updateHandEvaluation(
      this.dealer.hand
    );

    this.dealer.state =
      this.dealer.hand.busted
        ? "settling"
        : "idle";

    this.dealer.pose =
      this.dealer.hand.busted
        ? "settle"
        : "neutral";

    this.dealerTurnCompleted =
      true;

    this.setRoundState(
      "settlement"
    );

    this.settleRound();
  }


  private dealerShouldHit() {
    const evaluation =
      this.evaluateHand(
        this.dealer.hand
      );

    if (
      evaluation.bust
    ) {
      return false;
    }

    if (
      evaluation.value <
      this.table.dealerStandsOn
    ) {
      return true;
    }

    if (
      evaluation.value ===
        this.table.dealerStandsOn &&
      evaluation.soft &&
      this.dealerHitsSoft17
    ) {
      return true;
    }

    return false;
  }


  private revealDealerHoleCard() {
    if (
      this.dealerHoleCardRevealed
    ) {
      return;
    }

    const hidden =
      this.dealer.hand.cards.find(
        card =>
          !card.faceUp
      );

    if (!hidden) {
      this.dealerHoleCardRevealed =
        true;

      return;
    }

    hidden.faceUp =
      true;

    hidden.state =
      "revealing";

    this.dealerHoleCardRevealed =
      true;

    this.updateHandEvaluation(
      this.dealer.hand
    );

    this.emit(
      "card:flip",
      {
        card:
          hidden,
      }
    );
  }


  /* ==========================================================================
     SETTLEMENT
     ========================================================================== */

  settleRound() {
    if (
      this.phase !==
      "settlement"
    ) {
      if (
        this.phase ===
          "complete" ||
        this.phase ===
          "waiting"
      ) {
        return;
      }

      this.setRoundState(
        "settlement"
      );
    }

    if (
      !this.roundLocked
    ) {
      return;
    }

    this.settlements =
      [];

    const dealerEvaluation =
      this.evaluateHand(
        this.dealer.hand
      );

    const dealerBlackjack =
      dealerEvaluation.blackjack;

    /*
     * Only players who actually received cards belong to the round.
     */
    const roundPlayers =
      this.getRoundPlayers();

    for (
      const player of roundPlayers
    ) {
      const hands =
        [
          player.hand,
          player.secondaryHand,
        ].filter(
          (
            hand
          ): hand is Hand =>
            Boolean(hand)
        );

      for (
        const hand of hands
      ) {
        if (
          hand.cards.length ===
          0
        ) {
          continue;
        }

        const settlement =
          this.settleHand(
            player,
            hand,
            dealerEvaluation,
            dealerBlackjack
          );

        this.settlements.push(
          settlement
        );
      }

      const insurance =
        this.insuranceBets.get(
          player.id
        ) ??
        0;

      if (
        insurance >
        0
      ) {
        if (
          dealerBlackjack
        ) {
          const profit =
            insurance *
            INSURANCE_PAYOUT_MULTIPLIER;

          const payout =
            insurance +
            profit;

          player.balance +=
            payout;

          this.settlements.push(
            {
              playerId:
                player.id,

              handId:
                `insurance-${player.id}`,

              result:
                "insurance-win",

              wager:
                insurance,

              payout,

              profit,

              dealerValue:
                dealerEvaluation.value,

              playerValue:
                this.calculateHandValue(
                  player.hand
                ),
            }
          );
        } else {
          this.settlements.push(
            {
              playerId:
                player.id,

              handId:
                `insurance-${player.id}`,

              result:
                "insurance-loss",

              wager:
                insurance,

              payout:
                0,

              profit:
                -insurance,

              dealerValue:
                dealerEvaluation.value,

              playerValue:
                this.calculateHandValue(
                  player.hand
                ),
            }
          );
        }
      }

      player.bet =
        0;

      player.hand.bet =
        0;

      player.chips =
        createChipStack(
          0
        );
    }

    this.insuranceBets.clear();

    this.insuranceDecisions.clear();

    this.emit(
      "round:settle",
      {
        settlements:
          this.settlements,

        dealerValue:
          dealerEvaluation.value,

        dealerBlackjack,
      }
    );

    this.finishRound();
  }


  private settleHand(
    player: Player,
    hand: Hand,
    dealerEvaluation: HandEvaluation,
    dealerBlackjack: boolean
  ): Settlement {
    const playerEvaluation =
      this.evaluateHand(
        hand
      );

    const wager =
      hand.bet;

    /*
     * Surrender.
     */
    if (
      this.surrenderedHands.has(
        hand.id
      )
    ) {
      const payout =
        wager *
        SURRENDER_RETURN_MULTIPLIER;

      player.balance +=
        payout;

      player.losses +=
        1;

      hand.state =
        "loser";

      return {
        playerId:
          player.id,

        handId:
          hand.id,

        result:
          "surrender",

        wager,

        payout,

        profit:
          payout -
          wager,

        dealerValue:
          dealerEvaluation.value,

        playerValue:
          playerEvaluation.value,
      };
    }

    /*
     * Bust.
     */
    if (
      playerEvaluation.bust
    ) {
      player.losses +=
        1;

      hand.state =
        "busted";

      return {
        playerId:
          player.id,

        handId:
          hand.id,

        result:
          "bust",

        wager,

        payout:
          0,

        profit:
          -wager,

        dealerValue:
          dealerEvaluation.value,

        playerValue:
          playerEvaluation.value,
      };
    }

    /*
     * Natural blackjack.
     */
    if (
      playerEvaluation.blackjack &&
      !dealerBlackjack
    ) {
      const profit =
        wager *
        this.blackjackPayout;

      const payout =
        wager +
        profit;

      player.balance +=
        payout;

      player.wins +=
        1;

      hand.state =
        "winner";

      return {
        playerId:
          player.id,

        handId:
          hand.id,

        result:
          "blackjack",

        wager,

        payout,

        profit,

        dealerValue:
          dealerEvaluation.value,

        playerValue:
          playerEvaluation.value,
      };
    }

    /*
     * Both blackjack.
     */
    if (
      playerEvaluation.blackjack &&
      dealerBlackjack
    ) {
      player.balance +=
        wager;

      hand.state =
        "push";

      return {
        playerId:
          player.id,

        handId:
          hand.id,

        result:
          "push",

        wager,

        payout:
          wager,

        profit:
          0,

        dealerValue:
          dealerEvaluation.value,

        playerValue:
          playerEvaluation.value,
      };
    }

    /*
     * Dealer blackjack.
     */
    if (
      dealerBlackjack
    ) {
      player.losses +=
        1;

      hand.state =
        "loser";

      return {
        playerId:
          player.id,

        handId:
          hand.id,

        result:
          "loss",

        wager,

        payout:
          0,

        profit:
          -wager,

        dealerValue:
          dealerEvaluation.value,

        playerValue:
          playerEvaluation.value,
      };
    }

    /*
     * Dealer bust.
     */
    if (
      dealerEvaluation.bust
    ) {
      const payout =
        wager *
        2;

      player.balance +=
        payout;

      player.wins +=
        1;

      hand.state =
        "winner";

      return {
        playerId:
          player.id,

        handId:
          hand.id,

        result:
          "win",

        wager,

        payout,

        profit:
          wager,

        dealerValue:
          dealerEvaluation.value,

        playerValue:
          playerEvaluation.value,
      };
    }

    /*
     * Player higher.
     */
    if (
      playerEvaluation.value >
      dealerEvaluation.value
    ) {
      const payout =
        wager *
        2;

      player.balance +=
        payout;

      player.wins +=
        1;

      hand.state =
        "winner";

      return {
        playerId:
          player.id,

        handId:
          hand.id,

        result:
          "win",

        wager,

        payout,

        profit:
          wager,

        dealerValue:
          dealerEvaluation.value,

        playerValue:
          playerEvaluation.value,
      };
    }

    /*
     * Push.
     */
    if (
      playerEvaluation.value ===
      dealerEvaluation.value
    ) {
      player.balance +=
        wager;

      hand.state =
        "push";

      return {
        playerId:
          player.id,

        handId:
          hand.id,

        result:
          "push",

        wager,

        payout:
          wager,

        profit:
          0,

        dealerValue:
          dealerEvaluation.value,

        playerValue:
          playerEvaluation.value,
      };
    }

    /*
     * Player loses.
     */
    player.losses +=
      1;

    hand.state =
      "loser";

    return {
      playerId:
        player.id,

      handId:
        hand.id,

      result:
        "loss",

      wager,

      payout:
        0,

      profit:
        -wager,

      dealerValue:
        dealerEvaluation.value,

      playerValue:
        playerEvaluation.value,
    };
  }


  /* ==========================================================================
     ROUND END
     ========================================================================== */

  private finishRound() {
    /*
     * Move player cards to discard.
     */
    for (
      const player of this.players
    ) {
      const hands =
        [
          player.hand,
          player.secondaryHand,
        ].filter(
          (
            hand
          ): hand is Hand =>
            Boolean(hand)
        );

      for (
        const hand of hands
      ) {
        for (
          const card of hand.cards
        ) {
          this.discardCard(
            card
          );
        }
      }
    }

    /*
     * Move dealer cards to discard.
     */
    for (
      const card of this.dealer.hand.cards
    ) {
      this.discardCard(
        card
      );
    }

    this.surrenderedHands.clear();

    this.insuranceBets.clear();

    this.insuranceDecisions.clear();

    this.activeSeat =
      -1;

    this.activeHandIndex =
      0;

    this.roundLocked =
      false;

    for (
      const player of this.players
    ) {
      if (
        player.balance <=
        0
      ) {
        player.eliminated =
          true;

        player.active =
          false;

        player.state =
          "loser";

        player.bet =
          0;

        player.hand.bet =
          0;

        player.chips =
          createChipStack(
            0
          );

        continue;
      }

      player.state =
        "waiting";

      player.active =
        true;

      player.bet =
        0;

      player.hand.bet =
        0;

      player.chips =
        createChipStack(
          0
        );
    }

    this.setRoundState(
      "complete"
    );

    this.emit(
      "round:complete",
      {
        round:
          this.roundNumber,

        settlements:
          this.settlements,

        humanBalance:
          this.getHumanPlayer()
            ?.balance ??
          0,
      }
    );
  }


  /* ==========================================================================
     PLAYER / HAND STATE
     ========================================================================== */

  private syncPlayerState(
    player: Player
  ) {
    const hands =
      [
        player.hand,
        player.secondaryHand,
      ].filter(
        (
          hand
        ): hand is Hand =>
          Boolean(hand)
      );

    if (
      hands.some(
        hand =>
          hand.state ===
          "winner"
      )
    ) {
      player.state =
        "winner";

      return;
    }

    if (
      hands.every(
        hand =>
          hand.state ===
            "busted" ||
          hand.state ===
            "loser"
      )
    ) {
      player.state =
        "loser";

      return;
    }

    if (
      hands.some(
        hand =>
          hand.state ===
          "blackjack"
      )
    ) {
      player.state =
        "blackjack";

      return;
    }

    if (
      hands.some(
        hand =>
          hand.state ===
          "playing"
      )
    ) {
      player.state =
        "playing";

      return;
    }

    if (
      hands.some(
        hand =>
          hand.state ===
          "standing"
      )
    ) {
      player.state =
        "standing";

      return;
    }

    player.state =
      "waiting";
  }


  private updatePlayerTotalBet(
    player: Player
  ) {
    const total =
      player.hand.bet +
      (
        player.secondaryHand?.bet ??
        0
      );

    player.bet =
      total;
  }


  private handIsFinished(
    hand: Hand
  ) {
    return (
      hand.busted ||
      hand.blackjack ||
      hand.state ===
        "standing" ||
      hand.state ===
        "winner" ||
      hand.state ===
        "loser" ||
      hand.state ===
        "push"
    );
  }


  private handIsPlayable(
    hand: Hand
  ) {
    return (
      hand.cards.length >
        0 &&
      !hand.busted &&
      !hand.blackjack &&
      hand.state !==
        "standing" &&
      hand.state !==
        "winner" &&
      hand.state !==
        "loser" &&
      hand.state !==
        "push"
    );
  }


  private getActivePlayerHand(
    player: Player
  ): Hand | null {
    if (
      this.activeHandIndex ===
      0
    ) {
      return player.hand;
    }

    if (
      this.activeHandIndex ===
        1 &&
      player.secondaryHand
    ) {
      return player.secondaryHand;
    }

    return null;
  }


  private countPlayerHands(
    player: Player
  ) {
    return (
      1 +
      (
        player.secondaryHand
          ? 1
          : 0
      )
    );
  }


  /* ==========================================================================
     ACTION VALIDATION
     ========================================================================== */

  private canPlayerAct(
    player: Player,
    action: GameAction
  ) {
    if (
      this.phase !==
      "player-turn"
    ) {
      return false;
    }

    if (
      player.eliminated ||
      !player.active
    ) {
      return false;
    }

    if (
      player.seat !==
      this.activeSeat
    ) {
      return false;
    }

    const hand =
      this.getActivePlayerHand(
        player
      );

    if (!hand) {
      return false;
    }

    if (
      !this.handIsPlayable(
        hand
      )
    ) {
      return false;
    }

    switch (
      action
    ) {
      case "hit":
      case "stand":
        return true;

      case "surrender":
        return (
          this.allowSurrender &&
          hand.cards.length ===
            2 &&
          !hand.blackjack
        );

      case "double":
        return (
          hand.cards.length ===
            2 &&
          player.balance >=
            hand.bet &&
          (
            this.activeHandIndex ===
              0 ||
            this.allowDoubleAfterSplit
          )
        );

      case "split":
        return (
          hand.cards.length ===
            2 &&
          this.cardsCanSplit(
            hand.cards
          ) &&
          !player.secondaryHand &&
          player.balance >=
            hand.bet &&
          this.countPlayerHands(
            player
          ) <
            this.maxSplitHands
        );

      default:
        return false;
    }
  }


  /* ==========================================================================
     SPLIT / DEALER HELPERS
     ========================================================================== */

  private cardsCanSplit(
    cards: Card[]
  ) {
    if (
      cards.length !==
      2
    ) {
      return false;
    }

    return (
      this.splitValue(
        cards[0]
      ) ===
      this.splitValue(
        cards[1]
      )
    );
  }


  private splitValue(
    card: Card
  ) {
    return getCardValue(
      card.rank
    );
  }


  private isDealerUpcardAce() {
    const visible =
      this.dealer.hand.cards.find(
        card =>
          card.faceUp
      );

    return (
      visible?.rank ===
      "A"
    );
  }


  private getDealerUpcardValue() {
    const visible =
      this.dealer.hand.cards.find(
        card =>
          card.faceUp
      );

    if (!visible) {
      return 10;
    }

    return Math.min(
      10,
      getCardValue(
        visible.rank
      )
    );
  }


  /* ==========================================================================
     PLAYERS
     ========================================================================== */

  getPlayer(
    id: string
  ) {
    return this.players.find(
      player =>
        player.id ===
        id
    );
  }


  getPlayerBySeat(
    seat: number
  ) {
    return this.players.find(
      player =>
        player.seat ===
        seat
    );
  }


  getHumanPlayer() {
    return this.players.find(
      player =>
        player.type ===
        "human"
    );
  }


  /*
   * Public helper retained for compatibility.
   *
   * Unlike the old implementation, this does NOT require
   * bet <= balance because balance may already contain
   * a deducted wager during a live round.
   */
  getActivePlayers() {
    return this.players.filter(
      player =>
        player.active &&
        !player.eliminated
    );
  }


  /* ==========================================================================
     VISUAL STATE
     ========================================================================== */

  getVisualState():
    TableVisualState {
    const orderedPlayers =
      [...this.players]
        .sort(
          (a, b) =>
            a.seat -
            b.seat
        );

    const seats =
      orderedPlayers.map(
        player => ({
          id:
            player.seat,

          x:
            player.visual.position.x,

          y:
            player.visual.position.y,

          angle:
            player.visual.rotation,

          radius:
            0.04,

          occupied:
            player.active &&
            !player.eliminated,

          active:
            player.seat ===
            this.activeSeat,

          playerId:
            player.id,

          label:
            `SEAT ${String(
              player.seat
            ).padStart(
              2,
              "0"
            )}`,

          state:
            player.state,
        })
      );

    return {
      table:
        this.table,

      dealer:
        this.dealer,

      deck:
        this.deck,

      seats,

      players:
        orderedPlayers,

      activeSeat:
        this.activeSeat,

      focusedSeat:
        this.getHumanPlayer()
          ?.seat ??
        null,

      bettingOpen:
        this.phase ===
          "waiting" ||
        this.phase ===
          "betting" ||
        this.phase ===
          "complete",

      cardsVisible:
        true,

      chipsVisible:
        true,
    };
  }


  /* ==========================================================================
     STATE
     ========================================================================== */

  setRoundState(
    phase: RoundPhase
  ) {
    this.phase =
      phase;

    this.emit(
      "round:phase",
      {
        phase,
      }
    );
  }


  getState() {
    return {
      phase:
        this.phase,

      roundNumber:
        this.roundNumber,

      activeSeat:
        this.activeSeat,

      activeHandIndex:
        this.activeHandIndex,

      dealerHoleCardRevealed:
        this.dealerHoleCardRevealed,

      dealerTurnCompleted:
        this.dealerTurnCompleted,

      roundLocked:
        this.roundLocked,

      settlements:
        [
          ...this.settlements,
        ],
    };
  }


  /* ==========================================================================
     FAIL
     ========================================================================== */

  private fail(
    action: GameAction,
    reason: string
  ): ActionResult {
    this.emit(
      "error",
      {
        action,
        reason,
      }
    );

    return {
      success:
        false,

      action,

      reason,
    };
  }


  /* ==========================================================================
     SERIALIZATION
     ========================================================================== */

  serialize() {
    return {
      table:
        this.table,

      phase:
        this.phase,

      roundNumber:
        this.roundNumber,

      activeSeat:
        this.activeSeat,

      activeHandIndex:
        this.activeHandIndex,

      dealer:
        this.dealer,

      players:
        this.players,

      deck:
        {
          remaining:
            this.deck.remaining,

          discardCount:
            this.deck.discardCount,

          shoeCount:
            this.deck.shoeCount,
        },

      settlements:
        this.settlements,

      rules:
        {
          minimumBet:
            this.minimumBet,

          maximumBet:
            this.maximumBet,

          blackjackPayout:
            this.blackjackPayout,

          dealerStandsOn:
            this.table
              .dealerStandsOn,

          dealerHitsSoft17:
            this.dealerHitsSoft17,

          allowInsurance:
            this.allowInsurance,

          allowSurrender:
            this.allowSurrender,

          allowDoubleAfterSplit:
            this.allowDoubleAfterSplit,

          splitAcesOneCard:
            this.splitAcesOneCard,
        },
    };
  }


  /* ==========================================================================
     RESET
     ========================================================================== */

  reset() {
    this.phase =
      "waiting";

    this.activeSeat =
      -1;

    this.activeHandIndex =
      0;

    this.roundNumber =
      0;

    this.pendingBets.clear();

    this.insuranceBets.clear();

    this.insuranceDecisions.clear();

    this.surrenderedHands.clear();

    this.settlements =
      [];

    this.discardPile =
      [];

    this.roundLocked =
      false;

    this.dealerHoleCardRevealed =
      false;

    this.dealerTurnCompleted =
      false;

    this.resetDealerForRound();

    for (
      const player of this.players
    ) {
      player.balance =
        DEFAULT_BANKROLL;

      player.wins =
        0;

      player.losses =
        0;

      player.active =
        true;

      player.eliminated =
        false;

      player.bet =
        0;

      player.hand =
        createHand(
          `hand-${player.seat}-1`
        );

      player.secondaryHand =
        null;

      player.state =
        "waiting";

      player.chips =
        createChipStack(
          0
        );

      this.pendingBets.set(
        player.id,
        0
      );

      this.insuranceBets.set(
        player.id,
        0
      );
    }

    this.rebuildShoe();

    this.emit(
      "round:phase",
      {
        phase:
          "waiting",
      }
    );
  }


  /* ==========================================================================
     DESTROY
     ========================================================================== */

  destroy() {
    this.listeners.clear();

    this.pendingBets.clear();

    this.insuranceBets.clear();

    this.insuranceDecisions.clear();

    this.surrenderedHands.clear();

    this.settlements =
      [];

    this.discardPile =
      [];
  }
}


/* ==========================================================================
   DEFAULT EXPORT
   ========================================================================== */

export default Blackjack;