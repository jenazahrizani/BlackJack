/**
 * BLACKJACK 21 — SAVE SYSTEM
 *
 * Persistent browser storage for player progression.
 *
 * Responsibilities:
 * - Persist bankroll and statistics.
 * - Keep a versioned save schema.
 * - Survive malformed / old localStorage data.
 * - Never access localStorage during SSR.
 * - Never store live game objects, cards, decks, or engine state.
 * - Provide small, predictable methods for Game.ts.
 *
 * Storage key:
 *   blackjack-21-save-v1
 *
 * Runtime game state belongs to Blackjack.ts.
 * Rendering state belongs to Game.ts / Renderer.ts.
 * This module only handles persistence.
 */

export const SAVE_VERSION = 1 as const;

export const SAVE_KEY = "blackjack-21-save-v1";

export interface SaveData {
  /**
   * Schema version.
   */
  version: typeof SAVE_VERSION;

  /**
   * Current player bankroll.
   */
  balance: number;

  /**
   * Lifetime statistics.
   */
  wins: number;
  losses: number;
  pushes: number;
  blackjackWins: number;
  handsPlayed: number;

  /**
   * Lifetime wagering statistics.
   */
  totalWagered: number;
  totalProfit: number;

  /**
   * Last successful bet amount.
   *
   * Used by "repeat bet".
   */
  lastBet: number;

  /**
   * Timestamp of the latest successful save.
   */
  updatedAt: number;
}


/**
 * Partial patch accepted by update().
 *
 * Keeping this type separate prevents callers from accidentally
 * replacing the complete save object.
 */
export type SavePatch = Partial<
  Omit<SaveData, "version" | "updatedAt">
>;


/**
 * Creates a fresh save profile.
 *
 * Bankroll matches Blackjack.ts default bankroll.
 */
export function createDefaultSave(): SaveData {
  return {
    version: SAVE_VERSION,

    balance: 1250,

    wins: 0,
    losses: 0,
    pushes: 0,
    blackjackWins: 0,
    handsPlayed: 0,

    totalWagered: 0,
    totalProfit: 0,

    lastBet: 0,

    updatedAt: Date.now()
  };
}


/**
 * Browser storage availability.
 *
 * Important:
 * Astro can render code on the server.
 * localStorage must therefore never be touched at module scope.
 */
function hasStorage(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  );
}


/**
 * Converts unknown input into a finite number.
 */
function finiteNumber(
  value: unknown,
  fallback: number
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}


/**
 * Converts unknown input into a non-negative integer.
 */
function nonNegativeInteger(
  value: unknown,
  fallback: number
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return fallback;
  }

  return Math.max(
    0,
    Math.floor(value)
  );
}


/**
 * Normalizes a value loaded from localStorage.
 *
 * This is deliberately defensive:
 * localStorage is user-editable and can contain:
 * - invalid JSON
 * - old schemas
 * - strings instead of numbers
 * - negative counters
 * - Infinity / NaN
 * - unexpected fields
 */
function normalizeSave(
  input: unknown
): SaveData {
  const defaults = createDefaultSave();

  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    return defaults;
  }

  const raw = input as Record<string, unknown>;

  return {
    version: SAVE_VERSION,

    balance: Math.max(
      0,
      finiteNumber(
        raw.balance,
        defaults.balance
      )
    ),

    wins: nonNegativeInteger(
      raw.wins,
      defaults.wins
    ),

    losses: nonNegativeInteger(
      raw.losses,
      defaults.losses
    ),

    pushes: nonNegativeInteger(
      raw.pushes,
      defaults.pushes
    ),

    blackjackWins: nonNegativeInteger(
      raw.blackjackWins,
      defaults.blackjackWins
    ),

    handsPlayed: nonNegativeInteger(
      raw.handsPlayed,
      defaults.handsPlayed
    ),

    totalWagered: Math.max(
      0,
      finiteNumber(
        raw.totalWagered,
        defaults.totalWagered
      )
    ),

    totalProfit: finiteNumber(
      raw.totalProfit,
      defaults.totalProfit
    ),

    lastBet: Math.max(
      0,
      finiteNumber(
        raw.lastBet,
        defaults.lastBet
      )
    ),

    updatedAt: Math.max(
      0,
      finiteNumber(
        raw.updatedAt,
        defaults.updatedAt
      )
    )
  };
}


/**
 * Safely parses a serialized save.
 */
function parseSave(
  serialized: string | null
): SaveData | null {
  if (!serialized) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(
      serialized
    );

    return normalizeSave(parsed);
  } catch {
    return null;
  }
}


/**
 * Safely serializes a save object.
 */
function serializeSave(
  data: SaveData
): string {
  return JSON.stringify(data);
}


/**
 * Main save manager.
 *
 * The class does not automatically save on every mutation.
 * Game.ts should decide when a meaningful gameplay event has completed.
 *
 * Example:
 *
 *   const save = new SaveManager();
 *   const profile = save.load();
 *   profile.balance = player.balance;
 *   save.save(profile);
 */
