const { before, after, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createServer } = require("../server");
const { buildStatic } = require("../scripts/build-static");

function createFakeDatabasePool() {
  const registrations = new Map();
  return {
    registrations,
    async query(statement, values = []) {
      const sql = statement.trim();
      if (sql.startsWith("DELETE FROM registrations WHERE id =")) {
        return { rowCount: registrations.delete(values[0]) ? 1 : 0, rows: [] };
      }
      if (sql.startsWith("CREATE TABLE") || sql.startsWith("DELETE FROM registrations")) {
        return { rows: [] };
      }
      if (sql === "SELECT 1") return { rows: [{ "?column?": 1 }] };
      if (sql.startsWith("INSERT INTO registrations")) {
        const [id, name, email, phone, status, createdAt, reviewedAt] = values;
        const existing = registrations.get(id);
        registrations.set(id, {
          id, name, email, phone, status,
          created_at: existing?.created_at || (createdAt ? new Date(createdAt) : new Date()),
          reviewed_at: reviewedAt ? new Date(reviewedAt) : null
        });
        return { rows: [] };
      }
      if (sql.startsWith("SELECT id, name, email, phone, status, created_at, reviewed_at FROM registrations")) {
        return {
          rows: [...registrations.values()].sort((left, right) => right.created_at - left.created_at)
        };
      }
      if (sql.startsWith("UPDATE registrations")) {
        const [id, status, reviewedAt] = values;
        const registration = registrations.get(id);
        if (!registration) return { rows: [] };
        Object.assign(registration, { status, reviewed_at: reviewedAt ? new Date(reviewedAt) : null });
        return { rows: [registration] };
      }
      throw new Error(`Unexpected SQL in test: ${sql}`);
    },
    async end() {}
  };
}

let baseUrl;
let server;
let dataDirectory;
let registrationStorePath;
const adminToken = "test-admin-token-that-is-at-least-32-characters-long";

before(async () => {
  dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "academy-registration-test-"));
  registrationStorePath = path.join(dataDirectory, "registrations.jsonl");
  server = createServer({ registrationStorePath, adminToken });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  try {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  } finally {
    fs.rmSync(dataDirectory, { recursive: true, force: true });
  }
});

