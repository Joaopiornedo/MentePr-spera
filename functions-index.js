// ════════════════════════════════════════════════════════════
//  functions/index.js — Cloud Function para o painel de Admin
//  Mente Próspera · Calculadora da Virada
//
//  DEPLOY: firebase deploy --only functions
//  Após deploy, copia o URL gerado para o admin.html
// ════════════════════════════════════════════════════════════

const { onRequest } = require("firebase-functions/v2/https");
const admin         = require("firebase-admin");

admin.initializeApp();

// ↓ SUBSTITUI pelo teu email de admin (igual ao admin.html)
const ADMIN_EMAIL = "TEU_EMAIL_AQUI@gmail.com";

/**
 * adminGetUsers
 * Devolve a lista de todos os utilizadores do Firebase Auth.
 * Só pode ser chamado com o token de ID do utilizador admin.
 */
exports.adminGetUsers = onRequest({ cors: true }, async (req, res) => {

  // 1. Extrai o ID Token do header Authorization
  const authHeader = req.headers.authorization || "";
  const idToken    = authHeader.startsWith("Bearer ")
    ? authHeader.split("Bearer ")[1]
    : null;

  if (!idToken) {
    return res.status(401).json({ error: "Token em falta." });
  }

  try {
    // 2. Verifica que o token é válido e pertence ao admin
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (decoded.email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: "Acesso negado — não és admin." });
    }

    // 3. Lista todos os utilizadores (máx. 1000 por chamada)
    //    Para projectos com >1000 utilizadores, implementar paginação com pageToken
    const listResult = await admin.auth().listUsers(1000);

    const users = listResult.users.map(u => ({
      uid:         u.uid,
      email:       u.email        || "—",
      displayName: u.displayName  || "",
      createdAt:   u.metadata.creationTime,
      lastLogin:   u.metadata.lastSignInTime || null,
      disabled:    u.disabled,
      provider:    u.providerData[0]?.providerId || "password",
    }));

    // Ordena por data de registo (mais recente primeiro)
    users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.json({
      users,
      total:     users.length,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error("adminGetUsers error:", err);
    return res.status(500).json({ error: err.message });
  }
});
