/**
 * create-mec-apparel.js — MEC Label apparel (companion to create-mec.js).
 * Same constraints: Cloudflare-walled, no feed → every spec + hero image was
 * gathered by WebFetch off each PDP (BigCommerce store s-xw5rh7060c), after
 * Google/listing enumeration of the brand /clothing pages.
 *
 * SCOPE (user: "all of these clothes", 2026-07-19): the full MEC-brand apparel
 * line the user pasted — base layers, hiking pants/shorts, rain + softshell shells,
 * insulated jackets/vests, tees — INCLUDING lifestyle pieces (Mica Joggers, Anywear,
 * Classic Modern Rad). Skip youth (zero-kids rule). Already-imported via create-mec.js
 * (skip): Synergy Gore-Tex M, Northern Light Hoodie M/W.
 *
 * WEIGHTS: MEC apparel PDPs mostly publish FABRIC gsm, not garment grams, and the
 * scrape often conflated the two — so weightGrams is set ONLY where a real, distinct
 * GARMENT weight was published (jackets/rain/some pants). Everything else ships
 * weightless (matches the Smartwool/Icebreaker apparel precedent). Base layers = gsm
 * only → weightless; their weight-tier is derived from the T0/T1/T2/T3 name.
 *
 * VARIANTS: Size axis (gendered default range), no per-size weights (not published).
 * Color dropped. Offers = direct/unmonetized `merchantId:"direct-mec"`.
 *
 *   node src/scripts/create-mec-apparel.js [--commit]
 *
 * NOTE: ~15-20 more pasted items could not be URL-resolved from the listing (likely
 * out-of-stock / deep pages) — tracked in memory [[mec-import]] for a follow-up pass.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const COMMIT = process.argv.includes("--commit");
if (COMMIT && process.env.MONGO_DB_NAME !== "treklist_local") {
  console.error("local only");
  process.exit(1);
}
const ADMIN_ID = "69565d7c3480c2216f915a36";
const { categoryForItemType } = require("../config/inferItemType");
const CDN = "https://cdn11.bigcommerce.com/s-xw5rh7060c/";
const SZ_W = ["X-Small", "Small", "Medium", "Large", "X-Large", "XX-Large"];
const SZ_M = ["Small", "Medium", "Large", "X-Large", "XX-Large"];

// id, name, type, gender, weight (garment g or null), img suffix, + type extras
const ITEMS = [
  // ---- BASE LAYERS (weightless; tier from T#, fabric Merino/Synthetic) ----
  ["6018-171","MEC T3 Merino Base Layer Bottoms - Men's","Base Layer Bottom","Mens",null,"products/49223/images/434307/6018171_BK000_TRANSPARENT__27636.1781638779.1280.1280.png",{tier:"Expedition",fabric:"Merino Wool",gsm:230}],
  ["6018-168","MEC T2 Base Layer Bottoms - Men's","Base Layer Bottom","Mens",null,"products/49203/images/434211/6018168_BK000_TRANSPARENT__49873.1781638776.1280.1280.png",{tier:"Midweight",fabric:"Synthetic",gsm:190}],
  ["6019-342","MEC T2 Merino Base Layer Bottoms - Men's","Base Layer Bottom","Mens",null,"products/49204/images/434214/6019342_BK000_TRANSPARENT__28802.1781638776.1280.1280.png",{tier:"Midweight",fabric:"Merino Wool",gsm:180}],
  ["6017-379","MEC T3 Merino Base Layer Bottoms - Women's","Base Layer Bottom","Womens",null,"products/49191/images/434147/6017379_BK000_TRANSPARENT__65444.1781638774.1280.1280.png",{tier:"Expedition",fabric:"Merino Wool",gsm:230}],
  ["6019-344","MEC T0 Base Layer Bottoms - Men's","Base Layer Bottom","Mens",null,"products/49276/images/434365/6019344_BK000_TRANSPARENT__00475.1781638781.1280.1280.png",{tier:"Lightweight",fabric:"Synthetic",gsm:110}],
  ["6019-330","MEC T0 Base Layer Bottoms - Women's","Base Layer Bottom","Womens",null,"products/49255/images/434348/6019330_NVY13_TRANSPARENT__17703.1781638780.1280.1280.png",{tier:"Lightweight",fabric:"Synthetic",gsm:110}],
  ["6018-012","MEC T3 Base Layer Zip Neck - Women's","Base Layer Top","Womens",null,"products/49220/images/434302/6018012_BK000_TRANSPARENT__45555.1781638779.1280.1280.png",{tier:"Expedition",fabric:"Synthetic",sleeve:"Long Sleeve",neck:"Quarter-Zip",gsm:240}],
  ["6018-177","MEC T3 Base Layer 1/4 Zip Long Sleeve Top - Men's","Base Layer Top","Mens",null,"products/49429/images/434570/6018177_BK000_TRANSPARENT__11018.1781638787.1280.1280.png",{tier:"Expedition",fabric:"Synthetic",sleeve:"Long Sleeve",neck:"Quarter-Zip",gsm:240}],
  ["6018-176","MEC T2 Base Layer 1/4 Zip Long Sleeve Top - Men's","Base Layer Top","Mens",null,"products/49212/images/434258/6018176_BRY16_TRANSPARENT__36212.1781638778.1280.1280.png",{tier:"Midweight",fabric:"Synthetic",sleeve:"Long Sleeve",neck:"Quarter-Zip"}],
  ["6019-329","MEC T0 Base Layer Long Sleeve Top - Women's","Base Layer Top","Womens",null,"products/49213/images/434266/6019329_NVY13_TRANSPARENT__73579.1783108830.1280.1280.png",{tier:"Lightweight",fabric:"Synthetic",sleeve:"Long Sleeve",gsm:110}],
  ["6019-347","MEC T0 Base Layer Short Sleeve Top - Men's","Base Layer Top","Mens",null,"products/49208/images/434231/6019347_BK000_TRANSPARENT__53977.1781638777.1280.1280.png",{tier:"Lightweight",fabric:"Synthetic",sleeve:"Short Sleeve"}],
  ["6019-343","MEC T2 Merino Base Layer Long Sleeve Top - Men's","Base Layer Top","Mens",null,"products/49200/images/434200/6019343_BK000_TRANSPARENT__91994.1781638776.1280.1280.png",{tier:"Midweight",fabric:"Merino Wool",sleeve:"Long Sleeve",gsm:180}],
  ["6018-175","MEC T3 Merino Base Layer Long Sleeve Top - Men's","Base Layer Top","Mens",null,"products/49210/images/434235/6018175_NVY13_TRANSPARENT__55812.1783703707.1280.1280.png",{tier:"Expedition",fabric:"Merino Wool",sleeve:"Long Sleeve"}],
  ["6018-172","MEC T3 Merino Base Layer 1/4 Zip Long Sleeve Top - Men's","Base Layer Top","Mens",null,"products/49182/images/434110/6018172_BK000_TRANSPARENT__59014.1781638773.1280.1280.png",{tier:"Expedition",fabric:"Merino Wool",sleeve:"Long Sleeve",neck:"Quarter-Zip",gsm:230}],
  ["6017-378","MEC T3 Merino Base Layer 1/4 Zip Long Sleeve Top - Women's","Base Layer Top","Womens",null,"products/49211/images/434252/6017378_BK000_TRANSPARENT__64195.1781638778.1280.1280.png",{tier:"Expedition",fabric:"Merino Wool",sleeve:"Long Sleeve",neck:"Quarter-Zip"}],
  ["6028-742","MEC T1 Merino Base Layer Long Sleeve Top - Men's","Base Layer Top","Mens",null,"products/57854/images/447421/6028742_BK000_TRANSPARENT__87506.1781639063.1280.1280.png",{tier:"Lightweight",fabric:"Merino Wool",sleeve:"Long Sleeve"}],
  ["6028-792","MEC T1 Merino Base Layer Long Sleeve Top - Women's","Base Layer Top","Womens",null,"products/57832/images/447366/6028792_NVY13_TRANSPARENT__88199.1783703640.1280.1280.png",{tier:"Lightweight",fabric:"Merino Wool",sleeve:"Long Sleeve",gsm:130}],
  ["6023-136","MEC T2 Merino Base Layer 1/4 Zip Long Sleeve Top - Women's","Base Layer Top","Womens",null,"products/52322/images/439306/6023136_BK000_TRANSPARENT__30340.1781638889.1280.1280.png",{tier:"Midweight",fabric:"Merino Wool",sleeve:"Long Sleeve",neck:"Quarter-Zip"}],
  ["6017-383","MEC T2 Base Layer Long Sleeve Top - Women's","Base Layer Top","Womens",null,"products/49185/images/434128/6017383_BK000_TRANSPARENT__08201.1781638774.1280.1280.png",{tier:"Midweight",fabric:"Synthetic",sleeve:"Long Sleeve"}],

  // ---- HIKING PANTS ----
  ["6031-432","MEC Mochilero Stretch Pants - Men's","Hiking Pants","Mens",370,"products/59150/images/449384/6031432_BK000_TRANSPARENT__63811.1781639106.1280.1280.png",{material:"96% nylon / 4% spandex"}],
  ["6033-926","MEC Borderland Pants - Men's","Hiking Pants","Mens",342,"products/62415/images/460853/6033926_BK000_TRANSPARENT__28648.1781639340.1280.1280.png",{material:"90% recycled nylon / 10% spandex, PFAS-free DWR"}],
  ["6034-083","MEC Borderland Pants - Women's","Hiking Pants","Womens",336,"products/62024/images/459526/6034083_BK000_TRANSPARENT__38023.1781639313.1280.1280.png",{material:"90% recycled nylon / 10% spandex"}],
  ["6023-785","MEC Ridgewalk Pants - Men's","Hiking Pants","Mens",270,"products/50828/images/436465/6023785_BK000_TRANSPARENT__54600.1781638827.1280.1280.png",{material:"nylon / spandex"}],
  ["6026-495","MEC Wanderwall Pants - Women's","Hiking Pants","Womens",null,"products/54686/images/441725/6026495_BK000_TRANSPARENT__04556.1781638943.1280.1280.png",{material:"61% recycled nylon / 33% nylon / 6% spandex"}],
  ["6026-398","MEC Tech Pants - Women's","Hiking Pants","Womens",null,"products/54727/images/441788/6026398_BK000_TRANSPARENT__00117.1781638944.1280.1280.png",{material:"nylon / spandex, DWR"}],
  ["6038-536","MEC Tech Pants - Men's","Hiking Pants","Mens",null,"products/65566/images/472616/6038536_BK000_TRANSPARENT__61684.1781639579.1280.1280.png",{material:"94% nylon / 6% spandex, DWR"}],
  ["6026-396","MEC Ridgewalk Pants - Women's","Hiking Pants","Womens",null,"products/54647/images/441684/6026396_BK000_TRANSPARENT__88206.1781638942.1280.1280.png",{material:"nylon / spandex"}],
  ["6031-514","MEC Ridgewalk Capri - Women's","Hiking Pants","Womens",null,"products/59325/images/449782/6031514_BK000_TRANSPARENT__50472.1781639115.1280.1280.png",{material:"84% nylon / 16% spandex"}],
  ["6000-527","MEC Mochilero Cargo Pants - Men's","Hiking Pants","Mens",null,"products/7804/images/419542/6000527_IRN11_TRANSPARENT__29601.1781638456.1280.1280.png",{material:"96% nylon / 4% spandex"}],
  ["6031-504","MEC Anywear Pants - Women's","Hiking Pants","Womens",null,"products/59408/images/449979/6031504_BK000_TRANSPARENT__74216.1781639120.1280.1280.png",{material:"100% polyester, UPF 50+"}],
  ["6033-927","MEC Classic Modern Rad Pants - Men's","Hiking Pants","Mens",null,"products/62689/images/461931/6033927_BK000_TRANSPARENT__81662.1781639361.1280.1280.png",{material:"96% recycled nylon / 4% spandex, PFAS-free DWR"}],
  ["6033-930","MEC Classic Modern Rad Pants - Women's","Hiking Pants","Womens",370,"products/61986/images/459381/6033930_AGT00_TRANSPARENT__01655.1781639310.1280.1280.png",{material:"96% recycled nylon / 4% spandex"}],
  ["6028-955","MEC Mica Joggers - Men's","Hiking Pants","Mens",310,"products/56064/images/413625/6028955_BK000_TRANSPARENT__70647.1781093172.1280.1280.png",{material:"61% recycled nylon / 33% nylon / 6% spandex, DWR"}],

  // ---- HIKING SHORTS ----
  ["6031-428","MEC Mochilero 12\" Shorts - Men's","Hiking Shorts","Mens",null,"products/59329/images/449791/6031428_BK000_TRANSPARENT__57601.1781639116.1280.1280.png",{material:"96% nylon / 4% spandex, UPF 40-50+"}],
  ["6026-395","MEC Gorp Shorts - Women's","Hiking Shorts","Womens",118,"products/54610/images/441631/6026395_OFC40_TRANSPARENT__86105.1781638941.1280.1280.png",{material:"100% recycled nylon"}],
  ["6000-434","MEC Terrena Stretch 5\" Shorts - Women's","Hiking Shorts","Womens",null,"products/7905/images/408217/6000434_BK000_TRANSPARENT__79465.1780589157.1280.1280.png",{material:"96% nylon / 4% spandex, DWR, UPF 50+",inseam:5}],
  ["6000-433","MEC Terrena Stretch 12\" Shorts - Women's","Hiking Shorts","Womens",null,"products/7903/images/419605/6000433_BK000_TRANSPARENT__36865.1781638458.1280.1280.png",{material:"nylon / spandex"}],
  ["6020-355","MEC Ridgewalk Shorts - Men's","Hiking Shorts","Mens",null,"products/50783/images/436404/6020355_BK000_TRANSPARENT__52497.1781638826.1280.1280.png",{material:"nylon / spandex"}],
  ["6031-515","MEC Ridgewalk Shorts - Women's","Hiking Shorts","Womens",null,"products/59670/images/451622/6031515_BK000_TRANSPARENT__95456.1781639155.1280.1280.png",{material:"nylon / spandex"}],
  ["6020-532","MEC Tech Trail Short 4\" - Women's","Hiking Shorts","Womens",null,"products/50835/images/436482/6020532_BK000_TRANSPARENT__65055.1781638828.1280.1280.png",{material:"nylon / spandex",inseam:4}],
  ["6038-541","MEC Tech Trail 6 in Shorts - Men's","Hiking Shorts","Mens",null,"products/65577/images/472702/6038541_BK000_TRANSPARENT__98291.1781639581.1280.1280.png",{material:"94% nylon / 6% spandex, PFAS-free DWR, UPF 50+",inseam:6}],
  ["6026-401","MEC Wanderwall Shorts - Women's","Hiking Shorts","Womens",null,"products/55027/images/442240/6026401_BK000_TRANSPARENT__90593.1781638954.1280.1280.png",{material:"61% recycled nylon / 33% nylon / 6% spandex"}],

  // ---- RAIN JACKETS / PANTS ----
  ["6028-812","MEC x AQUANATOR Rain Jacket - Women's","Rain Jacket","Womens",null,"products/56211/images/445065/6028812_BK000_TRANSPARENT__50671.1781639013.1280.1280.png",{layer:"2.5-Layer",wp:20000,pitZips:false,pockets:2,packable:true,pfasFree:true}],
  ["6028-759","MEC x AQUANATOR Rain Jacket - Men's","Rain Jacket","Mens",354,"products/56214/images/445085/6028759_BK000_TRANSPARENT__08154.1781639014.1280.1280.png",{layer:"2.5-Layer",wp:20000,pitZips:false,pockets:2,packable:true,pfasFree:true}],
  ["6028-758","MEC x AQUANATOR Long Rain Jacket - Women's","Rain Jacket","Womens",null,"products/56206/images/445057/6028758_BK000_TRANSPARENT__84439.1781639013.1280.1280.png",{layer:"2.5-Layer",wp:20000,pitZips:false,pockets:2,packable:true,pfasFree:true}],
  ["6033-851","MEC Aquacycle Rain Jacket - Women's","Rain Jacket","Womens",null,"products/64902/images/469793/6033851_BK000_TRANSPARENT__10653.1781639522.1280.1280.png",{layer:"2.5-Layer",wp:20000,pitZips:false,pockets:2,packable:true}],
  ["6033-849","MEC Aquacycle Rain Jacket - Men's","Rain Jacket","Mens",102,"products/64901/images/469799/6033849_BK000_TRANSPARENT__83906.1781639522.1280.1280.png",{layer:"2.5-Layer",wp:20000,pitZips:false,pockets:2,packable:true}],
  ["6028-816","MEC x AQUANATOR Rain Pants - Women's","Rain Pants","Womens",180,"products/56204/images/414177/6028816_BK000_TRANSPARENT__10548.1781093430.1280.1280.png",{layer:"2.5-Layer",wp:20000,packable:true,pfasFree:true}],
  ["6028-760","MEC x AQUANATOR Rain Pants - Men's","Rain Pants","Mens",204,"products/56209/images/414176/6028760_BK000_TRANSPARENT__24233.1781093430.1280.1280.png",{layer:"2.5-Layer",wp:20000,packable:true,pfasFree:true,membrane:"VarioShell"}],
  ["6020-753","MEC Hydrofoil Stretch Pants - Men's","Rain Pants","Mens",431,"products/51561/images/491959/6020753_BK000_TRANSPARENT__63277.1783703913.1280.1280.png",{layer:"2.5-Layer",membrane:"Pertex Shield"}],

  // ---- SOFTSHELL ----
  ["6020-751","MEC Hydrofoil Stretch Jacket - Men's","Softshell Jacket","Mens",353,"products/51560/images/438088/6020751_BK000_TRANSPARENT__35941.1781638864.1280.1280.png",{material:"50D nylon, 2.5-layer Pertex Shield",wr:true,windR:true,stretch:true,packable:true}],

  // ---- INSULATED ----
  ["6015-540","MEC Boundary Light Down Jacket - Men's","Insulated Jacket","Mens",385,"products/49176/images/434083/6015540_BK000_TRANSPARENT__68686.1781638772.1280.1280.png",{insulation:"Down",fillPower:700,fillWeightG:100,hood:"No Hood",pockets:3,packable:true}],
  ["6028-809","MEC Northern Light Vest - Men's","Insulated Jacket","Mens",284,"products/55811/images/444184/6028809_BK000_TRANSPARENT__99800.1781638995.1280.1280.png",{insulation:"Synthetic",synthName:"EcoSoft (recycled)",gsm:60,hood:"No Hood",pockets:3,packable:true,vest:true}],

  // ---- HIKING SHIRTS / TEES ----
  ["6026-610","MEC All Day Merino Short Sleeve T-Shirt - Men's","Hiking Shirt","Mens",null,"products/54748/images/441806/6026610_BK000_TRANSPARENT__37346.1281638945.1280.1280.png",{sleeve:"Short Sleeve",material:"87% merino wool / 13% nylon"}],
  ["6036-440","MEC Mountain Short Sleeve T-Shirt - Women's","Hiking Shirt","Womens",null,"products/64898/images/469780/6036440_WHT00_TRANSPARENT__14383.1781639522.1280.1280.png",{sleeve:"Short Sleeve",material:"60% organic cotton / 40% recycled polyester"}],
  ["6031-455","MEC Anywear Long Sleeve Shirt - Men's","Hiking Shirt","Mens",85,"products/59695/images/451693/6031455_AGT00_TRANSPARENT__43851.1781639156.1280.1280.png",{sleeve:"Long Sleeve",material:"100% recycled polyester"}],
  ["6031-457","MEC Anywear Short Sleeve Shirt - Men's","Hiking Shirt","Mens",null,"products/59698/images/451757/6031457_AGT00_TRANSPARENT__66100.1781639158.1280.1280.png",{sleeve:"Short Sleeve",material:"100% recycled polyester, UPF 50+"}],

  // ---- ROUND 2 (user-supplied URLs, 2026-07-20) ----
  ["6028-843","MEC Northern Light Vest - Women's","Insulated Jacket","Womens",235,"products/55785/images/444095/6028843_BK000_TRANSPARENT__89700.1781638993.1280.1280.png",{insulation:"Synthetic",synthName:"EcoSoft (recycled)",gsm:60,hood:"No Hood",pockets:3,packable:true,vest:true}],
  ["6023-548","MEC Rapidi-T Short Sleeve Shirt - Women's","Hiking Shirt","Womens",null,"products/51299/images/437475/6023548_NVY13_TRANSPARENT__10964.1781638850.1280.1280.png",{sleeve:"Short Sleeve",material:"92% polyester / 8% spandex, UPF 50+"}],
  ["6023-571","MEC Rapidi-T Long Sleeve Shirt - Women's","Hiking Shirt","Womens",null,"products/51284/images/437444/6023571_GN081_TRANSPARENT__45835.1781638850.1280.1280.png",{sleeve:"Long Sleeve",material:"92% polyester / 8% spandex, UPF 50+"}],
  ["6026-581","MEC Gorp Shorts - Men's","Hiking Shorts","Mens",null,"products/54561/images/441569/6026581_NVY13_TRANSPARENT__89694.1781638939.1280.1280.png",{material:"100% recycled nylon, PFAS-free DWR, UPF 50+",inseam:6}],
  ["6020-531","MEC Tech Trail Short 7\" - Women's","Hiking Shorts","Womens",null,"products/50838/images/436498/6020531_BK000_TRANSPARENT__78566.1781638828.1280.1280.png",{material:"94% nylon / 6% spandex, DWR, UPF 40-50+",inseam:7}],
  ["6038-550","MEC Tech Trail 9 in Shorts - Men's","Hiking Shorts","Mens",null,"products/65573/images/472665/6038550_BK000_TRANSPARENT__18128.1781639580.1280.1280.png",{material:"94% nylon / 6% spandex, PFAS-free DWR, UPF 50+",inseam:9}],
  ["6020-744","MEC Hydrofoil Stretch Jacket - Women's","Softshell Jacket","Womens",null,"products/51123/images/436872/6020744_BK000_TRANSPARENT__76125.1781638838.1280.1280.png",{material:"50D nylon, 2.5-layer Pertex Shield",wr:true,windR:true,stretch:true,packable:true}],
  ["6017-368","MEC Flex Nordic Softshell Jacket - Women's","Softshell Jacket","Womens",null,"products/54184/images/441304/6017368_NVY13_TRANSPARENT__13004.1783704230.1280.1280.png",{material:"100% polyester softshell",wr:true,windR:true}],
  ["6000-431","MEC Terrena Stretch Pants - Women's","Hiking Pants","Womens",null,"products/7792/images/419462/6000431_BK000_TRANSPARENT__81489.1781638454.1280.1280.png",{material:"96% nylon / 4% spandex, DWR"}],
  ["6000-429","MEC Terrena Stretch Convertible Pants - Women's","Convertible Pants","Womens",null,"products/7789/images/419441/6000429_CME00_TRANSPARENT__72131.1781638453.1280.1280.png",{material:"96% nylon / 4% spandex, DWR, UPF 50+"}],
  ["6031-431","MEC Mochilero Stretch Convertible Pants - Men's","Convertible Pants","Mens",null,"products/59407/images/449974/6031431_BK000_TRANSPARENT__25932.1781639120.1280.1280.png",{material:"96% nylon / 4% spandex, PFAS-free DWR, UPF 50+"}],
  ["6031-430","MEC Mochilero 9\" Shorts - Men's","Hiking Shorts","Mens",null,"products/59330/images/449801/6031430_BK000_TRANSPARENT__68751.1781639116.1280.1280.png",{material:"96% nylon / 4% spandex, UPF 40-50+",inseam:9}],
  ["6036-433","MEC All Day Merino Short Sleeve T-Shirt - Women's","Hiking Shirt","Womens",null,"products/64122/images/466389/6036433_AGT00_TRANSPARENT__63967.1781639452.1280.1280.png",{sleeve:"Short Sleeve",material:"87% merino wool / 13% nylon"}],
  ["6017-382","MEC T2 Base Layer Bottoms - Women's","Base Layer Bottom","Womens",null,"products/49197/images/434186/6017382_BK000_TRANSPARENT__67501.1781638775.1280.1280.png",{tier:"Midweight",fabric:"Synthetic",gsm:190}],
  ["6019-332","MEC T2 Merino Base Layer Bottoms - Women's","Base Layer Bottom","Womens",null,"products/49195/images/434169/6019332_BK000_TRANSPARENT__81185.1781638775.1280.1280.png",{tier:"Midweight",fabric:"Merino Wool"}],
  ["6017-381","MEC T2 Base Layer 1/4 Zip Long Sleeve Top - Women's","Base Layer Top","Womens",null,"products/49192/images/434164/6017381_BK000_TRANSPARENT__58631.1781638775.1280.1280.png",{tier:"Midweight",fabric:"Synthetic",sleeve:"Long Sleeve",neck:"Quarter-Zip",gsm:190}],
  ["6019-183","MEC T3 Base Layer Bottoms - Women's","Base Layer Bottom","Womens",null,"products/49274/images/434367/6019183_BK000_TRANSPARENT__40475.1781638781.1280.1280.png",{tier:"Expedition",fabric:"Synthetic",gsm:240}],
  ["6018-181","MEC T3 Base Layer Bottoms - Men's","Base Layer Bottom","Mens",null,"products/49264/images/434357/6018181_BK000_TRANSPARENT__38742.1781638781.1280.1280.png",{tier:"Expedition",fabric:"Synthetic",gsm:240}],
  ["6018-014","MEC T3 Base Layer Long Sleeve Top - Women's","Base Layer Top","Womens",null,"products/49219/images/434289/6018014_BK000_TRANSPARENT__12802.1781638779.1280.1280.png",{tier:"Expedition",fabric:"Synthetic",sleeve:"Long Sleeve",gsm:240}],
  ["6019-345","MEC T0 Base Layer Long Sleeve Top - Men's","Base Layer Top","Mens",null,"products/49207/images/434232/6019345_BK000_TRANSPARENT__36378.1781638777.1280.1280.png",{tier:"Lightweight",fabric:"Synthetic",sleeve:"Long Sleeve"}],

  // ---- ROUND 3 (gap-closing, 2026-07-27) — Fleece / Down / Premium rain ----
  // Fleece / midlayers (Fireside Snap Pullover W 6028-727 held — front image pending)
  ["6028-749","MEC Fireside Fleece Jacket - Men's","Fleece Jacket","Mens",null,"products/54902/images/442022/6028749_BK000_TRANSPARENT__52733.1781638950.1280.1280.png",{fleeceType:"Classic Fleece",closure:"Full-Zip",hood:"No Hood",material:"100% recycled polyester (290 gsm)"}],
  ["6028-750","MEC Fireside Fleece Snap Pullover - Men's","Fleece Jacket","Mens",null,"products/54887/images/441976/6028750_NVY13_TRANSPARENT__64222.1783098990.1280.1280.png",{fleeceType:"Classic Fleece",closure:"Snap-T/Snap",hood:"No Hood",material:"100% recycled polyester (290 gsm), recycled-nylon reinforcement"}],
  ["6031-444","MEC Fireside Fleece Vest - Unisex","Fleece Jacket","Unisex",null,"products/59671/images/451639/6031444_BK000_TRANSPARENT__39727.1781639155.1280.1280.png",{fleeceType:"Classic Fleece",closure:"Full-Zip",hood:"No Hood",material:"100% recycled polyester (290 gsm)",vest:true}],
  ["6028-753","MEC Rockwall Midlayer - Men's","Fleece Jacket","Mens",null,"products/55770/images/444037/6028753_BK000_TRANSPARENT__17212.1781638991.1280.1280.png",{fleeceType:"Hardface Fleece",closure:"Full-Zip",hood:"Fixed Hood",material:"100% polyester thermal stretch fleece"}],
  ["6028-724","MEC Rockwall Midlayer - Women's","Fleece Jacket","Womens",null,"products/55801/images/444150/6028724_BK000_TRANSPARENT__94731.1781638994.1280.1280.png",{fleeceType:"Hardface Fleece",closure:"Full-Zip",hood:"Fixed Hood",material:"100% polyester thermal stretch fleece"}],
  ["6034-548","MEC Classic Berber Fleece Vest - Unisex","Fleece Jacket","Unisex",451,"products/62157/images/460340/6034548_STC27_TRANSPARENT__47459.1783703644.1280.1280.png",{fleeceType:"Sherpa Fleece",closure:"Full-Zip",hood:"No Hood",material:"100% recycled polyester berber, Thermolite-lined",vest:true}],

  // Premium rain / hardshell
  ["6033-843","MEC Synergy HD Gore-Tex Jacket - Men's","Rain Jacket","Mens",615,"products/62409/images/460843/6033843_BK000_TRANSPARENT__08692.1781639340.1280.1280.png",{layer:"3-Layer",membrane:"GORE-TEX (ePE)",hood:"Helmet-Compatible",pitZips:true,pockets:5}],
  ["6033-842","MEC Synergy HD Gore-Tex Bib - Men's","Rain Pants","Mens",685,"products/62392/images/414797/6033842_BK000_TRANSPARENT__73848.1781214639.1280.1280.png",{layer:"3-Layer",membrane:"GORE-TEX (ePE)",sideZips:"Full-Length"}],
  ["6020-755","MEC Synergy Gore-Tex Alpine Pants - Men's","Rain Pants","Mens",null,"products/52325/images/491970/6020755_CQB07_TRANSPARENT__51162.1783703913.1280.1280.png",{layer:"3-Layer",membrane:"GORE-TEX C-Knit",sideZips:"Full-Length"}],
  ["6020-746","MEC Greycoast Rain Jacket - Women's","Rain Jacket","Womens",null,"products/50972/images/436576/6020746_BK000_TRANSPARENT__71543.1781638831.1280.1280.png",{layer:"2.5-Layer",wp:15000,hood:"Adjustable Hood",pitZips:false,pockets:3}],

  // Down / insulated — rest of the line (Guides Down Parka W 6016-866 held — front image pending)
  ["6033-831","MEC Bromont Recycled Down Jacket - Men's","Insulated Jacket","Mens",1015,"products/63391/images/414793/6033831_BK000_TRANSPARENT__09519.1781214639.1280.1280.png",{insulation:"Down",fillPower:700,fillWeightG:205,hood:"Helmet-Compatible Hood",pockets:5}],
  ["6033-852","MEC Bromont Recycled Down Jacket - Women's","Insulated Jacket","Womens",null,"products/63525/images/464428/6033852_BK000_TRANSPARENT__16395.1781639411.1280.1280.png",{insulation:"Down",fillPower:700,fillWeightG:170,hood:"Helmet-Compatible Hood",pockets:4}],
  ["6033-830","MEC Boundary Light Down Hooded Jacket - Men's","Insulated Jacket","Mens",412,"products/61366/images/457537/6033830_BK000_TRANSPARENT__87364.1781639274.1280.1280.png",{insulation:"Down",fillPower:700,fillWeightG:100,rds:true,hood:"Helmet-Compatible Hood",pockets:3,packable:true}],
  ["6033-850","MEC Boundary Light Down Hooded Jacket - Women's","Insulated Jacket","Womens",372,"products/61353/images/457533/6033850_ZEN03_TRANSPARENT__89278.1781639274.1280.1280.png",{insulation:"Down",fillPower:700,fillWeightG:100,rds:true,hood:"Helmet-Compatible Hood",pockets:3,packable:true}],
  ["6019-623","MEC Boundary Light Down Jacket - Women's","Insulated Jacket","Womens",365,"products/49974/images/435599/6019623_BK000_TRANSPARENT__08464.1781638809.1280.1280.png",{insulation:"Down",fillPower:700,rds:true,hood:"No Hood",pockets:3,packable:true}],
  ["6019-625","MEC Boundary Light Down Vest - Women's","Insulated Jacket","Womens",256,"products/49971/images/435584/6019625_BK000_TRANSPARENT__73462.1781638808.1280.1280.png",{insulation:"Down",fillPower:700,fillWeightG:70,rds:true,hood:"No Hood",pockets:3,packable:true,vest:true}],
  ["6033-854","MEC Fall-Line Insulated Jacket - Women's","Insulated Jacket","Womens",885,"products/63394/images/414798/6033854_BK000_TRANSPARENT__41126.1781214639.1280.1280.png",{insulation:"Synthetic",gsm:100,hood:"Helmet-Compatible Hood",pockets:4}],
  ["6019-621","MEC Tremblant Jacket - Women's","Insulated Jacket","Womens",null,"products/50348/images/436044/6019621_BK000_TRANSPARENT__62864.1781638818.1280.1280.png",{insulation:"Down",fillPower:700,hood:"Helmet-Compatible Hood",pockets:3}],
  // Round-3 held items resolved 2026-08-05 (front images obtained)
  ["6028-727","MEC Fireside Fleece Snap Pullover - Women's","Fleece Jacket","Womens",null,"products/54881/images/441946/6028727_NVY13_TRANSPARENT__21148.1781638948.1280.1280.png",{fleeceType:"Classic Fleece",closure:"Snap-T/Snap",hood:"No Hood",material:"100% recycled polyester (290 gsm)"}],
  ["6016-866","MEC Guides Down Parka - Women's","Insulated Jacket","Womens",null,"products/50514/images/436198/6016866_BK000_TRANSPARENT__31876.1781638821.1280.1280.png",{insulation:"Down",fillPower:650,fillWeightG:377,rds:true,hood:"Insulated Hood",pockets:4}],

  // ---- ROUND 4 (gap 4 — tees / sun-hoody, 2026-08-05) — all Hiking Shirt ----
  ["6036-429","MEC Pace Short Sleeve Shirt - Men's","Hiking Shirt","Mens",null,"products/64896/images/413627/6036429_BK000_TRANSPARENT__47253.1781093172.1280.1280.png",{sleeve:"Short Sleeve",material:"68% recycled polyester / 32% polyester, UPF 30+, Polygiene"}],
  ["6036-447","MEC Pace Short Sleeve Shirt - Women's","Hiking Shirt","Womens",null,"products/64899/images/469783/6036447_BK000_TRANSPARENT__53683.1781639522.1280.1280.png",{sleeve:"Short Sleeve",material:"68% recycled polyester / 32% polyester, UPF 30+, Polygiene"}],
  ["6036-448","MEC Pace Tank - Women's","Hiking Shirt","Womens",null,"products/64900/images/469792/6036448_BK000_TRANSPARENT__02268.1781639522.1280.1280.png",{sleeve:"Sleeveless",material:"68% recycled polyester / 32% polyester, UPF 30+, Polygiene"}],
  ["6036-412","MEC Mountain Short Sleeve T-Shirt - Men's","Hiking Shirt","Mens",null,"products/61459/images/413344/6036412_BK000_TRANSPARENT__62399.1781092855.1280.1280.png",{sleeve:"Short Sleeve",material:"60% organic cotton / 40% recycled polyester"}],
  ["6036-406","MEC Mountain Graphic Short Sleeve T-Shirt - Unisex","Hiking Shirt","Unisex",null,"products/61435/images/457872/6036406_DNW21_TRANSPARENT__88391.1781639281.1280.1280.png",{sleeve:"Short Sleeve",material:"60% organic cotton / 40% recycled polyester"}],
  ["6037-047","MEC M-Eh-C Graphic Short Sleeve T-Shirt - Unisex","Hiking Shirt","Unisex",null,"products/61314/images/457367/6037047_RSC28_TRANSPARENT__81478.1781639270.1280.1280.png",{sleeve:"Short Sleeve",material:"60% organic cotton / 40% recycled polyester (Made in Canada)"}],
  ["6031-524","MEC Sunburst Hooded UPF - Women's","Hiking Shirt","Womens",85,"products/59328/images/449793/6031524_CLD00_TRANSPARENT__73390.1781639116.1280.1280.png",{sleeve:"Long Sleeve",material:"100% recycled polyester, UPF 50+ (hooded sun shirt)"}],
];

// map raw fabric text -> the itemType's material enum
function mapMaterial(type, m) {
  if (!m) return undefined;
  const s = m.toLowerCase();
  if (type === "Hiking Shirt") {
    if (s.includes("merino")) return "Merino Wool";
    if (s.includes("cotton")) return "Cotton";
    if (s.includes("polyester")) return "Polyester";
    if (s.includes("nylon")) return "Nylon";
    return "Synthetic";
  }
  if (type === "Hiking Shorts") {
    if (s.includes("cotton")) return "Cotton Blend";
    if (s.includes("spandex")) return "Spandex Mix";
    if (s.includes("polyester")) return "Polyester";
    if (s.includes("nylon")) return "Nylon";
    return undefined;
  }
  // Hiking Pants
  if (s.includes("cotton")) return "Cotton Blend";
  if (s.includes("spandex")) return "Nylon/Spandex Blend";
  if (s.includes("polyester")) return "Polyester";
  if (s.includes("nylon")) return "Nylon";
  return undefined;
}

// short curated description; keeps the raw fabric composition (dropped from attrs)
function describe(name, type, gender, weight, x) {
  const g = gender === "Mens" ? "Men's" : gender === "Womens" ? "Women's" : "Unisex";
  const w = weight != null ? ` ${weight} g.` : "";
  switch (type) {
    case "Base Layer Top":
    case "Base Layer Bottom": {
      const piece = type === "Base Layer Top" ? `top${x.sleeve ? " (" + x.sleeve.toLowerCase() + (x.neck ? ", " + x.neck.toLowerCase() : "") + ")" : ""}` : "bottoms";
      const mat = x.fabric === "Merino Wool" ? "merino-blend" : "synthetic";
      return `MEC Label ${g.toLowerCase()} ${x.tier.toLowerCase()}-weight ${mat} base-layer ${piece}${x.gsm ? ` (${x.gsm} gsm fabric)` : ""}. Flatlock seams, slim fit.`;
    }
    case "Hiking Pants":
      return `MEC Label ${g.toLowerCase()} hiking pants. ${x.material}.${w}`;
    case "Convertible Pants":
      return `MEC Label ${g.toLowerCase()} zip-off convertible hiking pants (legs zip off to shorts). ${x.material}.${w}`;
    case "Hiking Shorts":
      return `MEC Label ${g.toLowerCase()} hiking shorts${x.inseam ? ` (${x.inseam}" inseam)` : ""}. ${x.material}.${w}`;
    case "Hiking Shirt":
      return `MEC Label ${g.toLowerCase()} ${x.sleeve.toLowerCase()} shirt/tee. ${x.material}.${w}`;
    case "Rain Jacket":
    case "Rain Pants":
      return `MEC Label ${g.toLowerCase()} ${type === "Rain Pants" ? "rain pants" : "rain jacket"}, ${x.layer}${x.wp ? ` / ${x.wp} mm` : ""}${x.membrane ? ` ${x.membrane}` : ""}${x.packable ? ", packable" : ""}${x.pfasFree ? ", PFAS-free DWR" : ""}.${w}`;
    case "Softshell Jacket":
      return `MEC Label ${g.toLowerCase()} stretch softshell jacket. ${x.material || ""}${x.packable ? " Packable." : ""}${w}`;
    case "Fleece Jacket":
      return `MEC Label ${g.toLowerCase()} ${x.vest ? "fleece vest" : "fleece midlayer"} — ${x.fleeceType.toLowerCase()}${x.hood && x.hood !== "No Hood" ? ", hooded" : ""}. ${x.material || ""}${w}`;
    case "Insulated Jacket":
      return `MEC Label ${g.toLowerCase()} ${x.vest ? "insulated vest" : "insulated jacket"} — ${x.insulation}${x.fillPower ? ` ${x.fillPower}-fill-power down` : ""}${x.gsm ? ` (${x.gsm} g/m² fill)` : ""}${x.fillWeightG ? `, ${x.fillWeightG} g fill` : ""}${x.hood === "No Hood" ? ", hoodless" : ""}, stuffs into its own pocket.${w}`;
    default:
      return `MEC Label ${name}.`;
  }
}

function attrsFor(type, gender, x) {
  switch (type) {
    case "Base Layer Top": {
      const a = { gender, weight: x.tier, fabricType: x.fabric };
      if (x.gsm) a.fabricWeightGsm = x.gsm;
      if (x.sleeve) a.sleevesLength = x.sleeve;
      if (x.neck) a.neckStyle = x.neck;
      return a;
    }
    case "Base Layer Bottom": {
      const a = { gender, weight: x.tier, fabricType: x.fabric };
      if (x.gsm) a.fabricWeightGsm = x.gsm;
      return a;
    }
    case "Hiking Pants":
    case "Hiking Shorts": {
      const a = { gender };
      const m = mapMaterial(type, x.material);
      if (m) a.material = m;
      if (x.inseam) a.inseamIn = x.inseam;
      return a;
    }
    case "Convertible Pants": {
      const a = { gender, conversionType: "Zip-Off" };
      const m = mapMaterial("Hiking Pants", x.material); // same enum as pants
      if (m) a.material = m;
      return a;
    }
    case "Hiking Shirt": {
      const a = { gender, sleevesLength: x.sleeve };
      const m = mapMaterial(type, x.material);
      if (m) a.material = m;
      return a;
    }
    case "Rain Jacket":
    case "Rain Pants": {
      const a = { gender, layerConstruction: x.layer };
      if (x.wp) a.waterproofRating = x.wp;
      if (x.membrane) a.membrane = x.membrane;
      if (x.hood) a.hoodType = x.hood;
      if (x.pitZips != null) a.pitZips = x.pitZips;
      if (x.sideZips != null) a.sideZips = x.sideZips;
      if (x.pockets != null) a.pockets = x.pockets;
      if (x.packable != null) a.packable = x.packable;
      if (x.pfasFree != null) a.pfasFree = x.pfasFree;
      return a;
    }
    case "Fleece Jacket": {
      const a = { gender, fleeceType: x.fleeceType };
      if (x.closure) a.closure = x.closure;
      if (x.hood) a.hoodType = x.hood;
      if (x.material) a.material = x.material;
      if (x.pockets != null) a.pockets = x.pockets;
      return a;
    }
    case "Softshell Jacket": {
      const a = { gender };
      if (x.material) a.material = x.material;
      if (x.wr != null) a.waterResistant = x.wr;
      if (x.windR != null) a.windResistant = x.windR;
      if (x.stretch != null) a.stretchFabric = x.stretch;
      if (x.packable != null) a.packable = x.packable;
      return a;
    }
    case "Insulated Jacket": {
      const a = { insulationType: x.insulation, gender };
      if (x.fillPower) a.fillPower = x.fillPower;
      if (x.rds != null) a.rdsDown = x.rds;
      if (x.fillWeightG && x.fillWeightG <= 340) a.fillWeightG = x.fillWeightG; // schema max
      if (x.synthName) a.syntheticInsulationType = x.synthName;
      if (x.gsm) a.insulationWeightGsm = x.gsm;
      if (x.hood) a.hoodType = x.hood;
      if (x.pockets != null) a.pockets = x.pockets;
      if (x.packable != null) a.packable = x.packable;
      return a;
    }
    default:
      return { gender };
  }
}

module.exports = { ITEMS, attrsFor };
if (require.main !== module) return;

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB_NAME });
  const C = require("../models/catalogItem");
  const O = require("../models/merchantOffer");
  let created = 0, skipped = 0, failed = 0;
  const counts = {};

  for (const [id, name, type, gender, weight, img, x] of ITEMS) {
    const existing = await C.findOne({ name, brandLC: "mec", isActive: true }).lean();
    if (existing) { console.log(`SKIP (exists): ${name}`); skipped++; continue; }
    const { category, subcategory } = categoryForItemType(type, name);
    const attributes = attrsFor(type, gender, x);
    const sizes = gender === "Womens" ? SZ_W : SZ_M;
    const variantAxes = [{ name: "Size", values: sizes }];
    const variants = sizes.map((s) => ({ key: s, options: { Size: s } }));
    const defaultVariantKey = sizes.includes("Medium") ? "Medium" : sizes[0];
    counts[type] = (counts[type] || 0) + 1;
    console.log(`${name.slice(0, 48).padEnd(48)} ${type.padEnd(18)} ${String(weight ?? "—").padStart(4)}g  ${category || "-"}/${subcategory || "-"}`);
    if (!COMMIT) continue;

    const doc = new C({
      name, brand: "MEC", itemType: type,
      ...(category ? { category } : {}), ...(subcategory ? { subcategory } : {}),
      description: describe(name, type, gender, weight, x),
      imageUrls: [CDN + img], createdBy: ADMIN_ID, isActive: true,
      ...(weight != null ? { weightGrams: weight } : {}),
      variantAxes, variants, defaultVariantKey, attributes,
    });
    doc.$locals.lenientAttributes = true;
    try { await doc.save(); } catch (e) { console.log(`   !! ${name}: ${e.message}`); failed++; continue; }
    await O.create({ network: "direct", region: "global", merchantId: "direct-mec", merchantName: "MEC", productId: doc._id, deepLink: `https://www.mec.ca/en/product/${id}`, priority: 0 });
    created++;
  }
  console.log(`\nby itemType:`, counts);
  console.log(`total defined: ${ITEMS.length}`);
  console.log(`${COMMIT ? "APPLIED" : "DRY-RUN"}: ${created} created, ${skipped} skipped, ${failed} failed`);
  await mongoose.disconnect();
})();
