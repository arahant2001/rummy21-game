export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const MAX_PLAYERS = 10;

export const DEFAULT_RULES = {
  presetName: 'Classic South Indian',
  decks: 3,
  cardsPerPlayer: 21,
  poochiesPerDeck: 1,
  marriagePts: 50,
  tiplu1: 20,
  tiplu2: 40,
  tipluPts: 20,
  poochie1: 20,
  poochie2: 50,
  poochie3: 70,
  papluTaplu1: 10,
  papluTaplu2: 30,
  papluTaplu3: 50,
  firstDrop: 30,
  middleDrop: 70,
  forfeitPenalty: 100,
  maxDeadwood: 120,
  minPureSequences: 3,
  allowTunnelaAsPure: true,
  allow3TunellasShow: true,
  allow3PoochiesAsPure: true,
  allowMarriageAsPure: true,
  allowDoublesShow: true,
  dealtDoublesForShow: 7,
  drawnDoublesForShow: 8,
  freeScootDealtDoubles: 6,
  freeGameDrawnDoubles: 7,
  blockDiscardedJokerPickup: true,
  groupingTimeSec: 300,
  eliminationEnabled: false,
  scoreLimit: 500
};

export const RULE_PRESETS = {
  classic: { ...DEFAULT_RULES, presetName: 'Classic South Indian' },
  casual: {
    ...DEFAULT_RULES,
    presetName: 'Casual Family',
    firstDrop: 20,
    middleDrop: 50,
    maxDeadwood: 100,
    minPureSequences: 2,
    blockDiscardedJokerPickup: false,
    groupingTimeSec: 360
  },
  highStakes: {
    ...DEFAULT_RULES,
    presetName: 'High-Stakes Marriage',
    poochiesPerDeck: 2,
    marriagePts: 75,
    tiplu1: 30,
    tiplu2: 60,
    tipluPts: 30,
    poochie1: 30,
    poochie2: 75,
    poochie3: 110,
    papluTaplu1: 15,
    papluTaplu2: 40,
    papluTaplu3: 70,
    firstDrop: 40,
    middleDrop: 80,
    maxDeadwood: 150
  },
  tournament: {
    ...DEFAULT_RULES,
    presetName: 'Tournament',
    maxDeadwood: 210,
    eliminationEnabled: true,
    scoreLimit: 500
  }
};

