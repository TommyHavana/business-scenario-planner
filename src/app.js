import {
  validateHorizon,
  validateScenario,
  calculateScenario,
  compareScenario,
} from './model.js';
import { parseInput, numeric, euros, signedEuros, percent, recoveryDisplay } from './presentation.js';
import { STORAGE_KEY, createPlannerStore } from './storage.js';

const fields = [
  { key: 'investment', label: 'Inversión comercial', note: '€ · desembolso único en el mes 0', suffix: '€' },
  { key: 'visits', label: 'Visitas', note: 'visitas / mes', suffix: '' },
  { key: 'consultations', label: 'Consultas', note: 'consultas / mes · como máximo las visitas', suffix: '' },
  { key: 'closeRate', label: 'Porcentaje de cierre', note: '% de consultas que se convierten en clientes', suffix: '%' },
  { key: 'revenuePerClient', label: 'Facturación por cliente', note: '€ / cliente · primera venta', suffix: '€' },
  { key: 'marginPerClient', label: 'Margen por cliente', note: '€ / cliente · después de costes variables', suffix: '€' },
];
const chartNumber = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 });
const scientificNumber = new Intl.NumberFormat('es-ES', { notation: 'scientific', maximumFractionDigits: 1 });
const axisNumber = value => Math.abs(value) >= 1e12 || (value !== 0 && Math.abs(value) < .01)
  ? scientificNumber.format(value) : chartNumber.format(value);
const signClass = value => value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral';
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const descriptions = ['Referencia para comparar', 'Supuestos prudentes', 'Supuestos intermedios', 'Supuestos favorables'];
const plannerStore = createPlannerStore(() => localStorage);
let snapshot = plannerStore.read();
let state = snapshot.state;
let activeScenario = 'initial';
let announceTimer;

function announce(message) {
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => { document.querySelector('#update-status').textContent = message; }, 300);
}

function applySnapshot(next) {
  snapshot = next;
  state = snapshot.state;
  syncInputValues();
  showStorageNotice();
}

function showStorageNotice() {
  const notice = document.querySelector('#storage-notice');
  notice.textContent = snapshot.notice;
  notice.hidden = !snapshot.notice;
  document.querySelector('#save-status').textContent = snapshot.saved
    ? 'Guardado automático disponible en este navegador.'
    : 'Los cambios actuales solo están en esta pestaña.';
  document.querySelector('#restore-notice').hidden = !snapshot.undoState;
}

function selectScenario(id) {
  if (!state.scenarios.some(scenario => scenario.id === id)) return;
  activeScenario = id;
  document.querySelector('#scenario-picker').value = id;
  document.querySelectorAll('.assumptions-table [data-scenario]').forEach(element => {
    element.dataset.mobileActive = String(element.dataset.scenario === id);
  });
}

function syncInputValues() {
  for (const scenario of state.scenarios) {
    for (const { key } of fields) {
      const input = document.getElementById(`${scenario.id}-${key}`);
      if (input && input.value !== scenario[key]) input.value = scenario[key];
    }
  }
  const horizon = document.querySelector('#horizon');
  if (horizon.value !== state.horizon) horizon.value = state.horizon;
}

function columnHeaders(firstLabel) {
  return `<tr><th scope="col">${firstLabel}</th>${state.scenarios.map((scenario, index) => `
    <th scope="col" class="scenario-${scenario.id}" data-scenario="${scenario.id}" data-mobile-active="${scenario.id === activeScenario}"><span class="scenario-label"><span class="scenario-dot" aria-hidden="true"></span>${escapeHtml(scenario.name)}</span><small>${descriptions[index]}</small></th>`).join('')}</tr>`;
}

function renderInputs() {
  document.querySelector('#assumptions-head').innerHTML = columnHeaders('Todo supuesto es editable');
  document.querySelector('#assumptions-body').innerHTML = fields.map(field => `<tr>
    <th scope="row"><span id="label-${field.key}">${field.label}</span><small id="help-${field.key}">${field.note}</small></th>
    ${state.scenarios.map(scenario => {
      const id = `${scenario.id}-${field.key}`;
      return `<td data-scenario="${scenario.id}" data-mobile-active="${scenario.id === activeScenario}"><div class="input-wrap"><input type="text" id="${id}" data-scenario="${scenario.id}" data-field="${field.key}" inputmode="decimal" maxlength="512" autocomplete="off" spellcheck="false" value="${escapeHtml(scenario[field.key])}" aria-label="${field.label}, ${escapeHtml(scenario.name)}" aria-describedby="help-${field.key} input-guidance error-${id}" />${field.suffix ? `<span aria-hidden="true">${field.suffix}</span>` : ''}</div><p class="field-error" id="error-${id}" hidden></p></td>`;
    }).join('')}
  </tr>`).join('');
  syncInputValues();
  selectScenario(activeScenario);
}

