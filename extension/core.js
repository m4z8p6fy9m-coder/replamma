/* Shared, dependency-free validation. Loaded in the panel and isolated page world. */
(() => {
  const MAX_STEPS = 250;
  function webUrl(value) {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error('Use an HTTP(S) page without embedded credentials.');
    return url;
  }
  function validate(flow) {
    if (!flow || flow.schemaVersion !== 1)
      throw new Error(
        'Unsupported workflow format (expected schemaVersion 1).',
      );
    if (
      typeof flow.name !== 'string' ||
      !flow.name.trim() ||
      flow.name.length > 100
    )
      throw new Error('Give this workflow a name (1–100 characters).');
    webUrl(flow.url);
    if (!Array.isArray(flow.steps) || flow.steps.length > MAX_STEPS)
      throw new Error('A workflow can contain at most 250 steps.');
    const steps = flow.steps.map((step, index) => {
      if (!step || !['click', 'input', 'select', 'wait'].includes(step.type))
        throw new Error(`Invalid action at step ${index + 1}.`);
      if (step.type === 'wait') {
        if (!Number.isInteger(step.ms) || step.ms < 0 || step.ms > 30000)
          throw new Error('Wait must be between 0 and 30000 milliseconds.');
        return { type: 'wait', ms: step.ms };
      }
      if (
        typeof step.selector !== 'string' ||
        !step.selector ||
        step.selector.length > 2000
      )
        throw new Error(`Invalid selector at step ${index + 1}.`);
      if (
        step.type !== 'click' &&
        (typeof step.value !== 'string' || step.value.length > 10000)
      )
        throw new Error('Input values must be text, up to 10000 characters.');
      return {
        type: step.type,
        selector: step.selector,
        label: String(step.label || step.selector).slice(0, 200),
        ...(step.type !== 'click' ? { value: step.value } : {}),
      };
    });
    return {
      schemaVersion: 1,
      name: flow.name.trim(),
      url: webUrl(flow.url).href,
      steps,
    };
  }
  function samePage(a, b) {
    const x = webUrl(a),
      y = webUrl(b);
    return (
      x.origin === y.origin &&
      x.pathname === y.pathname &&
      x.search === y.search
    );
  }
  globalThis.ReplayCore = Object.freeze({
    validate,
    samePage,
    webUrl,
    MAX_STEPS,
  });
})();
