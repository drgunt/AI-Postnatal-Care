const test = require('node:test');
const assert = require('node:assert');
const { assess } = require('../web/risk-engine.js');
const { recommend } = require('../web/ttm.js');
const { check } = require('../web/herbs.js');

const base = { days: 10, delivery: 'vaginal', bleeding: 'normal', tempC: 36.8, pain: 2, sys: 118, dia: 76, epds: 4 };
const lvl = (o) => assess({ ...base, ...o }).level;

test('baseline is green', () => assert.strictEqual(lvl({}), 'green'));
test('heavy bleeding is red', () => assert.strictEqual(lvl({ bleeding: 'heavy' }), 'red'));
test('severe BP is red', () => assert.strictEqual(lvl({ sys: 165, dia: 100 }), 'red'));
test('headache + high BP is red', () => assert.strictEqual(lvl({ headacheVision: true, sys: 146, dia: 92 }), 'red'));
test('self-harm is red', () => assert.strictEqual(lvl({ selfHarm: true }), 'red'));
test('fever alone is orange, fever + foul lochia is red', () => {
  assert.strictEqual(lvl({ tempC: 38.4 }), 'orange');
  assert.strictEqual(lvl({ tempC: 38.4, foulLochia: true }), 'red');
});
test('moderate pain / low milk is yellow', () => {
  assert.strictEqual(lvl({ pain: 5 }), 'yellow');
  assert.strictEqual(lvl({ milk: 'low' }), 'yellow');
});
test('highest level wins and reasons sorted', () => {
  const r = assess({ ...base, pain: 5, tempC: 38.5 });
  assert.strictEqual(r.level, 'orange');
  assert.strictEqual(r.reasons[0].level, 'orange');
});
test('missing vitals are reported', () => assert.deepStrictEqual(assess({ days: 5 }).missing.length, 3));

test('TTM: red blocks everything, orange defers to staff', () => {
  assert.strictEqual(recommend({ ...base, bleeding: 'heavy' }, assess({ ...base, bleeding: 'heavy' })).gate, 'blocked');
  const o = { ...base, tempC: 38.2 };
  assert.strictEqual(recommend(o, assess(o)).gate, 'review');
});
test('TTM: C-section early days defer heat procedures', () => {
  const a = { ...base, delivery: 'cesarean', days: 10, pain: 3 };
  const items = recommend(a, assess(a)).items;
  assert.ok(items.filter(i => ['saltpot', 'steam'].includes(i.id)).every(i => i.status === 'defer'));
});
test('TTM: PPH history avoids heat procedures', () => {
  const a = { ...base, hxPPH: true, days: 20 };
  const items = recommend(a, assess(a)).items;
  assert.ok(items.filter(i => ['saltpot', 'steam'].includes(i.id)).every(i => i.status === 'avoid'));
});
test('TTM: never emits an auto-approved status', () => {
  const a = { ...base, days: 30, pain: 3 };
  assert.ok(recommend(a, assess(a)).items.every(i => ['consider', 'defer', 'avoid'].includes(i.status)));
});

test('Herbs: unknown product fails safe to consult', () => assert.strictEqual(check('ผลิตภัณฑ์ลึกลับ', {}).verdict, 'consult'));
test('Herbs: PPH history -> avoid postpartum remedy', () => assert.strictEqual(check('ยาขับน้ำคาวปลา', { hxPPH: true }).verdict, 'avoid'));
test('Herbs: ginger ok, but consult with anticoagulant', () => {
  assert.strictEqual(check('ขิง', {}).verdict, 'ok');
  assert.strictEqual(check('ขิง', { anticoag: true }).verdict, 'consult');
});
test('Herbs: licorice avoided with hypertension', () => assert.strictEqual(check('ชะเอมเทศ', { htn: true }).verdict, 'avoid'));
