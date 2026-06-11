// ═══════════════════════════════════════════════════════════════
//  AUTH.JS — Camada de Autenticação & Sincronização Firebase
//  Calculadora da Virada
//
//  O que este ficheiro faz:
//  1. Inicializa Firebase com as credenciais de firebase-config.js
//  2. Mostra o ecrã de login/registo antes da app carregar
//  3. No primeiro login, migra automaticamente os dados do localStorage
//  4. Substitui getData()/save() por versões que lêem/escrevem no Firestore
//  5. Sincroniza em tempo real entre dispositivos do mesmo utilizador
//  6. Mantém fallback offline: se sem internet, usa localStorage temporário
// ═══════════════════════════════════════════════════════════════

import { initializeApp }                          from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword,
         signInWithEmailAndPassword, signOut,
         onAuthStateChanged, sendPasswordResetEmail,
         updateProfile }                          from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc,
         onSnapshot, serverTimestamp }            from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── Inicialização ────────────────────────────────────────────────
const app  = initializeApp(FIREBASE_CONFIG); // vem de firebase-config.js
const auth = getAuth(app);
const db   = getFirestore(app);

// ── Estado global ─────────────────────────────────────────────────
let currentUser    = null;
let firestoreUnsub = null; // listener em tempo real
let _pendingSave   = null; // debounce de escritas
let _offlineMode   = false;

// ════════════════════════════════════════════════════════════════
//  CAMADA DE DADOS — substitui getData() e save() do index.html
// ════════════════════════════════════════════════════════════════

// getData() — lê do localStorage (sempre disponível e síncrono)
// A escrita vai ao Firestore + localStorage em paralelo
window._cvDataKey = () => currentUser ? `cvD6_${currentUser.uid}` : 'cvD6';

const _origGetData = window.getData;
window.getData = function () {
  const key = window._cvDataKey();
  let d = JSON.parse(localStorage.getItem(key) || '{}');
  // defaults (idênticos ao index.html original)
  if (!d.items)     d.items     = {};
  if (!d.sonhos)    d.sonhos    = [];
  if (!d.hist)      d.hist      = [];
  if (!d.cfg)       d.cfg       = {};
  if (!d.wallet)    d.wallet    = [];
  if (!d.fracs)     d.fracs     = { lazer:{n:0,names:[]}, invest:{n:0,names:[]} };
  if (!d.parcelados) d.parcelados = [];
  return d;
};

window.save = function (d) {
  const key = window._cvDataKey();
  // 1. Guarda sempre no localStorage (instantâneo, offline-safe)
  localStorage.setItem(key, JSON.stringify(d));

  // 2. Debounce Firestore — evita escrever a cada keystroke
  if (!currentUser || _offlineMode) return;
  clearTimeout(_pendingSave);
  _pendingSave = setTimeout(() => _writeFirestore(d), 800);
};

async function _writeFirestore(d) {
  if (!currentUser) return;
  try {
    await setDoc(
      doc(db, 'users', currentUser.uid, 'data', 'main'),
      { ...d, _updatedAt: serverTimestamp() }
    );
  } catch (err) {
    console.warn('[Firebase] Erro ao guardar:', err.message);
    _offlineMode = true;
    setTimeout(() => { _offlineMode = false; }, 30000); // retry em 30s
  }
}

// ════════════════════════════════════════════════════════════════
//  MIGRAÇÃO — localStorage → Firestore no primeiro login
// ════════════════════════════════════════════════════════════════
async function migrateLocalToFirestore(uid) {
  // Verifica se já existe data no Firestore
  const ref  = doc(db, 'users', uid, 'data', 'main');
  const snap = await getDoc(ref);

  if (snap.exists() && snap.data()._migratedAt) {
    // já migrado — só sincroniza para o localStorage local
    const cloudData = snap.data();
    delete cloudData._updatedAt;
    localStorage.setItem(`cvD6_${uid}`, JSON.stringify(cloudData));
    console.info('[Migração] Dados já na nuvem — sincronizados localmente.');
    return;
  }

  // Procura dados locais para migrar (chave genérica sem uid)
  const localRaw = localStorage.getItem('cvD6');
  if (!localRaw) {
    console.info('[Migração] Sem dados locais para migrar.');
    return;
  }

  try {
    const localData = JSON.parse(localRaw);
    // Só migra se houver conteúdo real
    const hasContent =
      (localData.hist && localData.hist.length > 0) ||
      (localData.sonhos && localData.sonhos.length > 0) ||
      (localData.items && Object.values(localData.items).some(a => a.length > 0)) ||
      (localData.cfg && localData.cfg.salario);

    if (!hasContent) {
      console.info('[Migração] Dados locais vazios — nada a migrar.');
      return;
    }

    localData._migratedAt  = new Date().toISOString();
    localData._migratedFrom = 'localStorage';

    await setDoc(ref, { ...localData, _updatedAt: serverTimestamp() });

    // Copia para a chave com uid (a usada daqui para a frente)
    localStorage.setItem(`cvD6_${uid}`, localRaw);
    // Remove a chave genérica para não confundir
    localStorage.removeItem('cvD6');

    console.info('[Migração] ✅ Dados migrados para o Firestore com sucesso!');
    showToastAuth('☁️ Os teus dados foram sincronizados com a nuvem!');
  } catch (err) {
    console.error('[Migração] Erro:', err);
  }
}

