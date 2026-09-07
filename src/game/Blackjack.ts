/* ==========================================================================
   BLACKJACK 21 — GAME LOGIC
   --------------------------------------------------------------------------
   Pure blackjack rules and round state.

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
   ========================================================================== */

import {
  createCard,
  createHand,
  createPlayer,
  createDealer,
  createDeck,
  createChipStack,
  getCardValue,

  type Card,
  type CardRank,
  type Dealer,
  type Deck,
  type Hand,
  type Player,
  type PlayerBehavior,
  type Suit,
  type SeatState,
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

const BLACKJACK_MULTIPLIER = 1.5;

const INSURANCE_MULTIPLIER = 2;

const SURRENDER_MULTIPLIER = 0.5;

const MAX_SPLIT_HANDS = 4;

const MAX_DOUBLE_AFTER_SPLIT = true;


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

  phase: RoundPhase =
    "waiting";

  activeSeat = -1;

  activeHandIndex = 0;

  roundNumber = 0;


  /* ------------------------------------------------------------------------
     BETTING
     ------------------------------------------------------------------------ */

  pendingBets =
    new Map<string, number>();


  /* ------------------------------------------------------------------------
     SPECIAL BETS
     ------------------------------------------------------------------------ */

  insuranceBets =
    new Map<string, number>();

  surrenderedHands =
    new Set<string>();


  /* ------------------------------------------------------------------------
     RESULT
     ------------------------------------------------------------------------ */

  settlements: Settlement[] =
    [];


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

  private dealerHoleCardRevealed =
    false;

  private dealerTurnCompleted =
    false;

  private roundLocked =
    false;


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

      random?: () => number;

      table?: Partial<Table>;

      players?: Player[];

      dealerName?: string;
    } = {}
  ) {

    /* ------------------------------------------------------------------------
       TABLE
       ------------------------------------------------------------------------ */

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
        options.minimumBet ??
        options.table?.minimumBet ??
        DEFAULT_MIN_BET,

      maximumBet:
        options.maximumBet ??
        options.table?.maximumBet ??
        DEFAULT_MAX_BET,

      blackjackPayout:
        options.blackjackPayout ??
        options.table?.blackjackPayout ??
        BLACKJACK_MULTIPLIER,

      dealerStandsOn:
        options.table?.dealerStandsOn ??
        DEFAULT_DEALER_STANDS_ON,

      dealerHitsSoft17:
        options.dealerHitsSoft17 ??
        options.table?.dealerHitsSoft17 ??
        false,

      doubleAfterSplit:
        options.allowDoubleAfterSplit ??
        options.table?.doubleAfterSplit ??
        MAX_DOUBLE_AFTER_SPLIT,

      surrenderAllowed:
        options.allowSurrender ??
        options.table?.surrenderAllowed ??
        false,
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
          this.table.minimumBet
        )
      );

    this.maximumBet =
      Math.max(
        this.minimumBet,
        Math.floor(
          options.maximumBet ??
          this.table.maximumBet
        )
      );

    this.allowInsurance =
      options.allowInsurance ??
      true;

    this.allowSurrender =
      options.allowSurrender ??
      this.table.surrenderAllowed;

    this.allowDoubleAfterSplit =
      options.allowDoubleAfterSplit ??
      this.table.doubleAfterSplit;

    this.dealerHitsSoft17 =
      options.dealerHitsSoft17 ??
      this.table.dealerHitsSoft17;

    this.maxSplitHands =
      Math.max(
        2,
        Math.floor(
          options.maxSplitHands ??
          MAX_SPLIT_HANDS
        )
      );

    this.blackjackPayout =
      options.blackjackPayout ??
      this.table.blackjackPayout;

    this.random =
      options.random ??
      Math.random;


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
      options.players ??
      [
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
       INITIAL BANKROLLS
       ------------------------------------------------------------------------ */

    for (
      const player of this.players
    ) {

      if (
        player.balance <= 0
      ) {
        player.balance =
          DEFAULT_BANKROLL;
      }

      player.state =
        "waiting";

      player.hand =
        createHand(
          `hand-${player.seat}`
        );

      player.secondaryHand =
        null;

      player.bet =
        0;

      player.chips =
        createChipStack(
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

      timestamp:
        Date.now(),

      detail,
    };


    this.listeners
      .get(name)
      ?.forEach(
        (listener) =>
          listener(event)
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
      i--
    ) {

      const j =
        Math.floor(
          this.random() *
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
      this.decks * 52;

    return (
      this.deck.remaining <=
      Math.floor(
        totalCards * 0.25
      )
    );
  }


  /* ==========================================================================
     DRAW
     ========================================================================== */

  drawCard(
    faceUp = true
  ): Card {

    if (
      this.needsShuffle()
    ) {
      this.rebuildShoe();
    }


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

    let hardValue = 0;

    let aces = 0;


    for (
      const card of hand.cards
    ) {

      const value =
        getCardValue(
          card.rank
        );

      hardValue +=
        value;

      if (
        card.rank ===
        "A"
      ) {
        aces +=
          1;
      }
    }


    let value =
      hardValue;


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
      hand.cards.some(
        (card) =>
          card.rank ===
          "A"
      ) &&
      value ===
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

    } else if (
      evaluation.blackjack
    ) {

      hand.state =
        "blackjack";

    } else if (
      hand.state ===
      "empty"
    ) {

      hand.state =
        "playing";
    }
  }


  /* ==========================================================================
     HAND RESET
     ========================================================================== */

  private resetPlayerForRound(
    player: Player
  ) {

    player.hand =
      createHand(
        `hand-${player.seat}-1`
      );

    player.secondaryHand =
      null;

    player.bet =
      0;

    player.state =
      "waiting";

    player.active =
      true;

    player.eliminated =
      false;

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


  private resetDealerForRound() {

    this.dealer.hand =
      createHand(
        "dealer-hand"
      );

    this.dealer.state =
      "idle";

    this.dealer.pose =
      "neutral";

    this.dealer.currentSeat =
      null;

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
        "betting" &&
      this.phase !==
        "waiting"
    ) {

      return this.fail(
        "increase-bet",
        "Betting is closed."
      );
    }


    const safeAmount =
      this.clampBet(
        amount,
        player.balance
      );


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


    return this.setBet(
      player.id,
      player.bet +
        step
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


    const next =
      Math.max(
        0,
        player.bet -
          step
      );


    if (
      next ===
      0
    ) {

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


      this.emit(
        "bet:change",
        {
          playerId:
            player.id,

          amount:
            0,
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


    this.emit(
      "bet:change",
      {
        playerId:
          player.id,

        amount:
          0,
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
          balance
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


    this.phase =
      "betting";

    this.roundNumber +=
      1;


    this.setRoundState(
      "betting"
    );


    this.prepareNPCBets();


    const human =
      this.getHumanPlayer();


    if (
      !human ||
      human.bet <
        this.minimumBet
    ) {

      return this.fail(
        "deal",
        `Place at least a ${this.minimumBet} bet.`
      );
    }


    this.roundLocked =
      true;


    this.setRoundState(
      "initial-deal"
    );


    this.resetHandsOnly();


    this.emit(
      "round:start",
      {
        round:
          this.roundNumber,

        humanBet:
          human.bet,
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
        player.balance <=
        0
      ) {

        player.eliminated =
          true;

        player.active =
          false;

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
        continue;
      }


      const bet =
        this.chooseNPCBet(
          player.balance,
          player.behavior
        );


      player.bet =
        bet;

      player.chips =
        createChipStack(
          bet
        );


      this.pendingBets.set(
        player.id,
        bet
      );
    }
  }


  private chooseNPCBet(
    balance: number,
    behavior: PlayerBehavior
  ) {

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
          Math.round(
            this.minimumBet *
            3
          );
        break;

      case "aggressive":
        base =
          Math.round(
            this.minimumBet *
            6
          );
        break;

      case "casual":
        base =
          Math.round(
            this.minimumBet *
            2
          );
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


    return Math.max(
      this.minimumBet,
      base
    );
  }


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

      player.secondaryHand =
        null;


      if (
        player.bet >=
        this.minimumBet
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


  /* ==========================================================================
     INITIAL DEAL
     ========================================================================== */

  private initialDeal() {

    const activePlayers =
      this.players.filter(
        (player) =>
          player.active &&
          !player.eliminated &&
          player.bet >=
            this.minimumBet &&
          player.bet <=
            Math.min(
              this.maximumBet,
              player.balance
            )
      );


    /*
     * Deduct initial wagers.
     */
    for (
      const player of activePlayers
    ) {

      player.balance -=
        player.bet;

      player.hand.bet =
        player.bet;
    }


    /*
     * First player card.
     */
    for (
      const player of activePlayers
    ) {

      this.dealToPlayer(
        player
      );
    }


    /*
     * Dealer up card.
     */
    this.dealToDealer(
      true
    );


    /*
     * Second player card.
     */
    for (
      const player of activePlayers
    ) {

      this.dealToPlayer(
        player
      );
    }


    /*
     * Dealer hole card.
     */
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
     * Player natural blackjacks.
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


    this.updateHandEvaluation(
      this.dealer.hand
    );


    /*
     * Dealer Ace → insurance window.
     */
    if (
      this.dealer.hand.cards.length ===
        2 &&
      this.isDealerUpcardAce()
    ) {

      if (
        this.allowInsurance
      ) {

        this.setRoundState(
          "insurance"
        );

        return;
      }
    }


    /*
     * Dealer blackjack.
     */
    if (
      this.isBlackjack(
        this.dealer.hand
      )
    ) {

      this.setRoundState(
        "settlement"
      );

      this.settleRound();

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


    card.state =
      "dealing";


    player.hand.cards.push(
      card
    );


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


    card.state =
      "dealing";


    this.dealer.hand.cards.push(
      card
    );


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


    const maximum =
      Math.min(
        player.bet / 2,
        player.balance
      );


    const wager =
      Math.floor(
        amount ??
        maximum
      );


    if (
      wager <= 0
    ) {
      return this.fail(
        "insurance",
        "Insufficient balance for insurance."
      );
    }


    player.balance -=
      wager;


    this.insuranceBets.set(
      player.id,
      wager
    );


    this.setRoundState(
      "player-turn"
    );


    this.emit(
      "player:action",
      {
        action:
          "insurance",

        playerId:
          player.id,

        amount:
          wager,
      }
    );


    if (
      this.isBlackjack(
        this.dealer.hand
      )
    ) {

      this.revealDealerHoleCard();

      this.setRoundState(
        "settlement"
      );

      this.settleRound();

    } else {

      this.beginPlayerTurns(
        this.getActivePlayers()
      );
    }


    return {
      success:
        true,

      action:
        "insurance",
    };
  }


  /* ==========================================================================
     PLAYER TURN SYSTEM
     ========================================================================== */

  private beginPlayerTurns(
    activePlayers: Player[]
  ) {

    const playable =
      activePlayers.filter(
        (player) =>
          !player.hand.blackjack &&
          !player.hand.busted &&
          player.hand.cards.length >
            0
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
      first.seat;

    this.activeHandIndex =
      0;


    this.setRoundState(
      "player-turn"
    );


    this.emit(
      "player:turn",
      {
        playerId:
          first.id,

        seat:
          first.seat,

        handIndex:
          0,
      }
    );


    if (
      first.type ===
      "npc"
    ) {

      this.resolveNPCPlayer(
        first
      );
    }
  }


  private finishCurrentPlayerTurn(
    player: Player
  ) {

    player.state =
      this.handIsFinished(
        this.getActivePlayerHand(
          player
        ) ?? player.hand
      )
        ? this.mapHandState(
            this.getActivePlayerHand(
              player
            ) ?? player.hand
          )
        : "standing";


    const next =
      this.nextPlayerWithPlayableHand();


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


  private nextPlayerWithPlayableHand():
    | {
        player: Player;
        handIndex: number;
      }
    | null {

    const ordered =
      [
        ...this.players,
      ].sort(
        (a, b) =>
          a.seat -
          b.seat
      );


    const start =
      ordered.findIndex(
        (player) =>
          player.seat ===
          this.activeSeat
      );


    /*
     * Current player's secondary hand first.
     */
    const current =
      this.getPlayerBySeat(
        this.activeSeat
      );


    if (current) {

      const currentHands =
        [
          current.hand,
          current.secondaryHand,
        ].filter(
          (
            hand
          ): hand is Hand =>
            Boolean(hand)
        );


      for (
        let i = 0;
        i <
        currentHands.length;
        i++
      ) {

        if (
          this.handIsPlayable(
            currentHands[i]
          ) &&
          (
            i !==
              this.activeHandIndex ||
            this.activeHandIndex > 0
          )
        ) {

          return {
            player:
              current,

            handIndex:
              i,
          };
        }
      }
    }


    /*
     * Search other seats.
     */
    for (
      let offset = 1;
      offset <=
        ordered.length;
      offset++
    ) {

      const index =
        (
          start +
          offset
        ) %
        ordered.length;


      const player =
        ordered[index];


      if (
        !player ||
        !player.active ||
        player.eliminated
      ) {
        continue;
      }


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
        let handIndex = 0;
        handIndex <
          hands.length;
        handIndex++
      ) {

        if (
          this.handIsPlayable(
            hands[handIndex]
          )
        ) {

          return {
            player,

            handIndex,
          };
        }
      }
    }


    return null;
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
      }
    );


    if (
      hand.busted
    ) {

      player.state =
        "busted";

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

    player.state =
      "standing";


    this.emit(
      "player:action",
      {
        action:
          "stand",

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
      player.secondaryHand &&
      !this.allowDoubleAfterSplit
    ) {

      return this.fail(
        "double",
        "Double after split is disabled."
      );
    }


    player.balance -=
      hand.bet;

    hand.bet *=
      2;

    player.bet =
      hand.bet;


    const card =
      this.drawCard(
        true
      );


    hand.cards.push(
      card
    );


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
      }
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


    if (
      player.secondaryHand
    ) {

      return this.fail(
        "split",
        "Additional split levels require a larger hand array."
      );
    }


    const secondCard =
      hand.cards.pop();


    if (!secondCard) {
      return this.fail(
        "split",
        "Unable to split cards."
      );
    }


    player.balance -=
      hand.bet;


    const newHand =
      createHand(
        `hand-${player.seat}-2`
      );


    newHand.bet =
      hand.bet;


    newHand.cards.push(
      secondCard
    );


    hand.state =
      "playing";

    newHand.state =
      "playing";


    player.secondaryHand =
      newHand;


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


    this.updateHandEvaluation(
      hand
    );

    this.updateHandEvaluation(
      newHand
    );


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
      }
    );


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

      case "surrender":
        return this.surrender(
          playerId
        );


      case "repeat-bet": {

        const player =
          this.getPlayer(
            playerId
          );


        if (!player) {
          return this.fail(
            "repeat-bet",
            "Player not found."
          );
        }


        const previous =
          this.pendingBets.get(
            player.id
          ) ??
          0;


        return this.setBet(
          player.id,
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
     NPC DECISION SYSTEM
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
      "playing"
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
      hand.busted
    ) {

      this.finishCurrentPlayerTurn(
        player
      );

      return;
    }


    let safety = 0;


    while (
      this.handIsPlayable(
        hand
      ) &&
      safety <
        12
    ) {

      safety +=
        1;


      const action =
        this.chooseNPCAction(
          player,
          hand
        );


      this.emit(
        "dealer:action",
        {
          source:
            "npc",

          playerId:
            player.id,

          action,
        }
      );


      switch (
        action
      ) {

        case "hit":
          this.hit(
            player.id
          );
          break;


        case "stand":
          this.stand(
            player.id
          );
          break;


        case "double":
          this.double(
            player.id
          );
          break;


        case "split":
          this.split(
            player.id
          );
          break;


        default:
          this.stand(
            player.id
          );
          break;
      }


      if (
        this.activeSeat !==
        player.seat
      ) {
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
      hand.cards.length === 2 &&
      this.cardsCanSplit(
        hand.cards
      )
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
          splitValue === 9 ||
          splitValue === 7
        )
      ) {
        return "split";
      }
    }


    /*
     * Double.
     */
    if (
      hand.cards.length === 2 &&
      hand.bet <=
        player.balance
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
        return evaluation.value <
          17
          ? "hit"
          : "stand";


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


    return "hit";
  }


  /* ==========================================================================
     DEALER TURN
     ========================================================================== */

  private beginDealerTurn() {

    this.setRoundState(
      "dealer-turn"
    );


    this.dealer.state =
      "revealing";


    this.revealDealerHoleCard();


    this.emit(
      "dealer:turn",
      {
        action:
          "reveal",
      }
    );


    this.resolveDealerHand();
  }


  private resolveDealerHand() {

    this.dealer.state =
      "dealing";


    this.updateHandEvaluation(
      this.dealer.hand
    );


    let safety = 0;


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
        }
      );
    }


    this.dealer.state =
      this.isBust(
        this.dealer.hand
      )
        ? "settling"
        : "idle";


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
        17 &&
      evaluation.soft &&
      this.dealerHitsSoft17
    ) {
      return true;
    }


    return false;
  }


  private revealDealerHoleCard() {

    const hidden =
      this.dealer.hand.cards.find(
        (card) =>
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

      this.setRoundState(
        "settlement"
      );
    }


    this.settlements =
      [];


    const dealerEvaluation =
      this.evaluateHand(
        this.dealer.hand
      );


    const dealerBlackjack =
      dealerEvaluation.blackjack;


    for (
      const player of this.players
    ) {

      if (
        !player.active ||
        player.eliminated
      ) {
        continue;
      }


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
            INSURANCE_MULTIPLIER;


          player.balance +=
            insurance +
            profit;


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

              payout:
                insurance +
                profit,

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


      player.chips =
        createChipStack(
          0
        );

      player.bet =
        0;
    }


    this.insuranceBets.clear();


    this.emit(
      "round:settle",
      {
        settlements:
          this.settlements,

        dealerValue:
          dealerEvaluation.value,
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
        SURRENDER_MULTIPLIER;


      player.balance +=
        payout;


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
        wager * 2;


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
     * Player wins.
     */
    if (
      playerEvaluation.value >
      dealerEvaluation.value
    ) {

      const payout =
        wager * 2;


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

    this.setRoundState(
      "complete"
    );


    for (
      const player of this.players
    ) {

      for (
        const hand of [
          player.hand,
          player.secondaryHand,
        ]
      ) {

        if (!hand) {
          continue;
        }


        for (
          const card of hand.cards
        ) {

          this.discardCard(
            card
          );
        }
      }
    }


    for (
      const card of this.dealer.hand.cards
    ) {

      this.discardCard(
        card
      );
    }


    this.surrenderedHands.clear();


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

        continue;
      }


      player.state =
        "waiting";
    }


    this.emit(
      "round:complete",
      {
        round:
          this.roundNumber,

        settlements:
          this.settlements,
      }
    );
  }


  /* ==========================================================================
     RULE HELPERS
     ========================================================================== */

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


  private mapHandState(
    hand: Hand
  ): SeatState {

    if (
      hand.blackjack
    ) {
      return "blackjack";
    }


    if (
      hand.busted
    ) {
      return "busted";
    }


    if (
      hand.state ===
      "standing"
    ) {
      return "standing";
    }


    return "playing";
  }


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
      case "surrender":
        return true;


      case "double":
        return (
          hand.cards.length ===
            2 &&
          player.balance >=
            hand.bet &&
          (
            !player.secondaryHand ||
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
          player.balance >=
            hand.bet &&
          !player.secondaryHand &&
          this.countPlayerHands(
            player
          ) <
            this.maxSplitHands
        );


      default:
        return false;
    }
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


  /* ==========================================================================
     DEALER UP CARD
     ========================================================================== */

  private isDealerUpcardAce() {

    const visible =
      this.dealer.hand.cards.find(
        (card) =>
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
        (card) =>
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
      (player) =>
        player.id ===
        id
    );
  }


  getPlayerBySeat(
    seat: number
  ) {

    return this.players.find(
      (player) =>
        player.seat ===
        seat
    );
  }


  getHumanPlayer() {

    return this.players.find(
      (player) =>
        player.type ===
        "human"
    );
  }


  getActivePlayers() {

    return this.players.filter(
      (player) =>
        player.active &&
        !player.eliminated &&
        player.bet >=
          this.minimumBet
    );
  }


  /* ==========================================================================
     UI / VISUAL STATE
     ========================================================================== */

  getVisualState():
    TableVisualState {

    return {

      table:
        this.table,

      dealer:
        this.dealer,

      deck:
        this.deck,

      seats:
        this.players.map(
          (player) => ({

            id:
              player.seat,

            x:
              player.visual
                .position.x,

            y:
              player.visual
                .position.y,

            angle:
              player.visual
                .rotation,

            radius:
              0.04,

            occupied:
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
        ),

      players:
        this.players,

      activeSeat:
        this.activeSeat,

      focusedSeat:
        this.getHumanPlayer()
          ?.seat ??
        null,

      bettingOpen:
        this.phase ===
        "betting",

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


      this.resetPlayerForRound(
        player
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