test("sert le site, ses ressources pédagogiques et sa politique de confidentialité", async () => {
  const [page, styles, script, support, studyPlan, supportStyles, adminPage, adminScript, privacyPage, health, missing] = await Promise.all([
    fetch(baseUrl),
    fetch(`${baseUrl}/styles.css`),
    fetch(`${baseUrl}/app.js`),
    fetch(`${baseUrl}/supports/fiche-revision`),
    fetch(`${baseUrl}/supports/plan-revision`),
    fetch(`${baseUrl}/support.css`),
    fetch(`${baseUrl}/admin`),
    fetch(`${baseUrl}/admin.js`),
    fetch(`${baseUrl}/privacy`),
    fetch(`${baseUrl}/healthz`),
    fetch(`${baseUrl}/inconnu`)
  ]);
  const [html, scriptContent, supportHtml, studyPlanHtml, adminHtml, adminScriptContent, privacyHtml] = await Promise.all([
    page.text(), script.text(), support.text(), studyPlan.text(), adminPage.text(), adminScript.text(), privacyPage.text()
  ]);

  assert.equal(page.status, 200);
  assert.match(html, /Académie Africaine des Agents de Football/);
  assert.match(html, /organisme privé de préparation/);
  assert.match(html, /ni agréée, ni affiliée, ni partenaire de la FIFA/);
  assert.match(html, /id="faq"/);
  assert.match(html, /La préparation garantit-elle la réussite ou une licence/);
  assert.match(html, /id="outils"/);
  assert.match(html, /id="cours"/);
  assert.match(html, /id="inscription"/);
  assert.match(html, /UN PROJET D’ENTRAIDE/);
  assert.match(html, /aider les jeunes Africains à mieux se préparer/);
  assert.match(html, /Un projet à vocation sociale/);
  assert.match(html, /Aucun service de paiement ni collecte de frais n’est proposé/);
  assert.doesNotMatch(html, /Wave Business|100.?000 XOF|checkout/i);
  assert.match(html, /Des outils gratuits/);
  assert.match(html, /Pas de compte nécessaire/);
  assert.match(html, /academieagentsfootball\.com/);
  assert.match(html, /ne crée pas automatiquement de compte étudiant/i);
  assert.match(html, /examinée et validée manuellement/i);
  assert.match(html, /politique de confidentialité/);
  assert.doesNotMatch(html, /Prototype local/);
  for (const platform of ["Canva", "Google Forms", "Google Meet", "YouTube", "WhatsApp"]) {
    assert.ok(html.includes(platform), `La plateforme ${platform} doit être présentée.`);
  }
  assert.match(html, /toute personne disposant de son lien/);
  assert.match(html, /QCM pédagogique original, non officiel/);
  assert.match(html, /Examen blanc · 10 min/);
  assert.match(html, /id="qcm"/);
  for (const country of ["Côte d’Ivoire", "Sénégal", "Cameroun", "RD Congo", "Maroc", "Bénin", "Togo"]) {
    assert.ok(html.includes(country), `Le pays ${country} doit être affiché.`);
  }
  assert.equal(styles.status, 200);
  assert.match(styles.headers.get("content-type"), /text\/css/);
  assert.equal(script.status, 200);
  assert.match(script.headers.get("content-type"), /javascript/);
  assert.match(scriptContent, /EXAM_DURATION_SECONDS = 10 \* 60/);
  assert.match(scriptContent, /Protection des mineurs/);
  assert.equal(support.status, 200);
  assert.match(supportHtml, /Imprimer \/ Enregistrer en PDF/);
  assert.equal(studyPlan.status, 200);
  assert.match(studyPlanHtml, /Mon plan de<br><em>révision sur un mois/);
  assert.match(studyPlanHtml, /Semaine 4 · Réviser et prendre du recul/);
  assert.equal((studyPlanHtml.match(/<h2>Semaine [1-4]/g) || []).length, 4);
  assert.equal(supportStyles.status, 200);
  assert.match(supportStyles.headers.get("content-type"), /text\/css/);
  assert.equal(adminPage.status, 200);
  assert.match(adminHtml, /Espace privé/);
  assert.match(adminHtml, /admin-token/);
  assert.equal(adminScript.status, 200);
  assert.match(adminScriptContent, /textContent/);
  assert.equal(privacyPage.status, 200);
  assert.match(privacyHtml, /à définir avant l’ouverture des demandes/);
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("x-frame-options"), "DENY");
  assert.match(health.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal(missing.status, 404);
});

test("génère un artefact statique gratuit sans formulaire ni fichiers serveur", () => {
  const staticOutput = buildStatic();
  const index = fs.readFileSync(path.join(staticOutput, "index.html"), "utf8");
  const privacy = fs.readFileSync(path.join(staticOutput, "privacy", "index.html"), "utf8");

  assert.match(index, /Demandes temporairement fermées/);
  assert.doesNotMatch(index, /registration-form|\/api\/inscriptions|admin\.js/);
  assert.match(index, /href="\/supports\/fiche-revision\/"/);
  assert.match(index, /href="\/supports\/plan-revision\/"/);
  assert.match(index, /href="\/privacy\/"/);
  assert.match(privacy, /ne comporte ni formulaire d’inscription ou de contact/);
  assert.doesNotMatch(privacy, /\{\{PRIVACY_CONTACT_EMAIL\}\}|\{\{DATA_RETENTION_DAYS\}\}/);

  assert.equal(fs.existsSync(path.join(staticOutput, "supports", "fiche-revision", "index.html")), true);
  assert.equal(fs.existsSync(path.join(staticOutput, "supports", "plan-revision", "index.html")), true);
  for (const privateFile of ["server.js", "admin.html", "admin.js", "package.json", "render.yaml", ".env"]) {
    assert.equal(fs.existsSync(path.join(staticOutput, privateFile)), false, `${privateFile} ne doit pas être publié.`);
  }
});

