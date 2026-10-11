Opstelling: webapp voor opstellingen, wissels en speelminuten van ons team.

Stack: Vite, React, TypeScript, Supabase (login en database), GitHub Pages.
Alles in de interface is Nederlands. Mobile first.

Wat de app doet (fase 1)
- Spelersbeheer: posities met niveau 1 tot 5, voorkeurspositie, voorkeursvoet, notities, actief ja/nee
- Seizoenen en wedstrijden, aanwezigheid (aanwezig, afwezig, geblesseerd)
- Opstelling maken op het veld (4-3-3, 4-4-2, 3-5-2, uit te breiden)
- Wissels achteraf invoeren met minuut, met controle op onmogelijke wissels
- Seizoensoverzicht: aanwezigheid, speel- en bankminuten per speler (alleen definitieve wedstrijden)

Fase 2 (nog niet gebouwd): opstellingsgenerator met een schuif tussen sterkste opstelling en eerlijke speeltijd.

Lokaal draaien
1. Installeer Node.js (brew install node)
2. cp .env.example .env en vul de publieke Supabase URL en publishable (anon) key in
3. npm install
4. npm run dev

Supabase instellen
1. Voer de bestanden in supabase/migrations uit in de SQL Editor, in volgorde 0001, 0002, 0003
2. Captain toevoegen: voeg zijn e-mailadres toe in de tabel captains (kleine letters)
   en maak onder Authentication, Users een gebruiker aan met Auto Confirm User aan
3. Authentication, URL Configuration: Site URL is het GitHub Pages-adres, en zet daar
   en http://localhost:5173/** bij de redirect URLs
4. Zelfregistratie staat uit: alleen aangemaakte gebruikers kunnen inloggen

Inloggen gaat met een link per e-mail. Een code in de mail kan alleen met een eigen SMTP-server.

Deployment
Elke push naar main bouwt en publiceert via GitHub Actions (zie .github/workflows/deploy.yml).
Het project gebruikt de repository-variabelen VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY.

Veiligheid
- Alleen de publieke URL en key staan in de frontend. De toegang wordt afgedwongen met Row Level Security.
- Gebruik nooit de service role of secret key in dit project en commit nooit een .env-bestand.
