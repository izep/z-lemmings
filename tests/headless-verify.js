'use strict';
// Headless verification for Lemmings Cavern Rescue.
// Runs the real LemmingsEngine in headless mode (no DOM/canvas):
//   node tests/headless-verify.js
const { LemmingsEngine, SKILL_KEYS } = require('../game.js');
const LEVELS = require('../levels.js');

let failures = 0;
let passes = 0;
function check(name, cond, detail = '') {
  if (cond) { passes++; console.log(`  PASS  ${name}`); }
  else { failures++; console.log(`  FAIL  ${name} ${detail}`); }
}

function stepUntil(eng, cond, maxTicks) {
  let t = 0;
  while (t < maxTicks && !cond()) { eng.step(); t++; }
  return t;
}

// ---------------------------------------------------------------- Test 1: level defs
console.log('Test 1: level definitions');
check('5 levels defined', LEVELS.length === 5, `got ${LEVELS.length}`);
for (const lv of LEVELS) {
  const ok = lv.id && lv.name && lv.lemmingCount > 0 && lv.saveQuota > 0 &&
    lv.trapdoor && lv.exit && Array.isArray(lv.terrain) && lv.terrain.length > 0 &&
    lv.skills && Object.keys(lv.skills).length === 8;
  check(`level ${lv.id} "${lv.name}" def complete`, !!ok);
  const skillSum = Object.values(lv.skills).reduce((a, b) => a + b, 0);
  check(`level ${lv.id} has skills to assign`, skillSum > 0, `sum=${skillSum}`);
}

// ---------------------------------------------------------------- Test 2: soak every level
console.log('Test 2: soak test (no input, resolve or time out)');
for (const lv of LEVELS) {
  const eng = new LemmingsEngine({ headless: true });
  let threw = null;
  try {
    eng.loadLevel(lv, lv.id - 1);
    const ticks = stepUntil(eng, () => eng.finished, 25000);
    check(`L${lv.id} finishes (ticks=${ticks})`, eng.finished === true, `ticks=${ticks}`);
    check(`L${lv.id} all lemmings spawned`, eng.spawnedCount === lv.lemmingCount,
      `spawned=${eng.spawnedCount}/${lv.lemmingCount}`);
    const active = eng.lemmings.filter((l) => !l.removed).length;
    check(`L${lv.id} counters consistent`,
      eng.savedCount + eng.lostCount + active === lv.lemmingCount,
      `saved=${eng.savedCount} lost=${eng.lostCount} active=${active}`);
    console.log(`       L${lv.id} result: saved=${eng.savedCount} lost=${eng.lostCount} won=${eng.won}`);
  } catch (e) { threw = e; }
  check(`L${lv.id} no exception`, threw === null, threw && threw.stack);
}

// ---------------------------------------------------------------- Test 3: all 8 skills
console.log('Test 3: skill assignment (level 1)');
function walkingLemming(eng) {
  stepUntil(eng, () => eng.lemmings.some((l) => !l.removed && l.state === 'WALKING'), 4000);
  return eng.lemmings.find((l) => !l.removed && l.state === 'WALKING');
}
{
  const eng = new LemmingsEngine({ headless: true });
  eng.loadLevel(LEVELS[0], 0);

  let lem = walkingLemming(eng);
  check('a lemming starts walking', !!lem);
  const before = eng.skills.builder;
  check('assign builder', eng.assignSkill(lem, 'builder') === true);
  check('builder state + bricks', lem.state === 'BUILDING' && lem.bricksLeft === 12);
  check('builder count decremented', eng.skills.builder === before - 1);
  const bricks0 = lem.bricksLeft;
  stepUntil(eng, () => lem.bricksLeft < bricks0, 500);
  check('builder lays bricks', lem.bricksLeft < bricks0, `bricksLeft=${lem.bricksLeft}`);

  lem = walkingLemming(eng);
  check('assign blocker', eng.assignSkill(lem, 'blocker') === true && lem.state === 'BLOCKING');
  for (let i = 0; i < 120; i++) eng.step();
  check('blocker persists', lem.state === 'BLOCKING' && !lem.removed);

  lem = walkingLemming(eng);
  check('assign climber', eng.assignSkill(lem, 'climber') === true && lem.isClimber === true);

  lem = walkingLemming(eng);
  check('assign floater', eng.assignSkill(lem, 'floater') === true && lem.isFloater === true);

  lem = walkingLemming(eng);
  check('assign bomber', eng.assignSkill(lem, 'bomber') === true && lem.bomberTimer === 300);
  stepUntil(eng, () => lem.removed, 600);
  check('bomber explodes after 5s', lem.removed === true);

  lem = walkingLemming(eng);
  check('assign basher', eng.assignSkill(lem, 'basher') === true && lem.state === 'BASHING');

  lem = walkingLemming(eng);
  check('assign miner', eng.assignSkill(lem, 'miner') === true && lem.state === 'MINING');

  lem = walkingLemming(eng);
  const y0 = lem.y;
  check('assign digger', eng.assignSkill(lem, 'digger') === true && lem.state === 'DIGGING');
  for (let i = 0; i < 400; i++) eng.step();
  check('digger digs downward', lem.y > y0 + 4, `y ${y0} -> ${lem.y}`);

  // invalid assignments
  const beforeNuke = eng.skills.builder;
  eng.skills.builder = 0;
  const w = walkingLemming(eng);
  check('cannot assign with zero count', eng.assignSkill(w, 'builder') === false);
  check('zero count not decremented', eng.skills.builder === 0);
  void beforeNuke;
}