// ════════════════════════════════════════════════════════════════
//  LISTENER EM TEMPO REAL — sincroniza entre dispositivos
// ════════════════════════════════════════════════════════════════
function startRealtimeSync(uid) {
  if (firestoreUnsub) firestoreUnsub(); // cancela listener anterior

  const ref = doc(db, 'users', uid, 'data', 'main');
  firestoreUnsub = onSnapshot(ref, (snap) => {
    if (!snap.exists()) return;
    const cloudData = snap.data();
    delete cloudData._updatedAt;
    delete cloudData._migratedAt;
    delete cloudData._migratedFrom;

    // Só actualiza se a alteração veio de outro dispositivo
    // (evita loop: escrita local → onSnapshot → re-escrita)
    const localRaw = localStorage.getItem(`cvD6_${uid}`);
    const cloudStr = JSON.stringify(cloudData);
    if (localRaw !== cloudStr) {
      localStorage.setItem(`cvD6_${uid}`, cloudStr);
      // Re-renderiza a UI com os novos dados
      if (typeof calcularTudo === 'function') calcularTudo();
      if (typeof renderDreams === 'function') renderDreams();
      if (typeof renderWallet === 'function') renderWallet();
      if (typeof renderHistory === 'function' && currentPage === 'historico') renderHistory();
    }
  }, (err) => {
    console.warn('[Firebase] Listener erro:', err.message);
  });
}

// ════════════════════════════════════════════════════════════════
//  AUTH STATE — o que acontece quando o utilizador faz login/logout
// ════════════════════════════════════════════════════════════════
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    updateUserBar(user);
    hideAuthScreen();

    // Migra dados locais → Firestore (só se necessário)
    await migrateLocalToFirestore(user.uid);
    // Update last login timestamp in public profile
    try {
      await setDoc(doc(db, 'users_public', user.uid), {
        uid:         user.uid,
        email:       user.email || '',
        displayName: user.displayName || '',
        lastLoginAt: serverTimestamp(),
      }, { merge: true }); // merge: true keeps existing fields like registeredAt
    } catch(e) { console.warn('[Profile] update failed:', e.message); }

    // Inicia sincronização em tempo real
    startRealtimeSync(user.uid);

    // Inicializa a app (chama o onload do index.html)
    if (typeof window._appInit === 'function') {
      window._appInit();
    } else {
      // fallback: se a app já carregou, só recalcula
      if (typeof calcularTudo === 'function') calcularTudo();
    }
  } else {
    currentUser = null;
    if (firestoreUnsub) { firestoreUnsub(); firestoreUnsub = null; }
    showAuthScreen();
  }
});

// ════════════════════════════════════════════════════════════════
//  FUNÇÕES DE AUTENTICAÇÃO (chamadas pelo HTML do ecrã de login)
// ════════════════════════════════════════════════════════════════
window.authRegister = async function () {
  const name  = document.getElementById('auth-name')?.value.trim();
  const email = document.getElementById('auth-email').value.trim();
  const pass  = document.getElementById('auth-pass').value;
  const pass2 = document.getElementById('auth-pass2')?.value;
  clearAuthError();

  if (!email || !pass) return showAuthError('Preenche o email e a senha.');
  if (pass.length < 6)  return showAuthError('A senha deve ter pelo menos 6 caracteres.');
  if (pass2 && pass !== pass2) return showAuthError('As senhas não coincidem.');

  setAuthLoading(true);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (name) await updateProfile(cred.user, { displayName: name });
    // Save public profile (name + email) to Firestore — readable by admin
    await setDoc(doc(db, 'users_public', cred.user.uid), {
      uid:          cred.user.uid,
      email:        email,
      displayName:  name || '',
      registeredAt: serverTimestamp(),
      lastLoginAt:  serverTimestamp(),
    });
  } catch (err) {
    showAuthError(firebaseErrMsg(err.code));
  } finally {
    setAuthLoading(false);
  }
};

window.authLogin = async function () {
  const email = document.getElementById('auth-email').value.trim();
  const pass  = document.getElementById('auth-pass').value;
  clearAuthError();

  if (!email || !pass) return showAuthError('Preenche o email e a senha.');

  setAuthLoading(true);
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    showAuthError(firebaseErrMsg(err.code));
  } finally {
    setAuthLoading(false);
  }
};

window.authLogout = async function () {
  if (!confirm('Tens a certeza que queres sair?')) return;
  await signOut(auth);
  showToastAuth('Sessão terminada.');
};

