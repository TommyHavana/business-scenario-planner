/** Locale-aware input and display helpers; economic calculations stay in model.js. */

const decimalInput = /^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:[eE][+-]?\d+)?$/;
const number = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2, useGrouping: 'always' });
const currency = new Intl.NumberFormat('es-ES', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 0,
  maximumFractionDigits: 2, useGrouping: 'always',
});
const preciseNumber = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 6, useGrouping: 'always' });
const normalizeZero = value => value === 0 ? 0 : value;
const roundsToZero = value => value !== 0 && Math.abs(value) < 0.005;
const smallMagnitude = value => value < 0 ? 'Entre −0,01 y 0' : '< 0,01';

/** Comma and point mean decimals, never thousands separators. */
export function parseInput(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? normalizeZero(raw) : NaN;
  if (typeof raw !== 'string') return NaN;
  const text = raw.trim();
  if (!decimalInput.test(text)) return NaN;
  const parsed = Number(text.replace(',', '.'));
  return Number.isFinite(parsed) ? normalizeZero(parsed) : NaN;
}

export function numeric(value) {
  return roundsToZero(value) ? smallMagnitude(value) : number.format(normalizeZero(value));
}

export function euros(value) {
  return roundsToZero(value) ? `${smallMagnitude(value)} €` : currency.format(normalizeZero(value));
}

export function signedEuros(value) {
  return `${value > 0 && !roundsToZero(value) ? '+' : ''}${euros(value)}`;
}

export function percent(value) {
  return `${numeric(value)} %`;
}

export function recoveryDisplay(comparison, horizon) {
  const payback = comparison.payback;
  if (payback.status === 'no-additional') return { label: 'No aplica', note: 'Sin inversión adicional frente a la inicial.' };
  if (payback.status === 'lower-investment') return { label: 'No aplica', note: 'Menor inversión que la situación inicial.' };
  if (payback.status === 'never') return { label: 'Sin recuperación', note: 'El margen adicional mensual es cero o negativo.' };
  if (payback.months === null) return { label: 'Fuera del horizonte', note: 'El plazo teórico excede el rango numérico representable.' };

  const rounded = Math.round(payback.months * 100) / 100;
  let label;
  if (payback.months > 0 && payback.months < 0.000001) {
    label = '< 0,000001 meses';
  } else if (payback.status === 'beyond' && rounded <= horizon) {
    label = `Más de ${numeric(horizon)} meses`;
  } else {
    const months = rounded === 0 ? preciseNumber.format(payback.months) : numeric(payback.months);
    label = `${months} meses`;
  }

  // Monthly checkpoints are useful over plausible planning periods, not enormous extrapolations.
  const checkpoint = Number.isSafeInteger(payback.firstFullMonth)
    && payback.firstFullMonth > 0 && payback.firstFullMonth <= 1_200
    ? ` Primer cierre recuperado: mes ${numeric(payback.firstFullMonth)}.` : '';
  return {
    label,
    note: payback.status === 'beyond'
      ? `Fuera de los ${numeric(horizon)} meses.${checkpoint} Exige prolongar los supuestos.`
      : `Dentro del horizonte.${checkpoint}`,
  };
}
