# Lakehouse Dojo

Une app pour apprendre Databricks en le manipulant : onze modules, onze simulateurs interactifs, des quiz, des flashcards en répétition espacée et des labs à réaliser dans Databricks Free Edition.

Projet indépendant, non affilié à Databricks. Le contenu n'a pas été relu par Databricks ; les tarifs du simulateur de coût sont des ordres de grandeur.

## Lancer en local

Aucune installation, aucune dépendance. Deux possibilités :

- ouvrir `index.html` dans un navigateur ;
- ou servir le dossier, par exemple `python -m http.server 8765`, puis ouvrir `http://localhost:8765`.

La progression est enregistrée dans le navigateur (`localStorage`). Elle est propre à chaque adresse et à chaque appareil.

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | Structure de la page et styles (thème clair et sombre) |
| `data.js` | Tout le contenu : modules, quiz, flashcards, labs, glossaire |
| `sims.js` | Les onze simulateurs |
| `app.js` | Navigation, progression (XP, ceintures, sceaux), quiz, flashcards, classement |

## Modifier le contenu

Tout le contenu est dans `data.js`. Chaque module est un objet avec `points`, `code`, `traps`, `ask`, `lab`, `quiz` et `cards`.

Règle d'écriture : les textes sont des template literals, donc pas de backtick ni de `${` à l'intérieur.

Un simulateur est un objet `{ id, mod, title, tag, mission, mount(root, win) }` dans `sims.js`. `mod` le rattache à un module ; `win()` signale que la mission est réussie.

## Classement d'équipe

Le classement ne fonctionne que lorsque la page est publiée comme artifact claude.ai (il s'appuie sur `window.claude`). Partout ailleurs il est simplement masqué, et le reste de l'app fonctionne à l'identique.

## Publier pour tout le monde

L'app est faite de quatre fichiers statiques : n'importe quel hébergement statique convient. Avec GitHub Pages : pousser le dépôt, puis Settings → Pages → Deploy from a branch → `main`, dossier racine.
