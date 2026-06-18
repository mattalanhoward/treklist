// server/src/utils/tripReminderEmailTemplate.js
// =============================================================================
// Pre-trip reminder email. Sent ~2 days before a gear list's tripStart.
// Mirrors the Kit card layout used by welcomeEmailTemplate.js.
// =============================================================================

const TRANSLATIONS = {
  en: {
    lang: "en",
    title: "Your trip is coming up",
    subject: (title, days) => `${title} starts in ${days} days: time to pack`,
    tagline: "Get the pack right",
    greeting: (name) => `Hey ${name},`,
    leadNormal: (title, days) =>
      `Your trip <strong>${title}</strong> starts in ${days} days. Here's a quick look at your list so you can make sure everything's ready.`,
    leadEmpty: (title, days) =>
      `Your trip <strong>${title}</strong> starts in ${days} days, but your list is still empty. Now's a great time to add your gear so nothing gets left behind.`,
    summaryHeading: "Your trip",
    labelWhen: "When",
    labelWhere: "Where",
    nights: (n) => (n === 1 ? "night" : "nights"),
    tripLinksHeading: "Trip links",
    labelItems: "Items",
    labelPackWeight: "Pack weight",
    cta: "Open my list",
    checklistCta: "Open my packing checklist",
    wishlistHeading: "Still on your wishlist",
    wishlistIntro: "Don't forget to grab these before you head out:",
    wishlistCta: "View your wishlist",
    questions: "Need help with something in TrekList? Just reply to this email and I'll lend a hand.",
    signoff: "Happy trails,",
    madeBy: "TrekList is made by Tall Joe Hikes",
    buildList: "Build a list",
    gearReviews: "Gear reviews",
    hikeGuides: "Hike guides",
    footerSignup: "You're getting this because you set a trip date on treklist.co",
    unsubscribe: "Unsubscribe from trip reminders",
  },
  fr: {
    lang: "fr",
    title: "Votre aventure approche",
    subject: (title, days) => `${title} commence dans ${days} jours : préparez votre sac`,
    tagline: "Préparez bien votre sac",
    greeting: (name) => `Salut ${name},`,
    leadNormal: (title, days) =>
      `Votre sortie <strong>${title}</strong> commence dans ${days} jours. Voici un aperçu de votre liste pour vérifier que tout est prêt.`,
    leadEmpty: (title, days) =>
      `Votre sortie <strong>${title}</strong> commence dans ${days} jours, mais votre liste est encore vide. C'est le moment idéal pour ajouter votre matériel afin de ne rien oublier.`,
    summaryHeading: "Votre sortie",
    labelWhen: "Quand",
    labelWhere: "Où",
    nights: (n) => (n === 1 ? "nuit" : "nuits"),
    tripLinksHeading: "Liens de la sortie",
    labelItems: "Articles",
    labelPackWeight: "Poids du sac",
    cta: "Ouvrir ma liste",
    checklistCta: "Ouvrir ma checklist de préparation",
    wishlistHeading: "Toujours sur votre liste de souhaits",
    wishlistIntro: "N'oubliez pas de récupérer ceci avant de partir :",
    wishlistCta: "Voir ma liste de souhaits",
    questions: "Besoin d'aide avec TrekList ? Répondez simplement à cet e-mail et je vous donnerai un coup de main.",
    signoff: "Bonne randonnée,",
    madeBy: "TrekList est créé par Tall Joe Hikes",
    buildList: "Créer une liste",
    gearReviews: "Avis équipement",
    hikeGuides: "Guides de randonnée",
    footerSignup: "Vous recevez ceci car vous avez défini une date de sortie sur treklist.co",
    unsubscribe: "Se désabonner des rappels de sortie",
  },
  de: {
    lang: "de",
    title: "Deine Tour steht an",
    subject: (title, days) => `${title} startet in ${days} Tagen: Zeit zu packen`,
    tagline: "Den Rucksack richtig packen",
    greeting: (name) => `Hey ${name},`,
    leadNormal: (title, days) =>
      `Deine Tour <strong>${title}</strong> startet in ${days} Tagen. Hier ist ein kurzer Blick auf deine Liste, damit alles bereit ist.`,
    leadEmpty: (title, days) =>
      `Deine Tour <strong>${title}</strong> startet in ${days} Tagen, aber deine Liste ist noch leer. Jetzt ist der ideale Moment, deine Ausrüstung zu erfassen, damit nichts liegen bleibt.`,
    summaryHeading: "Deine Tour",
    labelWhen: "Wann",
    labelWhere: "Wo",
    nights: (n) => (n === 1 ? "Nacht" : "Nächte"),
    tripLinksHeading: "Links zur Tour",
    labelItems: "Artikel",
    labelPackWeight: "Rucksackgewicht",
    cta: "Meine Liste öffnen",
    checklistCta: "Meine Checkliste öffnen",
    wishlistHeading: "Noch auf deiner Wunschliste",
    wishlistIntro: "Denk daran, das hier vor dem Aufbruch zu besorgen:",
    wishlistCta: "Wunschliste ansehen",
    questions: "Brauchst du Hilfe mit TrekList? Antworte einfach auf diese E-Mail und ich helfe dir weiter.",
    signoff: "Viel Spaß auf dem Weg,",
    madeBy: "TrekList wird von Tall Joe Hikes gemacht",
    buildList: "Liste erstellen",
    gearReviews: "Ausrüstungs-Reviews",
    hikeGuides: "Wanderführer",
    footerSignup: "Du erhältst diese E-Mail, weil du auf treklist.co ein Tourdatum festgelegt hast",
    unsubscribe: "Tour-Erinnerungen abbestellen",
  },
  es: {
    lang: "es",
    title: "Tu aventura se acerca",
    subject: (title, days) => `${title} empieza en ${days} días: hora de preparar la mochila`,
    tagline: "Prepara bien tu mochila",
    greeting: (name) => `Hola ${name},`,
    leadNormal: (title, days) =>
      `Tu salida <strong>${title}</strong> empieza en ${days} días. Aquí tienes un vistazo rápido a tu lista para asegurarte de que todo está listo.`,
    leadEmpty: (title, days) =>
      `Tu salida <strong>${title}</strong> empieza en ${days} días, pero tu lista todavía está vacía. Es el momento ideal para añadir tu equipo y no olvidar nada.`,
    summaryHeading: "Tu salida",
    labelWhen: "Cuándo",
    labelWhere: "Dónde",
    nights: (n) => (n === 1 ? "noche" : "noches"),
    tripLinksHeading: "Enlaces del viaje",
    labelItems: "Artículos",
    labelPackWeight: "Peso de la mochila",
    cta: "Abrir mi lista",
    checklistCta: "Abrir mi checklist de equipaje",
    wishlistHeading: "Todavía en tu lista de deseos",
    wishlistIntro: "No olvides conseguir esto antes de salir:",
    wishlistCta: "Ver mi lista de deseos",
    questions: "¿Necesitas ayuda con TrekList? Responde a este correo y te echo una mano.",
    signoff: "¡Buen camino,",
    madeBy: "TrekList es creado por Tall Joe Hikes",
    buildList: "Crear una lista",
    gearReviews: "Reseñas de equipo",
    hikeGuides: "Guías de senderismo",
    footerSignup: "Recibes esto porque definiste una fecha de salida en treklist.co",
    unsubscribe: "Cancelar recordatorios de salidas",
  },
  it: {
    lang: "it",
    title: "La tua avventura si avvicina",
    subject: (title, days) => `${title} inizia tra ${days} giorni: è ora di preparare lo zaino`,
    tagline: "Prepara bene lo zaino",
    greeting: (name) => `Ciao ${name},`,
    leadNormal: (title, days) =>
      `La tua uscita <strong>${title}</strong> inizia tra ${days} giorni. Ecco un riepilogo della tua lista per assicurarti che sia tutto pronto.`,
    leadEmpty: (title, days) =>
      `La tua uscita <strong>${title}</strong> inizia tra ${days} giorni, ma la tua lista è ancora vuota. È il momento ideale per aggiungere la tua attrezzatura e non dimenticare nulla.`,
    summaryHeading: "La tua uscita",
    labelWhen: "Quando",
    labelWhere: "Dove",
    nights: (n) => (n === 1 ? "notte" : "notti"),
    tripLinksHeading: "Link del viaggio",
    labelItems: "Articoli",
    labelPackWeight: "Peso dello zaino",
    cta: "Apri la mia lista",
    checklistCta: "Apri la mia checklist",
    wishlistHeading: "Ancora nella tua lista dei desideri",
    wishlistIntro: "Non dimenticare di procurarti questi prima di partire:",
    wishlistCta: "Vedi la lista dei desideri",
    questions: "Hai bisogno di aiuto con TrekList? Rispondi a questa email e ti do una mano.",
    signoff: "Buon cammino,",
    madeBy: "TrekList è realizzato da Tall Joe Hikes",
    buildList: "Crea una lista",
    gearReviews: "Recensioni attrezzatura",
    hikeGuides: "Guide escursionistiche",
    footerSignup: "Stai ricevendo questo perché hai impostato una data di uscita su treklist.co",
    unsubscribe: "Annulla i promemoria delle uscite",
  },
  nl: {
    lang: "nl",
    title: "Je trip komt eraan",
    subject: (title, days) => `${title} begint over ${days} dagen: tijd om in te pakken`,
    tagline: "Pak je rugzak goed in",
    greeting: (name) => `Hey ${name},`,
    leadNormal: (title, days) =>
      `Je trip <strong>${title}</strong> begint over ${days} dagen. Hier is een snel overzicht van je lijst zodat je zeker weet dat alles klaar is.`,
    leadEmpty: (title, days) =>
      `Je trip <strong>${title}</strong> begint over ${days} dagen, maar je lijst is nog leeg. Dit is het ideale moment om je uitrusting toe te voegen zodat je niets vergeet.`,
    summaryHeading: "Je trip",
    labelWhen: "Wanneer",
    labelWhere: "Waar",
    nights: (n) => (n === 1 ? "nacht" : "nachten"),
    tripLinksHeading: "Trip-links",
    labelItems: "Items",
    labelPackWeight: "Rugzakgewicht",
    cta: "Mijn lijst openen",
    checklistCta: "Mijn checklist openen",
    wishlistHeading: "Nog op je verlanglijst",
    wishlistIntro: "Vergeet niet om deze mee te nemen voordat je vertrekt:",
    wishlistCta: "Bekijk je verlanglijst",
    questions: "Hulp nodig met TrekList? Beantwoord deze e-mail en ik help je verder.",
    signoff: "Veel wandelplezier,",
    madeBy: "TrekList is gemaakt door Tall Joe Hikes",
    buildList: "Maak een lijst",
    gearReviews: "Uitrusting reviews",
    hikeGuides: "Wandelgidsen",
    footerSignup: "Je ontvangt dit omdat je een tripdatum hebt ingesteld op treklist.co",
    unsubscribe: "Trip-herinneringen afmelden",
  },
};

