let DATA = null;
let selectedCompare = ['idea3', 'idea11', 'idea93'];
let dbSort = { key: 'freq_512_mhz', asc: false };
let ideasSort = { key: 'joint_rank', asc: true };
let ideasFilter = 'all';
let selectedWidth = 256;
let selectedBubbleSlug = 'idea3';

async function init() {
  const res = await fetch('data.json');
  DATA = await res.json();
  renderChampions();
  renderDbTable();
  renderIdeasTable();
  renderParetoChart();
  renderScalingChart();
  renderTaxonomy();
  populateCompareSelects();
  updateCompareBadge();
  fetchGitHubStars();
}

async function fetchGitHubStars() {
  try {
    const res = await fetch('https://api.github.com/repos/SJTU-YONGFU-RESEARCH-GRP/adder-website');
    if (!res.ok) return;
    const info = await res.json();
    const el = document.getElementById('github-star-count');
    if (el && typeof info.stargazers_count === 'number') {
      el.textContent = String(info.stargazers_count);
    }
  } catch (_) {}
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tabName}`));
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function allEntities() {
  return [...DATA.ideas, ...DATA.classical];
}

function findEntity(slug) {
  return allEntities().find(e => e.slug === slug);
}

function renderChampions() {
  const grid = document.getElementById('champions-grid');
  if (!grid) return;
  const roles = {
    idea3: 'Case Study 1 — Ultra-Wide High-Speed Anchor',
    idea11: 'Case Study 2 — Balanced Novelty-PPA Adaptive Policy',
    idea93: 'Case Study 3 — Minimal-Area Edge Fusion & Collapse'
  };
  grid.innerHTML = DATA.champions.map(slug => {
    const c = findEntity(slug);
    return `
      <div class="champ-card">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
            <span class="pill pill-pareto">Joint #${c.joint_rank} (${c.joint_score.toFixed(4)})</span>
            <span class="pill ${c.decision === 'novel' ? 'pill-novel' : 'pill-inc'}">${c.decision} (${c.nov_score.toFixed(3)})</span>
          </div>
          <h3 style="margin:0 0 4px; font-size:1.1rem;">${c.slug.toUpperCase()}: ${c.name}</h3>
          <div style="font-size:0.82rem; font-weight:700; color:var(--teal); margin-bottom:10px;">${roles[slug]}</div>
          <div class="mono" style="font-size:0.8rem; line-height:1.6;">
            256b Delay: <strong>${c.delay_256_ns.toFixed(4)} ns</strong> (${c.fmax_256_mhz.toFixed(2)} MHz)<br>
            256b Area: <strong>${c.area_256.toFixed(2)} &mu;m&sup2;</strong> | Power: <strong>${c.power_256_mw.toFixed(4)} mW</strong><br>
            ABC Collapsed: <strong>${c.collapsed_cla ? 'Yes (1566.21 &mu;m&sup2;)' : 'No (Retains Topology)'}</strong>
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-mini" onclick="toggleCompare('${c.slug}')">+ Compare</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderDbTable() {
  const q = (document.getElementById('db-search').value || '').toLowerCase();
  const rows = DATA.classical
    .filter(r => r.name.toLowerCase().includes(q))
    .sort((a, b) => {
      const va = a[dbSort.key], vb = b[dbSort.key];
      if (typeof va === 'string') return dbSort.asc ? va.localeCompare(vb) : vb.localeCompare(va);
      return dbSort.asc ? va - vb : vb - va;
    });

  document.querySelector('#db-table tbody').innerHTML = rows.map(r => {
    const isAdded = selectedCompare.includes(r.slug);
    return `
      <tr>
        <td><a href="design.html?slug=${r.slug}" style="font-weight:800; color:var(--ink); text-decoration:underline; text-decoration-color:var(--cyan); text-underline-offset:3px;">${r.name}</a></td>
        <td class="mono">${r.area_512.toFixed(2)}</td>
        <td class="mono">${r.freq_512_mhz.toFixed(1)}</td>
        <td class="mono">${r.delay_512_ns.toFixed(2)}</td>
        <td class="mono">${r.power_512_mw.toFixed(2)}</td>
        <td><button class="btn-mini ${isAdded ? 'added' : ''}" onclick="toggleCompare('${r.slug}')">${isAdded ? 'Added' : '+ Compare'}</button></td>
      </tr>
    `;
  }).join('');
}

