const paths = {
  workflow: 'M5 4h14v16H5z M9 8h6 M9 12h6 M9 16h3',
  input: 'M4 5h16v14H4z M8 9v6 M6 9h4 M6 15h4 M13 12h4',
  select: 'M4 6h16v12H4z M14 10l3 3 3-3 M7 12h3',
  click: 'M8 3v13l4-4 4 8 3-2-4-7h5Z',
  wait: 'M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  up: 'm6 14 6-6 6 6',
  down: 'm6 10 6 6 6-6',
  right: 'm9 6 6 6-6 6',
  close: 'm6 6 12 12 M6 18 18 6',
  target:
    'M9 3H3v6 M15 3h6v6 M3 15v6h6 M21 15v6h-6 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
};
export function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', paths[name] || paths.workflow);
  svg.append(path);
  return svg;
}
