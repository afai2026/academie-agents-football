const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Pool } = require("pg");

const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/+$/, "");
const MAX_REGISTRATION_BYTES = 8_000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const DEFAULT_RETENTION_DAYS = 180;
const RETENTION_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

const publicFiles = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/index.html": { file: "index.html", type: "text/html; charset=utf-8" },
  "/styles.css": { file: "styles.css", type: "text/css; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/admin": { file: "admin.html", type: "text/html; charset=utf-8" },
  "/admin.js": { file: "admin.js", type: "text/javascript; charset=utf-8" },
  "/privacy": { file: "privacy.html", type: "text/html; charset=utf-8" },
  "/supports/fiche-revision": { file: "support.html", type: "text/html; charset=utf-8" },
  "/supports/plan-revision": { file: "study-plan.html", type: "text/html; charset=utf-8" },
  "/support.css": { file: "support.css", type: "text/css; charset=utf-8" }
};

function serveFile(response, file, contentType, privacyContactEmail = "", dataRetentionDays = DEFAULT_RETENTION_DAYS) {
  fs.readFile(path.join(__dirname, file), (error, content) => {
    if (error) {
      console.error(`Unable to read ${file}:`, error.message);
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Erreur lors du chargement de la page.");
      return;
    }
    let responseBody = content;
    if (file === "privacy.html") {
      responseBody = content.toString("utf8").replaceAll(
        "{{PRIVACY_CONTACT_EMAIL}}",
        privacyContactEmail ? escapeHtml(privacyContactEmail) : "à définir avant l’ouverture des demandes"
      ).replaceAll("{{DATA_RETENTION_DAYS}}", String(dataRetentionDays));
    }
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    });
    response.end(responseBody);
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers
  });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    request.on("data", (chunk) => {
      length += chunk.length;
      if (length > MAX_REGISTRATION_BYTES) {
        reject(Object.assign(new Error("La demande est trop volumineuse."), { status: 413 }));
        request.resume();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (length > MAX_REGISTRATION_BYTES) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(Object.assign(new Error("Le contenu de la demande est invalide."), { status: 400 }));
      }
    });
    request.on("error", (error) => reject(error));
  });
}

function validateRegistration(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw Object.assign(new Error("La demande est invalide."), { status: 400 });
  }
  if (typeof payload.website === "string" && payload.website.trim()) return null;

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const phone = typeof payload.phone === "string"
    ? payload.phone.replace(/[\s().-]/g, "")
    : "";
  if (!name || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw Object.assign(new Error("Saisissez un nom valide (100 caractères maximum)."), { status: 400 });
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error("Saisissez une adresse e-mail valide."), { status: 400 });
  }
  if (!/^\+?[0-9]{8,15}$/.test(phone)) {
    throw Object.assign(new Error("Saisissez un numéro de téléphone valide avec indicatif si nécessaire."), { status: 400 });
  }
  if (payload.consent !== true) {
    throw Object.assign(new Error("Votre accord est nécessaire pour envoyer cette demande."), { status: 400 });
  }
  return { id: crypto.randomUUID(), name, email, phone, status: "pending" };
}

