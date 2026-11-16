// Contenu pédagogique du Lakehouse Dojo.
// Règle d'écriture : tout le texte est en template literals, donc pas de backtick ni de "${" dans le contenu.
window.DOJO = {
  modules: [
    {
      id: `m1`, day: `J1`, title: `Lakehouse et plateforme`, sub: `Architecture, plans de contrôle et de calcul, médaillon`,
      points: [
        `Un <b>lakehouse</b> = des fichiers ouverts (Parquet) sur un stockage objet (ADLS Gen2) + une couche transactionnelle (<b>Delta Lake</b>) + un moteur (Spark / Photon). On obtient la souplesse d'un data lake et les garanties d'un entrepôt.`,
        `<b>Plan de contrôle</b> (géré par Databricks) : interface web, notebooks, ordonnanceur de jobs, Unity Catalog. <b>Plan de calcul</b> : les machines qui exécutent le code. En classique elles tournent dans <i>ton</i> abonnement Azure ; en serverless, dans celui de Databricks.`,
        `Sur Azure, créer un workspace crée aussi un <b>managed resource group</b> (VM, disques, réseau) que tu ne dois pas modifier à la main.`,
        `Les données restent dans <b>ton</b> stockage. Databricks y accède via une identité managée (Access Connector) déclarée dans Unity Catalog.`,
        `<b>Architecture médaillon</b> : Bronze (brut, tel que reçu, historisé), Silver (nettoyé, typé, dédoublonné), Gold (agrégé, modélisé pour l'usage métier).`,
        `Un seul socle sert le data engineering, le SQL/BI, le streaming et le ML : c'est l'argument principal face à une pile « lac + entrepôt » séparée.`
      ],
      code: [],
      traps: [
        `Confondre Databricks et Spark : Spark est le moteur open source, Databricks est la plateforme autour (gouvernance, orchestration, SQL, optimisations propriétaires comme Photon).`,
        `Croire que les données « sont dans Databricks » : elles sont dans ton compte de stockage, au format ouvert Delta.`,
        `Mettre de la logique métier dans le Bronze : il doit rester rejouable et fidèle à la source.`
      ],
      ask: [
        `Quand choisir Azure Databricks plutôt que Microsoft Fabric ou Synapse ?`,
        `Comment organiser les workspaces et les catalogues entre dev, recette et prod ?`,
        `Quelles contraintes réseau (VNet injection, Private Link) rencontre-t-on chez les clients ?`
      ],
      answers: [
        `<b>Synthèse :</b> Choisis <b>Azure Databricks</b> dès qu'il y a de la donnée volumineuse ou complexe, du code (PySpark, Scala, ML, CI/CD poussé), du multi-cloud ou un besoin de maturité sur le streaming et l'ingénierie logicielle. <b>Microsoft Fabric</b> séduit les équipes très centrées Power BI / M365 avec peu de code. <b>Synapse</b> est désormais en retrait côté Microsoft au profit de Fabric.<br><b>Réflexe Keyrus :</b> Chez beaucoup de grands comptes, l'architecture cible combine <i>Azure Databricks</i> pour le socle Data Engineering / Data Science (Bronze → Silver → Gold) et <i>Power BI / Fabric</i> pour la restitution métier.`,
        `<b>Synthèse :</b> Le standard moderne repose sur <b>un seul metastore Unity Catalog par région</b>, puis une isolation par <b>catalogues</b> (<code>domaine_dev</code>, <code>domaine_uat</code>, <code>domaine_prod</code>). Côté workspaces : soit un workspace par environnement (idéal pour isoler fortement la prod), soit un workspace mutualisé pour dev/uat et un dédié pour la prod.<br><b>Réflexe Keyrus :</b> Paramètre toujours le nom du catalogue en variable dans ton code ou ton bundle (<code>databricks.yml</code>) pour promouvoir de dev en prod sans toucher une ligne de SQL ou de Python.`,
        `<b>Synthèse :</b> En entreprise, le workspace n'est presque jamais déployé sur un réseau public par défaut : on utilise <b>VNet Injection</b> (les clusters tournent dans le VNet du client, filtrés par NSG/pare-feu) et <b>Private Link</b> (flux privés entre plan de contrôle, plan de calcul et stockage ADLS sans passer par Internet).<br><b>Réflexe Keyrus :</b> Si le client utilise le calcul <i>Serverless</i>, pense à anticiper l'ouverture des <i>Network Connectivity Configurations (NCC)</i> et des Private Endpoints vers son stockage ADLS.`
      ],
      lab: {
        title: `Prendre ses marques dans le workspace`, time: `20 min`,
        steps: [
          `Crée un compte Databricks Free Edition et ouvre le workspace.`,
          `Repère dans le menu de gauche : Workspace, Catalog, Jobs &amp; Pipelines, Compute, SQL Editor, Dashboards.`,
          `Dans Catalog, explore le catalogue <code>samples</code> et ouvre la table <code>samples.nyctaxi.trips</code> (onglets Schema, Sample data, Lineage).`,
          `Dessine sur papier le médaillon que tu construirais à partir de cette table (une table bronze, une silver, deux gold).`
        ],
        sol: `-- Pas de code ici. Vérifie simplement que tu sais répondre :
-- 1. Où sont stockés physiquement les fichiers d'une table ?
-- 2. Qui exécute ma requête : plan de contrôle ou plan de calcul ?
-- 3. Quelle couche du médaillon un analyste doit-il interroger ?`
      },
      quiz: [
        { q: `Qu'apporte Delta Lake par rapport à de simples fichiers Parquet ?`, o: [`Une compression plus forte`, `Un journal de transactions qui donne ACID, historique et MERGE`, `Un format propriétaire plus rapide`, `Le chiffrement des données`], a: 1, e: `Delta = Parquet + un journal de transactions (_delta_log). C'est ce journal qui apporte l'atomicité, le time travel et les mises à jour.` },
        { q: `En mode classique (non serverless) sur Azure, où tournent les VM des clusters ?`, o: [`Dans l'abonnement Azure du client`, `Dans l'abonnement de Databricks`, `Chez Microsoft, hors de tout abonnement`, `Sur le poste de l'utilisateur`], a: 0, e: `Le plan de calcul classique est déployé dans l'abonnement du client, dans le managed resource group.` },
        { q: `Quelle couche du médaillon contient les données nettoyées, typées et dédoublonnées ?`, o: [`Bronze`, `Silver`, `Gold`, `Platinum`], a: 1, e: `Bronze = brut, Silver = nettoyé et conforme, Gold = agrégé pour le métier.` },
        { q: `Lequel de ces éléments appartient au plan de contrôle ?`, o: [`Les exécuteurs Spark`, `Le compte de stockage ADLS`, `L'ordonnanceur de jobs et l'interface web`, `Les disques des VM`], a: 2, e: `Le plan de contrôle héberge l'interface, les notebooks, l'ordonnancement et les métadonnées.` },
        { q: `Pourquoi garder le Bronze aussi proche que possible de la source ?`, o: [`Pour réduire les coûts de stockage`, `Pour pouvoir rejouer les traitements en aval sans redemander les données`, `Parce que Delta l'impose`, `Pour accélérer les dashboards`], a: 1, e: `Un Bronze fidèle permet de reconstruire Silver et Gold après une correction de règle métier.` }
      ],
      cards: [
        [`Lakehouse : définition en une phrase`, `Stockage objet ouvert + couche transactionnelle Delta + moteur unique pour BI, data engineering et ML.`],
        [`Plan de contrôle vs plan de calcul`, `Contrôle : interface, jobs, métadonnées (chez Databricks). Calcul : les machines qui exécutent (chez le client en classique, chez Databricks en serverless).`],
        [`Médaillon : les 3 couches`, `Bronze = brut et rejouable. Silver = nettoyé et conforme. Gold = agrégé pour l'usage métier.`],
        [`À quoi sert l'Access Connector sur Azure ?`, `C'est l'identité managée par laquelle Unity Catalog accède au stockage ADLS.`],
        [`Qu'est-ce que le managed resource group ?`, `Le groupe de ressources Azure créé avec le workspace, qui contient VM, disques et réseau du plan de calcul classique.`]
      ]
    },
    {
      id: `m2`, day: `J1`, title: `Compute : clusters et SQL warehouses`, sub: `Types de calcul, modes d'accès, coûts`,
      points: [
        `<b>All-purpose compute</b> : cluster interactif pour développer en notebook. Le plus cher au DBU. <b>Job compute</b> : cluster créé pour un job puis détruit, moins cher : c'est le choix par défaut en production.`,
        `<b>Serverless</b> : démarrage en quelques secondes, rien à dimensionner, facturation à l'usage. Disponible pour les notebooks, les jobs, les pipelines et le SQL.`,
        `<b>SQL warehouse</b> : calcul dédié au SQL et à la BI (éditeur SQL, dashboards, Power BI). Tailles « T-shirt » (2X-Small à 4X-Large), auto-stop, mise à l'échelle par ajout de clusters.`,
        `<b>Modes d'accès</b> : <i>Standard</i> (ex-Shared, multi-utilisateurs, isolation) et <i>Dedicated</i> (ex-Single user, un utilisateur ou un groupe). Les deux sont compatibles Unity Catalog.`,
        `Un cluster = 1 <b>driver</b> (planifie, collecte les résultats) + N <b>workers</b> (exécutent). L'<b>autoscaling</b> fait varier N entre un min et un max.`,
        `Coût = <b>DBU</b> (payés à Databricks, tarif selon le type de calcul) + VM Azure (en classique). L'<b>auto-termination</b> et les <b>cluster policies</b> sont les deux premiers garde-fous. Une policy est un JSON où chaque champ est <b>fixed</b> (imposé), borné (<b>range</b>, <b>allowlist</b>) ou <b>unlimited</b>, et peut être masqué (<b>hidden</b>) : essaie-la dans le simulateur.`,
        `<b>Photon</b> : moteur d'exécution vectorisé en C++, nettement plus rapide sur le SQL et les DataFrames, avec un tarif DBU plus élevé.`,
        `La <b>Databricks Runtime</b> (DBR) fixe les versions de Spark, Delta et des bibliothèques. Préfère une version LTS en production.`
      ],
      code: [],
      traps: [
        `Lancer les jobs de production sur un cluster all-purpose : c'est payer le tarif interactif pour du batch.`,
        `Oublier l'auto-termination sur un cluster de dev : il tourne tout le week-end.`,
        `Faire un <code>collect()</code> ou un <code>toPandas()</code> sur un gros DataFrame : tout remonte sur le driver, qui tombe en mémoire.`
      ],
      ask: [
        `Sur quels critères trancher entre serverless et job cluster classique ?`,
        `Comment dimensionner un cluster (type de VM, nombre de workers) pour un premier pipeline ?`,
        `Quelles cluster policies mettre en place dès le départ chez un client ?`
      ],
      answers: [
        `<b>Synthèse :</b> Le <b>Serverless</b> démarre en 2 à 5 secondes (contre 3 à 5 minutes en classique) et évite de payer des VM qui attendent. Pour des jobs courts (&lt; 30 min), fréquents ou imprévisibles, le Serverless revient souvent moins cher malgré un prix facial DBU plus élevé. Le <b>Job cluster classique</b> garde l'avantage sur des traitements très longs et réguliers, ou quand le client impose des VM spécifiques / librairies système.<br><b>Réflexe Keyrus :</b> Utilise <i>Serverless SQL Warehouse</i> par défaut pour toute la BI et les requêtes ad-hoc : l'arrêt à 1 minute d'inactivité et le réveil instantané écrasent le coût d'un warehouse classique.`,
        `<b>Synthèse :</b> Commence petit ! Pour un pipeline de quelques dizaines de Go, un cluster <b>Job compute</b> de 2 à 4 workers (ex. <code>Standard_D4ds_v5</code>, 4 vCPU / 16 Go RAM) ou même un <b>Single Node</b> pour &lt; 5 Go suffit largement. Active Photon uniquement si le traitement est dominé par du scan/join/agg massif et vérifie que le gain de temps compense le surcoût DBU.<br><b>Réflexe Keyrus :</b> Ne dimensionne jamais à l'aveugle : fais un premier run, ouvre la <i>Spark UI / Ganglia / Metrics</i> et regarde si le goulot est le CPU, la mémoire (spill) ou l'I/O.`,
        `<b>Synthèse :</b> Trois policies indispensables dès le jour 1 : <b>1) Exploration / Dev individuel</b> (Single Node ou 1–2 workers max, <code>autotermination_minutes</code> fixé à 15–20 min, liste fermée de petites VM), <b>2) Cluster partagé d'équipe</b> (autoscaling borné 1–4 workers, auto-stop 30 min), <b>3) Job de production</b> (réservé aux Service Principals, version LTS imposée, tags FinOps obligatoires).`
      ],
      lab: {
        title: `Lire un écran de configuration de calcul`, time: `15 min`,
        steps: [
          `Ouvre Compute. En Free Edition tout est serverless : note ce que tu ne peux pas régler (taille, runtime, autoscaling).`,
          `Ouvre SQL Warehouses et regarde les réglages du warehouse : taille, auto-stop, scaling.`,
          `Lance la requête ci-dessous dans l'éditeur SQL, puis ouvre le <b>Query profile</b> : repère le temps passé en scan et en agrégation.`,
          `En formation, sur l'environnement Azure, crée un cluster classique et compare chaque réglage avec ce que tu as noté.`
        ],
        sol: `SELECT pickup_zip, count(*) AS courses, round(avg(fare_amount), 2) AS prix_moyen
FROM samples.nyctaxi.trips
GROUP BY pickup_zip
ORDER BY courses DESC
LIMIT 10;`
      },
      quiz: [
        { q: `Quel type de calcul choisir pour un pipeline planifié chaque nuit ?`, o: [`All-purpose cluster partagé`, `Job compute (ou serverless jobs)`, `SQL warehouse Pro`, `Le cluster du développeur`], a: 1, e: `Le job compute est créé pour l'exécution puis détruit, à un tarif DBU inférieur à l'interactif.` },
        { q: `Que facture un DBU ?`, o: [`Le stockage des tables`, `L'usage de la plateforme Databricks, selon le type de calcul`, `Le trafic réseau sortant`, `Le nombre d'utilisateurs`], a: 1, e: `Le DBU est l'unité de consommation Databricks. En classique, les VM Azure sont facturées en plus par Microsoft.` },
        { q: `Quel est le rôle du driver ?`, o: [`Stocker les tables Delta`, `Planifier l'exécution et rassembler les résultats`, `Chiffrer les données`, `Gérer les droits Unity Catalog`], a: 1, e: `Le driver porte la session Spark, construit le plan et coordonne les workers.` },
        { q: `Quel calcul utilise Power BI pour interroger Databricks en production ?`, o: [`Un job cluster`, `Un SQL warehouse`, `Un pipeline déclaratif`, `Le driver d'un notebook`], a: 1, e: `Les outils BI se connectent au hostname et au HTTP path d'un SQL warehouse.` },
        { q: `Quel mode d'accès permet à plusieurs utilisateurs de partager un cluster avec isolation ?`, o: [`Dedicated`, `Standard`, `No isolation`, `Photon`], a: 1, e: `Standard (anciennement Shared) isole les utilisateurs entre eux. Dedicated est attribué à un utilisateur ou à un groupe.` }
      ],
      cards: [
        [`All-purpose vs job compute`, `All-purpose : interactif, persistant, cher. Job : éphémère, créé pour un run, moins cher. Production = job compute.`],
        [`À quoi sert un SQL warehouse ?`, `Au SQL et à la BI : éditeur SQL, dashboards, alertes, connexions Power BI / JDBC.`],
        [`Modes d'accès d'un cluster`, `Standard (ex-Shared) : multi-utilisateurs isolés. Dedicated (ex-Single user) : un utilisateur ou un groupe.`],
        [`Photon`, `Moteur vectorisé C++ qui accélère SQL et DataFrames, facturé à un tarif DBU supérieur.`],
        [`Deux garde-fous de coût de base`, `Auto-termination sur les clusters interactifs et cluster policies pour borner tailles et types.`],
        [`Pourquoi éviter collect() sur un gros volume ?`, `Tout est ramené en mémoire sur le driver : risque d'OutOfMemory.`]
      ]
    },
    {
      id: `m3`, day: `J1`, title: `Unity Catalog`, sub: `Gouvernance, objets, droits, fédération`,
      points: [
        `Hiérarchie : <b>metastore</b> (un par région) → <b>catalogue</b> → <b>schéma</b> → tables, vues, volumes, fonctions, modèles. On nomme toujours en trois niveaux : <code>catalogue.schema.table</code>.`,
        `<b>Table managée</b> : Unity Catalog gère les fichiers. Un DROP déclenche une suppression différée : les données restent récupérables avec <code>UNDROP TABLE</code> pendant 7 jours par défaut. <b>Table externe</b> : tu fournis un chemin ; un DROP ne supprime que la métadonnée et les fichiers restent dans ton stockage.`,
        `<b>Volume</b> : gouvernance des fichiers non tabulaires (CSV, JSON, images). Chemin : <code>/Volumes/catalogue/schema/volume/...</code>`,
        `Accès au stockage : <b>storage credential</b> (l'identité) + <b>external location</b> (un chemin ADLS autorisé avec cette identité). Côté Azure, l'identité de l'Access Connector doit en plus avoir un rôle RBAC sur le compte de stockage (Storage Blob Data Reader ou Contributor). Azure authentifie, Unity Catalog autorise : un refus peut venir de l'un ou de l'autre.`,
        `Droits : il faut <code>USE CATALOG</code> + <code>USE SCHEMA</code> + le privilège sur l'objet (<code>SELECT</code>, <code>MODIFY</code>...). Les droits s'héritent vers le bas. Attribue-les à des <b>groupes</b>, pas à des personnes.`,
        `<b>Lakehouse Federation</b> : une <i>connection</i> + un <i>foreign catalog</i> permettent d'interroger une base externe (SQL Server, PostgreSQL, Snowflake...) sans copier les données.`,
        `Le <b>lineage</b> (tables et colonnes) et les journaux d'audit sont collectés automatiquement.`,
        `Sécurité fine : <b>row filters</b> et <b>column masks</b>, ou vues dynamiques avec <code>is_account_group_member()</code>.`
      ],
      code: [
        { t: `Créer et sécuriser`, c: `CREATE CATALOG IF NOT EXISTS ventes_dev;
CREATE SCHEMA IF NOT EXISTS ventes_dev.silver;

CREATE TABLE ventes_dev.silver.clients (
  id BIGINT, nom STRING, pays STRING
);

GRANT USE CATALOG ON CATALOG ventes_dev TO data_analysts;
GRANT USE SCHEMA ON SCHEMA ventes_dev.silver TO data_analysts;
GRANT SELECT ON TABLE ventes_dev.silver.clients TO data_analysts;

SHOW GRANTS ON TABLE ventes_dev.silver.clients;` },
        { t: `Fédérer une base SQL Server`, c: `CREATE CONNECTION crm_sqlserver TYPE sqlserver
OPTIONS (host 'monserveur.database.windows.net', port '1433',
         user secret('scope_crm', 'user'), password secret('scope_crm', 'pwd'));

CREATE FOREIGN CATALOG crm USING CONNECTION crm_sqlserver
OPTIONS (database 'CRM');

SELECT * FROM crm.dbo.comptes LIMIT 10;` }
      ],
      traps: [
        `Donner SELECT sur une table sans USE CATALOG ni USE SCHEMA : l'utilisateur ne voit rien.`,
        `Faire un DROP sur une table managée en pensant que les fichiers restent.`,
        `Continuer à utiliser <code>hive_metastore</code> et les montages DBFS (<code>/mnt</code>) : c'est l'ancien modèle, sans gouvernance fine.`
      ],
      ask: [
        `Un catalogue par environnement, par domaine, ou les deux ?`,
        `Tables managées ou externes : que recommandez-vous par défaut, et pourquoi ?`,
        `Fédération ou ingestion : à partir de quand faut-il copier les données ?`
      ],
      answers: [
        `<b>Synthèse :</b> Chez un client mono-domaine, <code>dev</code> / <code>uat</code> / <code>prod</code> suffit. Dès qu'il y a plusieurs domaines métiers (finance, retail, RH), le patron recommandé est <b><code>&lt;domaine&gt;_&lt;env&gt;</code></b> (ex. <code>finance_dev</code>, <code>finance_prod</code>) avec les couches en schémas (<code>bronze</code>, <code>silver</code>, <code>gold</code>).<br><b>Réflexe Keyrus :</b> Cela permet d'isoler à la fois les emplacements de stockage ADLS (un conteneur par domaine/env) et les groupes d'accès Entra ID sans multiplier les metastores.`,
        `<b>Synthèse :</b> Databricks recommande désormais les <b>tables managées par défaut</b> : elles bénéficient automatiquement de <i>Predictive Optimization</i> (OPTIMIZE, VACUUM et ANALYZE gérés en arrière-plan), d'<code>UNDROP TABLE</code> pendant 7 jours et de meilleures performances. On réserve les <b>tables externes</b> aux données déjà produites par d'autres moteurs hors Databricks ou quand une exigence réglementaire impose un contrôle strict du chemin de fichiers.`,
        `<b>Synthèse :</b> <b>Lakehouse Federation</b> est idéale pour l'exploration rapide, des référentiels de petite taille (&lt; quelques millions de lignes) ou des jointures ponctuelles. Dès qu'une table externe est volumineuse, interrogée fréquemment par des dashboards, ou nécessite un historique (Time Travel), **il faut l'ingérer en Delta** pour ne pas saturer la base transactionnelle source.`
      ],
      lab: {
        title: `Schéma, table, volume et droits`, time: `25 min`,
        steps: [
          `Crée un schéma <code>dojo</code> dans le catalogue <code>workspace</code>.`,
          `Crée une table managée <code>courses_bronze</code> à partir de <code>samples.nyctaxi.trips</code>.`,
          `Crée un volume <code>fichiers</code> et repère son chemin <code>/Volumes/...</code>.`,
          `Affiche le détail de la table (emplacement, format) et ses droits.`,
          `Ouvre l'onglet Lineage de la table dans Catalog Explorer.`
        ],
        sol: `CREATE SCHEMA IF NOT EXISTS workspace.dojo;

CREATE OR REPLACE TABLE workspace.dojo.courses_bronze AS
SELECT * FROM samples.nyctaxi.trips;

CREATE VOLUME IF NOT EXISTS workspace.dojo.fichiers;

DESCRIBE DETAIL workspace.dojo.courses_bronze;
DESCRIBE EXTENDED workspace.dojo.courses_bronze;
SHOW GRANTS ON TABLE workspace.dojo.courses_bronze;`
      },
      quiz: [
        { q: `Quel est l'ordre correct de la hiérarchie Unity Catalog ?`, o: [`Schéma → catalogue → table`, `Metastore → catalogue → schéma → table`, `Workspace → schéma → catalogue`, `Catalogue → metastore → table`], a: 1, e: `Metastore, puis catalogue, puis schéma, puis les objets.` },
        { q: `Que se passe-t-il quand on fait DROP sur une table externe ?`, o: [`Les fichiers sont supprimés immédiatement`, `Seule la métadonnée est supprimée, les fichiers restent`, `La table est archivée 30 jours`, `L'opération est interdite`], a: 1, e: `Pour une table externe, Unity Catalog ne gère pas le cycle de vie des fichiers.` },
        { q: `Quels privilèges faut-il au minimum pour lire une table ?`, o: [`SELECT seul`, `USE CATALOG, USE SCHEMA et SELECT`, `ALL PRIVILEGES sur le metastore`, `MODIFY et SELECT`], a: 1, e: `Il faut pouvoir « traverser » le catalogue et le schéma, puis lire l'objet.` },
        { q: `À quoi sert un volume ?`, o: [`À dimensionner les disques du cluster`, `À gouverner des fichiers non tabulaires`, `À partitionner une table`, `À sauvegarder le metastore`], a: 1, e: `Les volumes mettent les fichiers bruts sous la gouvernance de Unity Catalog.` },
        { q: `Quel couple d'objets permet d'interroger une base SQL Server sans copier les données ?`, o: [`Storage credential + volume`, `Connection + foreign catalog`, `External location + table externe`, `Secret scope + notebook`], a: 1, e: `C'est Lakehouse Federation : une connection décrit l'accès, le foreign catalog expose la base.` }
      ],
      cards: [
        [`Hiérarchie Unity Catalog`, `Metastore → catalogue → schéma → tables, vues, volumes, fonctions.`],
        [`Table managée vs externe`, `Managée : UC gère les fichiers, DROP supprime les données. Externe : chemin fourni, DROP ne retire que la métadonnée.`],
        [`Storage credential et external location`, `Credential = l'identité qui accède au stockage. External location = un chemin autorisé avec cette identité.`],
        [`Chemin d'un volume`, `/Volumes/catalogue/schema/volume/chemin`],
        [`Lakehouse Federation`, `Connection + foreign catalog : requêter une base externe en place, sans ingestion.`],
        [`Bonne pratique d'attribution des droits`, `Toujours à des groupes, au niveau le plus haut pertinent (les droits s'héritent).`]
      ]
    },
    {
      id: `m4`, day: `J2`, title: `Notebooks`, sub: `Cellules, magic commands, dbutils, widgets`,
      points: [
        `Un notebook a un langage par défaut ; une <b>magic command</b> en tête de cellule en change : <code>%python</code>, <code>%sql</code>, <code>%scala</code>, <code>%r</code>, <code>%md</code>.`,
        `Autres magics : <code>%run ./autre_notebook</code> (inclut son contenu), <code>%pip install</code> (bibliothèque pour la session), <code>%fs</code> et <code>%sh</code>.`,
        `<b>dbutils</b> : <code>dbutils.fs</code> (fichiers), <code>dbutils.widgets</code> (paramètres), <code>dbutils.secrets</code> (secrets, jamais affichés en clair), <code>dbutils.notebook.run</code> (appel d'un notebook avec paramètres).`,
        `<code>display(df)</code> affiche un tableau interactif et des graphiques ; <code>df.show()</code> n'imprime que du texte.`,
        `Le résultat d'une cellule SQL est disponible en Python dans la variable <code>_sqldf</code>. À l'inverse, <code>df.createOrReplaceTempView("v")</code> rend un DataFrame interrogeable en SQL.`,
        `Les <b>widgets</b> transforment un notebook en traitement paramétrable : c'est par eux qu'un job lui passe ses paramètres.`,
        `Versionne tes notebooks avec les <b>Git folders</b> (ex-Repos) plutôt qu'avec l'historique intégré.`
      ],
      code: [
        { t: `Lire, transformer, écrire`, c: `from pyspark.sql import functions as F

df = spark.read.table("samples.nyctaxi.trips")

silver = (df
  .filter(F.col("trip_distance") > 0)
  .withColumn("duree_min",
      (F.unix_timestamp("tpep_dropoff_datetime") - F.unix_timestamp("tpep_pickup_datetime")) / 60)
  .withColumn("jour", F.to_date("tpep_pickup_datetime")))

display(silver.limit(20))
silver.write.mode("overwrite").saveAsTable("workspace.dojo.courses_silver")` },
        { t: `Widgets et secrets`, c: `dbutils.widgets.text("date_traitement", "2016-01-15")
d = dbutils.widgets.get("date_traitement")

jour = spark.read.table("workspace.dojo.courses_silver").filter(F.col("jour") == d)
print(jour.count())

# Un secret n'apparaît jamais en clair dans les sorties
# pwd = dbutils.secrets.get(scope="scope_crm", key="pwd")` }
      ],
      traps: [
        `<code>%run</code> et <code>dbutils.notebook.run</code> ne font pas la même chose : le premier partage les variables, le second lance une exécution isolée.`,
        `Un <code>%pip install</code> au milieu du notebook relance l'interpréteur Python et efface les variables : place-le en tête.`,
        `Partager un notebook en lecture alors que des résultats sensibles sont affichés : les sorties voyagent avec le notebook. Efface-les avant de partager.`,
        `Écrire des identifiants ou des mots de passe en dur dans une cellule.`,
        `Laisser toute la logique dans des notebooks géants : sors les fonctions réutilisables dans des fichiers Python testables.`
      ],
      ask: [
        `Notebooks ou fichiers Python : comment répartir le code dans un projet réel ?`,
        `Comment organisez-vous les Git folders et les branches en équipe ?`,
        `Quelles conventions de nommage et de structure pour les notebooks d'un pipeline ?`
      ],
      answers: [
        `<b>Synthèse :</b> Le patron d'or en production : <b>le notebook est une coquille fine d'orchestration</b> (lecture des widgets, lecture des tables, appel d'une fonction de transformation, écriture de la table cible). Toute la logique métier réutilisable (nettoyage, règles de gestion, calculs) vit dans des <b>modules Python (<code>.py</code>)</b> dans le même Git folder.<br><b>Réflexe Keyrus :</b> Grâce à ce découpage, tu peux tester unitairement tes fonctions Python avec <code>pytest</code> en CI/CD en 3 secondes, tout en gardant le confort visuel de <code>display()</code> en notebook.`,
        `<b>Synthèse :</b> Chaque développeur possède son propre <b>Git folder</b> dans son dossier personnel (<code>/Workspace/Users/prenom.nom@client.fr/mon-repo</code>) calé sur sa branche de fonctionnalité (<code>feat/...</code>). Personne ne modifie directement les fichiers des environnements partagés : c'est la pipeline CI/CD (via Asset Bundles) qui déploie les branches <code>main</code> / <code>release</code> vers dev, uat et prod.`,
        `<b>Synthèse :</b> Numérote et préfixe par couche : <code>01_bronze_ingest_...</code>, <code>02_silver_clean_...</code>, <code>03_gold_agg_...</code>. Impose une structure en 4 blocs dans chaque notebook : <b>1) Entête Markdown + <code>%pip</code></b>, <b>2) Déclaration et lecture des widgets</b>, <b>3) Transformations</b>, <b>4) Écriture idempotente + publication des <code>taskValues</code></b>.`
      ],
      lab: {
        title: `Un notebook paramétré bilingue`, time: `30 min`,
        steps: [
          `Crée un notebook Python et construis <code>workspace.dojo.courses_silver</code> avec le premier extrait de code.`,
          `Ajoute un widget <code>date_traitement</code> et filtre la table dessus.`,
          `Dans une cellule <code>%sql</code>, calcule le prix moyen par jour ; récupère le résultat en Python via <code>_sqldf</code>.`,
          `Ajoute une cellule <code>%md</code> qui documente le notebook.`,
          `Change la valeur du widget et relance tout (Run all).`
        ],
        sol: `%sql
SELECT jour, count(*) AS courses, round(avg(fare_amount), 2) AS prix_moyen
FROM workspace.dojo.courses_silver
WHERE jour = :date_traitement
GROUP BY jour;

-- Cellule Python suivante :
-- display(_sqldf)`
      },
      quiz: [
        { q: `Quelle magic command exécute un autre notebook en partageant ses variables ?`, o: [`%sh`, `%run`, `%fs`, `%md`], a: 1, e: `%run inclut le notebook cible dans le contexte courant. dbutils.notebook.run lance une exécution séparée.` },
        { q: `Comment un job transmet-il un paramètre à un notebook ?`, o: [`Par une variable d'environnement Windows`, `Par un widget lu avec dbutils.widgets.get`, `Par un commentaire en tête de cellule`, `Ce n'est pas possible`], a: 1, e: `Les paramètres de tâche alimentent les widgets du notebook.` },
        { q: `Dans une cellule Python, comment récupérer le résultat de la cellule SQL précédente ?`, o: [`Avec la variable _sqldf`, `Avec dbutils.sql.last()`, `Avec spark.lastResult`, `Il faut relancer la requête`], a: 0, e: `_sqldf contient le DataFrame résultat de la dernière cellule SQL.` },
        { q: `Que fait dbutils.secrets.get dans une sortie de cellule ?`, o: [`Il affiche le secret en clair`, `Il renvoie la valeur, mais l'affichage est masqué`, `Il échoue toujours en notebook`, `Il écrit le secret dans un fichier`], a: 1, e: `La valeur est utilisable par le code, mais remplacée par [REDACTED] à l'affichage.` },
        { q: `Quelle est la bonne pratique de versionnement des notebooks ?`, o: [`Exporter en .dbc chaque semaine`, `Les Git folders reliés à un dépôt`, `Dupliquer le notebook avant chaque modification`, `L'historique intégré suffit`], a: 1, e: `Les Git folders relient le workspace à un dépôt Git : branches, revues, CI/CD.` }
      ],
      cards: [
        [`%run vs dbutils.notebook.run`, `%run : inclusion, variables partagées. dbutils.notebook.run : exécution isolée, avec paramètres et valeur de retour.`],
        [`À quoi servent les widgets ?`, `À paramétrer un notebook ; les jobs y injectent leurs paramètres.`],
        [`display() vs show()`, `display : tableau interactif et graphiques. show : texte brut.`],
        [`Passer d'un DataFrame Python à SQL`, `df.createOrReplaceTempView("v") puis SELECT ... FROM v.`],
        [`Les 4 familles de dbutils à connaître`, `fs, widgets, secrets, notebook.`]
      ]
    },
    {
      id: `m5`, day: `J2`, title: `Fondamentaux de Spark`, sub: `Évaluation paresseuse, shuffle, partitions`,
      points: [
        `<b>Évaluation paresseuse</b> : les <i>transformations</i> (select, filter, join, groupBy) construisent un plan ; rien ne s'exécute avant une <i>action</i> (count, show, write, collect).`,
        `Transformation <b>étroite</b> (filter, select) : chaque partition se traite seule. Transformation <b>large</b> (join, groupBy, orderBy, distinct) : il faut redistribuer les données, c'est le <b>shuffle</b>, l'opération la plus coûteuse.`,
        `Découpage : une action = un <b>job</b> ; chaque shuffle ouvre un nouveau <b>stage</b> ; chaque partition d'un stage = une <b>task</b>.`,
        `<b>Catalyst</b> optimise le plan (repousse les filtres vers la source, n'emporte que les colonnes utiles). <b>AQE</b> ajuste le plan pendant l'exécution : fusion des petites partitions, choix du type de jointure, traitement du skew.`,
        `<b>Broadcast join</b> : la petite table est envoyée à tous les workers, ce qui évite le shuffle de la grande.`,
        `Spark SQL et l'API DataFrame produisent le même plan : choisis selon la lisibilité, pas selon la performance.`,
        `Les <b>UDF Python</b> sortent les données du moteur optimisé : préfère les fonctions natives (<code>pyspark.sql.functions</code>).`,
        `<code>df.explain()</code> et la <b>Spark UI</b> (ou le Query profile) sont tes outils de diagnostic.`
      ],
      code: [
        { t: `Agrégation et jointure`, c: `from pyspark.sql import functions as F

courses = spark.read.table("workspace.dojo.courses_silver")

par_zone = (courses
  .groupBy("pickup_zip")
  .agg(F.count("*").alias("courses"),
       F.round(F.avg("fare_amount"), 2).alias("prix_moyen")))

# Rien n'a encore été exécuté : on regarde le plan
par_zone.explain()

# L'action déclenche le calcul
display(par_zone.orderBy(F.desc("courses")).limit(10))` },
        { t: `Forcer un broadcast`, c: `zones = spark.createDataFrame(
  [(10001, "Chelsea"), (10002, "Lower East Side")], ["zip", "quartier"])

enrichi = courses.join(F.broadcast(zones),
                       courses.pickup_zip == zones.zip, "left")` }
      ],
      traps: [
        `Chercher une erreur à la ligne de la transformation : elle n'apparaît qu'à l'action, parfois bien plus bas.`,
        `Appeler plusieurs actions sur le même DataFrame sans s'apercevoir que tout le plan est recalculé à chaque fois.`,
        `Boucler en Python sur les lignes (<code>for row in df.collect()</code>) au lieu d'exprimer le traitement en colonnes.`
      ],
      ask: [
        `Comment lisez-vous une Spark UI pour trouver le stage qui coûte cher ?`,
        `Quand le cache est-il utile, et quand est-il contre-productif ?`,
        `SQL ou PySpark : quelle convention d'équipe conseillez-vous ?`
      ],
      answers: [
        `<b>Synthèse :</b> Méthode en 3 clics : <b>1) Onglet Stages</b> → trie par <i>Duration</i> décroissante pour isoler le stage qui consomme 80 % du temps. <b>2) Dans ce stage</b> → regarde <i>Summary Metrics for Completed Tasks</i> : si le <i>Max</i> vaut 20 min alors que la <i>Median</i> vaut 5 s, c'est un <b>Skew</b> ; si la colonne <i>Spill (Memory / Disk)</i> est non nulle, c'est un manque de RAM ou des partitions trop grosses. <b>3) Onglet SQL / DataFrame</b> → repère les boîtes <i>Exchange</i> (shuffles) ou <i>BroadcastNestedLoopJoin</i> accidentels.`,
        `<b>Synthèse :</b> <code>df.cache()</code> n'est utile que si un même DataFrame intermédiaire coûteux est utilisé par <b>plusieurs actions dans la même session</b> (ex. entraînement ML ou contrôles multiples) et qu'on pense à faire <code>df.unpersist()</code> après. Il est contre-productif dans un pipeline linéaire (A → B → C) car il consomme la RAM des workers et provoque du <i>spill</i> sur les étapes suivantes.<br><b>Réflexe Keyrus :</b> Sur Databricks, le <b>Disk Cache (ex-Delta Cache)</b> accélère déjà automatiquement la relecture des fichiers Parquet sur les SSD locaux des VM sans saturer la mémoire JVM.`,
        `<b>Synthèse :</b> Comme Catalyst génère exactement le même plan physique, <b>SQL</b> est idéal pour les transformations métier lisibles par tous (jointures, agrégations, <code>QUALIFY</code>, <code>MERGE</code>), tandis que <b>PySpark</b> excelle dès qu'il faut paramétrer dynamiquement, boucler sur des métadonnées, factoriser des fonctions génériques ou écrire des tests unitaires.`
      ],
      lab: {
        title: `Voir la paresse et le shuffle`, time: `25 min`,
        steps: [
          `Construis un DataFrame avec un filtre, une colonne calculée et un groupBy, sans action. Constate que la cellule répond instantanément.`,
          `Appelle <code>explain()</code> et repère le mot <b>Exchange</b> : c'est le shuffle.`,
          `Ajoute une action (<code>count</code>) et observe le temps d'exécution.`,
          `Réécris exactement le même traitement en SQL et compare les deux plans.`
        ],
        sol: `from pyspark.sql import functions as F

t = spark.read.table("samples.nyctaxi.trips")
agg = (t.filter(F.col("fare_amount") > 5)
        .withColumn("jour", F.to_date("tpep_pickup_datetime"))
        .groupBy("jour").agg(F.sum("fare_amount").alias("ca")))

agg.explain()      # cherche "Exchange hashpartitioning(jour ...)"
print(agg.count()) # l'action déclenche l'exécution

spark.sql("""
  SELECT to_date(tpep_pickup_datetime) AS jour, sum(fare_amount) AS ca
  FROM samples.nyctaxi.trips WHERE fare_amount > 5 GROUP BY 1
""").explain()`
      },
      quiz: [
        { q: `Laquelle de ces opérations est une action ?`, o: [`filter`, `withColumn`, `count`, `join`], a: 2, e: `count déclenche l'exécution. Les trois autres ne font qu'enrichir le plan.` },
        { q: `Quelle opération provoque un shuffle ?`, o: [`select`, `filter`, `groupBy`, `withColumn`], a: 2, e: `groupBy est une transformation large : les lignes d'une même clé doivent être regroupées.` },
        { q: `Que fait un broadcast join ?`, o: [`Il trie les deux tables avant de les joindre`, `Il copie la petite table sur chaque worker pour éviter de redistribuer la grande`, `Il écrit le résultat sur le driver`, `Il désactive AQE`], a: 1, e: `Sans shuffle de la grande table, la jointure est beaucoup plus rapide.` },
        { q: `Qu'est-ce qui délimite deux stages ?`, o: [`Une cellule de notebook`, `Un shuffle`, `Une action`, `Un changement de langage`], a: 1, e: `Chaque redistribution des données ouvre un nouveau stage.` },
        { q: `Pourquoi éviter les UDF Python quand une fonction native existe ?`, o: [`Elles sont interdites avec Unity Catalog`, `Elles échappent aux optimisations du moteur et coûtent en sérialisation`, `Elles ne fonctionnent pas en SQL`, `Elles ne gèrent pas les valeurs nulles`], a: 1, e: `Les fonctions natives sont optimisées par Catalyst et exécutées par Photon.` }
      ],
      cards: [
        [`Transformation vs action`, `Transformation : construit le plan (filter, join...). Action : l'exécute (count, show, write, collect).`],
        [`Qu'est-ce que le shuffle ?`, `La redistribution des données entre partitions, imposée par join, groupBy, orderBy, distinct. C'est l'opération la plus coûteuse.`],
        [`Job, stage, task`, `Job = une action. Stage = un bloc sans shuffle. Task = un stage appliqué à une partition.`],
        [`AQE : trois apports`, `Fusion des petites partitions de shuffle, changement de stratégie de jointure, traitement du skew.`],
        [`Catalyst : deux optimisations à citer`, `Predicate pushdown (filtrer à la source) et column pruning (ne lire que les colonnes utiles).`],
        [`Comment voir le plan d'exécution ?`, `df.explain() en PySpark, EXPLAIN en SQL, puis la Spark UI ou le Query profile.`]
      ]
    },
    {
      id: `m6`, day: `J2`, title: `Delta Lake`, sub: `Journal, MERGE, time travel, maintenance`,
      points: [
        `Une table Delta = des fichiers Parquet + un dossier <code>_delta_log</code> de commits JSON numérotés. Chaque écriture ajoute une <b>version</b> : c'est ce qui donne l'ACID et l'isolation entre lecteurs et écrivains.`,
        `<b>Time travel</b> : <code>VERSION AS OF</code> / <code>TIMESTAMP AS OF</code> pour lire le passé, <code>RESTORE</code> pour y revenir, <code>DESCRIBE HISTORY</code> pour l'audit.`,
        `<b>MERGE INTO</b> = upsert : une seule instruction atomique pour mettre à jour, insérer et supprimer. C'est la brique des chargements incrémentaux et des dimensions à historique (SCD).`,
        `<b>Schema enforcement</b> : une écriture au schéma différent est rejetée. <b>Schema evolution</b> : on l'autorise explicitement (<code>mergeSchema</code>).`,
        `<b>OPTIMIZE</b> compacte les petits fichiers. <b>Liquid clustering</b> (<code>CLUSTER BY</code>) organise les données par colonnes de filtre ; il remplace le partitionnement et le Z-ORDER pour les nouvelles tables. Il est incompatible avec les deux sur une même table ; le Z-ORDER reste disponible sur les tables existantes.`,
        `<b>VACUUM</b> supprime physiquement les fichiers qui ne sont plus référencés (rétention par défaut : 7 jours). Au-delà, le time travel vers ces versions n'est plus possible. L'historique du journal a sa propre rétention (30 jours par défaut) : deux seuils distincts.`,
        `<b>Deletion vectors</b> : sur les tables où ils sont activés, un DELETE, un UPDATE ou un MERGE marque les lignes dans un petit fichier au lieu de réécrire le Parquet ; <code>OPTIMIZE</code> ou <code>REORG … APPLY (PURGE)</code> réécrit ensuite les fichiers. <b>Change Data Feed</b> : expose les changements ligne à ligne pour les traitements en aval.`,
        `<b>CLONE</b> : <i>shallow</i> (copie des métadonnées, idéal pour tester) ou <i>deep</i> (copie complète).`
      ],
      code: [
        { t: `MERGE (upsert)`, c: `MERGE INTO workspace.dojo.clients AS c
USING workspace.dojo.clients_maj AS m
  ON c.id = m.id
WHEN MATCHED AND m.supprime = true THEN DELETE
WHEN MATCHED THEN UPDATE SET *
WHEN NOT MATCHED THEN INSERT *;` },
        { t: `Historique et retour arrière`, c: `DESCRIBE HISTORY workspace.dojo.clients;

SELECT * FROM workspace.dojo.clients VERSION AS OF 1;
SELECT * FROM workspace.dojo.clients TIMESTAMP AS OF '2026-11-16 09:00:00';

RESTORE TABLE workspace.dojo.clients TO VERSION AS OF 1;` },
        { t: `Maintenance`, c: `CREATE TABLE workspace.dojo.courses_gold
CLUSTER BY (jour, pickup_zip)
AS SELECT * FROM workspace.dojo.courses_silver;

OPTIMIZE workspace.dojo.courses_gold;
VACUUM workspace.dojo.courses_gold;   -- rétention par défaut : 7 jours

CREATE TABLE workspace.dojo.courses_test SHALLOW CLONE workspace.dojo.courses_gold;` }
      ],
      traps: [
        `Un MERGE dont la source contient plusieurs lignes pour la même clé échoue : dédoublonne la source avant.`,
        `Baisser la rétention du VACUUM pour gagner de la place : tu perds le time travel et tu peux casser des lectures en cours.`,
        `Partitionner une petite table ou sur une colonne à forte cardinalité : on fabrique des milliers de petits fichiers.`,
        `Confondre time travel et sauvegarde : après VACUUM, les anciennes versions ont disparu.`
      ],
      ask: [
        `Liquid clustering ou partitionnement : que faites-vous sur les tables existantes ?`,
        `Comment implémentez-vous un SCD de type 2 proprement ?`,
        `Quelle politique OPTIMIZE / VACUUM en production (planifiée, predictive optimization) ?`
      ],
      answers: [
        `<b>Synthèse :</b> Sur toute <b>nouvelle table</b> (et toute table de moins de quelques To qu'on peut réécrire), choisis <b>Liquid Clustering (<code>CLUSTER BY</code>)</b> : il évite le piège du sur-partitionnement (petits fichiers) et permet de modifier les clés de clustering avec un simple <code>ALTER TABLE … CLUSTER BY (…)</code> sans réécrire l'historique. Sur une très grosse table existante déjà partitionnée qui fonctionne bien, inutile de tout casser immédiatement.`,
        `<b>Synthèse :</b> Deux approches propres sur Databricks : <b>1) En Pipeline déclaratif (Lakeflow / DLT)</b>, utilise directement <code>APPLY CHANGES INTO … STORED AS SCD TYPE 2</code> qui gère automatiquement l'ouverture/fermeture des périodes et les arrivées tardives. <b>2) En SQL / PySpark classique</b>, un <code>MERGE INTO</code> qui ferme les lignes actives modifiées (<code>date_fin = current_date(), actif = false</code>) combiné à l'insertion des nouvelles versions.`,
        `<b>Synthèse :</b> Si les tables sont <b>managées dans Unity Catalog</b>, active <b>Predictive Optimization</b> au niveau du catalogue : Databricks lance <code>OPTIMIZE</code> et <code>VACUUM</code> automatiquement quand c'est rentable. Pour des tables externes, planifie un job hebdomadaire (ou quotidien sur les tables très actives) qui exécute <code>OPTIMIZE</code> puis <code>VACUUM</code> (en gardant la rétention par défaut de 7 jours).`
      ],
      lab: {
        title: `Upsert, historique et retour arrière`, time: `35 min`,
        steps: [
          `Crée une table <code>clients</code> de trois lignes.`,
          `Crée une table <code>clients_maj</code> : une ligne modifiée, une nouvelle, une marquée supprimée.`,
          `Écris le MERGE qui applique les trois cas en une instruction.`,
          `Affiche l'historique, relis la version 1 (avant le MERGE), puis restaure-la.`,
          `Lance <code>DESCRIBE DETAIL</code> et note le nombre de fichiers avant et après <code>OPTIMIZE</code>.`
        ],
        sol: `CREATE OR REPLACE TABLE workspace.dojo.clients (id INT, nom STRING, pays STRING);
INSERT INTO workspace.dojo.clients VALUES (1,'Durand','FR'), (2,'Martin','FR'), (3,'Schmidt','DE');

CREATE OR REPLACE TABLE workspace.dojo.clients_maj (id INT, nom STRING, pays STRING, supprime BOOLEAN);
INSERT INTO workspace.dojo.clients_maj VALUES
  (2,'Martin','BE', false), (4,'Rossi','IT', false), (3, NULL, NULL, true);

MERGE INTO workspace.dojo.clients AS c
USING workspace.dojo.clients_maj AS m ON c.id = m.id
WHEN MATCHED AND m.supprime THEN DELETE
WHEN MATCHED THEN UPDATE SET c.nom = m.nom, c.pays = m.pays
WHEN NOT MATCHED THEN INSERT (id, nom, pays) VALUES (m.id, m.nom, m.pays);

DESCRIBE HISTORY workspace.dojo.clients;
SELECT * FROM workspace.dojo.clients VERSION AS OF 1;
RESTORE TABLE workspace.dojo.clients TO VERSION AS OF 1;
OPTIMIZE workspace.dojo.clients;
DESCRIBE DETAIL workspace.dojo.clients;`
      },
      quiz: [
        { q: `Où Delta enregistre-t-il l'historique des transactions ?`, o: [`Dans le metastore uniquement`, `Dans le dossier _delta_log à côté des fichiers Parquet`, `Dans une base SQL cachée`, `Dans la mémoire du driver`], a: 1, e: `Chaque commit est un fichier JSON numéroté dans _delta_log.` },
        { q: `Quelle instruction réalise un upsert atomique ?`, o: [`INSERT OVERWRITE`, `COPY INTO`, `MERGE INTO`, `UPDATE ... JOIN`], a: 2, e: `MERGE combine mise à jour, insertion et suppression en une transaction.` },
        { q: `Quel est l'effet de VACUUM ?`, o: [`Il compacte les petits fichiers`, `Il supprime les fichiers non référencés plus anciens que la rétention`, `Il recalcule les statistiques`, `Il vide la table`], a: 1, e: `VACUUM libère le stockage ; en contrepartie, les versions correspondantes ne sont plus lisibles.` },
        { q: `Une écriture arrive avec une colonne en plus. Que fait Delta par défaut ?`, o: [`Il ajoute la colonne en silence`, `Il rejette l'écriture`, `Il ignore la colonne`, `Il crée une nouvelle table`], a: 1, e: `C'est le schema enforcement. L'évolution du schéma doit être demandée explicitement.` },
        { q: `Que recommande Databricks pour organiser les données d'une nouvelle table ?`, o: [`Partitionner par date systématiquement`, `Z-ORDER sur toutes les colonnes`, `Liquid clustering avec CLUSTER BY`, `Ne rien faire`], a: 2, e: `Le liquid clustering remplace partitionnement et Z-ORDER, et ses clés peuvent évoluer sans réécrire la table.` },
        { q: `Qu'est-ce qu'un shallow clone ?`, o: [`Une copie complète des fichiers`, `Une copie des métadonnées qui pointe vers les fichiers de la source`, `Une vue matérialisée`, `Une sauvegarde chiffrée`], a: 1, e: `Rapide et peu coûteux : idéal pour tester une modification sans toucher à la table d'origine.` }
      ],
      cards: [
        [`De quoi est faite une table Delta ?`, `De fichiers Parquet et d'un journal de transactions (_delta_log).`],
        [`Time travel : 3 commandes`, `DESCRIBE HISTORY, SELECT ... VERSION AS OF n, RESTORE TABLE ... TO VERSION AS OF n.`],
        [`OPTIMIZE vs VACUUM`, `OPTIMIZE compacte les petits fichiers. VACUUM supprime les fichiers obsolètes (rétention 7 jours par défaut).`],
        [`Schema enforcement vs evolution`, `Enforcement : rejet des écritures non conformes. Evolution : ajout de colonnes autorisé explicitement (mergeSchema).`],
        [`Liquid clustering`, `CLUSTER BY (colonnes) : organisation des données qui remplace partitionnement et Z-ORDER.`],
        [`Piège classique du MERGE`, `Plusieurs lignes source pour une même clé : il faut dédoublonner la source.`],
        [`Change Data Feed`, `Option de table qui expose les insertions, mises à jour et suppressions ligne à ligne.`]
      ]
    },
    {
      id: `m7`, day: `J3`, title: `Orchestration`, sub: `Jobs, paramètres, Data Factory, pipelines déclaratifs`,
      points: [
        `Un <b>job</b> (Lakeflow Jobs, ex-Workflows) = un graphe de <b>tâches</b> avec dépendances : notebook, script Python, requête SQL, pipeline, dbt, ou un autre job.`,
        `Déclencheurs : planification cron, arrivée de fichier, mise à jour de table, continu, ou appel par API.`,
        `<b>Paramètres</b> : les paramètres de job se propagent à toutes les tâches ; un notebook les lit par <code>dbutils.widgets.get</code>. Les références dynamiques <code>{{job.start_time.iso_date}}</code> ou <code>{{job.parameters.nom}}</code> injectent le contexte.`,
        `<b>Task values</b> : une tâche publie une valeur (<code>dbutils.jobs.taskValues.set</code>), une tâche aval la lit. Complété par les tâches <i>If/else</i> et <i>For each</i>.`,
        `Fiabilité : retries par tâche, timeouts, notifications, et <b>Repair run</b> qui relance les tâches en échec et celles qui en dépendent, sans rejouer les tâches déjà réussies.`,
        `<b>Azure Data Factory</b> peut appeler un notebook via l'activité Databricks Notebook. Pertinent si ADF orchestre déjà le reste du SI ; sinon les jobs natifs suffisent et sont mieux intégrés.`,
        `<b>Pipelines déclaratifs</b> (Lakeflow Spark Declarative Pipelines, ex-Delta Live Tables) : tu déclares des <i>streaming tables</i> et des <i>materialized views</i> ; le moteur gère dépendances, incrémental, reprises et qualité via les <b>expectations</b>.`
      ],
      code: [
        { t: `Passer une valeur entre tâches`, c: `# Tâche "controle"
nb = spark.read.table("workspace.dojo.courses_silver").count()
dbutils.jobs.taskValues.set(key="nb_lignes", value=nb)

# Tâche aval
# Variante recommandée : référencer {{tasks.controle.values.nb_lignes}} dans les paramètres de la tâche
nb = dbutils.jobs.taskValues.get(taskKey="controle", key="nb_lignes", default=0)
if nb == 0:
    raise Exception("Aucune ligne à traiter")` },
        { t: `Pipeline déclaratif en SQL`, c: `CREATE OR REFRESH STREAMING TABLE courses_bronze
AS SELECT * FROM STREAM read_files(
  '/Volumes/workspace/dojo/fichiers/courses/', format => 'json');

CREATE OR REFRESH MATERIALIZED VIEW courses_silver (
  CONSTRAINT distance_valide EXPECT (trip_distance > 0) ON VIOLATION DROP ROW,
  CONSTRAINT prix_present   EXPECT (fare_amount IS NOT NULL)
) AS
SELECT *, to_date(tpep_pickup_datetime) AS jour
FROM courses_bronze;` }
      ],
      traps: [
        `Enchaîner les notebooks avec <code>dbutils.notebook.run</code> dans un notebook « chef d'orchestre » : on perd la visibilité, les retries et le repair. Utilise un job multi-tâches.`,
        `Un Repair run sur une tâche qui ajoute des lignes sans condition : elle les ajoute une seconde fois. Une tâche rejouable doit être idempotente.`,
        `Coder la date de traitement en dur : passe-la en paramètre pour pouvoir rejouer un jour passé.`,
        `Ne prévoir ni alerte ni retry : un échec nocturne se découvre le lendemain en réunion.`
      ],
      ask: [
        `ADF ou jobs Databricks : où placez-vous la frontière chez vos clients ?`,
        `Quand un pipeline déclaratif vaut-il mieux qu'un job de notebooks ?`,
        `Comment gérez-vous la reprise sur incident et les rejeux de dates passées ?`
      ],
      answers: [
        `<b>Synthèse :</b> Règle pragmatique : <b>Azure Data Factory (ADF)</b> sert à l'acquisition depuis le SI (copie depuis SAP, bases on-premise via Self-Hosted Integration Runtime, SFTP) vers un Volume / ADLS en zone d'atterrissage. Dès que le fichier est posé dans le stockage, **un seul appel ADF déclenche un Lakeflow Job Databricks** (ou un File Arrival Trigger prend le relais), et tout le graphe Bronze → Silver → Gold est orchestré dans Databricks pour profiter du Repair Run, du partage de cluster et de l'observabilité fine.`,
        `<b>Synthèse :</b> Choisis un <b>Pipeline déclaratif (Lakeflow / ex-DLT)</b> quand tu veux automatiser l'incrémental streaming/batch, déclarer des règles de qualité (<i>Expectations</i>) avec quarantaine/rejet et gérer du SCD Type 1/2 en quelques lignes de SQL. Préfère un <b>Job de notebooks / scripts Python</b> quand tu as besoin d'une logique procédurale complexe, d'appels d'API externes ou d'un contrôle très fin sur chaque étape.`,
        `<b>Synthèse :</b> Trois règles d'or : <b>1)</b> Aucune tâche n'utilise <code>current_date()</code> en dur : elle lit un paramètre <code>date_traitement</code> (qui vaut la date du run par défaut). <b>2)</b> Les écritures utilisent <code>MERGE</code> conditionnel ou <code>INSERT … REPLACE WHERE jour = :date_traitement</code>. <b>3)</b> En cas d'incident partiel, on utilise <b>Repair run</b> ; en cas de rattrapage sur 15 jours (backfill), on lance un job paramétré (ou une tâche <i>For each</i>) sur la liste des dates.`
      ],
      lab: {
        title: `Un job à trois tâches`, time: `40 min`,
        steps: [
          `Crée trois notebooks : <code>01_bronze</code>, <code>02_silver</code>, <code>03_gold</code> (réutilise le code des modules précédents).`,
          `Dans Jobs &amp; Pipelines, crée un job avec ces trois tâches en séquence.`,
          `Ajoute un paramètre de job <code>date_traitement</code> et lis-le dans <code>02_silver</code> par un widget.`,
          `Dans <code>02_silver</code>, publie le nombre de lignes en task value ; lis-le dans <code>03_gold</code>.`,
          `Provoque une erreur dans <code>03_gold</code>, lance le job, corrige, puis utilise <b>Repair run</b>.`,
          `Planifie le job chaque jour à 6 h, puis mets la planification en pause.`
        ],
        sol: `# 03_gold
nb = dbutils.jobs.taskValues.get(taskKey="02_silver", key="nb_lignes", default=0)
print("Lignes silver :", nb)

spark.sql("""
  CREATE OR REPLACE TABLE workspace.dojo.ca_par_jour AS
  SELECT jour, count(*) AS courses, round(sum(fare_amount), 2) AS ca
  FROM workspace.dojo.courses_silver
  GROUP BY jour
""")`
      },
      quiz: [
        { q: `Que fait « Repair run » ?`, o: [`Il relance tout le job depuis le début`, `Il relance uniquement les tâches en échec et celles qui en dépendent`, `Il corrige le code automatiquement`, `Il restaure les tables à leur version précédente`], a: 1, e: `Les tâches déjà réussies ne sont pas rejouées : gain de temps et de coût.` },
        { q: `Comment transmettre une valeur calculée d'une tâche à la suivante ?`, o: [`Par une variable globale Python`, `Par les task values`, `Par un fichier sur le driver`, `Ce n'est pas possible`], a: 1, e: `dbutils.jobs.taskValues.set dans la tâche amont, .get dans la tâche aval.` },
        { q: `Dans un pipeline déclaratif, à quoi sert une expectation ?`, o: [`À planifier le pipeline`, `À déclarer une règle de qualité et l'action en cas de violation`, `À dimensionner le cluster`, `À donner des droits`], a: 1, e: `On peut tracer la violation, écarter la ligne (DROP ROW) ou faire échouer la mise à jour (FAIL UPDATE).` },
        { q: `Quel est l'ancien nom des pipelines déclaratifs Lakeflow ?`, o: [`Auto Loader`, `Delta Live Tables`, `Delta Sharing`, `Workflows`], a: 1, e: `Delta Live Tables (DLT) a été renommé Lakeflow Spark Declarative Pipelines ; Workflows est devenu Lakeflow Jobs.` },
        { q: `Quand ADF est-il un choix raisonnable pour orchestrer Databricks ?`, o: [`Toujours, les jobs natifs sont limités`, `Quand ADF orchestre déjà des traitements hors Databricks dans le SI`, `Jamais, c'est incompatible`, `Seulement pour le streaming`], a: 1, e: `ADF garde son intérêt comme orchestrateur transverse ; pour du pur Databricks, les jobs natifs sont plus simples.` }
      ],
      cards: [
        [`Job et tâche`, `Un job est un graphe de tâches dépendantes (notebook, SQL, Python, pipeline, dbt...).`],
        [`Task values`, `Mécanisme pour passer de petites valeurs d'une tâche à une autre dans un job.`],
        [`Repair run`, `Relance les tâches en échec et celles qui en dépendent, sans rejouer celles qui ont réussi. La tâche repart de zéro : sans idempotence, elle peut dupliquer des données.`],
        [`Streaming table vs materialized view`, `Streaming table : ingestion incrémentale en ajout. Materialized view : résultat précalculé, rafraîchi par le pipeline.`],
        [`Expectations : 3 comportements`, `Tracer seulement, DROP ROW, FAIL UPDATE.`],
        [`Renommages Lakeflow`, `Workflows → Lakeflow Jobs. Delta Live Tables → Lakeflow Spark Declarative Pipelines.`]
      ]
    },
    {
      id: `m8`, day: `J3`, title: `Databricks SQL et BI`, sub: `Éditeur, alertes, dashboards, Power BI`,
      points: [
        `<b>Databricks SQL</b> (ex-SQL Analytics) : l'espace SQL de la plateforme, exécuté sur les SQL warehouses.`,
        `<b>Éditeur SQL</b> : requêtes enregistrées, partagées, paramétrées (<code>:nom_parametre</code>), avec visualisations sur les résultats et export.`,
        `Une requête peut être <b>planifiée</b>. Une <b>alerte</b> évalue une requête à intervalle régulier et notifie quand une condition est vraie (par exemple un nombre de lignes rejetées supérieur à zéro).`,
        `<b>Dashboards AI/BI</b> : jeux de données SQL + widgets, filtres, publication avec droits intégrés. <b>Genie</b> permet d'interroger les données en langage naturel.`,
        `<b>Query profile</b> et <b>Query history</b> : où part le temps, qui lance quoi, combien ça coûte.`,
        `<b>Power BI</b> : connecteur Azure Databricks, avec le <i>Server hostname</i> et le <i>HTTP path</i> du warehouse. <b>Import</b> (données copiées, rapide, rafraîchissement planifié) ou <b>DirectQuery</b> (requêtes en direct, données à jour, sollicite le warehouse).`,
        `Expose aux outils BI la couche <b>Gold</b>, avec des vues ou des tables dédiées, jamais le Bronze.`
      ],
      code: [
        { t: `Requête paramétrée`, c: `SELECT jour, count(*) AS courses, round(sum(fare_amount), 2) AS ca
FROM workspace.dojo.courses_silver
WHERE jour BETWEEN :date_debut AND :date_fin
GROUP BY jour
ORDER BY jour;` },
        { t: `Requête support d'une alerte qualité`, c: `SELECT count(*) AS lignes_suspectes
FROM workspace.dojo.courses_silver
WHERE fare_amount <= 0 OR trip_distance <= 0;
-- Alerte : déclencher quand lignes_suspectes > 0` }
      ],
      traps: [
        `Brancher Power BI en DirectQuery sur des tables brutes volumineuses : chaque clic lance une requête lourde.`,
        `Laisser un warehouse sans auto-stop, ou avec un délai très long.`,
        `Donner aux analystes l'accès au Silver « en attendant » : ils bâtissent dessus et tu ne peux plus le faire évoluer.`
      ],
      ask: [
        `Import ou DirectQuery : quels critères de décision avec Power BI ?`,
        `Dashboards AI/BI ou Power BI : comment les positionnez-vous ?`,
        `Comment dimensionner un SQL warehouse pour une équipe de 20 analystes ?`
      ],
      answers: [
        `<b>Synthèse :</b> <b>Mode Import par défaut dans 80 % des cas</b> : Power BI charge la couche Gold une ou plusieurs fois par jour, les interactions utilisateur sont instantanées et le SQL Warehouse s'éteint aussitôt (coût minimal). Choisis <b>DirectQuery</b> uniquement si la fraîcheur temps réel (&lt; 15 min) est exigée, si le volume Gold dépasse la capacité mémoire Power BI, ou si la sécurité ligne à ligne (RLS) doit absolument être évaluée à la volée par Unity Catalog.<br><b>Réflexe Keyrus :</b> Le <b>mode Composite (Dual)</b> offre le meilleur compromis : agrégats mensuels/journaliers en Import, et drill-down au détail de la transaction en DirectQuery !`,
        `<b>Synthèse :</b> <b>Power BI</b> reste l'outil roi pour les tableaux de bord d'entreprise largement diffusés aux métiers avec modélisation sémantique complexe (DAX). Les <b>Dashboards AI/BI Databricks + Genie</b> sont imbattables pour le suivi opérationnel, les indicateurs de qualité de données, le FinOps et l'exploration rapide sans quitter le gouvernail Unity Catalog.`,
        `<b>Synthèse :</b> Pour 20 analystes, privilégie un <b>SQL Warehouse Serverless</b> de taille <b>Small ou Medium</b> avec <b>Auto-stop à 5 minutes</b> (voire 1 minute) et un <b>Scaling de 1 à 3 clusters</b>. Tu absorbes les pics de 9 h du matin par ajout horizontal de clusters sans surpayer une taille X-Large toute la journée.`
      ],
      lab: {
        title: `De la requête au tableau de bord`, time: `30 min`,
        steps: [
          `Dans l'éditeur SQL, écris la requête paramétrée ci-dessus et enregistre-la.`,
          `Ajoute une visualisation en courbe sur le résultat.`,
          `Crée un dashboard avec deux widgets : un compteur (CA total) et la courbe du CA par jour, plus un filtre de dates.`,
          `Crée une alerte avec le SQL de la requête qualité (dans les alertes récentes le SQL s'écrit dans l'alerte elle-même ; les alertes « legacy » pointaient vers une requête enregistrée).`,
          `Repère dans Connection details du warehouse le <b>Server hostname</b> et le <b>HTTP path</b> que demandera Power BI.`
        ],
        sol: `-- Jeu de données du dashboard
SELECT jour, pickup_zip, count(*) AS courses, round(sum(fare_amount), 2) AS ca
FROM workspace.dojo.courses_silver
GROUP BY jour, pickup_zip;`
      },
      quiz: [
        { q: `Quelles informations faut-il pour connecter Power BI à Databricks ?`, o: [`L'adresse IP du driver`, `Le Server hostname et le HTTP path d'un SQL warehouse`, `Le chemin ADLS des tables`, `Le nom du metastore`], a: 1, e: `On les trouve dans l'onglet Connection details du warehouse.` },
        { q: `Que fait une alerte Databricks SQL ?`, o: [`Elle surveille la CPU du warehouse`, `Elle évalue périodiquement une requête et notifie si une condition est remplie`, `Elle bloque les requêtes trop longues`, `Elle sauvegarde les dashboards`], a: 1, e: `C'est un moyen simple de surveiller la qualité ou la fraîcheur des données.` },
        { q: `Quel mode Power BI garantit des données toujours à jour ?`, o: [`Import`, `DirectQuery`, `Export CSV`, `Dataflow`], a: 1, e: `DirectQuery interroge le warehouse à chaque interaction ; en contrepartie il le sollicite en continu.` },
        { q: `Comment déclare-t-on un paramètre nommé dans l'éditeur SQL ?`, o: [`@nom`, `:nom`, `%nom%`, `#nom`], a: 1, e: `La syntaxe des marqueurs nommés est :nom.` },
        { q: `Quelle couche exposer aux outils de BI ?`, o: [`Bronze`, `Silver`, `Gold`, `Les fichiers du volume`], a: 2, e: `Le Gold est modélisé et agrégé pour l'usage ; c'est le contrat avec les consommateurs.` }
      ],
      cards: [
        [`Power BI : les 2 paramètres de connexion`, `Server hostname et HTTP path du SQL warehouse.`],
        [`Import vs DirectQuery`, `Import : copie, rapide, à rafraîchir. DirectQuery : en direct, à jour, charge le warehouse.`],
        [`Alerte Databricks SQL`, `Requête évaluée à intervalle régulier ; notification quand la condition est vraie.`],
        [`Où diagnostiquer une requête lente ?`, `Dans le Query profile (plan, temps par opérateur) et le Query history.`],
        [`Genie`, `Interface en langage naturel pour interroger des jeux de données gouvernés.`]
      ]
    },
    {
      id: `m9`, day: `Après`, title: `Ingestion incrémentale et streaming`, sub: `COPY INTO, Auto Loader, Structured Streaming`,
      points: [
        `<b>COPY INTO</b> : commande SQL idempotente qui charge les nouveaux fichiers d'un dossier. Simple, adaptée aux volumes modestes.`,
        `<b>Auto Loader</b> (format <code>cloudFiles</code>) : détecte et ingère les nouveaux fichiers à grande échelle, infère le schéma et le fait évoluer. Par défaut, le flux s'arrête quand une nouvelle colonne apparaît et reprend au redémarrage : on le lance donc dans un job qui sait le relancer. Les données inattendues vont dans la colonne <code>_rescued_data</code>.`,
        `En SQL, <code>read_files()</code> lit des fichiers directement ; avec <code>STREAM</code> dans un pipeline, il s'appuie sur Auto Loader.`,
        `<b>Structured Streaming</b> : un flux est une table qui grandit. Le moteur traite par micro-lots et mémorise sa progression dans un <b>checkpoint</b>.`,
        `Le checkpoint est ce qui garantit le traitement « exactement une fois » vers Delta. Un checkpoint par flux, jamais partagé, jamais supprimé à la légère.`,
        `<b>Triggers</b> : <code>availableNow</code> traite tout le disponible puis s'arrête (du batch incrémental, économique) ; <code>processingTime</code> tourne en continu à intervalle fixe.`,
        `Une table Delta peut être lue en flux (<code>readStream.table</code>) : c'est ainsi qu'on propage l'incrémental de Bronze vers Silver.`,
        `<b>Watermark</b> : borne le retard accepté pour les agrégations par fenêtre de temps et permet de libérer l'état.`
      ],
      code: [
        { t: `Auto Loader en batch incrémental`, c: `chemin = "/Volumes/workspace/dojo/fichiers"

(spark.readStream
   .format("cloudFiles")
   .option("cloudFiles.format", "json")
   .option("cloudFiles.schemaLocation", chemin + "/_schemas/courses")
   .load(chemin + "/courses/")
 .writeStream
   .option("checkpointLocation", chemin + "/_checkpoints/courses_bronze")
   .trigger(availableNow=True)
   .toTable("workspace.dojo.courses_bronze_auto"))` },
        { t: `COPY INTO`, c: `CREATE TABLE IF NOT EXISTS workspace.dojo.courses_copy;

COPY INTO workspace.dojo.courses_copy
FROM '/Volumes/workspace/dojo/fichiers/courses/'
FILEFORMAT = JSON
COPY_OPTIONS ('mergeSchema' = 'true');` }
      ],
      traps: [
        `Supprimer ou partager un checkpoint : le flux réingère tout, ou saute des données.`,
        `Lancer un flux continu là où <code>availableNow</code> planifié toutes les heures suffirait : la facture n'est pas la même.`,
        `Ignorer <code>_rescued_data</code> : les changements de schéma de la source passent inaperçus.`
      ],
      ask: [
        `Auto Loader ou COPY INTO : où placez-vous la limite ?`,
        `Comment gérez-vous une évolution de schéma côté source en production ?`
      ],
      answers: [
        `<b>Synthèse :</b> <b>COPY INTO</b> est parfait pour des chargements SQL simples où le dossier source contient quelques centaines ou milliers de fichiers au total. Dès que le dossier accumule des dizaines de milliers ou millions de fichiers, ou que le schéma dérive dans le temps, passe à <b>Auto Loader (<code>cloudFiles</code>)</b> (ou <code>STREAM read_files()</code> en SQL) qui suit l'état dans RocksDB (checkpoint) et utilise les notifications de fichiers sans relister tout le stockage.`,
        `<b>Synthèse :</b> Active le mode <code>cloudFiles.schemaEvolutionMode = "addNewColumns"</code> combiné à la colonne <code>_rescued_data</code> en Bronze. Quand une nouvelle colonne apparaît dans le JSON/CSV source, Auto Loader met à jour le schéma de la table Bronze, arrête proprement le micro-batch et — grâce au retry automatique configuré sur la tâche du Job — repart immédiatement avec le nouveau schéma. Une alerte SQL sur <code>_rescued_data IS NOT NULL</code> prévient l'équipe des changements de type incompatibles.`
      ],
      lab: {
        title: `Ingérer des fichiers au fil de l'eau`, time: `40 min`,
        steps: [
          `Écris 1 000 lignes de <code>samples.nyctaxi.trips</code> en JSON dans le volume <code>fichiers/courses/</code>.`,
          `Lance le flux Auto Loader avec <code>availableNow</code> et compte les lignes de la table cible.`,
          `Dépose un second lot de fichiers et relance exactement la même cellule : seules les nouvelles lignes arrivent.`,
          `Relance une troisième fois sans nouveau fichier : le compte ne bouge pas. C'est le checkpoint qui travaille.`
        ],
        sol: `chemin = "/Volumes/workspace/dojo/fichiers"

(spark.read.table("samples.nyctaxi.trips").limit(1000)
   .write.mode("append").json(chemin + "/courses/"))

# ... cellule Auto Loader du module ...

print(spark.read.table("workspace.dojo.courses_bronze_auto").count())`
      },
      quiz: [
        { q: `À quoi sert le checkpoint d'un flux ?`, o: [`À accélérer les requêtes`, `À mémoriser la progression pour reprendre sans perte ni doublon`, `À sauvegarder la table cible`, `À stocker le schéma de la table`], a: 1, e: `Sans checkpoint, le flux ne sait pas ce qu'il a déjà traité.` },
        { q: `Que fait le trigger availableNow ?`, o: [`Il tourne en continu`, `Il traite tout ce qui est disponible puis s'arrête`, `Il ne traite qu'un seul fichier`, `Il attend une validation manuelle`], a: 1, e: `On obtient de l'incrémental avec un coût de batch.` },
        { q: `Où Auto Loader place-t-il les données qui ne correspondent pas au schéma ?`, o: [`Elles sont perdues`, `Dans la colonne _rescued_data`, `Dans une table d'erreurs obligatoire`, `Dans le journal du driver`], a: 1, e: `_rescued_data conserve ces données pour analyse.` },
        { q: `Quelle propriété rend COPY INTO sûr à relancer ?`, o: [`Il est idempotent : les fichiers déjà chargés sont ignorés`, `Il verrouille le dossier source`, `Il supprime les fichiers après chargement`, `Il fait un MERGE automatique`], a: 0, e: `COPY INTO garde la trace des fichiers déjà ingérés.` },
        { q: `Quel est le format à déclarer pour utiliser Auto Loader ?`, o: [`delta`, `autoloader`, `cloudFiles`, `stream`], a: 2, e: `spark.readStream.format("cloudFiles") avec l'option cloudFiles.format.` }
      ],
      cards: [
        [`Auto Loader`, `Ingestion incrémentale de fichiers (format cloudFiles) avec inférence et évolution de schéma.`],
        [`Checkpoint`, `État de progression d'un flux ; un par flux, garant de la reprise sans perte ni doublon.`],
        [`availableNow vs processingTime`, `availableNow : traite le disponible et s'arrête. processingTime : micro-lots en continu à intervalle fixe.`],
        [`COPY INTO`, `Chargement SQL idempotent des nouveaux fichiers d'un dossier.`],
        [`_rescued_data`, `Colonne où Auto Loader range les données non conformes au schéma attendu.`]
      ]
    },
    {
      id: `m10`, day: `Après`, title: `Performance et coûts`, sub: `Diagnostiquer, optimiser, piloter la facture`,
      points: [
        `<b>Data skipping</b> : Delta garde des statistiques min/max par fichier ; un filtre sur une colonne bien organisée (liquid clustering) évite de lire la plupart des fichiers.`,
        `Les quatre symptômes à reconnaître dans la Spark UI : <b>skew</b> (une task beaucoup plus longue que les autres), <b>spill</b> (débordement mémoire sur disque), <b>shuffle</b> massif, <b>petits fichiers</b>.`,
        `Leviers côté code : filtrer tôt, ne sélectionner que les colonnes utiles, joindre en broadcast les petites tables, éviter les UDF Python, ne pas multiplier les actions.`,
        `Leviers côté tables : liquid clustering sur les colonnes de filtre et de jointure, OPTIMIZE régulier, <b>predictive optimization</b> sur les tables managées.`,
        `Leviers côté calcul : job compute plutôt qu'all-purpose, auto-termination, autoscaling borné, bonne taille de warehouse, serverless pour les charges intermittentes.`,
        `<b>System tables</b> : <code>system.billing.usage</code> donne la consommation par job, cluster, utilisateur et tag. C'est la base de tout suivi de coûts.`,
        `<b>Tags</b> et <b>budgets</b> : tague les clusters et les jobs par projet ou client pour refacturer et alerter.`
      ],
      code: [
        { t: `Consommation par SKU sur 30 jours`, c: `SELECT sku_name, usage_date, sum(usage_quantity) AS dbu
FROM system.billing.usage
WHERE usage_date >= current_date() - INTERVAL 30 DAYS
GROUP BY sku_name, usage_date
ORDER BY usage_date DESC, dbu DESC;` },
        { t: `Comprendre une requête`, c: `EXPLAIN FORMATTED
SELECT pickup_zip, count(*)
FROM workspace.dojo.courses_gold
WHERE jour = '2016-01-15'
GROUP BY pickup_zip;

DESCRIBE DETAIL workspace.dojo.courses_gold;  -- numFiles, sizeInBytes, clusteringColumns` }
      ],
      traps: [
        `Ajouter des workers avant d'avoir regardé le plan : un skew ou un mauvais filtre ne se règle pas avec plus de machines.`,
        `Mettre <code>cache()</code> partout : on consomme de la mémoire et on masque le vrai problème.`,
        `Découvrir les coûts à la facture mensuelle faute de tags et de suivi.`
      ],
      ask: [
        `Quels sont les trois premiers réflexes face à un job devenu lent ?`,
        `Comment présentez-vous le suivi de coûts à un client ?`
      ],
      answers: [
        `<b>Synthèse :</b> <b>1) Vérifier ce qui a changé côté données</b> (explosion soudaine du volume, milliers de petits fichiers en amont, ou apparition d'une clé très fréquente créant un <i>Skew</i>). <b>2) Ouvrir la Spark UI / Query Profile</b> pour identifier si le temps part dans le <i>Scan</i> (manque de data skipping / Liquid Clustering), l'<i>Exchange</i> (jointure non broadcastée ou shuffle inutile) ou le <i>Spill</i>. <b>3) Seulement après</b>, ajuster le code ou le dimensionnement du cluster.`,
        `<b>Synthèse :</b> Mets en place dès le premier sprint une politique de <b>tags obligatoires</b> (<code>project</code>, <code>env</code>, <code>cost_center</code>) via les Cluster Policies et les Asset Bundles, puis branche un <b>Dashboard AI/BI FinOps</b> sur <code>system.billing.usage</code> et <code>system.lakeflow.job_run_timeline</code>. Le client voit en temps réel le coût en euros par pipeline, les jobs les plus gourmands et les clusters interactifs restés allumés.`
      ],
      lab: {
        title: `Mesurer avant d'optimiser`, time: `30 min`,
        steps: [
          `Crée <code>courses_gold</code> avec <code>CLUSTER BY (jour, pickup_zip)</code> (voir module Delta).`,
          `Exécute la même requête filtrée sur <code>jour</code> contre la table silver puis la table gold, et compare les Query profiles (fichiers lus, octets lus).`,
          `Interroge <code>system.billing.usage</code> et identifie ton poste de consommation principal. Si l'accès est refusé dans ton environnement, garde la requête pour un workspace client.`
        ],
        sol: `SELECT pickup_zip, count(*) FROM workspace.dojo.courses_silver
WHERE jour = '2016-01-15' GROUP BY pickup_zip;

SELECT pickup_zip, count(*) FROM workspace.dojo.courses_gold
WHERE jour = '2016-01-15' GROUP BY pickup_zip;
-- Sur un si petit volume l'écart est faible : regarde les métriques
-- "files read / files pruned" plutôt que la durée.`
      },
      quiz: [
        { q: `Sur quoi repose le data skipping ?`, o: [`Sur un index B-tree`, `Sur des statistiques min/max par fichier dans le journal Delta`, `Sur le cache du driver`, `Sur la compression Parquet`], a: 1, e: `Si la valeur cherchée est hors de l'intervalle min/max d'un fichier, il n'est pas lu.` },
        { q: `Dans un stage, une task dure 20 minutes et les 199 autres 10 secondes. Quel est le problème ?`, o: [`Spill`, `Skew`, `Petits fichiers`, `Cluster sous-dimensionné`], a: 1, e: `Une clé concentre l'essentiel des données. AQE peut aider ; sinon il faut traiter la clé à part.` },
        { q: `Quelle table système utiliser pour suivre la consommation ?`, o: [`system.access.audit`, `system.billing.usage`, `information_schema.tables`, `system.compute.clusters`], a: 1, e: `system.billing.usage détaille les DBU par SKU, workspace, job et tag.` },
        { q: `Quel est le premier réflexe devant un job lent ?`, o: [`Doubler le nombre de workers`, `Lire le plan et la Spark UI pour localiser le stage coûteux`, `Passer tout en UDF`, `Désactiver AQE`], a: 1, e: `On mesure d'abord ; on dimensionne ensuite si le plan est sain.` },
        { q: `Quelle pratique réduit le plus simplement la facture des traitements planifiés ?`, o: [`Les lancer sur un cluster all-purpose partagé`, `Les lancer sur du job compute`, `Désactiver Photon partout`, `Augmenter la rétention du VACUUM`], a: 1, e: `Le tarif DBU du job compute est nettement inférieur à celui de l'interactif.` }
      ],
      cards: [
        [`Data skipping`, `Statistiques min/max par fichier qui permettent de ne pas lire les fichiers hors du filtre.`],
        [`Les 4 symptômes de la Spark UI`, `Skew, spill, shuffle massif, petits fichiers.`],
        [`Table système des coûts`, `system.billing.usage`],
        [`Skew : définition`, `Répartition très inégale des données entre partitions ; une task concentre le travail.`],
        [`Predictive optimization`, `Maintenance automatique (OPTIMIZE, VACUUM, ANALYZE) des tables managées Unity Catalog. Elle ne couvre ni les tables externes ni les tables reçues par partage.`]
      ]
    },
    {
      id: `m11`, day: `Après`, title: `Industrialisation`, sub: `Asset Bundles, CI/CD, environnements, tests`,
      points: [
        `<b>Databricks Asset Bundles</b> (DABs, rebaptisés Declarative Automation Bundles dans la documentation récente ; les commandes et le fichier <code>databricks.yml</code> sont inchangés) : le projet (code + définition des jobs, pipelines, dashboards) est décrit en YAML dans <code>databricks.yml</code> et versionné dans Git.`,
        `Cycle : <code>databricks bundle validate</code>, <code>deploy -t dev</code>, <code>run</code>. Les <b>targets</b> (dev, recette, prod) portent les différences d'environnement : workspace, catalogue, identité d'exécution.`,
        `En production, les jobs s'exécutent sous un <b>service principal</b>, jamais sous le compte d'une personne.`,
        `Isolation des environnements : au minimum un catalogue par environnement (<code>ventes_dev</code>, <code>ventes_prod</code>), idéalement un workspace par environnement.`,
        `<b>CI/CD</b> : à chaque pull request, tests unitaires et <code>bundle validate</code> ; à la fusion, <code>bundle deploy</code> vers la cible. GitHub Actions ou Azure DevOps font très bien l'affaire.`,
        `<b>Tests</b> : sors la logique dans des fonctions Python pures qui prennent et rendent des DataFrames, et teste-les avec pytest. Complète par des contrôles de qualité dans le pipeline (expectations, alertes).`,
        `<b>Secrets</b> : dans des secret scopes (adossés à Azure Key Vault), jamais dans le code ni dans le YAML.`,
        `<b>Observabilité</b> : system tables (jobs, audit, facturation), notifications d'échec, lineage.`
      ],
      code: [
        { t: `databricks.yml minimal`, c: `bundle:
  name: dojo_pipeline

resources:
  jobs:
    courses_quotidien:
      name: courses_quotidien
      tasks:
        - task_key: silver
          notebook_task:
            notebook_path: ./notebooks/02_silver.py
        - task_key: gold
          depends_on:
            - task_key: silver
          notebook_task:
            notebook_path: ./notebooks/03_gold.py

targets:
  dev:
    mode: development
    default: true
  prod:
    mode: production
    run_as:
      service_principal_name: "00000000-0000-0000-0000-000000000000"` },
        { t: `Cycle de déploiement`, c: `databricks bundle validate
databricks bundle deploy -t dev
databricks bundle run courses_quotidien -t dev` }
      ],
      traps: [
        `Créer les jobs à la main dans l'interface de production : impossible à reproduire, à relire et à auditer.`,
        `Écrire le nom du catalogue en dur dans le code : passe-le en variable de bundle ou en paramètre.`,
        `Faire tourner la production sous le compte d'un développeur : au départ de la personne, tout s'arrête.`
      ],
      ask: [
        `Quelle organisation de dépôt Git recommandez-vous pour un projet Databricks ?`,
        `Asset Bundles ou Terraform : qui gère quoi ?`
      ],
      answers: [
        `<b>Synthèse :</b> Structure standard d'un dépôt <b>Databricks Asset Bundle</b> : <code>databricks.yml</code> à la racine, <code>resources/</code> (fichiers YAML découpés par job et pipeline), <code>src/</code> (les notebooks et un package Python partageable pour les fonctions pures), <code>tests/</code> (les tests unitaires <code>pytest</code> exécutés à chaque PR) et <code>.github/workflows/</code> ou <code>azure-pipelines.yml</code> pour l'intégration continue.`,
        `<b>Synthèse :</b> Séparation claire des responsabilités : <b>Terraform</b> (équipe Cloud / Infra) déploie le socle permanent : les Workspaces Azure Databricks, le réseau (VNet, Private Link), l'Access Connector, le metastore Unity Catalog, les Catalogues, les Storage Credentials et les Service Principals. <b>Databricks Asset Bundles (DABs)</b> (équipe Data) déploie tout ce qui vit au rythme du code applicatif : les Jobs, les Pipelines déclaratifs, les Notebooks, les fichiers Python et les Dashboards.`
      ],
      lab: {
        title: `Déployer ton pipeline par bundle`, time: `60 min`,
        steps: [
          `Installe la CLI Databricks et authentifie-toi sur ton workspace (<code>databricks auth login</code>).`,
          `Initialise un projet avec <code>databricks bundle init</code> (modèle default-python) et lis le <code>databricks.yml</code> généré.`,
          `Remplace le job d'exemple par ton job à trois tâches du module Orchestration.`,
          `Valide, déploie sur la cible dev, lance le job depuis la CLI.`,
          `Pousse le projet dans un dépôt Git. Tu as maintenant un pipeline reproductible : c'est ton projet vitrine.`
        ],
        sol: `databricks auth login --host https://<ton-workspace>
databricks bundle init
databricks bundle validate
databricks bundle deploy -t dev
databricks bundle run <nom_du_job> -t dev`
      },
      quiz: [
        { q: `Que décrit le fichier databricks.yml ?`, o: [`Les droits Unity Catalog`, `Le bundle : ressources (jobs, pipelines) et cibles de déploiement`, `La configuration réseau du workspace`, `Les bibliothèques du cluster uniquement`], a: 1, e: `C'est le point d'entrée d'un Databricks Asset Bundle.` },
        { q: `Sous quelle identité un job de production doit-il s'exécuter ?`, o: [`Le compte du développeur qui l'a créé`, `Un service principal`, `Le compte administrateur du workspace`, `Un compte invité`], a: 1, e: `Un service principal n'est lié à aucune personne et porte des droits limités au besoin.` },
        { q: `Quelle commande pousse le projet vers l'environnement cible ?`, o: [`databricks bundle validate`, `databricks bundle deploy -t prod`, `databricks jobs create`, `databricks workspace import`], a: 1, e: `validate vérifie, deploy crée ou met à jour les ressources de la cible.` },
        { q: `Comment rendre la logique de transformation testable ?`, o: [`En la laissant dans des cellules de notebook`, `En l'extrayant dans des fonctions Python qui prennent et rendent des DataFrames`, `En la dupliquant dans chaque environnement`, `En l'écrivant en UDF`], a: 1, e: `Des fonctions pures se testent avec pytest sur de petits DataFrames.` },
        { q: `Où stocker le mot de passe d'une base source ?`, o: [`Dans le notebook, en commentaire`, `Dans databricks.yml`, `Dans un secret scope adossé à Key Vault`, `Dans un widget`], a: 2, e: `Les secrets ne doivent apparaître ni dans le code ni dans la configuration versionnée.` }
      ],
      cards: [
        [`Databricks Asset Bundles`, `Description en YAML du code et des ressources (jobs, pipelines), versionnée et déployable par environnement.`],
        [`Les 3 commandes de bundle`, `validate, deploy -t cible, run.`],
        [`Service principal`, `Identité technique sous laquelle s'exécutent les jobs de production.`],
        [`Isolation minimale des environnements`, `Un catalogue par environnement ; idéalement un workspace par environnement.`],
        [`CI/CD type`, `Pull request : tests + bundle validate. Fusion : bundle deploy vers la cible.`]
      ]
    }
  ],

  plan: [
    { when: `Semaine 1`, what: `Créer un compte Databricks Free Edition. Les fondations : plateforme, calcul, gouvernance. Un simulateur et un quiz par module.`, mods: [`m1`, `m2`, `m3`] },
    { when: `Semaine 2`, what: `Construire : notebooks, Spark et Delta. Le lab Delta (MERGE et time travel) est le plus rentable de tout le parcours.`, mods: [`m4`, `m5`, `m6`] },
    { when: `Semaine 3`, what: `Livrer : un job à trois tâches, une requête, un tableau de bord. Flashcards dix minutes par jour.`, mods: [`m7`, `m8`] },
    { when: `Semaine 4`, what: `Passer expert : ingestion incrémentale, performance, CI/CD. Terminer le projet fil rouge, puis viser la certification Data Engineer Associate.`, mods: [`m9`, `m10`, `m11`] }
  ],

  projet: [
    `Ingestion Auto Loader de fichiers JSON vers une table bronze`,
    `Table silver nettoyée, alimentée par MERGE incrémental`,
    `Deux tables gold avec liquid clustering`,
    `Un job à plusieurs tâches, paramétré par date, avec alerte en cas d'échec`,
    `Un dashboard AI/BI et une alerte qualité`,
    `Le tout décrit dans un Asset Bundle et versionné dans Git`,
    `Une page de README qui explique les choix : c'est ce que tu montreras en interne`
  ],

  tracks: {
    all: {
      label: `Cursus complet`,
      time: `~15 h · 11 modules`,
      desc: `Le parcours intégral de la formation Databricks : des fondations jusqu'à l'industrialisation par Asset Bundles.`,
      mods: [`m1`, `m2`, `m3`, `m4`, `m5`, `m6`, `m7`, `m8`, `m9`, `m10`, `m11`]
    },
    express: {
      label: `Sprint Express (Absents formation)`,
      time: `2 h chrono · 6 modules clés`,
      desc: `Tu n'as pas pu assister aux 3 jours de formation ? Voici le condensé opérationnel : les 6 modules incontournables, leurs simulateurs et le Labo SQL pour tout comprendre en un après-midi.`,
      mods: [`m1`, `m2`, `m3`, `m6`, `m7`, `m9`],
      steps: [
        `<b>00:00 – 00:25 · Fondations & Coûts</b> : Lis l'essentiel des modules <a href="#module-m1">1 (Plateforme)</a> et <a href="#module-m2">2 (Compute)</a>, puis réussis le simulateur <a href="#sim-cout">Facture d'un pipeline</a>.`,
        `<b>00:25 – 00:45 · Unity Catalog</b> : Parcoure le module <a href="#module-m3">3 (Unity Catalog)</a> et débloque l'accès de l'analyste dans le simulateur <a href="#sim-droits">Droits UC</a>.`,
        `<b>00:45 – 01:10 · Le cœur de Delta Lake</b> : Étudie le module <a href="#module-m6">6 (Delta Lake)</a>, manipule le journal dans le simulateur <a href="#sim-delta">Time Travel & VACUUM</a>.`,
        `<b>01:10 – 01:45 · Mains dans le cambouis SQL</b> : Ouvre le <a href="#labo">Labo SQL (Banque Lanterne)</a> et réalise au moins les missions 1, 3, 4 et 7 (registre des défauts, Silver/rejets, Gold et Upsert idempotent).`,
        `<b>01:45 – 02:00 · Orchestration & Ingestion</b> : Passe les simulateurs <a href="#sim-job">Repair run</a>, <a href="#sim-dlt">Expectations Lakeflow</a> et <a href="#sim-autoloader">Auto Loader</a>.`
      ]
    },
    bi: {
      label: `Consultant BI, SQL & Analytics`,
      time: `~5 h · 5 modules`,
      desc: `Conçu pour les profils BI, Data Analysts et spécialistes Power BI / SQL qui exploitent ou modélisent la couche Gold.`,
      mods: [`m1`, `m2`, `m3`, `m6`, `m8`]
    },
    de: {
      label: `Data Engineer & Indus`,
      time: `~10 h · 8 modules`,
      desc: `Ciblé sur la construction de pipelines robustes : PySpark, Delta Lake, Auto Loader, Lakeflow Jobs/DLT, diagnostic Spark UI et CI/CD.`,
      mods: [`m3`, `m4`, `m5`, `m6`, `m7`, `m9`, `m10`, `m11`]
    },
    certif: {
      label: `Objectif Certification Associate`,
      time: `~8 h · 7 modules + Examen`,
      desc: `Focalisé sur les chapitres à fort coefficient de la certification Databricks Certified Data Engineer Associate et les pièges d'examen.`,
      mods: [`m1`, `m3`, `m4`, `m6`, `m7`, `m9`, `m11`]
    }
  },

  playbooks: [
    {
      title: `Découpage Unity Catalog multi-environnements`,
      tag: `Gouvernance · Module 3`,
      ctx: `Le client démarre sur Unity Catalog avec 3 environnements (Dev, UAT, Prod) et 2 domaines métiers (Finance, Retail). Il hésite entre créer 3 metastores ou tout mettre dans un seul catalogue.`,
      diag: `Un metastore par environnement empêche le partage simple et complique l'administration ; un seul catalogue pour tout le monde mélange les droits de dev et de prod.`,
      reco: `<b>1 seul metastore par région</b>, puis des catalogues nommés <code>&lt;domaine&gt;_&lt;env&gt;</code> (<code>finance_dev</code>, <code>finance_prod</code>, <code>retail_dev</code>, <code>retail_prod</code>), chacun rattaché à son propre conteneur ADLS managé, avec les schémas <code>bronze</code>, <code>silver</code>, <code>gold</code>.`,
      trap: `Coder le nom du catalogue en dur dans les requêtes SQL : passe toujours le catalogue en paramètre de job ou variable d'Asset Bundle (<code>USE CATALOG IDENTIFIER(:catalogue)</code>).`
    },
    {
      title: `Power BI sur Databricks : Import, DirectQuery ou Dual ?`,
      tag: `SQL & BI · Module 8`,
      ctx: `Une direction métier veut brancher Power BI en DirectQuery sur une table de 400 millions de lignes pour « avoir le temps réel », mais se plaint de lenteurs et d'une facture SQL Warehouse élevée.`,
      diag: `Chaque clic de filtre dans Power BI envoie plusieurs requêtes SQL analytiques et maintient le SQL Warehouse allumé en permanence.`,
      reco: `Passer en <b>mode Import</b> (rafraîchi 2 à 4 fois par jour) pour 90 % des rapports, ou en <b>mode Composite (Dual)</b> : tables d'agrégats Gold en Import (réponse en 50 ms) et table de détail en DirectQuery uniquement lors d'un drill-through sur une transaction précise, sur un <b>SQL Warehouse Serverless</b>.`,
      trap: `Connecter Power BI directement sur la couche Silver ou sur un cluster Spark All-purpose au lieu du HTTP Path d'un SQL Warehouse.`
    },
    {
      title: `Choisir le bon pattern d'ingestion de fichiers`,
      tag: `Ingestion · Module 9`,
      ctx: `Des fichiers JSON et CSV arrivent toutes les 15 minutes dans un conteneur ADLS (environ 5 000 fichiers par jour). Le schéma source ajoute parfois des champs sans prévenir.`,
      diag: `Un listage classique ou un simple <code>spark.read.json()</code> re-scanne tout le répertoire à chaque exécution et casse dès qu'une colonne change.`,
      reco: `Utiliser <b>Auto Loader (<code>cloudFiles</code>)</b> (ou <code>STREAM read_files()</code> dans un pipeline déclaratif) vers un Volume / External Location, avec un trigger <b><code>availableNow=True</code></b> planifié toutes les 15 min : on paie le coût d'un batch court tout en ayant la gestion de checkpoint et la colonne <code>_rescued_data</code>.`,
      trap: `Laisser tourner un cluster en streaming continu 24h/24 (<code>processingTime</code>) alors qu'une fraîcheur de 15 minutes en <code>availableNow</code> suffit et coûte 5 fois moins cher.`
    },
    {
      title: `ADF, Lakeflow Jobs ou Pipelines déclaratifs (DLT) ?`,
      tag: `Orchestration · Module 7`,
      ctx: `L'équipe utilisait Azure Data Factory (ADF) pour lancer 18 notebooks Databricks les uns après les autres via 18 activités Notebook distinctes.`,
      diag: `Chaque activité ADF instancie ou sollicite du calcul séparément, le passage de paramètres est lourd et on perd la réutilisation de job cluster ainsi que le Repair Run natif.`,
      reco: `Garder ADF uniquement pour déposer la donnée brute depuis les sources externes, puis déclencher <b>un seul Lakeflow Job multi-tâches</b> côté Databricks. Utiliser un <b>Pipeline déclaratif (Lakeflow / DLT)</b> pour les flux Bronze → Silver → Gold qui nécessitent des <i>Expectations</i> de qualité et du SCD Type 2 automatique.`,
      trap: `Orchestrer les notebooks par une boucle de <code>dbutils.notebook.run()</code> dans un notebook « maître » : en cas d'échec à la 14e table, impossible de faire un Repair Run ciblé.`
    },
    {
      title: `Audit FinOps : réduire la facture de 40 % en une semaine`,
      tag: `Coûts & Perf · Modules 2 & 10`,
      ctx: `Le client trouve sa facture Azure Databricks + VM trop élevée alors que les volumes de données restent modérés.`,
      diag: `Dans 4 cas sur 5 : des jobs de production tournent sur des clusters All-purpose, des clusters de dev ont un auto-stop à 120 min (ou désactivé), et un SQL Warehouse est réveillé toutes les 5 min par une alerte.`,
      reco: `1) Interroger <code>system.billing.usage</code> par SKU. 2) Basculer tous les traitements planifiés sur du <b>Job compute</b> ou <b>Serverless Jobs</b>. 3) Imposer une <b>Cluster Policy</b> avec auto-termination à 15–20 min en dev. 4) Activer <b>Liquid Clustering</b> sur les tables Gold les plus lues.`,
      trap: `Doubler la taille du cluster d'un job lent avant d'avoir vérifié dans la Spark UI s'il s'agit d'un <i>data skew</i> sur une seule partition.`
    },
    {
      title: `Migrer d'un entrepôt SQL Server / Oracle vers le Lakehouse`,
      tag: `Architecture · Modules 5 & 6`,
      ctx: `Une équipe habituée aux bases relationnelles transpose telle quelle une série de procédures stockées contenant des curseurs ligne à ligne et des centaines de petits <code>UPDATE</code> unitaires.`,
      diag: `Sur Delta Lake, chaque <code>UPDATE</code> ou <code>INSERT</code> unitaire crée un nouveau commit et réécrit des fichiers Parquet (ou génère des deletion vectors) : une boucle de 1 000 <code>INSERT</code> met 20 minutes au lieu de 2 secondes.`,
      reco: `Remplacer la logique ligne à ligne par des opérations ensemblistes : construire un DataFrame / CTE de toutes les modifications du lot, puis appliquer <b>un seul <code>MERGE INTO</code></b> ou <b><code>INSERT … REPLACE WHERE</code></b> par table.`,
      trap: `Créer des index ou partitionner une table de 5 Go en 3 000 dossiers par jour + agence : utiliser <code>CLUSTER BY</code> (Liquid Clustering) à la place.`
    }
  ],

  glossary: [
    [`ADLS Gen2`, `Azure Data Lake Storage : le stockage objet où vivent les fichiers des tables.`],
    [`AQE`, `Adaptive Query Execution : réoptimisation du plan Spark pendant l'exécution (coalesce des partitions, broadcast dynamique, gestion du skew).`],
    [`Auto Loader`, `Ingestion incrémentale de fichiers à grande échelle (format cloudFiles en PySpark, STREAM read_files en SQL).`],
    [`Catalyst`, `L'optimiseur de requêtes de Spark qui transforme le plan logique en plan physique optimisé.`],
    [`CDF`, `Change Data Feed : option Delta qui expose le flux des lignes insérées, mises à jour et supprimées entre deux versions.`],
    [`Checkpoint`, `Dossier d'état de progression d'un flux Structured Streaming garantissant le traitement exactement une fois.`],
    [`DABs`, `Databricks Asset Bundles (ou Declarative Automation Bundles) : description industrielle du projet (jobs, pipelines, cibles) en YAML.`],
    [`Data skipping`, `Évitement automatique de lecture des fichiers Parquet grâce aux statistiques min/max stockées dans _delta_log.`],
    [`DBR`, `Databricks Runtime : image système qui fixe les versions de Spark, Delta, Python et des bibliothèques.`],
    [`DBU`, `Databricks Unit : unité de facturation de la puissance de calcul sur la plateforme.`],
    [`Delta Lake`, `Format de table ouvert : fichiers Parquet + journal transactionnel JSON (_delta_log) apportant ACID et Time Travel.`],
    [`Deletion vector`, `Marquage logique des lignes supprimées ou modifiées dans un fichier annexe sans réécrire immédiatement le fichier Parquet.`],
    [`Driver`, `Nœud maître du cluster qui porte la session Spark, construit le plan et coordonne les workers.`],
    [`Expectation`, `Règle de qualité de données déclarée dans un pipeline déclaratif (tracer, DROP ROW ou FAIL UPDATE).`],
    [`External location`, `Objet Unity Catalog associant un chemin ADLS et un Storage Credential.`],
    [`Genie`, `Interface AI/BI permettant d'interroger des tables gouvernées en langage naturel.`],
    [`Git folder`, `Dossier du workspace connecté à un dépôt Git distant (anciennement Repos).`],
    [`Idempotence`, `Propriété d'un traitement qui produit exactement le même état final même s'il est exécuté plusieurs fois de suite.`],
    [`Lakeflow`, `Famille unifiée d'outils d'ingestion et d'orchestration : Connect, Spark Declarative Pipelines (ex-DLT) et Jobs (ex-Workflows).`],
    [`Liquid clustering`, `Organisation physique souple des données par CLUSTER BY (colonnes), successeur du partitionnement et du Z-ORDER.`],
    [`Medallion`, `Architecture en 3 couches : Bronze (brut historisé), Silver (nettoyé, typé, dédoublonné), Gold (agrégé pour le métier).`],
    [`Metastore`, `Conteneur racine de gouvernance Unity Catalog (un seul par région cloud).`],
    [`Photon`, `Moteur d'exécution natif vectorisé en C++ qui accélère les requêtes SQL et DataFrame.`],
    [`Predictive optimization`, `Maintenance automatique (OPTIMIZE, VACUUM, ANALYZE) exécutée en arrière-plan sur les tables managées Unity Catalog.`],
    [`Service principal`, `Identité technique non humaine sous laquelle doivent tourner les jobs et déploiements de production.`],
    [`Shuffle`, `Redistribution coûteuse des données sur le réseau entre les workers lors d'un join, groupBy, distinct ou orderBy.`],
    [`Skew`, `Déséquilibre de répartition où une clé concentre une part disproportionnée des données sur une seule task.`],
    [`Spill`, `Débordement sur disque local lorsque les données traitées par une task dépassent la mémoire RAM disponible.`],
    [`Volume`, `Objet Unity Catalog gouvernant les fichiers non tabulaires (/Volumes/catalogue/schema/volume/).`],
    [`Watermark`, `Seuil de tolérance au retard des événements dans une agrégation en streaming.`],
    [`Z-ORDER`, `Technique historique de tri multidimensionnel des fichiers Delta, aujourd'hui remplacée par le Liquid Clustering.`]
  ]
};
