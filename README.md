# Académie Africaine des Agents de Football

Site de présentation d’un organisme privé et indépendant de préparation à l’examen officiel de la FIFA pour les futurs agents de football, avec un accent sur la Côte d’Ivoire, le Sénégal, le Cameroun, la RD Congo, le Maroc, le Bénin et le Togo.

L’académie n’est ni agréée, ni affiliée, ni partenaire de la FIFA. Sa préparation ne garantit pas la réussite à l’examen ni l’obtention d’une licence. Les modalités et contenus officiels sont à vérifier auprès des publications de la FIFA.

## Démarrer en local

1. Installez Node.js 18 ou une version ultérieure.
2. Dans ce dossier, lancez le serveur :

```powershell
npm start
```

Ouvrez ensuite <http://localhost:3000>. Le site propose librement un plan de révision sur un mois, une fiche de révision imprimable, une banque de QCM corrigés et un examen blanc d’entraînement chronométré. Les fiches s’impriment ou s’enregistrent au format PDF depuis le navigateur, sans compte. Le QCM, l’examen blanc et les fiches sont des supports pédagogiques originaux, non officiels, qui ne reproduisent pas l’examen FIFA.

Le projet a une vocation sociale : faciliter l’accès des jeunes Africains à des ressources de préparation et à l’entraide autour des examens d’agent de football. Aucun service de paiement ni collecte de frais n’est proposé sur le site. Les services tiers présentés ne sont pas connectés au site.

Le formulaire recueille des demandes pour rejoindre l’entraide. Chaque demande reste en attente jusqu’à votre décision dans l’espace privé `/admin` ; aucune inscription n’est acceptée automatiquement, aucun compte étudiant n’est créé et aucun courriel n’est envoyé. La page `/privacy` décrit l’utilisation et la durée de conservation des données.

Sans `DATABASE_URL`, les demandes locales sont ajoutées à `data/registrations.jsonl`, un fichier ignoré par Git et qui n’est jamais exposé par une route publique. Ce mode est réservé au développement. En production, le serveur refuse de démarrer sans PostgreSQL.

### Valider les demandes

L’espace `/admin` exige la clé secrète `ADMIN_TOKEN` configurée dans l’environnement du serveur. Créez une clé aléatoire d’au moins 32 caractères et ne la placez jamais dans le dépôt. Sous PowerShell, vous pouvez en générer une et la définir pour la session en cours avant le démarrage :

```powershell
$env:ADMIN_TOKEN = (& node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")
npm start
```

Gardez cette clé privée. La page admin la conserve uniquement en mémoire pendant la session du navigateur. Les demandes peuvent être acceptées, refusées ou remises en attente ; contactez vous-même les personnes après votre décision. Sans clé correctement configurée, l’API privée répond qu’elle n’est pas disponible.

Le stockage local convient uniquement au développement. En production, les demandes sont enregistrées dans PostgreSQL et automatiquement supprimées après `DATA_RETENTION_DAYS` (180 jours par défaut, entre 30 et 730 jours).

## Première publication gratuite sur Render

Le choix actuel est une version statique gratuite. Le fichier `render.yaml` décrit le site statique Render et `npm run build:static` crée `dist/` à partir d’une liste blanche de ressources pédagogiques : le serveur Node, l’administration et les fichiers internes ne sont pas publiés. Le formulaire de collecte et la validation manuelle sont désactivés dans cette première version ; `/privacy/` explique qu’aucune demande n’est recueillie. Le dossier `dist/` est généré et ignoré par Git.

Le dépôt source `https://github.com/afai2026/academie-agents-football` est public, comme choisi par le propriétaire ; son code source est visible à tous. La version statique publiée exclut le serveur et l’administration. Les sites statiques Render n’ont pas de frais de calcul, mais leur bande passante et leurs minutes de construction sont soumises aux quotas du compte : vérifiez la page de facturation et les règles de dépassement Render, n’ajoutez pas de moyen de paiement si vous ne souhaitez aucune dépense et acceptez qu’un site puisse être suspendu s’il dépasse les quotas gratuits.

1. Connectez le dépôt GitHub `afai2026/academie-agents-football` à Render, en vérifiant que Render a accès au dépôt public.
2. Dans Render, choisissez **New > Blueprint**, connectez le dépôt et confirmez que Render détecte `render.yaml`. La première configuration n’exige ni base de données, ni variable secrète, ni moyen de paiement.
3. Déclenchez le déploiement manuel et attendez son succès. Ouvrez le domaine gratuit `onrender.com` affiché sur la page du service et vérifiez les ressources, le plan mensuel, les QCM et `/privacy/`.
4. Ajoutez des en-têtes de sécurité dans **Settings > Headers** du site statique Render : `/*` avec `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` et `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'`.

Le domaine `academieagentsfootball.com` n’est pas encore acheté ou configuré. Vous pourrez le connecter plus tard si vous en devenez propriétaire ; Render indique les valeurs DNS exactes dans **Settings > Custom Domains** et fournit le TLS. La disponibilité du domaine et son prix n’ont pas été vérifiés.

### Réactiver les demandes plus tard

Ne réactivez pas le formulaire sur un hébergement statique : il ne peut pas protéger ni conserver les demandes. La version Node du serveur est prévue pour un hébergement web payant avec PostgreSQL, une clé `ADMIN_TOKEN` d’au moins 32 caractères et un contact public configuré. Render indique que sa base gratuite expire après 30 jours ; avant d’ouvrir les demandes, utilisez une base adaptée à la production, relisez la politique de confidentialité et confirmez les coûts du service. Aucun service payant ne doit être créé sans votre accord explicite.

## Tests

```powershell
npm test
```
