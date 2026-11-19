import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_STATE, validateHorizon, validateScenario, calculateScenario, compareScenario } from '../src/model.js';

const scenario = (overrides = {}) => ({ ...DEFAULT_STATE.scenarios[0], ...overrides });
const approximately = (actual, expected, message = '') => {
  assert.ok(Math.abs(actual - expected) <= 1e-12 * Math.max(1, Math.abs(expected)),
    `${message}: expected ${expected}, received ${actual}`);
};

function compare(input, baseline = scenario(), horizon = 6) {
  return compareScenario(calculateScenario(input, horizon), calculateScenario(baseline, horizon), horizon);
}

function assertAllNumbersFinite(value) {
  if (typeof value === 'number') assert.ok(Number.isFinite(value));
  else if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) assertAllNumbersFinite(child);
  }
}

test('the four documented scenarios reproduce absolute monthly and horizon results', () => {
  const expected = [
    { consultationRate: 5, monthlyClients: 10, monthlyRevenue: 2_000, monthlyMargin: 800,
      totalClients: 60, totalRevenue: 12_000, totalMargin: 4_800, net: 4_800 },
    { consultationRate: 5, monthlyClients: 15, monthlyRevenue: 3_000, monthlyMargin: 1_200,
      totalClients: 90, totalRevenue: 18_000, totalMargin: 7_200, net: 4_200 },
    { consultationRate: 5, monthlyClients: 20, monthlyRevenue: 4_000, monthlyMargin: 1_600,
      totalClients: 120, totalRevenue: 24_000, totalMargin: 9_600, net: 6_600 },
    { consultationRate: 6, monthlyClients: 37.5, monthlyRevenue: 7_500, monthlyMargin: 3_000,
      totalClients: 225, totalRevenue: 45_000, totalMargin: 18_000, net: 15_000 },
  ];
  DEFAULT_STATE.scenarios.forEach((input, index) => {
    assert.deepEqual(calculateScenario(input, DEFAULT_STATE.horizon), {
      investment: input.investment, ...expected[index],
    });
  });
});

test('incremental results use only the improvement over the initial situation', () => {
  const results = DEFAULT_STATE.scenarios.map((input) => calculateScenario(input, 6));
  const expected = [
    { investment: 0, monthlyMargin: 0, revenue: 0, margin: 0, net: 0, roi: null,
      status: 'no-additional', months: null, firstFullMonth: null },
    { investment: 3_000, monthlyMargin: 400, revenue: 6_000, margin: 2_400, net: -600, roi: -20,
      status: 'beyond', months: 7.5, firstFullMonth: 8 },
    { investment: 3_000, monthlyMargin: 800, revenue: 12_000, margin: 4_800, net: 1_800, roi: 60,
      status: 'within', months: 3.75, firstFullMonth: 4 },
    { investment: 3_000, monthlyMargin: 2_200, revenue: 33_000, margin: 13_200, net: 10_200, roi: 340,
      status: 'within', months: 15 / 11, firstFullMonth: 2 },
  ];
  results.forEach((result, index) => {
    const actual = compareScenario(result, results[0], 6);
    const item = expected[index];
    assert.equal(actual.deltaInvestment, item.investment);
    assert.equal(actual.deltaMonthlyMargin, item.monthlyMargin);
    assert.equal(actual.deltaRevenue, item.revenue);
    assert.equal(actual.deltaMargin, item.margin);
    assert.equal(actual.deltaNet, item.net);
    assert.equal(actual.roi, item.roi);
    assert.deepEqual(actual.payback, {
      status: item.status, months: item.months, firstFullMonth: item.firstFullMonth,
    });
    assert.equal(actual.timeline.length, 7);
    assert.equal(actual.timeline[0].net, item.investment === 0 ? 0 : -item.investment);
    assert.equal(actual.timeline.at(-1).net, item.net);
  });
});

test('zero months retain the initial outlay while all accumulated activity is zero', () => {
  const input = scenario({ investment: 300, marginPerClient: -20 });
  const result = calculateScenario(input, 0);
  for (const field of ['totalClients', 'totalRevenue', 'totalMargin']) assert.equal(result[field], 0);
  assert.equal(result.net, -300);
  const comparison = compare(input, scenario(), 0);
  assert.equal(comparison.deltaNet, -300);
  assert.equal(comparison.roi, -100);
  assert.deepEqual(comparison.timeline, [{ month: 0, net: -300 }]);
  assert.equal(compare(scenario({ investment: 300, consultations: 100 }), scenario(), 0).payback.status, 'beyond');
});

