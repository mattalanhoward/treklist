const TRANSLATIONS = {
  en: {
    lang: "en",
    title: "Your TrekList gear list is ready",
    subject: "Your TrekList is ready: add your first item",
    tagline: "Get the pack right",
    greeting: (name) => `Hey ${name},`,
    ready: "Your list is ready whenever you are.",
    gearSection: "Building your My Gear section is quick: type a gear name, paste a link from any outdoor retailer, or take a photo of the packaging. TrekList fills in the details for you.",
    visualize: "From there you can build out your list and see everything you're taking in one place, so you can decide what you really need and what's just weighing you down.",
    checkOff: "Once your list is complete, you can check items off as you pack and head out the door knowing you haven't forgotten a thing.",
    cta: "Open my list",
    questions: "If you have any questions, just reply to this email. I'm more than happy to help!",
    signoff: "Happy trails,",
    madeBy: "TrekList is made by Tall Joe Hikes",
    buildList: "Build a list",
    gearReviews: "Gear reviews",
    hikeGuides: "Hike guides",
    footerSignup: "You're getting this because you signed up at treklist.co",
    unsubscribe: "Unsubscribe",
  },
  fr: {
    lang: "fr",
    title: "Votre liste TrekList est prête",
    subject: "Votre TrekList est prête : ajoutez votre premier article",
    tagline: "Préparez bien votre sac",
    greeting: (name) => `Salut ${name},`,
    ready: "Votre liste est prête quand vous l'êtes.",
    gearSection: "Construire votre section Mon Équipement est simple : tapez un nom d'article, collez un lien d'un revendeur outdoor, ou prenez une photo de l'emballage. TrekList remplit les détails pour vous.",
    visualize: "À partir de là, vous pouvez construire votre liste et voir tout ce que vous emportez au même endroit, pour décider ce dont vous avez vraiment besoin et ce qui vous alourdit inutilement.",
    checkOff: "Une fois votre liste complète, cochez les articles au fur et à mesure que vous faites votre sac et partez en sachant que vous n'avez rien oublié.",
    cta: "Ouvrir ma liste",
    questions: "Si vous avez des questions, répondez simplement à cet e-mail. Je serai ravi de vous aider !",
    signoff: "Bonne randonnée,",
    madeBy: "TrekList est créé par Tall Joe Hikes",
    buildList: "Créer une liste",
    gearReviews: "Avis équipement",
    hikeGuides: "Guides de randonnée",
    footerSignup: "Vous recevez ceci car vous vous êtes inscrit sur treklist.co",
    unsubscribe: "Se désabonner",
  },
  de: {
    lang: "de",
    title: "Deine TrekList-Ausrüstungsliste ist fertig",
    subject: "Deine TrekList ist fertig: füge dein erstes Ausrüstungsstück hinzu",
    tagline: "Den Rucksack richtig packen",
    greeting: (name) => `Hey ${name},`,
    ready: "Deine Liste ist bereit, wann immer du es bist.",
    gearSection: "Deine Ausrüstung zu erfassen ist einfach: Tippe einen Namen ein, füge einen Link von einem Outdoor-Händler ein oder fotografiere die Verpackung. TrekList füllt die Details automatisch für dich aus.",
    visualize: "Von dort aus baust du deine Liste auf und siehst alles, was du mitnimmst, auf einen Blick, so entscheidest du, was du wirklich brauchst und was dich nur unnötig beschwert.",
    checkOff: "Wenn deine Liste vollständig ist, kannst du Artikel abhaken, während du packst, und losgehst, ohne etwas vergessen zu haben.",
    cta: "Meine Liste öffnen",
    questions: "Wenn du Fragen hast, antworte einfach auf diese E-Mail. Ich helfe dir gerne!",
    signoff: "Viel Spaß auf dem Weg,",
    madeBy: "TrekList wird von Tall Joe Hikes gemacht",
    buildList: "Liste erstellen",
    gearReviews: "Ausrüstungs-Reviews",
    hikeGuides: "Wanderführer",
    footerSignup: "Du erhältst diese E-Mail, weil du dich bei treklist.co angemeldet hast",
    unsubscribe: "Abmelden",
  },
  es: {
    lang: "es",
    title: "Tu lista de equipamiento TrekList está lista",
    subject: "Tu TrekList está lista: añade tu primer artículo",
    tagline: "Prepara bien tu mochila",
    greeting: (name) => `Hola ${name},`,
    ready: "Tu lista está lista cuando tú lo estés.",
    gearSection: "Crear tu sección Mi Equipamiento es rápido: escribe el nombre de un artículo, pega un enlace de cualquier tienda outdoor, o toma una foto del embalaje. TrekList rellena los detalles por ti.",
    visualize: "A partir de ahí puedes construir tu lista y ver todo lo que llevas en un solo lugar, para decidir qué necesitas realmente y qué solo te está pesando de más.",
    checkOff: "Una vez completada tu lista, puedes marcar los artículos mientras haces la mochila y partir sabiendo que no has olvidado nada.",
    cta: "Abrir mi lista",
    questions: "Si tienes alguna pregunta, responde a este correo. ¡Estaré encantado de ayudarte!",
    signoff: "¡Buen camino,",
    madeBy: "TrekList es creado por Tall Joe Hikes",
    buildList: "Crear una lista",
    gearReviews: "Reseñas de equipo",
    hikeGuides: "Guías de senderismo",
    footerSignup: "Recibes esto porque te registraste en treklist.co",
    unsubscribe: "Darse de baja",
  },
  it: {
    lang: "it",
    title: "La tua lista attrezzatura TrekList è pronta",
    subject: "Il tuo TrekList è pronto: aggiungi il tuo primo articolo",
    tagline: "Prepara bene lo zaino",
    greeting: (name) => `Ciao ${name},`,
    ready: "La tua lista è pronta quando lo sei tu.",
    gearSection: "Aggiungere attrezzatura è semplice: digita un nome, incolla un link da qualsiasi rivenditore outdoor, o scatta una foto della confezione. TrekList compila i dettagli per te.",
    visualize: "Da lì puoi costruire la tua lista e vedere tutto ciò che porti in un unico posto, così decidi cosa ti serve davvero e cosa ti appesantisce inutilmente.",
    checkOff: "Una volta completata la lista, puoi spuntare gli articoli mentre fai lo zaino e partire sapendo di non aver dimenticato nulla.",
    cta: "Apri la mia lista",
    questions: "Se hai domande, rispondi semplicemente a questa email. Sono felice di aiutarti!",
    signoff: "Buon cammino,",
    madeBy: "TrekList è realizzato da Tall Joe Hikes",
    buildList: "Crea una lista",
    gearReviews: "Recensioni attrezzatura",
    hikeGuides: "Guide escursionistiche",
    footerSignup: "Stai ricevendo questo perché ti sei registrato su treklist.co",
    unsubscribe: "Annulla iscrizione",
  },
  nl: {
    lang: "nl",
    title: "Je TrekList uitrustingslijst is klaar",
    subject: "Je TrekList is klaar: voeg je eerste item toe",
    tagline: "Pak je rugzak goed in",
    greeting: (name) => `Hey ${name},`,
    ready: "Je lijst is klaar wanneer jij dat bent.",
    gearSection: "Je uitrusting toevoegen gaat snel: typ een naam, plak een link van een outdoor retailer, of maak een foto van de verpakking. TrekList vult de details automatisch voor je in.",
    visualize: "Vanaf daar bouw je je lijst op en zie je alles wat je meeneemt op één plek, zo bepaal je wat je echt nodig hebt en wat alleen maar extra gewicht is.",
    checkOff: "Zodra je lijst compleet is, kun je items afvinken terwijl je inpakt en vertrekken wetende dat je niets vergeten bent.",
    cta: "Mijn lijst openen",
    questions: "Als je vragen hebt, antwoord dan gewoon op deze e-mail. Ik help je graag!",
    signoff: "Veel wandelplezier,",
    madeBy: "TrekList is gemaakt door Tall Joe Hikes",
    buildList: "Maak een lijst",
    gearReviews: "Uitrusting reviews",
    hikeGuides: "Wandelgidsen",
    footerSignup: "Je ontvangt dit omdat je je hebt aangemeld bij treklist.co",
    unsubscribe: "Uitschrijven",
  },
};

