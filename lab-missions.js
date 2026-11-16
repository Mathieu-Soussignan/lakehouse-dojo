// Missions du Labo SQL : données pures (SQL de chargement, SQL de référence, missions, équivalences).
// Le SQL est celui de DuckDB (moteur du labo). Les différences avec Databricks sont dans DIALECT.
window.LAB = {
  /* Ce que « la plateforme » a déjà chargé : la couche bronze, lue telle quelle depuis les fichiers. */
  INGEST: `CREATE OR REPLACE TABLE bronze_agences AS SELECT * FROM read_csv('agences.csv', header = true);
CREATE OR REPLACE TABLE bronze_clients AS SELECT * FROM read_csv('clients.csv', delim = ';', header = true, dateformat = '%d/%m/%Y', types = {'code_postal': 'VARCHAR'});
CREATE OR REPLACE TABLE bronze_comptes AS SELECT * FROM read_csv('comptes.csv', header = true);
CREATE OR REPLACE TABLE bronze_transactions AS SELECT * FROM read_csv('transactions/*.csv', header = true);
CREATE OR REPLACE TABLE bronze_taux AS SELECT * FROM read_csv('taux_change.csv', header = true);
CREATE OR REPLACE TABLE arrivee_20260701 AS SELECT * FROM read_csv('arrivees/transactions_2026-07-01.csv', header = true);
CREATE OR REPLACE TABLE arrivee_20260702 AS SELECT * FROM read_csv('arrivees/transactions_2026-07-02.csv', header = true);
CREATE OR REPLACE TABLE arrivee_20260703 AS SELECT * FROM read_csv('arrivees/transactions_2026-07-03.csv', header = true);`,

  /* La chaîne de référence, matérialisée dans le schéma ref : les missions comparent ton travail à elle. */
  REF: `CREATE SCHEMA IF NOT EXISTS ref;
CREATE OR REPLACE TABLE ref.silver_clients AS
  SELECT DISTINCT client_id, upper(trim(nom)) AS nom, prenom, email, date_naissance, date_entree, segment, agence_id, ville, code_postal FROM bronze_clients;
CREATE OR REPLACE TABLE ref.q AS
  WITH d AS (SELECT DISTINCT * FROM bronze_transactions)
  SELECT d.*, CASE WHEN d.horodatage >= TIMESTAMP '2026-07-01' THEN 'date_future'
                   WHEN c.compte_id IS NULL THEN 'compte_inconnu'
                   WHEN d.montant = 0 THEN 'montant_nul'
                   WHEN d.type_operation = 'DEBIT' AND d.montant > 0 THEN 'signe_incoherent' END AS rejet
  FROM d LEFT JOIN bronze_comptes c ON c.compte_id = d.compte_id;
CREATE OR REPLACE TABLE ref.silver_transactions AS SELECT * EXCLUDE (rejet) REPLACE (upper(trim(devise)) AS devise) FROM ref.q WHERE rejet IS NULL;
CREATE OR REPLACE TABLE ref.rejets AS SELECT * FROM ref.q WHERE rejet IS NOT NULL;
CREATE OR REPLACE TABLE ref.gold_flux AS
  WITH tm AS (SELECT date_trunc('month', jour)::DATE AS mois, devise, avg(taux) AS taux FROM bronze_taux GROUP BY ALL),
       tx AS (SELECT t.*, date_trunc('month', t.horodatage)::DATE AS mois FROM ref.silver_transactions t)
  SELECT cl.agence_id, tx.mois, count(*) AS operations,
         round(sum(CASE WHEN tx.devise = 'EUR' THEN tx.montant ELSE tx.montant / tm.taux END), 2) AS montant_net_eur
  FROM tx JOIN bronze_comptes co ON co.compte_id = tx.compte_id
          JOIN ref.silver_clients cl ON cl.client_id = co.client_id
          LEFT JOIN tm ON tm.mois = tx.mois AND tm.devise = tx.devise
  GROUP BY cl.agence_id, tx.mois;
CREATE OR REPLACE TABLE ref.silver_j1 AS SELECT * FROM ref.silver_transactions;
UPDATE ref.silver_j1 SET statut = 'ANNULEE' FROM arrivee_20260701 a WHERE ref.silver_j1.transaction_id = a.transaction_id AND a.statut = 'ANNULEE' AND ref.silver_j1.statut <> 'ANNULEE';
INSERT INTO ref.silver_j1 SELECT a.* REPLACE (upper(trim(a.devise)) AS devise) FROM arrivee_20260701 a WHERE a.statut = 'VALIDEE' AND NOT EXISTS (SELECT 1 FROM ref.silver_j1 s WHERE s.transaction_id = a.transaction_id);
CREATE OR REPLACE TABLE ref.lot_3j AS
  WITH brut AS (
    SELECT * REPLACE (upper(trim(devise)) AS devise) FROM arrivee_20260701
    UNION ALL SELECT * REPLACE (upper(trim(devise)) AS devise) FROM arrivee_20260702
    UNION ALL SELECT * REPLACE (upper(trim(devise)) AS devise) FROM arrivee_20260703
  )
  SELECT * FROM brut QUALIFY row_number() OVER (PARTITION BY transaction_id ORDER BY CASE WHEN statut = 'ANNULEE' THEN 0 ELSE 1 END) = 1;
CREATE OR REPLACE TABLE ref.silver_j3 AS SELECT * FROM ref.silver_transactions;
UPDATE ref.silver_j3 SET statut = 'ANNULEE' FROM ref.lot_3j a WHERE ref.silver_j3.transaction_id = a.transaction_id AND a.statut = 'ANNULEE' AND ref.silver_j3.statut <> 'ANNULEE';
INSERT INTO ref.silver_j3 SELECT a.* FROM ref.lot_3j a WHERE NOT EXISTS (SELECT 1 FROM ref.silver_j3 s WHERE s.transaction_id = a.transaction_id);`,

  /* Ce qui change entre le SQL du labo (DuckDB) et celui de Databricks. */
  DIALECT: [
    ['read_csv(\'f.csv\', delim = \';\')', 'read_files(\'…/f.csv\', format => \'csv\', sep => \';\')', 'Lecture d\'un fichier. En Databricks on lit un chemin ADLS ou un volume.'],
    ['SELECT * EXCLUDE (col)', 'SELECT * EXCEPT (col)', 'Toutes les colonnes sauf une.'],
    ['a ANTI JOIN b ON …', 'a LEFT ANTI JOIN b ON …', 'Les lignes de a sans correspondance dans b.'],
    ['QUALIFY row_number() OVER (…) <= 3', 'QUALIFY row_number() OVER (…) <= 3', 'Identique : filtrer sur une fonction de fenêtre.'],
    ['count_if(cond)', 'count_if(cond)', 'Identique.'],
    ['GROUP BY ALL', 'GROUP BY ALL', 'Identique.'],
    ['UPDATE … FROM + INSERT … WHERE NOT EXISTS', 'MERGE INTO … USING …', 'Ce moteur n\'a pas MERGE : on écrit ses deux moitiés à la main. Sur Delta, une seule instruction atomique.'],
    ['CREATE OR REPLACE TABLE', 'CREATE OR REPLACE TABLE', 'Identique. Sur Databricks la table est une table Delta.']
  ],

  MISSIONS: [
    {
      id: 'm0', xp: 10, title: 'Bonjour, Lanterne',
      brief: 'La Banque Lanterne (fictive) vous confie ses fichiers. La plateforme les a déjà lus : les tables <code>bronze_*</code> sont dans le panneau de gauche. Première question : combien de lignes compte <code>bronze_transactions</code> ?',
      starter: '-- Écris une requête qui renvoie le nombre de lignes de bronze_transactions\n',
      hints: ['Une fonction d\'agrégation sans GROUP BY renvoie une seule ligne.', '<code>count(*)</code> compte les lignes d\'une table.', 'SELECT count(*) AS lignes FROM bronze_transactions;'],
      expect: { rows: [[3265]] },
      py: 'spark.table("bronze_transactions").count()'
    },
    {
      id: 'm1', xp: 40, title: 'Le registre des défauts',
      brief: 'Avant de nettoyer, on mesure. Écris <strong>une requête</strong> qui renvoie une ligne par défaut, avec le nombre de lignes concernées. Colonnes : <code>defaut</code>, <code>lignes</code>.',
      rules: [
        ['doublon_exact', 'Les lignes en trop : lignes totales moins lignes distinctes.'],
        ['montant_nul', 'Une opération de montant 0.'],
        ['date_future', 'Une opération datée du 1er juillet 2026 ou après.'],
        ['compte_inconnu', 'Un compte_id absent de bronze_comptes.'],
        ['signe_incoherent', 'Un DEBIT de montant positif.'],
        ['devise_mal_formee', 'Une devise qui change quand on la passe par upper(trim()).']
      ],
      starter: '-- Une ligne par défaut : defaut, lignes\n-- Les cinq derniers se comptent sur les lignes DISTINCTES (les doublons ne comptent qu\'une fois).\nWITH d AS (SELECT DISTINCT * FROM bronze_transactions)\nSELECT \'montant_nul\' AS defaut, count_if(montant = 0) AS lignes FROM d\nUNION ALL\n-- … les autres défauts\nSELECT \'doublon_exact\', 0;\n',
      hints: ['<code>UNION ALL</code> empile une requête par défaut ; <code>count_if(condition)</code> compte les lignes qui la vérifient.', 'Pour <code>compte_inconnu</code> : <code>FROM d ANTI JOIN bronze_comptes c ON c.compte_id = d.compte_id</code>. Pour les doublons : <code>count(*)</code> sur la table brute moins <code>count(*)</code> sur <code>d</code>.',
        'WITH t AS (SELECT * FROM bronze_transactions), d AS (SELECT DISTINCT * FROM t)\nSELECT \'doublon_exact\' AS defaut, (SELECT count(*) FROM t) - (SELECT count(*) FROM d) AS lignes\nUNION ALL SELECT \'montant_nul\', count_if(montant = 0) FROM d\nUNION ALL SELECT \'date_future\', count_if(horodatage >= TIMESTAMP \'2026-07-01\') FROM d\nUNION ALL SELECT \'compte_inconnu\', count(*) FROM d ANTI JOIN bronze_comptes c ON c.compte_id = d.compte_id\nUNION ALL SELECT \'signe_incoherent\', count_if(type_operation = \'DEBIT\' AND montant > 0) FROM d\nUNION ALL SELECT \'devise_mal_formee\', count_if(devise <> upper(trim(devise))) FROM d;'],
      expect: { sql: 'WITH t AS (SELECT * FROM bronze_transactions), d AS (SELECT DISTINCT * FROM t) SELECT \'doublon_exact\', (SELECT count(*) FROM t) - (SELECT count(*) FROM d) UNION ALL SELECT \'montant_nul\', count_if(montant = 0) FROM d UNION ALL SELECT \'date_future\', count_if(horodatage >= TIMESTAMP \'2026-07-01\') FROM d UNION ALL SELECT \'compte_inconnu\', count(*) FROM d ANTI JOIN bronze_comptes c ON c.compte_id = d.compte_id UNION ALL SELECT \'signe_incoherent\', count_if(type_operation = \'DEBIT\' AND montant > 0) FROM d UNION ALL SELECT \'devise_mal_formee\', count_if(devise <> upper(trim(devise))) FROM d' },
      after: 'Tu viens de produire ce que tout projet de données devrait avoir avant d\'écrire une ligne de transformation : un registre chiffré de ce qui ne va pas. Les trois premiers défauts seront <em>rejetés</em>, le quatrième aussi, et le dernier sera <em>corrigé</em> : c\'est la mission 3.',
      py: 'from pyspark.sql import functions as F\n\nt = spark.table("bronze_transactions")\nd = t.dropDuplicates()\nc = spark.table("bronze_comptes").select("compte_id")\n\nregistre = [\n    ("doublon_exact", t.count() - d.count()),\n    ("montant_nul", d.filter("montant = 0").count()),\n    ("date_future", d.filter("horodatage >= \'2026-07-01\'").count()),\n    ("compte_inconnu", d.join(c, "compte_id", "left_anti").count()),\n    ("signe_incoherent", d.filter("type_operation = \'DEBIT\' AND montant > 0").count()),\n    ("devise_mal_formee", d.filter(F.col("devise") != F.upper(F.trim("devise"))).count()),\n]\ndisplay(spark.createDataFrame(registre, ["defaut", "lignes"]))'
    },
    {
      id: 'm2', xp: 40, title: 'Des clients propres',
      brief: 'Construis <code>silver_clients</code> à partir de <code>bronze_clients</code> : <strong>sans doublons</strong>, avec le <code>nom</code> sans espaces autour et en <strong>majuscules</strong>. Les e-mails manquants restent nuls : un e-mail absent n\'est pas une erreur de format, c\'est une information. Garde les 10 colonnes, dans le même ordre.',
      starter: 'CREATE OR REPLACE TABLE silver_clients AS\nSELECT\n  client_id,\n  nom, -- à nettoyer\n  prenom, email, date_naissance, date_entree, segment, agence_id, ville, code_postal\nFROM bronze_clients;\n',
      hints: ['<code>SELECT DISTINCT</code> retire les lignes strictement identiques : pense à l\'appliquer <em>après</em> avoir nettoyé le nom.', '<code>upper(trim(nom))</code> fait les deux nettoyages en une expression.', 'CREATE OR REPLACE TABLE silver_clients AS\nSELECT DISTINCT client_id, upper(trim(nom)) AS nom, prenom, email, date_naissance, date_entree, segment, agence_id, ville, code_postal\nFROM bronze_clients;'],
      table: { name: 'silver_clients', ref: 'ref.silver_clients' },
      variants: [
        { sql: 'SELECT client_id, upper(trim(nom)) AS nom, prenom, email, date_naissance, date_entree, segment, agence_id, ville, code_postal FROM bronze_clients', msg: 'Les doublons sont toujours là : 64 lignes pour 60 clients. Ajoute DISTINCT.' },
        { sql: 'SELECT DISTINCT client_id, upper(nom) AS nom, prenom, email, date_naissance, date_entree, segment, agence_id, ville, code_postal FROM bronze_clients', msg: 'Les espaces autour des noms ne sont pas retirés : les lignes \'MOREAU \' et \'MOREAU\' sont encore deux valeurs différentes. Ajoute trim().' }
      ],
      py: 'from pyspark.sql import functions as F\n\n(spark.table("bronze_clients")\n    .withColumn("nom", F.upper(F.trim("nom")))\n    .dropDuplicates()\n    .write.mode("overwrite").saveAsTable("silver_clients"))'
    },
    {
      id: 'm3', xp: 60, title: 'Silver, rejets, et la comptabilité des lignes',
      brief: 'Construis deux tables. <code>silver_transactions</code> : les transactions <strong>sans doublons</strong>, <strong>sans rejet</strong>, avec la <code>devise</code> normalisée (<code>upper(trim())</code>), mêmes 10 colonnes. <code>rejets</code> : les lignes rejetées, avec une colonne <code>rejet</code>. Un rejet vaut, <em>dans cet ordre</em> : <code>date_future</code>, <code>compte_inconnu</code>, <code>montant_nul</code>, <code>signe_incoherent</code>. Rien ne disparaît sans être compté : <strong>bronze = silver + rejets + doublons</strong>.',
      starter: '-- Étape 1 : une vue des transactions dédoublonnées, avec la raison du rejet\nCREATE OR REPLACE TABLE qualif AS\nWITH d AS (SELECT DISTINCT * FROM bronze_transactions)\nSELECT d.*,\n  CASE\n    WHEN d.horodatage >= TIMESTAMP \'2026-07-01\' THEN \'date_future\'\n    -- WHEN … THEN \'compte_inconnu\'   (indice : LEFT JOIN bronze_comptes)\n    -- WHEN … THEN \'montant_nul\'\n    -- WHEN … THEN \'signe_incoherent\'\n  END AS rejet\nFROM d;\n\n-- Étape 2 : silver (sans la colonne rejet) et rejets\nCREATE OR REPLACE TABLE silver_transactions AS\nSELECT * EXCLUDE (rejet) FROM qualif WHERE rejet IS NULL;\n\nCREATE OR REPLACE TABLE rejets AS\nSELECT * FROM qualif WHERE rejet IS NOT NULL;\n',
      hints: ['Pour savoir si un compte existe : <code>LEFT JOIN bronze_comptes c ON c.compte_id = d.compte_id</code>, puis <code>c.compte_id IS NULL</code> signifie « inconnu ».', '<code>SELECT * EXCLUDE (rejet) REPLACE (upper(trim(devise)) AS devise)</code> retire la colonne et normalise la devise en une seule ligne.',
        'CREATE OR REPLACE TABLE qualif AS\nWITH d AS (SELECT DISTINCT * FROM bronze_transactions)\nSELECT d.*, CASE\n  WHEN d.horodatage >= TIMESTAMP \'2026-07-01\' THEN \'date_future\'\n  WHEN c.compte_id IS NULL THEN \'compte_inconnu\'\n  WHEN d.montant = 0 THEN \'montant_nul\'\n  WHEN d.type_operation = \'DEBIT\' AND d.montant > 0 THEN \'signe_incoherent\' END AS rejet\nFROM d LEFT JOIN bronze_comptes c ON c.compte_id = d.compte_id;\nCREATE OR REPLACE TABLE silver_transactions AS SELECT * EXCLUDE (rejet) REPLACE (upper(trim(devise)) AS devise) FROM qualif WHERE rejet IS NULL;\nCREATE OR REPLACE TABLE rejets AS SELECT * FROM qualif WHERE rejet IS NOT NULL;'],
      tables: [
        { name: 'silver_transactions', ref: 'ref.silver_transactions' },
        { name: 'rejets', ref: 'ref.rejets', cols: ['transaction_id', 'rejet'] }
      ],
      variants: [
        { table: 'silver_transactions', sql: 'SELECT * EXCLUDE (rejet) FROM ref.q WHERE rejet IS NULL', msg: 'Les devises ne sont pas normalisées : \'eur\', \' USD\' et \'EUR\' sont encore trois valeurs. Passe la colonne par upper(trim()).' },
        { table: 'silver_transactions', sql: 'SELECT * EXCLUDE (rejet) REPLACE (upper(trim(devise)) AS devise) FROM (SELECT t.*, NULL AS rejet FROM bronze_transactions t WHERE montant <> 0)', msg: 'Il reste des doublons ou des lignes à rejeter : relis les quatre règles de rejet, dans l\'ordre.' }
      ],
      after: 'Le bilan est bouclé. C\'est ce contrôle, <code>bronze = silver + rejets + doublons</code>, qui distingue un pipeline fiable d\'un pipeline qui « marche ». Dans Databricks, le même principe s\'écrit avec des <em>expectations</em> dans un pipeline déclaratif, ou avec une table de rejets comme ici.',
      flow: true,
      py: 'from pyspark.sql import functions as F\n\nd = spark.table("bronze_transactions").dropDuplicates()\nconnus = spark.table("bronze_comptes").select("compte_id", F.lit(True).alias("connu"))\n\nq = (d.join(connus, "compte_id", "left")\n  .withColumn("rejet",\n      F.when(F.col("horodatage") >= "2026-07-01", "date_future")\n       .when(F.col("connu").isNull(), "compte_inconnu")\n       .when(F.col("montant") == 0, "montant_nul")\n       .when((F.col("type_operation") == "DEBIT") & (F.col("montant") > 0), "signe_incoherent")))\n\ncols = d.columns\nq.filter("rejet IS NULL").select(*cols) \\\n  .withColumn("devise", F.upper(F.trim("devise"))) \\\n  .write.mode("overwrite").saveAsTable("silver_transactions")\nq.filter("rejet IS NOT NULL").write.mode("overwrite").saveAsTable("rejets")'
    },
    {
      id: 'm4', xp: 60, title: 'La couche gold et le taux de change',
      brief: 'Construis <code>gold_flux</code> : une ligne par <strong>agence</strong> et par <strong>mois</strong>, avec <code>agence_id</code>, <code>mois</code> (le 1er du mois, type DATE), <code>operations</code> (nombre d\'opérations) et <code>montant_net_eur</code> (somme des montants <strong>en euros</strong>, arrondie au centime). Les montants en devise se convertissent avec le <strong>taux moyen du mois</strong> de leur devise. Un taux est le nombre d\'unités de devise pour <em>1 euro</em> : multiplier, ou diviser ? Le chemin : <code>silver_transactions</code> → <code>bronze_comptes</code> (le client du compte) → <code>silver_clients</code> (l\'agence du client).',
      needs: ['silver_clients', 'silver_transactions'],
      starter: 'CREATE OR REPLACE TABLE gold_flux AS\nWITH taux_mois AS (\n  SELECT date_trunc(\'month\', jour)::DATE AS mois, devise, avg(taux) AS taux\n  FROM bronze_taux GROUP BY ALL\n),\ntx AS (\n  SELECT t.*, date_trunc(\'month\', t.horodatage)::DATE AS mois FROM silver_transactions t\n)\nSELECT\n  -- agence_id, mois, operations, montant_net_eur\nFROM tx\n  -- JOIN … JOIN … LEFT JOIN taux_mois …\nGROUP BY ALL;\n',
      hints: ['L\'agence vient du client : <code>tx → bronze_comptes (compte_id) → silver_clients (client_id)</code>. Les devises EUR n\'ont pas de ligne dans <code>bronze_taux</code> : prévois un <code>LEFT JOIN</code>.', '<code>CASE WHEN tx.devise = \'EUR\' THEN tx.montant ELSE tx.montant / tm.taux END</code>. 1 EUR = 1,08 USD : pour revenir en euros, on <em>divise</em> les dollars.',
        'CREATE OR REPLACE TABLE gold_flux AS\nWITH tm AS (SELECT date_trunc(\'month\', jour)::DATE AS mois, devise, avg(taux) AS taux FROM bronze_taux GROUP BY ALL),\n     tx AS (SELECT t.*, date_trunc(\'month\', t.horodatage)::DATE AS mois FROM silver_transactions t)\nSELECT cl.agence_id, tx.mois, count(*) AS operations,\n       round(sum(CASE WHEN tx.devise = \'EUR\' THEN tx.montant ELSE tx.montant / tm.taux END), 2) AS montant_net_eur\nFROM tx JOIN bronze_comptes co ON co.compte_id = tx.compte_id\n        JOIN silver_clients cl ON cl.client_id = co.client_id\n        LEFT JOIN tm ON tm.mois = tx.mois AND tm.devise = tx.devise\nGROUP BY cl.agence_id, tx.mois;'],
      table: { name: 'gold_flux', ref: 'ref.gold_flux', tol: 0.011 },
      variants: [
        { sql: 'SELECT cl.agence_id, tx.mois, count(*) AS operations, round(sum(CASE WHEN tx.devise = \'EUR\' THEN tx.montant ELSE tx.montant * tm.taux END), 2) AS montant_net_eur FROM (SELECT t.*, date_trunc(\'month\', t.horodatage)::DATE AS mois FROM ref.silver_transactions t) tx JOIN bronze_comptes co ON co.compte_id = tx.compte_id JOIN ref.silver_clients cl ON cl.client_id = co.client_id LEFT JOIN (SELECT date_trunc(\'month\', jour)::DATE AS mois, devise, avg(taux) AS taux FROM bronze_taux GROUP BY ALL) tm ON tm.mois = tx.mois AND tm.devise = tx.devise GROUP BY cl.agence_id, tx.mois', msg: 'Tu as <strong>multiplié</strong> par le taux. Un taux de 1,08 signifie « 1 € = 1,08 $ » : pour convertir des dollars en euros, il faut <strong>diviser</strong>. Le total est faux de plusieurs milliers d\'euros, et aucune erreur ne s\'affiche : c\'est ce qui rend ce bug dangereux.' }
      ],
      py: 'from pyspark.sql import functions as F\n\ntaux = (spark.table("bronze_taux")\n  .withColumn("mois", F.trunc("jour", "month"))\n  .groupBy("mois", "devise").agg(F.avg("taux").alias("taux")))\n\ntx = (spark.table("silver_transactions")\n  .withColumn("mois", F.trunc("horodatage", "month"))\n  .join(spark.table("bronze_comptes"), "compte_id")\n  .join(spark.table("silver_clients"), "client_id")\n  .join(taux, ["mois", "devise"], "left")\n  .withColumn("eur", F.when(F.col("devise") == "EUR", F.col("montant"))\n                      .otherwise(F.col("montant") / F.col("taux"))))\n\n(tx.groupBy("agence_id", "mois")\n   .agg(F.count("*").alias("operations"),\n        F.round(F.sum("eur"), 2).alias("montant_net_eur"))\n   .write.mode("overwrite").saveAsTable("gold_flux"))'
    },
    {
      id: 'm5', xp: 30, title: 'Où sont passées les opérations ?',
      brief: 'La silver compte plus d\'opérations que la gold. Écris une requête qui renvoie <strong>une seule valeur</strong> : le nombre d\'opérations de <code>silver_transactions</code> qui ne se retrouvent pas dans <code>gold_flux</code> (colonne <code>operations_perdues</code>). Puis explique pourquoi.',
      needs: ['silver_transactions', 'gold_flux'],
      starter: 'SELECT\n  (SELECT count(*) FROM silver_transactions) - (SELECT sum(operations) FROM gold_flux) AS operations_perdues;\n',
      hints: ['La gold est une somme du nombre d\'opérations par agence et par mois : <code>sum(operations)</code>.', 'C\'est une soustraction entre deux sous-requêtes.', 'SELECT (SELECT count(*) FROM silver_transactions) - (SELECT sum(operations) FROM gold_flux) AS operations_perdues;'],
      expect: { sql: 'SELECT (SELECT count(*) FROM ref.silver_transactions) - (SELECT sum(operations) FROM ref.gold_flux)' },
      followup: {
        q: 'Pourquoi ces opérations disparaissent-elles entre la silver et la gold ?',
        options: ['Elles sont des doublons que la silver a oubliés', 'Leur compte n\'a pas de client dans silver_clients : la jointure interne les écarte sans prévenir', 'Leur devise n\'a pas de taux de change', 'Elles sont datées de juillet'],
        answer: 1, xp: 10,
        explain: 'Trois comptes de comptes.csv pointent vers des clients absents de clients.csv. Une jointure interne écarte sans prévenir les lignes sans correspondance : compter avant et après est le seul garde-fou. Vérifie : <code>SELECT co.client_id, count(*) FROM silver_transactions t JOIN bronze_comptes co USING (compte_id) ANTI JOIN silver_clients c ON c.client_id = co.client_id GROUP BY 1</code>.'
      },
      py: 'perdues = spark.table("silver_transactions").count() - \\\n  spark.table("gold_flux").agg(F.sum("operations")).first()[0]'
    },
    {
      id: 'm6', xp: 40, title: 'Le podium du mois',
      brief: 'La direction du réseau veut le podium de <strong>juin 2026</strong> : les 3 agences au <strong>montant net en euros</strong> le plus élevé, avec leur <code>agence</code> (le nom), leurs <code>operations</code> et leur <code>montant_net_eur</code>, du plus élevé au moins élevé. Une seule requête, sans sous-requête de classement : utilise une fonction de fenêtre et <code>QUALIFY</code>.',
      needs: ['gold_flux'],
      starter: 'SELECT a.nom AS agence, g.operations, g.montant_net_eur\nFROM gold_flux g JOIN bronze_agences a USING (agence_id)\nWHERE g.mois = DATE \'2026-06-01\'\n-- QUALIFY row_number() OVER (ORDER BY … DESC) <= 3\nORDER BY g.montant_net_eur DESC;\n',
      hints: ['<code>QUALIFY</code> filtre sur le résultat d\'une fonction de fenêtre, comme <code>HAVING</code> filtre sur un agrégat.', '<code>row_number() OVER (ORDER BY g.montant_net_eur DESC) <= 3</code>.', 'SELECT a.nom AS agence, g.operations, g.montant_net_eur\nFROM gold_flux g JOIN bronze_agences a USING (agence_id)\nWHERE g.mois = DATE \'2026-06-01\'\nQUALIFY row_number() OVER (ORDER BY g.montant_net_eur DESC) <= 3\nORDER BY g.montant_net_eur DESC;'],
      expect: { sql: 'SELECT a.nom, g.operations, g.montant_net_eur FROM ref.gold_flux g JOIN bronze_agences a USING (agence_id) WHERE g.mois = DATE \'2026-06-01\' QUALIFY row_number() OVER (ORDER BY g.montant_net_eur DESC) <= 3 ORDER BY g.montant_net_eur DESC', ordered: true },
      variants: [
        { sql: 'SELECT a.nom, g.operations, g.montant_net_eur FROM ref.gold_flux g JOIN bronze_agences a USING (agence_id) WHERE g.mois = DATE \'2026-06-01\' QUALIFY row_number() OVER (ORDER BY g.operations DESC) <= 3 ORDER BY g.operations DESC', msg: 'Tu as classé sur le <strong>nombre d\'opérations</strong>, pas sur le montant net. La question métier est « qui rapporte le plus », pas « qui travaille le plus ».' }
      ],
      py: 'from pyspark.sql import Window, functions as F\n\nw = Window.orderBy(F.desc("montant_net_eur"))\npodium = (spark.table("gold_flux").filter("mois = \'2026-06-01\'")\n  .join(spark.table("bronze_agences"), "agence_id")\n  .withColumn("rang", F.row_number().over(w))\n  .filter("rang <= 3")\n  .select(F.col("nom").alias("agence"), "operations", "montant_net_eur"))'
    },
    {
      id: 'm7', xp: 60, title: 'Absorber le 1er juillet, sans rien casser en le rejouant',
      brief: 'Chaque jour la banque dépose un fichier : des opérations <strong>nouvelles</strong> (<code>VALIDEE</code>) et des <strong>annulations</strong> d\'opérations déjà reçues (même <code>transaction_id</code>, statut <code>ANNULEE</code>). Applique <code>arrivee_20260701</code> à <code>silver_transactions</code> : une annulation d\'une opération existante, <em>pas encore annulée</em>, passe son statut à <code>ANNULEE</code> ; une opération nouvelle et validée est insérée. Ce moteur n\'a pas <code>MERGE INTO</code> : écris les deux moitiés. <strong>Ton script sera exécuté deux fois à la validation : le second passage ne doit rien changer</strong> (idempotence).',
      starter: '-- 1. Les annulations : mettre à jour les opérations existantes pas encore annulées\nUPDATE silver_transactions\nSET statut = \'ANNULEE\'\nFROM arrivee_20260701 a\nWHERE silver_transactions.transaction_id = a.transaction_id\n  AND a.statut = \'ANNULEE\'\n  AND silver_transactions.statut <> \'ANNULEE\';\n\n-- 2. Les nouvelles opérations : insérer celles qui n\'existent pas encore\nINSERT INTO silver_transactions\nSELECT a.*\nFROM arrivee_20260701 a\nWHERE a.statut = \'VALIDEE\'\n  AND NOT EXISTS (SELECT 1 FROM silver_transactions s WHERE s.transaction_id = a.transaction_id);\n',
      hints: ['Idempotent veut dire : rejouer le script ne change plus rien. La condition <code>statut <> \'ANNULEE\'</code> protège l\'UPDATE, et <code>NOT EXISTS</code> protège l\'INSERT.', 'Si le second passage insère encore des lignes, ta clause <code>NOT EXISTS</code> ne compare pas bien sur <code>transaction_id</code>.', 'UPDATE silver_transactions SET statut = \'ANNULEE\' FROM arrivee_20260701 a\nWHERE silver_transactions.transaction_id = a.transaction_id AND a.statut = \'ANNULEE\' AND silver_transactions.statut <> \'ANNULEE\';\nINSERT INTO silver_transactions SELECT a.* REPLACE (upper(trim(a.devise)) AS devise) FROM arrivee_20260701 a\nWHERE a.statut = \'VALIDEE\' AND NOT EXISTS (SELECT 1 FROM silver_transactions s WHERE s.transaction_id = a.transaction_id);'],
      idempotent: { name: 'silver_transactions', ref: 'ref.silver_j1', reset: 'ref.silver_transactions' },
      after: 'Voilà pourquoi le MERGE de Delta est l\'outil du chargement incrémental : une instruction, atomique, rejouable. Sur Databricks, tout ceci tient en une commande (ci-dessous, après « Équivalent PySpark »). Et si le job échoue à mi-chemin, <em>Repair run</em> relance la tâche : sans idempotence, elle dupliquerait les données.',
      py: '-- Databricks SQL : la même logique, en une instruction atomique\nMERGE INTO silver_transactions AS t\nUSING arrivee_20260701 AS a ON t.transaction_id = a.transaction_id\nWHEN MATCHED AND a.statut = \'ANNULEE\' AND t.statut <> \'ANNULEE\'\n  THEN UPDATE SET t.statut = \'ANNULEE\'\nWHEN NOT MATCHED AND a.statut = \'VALIDEE\'\n  THEN INSERT *;'
    },
    {
      id: 'm8', xp: 60, title: 'Rattraper 3 jours d\'un coup : le piège du lot multi-fichiers',
      brief: 'Après un incident le week-end, trois fichiers attendent : <code>arrivee_20260701</code>, <code>arrivee_20260702</code> et <code>arrivee_20260703</code> (170 lignes au total). Piège classique : l\'opération <code>TX0003231</code> est créée le 1er juillet (<code>VALIDEE</code>) puis annulée le 3 juillet (<code>ANNULEE</code>), et <code>TX0001969</code> est annulée deux fois ! Sur Databricks, un <code>MERGE</code> dont la source contient deux lignes pour le même <code>transaction_id</code> échoue immédiatement. Construis d\'abord une table ou vue dédoublonnée <code>lot_3j</code> (une seule ligne par <code>transaction_id</code>, devise normalisée, où <code>ANNULEE</code> l\'emporte sur <code>VALIDEE</code> grâce à <code>QUALIFY row_number()</code>), puis applique ce lot de façon <strong>idempotente</strong> à <code>silver_transactions</code>.',
      needs: ['silver_transactions'],
      starter: '-- 1. Empiler les 3 arrivées, normaliser la devise et garder 1 ligne par transaction_id (ANNULEE prioritaire)\nCREATE OR REPLACE TEMP VIEW lot_3j AS\nWITH brut AS (\n  SELECT * REPLACE (upper(trim(devise)) AS devise) FROM arrivee_20260701\n  UNION ALL SELECT * REPLACE (upper(trim(devise)) AS devise) FROM arrivee_20260702\n  UNION ALL SELECT * REPLACE (upper(trim(devise)) AS devise) FROM arrivee_20260703\n)\nSELECT * FROM brut\n-- QUALIFY row_number() OVER (PARTITION BY transaction_id ORDER BY …) = 1\n;\n\n-- 2. Mettre à jour les opérations existantes qui passent à ANNULEE\nUPDATE silver_transactions\nSET statut = \'ANNULEE\'\nFROM lot_3j a\nWHERE silver_transactions.transaction_id = a.transaction_id\n  AND a.statut = \'ANNULEE\'\n  AND silver_transactions.statut <> \'ANNULEE\';\n\n-- 3. Insérer toutes les nouvelles opérations de juillet (avec leur statut final)\nINSERT INTO silver_transactions\nSELECT a.* FROM lot_3j a\nWHERE NOT EXISTS (SELECT 1 FROM silver_transactions s WHERE s.transaction_id = a.transaction_id);\n',
      hints: [
        'Pour que <code>ANNULEE</code> passe avant <code>VALIDEE</code> dans la fenêtre : <code>ORDER BY CASE WHEN statut = \'ANNULEE\' THEN 0 ELSE 1 END</code> (ou simplement <code>ORDER BY statut ASC</code> puisque A vient avant V !).',
        'Attention dans l\'<code>INSERT</code> : contrairement à la mission 7, n\'écris pas <code>WHERE a.statut = \'VALIDEE\'</code> car <code>TX0003231</code> est une nouvelle opération de juillet dont l\'état final au 3 juillet est déjà <code>ANNULEE</code> ! La clause <code>NOT EXISTS</code> suffit.',
        'CREATE OR REPLACE TEMP VIEW lot_3j AS\nWITH brut AS (\n  SELECT * REPLACE (upper(trim(devise)) AS devise) FROM arrivee_20260701\n  UNION ALL SELECT * REPLACE (upper(trim(devise)) AS devise) FROM arrivee_20260702\n  UNION ALL SELECT * REPLACE (upper(trim(devise)) AS devise) FROM arrivee_20260703\n)\nSELECT * FROM brut\nQUALIFY row_number() OVER (PARTITION BY transaction_id ORDER BY CASE WHEN statut = \'ANNULEE\' THEN 0 ELSE 1 END) = 1;\n\nUPDATE silver_transactions SET statut = \'ANNULEE\' FROM lot_3j a\nWHERE silver_transactions.transaction_id = a.transaction_id AND a.statut = \'ANNULEE\' AND silver_transactions.statut <> \'ANNULEE\';\n\nINSERT INTO silver_transactions SELECT a.* FROM lot_3j a\nWHERE NOT EXISTS (SELECT 1 FROM silver_transactions s WHERE s.transaction_id = a.transaction_id);'
      ],
      idempotent: { name: 'silver_transactions', ref: 'ref.silver_j3', reset: 'ref.silver_transactions' },
      after: 'Bravo : tu viens de maîtriser le pattern n°1 des pipelines incrémentaux en production. Quand Auto Loader (<code>availableNow</code>) ou un backfill absorbe plusieurs fichiers d\'un coup, on dédoublonne toujours le micro-lot par clé primaire en gardant l\'état le plus récent avant d\'exécuter le <code>MERGE INTO</code>.',
      py: '-- Databricks SQL : dédoublonner la source dans le USING avant le MERGE\nWITH lot_3j AS (\n  SELECT * EXCEPT (devise), upper(trim(devise)) AS devise\n  FROM read_files(\'/Volumes/banque/lanterne/arrivees/*.csv\', format => \'csv\', header => true)\n  QUALIFY row_number() OVER (\n    PARTITION BY transaction_id\n    ORDER BY CASE WHEN statut = \'ANNULEE\' THEN 0 ELSE 1 END\n  ) = 1\n)\nMERGE INTO silver_transactions AS t\nUSING lot_3j AS a ON t.transaction_id = a.transaction_id\nWHEN MATCHED AND a.statut = \'ANNULEE\' AND t.statut <> \'ANNULEE\'\n  THEN UPDATE SET t.statut = \'ANNULEE\'\nWHEN NOT MATCHED\n  THEN INSERT *;'
    },
    {
      id: 'm9', xp: 50, title: 'L\'alerte SQL : traquer les comptes orphelins',
      brief: 'À la mission 5, tu as découvert que des opérations de <code>silver_transactions</code> disparaissaient de la couche Gold parce que leur compte pointait vers un <code>client_id</code> absent de <code>silver_clients</code>. Dans Databricks SQL (Module 8), on ne laisse jamais une telle anomalie silencieuse : on crée une <strong>Alerte SQL</strong> qui surveille les comptes orphelins. Écris la requête support de cette alerte : pour chaque compte de <code>bronze_comptes</code> dont le <code>client_id</code> n\'existe pas dans <code>silver_clients</code>, renvoie <code>compte_id</code>, <code>client_id</code>, <code>operations</code> (nombre de lignes dans <code>silver_transactions</code>) et <code>volume_eur</code> (somme des valeurs absolues <code>round(sum(abs(montant)), 2)</code>), triés par <code>operations DESC</code>.',
      needs: ['silver_clients', 'silver_transactions'],
      starter: '-- Requête support de l\'alerte Databricks SQL : comptes sans client dans silver_clients\nSELECT\n  co.compte_id,\n  co.client_id,\n  count(*) AS operations,\n  round(sum(abs(t.montant)), 2) AS volume_eur\nFROM silver_transactions t\nJOIN bronze_comptes co USING (compte_id)\n-- Écarte les comptes qui ont un client dans silver_clients (ANTI JOIN)\nGROUP BY ALL\nORDER BY operations DESC;\n',
      hints: [
        'Utilise <code>ANTI JOIN silver_clients cl ON cl.client_id = co.client_id</code> (ou <code>LEFT JOIN</code> + <code>WHERE cl.client_id IS NULL</code>) pour ne garder que les comptes sans client.',
        'N\'oublie pas <code>abs(t.montant)</code> dans la somme pour mesurer le volume financier total en jeu (débits et crédits cumulés).',
        'SELECT co.compte_id, co.client_id, count(*) AS operations, round(sum(abs(t.montant)), 2) AS volume_eur\nFROM silver_transactions t\nJOIN bronze_comptes co USING (compte_id)\nANTI JOIN silver_clients cl ON cl.client_id = co.client_id\nGROUP BY co.compte_id, co.client_id\nORDER BY operations DESC;'
      ],
      expect: {
        sql: 'SELECT co.compte_id, co.client_id, count(*) AS operations, round(sum(abs(t.montant)), 2) AS volume_eur FROM ref.silver_transactions t JOIN bronze_comptes co USING (compte_id) ANTI JOIN ref.silver_clients cl ON cl.client_id = co.client_id GROUP BY co.compte_id, co.client_id ORDER BY operations DESC, co.compte_id',
        ordered: true
      },
      variants: [
        {
          sql: 'SELECT co.compte_id, co.client_id, count(*) AS operations, round(sum(t.montant), 2) AS volume_eur FROM ref.silver_transactions t JOIN bronze_comptes co USING (compte_id) ANTI JOIN ref.silver_clients cl ON cl.client_id = co.client_id GROUP BY co.compte_id, co.client_id ORDER BY operations DESC, co.compte_id',
          msg: 'Tu as sommé <code>montant</code> avec son signe (les débits compensent les crédits). Utilise <code>sum(abs(t.montant))</code> pour mesurer le volume total d\'activité non rattaché.'
        }
      ],
      followup: {
        q: 'Sur quel type de calcul planifier cette Alerte Databricks SQL toutes les heures au moindre coût ?',
        options: [
          'Sur un cluster All-purpose laissé allumé 24h/24',
          'Sur un SQL Warehouse Serverless (ou à auto-stop court de 1 à 5 minutes)',
          'Sur le poste local du développeur avec cron',
          'Sur un cluster ML avec GPU'
        ],
        answer: 1, xp: 10,
        explain: 'Les Alertes Databricks SQL s\'exécutent sur un SQL Warehouse. Avec un SQL Warehouse Serverless, le démarrage est quasi instantané, la requête d\'alerte tourne en 2 secondes et la facturation s\'arrête aussitôt.'
      },
      after: 'Le tour de la Banque Lanterne est complet : tu as audité le brut, nettoyé et réconcilié la Silver, construit la Gold en euros, absorbé des lots incrémentaux idempotents et posé la sonde d\'alerte SQL.',
      py: '# En PySpark : isoler les comptes orphelins pour une table de quarantaine\nfrom pyspark.sql import functions as F\n\norphelins = (spark.table("silver_transactions").alias("t")\n  .join(spark.table("bronze_comptes").alias("co"), "compte_id")\n  .join(spark.table("silver_clients").alias("cl"), "client_id", "left_anti")\n  .groupBy("compte_id", "client_id")\n  .agg(F.count("*").alias("operations"),\n       F.round(F.sum(F.abs("montant")), 2).alias("volume_eur"))\n  .orderBy(F.desc("operations")))\ndisplay(orphelins)'
    }
  ]
};
