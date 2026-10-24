import { icon } from './ui.js';
const $ = (id) => document.getElementById(id);
const { validate, samePage, webUrl, variables, resolveVariables } = ReplayCore;
let library = {},
  selected = '',
  flow = fresh(),
  mode = 'idle',
  tabId = null,
  generation = 0,
  pollTimer,
  polling = false,
  session = '',
  approvePending,
  history = [],
  historyQueue = Promise.resolve();
function fresh() {
  return { schemaVersion: 1, name: 'Untitled workflow', url: '', steps: [] };
}
function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function status(text, kind = '') {
  $('status').textContent = text;
  $('status').dataset.kind = kind;
}
function syncFields() {
  flow.name = $('name').value;
  flow.url = $('url').value;
}
function savedState() {
  syncFields();
  $('saved-state').textContent =
    selected && JSON.stringify(library[selected]) === JSON.stringify(flow)
      ? 'Saved'
      : 'Unsaved changes';
  if (!flow.steps.length && !flow.url && !selected)
    $('saved-state').textContent = 'Not saved';
  try {
    $('page-host').textContent = new URL(flow.url).host;
  } catch {
    $('page-host').textContent = 'Not set';
  }
}
function busy(next) {
  mode = next;
  for (const id of [
    'new',
    'record',
    'run',
    'save',
    'export',
    'delete',
    'import',
    'duplicate',
    'name',
    'url',
    'search',
    'wait',
    'clear-history',
  ])
    $(id).disabled = next !== 'idle';
  $('stop').disabled = next === 'idle' || next === 'preparing';
  for (const el of document.querySelectorAll(
    '#steps button,#steps input,#library button,#variable-fields input',
  ))
    el.disabled = next !== 'idle';
}
function showView(view) {
  for (const name of ['workflows', 'history', 'settings']) {
    $('view-' + name).hidden = name !== view;
    $('tab-' + name).classList.toggle('active', name === view);
    if (name === view) $('tab-' + name).setAttribute('aria-current', 'page');
    else $('tab-' + name).removeAttribute('aria-current');
  }
}
for (const view of ['workflows', 'history', 'settings'])
  $('tab-' + view).onclick = () => showView(view);
