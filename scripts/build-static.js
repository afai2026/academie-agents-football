const fs = require("node:fs");
const path = require("node:path");

const projectDirectory = path.resolve(__dirname, "..");
const outputDirectory = path.join(projectDirectory, "dist");

function copy(source, destination) {
  const target = path.join(outputDirectory, destination);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(projectDirectory, source), target);
}

function buildStatic() {
  fs.rmSync(outputDirectory, { recursive: true, force: true });
  fs.mkdirSync(outputDirectory, { recursive: true });

  let index = fs.readFileSync(path.join(projectDirectory, "index.html"), "utf8");
  const registrationCard = /<article class="launch-card">[\s\S]*?<\/article>/;
  if (!registrationCard.test(index)) {
    throw new Error("Impossible de trouver le bloc de demande à désactiver dans index.html.");
  }
  index = index.replace(registrationCard, `<article class="launch-card">
            <span class="launch-kicker">01 · REJOINDRE L’ENTRAIDE</span>
            <h3>Demandes temporairement fermées</h3>
            <p>Cette première version gratuite partage les ressources pédagogiques sans recueillir de coordonnées. Les demandes pour rejoindre l’entraide seront annoncées ici lorsque leur traitement manuel et sécurisé sera prêt.</p>
            <p class="launch-note">Aucune inscription ni compte étudiant n’est créé sur ce site.</p>
          </article>`);
  index = index
    .replaceAll("/supports/fiche-revision", "/supports/fiche-revision/")
    .replaceAll("/supports/plan-revision", "/supports/plan-revision/")
    .replaceAll('href="/privacy"', 'href="/privacy/"');
  if (index.includes('id="registration-form"') || index.includes("/api/inscriptions")) {
    throw new Error("Le formulaire de collecte ne doit pas être publié dans la version statique.");
  }
  fs.writeFileSync(path.join(outputDirectory, "index.html"), index, "utf8");

  copy("styles.css", "styles.css");
  copy("app.js", "app.js");
  copy("support.css", "support.css");
  copy("support.html", "supports/fiche-revision/index.html");
  copy("study-plan.html", "supports/plan-revision/index.html");
  copy("privacy-static.html", "privacy/index.html");

  for (const forbiddenFile of ["server.js", "admin.html", "admin.js", "package.json", "render.yaml"]) {
    if (fs.existsSync(path.join(outputDirectory, forbiddenFile))) {
      throw new Error(`Le fichier serveur ${forbiddenFile} ne doit pas être publié.`);
    }
  }
  return outputDirectory;
}

if (require.main === module) {
  try {
    const builtDirectory = buildStatic();
    console.log(`Site statique prêt dans ${builtDirectory}`);
  } catch (error) {
    console.error("Échec de la génération du site statique:", error.message);
    process.exitCode = 1;
  }
}

module.exports = { buildStatic };
