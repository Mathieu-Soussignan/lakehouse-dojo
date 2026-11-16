# Lakehouse Dojo

Une app pour apprendre Databricks en le manipulant. Onze modules, douze simulateurs, un **vrai moteur SQL dans le navigateur**, un examen blanc chronométré, des flashcards en répétition espacée et des labs à refaire dans Databricks Free Edition.

Projet indépendant, non affilié à Databricks ni à ORSYS. Le déroulé suit le programme public de la formation « Databricks pour data engineers », mais **aucun contenu de support de cours n'est reproduit** : exercices, données et textes sont originaux.

## Ce que contient l'app

| Espace | Ce que tu y fais |
|---|---|
| **Parcours** | 11 modules : plateforme, compute, Unity Catalog, notebooks, Spark, Delta, orchestration, SQL et BI, ingestion, performance, industrialisation. Quatre preuves par module : leçon, simulateur, lab, quiz. |
| **Simulateurs** | 12 mécanismes à manipuler : plans de contrôle et de calcul, coût d'un pipeline, cluster policy, droits Unity Catalog, notebook et état caché, shuffle Spark, journal Delta, Repair run, Import contre DirectQuery, checkpoint Auto Loader, data skipping, CI/CD. |
| **Labo SQL** | Un moteur DuckDB (WebAssembly) sur la **Banque Lanterne**, une banque fictive dont les fichiers contiennent des défauts. 8 missions bronze → silver → gold, vérifiées contre une chaîne de référence : registre des défauts, nettoyage, rejets, taux de change, podium avec `QUALIFY`, upsert idempotent. |
| **Examen blanc** | 20 questions de scénario tirées de 90 questions, 30 minutes, seuil 70 %, bilan par domaine. |
| **Flashcards et quiz** | 61 cartes, 56 questions avec explications. |
| **Mémo** | Glossaire et traducteur pour qui vient de Snowflake, SQL Server/Synapse, Hadoop/Hive, Airflow/dbt ou Python/pandas. |
| **Progression** | XP, 7 ceintures, 12 sceaux, radar de compétences, carte de profil à télécharger, sauvegarde et restauration en fichier JSON. |

`Ctrl` + `K` ouvre la recherche dans tout le contenu.

## Lancer en local

Aucune installation. Ouvrir `index.html` dans un navigateur, ou servir le dossier :

```bash
python -m http.server 8765
```

Le Labo SQL télécharge DuckDB (environ 7 Mo) depuis jsDelivr la première fois : il faut une connexion internet. Le reste fonctionne hors ligne. La progression est enregistrée dans le navigateur (`localStorage`), propre à chaque adresse et à chaque appareil ; l'export JSON la déplace.

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | Structure, styles, thème clair et sombre |
| `app.js` | Navigation, progression, quiz, flashcards, classement |
| `data.js` | Contenu des modules : leçons, code, pièges, labs, quiz, cartes, glossaire |
| `sims.js` | Les 12 simulateurs |
| `lab-missions.js` | Missions du Labo SQL : SQL de chargement, SQL de référence, indices, équivalents PySpark |
| `sqllab.js` | Moteur DuckDB, éditeur, validation des missions, diagramme de flux |
| `exam-bank.js` | Questions de scénario de l'examen blanc |
| `extras.js` | Examen, palette de commandes, thème, carte de profil, traducteur |
| `data/lanterne.js` | Jeu de données de la Banque Lanterne (généré) |
| `tools/generate-lanterne.mjs` | Générateur déterministe du jeu de données |

## Ajouter du contenu

- **Un module** : un objet dans `data.js` (`points`, `code`, `traps`, `ask`, `lab`, `quiz`, `cards`). Les textes sont des template literals : pas de backtick ni de `${` dedans.
- **Une question d'examen** : une entrée dans `exam-bank.js` avec `m` (le module), `q`, `o` (4 options), `a` (index de la bonne), `e` (explication).
- **Un simulateur** : un objet `{ id, mod, title, tag, mission, mount(root, win) }` dans `sims.js` ; `win()` valide la mission.
- **Une mission SQL** : un objet dans `lab-missions.js`. Elle déclare soit un résultat attendu (`expect`), soit une table à comparer à une table de référence (`table`), et des `variants` : des erreurs classiques, reconnues avec un message qui explique.
- **Régénérer les données** : `node tools/generate-lanterne.mjs`. La graine est fixe, le résultat est identique à chaque exécution.

## Publier

Quatre fichiers statiques et un dossier de données : n'importe quel hébergement statique convient. Avec GitHub Pages : Settings, Pages, Deploy from a branch, `main`, dossier racine.

Le classement d'équipe ne s'active que lorsque la page est publiée comme artifact claude.ai. Partout ailleurs il reste masqué et le reste fonctionne à l'identique.

## Limites connues

- Le contenu a été relu contre la documentation officielle, mais pas validé par Databricks. Les tarifs du simulateur de coût sont des ordres de grandeur.
- Les labs Databricks n'ont pas été exécutés dans un workspace réel ; le Labo SQL, lui, est vérifié de bout en bout dans le navigateur.
- Le moteur du labo est DuckDB, pas Spark : le dialecte est proche mais il n'a pas `MERGE INTO`. Les différences utiles sont listées dans l'interface.

## Licence

MIT pour le code. Les données de la Banque Lanterne sont entièrement fictives.