function hasChanges() {
  syncFields();
  return selected
    ? JSON.stringify(library[selected]) !== JSON.stringify(flow)
    : flow.steps.length > 0 || !!flow.url;
}
function confirmSwitch() {
  return !hasChanges() || confirm('Discard unsaved changes in this editor?');
}
function openFlow(id) {
  if (!confirmSwitch()) return;
  selected = id;
  flow = id ? structuredClone(library[id]) : fresh();
  $('variable-fields').replaceChildren();
  renderLibrary();
  render();
  showView('workflows');
  status('Workflow opened.');
}
function renderLibrary() {
  const query = $('search').value.trim().toLowerCase();
  const items = Object.entries(library).filter(([, item]) =>
    (item.name + ' ' + item.url).toLowerCase().includes(query),
  );
  $('library').replaceChildren();
  if (!items.length)
    $('library').append(
      node(
        'p',
        query ? 'No matching workflows.' : 'No saved workflows yet.',
        'library-empty',
      ),
    );
  for (const [id, item] of items) {
    const button = node(
      'button',
      undefined,
      'workflow-item' + (id === selected ? ' selected' : ''),
    );
    button.disabled = mode !== 'idle';
    button.setAttribute('aria-label', 'Open ' + item.name);
    button.setAttribute('aria-pressed', String(id === selected));
    const symbol = node('span', undefined, 'workflow-symbol');
    symbol.append(icon('workflow'));
    const info = node('span', undefined, 'workflow-info');
    info.append(
      node('span', item.name, 'workflow-name'),
      node(
        'span',
        new URL(item.url).host + ' · ' + item.steps.length + ' steps',
        'workflow-meta',
      ),
    );
    const arrow = node('span', undefined, 'workflow-arrow');
    arrow.append(icon('right'));
    button.append(symbol, info, arrow);
    button.onclick = () => openFlow(id);
    $('library').append(button);
  }
}
$('search').oninput = renderLibrary;
function inputField(text, value, oninput, attrs = {}) {
  const label = node('label', text, 'field'),
    input = node('input');
  input.value = value;
  for (const [key, val] of Object.entries(attrs)) input.setAttribute(key, val);
  input.disabled = mode !== 'idle';
  input.oninput = () => {
    oninput(input.value);
    savedState();
  };
  label.append(input);
  return label;
}
function renderVariables() {
  const prior = Object.fromEntries(
    [...$('variable-fields').querySelectorAll('input')].map((el) => [
      el.dataset.variable,
      el.value,
    ]),
  );
  $('variable-fields').replaceChildren();
  let names;
  try {
    names = variables(flow);
  } catch (error) {
    status(error.message, 'error');
    return;
  }
  $('variables').hidden = !names.length;
  for (const name of names) {
    const label = inputField(name, prior[name] || '', () => {}, {
      'aria-label': 'Run input ' + name,
      autocomplete: 'off',
      maxlength: '10000',
    });
    label.querySelector('input').dataset.variable = name;
    $('variable-fields').append(label);
  }
}
function render() {
  $('name').value = flow.name;
  $('url').value = flow.url;
  $('count').textContent = flow.steps.length + ' steps';
  $('empty').hidden = !!flow.steps.length;
  $('steps').replaceChildren();
  flow.steps.forEach((step, index) => {
    const li = node('li', undefined, 'step'),
      heading = node('div', undefined, 'step-heading');
    const number = node(
        'span',
        String(index + 1).padStart(2, '0'),
        'step-number',
      ),
      symbol = node('span', undefined, 'step-icon');
    symbol.append(icon(step.type));
    const title = node('span', step.label || 'Wait', 'step-label');
    title.append(
      node(
        'small',
        {
          input: 'Fill field',
          select: 'Choose option',
          click: 'Click element',
          wait: 'Wait ' + step.ms + ' ms',
        }[step.type],
      ),
    );
    const actions = node('div', undefined, 'step-buttons');
    function action(type, label, fn, disabled = false) {
      const button = node('button');
      button.append(icon(type));
      button.title = label;
      button.setAttribute('aria-label', label + ' ' + (index + 1));
      button.disabled = mode !== 'idle' || disabled;
      button.onclick = () => {
        syncFields();
        fn();
        render();
      };
      actions.append(button);
    }
    action(
      'up',
      'Move step up',
      () => {
        [flow.steps[index - 1], flow.steps[index]] = [
          flow.steps[index],
          flow.steps[index - 1],
        ];
      },
      index === 0,
    );
    action(
      'down',
      'Move step down',
      () => {
        [flow.steps[index + 1], flow.steps[index]] = [
          flow.steps[index],
          flow.steps[index + 1],
        ];
      },
      index === flow.steps.length - 1,
    );
    action('close', 'Remove step', () => flow.steps.splice(index, 1));
    heading.append(number, symbol, title, actions);
    li.append(heading);
    if (step.type === 'wait') {
      const label = inputField(
        'Wait (milliseconds)',
        step.ms,
        (value) => {
          step.ms = Number(value);
        },
        {
          type: 'number',
          min: 0,
          max: 30000,
          'aria-label': 'Wait for step ' + (index + 1),
        },
      );
      label.classList.add('step-value');
      li.append(label);
    } else {
      if (step.type !== 'click') {
        const label = inputField(
          'Value',
          step.value,
          (value) => {
            step.value = value;
            renderVariables();
          },
          { 'aria-label': 'Value for step ' + (index + 1) },
        );
        label.classList.add('step-value');
        li.append(label);
      }
      const details = node('details', undefined, 'step-details');
      details.append(node('summary', 'Target settings'));
      details.append(
        inputField(
          'CSS selector',
          step.selector,
          (value) => {
            step.selector = value;
          },
          { 'aria-label': 'CSS selector for step ' + (index + 1) },
        ),
      );
      const tools = node('div', undefined, 'target-tools'),
        pick = node('button', 'Choose on page');
      pick.prepend(icon('target'));
      pick.disabled = mode !== 'idle';
      pick.setAttribute('aria-label', 'Choose target for step ' + (index + 1));
      pick.onclick = guard(() => pickTarget(index));
      tools.append(pick);
      details.append(tools);
      li.append(details);
    }
    $('steps').append(li);
  });
  renderVariables();
  savedState();
}
function renderHistory() {
  $('history-list').replaceChildren();
  if (!history.length)
    $('history-list').append(
      node(
        'li',
        'No runs yet. Completed and stopped runs appear here.',
        'library-empty',
      ),
    );
  for (const item of history) {
    const li = node('li', undefined, 'history-item'),
      top = node('div', undefined, 'section-title');
    top.append(
      node('strong', item.name),
      node('span', item.outcome, 'outcome ' + item.outcome),
    );
    const meta = node('div', undefined, 'history-info');
    meta.append(
      node('span', new Date(item.at).toLocaleString()),
      node(
        'span',
        item.completed +
          '/' +
          item.total +
          ' steps · ' +
          (item.durationMs / 1000).toFixed(1) +
          's',
      ),
    );
    li.append(top, meta);
    $('history-list').append(li);
  }
}
function addHistory(item) {
  historyQueue = historyQueue
    .then(async () => {
      history = [item, ...history].slice(0, 50);
      await chrome.storage.local.set({ runHistory: history });
      renderHistory();
    })
    .catch(() =>
      status('The run ended, but activity could not be saved.', 'error'),
    );
  return historyQueue;
}
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url)
    throw new Error(
      'Click the Replamma toolbar icon on the page to grant access.',
    );
  webUrl(tab.url);
  return tab;
}
async function inject(id) {
  await chrome.scripting.executeScript({
    target: { tabId: id },
    files: ['core.js', 'content.js'],
  });
}
async function send(type, extra = {}) {
  const result = await chrome.tabs.sendMessage(tabId, { type, ...extra });
  if (!result?.ok) throw new Error(result?.error || 'Page did not respond.');
  return result;
}
async function persistDraft() {
  await chrome.storage.local.set({ draft: flow });
}
async function poll() {
  if (polling || mode !== 'recording') return;
  polling = true;
  try {
    const result = await send('RECORD_POLL');
    if (mode !== 'recording') return;
    if (result.session !== session)
      throw new Error(
        'The page changed. Your last captured steps are preserved.',
      );
    flow.steps = result.steps;
    render();
    await persistDraft();
    if (!result.recording)
      await stop(
        'Recording stopped: page changed or the step limit was reached.',
      );
  } catch (error) {
    if (mode === 'recording')
      await stop('Recording interrupted. ' + error.message);
  } finally {
    polling = false;
  }
}
async function stop(message = 'Stopped. Review your steps before saving.') {
  const previous = mode;
  generation++;
  clearInterval(pollTimer);
  approvePending?.(false);
  approvePending = null;
  $('approval').hidden = true;
  try {
    if (previous === 'recording') {
      const result = await send('RECORD_STOP');
      if (result.session === session) flow.steps = result.steps;
    } else if (previous === 'running' || previous === 'picking')
      await send('CANCEL');
  } catch {}
  busy('idle');
  render();
  await persistDraft();
  status(message);
}
function guard(fn) {
  return async () => {
    try {
      await fn();
    } catch (error) {
      if (mode === 'preparing') {
        busy('idle');
        render();
      }
      status(error.message, 'error');
    }
  };
}
async function pickTarget(index) {
  syncFields();
  busy('preparing');
  const tab = await activeTab();
  if (!samePage(flow.url, tab.url))
    throw new Error(
      'Open this workflow’s starting page before choosing a target.',
    );
  tabId = tab.id;
  await inject(tabId);
  await send('PICK_START');
  busy('picking');
  const token = ++generation;
  status('Click an element on the page. Press Escape to cancel.');
  try {
    while (generation === token) {
      const { result } = await send('PICK_POLL');
      if (result) {
        if (!result.cancelled) {
          flow.steps[index].selector = result.selector;
          flow.steps[index].label = result.label;
          status('Target updated. Save the workflow to keep it.');
        } else status('Target selection cancelled.');
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  } finally {
    if (generation === token) {
      busy('idle');
      render();
    }
  }
}
$('name').oninput = savedState;
$('url').oninput = savedState;
$('new').onclick = () => {
  if (!confirmSwitch()) return;
  selected = '';
  flow = fresh();
  $('variable-fields').replaceChildren();
  renderLibrary();
  render();
  status('New workflow. Press Record to begin.');
};
$('record').onclick = guard(async () => {
  syncFields();
  if (
    flow.steps.length &&
    !confirm(
      'Replace the current steps with a new recording? Saved workflows are kept.',
    )
  )
    return;
  busy('preparing');
  const tab = await activeTab();
  tabId = tab.id;
  await inject(tabId);
  session = crypto.randomUUID();
  await send('RECORD_START', { session });
  flow.url = tab.url;
  flow.steps = [];
  busy('recording');
  render();
  status('Recording this page. Sensitive fields are skipped.');
  pollTimer = setInterval(poll, 500);
});
$('stop').onclick = guard(() => stop());
$('save').onclick = guard(async () => {
  syncFields();
  flow = validate(flow);
  selected ||= crypto.randomUUID();
  library[selected] = structuredClone(flow);
  await chrome.storage.local.set({ workflows: library, draft: flow });
  renderLibrary();
  savedState();
  status('Saved in this browser profile.', 'success');
});
$('duplicate').onclick = guard(async () => {
  syncFields();
  flow = validate(flow);
  flow.name = (flow.name + ' (copy)').slice(0, 100);
  selected = '';
  $('variable-fields').replaceChildren();
  renderLibrary();
  render();
  status('Duplicate created. Choose a name, then save it.');
});
$('delete').onclick = guard(async () => {
  if (!selected) throw new Error('Open a saved workflow to delete it.');
  if (!confirm('Delete “' + library[selected].name + '” from this browser?'))
    return;
  delete library[selected];
  await chrome.storage.local.set({ workflows: library });
  selected = '';
  flow = fresh();
  $('variable-fields').replaceChildren();
  renderLibrary();
  render();
  await persistDraft();
  status('Workflow deleted.');
});
$('wait').onclick = () => {
  syncFields();
  if (flow.steps.length >= 250)
    return status('250-step limit reached.', 'error');
  flow.steps.push({ type: 'wait', ms: 1000 });
  render();
};
$('export').onclick = guard(async () => {
  syncFields();
  const clean = validate(flow),
    url = URL.createObjectURL(
      new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' }),
    ),
    link = node('a');
  link.href = url;
  link.download =
    (clean.name.replace(/[^a-z0-9_-]/gi, '-') || 'workflow') + '.replamma.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status('Exported. Check for private information before sharing.');
});
$('import').onclick = () => $('file').click();
$('file').onchange = guard(async () => {
  const file = $('file').files[0];
  if (!file) return;
  try {
    if (file.size > 2000000)
      throw new Error('Import files must be smaller than 2 MB.');
    const imported = validate(JSON.parse(await file.text()));
    if (!confirmSwitch()) return;
    flow = imported;
    selected = '';
    $('variable-fields').replaceChildren();
    renderLibrary();
    render();
    showView('workflows');
    status('Imported. Review all steps before running.');
  } finally {
    $('file').value = '';
  }
});
$('clear-history').onclick = guard(async () => {
  if (
    history.length &&
    !confirm('Clear activity on this device? Workflows are kept.')
  )
    return;
  await historyQueue;
  history = [];
  await chrome.storage.local.set({ runHistory: [] });
  renderHistory();
});
$('approve').onclick = () => {
  approvePending?.(true);
  approvePending = null;
  $('approval').hidden = true;
};
$('run').onclick = guard(async () => {
  syncFields();
  const values = Object.fromEntries(
    [...$('variable-fields').querySelectorAll('input')].map((el) => [
      el.dataset.variable,
      el.value,
    ]),
  );
  const plan = resolveVariables(structuredClone(flow), values);
  if (!plan.steps.length) throw new Error('Record or import some steps first.');
  busy('preparing');
  const tab = await activeTab();
  if (!samePage(plan.url, tab.url))
    throw new Error(
      'Open the starting page and click the Replamma toolbar icon there.',
    );
  tabId = tab.id;
  await inject(tabId);
  await send('CANCEL');
  busy('running');
  const token = ++generation,
    started = Date.now();
  let completed = 0,
    outcome = 'cancelled';
  try {
    for (const [index, step] of plan.steps.entries()) {
      if (generation !== token) return;
      status(
        'Step ' +
          (index + 1) +
          ' of ' +
          plan.steps.length +
          ': ' +
          (step.label || step.type),
      );
      if (step.type === 'click') {
        $('approval-text').textContent =
          'Click “' +
          step.label +
          '”. This may submit data, start a download or leave the page.';
        $('approval-selector').textContent = step.selector;
        $('approval').hidden = false;
        const approved = await new Promise((resolve) => {
          approvePending = resolve;
        });
        if (!approved || generation !== token) return;
      }
      if (step.type === 'wait') {
        const end = Date.now() + step.ms;
        while (Date.now() < end) {
          if (generation !== token) return;
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(100, end - Date.now())),
          );
        }
      } else await send('EXECUTE', { step, url: plan.url });
      completed++;
    }
    if (generation === token) {
      outcome = 'completed';
      status('Workflow completed.', 'success');
    }
  } catch (error) {
    if (generation === token) {
      outcome = 'failed';
      status(
        'Stopped at step ' + (completed + 1) + ': ' + error.message,
        'error',
      );
    }
  } finally {
    for (const input of $('variable-fields').querySelectorAll('input'))
      input.value = '';
    if (generation === token) {
      busy('idle');
      render();
      $('approval').hidden = true;
      approvePending = null;
    }
    await addHistory({
      name: plan.name,
      at: started,
      outcome,
      completed,
      total: plan.steps.length,
      durationMs: Date.now() - started,
    });
  }
});
window.addEventListener('pagehide', () => {
  if (tabId !== null)
    chrome.tabs.sendMessage(tabId, { type: 'CANCEL' }).catch(() => {});
});
document.addEventListener('copy', (event) => {
  if (!document.activeElement?.matches('input,textarea'))
    event.preventDefault();
});
try {
  const stored = await chrome.storage.local.get([
    'workflows',
    'draft',
    'runHistory',
  ]);
  for (const [id, item] of Object.entries(stored.workflows || {})) {
    try {
      library[id] = validate(item);
    } catch {}
  }
  if (stored.draft) {
    try {
      flow = validate(stored.draft);
    } catch {}
  }
  history = Array.isArray(stored.runHistory)
    ? stored.runHistory
        .filter(
          (item) =>
            typeof item?.name === 'string' &&
            Number.isFinite(item.at) &&
            ['completed', 'failed', 'cancelled'].includes(item.outcome),
        )
        .slice(0, 50)
    : [];
  selected =
    Object.keys(library).find(
      (id) => JSON.stringify(library[id]) === JSON.stringify(flow),
    ) || '';
  renderLibrary();
  render();
  renderHistory();
} catch (error) {
  status('Could not load local storage: ' + error.message, 'error');
}