function validateInputs() {
  const horizon = parseInput(state.horizon);
  const scenarios = state.scenarios.map(scenario => ({ ...scenario, ...Object.fromEntries(fields.map(({ key }) => [key, parseInput(scenario[key])])) }));
  const horizonError = validateHorizon(horizon);
  const horizonInput = document.querySelector('#horizon');
  horizonInput.setAttribute('aria-invalid', String(Boolean(horizonError)));
  const errorElement = document.querySelector('#horizon-error');
  errorElement.textContent = horizonError || '';
  errorElement.hidden = !horizonError;
  const errors = scenarios.map(scenario => {
    const scenarioErrors = validateScenario(scenario);
    fields.forEach(({ key }) => {
      const id = `${scenario.id}-${key}`;
      const message = scenarioErrors[key];
      document.getElementById(id).setAttribute('aria-invalid', String(Boolean(message)));
      const element = document.getElementById(`error-${id}`);
      element.textContent = message || '';
      element.hidden = !message;
    });
    return scenarioErrors;
  });
  const summaryItems = horizonError ? [{ id: 'horizon', label: 'Horizonte común', message: horizonError }] : [];
  errors.forEach((error, index) => fields.forEach(field => {
    if (error[field.key]) summaryItems.push({ id: `${state.scenarios[index].id}-${field.key}`, label: `${state.scenarios[index].name}: ${field.label}`, message: error[field.key] });
  }));
  document.querySelector('#error-summary').hidden = summaryItems.length === 0;
  document.querySelector('#error-summary-title').textContent = `${summaryItems.length} ${summaryItems.length === 1 ? 'supuesto necesita' : 'supuestos necesitan'} revisión`;
  document.querySelector('#error-list').innerHTML = summaryItems.map(item => `<li><a href="#${item.id}" data-error-target="${item.id}">${escapeHtml(item.label)}</a>: ${escapeHtml(item.message)}</li>`).join('');
  return { horizonError, errors, horizon, scenarios, errorCount: summaryItems.length };
}

function renderOutcome(scenario, comparison, horizon, baselineInvalid) {
  if (!comparison) return `<article class="outcome scenario-${scenario.id}"><h3>${escapeHtml(scenario.name)}</h3><span class="metric">—</span><p class="metric-label">Comparación no disponible</p><p class="recovery-note">Revisa los campos señalados${baselineInvalid ? ' de la situación inicial' : ''}.</p></article>`;
  const recovery = recoveryDisplay(comparison, horizon);
  const roi = comparison.roi === null ? (comparison.deltaInvestment > 0 ? 'Fuera de rango' : 'No aplica') : percent(comparison.roi);
  return `<article class="outcome scenario-${scenario.id}">
    <h3 class="scenario-label"><span class="scenario-dot" aria-hidden="true"></span>${escapeHtml(scenario.name)}</h3>
    <strong class="metric ${signClass(comparison.deltaNet)}">${signedEuros(comparison.deltaNet)}</strong>
    <p class="metric-label">Resultado adicional frente a la inicial</p>
    <div class="outcome-meta"><span>ROI incremental <strong>${roi}</strong></span><span>Recuperación <strong>${recovery.label}</strong></span></div>
    <span class="recovery-note">${recovery.note}${comparison.deltaInvestment > 0 && comparison.roi === null ? ' ROI fuera del rango numérico.' : ''}</span>
  </article>`;
}

