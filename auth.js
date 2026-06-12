// ═══════════════════════════════════════════════════════════════
//  AUTH.JS — Autenticação Firebase + Sincronização Firestore
//  Mente Próspera · Controle Financeiro
// ═══════════════════════════════════════════════════════════════

import { initializeApp }                          from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword,
         signInWithEmailAndPassword, signOut,
         onAuthStateChanged, sendPasswordResetEmail,
         updateProfile }                          from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc,
         onSnapshot, serverTimestamp }            from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── Os ebooks não usam auth — sai imediatamente se não for o index ──
const isIndex = document.getElementById('auth-screen') !== null;
if (!isIndex) {
  // ficheiro ebook ou outro — não faz nada
  throw new Error('[Auth] Não é o index.html — auth ignorado.');
}

// ── Inicialização ────────────────────────────────────────────────
const app  = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── Estado global ─────────────────────────────────────────────────
let currentUser    = null;
let firestoreUnsub = null;
let _pendingSave   = null;
let _offlineMode   = false;

// ════════════════════════════════════════════════════════════════
//  CAMADA DE DADOS
// ════════════════════════════════════════════════════════════════
window._cvDataKey = () => currentUser ? `cvD6_${currentUser.uid}` : 'cvD6';

window.getData = function () {
  const key = window._cvDataKey();
  let d = JSON.parse(localStorage.getItem(key) || '{}');
  if (!d.items)      d.items      = {};
  if (!d.sonhos)     d.sonhos     = [];
  if (!d.hist)       d.hist       = [];
  if (!d.cfg)        d.cfg        = {};
  if (!d.wallet)     d.wallet     = [];
  if (!d.fracs)      d.fracs      = { lazer:{n:0,names:[]}, invest:{n:0,names:[]} };
  if (!d.parcelados) d.parcelados = [];
  return d;
};

window.save = function (d) {
  const key = window._cvDataKey();
  localStorage.setItem(key, JSON.stringify(d));
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
    setTimeout(() => { _offlineMode = false; }, 30000);
  }
}

// ════════════════════════════════════════════════════════════════
//  MIGRAÇÃO — localStorage → Firestore no primeiro login
// ════════════════════════════════════════════════════════════════
async function migrateLocalToFirestore(uid) {
  const ref  = doc(db, 'users', uid, 'data', 'main');
  const snap = await getDoc(ref);

  if (snap.exists() && snap.data()._migratedAt) {
    const cloudData = snap.data();
    delete cloudData._updatedAt;
    localStorage.setItem(`cvD6_${uid}`, JSON.stringify(cloudData));
    return;
  }

  const localRaw = localStorage.getItem('cvD6');
  if (!localRaw) return;

  try {
    const localData = JSON.parse(localRaw);
    const hasContent =
      (localData.hist    && localData.hist.length > 0)   ||
      (localData.sonhos  && localData.sonhos.length > 0) ||
      (localData.items   && Object.values(localData.items).some(a => a.length > 0)) ||
      (localData.cfg     && localData.cfg.salario);

    if (!hasContent) return;

    localData._migratedAt   = new Date().toISOString();
    localData._migratedFrom = 'localStorage';
    await setDoc(ref, { ...localData, _updatedAt: serverTimestamp() });
    localStorage.setItem(`cvD6_${uid}`, localRaw);
    localStorage.removeItem('cvD6');
    showToastAuth('☁️ Os teus dados foram sincronizados com a nuvem!');
  } catch (err) {
    console.error('[Migração] Erro:', err);
  }
}

// ════════════════════════════════════════════════════════════════
//  SINCRONIZAÇÃO EM TEMPO REAL
// ════════════════════════════════════════════════════════════════
function startRealtimeSync(uid) {
  if (firestoreUnsub) firestoreUnsub();
  const ref = doc(db, 'users', uid, 'data', 'main');
  firestoreUnsub = onSnapshot(ref, (snap) => {
    if (!snap.exists()) return;
    const cloudData = snap.data();
    delete cloudData._updatedAt;
    delete cloudData._migratedAt;
    delete cloudData._migratedFrom;
    const localRaw = localStorage.getItem(`cvD6_${uid}`);
    const cloudStr = JSON.stringify(cloudData);
    if (localRaw !== cloudStr) {
      localStorage.setItem(`cvD6_${uid}`, cloudStr);
      if (typeof calcularTudo  === 'function') calcularTudo();
      if (typeof renderDreams  === 'function') renderDreams();
      if (typeof renderWallet  === 'function') renderWallet();
      if (typeof renderHistory === 'function' && currentPage === 'historico') renderHistory();
    }
  }, (err) => {
    console.warn('[Firebase] Listener erro:', err.message);
  });
}