function createServer({
  registrationStorePath = path.join(__dirname, "data", "registrations.jsonl"),
  adminToken = process.env.ADMIN_TOKEN,
  databaseUrl = process.env.DATABASE_URL,
  privacyContactEmail = process.env.PRIVACY_CONTACT_EMAIL || "",
  dataRetentionDays = Number(process.env.DATA_RETENTION_DAYS || DEFAULT_RETENTION_DAYS),
  baseUrl = BASE_URL,
  isProduction = process.env.NODE_ENV === "production",
  databasePool,
  trustProxy = process.env.TRUST_PROXY === "true",
  now = () => Date.now()
} = {}) {
  if (isProduction && !databaseUrl && !databasePool) {
    throw new Error("DATABASE_URL est obligatoire en production ; le stockage local n’est pas sûr pour un déploiement public.");
  }
  if (isProduction && (typeof adminToken !== "string" || adminToken.length < 32)) {
    throw new Error("ADMIN_TOKEN doit contenir au moins 32 caractères en production.");
  }
  if (isProduction && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(privacyContactEmail)) {
    throw new Error("PRIVACY_CONTACT_EMAIL doit être une adresse e-mail valide en production.");
  }
  if (isProduction && !/^https:\/\//i.test(baseUrl)) {
    throw new Error("BASE_URL doit utiliser HTTPS en production.");
  }
  if (!Number.isInteger(dataRetentionDays) || dataRetentionDays < 30 || dataRetentionDays > 730) {
    throw new Error("DATA_RETENTION_DAYS doit être un nombre entier compris entre 30 et 730.");
  }

  const requestsByIp = new Map();
  const adminAttemptsByIp = new Map();
  let writeQueue = Promise.resolve();
  const pool = databasePool || (databaseUrl
    ? new Pool({ connectionString: databaseUrl, max: 5, connectionTimeoutMillis: 10_000 })
    : null);

  const databaseReady = pool
    ? pool.query(`
      CREATE TABLE IF NOT EXISTS registrations (
        id UUID PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(254) NOT NULL,
        phone VARCHAR(16) NOT NULL,
        consent BOOLEAN NOT NULL DEFAULT TRUE,
        status VARCHAR(16) NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reviewed_at TIMESTAMPTZ
      );
      ALTER TABLE registrations ADD COLUMN IF NOT EXISTS consent BOOLEAN NOT NULL DEFAULT TRUE;
      CREATE INDEX IF NOT EXISTS registrations_created_at_idx ON registrations (created_at);
    `).then(() => pool.query(
      "DELETE FROM registrations WHERE created_at < NOW() - ($1::int * INTERVAL '1 day')",
      [dataRetentionDays]
    ))
    : Promise.resolve();

  function appendRegistration(registration) {
    if (pool) {
      return databaseReady.then(() => pool.query(
        `INSERT INTO registrations (id, name, email, phone, consent, status, created_at, reviewed_at)
         VALUES ($1, $2, $3, $4, TRUE, $5, COALESCE($6::timestamptz, NOW()), $7::timestamptz)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           email = EXCLUDED.email,
           phone = EXCLUDED.phone,
           status = EXCLUDED.status,
           reviewed_at = EXCLUDED.reviewed_at`,
        [
          registration.id,
          registration.name,
          registration.email,
          registration.phone,
          registration.status,
          registration.createdAt || null,
          registration.reviewedAt || null
        ]
      ));
    }
    const write = writeQueue.then(async () => {
      await fs.promises.mkdir(path.dirname(registrationStorePath), { recursive: true });
      await fs.promises.appendFile(
        registrationStorePath,
        `${JSON.stringify({ ...registration, createdAt: registration.createdAt || new Date(now()).toISOString() })}\n`,
        { encoding: "utf8", mode: 0o600 }
      );
    });
    writeQueue = write.catch(() => {});
    return write;
  }

  async function readLocalRegistrations() {
    let content;
    try {
      content = await fs.promises.readFile(registrationStorePath, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }

    const latestById = new Map();
    const lines = content.split(/\r?\n/).filter(Boolean);
    lines.forEach((line, index) => {
      let registration;
      try {
        registration = JSON.parse(line);
      } catch {
        throw new Error(`L’enregistrement local ${index + 1} est illisible.`);
      }
      if (!registration || typeof registration !== "object" || typeof registration.name !== "string" || typeof registration.email !== "string" || typeof registration.phone !== "string") {
        throw new Error(`L’enregistrement local ${index + 1} est invalide.`);
      }
      const id = typeof registration.id === "string"
        ? registration.id
        : crypto.createHash("sha256").update(`${index}:${line}`).digest("hex")
          .slice(0, 32).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
      const status = ["pending", "approved", "rejected"].includes(registration.status)
        ? registration.status
        : "pending";
      latestById.set(id, { ...registration, id, status });
    });
    return [...latestById.values()].sort((left, right) => right.createdAt?.localeCompare(left.createdAt || "") || 0);
  }

  async function readRegistrations() {
    if (pool) {
      await databaseReady;
      const { rows } = await pool.query(
        "SELECT id, name, email, phone, status, created_at, reviewed_at FROM registrations ORDER BY created_at DESC"
      );
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        status: row.status,
        createdAt: new Date(row.created_at).toISOString(),
        reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null
      }));
    }
    await writeQueue;
    return readLocalRegistrations();
  }

  function getClientIp(request) {
    if (trustProxy && typeof request.headers["x-forwarded-for"] === "string") {
      const forwardedIp = request.headers["x-forwarded-for"].split(",")[0].trim();
      if (forwardedIp) return forwardedIp;
    }
    return request.socket.remoteAddress || "unknown";
  }

  async function removeRegistration(id) {
    if (pool) {
      await databaseReady;
      const { rowCount } = await pool.query("DELETE FROM registrations WHERE id = $1::uuid", [id]);
      return rowCount > 0;
    }

    const deletion = writeQueue.then(async () => {
      const registrations = await readLocalRegistrations();
      if (!registrations.some((registration) => registration.id === id)) return false;
      const remaining = registrations.filter((registration) => registration.id !== id);
      await fs.promises.mkdir(path.dirname(registrationStorePath), { recursive: true });
      const content = remaining.map((registration) => JSON.stringify(registration)).join("\n");
      const temporaryPath = `${registrationStorePath}.${crypto.randomUUID()}.tmp`;
      await fs.promises.writeFile(temporaryPath, content ? `${content}\n` : "", { encoding: "utf8", mode: 0o600 });
      await fs.promises.rename(temporaryPath, registrationStorePath);
      return true;
    });
    writeQueue = deletion.catch(() => {});
    return deletion;
  }

  function authorizeAdmin(request, response) {
    if (typeof adminToken !== "string" || adminToken.length < 32) {
      sendJson(response, 503, { error: "L’espace administrateur n’est pas configuré. Définissez ADMIN_TOKEN (32 caractères minimum) côté serveur." });
      return false;
    }

    const ip = getClientIp(request);
    const currentTime = now();
    const recentAttempts = (adminAttemptsByIp.get(ip) || []).filter((timestamp) => currentTime - timestamp < RATE_LIMIT_WINDOW_MS);
    if (recentAttempts.length >= RATE_LIMIT_MAX_REQUESTS) {
      sendJson(response, 429, { error: "Trop de tentatives de connexion. Réessayez plus tard." }, {
        "Retry-After": String(Math.ceil((recentAttempts[0] + RATE_LIMIT_WINDOW_MS - currentTime) / 1000))
      });
      return false;
    }

    const authorization = request.headers.authorization || "";
    const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const expected = Buffer.from(adminToken);
    const supplied = Buffer.from(suppliedToken);
    const matches = expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
    if (!matches) {
      recentAttempts.push(currentTime);
      adminAttemptsByIp.set(ip, recentAttempts);
      if (adminAttemptsByIp.size > 1_000) {
        for (const [address, timestamps] of adminAttemptsByIp) {
          if (!timestamps.some((timestamp) => currentTime - timestamp < RATE_LIMIT_WINDOW_MS)) adminAttemptsByIp.delete(address);
        }
      }
      sendJson(response, 401, { error: "Clé administrateur invalide." });
      return false;
    }
    adminAttemptsByIp.delete(ip);
    return true;
  }

  async function handleRegistration(request, response) {
    if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
      return sendJson(response, 415, { error: "Le format de la demande doit être JSON." });
    }

    const ip = getClientIp(request);
    const currentTime = now();
    const recentRequests = (requestsByIp.get(ip) || []).filter((timestamp) => currentTime - timestamp < RATE_LIMIT_WINDOW_MS);
    if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
      return sendJson(response, 429, { error: "Trop de demandes depuis cet appareil. Réessayez plus tard." }, {
        "Retry-After": String(Math.ceil((recentRequests[0] + RATE_LIMIT_WINDOW_MS - currentTime) / 1000))
      });
    }
    recentRequests.push(currentTime);
    requestsByIp.set(ip, recentRequests);
    if (requestsByIp.size > 1_000) {
      for (const [address, timestamps] of requestsByIp) {
        if (!timestamps.some((timestamp) => currentTime - timestamp < RATE_LIMIT_WINDOW_MS)) requestsByIp.delete(address);
      }
    }

    try {
      const payload = await readJsonBody(request);
      const registration = validateRegistration(payload);
      if (registration) {
        registration.createdAt = new Date(now()).toISOString();
        await appendRegistration(registration);
      }
      return sendJson(response, 201, { ok: true });
    } catch (error) {
      if (error.status) return sendJson(response, error.status, { error: error.message });
      console.error("Unable to save information request:", error.message);
      return sendJson(response, 500, { error: "Impossible d’enregistrer la demande pour le moment." });
    }
  }

  async function handleAdminRequests(request, response, url) {
    if (!authorizeAdmin(request, response)) return;
    if (request.method === "GET" && url.pathname === "/api/admin/requests") {
      try {
        return sendJson(response, 200, { requests: await readRegistrations() });
      } catch (error) {
        console.error("Unable to read information requests:", error.message);
        return sendJson(response, 500, { error: "Impossible de lire les demandes pour le moment." });
      }
    }

    const match = url.pathname.match(/^\/api\/admin\/requests\/([0-9a-f-]{36})$/i);
    if (!match) {
      return sendJson(response, 404, { error: "Page introuvable." });
    }
    if (request.method === "DELETE") {
      try {
        const deleted = await removeRegistration(match[1]);
        return deleted
          ? sendJson(response, 200, { ok: true })
          : sendJson(response, 404, { error: "Cette demande est introuvable." });
      } catch (error) {
        console.error("Unable to delete information request:", error.message);
        return sendJson(response, 500, { error: "Impossible de supprimer cette demande." });
      }
    }
    if (request.method !== "POST") return sendJson(response, 404, { error: "Page introuvable." });
    if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
      return sendJson(response, 415, { error: "Le format de la demande doit être JSON." });
    }
    try {
      const payload = await readJsonBody(request);
      if (!payload || !["approved", "rejected", "pending"].includes(payload.status)) {
        return sendJson(response, 400, { error: "Choisissez une décision valide." });
      }
      const requests = await readRegistrations();
      const registration = requests.find((entry) => entry.id === match[1]);
      if (!registration) return sendJson(response, 404, { error: "Cette demande est introuvable." });

      const updated = {
        ...registration,
        status: payload.status,
        reviewedAt: payload.status === "pending" ? null : new Date(now()).toISOString()
      };
      if (pool) {
        const { rows } = await pool.query(
          `UPDATE registrations SET status = $2, reviewed_at = $3::timestamptz
           WHERE id = $1::uuid
           RETURNING id, name, email, phone, status, created_at, reviewed_at`,
          [match[1], updated.status, updated.reviewedAt]
        );
        if (!rows.length) return sendJson(response, 404, { error: "Cette demande est introuvable." });
        const [row] = rows;
        updated.createdAt = new Date(row.created_at).toISOString();
        updated.reviewedAt = row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null;
      } else {
        await appendRegistration(updated);
      }
      return sendJson(response, 200, { request: updated });
    } catch (error) {
      if (error.status) return sendJson(response, error.status, { error: error.message });
      console.error("Unable to update information request:", error.message);
      return sendJson(response, 500, { error: "Impossible de mettre à jour cette demande." });
    }
  }

  const server = http.createServer((request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'"
    );
    if (isProduction) response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

    let url;
    try {
      url = new URL(request.url, baseUrl);
    } catch {
      return sendJson(response, 400, { error: "Adresse de requête invalide." });
    }
    if (request.method === "GET" && url.pathname === "/healthz") {
      (async () => {
        try {
          await databaseReady;
          if (pool) await pool.query("SELECT 1");
          return sendJson(response, 200, { ok: true });
        } catch (error) {
          console.error("Health check failed:", error.message);
          return sendJson(response, 503, { ok: false, error: "Service temporairement indisponible." });
        }
      })();
      return;
    }
    if (url.pathname === "/api/admin/requests" || url.pathname.startsWith("/api/admin/requests/")) {
      handleAdminRequests(request, response, url);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/inscriptions") {
      handleRegistration(request, response);
      return;
    }
    if (request.method === "GET" && publicFiles[url.pathname]) {
      const { file, type } = publicFiles[url.pathname];
      serveFile(response, file, type, privacyContactEmail, dataRetentionDays);
      return;
    }
    response.writeHead(404, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(JSON.stringify({ error: "Page introuvable." }));
  });
  server.databaseReady = databaseReady;
  const retentionTimer = pool ? setInterval(() => {
    databaseReady
      .then(() => pool.query(
        "DELETE FROM registrations WHERE created_at < NOW() - ($1::int * INTERVAL '1 day')",
        [dataRetentionDays]
      ))
      .catch((error) => console.error("Unable to purge expired information requests:", error.message));
  }, RETENTION_CHECK_INTERVAL_MS) : null;
  if (retentionTimer) retentionTimer.unref();
  let poolClosePromise;
  const closePool = () => {
    if (!pool) return Promise.resolve();
    if (!poolClosePromise) poolClosePromise = pool.end();
    return poolClosePromise;
  };
  server.on("close", () => {
    if (retentionTimer) clearInterval(retentionTimer);
    closePool().catch((error) => console.error("Unable to close PostgreSQL pool:", error.message));
  });
  server.shutdown = async () => {
    if (retentionTimer) clearInterval(retentionTimer);
    await closePool();
  };
  return server;
}

if (require.main === module) {
  let server;
  try {
    server = createServer();
  } catch (error) {
    console.error("Configuration de production invalide:", error.message);
    process.exitCode = 1;
  }
  if (server) {
    server.databaseReady.then(() => {
      server.listen(PORT, "0.0.0.0", () => {
        console.log(`L’Académie Africaine des Agents de Football est disponible sur ${BASE_URL}`);
      });
    }).catch(async (error) => {
      console.error("Impossible de préparer la base PostgreSQL:", error.message);
      try {
        await server.shutdown();
      } catch (shutdownError) {
        console.error("Impossible de fermer PostgreSQL proprement:", shutdownError.message);
      }
      process.exitCode = 1;
    });
  }
}

module.exports = { createServer };
