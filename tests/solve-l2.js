'use strict';
// Solver: level 2 "Down Under" - dig to each steel floor, bash right between tiers.
// Lessons: dig the first shaft AWAY from the trapdoor (x=240) so spawners don't
// fall down the open shaft, and start bashers where dirt is actually ahead.
const { LemmingsEngine } = require('../game.js');
const LEVELS = require('../levels.js');

const eng = new LemmingsEngine({ headless: true });
eng.loadLevel(LEVELS[1], 1);

let dig1 = false, bash1 = false, dig2 = false, bash2 = false;
let ticks = 0;
while (!eng.finished && ticks < 20000) {
  for (const l of eng.lemmings) {
    if (l.removed || l.state !== 'WALKING') continue;
    // Phase 1: dig from the top deck into the Tier-1 gallery (away from trapdoor x=240)
    if (!dig1 && l.y >= 295 && l.y <= 305 && l.x >= 320 && l.x <= 460 && eng.skills.digger > 0) {
      if (eng.assignSkill(l, 'digger')) { dig1 = true; console.log(`tick ${ticks}: digger#1 -> lem ${l.id} at (${l.x},${l.y})`); }
    }
    // Phase 2: bash right from the gallery's east end into the Tier-2 chamber
    if (dig1 && !bash1 && l.dir === 1 && l.y >= 380 && l.y <= 390 && l.x >= 440 && l.x <= 479 &&
        eng.isDirt(l.x + 8, l.y - 6) && eng.skills.basher > 0) {
      if (eng.assignSkill(l, 'basher')) { bash1 = true; console.log(`tick ${ticks}: basher#1 -> lem ${l.id} at (${l.x},${l.y})`); }
    }
    // Phase 3: dig from Tier-2 chamber floor into the lower gallery
    if (bash1 && !dig2 && l.y >= 380 && l.y <= 390 && l.x >= 620 && l.x <= 765 && eng.skills.digger > 0) {
      if (eng.assignSkill(l, 'digger')) { dig2 = true; console.log(`tick ${ticks}: digger#2 -> lem ${l.id} at (${l.x},${l.y})`); }
    }
    // Phase 4: bash right from the lower gallery's east end into the exit cavern
    if (dig2 && !bash2 && l.dir === 1 && l.y >= 465 && l.y <= 475 && l.x >= 700 && l.x <= 769 &&
        eng.isDirt(l.x + 8, l.y - 6) && eng.skills.basher > 0) {
      if (eng.assignSkill(l, 'basher')) { bash2 = true; console.log(`tick ${ticks}: basher#2 -> lem ${l.id} at (${l.x},${l.y})`); }
    }
  }
  eng.step();
  ticks++;
}
console.log(`L2 result: ticks=${ticks} saved=${eng.savedCount}/${LEVELS[1].lemmingCount} lost=${eng.lostCount} won=${eng.won} finished=${eng.finished}`);
process.exit(eng.won ? 0 : 1);