document.getElementById('db-search').addEventListener('input', renderDbTable);
document.querySelectorAll('#db-table th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const k = th.dataset.sort;
    dbSort = { key: k, asc: dbSort.key === k ? !dbSort.asc : true };
    renderDbTable();
  });
});

function renderIdeasTable() {
  const q = (document.getElementById('ideas-search').value || '').toLowerCase();
  const rows = DATA.ideas.filter(r => {
    const matchText = r.slug.includes(q) || r.name.toLowerCase().includes(q);
    if (!matchText) return false;
    if (ideasFilter === 'novel') return r.decision === 'novel';
    if (ideasFilter === 'pareto') return r.pareto_256;
    if (ideasFilter === 'noncollapsed') return r.has_sta && !r.collapsed_cla;
    if (ideasFilter === 'sta') return r.has_sta;
    return true;
  }).sort((a, b) => {
    const k = ideasSort.key;
    const va = a[k] ?? 999999, vb = b[k] ?? 999999;
    return ideasSort.asc ? va - vb : vb - va;
  });

  document.querySelector('#ideas-table tbody').innerHTML = rows.map(r => {
    const isAdded = selectedCompare.includes(r.slug);
    const badges = [
      `<span class="pill ${r.decision === 'novel' ? 'pill-novel' : 'pill-inc'}">${r.decision}</span>`,
      r.pareto_256 ? '<span class="pill pill-pareto">Pareto</span>' : '',
      r.collapsed_cla ? '<span class="pill pill-collapsed">Collapsed</span>' : ''
    ].filter(Boolean).join(' ');
    return `
      <tr>
        <td class="mono">#${r.joint_rank}</td>
        <td><strong>${r.slug}</strong> <span style="font-size:0.78rem; color:#444;">${r.name}</span></td>
        <td class="mono"><strong>${r.joint_score.toFixed(4)}</strong></td>
        <td class="mono">${r.nov_score.toFixed(3)}</td>
        <td class="mono">${r.ppa_score.toFixed(4)}</td>
        <td class="mono">${r.has_sta ? r.area_256.toFixed(2) : '—'}</td>
        <td class="mono">${r.has_sta ? r.delay_256_ns.toFixed(4) : '—'}</td>
        <td class="mono">${r.has_sta ? r.fmax_256_mhz.toFixed(2) : '—'}</td>
        <td class="mono">${r.has_sta ? r.power_256_mw.toFixed(4) : '—'}</td>
        <td>${badges}</td>
        <td><button class="btn-mini ${isAdded ? 'added' : ''}" onclick="toggleCompare('${r.slug}')">${isAdded ? 'Added' : '+ Compare'}</button></td>
      </tr>
    `;
  }).join('');
}

document.getElementById('ideas-search').addEventListener('input', renderIdeasTable);
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ideasFilter = btn.dataset.filter;
    renderIdeasTable();
  });
});
document.querySelectorAll('#ideas-table th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const k = th.dataset.sort;
    ideasSort = { key: k, asc: ideasSort.key === k ? !ideasSort.asc : true };
    renderIdeasTable();
  });
});

function getPointsForWidth(width) {
  const pts = [];
  for (const r of DATA.ideas) {
    const pt = (r.sta_scaling || []).find(s => s.width === width);
    if (pt) {
      pts.push({
        idea: r,
        slug: r.slug,
        area: pt.area,
        delay: pt.delay,
        fmax: pt.fmax,
        power: pt.power,
        adp: pt.area * pt.delay,
        pdp: pt.power * pt.delay,
      });
    }
  }
  for (const p of pts) {
    p.pareto = !pts.some(o =>
      o.area <= p.area && o.delay <= p.delay && o.power <= p.power &&
      (o.area < p.area || o.delay < p.delay || o.power < p.power)
    );
  }
  return pts;
}

function selectBubble(slug) {
  selectedBubbleSlug = slug;
  renderParetoChart();
}