export class SaveManager {
  private readonly storageKey: string;

  private cached: SaveData | null = null;

  constructor(
    storageKey: string = SAVE_KEY
  ) {
    this.storageKey = storageKey;
  }


  /**
   * Returns the storage key being used.
   */
  getKey(): string {
    return this.storageKey;
  }


  /**
   * Whether browser storage is currently available.
   */
  isAvailable(): boolean {
    return hasStorage();
  }


  /**
   * Whether a save currently exists.
   */
  exists(): boolean {
    if (!hasStorage()) {
      return false;
    }

    try {
      return (
        window.localStorage.getItem(
          this.storageKey
        ) !== null
      );
    } catch {
      return false;
    }
  }


  /**
   * Loads the save.
   *
   * Behavior:
   * - Returns normalized saved data when valid.
   * - Creates a default profile when no save exists.
   * - Recovers from malformed storage automatically.
   * - Never throws localStorage / JSON errors.
   */
  load(): SaveData {
    if (this.cached) {
      return this.clone(
        this.cached
      );
    }

    if (!hasStorage()) {
      const defaults =
        createDefaultSave();

      this.cached = defaults;

      return this.clone(
        defaults
      );
    }

    try {
      const raw =
        window.localStorage.getItem(
          this.storageKey
        );

      const parsed =
        parseSave(raw);

      const data =
        parsed ?? createDefaultSave();

      this.cached = data;

      /*
       * If storage was corrupted, quietly repair it.
       * This also upgrades future compatible schemas.
       */
      if (!parsed) {
        this.write(data);
      }

      return this.clone(
        data
      );
    } catch {
      const defaults =
        createDefaultSave();

      this.cached = defaults;

      return this.clone(
        defaults
      );
    }
  }


  /**
   * Saves a complete profile.
   *
   * The incoming object is normalized before writing.
   */
  save(
    data: SaveData
  ): SaveData {
    const normalized =
      normalizeSave(data);

    normalized.updatedAt =
      Date.now();

    this.cached =
      normalized;

    this.write(
      normalized
    );

    return this.clone(
      normalized
    );
  }


  /**
   * Updates selected save fields.
   *
   * Example:
   *
   *   save.update({
   *     balance: player.balance,
   *     lastBet: player.bet
   *   });
   */
  update(
    patch: SavePatch
  ): SaveData {
    const current =
      this.load();

    const merged: SaveData = {
      ...current,
      ...patch,

      version: SAVE_VERSION,
      updatedAt: Date.now()
    };

    return this.save(
      merged
    );
  }


  /**
   * Resets the persistent profile.
   *
   * Returns the fresh default profile.
   */
  reset(): SaveData {
    const defaults =
      createDefaultSave();

    this.cached =
      defaults;

    if (hasStorage()) {
      try {
        window.localStorage.removeItem(
          this.storageKey
        );
      } catch {
        /*
         * Storage may be blocked.
         * The in-memory save is still reset.
         */
      }
    }

    /*
     * Write the fresh default profile back so reset()
     * results in a deterministic initialized save.
     */
    this.write(
      defaults
    );

    return this.clone(
      defaults
    );
  }


  /**
   * Completely removes the persistent profile.
   *
   * Unlike reset(), this leaves storage empty.
   */
  clear(): boolean {
    this.cached = null;

    if (!hasStorage()) {
      return false;
    }

    try {
      window.localStorage.removeItem(
        this.storageKey
      );

      return true;
    } catch {
      return false;
    }
  }


  /**
   * Returns a detached copy.
   *
   * This prevents callers from accidentally mutating
   * the internal cached object without calling save().
   */
  private clone(
    data: SaveData
  ): SaveData {
    return {
      ...data
    };
  }


  /**
   * Writes to localStorage without throwing.
   */
  private write(
    data: SaveData
  ): boolean {
    if (!hasStorage()) {
      return false;
    }

    try {
      window.localStorage.setItem(
        this.storageKey,
        serializeSave(data)
      );

      return true;
    } catch {
      /*
       * Possible causes:
       * - private browsing restrictions
       * - storage disabled
       * - quota exceeded
       * - browser security policy
       */
      return false;
    }
  }
}


/**
 * Singleton instance for the game.
 *
 * Nothing touches localStorage until one of the manager methods
 * is called from browser-side code.
 */
export const saveManager =
  new SaveManager();


/* ==========================================================================
   Convenience helpers
   ========================================================================== */

/**
 * Load the current persistent profile.
 */
export function loadSave(): SaveData {
  return saveManager.load();
}


/**
 * Persist a complete profile.
 */
export function saveGame(
  data: SaveData
): SaveData {
  return saveManager.save(
    data
  );
}


/**
 * Update selected persistent values.
 */
export function updateSave(
  patch: SavePatch
): SaveData {
  return saveManager.update(
    patch
  );
}


/**
 * Reset persistent progression.
 */
export function resetSave(): SaveData {
  return saveManager.reset();
}


/**
 * Remove persistent progression completely.
 */
export function clearSave(): boolean {
  return saveManager.clear();
}