// ---------------------------------------------------------------- Test 4: scripted win, level 1
console.log('Test 4: scripted win path (level 1, chained builders)');
{
  const eng = new LemmingsEngine({ headless: true });
  eng.loadLevel(LEVELS[0], 0);
  let buildersUsed = 0;
  let ticks = 0;
  while (!eng.finished && ticks < 15000) {
    // Human-like play: chain builders on the lead lemming at the chasm edge.
    // Stop once anyone is across the gap (x > 640).
    const anyoneAcross = eng.lemmings.some((l) => !l.removed && l.x > 640);
    const someoneBuilding = eng.lemmings.some((l) => !l.removed && l.state === 'BUILDING');
    if (!anyoneAcross && !someoneBuilding && eng.skills.builder > 0) {
      const cands = eng.lemmings.filter((l) => !l.removed && l.state === 'WALKING' &&
        l.dir === 1 && l.x >= 470 && l.x <= 635);
      if (cands.length) {
        const leader = cands.reduce((a, b) => (b.x > a.x ? b : a));
        if (eng.assignSkill(leader, 'builder')) buildersUsed++;
      }
    }
    eng.step();
    ticks++;
  }
  console.log(`       ticks=${ticks} saved=${eng.savedCount} lost=${eng.lostCount} buildersUsed=${buildersUsed} finished=${eng.finished}`);
  check('level 1 finished', eng.finished === true);
  check('level 1 WON (quota 50%)', eng.won === true,
    `saved=${eng.savedCount}/${LEVELS[0].lemmingCount}`);
}

// ---------------------------------------------------------------- Test 5: scripted win, level 3 (100% quota)
console.log('Test 5: scripted win path (level 3, floaters + climbers)');
{
  const eng = new LemmingsEngine({ headless: true });
  eng.loadLevel(LEVELS[2], 2);
  let ticks = 0;
  while (!eng.finished && ticks < 15000) {
    for (const l of eng.lemmings) {
      if (l.removed) continue;
      if (!l.isFloater && eng.skills.floater > 0) eng.assignSkill(l, 'floater');
      if (l.state === 'WALKING' && l.dir === 1 && !l.isClimber &&
          l.x >= 680 && l.x <= 739 && eng.skills.climber > 0) {
        eng.assignSkill(l, 'climber');
      }
    }
    eng.step();
    ticks++;
  }
  console.log(`       ticks=${ticks} saved=${eng.savedCount} lost=${eng.lostCount} finished=${eng.finished}`);
  check('level 3 finished', eng.finished === true);
  check('level 3 WON (quota 100%)', eng.won === true,
    `saved=${eng.savedCount}/${LEVELS[2].lemmingCount}`);
}

// ---------------------------------------------------------------- Test 6: scripted win, level 2
console.log('Test 6: scripted win path (level 2, dig to steel, bash between tiers)');
{
  const eng = new LemmingsEngine({ headless: true });
  eng.loadLevel(LEVELS[1], 1);
  let dig1 = false, bash1 = false, dig2 = false, bash2 = false;
  let ticks = 0;
  while (!eng.finished && ticks < 20000) {
    for (const l of eng.lemmings) {
      if (l.removed || l.state !== 'WALKING') continue;
      if (!dig1 && l.y >= 295 && l.y <= 305 && l.x >= 320 && l.x <= 460 && eng.skills.digger > 0) {
        if (eng.assignSkill(l, 'digger')) dig1 = true;
      }
      if (dig1 && !bash1 && l.dir === 1 && l.y >= 380 && l.y <= 390 && l.x >= 440 && l.x <= 479 &&
          eng.isDirt(l.x + 8, l.y - 6) && eng.skills.basher > 0) {
        if (eng.assignSkill(l, 'basher')) bash1 = true;
      }
      if (bash1 && !dig2 && l.y >= 380 && l.y <= 390 && l.x >= 620 && l.x <= 765 && eng.skills.digger > 0) {
        if (eng.assignSkill(l, 'digger')) dig2 = true;
      }
      if (dig2 && !bash2 && l.dir === 1 && l.y >= 465 && l.y <= 475 && l.x >= 700 && l.x <= 769 &&
          eng.isDirt(l.x + 8, l.y - 6) && eng.skills.basher > 0) {
        if (eng.assignSkill(l, 'basher')) bash2 = true;
      }
    }
    eng.step();
    ticks++;
  }
  console.log(`       ticks=${ticks} saved=${eng.savedCount} lost=${eng.lostCount} finished=${eng.finished}`);
  check('level 2 finished', eng.finished === true);
  check('level 2 WON (quota 66%)', eng.won === true,
    `saved=${eng.savedCount}/${LEVELS[1].lemmingCount}`);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
