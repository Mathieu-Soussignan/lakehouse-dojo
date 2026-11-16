# Lakehouse Dojo · Édition Keyrus

Une application interactive pour apprendre et maîtriser Databricks en le manipulant, au rythme de chaque collaborateur — qu'il ait assisté ou non à la formation.

Onze modules, **quatorze simulateurs**, un **vrai moteur SQL dans le navigateur** (10 missions sur la Banque Lanterne), **cinq parcours personnalisés selon le profil**, des **playbooks d'architecture client**, un **examen blanc chronométré** (banque de 111 questions), des **notebooks `.ipynb` exportables en 1 clic** pour Databricks Free Edition et un **Dojo d'équipe sans serveur**.

Projet indépendant, non affilié à Databricks ni à ORSYS. Le déroulé couvre le programme « Databricks pour data engineers », mais **aucun contenu de support de cours n'est reproduit** : exercices, données et textes sont originaux.

## Ce que contient l'app

| Espace | Ce que tu y fais |
|---|---|
| **5 Parcours au choix** | **Cursus complet** (11 modules), **Sprint Express « Absents de la formation »** (2 h chrono avec feuille de route interactive), **Consultant BI / SQL & Analytics** (5 modules), **Data Engineer & Indus** (8 modules), **Objectif Certification Associate** (7 modules clés + examen). |
| **Parcours (11 modules)** | Plateforme, compute, Unity Catalog, notebooks, Spark, Delta, orchestration, SQL et BI, ingestion, performance, industrialisation. Quatre preuves par module (leçon, simulateur, lab, quiz) + **Questions d'architecture avec réponses terrain et réflexes consultant Keyrus**. |
| **14 Simulateurs** | Plans de contrôle et de calcul, coût d'un pipeline, cluster policy, droits Unity Catalog, notebook et état caché, shuffle Spark, journal Delta, Repair run, **Pipeline déclaratif (DLT) & Expectations**, Import contre DirectQuery, checkpoint Auto Loader, data skipping, **Diagnostic Spark UI (Skew, Spill, Petits fichiers, Shuffle)**, CI/CD. |
| **Labo SQL (10 missions)** | Moteur DuckDB (WebAssembly) sur la **Banque Lanterne** : registre des défauts, nettoyage, réconciliation `bronze = silver + rejets + doublons` (diagramme de Sankey), taux de change Gold, opérations perdues, podium `QUALIFY`, upsert idempotent J1, **rattrapage d'un lot multi-fichiers sur 3 jours (`arrivee_20260701` à `03`)**, et **requête d'alerte SQL sur les comptes orphelins**, avec **diff visuel** et export CSV. |
| **Labs Databricks (`.ipynb`)** | Export en 1 clic de chaque lab (ou du carnet complet des 11 labs) au format Jupyter / Databricks `.ipynb` prêt à importer dans Databricks Free Edition. |
| **Examen blanc** | 20 questions de scénario tirées d'une banque de 111 questions, 30 minutes, seuil 70 %, bilan détaillé par module. |
| **Flashcards et quiz** | 61 cartes en répétition espacée (Leitner), 56 questions de quiz de module avec explications. |
| **Mémo & Playbooks** | **6 Playbooks d'architecture en mission client** (Unity Catalog multi-env, Power BI Import/DirectQuery/Dual, Auto Loader vs COPY INTO, ADF vs Lakeflow Jobs/DLT, Audit FinOps, Migration SQL Server/Oracle), traducteur d'outils (Snowflake, SQL Server/Synapse, Hadoop/Hive, Airflow/dbt, Python/pandas) et glossaire enrichi. |
| **Dojo d'équipe Keyrus** | Partage de progression **sans serveur** par jeton (`DOJO1:…`) à coller dans Teams, classement local de l'équipe et **superposition du radar de compétences** avec celui d'un collègue. |

`Ctrl` + `K` ouvre la palette de recherche instantanée dans tous les modules, playbooks, missions, simulateurs et termes du glossaire.

## Lancer en local

Aucune installation. Ouvrir `index.html` dans un navigateur, ou servir le dossier :

```bash
python -m http.server 8765
```

Le Labo SQL télécharge DuckDB (environ 7 Mo) depuis jsDelivr la première fois : il faut une connexion internet. Le reste fonctionne hors ligne. La progression est enregistrée dans le navigateur (`localStorage`) ; l'export JSON et le jeton d'équipe `DOJO1:…` permettent de la sauvegarder et de la partager.

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | Structure, styles, thème clair et sombre |
| `app.js` | Navigation, parcours sur-mesure, progression, quiz, flashcards, classement d'équipe et comparaison radar |
| `data.js` | Contenu des 11 modules (leçons, code, pièges, questions/réponses terrain, labs, quiz, cartes), parcours, playbooks et glossaire |
| `sims.js` | Les 14 simulateurs interactifs |
| `lab-missions.js` | Les 10 missions du Labo SQL : chargement, chaîne de référence `ref.*`, indices, variantes d'erreurs, équivalents PySpark/MERGE |
| `sqllab.js` | Moteur DuckDB, éditeur SQL, diff visuel de validation, export CSV, diagramme de flux Sankey |
| `exam-bank.js` | Questions de scénario de l'examen blanc |
| `extras.js` | Examen blanc, palette `Ctrl+K`, export de notebooks `.ipynb`, passeport d'équipe Keyrus (`DOJO1:…`), carte de profil PNG, traducteur |
| `data/lanterne.js` | Jeu de données de la Banque Lanterne (généré) |
| `tools/generate-lanterne.mjs` | Générateur déterministe du jeu de données |

## Licence

MIT pour le code. Les données de la Banque Lanterne sont entièrement fictives.
