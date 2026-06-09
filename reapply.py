import re

with open('index.html', 'r') as f:
    content = f.read()

# 1. Saldo Livre Calculation
search_saldo = r"""
  // Balance
  const saldo = salario - totalGeral;
  const pill = \$\('balancePill'\);
  if \(salario === 0\) \{
    pill.textContent = t\('noSalary'\);
    pill.style.background = 'rgba\(245,158,11,0.2\)';
  \} else if \(saldo >= 0\) \{
    pill.textContent = t\('balanceFmt', fmtMoney\(saldo\)\);
    pill.style.background = 'rgba\(16,185,129,0.2\)';
  \} else \{
    pill.textContent = t\('deficitFmt', fmtMoney\(Math.abs\(saldo\)\)\);
    pill.style.background = 'rgba\(239,68,68,0.2\)';
  \}
"""

replace_saldo = """
  // Balance
  const saldo = salario - totalGeral;

  // Calculate accumulated balance (past history + current month investments + current month saldo)
  const pastAccumulated = d.historico.reduce((acc, h) => acc + safeNum(h.sobra) + safeNum(h.totalInvest), 0);
  const currentAccumulated = pastAccumulated + saldo + totalInvest;

  const pill = $('balancePill');
  if (salario === 0) {
    pill.textContent = t('noSalary');
    pill.style.background = 'rgba(245,158,11,0.2)';
  } else if (currentAccumulated >= 0) {
    pill.textContent = t('balanceFmt', fmtMoney(currentAccumulated));
    pill.style.background = 'rgba(16,185,129,0.2)';
  } else {
    pill.textContent = t('deficitFmt', fmtMoney(Math.abs(currentAccumulated)));
    pill.style.background = 'rgba(239,68,68,0.2)';
  }
"""
content = re.sub(search_saldo.strip(), replace_saldo.strip(), content, count=1)

# 2. Fractions UI
content = content.replace("""        <div class="budget-card-meta">
          Limite<strong id="meta-lazer">$600</strong>
        </div>
      </div>""", """        <div class="budget-card-meta">
          Limite<strong id="meta-lazer">$600</strong>
        </div>
      </div>
      <div class="fractions-container" id="fracoes-lazer" style="padding: 10px 18px; border-bottom: 1px solid var(--border);">
        <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:8px;text-transform:uppercase;display:flex;justify-content:space-between;align-items:center;">
          <span>Divisão da Meta</span>
          <select class="fraction-select" onchange="setFraction('lazer', this.value)" style="font-size:11px;padding:2px 4px;border:1px solid var(--border);border-radius:4px;background:var(--surface);">
            <option value="1">1 Parte (Sem divisão)</option>
            <option value="2">2 Partes</option>
            <option value="3">3 Partes</option>
            <option value="4">4 Partes</option>
          </select>
        </div>
        <div id="fracoes-lazer-list"></div>
      </div>""")

content = content.replace("""        <div class="budget-card-meta">
          Meta mínima<strong id="meta-invest">$400</strong>
        </div>
      </div>""", """        <div class="budget-card-meta">
          Meta mínima<strong id="meta-invest">$400</strong>
        </div>
      </div>
      <div class="fractions-container" id="fracoes-invest" style="padding: 10px 18px; border-bottom: 1px solid var(--border);">
        <div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:8px;text-transform:uppercase;display:flex;justify-content:space-between;align-items:center;">
          <span>Divisão da Meta</span>
          <select class="fraction-select" onchange="setFraction('invest', this.value)" style="font-size:11px;padding:2px 4px;border:1px solid var(--border);border-radius:4px;background:var(--surface);">
            <option value="1">1 Parte (Sem divisão)</option>
            <option value="2">2 Partes</option>
            <option value="3">3 Partes</option>
            <option value="4">4 Partes</option>
          </select>
        </div>
        <div id="fracoes-invest-list"></div>
      </div>""")


# 3. Fractions script
search_get_data = "return JSON.parse(localStorage.getItem('cvData_v4') || '{\"historico\":[],\"sonhos\":[],\"items\":{}}');"
replace_get_data = """  let d = JSON.parse(localStorage.getItem('cvData_v4') || '{"historico":[],"sonhos":[],"items":{}}');
  if (!d.config) d.config = {};
  if (!d.config.fracoes) d.config.fracoes = { lazer: { partes: 1, nomes: [], checks: [] }, invest: { partes: 1, nomes: [], checks: [] } };
  return d;"""
