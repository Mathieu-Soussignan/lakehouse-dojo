# Lakehouse Dojo · Édition Keyrus (Trinité Python · Spark · Databricks)

Une application interactive pour apprendre et maîtriser **Python pour la Data, Apache Spark / PySpark et Databricks** en les manipulant directement dans le navigateur, au rythme de chaque collaborateur — qu'il ait assisté ou non à la formation.

Onze modules, **dix-sept simulateurs**, une **Académie de code en 3 étages** (interpréteur Python Data + compilateur PySpark Catalyst + vrai moteur SQL DuckDB-WASM sur les **24 missions** de la Banque Lanterne), **sept parcours personnalisés selon le profil**, **trois anti-sèches opérationnelles**, **huit playbooks d'architecture client**, un **examen blanc chronométré** (banque de 117 questions), des **notebooks `.ipynb` et un Starter Kit Asset Bundle exportables en 1 clic** et un **Dojo d'équipe sans serveur**.

Projet indépendant, non affilié à Databricks ni à ORSYS. Le déroulé couvre le programme « Databricks pour data engineers », mais **aucun contenu de support de cours n'est reproduit** : exercices, données et textes sont originaux.

## Ce que contient l'app

| Espace | Ce que tu y fais |
|---|---|
| **7 Parcours au choix** | **Cursus complet** (11 modules), **Trinité Python + Spark + Databricks (Zéro → Hero)**, **Initiation Python & PySpark (14 paliers guidés)**, **Sprint Express « Absents de la formation »** (2 h chrono), **Consultant BI / SQL & Analytics** (5 modules), **Data Engineer & Indus** (8 modules), **Objectif Certification Associate** (7 modules clés + examen). |
| **Parcours (11 modules)** | Plateforme, compute, Unity Catalog, **Notebooks & Python pour la Data**, **Fondamentaux & Patterns de Spark / PySpark**, Delta Lake, orchestration, SQL et BI, ingestion, performance, industrialisation. Quatre preuves par module + **Questions d'architecture avec réponses terrain et réflexes consultant Keyrus**. |
| **17 Simulateurs** | Plans de contrôle et de calcul, coût d'un pipeline, cluster policy, droits Unity Catalog, notebook et état caché, **Python sur le Driver vs Spark sur les Workers (L'Anti-UDF)**, paresse et shuffle Spark, **De SQL à PySpark : brique par brique**, journal Delta, Repair run, **Pipeline déclaratif (DLT) & Expectations**, Import contre DirectQuery, checkpoint Auto Loader, data skipping, **Diagnostic Spark UI (Skew, Spill, Petits fichiers, Shuffle)**, CI/CD, **Clinique des Stacktraces (Déboguer la Prod)**. |
| **Académie Code (24 missions en 3 étages)** | **1) 🐍 École Python pour la Data (`P1–P4`)** : variables, `f-strings`, listes, boucles `for` sur les métadonnées, dictionnaires, `.fillna()`, fonctions pures `def`, `.transform()` et tests unitaires `assert` + console `print()`.<br>**2) ⚡ École Spark & PySpark (`S1–S10`)** : de `.select()` et `.filter()` jusqu'à `F.coalesce()`, `F.substring()`, `F.datediff()`, `Window.partitionBy()` et `F.broadcast()` avec **graphe visuel du plan physique Catalyst (`explain`)**.<br>**3) 🏦 Pipeline Banque Lanterne (`M0–M9`, bilingue SQL & PySpark)** : registre des défauts, nettoyage, réconciliation `bronze = silver + rejets + doublons` (diagramme de Sankey), taux de change Gold, opérations perdues, podium `QUALIFY`, upsert idempotent J1, rattrapage multi-fichiers sur 3 jours et alerte SQL sur les comptes orphelins. |
| **Labs Databricks (`.ipynb`) & Starter Kit DAB** | Export en 1 clic de chaque lab (ou du carnet complet des 11 labs) au format Jupyter / Databricks `.ipynb` + **Générateur de Starter Kit Asset Bundle** (`databricks.yml`, Auto Loader, MERGE testable, Gold Liquid Clustering, `pytest` et GitHub Actions). |
| **Examen blanc** | 20 questions de scénario tirées d'une banque de 117 questions, 30 minutes, seuil 70 %, bilan détaillé par module. |
| **Flashcards et quiz** | 62 cartes en répétition espacée (Leitner), 57 questions de quiz de module avec explications. |
| **Mémo, 3 Anti-sèches & 8 Playbooks** | **3 Anti-sèches opérationnelles** (🐍 Python Data Engineer, ⚡ Dictionnaire SQL ⇄ PySpark en 22 gestes, 🧱 Databricks/Delta/CLI), **8 Playbooks d'architecture en mission client** (Unity Catalog multi-env, Power BI Import/DirectQuery/Dual, Auto Loader vs COPY INTO, ADF vs Lakeflow Jobs/DLT, Audit FinOps, Migration SQL Server/Oracle, Code Python/PySpark testable, Flux JSON complexes), traducteur d'outils et glossaire. |
| **Dojo d'équipe Keyrus** | Partage de progression **sans serveur** par lien magique 1-clic (`#peer-DOJO1:…`) à coller dans Teams, classement local de l'équipe et **superposition du radar de compétences** avec celui d'un collègue. |

`Ctrl` + `K` ouvre la palette de recherche instantanée dans tous les modules, playbooks, missions, simulateurs et termes du glossaire.

## Lancer en local

Aucune installation. Ouvrir `index.html` dans un navigateur, ou servir le dossier :

```bash
python -m http.server 8765
```

L'Académie Code télécharge DuckDB (environ 7 Mo) depuis jsDelivr la première fois : il faut une connexion internet. Le reste fonctionne hors ligne. La progression est enregistrée dans le navigateur (`localStorage`) ; l'export JSON et le jeton d'équipe `DOJO1:…` permettent de la sauvegarder et de la partager.

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | Structure, styles, thème clair et sombre |
| `app.js` | Navigation, parcours sur-mesure, progression, quiz, flashcards, 3 anti-sèches, classement d'équipe et comparaison radar |
| `data.js` | Contenu des 11 modules (leçons, code, pièges, questions/réponses terrain, labs, quiz, cartes), parcours, playbooks et glossaire |
| `sims.js` | Les 17 simulateurs interactifs |
| `lab-missions.js` | Les 24 missions de l'Académie (École Python `P1–P4`, École Spark `S1–S10`, Banque Lanterne `M0–M9`) |
| `sqllab.js` | Moteur DuckDB, interpréteur Python Data & compilateur PySpark Catalyst, graphe physique `explain()`, diff visuel, diagramme Sankey |
| `exam-bank.js` | Questions de scénario de l'examen blanc |
| `extras.js` | Examen blanc, palette `Ctrl+K`, export de notebooks `.ipynb`, Starter Kit Asset Bundle, lien magique 1-clic (`DOJO1:…`), carte de profil PNG, traducteur |
| `data/lanterne.js` | Jeu de données de la Banque Lanterne (généré) |
| `tools/generate-lanterne.mjs` | Générateur déterministe du jeu de données |

## Licence

MIT pour le code. Les données de la Banque Lanterne sont entièrement fictives.