function renderChart(comparisons, horizon) {
  const valid = comparisons.slice(1).map((comparison, i) => ({ comparison, scenario: state.scenarios[i + 1] })).filter(({ comparison }) => comparison);
  if (!valid.length) return '';
  const small = window.matchMedia('(max-width: 700px)').matches;
  const width = small ? 500 : 1100;
  const height = small ? 270 : 280;
  const left = small ? 68 : 80;
  const right = 20;
  const top = 24;
  const bottom = height - 40;
  const values = valid.flatMap(({ comparison }) => comparison.timeline.map(point => point.net));
  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(0, ...values);
  const span = rawMax - rawMin || 100;
  const yMin = rawMin - span * .12;
  const yMax = rawMax + span * .13;
  const x = month => horizon === 0 ? left : left + month / horizon * (width - left - right);
  const y = value => bottom - (value - yMin) / (yMax - yMin) * (bottom - top);
  const yTicks = [rawMin, (rawMin + rawMax) / 2, rawMax].filter((v, i, array) => array.indexOf(v) === i && v !== 0);
  const monthTicks = horizon <= 6
    ? Array.from({ length: horizon + 1 }, (_, i) => i)
    : [...new Set([0, Math.round(horizon / 4), Math.round(horizon / 2), Math.round(horizon * 3 / 4), horizon])];
  const lines = valid.map(({ comparison, scenario }) => {
    const points = comparison.timeline.map(point => `${x(point.month)},${y(point.net)}`).join(' ');
    const last = comparison.timeline.at(-1);
    return `<g class="scenario-${scenario.id}"><polyline points="${points}" fill="none" stroke="var(--scenario-color)" stroke-width="2.8" ${scenario.id === 'conservative' ? 'stroke-dasharray="7 4"' : scenario.id === 'favorable' ? 'stroke-dasharray="2 3"' : ''} /><circle cx="${x(last.month)}" cy="${y(last.net)}" r="4.2" fill="var(--scenario-color)"><title>${escapeHtml(scenario.name)}: ${signedEuros(last.net)} en el mes ${last.month}</title></circle></g>`;
  }).join('');
  return `<section class="chart-panel" aria-labelledby="chart-title">
    <div class="chart-top"><div><h3 id="chart-title">¿Cuándo se compensaría la inversión adicional?</h3><p>Resultado adicional acumulado frente a la inicial. Con inversión adicional y margen adicional positivos, alcanzar cero indica recuperación.</p></div><div class="chart-legend">${valid.map(({ scenario }) => `<span class="scenario-${scenario.id}"><i aria-hidden="true"></i>${escapeHtml(scenario.name)}</span>`).join('')}</div></div>
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="chart-svg-title chart-description">
      <title id="chart-svg-title">Evolución condicionada del resultado adicional durante ${horizon} meses</title>
      <desc id="chart-description">${valid.map(({ comparison, scenario }) => `${scenario.name}: empieza en ${euros(comparison.timeline[0].net)} y termina en ${euros(comparison.deltaNet)}. ${recoveryDisplay(comparison, horizon).note}`).join(' ')} Los valores detallados están en la tabla siguiente.</desc>
      ${yTicks.map(value => `<line x1="${left}" y1="${y(value)}" x2="${width - right}" y2="${y(value)}" stroke="#e6edf4"/><text x="${left - 13}" y="${y(value) + 4}" text-anchor="end">${axisNumber(value)} €</text>`).join('')}
      <line x1="${left}" y1="${y(0)}" x2="${width - right}" y2="${y(0)}" stroke="#8a9bad" stroke-dasharray="4 4"/><text class="zero-label" x="${left - 13}" y="${y(0) + 4}" text-anchor="end">0 €</text>
      ${monthTicks.map(month => `<text x="${x(month)}" y="${height - 13}" text-anchor="middle">${month === 0 ? 'Mes 0' : month}</text>`).join('')}
      ${lines}
    </svg>
    <p class="chart-foot">Mes 0: desembolso adicional inicial. La línea de cero representa la situación inicial.${horizon === 0 ? ' Con horizonte cero solo se representa ese desembolso.' : ''}${valid.length < 3 ? ' Los escenarios con errores se omiten del gráfico.' : ''}</p>
  </section>`;
}

