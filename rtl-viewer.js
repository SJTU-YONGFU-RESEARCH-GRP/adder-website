/* Shared Verilog / SystemVerilog RTL Viewer for design.html and idea.html */

(function () {
  const KEYWORDS = new Set([
    'module', 'endmodule', 'input', 'output', 'inout', 'wire', 'reg', 'logic',
    'parameter', 'localparam', 'assign', 'always', 'always_comb', 'always_ff',
    'begin', 'end', 'if', 'else', 'for', 'case', 'endcase', 'default',
    'generate', 'endgenerate', 'genvar', 'function', 'endfunction',
    'integer', 'signed', 'unsigned', 'posedge', 'negedge', 'or'
  ]);

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function highlightVerilogLine(line) {
    // Tokenize comments, strings, preprocessor, numbers, and identifiers safely.
    const tokenRe = /(\/\/.*$|\/\*.*?\*\/|"(?:\\.|[^"])*"|`[A-Za-z_]\w*|\b\d*'[bBoOdDhH][0-9a-fA-FxXzZ_]+\b|\b\d+\b|\b[A-Za-z_]\w*\b)/g;
    let out = '';
    let last = 0;
    let m;
    while ((m = tokenRe.exec(line)) !== null) {
      if (m.index > last) {
        out += escHtml(line.slice(last, m.index));
      }
      const tok = m[0];
      if (tok.startsWith('//') || tok.startsWith('/*')) {
        out += `<span class="rtl-tok-comment">${escHtml(tok)}</span>`;
      } else if (tok.startsWith('"')) {
        out += `<span class="rtl-tok-str">${escHtml(tok)}</span>`;
      } else if (tok.startsWith('`')) {
        out += `<span class="rtl-tok-pre">${escHtml(tok)}</span>`;
      } else if (/^\d*'[bBoOdDhH]/.test(tok) || /^\d+$/.test(tok)) {
        out += `<span class="rtl-tok-num">${escHtml(tok)}</span>`;
      } else if (KEYWORDS.has(tok)) {
        out += `<span class="rtl-tok-kw">${escHtml(tok)}</span>`;
      } else {
        out += escHtml(tok);
      }
      last = tokenRe.lastIndex;
    }
    if (last < line.length) {
      out += escHtml(line.slice(last));
    }
    return out;
  }

  function highlightVerilog(code) {
    const lines = code.replace(/\r\n/g, '\n').split('\n');
    let inBlockComment = false;
    return lines.map((line, idx) => {
      let rendered;
      if (inBlockComment) {
        const endIdx = line.indexOf('*/');
        if (endIdx === -1) {
          rendered = `<span class="rtl-tok-comment">${escHtml(line)}</span>`;
        } else {
          const head = line.slice(0, endIdx + 2);
          const tail = line.slice(endIdx + 2);
          inBlockComment = false;
          rendered = `<span class="rtl-tok-comment">${escHtml(head)}</span>${highlightVerilogLine(tail)}`;
        }
      } else {
        const startIdx = line.indexOf('/*');
        const lineCommentIdx = line.indexOf('//');
        if (startIdx !== -1 && (lineCommentIdx === -1 || startIdx < lineCommentIdx)) {
          const endIdx = line.indexOf('*/', startIdx + 2);
          if (endIdx === -1) {
            inBlockComment = true;
            const head = line.slice(0, startIdx);
            const tail = line.slice(startIdx);
            rendered = `${highlightVerilogLine(head)}<span class="rtl-tok-comment">${escHtml(tail)}</span>`;
          } else {
            rendered = highlightVerilogLine(line);
          }
        } else {
          rendered = highlightVerilogLine(line);
        }
      }
      return `<div class="rtl-line"><span class="rtl-ln">${idx + 1}</span><span class="rtl-code">${rendered || ' '}</span></div>`;
    }).join('');
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  window.renderRtlSection = async function renderRtlSection(containerId, slug) {
    const host = document.getElementById(containerId);
    if (!host) return;
    try {
      const res = await fetch('rtl.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rtlMap = await res.json();
      const entry = rtlMap[slug];
      if (!entry || !entry.code) {
        host.innerHTML = `
          <h2>RTL Source Code (Verilog)</h2>
          <p class="section-sub" style="margin-bottom:0;">No RTL source available for <code>${escHtml(slug)}</code>.</p>
        `;
        return;
      }

      const isLong = entry.lines > 36;
      host.innerHTML = `
        <div class="rtl-header">
          <div>
            <h2 style="margin:0;">RTL Source Code (Verilog)</h2>
            <div class="rtl-meta">
              <span class="pill" style="background:var(--cyan-soft);">${escHtml(entry.filename)}</span>
              <span class="pill">${entry.lines} lines &middot; ${formatBytes(entry.bytes)}</span>
            </div>
          </div>
          <div class="rtl-actions">
            ${isLong ? `<button id="rtl-toggle-btn" class="btn-mini" type="button">Expand Full Code</button>` : ''}
            <button id="rtl-copy-btn" class="btn-mini" type="button" style="background:var(--yellow);">Copy RTL</button>
            <button id="rtl-download-btn" class="btn-mini" type="button" style="background:var(--lime);">Download ${escHtml(entry.filename)}</button>
          </div>
        </div>
        <div id="rtl-viewer" class="rtl-viewer${isLong ? ' collapsed' : ''}" role="region" aria-label="Verilog RTL source code">
          <pre class="rtl-pre">${highlightVerilog(entry.code)}</pre>
        </div>
      `;

      const copyBtn = document.getElementById('rtl-copy-btn');
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(entry.code);
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy RTL'; }, 1600);
        } catch (_) {
          copyBtn.textContent = 'Copy Failed';
          setTimeout(() => { copyBtn.textContent = 'Copy RTL'; }, 1600);
        }
      });

      const dlBtn = document.getElementById('rtl-download-btn');
      dlBtn.addEventListener('click', () => {
        const blob = new Blob([entry.code], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = entry.filename;
        a.click();
        URL.revokeObjectURL(url);
      });

      const toggleBtn = document.getElementById('rtl-toggle-btn');
      const viewer = document.getElementById('rtl-viewer');
      if (toggleBtn && viewer) {
        toggleBtn.addEventListener('click', () => {
          const collapsed = viewer.classList.toggle('collapsed');
          toggleBtn.textContent = collapsed ? 'Expand Full Code' : 'Collapse';
        });
      }
    } catch (err) {
      host.innerHTML = `
        <h2>RTL Source Code (Verilog)</h2>
        <p class="section-sub" style="margin-bottom:0;">Failed to load RTL source (${escHtml(err.message)}).</p>
      `;
    }
  };
})();
