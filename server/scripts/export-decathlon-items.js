#!/usr/bin/env node
/**
 * export-decathlon-items.js
 *
 * 1. Exports all Decathlon-brand CatalogItems (Forclaz, Quechua, Simond, Decathlon)
 *    plus any CatalogItem with an awin MerchantOffer linked — to an Excel file.
 * 2. Compares against products extracted from in-store photos.
 * 3. Outputs a second sheet listing items from photos NOT yet in the DB.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const ExcelJS = require("exceljs");
const path = require("path");

const CatalogItem = require("../src/models/catalogItem");
const MerchantOffer = require("../src/models/merchantOffer");

// ---------------------------------------------------------------------------
// Products extracted from in-store photos (name, decathlonRef, weight, category, notes)
// decathlonRef = the numeric reference printed on store signage
// ---------------------------------------------------------------------------
const IMAGE_PRODUCTS = [
  // ---- SLEEPING BAGS (Simond) ----
  { name: "Sleeping Bag MT500 15°C", decathlonRef: "8799895", weightG: 660, category: "Sleep System", brand: "Simond", notes: "Slaapzak" },
  { name: "Sleeping Bag MT500 10°C", decathlonRef: "8799893", weightG: 900, category: "Sleep System", brand: "Simond", notes: "" },
  { name: "Sleeping Bag MT500 5°C", decathlonRef: "8799889", weightG: 1050, category: "Sleep System", brand: "Simond", notes: "" },
  { name: "Sleeping Bag MT500 0°C", decathlonRef: "8799901", weightG: 1450, category: "Sleep System", brand: "Simond", notes: "" },
  { name: "Sleeping Bag MT500 -5°C", decathlonRef: "8799902", weightG: 1650, category: "Sleep System", brand: "Simond", notes: "" },
  { name: "Sleeping Bag MT500 10°C Dons", decathlonRef: "8407105", weightG: 630, category: "Sleep System", brand: "Simond", notes: "100% gerecycled eendendons 700 Cuin" },
  { name: "Sleeping Bag MT500 5°C Dons", decathlonRef: "8407113", weightG: 830, category: "Sleep System", brand: "Simond", notes: "100% gerecycled eendendons 700 Cuin" },
  { name: "Sleeping Bag MT900 0°C Dons", decathlonRef: "8480702", weightG: 930, category: "Sleep System", brand: "Simond", notes: "Eendendons" },
  { name: "Sleeping Bag QUILT SPRINT 0°C Dons", decathlonRef: "", weightG: 695, category: "Sleep System", brand: "Simond", notes: "Ganzensdons RDS 900 Cuin" },
  { name: "Sleeping Bag MAKALU I -5°C", decathlonRef: "8489109", weightG: 1160, category: "Sleep System", brand: "Simond", notes: "" },
  { name: "Sleeping Bag MAKALU II -9°C", decathlonRef: "8489191", weightG: 1471, category: "Sleep System", brand: "Simond", notes: "Eendendons RDS 800 Cuin" },
  { name: "Sleeping Bag MAKALU III -12°C", decathlonRef: "8480193", weightG: 1840, category: "Sleep System", brand: "Simond", notes: "" },

  // ---- COOKING STOVES ----
  { name: "Camp Stove Bleuet Compact Connect", decathlonRef: "8989039", weightG: 193, category: "Kitchen", brand: "Campingaz", notes: "1250W, Ventielpatroon" },
  { name: "Camp Stove MT100", decathlonRef: "8582112", weightG: 184, category: "Kitchen", brand: "Simond", notes: "2200W" },
  { name: "Camp Stove MT500 Light", decathlonRef: "8559534", weightG: 85, category: "Kitchen", brand: "Simond", notes: "2750W" },
  { name: "Camp Stove MT500 Remonte", decathlonRef: "8559535", weightG: 170, category: "Kitchen", brand: "Simond", notes: "2500W" },
  { name: "Camp Stove MT900", decathlonRef: "8975262", weightG: 50, category: "Kitchen", brand: "Simond", notes: "2300W" },
  { name: "Camp Stove Jetboil Zip 2.0", decathlonRef: "9030015", weightG: 324, category: "Kitchen", brand: "Jetboil", notes: "900W" },

  // ---- TARPS (Simond) ----
  { name: "Tarp MT900 1P", decathlonRef: "8968612", weightG: 920, category: "Shelter", brand: "Simond", notes: "Tarp 1 persoon" },
  { name: "Tarp MT900 2P", decathlonRef: "8968614", weightG: 1300, category: "Shelter", brand: "Simond", notes: "Tarp 2 personen" },

  // ---- TUNNEL TENTS (Simond) ----
  { name: "Tunneltent UL MT900 2P", decathlonRef: "8586318", weightG: 1650, category: "Shelter", brand: "Simond", notes: "Ultralicht tunneltent 2P" },
  { name: "Tunneltent MT900 2P", decathlonRef: "8882677", weightG: 2080, category: "Shelter", brand: "Simond", notes: "Tunneltent 2P" },
  { name: "Tunneltent MT900 3P", decathlonRef: "8882697", weightG: 3080, category: "Shelter", brand: "Simond", notes: "Tunneltent 3P" },

  // ---- TENTS MT900 (Simond) ----
  { name: "Tent MT900 1P", decathlonRef: "8882673", weightG: 1300, category: "Shelter", brand: "Simond", notes: "Tent 1P" },
  { name: "Tent MT900 2P", decathlonRef: "8882674", weightG: 1950, category: "Shelter", brand: "Simond", notes: "Tent 2P (also ref 8975216)" },
  { name: "Tent MT900 3P", decathlonRef: "8882675", weightG: 2700, category: "Shelter", brand: "Simond", notes: "Tent 3P" },

  // ---- TENTS MT500 (Simond) ----
  { name: "Tent MT500 Mesh 2P", decathlonRef: "8786418", weightG: 2600, category: "Shelter", brand: "Simond", notes: "Mesh tent 2P" },
  { name: "Tent MT500 2P", decathlonRef: "8858233", weightG: 2850, category: "Shelter", brand: "Simond", notes: "Tent 2P" },
  { name: "Tent MT500 3P", decathlonRef: "8858234", weightG: 3650, category: "Shelter", brand: "Simond", notes: "Tent 3P" },

  // ---- SLEEPING MATS ----
  { name: "Sleeping Mat MT100 Schuim", decathlonRef: "5591040", weightG: 210, category: "Sleep System", brand: "Simond", notes: "180x50x0.7cm, R=1, Foam" },
  { name: "Sleeping Mat MT500 Schuim", decathlonRef: "6492712", weightG: 370, category: "Sleep System", brand: "Simond", notes: "180x55x2cm, R=2.1, Foam" },
  { name: "Sleeping Mat MT100 Schuim Isolerend", decathlonRef: "8801325", weightG: 480, category: "Sleep System", brand: "Simond", notes: "195x55x2cm, R=2.2, Foam" },
  { name: "Sleeping Mat MT100 Zelfopblazend L", decathlonRef: "8612278", weightG: 920, category: "Sleep System", brand: "Simond", notes: "180x52x2.5cm, R=2.7, Self-inflating" },
  { name: "Sleeping Mat MT100 Zelfopblazend XL", decathlonRef: "8612279", weightG: 1020, category: "Sleep System", brand: "Simond", notes: "193x60x2.5cm, R=2.7, Self-inflating" },
  { name: "Sleeping Mat MT500 Air L", decathlonRef: "8799965", weightG: 510, category: "Sleep System", brand: "Simond", notes: "180x52x5cm, R=1.5, Inflatable" },
  { name: "Sleeping Mat MT500 Air XL", decathlonRef: "8799966", weightG: 600, category: "Sleep System", brand: "Simond", notes: "195x60x5cm, R=1.5, Inflatable" },
  { name: "Sleeping Mat MT500 Isolerend L", decathlonRef: "8853280", weightG: 670, category: "Sleep System", brand: "Simond", notes: "180x52x5cm, R=3.3, Inflatable" },
  { name: "Sleeping Mat MT500 Isolerend XL", decathlonRef: "8853281", weightG: 800, category: "Sleep System", brand: "Simond", notes: "195x60x5cm, R=3.3, Inflatable" },
  { name: "Sleeping Mat MT900 Air L", decathlonRef: "8975036", weightG: 520, category: "Sleep System", brand: "Simond", notes: "183x54x8.5cm, R=1.5, Inflatable" },
  { name: "Sleeping Mat MT900 Air XL", decathlonRef: "8799038", weightG: 620, category: "Sleep System", brand: "Simond", notes: "195x63x8.5cm, R=1.5, Inflatable" },
  { name: "Sleeping Mat MT900 Air Isolerend L", decathlonRef: "8975202", weightG: 615, category: "Sleep System", brand: "Simond", notes: "183x54x9cm, R=5.4, Inflatable" },
  { name: "Sleeping Mat MT900 Air Isolerend XL", decathlonRef: "8975212", weightG: 730, category: "Sleep System", brand: "Simond", notes: "195x63x9cm, R=5.4, Inflatable" },
  { name: "Sleeping Mat Sea to Summit Ultralight Insulated L", decathlonRef: "8951198", weightG: 480, category: "Sleep System", brand: "Sea to Summit", notes: "183x55x5cm, R=3.1, Inflatable" },
  { name: "Sleeping Mat Sea to Summit Ultralight Insulated XL", decathlonRef: "8951198", weightG: 595, category: "Sleep System", brand: "Sea to Summit", notes: "198x64x5cm, R=3.1, Inflatable" },
  { name: "Set Reparatiepatch slaapmat", decathlonRef: "8817232", weightG: null, category: "Accessories", brand: "Simond", notes: "Repair patch set" },

  // ---- WOMEN'S HIKING BOOTS (NH series - Dames) ----
  { name: "NH50 LOW Women", decathlonRef: "8553549", weightG: 270, category: "Footwear", brand: "Quechua", notes: "Wandelschoen dames" },
  { name: "NH100 MID Women", decathlonRef: "8930406", weightG: 312, category: "Footwear", brand: "Quechua", notes: "Wandelschoen dames" },
  { name: "NH100 LOW WTP Women", decathlonRef: "8871776", weightG: 300, category: "Footwear", brand: "Quechua", notes: "Wandelschoen dames waterproof" },
  { name: "NH100 MID WTP Women", decathlonRef: "8870065", weightG: 310, category: "Footwear", brand: "Quechua", notes: "Wandelschoen dames mid waterproof" },
  { name: "NH500 LOW Women", decathlonRef: "8934985", weightG: 240, category: "Footwear", brand: "Quechua", notes: "Wandelschoen dames" },
  { name: "NH500 LOW WP Women", decathlonRef: "8969434", weightG: 300, category: "Footwear", brand: "Quechua", notes: "Wandelschoen dames waterproof" },
  { name: "NH500 LOW LEER WP Women", decathlonRef: "8871375", weightG: 300, category: "Footwear", brand: "Quechua", notes: "Wandelschoen dames leer waterproof" },
  { name: "NH500 MID LEER WP Women", decathlonRef: "8884466", weightG: 325, category: "Footwear", brand: "Quechua", notes: "Wandelschoen dames mid leer waterproof" },

  // ---- MEN'S HIKING BOOTS (NH series - Heren) ----
  { name: "NH50 LOW Men", decathlonRef: "8844096", weightG: 361, category: "Footwear", brand: "Quechua", notes: "Wandelschoen heren" },
  { name: "NH100 MID Men", decathlonRef: "8780701", weightG: 371, category: "Footwear", brand: "Quechua", notes: "Wandelschoen heren" },
  { name: "NH100 LOW WTP Men", decathlonRef: "8877180", weightG: 325, category: "Footwear", brand: "Quechua", notes: "Wandelschoen heren waterproof" },
  { name: "NH100 MID WTP Men", decathlonRef: "8894871", weightG: 365, category: "Footwear", brand: "Quechua", notes: "Wandelschoen heren mid waterproof" },
  { name: "NH500 LOW Men", decathlonRef: "8931885", weightG: 325, category: "Footwear", brand: "Quechua", notes: "Wandelschoen heren" },
  { name: "ARPENAZ REVIVAL Men", decathlonRef: "8940976", weightG: 265, category: "Footwear", brand: "Quechua", notes: "Wandelschoen heren" },
  { name: "NH500 LOW WP Men", decathlonRef: "8930684", weightG: 375, category: "Footwear", brand: "Quechua", notes: "Wandelschoen heren waterproof" },
  { name: "NH500 MID LEER WP Men", decathlonRef: "8988718", weightG: 403, category: "Footwear", brand: "Quechua", notes: "Wandelschoen heren mid leer waterproof" },
  { name: "NH500 MID LEER Men", decathlonRef: "8883913", weightG: 425, category: "Footwear", brand: "Quechua", notes: "Wandelschoen heren mid leer" },

  // ---- MEN'S TREKKING BOOTS ----
  { name: "Trekking Boot MT100", decathlonRef: "8883388", weightG: 560, category: "Footwear", brand: "Forclaz", notes: "Trekkingschoen heren" },
  { name: "Trekking Boot MT100 LEER BREED", decathlonRef: "8550247", weightG: 627, category: "Footwear", brand: "Forclaz", notes: "Trekkingschoen heren breed" },
  { name: "Trekking Boot TECNICA STARCROSS", decathlonRef: "9054921", weightG: 500, category: "Footwear", brand: "Tecnica", notes: "Trekkingschoen heren" },
  { name: "Trekking Boot MT500 LEER", decathlonRef: "8788855", weightG: 552, category: "Footwear", brand: "Forclaz", notes: "Trekkingschoen heren leer" },
  { name: "Trekking Boot SALEWA ALP TRAINER MID", decathlonRef: "9000448", weightG: 532, category: "Footwear", brand: "Salewa", notes: "Trekkingschoen heren" },
  { name: "Trekking Boot LOWA RENETREK GTX", decathlonRef: "9007426", weightG: 590, category: "Footwear", brand: "Lowa", notes: "Trekkingschoen heren" },
  { name: "Trekking Boot SALOMON QUEST 4", decathlonRef: "9020991", weightG: 585, category: "Footwear", brand: "Salomon", notes: "Trekkingschoen heren" },
  { name: "Trekking Boot TECNICA FUSE", decathlonRef: "", weightG: 560, category: "Footwear", brand: "Tecnica", notes: "Trekkingschoen heren" },

  // ---- MEN'S MOUNTAIN HIKING BOOTS ----
  { name: "Mountain Boot MH100", decathlonRef: "8755055", weightG: null, category: "Footwear", brand: "Quechua", notes: "Bergwandelschoen heren" },
  { name: "Mountain Boot MH100 WP", decathlonRef: "8710204", weightG: null, category: "Footwear", brand: "Quechua", notes: "Bergwandelschoen heren WP" },
  { name: "Mountain Boot MH100 MID WP", decathlonRef: "8799992", weightG: null, category: "Footwear", brand: "Quechua", notes: "Bergwandelschoen heren mid WP" },
  { name: "Mountain Boot MH500 WP", decathlonRef: "8723811", weightG: null, category: "Footwear", brand: "Quechua", notes: "Bergwandelschoen heren WP" },
  { name: "Mountain Boot MH500 MID WP", decathlonRef: "8723616", weightG: null, category: "Footwear", brand: "Quechua", notes: "Bergwandelschoen heren mid WP" },
  { name: "Mountain Boot MERRELL CROSSLANDER", decathlonRef: "8923385", weightG: null, category: "Footwear", brand: "Merrell", notes: "Bergwandelschoen heren" },
  { name: "Mountain Boot COLUMBIA DIAMOND", decathlonRef: "8981294", weightG: null, category: "Footwear", brand: "Columbia", notes: "Bergwandelschoen heren" },
  { name: "Mountain Boot COLUMBIA DIAMOND MID", decathlonRef: "9012380", weightG: null, category: "Footwear", brand: "Columbia", notes: "Bergwandelschoen heren mid" },
  { name: "Mountain Boot MERRELL MOAB MID", decathlonRef: "9012460", weightG: null, category: "Footwear", brand: "Merrell", notes: "Bergwandelschoen heren mid" },
  { name: "Mountain Boot LOWA SIRKOS GTX LO DC", decathlonRef: "9012730", weightG: null, category: "Footwear", brand: "Lowa", notes: "Bergwandelschoen heren" },
  { name: "Mountain Boot SALEWA ALP TRAINER", decathlonRef: "9012228", weightG: null, category: "Footwear", brand: "Salewa", notes: "Bergwandelschoen heren" },

  // ---- HIKING BACKPACKS (Quechua) ----
  { name: "Hiking Pack MH100 20L", decathlonRef: "8740470", weightG: 740, category: "Pack", brand: "Quechua", notes: "Wandelrugzak 20L, 40x25x17.6cm" },
  { name: "Hiking Pack MH100 35L", decathlonRef: "8790270", weightG: 840, category: "Pack", brand: "Quechua", notes: "Wandelrugzak 35L, 40x29x22cm" },
  { name: "Hiking Pack MH500 25L", decathlonRef: "8910354", weightG: 975, category: "Pack", brand: "Quechua", notes: "Wandelrugzak 25L" },
  { name: "Hiking Pack MH500 38L", decathlonRef: "8920390", weightG: 1150, category: "Pack", brand: "Quechua", notes: "Wandelrugzak 38L" },
  { name: "Hiking Pack MH500 LIGHT 15L", decathlonRef: "8870393", weightG: 550, category: "Pack", brand: "Quechua", notes: "Wandelrugzak licht 15L" },
  { name: "Hiking Pack MH500 LIGHT 22L", decathlonRef: "8813394", weightG: 780, category: "Pack", brand: "Quechua", notes: "Wandelrugzak licht 22L" },
  { name: "Hiking Pack FH500 17L", decathlonRef: "8884020", weightG: 400, category: "Pack", brand: "Quechua", notes: "Snelwandelen 17L" },
  { name: "Hiking Pack MH900 25L", decathlonRef: "8881199", weightG: 1080, category: "Pack", brand: "Quechua", notes: "Intensief wandelen 25L" },
  { name: "Hiking Pack MH900 38L", decathlonRef: "8946339", weightG: 1160, category: "Pack", brand: "Quechua", notes: "Intensief wandelen 38L" },

  // ---- TREKKING BACKPACKS (Simond) ----
  { name: "Trekking Pack MT100 50L", decathlonRef: "", weightG: 1400, category: "Pack", brand: "Simond", notes: "Trekkingsrugzak 50L" },
  { name: "Trekking Pack MT100 Easyfit 50+10L (Men)", decathlonRef: "8559800", weightG: 1600, category: "Pack", brand: "Simond", notes: "Trekkingsrugzak 50+10L heren" },
  { name: "Trekking Pack MT100 Easyfit 60+10L (Women)", decathlonRef: "8731082", weightG: 1700, category: "Pack", brand: "Simond", notes: "Trekkingsrugzak 60+10L dames" },
  { name: "Trekking Pack MT500 Air 45+10L (Men)", decathlonRef: "8978310", weightG: 1600, category: "Pack", brand: "Simond", notes: "Trekkingsrugzak 45+10L heren" },
  { name: "Trekking Pack MT500 Air (Women)", decathlonRef: "8898272", weightG: 1730, category: "Pack", brand: "Simond", notes: "Trekkingsrugzak dames" },
  { name: "Trekking Pack MT900 Light 50+10L (Men)", decathlonRef: "8842899", weightG: 1300, category: "Pack", brand: "Simond", notes: "Trekkingsrugzak licht 50+10L heren" },
  { name: "Trekking Pack MT900 Light 45+10L (Women)", decathlonRef: "8842604", weightG: 1300, category: "Pack", brand: "Simond", notes: "Trekkingsrugzak licht 45+10L dames" },
  { name: "Trekking Pack MT800 Symbium (Men)", decathlonRef: "8781983", weightG: null, category: "Pack", brand: "Simond", notes: "Trekkingsrugzak 50-90+10L heren" },
  { name: "Trekking Pack MT800 Symbium (Women)", decathlonRef: "8732034", weightG: null, category: "Pack", brand: "Simond", notes: "Trekkingsrugzak 50-80+10L dames" },
  { name: "Trekking Pack MT800 UL 50L", decathlonRef: "8879319", weightG: 680, category: "Pack", brand: "Simond", notes: "Ultralicht trekkingsrugzak 50L" },
  { name: "Trekking Pack Deuter Trekking Plus 45+10L", decathlonRef: "9008928", weightG: 1890, category: "Pack", brand: "Deuter", notes: "Trekkingsrugzak dames 45+10L" },

  // ---- HIKING POLES (Quechua) ----
  { name: "Hiking Pole MT100", decathlonRef: "8807204", weightG: 200, category: "Poles", brand: "Quechua", notes: "Per stok, 105-120cm, compact 56cm" },
  { name: "Hiking Pole MT100 Comfort", decathlonRef: "8905507", weightG: 230, category: "Poles", brand: "Quechua", notes: "Per stok, 110-130cm, compact 57cm" },
  { name: "Hiking Pole MT100 Ergonomisch", decathlonRef: "8807205", weightG: 240, category: "Poles", brand: "Quechua", notes: "Per stok, 90-110cm, compact 58cm" },
  { name: "Hiking Pole MT500 Ergonomisch", decathlonRef: "8870985", weightG: 240, category: "Poles", brand: "Quechua", notes: "Per stok, 90-110cm, compact 58cm" },
  { name: "Hiking Pole MT500", decathlonRef: "8840581", weightG: 280, category: "Poles", brand: "Simond", notes: "Per stok, 100-130cm, compact 58cm" },
  { name: "Hiking Pole MT500 All Season", decathlonRef: "8910014", weightG: 280, category: "Poles", brand: "Simond", notes: "Per stok, 105-135cm, compact 77cm" },
  { name: "Hiking Pole MT500 Antishock", decathlonRef: "8810080", weightG: 245, category: "Poles", brand: "Simond", notes: "Per stok, 105-130cm, compact 59cm" },
  { name: "Hiking Pole MT500 Cork", decathlonRef: "8869228", weightG: 238, category: "Poles", brand: "Simond", notes: "Per stok, 100-130cm, compact 56cm" },
  { name: "Hiking Pole MT900", decathlonRef: "8810058", weightG: 275, category: "Poles", brand: "Simond", notes: "Per stok, 110-130cm, compact 38cm" },
  { name: "Hiking Pole Komperdell Ridge Hiker", decathlonRef: "8827380", weightG: 280, category: "Poles", brand: "Komperdell", notes: "Per stok, 105-140cm, compact 64cm" },
  { name: "Hiking Pole Black Diamond BD Vista FLZ", decathlonRef: "8910080", weightG: 284, category: "Poles", brand: "Black Diamond", notes: "Per stok, 110-125cm, compact 37cm" },
  { name: "Hiking Pole Paar Sprint", decathlonRef: "8793383", weightG: 184, category: "Poles", brand: "Simond", notes: "Per stok, 110-130cm, compact 38.5cm" },
  { name: "Hiking Pole Komperdell Zero Pro", decathlonRef: "9017579", weightG: 218, category: "Poles", brand: "Komperdell", notes: "Per stok, 105-140cm, compact 64cm" },

  // ---- TRAVEL BACKPACKS (Quechua) ----
  { name: "Travel Pack 500 Organizer 30L", decathlonRef: "8990286", weightG: 1400, category: "Pack", brand: "Quechua", notes: "Reisrugzak 30L, 50x30x22cm" },
  { name: "Travel Pack 500 Organizer 40L", decathlonRef: "8787845", weightG: 1400, category: "Pack", brand: "Quechua", notes: "Reisrugzak 40L" },
  { name: "Travel Pack 900 Easy-Fit 50L (Men)", decathlonRef: "8880000", weightG: 2160, category: "Pack", brand: "Quechua", notes: "Reisrugzak 50L heren, 60x32x32cm" },
  { name: "Travel Pack 900 Easy-Fit 50L (Women)", decathlonRef: "8816394", weightG: 2160, category: "Pack", brand: "Quechua", notes: "Reisrugzak 50L dames, 65x32x32cm" },
  { name: "Travel Pack 900 Easy-Fit 70L (Men)", decathlonRef: "8880014", weightG: 2350, category: "Pack", brand: "Quechua", notes: "Reisrugzak 70L heren, 75x35x30cm" },
  { name: "Travel Pack 900 Easy-Fit 60L (Women)", decathlonRef: "8880010", weightG: 2350, category: "Pack", brand: "Quechua", notes: "Reisrugzak 60L dames, 70x35x30cm" },

  // ---- BIVAK/CAMP LIGHTS (Quechua) ----
  { name: "Camp Light BL 40 lm (battery)", decathlonRef: "8615283", weightG: null, category: "Lighting", brand: "Quechua", notes: "40 lm, 3 AAA, 50u" },
  { name: "Camp Light BL 100 lm (battery)", decathlonRef: "8492468", weightG: null, category: "Lighting", brand: "Quechua", notes: "100 lm, 4 AAA, 26.5u" },
  { name: "Camp Light BL 60 lm (USB/dynamo)", decathlonRef: "8755548", weightG: null, category: "Lighting", brand: "Quechua", notes: "60 lm, USB-C/dynamo, 6.5u" },
  { name: "Camp Light BL 100 lm (USB)", decathlonRef: "8670110", weightG: null, category: "Lighting", brand: "Quechua", notes: "100 lm, Micro-USB, 8u" },
  { name: "Camp Light BL 120 lm", decathlonRef: "8881742", weightG: null, category: "Lighting", brand: "Quechua", notes: "120 lm, USB-C, 10u" },
  { name: "Camp Light BL 200 lm", decathlonRef: "8852787", weightG: null, category: "Lighting", brand: "Quechua", notes: "200 lm, USB-C, 7u" },
  { name: "Camp Light BL 230 lm", decathlonRef: "8492469", weightG: null, category: "Lighting", brand: "Quechua", notes: "230 lm, USB-C, 4u" },
  { name: "Camp Light BL 400 lm", decathlonRef: "8492095", weightG: null, category: "Lighting", brand: "Quechua", notes: "400 lm, USB-C, 3.5u" },
  { name: "Camp Light Lichtsnoer 200 lm", decathlonRef: "8649378", weightG: null, category: "Lighting", brand: "Quechua", notes: "200 lm, USB-C, 6u" },
  { name: "Flashlight TL 100", decathlonRef: "8948415", weightG: null, category: "Lighting", brand: "Quechua", notes: "100 lm, Batteries" },
  { name: "Flashlight 500 zoom", decathlonRef: "8501304", weightG: null, category: "Lighting", brand: "Quechua", notes: "500 lm, Batteries" },
  { name: "Flashlight Dynamo 100", decathlonRef: "8665145", weightG: null, category: "Lighting", brand: "Quechua", notes: "15 lm, Dynamo" },
  { name: "Flashlight Dynamo 500", decathlonRef: "8665147", weightG: null, category: "Lighting", brand: "Quechua", notes: "150 lm, Dynamo+USB" },
  { name: "Flashlight Dynamo 900 PWB", decathlonRef: "8665150", weightG: null, category: "Lighting", brand: "Quechua", notes: "210 lm, Dynamo+USB" },
  { name: "Flashlight 900 lumen", decathlonRef: "8501305", weightG: null, category: "Lighting", brand: "Quechua", notes: "900 lm, Micro-USB" },

  // ---- HEADLAMPS (Quechua + Simond) ----
  { name: "Headlamp HL50 LM", decathlonRef: "8786370", weightG: 80, category: "Lighting", brand: "Quechua", notes: "50 lm, 2 AAA, 20m" },
  { name: "Headlamp Onnight 100 80 LM", decathlonRef: "8384891", weightG: 80, category: "Lighting", brand: "Quechua", notes: "80 lm, 3 AAA, 25m" },
  { name: "Headlamp HL100 USB", decathlonRef: "8505882", weightG: 72, category: "Lighting", brand: "Quechua", notes: "120 lm, Micro-USB, 25m" },
  { name: "Headlamp HL500", decathlonRef: "8919550", weightG: 90, category: "Lighting", brand: "Simond", notes: "500 lm, USB-C, 65m" },
  { name: "Headlamp HL900", decathlonRef: "8979230", weightG: 105, category: "Lighting", brand: "Simond", notes: "900 lm, Batteries+USB-C, 120m" },
  { name: "Headlamp Petzl Actik Core 550", decathlonRef: "8511135", weightG: 88, category: "Lighting", brand: "Petzl", notes: "625 lm, USB-C, 115m" },
  { name: "Headlamp ML 200", decathlonRef: "8978237", weightG: 74, category: "Lighting", brand: "Simond", notes: "200 lm, USB-C, 30m" },
  { name: "Headlamp UL 200", decathlonRef: "8787287", weightG: 42, category: "Lighting", brand: "Simond", notes: "200 lm, USB-C, 70m" },
  { name: "Headlamp Sprint 400", decathlonRef: "8858783", weightG: 105, category: "Lighting", brand: "Simond", notes: "400 lm, USB-C, 85m" },
  { name: "Headlamp Sprint 900", decathlonRef: "8813317", weightG: 139, category: "Lighting", brand: "Simond", notes: "900 lm, Micro-USB, 150m" },
  { name: "Headlamp Petzl Swift RL", decathlonRef: "9012843", weightG: 102, category: "Lighting", brand: "Petzl", notes: "1100 lm, USB-C, 165m" },
  { name: "Headlamp Petzl Swift LT", decathlonRef: "9012845", weightG: 43, category: "Lighting", brand: "Petzl", notes: "380 lm, USB-C, 30m" },
];

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  const uri = process.env.MONGO_URI;
  const dbName = process.env.MONGO_DB_NAME;
  if (!uri || !dbName) {
    console.error("Missing MONGO_URI or MONGO_DB_NAME");
    process.exit(1);
  }

  await mongoose.connect(uri, { dbName: "TrekList" });
  console.log("Connected to DB:", mongoose.connection.name);

  // 1. Fetch all Decathlon-brand CatalogItems
  const DECATHLON_BRANDS = ["forclaz", "quechua", "simond", "decathlon"];
  const catalogItems = await CatalogItem.find({
    $or: [
      { brandLC: { $in: DECATHLON_BRANDS } },
    ],
  }).lean();

  // 2. Also fetch any awin offers linked to catalog items to enrich data
  const catalogItemIds = catalogItems.map((ci) => ci._id);
  const awinOffers = await MerchantOffer.find({
    network: "awin",
    productId: { $in: catalogItemIds },
  }).lean();

  // Build a map: productId -> [offers]
  const offersByProductId = {};
  for (const offer of awinOffers) {
    const key = offer.productId.toString();
    if (!offersByProductId[key]) offersByProductId[key] = [];
    offersByProductId[key].push(offer);
  }

  console.log(`Found ${catalogItems.length} Decathlon catalog items`);
  console.log(`Found ${awinOffers.length} linked awin offers`);

  // 3. Build Excel workbook
  const wb = new ExcelJS.Workbook();
  wb.creator = "TrekList Export";
  wb.created = new Date();

  // ---- Sheet 1: Current DB Items ----
  const dbSheet = wb.addWorksheet("DB Items (Decathlon)");
  dbSheet.columns = [
    { header: "DB ID", key: "dbId", width: 26 },
    { header: "Name", key: "name", width: 40 },
    { header: "Brand", key: "brand", width: 16 },
    { header: "Model Number", key: "modelNumber", width: 20 },
    { header: "Category", key: "category", width: 18 },
    { header: "Subcategory", key: "subcategory", width: 18 },
    { header: "Item Type", key: "itemType", width: 24 },
    { header: "Weight (g)", key: "weightGrams", width: 12 },
    { header: "Attributes", key: "attributes", width: 50 },
    { header: "Canonical SKU", key: "canonicalSku", width: 18 },
    { header: "Item Group ID", key: "itemGroupId", width: 18 },
    { header: "EAN", key: "ean", width: 16 },
    { header: "Has Awin Offer", key: "hasAwin", width: 14 },
    { header: "Awin Merchant(s)", key: "awinMerchants", width: 30 },
    { header: "Awin Region(s)", key: "awinRegions", width: 18 },
    { header: "Active", key: "isActive", width: 10 },
    { header: "Image Count", key: "imageCount", width: 12 },
    { header: "Created", key: "createdAt", width: 20 },
  ];

  // Style header row
  dbSheet.getRow(1).font = { bold: true };
  dbSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4472C4" },
  };
  dbSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  for (const item of catalogItems) {
    const idStr = item._id.toString();
    const offers = offersByProductId[idStr] || [];
    const merchants = [...new Set(offers.map((o) => o.merchantName || o.merchantId))].join(", ");
    const regions = [...new Set(offers.map((o) => o.region))].join(", ");
    const attrStr = item.attributes
      ? Object.entries(item.attributes)
          .map(([k, v]) => `${k}: ${v}`)
          .join(" | ")
      : "";

    dbSheet.addRow({
      dbId: idStr,
      name: item.name,
      brand: item.brand || "",
      modelNumber: item.modelNumber || "",
      category: item.category || "",
      subcategory: item.subcategory || "",
      itemType: item.itemType || "",
      weightGrams: item.weightGrams ?? "",
      attributes: attrStr,
      canonicalSku: item.canonicalSku || "",
      itemGroupId: item.itemGroupId || "",
      ean: item.externalIds?.ean || "",
      hasAwin: offers.length > 0 ? "YES" : "NO",
      awinMerchants: merchants,
      awinRegions: regions,
      isActive: item.isActive ? "YES" : "NO",
      imageCount: (item.imageUrls || []).length,
      createdAt: item.createdAt ? item.createdAt.toISOString().split("T")[0] : "",
    });
  }

  // Zebra stripe
  dbSheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
    }
  });

  // ---- Sheet 2: Image Products ----
  const imgSheet = wb.addWorksheet("Products from Photos");
  imgSheet.columns = [
    { header: "Name", key: "name", width: 45 },
    { header: "Decathlon Ref", key: "decathlonRef", width: 16 },
    { header: "Brand", key: "brand", width: 16 },
    { header: "Weight (g)", key: "weightG", width: 12 },
    { header: "Category", key: "category", width: 18 },
    { header: "Notes", key: "notes", width: 50 },
    { header: "In DB?", key: "inDb", width: 10 },
    { header: "DB Match Name", key: "dbMatchName", width: 45 },
    { header: "DB ID", key: "dbId", width: 26 },
  ];
  imgSheet.getRow(1).font = { bold: true };
  imgSheet.getRow(1).fill = {
    type: "pattern", pattern: "solid", fgColor: { argb: "FF70AD47" },
  };
  imgSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  // Build lookup sets for matching: by canonicalSku, modelNumber, externalIds.ean, externalIds.sku, itemGroupId
  const dbRefSet = new Set();
  const dbRefToItem = {};
  for (const item of catalogItems) {
    const refs = [
      item.canonicalSku,
      item.modelNumber,
      item.externalIds?.ean,
      item.externalIds?.sku,
      item.externalIds?.mpn,
      item.itemGroupId,
    ].filter(Boolean).map(String);
    for (const r of refs) {
      dbRefSet.add(r.trim());
      dbRefToItem[r.trim()] = item;
    }
  }

  // ---- Sheet 3: NOT in DB (the gap list) ----
  const missingSheet = wb.addWorksheet("NOT in DB (Add These)");
  missingSheet.columns = [
    { header: "Name", key: "name", width: 45 },
    { header: "Decathlon Ref", key: "decathlonRef", width: 16 },
    { header: "Brand", key: "brand", width: 16 },
    { header: "Weight (g)", key: "weightG", width: 12 },
    { header: "Category", key: "category", width: 18 },
    { header: "Notes", key: "notes", width: 50 },
  ];
  missingSheet.getRow(1).font = { bold: true };
  missingSheet.getRow(1).fill = {
    type: "pattern", pattern: "solid", fgColor: { argb: "FFFF0000" },
  };
  missingSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  let missingCount = 0;

  for (const prod of IMAGE_PRODUCTS) {
    const ref = (prod.decathlonRef || "").trim();
    let match = null;
    if (ref && dbRefSet.has(ref)) {
      match = dbRefToItem[ref];
    }

    // Also try loose name-based match as fallback
    if (!match && prod.name) {
      const lowerName = prod.name.toLowerCase();
      match = catalogItems.find(
        (ci) =>
          ci.name && ci.name.toLowerCase().includes(lowerName.split(" ").slice(-1)[0])
      );
    }

    const inDb = !!match;

    imgSheet.addRow({
      name: prod.name,
      decathlonRef: prod.decathlonRef,
      brand: prod.brand,
      weightG: prod.weightG ?? "",
      category: prod.category,
      notes: prod.notes,
      inDb: inDb ? "YES" : "NO",
      dbMatchName: match ? match.name : "",
      dbId: match ? match._id.toString() : "",
    });

    // Color the "In DB?" cell
    const lastRow = imgSheet.lastRow;
    const inDbCell = lastRow.getCell("inDb");
    inDbCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: inDb ? "FFC6EFCE" : "FFFFC7CE" },
    };

    if (!inDb) {
      missingSheet.addRow({
        name: prod.name,
        decathlonRef: prod.decathlonRef,
        brand: prod.brand,
        weightG: prod.weightG ?? "",
        category: prod.category,
        notes: prod.notes,
      });
      missingCount++;
    }
  }

  // Zebra for missing sheet
  missingSheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF0F0" } };
    }
  });

  // ---- Summary sheet ----
  const summarySheet = wb.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Metric", key: "metric", width: 40 },
    { header: "Value", key: "value", width: 20 },
  ];
  summarySheet.getRow(1).font = { bold: true };
  summarySheet.addRows([
    { metric: "Decathlon items in DB", value: catalogItems.length },
    { metric: "Items with awin offers", value: Object.keys(offersByProductId).length },
    { metric: "Total items extracted from photos", value: IMAGE_PRODUCTS.length },
    { metric: "Items from photos NOT in DB", value: missingCount },
    { metric: "Items from photos already in DB", value: IMAGE_PRODUCTS.length - missingCount },
    { metric: "Export date", value: new Date().toISOString().split("T")[0] },
  ]);

  // Save
  const outPath = path.join(
    process.env.HOME,
    "Desktop",
    "decathlon_items_export.xlsx"
  );
  await wb.xlsx.writeFile(outPath);
  console.log(`\nExport written to: ${outPath}`);
  console.log(`  DB Items sheet:       ${catalogItems.length} rows`);
  console.log(`  Photo products sheet: ${IMAGE_PRODUCTS.length} rows`);
  console.log(`  NOT in DB sheet:      ${missingCount} rows`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
