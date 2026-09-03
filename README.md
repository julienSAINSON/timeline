# Timeline

BETA d'une frise chronologique interactive, pensée pour la planification visuelle plutot que pour un diagramme de Gantt.

## Fonctionnalites de la BETA

- Mire d'acces avec Google via Supabase Auth ou mode bac a sable local.
- Plusieurs timelines, sauvegardees dans Supabase apres connexion ou dans le navigateur en bac a sable.
- Axe temporel horizontal, zoom ($1$ a $34$ pixels par jour), graduations adaptees et retour a aujourd'hui.
- Periodes deplacables et redimensionnables a la souris.
- Jalons ancres strictement a leur date, avec repartition verticale automatique en cas de chevauchement.
- Annotations, choix de six couleurs et edition/suppression par clic.
- Ajout rapide par clic droit, y compris les series de periodes et de jalons.
- Donnees de demonstration incluses au premier lancement.
- Schema Supabase avec RLS, recurrence et champs de partage public, pret a etre applique.

## Architecture

- `src/engine/`: logique pure de dates, echelle, graduations, recurrences et placement des jalons.
- `supabase/auth/`: modules Google OAuth existants, reutilises par Timeline.
- `src/app.js`: mire d'acces, orchestration de l'interface et interactions DOM.
- `src/repositories.js`: depots local et Supabase, utilises par le meme editeur.
- `src/storage.js`: secours local lorsqu'aucune configuration Supabase n'est disponible.
- `supabase/schema.sql`: schema relationnel `tl_*` securise a executer une fois dans une base vide.

## Lancer localement

L'application est volontairement sans etape de build, ce qui la rend compatible avec GitHub Pages. Servez toutefois les ES modules par HTTP, au lieu d'ouvrir `index.html` directement.

```powershell
py -m http.server 4173
```

Ouvrez ensuite `http://localhost:4173`.

## Supabase

1. Dans le projet Supabase existant de Timekeeper, executez [le schema](supabase/schema.sql) dans le SQL Editor. Il cree uniquement les tables Timeline `tl_*`.
2. Dans **Authentication > Providers > Google**, activez Google et renseignez le Client ID et le Client Secret de votre projet OAuth Google.
3. Dans **Authentication > URL Configuration**, ajoutez `http://127.0.0.1:5500/` et l'URL GitHub Pages de production aux **Redirect URLs**.
4. Renseignez [src/config.js](src/config.js) avec l'URL du projet et sa cle `anon` publique. `supabaseRedirectTo` est calculee a partir de l'URL courante, sans adresse de production codee en dur.

`src/config.js` est publie avec l'application car la cle `anon` est une cle publique. Ne mettez jamais de `service_role` ni une cle secrete dans ce projet frontend.

Sans session Google, l'utilisateur choisit explicitement le bac a sable. Avec Supabase configure, les frises bac a sable sont stockees dans la base sans `user_id`, partagees et modifiables par tous les visiteurs. Elles ne sont jamais rattachees a un compte. Apres connexion Google, les donnees privees du compte sont chargees et sauvegardees exclusivement dans Supabase. Le transfert d'une frise bac a sable vers un compte n'est pas encore implemente.

## Deployer sur GitHub Pages

1. Poussez ce depot sur GitHub.
2. Dans **Settings > Pages**, choisissez **Deploy from a branch**.
3. Selectionnez la branche `main` et le dossier `/(root)`.
4. Validez: GitHub Pages servira directement `index.html`.
5. Ajoutez l'URL Pages finale a la configuration OAuth Google et remplacez `supabaseRedirectTo` dans la configuration publiee par cette URL.

Pour un partage en lecture seule dans cette BETA, activez **Partager** puis utilisez le lien genere avec le parametre `?view=<public_token>`. Le mode n'affiche aucune commande d'edition. Une route propre `/view/:public_token` pourra etre introduite avec un routeur SPA et une regle de reecriture Pages lorsque le partage public passera en phase active.