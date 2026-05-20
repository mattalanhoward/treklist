// =============================================================================
// SEED: Sample forum users and posts
// =============================================================================
//
// RUN:
//   cd server
//   node src/scripts/seed-forum.js
//
// Safe to re-run — skips existing users/posts by email/title+community.
// Password for all seed users: treklist123
// =============================================================================

require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const SEED_USERS = [
  { trailname: "AlpineAndy",    email: "seed.andy@treklist.dev" },
  { trailname: "GramWeenie",    email: "seed.gram@treklist.dev" },
  { trailname: "BlistersAndAll",email: "seed.blisters@treklist.dev" },
  { trailname: "MossyRock",     email: "seed.mossy@treklist.dev" },
  { trailname: "TrailSister",   email: "seed.sister@treklist.dev" },
  { trailname: "ULConvert",     email: "seed.ul@treklist.dev" },
  { trailname: "HutHopper",     email: "seed.hut@treklist.dev" },
];

const POSTS_BY_SLUG = {
  "treklist-help": [
    {
      title: "How do I share my gear list publicly?",
      body: "I want to send my TMB kit list to a friend who doesn't have an account. Is there a share link somewhere? I looked in the settings but couldn't find it.",
    },
    {
      title: "Can I copy a list and use it as a template?",
      body: "I have a summer list I want to duplicate for winter with a few changes. Is copy/paste possible or do I have to build from scratch?",
    },
    {
      title: "Weight unit keeps resetting to grams",
      body: "I set it to oz in my account settings but every time I come back it's back to grams. Tried on Chrome and Safari, same issue.",
    },
    {
      title: "Feature request: shareable packing checklists",
      body: "Would love to be able to export a checklist view to PDF or print it. Right now I screenshot the list which isn't ideal.",
    },
    {
      title: "Is there a mobile app planned?",
      body: "The site works well on mobile browser but a native app with offline access would be great for in-the-field use. Any plans?",
    },
  ],
  "shakedown": [
    {
      title: "First overnighter in new kit — what broke down",
      body: "Did a quick one-nighter last weekend specifically to stress test my new setup. The Zpacks Arc Haul fits great but my Sea to Summit pillow deflated overnight. Anyone else had that issue?",
    },
    {
      title: "Wore my trail runners on a shakedown — they're a no",
      body: "Altras felt great in the shop but 12 miles in I had hot spots on both pinky toes. Back to my Hokas. Annoying but better to know before the TMB.",
    },
    {
      title: "Rain gear test in actual rain — finally",
      body: "We've had nothing but sun here for months so I couldn't test my new Montane jacket properly. Finally got a proper wet day. Seams held, pit zips work great, no complaints.",
    },
    {
      title: "Stove shakedown: alcohol vs canister",
      body: "Switched from canister to an alcohol stove for a weekend trip. Boil times were longer than expected in cold temps but the weight savings are real. I'm sticking with it.",
    },
    {
      title: "Shelter shakedown — inner tent condensation issue",
      body: "My Durston X-Mid had serious condensation on the inner on a cold night. Pitched it low due to wind. Is this a pitch issue or a ventilation problem? Looking for advice.",
    },
  ],
  "gear-talk": [
    {
      title: "Zpacks vs Gossamer Gear — which pack for a 10-day trip?",
      body: "Coming from a 65L traditional pack. Looking at the Arc Haul Ultra 60 vs the Mariposa 60. Carrying about 9kg base. Anyone done extended trips with either?",
    },
    {
      title: "Quilt vs sleeping bag for shoulder season in the Alps",
      body: "Convinced by the quilt crowd for summer but wondering if a quilt makes sense for TMB in late September when temps drop to 2-5°C at night. Using a 20°F Enlightened Equipment currently.",
    },
    {
      title: "Best trekking poles under £100",
      body: "My Black Diamond Trails snapped on the last trip. Looking for a replacement. Don't need carbon, just something reliable. Any suggestions?",
    },
    {
      title: "Water filter — Sawyer Squeeze vs BeFree",
      body: "I've always used the Sawyer but my hiking partner swears by the BeFree for the flow rate. Anyone switched and regretted it or not?",
    },
    {
      title: "Down vs synthetic insulation for damp climates",
      body: "Planning the WHW and Scotland is notoriously wet. I have a 850FP down jacket but wondering if I should switch to synthetic. Real-world experience appreciated.",
    },
  ],
  "ultralight": [
    {
      title: "Finally broke 5kg base weight — here's what I cut",
      body: "After two years of gradual swaps I hit 4.8kg base last month. The biggest wins were shelter (moved to Durston X-Mid), sleep system (Katabatic Palisade quilt), and ditching a dedicated rain jacket for a wind shirt in summer. Happy to share the full list.",
    },
    {
      title: "The 'ultralight tax' is real — how do you justify the cost?",
      body: "I added up what I've spent getting to a UL kit over 3 years. It's significant. For those who've done the journey — do you feel it's been worth it in terms of enjoyment on trail?",
    },
    {
      title: "Anyone going stoveless for multi-day trips?",
      body: "I dropped my stove for a recent trip and ate cold soaks only. Lost 300g and honestly didn't miss hot food as much as I expected. Curious if others have gone fully stoveless.",
    },
    {
      title: "What's your \"luxury\" item that breaks the UL rules?",
      body: "Mine is a real pillow (Sea to Summit Aeros Ultralight, 67g). I've tried stuff sacks and clothing bundles and I just sleep better with it. What's your guilty gram?",
    },
    {
      title: "Tarp vs single-wall tent for UL — which do you use?",
      body: "I've been using a Zpacks Plex Solo single-wall and loving the weight but the condensation can be rough. Considering a tarp setup. What's your shelter strategy and why?",
    },
  ],
  "tmb": [
    {
      title: "Clockwise or counter-clockwise — which direction did you prefer?",
      body: "Doing the TMB in August. Most people seem to go counter-clockwise but I've heard clockwise gives better views of Mont Blanc earlier in the trip. Any strong opinions?",
    },
    {
      title: "Refuge booking strategy — 2025",
      body: "How far in advance are people booking refuges for August? I've heard the Bonatti in particular fills up months ahead. Staying flexible vs booking everything — what's your approach?",
    },
    {
      title: "Kit list check — what am I missing?",
      body: "Pack weight is sitting around 8.5kg with 3 days food and 1L water. Main items: Osprey Exos 48, Zpacks Plex tent, Thermarest NeoAir XLite, down jacket, rain jacket, merino base layer. Anything obviously missing for late July?",
    },
    {
      title: "Grand Col Ferret conditions in late September",
      body: "Anyone crossed the Grand Col Ferret in late September recently? Wondering if snow on the col is a serious concern or manageable with just trail runners.",
    },
    {
      title: "Budget tips — self-catering vs refuges",
      body: "The full refuge route is going to cost me a fortune. Anyone done a mix of bivouacs and refuges to keep costs down? Where are wild camping rules most relaxed?",
    },
  ],
  "av1": [
    {
      title: "AV1 solo — is it a realistic option?",
      body: "Planning to do AV1 solo in early September. I've done multi-day trips solo before but never a route this remote. Any solo hikers with experience on this specific trail?",
    },
    {
      title: "Hut-to-hut vs tenting on the AV1",
      body: "The huts on the AV1 look incredible but the cost adds up fast. Is wild camping genuinely feasible or do the regulations make it impractical? What did people actually do?",
    },
    {
      title: "Best section of the AV1?",
      body: "Doing the full route but curious which sections people found most memorable. I keep hearing the Forcella della Marmolada area is the highlight — agree?",
    },
    {
      title: "Trail runner recommendation for rocky Dolomite terrain",
      body: "Most of my hiking has been on softer ground. The Dolomite rock looks technical in places. Should I size up on tread/lugs or is a standard trail runner fine?",
    },
    {
      title: "What's the resupply situation like?",
      body: "Planning an 8-day itinerary. How are the huts for resupply? Can I top up snacks and fuel along the way or do I need to carry everything from the start?",
    },
  ],
  "whw": [
    {
      title: "West Highland Way in November — thoughts?",
      body: "Most people seem to do the WHW in summer but I'm keen on an off-season attempt in November. I know it'll be tough — shorter days, wet, cold. Anyone done it in late autumn?",
    },
    {
      title: "Rannoch Moor — how bad is the bog in spring?",
      body: "Doing the WHW in May. I've heard Rannoch Moor can be brutal in spring with the wet. Should I go waterproof boots or accept wet feet in trail runners?",
    },
    {
      title: "Accommodation strategy — bothies vs B&Bs vs tent",
      body: "I want a mix of wild camping and bothies to keep costs low, but also a hot shower now and then. What worked well for people as a blend?",
    },
    {
      title: "Conic Hill at sunrise — worth the timing effort?",
      body: "I've seen photos of Conic Hill with Loch Lomond below at sunrise and it looks stunning. Anyone structured their itinerary to hit it at the right time?",
    },
    {
      title: "What to expect on the Devil's Staircase",
      body: "Heard a lot about the Devil's Staircase section near Glencoe. Is it as tough as the name suggests or is the reputation overblown? Planning to cross it on day 6.",
    },
  ],
};

