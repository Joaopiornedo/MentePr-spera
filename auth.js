// ═══════════════════════════════════════════════════════════════
//  AUTH.JS — Firebase Auth + Firestore (script normal, sem módulos ES6)
//  Carrega depois do firebase-config.js
// ═══════════════════════════════════════════════════════════════

// URLs dos SDKs Firebase (versão compat — funciona como script normal)
(function() {

  // ── Carregar Firebase SDK (compat) via script tags dinâmicos ──
  function loadScript(src, cb) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = cb;
    s.onerror = function() { console.error('Falha ao carregar:', src); cb(); };
    document.head.appendChild(s);
  }

  var FB_VER = '10.12.0';
  var BASE   = 'https://www.gstatic.com/firebasejs/' + FB_VER + '/';

  function initFirebase() {
    try {
      firebase.initializeApp(window.FIREBASE_CONFIG);
      var auth = firebase.auth();
      var db   = firebase.firestore();

      // ── Auth state listener ──────────────────────────────────
      auth.onAuthStateChanged(function(user) {
        if (user) {
          currentUser = user;
          updateUserBar(user);
          hideAuthScreen();
          migrateAndSync(user, db).then(function() {
            if (typeof window._appInit === 'function') window._appInit();
          });
        } else {
          currentUser = null;
          showAuthScreen();
        }
      });

      // ── Expose auth functions to window ──────────────────────
      window.authLogin = function() {
        var email = document.getElementById('auth-email').value.trim();
        var pass  = document.getElementById('auth-pass').value;
        clearErr();
        if (!email || !pass) return showErr('Preenche o email e a senha.');
        setLoading(true);
        auth.signInWithEmailAndPassword(email, pass)
          .catch(function(e) { showErr(fbMsg(e.code)); setLoading(false); });
      };

      window.authRegister = function() {
        var name  = (document.getElementById('auth-name') || {}).value || '';
        var email = document.getElementById('auth-email').value.trim();
        var pass  = document.getElementById('auth-pass').value;
        var pass2 = (document.getElementById('auth-pass2') || {}).value || pass;
        clearErr();
        if (!email || !pass) return showErr('Preenche o email e a senha.');
        if (pass.length < 6)  return showErr('Senha mínimo 6 caracteres.');
        if (pass !== pass2)   return showErr('As senhas não coincidem.');
        setLoading(true);
        auth.createUserWithEmailAndPassword(email, pass)
          .then(function(cred) {
            var promises = [];
            if (name.trim()) promises.push(cred.user.updateProfile({ displayName: name.trim() }));
            // Save public profile
            promises.push(db.collection('users_public').doc(cred.user.uid).set({
              uid: cred.user.uid, email: email,
              displayName: name.trim() || '',
              registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
              lastLoginAt:  firebase.firestore.FieldValue.serverTimestamp(),
            }));
            return Promise.all(promises);
          })
          .catch(function(e) { showErr(fbMsg(e.code)); setLoading(false); });
      };

      window.authLogout = function() {
        if (!confirm('Tens a certeza que queres sair?')) return;
        auth.signOut();
      };

      window.authResetPassword = function() {
        var email = (document.getElementById('auth-email') || {}).value ||
                    prompt('Indica o teu email para recuperar a senha:');
        if (!email) return;
        auth.sendPasswordResetEmail(email)
          .then(function() { showErr('✅ Email enviado! Verifica a caixa de entrada.', 'ok'); })
          .catch(function(e) { showErr(fbMsg(e.code)); });
      };

      window.authSwitchMode = function(mode) {
        var nameRow  = document.getElementById('auth-name-row');
        var pass2Row = document.getElementById('auth-pass2-row');
        var title    = document.getElementById('auth-title');
        var sub      = document.getElementById('auth-subtitle');
        var btn      = document.getElementById('auth-submit-btn');
        var linkRow  = document.getElementById('auth-link-row');
        var resetRow = document.getElementById('auth-reset-row');
        clearErr();
        if (mode === 'register') {
          if (nameRow)  nameRow.style.display  = 'block';
          if (pass2Row) pass2Row.style.display = 'block';
          if (resetRow) resetRow.style.display = 'none';
          if (title)    title.textContent      = 'Criar conta';
          if (sub)      sub.textContent        = 'Junta-te à Mente Próspera';
          if (btn) { btn.textContent = 'Criar conta'; btn.dataset.label = 'Criar conta'; btn.onclick = window.authRegister; }
          if (linkRow)  linkRow.innerHTML = 'Já tens conta? <span onclick="authSwitchMode(\'login\')" style="color:#8b5cf6;font-weight:700;cursor:pointer;">Entrar</span>';
        } else {
          if (nameRow)  nameRow.style.display  = 'none';
          if (pass2Row) pass2Row.style.display = 'none';
          if (resetRow) resetRow.style.display = 'block';
          if (title)    title.textContent      = 'Entrar';
          if (sub)      sub.textContent        = 'A tua conta Mente Próspera';
          if (btn) { btn.textContent = 'Entrar'; btn.dataset.label = 'Entrar'; btn.onclick = window.authLogin; }
          if (linkRow)  linkRow.innerHTML = 'Não tens conta? <span onclick="authSwitchMode(\'register\')" style="color:#8b5cf6;font-weight:700;cursor:pointer;">Criar agora</span>';
        }
      };

    } catch(e) {
      console.error('Firebase init error:', e);
      // Firebase falhou — corre app sem auth
      runWithoutAuth();
    }
  }

  // ── Data helpers ─────────────────────────────────────────────
  var currentUser = null;

  window._cvDataKey = function() {
    return currentUser ? ('cvD6_' + currentUser.uid) : 'cvD6';
  };

  var _origGetData = window.getData;
  window.getData = function() {
    var key = window._cvDataKey();
    var d = JSON.parse(localStorage.getItem(key) || '{}');
    if (!d.items)      d.items      = {};
    if (!d.sonhos)     d.sonhos     = [];
    if (!d.hist)       d.hist       = [];
    if (!d.cfg)        d.cfg        = {};
    if (!d.wallet)     d.wallet     = [];
    if (!d.fracs)      d.fracs      = { lazer:{n:0,names:[]}, invest:{n:0,names:[]} };
    if (!d.parcelados) d.parcelados = [];
    return d;
  };

  var _savePending = null;
  window.save = function(d) {
    var key = window._cvDataKey();
    localStorage.setItem(key, JSON.stringify(d));
    if (!currentUser) return;
    clearTimeout(_savePending);
    _savePending = setTimeout(function() {
      try {
        firebase.firestore()
          .collection('users').doc(currentUser.uid)
          .collection('data').doc('main')
          .set(Object.assign({}, d, { _updatedAt: firebase.firestore.FieldValue.serverTimestamp() }));
      } catch(e) {}
    }, 800);
  };

  // ── Migration localStorage → Firestore ───────────────────────
  function migrateAndSync(user, db) {
    var ref = db.collection('users').doc(user.uid).collection('data').doc('main');
    return ref.get().then(function(snap) {
      if (snap.exists && snap.data()._migratedAt) {
        // Already in cloud — sync to localStorage
        var data = snap.data();
        delete data._updatedAt; delete data._migratedAt; delete data._migratedFrom;
        localStorage.setItem('cvD6_' + user.uid, JSON.stringify(data));
      } else {
        // Try to migrate from localStorage
        var localRaw = localStorage.getItem('cvD6');
        if (localRaw) {
          try {
            var localData = JSON.parse(localRaw);
            var hasContent = (localData.hist && localData.hist.length > 0) ||
                             (localData.cfg && localData.cfg.salario);
            if (hasContent) {
              localData._migratedAt = new Date().toISOString();
              return ref.set(Object.assign({}, localData,
                { _updatedAt: firebase.firestore.FieldValue.serverTimestamp() }
              )).then(function() {
                localStorage.setItem('cvD6_' + user.uid, localRaw);
                localStorage.removeItem('cvD6');
              });
            }
          } catch(e) {}
        }
      }
      // Update last login + public profile
      try {
        db.collection('users_public').doc(user.uid).set({
          uid: user.uid, email: user.email || '',
          displayName: user.displayName || '',
          lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch(e) {}
    }).catch(function(e) {
      console.warn('Firestore sync failed:', e.message);
    });
  }

  // ── UI helpers ────────────────────────────────────────────────
  function showAuthScreen() {
    var el = document.getElementById('auth-screen');
    if (el) { el.style.display = 'flex'; el.style.alignItems = 'center'; el.style.justifyContent = 'center'; }
  }
  function hideAuthScreen() {
    var el = document.getElementById('auth-screen');
    if (el) el.style.display = 'none';
  }
  function showErr(msg, type) {
    var el = document.getElementById('auth-error');
    if (!el) return;
    el.textContent = msg; el.style.display = 'block';
    el.style.background = type === 'ok' ? '#d1fae5' : '#fee2e2';
    el.style.color      = type === 'ok' ? '#059669' : '#dc2626';
    el.style.borderColor= type === 'ok' ? '#6ee7b7' : '#fca5a5';
  }
  function clearErr() { var el = document.getElementById('auth-error'); if (el) el.style.display = 'none'; }
  function setLoading(on) {
    var btn = document.getElementById('auth-submit-btn');
    if (!btn) return;
    btn.disabled = on; btn.textContent = on ? '...' : (btn.dataset.label || 'Entrar');
  }
  function updateUserBar(user) {
    var bar = document.getElementById('user-bar');
    if (bar) bar.style.display = 'flex';
    var n = document.getElementById('user-bar-name');
    var a = document.getElementById('user-bar-avatar');
    if (n) n.textContent = user.displayName || user.email.split('@')[0];
    if (a) a.textContent = (user.displayName || user.email)[0].toUpperCase();
  }
  function fbMsg(code) {
    var m = {
      'auth/email-already-in-use':   'Este email já está registado.',
      'auth/invalid-email':          'Email inválido.',
      'auth/user-not-found':         'Utilizador não encontrado.',
      'auth/wrong-password':         'Senha incorrecta.',
      'auth/invalid-credential':     'Email ou senha incorrectos.',
      'auth/too-many-requests':      'Muitas tentativas. Tenta mais tarde.',
      'auth/network-request-failed': 'Sem ligação à internet.',
      'auth/weak-password':          'Senha demasiado fraca (mínimo 6 caracteres).',
    };
    return m[code] || ('Erro: ' + code);
  }

  // Enter key
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter') return;
    var s = document.getElementById('auth-screen');
    if (!s || s.style.display === 'none') return;
    var btn = document.getElementById('auth-submit-btn');
    if (btn && !btn.disabled) btn.click();
  });

  // ── Run without auth (Firebase not configured or failed) ──────
  function runWithoutAuth() {
    hideAuthScreen();
    if (typeof window._appInit === 'function') window._appInit();
  }

  // ── Bootstrap ─────────────────────────────────────────────────
  // Load Firebase compat SDKs then init
  loadScript(BASE + 'firebase-app-compat.js', function() {
    loadScript(BASE + 'firebase-auth-compat.js', function() {
      loadScript(BASE + 'firebase-firestore-compat.js', function() {
        initFirebase();
      });
    });
  });

})();