content = content.replace(search_get_data, replace_get_data)

search_save_items = """  d.config = {
    salario: $('salario').value,
    pctFixo: $('pctFixo').value,
    pctInvest: $('pctInvest').value,
    mode: mode
  };"""
replace_save_items = """  if(!d.config) d.config = {};
  d.config.salario = $('salario').value;
  d.config.pctFixo = $('pctFixo').value;
  d.config.pctInvest = $('pctInvest').value;
  d.config.mode = mode;"""
content = content.replace(search_save_items, replace_save_items)

code_fractions = """
// ═══════════════════════════════════════════════════════
//  FRACTIONS
// ═══════════════════════════════════════════════════════
function setFraction(cat, parts) {
  const d = getData();
  if(!d.config.fracoes) d.config.fracoes = { lazer: { partes: 1, nomes: [], checks: [] }, invest: { partes: 1, nomes: [], checks: [] } };
  d.config.fracoes[cat].partes = parseInt(parts);
  saveData(d);
  calcularTudo();
}

function saveFractionName(cat, idx, val) {
  const d = getData();
  if(!d.config.fracoes) d.config.fracoes = { lazer: { partes: 1, nomes: [], checks: [] }, invest: { partes: 1, nomes: [], checks: [] } };
  d.config.fracoes[cat].nomes[idx] = val;
  saveData(d);
}

function toggleFractionCheck(cat, idx, isChecked) {
  const d = getData();
  if(!d.config.fracoes) d.config.fracoes = { lazer: { partes: 1, nomes: [], checks: [] }, invest: { partes: 1, nomes: [], checks: [] } };
  d.config.fracoes[cat].checks[idx] = isChecked;
  saveData(d);
}

function renderFractions(cat, totalMeta) {
  const d = getData();
  if(!d.config.fracoes) d.config.fracoes = { lazer: { partes: 1, nomes: [], checks: [] }, invest: { partes: 1, nomes: [], checks: [] } };
  const fracoes = d.config.fracoes[cat];
  const select = document.querySelector(`#fracoes-${cat} .fraction-select`);
  if (select) select.value = fracoes.partes;

  const list = $(`fracoes-${cat}-list`);
  if (!list) return;

  if (fracoes.partes <= 1) {
    list.innerHTML = '';
    return;
  }

  const fractionValue = totalMeta / fracoes.partes;
  let html = '';
  for (let i = 0; i < fracoes.partes; i++) {
    const nome = escapeHTML(fracoes.nomes[i] || `Parte ${i + 1}`);
    const isChecked = fracoes.checks[i] ? 'checked' : '';
    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; padding-bottom:6px;">
        <div style="display:flex; align-items:center; gap: 8px; flex: 1;">
          <input type="checkbox" onchange="toggleFractionCheck('${cat}', ${i}, this.checked)" ${isChecked} style="accent-color:var(--primary); width: 14px; height: 14px; cursor: pointer;">
          <input type="text" value="${nome}" oninput="saveFractionName('${cat}', ${i}, this.value)" placeholder="Nome da parte..." style="font-size:12px; padding:4px 6px; border:1px solid var(--border); border-radius:4px; width:100%; max-width: 200px; background:var(--surface); color:var(--text);">
        </div>
        <span style="font-size:12px; font-weight:bold; color:var(--text);">${fmtMoney(fractionValue)}</span>
      </div>
    `;
  }
  list.innerHTML = html;
}
"""

content = content.replace('// ═══════════════════════════════════════════════════════\n//  SUB-TAB NAVIGATION', code_fractions + '\n// ═══════════════════════════════════════════════════════\n//  SUB-TAB NAVIGATION')

search_calcular = """    $('pctInvestSym').textContent = '$';
  }

  // Distribution bar"""
replace_calcular = """    $('pctInvestSym').textContent = '$';
  }

  // Fractions
  renderFractions('lazer', mLazer);
  renderFractions('invest', mInvest);

  // Distribution bar"""
content = content.replace(search_calcular, replace_calcular)