async function run() {
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MONGO_DB_NAME,
  });

  const User = require("../models/user");
  const Community = require("../models/community");
  const Post = require("../models/post");

  const passwordHash = await bcrypt.hash("treklist123", 10);

  // Upsert seed users
  const userMap = {};
  for (const u of SEED_USERS) {
    let user = await User.findOne({ email: u.email });
    if (!user) {
      user = await User.create({
        email: u.email,
        trailname: u.trailname,
        passwordHash,
        isVerified: true,
        authProviders: [{ provider: "email" }],
      });
      console.log(`  ✅ Created user: ${u.trailname}`);
    } else {
      console.log(`  ↩  Exists user: ${u.trailname}`);
    }
    userMap[u.trailname] = user;
  }

  const users = Object.values(userMap);

  // Seed posts per community
  for (const [slug, posts] of Object.entries(POSTS_BY_SLUG)) {
    const community = await Community.findOne({ slug });
    if (!community) {
      console.log(`  ⚠️  Community not found: ${slug} — skipping`);
      continue;
    }

    let created = 0;
    for (let i = 0; i < posts.length; i++) {
      const p = posts[i];
      const existing = await Post.findOne({ communityId: community._id, title: p.title });
      if (existing) continue;

      const author = users[i % users.length];
      await Post.create({
        communityId: community._id,
        userId: author._id,
        title: p.title,
        body: p.body || "",
        url: p.url || "",
      });
      created++;
    }
    console.log(`  ✅ ${community.name}: ${created} posts created`);
  }

  console.log("\nDone.");
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
