(() => {
  if (globalThis.__replayContent) return;
  globalThis.__replayContent = true;
  let recording = false,
    steps = [],
    startUrl = '',
    session = '',
    runEpoch = 0,
    heartbeat = 0;
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
  async function execute(step) {
    const epoch = runEpoch;
    const deadline = Date.now() + 5000;
    let el;
    do {
      if (epoch !== runEpoch) throw new Error('Run stopped.');
      const matches = document.querySelectorAll(step.selector);
      if (matches.length > 1)
        throw new Error('Selector matches multiple elements. Edit this step.');
      el = matches[0];
      if (el) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    } while (Date.now() < deadline);
    if (!el) throw new Error('Element not found within 5 seconds.');
    if (sensitive(el))
      throw new Error('Replay refuses sensitive or private fields.');
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
          runEpoch++;
          recording = false;
          return {};
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
          await execute(flow.steps[0]);
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