// Format a weight in grams into the user's preferred unit.
function formatWeight(grams, weightUnit) {
  const g = Math.max(0, Math.round(grams || 0));
  if (weightUnit === "oz") {
    const oz = g / 28.3495;
    if (oz >= 16) return `${(oz / 16).toFixed(2)} lb`;
    return `${oz.toFixed(1)} oz`;
  }
  if (g >= 1000) return `${(g / 1000).toFixed(2)} kg`;
  return `${g} g`;
}

function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const LOCALE_MAP = { en: "en-GB", fr: "fr-FR", de: "de-DE", es: "es-ES", it: "it-IT", nl: "nl-NL" };
const DAY_MS = 24 * 60 * 60 * 1000;

// "Sat 23 May 2026 · 1 night" — formatted in UTC for determinism (no per-user tz).
function formatWhen(startISO, endISO, t, language) {
  if (!startISO) return "";
  const locale = LOCALE_MAP[language] || "en-GB";
  const start = new Date(startISO);
  if (isNaN(start)) return "";
  const dateStr = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(start);

  let nights = 0;
  if (endISO) {
    const end = new Date(endISO);
    if (!isNaN(end)) {
      const s = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
      const e = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
      nights = Math.max(0, Math.round((e - s) / DAY_MS));
    }
  }
  return nights > 0 ? `${dateStr} · ${nights} ${t.nights(nights)}` : dateStr;
}

