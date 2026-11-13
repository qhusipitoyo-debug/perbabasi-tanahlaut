/**
 * Chart canvas custom (tanpa library): bar chart arus kas & donut pengeluaran.
 * Otomatis menyesuaikan devicePixelRatio dan warna tema aktif.
 */
const cssVar = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(rect.width, 280);
  const height = Math.max(rect.height, 180);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, width, height };
}

export function renderCashflowChart(canvas, chart6) {
  if (!canvas) return;
  const { ctx, width, height } = setupCanvas(canvas);
  ctx.clearRect(0, 0, width, height);

  const pad = { top: 18, right: 8, bottom: 30, left: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const maxVal = Math.max(1, ...chart6.flatMap((d) => [d.masuk, d.keluar]));
  const niceMax = Math.ceil(maxVal / 500000) * 500000 || maxVal;

  const gridColor = cssVar('--border', '#e2e8f0');
  const textColor = cssVar('--muted', '#64748b');
  ctx.font = '10px Segoe UI, sans-serif';

  // Gridlines + label Y (ringkas: jt)
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (innerH / 4) * i;
    const value = niceMax - (niceMax / 4) * i;
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + innerW, y);
    ctx.stroke();
    ctx.fillStyle = textColor;
    ctx.textAlign = 'right';
    ctx.fillText(value >= 1000000 ? `${(value / 1000000).toFixed(1)}jt` : `${Math.round(value / 1000)}rb`, pad.left - 6, y + 3);
  }

  const groupW = innerW / chart6.length;
  const barW = Math.min(22, (groupW - 18) / 2);
  chart6.forEach((d, i) => {
    const cx = pad.left + groupW * i + groupW / 2;
    const drawBar = (value, offset, color) => {
      const h = (value / niceMax) * innerH;
      const x = cx + offset - barW / 2;
      const y = pad.top + innerH - h;
      ctx.fillStyle = color;
      ctx.beginPath();
      const r = Math.min(5, barW / 2, Math.max(0, h));
      if (h > 0) {
        ctx.roundRect(x, y, barW, h, [r, r, 0, 0]);
        ctx.fill();
      }
    };
    drawBar(d.masuk, -barW / 2 - 1.5, '#16a34a');
    drawBar(d.keluar, barW / 2 + 1.5, '#ef4444');
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.fillText(d.label, cx, height - 10);
  });
}

const DONUT_COLORS = ['#f97316', '#2563eb', '#16a34a', '#eab308', '#a855f7', '#64748b'];

export function renderDonutChart(canvas, items) {
  if (!canvas) return;
  const { ctx, width, height } = setupCanvas(canvas);
  ctx.clearRect(0, 0, width, height);

  const textColor = cssVar('--text', '#0f172a');
  const mutedColor = cssVar('--muted', '#64748b');
  const total = items.reduce((s, i) => s + i.total, 0);

  const cx = width / 2;
  const cy = height / 2 - 4;
  const radius = Math.min(width, height) / 2 - 14;
  const thickness = Math.max(18, radius * 0.38);

  if (total === 0) {
    ctx.strokeStyle = cssVar('--border', '#e2e8f0');
    ctx.lineWidth = thickness;
    ctx.beginPath();
    ctx.arc(cx, cy, radius - thickness / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = mutedColor;
    ctx.textAlign = 'center';
    ctx.font = '600 12px Segoe UI, sans-serif';
    ctx.fillText('Belum ada pengeluaran', cx, cy + 4);
    return;
  }

  let angle = -Math.PI / 2;
  items.forEach((item, i) => {
    const slice = (item.total / total) * Math.PI * 2;
    ctx.strokeStyle = DONUT_COLORS[i % DONUT_COLORS.length];
    ctx.lineWidth = thickness;
    ctx.beginPath();
    ctx.arc(cx, cy, radius - thickness / 2, angle, angle + slice - 0.02);
    ctx.stroke();
    angle += slice;
  });

  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.font = '700 13px Segoe UI, sans-serif';
  ctx.fillText('TOTAL', cx, cy - 6);
  ctx.font = '800 15px Segoe UI, sans-serif';
  const compact = total >= 1000000 ? `Rp ${(total / 1000000).toFixed(2)} jt` : `Rp ${Math.round(total / 1000)} rb`;
  ctx.fillText(compact, cx, cy + 12);
}

export function donutLegend(items) {
  const total = items.reduce((s, i) => s + i.total, 0) || 1;
  return items
    .map(
      (item, i) => `
      <div class="legend-item">
        <span class="legend-dot" style="background:${DONUT_COLORS[i % DONUT_COLORS.length]}"></span>
        <span>${item.name}</span>
        <strong>${Math.round((item.total / total) * 100)}%</strong>
      </div>`
    )
    .join('');
}
