// test-attributeSchemas.js
// Run this with: node test-attributeSchemas.js
// This verifies the attributeSchemas.js file works correctly before you integrate it

const {
  getAllItemTypes,
  getSchemaForItemType,
  getFieldsForItemType,
  isValidItemType,
  validateAttributes,
  migrateAttributes,
  parseTemperature,
  parseFillPower,
  parseGender,
} = require("./attributeSchemas");

console.log("=".repeat(60));
console.log("ATTRIBUTE SCHEMAS TEST");
console.log("=".repeat(60));

// Test 1: Get all item types
console.log("\n1. All supported item types:");
const itemTypes = getAllItemTypes();
console.log(`   Found ${itemTypes.length} item types:`);
itemTypes.forEach((t) => console.log(`   - ${t}`));

// Test 2: Check specific item type
console.log('\n2. Schema for "Sleeping Bag (Down)":');
const sleepingBagSchema = getSchemaForItemType("Sleeping Bag (Down)");
if (sleepingBagSchema) {
  console.log("   Fields:");
  Object.entries(sleepingBagSchema.fields).forEach(([key, field]) => {
    const req = field.required ? "(required)" : "";
    console.log(`   - ${key}: ${field.type} ${req}`);
  });
} else {
  console.log("   ERROR: Schema not found!");
}

// Test 3: Validate valid attributes
console.log("\n3. Validating VALID sleeping bag attributes:");
const validAttrs = {
  tempRatingF: 20,
  fillPower: 850,
  shape: "Mummy",
  gender: "Mens",
};
const validResult = validateAttributes("Sleeping Bag (Down)", validAttrs);
console.log(`   Valid: ${validResult.valid}`);
console.log(
  `   Errors: ${validResult.errors.length === 0 ? "None" : validResult.errors.join(", ")}`,
);
console.log(`   Cleaned:`, validResult.cleaned);
console.log(`   Derived tempRatingC: ${validResult.cleaned.tempRatingC}°C`);

// Test 4: Validate invalid attributes
console.log(
  "\n4. Validating INVALID sleeping bag attributes (missing required fields):",
);
const invalidAttrs = {
  tempRatingF: 20,
  // Missing: fillPower, shape, gender
};
const invalidResult = validateAttributes("Sleeping Bag (Down)", invalidAttrs);
console.log(`   Valid: ${invalidResult.valid}`);
console.log(`   Errors:`);
invalidResult.errors.forEach((e) => console.log(`   - ${e}`));

// Test 5: Test migration from old format
console.log("\n5. Migrating OLD format attributes:");
const oldAttrs = {
  "Temperature rating": "30°F (-1°C)",
  Fill: "900 fill-power",
  Shape: "Mummy",
  "Gender / Fit": "Women",
  "Random Field": "some value", // Should end up in unmapped
};
const migrationResult = migrateAttributes("Sleeping Bag (Down)", oldAttrs);
console.log("   Old format:", oldAttrs);
console.log("   Migrated:", migrationResult.migrated);
console.log("   Unmapped:", migrationResult.unmapped);
console.log("   Warnings:", migrationResult.warnings);

// Test 6: Test backpack validation
console.log("\n6. Validating Backpack:");
const backpackAttrs = {
  volumeLiters: 45,
  gender: "Unisex",
  frameType: "Frameless",
  rainCoverIncluded: true,
};
const backpackResult = validateAttributes("Backpack", backpackAttrs);
console.log(`   Valid: ${backpackResult.valid}`);
console.log(`   Cleaned:`, backpackResult.cleaned);

// Test 7: Parse helpers
console.log("\n7. Testing parse helpers:");
console.log(
  '   parseTemperature("30°F (-1°C)"):',
  parseTemperature("30°F (-1°C)"),
);
console.log('   parseTemperature("20"):', parseTemperature("20"));
console.log(
  '   parseFillPower("900 fill-power"):',
  parseFillPower("900 fill-power"),
);
console.log('   parseGender("Women\'s"):', parseGender("Women's"));
console.log('   parseGender("M"):', parseGender("M"));

// Test 8: Invalid item type
console.log("\n8. Testing invalid item type:");
console.log(
  `   isValidItemType("Sleeping Bag (Down)"): ${isValidItemType("Sleeping Bag (Down)")}`,
);
console.log(
  `   isValidItemType("Made Up Item"): ${isValidItemType("Made Up Item")}`,
);

// Test 9: Get fields for UI
console.log("\n9. Fields for UI rendering (Headlamp):");
const headlampFields = getFieldsForItemType("Headlamp");
console.log(`   ${headlampFields.length} fields for Headlamp:`);
headlampFields.slice(0, 5).forEach((f) => {
  console.log(
    `   - ${f.key}: ${f.label} (${f.type}${f.required ? ", required" : ""})`,
  );
});
console.log("   ...");

console.log("\n" + "=".repeat(60));
console.log("ALL TESTS COMPLETE");
console.log("=".repeat(60));
console.log(
  "\nIf you see no ERROR messages above, the file is working correctly!",
);
console.log(
  "Copy attributeSchemas.js to: server/src/config/attributeSchemas.js",
);
