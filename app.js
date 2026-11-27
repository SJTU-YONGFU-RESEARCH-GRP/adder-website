let DATA = null;
let selectedCompare = ['idea3', 'idea11', 'idea93'];
let dbSort = { key: 'freq_512_mhz', asc: false };
let ideasSort = { key: 'joint_rank', asc: true };
let ideasFilter = 'all';
let selectedWidth = 256;
let selectedDataset = 'ideas';
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
  } catch (_) { }
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
        <td class="mono">${r.area_512 != null ? r.area_512.toFixed(2) : '—'}</td>
        <td class="mono">${r.freq_512_mhz != null ? r.freq_512_mhz.toFixed(1) : '—'}</td>
        <td class="mono">${r.delay_512_ns != null ? r.delay_512_ns.toFixed(2) : '—'}</td>
        <td class="mono">${r.power_512_mw != null ? r.power_512_mw.toFixed(2) : '—'}</td>
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

function getPointsForWidth(width, dataset = selectedDataset) {
  const pts = [];
  if (dataset === 'ideas' || dataset === 'both') {
    for (const r of DATA.ideas) {
      const pt = (r.sta_scaling || []).find(s => s.width === width);
      if (pt) {
        pts.push({
          entity: r,
          kind: 'discovered',
          slug: r.slug,
          name: r.name,
          area: pt.area,
          delay: pt.delay,
          xVal: pt.area,
          yVal: pt.delay,
          fmax: pt.fmax,
          power: pt.power,
          adp: pt.area * pt.delay,
          pdp: pt.power * pt.delay,
        });
      }
    }
  }
  if (dataset === 'classical' || dataset === 'both') {
    for (const c of DATA.classical) {
      const pt = (c.scaling || []).find(s => s.width === width);
      if (pt) {
        pts.push({
          entity: c,
          kind: 'classical',
          slug: c.slug,
          name: `${c.name} Adder`,
          area: pt.area,
          delay: pt.delay,
          xVal: pt.area,
          yVal: pt.delay,
          fmax: pt.freq,
          power: pt.power,
          adp: pt.area * pt.delay,
          pdp: pt.power * pt.delay,
        });
      }
    }
  }
  const nonCpaSlugs = new Set(['db_carry_save']);
  for (const p of pts) {
    if (nonCpaSlugs.has(p.slug)) {
      p.nonCpa = true;
      p.pareto = false;
    } else {
      p.nonCpa = false;
      p.pareto = !pts.some(o =>
        !nonCpaSlugs.has(o.slug) &&
        o.xVal <= p.xVal && o.yVal <= p.yVal &&
        (o.xVal < p.xVal || o.yVal < p.yVal)
      );
    }
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
  const e = pt.entity;
  const isAdded = selectedCompare.includes(pt.slug);
  const pills = pt.kind === 'classical'
    ? `<span class="pill" style="background:var(--purple-soft);">Classic Design</span>
       ${pt.nonCpa ? '<span class="pill pill-collapsed">3:2 Redundant CSA (Excluded from CPA Pareto)</span>' : ''}
       ${pt.pareto ? `<span class="pill pill-pareto">Pareto-Optimal @ ${selectedWidth}b</span>` : ''}`
    : `<span class="pill ${e.decision === 'novel' ? 'pill-novel' : 'pill-inc'}">${e.decision} (${e.nov_score.toFixed(3)}/5)</span>
       <span class="pill">Joint #${e.joint_rank} (${e.joint_score.toFixed(4)})</span>
       ${pt.pareto ? `<span class="pill pill-pareto">Pareto-Optimal @ ${selectedWidth}b</span>` : ''}
       ${e.collapsed_cla ? '<span class="pill pill-collapsed">ABC Equivalence-Collapsed</span>' : '<span class="pill" style="background:var(--cyan-soft);">Non-Collapsed</span>'}`;

  const dossierLink = pt.kind === 'classical'
    ? `<a class="btn-mini" style="text-decoration:none; color:inherit; background:var(--yellow);" href="design.html?slug=${pt.slug}">Open Classic Dossier &rarr;</a>`
    : '';

  box.style.display = 'flex';
  box.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
      <div>
        <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:6px;">${pills}</div>
        <h3 style="margin:0; font-size:1.1rem;">${pt.kind === 'classical' ? pt.name : `${pt.slug.toUpperCase()}: ${pt.name}`}</h3>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        ${dossierLink}
        <button class="btn-mini ${isAdded ? 'added' : ''}" onclick="toggleCompare('${pt.slug}'); renderBubbleDetail(getPointsForWidth(selectedWidth).find(p => p.slug === '${pt.slug}'));">
          ${isAdded ? 'Added to Compare' : '+ Add to Compare'}
        </button>
      </div>
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
  const normMode = false;
  const w = 780, h = 360, padL = 62, padR = 32, padT = 24, padB = 46;
  const xVals = pts.map(p => p.xVal), yVals = pts.map(p => p.yVal);
  const minX = Math.min(...xVals) * 0.92, maxX = Math.max(...xVals) * 1.05;
  const minY = Math.min(...yVals) * 0.90, maxY = Math.max(...yVals) * 1.06;
  const sx = x => padL + ((x - minX) / Math.max(1e-6, maxX - minX)) * (w - padL - padR);
  const sy = y => h - padB - ((y - minY) / Math.max(1e-6, maxY - minY)) * (h - padT - padB);

  const paretoPts = pts.filter(p => p.pareto).sort((a, b) => a.xVal - b.xVal);
  const poly = paretoPts.map(p => `${sx(p.xVal).toFixed(1)},${sy(p.yVal).toFixed(1)}`).join(' ');

  const circles = pts.map(p => {
    const cx = sx(p.xVal), cy = sy(p.yVal);
    const isSel = p.slug === selectedBubbleSlug;
    let fill = '#22bfd7';
    if (p.pareto) fill = '#ffc83e';
    else if (p.kind === 'classical') fill = '#8275e8';
    else if (p.entity.collapsed_cla) fill = '#f38469';
    const rad = isSel ? 9 : (p.pareto ? 7 : 5);
    const strokeW = isSel ? 3 : 1.5;
    const labelText = p.kind === 'classical' ? p.entity.name : p.slug;
    const label = (p.pareto || isSel) ? `<text x="${cx + 10}" y="${cy + 4}" font-size="11" font-weight="800" font-family="JetBrains Mono">${labelText}</text>` : '';
    return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rad}" fill="${fill}" stroke="#151b20" stroke-width="${strokeW}" style="cursor:pointer;" onclick="selectBubble('${p.slug}')"><title>${labelText}: Area=${p.area} um2, Delay=${p.delay} ns</title></circle>${label}`;
  }).join('');

  const xTicks = [0, 0.5, 1.0].map(f => {
    const val = minX + (maxX - minX) * f;
    const lbl = normMode ? `${val.toFixed(2)}x` : (val >= 10000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0));
    return `<text x="${sx(val).toFixed(1)}" y="${h - padB + 18}" text-anchor="middle" font-size="11" font-family="JetBrains Mono">${lbl}</text>`;
  }).join('');
  const yTicks = [0, 0.5, 1.0].map(f => {
    const val = minY + (maxY - minY) * f;
    const lbl = normMode ? `${val.toFixed(2)}x` : val.toFixed(2);
    return `<text x="${padL - 8}" y="${(sy(val) + 4).toFixed(1)}" text-anchor="end" font-size="11" font-family="JetBrains Mono">${lbl}</text>`;
  }).join('');

  const rcaLines = (normMode && 1.0 >= minX && 1.0 <= maxX && 1.0 >= minY && 1.0 <= maxY)
    ? `<line x1="${sx(1.0).toFixed(1)}" y1="${padT}" x2="${sx(1.0).toFixed(1)}" y2="${h - padB}" stroke="rgba(21,27,32,0.28)" stroke-dasharray="3,3"/>
       <line x1="${padL}" y1="${sy(1.0).toFixed(1)}" x2="${w - padR}" y2="${sy(1.0).toFixed(1)}" stroke="rgba(21,27,32,0.28)" stroke-dasharray="3,3"/>`
    : '';

  document.getElementById('pareto-chart').innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%; max-width:${w}px; height:auto;">
      ${rcaLines}
      <line x1="${padL}" y1="${h - padB}" x2="${w - padR}" y2="${h - padB}" stroke="#151b20" stroke-width="2"/>
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${h - padB}" stroke="#151b20" stroke-width="2"/>
      <polyline points="${poly}" fill="none" stroke="#151b20" stroke-width="2" stroke-dasharray="5,4"/>
      ${xTicks}${yTicks}
      ${circles}
      <text x="${(w + padL - padR) / 2}" y="${h - 8}" text-anchor="middle" font-size="12" font-weight="700">${normMode ? `${selectedWidth}-bit Normalized Area (x RCA)` : `${selectedWidth}-bit Area (&mu;m&sup2;)`}</text>
      <text x="16" y="${(h - padB + padT) / 2}" text-anchor="middle" font-size="12" font-weight="700" transform="rotate(-90 16 ${(h - padB + padT) / 2})">${normMode ? `${selectedWidth}-bit Normalized Delay (x RCA)` : `${selectedWidth}-bit Delay (ns)`}</text>
    </svg>
  `;

  const selPt = pts.find(p => p.slug === selectedBubbleSlug) || paretoPts[0];
  renderBubbleDetail(selPt);
}

document.querySelectorAll('.dataset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.dataset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedDataset = btn.dataset.dataset;
    document.querySelectorAll('.width-btn').forEach(wb => {
      const w = Number(wb.dataset.width);
      if (selectedDataset === 'classical') {
        wb.style.display = '';
      } else {
        wb.style.display = (w === 512) ? 'none' : '';
      }
    });
    if (selectedDataset !== 'classical' && selectedWidth === 512) {
      selectedWidth = 256;
    }
    document.querySelectorAll('.width-btn').forEach(wb => wb.classList.toggle('active', Number(wb.dataset.width) === selectedWidth));
    renderParetoChart();
  });
});

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

  const xLabels = widths.map((wd, i) => `<text x="${sx(i)}" y="${h - pad + 18}" text-anchor="middle" font-size="11" font-family="JetBrains Mono">${wd}b</text>`).join('');

  document.getElementById('scaling-chart').innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%; max-width:${w}px; height:auto;">
      <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="#151b20" stroke-width="2"/>
      <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h - pad}" stroke="#151b20" stroke-width="2"/>
      ${lines}
      ${xLabels}
      <text x="16" y="${h / 2}" text-anchor="middle" font-size="12" font-weight="700" transform="rotate(-90 16 ${h / 2})">Delay (ns)</text>
    </svg>
    <div class="chart-legend">
      <span><span class="legend-dot" style="background:#ffc83e;"></span>idea3 (HGGCBA) — 3.67 ns @ 256b</span>
      <span><span class="legend-dot" style="background:#22bfd7;"></span>idea11 (MECFA) — 5.85 ns @ 256b</span>
      <span><span class="legend-dot" style="background:#f38469;"></span>idea93 (PWCFA) — 8.54 ns @ 256b</span>
    </div>
  `;
}

