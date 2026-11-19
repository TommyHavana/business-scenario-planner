import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInput, numeric, euros, signedEuros, percent, recoveryDisplay } from '../src/presentation.js';
import { DEFAULT_STATE, calculateScenario, compareScenario } from '../src/model.js';

const normalizeSpaces = text => text.replace(/\s/g, ' ');
const recovery = (months, status = 'within', firstFullMonth = Math.ceil(months)) => ({
  payback: { months, status, firstFullMonth },
});

test('decimal inputs accept comma or point, signs and finite scientific notation', () => {
  for (const [input, expected] of [
    ['20,5', 20.5], ['20.5', 20.5], ['  +20,5  ', 20.5], ['−20,5', NaN],
    ['-20,5', -20.5], [',5', 0.5], ['.5', 0.5], ['1,25e2', 125],
    ['1.25E-2', 0.0125], ['0', 0], ['-0', 0], [20.5, 20.5], [-0, 0],
  ]) {
    assert.equal(parseInput(input), expected, `parse ${String(input)}`);
  }
  // A separator denotes decimals; grouping is deliberately unsupported.
  assert.equal(parseInput('1.000'), 1);
  assert.equal(parseInput('1,000'), 1);
});

test('empty, incomplete, grouped, mixed and nonfinite inputs remain invalid', () => {
  for (const input of [
    '', '   ', '-', '+', '.', ',', '20,', '20.', '1e', '1e-', '1e+',
    '1,000.50', '1.000,50', '1,000,000', '1.000.000', '1 000', '20 %', '20%',
    '0x10', '0b10', 'Infinity', '-Infinity', 'NaN', '1e309', 'word',
    null, undefined, true, false, {}, [], NaN, Infinity, -Infinity,
  ]) {
    assert.ok(Number.isNaN(parseInput(input)), `reject ${String(input)}`);
  }
});

test('ordinary values use Spanish decimals and consistent grouping, retaining zero', () => {
  assert.equal(numeric(1000), '1.000');
  assert.equal(numeric(1234.567), '1.234,57');
  assert.equal(normalizeSpaces(euros(1234.567)), '1.234,57 €');
  assert.equal(normalizeSpaces(signedEuros(12.5)), '+12,5 €');
  assert.equal(normalizeSpaces(signedEuros(-12.5)), '-12,5 €');
  assert.equal(percent(20.5), '20,5 %');
  assert.equal(numeric(-0), '0');
  assert.equal(normalizeSpaces(euros(-0)), '0 €');
  assert.equal(normalizeSpaces(signedEuros(-0)), '0 €');
  assert.equal(percent(-0), '0 %');
});

test('tiny nonzero values keep magnitude and sign instead of displaying false zero', () => {
  for (const value of [Number.MIN_VALUE, 0.000001, 0.004999]) {
    assert.equal(numeric(value), '< 0,01');
    assert.equal(numeric(-value), 'Entre −0,01 y 0');
    assert.equal(euros(value), '< 0,01 €');
    assert.equal(euros(-value), 'Entre −0,01 y 0 €');
    assert.equal(signedEuros(value), '< 0,01 €');
    assert.equal(signedEuros(-value), 'Entre −0,01 y 0 €');
    assert.equal(percent(value), '< 0,01 %');
    assert.equal(percent(-value), 'Entre −0,01 y 0 %');
  }
  assert.equal(numeric(0.005), '0,01');
  assert.equal(numeric(-0.005), '-0,01');
  assert.equal(normalizeSpaces(euros(0.005)), '0,01 €');
});

test('recovery labels preserve the model boundary instead of rounding beyond to within', () => {
  const justBeyond = recoveryDisplay(recovery(6.000000001, 'beyond'), 6);
  assert.equal(justBeyond.label, 'Más de 6 meses');
  assert.match(justBeyond.note, /Fuera de los 6 meses/);
  assert.match(justBeyond.note, /mes 7\./);
  assert.match(justBeyond.note, /prolongar los supuestos/);
  const atBoundary = recoveryDisplay(recovery(6), 6);
  assert.equal(atBoundary.label, '6 meses');
  assert.match(atBoundary.note, /Dentro del horizonte/);
  assert.match(atBoundary.note, /mes 6\./);
  assert.equal(recoveryDisplay(recovery(1e-8), 6).label, '< 0,000001 meses');
  assert.equal(recoveryDisplay(recovery(1e-8, 'beyond'), 0).label, '< 0,000001 meses');
  assert.equal(recoveryDisplay(recovery(0.000001), 6).label, '0,000001 meses');
});

test('documented scenarios retain their recovery explanations and monthly checkpoints', () => {
  const results = DEFAULT_STATE.scenarios.map(input => calculateScenario(input, 6));
  const outputs = results.map(result => recoveryDisplay(compareScenario(result, results[0], 6), 6));
  assert.deepEqual(outputs[0], { label: 'No aplica', note: 'Sin inversión adicional frente a la inicial.' });
  assert.equal(outputs[1].label, '7,5 meses');
  assert.match(outputs[1].note, /Fuera de los 6 meses/);
  assert.match(outputs[1].note, /mes 8\./);
  assert.equal(outputs[2].label, '3,75 meses');
  assert.match(outputs[2].note, /Dentro del horizonte/);
  assert.match(outputs[2].note, /mes 4\./);
  assert.equal(outputs[3].label, '1,36 meses');
});

test('undefined or impractically distant recovery has an explicit explanation', () => {
  assert.match(recoveryDisplay(recovery(null, 'never', null), 6).note, /cero o negativo/);
  assert.equal(recoveryDisplay(recovery(null, 'lower-investment', null), 6).label, 'No aplica');
  assert.match(recoveryDisplay(recovery(null, 'beyond', null), 6).note, /rango numérico/);
  const distant = recoveryDisplay(recovery(1e20, 'beyond'), 6);
  assert.match(distant.note, /prolongar los supuestos/);
  assert.doesNotMatch(distant.note, /Primer cierre/);
});
