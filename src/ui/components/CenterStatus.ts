export function renderCenterStatus(
  turn: number,
  wallRemaining: number,
  lastAction: string
): HTMLElement {
  const center = document.createElement('div');
  center.className = 'center-status';
  center.style.textAlign = 'center';
  center.style.padding = '16px';
  center.style.backgroundColor = '#f9f9f9';
  center.style.borderRadius = '8px';
  center.style.border = '1px solid #ddd';

  const turnDiv = document.createElement('div');
  turnDiv.style.fontSize = '18px';
  turnDiv.style.fontWeight = '600';
  turnDiv.style.marginBottom = '8px';
  turnDiv.textContent = `Turn ${turn}`;

  const wallDiv = document.createElement('div');
  wallDiv.style.fontSize = '14px';
  wallDiv.style.color = '#666';
  wallDiv.style.marginBottom = '8px';
  wallDiv.textContent = `Wall: ${wallRemaining} tiles`;

  const actionDiv = document.createElement('div');
  actionDiv.style.fontSize = '12px';
  actionDiv.style.color = '#888';
  actionDiv.style.marginTop = '8px';
  actionDiv.style.fontStyle = 'italic';
  actionDiv.textContent = lastAction || 'Game started';

  center.appendChild(turnDiv);
  center.appendChild(wallDiv);
  center.appendChild(actionDiv);

  return center;
}
