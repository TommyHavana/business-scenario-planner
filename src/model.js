/** Pure scenario calculations. Units and assumptions: ../docs/MODELO.md. */

const MAX_AMOUNT = 1_000_000_000;
const MAX_HORIZON = 120;

export const DEFAULT_STATE = {
  horizon: 6,
  scenarios: [
    {
      id: 'initial',
      name: 'Situación inicial',
      investment: 0,
      visits: 1_000,
      consultations: 50,
      closeRate: 20,
      revenuePerClient: 200,
      marginPerClient: 80,
    },
    {
      id: 'conservative',
      name: 'Conservador',
      investment: 3_000,
      visits: 1_500,
      consultations: 75,
      closeRate: 20,
      revenuePerClient: 200,
      marginPerClient: 80,
    },
    {
      id: 'middle',
      name: 'Intermedio',
      investment: 3_000,
      visits: 2_000,
      consultations: 100,
      closeRate: 20,
      revenuePerClient: 200,
      marginPerClient: 80,
    },
    {
      id: 'favorable',
      name: 'Favorable',
      investment: 3_000,
      visits: 2_500,
      consultations: 150,
      closeRate: 25,
      revenuePerClient: 200,
      marginPerClient: 80,
    },
  ],
};

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const withoutNegativeZero = (value) => (Object.is(value, -0) ? 0 : value);

export function validateHorizon(value) {
  if (!isFiniteNumber(value)) return 'Introduce un número de meses válido.';
  if (!Number.isInteger(value) || value < 0 || value > MAX_HORIZON) {
    return 'El horizonte debe ser un número entero entre 0 y 120 meses.';
  }
  return null;
}

export function validateScenario(input) {
  const errors = {};
  const domains = {
    investment: [0, MAX_AMOUNT],
    visits: [0, MAX_AMOUNT],
    consultations: [0, MAX_AMOUNT],
    closeRate: [0, 100],
    revenuePerClient: [0, MAX_AMOUNT],
    marginPerClient: [-MAX_AMOUNT, MAX_AMOUNT],
  };

  for (const [field, [minimum, maximum]] of Object.entries(domains)) {
    const value = input?.[field];
    if (!isFiniteNumber(value)) {
      errors[field] = 'Introduce un número válido; un campo vacío no equivale a cero.';
    } else if (value < minimum || value > maximum) {
      if (field === 'closeRate') {
        errors[field] = 'El cierre debe estar entre 0 y 100 %.';
      } else if (field === 'marginPerClient') {
        errors[field] = 'El margen debe estar entre −1.000.000.000 y 1.000.000.000 € por cliente.';
      } else {
        errors[field] = 'Introduce un valor entre 0 y 1.000.000.000.';
      }
    }
  }

  if (!errors.consultations && !errors.visits && input.consultations > input.visits) {
    errors.consultations = 'Las consultas mensuales no pueden superar las visitas mensuales.';
  }
  if (!errors.marginPerClient && !errors.revenuePerClient
      && input.marginPerClient > input.revenuePerClient) {
    errors.marginPerClient = 'El margen por cliente no puede superar la facturación por cliente.';
  }
  return errors;
}

function requireHorizon(horizon) {
  const error = validateHorizon(horizon);
  if (error) throw new RangeError(error);
}

function requireFinite(value, name) {
  if (!isFiniteNumber(value)) throw new RangeError(`${name} debe ser un número finito.`);
  return withoutNegativeZero(value);
}

export function calculateScenario(input, horizon) {
  requireHorizon(horizon);
  const errors = validateScenario(input);
  if (Object.keys(errors).length > 0) {
    throw new RangeError(Object.values(errors).join(' '));
  }

  const monthlyClients = input.consultations * (input.closeRate / 100);
  const monthlyRevenue = monthlyClients * input.revenuePerClient;
  const monthlyMargin = monthlyClients * input.marginPerClient;
  const totalMargin = monthlyMargin * horizon;

  const result = {
    investment: input.investment,
    consultationRate: input.visits === 0 ? null : (input.consultations / input.visits) * 100,
    monthlyClients,
    monthlyRevenue,
    monthlyMargin,
    totalClients: monthlyClients * horizon,
    totalRevenue: monthlyRevenue * horizon,
    totalMargin,
    net: totalMargin - input.investment,
  };

  return Object.fromEntries(Object.entries(result).map(([key, value]) => [
    key, value === null ? null : requireFinite(value, key),
  ]));
}

function calculatePayback(deltaInvestment, deltaMonthlyMargin, horizon) {
  const unavailable = (status) => ({ status, months: null, firstFullMonth: null });
  if (deltaInvestment < 0) return unavailable('lower-investment');
  if (deltaInvestment === 0) return unavailable('no-additional');
  if (deltaMonthlyMargin <= 0) return unavailable('never');

  const quotient = deltaInvestment / deltaMonthlyMargin;
  if (!Number.isFinite(quotient)) return unavailable('beyond');

  // A positive investment cannot recover at t=0, even if division underflows.
  let months = Math.max(Number.MIN_VALUE, quotient);
  const nearestMonth = Math.round(months);
  const tolerance = 8 * Number.EPSILON * Math.max(1, Math.abs(months));
  if (nearestMonth > 0 && Math.abs(months - nearestMonth) <= tolerance) {
    months = nearestMonth;
  }
  return {
    status: months <= horizon ? 'within' : 'beyond',
    months,
    firstFullMonth: Math.max(1, Math.ceil(months)),
  };
}

export function compareScenario(result, baseline, horizon) {
  requireHorizon(horizon);
  for (const [label, scenario] of [['Escenario', result], ['Inicial', baseline]]) {
    for (const field of ['investment', 'monthlyRevenue', 'monthlyMargin']) {
      requireFinite(scenario?.[field], `${label}: ${field}`);
    }
  }

  const deltaInvestment = requireFinite(result.investment - baseline.investment, 'Inversión adicional');
  const deltaMonthlyMargin = requireFinite(result.monthlyMargin - baseline.monthlyMargin, 'Margen mensual adicional');
  const deltaRevenue = requireFinite((result.monthlyRevenue - baseline.monthlyRevenue) * horizon, 'Facturación adicional');
  const deltaMargin = requireFinite(deltaMonthlyMargin * horizon, 'Margen adicional');
  const deltaNet = requireFinite(deltaMargin - deltaInvestment, 'Resultado adicional');
  const roiValue = deltaInvestment > 0 ? (deltaNet / deltaInvestment) * 100 : null;

  return {
    deltaInvestment,
    deltaMonthlyMargin,
    deltaRevenue,
    deltaMargin,
    deltaNet,
    roi: roiValue !== null && Number.isFinite(roiValue) ? withoutNegativeZero(roiValue) : null,
    payback: calculatePayback(deltaInvestment, deltaMonthlyMargin, horizon),
    timeline: Array.from({ length: horizon + 1 }, (_, month) => ({
      month,
      net: requireFinite(deltaMonthlyMargin * month - deltaInvestment, 'Resultado adicional mensual'),
    })),
  };
}