test('zero visits, consultations and closing have explicit finite results', () => {
  const noVisits = calculateScenario(scenario({ visits: 0, consultations: 0, investment: 100 }), 6);
  assert.equal(noVisits.consultationRate, null);
  assert.equal(noVisits.monthlyClients, 0);
  assert.equal(noVisits.totalRevenue, 0);
  assert.equal(noVisits.net, -100);
  const noConsultations = calculateScenario(scenario({ consultations: 0 }), 6);
  assert.equal(noConsultations.consultationRate, 0);
  assert.equal(noConsultations.monthlyMargin, 0);
  const noClosing = calculateScenario(scenario({ closeRate: 0 }), 6);
  assert.equal(noClosing.monthlyClients, 0);
  assert.equal(noClosing.monthlyRevenue, 0);
  const noRevenue = calculateScenario(scenario({ revenuePerClient: 0, marginPerClient: 0 }), 6);
  assert.equal(noRevenue.totalMargin, 0);
  for (const result of [noVisits, noConsultations, noClosing, noRevenue]) assertAllNumbersFinite(result);
});

test('additional investment cannot recover without positive additional monthly margin', () => {
  const unchangedMargin = compare(scenario({ investment: 300 }));
  assert.deepEqual(unchangedMargin.payback, { status: 'never', months: null, firstFullMonth: null });
  assert.equal(unchangedMargin.roi, -100);
  const negativeMargin = compare(scenario({ investment: 100, visits: 10, consultations: 10,
    closeRate: 100, marginPerClient: -20 }), scenario({ consultations: 0 }), 2);
  assert.equal(negativeMargin.deltaMonthlyMargin, -200);
  assert.equal(negativeMargin.deltaNet, -500);
  assert.equal(negativeMargin.roi, -500);
  assert.equal(negativeMargin.payback.status, 'never');
});

test('equal or lower investment keeps the comparison but has no positive-investment ROI', () => {
  const baseline = scenario({ investment: 100 });
  const equal = compare(scenario({ investment: 100, consultations: 100 }), baseline);
  assert.equal(equal.deltaNet, 4_800);
  assert.equal(equal.roi, null);
  assert.deepEqual(equal.payback, { status: 'no-additional', months: null, firstFullMonth: null });
  const lower = compare(scenario({ investment: 50, consultations: 0 }), baseline);
  assert.equal(lower.deltaInvestment, -50);
  assert.equal(lower.deltaNet, -4_750);
  assert.equal(lower.roi, null);
  assert.deepEqual(lower.payback, { status: 'lower-investment', months: null, firstFullMonth: null });
});

test('monthly means and expected clients stay fractional and closing is expressed in percent', () => {
  const input = scenario({ visits: 10.5, consultations: 2.5, closeRate: 12.5,
    revenuePerClient: 17.25, marginPerClient: 3.75 });
  assert.deepEqual(validateScenario(input), {});
  const result = calculateScenario(input, 3);
  assert.equal(result.monthlyClients, 0.3125);
  assert.equal(result.monthlyRevenue, 5.390625);
  assert.equal(result.monthlyMargin, 1.171875);
  assert.equal(result.totalClients, 0.9375);
  assert.equal(result.totalMargin, 3.515625);
  assert.equal(calculateScenario(scenario({ closeRate: 100 }), 1).monthlyClients, 50);
  assert.equal(calculateScenario(scenario({ closeRate: 0 }), 1).monthlyClients, 0);
});

test('scenario validation rejects missing, nonnumeric and nonfinite field values without coercion', () => {
  const fields = ['investment', 'visits', 'consultations', 'closeRate', 'revenuePerClient', 'marginPerClient'];
  for (const field of fields) {
    for (const value of ['', '20', null, undefined, true, NaN, Infinity, -Infinity]) {
      const input = scenario({ [field]: value });
      assert.ok(validateScenario(input)[field], `${field} must reject ${String(value)}`);
      assert.throws(() => calculateScenario(input, 6), RangeError);
    }
  }
  assert.equal(Object.keys(validateScenario(null)).length, fields.length);
});

test('validation enforces domains and the two cross-field consistency constraints', () => {
  for (const field of ['investment', 'visits', 'consultations', 'revenuePerClient']) {
    for (const value of [-0.01, 1_000_000_001]) assert.ok(validateScenario(scenario({ [field]: value }))[field]);
  }
  for (const value of [-0.01, 100.01]) assert.ok(validateScenario(scenario({ closeRate: value })).closeRate);
  assert.ok(validateScenario(scenario({ marginPerClient: -1_000_000_001 })).marginPerClient);
  assert.ok(validateScenario(scenario({ marginPerClient: 201 })).marginPerClient);
  assert.ok(validateScenario(scenario({ visits: 0, consultations: 0.1 })).consultations);
  assert.ok(validateScenario(scenario({ visits: 1.2, consultations: 1.3 })).consultations);
  assert.deepEqual(validateScenario(scenario({ visits: 1.2, consultations: 1.2, marginPerClient: -1_000_000_000 })), {});
  assert.deepEqual(validateScenario(scenario({ marginPerClient: 200 })), {});
});

test('the horizon accepts only finite integer numbers from 0 to 120', () => {
  for (const value of [0, 1, 6, 120]) assert.equal(validateHorizon(value), null);
  for (const value of [-1, 121, 1.5, '', '6', null, undefined, NaN, Infinity, true]) {
    assert.ok(validateHorizon(value));
    assert.throws(() => calculateScenario(scenario(), value), RangeError);
    assert.throws(() => compareScenario({}, {}, value), RangeError);
  }
});