function buildTripReminderEmail({
  trailname,
  tripTitle,
  daysUntil = 2,
  tripStartISO,
  tripEndISO,
  location,
  links = [],
  listUrl,
  checklistUrl,
  wishlistUrl,
  unsubscribeUrl,
  summary = { totalItems: 0, packWeightGrams: 0, wornCount: 0, consumableCount: 0 },
  weightUnit = "g",
  wishlistItems = [],
  language = "en",
}) {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const name = trailname || "there";
  const safeTitle = escapeHtml(tripTitle || "your trip");
  const isEmpty = !summary || summary.totalItems === 0;

  // ── Info card: trip facts (always) + pack stats (when the list has items) ──
  const row = (label, value) => `
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#475569;padding:6px 0;">${label}</td>
                  <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#0f172a;padding:6px 0;">${value}</td>
                </tr>`;

  const whenValue = formatWhen(tripStartISO, tripEndISO, t, language);

  let infoRows = "";
  if (whenValue) infoRows += row(t.labelWhen, whenValue);
  if (location && location.trim()) infoRows += row(t.labelWhere, escapeHtml(location.trim()));
  if (!isEmpty) {
    infoRows += row(t.labelItems, summary.totalItems);
    infoRows += row(t.labelPackWeight, formatWeight(summary.packWeightGrams, weightUnit));
  }

  const summaryBlock = infoRows
    ? `
              <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;letter-spacing:0.5px;text-transform:uppercase;color:#94a3b8;margin:0 0 8px;">${t.summaryHeading}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 16px;margin:0 0 24px;">
                ${infoRows}
              </table>`
    : "";

  // ── Trip links the user saved (maps, weather, permits…) — only valid ones ──
  const validLinks = (links || []).filter((l) => l && l.url && l.url.trim());
  const linksBlock = validLinks.length
    ? `
              <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;letter-spacing:0.5px;text-transform:uppercase;color:#94a3b8;margin:0 0 8px;">${t.tripLinksHeading}</p>
              <ul style="margin:0 0 24px;padding-left:20px;font-size:16px;line-height:1.6;color:#334155;">
                ${validLinks
                  .map((l) => {
                    const url = escapeHtml(l.url.trim());
                    const label = l.label && l.label.trim() ? escapeHtml(l.label.trim()) : url;
                    return `<li><a href="${url}" style="color:#1d4ed8;text-decoration:underline;">${label}</a></li>`;
                  })
                  .join("\n                ")}
              </ul>`
    : "";

  // ── Wishlist block (omitted when there's nothing wishlisted) ──
  const wishlistBlock =
    wishlistItems && wishlistItems.length
      ? `
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
              <p style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;letter-spacing:0.5px;text-transform:uppercase;color:#94a3b8;margin:0 0 8px;">${t.wishlistHeading}</p>
              <p>${t.wishlistIntro}</p>
              <ul style="margin:0 0 16px;padding-left:20px;font-size:16px;line-height:1.6;color:#334155;">
                ${wishlistItems
                  .map(
                    (i) =>
                      `<li>${escapeHtml(i.name)}${i.brand ? ` <span style="color:#94a3b8;">· ${escapeHtml(i.brand)}</span>` : ""}</li>`
                  )
                  .join("\n                ")}
              </ul>
              <p style="margin:0 0 8px;"><a href="${wishlistUrl}" style="color:#1d4ed8;text-decoration:underline;">${t.wishlistCta}</a></p>`
      : "";

  // Secondary link to the packing checklist (only useful once there are items).
  const checklistLink =
    !isEmpty && checklistUrl
      ? `
              <p style="text-align:center;font-size:14px;line-height:1.6;margin:0 0 24px;"><a href="${checklistUrl}" style="color:#1d4ed8;text-decoration:underline;">${t.checklistCta} &rarr;</a></p>`
      : "";

  const lead = isEmpty
    ? t.leadEmpty(safeTitle, daysUntil)
    : t.leadNormal(safeTitle, daysUntil);

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
    .content-area a { color: #1d4ed8; text-decoration: underline; }

    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; }
      .px { padding-left: 20px !important; padding-right: 20px !important; }
      .footer-links td { display: block !important; padding: 4px 0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#e8edf2;">

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
              <p>${lead}</p>
              ${summaryBlock}
              <table role="presentation" class="btn" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px auto ${checklistLink ? "12px" : "24px"};">
                <tr>
                  <td align="center" style="border-radius:6px;background-color:#1d4ed8;">
                    <a href="${listUrl}" style="background-color:#1d4ed8;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;padding:12px 28px;border-radius:6px;display:inline-block;">${t.cta}</a>
                  </td>
                </tr>
              </table>
              ${checklistLink}
              ${linksBlock}
              ${wishlistBlock}
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

  // ── Plain-text version ──
  const textLines = [
    t.greeting(name),
    "",
    lead.replace(/<\/?strong>/g, ""),
    "",
  ];
  if (infoRows) {
    textLines.push(`${t.summaryHeading}:`);
    if (whenValue) textLines.push(`- ${t.labelWhen}: ${whenValue}`);
    if (location && location.trim()) textLines.push(`- ${t.labelWhere}: ${location.trim()}`);
    if (!isEmpty) {
      textLines.push(`- ${t.labelItems}: ${summary.totalItems}`);
      textLines.push(`- ${t.labelPackWeight}: ${formatWeight(summary.packWeightGrams, weightUnit)}`);
    }
    textLines.push("");
  }
  textLines.push(`${t.cta}: ${listUrl}`);
  if (!isEmpty && checklistUrl) {
    textLines.push(`${t.checklistCta}: ${checklistUrl}`);
  }
  if (validLinks.length) {
    textLines.push("");
    textLines.push(`${t.tripLinksHeading}:`);
    validLinks.forEach((l) => {
      const label = l.label && l.label.trim() ? l.label.trim() : l.url.trim();
      textLines.push(`- ${label}: ${l.url.trim()}`);
    });
  }
  if (wishlistItems && wishlistItems.length) {
    textLines.push("");
    textLines.push(`${t.wishlistHeading}:`);
    wishlistItems.forEach((i) => textLines.push(`- ${i.name}${i.brand ? ` · ${i.brand}` : ""}`));
    textLines.push(`${t.wishlistCta}: ${wishlistUrl}`);
  }
  textLines.push("", t.signoff, "Tall Joe · TrekList", "", "---", t.footerSignup, `${t.unsubscribe}: ${unsubscribeUrl}`);

  return {
    html,
    text: textLines.join("\n"),
    subject: t.subject(tripTitle || "Your trip", daysUntil),
  };
}

module.exports = { buildTripReminderEmail };
