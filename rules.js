export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const DEFAULT_RULES = {
  presetName: 'Classic South Indian',
  decks: 3,
  poochiesPerDeck: 1,
  marriagePts: 50,
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
  allow3PoochiesAsPure: true,
  allowMarriageAsPure: true,
  allowDoublesShow: true,
  dealtDoublesForShow: 7,
  drawnDoublesForShow: 8,
  freeScootDealtDoubles: 6,
  freeGameDrawnDoubles: 7,
  blockDiscardedJokerPickup: true,
  groupingTimeSec: 300
};

export const RULE_PRESETS = {
  classic: { ...DEFAULT_RULES, presetName: 'Classic South Indian' },
  casual: {
    ...DEFAULT_RULES,
    presetName: 'Casual Family',
    firstDrop: 20,
    middleDrop: 50,
    forfeitPenalty: 80,
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
    tipluPts: 30,
    poochie1: 30,
    poochie2: 75,
    poochie3: 110,
    papluTaplu1: 15,
    papluTaplu2: 40,
    papluTaplu3: 70,
    firstDrop: 40,
    middleDrop: 80,
    forfeitPenalty: 120,
    maxDeadwood: 150
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

  const dealtDoublesForShow = clampInt(src.dealtDoublesForShow, 5, 10, DEFAULT_RULES.dealtDoublesForShow);
  const drawnDoublesForShow = clampInt(src.drawnDoublesForShow, 6, 10, DEFAULT_RULES.drawnDoublesForShow);
  const freeScootDealtDoubles = clampInt(src.freeScootDealtDoubles, 4, 9, DEFAULT_RULES.freeScootDealtDoubles);
  const freeGameDrawnDoubles = clampInt(src.freeGameDrawnDoubles, 5, 10, DEFAULT_RULES.freeGameDrawnDoubles);

  return {
    presetName,
    decks: 3,
    poochiesPerDeck: clampInt(src.poochiesPerDeck, 1, 2, DEFAULT_RULES.poochiesPerDeck),
    marriagePts: clampInt(src.marriagePts, 0, 250, DEFAULT_RULES.marriagePts),
    tipluPts: clampInt(src.tipluPts, 0, 150, DEFAULT_RULES.tipluPts),
    poochie1: clampInt(src.poochie1, 0, 150, DEFAULT_RULES.poochie1),
    poochie2: clampInt(src.poochie2, 0, 250, DEFAULT_RULES.poochie2),
    poochie3: clampInt(src.poochie3, 0, 350, DEFAULT_RULES.poochie3),
    papluTaplu1: clampInt(src.papluTaplu1, 0, 100, DEFAULT_RULES.papluTaplu1),
    papluTaplu2: clampInt(src.papluTaplu2, 0, 200, DEFAULT_RULES.papluTaplu2),
    papluTaplu3: clampInt(src.papluTaplu3, 0, 300, DEFAULT_RULES.papluTaplu3),
    firstDrop: clampInt(src.firstDrop, 0, 120, DEFAULT_RULES.firstDrop),
    middleDrop: clampInt(src.middleDrop, 0, 200, DEFAULT_RULES.middleDrop),
    forfeitPenalty: clampInt(src.forfeitPenalty, 0, 300, DEFAULT_RULES.forfeitPenalty),
    maxDeadwood: clampInt(src.maxDeadwood, 40, 300, DEFAULT_RULES.maxDeadwood),
    minPureSequences: clampInt(src.minPureSequences, 1, 4, DEFAULT_RULES.minPureSequences),
    allowTunnelaAsPure: src.allowTunnelaAsPure !== false,
    allow3PoochiesAsPure: src.allow3PoochiesAsPure !== false,
    allowMarriageAsPure: src.allowMarriageAsPure !== false,
    allowDoublesShow: src.allowDoublesShow !== false,
    dealtDoublesForShow,
    drawnDoublesForShow: Math.max(dealtDoublesForShow, drawnDoublesForShow),
    freeScootDealtDoubles,
    freeGameDrawnDoubles: Math.max(freeScootDealtDoubles, freeGameDrawnDoubles),
    blockDiscardedJokerPickup: src.blockDiscardedJokerPickup !== false,
    groupingTimeSec: clampInt(src.groupingTimeSec, 60, 600, DEFAULT_RULES.groupingTimeSec)
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
  const poochiesPerDeck = rConfig.poochiesPerDeck || 1;

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
  const tipluPts = remTiplus * rConfig.tipluPts;
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
  if (rConfig.allowTunnelaAsPure && isTunella(cards)) return true;
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
    return { valid: false, reason: `A 21-card declaration requires at least ${rConfig.minPureSequences} Pure Sequence(s). You have ${pureSequences}.` };
  }
  return { valid: true, pureSequences };
}

export const calculateHonors = calculateMaal;

export function extractOptimalPureRuns(availCards) {
  const windows = [];
  for (let i = 0; i <= RANKS.length - 3; i++) {
    windows.push(RANKS.slice(i, i + 3));
  }
  windows.push(['Q', 'K', 'A']);

  function solve(remaining) {
    let best = [];
    for (const win of windows) {
      const c0 = remaining.find(c => c.rank === win[0]);
      const c1 = remaining.find(c => c.rank === win[1] && c.id !== c0?.id);
      const c2 = remaining.find(c => c.rank === win[2] && c.id !== c0?.id && c.id !== c1?.id);
      if (c0 && c1 && c2) {
        const run = [c0, c1, c2];
        const nextRemaining = remaining.filter(c => c.id !== c0.id && c.id !== c1.id && c.id !== c2.id);
        const sub = solve(nextRemaining);
        const candidate = [run, ...sub];
        if (candidate.length > best.length) {
          best = candidate;
        }
      }
    }
    return best;
  }

  const best3Runs = solve(availCards);
  const usedIds = new Set(best3Runs.flatMap(r => r.map(c => c.id)));
  const leftover = availCards.filter(c => !usedIds.has(c.id));

  for (const run of best3Runs) {
    let extended = true;
    while (extended) {
      extended = false;
      const firstRank = run[0].rank;
      const lastRank = run[run.length - 1].rank;
      const firstIdx = RANKS.indexOf(firstRank);
      if (firstIdx > 0) {
        const prevRank = RANKS[firstIdx - 1];
        const match = leftover.find(c => c.rank === prevRank && !usedIds.has(c.id));
        if (match) {
          run.unshift(match);
          usedIds.add(match.id);
          extended = true;
          continue;
        }
      }
      const lastIdx = RANKS.indexOf(lastRank);
      if (lastIdx >= 0 && lastIdx < RANKS.length - 1) {
        const nextRank = RANKS[lastIdx + 1];
        const match = leftover.find(c => c.rank === nextRank && !usedIds.has(c.id));
        if (match) {
          run.push(match);
          usedIds.add(match.id);
          extended = true;
          continue;
        }
      }
      if (lastRank === 'K') {
        const match = leftover.find(c => c.rank === 'A' && !usedIds.has(c.id));
        if (match) {
          run.push(match);
          usedIds.add(match.id);
          extended = true;
          continue;
        }
      }
    }
  }
  return best3Runs;
}

export function autoArrangeHandToGroups(cards, cutCard, rules = DEFAULT_RULES) {
  if (!Array.isArray(cards) || cards.length === 0) return [];
  const rConfig = sanitizeRules(rules);
  const pool = cards.filter(Boolean);
  const usedIds = new Set();
  const groups = [];
  const getAvailable = () => pool.filter(c => c && !usedIds.has(c.id));

  const effectiveRoles = cutCard ? resolveJokerRoles(cutCard) : null;

  // 1. Marriages: (Taplu + Tiplu + Paplu in cut suit) -> Pure Sequence
  if (effectiveRoles && rConfig.allowMarriageAsPure) {
    const r = effectiveRoles;
    let searchingMarriage = true;
    while (searchingMarriage) {
      const avail = getAvailable();
      const taplu = avail.find(c => c.suit === r.tipluSuit && c.rank === r.nichluRank);
      const tiplu = avail.find(c => c.suit === r.tipluSuit && c.rank === r.tipluRank);
      const paplu = avail.find(c => c.suit === r.tipluSuit && c.rank === r.papluRank);
      if (taplu && tiplu && paplu && taplu.id !== tiplu.id && tiplu.id !== paplu.id && taplu.id !== paplu.id) {
        const trio = [taplu, tiplu, paplu];
        trio.forEach(c => usedIds.add(c.id));
        groups.push({
          type: 'PURE_SEQUENCE',
          typeLabel: `Marriage Pure Run (${rConfig.marriagePts} pts)`,
          cardIds: trio.map(c => c.id),
          cards: trio
        });
      } else {
        searchingMarriage = false;
      }
    }
  }

  // 2. 3 Poochies -> Pure Sequence (Tunella)
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

  // 3. Tunellas: (3 identical cards of exact same suit and rank)
  if (rConfig.allowTunnelaAsPure) {
    let searchingTunellas = true;
    while (searchingTunellas) {
      const avail = getAvailable().filter(c => !isWildCard(c, cutCard));
      const suitRankMap = new Map();
      for (const c of avail) {
        const key = `${c.suit}_${c.rank}`;
        if (!suitRankMap.has(key)) suitRankMap.set(key, []);
        suitRankMap.get(key).push(c);
      }
      let foundTun = false;
      for (const grp of suitRankMap.values()) {
        if (grp.length >= 3) {
          const trio = grp.slice(0, 3);
          trio.forEach(c => usedIds.add(c.id));
          groups.push({
            type: 'PURE_SEQUENCE',
            typeLabel: `Tunella (${trio[0].rank}${trio[0].suit} x3)`,
            cardIds: trio.map(c => c.id),
            cards: trio
          });
          foundTun = true;
          break;
        }
      }
      if (!foundTun) searchingTunellas = false;
    }
  }

  // 4. Natural Pure Sequences: Smart optimizer to maximize count of pure sequences
  for (const suit of SUITS) {
    const suitNaturals = getAvailable().filter(c => c && c.suit === suit && !c.isPoochie && c.rank !== 'PJ' && c.suit !== '★');
    if (suitNaturals.length >= 3) {
      const optimalRuns = extractOptimalPureRuns(suitNaturals);
      for (const run of optimalRuns) {
        run.forEach(c => usedIds.add(c.id));
        groups.push({
          type: 'PURE_SEQUENCE',
          typeLabel: `Pure Run (${run.length})`,
          cardIds: run.map(c => c.id),
          cards: run
        });
      }
    }
  }

  // 5. Sets (3 or 4 cards of the same rank in different suits)
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

  // 6. Impure sequences (using wildcards) - safe loop without card reuse
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

  // 7. Strict deduplication invariant: ensure no card ID appears in multiple groups
  const verifiedGroups = [];
  const claimedIds = new Set();
  for (const g of groups) {
    if (Array.isArray(g.cards) && g.cards.every(c => c && c.id && !claimedIds.has(c.id))) {
      g.cards.forEach(c => claimedIds.add(c.id));
      verifiedGroups.push(g);
    }
  }

  return verifiedGroups;
}