function clampInt(val, min, max, fallback) {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function sanitizeRules(raw) {
  const src = (raw && typeof raw === 'object') ? raw : {};
  const presetName = typeof src.presetName === 'string' && src.presetName.trim()
    ? src.presetName.trim().slice(0, 40)
    : DEFAULT_RULES.presetName;

  const cardsPerPlayer = clampInt(src.cardsPerPlayer, 13, 28, DEFAULT_RULES.cardsPerPlayer);
  const dealtDoublesForShow = clampInt(src.dealtDoublesForShow, 5, 10, DEFAULT_RULES.dealtDoublesForShow);
  const drawnDoublesForShow = clampInt(src.drawnDoublesForShow, 6, 10, DEFAULT_RULES.drawnDoublesForShow);
  const freeScootDealtDoubles = clampInt(src.freeScootDealtDoubles, 4, 9, DEFAULT_RULES.freeScootDealtDoubles);
  const freeGameDrawnDoubles = clampInt(src.freeGameDrawnDoubles, 5, 10, DEFAULT_RULES.freeGameDrawnDoubles);
  const tiplu1 = clampInt(src.tiplu1 ?? src.tipluPts, 0, 150, DEFAULT_RULES.tiplu1);
  const tiplu2 = clampInt(
    src.tiplu2,
    0,
    300,
    (src.tipluPts !== undefined && src.tiplu2 === undefined) ? tiplu1 * 2 : DEFAULT_RULES.tiplu2
  );
  const poochiesPerDeck = clampInt(src.poochiesPerDeck, 0, 2, DEFAULT_RULES.poochiesPerDeck);
  const allowDoublesShow = cardsPerPlayer >= 21 && (src.allowDoublesShow !== false);

  return {
    presetName,
    decks: clampInt(src.decks, 3, 6, DEFAULT_RULES.decks),
    cardsPerPlayer,
    poochiesPerDeck,
    marriagePts: clampInt(src.marriagePts, 0, 250, DEFAULT_RULES.marriagePts),
    tiplu1,
    tiplu2,
    tipluPts: tiplu1,
    poochie1: clampInt(src.poochie1, 0, 150, DEFAULT_RULES.poochie1),
    poochie2: clampInt(src.poochie2, 0, 250, DEFAULT_RULES.poochie2),
    poochie3: clampInt(src.poochie3, 0, 350, DEFAULT_RULES.poochie3),
    papluTaplu1: clampInt(src.papluTaplu1, 0, 100, DEFAULT_RULES.papluTaplu1),
    papluTaplu2: clampInt(src.papluTaplu2, 0, 200, DEFAULT_RULES.papluTaplu2),
    papluTaplu3: clampInt(src.papluTaplu3, 0, 300, DEFAULT_RULES.papluTaplu3),
    firstDrop: clampInt(src.firstDrop, 0, 120, DEFAULT_RULES.firstDrop),
    middleDrop: clampInt(src.middleDrop, 0, 200, DEFAULT_RULES.middleDrop),
    forfeitPenalty: DEFAULT_RULES.forfeitPenalty,
    maxDeadwood: clampInt(src.maxDeadwood, 40, 300, DEFAULT_RULES.maxDeadwood),
    minPureSequences: clampInt(src.minPureSequences, 1, 4, DEFAULT_RULES.minPureSequences),
    allowTunnelaAsPure: true,
    allow3TunellasShow: src.allow3TunellasShow !== false,
    allow3PoochiesAsPure: src.allow3PoochiesAsPure !== false,
    allowMarriageAsPure: src.allowMarriageAsPure !== false,
    allowDoublesShow,
    dealtDoublesForShow,
    drawnDoublesForShow: Math.max(dealtDoublesForShow, drawnDoublesForShow),
    freeScootDealtDoubles,
    freeGameDrawnDoubles: Math.max(freeScootDealtDoubles, freeGameDrawnDoubles),
    blockDiscardedJokerPickup: src.blockDiscardedJokerPickup !== false,
    groupingTimeSec: clampInt(src.groupingTimeSec, 60, 600, DEFAULT_RULES.groupingTimeSec),
    eliminationEnabled: Boolean(src.eliminationEnabled),
    scoreLimit: clampInt(src.scoreLimit, 100, 5000, DEFAULT_RULES.scoreLimit)
  };
}

export const CONFIG = {
  marriagePts: DEFAULT_RULES.marriagePts,
  tipluPts: DEFAULT_RULES.tipluPts,
  poochie1: DEFAULT_RULES.poochie1,
  poochie2: DEFAULT_RULES.poochie2,
  poochie3: DEFAULT_RULES.poochie3,
  firstDrop: DEFAULT_RULES.firstDrop,
  middleDrop: DEFAULT_RULES.middleDrop,
  maxDeadwood: DEFAULT_RULES.maxDeadwood
};

export function createDeck(rules = DEFAULT_RULES) {
  const rConfig = sanitizeRules(rules);
  const deck = [];
  let id = 1;
  const numDecks = rConfig.decks || 3;
  const poochiesPerDeck = rConfig.poochiesPerDeck ?? 1;

  for (let d = 0; d < numDecks; d++) {
    for (const suit of SUITS) {
      for (let r = 0; r < RANKS.length; r++) {
        deck.push({
          id: `c_${id++}`,
          suit,
          rank: RANKS[r],
          rankValue: r + 1,
          isPoochie: false
        });
      }
    }
    for (let p = 0; p < poochiesPerDeck; p++) {
      deck.push({
        id: `c_${id++}`,
        suit: '★',
        rank: 'PJ',
        rankValue: 0,
        isPoochie: true
      });
    }
  }

  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function resolveJokerRoles(cutCard) {
  if (cutCard.isPoochie) {
    return {
      tipluSuit: '♠',
      tipluRank: 'A',
      papluRank: '2',
      nichluRank: 'K'
    };
  }

  const idx = RANKS.indexOf(cutCard.rank);
  const papluIdx = (idx + 1) % 13;
  const nichluIdx = (idx - 1 + 13) % 13;

  return {
    tipluSuit: cutCard.suit,
    tipluRank: cutCard.rank,
    papluRank: RANKS[papluIdx],
    nichluRank: RANKS[nichluIdx]
  };
}

export function calculateMaal(hand, cutCard, rules = DEFAULT_RULES) {
  const rConfig = sanitizeRules(rules);
  const roles = resolveJokerRoles(cutCard);

  let poochies = 0;
  let tiplus = 0;
  let paplus = 0;
  let nichlus = 0;

  for (const card of hand) {
    if (!card) continue;
    if (card.isPoochie || card.suit === '★' || card.rank === 'PJ') {
      poochies++;
    } else if (card.suit === roles.tipluSuit && card.rank === roles.tipluRank) {
      tiplus++;
    } else if (card.suit === roles.tipluSuit && card.rank === roles.papluRank) {
      paplus++;
    } else if (card.suit === roles.tipluSuit && card.rank === roles.nichluRank) {
      nichlus++;
    }
  }

  // Marriages = (Taplu + Exact Cut Joker + Paplu) sets
  const marriages = Math.min(nichlus, tiplus, paplus);
  const remTiplus = tiplus - marriages;
  const remPaplus = paplus - marriages;
  const remTuplus = nichlus - marriages;

  const getTipluTier = (count) => {
    if (count <= 0) return 0;
    if (count === 1) return rConfig.tiplu1;
    if (count === 2) return rConfig.tiplu2;
    const extraStep = Math.max(0, rConfig.tiplu2 - rConfig.tiplu1);
    return rConfig.tiplu2 + (count - 2) * (extraStep || rConfig.tiplu1);
  };

  const getPoochieTier = (count) => {
    if (count <= 0) return 0;
    if (count === 1) return rConfig.poochie1;
    if (count === 2) return rConfig.poochie2;
    const extraStep = Math.max(0, rConfig.poochie3 - rConfig.poochie2);
    return rConfig.poochie3 + (count - 3) * (extraStep || rConfig.poochie1);
  };

  const getPoolTier = (count) => {
    if (count <= 0) return 0;
    if (count === 1) return rConfig.papluTaplu1;
    if (count === 2) return rConfig.papluTaplu2;
    const extraStep = Math.max(0, rConfig.papluTaplu3 - rConfig.papluTaplu2);
    return rConfig.papluTaplu3 + (count - 3) * (extraStep || rConfig.papluTaplu1);
  };

  const marriagePts = marriages * rConfig.marriagePts;
  const tipluPts = getTipluTier(remTiplus);
  const poochiePts = getPoochieTier(poochies);
  const papluPts = getPoolTier(remPaplus);
  const tupluPts = getPoolTier(remTuplus);

  const total = marriagePts + tipluPts + poochiePts + papluPts + tupluPts;

  return {
    total,
    details: {
      marriages,
      marriagePts,
      tiplus: remTiplus,
      tipluPts,
      poochies,
      poochiePts,
      paplus: remPaplus,
      papluPts,
      tuplus: remTuplus,
      tupluPts
    }
  };
}

export function isTunella(cards) {
  if (!Array.isArray(cards) || cards.length !== 3) return false;
  const first = cards[0];
  if (!first || first.isPoochie || first.rank === 'PJ' || first.suit === '★') return false;
  return cards.every(c => c && c.rank === first.rank && c.suit === first.suit && !c.isPoochie && c.rank !== 'PJ' && c.suit !== '★');
}

export function countTunellas(cards) {
  if (!Array.isArray(cards)) return { count: 0, tunellas: [] };
  const byExact = new Map();
  for (const c of cards) {
    if (!c || c.isPoochie || c.rank === 'PJ' || c.suit === '★') continue;
    const key = `${c.suit}_${c.rank}`;
    if (!byExact.has(key)) byExact.set(key, []);
    byExact.get(key).push(c);
  }
  const tunellas = [];
  for (const list of byExact.values()) {
    const numT = Math.floor(list.length / 3);
    for (let i = 0; i < numT; i++) {
      tunellas.push(list.slice(i * 3, i * 3 + 3));
    }
  }
  return { count: tunellas.length, tunellas };
}

export function calculateDeadwood(hand, cutCard, rules = DEFAULT_RULES) {
  return calculateGroupedDeadwood([], hand, cutCard, rules);
}

export function calculateGroupedDeadwood(groups, hand, cutCard, rules = DEFAULT_RULES) {
  if (!Array.isArray(hand) || !cutCard) return 0;
  const rConfig = sanitizeRules(rules);
  const doublesInfo = countDoubles(hand);
  if (rConfig.allowDoublesShow && doublesInfo.count >= rConfig.freeGameDrawnDoubles) {
    return 0; // Holding 7+ doubles (default) is free game / 0 deadwood
  }

  const handIds = new Set(hand.map(c => c.id));
  const usedIds = new Set();
  let validPureSequences = 0;
  const validMeldedIds = new Set();
  const qualifyingExemptIds = new Set(); // 4+ card pure runs and tunellas (exempt without minPureSequences)

  if (Array.isArray(groups) && groups.length > 0) {
    for (const group of groups) {
      if (!group) continue;
      const cardIds = Array.isArray(group.cardIds)
        ? group.cardIds
        : (Array.isArray(group.cards) ? group.cards.map(c => (c && c.id) ? c.id : c) : []);
      if (cardIds.length < 3) continue;

      const cards = [];
      let conflict = false;
      for (const id of cardIds) {
        if (!handIds.has(id) || usedIds.has(id)) { conflict = true; break; }
        cards.push(hand.find(c => c.id === id));
      }
      if (conflict) continue;

      const type = group.type || 'SEQUENCE';
      const isPure = isPureSequence(cards, cutCard, rConfig);
      const isTun = isTunella(cards);
      let isValid = false;

      if (isPure) {
        isValid = true;
        validPureSequences++;
      } else if (type === 'SEQUENCE' && isSequence(cards, cutCard, rConfig)) {
        isValid = true;
      } else if (type === 'SET' && isSet(cards, cutCard)) {
        isValid = true;
      }

      if (isValid) {
        for (const id of cardIds) {
          usedIds.add(id);
          validMeldedIds.add(id);
        }
        // Pure sequences of 4 or more cards are exempt from deadwood even without required pure sequences
        if (isPure && cards.length >= 4) {
          for (const id of cardIds) qualifyingExemptIds.add(id);
        }
        // Tunellas are exempt from deadwood even without required pure sequences
        if (isTun) {
          for (const id of cardIds) qualifyingExemptIds.add(id);
        }
      }
    }
  }

  // Also check if any unassigned/ungrouped cards form a Tunella
  if (validPureSequences < rConfig.minPureSequences) {
    const unassigned = hand.filter(c => !usedIds.has(c.id));
    const cardMap = new Map();
    for (const c of unassigned) {
      if (!c || c.isPoochie || c.rank === 'PJ' || c.suit === '★') continue;
      const key = `${c.suit}_${c.rank}`;
      if (!cardMap.has(key)) cardMap.set(key, []);
      cardMap.get(key).push(c.id);
    }
    for (const ids of cardMap.values()) {
      if (ids.length >= 3) {
        ids.slice(0, 3).forEach(id => qualifyingExemptIds.add(id));
      }
    }
  }

  const protectedCards = (validPureSequences >= rConfig.minPureSequences) ? validMeldedIds : qualifyingExemptIds;

  let points = 0;
  for (const card of hand) {
    if (protectedCards.has(card.id)) continue;
    const isJoker = isWildCard(card, cutCard);
    if (!isJoker) {
      if (['A', 'K', 'Q', 'J', '10'].includes(card.rank)) {
        points += 10;
      } else {
        points += parseInt(card.rank, 10) || 0;
      }
    }
  }

  return Math.min(points, rConfig.maxDeadwood);
}

export function getDeadwoodCards(groups, hand, cutCard, rules = DEFAULT_RULES) {
  if (!Array.isArray(hand) || !cutCard) return [];
  const rConfig = sanitizeRules(rules);
  const doublesInfo = countDoubles(hand);
  if (rConfig.allowDoublesShow && doublesInfo.count >= rConfig.freeGameDrawnDoubles) return [];

  const handIds = new Set(hand.map(c => c.id));
  const usedIds = new Set();
  let validPureSequences = 0;
  const validMeldedIds = new Set();
  const qualifyingExemptIds = new Set();

  if (Array.isArray(groups) && groups.length > 0) {
    for (const group of groups) {
      if (!group) continue;
      const cardIds = Array.isArray(group.cardIds)
        ? group.cardIds
        : (Array.isArray(group.cards) ? group.cards.map(c => (c && c.id) ? c.id : c) : []);
      if (cardIds.length < 3) continue;

      const cards = [];
      let conflict = false;
      for (const id of cardIds) {
        if (!handIds.has(id) || usedIds.has(id)) { conflict = true; break; }
        cards.push(hand.find(c => c.id === id));
      }
      if (conflict) continue;

      const type = group.type || 'SEQUENCE';
      const isPure = isPureSequence(cards, cutCard, rConfig);
      const isTun = isTunella(cards);
      let isValid = false;

      if (isPure) {
        isValid = true;
        validPureSequences++;
      } else if (type === 'SEQUENCE' && isSequence(cards, cutCard, rConfig)) {
        isValid = true;
      } else if (type === 'SET' && isSet(cards, cutCard)) {
        isValid = true;
      }

      if (isValid) {
        for (const id of cardIds) {
          usedIds.add(id);
          validMeldedIds.add(id);
        }
        if (isPure && cards.length >= 4) {
          for (const id of cardIds) qualifyingExemptIds.add(id);
        }
        if (isTun) {
          for (const id of cardIds) qualifyingExemptIds.add(id);
        }
      }
    }
  }

  if (validPureSequences < rConfig.minPureSequences) {
    const unassigned = hand.filter(c => !usedIds.has(c.id));
    const cardMap = new Map();
    for (const c of unassigned) {
      if (!c || c.isPoochie || c.rank === 'PJ' || c.suit === '★') continue;
      const key = `${c.suit}_${c.rank}`;
      if (!cardMap.has(key)) cardMap.set(key, []);
      cardMap.get(key).push(c.id);
    }
    for (const ids of cardMap.values()) {
      if (ids.length >= 3) {
        ids.slice(0, 3).forEach(id => qualifyingExemptIds.add(id));
      }
    }
  }

  const protectedCards = (validPureSequences >= rConfig.minPureSequences) ? validMeldedIds : qualifyingExemptIds;
  const deadwoodCards = [];
  for (const card of hand) {
    if (!card) continue;
    if (protectedCards.has(card.id)) continue;
    if (isWildCard(card, cutCard)) continue; // Jokers are NEVER deadwood!
    deadwoodCards.push(card);
  }
  return deadwoodCards;
}

export function countDoubles(cards) {
  if (!Array.isArray(cards)) return { count: 0, pairs: [] };
  const counts = new Map();
  for (const c of cards) {
    if (!c) continue;
    const key = (c.isPoochie || c.rank === 'PJ' || c.suit === '★')
      ? 'PJ_★'
      : `${c.suit}_${c.rank}`;
    if (!counts.has(key)) counts.set(key, []);
    counts.get(key).push(c);
  }
  let doubleCount = 0;
  const pairs = [];
  for (const cardList of counts.values()) {
    const numPairs = Math.floor(cardList.length / 2);
    for (let i = 0; i < numPairs; i++) {
      pairs.push([cardList[i * 2], cardList[i * 2 + 1]]);
      doubleCount++;
    }
  }
  return { count: doubleCount, pairs };
}

export function isWildCard(card, cutCard) {
  if (!card) return false;
  if (card.isPoochie || card.rank === 'PJ' || card.suit === '★' || card.isJoker) return true;
  if (!cutCard) return false;
  if (card.rank === cutCard.rank) return true;
  const roles = resolveJokerRoles(cutCard);
  return Boolean(card.rank === roles.tipluRank ||
    (card.suit === roles.tipluSuit && (card.rank === roles.papluRank || card.rank === roles.nichluRank)));
}

export function isMarriageGroup(cards, cutCard) {
  if (!Array.isArray(cards) || cards.length !== 3 || !cutCard) return false;
  const roles = resolveJokerRoles(cutCard);
  const hasTuplu = cards.some(c => c && c.suit === roles.tipluSuit && c.rank === roles.nichluRank);
  const hasTiplu = cards.some(c => c && c.suit === roles.tipluSuit && c.rank === roles.tipluRank);
  const hasPaplu = cards.some(c => c && c.suit === roles.tipluSuit && c.rank === roles.papluRank);
  return Boolean(hasTuplu && hasTiplu && hasPaplu);
}

export function isThreePoochies(cards) {
  if (!Array.isArray(cards) || cards.length !== 3) return false;
  return cards.every(c => c && (c.isPoochie || c.suit === '★' || c.rank === 'PJ'));
}

function rankValueForSequence(card) {
  if (card.rank === 'A') return [1, 14];
  const v = RANKS.indexOf(card.rank) + 1;
  return v > 0 ? [v] : [];
}

export function isPureSequence(cards, cutCard, rules = DEFAULT_RULES) {
  const rConfig = sanitizeRules(rules);
  if (!Array.isArray(cards) || cards.length < 3) return false;
  if (rConfig.allowMarriageAsPure && isMarriageGroup(cards, cutCard)) return true;
  if (rConfig.allow3PoochiesAsPure && isThreePoochies(cards)) return true;
  if (isTunella(cards)) return true;
  // A natural pure sequence cannot contain printed jokers, but CAN include a cut joker / wild card
  // as long as it is in its natural suit and number (e.g. 5♠-6♠-7♠ when 5♠ is pukka joker).
  if (cards.some(c => !c || c.isPoochie || c.rank === 'PJ' || c.suit === '★')) return false;
  const suit = cards[0].suit;
  if (!cards.every(c => c && c.suit === suit)) return false;
  const vals = cards.map(c => rankValueForSequence(c)[0]);
  if (new Set(vals).size !== vals.length) return false;
  const low = [...vals].sort((a, b) => a - b);
  if (low.every((v, i) => i === 0 || v === low[i - 1] + 1)) return true;
  const high = cards.map(c => c.rank === 'A' ? 14 : rankValueForSequence(c)[0]).sort((a, b) => a - b);
  return new Set(high).size === high.length && high.every((v, i) => i === 0 || v === high[i - 1] + 1);
}

function isSequence(cards, cutCard, rules = DEFAULT_RULES) {
  if (!Array.isArray(cards) || cards.length < 3) return false;
  if (isMarriageGroup(cards, cutCard)) return true;
  if (isThreePoochies(cards)) return true;
  if (isPureSequence(cards, cutCard, rules)) return true;
  const wilds = cards.filter(c => isWildCard(c, cutCard));
  const naturals = cards.filter(c => !isWildCard(c, cutCard));
  if (!naturals.length) return false;
  const suit = naturals[0].suit;
  if (!naturals.every(c => c.suit === suit)) return false;

  const n = cards.length;
  const naturalOptions = naturals.map(rankValueForSequence);
  // Try every consecutive window, including 10-J-Q-K-A. Ace can be low or high;
  // K-A-2 is never considered a valid run.
  for (let start = 1; start <= 15 - n; start++) {
    const target = new Set(Array.from({ length: n }, (_, i) => start + i));
    const used = new Set();
    let ok = true;
    for (const options of naturalOptions) {
      const match = options.find(v => target.has(v) && !used.has(v));
      if (match === undefined) { ok = false; break; }
      used.add(match);
    }
    const missingSlots = n - used.size;
    if (ok && missingSlots === wilds.length) return true;
  }
  return false;
}

function isSet(cards, cutCard) {
  if (cards.length < 3 || cards.length > 4) return false;
  const naturals = cards.filter(c => !isWildCard(c, cutCard));
  if (!naturals.length) return false;
  const rank = naturals[0].rank;
  if (!naturals.every(c => c.rank === rank)) return false;
  const suits = naturals.map(c => c.suit);
  return new Set(suits).size === suits.length;
}

export function validateShow(groups, hand, cutCard, isDealt = false, rules = DEFAULT_RULES) {
  if (!Array.isArray(hand) || !cutCard) return { valid: false, reason: 'Show hand is missing.' };
  const rConfig = sanitizeRules(rules);

  // Doubles declaration check:
  if (rConfig.allowDoublesShow) {
    const doublesInfo = countDoubles(hand);
    const minDoublesNeeded = isDealt ? rConfig.dealtDoublesForShow : rConfig.drawnDoublesForShow;
    if (doublesInfo.count >= minDoublesNeeded) {
      return { valid: true, pureSequences: 0, isDoubles: true, doubleCount: doublesInfo.count };
    }
  }

  // 3 Tunellas instant show check:
  if (rConfig.allow3TunellasShow) {
    const tunInfo = countTunellas(hand);
    if (tunInfo.count >= 3) {
      return { valid: true, pureSequences: tunInfo.count, isThreeTunellas: true, tunellaCount: tunInfo.count };
    }
  }

  if (!Array.isArray(groups)) return { valid: false, reason: 'Show groups are missing.' };
  const handIds = new Set(hand.map(c => c.id));
  const used = new Set();
  let pureSequences = 0;

  for (const group of groups) {
    if (!group || !Array.isArray(group.cardIds)) return { valid: false, reason: 'Invalid group format.' };
    const type = group.type || 'SEQUENCE';
    if (type === 'DOUBLE') {
      if (group.cardIds.length !== 2) return { valid: false, reason: 'A Double must contain exactly 2 identical cards.' };
      const [c1, c2] = group.cardIds.map(id => hand.find(c => c.id === id));
      if (!c1 || !c2) return { valid: false, reason: 'Cards not found in hand.' };
      const isIdentical = (c1.isPoochie && c2.isPoochie) || (c1.rank === c2.rank && c1.suit === c2.suit);
      if (!isIdentical) return { valid: false, reason: 'A Double must be two identical cards of the same rank and suit.' };
      group.cardIds.forEach(id => { used.add(id); });
      continue;
    }

    if (group.cardIds.length < 3) return { valid: false, reason: 'Every group must contain at least 3 cards (or 2 for a double).' };
    const cards = [];
    for (const id of group.cardIds) {
      if (!handIds.has(id) || used.has(id)) return { valid: false, reason: 'Each card must appear in exactly one group.' };
      used.add(id);
      cards.push(hand.find(c => c.id === id));
    }
    if (type === 'PURE_SEQUENCE') {
      if (!isPureSequence(cards, cutCard, rConfig)) return { valid: false, reason: 'A Pure Sequence must be 3+ consecutive cards of one suit with no joker substitution.' };
      pureSequences++;
    } else if (type === 'SEQUENCE') {
      if (!isSequence(cards, cutCard, rConfig)) return { valid: false, reason: 'That sequence is not a valid run.' };
    } else if (type === 'SET') {
      if (!isSet(cards, cutCard)) return { valid: false, reason: 'A set needs 3–4 cards of the same rank with different natural suits.' };
    } else return { valid: false, reason: 'Unknown group type.' };
  }

  if (used.size !== hand.length) return { valid: false, reason: `All ${hand.length} cards must be grouped; ${hand.length - used.size} card(s) are ungrouped.` };
  if (pureSequences < rConfig.minPureSequences) {
    return { valid: false, reason: `A ${hand.length}-card declaration requires at least ${rConfig.minPureSequences} Pure Sequence(s). You have ${pureSequences}.` };
  }
  return { valid: true, pureSequences };
}

export const calculateHonors = calculateMaal;

function cardFacePoints(card) {
  if (!card) return 0;
  if (['A', 'K', 'Q', 'J', '10'].includes(card.rank)) return 10;
  return parseInt(card.rank, 10) || 0;
}

function solveOptimalSuitPurePatterns(availCards, cutCard = null, options = {}) {
  if (!Array.isArray(availCards) || availCards.length < 3) return [];
  const {
    includeTunellas = false,
    includeWrapMarriage = false,
    extendWithNonWild = true
  } = options;

  const rankIndex = new Map(RANKS.map((r, idx) => [r, idx]));
  const buckets = Array.from({ length: 13 }, () => []);
  for (const c of availCards) {
    if (!c) continue;
    const idx = rankIndex.get(c.rank);
    if (idx !== undefined) buckets[idx].push(c);
  }
  const wildAtRank = buckets.map(list => list.length > 0 && isWildCard(list[0], cutCard));
  const counts = buckets.map(list => list.length);

  // Build candidate 3-card patterns ordered so joker-free / lower-joker options appear early
  const patterns = [];
  if (includeTunellas) {
    for (let r = 0; r < 13; r++) {
      if (counts[r] >= 3 && !wildAtRank[r]) {
        const pts = 3 * cardFacePoints(buckets[r][0]);
        patterns.push({ kind: 'TUNELLA', indices: [r, r, r], jokerCount: 0, tunBonus: 1, pts });
      }
    }
  }
  for (let i = 0; i <= 10; i++) {
    const idxs = [i, i + 1, i + 2];
    if (counts[idxs[0]] > 0 && counts[idxs[1]] > 0 && counts[idxs[2]] > 0) {
      const jokerCount = (wildAtRank[idxs[0]] ? 1 : 0) + (wildAtRank[idxs[1]] ? 1 : 0) + (wildAtRank[idxs[2]] ? 1 : 0);
      const pts = (wildAtRank[idxs[0]] ? 0 : cardFacePoints(buckets[idxs[0]][0]))
        + (wildAtRank[idxs[1]] ? 0 : cardFacePoints(buckets[idxs[1]][0]))
        + (wildAtRank[idxs[2]] ? 0 : cardFacePoints(buckets[idxs[2]][0]));
      patterns.push({ kind: 'RUN', indices: idxs, jokerCount, tunBonus: 0, pts });
    }
  }
  // Q-K-A high consecutive run
  if (counts[11] > 0 && counts[12] > 0 && counts[0] > 0) {
    const idxs = [11, 12, 0];
    const jokerCount = (wildAtRank[11] ? 1 : 0) + (wildAtRank[12] ? 1 : 0) + (wildAtRank[0] ? 1 : 0);
    const pts = (wildAtRank[11] ? 0 : 10) + (wildAtRank[12] ? 0 : 10) + (wildAtRank[0] ? 0 : 10);
    patterns.push({ kind: 'RUN', indices: idxs, jokerCount, tunBonus: 0, pts });
  }
  // K-A-2 wrap-around only valid when it is an allowed Marriage
  if (includeWrapMarriage && counts[12] > 0 && counts[0] > 0 && counts[1] > 0) {
    const idxs = [12, 0, 1];
    const jokerCount = (wildAtRank[12] ? 1 : 0) + (wildAtRank[0] ? 1 : 0) + (wildAtRank[1] ? 1 : 0);
    patterns.push({ kind: 'MARRIAGE_WRAP', indices: idxs, jokerCount, tunBonus: 0, pts: 0 });
  }

  // Sort patterns: prioritize 0 jokers first, then Tunellas, then higher natural pts (helps pruning)
  patterns.sort((a, b) => (a.jokerCount - b.jokerCount) || (b.tunBonus - a.tunBonus) || (b.pts - a.pts));

  let bestScore = { count: 0, negJokers: 0, tunBonus: 0, pts: 0 };
  let bestPicks = [];

  function isBetter(a, b) {
    if (a.count !== b.count) return a.count > b.count;
    if (a.negJokers !== b.negJokers) return a.negJokers > b.negJokers;
    if (a.tunBonus !== b.tunBonus) return a.tunBonus > b.tunBonus;
    return a.pts > b.pts;
  }

  function dfs(startIdx, remCounts, remTotal, picked, currJokers, currTun, currPts) {
    const maxPossibleCount = picked.length + Math.floor(remTotal / 3);
    if (maxPossibleCount < bestScore.count) return;
    if (maxPossibleCount === bestScore.count && -currJokers < bestScore.negJokers) return;

    const currScore = { count: picked.length, negJokers: -currJokers, tunBonus: currTun, pts: currPts };
    if (isBetter(currScore, bestScore)) {
      bestScore = currScore;
      bestPicks = [...picked];
    }

    for (let i = startIdx; i < patterns.length; i++) {
      const p = patterns[i];
      if (p.kind === 'TUNELLA') {
        const r = p.indices[0];
        if (remCounts[r] < 3) continue;
        remCounts[r] -= 3;
      } else {
        const [a, b, c] = p.indices;
        if (remCounts[a] < 1 || remCounts[b] < 1 || remCounts[c] < 1) continue;
        remCounts[a]--; remCounts[b]--; remCounts[c]--;
      }

      picked.push(p);
      dfs(i, remCounts, remTotal - 3, picked, currJokers + p.jokerCount, currTun + p.tunBonus, currPts + p.pts);
      picked.pop();

      if (p.kind === 'TUNELLA') {
        remCounts[p.indices[0]] += 3;
      } else {
        const [a, b, c] = p.indices;
        remCounts[a]++; remCounts[b]++; remCounts[c]++;
      }
    }
  }

  dfs(0, [...counts], availCards.length, [], 0, 0, 0);

  // Materialize actual card objects
  const usedIds = new Set();
  const popRank = (rIdx) => {
    const match = buckets[rIdx].find(c => c && !usedIds.has(c.id));
    if (match) usedIds.add(match.id);
    return match;
  };

  const results = bestPicks.map(p => ({
    kind: p.kind,
    cards: p.indices.map(popRank).filter(Boolean)
  })).filter(g => g.cards.length === 3);

  // Optionally extend consecutive runs strictly with NON-WILD cards so we never waste a joker
  if (extendWithNonWild) {
    const leftover = availCards.filter(c => c && !usedIds.has(c.id));
    for (const grp of results) {
      if (grp.kind !== 'RUN') continue;
      const run = grp.cards;
      let extended = true;
      while (extended) {
        extended = false;
        const firstRank = run[0].rank;
        const lastRank = run[run.length - 1].rank;
        const firstIdx = RANKS.indexOf(firstRank);
        if (firstIdx > 0) {
          const prevRank = RANKS[firstIdx - 1];
          const match = leftover.find(c => c.rank === prevRank && !usedIds.has(c.id) && !isWildCard(c, cutCard));
          if (match) {
            run.unshift(match);
            usedIds.add(match.id);
            extended = true;
            continue;
          }
        }
        const lastIdx = RANKS.indexOf(lastRank);
        if (lastRank !== 'A' && lastIdx >= 0 && lastIdx < RANKS.length - 1) {
          const nextRank = RANKS[lastIdx + 1];
          const match = leftover.find(c => c.rank === nextRank && !usedIds.has(c.id) && !isWildCard(c, cutCard));
          if (match) {
            run.push(match);
            usedIds.add(match.id);
            extended = true;
            continue;
          }
        }
        if (lastRank === 'K') {
          const match = leftover.find(c => c.rank === 'A' && !usedIds.has(c.id) && !isWildCard(c, cutCard));
          if (match) {
            run.push(match);
            usedIds.add(match.id);
            extended = true;
            continue;
          }
        }
      }
    }
  }

  return results;
}

export function extractOptimalPureRuns(availCards, cutCard = null) {
  return solveOptimalSuitPurePatterns(availCards, cutCard, {
    includeTunellas: false,
    includeWrapMarriage: false,
    extendWithNonWild: true
  }).map(g => g.cards);
}

export function autoArrangeHandToGroups(cards, cutCard, rules = DEFAULT_RULES) {
  if (!Array.isArray(cards) || cards.length === 0) return [];
  const rConfig = sanitizeRules(rules);
  const pool = cards.filter(Boolean);
  const usedIds = new Set();
  const groups = [];
  const getAvailable = () => pool.filter(c => c && !usedIds.has(c.id));

  const effectiveRoles = cutCard ? resolveJokerRoles(cutCard) : null;

  // 1. Optimal Pure Groups per suit (Natural Pure Runs + Tunellas + Marriage)
  // Maximizes pure sequence count and strictly avoids jokers whenever pure sequences can form without them.
  // Do not greedily extend 4th+ cards yet so unused natural cards remain free for Sets first.
  for (const suit of SUITS) {
    const suitNaturals = getAvailable().filter(c => c && c.suit === suit && !c.isPoochie && c.rank !== 'PJ' && c.suit !== '★');
    if (suitNaturals.length < 3) continue;
    const isMarriageWrap = Boolean(
      effectiveRoles && rConfig.allowMarriageAsPure &&
      suit === effectiveRoles.tipluSuit && effectiveRoles.tipluRank === 'A'
    );
    const optimalSuitGroups = solveOptimalSuitPurePatterns(suitNaturals, cutCard, {
      includeTunellas: true,
      includeWrapMarriage: isMarriageWrap,
      extendWithNonWild: false
    });
    for (const g of optimalSuitGroups) {
      g.cards.forEach(c => usedIds.add(c.id));
      let typeLabel = `Pure Run (${g.cards.length})`;
      if (g.kind === 'TUNELLA') {
        typeLabel = `Tunella (${g.cards[0].rank}${g.cards[0].suit} x3)`;
      } else if (isMarriageGroup(g.cards, cutCard) && rConfig.allowMarriageAsPure) {
        typeLabel = `Marriage Pure Run (${rConfig.marriagePts} pts)`;
      }
      groups.push({
        type: 'PURE_SEQUENCE',
        typeLabel,
        cardIds: g.cards.map(c => c.id),
        cards: g.cards,
        _kind: g.kind
      });
    }
  }

  // 2. 3 Poochies -> Pure Sequence (Tunella) when allowed
  if (rConfig.allow3PoochiesAsPure) {
    let searchingPoochies = true;
    while (searchingPoochies) {
      const avail = getAvailable();
      const poochies = avail.filter(c => c.isPoochie || c.suit === '★' || c.rank === 'PJ');
      if (poochies.length >= 3) {
        const trio = poochies.slice(0, 3);
        trio.forEach(c => usedIds.add(c.id));
        groups.push({
          type: 'PURE_SEQUENCE',
          typeLabel: '3 Poochies (Tunella)',
          cardIds: trio.map(c => c.id),
          cards: trio
        });
      } else {
        searchingPoochies = false;
      }
    }
  }

  // 3. Sets (3 or 4 non-wild cards of the same rank in different suits)
  for (const rnk of RANKS) {
    let foundSet = true;
    while (foundSet) {
      foundSet = false;
      const availSameRank = getAvailable().filter(c => c.rank === rnk && !isWildCard(c, cutCard));
      const bySuit = new Map();
      for (const c of availSameRank) {
        if (!bySuit.has(c.suit)) bySuit.set(c.suit, c);
      }
      if (bySuit.size >= 3) {
        const setCards = Array.from(bySuit.values()).slice(0, 4);
        setCards.forEach(c => usedIds.add(c.id));
        groups.push({
          type: 'SET',
          typeLabel: `Set of ${rnk}s (${setCards.length})`,
          cardIds: setCards.map(c => c.id),
          cards: setCards
        });
        foundSet = true;
      }
    }
  }

  // 4. Impure sequences (using wildcards) - safe loop without card reuse
  let searchingJokerRun = true;
  while (searchingJokerRun) {
    searchingJokerRun = false;
    const availWildcards = getAvailable().filter(c => isWildCard(c, cutCard));
    if (availWildcards.length === 0) break;

    for (const suit of SUITS) {
      const suitNaturals = getAvailable().filter(c => c && c.suit === suit && !isWildCard(c, cutCard));
      if (suitNaturals.length < 2) continue;

      let formedRun = false;
      for (let i = 0; i < suitNaturals.length; i++) {
        for (let j = i + 1; j < suitNaturals.length; j++) {
          const trio = [suitNaturals[i], suitNaturals[j], availWildcards[0]];
          if (isSequence(trio, cutCard, rConfig)) {
            trio.forEach(c => usedIds.add(c.id));
            groups.push({
              type: 'SEQUENCE',
              typeLabel: 'Joker Run',
              cardIds: trio.map(c => c.id),
              cards: trio
            });
            formedRun = true;
            searchingJokerRun = true;
            break;
          }
        }
        if (formedRun) break;
      }
      if (formedRun) break;
    }
  }

  // 4b. Joker Sets (2 non-wilds of same rank & distinct suits + 1 wildcard)
  let searchingJokerSet = true;
  while (searchingJokerSet) {
    searchingJokerSet = false;
    const availWildcards = getAvailable().filter(c => isWildCard(c, cutCard));
    if (availWildcards.length === 0) break;
    for (const rnk of RANKS) {
      const availSameRank = getAvailable().filter(c => c.rank === rnk && !isWildCard(c, cutCard));
      const bySuit = new Map();
      for (const c of availSameRank) {
        if (!bySuit.has(c.suit)) bySuit.set(c.suit, c);
      }
      if (bySuit.size >= 2) {
        const pair = Array.from(bySuit.values()).slice(0, 2);
        const trio = [...pair, availWildcards[0]];
        trio.forEach(c => usedIds.add(c.id));
        groups.push({
          type: 'SET',
          typeLabel: `Joker Set of ${rnk}s`,
          cardIds: trio.map(c => c.id),
          cards: trio
        });
        searchingJokerSet = true;
        break;
      }
    }
  }

  // 5. Extend consecutive Pure Runs with still-unused NON-WILD cards (never swallow a joker!)
  for (const g of groups) {
    if (g.type !== 'PURE_SEQUENCE' || g._kind !== 'RUN') continue;
    const run = g.cards;
    let extended = true;
    while (extended) {
      extended = false;
      const runSuit = run[0].suit;
      const firstRank = run[0].rank;
      const lastRank = run[run.length - 1].rank;
      const availSuit = getAvailable().filter(c => c && c.suit === runSuit && !isWildCard(c, cutCard));

      const firstIdx = RANKS.indexOf(firstRank);
      if (firstIdx > 0) {
        const prevRank = RANKS[firstIdx - 1];
        const match = availSuit.find(c => c.rank === prevRank);
        if (match) {
          run.unshift(match);
          usedIds.add(match.id);
          extended = true;
          continue;
        }
      }
      const lastIdx = RANKS.indexOf(lastRank);
      if (lastRank !== 'A' && lastIdx >= 0 && lastIdx < RANKS.length - 1) {
        const nextRank = RANKS[lastIdx + 1];
        const match = availSuit.find(c => c.rank === nextRank);
        if (match) {
          run.push(match);
          usedIds.add(match.id);
          extended = true;
          continue;
        }
      }
      if (lastRank === 'K') {
        const match = availSuit.find(c => c.rank === 'A');
        if (match) {
          run.push(match);
          usedIds.add(match.id);
          extended = true;
          continue;
        }
      }
    }
    g.cardIds = run.map(c => c.id);
    if (!g.typeLabel.startsWith('Marriage')) {
      g.typeLabel = `Pure Run (${run.length})`;
    }
  }

  // 6. Strict deduplication invariant: ensure no card ID appears in multiple groups
  const verifiedGroups = [];
  const claimedIds = new Set();
  for (const g of groups) {
    if (Array.isArray(g.cards) && g.cards.every(c => c && c.id && !claimedIds.has(c.id))) {
      g.cards.forEach(c => claimedIds.add(c.id));
      const { _kind, ...cleanGroup } = g;
      verifiedGroups.push(cleanGroup);
    }
  }

  return verifiedGroups;
}
