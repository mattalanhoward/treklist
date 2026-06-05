// =============================================================================
// SEED: Community content for production
// =============================================================================
//
// RUN (from server/):
//   MONGO_DB_NAME=treklist node src/scripts/seed-community-prod.js
//
// What this does:
//   - Clears all Posts, Comments, and post/comment Upvotes
//   - Does NOT touch Users — real accounts (HikerMatt, etc.) are preserved
//   - Looks up TallJoe by email (talljoe@treklist.co) — must already exist
//   - Creates / reuses the 20 seed users (seed.*.treklist.dev)
//   - Inserts all posts, comments, and upvotes
//   - Does NOT rename communities (live site already has correct names)
//
// Password for all seed users: treklist123
// =============================================================================

require("dotenv").config();
const mongoose  = require("mongoose");
const bcrypt    = require("bcrypt");
const readline  = require("readline");

// ─── Confirmation prompt ──────────────────────────────────────────────────────

const dbName = process.env.MONGO_DB_NAME || "";

async function confirm() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    console.log(`\n⚠️  This will wipe ALL posts, comments, and post/comment upvotes on "${dbName}".\n`);
    rl.question('Type "seed production" to continue: ', (answer) => {
      rl.close();
      resolve(answer.trim() === "seed production");
    });
  });
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