function renderBubbleDetail(pt) {
  const box = document.getElementById('bubble-detail');
  if (!box) return;
  if (!pt) {
    box.style.display = 'none';
    return;
  }
  const r = pt.idea;
  const isAdded = selectedCompare.includes(r.slug);
  box.style.display = 'flex';
  box.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
      <div>
        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:6px;">
          <span class="pill ${r.decision === 'novel' ? 'pill-novel' : 'pill-inc'}">${r.decision} (${r.nov_score.toFixed(3)}/5)</span>
          <span class="pill">Joint #${r.joint_rank} (${r.joint_score.toFixed(4)})</span>
          ${pt.pareto ? `<span class="pill pill-pareto">Pareto-Optimal @ ${selectedWidth}b</span>` : ''}
          ${r.collapsed_cla ? '<span class="pill pill-collapsed">ABC Equivalence-Collapsed</span>' : '<span class="pill" style="background:var(--cyan-soft);">Non-Collapsed</span>'}
        </div>
        <h3 style="margin:0; font-size:1.1rem;">${r.slug.toUpperCase()}: ${r.name}</h3>
      </div>
      <button class="btn-mini ${isAdded ? 'added' : ''}" onclick="toggleCompare('${r.slug}'); renderBubbleDetail(getPointsForWidth(selectedWidth).find(p => p.slug === '${r.slug}'));">
        ${isAdded ? 'Added to Compare' : '+ Add to Compare'}
      </button>
    </div>
    <div class="mono" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px; font-size:0.84rem; background:var(--cream); border:1.5px solid var(--ink); border-radius:8px; padding:12px;">
      <div><strong>Area (${selectedWidth}b):</strong><br>${pt.area.toFixed(2)} &mu;m&sup2;</div>
      <div><strong>Delay (${selectedWidth}b):</strong><br>${pt.delay.toFixed(4)} ns</div>
      <div><strong>Fmax (${selectedWidth}b):</strong><br>${pt.fmax.toFixed(2)} MHz</div>
      <div><strong>Power (${selectedWidth}b):</strong><br>${pt.power.toFixed(4)} mW</div>
      <div><strong>ADP:</strong><br>${pt.adp.toFixed(1)} &mu;m&sup2;&middot;ns</div>
      <div><strong>PDP:</strong><br>${pt.pdp.toFixed(4)} pJ</div>
    </div>
  `;
}

function renderParetoChart() {
  const pts = getPointsForWidth(selectedWidth);
  if (!pts.length) return;
  const w = 780, h = 360, padL = 62, padR = 32, padT = 24, padB = 46;
  const areas = pts.map(p => p.area), delays = pts.map(p => p.delay);
  const minA = Math.min(...areas) * 0.96, maxA = Math.max(...areas) * 1.04;
  const minD = Math.min(...delays) * 0.90, maxD = Math.max(...delays) * 1.06;
  const sx = a => padL + ((a - minA) / Math.max(1e-6, maxA - minA)) * (w - padL - padR);
  const sy = d => h - padB - ((d - minD) / Math.max(1e-6, maxD - minD)) * (h - padT - padB);

  const paretoPts = pts.filter(p => p.pareto).sort((a, b) => a.area - b.area);
  const poly = paretoPts.map(p => `${sx(p.area).toFixed(1)},${sy(p.delay).toFixed(1)}`).join(' ');

  const circles = pts.map(p => {
    const cx = sx(p.area), cy = sy(p.delay);
    const isSel = p.slug === selectedBubbleSlug;
    const fill = p.pareto ? '#ffc83e' : (p.idea.collapsed_cla ? '#f38469' : '#22bfd7');
    const rad = isSel ? 9 : (p.pareto ? 7 : 5);
    const strokeW = isSel ? 3 : 1.5;
    const label = (p.pareto || isSel) ? `<text x="${cx + 10}" y="${cy + 4}" font-size="11" font-weight="800" font-family="JetBrains Mono">${p.slug}</text>` : '';
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rad}" fill="${fill}" stroke="#151b20" stroke-width="${strokeW}" style="cursor:pointer;" onclick="selectBubble('${p.slug}')"><title>${p.slug}: Area=${p.area} um2, Delay=${p.delay} ns (Click for details)</title></circle>${label}`;
  }).join('');

  const xTicks = [0, 0.5, 1.0].map(f => {
    const val = minA + (maxA - minA) * f;
    return `<text x="${sx(val).toFixed(1)}" y="${h - padB + 18}" text-anchor="middle" font-size="11" font-family="JetBrains Mono">${val.toFixed(0)}</text>`;
  }).join('');
  const yTicks = [0, 0.5, 1.0].map(f => {
    const val = minD + (maxD - minD) * f;
    return `<text x="${padL - 8}" y="${(sy(val) + 4).toFixed(1)}" text-anchor="end" font-size="11" font-family="JetBrains Mono">${val.toFixed(2)}</text>`;
  }).join('');

  document.getElementById('pareto-chart').innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%; max-width:${w}px; height:auto;">
      <line x1="${padL}" y1="${h - padB}" x2="${w - padR}" y2="${h - padB}" stroke="#151b20" stroke-width="2"/>
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${h - padB}" stroke="#151b20" stroke-width="2"/>
      <polyline points="${poly}" fill="none" stroke="#151b20" stroke-width="2" stroke-dasharray="5,4"/>
      ${xTicks}${yTicks}
      ${circles}
      <text x="${(w + padL - padR)/2}" y="${h - 8}" text-anchor="middle" font-size="12" font-weight="700">${selectedWidth}-bit Area (&mu;m&sup2;)</text>
      <text x="16" y="${(h - padB + padT)/2}" text-anchor="middle" font-size="12" font-weight="700" transform="rotate(-90 16 ${(h - padB + padT)/2})">${selectedWidth}-bit Delay (ns)</text>
    </svg>
  `;

  const selPt = pts.find(p => p.slug === selectedBubbleSlug) || paretoPts[0];
  renderBubbleDetail(selPt);
}

document.querySelectorAll('.width-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.width-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedWidth = Number(btn.dataset.width);
    renderParetoChart();
  });
});

function renderScalingChart() {
  const champs = [
    { slug: 'idea3', color: '#ffc83e' },
    { slug: 'idea11', color: '#22bfd7' },
    { slug: 'idea93', color: '#f38469' }
  ];
  const widths = [8, 16, 32, 64, 128, 256];
  const w = 780, h = 300, pad = 56;
  const sx = i => pad + (i / (widths.length - 1)) * (w - 2 * pad);
  const sy = d => h - pad - (d / 9.0) * (h - 2 * pad);

  const lines = champs.map(ch => {
    const ent = findEntity(ch.slug);
    const pts = widths.map((wd, i) => {
      const pt = ent.sta_scaling.find(s => s.width === wd);
      return pt ? { x: sx(i), y: sy(pt.delay), d: pt.delay } : null;
    }).filter(Boolean);
    const poly = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const dots = pts.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="${ch.color}" stroke="#151b20" stroke-width="1.5"><title>${ch.slug}: ${p.d} ns</title></circle>`).join('');
    return `<polyline points="${poly}" fill="none" stroke="${ch.color}" stroke-width="3"/>${dots}`;
  }).join('');

  const xLabels = widths.map((wd, i) => `<text x="${sx(i)}" y="${h-pad+18}" text-anchor="middle" font-size="11" font-family="JetBrains Mono">${wd}b</text>`).join('');

  document.getElementById('scaling-chart').innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%; max-width:${w}px; height:auto;">
      <line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" stroke="#151b20" stroke-width="2"/>
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h-pad}" stroke="#151b20" stroke-width="2"/>
      ${lines}
      ${xLabels}
      <text x="16" y="${h/2}" text-anchor="middle" font-size="12" font-weight="700" transform="rotate(-90 16 ${h/2})">Delay (ns)</text>
    </svg>
    <div class="chart-legend">
      <span><span class="legend-dot" style="background:#ffc83e;"></span>idea3 (HGGCBA) — 3.67 ns @ 256b</span>
      <span><span class="legend-dot" style="background:#22bfd7;"></span>idea11 (MECFA) — 5.85 ns @ 256b</span>
      <span><span class="legend-dot" style="background:#f38469;"></span>idea93 (PWCFA) — 8.54 ns @ 256b</span>
    </div>
  `;
}

function renderTaxonomy() {
  document.getElementById('kw-grid').innerHTML = DATA.keywords.map(cat => `
    <div class="kw-card">
      <h3 style="margin:0 0 12px; font-size:1rem;">${cat.category}</h3>
      ${cat.items.map(it => `
        <div class="kw-bar-row">
          <div class="kw-bar-label">
            <code>${it.kw}</code>
            <span class="mono">${it.files}/100 (${it.mentions})</span>
          </div>
          <div class="kw-bar-track"><div class="kw-bar-fill" style="width:${it.files}%"></div></div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

/* Compare Matrix Modal */
function updateCompareBadge() {
  document.getElementById('compare-count-badge').textContent = String(selectedCompare.length);
}

function toggleCompare(slug) {
  if (selectedCompare.includes(slug)) {
    selectedCompare = selectedCompare.filter(s => s !== slug);
  } else {
    if (selectedCompare.length >= 3) selectedCompare.shift();
    selectedCompare.push(slug);
  }
  updateCompareBadge();
  renderDbTable();
  renderIdeasTable();
  renderCompareMatrix();
}

function applyPreset(slugs) {
  selectedCompare = slugs.slice(0, 3);
  updateCompareBadge();
  renderDbTable();
  renderIdeasTable();
  renderCompareMatrix();
}

function populateCompareSelects() {
  const opts = allEntities().map(e => `<option value="${e.slug}">${e.kind === 'classical' ? '[DB] ' : `[${e.slug}] `}${e.name}</option>`).join('');
  [0, 1, 2].forEach(i => {
    const sel = document.getElementById(`cmp-sel-${i}`);
    sel.innerHTML = `<option value="">-- None --</option>` + opts;
    sel.value = selectedCompare[i] || '';
    sel.addEventListener('change', () => {
      selectedCompare = [0, 1, 2].map(j => document.getElementById(`cmp-sel-${j}`).value).filter(Boolean);
      updateCompareBadge();
      renderCompareMatrix();
    });
  });
}

function renderCompareMatrix() {
  [0, 1, 2].forEach(i => {
    const sel = document.getElementById(`cmp-sel-${i}`);
    if (sel) sel.value = selectedCompare[i] || '';
  });
  const ents = selectedCompare.map(findEntity).filter(Boolean);
  const thead = document.querySelector('#compare-table thead');
  const tbody = document.querySelector('#compare-table tbody');
  thead.innerHTML = `<tr><th>Metric</th>${ents.map(e => `<th>${e.name}</th>`).join('')}</tr>`;
  const rows = [
    ['Source / Kind', e => e.kind === 'classical' ? 'projects/database (512b)' : `experiments/${e.slug} (256b)`],
    ['Joint Rank / Score', e => e.joint_rank ? `#${e.joint_rank} (${e.joint_score.toFixed(4)})` : 'Baseline'],
    ['Novelty Score (/5)', e => e.nov_score ? `${e.nov_score.toFixed(3)} (${e.decision})` : 'Classical Reference'],
    ['Area (um^2)', e => e.area_256 ? `${e.area_256.toFixed(2)} (256b)` : (e.area_512 ? `${e.area_512.toFixed(2)} (512b)` : '—')],
    ['Delay (ns)', e => e.delay_256_ns ? `${e.delay_256_ns.toFixed(4)} (256b)` : (e.delay_512_ns ? `${e.delay_512_ns.toFixed(2)} (512b)` : '—')],
    ['Fmax (MHz)', e => e.fmax_256_mhz ? `${e.fmax_256_mhz.toFixed(2)} (256b)` : (e.freq_512_mhz ? `${e.freq_512_mhz.toFixed(1)} (512b)` : '—')],
    ['Power (mW)', e => e.power_256_mw ? `${e.power_256_mw.toFixed(4)} (256b)` : (e.power_512_mw ? `${e.power_512_mw.toFixed(2)} (512b)` : '—')],
    ['Pareto / Collapse', e => e.kind === 'classical' ? 'Baseline' : `${e.pareto_256 ? 'Pareto-Optimal' : 'Dominated'} / ${e.collapsed_cla ? 'Collapsed' : 'Non-Collapsed'}`],
  ];
  tbody.innerHTML = rows.map(([label, fn]) => `<tr><td><strong>${label}</strong></td>${ents.map(e => `<td class="mono">${fn(e)}</td>`).join('')}</tr>`).join('');
}

const modal = document.getElementById('compare-modal');
document.getElementById('open-compare-btn').addEventListener('click', () => { modal.classList.add('open'); renderCompareMatrix(); });
document.getElementById('close-compare-btn').addEventListener('click', () => modal.classList.remove('open'));
modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
document.addEventListener('keydown', e => {
  if (e.key === 'c' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    modal.classList.toggle('open');
    if (modal.classList.contains('open')) renderCompareMatrix();
  } else if (e.key === 'Escape') {
    modal.classList.remove('open');
  }
});

init();
