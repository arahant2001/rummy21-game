export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const CONFIG = {
  marriagePts: 50,
  tipluPts: 20,
  poochie1: 20,
  poochie2: 50,
  poochie3: 70,
  papluNichlu1: 10,
  papluNichlu2: 30,
  papluNichlu3: 50,
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
    if (card.isPoochie) {
      poochies++;
    } else if (card.suit === roles.tipluSuit && card.rank === roles.tipluRank) {
      tiplus++;
    } else if (card.suit === roles.tipluSuit && card.rank === roles.papluRank) {
      paplus++;
    } else if (card.suit === roles.tipluSuit && card.rank === roles.nichluRank) {
      nichlus++;
    }
  }

  // Marriages = (Nichlu + Tiplu + Paplu) sets
  const marriages = Math.min(nichlus, tiplus, paplus);
  const remTiplus = tiplus - marriages;
  const remPapluNichlu = (paplus - marriages) + (nichlus - marriages);

  const getTiered = (count, s1, s2, s3) => {
    if (count <= 0) return 0;
    if (count === 1) return s1;
    if (count === 2) return s2;
    return s3 + (count - 3) * s1;
  };

  const marriagePts = marriages * CONFIG.marriagePts;
  const tipluPts = remTiplus * CONFIG.tipluPts;
  const poochiePts = getTiered(poochies, CONFIG.poochie1, CONFIG.poochie2, CONFIG.poochie3);
  const papluNichluPts = getTiered(remPapluNichlu, CONFIG.papluNichlu1, CONFIG.papluNichlu2, CONFIG.papluNichlu3);

  const total = marriagePts + tipluPts + poochiePts + papluNichluPts;

  return {
    total,
    details: {
      marriages,
      marriagePts,
      tiplus: remTiplus,
      tipluPts,
      poochies,
      poochiePts,
      papluNichlu: remPapluNichlu,
      papluNichluPts
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