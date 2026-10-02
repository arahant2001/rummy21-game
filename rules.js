export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const CONFIG = {
  marriagePts: 50,
  tipluPts: 20,
  poochie1: 20,
  poochie2: 50,
  poochie3: 70,
  firstDrop: 30,
  middleDrop: 70,
  maxDeadwood: 120
};

export function createDeck() {
  const deck = [];
  let id = 1;

  // 3 standard decks (156 cards)
  for (let d = 0; d < 3; d++) {
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
    // 2 printed jokers (poochies) per deck (6 total)
    for (let j = 0; j < 2; j++) {
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

export function calculateMaal(hand, cutCard) {
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
    if (count === 1) return CONFIG.poochie1;
    if (count === 2) return CONFIG.poochie2;
    return CONFIG.poochie3 + (count - 3) * CONFIG.poochie1;
  };

  const getPoolTier = (count) => {
    if (count <= 0) return 0;
    if (count === 1) return 10;
    if (count === 2) return 30;
    return 50 + (count - 3) * 10;
  };

  const marriagePts = marriages * CONFIG.marriagePts;
  const tipluPts = remTiplus * CONFIG.tipluPts;
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

export function calculateDeadwood(hand, cutCard) {
  const roles = resolveJokerRoles(cutCard);
  let points = 0;
  for (const card of hand) {
    const isJoker = card.isPoochie ||
      card.rank === roles.tipluRank ||
      (card.suit === roles.tipluSuit && (card.rank === roles.papluRank || card.rank === roles.nichluRank));

    if (!isJoker) {
      if (['A', 'K', 'Q', 'J', '10'].includes(card.rank)) {
        points += 10;
      } else {
        points += parseInt(card.rank, 10) || 0;
      }
    }
  }
  return Math.min(points, CONFIG.maxDeadwood);
}

export function calculateGroupedDeadwood(groups, hand, cutCard) {
  if (!Array.isArray(hand) || !cutCard) return 0;
  const roles = resolveJokerRoles(cutCard);

  if (!Array.isArray(groups) || groups.length === 0) {
    return calculateDeadwood(hand, cutCard);
  }

  const handIds = new Set(hand.map(c => c.id));
  const usedIds = new Set();
  let validPureSequences = 0;
  const validMeldedIds = new Set();

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
    let isValid = false;
    if (type === 'PURE_SEQUENCE' && isPureSequence(cards, cutCard)) {
      isValid = true;
      validPureSequences++;
    } else if (type === 'SEQUENCE' && isSequence(cards, cutCard)) {
      isValid = true;
    } else if (type === 'SET' && isSet(cards, cutCard)) {
      isValid = true;
    }

    if (isValid) {
      for (const id of cardIds) {
        usedIds.add(id);
        validMeldedIds.add(id);
      }
    }
  }

  // Having at least 3 pure sequences unlocks full meld protection: valid groups count as 0 deadwood
  const protectedCards = (validPureSequences >= 3) ? validMeldedIds : new Set();

  let points = 0;
  for (const card of hand) {
    if (protectedCards.has(card.id)) continue;
    const isJoker = card.isPoochie ||
      card.rank === roles.tipluRank ||
      (card.suit === roles.tipluSuit && (card.rank === roles.papluRank || card.rank === roles.nichluRank));

    if (!isJoker) {
      if (['A', 'K', 'Q', 'J', '10'].includes(card.rank)) {
        points += 10;
      } else {
        points += parseInt(card.rank, 10) || 0;
      }
    }
  }
  return Math.min(points, CONFIG.maxDeadwood || 120);
}

export function isWildCard(card, cutCard) {
  if (!card || !cutCard) return false;
  const roles = resolveJokerRoles(cutCard);
  return Boolean(card.isPoochie || card.rank === roles.tipluRank ||
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

function isPureSequence(cards, cutCard) {
  if (!Array.isArray(cards) || cards.length < 3) return false;
  if (isMarriageGroup(cards, cutCard)) return true;
  if (isThreePoochies(cards)) return true;
  if (cards.some(c => isWildCard(c, cutCard))) return false;
  if (cards.length === 3 && cards.every(c => c.rank === cards[0].rank && c.suit === cards[0].suit)) return true;
  const suit = cards[0].suit;
  if (!cards.every(c => c.suit === suit)) return false;
  const vals = cards.map(c => rankValueForSequence(c)[0]);
  if (new Set(vals).size !== vals.length) return false;
  const low = [...vals].sort((a,b)=>a-b);
  if (low.every((v,i)=>i===0 || v===low[i-1]+1)) return true;
  const high = cards.map(c => c.rank === 'A' ? 14 : rankValueForSequence(c)[0]).sort((a,b)=>a-b);
  return new Set(high).size === high.length && high.every((v,i)=>i===0 || v===high[i-1]+1);
}

function isSequence(cards, cutCard) {
  if (!Array.isArray(cards) || cards.length < 3) return false;
  if (isMarriageGroup(cards, cutCard)) return true;
  if (isThreePoochies(cards)) return true;
  if (isPureSequence(cards, cutCard)) return true;
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
    const target = new Set(Array.from({length:n}, (_, i) => start + i));
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

export function validateShow(groups, hand, cutCard) {
  if (!Array.isArray(groups) || !Array.isArray(hand) || !cutCard) return { valid:false, reason:'Show groups are missing.' };
  const handIds = new Set(hand.map(c=>c.id));
  const used = new Set();
  let pureSequences = 0;

  for (const group of groups) {
    if (!group || !Array.isArray(group.cardIds) || group.cardIds.length < 3) return { valid:false, reason:'Every group must contain at least 3 cards.' };
    const cards = [];
    for (const id of group.cardIds) {
      if (!handIds.has(id) || used.has(id)) return { valid:false, reason:'Each card must appear in exactly one group.' };
      used.add(id);
      cards.push(hand.find(c=>c.id===id));
    }
    const type = group.type || 'SEQUENCE';
    if (type === 'PURE_SEQUENCE') {
      if (!isPureSequence(cards, cutCard)) return { valid:false, reason:'A Pure Sequence must be 3+ consecutive cards of one suit with no joker substitution.' };
      pureSequences++;
    } else if (type === 'SEQUENCE') {
      if (!isSequence(cards, cutCard)) return { valid:false, reason:'That sequence is not a valid run.' };
    } else if (type === 'SET') {
      if (!isSet(cards, cutCard)) return { valid:false, reason:'A set needs 3–4 cards of the same rank with different natural suits.' };
    } else return { valid:false, reason:'Unknown group type.' };
  }

  if (used.size !== hand.length) return { valid:false, reason:`All \${hand.length} cards must be grouped; \${hand.length-used.size} card(s) are ungrouped.` };
  if (pureSequences < 3) return { valid:false, reason:`A 21-card declaration requires at least 3 Pure Sequences. You have \${pureSequences}.` };
  return { valid:true, pureSequences };
}
