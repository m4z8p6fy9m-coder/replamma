const $ = (id) => document.getElementById(id);
const { validate, samePage, webUrl } = ReplayCore;
let library = {},
  selected = '',
  flow = fresh(),
  mode = 'idle',
  tabId = null,
  pollTimer,
  polling = false,
  session = '',
  generation = 0,
  approvePending;
function fresh() {
  return { schemaVersion: 1, name: 'My first workflow', url: '', steps: [] };
}
function status(text, kind = '') {
  $('status').textContent = text;
  $('status').dataset.kind = kind;
}
function syncFields() {
  flow.name = $('name').value;
  flow.url = $('url').value;
}
function busy(value) {
  mode = value;
  for (const id of [
    'new',
    'record',
    'run',
    'save',
    'export',
    'delete',
    'import',
    'library',
    'name',
    'url',
    'wait',
  ])
    $(id).disabled = value !== 'idle';
  $('stop').disabled = value === 'idle' || value === 'preparing';
  for (const el of $('steps').querySelectorAll('button,input'))
    el.disabled = value !== 'idle';
}
function renderLibrary() {
  $('library').replaceChildren(new Option('Unsaved workflow', ''));
  for (const [id, item] of Object.entries(library))
    $('library').add(new Option(item.name, id));
  $('library').value = selected;
}
function render() {
  $('name').value = flow.name;
  $('url').value = flow.url;
  $('count').textContent =
    `${flow.steps.length} step${flow.steps.length === 1 ? '' : 's'}`;
  $('empty').hidden = flow.steps.length > 0;
  $('steps').replaceChildren();
  flow.steps.forEach((step, index) => {
    const li = document.createElement('li');
    const heading = document.createElement('div');
    heading.className = 'step-heading';
    const number = document.createElement('span');
    number.className = 'step-number';
    number.textContent = String(index + 1).padStart(2, '0');
    const type = document.createElement('span');
    type.className = 'step-type';
    type.textContent = step.type;
    const label = document.createElement('span');
    label.className = 'step-label';
    label.textContent = step.label || `${step.ms} ms`;
    const actions = document.createElement('div');
    actions.className = 'step-buttons';
    function action(text, title, fn, disabled = false) {
      const button = document.createElement('button');
      button.textContent = text;
      button.title = title;
      button.setAttribute('aria-label', `${title} ${index + 1}`);
      button.disabled = mode !== 'idle' || disabled;
      button.onclick = fn;
      actions.append(button);
    }
    action(
      '↑',
      'Move step up',
      () => {
        syncFields();
        [flow.steps[index - 1], flow.steps[index]] = [
          flow.steps[index],
          flow.steps[index - 1],
        ];
        render();
      },
      index === 0,
    );
    action(
      '↓',
      'Move step down',
      () => {
        syncFields();
        [flow.steps[index + 1], flow.steps[index]] = [
          flow.steps[index],
          flow.steps[index + 1],
        ];
        render();
      },
      index === flow.steps.length - 1,
    );
    action('×', 'Remove step', () => {
      syncFields();
      flow.steps.splice(index, 1);
      render();
    });
    heading.append(number, type, label, actions);
    li.append(heading);
    const editor = document.createElement('div');
    editor.className = 'step-editor';
    for (const key of step.type === 'wait'
      ? ['ms']
      : step.type === 'click'
        ? ['selector']
        : ['selector', 'value']) {
      const field = document.createElement('label');
      field.className = 'field';
      field.textContent =
        key === 'ms'
          ? 'Wait (milliseconds)'
          : key === 'selector'
            ? 'CSS selector'
            : 'Value';
      const input = document.createElement('input');
      input.value = step[key];
      input.disabled = mode !== 'idle';
      input.setAttribute(
        'aria-label',
        `${field.textContent} for step ${index + 1}`,
      );
      if (key === 'ms') {
        input.type = 'number';
        input.min = 0;
        input.max = 30000;
      }
      input.oninput = () => {
        step[key] = key === 'ms' ? Number(input.value) : input.value;
      };
      field.append(input);
      editor.append(field);
    }
    li.append(editor);
    $('steps').append(li);
  });
}
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url)
    throw new Error(
      'Click Replay’s toolbar icon on the page to grant temporary access.',
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
  const response = await chrome.tabs.sendMessage(tabId, { type, ...extra });
  if (!response?.ok)
    throw new Error(response?.error || 'Page did not respond.');
  return response;
}
async function persistDraft() {
  await chrome.storage.local.set({ draft: flow });
}
async function poll() {
  if (polling || mode !== 'recording') return;
  polling = true;
  try {
    const data = await send('RECORD_POLL');
    if (mode !== 'recording') return;
    if (data.session !== session)
      throw new Error(
        'Recording page changed. Your last captured steps are preserved.',
      );
    flow.steps = data.steps;
    render();
    await persistDraft();
    if (!data.recording)
      await stop('Recording stopped: page changed or 250-step limit reached.');
  } catch (error) {
    if (mode === 'recording')
      await stop(`Recording interrupted. ${error.message}`);
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
      const data = await send('RECORD_STOP');
      if (data.session === session) flow.steps = data.steps;
    } else if (previous === 'running') await send('CANCEL');
  } catch {
    /* Navigated/closed pages have no receiver. Preserve the last draft. */
  }
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
$('new').onclick = guard(async () => {
  flow = fresh();
  selected = '';
  renderLibrary();
  render();
  status('New workflow. Open a page to start recording.');
});
$('record').onclick = guard(async () => {
  syncFields();
  if (
    flow.steps.length &&
    !confirm(
      'Replace the steps in this editor with a new recording? Saved workflows are kept.',
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
  status(
    'Recording this page. Passwords and recognizable sensitive fields are skipped.',
  );
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
  status('Saved in this browser profile.', 'success');
});
$('library').onchange = guard(async () => {
  if (
    !confirm(
      'Open the selected workflow? Unsaved editor changes will be replaced.',
    )
  ) {
    $('library').value = selected;
    return;
  }
  selected = $('library').value;
  flow = selected ? structuredClone(library[selected]) : fresh();
  render();
  status('Workflow opened.');
});
$('delete').onclick = guard(async () => {
  if (!selected) throw new Error('Select a saved workflow to delete.');
  if (!confirm(`Delete “${library[selected].name}” from this browser?`)) return;
  delete library[selected];
  await chrome.storage.local.set({ workflows: library });
  selected = '';
  flow = fresh();
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
  const clean = validate(flow);
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `${clean.name.replace(/[^a-z0-9_-]/gi, '-') || 'workflow'}.replay.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status('Exported. Review the JSON for personal data before sharing.');
});
$('import').onclick = () => $('file').click();
$('file').onchange = guard(async () => {
  const file = $('file').files[0];
  if (!file) return;
  try {
    if (file.size > 2_000_000)
      throw new Error('Import file must be smaller than 2 MB.');
    const imported = validate(JSON.parse(await file.text()));
    if (
      !confirm(
        'Import this workflow into the editor? Unsaved editor changes will be replaced.',
      )
    )
      return;
    flow = imported;
    selected = '';
    renderLibrary();
    render();
    status(
      'Imported for review. Inspect each selector and value before running.',
    );
  } finally {
    $('file').value = '';
  }
});
$('approve').onclick = () => {
  approvePending?.(true);
  approvePending = null;
  $('approval').hidden = true;
};
$('run').onclick = guard(async () => {
  syncFields();
  const plan = validate(structuredClone(flow));
  if (!plan.steps.length) throw new Error('Record or import some steps first.');
  busy('preparing');
  const tab = await activeTab();
  if (!samePage(plan.url, tab.url))
    throw new Error(
      'Open the workflow’s starting URL and click Replay’s toolbar icon there.',
    );
  tabId = tab.id;
  await inject(tabId);
  await send('CANCEL');
  busy('running');
  const token = ++generation;
  try {
    for (const [index, step] of plan.steps.entries()) {
      if (generation !== token) return;
      status(
        `Step ${index + 1} of ${plan.steps.length}: ${step.label || step.type}`,
      );
      if (step.type === 'click') {
        $('approval-text').textContent =
          `Step ${index + 1}: click “${step.label}”. This can submit data, start a download, or leave this page.`;
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
    }
    if (generation === token) status('Workflow completed.', 'success');
  } catch (error) {
    if (generation === token)
      status(`Run paused on error: ${error.message}`, 'error');
  } finally {
    if (generation === token) {
      busy('idle');
      render();
      $('approval').hidden = true;
      approvePending = null;
    }
  }
});
window.addEventListener('pagehide', () => {
  if (tabId !== null)
    chrome.tabs.sendMessage(tabId, { type: 'CANCEL' }).catch(() => {});
});
try {
  const stored = await chrome.storage.local.get(['workflows', 'draft']);
  for (const [id, item] of Object.entries(stored.workflows || {})) {
    try {
      library[id] = validate(item);
    } catch {
      /* Ignore incompatible records. */
    }
  }
  if (stored.draft) {
    try {
      flow = validate(stored.draft);
    } catch {
      /* Empty drafts may have no starting URL. */
    }
  }
  selected =
    Object.keys(library).find(
      (id) => JSON.stringify(library[id]) === JSON.stringify(flow),
    ) || '';
  renderLibrary();
  render();
} catch (error) {
  status(`Could not load local storage: ${error.message}`, 'error');
}