// ════════════════════════════════════════════════════════════════
//  AUTH STATE
// ════════════════════════════════════════════════════════════════
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    updateUserBar(user);
    hideAuthScreen();

    // Guarda/actualiza perfil público (nome + email)
    try {
      await setDoc(doc(db, 'users_public', user.uid), {
        uid:         user.uid,
        email:       user.email        || '',
        displayName: user.displayName  || '',
        lastLoginAt: serverTimestamp(),
      }, { merge: true });
    } catch(e) { console.warn('[Profile]', e.message); }

    await migrateLocalToFirestore(user.uid);
    startRealtimeSync(user.uid);

    if (typeof window._appInit === 'function') {
      window._appInit();
    } else {
      if (typeof calcularTudo === 'function') calcularTudo();
    }
  } else {
    currentUser = null;
    if (firestoreUnsub) { firestoreUnsub(); firestoreUnsub = null; }
    showAuthScreen();
  }
});

// ════════════════════════════════════════════════════════════════
//  FUNÇÕES DE AUTENTICAÇÃO
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
    // Perfil público criado no onAuthStateChanged acima
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

// ── Mensagens de erro ──
function firebaseErrMsg(code) {
  const msgs = {
    'auth/email-already-in-use':   'Este email já está registado.',
    'auth/invalid-email':          'Email inválido.',
    'auth/user-not-found':         'Utilizador não encontrado.',
    'auth/wrong-password':         'Senha incorrecta.',
    'auth/invalid-credential':     'Email ou senha incorrectos.',
    'auth/too-many-requests':      'Muitas tentativas. Tenta mais tarde.',
    'auth/network-request-failed': 'Sem ligação à internet.',
    'auth/weak-password':          'Senha demasiado fraca (mínimo 6 caracteres).',
  };
  return msgs[code] || `Erro: ${code}`;
}

// ── UI Helpers ──
function showAuthScreen()  { const el = document.getElementById('auth-screen');  if (el) { el.style.display = 'flex'; el.style.alignItems = 'center'; el.style.justifyContent = 'center'; } }
function hideAuthScreen()  { const el = document.getElementById('auth-screen');  if (el) el.style.display = 'none'; }

function showAuthError(msg, type='error') {
  const el = document.getElementById('auth-error');
  if (!el) return;
  el.textContent  = msg;
  el.style.display      = 'block';
  el.style.background   = type === 'ok' ? '#d1fae5' : '#fee2e2';
  el.style.color        = type === 'ok' ? '#059669' : '#dc2626';
  el.style.borderColor  = type === 'ok' ? '#6ee7b7' : '#fca5a5';
}
function clearAuthError() { const el = document.getElementById('auth-error'); if (el) el.style.display = 'none'; }

function setAuthLoading(on) {
  const btn = document.getElementById('auth-submit-btn');
  if (!btn) return;
  btn.disabled    = on;
  btn.textContent = on ? '…' : btn.dataset.label;
}

function updateUserBar(user) {
  const bar = document.getElementById('user-bar');
  if (!bar) return;
  bar.style.display = 'flex';
  const nameEl  = document.getElementById('user-bar-name');
  const avatarEl= document.getElementById('user-bar-avatar');
  if (nameEl)   nameEl.textContent   = user.displayName || user.email.split('@')[0];
  if (avatarEl) avatarEl.textContent = (user.displayName || user.email)[0].toUpperCase();
}

function showToastAuth(msg) {
  if (typeof showToast === 'function') { showToast(msg); return; }
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;padding:10px 20px;border-radius:100px;font-size:13px;font-weight:700;z-index:9999;';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ── Troca entre login e registo ──
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
    if (sub)      sub.textContent        = 'Junta-te à Mente Próspera';
    if (btn)    { btn.textContent = 'Criar conta'; btn.dataset.label = 'Criar conta'; btn.onclick = window.authRegister; }
    if (linkRow)  linkRow.innerHTML      = 'Já tens conta? <span onclick="authSwitchMode(\'login\')" style="color:#8b5cf6;font-weight:700;cursor:pointer;">Entrar</span>';
  } else {
    if (nameRow)  nameRow.style.display  = 'none';
    if (pass2Row) pass2Row.style.display = 'none';
    if (resetRow) resetRow.style.display = 'block';
    if (title)    title.textContent      = 'Entrar';
    if (sub)      sub.textContent        = 'A tua conta Mente Próspera';
    if (btn)    { btn.textContent = 'Entrar'; btn.dataset.label = 'Entrar'; btn.onclick = window.authLogin; }
    if (linkRow)  linkRow.innerHTML      = 'Não tens conta? <span onclick="authSwitchMode(\'register\')" style="color:#8b5cf6;font-weight:700;cursor:pointer;">Criar agora</span>';
  }
};

// Enter key
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const screen = document.getElementById('auth-screen');
  if (!screen || screen.style.display === 'none') return;
  const btn = document.getElementById('auth-submit-btn');
  if (btn && !btn.disabled) btn.click();
});
