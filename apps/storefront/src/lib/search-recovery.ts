// Bounded, deterministic hints only: callers retain exact search until chosen.
function oneEditAway(left: string, right: string): boolean {
  if (left === right || Math.abs(left.length - right.length) > 1) return false;
  if (left.length === right.length) {
    const mismatches: number[] = [];
    for (let i = 0; i < left.length; i++) {
      if (left[i] !== right[i]) mismatches.push(i);
      if (mismatches.length > 2) return false;
    }
    if (mismatches.length === 1) return true;
    const [a, b] = mismatches;
    return b === a + 1 && left[a] === right[b] && left[b] === right[a];
  }
  const short = left.length < right.length ? left : right;
  const long = left.length < right.length ? right : left;
  let i = 0;
  while (i < short.length && short[i] === long[i]) i++;
  return short.slice(i) === long.slice(i + 1);
}

export function suggestSearchTerms(query: string, eligibleNames: string[]): string[] {
  const term = query.trim().toLowerCase();
  // Multiword, very short, long and non-ASCII input stays exact-search only.
  if (!/^[a-z]{4,32}$/.test(term)) return [];
  const candidates = new Set(
    eligibleNames.flatMap(name => (name.toLowerCase().match(/[a-z]+/g) || []).filter(word => word.length >= 4 && word.length <= 32)),
  );
  return [...candidates].filter(candidate => oneEditAway(term, candidate)).sort().slice(0, 3);
}
