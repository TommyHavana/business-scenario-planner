import { DEFAULT_STATE } from './model.js';

// Keep the existing key so older numeric drafts can be recovered.
export const STORAGE_KEY = 'business-scenario-planner:v1';
const FIELD_KEYS = ['investment', 'visits', 'consultations', 'closeRate', 'revenuePerClient', 'marginPerClient'];
const MAX_DRAFT_LENGTH = 512;
const clone = value => structuredClone(value);

export function createDraftState() {
  return {
    horizon: String(DEFAULT_STATE.horizon),
    scenarios: DEFAULT_STATE.scenarios.map(scenario => ({
      id: scenario.id,
      name: scenario.name,
      ...Object.fromEntries(FIELD_KEYS.map(key => [key, String(scenario[key])])),
    })),
  };
}

function decodeState(input, version) {
  if (!input || !Array.isArray(input.scenarios)
      || input.scenarios.length !== DEFAULT_STATE.scenarios.length) {
    throw new TypeError('Formato de escenarios no compatible.');
  }
  const decodeValue = value => {
    if (version === 1) {
      if (value === null) return '';
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    } else if (typeof value === 'string' && value.length <= MAX_DRAFT_LENGTH) {
      return value;
    }
    throw new TypeError('Formato de supuesto no compatible.');
  };
  const state = createDraftState();
  state.horizon = decodeValue(input.horizon);
  state.scenarios.forEach((scenario, index) => {
    const saved = input.scenarios[index];
    if (saved?.id !== scenario.id) throw new TypeError('Identidad de escenario no compatible.');
    FIELD_KEYS.forEach(key => { scenario[key] = decodeValue(saved[key]); });
  });
  // Names and all other stored metadata are deliberately ignored.
  return state;
}

function decodePayload(raw) {
  if (raw === null) return { state: createDraftState(), undoState: null };
  const payload = JSON.parse(raw);
  if (!payload || (payload.version !== 1 && payload.version !== 2)) {
    throw new TypeError('Versión de guardado no compatible.');
  }
  return {
    state: decodeState(payload.state, payload.version),
    undoState: payload.version === 1 || payload.undoState === null
      ? null : decodeState(payload.undoState, 2),
  };
}

function applyField(state, { scenarioId, key, value }) {
  if (scenarioId === null) state.horizon = value;
  else state.scenarios.find(scenario => scenario.id === scenarioId)[key] = value;
}

/**
 * Local draft storage. Strings preserve empty, comma-decimal and incomplete input.
 * Updates merge fields into the latest available draft; for the same field, the
 * last successful save wins. Restore/undo intentionally replace the full draft.
 * localStorage has no cross-tab transaction: simultaneous read/write operations
 * cannot be made atomic. No remote changes replace unsaved local input on sync.
 */
export function createPlannerStore(getStorage) {
  let state = createDraftState();
  let undoState = null;
  let saved = true;
  let notice = '';
  let replacementPending = false;
  const pendingFields = new Map();
  const isDirty = () => replacementPending || pendingFields.size > 0;
  const result = () => ({ state: clone(state), undoState: clone(undoState), saved, notice });

  function loadLatest() {
    let raw;
    try {
      raw = getStorage().getItem(STORAGE_KEY);
    } catch {
      return {
        canWrite: false,
        notice: 'No se pudo leer el guardado de este navegador. Tu borrador permanece disponible en esta sesión.',
      };
    }
    try {
      return { ...decodePayload(raw), canWrite: true };
    } catch {
      return {
        canWrite: true,
        notice: 'El guardado tiene un formato dañado o incompatible. Se conserva el borrador actual; los próximos cambios lo guardarán de nuevo.',
      };
    }
  }

  function refresh(forMutation = false) {
    if (isDirty() && !forMutation) {
      saved = false;
      notice = 'Hay cambios de esta sesión pendientes de guardar. Se conserva tu borrador; vuelve a editar para reintentar el guardado.';
      return false;
    }
    // A failed reset/undo is a deliberate full replacement, not a field merge.
    if (replacementPending) return true;
    const latest = loadLatest();
    if (!latest.state) {
      saved = false;
      notice = latest.notice;
      return latest.canWrite;
    }
    state = latest.state;
    undoState = latest.undoState;
    // Retry pending fields on top of remote edits without losing either draft.
    pendingFields.forEach(change => applyField(state, change));
    saved = !isDirty();
    notice = '';
    return true;
  }

  function persist(canWrite) {
    if (!canWrite) {
      saved = false;
      notice += ' Los cambios todavía no se han guardado.';
      return result();
    }
    try {
      getStorage().setItem(STORAGE_KEY, JSON.stringify({ version: 2, state, undoState }));
      pendingFields.clear();
      replacementPending = false;
      saved = true;
      notice = '';
    } catch {
      saved = false;
      notice = 'No se pudieron guardar los cambios. Se conservan en esta sesión; vuelve a editar para reintentar el guardado.';
    }
    return result();
  }

  return {
    read() {
      refresh();
      return result();
    },
    sync() {
      refresh();
      return result();
    },
    updateField(change) {
      const { scenarioId, key, value } = change;
      const validTarget = scenarioId === null ? key === 'horizon'
        : DEFAULT_STATE.scenarios.some(scenario => scenario.id === scenarioId) && FIELD_KEYS.includes(key);
      if (!validTarget) throw new TypeError('Campo de supuesto desconocido.');
      if (typeof value !== 'string' || value.length > MAX_DRAFT_LENGTH) {
        throw new TypeError('El borrador debe ser un texto de hasta 512 caracteres.');
      }
      const canWrite = refresh(true);
      const patch = { scenarioId, key, value };
      applyField(state, patch);
      pendingFields.set(`${scenarioId ?? ''}:${key}`, patch);
      return persist(canWrite);
    },
    restoreExample() {
      const canWrite = refresh(true);
      const defaults = createDraftState();
      if (JSON.stringify(state) !== JSON.stringify(defaults)) undoState = clone(state);
      state = defaults;
      pendingFields.clear();
      replacementPending = true;
      return persist(canWrite);
    },
    undoRestore() {
      const canWrite = refresh(true);
      if (undoState === null) return result();
      state = clone(undoState);
      undoState = null;
      pendingFields.clear();
      replacementPending = true;
      return persist(canWrite);
    },
  };
}
