(() => {
  if (globalThis.__replayContent) return;
  globalThis.__replayContent = true;
  let recording = false,
    steps = [],
    startUrl = '',
    session = '',
    runEpoch = 0,
    heartbeat = 0;
  let cancelPicker = () => {},
    pickResult = null;
  const sensitive = (element) => {
    const meta = [
      element.type,
      element.name,
      element.id,
      element.autocomplete,
      element.getAttribute('aria-label'),
    ]
      .join(' ')
      .toLowerCase();
    return (
      /password|passwd|secret|token|credit|card|cvc|cvv|otp|one.time|cc-|social.security/.test(
        meta,
      ) || element.closest('[data-replay-private]')
    );
  };
  function selector(element) {
    for (const attr of ['data-testid', 'id', 'name', 'aria-label']) {
      const value = element.getAttribute(attr);
      if (value) {
        const query = `[${attr}=${CSS.escape(value)}]`;
        if (document.querySelectorAll(query).length === 1) return query;
      }
    }
    const path = [];
    for (
      let node = element;
      node && node !== document.documentElement;
      node = node.parentElement
    ) {
      const siblings = [...node.parentElement.children].filter(
        (other) => other.tagName === node.tagName,
      );
      path.unshift(
        `${node.localName}:nth-of-type(${siblings.indexOf(node) + 1})`,
      );
      const query = path.join(' > ');
      if (document.querySelectorAll(query).length === 1) return query;
    }
    throw new Error('Cannot create a unique selector.');
  }
  function label(el) {
    const associatedLabel = el.labels?.[0]?.cloneNode(true);
    associatedLabel
      ?.querySelectorAll('input, select, textarea')
      .forEach((control) => control.remove());
    return (
      el.getAttribute('aria-label') ||
      associatedLabel?.textContent ||
      el.textContent ||
      el.name ||
      el.localName
    )
      .trim()
      .slice(0, 120);
  }
  function add(step) {
    if (steps.length >= ReplayCore.MAX_STEPS) {
      recording = false;
      return;
    }
    const previous = steps.at(-1);
    if (
      step.type !== 'click' &&
      previous?.type === step.type &&
      previous.selector === step.selector
    )
      steps[steps.length - 1] = step;
    else steps.push(step);
  }
  function capture(event) {
    if (Date.now() - heartbeat > 2000) recording = false;
    if (!recording || !event.isTrusted || location.href !== startUrl) return;
    let el = event.target;
    if (!(el instanceof Element) || sensitive(el)) return;
    if (event.type === 'click') {
      el = el.closest(
        'button, a[href], [role="button"], input[type="checkbox"], input[type="radio"], input[type="submit"]',
      );
      if (!el || sensitive(el)) return;
      add({ type: 'click', selector: selector(el), label: label(el) });
    } else if (
      el.matches('input, textarea, select') &&
      !['checkbox', 'radio', 'file', 'hidden', 'submit', 'button'].includes(
        el.type,
      )
    ) {
      add({
        type: el.matches('select') ? 'select' : 'input',
        selector: selector(el),
        label: label(el),
        value: el.value,
      });
    }
  }
  document.addEventListener('click', capture, true);
  document.addEventListener('input', capture, true);
  document.addEventListener('change', capture, true);
  function startPicker() {
    cancelPicker();
    recording = false;
    pickResult = null;
    const overlay = document.createElement('div');
    const shadow = overlay.attachShadow({ mode: 'closed' });
    const box = document.createElement('div');
    const note = document.createElement('div');
    const style = document.createElement('style');
    style.textContent =
      ':host{all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important}div{box-sizing:border-box}#box{position:fixed;border:2px solid #116b66;background:#116b6614;border-radius:3px}#note{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);font:13px system-ui;background:#183b39;color:white;padding:10px 16px;border-radius:5px;white-space:nowrap}';
    box.id = 'box';
    note.id = 'note';
    note.textContent = 'Replamma: click a target · Esc to cancel';
    shadow.append(style, box, note);
    document.documentElement.append(overlay);
    const clean = () => {
      clearTimeout(timeout);
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('click', click, true);
      document.removeEventListener('keydown', key, true);
      overlay.remove();
      cancelPicker = () => {};
    };
    const move = (event) => {
      const rect = event.target.getBoundingClientRect();
      Object.assign(box.style, {
        left: rect.left + 'px',
        top: rect.top + 'px',
        width: rect.width + 'px',
        height: rect.height + 'px',
      });
    };
    const click = (event) => {
      if (!event.isTrusted) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const el = event.target;
      if (sensitive(el)) {
        note.textContent =
          'This field is private. Choose another target or press Esc.';
        return;
      }
      try {
        pickResult = { selector: selector(el), label: label(el) };
        clean();
      } catch {
        note.textContent =
          'Could not identify this element. Choose another target.';
      }
    };
    const key = (event) => {
      if (!event.isTrusted) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        pickResult = { cancelled: true };
        clean();
      }
    };
    const timeout = setTimeout(() => {
      pickResult = { cancelled: true };
      clean();
    }, 30000);
    document.addEventListener('pointermove', move, true);
    document.addEventListener('click', click, true);
    document.addEventListener('keydown', key, true);
    cancelPicker = () => {
      pickResult = { cancelled: true };
      clean();
    };
  }
  async function execute(step, expectedUrl = location.href) {
    const epoch = runEpoch;
    const deadline = Date.now() + 5000;
    let el;
    do {
      if (epoch !== runEpoch) throw new Error('Run stopped.');
      if (!ReplayCore.samePage(expectedUrl, location.href))
        throw new Error('Page changed while waiting for the target.');
      const matches = document.querySelectorAll(step.selector);
      if (matches.length > 1)
        throw new Error('Selector matches multiple elements. Edit this step.');
      el = matches[0];
      if (el) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    } while (Date.now() < deadline);
    if (!el) throw new Error('Element not found within 5 seconds.');
    if (sensitive(el))
      throw new Error('Replamma refuses sensitive or private fields.');
    if (el.disabled || !el.getClientRects().length)
      throw new Error('Element is disabled or hidden.');
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    if (step.type === 'click') el.click();
    else {
      if (step.type === 'select' && !(el instanceof HTMLSelectElement))
        throw new Error('Expected a select element.');
      if (
        step.type === 'input' &&
        (!(
          el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
        ) ||
          ['file', 'hidden', 'checkbox', 'radio', 'submit', 'button'].includes(
            el.type,
          ))
      )
        throw new Error('Expected an editable text field.');
      if (
        step.type === 'select' &&
        ![...el.options].some((option) => option.value === step.value)
      )
        throw new Error('Select option no longer exists.');
      const proto =
        el instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : el instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, step.value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return;
    (async () => {
      switch (message.type) {
        case 'RECORD_START':
          recording = true;
          steps = [];
          startUrl = location.href;
          session = message.session;
          heartbeat = Date.now();
          return { session };
        case 'RECORD_POLL': {
          if (Date.now() - heartbeat > 2000) recording = false;
          heartbeat = Date.now();
          return {
            steps,
            url: startUrl,
            session,
            recording: recording && location.href === startUrl,
          };
        }
        case 'RECORD_STOP':
          recording = false;
          return { steps, url: startUrl, session };
        case 'CANCEL':
          cancelPicker();
          runEpoch++;
          recording = false;
          return {};
        case 'PICK_START':
          startPicker();
          return {};
        case 'PICK_POLL':
          return { result: pickResult };
        case 'EXECUTE': {
          if (!ReplayCore.samePage(message.url, location.href))
            throw new Error(
              'Page changed. Return to the original URL before continuing.',
            );
          const flow = ReplayCore.validate({
            schemaVersion: 1,
            name: 'Run',
            url: message.url,
            steps: [message.step],
          });
          if (flow.steps[0].type === 'wait')
            throw new Error('Wait steps run in the panel.');
          await execute(flow.steps[0], message.url);
          return {};
        }
        default:
          throw new Error('Unknown command.');
      }
    })()
      .then((data) => respond({ ok: true, ...data }))
      .catch((error) => respond({ ok: false, error: error.message }));
    return true;
  });
})();