escape_html_def = """const safeNum = v => { let n = parseFloat(String(v||0).replace(',','.')); return isNaN(n) ? 0 : n; };
const escapeHTML = str => String(str).replace(/[&<>'"]/g, tag => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
}[tag]));
"""
content = content.replace("const safeNum = v => { let n = parseFloat(String(v||0).replace(',','.')); return isNaN(n) ? 0 : n; };\n", escape_html_def)

# 4. Plano Button Nav
content = content.replace("/* Bottom nav 3 items */\n.bottom-nav { display: grid; grid-template-columns: repeat(3, 1fr); }", "/* Bottom nav 4 items */\n.bottom-nav { display: grid; grid-template-columns: repeat(4, 1fr); }")

search_html = """<!-- ═══════════════════════════════════
     BOTTOM NAV
═══════════════════════════════════ -->
<nav class="bottom-nav">
  <button class="nav-item active" id="nav-orcamento" onclick="switchPage('orcamento')">
    <span class="nav-icon">💰</span>Orçamento
  </button>
  <button class="nav-item" id="nav-ebook" onclick="goToEbook()">
    <span class="nav-icon">📚</span>Ebook
  </button>
  <button class="nav-item" id="nav-historico" onclick="switchPage('historico')">
    <span class="nav-icon">📅</span>Histórico
  </button>
</nav>"""
replace_html = """<!-- ═══════════════════════════════════
     BOTTOM NAV
═══════════════════════════════════ -->
<nav class="bottom-nav">
  <button class="nav-item active" id="nav-orcamento" onclick="switchPage('orcamento')">
    <span class="nav-icon">💰</span>Orçamento
  </button>
  <button class="nav-item" id="nav-ebook" onclick="goToEbook()">
    <span class="nav-icon">📚</span>Ebook
  </button>
  <button class="nav-item" id="nav-historico" onclick="switchPage('historico')">
    <span class="nav-icon">📅</span>Histórico
  </button>
  <button class="nav-item" id="nav-plano">
    <span class="nav-icon">📈</span>Plano
  </button>
</nav>"""
content = content.replace(search_html, replace_html)

search_apply = """  // nav
  const navItems = document.querySelectorAll('.nav-item');
  if (navItems[0]) navItems[0].lastChild.textContent = L.navOrcamento;
  if (navItems[1]) navItems[1].lastChild.textContent = L.navEbook;
  if (navItems[2]) navItems[2].lastChild.textContent = L.navHistorico;
  // ebook"""
replace_apply = """  // nav
  const navItems = document.querySelectorAll('.nav-item');
  if (navItems[0]) navItems[0].lastChild.textContent = L.navOrcamento;
  if (navItems[1]) navItems[1].lastChild.textContent = L.navEbook;
  if (navItems[2]) navItems[2].lastChild.textContent = L.navHistorico;
  if (navItems[3]) navItems[3].lastChild.textContent = L.navPlano;
  // ebook"""
content = content.replace(search_apply, replace_apply)

search_pt = """    // nav
    navOrcamento: 'Orçamento',
    navEbook: 'Ebook',
    navHistorico: 'Histórico',
    // ebook"""
replace_pt = """    // nav
    navOrcamento: 'Orçamento',
    navEbook: 'Ebook',
    navHistorico: 'Histórico',
    navPlano: 'Plano',
    // ebook"""
content = content.replace(search_pt, replace_pt)

search_es = """    navOrcamento: 'Presupuesto',
    navEbook: 'Ebook',
    navHistorico: 'Historial',
    ebookBadge: '📚 Ebook Exclusivo Incluido',"""
replace_es = """    navOrcamento: 'Presupuesto',
    navEbook: 'Ebook',
    navHistorico: 'Historial',
    navPlano: 'Plan',
    ebookBadge: '📚 Ebook Exclusivo Incluido',"""
content = content.replace(search_es, replace_es)

search_en = """    navOrcamento: 'Budget',
    navEbook: 'Ebook',
    navHistorico: 'History',
    ebookBadge: '📚 Exclusive Ebook Included',"""
replace_en = """    navOrcamento: 'Budget',
    navEbook: 'Ebook',
    navHistorico: 'History',
    navPlano: 'Plan',
    ebookBadge: '📚 Exclusive Ebook Included',"""
content = content.replace(search_en, replace_en)


with open('index.html', 'w') as f:
    f.write(content)
