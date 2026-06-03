// =============================================================================
// SEED: Community users, posts, comments, and upvotes
// =============================================================================
//
// RUN:
//   cd server
//   node src/scripts/seed-community.js
//
// ⚠️  DESTRUCTIVE: clears ALL users, posts, comments, and upvotes.
// Safety check aborts if MONGO_DB_NAME does not contain "local".
// Password for all seed users: treklist123
// =============================================================================

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt   = require("bcrypt");

// ─── Safety check ─────────────────────────────────────────────────────────────

const dbName = process.env.MONGO_DB_NAME || "";
if (!dbName.toLowerCase().includes("local")) {
  console.error(`❌  MONGO_DB_NAME is "${dbName}" — does not contain "local". Aborting to protect production data.`);
  process.exit(1);
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

const NOW     = Date.now();
const rand    = (min, max) => min + Math.random() * (max - min);
const hoursMs = (h) => h * 60 * 60 * 1000;
const daysMs  = (d) => d * 24 * 60 * 60 * 1000;

function postTs(daysAgo) {
  return new Date(NOW - daysMs(daysAgo) - hoursMs(rand(7, 22)));
}

function afterTs(ref, minH, maxH) {
  return new Date(ref.getTime() + hoursMs(rand(minH, maxH)));
}

async function insert(Model, data) {
  const doc = new Model(data);
  return doc.save({ timestamps: false });
}

// ─── Users ────────────────────────────────────────────────────────────────────

const SEED_USERS = [
  { trailname: "PeaksNValleys", email: "seed.peaksnvalleys@treklist.dev" },
  { trailname: "claire",        email: "seed.claire@treklist.dev"        },
  { trailname: "pete82",        email: "seed.pete82@treklist.dev"        },
  { trailname: "AnnaBanana",    email: "seed.annabana@treklist.dev"      },
  { trailname: "david_r",       email: "seed.david_r@treklist.dev"       },
  { trailname: "helen",         email: "seed.helen@treklist.dev"         },
  { trailname: "robvdb",        email: "seed.robvdb@treklist.dev"        },
  { trailname: "jessinthealps", email: "seed.jessinthealps@treklist.dev" },
  { trailname: "mdescamps",     email: "seed.mdescamps@treklist.dev"     },
  { trailname: "elisatn",       email: "seed.elisatn@treklist.dev"       },
  { trailname: "runfast",       email: "seed.runfast@treklist.dev"       },
  { trailname: "KateMendip",    email: "seed.katemendip@treklist.dev"    },
  { trailname: "TentDad79",     email: "seed.tentdad79@treklist.dev"     },
  { trailname: "sarahbc",       email: "seed.sarahbc@treklist.dev"       },
  { trailname: "leo",           email: "seed.leo@treklist.dev"           },
  { trailname: "mtnmama",       email: "seed.mtnmama@treklist.dev"       },
  { trailname: "johnpdx",       email: "seed.johnpdx@treklist.dev"       },
  { trailname: "LonghornK",     email: "seed.longhornk@treklist.dev"     },
  { trailname: "MJK",           email: "seed.mjk@treklist.dev"           },
  { trailname: "FrankReynolds", email: "seed.frankreynolds@treklist.dev" },
  { trailname: "TallJoe",       email: "mattalanhoward@gmail.com", isAdmin: true },
];

// ─── Posts ────────────────────────────────────────────────────────────────────

const POSTS_BY_SLUG = {

  "treklist-help": [
    {
      key: "H1", author: "pete82", daysAgo: 12,
      title: "How do I share my list with someone who doesn't have an account?",
      body:  "Want to send my kit list to a friend before our trip. She doesn't have an account and I don't want to make her sign up just to see it. Is there a public link option somewhere? Thanks",
    },
    {
      key: "H2", author: "mdescamps", daysAgo: 9,
      title: "Can I duplicate a list to use as a starting point for a new trip?",
      body:  "I have a summer Alps list I want to use as a starting point for a TMB trip. Rather than rebuild from scratch is there a copy or duplicate function? Cheers",
    },
    {
      key: "H3", author: "jessinthealps", daysAgo: 6,
      title: "Weight unit keeps switching back to grams after I set it to oz",
      body:  "Set my preference to oz in account settings. Works fine while I'm on the site but next time I log in it's back to grams. Tried it on two different browsers. Anyone else getting this?",
    },
    {
      key: "H4", author: "helen", daysAgo: 3,
      title: "Is there a print or PDF export anywhere?",
      body:  "Is there a way to print a list or export to PDF? Going through my kit with my hiking partner and screen sharing a browser tab is a pain",
    },
    {
      key: "H5", author: "TentDad79", daysAgo: 1,
      title: "Any plans for a mobile app?",
      body:  "The mobile browser version works fine but offline access would be really useful for when you're in the mountains without signal. Any plans for an app?",
    },
  ],

  "gear-talk": [
    {
      key: "G1", author: "david_r", daysAgo: 13,
      title: "Zpacks Arc Haul vs Gossamer Gear Mariposa for a 10-day carry",
      body:  "Coming from a 65L traditional pack. Looking at the Arc Haul Ultra 60 vs the Mariposa 60 for a 10-day Alpine route. Base weight around 6.5kg, 3 days food, 1.5L water at max. Is the Arc Haul frame worth the extra weight for that kind of carry?",
    },
    {
      key: "G2", author: "claire", daysAgo: 10,
      title: "Quilt or sleeping bag for the Alps in late September?",
      body:  "Sold on quilts for summer but not sure about late September in the Alps where it can drop to 2-4°C at night. I have a 30°F Katabatic Palisade. Is that enough or would I be better on a bag for shoulder season?",
    },
    {
      key: "G3", author: "KateMendip", daysAgo: 8,
      title: "Trekking pole recommendations under £100 — mine snapped",
      body:  "My Black Diamond Trail poles snapped at a joint on the last descent. Looking for a replacement. Don't need carbon just something reliable that won't fail on a mountain. Budget around £80-100",
    },
    {
      key: "G4", author: "robvdb", daysAgo: 5,
      title: "Sawyer Squeeze vs BeFree — has anyone switched and regretted it?",
      body:  "Used the Sawyer Squeeze for three years no issues. My hiking partner switched to the BeFree for the flow rate and won't stop talking about it. Has anyone made the switch and wished they hadn't?",
    },
    {
      key: "G5", author: "helen", daysAgo: 3,
      title: "Down jacket in Scotland — is the wetness concern real or overblown?",
      body:  "I have an 850fp down jacket and I keep second-guessing it for Scotland. Does down actually fail in those conditions or is the synthetic recommendation just excessive caution?",
    },
    {
      key: "G6", author: "mtnmama", daysAgo: 1,
      title: "Backpack sizing for shorter frames — any recommendations?",
      body:  "What size and brand backpack would people recommend for a 5'3 female? Been on a 50L Osprey Aura for years but thinking about going lighter. The women's specific fit matters to me",
    },
  ],

  "tmb": [
    {
      key: "T1", author: "claire", daysAgo: 14,
      title: "Clockwise or counter-clockwise — strong opinions?",
      body:  "Hi all. Doing the TMB in August, first time. Counter-clockwise seems to be the default but I've seen arguments for clockwise too. Anyone done both? Do you have a strong preference?",
    },
    {
      key: "T2", author: "mtnmama", daysAgo: 12,
      title: "How far ahead are people booking refuges for August?",
      body:  "Planning late August. How far ahead do I actually need to book? I keep hearing Refuge Bonatti goes in days but is that true for the whole route or just a few key nights?",
    },
    {
      key: "T3", author: "pete82", daysAgo: 10,
      title: "Kit list sense-check — 8.5kg with 3 days food",
      body:  "Pack is sitting at 8.5kg with 3 days food and 1.5L water. Osprey Exos 48, Nemo Hornet 2P, NeoAir XLite, down jacket, Montane rain jacket, merino base. Doing it late July. Anything obviously wrong?",
    },
    {
      key: "T4", author: "PeaksNValleys", daysAgo: 8,
      title: "Grand Col Ferret in late September — snow a real concern?",
      body:  "Aiming for the last week of September. The Grand Col Ferret is the bit I'm uncertain about — is snow on the col a serious problem by then or manageable in trail runners? Anyone done it late September recently?",
    },
    {
      key: "T5", author: "leo", daysAgo: 6,
      title: "Wild camping and bivouac rules on the TMB",
      body:  "Coming from the Pyrenees where the rules above a certain altitude are pretty relaxed. I've read conflicting things about the TMB. Is wild camping genuinely possible or are the rules enforced throughout?",
    },
    {
      key: "T6", author: "johnpdx", daysAgo: 4,
      title: "First TMB next summer — 7 days, where to focus?",
      body:  "Hi all! Planning my first TMB next summer and will only have 7 days. What sections would you prioritize? I'm most interested in the scenery, I don't need to do the full loop. Which apps or resources did you use for planning? Thanks so much",
    },
    {
      key: "T7", author: "FrankReynolds", daysAgo: 2,
      title: "Group of 8, TMB September 2027 — when to start booking?",
      body:  "Planning a TMB for a group of 8 for early September 2027. We want to stay in refuges. How early can I start booking and what's the minimum lead time you'd recommend? Thanks",
    },
    {
      key: "T8", author: "LonghornK", daysAgo: 1,
      title: "Is sunburn actually an issue in mid July?",
      body:  "Is sunburn actually a concern at altitude in mid July? I never think about it but it keeps showing up on packing lists. Asking from Texas where we just wear a hat and move on",
    },
  ],

  "av1": [
    {
      key: "A1", author: "jessinthealps", daysAgo: 14,
      title: "AV1 solo in early September — realistic or naive?",
      body:  "I've done solo multi-day trips before but the Dolomites look more remote than anything I've done. Is AV1 solo in early September realistic for a confident but not elite hiker? Or is there a reason people usually go in pairs?",
    },
    {
      key: "A2", author: "mdescamps", daysAgo: 12,
      title: "Hut-to-hut vs wild camping on the AV1",
      body:  "The rifugi look incredible but 8 nights adds up fast. Is wild camping a realistic alternative for most of the route or do the regulations make it impractical? Would I just end up paying anyway?",
    },
    {
      key: "A3", author: "MJK", daysAgo: 10,
      title: "Which section of the AV1 was the highlight for you?",
      body:  "Done the full AV1 twice. The Civetta section is the obvious answer but curious what others say. Which day or section stuck with you most?",
    },
    {
      key: "A4", author: "KateMendip", daysAgo: 8,
      title: "Trail runner advice for Dolomite terrain",
      body:  "Most of my hiking is on softer ground — Scottish hills and Irish mountains. The Dolomites look much more technical and rocky. Do I need trail runners with more aggressive tread or will standard ones do?",
    },
    {
      key: "A5", author: "TentDad79", daysAgo: 6,
      title: "Resupply options along the AV1",
      body:  "Planning an 8-day itinerary. How much food should I carry from the start versus relying on the rifugi? Can you realistically top up snacks and fuel along the route or is it better to carry everything?",
    },
    {
      key: "A6", author: "LonghornK", daysAgo: 5,
      title: "Getting excited for the Dolomites!",
      body:  "My wife and I are doing the AV1 this September. First time in the Dolomites and we cannot wait. Anyone else heading out around the same time?",
    },
    {
      key: "A7", author: "johnpdx", daysAgo: 3,
      title: "Route difficulty after Pramperet — exposure question",
      body:  "Has anyone had trouble with the section after Pramperet? Our guidebook says something like near vertical crest with exposure and I'm not great with heights. Is it as bad as it sounds?",
    },
    {
      key: "A8", author: "mtnmama", daysAgo: 2,
      title: "Backpack size and guidebook recommendations for AV1",
      body:  "Hi all. Planning the AV1 for next summer. Two questions — what size pack are people taking (I'm 5'3 and usually go 40L but not sure if that's enough for 8 days hut-to-hut), and which guidebook would you recommend? Thanks",
    },
    {
      key: "A9", author: "FrankReynolds", daysAgo: 1,
      title: "Are the WWI tunnels worth doing?",
      body:  "Are the war tunnels on the route worth doing? Worth the detour or more of a tourist thing",
    },
  ],

  "whw": [
    {
      key: "W1", author: "sarahbc", daysAgo: 13,
      title: "WHW in November — has anyone done it?",
      body:  "Most people seem to do the WHW in summer but I'm planning a November attempt. I know what I'm getting into with the daylight and weather. What I don't know is whether sections become genuinely impassable — river crossings, ground conditions. Anyone done it late in the year?",
    },
    {
      key: "W2", author: "pete82", daysAgo: 11,
      title: "Rannoch Moor in spring — how bad is the bog?",
      body:  "Doing the WHW in May, first long distance route. I keep hearing Rannoch Moor is brutal in spring. Do I need waterproof boots or should I just accept the wet feet and go with trail runners? Genuinely unsure",
    },
    {
      key: "W3", author: "claire", daysAgo: 9,
      title: "Mixing wild camping, bothies and B&Bs — what balance worked?",
      body:  "I want a mix of wild camping, bothies, and the occasional B&B for a hot shower. Anyone done a blend that worked well? Particularly wondering whether the bothies are crowded in May",
    },
    {
      key: "W4", author: "mdescamps", daysAgo: 7,
      title: "Conic Hill at sunrise — worth restructuring your itinerary for?",
      body:  "I've seen photos of the sunrise from Conic Hill over Loch Lomond and they look incredible. Has anyone restructured their itinerary specifically to be there at dawn? Was it worth it?",
    },
    {
      key: "W5", author: "leo", daysAgo: 5,
      title: "What's the Devil's Staircase actually like?",
      body:  "The Devil's Staircase has a scary name but when I look at the elevation profile it doesn't seem that bad. Is the reputation overblown or is it genuinely tough? Doing it on day 6 of a 7-day itinerary",
    },
    {
      key: "W6", author: "LonghornK", daysAgo: 4,
      title: "Just found out about midges and I'm terrified",
      body:  "Just found out midges are a thing in Scotland and now I'm genuinely worried. Any tips for dealing with them? We have accommodation booked for September. Are there sections worse than others?",
    },
    {
      key: "W7", author: "mtnmama", daysAgo: 3,
      title: "Rain pants in May — necessary or overkill?",
      body:  "Rain pants — do you actually need them or is a good rain jacket enough for the WHW in May? Trying to figure out what's essential vs overkill",
    },
    {
      key: "W8", author: "FrankReynolds", daysAgo: 1,
      title: "Is the Loch Lomond section really the hardest part?",
      body:  "Heard the Loch Lomond section is one of the hardest parts of the trail. Is that accurate or is it more of an exaggeration? Just trying to set realistic expectations for my group",
    },
  ],
};

// ─── Comments & replies ───────────────────────────────────────────────────────

const THREADS = [

  // ── Treklist Help ──────────────────────────────────────────────────────────
  {
    postKey: "H1",
    comments: [
      {
        author: "AnnaBanana",
        body: "Share button on the list page, think it's top right. Generates a public link, they don't need an account.",
        replies: [
          { author: "pete82", body: "Found it! Thanks so much" },
        ],
      },
      {
        author: "david_r",
        body: "Works on mobile too. Sent mine to a few people before my last trip, none of them needed to sign up.",
        replies: [],
      },
    ],
  },
  {
    postKey: "H3",
    comments: [
      {
        author: "jessinthealps",
        body: "Same issue on Firefox. Saves while I'm on the site but gone next session.",
        replies: [],
      },
      {
        author: "robvdb",
        body: "Try logging out fully and clearing site data. Fixed it for me",
        replies: [
          { author: "jessinthealps", body: "tried that, still happening. will try another browser" },
        ],
      },
    ],
  },
  {
    postKey: "H4",
    comments: [
      {
        author: "helen",
        body: "Would love this. I've been screenshotting it and sending which is barely readable on a phone",
        replies: [],
      },
      {
        author: "PeaksNValleys",
        body: "Even a basic print stylesheet would cover most of it honestly",
        replies: [],
      },
    ],
  },

  // ── Gear Talk ──────────────────────────────────────────────────────────────
  {
    postKey: "G1",
    comments: [
      {
        author: "david_r",
        body: "Done extended trips with both. Arc Haul for that carry weight — the frame makes a real difference over long days. Mariposa is excellent but I'd keep it under 8kg.",
        replies: [],
      },
      {
        author: "AnnaBanana",
        body: "The Mariposa hipbelt is the weak link once you load it up. Everything else about it is excellent.",
        replies: [
          { author: "david_r", body: "Exactly right. Shoulder harness is very good but the hipbelt suffers on heavy days." },
        ],
      },
      {
        author: "jessinthealps",
        body: "If you can try both on with actual weight in them do it. Fit is really individual with frameless packs.",
        replies: [],
      },
    ],
  },
  {
    postKey: "G3",
    comments: [
      {
        author: "PeaksNValleys",
        body: "Leki Makalu Lite. Had mine four years no issues. Cork grips, spare parts are easy to find.",
        replies: [],
      },
      {
        author: "helen",
        body: "BD Trail Ergo Cork, about £85. Really good grips especially on long descents",
        replies: [
          { author: "KateMendip", body: "Is the locking mechanism reliable? That's what failed on mine" },
          { author: "helen",      body: "Twist-lock has been solid for me, no issues" },
        ],
      },
    ],
  },
  {
    postKey: "G5",
    comments: [
      {
        author: "sarahbc",
        body: "I use 850fp down in wet conditions regularly. The real problem is full saturation with nowhere to dry out — a shell over it handles most real-world situations. Hydrophobic down has closed the gap a lot too.",
        replies: [],
      },
      {
        author: "helen",
        body: "Honestly the reputation is a bit overblown in my experience. It rains a lot but you're not swimming. Shell over the top and you're fine.",
        replies: [
          { author: "sarahbc", body: "Yep. Nikwax treated or Pertex shell and you're in good shape." },
        ],
      },
    ],
  },
  {
    postKey: "G6",
    comments: [
      {
        author: "robvdb",
        body: "The Osprey Eja 48 is designed for women's torso lengths and fits shorter frames well. Runs lighter than the Aura too.",
        replies: [],
      },
      {
        author: "KateMendip",
        body: "I'm 5'4 and use the Gregory Juno 36. Excellent fit and genuinely comfortable with weight in it.",
        replies: [
          { author: "mtnmama", body: "Thank you! The Eja is already on my list to try. Will look at the Gregory too" },
        ],
      },
    ],
  },

  // ── TMB ────────────────────────────────────────────────────────────────────
  {
    postKey: "T1",
    comments: [
      {
        author: "AnnaBanana",
        body: "CCW is standard for good reasons — easier on day one climbing out of Les Houches, and the Bonatti section works better from that direction. Clockwise is noticeably quieter though.",
        replies: [],
      },
      {
        author: "david_r",
        body: "Done clockwise twice. Preferred getting the Italian side early. Quieter too. No strong argument against CCW.",
        replies: [
          { author: "claire", body: "The finishing into Chamonix feeling is apparently quite something... might tip it for me" },
        ],
      },
      {
        author: "elisatn",
        body: "CCW for a first time. Do it the other way on the second.",
        replies: [],
      },
    ],
  },
  {
    postKey: "T2",
    comments: [
      {
        author: "AnnaBanana",
        body: "Bonatti books out fast when August dates open, usually Jan or Feb. Set a reminder. Elisabetta and La Peule also book early. Everything else you can normally sort 6-8 weeks out.",
        replies: [
          { author: "mtnmama",   body: "Do you know roughly when Bonatti opens? Is there a set date?" },
          { author: "AnnaBanana", body: "Usually Jan or Feb. Check their website directly, they don't always announce it." },
        ],
      },
      {
        author: "david_r",
        body: "Tried the flexible approach in a busy August. Ended up wild camping 3 nights I hadn't planned for. Fine if you're set up for it.",
        replies: [],
      },
    ],
  },
  {
    postKey: "T3",
    comments: [
      {
        author: "AnnaBanana",
        body: "Solid overall. Two things: drop the camp shoes if you have them, trail runners are fine in the refuges. And that Osprey is more pack than you need if you're sleeping in huts every night.",
        replies: [
          { author: "pete82", body: "Good call on the camp shoes! Will look at a smaller pack too" },
        ],
      },
      {
        author: "PeaksNValleys",
        body: "Sleep system looks fine for July. Everything else seems reasonable.",
        replies: [],
      },
      {
        author: "elisatn",
        body: "Late July is very busy. Your kit looks fine — booking the refuges is more important than anything on that list at this point.",
        replies: [],
      },
    ],
  },
  {
    postKey: "T4",
    comments: [
      {
        author: "elisatn",
        body: "Crossed it September 26th last year. Small amount of snow on the Italian descent, nothing that required anything beyond care going down. Mid-October is a different story.",
        replies: [],
      },
      {
        author: "AnnaBanana",
        body: "CampToCamp route log is good for recent conditions — people post updates within days of crossing.",
        replies: [
          { author: "PeaksNValleys", body: "didn't know about that, useful" },
        ],
      },
    ],
  },
  {
    postKey: "T5",
    comments: [
      {
        author: "AnnaBanana",
        body: "The rules are technically strict throughout but enforcement varies. General expectation is arrive late, leave early, leave no trace, don't camp near refuges or villages. Italy and Switzerland are stricter than France.",
        replies: [
          { author: "leo", body: "More complicated than the Pyrenees then. Was afraid of that" },
        ],
      },
      {
        author: "david_r",
        body: "Did a few nights wild camping on the TMB. Nothing happened but I was discreet. Main issue is finding flat ground.",
        replies: [],
      },
    ],
  },
  {
    postKey: "T6",
    comments: [
      {
        author: "AnnaBanana",
        body: "If you're cutting sections prioritise the Italian side. Chamonix to Courmayeur covers the best scenery and the Bonatti section is the highlight of the whole route for most people.",
        replies: [
          { author: "johnpdx", body: "Really helpful, thank you. Going to build the itinerary around the Italian section." },
        ],
      },
      {
        author: "PeaksNValleys",
        body: "TMB Association website has good route info. Karten Trek app is what most people use on trail.",
        replies: [],
      },
    ],
  },
  {
    postKey: "T7",
    comments: [
      {
        author: "AnnaBanana",
        body: "For a group of 8 in September 2027 you want to book as soon as huts open reservations, typically around January. Check each hut's policy on group sizes — some have a cap.",
        replies: [],
      },
      {
        author: "claire",
        body: "Some refuges don't take groups larger than 6 in one booking so worth confirming before you lock in the itinerary.",
        replies: [
          { author: "FrankReynolds", body: "Good to know about the group size limits, will check each one." },
        ],
      },
    ],
  },
  {
    postKey: "T8",
    comments: [
      {
        author: "david_r",
        body: "Real concern. More UV at altitude and if there's any snow around the reflection makes it worse. SPF 50 minimum, don't forget the neck.",
        replies: [
          { author: "LonghornK", body: "Ok noted. Adding sunscreen to the list. The neck, good call." },
        ],
      },
      {
        author: "PeaksNValleys",
        body: "Yes. And lips — people always forget the lips.",
        replies: [],
      },
    ],
  },

  // ── AV1 ────────────────────────────────────────────────────────────────────
  {
    postKey: "A1",
    comments: [
      {
        author: "elisatn",
        body: "Completely doable solo in September. The route is well marked, the rifugi staff are welcoming and used to solo hikers. A few exposed bits above 2500m need attention but nothing technical.",
        replies: [
          { author: "jessinthealps", body: "That's really reassuring. I think I was imagining it more remote than it is." },
        ],
      },
      {
        author: "david_r",
        body: "Solo in September is fine. Let the rifugio staff know your next destination each morning. Standard practice and they appreciate it.",
        replies: [],
      },
    ],
  },
  {
    postKey: "A2",
    comments: [
      {
        author: "elisatn",
        body: "Technically you can wild camp but the regulations make it genuinely tricky for most of the route. Most people who try it end up paying for at least half the nights anyway. The rifugi are also very social — half the experience.",
        replies: [
          { author: "mdescamps", body: "That's kind of what I suspected. Probably just go full hut-to-hut and stop agonising over it." },
        ],
      },
      {
        author: "MJK",
        body: "Did it hut-to-hut. Cost was high but the rifugi food and company in the evenings were genuinely part of the trip. Don't skip them.",
        replies: [],
      },
    ],
  },
  {
    postKey: "A3",
    comments: [
      {
        author: "elisatn",
        body: "Civetta is the obvious one but for me it's the approach to Rifugio Tissi. You come around a corner and the north face appears all at once. Hard to describe.",
        replies: [],
      },
      {
        author: "david_r",
        body: "Forcella della Marmolada for views, Civetta for drama. Day 5 area if I had to pick one.",
        replies: [
          { author: "KateMendip", body: "Right that's it, I'm booking this. Keep putting it off." },
        ],
      },
    ],
  },
  {
    postKey: "A4",
    comments: [
      {
        author: "elisatn",
        body: "The Dolomite rock is harder and sharper than most people expect. I'd go with something more aggressive than a standard trail runner — Scarpa Spin or Salomon Speedcross grip level rather than road-biased.",
        replies: [],
      },
      {
        author: "jessinthealps",
        body: "I wore Hokas on my first Dolomites trip and regretted it. The softer compound doesn't grip wet rock well at all.",
        replies: [
          { author: "KateMendip",    body: "What are you running now?" },
          { author: "jessinthealps", body: "Scarpa Spin Ultra. Much better on that terrain." },
        ],
      },
    ],
  },
  {
    postKey: "A5",
    comments: [
      {
        author: "elisatn",
        body: "The rifugi sell basic supplies — chocolate, nuts, bars, sometimes pasta. Fuel at most of the bigger huts. I'd carry 1.5-2 days backup from the start.",
        replies: [],
      },
      {
        author: "robvdb",
        body: "I made a spreadsheet of what each hut stocks before my trip. Happy to share if it's still accurate (2023 info)",
        replies: [
          { author: "TentDad79", body: "Please share! That's exactly the kind of thing I can't find anywhere" },
        ],
      },
    ],
  },
  {
    postKey: "A6",
    comments: [
      {
        author: "elisatn",
        body: "Welcome! September is a wonderful time in the Dolomites. The light is different from summer, something special about it. Enjoy every moment.",
        replies: [],
      },
      {
        author: "mdescamps",
        body: "We went last September and it exceeded every expectation. Have a brilliant trip!",
        replies: [
          { author: "LonghornK", body: "Thank you!! Cannot come soon enough" },
        ],
      },
    ],
  },
  {
    postKey: "A7",
    comments: [
      {
        author: "elisatn",
        body: "I know that section well. It's steep and exposed but not technical climbing. Take your time, don't look down unnecessarily, and you'll be fine. Most people find it less scary than the description suggests.",
        replies: [
          { author: "johnpdx", body: "That's really reassuring. I can handle steep — it was the near vertical wording that worried me." },
        ],
      },
      {
        author: "KateMendip",
        body: "The descriptions on these routes always sound more dramatic than the reality. If you can handle a steep scramble with occasional hand-holds you'll be absolutely fine.",
        replies: [],
      },
    ],
  },
  {
    postKey: "A8",
    comments: [
      {
        author: "TentDad79",
        body: "Gillian Price's guide is the standard one, very good. For 8 days hut-to-hut a 38-45L pack is plenty. You're not carrying much if the rifugi are booked.",
        replies: [
          { author: "mtnmama", body: "Helpful, thank you. Will pick up the Gillian Price guide." },
        ],
      },
      {
        author: "elisatn",
        body: "For women's fit the Osprey Tempest works well for shorter torsos. If you're going hut-to-hut 40L is more than enough.",
        replies: [],
      },
    ],
  },
  {
    postKey: "A9",
    comments: [
      {
        author: "elisatn",
        body: "Worth doing. The Lagazuoi tunnels are genuinely impressive and the WWI history at that altitude gives them real context. Takes about an hour, bring a headlamp. The exit view from the top of Lagazuoi is one of the best moments on the whole route.",
        replies: [],
      },
      {
        author: "MJK",
        body: "Not a tourist trap. Interesting history and the view from Lagazuoi is excellent. Don't skip it.",
        replies: [
          { author: "FrankReynolds", body: "Ok sold. Adding it to the itinerary." },
        ],
      },
    ],
  },

  // ── WHW ────────────────────────────────────────────────────────────────────
  {
    postKey: "W1",
    comments: [
      {
        author: "helen",
        body: "Scottish hiker here — doable but take it seriously. 7-8 hours of daylight at most, start early every day. The Inveroran area can flood after heavy rain, worth checking water levels before that section.",
        replies: [
          { author: "sarahbc", body: "This. The route itself is fine in November, it's the logistics and day length that need planning around." },
        ],
      },
      {
        author: "mdescamps",
        body: "No midges in November though which is honestly a major bonus",
        replies: [],
      },
    ],
  },
  {
    postKey: "W2",
    comments: [
      {
        author: "helen",
        body: "It's bad in May. My honest advice: trail runners and just accept your feet will be wet by 9am. Waterproof boots stay wet longer once they flood.",
        replies: [],
      },
      {
        author: "sarahbc",
        body: "Gaiters help more than boot choice. Keep the debris out at least.",
        replies: [
          { author: "pete82",  body: "Do I need proper mountaineering gaiters or will lightweight trail ones do?" },
          { author: "sarahbc", body: "Lightweight, Dirty Girl style or similar. More than enough for that terrain." },
        ],
      },
    ],
  },
  {
    postKey: "W3",
    comments: [
      {
        author: "helen",
        body: "Bothies in May can be busy on weekends, quieter midweek. The mix you're describing is very doable. Bridge of Orchy hotel is a good mid-route shower stop if you need one.",
        replies: [],
      },
      {
        author: "david_r",
        body: "Did a similar blend. Worked well. Book the B&Bs early if you want specific nights.",
        replies: [
          { author: "claire", body: "Good tip on booking early, will do that. Thanks" },
        ],
      },
    ],
  },
  {
    postKey: "W4",
    comments: [
      {
        author: "mdescamps",
        body: "I restructured mine for this. Left Drymen at 5am. Completely worth it. Everything the photos promise.",
        replies: [],
      },
      {
        author: "helen",
        body: "It's a beautiful view. But the WHW has other quiet moments just as good — don't stress if the weather doesn't cooperate.",
        replies: [
          { author: "mdescamps", body: "Fair point. I got lucky with the weather. Not guaranteed." },
        ],
      },
    ],
  },
  {
    postKey: "W5",
    comments: [
      {
        author: "helen",
        body: "The name is way scarier than the climb. It's steady and relentless rather than technical. After a week on trail your legs will be tired but it's very manageable.",
        replies: [
          { author: "leo", body: "Good to hear. I've done worse in the Pyrenees then" },
        ],
      },
      {
        author: "david_r",
        body: "The view from the top is the best on the whole route. Worth every step.",
        replies: [],
      },
    ],
  },
  {
    postKey: "W6",
    comments: [
      {
        author: "helen",
        body: "September is getting late enough that they're dying down. Mainly a June to August problem. A head net as backup is sensible. Worst spots are around Loch Lomond and anywhere with standing water.",
        replies: [
          { author: "LonghornK", body: "Ok that's reassuring. Head net going in the bag regardless." },
        ],
      },
      {
        author: "sarahbc",
        body: "Avon Skin So Soft is the local recommendation. Sounds ridiculous but it works better than most dedicated midge repellents.",
        replies: [
          { author: "LonghornK", body: "Avon Skin So Soft 😂 ok I'll track some down" },
        ],
      },
    ],
  },
  {
    postKey: "W7",
    comments: [
      {
        author: "helen",
        body: "In May I'd call them essential. Scotland in May is relentless and a jacket alone isn't enough on the exposed sections. Get ones you can pull on without taking your boots off.",
        replies: [
          { author: "mtnmama", body: "Any recommendations?" },
          { author: "helen",   body: "Montane Minimus or similar. Light enough to forget they're there until you need them." },
        ],
      },
      {
        author: "sarahbc",
        body: "Rain pants in May in Scotland is not overkill. It's just sense.",
        replies: [],
      },
    ],
  },
  {
    postKey: "W8",
    comments: [
      {
        author: "helen",
        body: "The eastern shore of Loch Lomond is genuinely rough going. Rocky, rooty, narrow. Not technically difficult but slow and tiring in a way the rest of the route isn't. Factor in more time than the distance suggests.",
        replies: [],
      },
      {
        author: "pete82",
        body: "I was surprised by it. You're moving well all day and then suddenly you're picking your way over roots for 3 hours. Not hard, just grinds you down a bit.",
        replies: [
          { author: "FrankReynolds", body: "Good to know. Will adjust expectations for that day. Thanks." },
        ],
      },
    ],
  },
];

// ─── Post upvotes ─────────────────────────────────────────────────────────────

const POST_UPVOTES = [
  { postKey: "A3", voters: ["elisatn", "jessinthealps", "KateMendip", "mdescamps"] },
  { postKey: "T2", voters: ["pete82", "claire", "leo", "PeaksNValleys", "elisatn"] },
  { postKey: "G1", voters: ["jessinthealps", "KateMendip", "david_r", "mdescamps"] },
  { postKey: "W6", voters: ["mtnmama", "pete82", "FrankReynolds"] },
  { postKey: "A1", voters: ["jessinthealps", "david_r", "KateMendip"] },
  { postKey: "T6", voters: ["johnpdx", "mtnmama", "LonghornK", "FrankReynolds"] },
  { postKey: "G5", voters: ["helen", "KateMendip", "PeaksNValleys"] },
  { postKey: "W1", voters: ["sarahbc", "mdescamps", "pete82"] },
  { postKey: "A6", voters: ["elisatn", "LonghornK", "mdescamps", "mtnmama"] },
  { postKey: "T8", voters: ["LonghornK", "mtnmama", "johnpdx"] },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  await mongoose.connect(process.env.MONGO_URI, { dbName });

  const User      = require("../models/user");
  const Community = require("../models/community");
  const Post      = require("../models/post");
  const Comment   = require("../models/comment");
  const Upvote    = require("../models/upvote");

  // 1. Clear everything
  const [uDel, pDel, cDel, vDel] = await Promise.all([
    User.deleteMany({}),
    Post.deleteMany({}),
    Comment.deleteMany({}),
    Upvote.deleteMany({}),
  ]);
  console.log(`  🗑  Cleared ${uDel.deletedCount} users, ${pDel.deletedCount} posts, ${cDel.deletedCount} comments, ${vDel.deletedCount} upvotes\n`);

  // 2. Update community names and remove ultralight
  const communityUpdates = [
    { slug: "av1",           name: "Alta Via 1",        description: "The classic Dolomites high route — refugio tips, conditions, kit lists, and route planning." },
    { slug: "shakedown",     name: "Shakedown Request", description: "Post your shared list url, tell us the trip — the community will help you cut weight, spot gaps, and get dialled in." },
    { slug: "tmb",           name: "Tour du Mont Blanc", description: "170km around the Alps' highest peak — hut bookings, stages, gear, and trip reports." },
    { slug: "whw",           name: "West Highland Way",  description: "96 miles through the Scottish Highlands — planning, kit, conditions, and stories from the trail." },
    { slug: "treklist-help", name: "Treklist Help",      description: "Questions, feedback, and ideas for the Treklist app." },
    { slug: "gear-talk",     name: "Gear Talk",          description: "Anything kit-related — gear questions, comparisons, and what's in your pack." },
  ];
  for (const u of communityUpdates) {
    await Community.findOneAndUpdate({ slug: u.slug }, { name: u.name, description: u.description });
  }
  const ultraDel = await Community.deleteOne({ slug: "ultralight" });
  console.log(`  ✅ Communities updated${ultraDel.deletedCount ? ", ultralight removed" : ""}\n`);

  // 3. Create users
  const passwordHash = await bcrypt.hash("treklist123", 10);
  const userMap = {};
  for (const u of SEED_USERS) {
    const user = await User.create({
      email:         u.email,
      trailname:     u.trailname,
      passwordHash,
      isVerified:    true,
      isAdmin:       u.isAdmin || false,
      authProviders: [{ provider: "email" }],
    });
    userMap[u.trailname] = user;
    console.log(`  ✅ Created user: ${u.trailname}`);
  }
  console.log();

  // 4. Create posts
  const postMap = {};
  for (const [slug, posts] of Object.entries(POSTS_BY_SLUG)) {
    const community = await Community.findOne({ slug });
    if (!community) { console.log(`  ⚠️  Community not found: ${slug} — skipping`); continue; }
    for (const p of posts) {
      const ts   = postTs(p.daysAgo);
      const post = await insert(Post, {
        communityId: community._id,
        userId:      userMap[p.author]._id,
        title:       p.title,
        body:        p.body,
        createdAt:   ts,
        updatedAt:   ts,
      });
      postMap[p.key] = post;
    }
    console.log(`  ✅ ${community.name}: ${posts.length} posts`);
  }
  console.log();

  // 5. Comments and replies
  let commentTotal = 0;
  for (const thread of THREADS) {
    const post = postMap[thread.postKey];
    if (!post) { console.log(`  ⚠️  Post key not found: ${thread.postKey}`); continue; }
    let postCommentCount = 0;

    for (const c of thread.comments) {
      const commentTs = afterTs(post.createdAt, 1, 48);
      const comment   = await insert(Comment, {
        postId:    post._id,
        userId:    userMap[c.author]._id,
        body:      c.body,
        createdAt: commentTs,
        updatedAt: commentTs,
      });
      postCommentCount++;

      for (const r of (c.replies || [])) {
        const replyTs = afterTs(commentTs, 1, 12);
        await insert(Comment, {
          postId:          post._id,
          parentCommentId: comment._id,
          userId:          userMap[r.author]._id,
          body:            r.body,
          createdAt:       replyTs,
          updatedAt:       replyTs,
        });
        postCommentCount++;
      }
    }

    await Post.findByIdAndUpdate(post._id, { commentCount: postCommentCount });
    commentTotal += postCommentCount;
  }
  console.log(`  ✅ ${commentTotal} comments and replies\n`);

  // 6. Upvotes
  let upvoteTotal = 0;
  for (const u of POST_UPVOTES) {
    const post = postMap[u.postKey];
    if (!post) continue;
    let count = 0;
    for (const voter of u.voters) {
      try {
        await Upvote.create({ userId: userMap[voter]._id, targetId: post._id, targetType: "post" });
        count++;
      } catch (_) { /* skip duplicate */ }
    }
    await Post.findByIdAndUpdate(post._id, { upvoteCount: count });
    upvoteTotal += count;
  }
  console.log(`  ✅ ${upvoteTotal} upvotes\n`);

  console.log("Done.");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
