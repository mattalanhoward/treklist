const TRANSLATIONS = {
  en: {
    lang: "en",
    title: "Your TrekList gear list is ready",
    subject: "Your TrekList is ready — add your first item",
    tagline: "Free gear list planner for hikers",
    greeting: (name) => `Hey ${name},`,
    ready: "Your list is ready whenever you are.",
    gearSection: "Building your My Gear section is quick: type a gear name, paste a link from any outdoor retailer, or take a photo of the packaging. TrekList fills in the details for you.",
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
    subject: "Votre TrekList est prête — ajoutez votre premier article",
    tagline: "Planificateur gratuit de liste d'équipement pour randonneurs",
    greeting: (name) => `Salut ${name},`,
    ready: "Votre liste est prête quand vous l'êtes.",
    gearSection: "Construire votre section Mon Équipement est simple : tapez un nom d'article, collez un lien d'un revendeur outdoor, ou prenez une photo de l'emballage. TrekList remplit les détails pour vous.",
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
    subject: "Deine TrekList ist fertig — füge dein erstes Ausrüstungsstück hinzu",
    tagline: "Kostenloser Ausrüstungslisten-Planer für Wanderer",
    greeting: (name) => `Hey ${name},`,
    ready: "Deine Liste ist bereit, wann immer du es bist.",
    gearSection: "Deine Ausrüstung zu erfassen ist einfach: Tippe einen Namen ein, füge einen Link von einem Outdoor-Händler ein oder fotografiere die Verpackung. TrekList füllt die Details automatisch für dich aus.",
    checkOff: "Wenn deine Liste vollständig ist, kannst du Artikel abhaken, während du packst, und los gehst – ohne etwas vergessen zu haben.",
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
    subject: "Tu TrekList está lista — añade tu primer artículo",
    tagline: "Planificador gratuito de listas de equipamiento para senderistas",
    greeting: (name) => `Hola ${name},`,
    ready: "Tu lista está lista cuando tú lo estés.",
    gearSection: "Crear tu sección Mi Equipamiento es rápido: escribe el nombre de un artículo, pega un enlace de cualquier tienda outdoor, o toma una foto del embalaje. TrekList rellena los detalles por ti.",
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
    subject: "Il tuo TrekList è pronto — aggiungi il tuo primo articolo",
    tagline: "Pianificatore gratuito di liste attrezzatura per escursionisti",
    greeting: (name) => `Ciao ${name},`,
    ready: "La tua lista è pronta quando lo sei tu.",
    gearSection: "Aggiungere attrezzatura è semplice: digita un nome, incolla un link da qualsiasi rivenditore outdoor, o scatta una foto della confezione. TrekList compila i dettagli per te.",
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
    subject: "Je TrekList is klaar — voeg je eerste item toe",
    tagline: "Gratis uitrustingslijst planner voor wandelaars",
    greeting: (name) => `Hey ${name},`,
    ready: "Je lijst is klaar wanneer jij dat bent.",
    gearSection: "Je uitrusting toevoegen gaat snel: typ een naam, plak een link van een outdoor retailer, of maak een foto van de verpakking. TrekList vult de details automatisch voor je in.",
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
<html lang="${t.lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${t.title}</title>
  <style>
    :root { color-scheme: light; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background-color: #e8edf2;
      font-family: Arial, Helvetica, sans-serif;
      color: #1e293b;
      -webkit-text-size-adjust: 100%;
      text-size-adjust: 100%;
    }
    .email-wrapper { max-width: 620px; margin: 0 auto; background-color: #ffffff; }
    .header {
      background-color: #0B1220;
      padding: 22px 40px;
      text-align: center;
      border-bottom: 3px solid #1d4ed8;
    }
    .header-logo {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      text-decoration: none;
      letter-spacing: -0.01em;
      display: block;
    }
    .header-tagline {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
      font-weight: 400;
      color: #60a5fa;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 5px;
    }
    .content-area {
      padding: 40px 44px;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 15px;
      line-height: 1.7;
      color: #1e293b;
    }
    .content-area p { margin-bottom: 18px; }
    .content-area a { color: #1d4ed8; text-decoration: underline; }
    .cta-wrap { text-align: center; margin: 32px 0; }
    .cta-button {
      display: inline-block;
      background-color: #1d4ed8;
      color: #ffffff !important;
      text-decoration: none !important;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 15px;
      font-weight: 700;
      padding: 14px 32px;
      border-radius: 6px;
      letter-spacing: 0.01em;
    }
    .footer {
      background-color: #0B1220;
      padding: 28px 40px;
      text-align: center;
      border-top: 3px solid #1d4ed8;
    }
    .footer-logo {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 15px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 12px;
    }
    .footer-links { margin-bottom: 16px; }
    .footer-links a {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #60a5fa !important;
      text-decoration: none;
      margin: 0 10px;
    }
    .footer-text {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.8;
      color: #64748b;
    }
    .footer-text a { color: #60a5fa !important; text-decoration: none; }
    @media (max-width: 640px) {
      .content-area { padding: 28px 24px; }
      .header { padding: 20px 24px; }
      .footer { padding: 24px 24px; }
    }
  </style>
</head>
<body>
<div class="email-wrapper">

  <div class="header">
    <a href="https://treklist.co" class="header-logo">TrekList</a>
    <div class="header-tagline">${t.tagline}</div>
  </div>

  <div class="content-area">
    <p>${t.greeting(name)}</p>
    <p>${t.ready}</p>
    <img src="https://res.cloudinary.com/treklist/image/upload/w_1080,f_png/v1779787880/Screenshot-treklist-desktop-view_x256gu.png" alt="TrekList gear list" width="540" style="max-width:100%;height:auto;display:block;margin:0 auto 24px;border-radius:6px;border:1px solid #e2e8f0;">
    <p>${t.gearSection}</p>
    <p>${t.checkOff}</p>
    <div class="cta-wrap">
      <a href="${listUrl}" class="cta-button">${t.cta}</a>
    </div>
    <p>${t.questions}</p>
    <p>${t.signoff}<br>Tall Joe · TrekList</p>
  </div>

  <div class="footer">
    <div class="footer-logo">TrekList</div>
    <p class="footer-text">${t.madeBy}</p>
    <div class="footer-links">
      <a href="https://treklist.co">${t.buildList}</a>
      <a href="https://talljoehikes.com/gear/">${t.gearReviews}</a>
      <a href="https://talljoehikes.com/hikes/">${t.hikeGuides}</a>
    </div>
    <p class="footer-text">
      ${t.footerSignup}<br>
      <a href="${unsubscribeUrl}">${t.unsubscribe}</a><br><br>
      © 2026 TrekList · Tall Joe Hikes · Netherlands
    </p>
  </div>

</div>
</body>
</html>`;

  const text = `${t.greeting(name)}

${t.ready}

${listUrl}

${t.gearSection}

${t.checkOff}

${t.signoff}
Tall Joe · TrekList

---
${t.footerSignup}
${t.unsubscribe}: ${unsubscribeUrl}`;

  return { html, text, subject: t.subject };
}

module.exports = { buildWelcomeEmail };
