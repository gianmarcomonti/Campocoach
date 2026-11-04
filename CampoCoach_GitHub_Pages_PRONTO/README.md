# CampoCoach 4.5 — App per GitHub Pages

Gestione squadra di calcio: rosa con ruoli principali e secondari, presenze certificate agli allenamenti, generazione squadre con moduli, partite e formazioni, panchina, gol/assist/autogol/porta inviolata e statistiche ordinabili.

**Questa e una web app installabile (PWA).** Non servono server, database, Node.js o programmi da compilare. Tutti i file dell'app sono nella cartella principale del repository.

## Pubblicazione su GitHub (senza usare programmi)

1. Scarica e **estrai** lo ZIP che contiene questi file. Non caricare soltanto lo ZIP su GitHub.
2. Su [github.com/new](https://github.com/new), crea un repository, ad esempio `CampoCoach` (per GitHub Free scegli **Public**).
3. Apri il repository e seleziona **Add file > Upload files**.
4. Trascina **i file estratti**, fra cui `index.html`, `app.js`, `tactics.js`, `styles.css`, `manifest.webmanifest`, `sw.js`, le due icone, `README.md` e `.nojekyll`. Devono essere nella **radice del repository**, non dentro una sottocartella.
5. Premi **Commit changes**.
6. Apri **Settings > Pages**, scegli **Deploy from a branch** come Source, poi seleziona `main`, cartella `/(root)`, e premi **Save**.
7. Quando GitHub Pages completa la pubblicazione, apri **Visit site** nella stessa pagina. Se il repository si chiama `CampoCoach`, l'indirizzo in genere e `https://TUO-USERNAME.github.io/CampoCoach/`.

Per le istruzioni ufficiali: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Installazione sul cellulare

- **Android / Chrome:** apri il link pubblicato, menu del browser e scegli `Installa app` o `Aggiungi a schermata Home`.
- **iPhone / Safari:** apri il link pubblicato, tocca `Condividi` > `Aggiungi alla schermata Home`.
- La prima apertura richiede internet. Dopo il caricamento la web app puo funzionare anche offline grazie al service worker, nei limiti della cache del dispositivo.

## Dove sono salvati i dati?

**Sul dispositivo e nel browser che stai utilizzando**, tramite archiviazione locale (localStorage). Non esiste ancora un database cloud. I giocatori che inserisci da un telefono non appaiono automaticamente su un altro telefono.

- Esporta regolarmente un **backup JSON** dalla sezione Rosa.
- Importa il backup su un nuovo dispositivo o browser per trasferire i dati.
- Se cambi l'indirizzo web dell'app (nome del repository, dominio o account GitHub), il browser potrebbe non trovare i dati locali precedenti: esporta prima un backup.
- Anche se il codice del repository e pubblico, le informazioni inserite nell'app **non vengono caricate automaticamente su GitHub**.

## Aggiornamenti futuri

Per sostituire i file con una nuova versione: carica i nuovi file nel medesimo repository (mantenendo il nome del repository e quindi l'URL). Prima di aggiornare, esporta un backup.

## Struttura

```
index.html
app.js
tactics.js
styles.css
manifest.webmanifest
sw.js
icon-192.png
icon-512.png
.nojekyll
README.md
```

## Nota

Non e un'app nativa pubblicata su App Store o Google Play, ma un sito installabile sul telefono tramite GitHub Pages. L'app non richiede account e non sincronizza dati tra dispositivi.