window.authResetPassword = async function () {
  const email = document.getElementById('auth-email')?.value.trim()
             || prompt('Indica o teu email para recuperar a senha:');
  if (!email) return;
  try {
    await sendPasswordResetEmail(auth, email);
    showAuthError('✅ Email de recuperação enviado! Verifica a caixa de entrada.', 'ok');
  } catch (err) {
    showAuthError(firebaseErrMsg(err.code));
  }
};

// ── Mensagens de erro em português ──
function firebaseErrMsg(code) {
  const msgs = {
    'auth/email-already-in-use':    'Este email já está registado.',
    'auth/invalid-email':           'Email inválido.',
    'auth/user-not-found':          'Utilizador não encontrado.',
    'auth/wrong-password':          'Senha incorrecta.',
    'auth/invalid-credential':      'Email ou senha incorrectos.',
    'auth/too-many-requests':       'Muitas tentativas. Tenta mais tarde.',
    'auth/network-request-failed':  'Sem ligação à internet.',
    'auth/weak-password':           'Senha demasiado fraca (mínimo 6 caracteres).',
    'auth/popup-closed-by-user':    'Login cancelado.',
  };
  return msgs[code] || `Erro: ${code}`;
}

// ════════════════════════════════════════════════════════════════
//  UI HELPERS
// ════════════════════════════════════════════════════════════════
function showAuthScreen()  { const el = document.getElementById('auth-screen');  if (el) el.style.display = 'flex'; }
function hideAuthScreen()  { const el = document.getElementById('auth-screen');  if (el) el.style.display = 'none'; }
function showAuthError(msg, type='error') {
  const el = document.getElementById('auth-error');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  el.style.background = type === 'ok' ? '#d1fae5' : '#fee2e2';
  el.style.color      = type === 'ok' ? '#059669' : '#dc2626';
  el.style.borderColor= type === 'ok' ? '#6ee7b7' : '#fca5a5';
}
function clearAuthError() { const el = document.getElementById('auth-error'); if (el) el.style.display = 'none'; }
function setAuthLoading(on) {
  const btn = document.getElementById('auth-submit-btn');
  if (!btn) return;
  btn.disabled    = on;
  btn.textContent = on ? '...' : btn.dataset.label;
}
function updateUserBar(user) {
  const bar = document.getElementById('user-bar');
  if (!bar) return;
  bar.style.display = 'flex';
  const nameEl  = document.getElementById('user-bar-name');
  const emailEl = document.getElementById('user-bar-email');
  if (nameEl)  nameEl.textContent  = user.displayName || '👤';
  if (emailEl) emailEl.textContent = user.email;
}
function showToastAuth(msg) {
  if (typeof showToast === 'function') { showToast(msg); return; }
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;padding:10px 20px;border-radius:100px;font-size:13px;font-weight:700;z-index:9999;';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// Troca entre formulário de login e registo
window.authSwitchMode = function (mode) {
  const nameRow  = document.getElementById('auth-name-row');
  const pass2Row = document.getElementById('auth-pass2-row');
  const title    = document.getElementById('auth-title');
  const sub      = document.getElementById('auth-subtitle');
  const btn      = document.getElementById('auth-submit-btn');
  const linkRow  = document.getElementById('auth-link-row');
  const resetRow = document.getElementById('auth-reset-row');
  clearAuthError();

  if (mode === 'register') {
    if (nameRow)  nameRow.style.display  = 'block';
    if (pass2Row) pass2Row.style.display = 'block';
    if (resetRow) resetRow.style.display = 'none';
    if (title)    title.textContent      = 'Criar conta';
    if (sub)      sub.textContent        = 'Junta-te à Calculadora da Virada';
    if (btn)    { btn.textContent = 'Criar conta'; btn.dataset.label = 'Criar conta'; btn.onclick = window.authRegister; }
    if (linkRow)  linkRow.innerHTML      = 'Já tens conta? <span onclick="authSwitchMode(\'login\')" style="color:#6d28d9;font-weight:700;cursor:pointer;">Entrar</span>';
  } else {
    if (nameRow)  nameRow.style.display  = 'none';
    if (pass2Row) pass2Row.style.display = 'none';
    if (resetRow) resetRow.style.display = 'block';
    if (title)    title.textContent      = 'Entrar';
    if (sub)      sub.textContent        = 'A tua conta Calculadora da Virada';
    if (btn)    { btn.textContent = 'Entrar'; btn.dataset.label = 'Entrar'; btn.onclick = window.authLogin; }
    if (linkRow)  linkRow.innerHTML      = 'Não tens conta? <span onclick="authSwitchMode(\'register\')" style="color:#6d28d9;font-weight:700;cursor:pointer;">Criar agora</span>';
  }
};

// Enter key nos inputs
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const screen = document.getElementById('auth-screen');
  if (!screen || screen.style.display === 'none') return;
  const btn = document.getElementById('auth-submit-btn');
  if (btn && !btn.disabled) btn.click();
});
