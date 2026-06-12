// ═══════════════════════════════════════════════════════════════
//  AUTH.JS — Session guard + Firestore sync
//  Loads AFTER firebase-config.js and Firebase compat SDKs
//  Called from index.html only (NOT login.html)
// ═══════════════════════════════════════════════════════════════
(function () {

  // If Firebase not configured → run app without auth
  if (typeof window.FIREBASE_CONFIG === 'undefined' ||
      !window.FIREBASE_CONFIG.apiKey ||
      window.FIREBASE_CONFIG.apiKey === 'SUBSTITUI_AQUI') {
    return; // index.html onload runs the app directly
  }

  var app, auth, db;
  try {
    app  = firebase.initializeApp(window.FIREBASE_CONFIG);
    auth = firebase.auth();
    db   = firebase.firestore();
  } catch (e) {
    console.warn('[Auth] Firebase init failed:', e.message);
    return; // run app without auth
  }

  // ── Session check ───────────────────────────────────────────
  // onAuthStateChanged fires once on load with current user
  auth.onAuthStateChanged(function (user) {
    if (!user) {
      // No session → go to login page
      window.location.replace('login.html');
      return;
    }

    // ── User is logged in ──────────────────────────────────────
    // Show user name/email in topbar
    showUserBar(user);

    // Override data key to use uid-scoped localStorage key
    window._cvDataKey = function () { return 'cvD6_' + user.uid; };

    // Patch save() to also write to Firestore
    var _baseSave = window.save;
    var _pending  = null;
    window.save = function (d) {
      if (_baseSave) _baseSave(d); // writes to localStorage
      clearTimeout(_pending);
      _pending = setTimeout(function () {
        db.collection('users').doc(user.uid)
          .collection('data').doc('main')
          .set(Object.assign({}, d, {
            _updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }))
          .catch(function (e) { console.warn('[Firestore] save failed:', e.message); });
      }, 1000);
    };

    // Migrate localStorage → Firestore on first login
    migrateIfNeeded(user).then(function () {
      // Update last login timestamp
      db.collection('users_public').doc(user.uid).set({
        uid: user.uid, email: user.email || '',
        displayName: user.displayName || '',
        lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }).catch(function () {});
    });

    // ── Logout function ────────────────────────────────────────
    window.authLogout = function () {
      if (!confirm('Tens a certeza que queres sair?')) return;
      auth.signOut().then(function () {
        window.location.replace('login.html');
      });
    };
  });

  // ── Migration ───────────────────────────────────────────────
  function migrateIfNeeded(user) {
    var ref = db.collection('users').doc(user.uid).collection('data').doc('main');
    return ref.get().then(function (snap) {
      if (snap.exists && snap.data()._migratedAt) {
        // Already in cloud — pull to local
        var d = snap.data();
        delete d._updatedAt; delete d._migratedAt; delete d._migratedFrom;
        localStorage.setItem('cvD6_' + user.uid, JSON.stringify(d));
        return;
      }
      // Try to push local data to cloud
      var raw = localStorage.getItem('cvD6');
      if (!raw) return;
      try {
        var local = JSON.parse(raw);
        if ((local.cfg && local.cfg.salario) ||
            (local.hist && local.hist.length)) {
          local._migratedAt   = new Date().toISOString();
          local._migratedFrom = 'localStorage';
          return ref.set(Object.assign({}, local, {
            _updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          })).then(function () {
            localStorage.setItem('cvD6_' + user.uid, raw);
            localStorage.removeItem('cvD6');
          });
        }
      } catch (e) {}
    }).catch(function (e) {
      console.warn('[Firestore] migration failed:', e.message);
    });
  }

  // ── User bar ────────────────────────────────────────────────
  function showUserBar(user) {
    var bar   = document.getElementById('user-bar');
    var name  = document.getElementById('user-bar-name');
    var av    = document.getElementById('user-bar-avatar');
    if (bar)  { bar.style.display = 'flex'; }
    if (name) { name.textContent = user.displayName || user.email.split('@')[0]; }
    if (av)   { av.textContent   = (user.displayName || user.email)[0].toUpperCase(); }
  }

})();