test("enregistre une demande d’information sans créer de compte ni paiement", async () => {
  const invalid = await fetch(`${baseUrl}/api/inscriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Étudiante", email: "adresse-invalide", phone: "+225 07 00 00 00 00", consent: true })
  });
  assert.equal(invalid.status, 400);
  assert.equal(fs.existsSync(registrationStorePath), false);

  const response = await fetch(`${baseUrl}/api/inscriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Étudiante Démonstration",
      email: "Etudiante@Example.ci",
      phone: "+225 07 00 00 00 00",
      consent: true,
      password: "ne-doit-pas-etre-stocke"
    })
  });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true });

  const records = fs.readFileSync(registrationStorePath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(records.length, 1);
  assert.equal(records[0].name, "Étudiante Démonstration");
  assert.equal(records[0].email, "etudiante@example.ci");
  assert.equal(records[0].phone, "+2250700000000");
  assert.equal(records[0].status, "pending");
  assert.ok(records[0].createdAt);
  assert.equal("password" in records[0], false);

  const hidden = await fetch(`${baseUrl}/data/registrations.jsonl`);
  assert.equal(hidden.status, 404);
});

test("permet uniquement à l’administrateur de consulter et valider les demandes", async () => {
  const registration = await fetch(`${baseUrl}/api/inscriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Demande à valider",
      email: "validation@example.ci",
      phone: "+2250700000011",
      consent: true
    })
  });
  assert.equal(registration.status, 201);

  const unauthorized = await fetch(`${baseUrl}/api/admin/requests`);
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.headers.get("cache-control"), "no-store");

  const wrongKey = await fetch(`${baseUrl}/api/admin/requests`, {
    headers: { Authorization: "Bearer cle-invalide-qui-ne-doit-pas-fonctionner" }
  });
  assert.equal(wrongKey.status, 401);

  const headers = { Authorization: `Bearer ${adminToken}` };
  const list = await fetch(`${baseUrl}/api/admin/requests`, { headers });
  assert.equal(list.status, 200);
  const requests = (await list.json()).requests;
  const request = requests.find((entry) => entry.email === "validation@example.ci");
  assert.ok(request);
  assert.equal(request.status, "pending");

  const update = async (status) => fetch(`${baseUrl}/api/admin/requests/${request.id}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  const approved = await update("approved");
  assert.equal(approved.status, 200);
  const approvedRequest = (await approved.json()).request;
  assert.equal(approvedRequest.status, "approved");
  assert.equal(approvedRequest.createdAt, request.createdAt);

  const rejected = await update("rejected");
  assert.equal(rejected.status, 200);
  assert.equal((await rejected.json()).request.status, "rejected");

  const pending = await update("pending");
  assert.equal(pending.status, 200);
  const pendingResult = (await pending.json()).request;
  assert.equal(pendingResult.status, "pending");
  assert.equal(pendingResult.reviewedAt, null);

  const updatedList = await fetch(`${baseUrl}/api/admin/requests`, { headers });
  const finalRequest = (await updatedList.json()).requests.find((entry) => entry.id === request.id);
  assert.equal(finalRequest.status, "pending");
  assert.equal((await fetch(`${baseUrl}/data/registrations.jsonl`)).status, 404);
});

test("désactive l’API privée sans clé et limite les tentatives de clé incorrecte", async () => {
  const unconfiguredServer = createServer({
    registrationStorePath: path.join(dataDirectory, "unconfigured.jsonl"),
    adminToken: ""
  });
  await new Promise((resolve) => unconfiguredServer.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${unconfiguredServer.address().port}/api/admin/requests`);
    assert.equal(response.status, 503);
  } finally {
    await new Promise((resolve, reject) => {
      unconfiguredServer.close((error) => error ? reject(error) : resolve());
      unconfiguredServer.closeAllConnections();
    });
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/admin/requests`, {
      headers: { Authorization: "Bearer mauvaise-cle" }
    });
    assert.equal(response.status, 401);
  }
  const limited = await fetch(`${baseUrl}/api/admin/requests`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get("retry-after"));
});