test('incremental balances equal the difference of absolute balances across varied inputs', () => {
  for (const horizon of [0, 1, 7, 120]) {
    for (const marginPerClient of [-15.75, 0, 63.5]) {
      for (const investment of [0, 121.25, 1_000_000]) {
        const input = scenario({ investment, consultations: 47.25, closeRate: 33.33, marginPerClient });
        const initialInput = scenario({ investment: 121.25, consultations: 28.5, closeRate: 12.75 });
        const result = calculateScenario(input, horizon);
        const initial = calculateScenario(initialInput, horizon);
        const comparison = compareScenario(result, initial, horizon);
        approximately(comparison.deltaNet, result.net - initial.net, 'incremental net');
        approximately(comparison.deltaRevenue, result.totalRevenue - initial.totalRevenue, 'incremental revenue');
        approximately(comparison.deltaMargin, result.totalMargin - initial.totalMargin, 'incremental margin');
        comparison.timeline.forEach((point, month) => {
          assert.equal(point.month, month);
          approximately(point.net, comparison.deltaMonthlyMargin * month - comparison.deltaInvestment, 'timeline');
        });
      }
    }
  }
});

test('payback tolerates floating-point noise at an integer but preserves genuinely later recovery', () => {
  const baseline = scenario({ visits: 1, consultations: 0, revenuePerClient: 1, marginPerClient: 0.1 });
  const input = scenario({ visits: 1, consultations: 1, closeRate: 100,
    revenuePerClient: 1, marginPerClient: 0.1, investment: 0.30000000000000004 });
  assert.deepEqual(compare(input, baseline, 3).payback, { status: 'within', months: 3, firstFullMonth: 3 });
  const later = compare({ ...input, investment: 0.30000001 }, baseline, 3).payback;
  assert.equal(later.status, 'beyond');
  assert.equal(later.firstFullMonth, 4);
  assert.ok(later.months > 3);
});

test('operational upper bounds remain finite, including negative margin and horizon 120', () => {
  const input = scenario({ investment: 1e9, visits: 1e9, consultations: 1e9,
    closeRate: 100, revenuePerClient: 1e9, marginPerClient: 1e9 });
  const baseline = { ...input, investment: 0, marginPerClient: -1e9 };
  const result = calculateScenario(input, 120);
  assert.equal(result.monthlyRevenue, 1e18);
  assert.equal(result.totalMargin, 1.2e20);
  assertAllNumbersFinite(result);
  assertAllNumbersFinite(compare(input, baseline, 120));
});

test('unrepresentable ratios have explicit nullable results, never Infinity or NaN', () => {
  const baseline = scenario({ visits: 1, consultations: 0, revenuePerClient: 1, marginPerClient: 0 });
  const slow = scenario({ investment: 1e9, visits: 1, consultations: 1, closeRate: 100,
    revenuePerClient: 1, marginPerClient: Number.MIN_VALUE });
  const slowComparison = compare(slow, baseline, 6);
  assert.deepEqual(slowComparison.payback, { status: 'beyond', months: null, firstFullMonth: null });
  const tinyInvestment = { ...slow, investment: Number.MIN_VALUE, marginPerClient: 1 };
  const enormousRoi = compare(tinyInvestment, baseline, 6);
  assert.equal(enormousRoi.roi, null);
  assert.equal(enormousRoi.payback.status, 'within');
  assertAllNumbersFinite(slowComparison);
  assertAllNumbersFinite(enormousRoi);
});

test('a positive investment cannot recover at month zero even when division underflows', () => {
  const input = scenario({ investment: Number.MIN_VALUE, visits: 1, consultations: 1, closeRate: 100 });
  const baseline = scenario({ consultations: 0 });
  const atZero = compare(input, baseline, 0);
  assert.equal(atZero.payback.status, 'beyond');
  assert.ok(atZero.payback.months > 0);
  assert.equal(atZero.payback.firstFullMonth, 1);
  assert.equal(atZero.roi, -100);
  assert.equal(compare(input, baseline, 1).payback.status, 'within');
});

test('calculation functions leave supplied assumptions and results unchanged', () => {
  const input = Object.freeze(scenario({ consultations: 87.5 }));
  const baseline = Object.freeze(calculateScenario(scenario(), 6));
  const result = Object.freeze(calculateScenario(input, 6));
  const before = JSON.stringify({ input, baseline, result });
  compareScenario(result, baseline, 6);
  assert.equal(JSON.stringify({ input, baseline, result }), before);
});

test('invalid comparison data fails explicitly instead of leaking nonfinite results', () => {
  const result = calculateScenario(scenario(), 6);
  assert.throws(() => compareScenario({ ...result, monthlyMargin: Infinity }, result, 6), RangeError);
  assert.throws(() => compareScenario(null, result, 6), RangeError);
  assert.throws(() => compareScenario({ ...result, monthlyMargin: Number.MAX_VALUE }, result, 120), RangeError);
});
