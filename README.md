# CampoCoach 4.7 — App per GitHub Pages

Gestione squadra di calcio: rosa con ruoli principali e secondari, presenze certificate agli allenamenti, generazione squadre con moduli, partite e formazioni, panchina, gol/assist/autogol/porta inviolata e statistiche ordinabili.

**Questa e una web app installabile (PWA).** Non servono server, database, Node.js o programmi da compilare. Tutti i file dell'app sono nella cartella principale del repository.

## Pubblicazione su GitHub (senza usare programmi)

1. Scarica e **estrai** lo ZIP che contiene questi file. Non caricare soltanto lo ZIP su GitHub.
2. Se hai già pubblicato la precedente versione, **riutilizza il repository esistente `Campocoach`**: non crearne uno nuovo. In caso contrario, crea un repository pubblico su GitHub.
3. Apri il repository e seleziona **Add file > Upload files**.
4. Trascina **i file estratti**, fra cui `index.html`, `app.js`, `tactics.js`, `styles.css`, `manifest.webmanifest`, `sw.js`, le due icone, `README.md` e `.nojekyll`. Devono essere nella **radice del repository**, non dentro una sottocartella.
5. Premi **Commit changes**.
6. Apri **Settings > Pages**, scegli **Deploy from a branch** come Source, poi seleziona `main`, cartella `/(root)`, e premi **Save**.
7. Quando GitHub Pages completa la pubblicazione, apri **Visit site**. Il link già configurato è `https://gianmarcomonti.github.io/Campocoach/` e rimane invariato con questo aggiornamento.

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


## Novità 4.7 — Sponde, Jolly Dondo e statistiche singole

- Portiere titolare: una porta inviolata viene conteggiata automaticamente quando i **gol subiti sono 0**. Un risultato non inserito non conta. I precedenti eventi manuali senza risultato sono conservati per compatibilità, senza contare due volte.
- Nella tabella **Statistiche**, tocca il nome di un giocatore per visualizzare la sua scheda con gol, assist, autogol e porte inviolate, divisi per partita e avversario.
- Nei **possessi palla** scegli il numero di **sponde**. Le sponde e i rispettivi nomi appaiono separati dalle squadre generate; la configurazione viene salvata nello storico.
- Nella **Rosa**, il flag **Questo giocatore è il Jolly Dondo** consente di creare un giocatore speciale con ruolo principale/secondario, numero e stelle. In **Allenamenti → Crea squadre** puoi attivare **Jolly Dondo** e usarlo come jolly/sponda oppure come giocatore aggiuntivo per pareggiare le squadre. Dondo non risulta nelle presenze certificate, nelle partite o nelle statistiche ufficiali.
- Carica tutti i file del pacchetto nella radice del repository GitHub (`main / (root)`), non lo ZIP. Se usi il medesimo URL GitHub Pages, i dati locali restano disponibili. Esporta sempre un backup prima di aggiornare.


## Novità CampoCoach 4.7 — Convocazioni e Prima squadra

- Nella **Rosa** puoi indicare un giocatore come **Prima squadra**. È una semplice etichetta: non cambia presenze certificate, statistiche, stelle o punteggio di forma.
- Nella **Partita** seleziona i **convocati**, eventualmente usando i pulsanti “Convoca tutti” e “Solo Prima squadra”, poi premi **Conferma convocati**.
- **Genera la migliore formazione** utilizza soltanto i convocati confermati. La compatibilità con il ruolo viene prima, poi valore in stelle, presenze settimanali e rendimento recente.
- I convocati non scelti titolari passano automaticamente in **panchina**. I non convocati restano fuori.
- Le partite delle vecchie versioni conservano titolari e panchinari esistenti come convocati iniziali.
- Se cambi i convocati, devi confermarli nuovamente prima di rigenerare. La modifica viene salvata soltanto con **Salva modifiche**.