function renderResultsTable(results, comparisons, horizon) {
  const row = (label, note, values, emphasis = false) => `<tr${emphasis ? ' class="emphasis-row"' : ''}><th scope="row">${label}${note ? `<small>${note}</small>` : ''}</th>${values.map(value => `<td>${value ?? '<span class="small-result">Revisa supuestos</span>'}</td>`).join('')}</tr>`;
  const absolute = (key, formatter = euros) => results.map(result => result ? formatter(result[key]) : null);
  const relative = (key, formatter = signedEuros) => comparisons.map((comparison, index) => index === 0 ? '<span class="small-result">Referencia</span>' : comparison ? formatter(comparison[key]) : null);
  const group = label => `<tr class="group-row"><th colspan="5">${label}</th></tr>`;
  return `<section class="results-detail" aria-labelledby="detail-heading"><h3 id="detail-heading">La comparación, cifra a cifra</h3><div class="scroll-hint">Desliza para consultar todos los resultados.</div><div class="table-scroll" role="region" aria-label="Tabla de resultados de todos los escenarios" tabindex="0"><table class="results-table"><caption class="sr-only">Resultados mensuales, del horizonte y adicionales frente a la situación inicial</caption><thead>${columnHeaders('Magnitud y periodo')}</thead><tbody>
    ${group('Actividad mensual constante')}
    ${row('Visitas → consultas', '% de visitas que originan una consulta', absolute('consultationRate', value => value === null ? '<span class="small-result">No aplica: 0 visitas</span>' : percent(value)))}
    ${row('Clientes esperados', 'clientes / mes · pueden ser fraccionarios', absolute('monthlyClients', numeric))}
    ${row('Facturación', '€ / mes · antes de costes', absolute('monthlyRevenue'))}
    ${row('Margen de contribución', '€ / mes · antes de inversión comercial', absolute('monthlyMargin'))}
    ${group(`Acumulado en ${numeric(horizon)} meses`)}
    ${row('Clientes esperados', 'clientes en todo el horizonte', absolute('totalClients', numeric))}
    ${row('Facturación acumulada', '€ en todo el horizonte', absolute('totalRevenue'))}
    ${row('Margen acumulado', '€ · después de costes variables', absolute('totalMargin'))}
    ${row('Resultado tras inversión', 'Margen acumulado − inversión · no es beneficio neto', absolute('net'), true)}
    ${group('Diferencia frente a la situación inicial')}
    ${row('Inversión adicional', '€ · diferencia de desembolso en el mes 0', relative('deltaInvestment'))}
    ${row('Facturación adicional', '€ en todo el horizonte', relative('deltaRevenue'))}
    ${row('Margen adicional', '€ / mes', relative('deltaMonthlyMargin'))}
    ${row('Margen adicional acumulado', '€ en todo el horizonte', relative('deltaMargin'))}
    ${row('Resultado adicional', 'Margen adicional acumulado − inversión adicional', relative('deltaNet', value => `<span class="${signClass(value)}">${signedEuros(value)}</span>`), true)}
    ${row('ROI incremental', '% en todo el horizonte · sin anualizar', comparisons.map((comparison, i) => i === 0 ? '<span class="small-result">Referencia</span>' : !comparison ? null : comparison.roi === null ? `<span class="small-result">${comparison.deltaInvestment > 0 ? 'Fuera de rango numérico' : 'No aplica'}</span>` : percent(comparison.roi)))}
    ${row('Recuperación adicional', 'meses · margen incremental uniforme', comparisons.map((comparison, i) => i === 0 ? '<span class="small-result">Referencia</span>' : !comparison ? null : `${recoveryDisplay(comparison, horizon).label}<br/><span class="small-result">${recoveryDisplay(comparison, horizon).note}</span>`))}
  </tbody></table></div><p class="results-foot">Los resultados se redondean solo al presentarlos. «No aplica» no significa cero. La facturación y el margen no son equivalentes al efectivo cobrado.</p></section>`;
}

