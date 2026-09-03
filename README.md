# Timeline

BETA d'une frise chronologique interactive, pensée pour la planification visuelle plutot que pour un diagramme de Gantt.

## Fonctionnalites de la BETA

- Plusieurs timelines avec persistance locale dans le navigateur.
- Axe temporel horizontal, zoom ($1$ a $34$ pixels par jour), graduations adaptees et retour a aujourd'hui.
- Periodes deplacables et redimensionnables a la souris.
- Jalons ancres strictement a leur date, avec repartition verticale automatique en cas de chevauchement.
- Annotations, choix de six couleurs et edition/suppression par clic.
- Ajout rapide par clic droit, y compris les series de periodes et de jalons.
- Donnees de demonstration incluses au premier lancement.
- Schema Supabase avec RLS, recurrence et champs de partage public, pret a etre applique.

## Architecture

- `src/engine/`: logique pure de dates, echelle, graduations, recurrences et placement des jalons.
- `src/app.js`: orchestration de l'interface et interactions DOM.
- `src/storage.js`: persistance locale de la BETA. Elle constitue un cache de travail simple avant le branchement du client Supabase authentifie.
- `supabase/schema.sql`: schema relationnel securise a executer une fois dans une base vide.

## Lancer localement

L'application est volontairement sans etape de build, ce qui la rend compatible avec GitHub Pages. Servez toutefois les ES modules par HTTP, au lieu d'ouvrir `index.html` directement.

```powershell
py -m http.server 4173
```

Ouvrez ensuite `http://localhost:4173`.

## Supabase

1. Creez un projet Supabase puis executez [le schema](supabase/schema.sql) dans le SQL Editor.
2. Activez un fournisseur d'authentification dans Supabase. Les politiques SQL limitent l'ecriture au proprietaire connecte.
3. Copiez `src/config.example.js` vers `src/config.js` et renseignez l'URL du projet et sa cle `anon` publique uniquement.

`src/config.js` est ignore par Git. Ne mettez jamais de `service_role` ni une cle secrete dans ce projet frontend.

La persistance locale est active par defaut afin que la BETA fonctionne sans configuration. Le modele SQL et les identifiants UUID des elements permettent d'ajouter ensuite une synchronisation Supabase sans modifier le moteur de rendu.

## Deployer sur GitHub Pages

1. Poussez ce depot sur GitHub.
2. Dans **Settings > Pages**, choisissez **Deploy from a branch**.
3. Selectionnez la branche `main` et le dossier `/(root)`.
4. Validez: GitHub Pages servira directement `index.html`.

Pour un partage en lecture seule dans cette BETA, activez **Partager** puis utilisez le lien genere avec le parametre `?view=<public_token>`. Le mode n'affiche aucune commande d'edition. Une route propre `/view/:public_token` pourra etre introduite avec un routeur SPA et une regle de reecriture Pages lorsque le partage public passera en phase active.