function renderTaxonomy() {
  const sections = [
    {
      title: '1. Carry-Path & Adder Architecture Primitives',
      accent: 'var(--cyan-soft)',
      blocks: [
        {
          heading: 'Exact Carry-Evaluation Branches (select, ripple, skip, bypass, increment, prefix)',
          goal: 'Provide multiple hardware topologies for evaluating a w_k-bit block so the control policy can trade off propagation depth, multiplexing, and area while preserving bit-exact integer addition.',
          items: [
            '<code>select</code> (Carry-Select): precomputes block sum and carry-out for both <code>Cin=0</code> and <code>Cin=1</code> in parallel, then selects via multiplexer once <code>C_k</code> arrives.',
            '<code>ripple</code> (Ripple-Carry): sequential bit-by-bit recurrence <code>c_{i+1} = g_i | (p_i &amp; c_i)</code>; low-area baseline or fallback path.',
            '<code>skip / bypass</code>: forwards <code>C_{k+1} = C_k</code> directly when full-block propagate <code>P_group = &amp;_i p_i = 1</code> holds, paired with carry-conditioned sum selection.',
            '<code>increment / conditional-sum / prefix</code>: computes a <code>Cin=0</code> sum and conditionally adds <code>+1</code>, recursively merges dual sums, or uses associative prefix trees.',
            '<code>fusion / window / hybrid / rotating</code>: combines multiple carry strategies across fixed/sliding bit windows or cyclically rotates modes by block index <code>k</code>.'
          ]
        }
      ]
    },
    {
      title: '2. Control & Selection Mechanisms',
      accent: 'var(--yellow-soft)',
      blocks: [
        {
          heading: 'Exactness & Policy Contract (exact, policy, deterministic, bounded)',
          goal: 'Guarantee bit-for-bit identical results to A + B + Cin regardless of which branch is selected, while keeping policy decisions repeatable and scores clamped to fixed integer ranges.',
          items: [
            '<strong>Exactness invariant</strong>: every branch computes the exact same Boolean sum and carry-out for <code>(A_k, B_k, C_k)</code>; the <code>policy</code> only selects which topology evaluates block <code>k</code>.',
            '<strong>Deterministic &amp; bounded</strong>: thresholds and counters use integer-only arithmetic so Python models, RTL simulations, and synthesis flows are 100% reproducible.'
          ]
        },
        {
          heading: 'Quorum & Majority Ratio Gating (quorum, majority, voting)',
          goal: 'Trigger a fast carry path when a sufficient fraction of bits in a block agree, using integer cross-multiplication instead of floating-point division.',
          items: [
            '<strong>Quorum</strong>: <code>ones_k * Q_den &gt;= w_k * Q_num</code> on propagate bits routes to carry-skip if true, else carry-select.',
            '<strong>Majority &amp; alternating parity</strong>: checks <code>2 * popcount(p) &gt;= w_k</code> on even blocks (<code>k mod 2 == 0</code>) and edge-generate <code>g_lsb | g_msb</code> on odd blocks.'
          ]
        },
        {
          heading: 'Threshold, Gating & Margin Rules (threshold, gating, gated, margin)',
          goal: 'Gate between fast-path (bypass/skip), speculative (select), and low-area (ripple) modes using width-dependent cutoffs.',
          items: [
            '<strong>Margin-weighted gating</strong>: <code>entropy_score = 2*min(G_cnt, K_cnt) + P_cnt</code>, <code>balance_margin = |G_cnt - K_cnt|</code>, and <code>threshold = w_k + 2 + I(balance_margin &gt;= floor(w_k/2) + 1)</code>.',
            '<strong>Bypass-first stability threshold</strong>: routes to bypass if <code>P_group == 1</code>, else carry-select if <code>score &gt;= w_k + max(1, floor(P_cnt/2))</code>, else ripple.'
          ]
        },
        {
          heading: 'Multi-Branch Competition & Consensus (consensus, adaptive, switching, routing)',
          goal: 'Score each candidate carry path independently and route block k to the winning branch when local indicators align.',
          items: [
            '<strong>Consensus</strong>: <code>consensus = 1</code> when <code>|G_cnt - K_cnt| &lt;= 1</code>.',
            '<strong>Branch competition</strong>: <code>bypass_score = P_cnt + confidence + consensus</code>, <code>select_score = P_cnt + min(G_cnt, K_cnt) + floor(debt/2)</code>, <code>ripple_score = w_k - |G_cnt - K_cnt| + I(debt &gt; 0)</code>.'
          ]
        },
        {
          heading: 'Synthesis Equivalence Collapse (equivalence, collapse)',
          goal: 'Understand how combinational logic synthesis maps multi-branch exact policies to standard cells.',
          items: [
            'Because all candidate branches compute identical Boolean addition functions, Yosys/ABC (<code>abc -liberty Nangate45_typ.lib</code>) detects functional equivalence and collapses redundant scoring/mux networks toward a standard CLA-like netlist unless structural prefix/bypass boundaries are preserved.'
          ]
        }
      ]
    },
    {
      title: '3. Stateful & Temporal Context Signals',
      accent: 'var(--purple-soft)',
      blocks: [
        {
          heading: 'Hysteresis & Sticky Mode Retention (hysteresis, hysteretic)',
          goal: 'Prevent rapid mode chattering across adjacent block boundaries by biasing block k toward retaining the recent mode.',
          items: [
            '<strong>Carry-consistency hysteresis</strong>: sets <code>hysteresis_k = 1</code> when <code>Cin_k == Cin_{k-1}</code>, else <code>0</code>.',
            '<strong>Bounded signed hysteresis</strong>: clamped counter <code>hysteresis in [-3, 4]</code> shifts the block stability score.',
            '<strong>Sticky carry-select</strong>: biases the FSM to remain in carry-select once triggered.'
          ]
        },
        {
          heading: 'Carry Streak & Temporal Stability (streak, temporal)',
          goal: 'Track whether incoming carry C_k is steady or toggling across block boundaries.',
          items: [
            '<strong>Carry streak</strong>: <code>carry_streak in [0, 3]</code> increments when <code>carry == previous_carry</code> and resets to <code>0</code> on a flip.',
            '<strong>Temporal flip vs. stability</strong>: separates <code>temporal_flip_k = (Cin_k != Cin_{k-1})</code> and <code>temporal_stability_k = (Cin_k == Cin_{k-1})</code> weighted alongside <code>floor(score_{k-1}/2)</code>.'
          ]
        },
        {
          heading: 'Momentum, Inertia & Drift (momentum, inertia, drift)',
          goal: 'Propagate smoothed trend/velocity from prior blocks rather than reacting to a single-block snapshot.',
          items: [
            '<strong>Momentum</strong>: <code>score_k = base_score_k + floor(score_{k-1} / 2)</code>.',
            '<strong>Inertia</strong>: 4-tap integer low-pass filter <code>inertia_k = floor((2*inertia_{k-1} + score_{k-1} + score_k) / 4)</code> with clipped confidence in <code>[-4, 4]</code>.',
            '<strong>Drift &amp; derivatives</strong>: first-order <code>delta_k = score_k - score_{k-1}</code> and second-order acceleration <code>accel_k = delta_k - delta_{k-1}</code>.'
          ]
        },
        {
          heading: 'Memory Regulation: Saturation & Leak (memory, saturation, leak)',
          goal: 'Prevent unbounded score growth in 256–512b adders and ensure stale history fades.',
          items: [
            '<strong>Leak</strong>: subtracts <code>leak_k = floor(prev_score_{k-1} / 3)</code> at each block step.',
            '<strong>Saturation</strong>: clamps to fixed width via <code>min(3*w_k + 6, base_score_k + prev_score_{k-1} - leak_k)</code>.'
          ]
        }
      ]
    },
    {
      title: '4. Block-Local Statistical & Information-Theoretic Features',
      accent: 'var(--lime-soft)',
      blocks: [
        {
          heading: 'Bit Counts & Density (popcount, hamming, density)',
          goal: 'Summarize raw P, G, and K activity levels inside a w_k-bit block.',
          items: [
            '<code>P_cnt = sum(p_j)</code>, <code>G_cnt = sum(g_j)</code>, <code>K_cnt = sum(k_j)</code> (Hamming weight / popcount); high <code>P_cnt</code> signals carry-propagation demand while high <code>G_cnt/K_cnt</code> signals local termination.'
          ]
        },
        {
          heading: 'Balance, Polarity & Asymmetry (imbalance, polarity, parity, skew, variance)',
          goal: 'Measure whether a block is dominated by carry generation (G), carry killing (K), or alternating bit patterns.',
          items: [
            '<strong>Imbalance &amp; Polarity</strong>: <code>|G_cnt - K_cnt|</code> magnitude and signed <code>(G_cnt - K_cnt)</code> direction.',
            '<strong>Skew</strong>: weights boundary bits (<code>G_msb</code>, <code>K_lsb</code>) via <code>|(2*G_cnt + G_msb) - (2*K_cnt + K_lsb)| + P_cnt + (k mod 2)</code>.',
            '<strong>Variance</strong>: squared spread <code>(G_cnt - K_cnt)^2 + P_cnt</code> to amplify strong asymmetry.',
            '<strong>Parity</strong>: XOR-reduction or even/odd bit-index balance of propagate bits.'
          ]
        },
        {
          heading: 'Disorder, Transitions & Entropy Proxies (entropy, transition, gradient, divergence)',
          goal: 'Quantify bit-level irregularity and spatial change using integer-only proxies (no logarithms).',
          items: [
            '<strong>Transition count</strong>: adjacent bit flips <code>T_k = sum(p_j ^ p_{j+1})</code>.',
            '<strong>Entropy proxy</strong>: peaks on mixed patterns, e.g., <code>min(P_cnt, w_k - P_cnt)</code> or <code>2*min(G_cnt, K_cnt) + P_cnt</code>.',
            '<strong>Gradient</strong>: half-block spatial shift <code>|G_cnt - K_cnt| + T_cnt + |F_load - B_load|</code>.'
          ]
        },
        {
          heading: 'Contiguous Runs & Boundary Spans (run-length, span, pressure)',
          goal: 'Detect contiguous chains of P=1 bits where carries travel across most or all of a block.',
          items: [
            '<strong>Run-length</strong>: longest contiguous <code>1</code>-run (<code>L1_k</code>) and <code>0</code>-run (<code>L0_k</code>) in <code>p</code>.',
            '<strong>Edge-propagate span</strong>: <code>span_score = prefix_span + suffix_span</code> anchored at LSB/MSB boundaries.'
          ]
        },
        {
          heading: 'Composite Scores & Alignment (stability, confidence, certainty, signature, phase, resonance, corridor)',
          goal: 'Combine local features and bounded state into a single integer score for Stage 2 routing.',
          items: [
            '<strong>Stability</strong>: <code>span_score + |G_cnt - K_cnt| + carry_streak + hysteresis</code>.',
            '<strong>Phase &amp; Resonance</strong>: carry-flip alignment <code>phase_match_k</code> and bounded accumulator <code>phase_acc_k in [-7, 7]</code>.',
            '<strong>Corridor</strong>: <code>entropy_proxy + skew_gap + |corridor_memory|</code> with memory bounded in <code>[-7, 7]</code>.'
          ]
        }
      ]
    }
  ];

  document.getElementById('kw-grid').style.gridTemplateColumns = '1fr';
  document.getElementById('kw-grid').innerHTML = sections.map(sec => `
    <div class="section-card" style="margin-bottom:0; background:var(--paper);">
      <h3 style="margin:0 0 14px; font-size:1.15rem; padding:6px 12px; background:${sec.accent}; border:2px solid var(--ink); border-radius:8px; display:inline-block;">${sec.title}</h3>
      <div style="display:flex; flex-direction:column; gap:12px;">
        ${sec.blocks.map(b => `
          <div class="kw-card" style="background:var(--cream);">
            <h4 style="margin:0 0 6px; font-size:0.95rem;">${b.heading}</h4>
            <p style="margin:0 0 8px; font-size:0.83rem; color:rgba(21,27,32,0.82);"><strong>Goal:</strong> ${b.goal}</p>
            <ul style="margin:0; padding-left:18px; display:flex; flex-direction:column; gap:6px; font-size:0.82rem;">
              ${b.items.map(it => `<li>${it}</li>`).join('')}
            </ul>
          </div>
        `).join('')}
      </div>
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