function renderResults(announceChanges = false) {
  const { horizonError, errors, horizon, scenarios, errorCount } = validateInputs();
  const container = document.querySelector('#results');
  const focusedResultTable = document.activeElement?.classList.contains('table-scroll') && container.contains(document.activeElement);
  const tableScroll = container.querySelector('.table-scroll')?.scrollLeft ?? 0;
  if (horizonError) {
    container.innerHTML = '<div class="invalid-panel"><strong>Revisa el horizonte para calcular los resultados.</strong><p>Introduce un número entero de meses entre 0 y 120. Un horizonte de cero conserva el desembolso inicial.</p></div>';
  } else {
    const results = scenarios.map((scenario, i) => Object.keys(errors[i]).length ? null : calculateScenario(scenario, horizon));
    const comparisons = results.map(result => result && results[0] ? compareScenario(result, results[0], horizon) : null);
    container.innerHTML = `<div class="section-heading result-heading"><div><h2>Si se cumplen estos supuestos…</h2><p>Así cambiaría el resultado respecto a mantener la situación inicial.</p></div><div class="section-actions"><span class="period-tag">${numeric(horizon)} meses</span><a class="text-link" href="#assumptions">Editar supuestos</a></div></div>
      ${!results[0] ? '<div class="invalid-panel"><strong>La situación inicial necesita una corrección.</strong><p>Las comparaciones quedan suspendidas hasta corregir sus supuestos. Los resultados absolutos válidos siguen disponibles en la tabla.</p></div>' : ''}
      <div class="outcome-grid">${state.scenarios.slice(1).map((scenario, i) => renderOutcome(scenario, comparisons[i + 1], horizon, !results[0])).join('')}</div>
      ${renderChart(comparisons, horizon)}
      ${renderResultsTable(results, comparisons, horizon)}`;
  }
  const nextTable = container.querySelector('.table-scroll');
  if (nextTable) {
    nextTable.scrollLeft = tableScroll;
    if (focusedResultTable) nextTable.focus({ preventScroll: true });
  }
  if (announceChanges) announce(errorCount
    ? `${errorCount} supuestos necesitan revisión. Usa los enlaces del resumen de errores para corregirlos.`
    : `Escenarios actualizados para un horizonte de ${numeric(horizon)} meses.`);
}

document.querySelector('#assumptions-body').addEventListener('input', event => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.dataset.field) return;
  applySnapshot(plannerStore.updateField({ scenarioId: input.dataset.scenario, key: input.dataset.field, value: input.value }));
  renderResults(true);
});
document.querySelector('#assumptions-body').addEventListener('focusin', event => {
  if (event.target instanceof HTMLInputElement && event.target.dataset.scenario) {
    selectScenario(event.target.dataset.scenario);
  }
});
document.querySelector('#horizon').addEventListener('input', event => {
  applySnapshot(plannerStore.updateField({ scenarioId: null, key: 'horizon', value: event.target.value }));
  renderResults(true);
});
document.querySelector('#reset-button').addEventListener('click', () => {
  applySnapshot(plannerStore.restoreExample());
  renderResults();
  announce(snapshot.undoState ? 'Ejemplo restaurado. Puedes deshacer la restauración y recuperar tus supuestos.' : 'El ejemplo ya está cargado.');
});
document.querySelector('#undo-button').addEventListener('click', () => {
  applySnapshot(plannerStore.undoRestore());
  renderResults();
  document.querySelector('#reset-button').focus();
  announce('Restauración deshecha. Se han recuperado los supuestos anteriores.');
});
document.querySelector('#scenario-picker').addEventListener('change', event => {
  selectScenario(event.target.value);
});
document.querySelector('#error-list').addEventListener('click', event => {
  const link = event.target.closest('a[data-error-target]');
  if (!link) return;
  const target = document.getElementById(link.dataset.errorTarget);
  if (!target) return;
  event.preventDefault();
  if (target.dataset.scenario) selectScenario(target.dataset.scenario);
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: 'center', inline: 'nearest' });
});
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  applySnapshot(plannerStore.sync());
  renderResults();
  announce(snapshot.saved ? 'Supuestos actualizados desde otra pestaña.' : snapshot.notice);
});
window.matchMedia('(max-width: 700px)').addEventListener('change', () => {
  // Resize only the graphic; preserve the result table's scroll position and focus.
  const horizon = parseInput(state.horizon);
  const chart = document.querySelector('.chart-panel');
  if (!chart || validateHorizon(horizon)) return;
  const results = state.scenarios.map(draft => {
    const scenario = { ...draft, ...Object.fromEntries(fields.map(({ key }) => [key, parseInput(draft[key])])) };
    return Object.keys(validateScenario(scenario)).length ? null : calculateScenario(scenario, horizon);
  });
  const comparisons = results.map(result => result && results[0] ? compareScenario(result, results[0], horizon) : null);
  chart.outerHTML = renderChart(comparisons, horizon);
});

renderInputs();
renderResults();
showStorageNotice();