// ─── Seed users (TallJoe looked up by email, not created) ─────────────────────

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
      key: "H4", author: "helen", daysAgo: 3,
      title: "Is there a print or PDF export anywhere?",
      body:  "<p>Is there a way to print a list or export to PDF? I like to have a physical copy when packing.</p>",
    },
    {
      key: "H5", author: "TentDad79", daysAgo: 1,
      title: "Any plans for a mobile app?",
      body:  "<p>The mobile browser version works fine but I was thinking an app would be good idea. Any plans for a mobile app?</p>",
    },
  ],

  "gear-talk": [
    {
      key: "G3", author: "KateMendip", daysAgo: 8,
      title: "Trekking pole recommendations under £100",
      body:  "<p>I'm looking for something not too expensive for the TMB. Don't need carbon just something reliable that won't fail on a mountain. Budget around £80-100</p>",
    },
    {
      key: "G4", author: "robvdb", daysAgo: 5,
      title: "Sawyer Squeeze vs BeFree?",
      body:  "<p>Used the Sawyer Squeeze for three years no issues. I was thinking about switching to BeFree because I heard the flow rate and bag are better. Has anyone used both? Which one do you prefer?</p>",
    },
    {
      key: "G5", author: "helen", daysAgo: 3,
      title: "Down jacket in Scotland — is the wetness concern real or overblown?",
      body:  "I have an 850fp down jacket and I keep second-guessing it for Scotland. Does down actually fail in those conditions or is the synthetic recommendation just excessive caution?",
    },
    {
      key: "G6", author: "mtnmama", daysAgo: 1,
      title: "Backpack sizing for shorter frames. Any recommendations?",
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
      title: "Grand Col Ferret in late September. Is snow a real concern?",
      body:  "<p>Aiming for the last week of September. The Grand Col Ferret is the bit I'm uncertain about. Is snow on the col a serious problem by then or manageable in trail runners? Anyone done it late September recently?</p>",
    },
    {
      key: "T5", author: "leo", daysAgo: 6,
      title: "Wild camping and bivouac rules on the TMB",
      body:  "Coming from the Pyrenees where the rules above a certain altitude are pretty relaxed. I've read conflicting things about the TMB. Is wild camping genuinely possible or are the rules enforced throughout?",
    },
    {
      key: "T6", author: "johnpdx", daysAgo: 4,
      title: "First TMB next summer in 7 days, where to focus?",
      body:  "Hi all! Planning my first TMB next summer and will only have 7 days. What sections would you prioritize? I'm most interested in the scenery, I don't need to do the full loop. Which apps or resources did you use for planning? Thanks so much",
    },
    {
      key: "T7", author: "FrankReynolds", daysAgo: 2,
      title: "Group of 8, TMB September 2027. When to start booking?",
      body:  "Planning a TMB for a group of 8 for early September 2027. We want to stay in refuges. How early can I start booking and what's the minimum lead time you'd recommend? Thanks",
    },
    {
      key: "T8", author: "LonghornK", daysAgo: 1,
      title: "Is sunburn actually an issue in mid July?",
      body:  "<p>Is sunburn actually a concern at altitude in mid July? I never think about it but it keeps showing up on packing lists.</p>",
    },
  ],

  "av1": [
    {
      key: "A1", author: "jessinthealps", daysAgo: 14,
      title: "AV1 solo in early September?",
      body:  "<p>I've done solo multi-day trips before but the Dolomites look more challenging than anything I've done. Is AV1 solo in early September realistic for a confident but not elite hiker?</p>",
    },
    {
      key: "A2", author: "mdescamps", daysAgo: 12,
      title: "Hut-to-hut vs wild camping on the AV1",
      body:  "<p>The rifugios look incredible but 8 nights adds up fast. Is wild camping a realistic alternative for most of the route or do the regulations make it impractical? Would I just end up paying anyway?</p>",
    },
    {
      key: "A3", author: "MJK", daysAgo: 10,
      title: "Which section of the AV1 was the highlight for you?",
      body:  "<p>Done the full AV1 twice. The Civetta section from Coldai to Vazzoler was my favorite but curious what others say. Which day or section stuck with you most?</p>",
    },
    {
      key: "A4", author: "KateMendip", daysAgo: 8,
      title: "Trail runner advice for Dolomite terrain",
      body:  "<p>Do I need trail runners with more aggressive tread or should I wear boots?</p>",
    },
    {
      key: "A10", author: "LonghornK", daysAgo: 4,
      title: "Which is better? Southbound or Northbound?",
      body:  "For anyone who as done the trail. Which direction do you think is better and why?",
    },
    {
      key: "A6", author: "LonghornK", daysAgo: 5,
      title: "Getting excited for the Dolomites!",
      body:  "My wife and I are doing the AV1 this September. First time in the Dolomites and we cannot wait. Anyone else heading out around the same time?",
    },
    {
      key: "A7", author: "johnpdx", daysAgo: 3,
      title: "Route difficulty after Pramperet. exposure question",
      body:  "Has anyone had trouble with the section after Pramperet? Our guidebook says something like near vertical crest with exposure and I'm not great with heights. Is it as bad as it sounds?",
    },
    {
      key: "A8", author: "mtnmama", daysAgo: 2,
      title: "Backpack size and guidebook recommendations for AV1",
      body:  "<p>Hi all. Planning the AV1 for next summer. Two questions. What size pack are people taking (I'm 5'3 and usually go 40L, is that too big for hut-to-hut), and which guidebook would you recommend? Thanks</p>",
    },
    {
      key: "A9", author: "FrankReynolds", daysAgo: 1,
      title: "Are the WWI tunnels worth doing?",
      body:  "<p>Are the war tunnels on the route worth doing? I see theres a few options past rifugio Lagazoui. Which way is considered to best?</p>",
    },
  ],

  "whw": [
    {
      key: "W1", author: "sarahbc", daysAgo: 13,
      title: "WHW in November — has anyone done it?",
      body:  "Most people seem to do the WHW in summer but I'm planning a November attempt. I know what I'm getting into with the daylight and weather. What I don't know is whether sections become genuinely impassable — river crossings, ground conditions. Anyone done it late in the year?",
    },
    {
      key: "W3", author: "claire", daysAgo: 9,
      title: "Mixing wild camping, bothies and B&Bs?",
      body:  "I want a mix of wild camping, bothies, and the occasional B&amp;B for a hot shower. Anyone done a blend that worked well? Particularly wondering whether the bothies are crowded in May",
    },
    {
      key: "W4", author: "mdescamps", daysAgo: 7,
      title: "Conic Hill at sunrise?",
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
      title: "Do I need rain pants in May?",
      body:  "<p>Do you actually need them or is a good rain jacket enough for the WHW in May? Trying to figure out what's essential vs overkill</p>",
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

  // ── Treklist Help ─────────────────────────────────────────────────────────
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
    ],
  },
  {
    postKey: "H4",
    comments: [
      {
        author: "PeaksNValleys",
        body: "Even a basic print stylesheet would cover most of it honestly",
        replies: [],
      },
    ],
  },

  // ── Gear Talk ──────────────────────────────────────────────────────────────
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
          { author: "KateMendip", body: "Is the locking mechanism reliable?" },
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
        body: "CCW is standard for good reasons. Its easier on day one climbing out of Les Houches, and the Bonatti section works better from that direction.",
        replies: [],
      },
      {
        author: "david_r",
        body: "Done clockwise twice. Preferred getting the Italian side early. No strong argument against CCW.",
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
        body: "Bonatti books out fast when August dates open, usually right away. Set a reminder. Elisabetta and La Peule also book early.",
        replies: [
          { author: "mtnmama",    body: "Do you know roughly when Bonatti opens? Is there a set date?" },
          { author: "AnnaBanana", body: "There is a new centralized system that opens in mid October." },
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
        author: "AnnaBanana",
        body: "CampToCamp route log is good for recent conditions — people post updates within days of crossing.",
        replies: [
          { author: "PeaksNValleys", body: "didn't know about that, useful" },
        ],
      },
      {
        author: "elisatn",
        body: "Crossed it September 26th last year. Small amount of snow on the Italian descent, nothing that required anything beyond care going down. Mid-October is a different story.",
        replies: [],
      },
    ],
  },
  {
    postKey: "T5",
    comments: [
      {
        author: "AnnaBanana",
        body: "The rules are technically strict throughout but enforcement varies. General expectation is arrive late, leave early, leave no trace, don't camp near refuges or villages. Italy and Switzerland are stricter than France.",
        replies: [],
      },
      {
        author: "david_r",
        body: "Did a few nights wild camping on the TMB. Nothing happened but I was discreet.",
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
        body: "Check out https://traileasy.com for route planning. There are a few sample itineraries and I think you can even customize it to 7 days. Maybe you could do the whole loop then!",
        replies: [],
      },
    ],
  },
  {
    postKey: "T7",
    comments: [
      {
        author: "AnnaBanana",
        body: "For a group of 8 in September 2027 you want to book as soon as huts open reservations, typically around mid-October. Check each hut's policy on group sizes as some have a cap.",
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
        body: "Yes. And lips, people always forget the lips.",
        replies: [],
      },
    ],
  },

  // ── AV1 ────────────────────────────────────────────────────────────────────
  {
    postKey: "A10",
    comments: [
      {
        author: "TallJoe",
        body: "I've only done it N to S but I still think thats the better way. Couple reasons.\n\n- As Brendon Mackenzie mentioned - more down than up (1,000 meters). Although theres still a lot of both.\n- These types of trails, I prefer to move with the crowd instead of against it. You'll cross paths with fewer people as there are less times you'll need to step off trail to let the other one go.\n- That climb from La Pissa to Cima di Zita Sud is about 2,000 meters (6,000ft) of up in 14km (9 miles). You could split that by staying at Bianchet or even Pian de Fontana but its still pretty difficult.\n- Save the best for last - This is debatable but I felt the southern half was slightly better especially the climb up to Cima di Zita. It was a great way to end the trail. The southern section is also less crowded south of Passo Giau.",
        replies: [],
      },
      {
        author: "MJK",
        body: "The elevation profile makes it an easy call for me — N to S nets around 1,000m of descent overall. There's still plenty of climbing either way but going southbound you're working with gravity more often than against it. Makes the harder days noticeably more manageable.",
        replies: [],
      },
    ],
  },
  {
    postKey: "A1",
    comments: [
      {
        author: "elisatn",
        body: "Completely doable solo in September. The route is well marked, the rifugi staff are welcoming and used to solo hikers. A few exposed bits above 2500m need attention but nothing technical. No via ferrata equipment is needed.",
        replies: [
          { author: "jessinthealps", body: "Thanks! That's really reassuring. I think I was imagining it more remote than it is." },
        ],
      },
      {
        author: "david_r",
        body: "Solo in September is fine. If there is inclement weather let the rifugio staff know your next destination each morning and give the next rifugio a heads up if you are running late.",
        replies: [],
      },
    ],
  },
  {
    postKey: "A2",
    comments: [
      {
        author: "elisatn",
        body: "Technically you aren't allowed to wild camp but I did see tents every now and then along the route. Most people who try it end up paying for at least half the nights anyway. The rifugios are also very social and a big part of the experience.",
        replies: [
          { author: "mdescamps", body: "That's kind of what I suspected. Probably just go full hut-to-hut and stop agonising over it." },
        ],
      },
      {
        author: "MJK",
        body: "I did it hut-to-hut. Cost was high but the rifugio's food and company in the evenings were genuinely part of the trip. Don't skip them.",
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
        body: "I'd go with something more aggressive than a standard trail runner.",
        replies: [],
      },
      {
        author: "jessinthealps",
        body: "I usually wear Hoka Speedgoats. I prefer a much lighter, trail runner than a boot as I tend to do long days and they are softer on my feet.",
        replies: [
          { author: "KateMendip",    body: "I've heard really good things about the speedgoats." },
          { author: "jessinthealps", body: "I love them! I also see a lot of people wearing Topos and Altras but I don't have much experience with them." },
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
        body: "I know that section well. It's steep and exposed but not technical climbing. Take your time, don't look down unnecessarily, and you'll be fine. Most people find it less scary than the description suggests. It reality its probably 6 feet wide. So not really that scary.",
        replies: [
          { author: "johnpdx", body: "That's really reassuring. I can handle steep it was the near vertical wording that worried me." },
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
        body: "Gillian Price's guide is the standard one, very good. For 8 days hut-to-hut a 38-45L pack is plenty. You're not carrying much if the rifugios are booked.",
        replies: [
          { author: "mtnmama", body: "Helpful, thank you. Will pick up the Gillian Price guide." },
        ],
      },
      {
        author: "elisatn",
        body: "For women's fit the Osprey Tempest works well for shorter torsos. There is a small/medium and a large/xl version. If you're going hut-to-hut 40L is more than enough. I'd probably go with something closer to 30.",
        replies: [],
      },
    ],
  },
  {
    postKey: "A9",
    comments: [
      {
        author: "elisatn",
        body: "Worth doing. The Lagazuoi tunnels are genuinely impressive and the WWI history at that altitude gives them real context. Takes about an hour, bring a headlamp as its pitch black with the exception of a few overlooks.",
        replies: [],
      },
      {
        author: "MJK",
        body: "Interesting history and the view from Lagazuoi is excellent. Adds a little variety to the trek and is a unique experience for sure. Don't skip it.",
        replies: [
          { author: "FrankReynolds", body: "Ok thanks!. Adding it to the itinerary." },
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
        replies: [],
      },
      {
        author: "mdescamps",
        body: "No midges in November though which is honestly a major bonus",
        replies: [],
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
        author: "helen",
        body: "It's a beautiful view. But the WHW has other quiet moments just as good. Don't stress if the weather doesn't cooperate.",
        replies: [],
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
        author: "sarahbc",
        body: "Avon Skin So Soft is the local recommendation. Sounds ridiculous but it works well. You can also pick up some Smidge in Milngavie or Glasgow. Its supposed to be really good. Oh and you'll definitely want a head net!",
        replies: [
          { author: "LonghornK", body: "Smidge! 😂 ok I'll track some down. Thanks!" },
        ],
      },
      {
        author: "helen",
        body: "September is getting late enough that they're dying down. Mainly a June to August problem. A head net as backup is sensible. Worst spots are around Loch Lomond and anywhere with standing water.",
        replies: [
          { author: "LonghornK", body: "Ok that's reassuring. Head net going in the bag regardless." },
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
        author: "pete82",
        body: "I was surprised by it. You're moving well all day and then suddenly you're picking your way over roots and boulders for a large chunk of the day. Not hard, just grinds you down a bit.",
        replies: [
          { author: "FrankReynolds", body: "Good to know. Will adjust expectations for that day. Thanks." },
        ],
      },
      {
        author: "helen",
        body: "The eastern shore of Loch Lomond is genuinely rough going. Rocky, rooty, narrow. Not technically difficult but slow and tiring in a way the rest of the route isn't. Factor in more time than the distance suggests.",
        replies: [],
      },
    ],
  },
];

// ─── Post upvotes ─────────────────────────────────────────────────────────────

const POST_UPVOTES = [
  { postKey: "A3", voters: ["elisatn", "jessinthealps", "KateMendip", "mdescamps"] },
  { postKey: "T2", voters: ["pete82", "claire", "leo", "PeaksNValleys", "elisatn"] },
  { postKey: "G5", voters: ["helen", "KateMendip", "PeaksNValleys"] },
  { postKey: "W6", voters: ["mtnmama", "pete82", "FrankReynolds"] },
  { postKey: "A1", voters: ["jessinthealps", "david_r", "KateMendip"] },
  { postKey: "T6", voters: ["johnpdx", "mtnmama", "LonghornK", "FrankReynolds"] },
  { postKey: "W1", voters: ["sarahbc", "mdescamps", "pete82"] },
  { postKey: "A6", voters: ["elisatn", "LonghornK", "mdescamps", "mtnmama"] },
  { postKey: "T8", voters: ["LonghornK", "mtnmama", "johnpdx"] },
  { postKey: "A4", voters: ["KateMendip", "jessinthealps", "mdescamps"] },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  if (!dbName) {
    console.error("❌  MONGO_DB_NAME is not set. Aborting.");
    process.exit(1);
  }

  const ok = await confirm();
  if (!ok) {
    console.log("Aborted.");
    process.exit(0);
  }

  await mongoose.connect(process.env.MONGO_URI, { dbName });

  const User      = require("../models/user");
  const Community = require("../models/community");
  const Post      = require("../models/post");
  const Comment   = require("../models/comment");
  const Upvote    = require("../models/upvote");

  // 1. Clear posts, comments, and post/comment upvotes only — never users
  const [pDel, cDel, vDel] = await Promise.all([
    Post.deleteMany({}),
    Comment.deleteMany({}),
    Upvote.deleteMany({ targetType: { $in: ["post", "comment"] } }),
  ]);
  console.log(`\n  🗑  Cleared ${pDel.deletedCount} posts, ${cDel.deletedCount} comments, ${vDel.deletedCount} upvotes\n`);

  // 2. Build user map — look up TallJoe, create or reuse the 20 seed users
  const passwordHash = await bcrypt.hash("treklist123", 10);
  const userMap = {};

  const tallJoe = await User.findOne({ email: "talljoe@treklist.co" }).lean();
  if (!tallJoe) {
    console.error("❌  TallJoe (talljoe@treklist.co) not found in database. Aborting.");
    await mongoose.disconnect();
    process.exit(1);
  }
  userMap["TallJoe"] = tallJoe;
  console.log("  ✅ Found TallJoe");

  for (const u of SEED_USERS) {
    let user = await User.findOne({ email: u.email }).lean();
    if (!user) {
      user = await User.create({
        email:         u.email,
        trailname:     u.trailname,
        passwordHash,
        isVerified:    true,
        isAdmin:       false,
        authProviders: [{ provider: "email" }],
      });
      console.log(`  ✅ Created user: ${u.trailname}`);
    } else {
      console.log(`  ↩️  Reused user: ${u.trailname}`);
    }
    userMap[u.trailname] = user;
  }
  console.log();

  // 3. Create posts
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

  // 4. Comments and replies
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

  // 5. Upvotes
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
