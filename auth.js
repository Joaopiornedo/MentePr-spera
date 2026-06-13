// ═══════════════════════════════════════════════════════════════
//  AUTH.JS — Firebase Auth + Firestore data sync
//  Carregado no fundo do body do index.html, depois dos SDKs compat
//
//  FLUXO:
//  1. Firebase não configurado → app corre sem auth (localStorage puro)
//  2. Firebase configurado + sem sessão → redireciona para login.html
//  3. Firebase configurado + sessão válida → carrega dados do Firestore
//     e patcha getData()/save() para usar uid do utilizador
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ── Verificar config ──────────────────────────────────────────
  if (typeof window.FIREBASE_CONFIG === 'undefined' ||
      !window.FIREBASE_CONFIG.apiKey ||
      window.FIREBASE_CONFIG.apiKey === 'SUBSTITUI_AQUI') {
    // Sem Firebase → app funciona normalmente com localStorage
    console.log('[Auth] Sem Firebase config — modo local');
    return;
  }

  // ── Inicializar Firebase ──────────────────────────────────────
  var app, auth, db;
  try {
    // Evita inicializar duas vezes (ex: hot reload)
    app  = firebase.apps.length
           ? firebase.app()
           : firebase.initializeApp(window.FIREBASE_CONFIG);
    auth = firebase.auth();
    db   = firebase.firestore();
  } catch (e) {
    console.warn('[Auth] Falha ao inicializar Firebase:', e.message);
    return;
  }

  // ── Listener de sessão ────────────────────────────────────────
  auth.onAuthStateChanged(function (user) {
    if (!user) {
      // Sem sessão → vai para login
      window.location.replace('login.html');
      return;
    }

    // ── Utilizador autenticado ────────────────────────────────
    var uid = user.uid;
    var KEY = 'cvD6_' + uid;  // chave localStorage deste utilizador

    // Mostrar avatar/nome no topbar
    showUserBar(user);

    // ── Patch getData para ler a chave certa ──────────────────
    var _origGetData = window.getData;
    window.getData = function () {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        try {
          var d = JSON.parse(raw);
          if (!d.items)  d.items  = {fixo:[],lazer:[],invest:[]};
          if (!d.sonhos) d.sonhos = [];
          if (!d.hist)   d.hist   = [];
          if (!d.cfg)    d.cfg    = {};
          if (!d.wallet) d.wallet = [];
          if (!d.fracs)  d.fracs  = {lazer:{n:0,names:[]},invest:{n:0,names:[]}};
          return d;
        } catch(e) {}
      }
      // Se não houver dados locais, devolver estrutura vazia
      return {items:{fixo:[],lazer:[],invest:[]},sonhos:[],hist:[],cfg:{},wallet:[],fracs:{lazer:{n:0,names:[]},invest:{n:0,names:[]}}};
    };

    // ── Patch save para escrever na chave certa + Firestore ───
    var _savePending = null;
    window.save = function (d) {
      // 1. Guardar no localStorage com a chave do utilizador
      localStorage.setItem(KEY, JSON.stringify(d));

      // 2. Sincronizar com Firestore (debounced 1.5s)
      clearTimeout(_savePending);
      _savePending = setTimeout(function () {
        var toSave = JSON.parse(JSON.stringify(d)); // deep clone
        toSave._updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        db.collection('users').doc(uid)
          .collection('data').doc('main')
          .set(toSave)
          .catch(function (e) {
            console.warn('[Firestore] Falha ao guardar:', e.message);
          });
      }, 1500);
    };

    // ── Carregar dados do Firestore → localStorage ─────────────
    carregarDados(uid, KEY, function () {
      // Dados prontos → re-inicializar a app com os dados correctos
      reinitApp();
      // Actualizar último login no perfil público
      db.collection('users_public').doc(uid).set({
        uid:         uid,
        email:       user.email || '',
        displayName: user.displayName || '',
        lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true }).catch(function () {});
    });

    // ── Logout ────────────────────────────────────────────────
    window.authLogout = function () {
      if (!confirm('Tens a certeza que queres sair?')) return;
      auth.signOut().then(function () {
        window.location.replace('login.html');
      });
    };
  });

  // ── Carregar dados: Firestore tem prioridade ─────────────────
  function carregarDados(uid, KEY, cb) {
    db.collection('users').doc(uid)
      .collection('data').doc('main')
      .get()
      .then(function (snap) {
        if (snap.exists) {
          // Dados na nuvem → guardar localmente e usar
          var d = snap.data();
          delete d._updatedAt;
          localStorage.setItem(KEY, JSON.stringify(d));
          console.log('[Auth] Dados carregados do Firestore');
        } else {
          // Nuvem vazia → verificar se há dados locais antigos (sem uid)
          var legacyRaw = localStorage.getItem('cvD6');
          if (legacyRaw) {
            try {
              var legacyData = JSON.parse(legacyRaw);
              var temDados = (legacyData.cfg && legacyData.cfg.salario) ||
                             (legacyData.hist && legacyData.hist.length > 0) ||
                             (legacyData.items && legacyData.items.fixo && legacyData.items.fixo.length > 0);
              if (temDados) {
                // Migrar dados antigos → nuvem
                localStorage.setItem(KEY, legacyRaw);
                localStorage.removeItem('cvD6');
                var toMigrate = JSON.parse(legacyRaw);
                toMigrate._migratedAt = new Date().toISOString();
                toMigrate._updatedAt  = firebase.firestore.FieldValue.serverTimestamp();
                db.collection('users').doc(uid)
                  .collection('data').doc('main')
                  .set(toMigrate)
                  .then(function () {
                    console.log('[Auth] Dados antigos migrados para Firestore');
                  })
                  .catch(function (e) {
                    console.warn('[Auth] Falha na migração:', e.message);
                  });
              }
            } catch (e) {}
          }
        }
        cb();
      })
      .catch(function (e) {
        console.warn('[Auth] Falha ao carregar Firestore:', e.message);
        // Offline ou erro → usar localStorage existente
        cb();
      });
  }

  // ── Re-inicializar app com dados correctos ───────────────────
  // A app já foi inicializada pelo window.onload com getData() antigo.
  // Agora que getData() aponta para a chave certa, limpamos e recarregamos.
  function reinitApp() {
    // Limpar listas de itens actuais (foram carregadas com dados errados)
    ['fixo','lazer','invest'].forEach(function (cat) {
      var list = document.getElementById('list-' + cat);
      if (list) list.innerHTML = '';
    });
    var dl = document.getElementById('dreamsList');
    if (dl) dl.innerHTML = '';

    // Recarregar com os dados correctos do utilizador
    var d = window.getData();

    // Restaurar config
    if (d.cfg) {
      if (d.cfg.salario  && document.getElementById('salario'))   document.getElementById('salario').value   = d.cfg.salario;
      if (d.cfg.pctFixo  && document.getElementById('pctFixo'))   document.getElementById('pctFixo').value   = d.cfg.pctFixo;
      if (d.cfg.pctInvest && document.getElementById('pctInvest')) document.getElementById('pctInvest').value = d.cfg.pctInvest;
      if (d.cfg.mode && window.setMode) {
        window.mode = d.cfg.mode;
      }
    }

    // Recarregar itens
    if (window.loadItems)  window.loadItems();

    // Recarregar wallet
    if (window.renderWallet) window.renderWallet();

    // Recarregar sonhos
    if (window.renderDreams) window.renderDreams();

    // Recarregar histórico (se na página certa)
    if (window.renderHistory) window.renderHistory();

    // Recalcular tudo
    if (window.calcularTudo) window.calcularTudo();

    console.log('[Auth] App reinicializada com dados do utilizador');
  }

  // ── Mostrar avatar no topbar ──────────────────────────────────
  function showUserBar(user) {
    var bar = document.getElementById('user-bar');
    var av  = document.getElementById('user-bar-avatar');
    if (bar) bar.style.display = 'flex';
    if (av) {
      var inicial = (user.displayName || user.email || '?')[0].toUpperCase();
      av.textContent = inicial;
      av.title = (user.displayName || user.email) + ' — clica para sair';
    }
  }

})();