function buildWelcomeEmail({ trailname, listUrl, unsubscribeUrl, language = "en" }) {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const name = trailname || "there";

  const html = `<!DOCTYPE html>
<html lang="${t.lang}" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${t.title}</title>
  <style>
    body, table, td { font-family: Arial, Helvetica, sans-serif; }
    body { margin: 0; padding: 0; background-color: #e8edf2; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    img { border: 0; line-height: 100%; outline: none; text-decoration: none; }
    a { color: #1d4ed8; }

    .content-area p { margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #334155; }
    .content-area h1 { margin: 0 0 16px; font-size: 24px; line-height: 1.3; color: #0f172a; }
    .content-area h2 { margin: 24px 0 12px; font-size: 20px; line-height: 1.3; color: #0f172a; }
    .content-area h3 { margin: 20px 0 10px; font-size: 17px; line-height: 1.3; color: #0f172a; }
    .content-area ul, .content-area ol { margin: 0 0 16px; padding-left: 24px; font-size: 16px; line-height: 1.6; color: #334155; }
    .content-area li { margin-bottom: 6px; }
    .content-area a { color: #1d4ed8; text-decoration: underline; }
    .content-area img { max-width: 100%; height: auto; border-radius: 6px; }
    .content-area hr { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
    .content-area blockquote { margin: 0 0 16px; padding: 12px 20px; border-left: 3px solid #1d4ed8; background-color: #f8fafc; color: #334155; font-size: 16px; line-height: 1.6; }

    .btn a { background-color: #1d4ed8; color: #ffffff !important; text-decoration: none !important; font-size: 16px; font-weight: bold; padding: 12px 28px; border-radius: 6px; display: inline-block; }

    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; }
      .px { padding-left: 20px !important; padding-right: 20px !important; }
      .footer-links td { display: block !important; padding: 4px 0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#e8edf2;">

  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">&nbsp;</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#e8edf2;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">

          <!-- Accent bar -->
          <tr>
            <td style="height:3px;line-height:3px;font-size:0;background-color:#1d4ed8;border-radius:8px 8px 0 0;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td class="px" style="background-color:#ffffff;padding:22px 32px;border-bottom:1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;color:#0f172a;letter-spacing:-0.3px;">TrekList</td>
                  <td align="right" valign="bottom" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#94a3b8;letter-spacing:1.5px;text-transform:uppercase;">${t.tagline}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body content -->
          <tr>
            <td class="px content-area" style="background-color:#ffffff;padding:32px;">
              <p>${t.greeting(name)}</p>
              <p>${t.ready}</p>
              <img src="https://res.cloudinary.com/treklist/image/upload/w_1080,f_png/v1779787880/Screenshot-treklist-desktop-view_x256gu.png" alt="TrekList gear list" width="536" style="max-width:100%;height:auto;display:block;margin:0 auto 24px;border-radius:6px;border:1px solid #e2e8f0;">
              <p>${t.gearSection}</p>
              <p>${t.visualize}</p>
              <p>${t.checkOff}</p>
              <table role="presentation" class="btn" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:32px auto;">
                <tr>
                  <td align="center" style="border-radius:6px;background-color:#1d4ed8;">
                    <a href="${listUrl}" style="background-color:#1d4ed8;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;padding:12px 28px;border-radius:6px;display:inline-block;">${t.cta}</a>
                  </td>
                </tr>
              </table>
              <p>${t.questions}</p>
              <p>${t.signoff}<br>Tall Joe · TrekList</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="px" style="background-color:#f8fafc;padding:28px 32px;border-top:1px solid #e2e8f0;border-radius:0 0 8px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#0f172a;padding-bottom:4px;">TrekList</td>
                </tr>
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#94a3b8;padding-bottom:16px;">${t.madeBy}</td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:20px;">
                    <table role="presentation" class="footer-links" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;padding:0 10px;"><a href="https://treklist.co" style="color:#1d4ed8;text-decoration:none;">${t.buildList}</a></td>
                        <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;padding:0 10px;"><a href="https://talljoehikes.com/gear/" style="color:#1d4ed8;text-decoration:none;">${t.gearReviews}</a></td>
                        <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;padding:0 10px;"><a href="https://talljoehikes.com/hikes/" style="color:#1d4ed8;text-decoration:none;">${t.hikeGuides}</a></td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#94a3b8;line-height:1.6;padding-bottom:12px;">
                    ${t.footerSignup}<br>
                    <a href="${unsubscribeUrl}" style="color:#94a3b8;text-decoration:underline;">${t.unsubscribe}</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#94a3b8;">&copy; 2026 TrekList · Tall Joe Hikes · Netherlands</td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;

  const text = `${t.greeting(name)}

${t.ready}

${listUrl}

${t.gearSection}

${t.visualize}

${t.checkOff}

${t.signoff}
Tall Joe · TrekList

---
${t.footerSignup}
${t.unsubscribe}: ${unsubscribeUrl}`;

  return { html, text, subject: t.subject };
}

module.exports = { buildWelcomeEmail };
