// ── GENERIC REWARD MODEL ───────────────────────────────────────────────────
// "Where is the thrill?" Every reward source in the game, as DATA: a value and the
// motor skill that collects it. The planner (debug.js _planReward) reads this and
// maximizes total value. To extend the game — or PORT to another game — you add a
// row here and (if new) one motor skill; the planner is untouched. Pure (browser+node).
//
//   method:  reach  — be at the point (coins, the flag)
//            bump   — jump up into it from below (? blocks, bricks)
//            stomp  — land on top of it from above (walkers, the boss)
//            ride   — step onto it (springs, dash pads — the "thrill" beats)
export const REWARD = {
  coin:   { value: 1,   method: 'reach' },
  qblock: { value: 5,   method: 'bump'  },   // ? block → coins / mushroom
  power:  { value: 9,   method: 'bump'  },   // power ? block → the empowerment beat
  brick:  { value: 1,   method: 'bump'  },
  enemy:  { value: 4,   method: 'stomp' },   // stompable walker
  boss:   { value: 40,  method: 'stomp' },   // the climactic duel
  spring: { value: 2,   method: 'ride'  },   // a thrill launch
  dash:   { value: 2,   method: 'ride'  },
  goal:   { value: 100, method: 'reach' },   // finishing is itself the biggest reward
};

// Enumerate every uncollected reward in the live game state → [{kind,x,y,value,method,...}].
// x,y are in PIXELS (snapshot space) so the planner can measure distance directly.
export function rewardMap(s) {
  const r = [];
  (s.coinsList || []).forEach((c) => r.push({ kind: 'coin', x: c.x, y: c.y, ...REWARD.coin }));
  (s.blocksList || []).forEach((b) => {
    if (b.used) return;
    if (b.kind === 'qblock') r.push({ kind: b.power ? 'power' : 'qblock', x: b.x, y: b.y, ...(b.power ? REWARD.power : REWARD.qblock) });
    else if (b.kind === 'brick') r.push({ kind: 'brick', x: b.x, y: b.y, ...REWARD.brick });
  });
  (s.enemiesList || []).forEach((e) => { if (!e.alive) return; if (e.boss) r.push({ kind: 'boss', x: e.x, y: e.y, ...REWARD.boss }); else if (!e.fly) r.push({ kind: 'enemy', x: e.x, y: e.y, ...REWARD.enemy }); });
  (s.springsList || []).forEach((sp) => r.push({ kind: 'spring', x: sp.x, y: sp.y, ...REWARD.spring }));
  if (s.goalX != null) r.push({ kind: 'goal', x: s.goalX, y: (s.player ? s.player.y : 0), ...REWARD.goal });
  return r;
}

// Total value still on the table (a "thrill remaining" gauge for the planner/eval).
export function rewardTotal(s) { return rewardMap(s).reduce((a, b) => a + (b.kind === 'goal' ? 0 : b.value), 0); }