test("migre les anciennes demandes vers le flux de validation manuelle", async () => {
  const legacyStorePath = path.join(dataDirectory, "legacy-registrations.jsonl");
  fs.writeFileSync(legacyStorePath, `${JSON.stringify({
    name: "Ancienne demande",
    email: "legacy@example.ci",
    phone: "+2250700000012",
    status: "information_request",
    createdAt: "2025-01-01T10:00:00.000Z"
  })}\n`);
  const legacyServer = createServer({ registrationStorePath: legacyStorePath, adminToken });
  await new Promise((resolve) => legacyServer.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${legacyServer.address().port}/api/admin/requests`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(response.status, 200);
    const [legacyRequest] = (await response.json()).requests;
    assert.match(legacyRequest.id, /^[0-9a-f-]{36}$/i);
    assert.equal(legacyRequest.status, "pending");

    const decision = await fetch(`http://127.0.0.1:${legacyServer.address().port}/api/admin/requests/${legacyRequest.id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" })
    });
    assert.equal(decision.status, 200);
    assert.equal((await decision.json()).request.status, "approved");
  } finally {
    await new Promise((resolve, reject) => {
      legacyServer.close((error) => error ? reject(error) : resolve());
      legacyServer.closeAllConnections();
    });
  }
});

test("utilise PostgreSQL en production, protège la configuration et sert le domaine public en HTTPS", async () => {
  const validConfig = {
    isProduction: true,
    databaseUrl: "postgres://render.internal/academy",
    adminToken,
    privacyContactEmail: "privacy@example.ci",
    baseUrl: "https://academieagentsfootball.com",
    dataRetentionDays: 180
  };
  assert.throws(() => createServer({ ...validConfig, databaseUrl: "" }), /DATABASE_URL/);
  assert.throws(() => createServer({ ...validConfig, adminToken: "short" }), /ADMIN_TOKEN/);
  assert.throws(() => createServer({ ...validConfig, privacyContactEmail: "invalid" }), /PRIVACY_CONTACT_EMAIL/);
  assert.throws(() => createServer({ ...validConfig, baseUrl: "http://localhost:3000" }), /HTTPS/);
  assert.throws(() => createServer({ ...validConfig, dataRetentionDays: 1 }), /DATA_RETENTION_DAYS/);

  const pool = createFakeDatabasePool();
  const unusedLocalStore = path.join(dataDirectory, "production-file-must-not-be-used.jsonl");
  const databaseServer = createServer({
    ...validConfig,
    databasePool: pool,
    registrationStorePath: unusedLocalStore,
    trustProxy: true
  });
  await databaseServer.databaseReady;
  await new Promise((resolve) => databaseServer.listen(0, "127.0.0.1", resolve));
  const databaseUrl = `http://127.0.0.1:${databaseServer.address().port}`;
  try {
    const health = await fetch(`${databaseUrl}/healthz`);
    assert.equal(health.status, 200);
    assert.equal(health.headers.get("strict-transport-security"), "max-age=31536000; includeSubDomains");

    const privacy = await fetch(`${databaseUrl}/privacy`);
    const policy = await privacy.text();
    assert.match(policy, /privacy@example\.ci/);
    assert.match(policy, /180 jours/);

    const submission = await fetch(`${databaseUrl}/api/inscriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.17" },
      body: JSON.stringify({
        name: "Demande PostgreSQL",
        email: "postgres@example.ci",
        phone: "+2250700000022",
        consent: true
      })
    });
    assert.equal(submission.status, 201);
    assert.equal(pool.registrations.size, 1);

    const requests = await fetch(`${databaseUrl}/api/admin/requests`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const [request] = (await requests.json()).requests;
    assert.equal(request.name, "Demande PostgreSQL");
    const decision = await fetch(`${databaseUrl}/api/admin/requests/${request.id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" })
    });
    assert.equal(decision.status, 200);
    assert.equal((await decision.json()).request.status, "approved");

    const deletion = await fetch(`${databaseUrl}/api/admin/requests/${request.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(deletion.status, 200);
    assert.equal(pool.registrations.size, 0);
    assert.equal(fs.existsSync(unusedLocalStore), false);
  } finally {
    await new Promise((resolve, reject) => {
      databaseServer.close((error) => error ? reject(error) : resolve());
      databaseServer.closeAllConnections();
    });
  }
});

test("ne propose plus les anciennes routes de paiement", async () => {
  const [checkout, order] = await Promise.all([
    fetch(`${baseUrl}/api/checkout`, { method: "POST" }),
    fetch(`${baseUrl}/api/order?session_id=cs_test_example`)
  ]);
  assert.equal(checkout.status, 404);
  assert.equal(order.status, 404);
});
