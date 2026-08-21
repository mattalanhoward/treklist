// client/src/pages/AdminView.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import api from "../services/api";
import {
  CATALOG_CATEGORIES,
  buildCategoryOptions,
  buildSubcategoryOptions,
} from "../config/catalogTaxonomy";
import { toast } from "react-hot-toast";
import { FiEdit2, FiX, FiChevronUp, FiChevronDown, FiUsers, FiUser, FiCopy, FiExternalLink, FiCheck, FiSlash } from "react-icons/fi";

function ImageStatusCell({ imageUrls }) {
  // Health probe: must check the original stored URL, never a resized variant.
  const firstUrl = Array.isArray(imageUrls) && imageUrls[0] ? imageUrls[0] : null;
  const [status, setStatus] = useState(firstUrl ? "loading" : "none");

  useEffect(() => {
    if (!firstUrl) { setStatus("none"); return; }
    setStatus("loading");
    const img = new Image();
    img.onload = () => setStatus("ok");
    img.onerror = () => setStatus("error");
    img.src = firstUrl;
  }, [firstUrl]);

  if (status === "none") return <span className="text-primary/30">–</span>;
  if (status === "loading") return <span className="text-primary/40 text-xs">…</span>;
  if (status === "ok") return <FiCheck className="text-success" title="Image loaded" />;
  return <FiSlash className="text-error" title="Image failed (404 or broken)" />;
}
import ConfirmDialog from "../components/ConfirmDialog";
import { useUserSettings } from "../contexts/UserSettings";
import AttributeFields, {
  getItemTypesForCategory,
  getSchemaForItemType,
} from "../components/AttributeFields";
import VariantEditor from "../components/VariantEditor";
import { resizedImageUrl } from "../utils/imageCdn";

const TABS = [
  { id: "gearCatalog", label: "Gear catalog" },
  { id: "gearCreate", label: "Add catalog item" },
  { id: "qa", label: "QA / Reports" },
  { id: "users", label: "Users" },
  { id: "lists", label: "Public lists" },
  { id: "community", label: "Community" },
];

// Field labels for the catalog report queue (mirror the report popover).
const REPORT_FIELD_LABELS = {
  weight: "Weight incorrect",
  category: "Wrong category / type",
  name: "Name / brand wrong",
  image: "Image / link broken",
  other: "Something else",
};

const NETWORK_OPTIONS = [
  { value: "", label: "Select…" },
  { value: "amazon", label: "Amazon" },
  { value: "awin", label: "Awin" },
  { value: "impact", label: "Impact" },
  { value: "direct", label: "Direct / Brand (no network)" },
];

const REGION_OPTIONS = [
  { value: "global", label: "Global" },
  { value: "eu", label: "EU (all EU countries)" },
  { value: "us", label: "US" },
  { value: "uk", label: "UK" },
  { value: "de", label: "DE" },
  { value: "fr", label: "FR" },
  { value: "it", label: "IT" },
  { value: "es", label: "ES" },
  { value: "nl", label: "NL" },
  { value: "ca", label: "CA" },
  { value: "se", label: "SE" },
  { value: "pl", label: "PL" },
];

const AMAZON_BASE_BY_MP = {
  us: "https://www.amazon.com",
  uk: "https://www.amazon.co.uk",
  de: "https://www.amazon.de",
  fr: "https://www.amazon.fr",
  it: "https://www.amazon.it",
  es: "https://www.amazon.es",
  nl: "https://www.amazon.nl",
  ca: "https://www.amazon.ca",
  se: "https://www.amazon.se",
  pl: "https://www.amazon.pl",
};

function blankOffer() {
  return {
    network: "",
    region: "global",
    url: "",
    merchantName: "",
    externalId: "",
    priority: undefined,
  };
}

function extractAsinFromAmazonUrl(url) {
  try {
    const u = new URL(url);
    const p = u.pathname || "";
    const m =
      p.match(/\/dp\/([A-Z0-9]{10})(?:[/?]|$)/i) ||
      p.match(/\/gp\/product\/([A-Z0-9]{10})(?:[/?]|$)/i);
    return m ? m[1].toUpperCase() : null;
  } catch {
    return null;
  }
}

function marketplaceFromAmazonUrlClient(url) {
  try {
    const host = new URL(url).hostname
      .toLowerCase()
      .replace(/^smile\./, "")
      .replace(/^www\./, "");
    if (host === "amazon.com") return "us";
    if (host === "amazon.co.uk") return "uk";
    if (host === "amazon.de") return "de";
    if (host === "amazon.fr") return "fr";
    if (host === "amazon.it") return "it";
    if (host === "amazon.es") return "es";
    if (host === "amazon.nl") return "nl";
    if (host === "amazon.ca") return "ca";
    if (host === "amazon.se") return "se";
    if (host === "amazon.pl") return "pl";
    return "us";
  } catch {
    return "us";
  }
}

const getPrimaryOffer = (f) =>
  Array.isArray(f?.offers) && f.offers[0] ? f.offers[0] : blankOffer();

function hasMissingRequiredAttributes(itemType, attributes, variants) {
  const schema = getSchemaForItemType(itemType);
  if (!schema) return false;
  const variantList = Array.isArray(variants) ? variants : [];
  const hasValue = (v) => v !== undefined && v !== null && v !== "";
  return Object.entries(schema.fields).some(([key, field]) => {
    if (!field.required || field.derived) return false;
    if (hasValue(attributes?.[key])) return false;
    // A required attribute that varies per variant (e.g. a sleeping bag's
    // temp rating) is satisfied when EVERY variant overrides it.
    if (
      variantList.length &&
      variantList.every((v) => hasValue(v?.attributes?.[key]))
    ) {
      return false;
    }
    return true;
  });
}

// "Yellow" items: missing weight or missing required attributes (or untyped).
// Mirrors the per-tab completeness dots in the edit modal.
function isItemIncomplete(item) {
  const variants = Array.isArray(item.variants) ? item.variants : [];
  const hasBaseWeight = typeof item.weightGrams === "number";
  const missingWeight = variants.length
    ? !hasBaseWeight && variants.some((v) => typeof v.weightGrams !== "number")
    : !hasBaseWeight;
  if (missingWeight) return true;
  if (!item.itemType) return true;
  return hasMissingRequiredAttributes(
    item.itemType,
    item.attributes,
    item.variants,
  );
}

function toOptionalNumber(val) {
  if (val === "" || val === null || val === undefined) return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}

// ---------------------------------------------------------------------------
// Decathlon import panel
// ---------------------------------------------------------------------------
function DecathlonImportPanel({ onImported, onEditItem }) {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [importingId, setImportingId] = useState(null);
  const [searchError, setSearchError] = useState("");

  const isCode = /^\d+$/.test(query.trim());

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchError("");
    setResults([]);
    try {
      const params = isCode ? { code: query.trim() } : { q: query.trim() };
      const { data } = await api.get("/admin/awin/search", { params });
      setResults(data);
      if (data.length === 0) setSearchError("No products found.");
    } catch (err) {
      setSearchError(err?.response?.data?.message || "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function handleImport(product) {
    setImportingId(product.externalProductId);
    try {
      const { data } = await api.post("/admin/awin/import", { externalProductId: product.externalProductId });
      toast.success(`Imported: ${product.name}`);
      setResults((prev) =>
        prev.map((r) =>
          r.externalProductId === product.externalProductId
            ? { ...r, alreadyImported: true }
            : r
        )
      );
      onImported?.();
      if (data?.catalogItem) onEditItem?.(data.catalogItem);
    } catch (err) {
      const msg = err?.response?.data?.message || "Import failed.";
      if (err?.response?.status === 409) {
        toast(`Already in catalog: ${product.name}`);
      } else {
        toast.error(msg);
      }
    } finally {
      setImportingId(null);
    }
  }

  return (
    <div className="bg-neutralAlt rounded-lg shadow-2xl border border-primary overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 border-b border-base-200">
        <div>
          <h3 className="text-sm font-semibold text-primary">Import from Decathlon UK</h3>
          <p className="text-[11px] text-primary/70">
            Enter a product code (from the Decathlon URL) or search by name.
          </p>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className="btn btn-ghost btn-xs text-primary">
          {open ? <FiChevronUp /> : <FiChevronDown />}
        </button>
      </div>

      {open && (
        <div className="px-4 py-4 sm:px-6 space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              className="input input-sm input-bordered flex-1"
              placeholder="Decathlon product ID (shown on product page, e.g. 8882673) or name"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setResults([]); setSearchError(""); }}
            />
            <button type="submit" className="btn btn-sm btn-primary" disabled={searching || !query.trim()}>
              {searching ? "Searching..." : "Search"}
            </button>
          </form>

          {searchError && <p className="text-xs text-error">{searchError}</p>}

          {results.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {results.map((product) => (
                <div key={product.externalProductId} className="border border-base-200 rounded-lg overflow-hidden flex flex-col">
                  {product.imageUrl && (
                    <img
                      src={resizedImageUrl(product.imageUrl, 400)}
                      alt={product.name}
                      className="w-full h-36 object-contain bg-base-100 p-2"
                    />
                  )}
                  <div className="p-3 flex flex-col gap-1 flex-1">
                    <p className="text-xs font-semibold text-primary leading-snug">{product.name}</p>
                    <p className="text-[11px] text-primary/60">{product.brand}</p>
                    {product.colour && <p className="text-[11px] text-primary/50">{product.colour}</p>}
                    <div className="flex items-center justify-between mt-auto pt-2">
                      <div className="text-[11px] text-primary/60 space-y-0.5">
                        {product.price != null && <p>£{product.price.toFixed(2)}</p>}
                        {product.deliveryWeightKg != null && (
                          <p>{Math.round(product.deliveryWeightKg * 1000)}g</p>
                        )}
                      </div>
                      {product.alreadyImported ? (
                        <span className="text-[11px] text-success flex items-center gap-1">
                          <FiCheck size={12} /> In catalog
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-xs btn-primary"
                          disabled={importingId === product.externalProductId}
                          onClick={() => handleImport(product)}
                        >
                          {importingId === product.externalProductId ? "Importing..." : "Import"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GearCatalogSection({
  mode = "both",
  onDuplicate,
  duplicateSeed,
  onSeedConsumed,
}) {
  const [items, setItems] = useState([]);
  const [allBrands, setAllBrands] = useState([]); // whole-catalog brands for the filter dropdown
  const [serverTotal, setServerTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const searchTimerRef = useRef(null);
  const [editingItem, setEditingItem] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [archivingId, setArchivingId] = useState(null);

  const [showArchived, setShowArchived] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(true);
  const [showListBody, setShowListBody] = useState(true);

  // Filters / sorting
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterBrand, setFilterBrand] = useState("all");
  const [filterNetwork, setFilterNetwork] = useState("all");
  const [filterImage, setFilterImage] = useState("all");
  const [filterCompleteness, setFilterCompleteness] = useState("all");
  const [sort, setSort] = useState({ field: "updatedAt", dir: "desc" });

  // Pagination
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const [creating, setCreating] = useState(false);
  const [prefillLoading, setPrefillLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    brand: "",
    category: "",
    subcategory: "",
    itemType: "",
    modelNumber: "",
    description: "",
    weightGrams: "",
    dimLength: "",
    dimWidth: "",
    dimHeight: "",
    dimNote: "",
    tags: "",
    imageUrlsText: "",
    canonicalAsin: "",
    itemGroupId: "",
    attributes: {}, // Structured attributes object

    // Prefill controls (decoupled from offer network)
    prefillSource: "none", // "none" | "amazon" (future: "rei", etc)
    prefillOverwrite: false,
    amazonAsinLookup: "",

    amazonMarketplace: "us",

    // IMPORTANT: this UI uses offers[] (not links[])
    offers: [blankOffer()],
  });

  const categorySelectOptions = buildCategoryOptions({
    existing: [],
    current: form.category,
  });

  const loadItems = async ({ includeArchived } = {}) => {
    setLoading(true);
    setError("");
    try {
      const archived = includeArchived ?? showArchived;
      const params = {
        isActive: archived ? "all" : "true",
        skip: page * pageSize,
        limit: pageSize,
        sortField: sort.field,
        sortDir: sort.dir,
      };
      if (search.trim()) params.q = search.trim();
      if (filterCategory !== "all") params.category = filterCategory;
      if (filterBrand !== "all") params.brand = filterBrand;

      const { data } = await api.get("/admin/catalog-items", { params });
      setItems(data?.items || []);
      setServerTotal(data?.total ?? 0);
    } catch (err) {
      console.error("Failed to load CatalogItems", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load catalog items.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch on page or sort change immediately; debounce search/filter changes
  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed && trimmed.length < 3) return; // wait for at least 3 chars
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(loadItems, trimmed ? 500 : 0);
    return () => clearTimeout(searchTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, filterCategory, filterBrand, showArchived, sort.field, sort.dir]);

  // Load the full catalog's distinct brands once, so the brand filter isn't limited
  // to the current page of results.
  useEffect(() => {
    let cancelled = false;
    api
      .get("/admin/catalog-items/brands")
      .then(({ data }) => {
        if (!cancelled) setAllBrands(data?.brands || []);
      })
      .catch((err) => console.error("Failed to load brands", err));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!duplicateSeed) return;
    if (mode === "list") return;

    const src = duplicateSeed;
    const dims = src?.dimensions || {};

    setForm((prev) => ({
      ...prev,

      // ✅ human-readable/spec fields
      name: src?.name ? `${src.name} (copy)` : "",
      brand: src?.brand || "",
      category: src?.category || "",
      subcategory: src?.subcategory || "",
      itemType: src?.itemType || "",
      modelNumber: src?.modelNumber || "",
      description: src?.description || "",
      attributes: src?.attributes || {},
      weightGrams:
        typeof src?.weightGrams === "number" ? String(src.weightGrams) : "",
      dimLength: typeof dims.length === "number" ? String(dims.length) : "",
      dimWidth: typeof dims.width === "number" ? String(dims.width) : "",
      dimHeight: typeof dims.height === "number" ? String(dims.height) : "",
      dimNote: typeof dims.note === "string" ? dims.note : "",

      tags: Array.isArray(src?.tags) ? src.tags.join(", ") : "",
      imageUrlsText: Array.isArray(src?.imageUrls)
        ? src.imageUrls.join("\n")
        : "",

      // 🚫 NOT duplicated (per your requirement)
      canonicalAsin: "",
      itemGroupId: "",
      offers: [blankOffer()], // empty offer slate

      // keep prefill out of the way for this workflow
      prefillSource: "none",
      prefillOverwrite: false,
      amazonAsinLookup: "",
      amazonMarketplace: "us",
    }));

    toast.success(
      "Duplicated into Add catalog item. Update name + offers, then save.",
      { id: "catalog-duplicate" },
    );
    onSeedConsumed?.();
  }, [duplicateSeed, mode, onSeedConsumed]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const updateOffer = (idx, key, value) => {
    setForm((prev) => {
      const offers = Array.isArray(prev.offers) ? [...prev.offers] : [];
      while (offers.length <= idx) offers.push(blankOffer());

      const next = { ...offers[idx], [key]: value };

      // ✅ If Amazon URL pasted, fill externalId automatically (if empty)
      if (key === "url") {
        const net = String(next.network || "").toLowerCase();
        if (net === "amazon") {
          const asin = extractAsinFromAmazonUrl(String(value || ""));
          if (asin) next.externalId = asin;
          if (!String(next.merchantName || "").trim()) {
            next.merchantName = "Amazon";
          }
        }
      }

      offers[idx] = next;
      return { ...prev, offers };
    });
  };

  const addOffer = () => {
    setForm((prev) => ({
      ...prev,
      offers: [
        ...(Array.isArray(prev.offers) ? prev.offers : []),
        { ...blankOffer(), network: "amazon" },
      ],
    }));
  };

  const removeOffer = (idx) => {
    setForm((prev) => {
      const offers = Array.isArray(prev.offers) ? [...prev.offers] : [];
      offers.splice(idx, 1);
      // keep at least one offer
      return { ...prev, offers: offers.length ? offers : [blankOffer()] };
    });
  };

  // helper: treat an offer as "meaningful" if *any* field is filled
  const isMeaningfulOffer = (o) => {
    const url = String(o.url || "").trim();
    const merchantName = String(o.merchantName || "").trim();
    const externalId = String(o.externalId || "").trim();
    const priority = String(o.priority ?? "").trim(); // only meaningful if user set it
    return Boolean(url || merchantName || externalId || priority);
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) return toast.error("Name is required.");

    // 1) Only validate offers the user actually started filling out
    const meaningfulOffers = (
      Array.isArray(form.offers) ? form.offers : []
    ).filter(isMeaningfulOffer);

    // 2) If they started an offer row, require network + url for THAT row
    const hasInvalidOffer = meaningfulOffers.some(
      (o) => !String(o.network || "").trim() || !String(o.url || "").trim(),
    );
    if (hasInvalidOffer) {
      return toast.error("Each offer must have a network and URL.");
    }

    // (keep your Amazon rewrite check)
    // Attributes are already structured - just pass them through
    const attributes =
      form.attributes && Object.keys(form.attributes).length > 0
        ? form.attributes
        : undefined;

    setCreating(true);
    try {
      const imageUrls = form.imageUrlsText
        ? form.imageUrlsText
            .split(/\r?\n/)
            .map((u) => u.trim())
            .filter(Boolean)
        : [];

      const offersPayload = meaningfulOffers.map((o) => ({
        network: String(o.network || "")
          .trim()
          .toLowerCase(),
        region: String(o.region || "global")
          .trim()
          .toLowerCase(),
        deepLink: String(o.url || "").trim(),
        merchantName: o.merchantName
          ? String(o.merchantName).trim()
          : undefined,
        externalProductId: o.externalId
          ? String(o.externalId).trim()
          : undefined,
        priority: toOptionalNumber(o.priority) ?? 0,
      }));

      const payload = {
        name: form.name.trim(),
        brand: form.brand.trim() || undefined,
        category: form.category.trim() || undefined,
        subcategory: form.subcategory.trim() || undefined,
        itemType: form.itemType.trim() || undefined,
        modelNumber: form.modelNumber.trim() || undefined,
        description: form.description.trim() || undefined,
        attributes,
        weightGrams: toOptionalNumber(form.weightGrams),
        dimensions:
          form.dimLength ||
          form.dimWidth ||
          form.dimHeight ||
          String(form.dimNote || "").trim()
            ? {
                length:
                  form.dimLength === "" ? undefined : Number(form.dimLength),
                width: form.dimWidth === "" ? undefined : Number(form.dimWidth),
                height:
                  form.dimHeight === "" ? undefined : Number(form.dimHeight),
                unit: "cm",
                note: String(form.dimNote || "").trim() || undefined,
              }
            : undefined,
        tags: form.tags
          ? form.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        imageUrls,
        canonicalAsin: form.canonicalAsin.trim() || undefined,
        itemGroupId: form.itemGroupId.trim() || undefined,

        // ✅ optional offers: omit if none
        ...(offersPayload.length ? { offers: offersPayload } : {}),
        // or if your server prefers it always present: offers: offersPayload
      };

      await api.post("/admin/catalog-items", payload);
      toast.success("Catalog item created.");

      setForm({
        name: "",
        brand: "",
        category: "",
        subcategory: "",
        itemType: "",
        modelNumber: "",
        description: "",
        weightGrams: "",
        dimLength: "",
        dimWidth: "",
        dimHeight: "",
        dimNote: "",
        tags: "",
        imageUrlsText: "",
        canonicalAsin: "",
        itemGroupId: "",
        prefillSource: "none",
        prefillOverwrite: false,
        amazonAsinLookup: "",
        amazonMarketplace: "us",
        offers: [blankOffer()],
        attributes: {},
      });

      loadItems({ includeArchived: showArchived });
    } catch (err) {
      console.error("Failed to create CatalogItem", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to create catalog item.";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleAmazonLookup = async () => {
    if (String(form.prefillSource || "none") !== "amazon") {
      toast.error("Set Prefill source to Amazon to use ASIN lookup.");
      return;
    }

    const asin = String(form.amazonAsinLookup || "")
      .trim()
      .toUpperCase();
    if (!/^[A-Z0-9]{10}$/.test(asin)) {
      toast.error("Enter a valid 10-character ASIN.");
      return;
    }

    const marketplace = String(form.amazonMarketplace || "us")
      .trim()
      .toLowerCase();
    const region = String(getPrimaryOffer(form).region || "global")
      .trim()
      .toLowerCase();

    setPrefillLoading(true);
    try {
      const { data } = await api.post("/admin/amazon/lookup", {
        asin,
        marketplace,
        region,
      });

      const prefill = data?.prefill || {};
      const offer = data?.offer || {};
      const existingItems = data?.existingItems || [];
      if (existingItems.length > 0) {
        const names = existingItems.map((i) => i.name).join(", ");
        toast(
          `Duplicate ASIN: ${asin} already exists as "${names}"`,
          { duration: 8000, icon: "⚠️" },
        );
      }

      const base = AMAZON_BASE_BY_MP[marketplace] || AMAZON_BASE_BY_MP.us;
      const fallbackUrl = `${base}/dp/${asin}`;
      const nextLinkUrl =
        typeof offer.deepLink === "string" && offer.deepLink.trim()
          ? offer.deepLink.trim()
          : fallbackUrl;

      setForm((prev) => {
        const overwrite = Boolean(prev.prefillOverwrite);
        const pick = (current, next) => {
          const nextVal =
            typeof next === "string" ? next.trim() : (next ?? undefined);
          if (nextVal == null || nextVal === "") return current;
          if (overwrite) return nextVal;
          return String(current || "").trim() ? current : nextVal;
        };
        const nextOffers = Array.isArray(prev.offers) ? [...prev.offers] : [];
        if (!nextOffers[0]) nextOffers[0] = blankOffer();

        // Prefill should NOT clobber offers unless overwrite=true or offer is empty
        const primary = nextOffers[0] || blankOffer();
        const primaryUrlEmpty = !String(primary.url || "").trim();
        const primaryIdEmpty = !String(primary.externalId || "").trim();
        if (overwrite || primaryUrlEmpty) {
          primary.url = nextLinkUrl;
        }
        if (overwrite || primaryIdEmpty) {
          primary.externalId = asin;
        }
        if (!String(primary.merchantName || "").trim()) {
          primary.merchantName = "Amazon";
        }
        // Auto-set network to amazon when fetching from Amazon
        if (!String(primary.network || "").trim() || overwrite) {
          primary.network = "amazon";
        }
        nextOffers[0] = { ...primary };

        const nextDescription = pick(
          prev.description,
          typeof prefill.description === "string" ? prefill.description : "",
        );
        return {
          ...prev,
          name: pick(prev.name, prefill.name),
          brand: pick(prev.brand, prefill.brand),
          description: nextDescription,
          modelNumber: pick(prev.modelNumber, prefill.modelNumber),
          weightGrams:
            typeof prefill.weightGrams === "number"
              ? overwrite || !String(prev.weightGrams || "").trim()
                ? String(prefill.weightGrams)
                : prev.weightGrams
              : prev.weightGrams,
          dimLength:
            typeof prefill?.dimensions?.length === "number" &&
            prefill.dimensions.length > 0
              ? overwrite || !String(prev.dimLength || "").trim()
                ? String(prefill.dimensions.length)
                : prev.dimLength
              : prev.dimLength,
          dimWidth:
            typeof prefill?.dimensions?.width === "number" &&
            prefill.dimensions.width > 0
              ? overwrite || !String(prev.dimWidth || "").trim()
                ? String(prefill.dimensions.width)
                : prev.dimWidth
              : prev.dimWidth,
          dimHeight:
            typeof prefill?.dimensions?.height === "number" &&
            prefill.dimensions.height > 0
              ? overwrite || !String(prev.dimHeight || "").trim()
                ? String(prefill.dimensions.height)
                : prev.dimHeight
              : prev.dimHeight,
          imageUrlsText:
            Array.isArray(prefill.imageUrls) && prefill.imageUrls.length
              ? overwrite || !String(prev.imageUrlsText || "").trim()
                ? prefill.imageUrls.join("\n")
                : prev.imageUrlsText
              : prev.imageUrlsText,
          canonicalAsin:
            overwrite || !String(prev.canonicalAsin || "").trim()
              ? asin
              : prev.canonicalAsin,
          category:
            prefill.suggestedCategory
              ? overwrite || !String(prev.category || "").trim()
                ? prefill.suggestedCategory
                : prev.category
              : prev.category,
          itemType:
            prefill.suggestedItemType
              ? overwrite || !String(prev.itemType || "").trim()
                ? prefill.suggestedItemType
                : prev.itemType
              : prev.itemType,
          offers: nextOffers,
        };
      });

      if (prefill.suggestedItemType) {
        toast.success(
          `Amazon data loaded. Auto-detected: ${prefill.suggestedCategory} / ${prefill.suggestedItemType}`,
        );
      } else {
        toast.success("Amazon data loaded. Review prefilled fields.");
      }
    } catch (err) {
      console.error("Amazon lookup failed", err);
      const msg =
        err?.response?.data?.message || err?.message || "Amazon lookup failed.";
      toast.error(msg);
    } finally {
      setPrefillLoading(false);
    }
  };

  const getPrimaryItemOffer = (item) => {
    const offer =
      (Array.isArray(item?.offers) && item.offers[0]) ||
      (Array.isArray(item?.links) && item.links[0]) ||
      null;

    // normalize deepLink/url to one "url" field if you ever need it
    if (!offer) return null;

    return {
      ...offer,
      url: String(offer.deepLink || offer.url || "").trim(),
    };
  };

  const handleArchiveToggle = async (item, nextIsActive) => {
    setArchivingId(item._id);
    try {
      await api.patch(`/admin/catalog-items/${item._id}/archive`, {
        isActive: nextIsActive,
      });
      toast.success(
        nextIsActive ? `Unarchived "${item.name}"` : `Archived "${item.name}"`,
      );
      loadItems({ includeArchived: showArchived });
    } catch (err) {
      console.error("Failed to update CatalogItem archive state", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to update catalog item.";
      toast.error(msg);
    } finally {
      setArchivingId(null);
    }
  };

  const handleEditSaved = () => {
    setEditingItem(null);
    loadItems({ includeArchived: showArchived });
  };

  const categoryOptions = useMemo(() => {
    const existing = Array.from(
      new Set(items.map((i) => i.category).filter(Boolean)),
    );
    return buildCategoryOptions({ existing });
  }, [items]);

  const brandOptions = useMemo(() => {
    // Prefer the whole-catalog brand list; fall back to the current page's brands
    // until it loads (or if the request failed) so the dropdown is never empty.
    if (allBrands.length) return allBrands;
    return Array.from(new Set(items.map((i) => i.brand).filter(Boolean))).sort();
  }, [allBrands, items]);

  const networkOptions = useMemo(() => {
    const nets = items
      .map((i) => getPrimaryItemOffer(i)?.network || null)
      .filter(Boolean);
    return Array.from(new Set(nets)).sort();
  }, [items]);

  // Search, category, brand are handled server-side.
  // Network and image filters apply client-side to the current page.
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const mainOffer = getPrimaryItemOffer(item);
      const itemNetwork = mainOffer?.network || "";
      const networkMatches = filterNetwork === "all" || itemNetwork === filterNetwork;
      const hasImage = Array.isArray(item.imageUrls) && item.imageUrls.length > 0;
      const imageMatches =
        filterImage === "all" ||
        (filterImage === "has_image" && hasImage) ||
        (filterImage === "no_image" && !hasImage);
      const completenessMatches =
        filterCompleteness === "all" ||
        (filterCompleteness === "incomplete" && isItemIncomplete(item)) ||
        (filterCompleteness === "complete" && !isItemIncomplete(item));
      return networkMatches && imageMatches && completenessMatches;
    });
  }, [items, filterNetwork, filterImage, filterCompleteness]);

  const sortedItems = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;

    return filteredItems.slice().sort((a, b) => {
      const mainOfferA = getPrimaryItemOffer(a);
      const mainOfferB = getPrimaryItemOffer(b);

      switch (sort.field) {
        case "name": {
          const na = (a.name || "").toLowerCase();
          const nb = (b.name || "").toLowerCase();
          return na.localeCompare(nb) * dir;
        }
        case "category": {
          const ca = (a.category || "").toLowerCase();
          const cb = (b.category || "").toLowerCase();
          return ca.localeCompare(cb) * dir;
        }
        case "brand": {
          const ba = (a.brand || "").toLowerCase();
          const bb = (b.brand || "").toLowerCase();
          return ba.localeCompare(bb) * dir;
        }
        case "subcategory": {
          const sa = (a.subcategory || "").toLowerCase();
          const sb = (b.subcategory || "").toLowerCase();
          return sa.localeCompare(sb) * dir;
        }
        case "itemType": {
          const ia = (a.itemType || "").toLowerCase();
          const ib = (b.itemType || "").toLowerCase();
          return ia.localeCompare(ib) * dir;
        }
        case "network": {
          const na = (mainOfferA?.network || "").toLowerCase();
          const nb = (mainOfferB?.network || "").toLowerCase();
          return na.localeCompare(nb) * dir;
        }
        case "weightGrams": {
          const wa =
            typeof a.weightGrams === "number"
              ? a.weightGrams
              : Number.POSITIVE_INFINITY;
          const wb =
            typeof b.weightGrams === "number"
              ? b.weightGrams
              : Number.POSITIVE_INFINITY;
          if (wa === wb) return 0;
          return wa > wb ? dir : -dir;
        }
        case "updatedAt":
        default: {
          const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          if (ta === tb) return 0;
          return ta > tb ? dir : -dir;
        }
      }
    });
  }, [filteredItems, sort]);

  const totalItems = serverTotal;
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageItems = sortedItems;

  const sortArrow = (field) => {
    if (sort.field !== field) return null;
    return (
      <span className="ml-1 text-[10px]">{sort.dir === "asc" ? "↑" : "↓"}</span>
    );
  };

  const handleSort = (field) => {
    setSort((prev) => {
      if (prev.field === field)
        return { field, dir: prev.dir === "asc" ? "desc" : "asc" };
      return { field, dir: "asc" };
    });
  };

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-primary">
            Gear catalog (admin-curated)
          </h2>
          <p className="text-xs text-primary/80 max-w-2xl">
            Add affiliate-backed catalog items (Amazon now, Awin/Impact later).
          </p>
        </div>
      </div>

      {/* DECATHLON IMPORT */}
      {mode !== "list" && (
        <DecathlonImportPanel
          onImported={loadItems}
          onEditItem={(item) => setEditingItem(item)}
        />
      )}

      {/* CREATE */}
      {mode !== "list" && (
        <div className="bg-neutralAlt rounded-lg shadow-2xl border border-primary overflow-hidden">
          {/* Create header */}
          <div className="flex items-center justify-between px-4 py-3 sm:px-6 border-b border-base-200">
            <div>
              <h3 className="text-sm font-semibold text-primary">
                Add catalog item
              </h3>
              <p className="text-[11px] text-primary/70">
                Flow: (Optional) Amazon Prefill → Basics → Media & Specs → Offer
                → Save
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateForm((v) => !v)}
              className="btn btn-ghost btn-xs text-primary"
              title={showCreateForm ? "Hide create form" : "Show create form"}
            >
              {showCreateForm ? <FiChevronUp /> : <FiChevronDown />}
            </button>
          </div>

          {showCreateForm && (
            <form
              onSubmit={handleCreate}
              className="px-4 py-4 sm:px-6 sm:py-6 space-y-5"
            >
              {/* 0) PREFILL SOURCE (decoupled from offers) */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-primary/80">
                  Prefill source
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-start">
                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      Source
                    </label>
                    <select
                      name="prefillSource"
                      value={form.prefillSource || "none"}
                      onChange={handleChange}
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt"
                    >
                      <option value="none">None</option>
                      <option value="amazon">Amazon</option>
                      <option value="rei" disabled>
                        REI (soon)
                      </option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 text-[11px] text-primary/70 mt-6 sm:mt-0">
                    Prefill should be used mainly during creation; edits are
                    usually manual unless you’re refreshing stale specs.
                  </div>
                </div>
              </div>
              {/* 1) AMAZON PREFILL (decoupled from offer network) */}
              {String(form.prefillSource || "none") === "amazon" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-primary/80">
                        Amazon prefill (optional)
                      </div>
                      <div className="text-[11px] text-primary/70">
                        Pulls name/brand/description/images. You must rewrite
                        the description.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAmazonLookup}
                      disabled={creating || prefillLoading}
                      className={`px-2 py-1 rounded bg-secondary text-white hover:bg-secondary/80 ${
                        creating || prefillLoading
                          ? "opacity-60 cursor-not-allowed"
                          : ""
                      }`}
                      title="Fetch product data by ASIN"
                    >
                      {prefillLoading
                        ? "Fetching..."
                        : "Fetch from Amazon"}{" "}
                    </button>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-primary">
                    <input
                      type="checkbox"
                      name="prefillOverwrite"
                      checked={Boolean(form.prefillOverwrite)}
                      onChange={handleChange}
                      className="checkbox checkbox-xs"
                    />
                    <span>Overwrite existing fields when applying prefill</span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <label className="block font-medium text-primary mb-0.5">
                        ASIN
                      </label>
                      <input
                        type="text"
                        name="amazonAsinLookup"
                        value={form.amazonAsinLookup}
                        onChange={handleChange}
                        className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                        placeholder="B0XXXXXXXX"
                        maxLength={10}
                      />
                    </div>

                    <div>
                      <label className="block font-medium text-primary mb-0.5">
                        Marketplace
                      </label>
                      <select
                        name="amazonMarketplace"
                        value={form.amazonMarketplace}
                        onChange={handleChange}
                        className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt"
                      >
                        <option value="us">US</option>
                        <option value="uk">UK</option>
                        <option value="de">DE</option>
                        <option value="fr">FR</option>
                        <option value="it">IT</option>
                        <option value="es">ES</option>
                        <option value="nl">NL</option>
                        <option value="ca">CA</option>
                        <option value="se">SE</option>
                        <option value="pl">PL</option>
                      </select>
                    </div>
                  </div>

                </div>
              )}
              {/* 2) BASICS */}
              <div className="space-y-3 border-t border-base-200 pt-4">
                <div className="text-xs font-semibold text-primary/80">
                  Basics
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* Row 1 */}
                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      Brand
                    </label>
                    <input
                      type="text"
                      name="brand"
                      value={form.brand}
                      onChange={handleChange}
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                      placeholder="Nemo"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      Item name *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                      placeholder="Nemo Hornet OSMO 2P"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      Model number
                    </label>
                    <input
                      type="text"
                      name="modelNumber"
                      value={form.modelNumber}
                      onChange={handleChange}
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                      placeholder="Manufacturer model code"
                    />
                  </div>

                  {/* Row 2 */}
                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      Category
                    </label>
                    <select
                      name="category"
                      value={form.category}
                      onChange={handleChange}
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt"
                    >
                      <option value="">Select a category…</option>
                      {categorySelectOptions.map((cat) => {
                        const isLegacy = !CATALOG_CATEGORIES.includes(cat);
                        return (
                          <option key={cat} value={cat}>
                            {isLegacy ? `${cat} (legacy)` : cat}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      Subcategory
                    </label>
                    <select
                      name="subcategory"
                      value={form.subcategory}
                      onChange={handleChange}
                      disabled={!form.category}
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt disabled:opacity-50"
                    >
                      <option value="">None</option>
                      {buildSubcategoryOptions(form.category, { current: form.subcategory }).map((sub) => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      Item type
                    </label>
                    <select
                      name="itemType"
                      value={form.itemType}
                      onChange={(e) => {
                        const newItemType = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          itemType: newItemType,
                          // Clear attributes when item type changes
                          attributes: {},
                        }));
                      }}
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt"
                    >
                      <option value="">Select item type…</option>
                      {getItemTypesForCategory(form.category).map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 3) MEDIA & SPECS */}
              <div className="space-y-3 border-t border-base-200 pt-4">
                <div className="text-xs font-semibold text-primary/80">
                  Media & specs
                </div>

                <div>
                  <label className="block font-medium text-primary mb-0.5">
                    Attributes
                  </label>
                  <AttributeFields
                    itemType={form.itemType}
                    attributes={form.attributes}
                    onChange={(newAttrs) =>
                      setForm((prev) => ({ ...prev, attributes: newAttrs }))
                    }
                  />
                </div>

                <div>
                  <label className="block font-medium text-primary mb-0.5">
                    Weight / Dimensions
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
                    <input
                      type="number"
                      name="weightGrams"
                      value={form.weightGrams}
                      onChange={handleChange}
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                      placeholder="Weight (g)"
                      min="0"
                    />
                    <input
                      type="number"
                      name="dimLength"
                      value={form.dimLength}
                      onChange={handleChange}
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                      placeholder="L"
                      min="0"
                      step="0.1"
                    />
                    <input
                      type="number"
                      name="dimWidth"
                      value={form.dimWidth}
                      onChange={handleChange}
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                      placeholder="W"
                      min="0"
                      step="0.1"
                    />
                    <input
                      type="number"
                      name="dimHeight"
                      value={form.dimHeight}
                      onChange={handleChange}
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                      placeholder="H"
                      min="0"
                      step="0.1"
                    />
                    <div className="mt-0.5 w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt flex items-center justify-center">
                      <span className="text-xs font-semibold tracking-wide">
                        cm
                      </span>
                    </div>
                    <input
                      type="text"
                      name="dimNote"
                      value={form.dimNote || ""}
                      onChange={handleChange}
                      placeholder="Note"
                      className="sm:col-span-2 mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt"
                    />
                  </div>
                  <span className="block text-[11px] text-primary/70">
                    Dimensions stored as L × W × H (cm). Note: e.g. "Packed", "Varies by size"
                  </span>
                </div>

                <div>
                  <label className="block font-medium text-primary mb-0.5">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary resize-y"
                    rows={3}
                    placeholder="Short blurb to help you recognize the item when importing."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      Image URLs
                    </label>
                    <textarea
                      name="imageUrlsText"
                      value={form.imageUrlsText}
                      onChange={handleChange}
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary resize-y"
                      rows={2}
                      placeholder="One image URL per line"
                    />
                    <span className="block text-[11px] text-primary/70">
                      First URL will be used as the primary image.
                    </span>
                  </div>

                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      name="tags"
                      value={form.tags}
                      onChange={handleChange}
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                      placeholder="3-season, tent, 1p"
                    />
                  </div>
                </div>
              </div>

              {/* 4) PRIMARY OFFER */}
              <div className="space-y-3 border-t border-base-200 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-primary/80">
                      Primary offer
                    </div>
                    <div className="text-[11px] text-primary/70">
                      This is the default link shown when users import this
                      item.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addOffer}
                    className="btn btn-ghost btn-xs text-primary"
                  >
                    + Add offer
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div className="sm:col-span-2">
                    <label className="block font-medium text-primary mb-0.5">
                      Affiliate URL *
                    </label>
                    <input
                      type="url"
                      value={getPrimaryOffer(form).url || ""}
                      onChange={(e) => updateOffer(0, "url", e.target.value)}
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                      placeholder="https://www.amazon.com/dp/ASIN/?tag=yourtag-20"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      Network *
                    </label>
                    <select
                      value={getPrimaryOffer(form).network || ""}
                      onChange={(e) =>
                        updateOffer(0, "network", e.target.value)
                      }
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt"
                    >
                      {NETWORK_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      Region
                    </label>
                    <select
                      value={getPrimaryOffer(form).region || "global"}
                      onChange={(e) => updateOffer(0, "region", e.target.value)}
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt"
                    >
                      {REGION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      Merchant name
                    </label>
                    <input
                      type="text"
                      value={getPrimaryOffer(form).merchantName || ""}
                      onChange={(e) =>
                        updateOffer(0, "merchantName", e.target.value)
                      }
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                      placeholder="Amazon / Bergfreunde / REI"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      External ID
                    </label>
                    <input
                      type="text"
                      value={getPrimaryOffer(form).externalId || ""}
                      onChange={(e) =>
                        updateOffer(0, "externalId", e.target.value)
                      }
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                      placeholder="ASIN, Awin product id..."
                    />
                    <span className="block text-[11px] text-primary/70">
                      ASIN (Amazon) / product id (Awin, Impact)
                    </span>
                  </div>

                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      Link priority
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={Number(getPrimaryOffer(form).priority ?? 10)}
                      onChange={(e) =>
                        updateOffer(0, "priority", Number(e.target.value) || 0)
                      }
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                      placeholder="10"
                    />
                    <span className="block text-[11px] text-primary/70">
                      Higher wins if multiple links exist for a region.
                    </span>
                  </div>
                </div>
              </div>

              {/* 5) Additional offers */}
              {Array.isArray(form.offers) && form.offers.length > 1 && (
                <div className="space-y-2 border-t border-base-200 pt-4">
                  <div className="text-xs font-semibold text-primary/80">
                    Additional offers
                  </div>

                  {form.offers.slice(1).map((offer, i) => {
                    const idx = i + 1;
                    return (
                      <div
                        key={idx}
                        className="border border-primary/40 rounded p-2 bg-neutralAlt/40"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs text-primary/80">
                            Offer #{idx + 1}
                          </div>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs text-error"
                            onClick={() => removeOffer(idx)}
                            title="Remove offer"
                          >
                            <FiX />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <div>
                            <label className="block font-medium text-primary mb-0.5">
                              Network *
                            </label>
                            <select
                              value={offer.network || "amazon"}
                              onChange={(e) =>
                                updateOffer(idx, "network", e.target.value)
                              }
                              className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt"
                            >
                              {NETWORK_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block font-medium text-primary mb-0.5">
                              Region
                            </label>
                            <select
                              value={offer.region || "global"}
                              onChange={(e) =>
                                updateOffer(idx, "region", e.target.value)
                              }
                              className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt"
                            >
                              {REGION_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block font-medium text-primary mb-0.5">
                              Affiliate URL *
                            </label>
                            <input
                              type="url"
                              value={offer.url || ""}
                              onChange={(e) =>
                                updateOffer(idx, "url", e.target.value)
                              }
                              className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                          <div>
                            <label className="block font-medium text-primary mb-0.5">
                              Merchant name
                            </label>
                            <input
                              type="text"
                              value={offer.merchantName || ""}
                              onChange={(e) =>
                                updateOffer(idx, "merchantName", e.target.value)
                              }
                              className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                            />
                          </div>

                          <div>
                            <label className="block font-medium text-primary mb-0.5">
                              External ID
                            </label>
                            <input
                              type="text"
                              value={offer.externalId || ""}
                              onChange={(e) =>
                                updateOffer(idx, "externalId", e.target.value)
                              }
                              className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                            />
                          </div>

                          <div>
                            <label className="block font-medium text-primary mb-0.5">
                              Link priority
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={Number(offer.priority ?? 10)}
                              onChange={(e) =>
                                updateOffer(
                                  idx,
                                  "priority",
                                  Number(e.target.value) || 0,
                                )
                              }
                              className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 5) IDS */}
              <div className="space-y-3 border-t border-base-200 pt-4">
                <div className="text-xs font-semibold text-primary/80">IDs</div>
                <div>
                  <label className="block font-medium text-primary mb-0.5">
                    Canonical ASIN (optional)
                  </label>
                  <input
                    type="text"
                    name="canonicalAsin"
                    value={form.canonicalAsin}
                    onChange={handleChange}
                    className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                    placeholder="Main ASIN for this product"
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-2 pt-3 border-t border-base-200">
                <button
                  type="submit"
                  disabled={creating}
                  className={`px-2 py-1 rounded bg-secondary text-white hover:bg-secondary/80 ${
                    creating ? "opacity-60 cursor-not-allowed" : ""
                  }`}
                >
                  {creating ? "Saving..." : "Add to catalog"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* LIST */}
      {mode !== "create" && (
        <div className="border border-base-300 rounded-lg bg-base-100/80 overflow-auto">
          {/* List header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-base-200 text-xs text-primary/80">
            <span>
              {loading
                ? "Loading catalog items..."
                : showArchived
                  ? `Catalog items (including archived): ${serverTotal}`
                  : `Active catalog items: ${serverTotal}`}
            </span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  className="checkbox checkbox-xs"
                  checked={showArchived}
                  onChange={(e) => {
                    const include = e.target.checked;
                    setShowArchived(include);
                    setPage(0);
                    loadItems({ includeArchived: include });
                  }}
                />
                <span>Show archived</span>
              </label>

              <button
                type="button"
                onClick={() => loadItems({ includeArchived: showArchived })}
                disabled={loading}
                className="btn btn-ghost btn-xs"
              >
                Refresh
              </button>

              <button
                type="button"
                onClick={() => setShowListBody((v) => !v)}
                className="btn btn-ghost btn-xs"
                title={showListBody ? "Hide catalog list" : "Show catalog list"}
              >
                {showListBody ? <FiChevronUp /> : <FiChevronDown />}
              </button>
            </div>
          </div>

          {showListBody && (
            <>
              {error && !loading && (
                <div className="px-3 py-2 text-xs text-error">{error}</div>
              )}

              {!loading && !error && (
                <>
                  {/* Filters */}
                  <div className="px-3 py-2 border-b border-base-200 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between text-xs">
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        className="input input-xs input-bordered w-full"
                        placeholder="Search name, brand, category, tags..."
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setPage(0);
                        }}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <select
                        className="select select-xs select-bordered"
                        value={filterCategory}
                        onChange={(e) => {
                          setFilterCategory(e.target.value);
                          setPage(0);
                        }}
                      >
                        <option value="all">All categories</option>
                        {categoryOptions.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>

                      <select
                        className="select select-xs select-bordered"
                        value={filterBrand}
                        onChange={(e) => {
                          setFilterBrand(e.target.value);
                          setPage(0);
                        }}
                      >
                        <option value="all">All brands</option>
                        {brandOptions.map((brand) => (
                          <option key={brand} value={brand}>
                            {brand}
                          </option>
                        ))}
                      </select>

                      <select
                        className="select select-xs select-bordered"
                        value={filterNetwork}
                        onChange={(e) => {
                          setFilterNetwork(e.target.value);
                          setPage(0);
                        }}
                      >
                        <option value="all">All networks</option>
                        {networkOptions.map((net) => (
                          <option key={net} value={net}>
                            {net}
                          </option>
                        ))}
                      </select>

                      <select
                        className="select select-xs select-bordered"
                        value={filterImage}
                        onChange={(e) => {
                          setFilterImage(e.target.value);
                          setPage(0);
                        }}
                      >
                        <option value="all">All images</option>
                        <option value="has_image">Has image</option>
                        <option value="no_image">No image</option>
                      </select>

                      <select
                        className="select select-xs select-bordered"
                        value={filterCompleteness}
                        onChange={(e) => {
                          setFilterCompleteness(e.target.value);
                          setPage(0);
                        }}
                        title="Incomplete = missing weight (base or per-variant), untyped, or missing required attributes"
                      >
                        <option value="all">All items</option>
                        <option value="incomplete">Incomplete only</option>
                        <option value="complete">Complete only</option>
                      </select>
                    </div>
                  </div>

                  {items.length === 0 && (
                    <div className="px-3 py-2 text-xs text-primary/70">
                      {search.trim() || filterCategory !== "all" || filterBrand !== "all" || filterNetwork !== "all" || filterImage !== "all" || filterCompleteness !== "all"
                        ? "No items match your search. Try a different term or clear the filters."
                        : "No catalog items yet. Use the form above to add your first affiliate-backed gear item."}
                    </div>
                  )}

                  {items.length > 0 && (
                  <>
                  {/* Table */}
                  <table className="min-w-full text-xs sm:text-sm">
                    <thead className="bg-base-200/80">
                      <tr>
                        <th
                          className="text-left px-3 py-2 font-semibold cursor-pointer select-none"
                          onClick={() => handleSort("brand")}
                        >
                          Brand {sortArrow("brand")}
                        </th>

                        <th
                          className="text-left px-3 py-2 font-semibold cursor-pointer select-none"
                          onClick={() => handleSort("name")}
                        >
                          Name {sortArrow("name")}
                        </th>

                        <th
                          className="text-left px-3 py-2 font-semibold cursor-pointer select-none"
                          onClick={() => handleSort("category")}
                        >
                          Category {sortArrow("category")}
                        </th>

                        <th
                          className="text-left px-3 py-2 font-semibold cursor-pointer select-none"
                          onClick={() => handleSort("subcategory")}
                        >
                          Subcategory {sortArrow("subcategory")}
                        </th>

                        <th
                          className="text-left px-3 py-2 font-semibold cursor-pointer select-none"
                          onClick={() => handleSort("itemType")}
                        >
                          Item type {sortArrow("itemType")}
                        </th>

                        <th
                          className="text-left px-3 py-2 font-semibold cursor-pointer select-none"
                          onClick={() => handleSort("network")}
                        >
                          Network / Region {sortArrow("network")}
                        </th>

                        <th
                          className="text-right px-3 py-2 font-semibold cursor-pointer select-none"
                          onClick={() => handleSort("weightGrams")}
                        >
                          Weight {sortArrow("weightGrams")}
                        </th>

                        <th className="text-center px-3 py-2 font-semibold">
                          Image
                        </th>

                        <th className="text-left px-3 py-2 font-semibold">
                          Status
                        </th>

                        <th
                          className="text-right px-3 py-2 font-semibold cursor-pointer select-none"
                          onClick={() => handleSort("updatedAt")}
                        >
                          Updated {sortArrow("updatedAt")}
                        </th>

                        <th className="text-right px-3 py-2 font-semibold">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {pageItems.map((item) => {
                        const id = item._id || item.id;
                        const mainOffer = getPrimaryItemOffer(item);

                        const updated =
                          item.updatedAt &&
                          !Number.isNaN(Date.parse(item.updatedAt))
                            ? new Date(item.updatedAt).toLocaleDateString()
                            : "–";

                        return (
                          <tr
                            key={id}
                            className={
                              "border-t border-base-200 hover:bg-base-200/40 " +
                              (!item.isActive ? "opacity-60" : "")
                            }
                          >
                            <td className="px-3 py-2 align-top">
                              {item.brand || "–"}
                            </td>
                            <td className="px-3 py-2 align-top">
                              <button
                                type="button"
                                onClick={() => setViewingItem(item)}
                                className="text-left text-primary hover:opacity-60 transition-opacity"
                              >
                                {item.name}
                              </button>
                            </td>
                            <td className="px-3 py-2 align-top">
                              {item.category || "–"}
                            </td>
                            <td className="px-3 py-2 align-top">
                              {item.subcategory || "–"}
                            </td>
                            <td className="px-3 py-2 align-top">
                              {item.itemType || "–"}
                            </td>

                            <td className="px-3 py-2 align-top">
                              {mainOffer
                                ? `${mainOffer.network} / ${
                                    mainOffer.region || "global"
                                  }`
                                : "–"}
                            </td>

                            <td className="px-3 py-2 text-right align-top whitespace-nowrap">
                              {typeof item.weightGrams === "number"
                                ? `${item.weightGrams} g`
                                : "–"}
                              {Array.isArray(item.variants) &&
                                item.variants.length > 0 && (
                                  <span
                                    className="ml-1 text-[10px] text-primary/50"
                                    title={`${item.variants.length} variants`}
                                  >
                                    ×{item.variants.length}
                                  </span>
                                )}
                            </td>

                            <td className="px-3 py-2 text-center align-top">
                              <ImageStatusCell imageUrls={item.imageUrls} />
                            </td>

                            <td className="px-3 py-2 text-left align-top">
                              <span
                                className={
                                  "badge badge-xs " +
                                  (item.isActive
                                    ? "badge-success"
                                    : "badge-ghost")
                                }
                              >
                                {item.isActive ? "Active" : "Archived"}
                              </span>
                              {isItemIncomplete(item) && (
                                <span
                                  className="inline-block w-2 h-2 rounded-full bg-warning ml-1.5"
                                  title="Incomplete: missing weight, untyped, or missing required attributes"
                                />
                              )}
                            </td>

                            <td className="px-3 py-2 text-right align-top">
                              {updated}
                            </td>

                            <td className="px-3 py-2 text-right align-top">
                              <div className="inline-flex items-center gap-2 justify-end">
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs"
                                  onClick={() => setEditingItem(item)}
                                  title="Edit catalog item"
                                >
                                  <FiEdit2 />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onDuplicate?.(item);
                                  }}
                                  title="Duplicate (copy fields into Add catalog item)"
                                >
                                  <FiCopy />
                                </button>
                                <button
                                  type="button"
                                  className={
                                    "btn btn-xs " +
                                    (item.isActive
                                      ? "btn-outline btn-error"
                                      : "btn-outline")
                                  }
                                  disabled={archivingId === id}
                                  onClick={() =>
                                    handleArchiveToggle(item, !item.isActive)
                                  }
                                >
                                  {archivingId === id
                                    ? item.isActive
                                      ? "Archiving..."
                                      : "Unarchiving..."
                                    : item.isActive
                                      ? "Archive"
                                      : "Unarchive"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  <div className="flex items-center justify-between px-3 py-2 border-t border-base-200 text-xs text-primary/80">
                    <span>
                      Showing {totalItems === 0 ? 0 : currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, totalItems)}{" "}
                      of {totalItems}
                    </span>

                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1">
                        <span>Rows</span>
                        <select
                          className="select select-xs select-bordered"
                          value={pageSize}
                          onChange={(e) => {
                            const next = Number(e.target.value) || 25;
                            setPageSize(next);
                            setPage(0);
                          }}
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </label>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          disabled={currentPage === 0}
                          onClick={() => setPage((p) => Math.max(0, p - 1))}
                        >
                          Previous
                        </button>
                        <span>
                          Page {currentPage + 1} of {pageCount}
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          disabled={currentPage >= pageCount - 1}
                          onClick={() =>
                            setPage((p) => Math.min(pageCount - 1, p + 1))
                          }
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                  </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {editingItem && (
        <EditCatalogItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={handleEditSaved}
        />
      )}

      {viewingItem && (
        <ViewCatalogItemModal
          item={viewingItem}
          onClose={() => setViewingItem(null)}
        />
      )}
    </section>
  );
}

function ViewCatalogItemModal({ item, onClose }) {
  const imageUrl = Array.isArray(item.imageUrls) && item.imageUrls[0];
  const weightOz = item.weightGrams
    ? (item.weightGrams / 28.3495).toFixed(1)
    : null;

  const offers = Array.isArray(item.offers) ? item.offers : [];

  const attrEntries = item.attributes
    ? Object.entries(item.attributes).filter(([, v]) => v !== null && v !== undefined && v !== "")
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-base-100 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-200">
          <h2 className="text-base font-semibold text-primary">Item Details</h2>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-xs text-error"
          >
            <FiX />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Image */}
          {imageUrl && (
            <div className="flex justify-center">
              <img
                src={resizedImageUrl(imageUrl, 400)}
                alt={item.name}
                className="max-h-48 max-w-full object-contain rounded"
              />
            </div>
          )}

          {/* Core fields */}
          <div className="space-y-2 text-sm">
            {item.itemType && (
              <div className="flex gap-2">
                <span className="font-medium text-primary w-28 shrink-0">Item type:</span>
                <span className="text-primary">{item.itemType}</span>
              </div>
            )}
            <div className="flex gap-2">
              <span className="font-medium text-primary w-28 shrink-0">Name:</span>
              <span className="text-primary">{item.name}</span>
            </div>
            {item.brand && (
              <div className="flex gap-2">
                <span className="font-medium text-primary w-28 shrink-0">Brand:</span>
                <span className="text-primary">{item.brand}</span>
              </div>
            )}
            {item.modelNumber && (
              <div className="flex gap-2">
                <span className="font-medium text-primary w-28 shrink-0">Model #:</span>
                <span className="text-primary">{item.modelNumber}</span>
              </div>
            )}
            {item.category && (
              <div className="flex gap-2">
                <span className="font-medium text-primary w-28 shrink-0">Category:</span>
                <span className="text-primary">
                  {item.category}{item.subcategory ? ` / ${item.subcategory}` : ""}
                </span>
              </div>
            )}
            {weightOz && (
              <div className="flex gap-2">
                <span className="font-medium text-primary w-28 shrink-0">Weight:</span>
                <span className="text-primary">{weightOz} oz ({item.weightGrams} g)</span>
              </div>
            )}
          </div>

          {/* Attributes */}
          {attrEntries.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-primary uppercase tracking-wide">Attributes</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {attrEntries.map(([k, v]) => (
                  <div key={k} className="flex gap-1">
                    <span className="font-medium text-primary capitalize shrink-0">{k}:</span>
                    <span className="text-primary">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {item.description && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-primary uppercase tracking-wide">Description</div>
              <p className="text-sm text-primary whitespace-pre-line">{item.description}</p>
            </div>
          )}

          {/* Affiliate links */}
          {offers.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-primary uppercase tracking-wide">Affiliate Links</div>
              <div className="space-y-1">
                {offers.map((offer, i) => {
                  const url = offer.deepLink || offer.url || "";
                  return (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-primary shrink-0">
                        {[offer.merchantName, offer.network, offer.region]
                          .filter(Boolean)
                          .join(" / ")}
                        {url ? ":" : ""}
                      </span>
                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 underline truncate hover:opacity-70"
                          title={url}
                        >
                          {url.length > 50 ? url.slice(0, 50) + "…" : url}
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EditCatalogItemModal({ item, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [form, setForm] = useState(() => {
    const dims = item?.dimensions || {};

    // ✅ NEW: prefer item.offers (MerchantOffer docs), fallback to legacy item.links
    const rawOffers =
      Array.isArray(item?.offers) && item.offers.length
        ? item.offers
        : Array.isArray(item?.links) && item.links.length
          ? item.links
          : [];

    const offers =
      rawOffers.length > 0
        ? rawOffers.map((o) => ({
            network: String(o.network || "amazon")
              .trim()
              .toLowerCase(),
            region: String(o.region || "global")
              .trim()
              .toLowerCase(),
            // MerchantOffer uses deepLink; legacy uses url
            url: String(o.deepLink || o.url || "").trim(),
            merchantName: o.merchantName ? String(o.merchantName).trim() : "",
            // MerchantOffer uses externalProductId; legacy uses externalId
            externalId: o.externalProductId
              ? String(o.externalProductId).trim()
              : o.externalId
                ? String(o.externalId).trim()
                : "",
            priority:
              typeof o.priority === "number"
                ? o.priority
                : Number(o.priority) || 0,
          }))
        : [blankOffer()];

    return {
      name: item?.name || "",
      brand: item?.brand || "",
      category: item?.category || "",
      subcategory: item?.subcategory || "",
      itemType: item?.itemType || "",
      modelNumber: item?.modelNumber || "",
      description: item?.description || "",
      attributes: item?.attributes || {},
      weightGrams:
        typeof item?.weightGrams === "number" ? String(item.weightGrams) : "",
      dimLength: typeof dims.length === "number" ? String(dims.length) : "",
      dimWidth: typeof dims.width === "number" ? String(dims.width) : "",
      dimHeight: typeof dims.height === "number" ? String(dims.height) : "",
      dimNote: typeof dims.note === "string" ? dims.note : "",

      tags: Array.isArray(item?.tags) ? item.tags.join(", ") : "",
      imageUrlsText: Array.isArray(item?.imageUrls)
        ? item.imageUrls.join("\n")
        : "",

      canonicalAsin: item?.canonicalAsin || "",
      itemGroupId: item?.itemGroupId || "",

      // Variant matrix (weights kept as strings for the inputs)
      variantAxes: Array.isArray(item?.variantAxes)
        ? item.variantAxes.map((a) => ({
            name: a?.name || "",
            values: Array.isArray(a?.values) ? [...a.values] : [],
          }))
        : [],
      variants: Array.isArray(item?.variants)
        ? item.variants.map((v) => ({
            key: v?.key || "",
            options:
              v?.options && typeof v.options === "object"
                ? { ...v.options }
                : {},
            weightGrams:
              typeof v?.weightGrams === "number" ? String(v.weightGrams) : "",
            sku: v?.sku || "",
            attributes:
              v?.attributes && typeof v.attributes === "object"
                ? { ...v.attributes }
                : {},
          }))
        : [],
      defaultVariantKey: item?.defaultVariantKey || "",

      // Amazon lookup helpers
      amazonAsinLookup:
        item?.canonicalAsin ||
        (offers?.[0]?.network === "amazon" ? offers?.[0]?.externalId : "") ||
        "",

      // Prefill controls (decoupled from offer network)
      // Default to "none" unless primary offer is Amazon
      prefillSource:
        offers?.[0]?.network === "amazon" ? "amazon" : "none",
      prefillOverwrite: false,

      amazonMarketplace:
        marketplaceFromAmazonUrlClient(offers?.[0]?.url || "") || "us",

      // ✅ NEW: state is offers (not links)
      offers,
    };
  });

  const [activeTab, setActiveTab] = useState("details");

  // Locked categories + ensure current value is selectable (legacy-safe)
  const categorySelectOptions = buildCategoryOptions({
    existing: [], // locked list only
    current: form.category,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const getPrimaryOffer = (f) =>
    Array.isArray(f.offers) && f.offers[0] ? f.offers[0] : blankOffer();

  const hasVariants = form.variants.length > 0;

  // Per-tab completeness (drives the yellow dots in the tab bar)
  const tabWarnings = {
    details:
      !form.name.trim() ||
      !form.category ||
      !form.itemType ||
      (!hasVariants && !String(form.weightGrams || "").trim()),
    attributes: hasMissingRequiredAttributes(
      form.itemType,
      form.attributes,
      form.variants,
    ),
    variants:
      hasVariants &&
      form.variants.some((v) => !String(v.weightGrams ?? "").trim()),
    media: !form.imageUrlsText.trim(),
    offers: !(Array.isArray(form.offers) ? form.offers : []).some(
      (o) =>
        String(o.network || "").trim() && String(o.url || "").trim(),
    ),
  };

  const EDIT_TABS = [
    { id: "details", label: "Details" },
    { id: "attributes", label: "Attributes" },
    {
      id: "variants",
      label: hasVariants ? `Variants (${form.variants.length})` : "Variants",
    },
    { id: "media", label: "Media & Description" },
    { id: "offers", label: "Offers" },
  ];

  const updateOffer = (idx, key, value) => {
    setForm((prev) => {
      const offers = Array.isArray(prev.offers) ? [...prev.offers] : [];
      while (offers.length <= idx) offers.push(blankOffer());

      const next = { ...offers[idx], [key]: value };

      // ✅ If Amazon URL pasted, fill externalId automatically (if empty)
      if (key === "url") {
        const net = String(next.network || "").toLowerCase();
        if (net === "amazon") {
          const asin = extractAsinFromAmazonUrl(String(value || ""));
          if (asin) {
            next.externalId = asin; // always sync to URL
          }
          if (!String(next.merchantName || "").trim()) {
            next.merchantName = "Amazon";
          }
        }
      }

      offers[idx] = next;
      return { ...prev, offers };
    });
  };

  const addOffer = () => {
    setForm((prev) => ({
      ...prev,
      offers: [
        ...(Array.isArray(prev.offers) ? prev.offers : []),
        { ...blankOffer(), network: "amazon" },
      ],
    }));
  };

  const removeOffer = (idx) => {
    setForm((prev) => {
      const offers = Array.isArray(prev.offers) ? [...prev.offers] : [];
      offers.splice(idx, 1);
      return { ...prev, offers: offers.length ? offers : prev.offers };
    });
  };

  const handleAmazonLookup = async () => {
    if (String(form.prefillSource || "none") !== "amazon") {
      toast.error("Set Prefill source to Amazon to use ASIN lookup.");
      return;
    }

    const asin = String(getPrimaryOffer(form).externalId || "")
      .trim()
      .toUpperCase();
    if (!/^[A-Z0-9]{10}$/.test(asin)) {
      toast.error("Enter a valid 10-character ASIN.");
      return;
    }

    const marketplace = String(form.amazonMarketplace || "us")
      .trim()
      .toLowerCase();
    const region = String(getPrimaryOffer(form).region || "global")
      .trim()
      .toLowerCase();
    setPrefillLoading(true);
    try {
      const { data } = await api.post("/admin/amazon/lookup", {
        asin,
        marketplace,
        region,
      });

      const prefill = data?.prefill || {};
      const offer = data?.offer || {};
      const existingItems = data?.existingItems || [];
      if (existingItems.length > 0) {
        const names = existingItems.map((i) => i.name).join(", ");
        toast(
          `Duplicate ASIN: ${asin} already exists as "${names}"`,
          { duration: 8000, icon: "⚠️" },
        );
      }

      const mp = String(form.amazonMarketplace || "us").toLowerCase();
      const base = AMAZON_BASE_BY_MP[mp] || AMAZON_BASE_BY_MP.us;
      const fallbackUrl = `${base}/dp/${asin}`;
      const nextLinkUrl =
        typeof offer.deepLink === "string" && offer.deepLink.trim()
          ? offer.deepLink.trim()
          : fallbackUrl;

      setForm((prev) => {
        const overwrite = Boolean(prev.prefillOverwrite);
        const pick = (current, next) => {
          const nextVal =
            typeof next === "string" ? next.trim() : (next ?? undefined);
          if (nextVal == null || nextVal === "") return current;
          if (overwrite) return nextVal;
          return String(current || "").trim() ? current : nextVal;
        };
        const nextOffers = Array.isArray(prev.offers)
          ? [...prev.offers]
          : [blankOffer()];
        if (!nextOffers[0]) nextOffers[0] = blankOffer();
        // Prefill should NOT clobber offers unless overwrite=true or offer is empty
        const primary = nextOffers[0] || blankOffer();
        const primaryUrlEmpty = !String(primary.url || "").trim();
        const primaryIdEmpty = !String(primary.externalId || "").trim();
        if (overwrite || primaryUrlEmpty) primary.url = nextLinkUrl;
        if (overwrite || primaryIdEmpty) primary.externalId = asin;
        if (!String(primary.merchantName || "").trim())
          primary.merchantName = "Amazon";
        // Auto-set network to amazon when fetching from Amazon
        if (!String(primary.network || "").trim() || overwrite) {
          primary.network = "amazon";
        }
        nextOffers[0] = { ...primary };

        const nextDescription = pick(
          prev.description,
          typeof prefill.description === "string" ? prefill.description : "",
        );
        return {
          ...prev,
          name: pick(prev.name, prefill.name),
          brand: pick(prev.brand, prefill.brand),
          description: nextDescription,
          modelNumber: pick(prev.modelNumber, prefill.modelNumber),
          weightGrams:
            typeof prefill.weightGrams === "number"
              ? overwrite || !String(prev.weightGrams || "").trim()
                ? String(prefill.weightGrams)
                : prev.weightGrams
              : prev.weightGrams,
          dimLength:
            typeof prefill?.dimensions?.length === "number" &&
            prefill.dimensions.length > 0
              ? overwrite || !String(prev.dimLength || "").trim()
                ? String(prefill.dimensions.length)
                : prev.dimLength
              : prev.dimLength,
          dimWidth:
            typeof prefill?.dimensions?.width === "number" &&
            prefill.dimensions.width > 0
              ? overwrite || !String(prev.dimWidth || "").trim()
                ? String(prefill.dimensions.width)
                : prev.dimWidth
              : prev.dimWidth,
          dimHeight:
            typeof prefill?.dimensions?.height === "number" &&
            prefill.dimensions.height > 0
              ? overwrite || !String(prev.dimHeight || "").trim()
                ? String(prefill.dimensions.height)
                : prev.dimHeight
              : prev.dimHeight,

          imageUrlsText:
            Array.isArray(prefill.imageUrls) && prefill.imageUrls.length
              ? overwrite || !String(prev.imageUrlsText || "").trim()
                ? prefill.imageUrls.join("\n")
                : prev.imageUrlsText
              : prev.imageUrlsText,
          canonicalAsin:
            overwrite || !String(prev.canonicalAsin || "").trim()
              ? asin
              : prev.canonicalAsin,
          category:
            prefill.suggestedCategory
              ? overwrite || !String(prev.category || "").trim()
                ? prefill.suggestedCategory
                : prev.category
              : prev.category,
          itemType:
            prefill.suggestedItemType
              ? overwrite || !String(prev.itemType || "").trim()
                ? prefill.suggestedItemType
                : prev.itemType
              : prev.itemType,
          offers: nextOffers,
        };
      });

      if (prefill.suggestedItemType) {
        toast.success(
          `Amazon data loaded. Auto-detected: ${prefill.suggestedCategory} / ${prefill.suggestedItemType}`,
        );
      } else {
        toast.success("Amazon data loaded. Review prefilled fields.");
      }
    } catch (err) {
      console.error("Amazon lookup failed", err);
      const msg =
        err?.response?.data?.message || err?.message || "Amazon lookup failed.";
      toast.error(msg);
    } finally {
      setPrefillLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const attributes =
      form.attributes && Object.keys(form.attributes).length > 0
        ? form.attributes
        : undefined;

    if (!form.name.trim()) {
      toast.error("Name is required.");
      return;
    }

    // Only consider offers the user actually started filling out
    const meaningfulOffers = (Array.isArray(form.offers) ? form.offers : []).filter(
      (o) =>
        String(o.url || "").trim() ||
        String(o.merchantName || "").trim() ||
        String(o.externalId || "").trim() ||
        String(o.priority ?? "").trim(),
    );

    if (meaningfulOffers.length === 0) {
      toast.error("At least one offer is required.");
      return;
    }

    if (
      meaningfulOffers.some(
        (o) => !String(o.network || "").trim() || !String(o.url || "").trim(),
      )
    ) {
      toast.error("Each offer must have a network and URL.");
      return;
    }

    setSaving(true);
    try {
      const imageUrls = form.imageUrlsText
        ? form.imageUrlsText
            .split(/\r?\n/)
            .map((u) => u.trim())
            .filter(Boolean)
        : [];

      const payload = {
        name: form.name.trim(),
        brand: form.brand.trim() || undefined,
        category: form.category.trim() || undefined,
        subcategory: form.subcategory.trim() || undefined,
        itemType: form.itemType.trim() || undefined,
        modelNumber: form.modelNumber.trim() || undefined,
        description: form.description.trim() || undefined,
        attributes,
        // With variants, base weight is synced server-side to the default
        // variant's weight — don't send it.
        ...(form.variants.length
          ? {}
          : { weightGrams: toOptionalNumber(form.weightGrams) }),
        dimensions:
          form.dimLength ||
          form.dimWidth ||
          form.dimHeight ||
          String(form.dimNote || "").trim()
            ? {
                length:
                  form.dimLength === "" ? undefined : Number(form.dimLength),
                width: form.dimWidth === "" ? undefined : Number(form.dimWidth),
                height:
                  form.dimHeight === "" ? undefined : Number(form.dimHeight),
                unit: "cm",
                note: String(form.dimNote || "").trim() || undefined,
              }
            : undefined,
        tags: form.tags
          ? form.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        imageUrls,

        canonicalAsin:
          form.canonicalAsin.trim() === "" ? null : form.canonicalAsin.trim(),
        itemGroupId:
          form.itemGroupId.trim() === "" ? null : form.itemGroupId.trim(),

        // Variant matrix. Keys are regenerated server-side from options in
        // axis order; per-variant attributes are validated leniently.
        variantAxes: form.variantAxes
          .filter((a) => String(a.name).trim() && a.values.length)
          .map((a) => ({ name: a.name.trim(), values: a.values })),
        variants: form.variants.map((v) => ({
          key: v.key,
          options: v.options,
          weightGrams: toOptionalNumber(v.weightGrams) ?? null,
          sku: String(v.sku || "").trim() || undefined,
          attributes:
            v.attributes && Object.keys(v.attributes).length
              ? v.attributes
              : undefined,
        })),
        defaultVariantKey: form.defaultVariantKey || undefined,

        // ✅ IMPORTANT: send offers (server reads offers + supports url/deepLink)
        offers: form.offers.map((o) => ({
          network: String(o.network || "")
            .trim()
            .toLowerCase(),
          region: String(o.region || "global")
            .trim()
            .toLowerCase(),
          // server accepts deepLink OR url; sending deepLink is cleanest
          deepLink: String(o.url || "").trim(),
          merchantName: o.merchantName
            ? String(o.merchantName).trim()
            : undefined,
          externalProductId: o.externalId
            ? String(o.externalId).trim()
            : undefined,
          priority: toOptionalNumber(o.priority) ?? 0,
        })),
      };

      await api.patch(`/admin/catalog-items/${item._id}`, payload);
      toast.success("Catalog item updated.");
      onSaved?.();
    } catch (err) {
      console.error("Failed to update CatalogItem", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to update catalog item.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-primary bg-opacity-50 flex items-center justify-center z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-neutralAlt rounded-lg shadow-2xl border border-primary max-w-5xl w-full max-h-[80vh] overflow-y-auto my-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 sm:px-6 border-b border-base-200">
          <h2 className="text-sm font-semibold text-primary">
            Edit catalog item
            {form.name ? (
              <span className="font-normal text-primary/60"> — {form.name}</span>
            ) : null}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="btn btn-ghost btn-xs text-error"
            title="Close"
          >
            <FiX />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 px-4 sm:px-6 pt-2 border-b border-base-200 sticky top-0 bg-neutralAlt z-10">
          {EDIT_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={
                "px-3 py-1.5 text-xs font-semibold rounded-t border-b-2 -mb-px transition-colors " +
                (activeTab === t.id
                  ? "border-secondary text-primary"
                  : "border-transparent text-primary/60 hover:text-primary")
              }
            >
              {t.label}
              {tabWarnings[t.id] && (
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full bg-warning ml-1.5 align-middle"
                  title="Incomplete"
                />
              )}
            </button>
          ))}
        </div>

        <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-3">
          {/* DETAILS TAB */}
          {activeTab === "details" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {/* Row 1 */}
                <div>
                  <label className="block font-medium text-primary mb-0.5">
                    Item name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                  />
                </div>

                <div>
                  <label className="block font-medium text-primary mb-0.5">
                    Brand
                  </label>
                  <input
                    type="text"
                    name="brand"
                    value={form.brand}
                    onChange={handleChange}
                    className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                  />
                </div>

                <div>
                  <label className="block font-medium text-primary mb-0.5">
                    Model number
                  </label>
                  <input
                    type="text"
                    name="modelNumber"
                    value={form.modelNumber}
                    onChange={handleChange}
                    className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                    placeholder="Manufacturer model code"
                  />
                </div>

                {/* Row 2 */}
                <div>
                  <label className="block font-medium text-primary mb-0.5">
                    Category
                  </label>
                  <select
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt"
                  >
                    <option value="">Select a category…</option>
                    {categorySelectOptions.map((cat) => {
                      const isLegacy = !CATALOG_CATEGORIES.includes(cat);
                      return (
                        <option key={cat} value={cat}>
                          {isLegacy ? `${cat} (legacy)` : cat}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-primary mb-0.5">
                    Subcategory
                  </label>
                  <select
                    name="subcategory"
                    value={form.subcategory}
                    onChange={handleChange}
                    disabled={!form.category}
                    className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt disabled:opacity-50"
                  >
                    <option value="">None</option>
                    {buildSubcategoryOptions(form.category, { current: form.subcategory }).map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-primary mb-0.5">
                    Item type
                  </label>
                  <select
                    name="itemType"
                    value={form.itemType}
                    onChange={(e) => {
                      const newItemType = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        itemType: newItemType,
                        attributes: {},
                      }));
                    }}
                    className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt"
                  >
                    <option value="">Select item type…</option>
                    {getItemTypesForCategory(form.category).map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Weight & dimensions */}
              <div className="border-t border-base-200 pt-3">
                  <label className="block font-medium text-primary mb-0.5">
                    Weight / Dimensions
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
                    <input
                      type="number"
                      name="weightGrams"
                      value={form.weightGrams}
                      onChange={handleChange}
                      disabled={hasVariants}
                      title={
                        hasVariants
                          ? "Tracks the default variant's weight (edit in the Variants tab)"
                          : undefined
                      }
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary disabled:opacity-50"
                      placeholder="Weight (g)"
                      min="0"
                    />
                    <input
                      type="number"
                      name="dimLength"
                      value={form.dimLength}
                      onChange={handleChange}
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                      placeholder="L"
                      min="0"
                      step="0.1"
                    />
                    <input
                      type="number"
                      name="dimWidth"
                      value={form.dimWidth}
                      onChange={handleChange}
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                      placeholder="W"
                      min="0"
                      step="0.1"
                    />
                    <input
                      type="number"
                      name="dimHeight"
                      value={form.dimHeight}
                      onChange={handleChange}
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                      placeholder="H"
                      min="0"
                      step="0.1"
                    />
                    <div className="mt-0.5 w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt flex items-center justify-center">
                      <span className="text-xs font-semibold tracking-wide">
                        cm
                      </span>
                    </div>
                    <input
                      type="text"
                      name="dimNote"
                      value={form.dimNote || ""}
                      onChange={handleChange}
                      placeholder="Note"
                      className="sm:col-span-2 mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt"
                    />
                  </div>
                  <span className="block text-[11px] text-primary/70">
                    Dimensions stored as L × W × H (cm). Note: e.g. "Packed", "Varies by size"
                  </span>
                  {hasVariants && (
                    <span className="block text-[11px] text-primary/70">
                      Base weight tracks the default variant (
                      {form.defaultVariantKey || "—"}) — edit it in the
                      Variants tab.
                    </span>
                  )}
              </div>
            </div>
          )}

          {/* ATTRIBUTES TAB (base attributes; variants can override per-variant) */}
          {activeTab === "attributes" && (
            <div className="space-y-2">
              {hasVariants && (
                <div className="text-[11px] text-primary/70 bg-base-200/50 rounded p-2">
                  These are the BASE attributes. Per-variant overrides (e.g.
                  volumeLiters per size, tempRatingC per temperature) live in
                  the Variants tab and merge over these when a variant is
                  selected. Required fields that vary per variant can stay
                  blank here — they count as complete once every variant
                  overrides them.
                </div>
              )}
              <AttributeFields
                itemType={form.itemType}
                attributes={form.attributes}
                onChange={(newAttrs) =>
                  setForm((prev) => ({ ...prev, attributes: newAttrs }))
                }
              />
            </div>
          )}

          {/* VARIANTS TAB */}
          {activeTab === "variants" && (
            <VariantEditor
              itemType={form.itemType}
              variantAxes={form.variantAxes}
              variants={form.variants}
              defaultVariantKey={form.defaultVariantKey}
              onChange={({ variantAxes, variants, defaultVariantKey }) =>
                setForm((prev) => {
                  const def = variants.find(
                    (v) => v.key === defaultVariantKey,
                  );
                  return {
                    ...prev,
                    variantAxes,
                    variants,
                    defaultVariantKey,
                    // Base weight mirrors the default variant for display.
                    weightGrams:
                      def && String(def.weightGrams ?? "").trim()
                        ? String(def.weightGrams)
                        : prev.weightGrams,
                  };
                })
              }
            />
          )}

          {/* MEDIA & DESCRIPTION TAB */}
          {activeTab === "media" && (
            <div className="space-y-3">
                <div>
                  <label className="block font-medium text-primary mb-0.5">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary resize-y"
                    rows={3}
                    placeholder="Short blurb to help you recognize the item when importing."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      Image URLs
                    </label>
                    <textarea
                      name="imageUrlsText"
                      value={form.imageUrlsText}
                      onChange={handleChange}
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary resize-y"
                      rows={2}
                      placeholder="One image URL per line"
                    />
                    <span className="block text-[11px] text-primary/70">
                      First URL will be used as the primary image.
                    </span>
                  </div>

                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      name="tags"
                      value={form.tags}
                      onChange={handleChange}
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                      placeholder="3-season, tent, 1p"
                    />
                  </div>
                </div>

              {/* PREFILL SOURCE */}
              <div className="space-y-3 border-t border-base-200 pt-4">
                <div className="text-xs font-semibold text-primary/80">
                  Prefill source
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-start">
                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      Source
                    </label>
                    <select
                      name="prefillSource"
                      value={form.prefillSource || "none"}
                      onChange={handleChange}
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt"
                    >
                      <option value="none">None</option>
                      <option value="amazon">Amazon</option>
                      <option value="rei" disabled>
                        REI (soon)
                      </option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 text-[11px] text-primary/70 mt-6 sm:mt-0">
                    Use prefill when you need to refresh specs. Most edits
                    should be manual to avoid overwriting curated fields.
                  </div>
                </div>
              </div>
              {/* Amazon ASIN lookup */}
              {String(form.prefillSource || "none") === "amazon" && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                  {" "}
                  <div className="sm:col-span-2">
                    <label className="block font-medium text-primary mb-0.5">
                      ASIN
                    </label>
                    <input
                      type="text"
                      name="amazonAsinLookup"
                      value={getPrimaryOffer(form).externalId || ""}
                      onChange={(e) =>
                        updateOffer(0, "externalId", e.target.value)
                      }
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                      placeholder="B0XXXXXXXX"
                      maxLength={10}
                    />
                    <span className="block text-[11px] text-primary/70">
                      Enter an Amazon ASIN to prefill this item.
                    </span>
                  </div>
                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      Marketplace
                    </label>
                    <select
                      value={form.amazonMarketplace || "us"}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          amazonMarketplace: e.target.value,
                        }))
                      }
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt"
                    >
                      <option value="us">US</option>
                      <option value="uk">UK</option>
                      <option value="de">DE</option>
                      <option value="fr">FR</option>
                      <option value="it">IT</option>
                      <option value="es">ES</option>
                      <option value="nl">NL</option>
                      <option value="ca">CA</option>
                      <option value="se">SE</option>
                      <option value="pl">PL</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAmazonLookup}
                  disabled={
                    saving ||
                    prefillLoading ||
                    String(form.prefillSource || "none") !== "amazon"
                  }
                  className={`px-2 py-1 rounded bg-secondary text-white hover:bg-secondary/80 ${
                    saving ||
                    prefillLoading ||
                    String(form.prefillSource || "none") !== "amazon"
                      ? "opacity-60 cursor-not-allowed"
                      : ""
                  }`}
                  title={
                    String(form.prefillSource || "none") !== "amazon"
                      ? "Set Prefill source to Amazon to use lookup"
                      : "Fetch product data by ASIN"
                  }
                >
                  {prefillLoading ? "Fetching..." : "Fetch from Amazon"}{" "}
                </button>
              </div>
              <label className="flex items-center gap-2 text-xs text-primary mt-2">
                <input
                  type="checkbox"
                  name="prefillOverwrite"
                  checked={Boolean(form.prefillOverwrite)}
                  onChange={handleChange}
                  className="checkbox checkbox-xs"
                />
                <span>Overwrite existing fields when applying prefill</span>
              </label>
            </div>
          )}

          {/* OFFERS TAB */}
          {activeTab === "offers" && (
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-primary/80">
                    Primary offer
                  </div>
                  <button
                    type="button"
                    onClick={addOffer}
                    className="btn btn-ghost btn-xs text-primary"
                  >
                    + Add offer
                  </button>
                </div>

              {/* Primary offer */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-primary mb-0.5">
                    Network *
                  </label>
                  <select
                    value={getPrimaryOffer(form).network}
                    onChange={(e) => updateOffer(0, "network", e.target.value)}
                    className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt"
                  >
                    {NETWORK_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-primary mb-0.5">
                    Region
                  </label>
                  <select
                    value={getPrimaryOffer(form).region || "global"}
                    onChange={(e) => updateOffer(0, "region", e.target.value)}
                    className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt"
                  >
                    {REGION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-primary mb-0.5">
                  Affiliate URL *
                </label>
                <input
                  type="url"
                  value={getPrimaryOffer(form).url || ""}
                  onChange={(e) => updateOffer(0, "url", e.target.value)}
                  className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                  placeholder="https://www.amazon.com/dp/ASIN/?tag=yourtag-20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-primary mb-0.5">
                    Merchant name
                  </label>
                  <input
                    type="text"
                    value={getPrimaryOffer(form).merchantName || ""}
                    onChange={(e) =>
                      updateOffer(0, "merchantName", e.target.value)
                    }
                    className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                    placeholder="Amazon / Bergfreunde / REI"
                  />
                </div>
                <div>
                  <label className="block font-medium text-primary mb-0.5">
                    External ID
                  </label>
                  <input
                    type="text"
                    value={getPrimaryOffer(form).externalId || ""}
                    onChange={(e) =>
                      updateOffer(0, "externalId", e.target.value)
                    }
                    className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                    placeholder="ASIN, Awin product id..."
                  />
                  <span className="block text-[11px] text-primary/70">
                    ASIN (Amazon) / product id (Awin, Impact)
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-medium text-primary mb-0.5">
                  Link priority
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={Number(getPrimaryOffer(form).priority ?? 10)}
                  onChange={(e) =>
                    updateOffer(0, "priority", Number(e.target.value) || 0)
                  }
                  className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                  placeholder="10"
                />
                <span className="block text-[11px] text-primary/70">
                  Higher wins if multiple links exist for a region.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="block font-medium text-primary mb-0.5">
                    Canonical ASIN (optional)
                  </label>
                  <input
                    type="text"
                    name="canonicalAsin"
                    value={form.canonicalAsin}
                    onChange={handleChange}
                    className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                    placeholder="Main ASIN for this product"
                  />
                </div>
                <div>
                  <label className="block font-medium text-primary mb-0.5">
                    Item group ID (optional)
                  </label>
                  <input
                    type="text"
                    name="itemGroupId"
                    value={form.itemGroupId}
                    onChange={handleChange}
                    className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                    placeholder="Internal cross-network key"
                  />
                  <span className="block text-[11px] text-primary/70">
                    Used to link Awin/Impact offers to this product later.
                  </span>
                </div>
              </div>

              {/* Additional offers */}
              {Array.isArray(form.offers) && form.offers.length > 1 && (
                <div className="mt-2 space-y-2">
                  {form.offers.slice(1).map((offer, i) => {
                    const idx = i + 1;
                    return (
                      <div
                        key={idx}
                        className="border border-primary/40 rounded p-2 bg-neutralAlt/40"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs text-primary/80">
                            Additional offer #{idx + 1}
                          </div>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs text-error"
                            onClick={() => removeOffer(idx)}
                            title="Remove offer"
                          >
                            <FiX />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block font-medium text-primary mb-0.5">
                              Network *
                            </label>
                            <select
                              value={offer.network || "amazon"}
                              onChange={(e) =>
                                updateOffer(idx, "network", e.target.value)
                              }
                              className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt"
                            >
                              {NETWORK_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block font-medium text-primary mb-0.5">
                              Region
                            </label>
                            <select
                              value={offer.region || "global"}
                              onChange={(e) =>
                                updateOffer(idx, "region", e.target.value)
                              }
                              className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary bg-neutralAlt"
                            >
                              {REGION_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="mt-2">
                          <label className="block font-medium text-primary mb-0.5">
                            Affiliate URL *
                          </label>
                          <input
                            type="url"
                            value={offer.url || ""}
                            onChange={(e) =>
                              updateOffer(idx, "url", e.target.value)
                            }
                            className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                          <div>
                            <label className="block font-medium text-primary mb-0.5">
                              Merchant name
                            </label>
                            <input
                              type="text"
                              value={offer.merchantName || ""}
                              onChange={(e) =>
                                updateOffer(idx, "merchantName", e.target.value)
                              }
                              className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                            />
                          </div>
                          <div>
                            <label className="block font-medium text-primary mb-0.5">
                              External ID
                            </label>
                            <input
                              type="text"
                              value={offer.externalId || ""}
                              onChange={(e) =>
                                updateOffer(idx, "externalId", e.target.value)
                              }
                              className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                            />
                          </div>
                          <div>
                            <label className="block font-medium text-primary mb-0.5">
                              Link priority
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={Number(offer.priority ?? 10)}
                              onChange={(e) =>
                                updateOffer(
                                  idx,
                                  "priority",
                                  Number(e.target.value) || 0,
                                )
                              }
                              className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-base-200 mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-2 py-1 rounded bg-neutralAlt text-primary hover:bg-neutralAlt/90"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`px-2 py-1 rounded bg-secondary text-white hover:bg-secondary/80 ${
                saving ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function StatField({ label, children, className = "" }) {
  return (
    <div className={"rounded-lg bg-base-200/60 px-3 py-2 min-w-0 " + className}>
      <div className="text-[11px] uppercase tracking-wide font-semibold text-primary/50 mb-0.5">
        {label}
      </div>
      <div className="text-sm text-primary break-words">{children}</div>
    </div>
  );
}

function SectionHeading({ icon, children, right }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2 mt-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-primary/60 flex items-center gap-1.5">
        {icon}
        <span>{children}</span>
      </h3>
      {right}
    </div>
  );
}

// How far a user got past signing up. Mirrors the server's classification in
// server/src/routes/adminUsers.js — keep the two in sync.
// NOTE: this app has no daisyUI — badge-*/bg-success style classes are inert
// here, so these use the project's own theme tokens (see tailwind.config.js).
const ENGAGEMENT_META = {
  none: {
    label: "No activity",
    badge: "bg-primary/10 text-primary/60",
    hint: "Signed up but has no lists and no gear",
  },
  copier: {
    label: "Copier",
    badge: "bg-primary/15 text-primary/80",
    hint: "Has gear, but all of it arrived by copying someone else's list",
  },
  builder: {
    label: "Builder",
    badge: "bg-accent/15 text-accent",
    hint: "Has added their own gear — the first real signal of intent",
  },
  power: {
    label: "Power user",
    badge: "bg-accent text-neutral",
    hint: "Has built out a substantial kit of their own",
  },
};

function EngagementBadge({ value, className = "" }) {
  const meta = ENGAGEMENT_META[value];
  if (!meta) return <span className="text-primary/30">–</span>;
  return (
    <span
      className={
        "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap " +
        `${meta.badge} ${className}`
      }
      title={meta.hint}
    >
      {meta.label}
    </span>
  );
}

/**
 * Stacked bar showing what a user's My Gear is actually made of.
 * The distinction that matters: gear they chose vs gear that rode in on a copy.
 */
function GearMixBar({ own = 0, imported = 0, unusedImported = 0 }) {
  const total = own + imported;
  if (total === 0) {
    return <div className="text-xs text-primary/50">No gear yet</div>;
  }
  const pct = (n) => `${((n / total) * 100).toFixed(1)}%`;
  const usedImported = Math.max(0, imported - unusedImported);

  // Theme tokens only — see the note on ENGAGEMENT_META.
  const segments = [
    {
      key: "own",
      n: own,
      color: "bg-accent",
      label: "their own",
      title: `${own} added by this user`,
    },
    {
      key: "used",
      n: usedImported,
      color: "bg-primary/40",
      label: "from packs, in use",
      title: `${usedImported} from copied lists, still in use`,
    },
    {
      key: "unused",
      n: unusedImported,
      color: "bg-primary/15",
      label: "from packs, unused",
      title: `${unusedImported} from copied lists, not in any list`,
    },
  ];

  return (
    <div className="space-y-1.5">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-primary/5">
        {segments.map((s) => (
          <div
            key={s.key}
            className={s.color}
            style={{ width: pct(s.n) }}
            title={s.title}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-primary/70">
        {segments.map((s) => (
          <span key={s.key} className="flex items-center gap-1">
            <span
              className={`inline-block h-2 w-2 rounded-full ${s.color}`}
            />
            {s.n} {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

const TIMELINE_STYLES = {
  signup: { dot: "bg-primary/40" },
  "list.created": { dot: "bg-secondary" },
  "list.copied": { dot: "bg-primary/30" },
  "item.added": { dot: "bg-accent" },
  "item.edited": { dot: "bg-accent/40" },
  "item.placed": { dot: "bg-accent/60" },
  "pane.viewed": { dot: "bg-primary/20" },
};

/**
 * The "what is this person actually doing?" panel.
 *
 * Gear activity is reconstructed from document timestamps and provenance
 * flags: it shows what was added and when, but not deletions. Unused imported
 * gear is the closest available proxy for "items they threw out of a copied
 * list". Navigation is not inferred — pane opens are logged outright and
 * merged into the same timeline, but only from the day that logging shipped
 * and only for the server's retention window.
 */
/**
 * Loads the derived activity picture for one user.
 *
 * Treklist keeps no event log, so the server reconstructs this from document
 * timestamps and provenance flags. It can show what was added and when; it
 * cannot show deletions or browsing. Unused imported gear is the closest
 * available proxy for "items they threw out of a copied list".
 */
function useUserActivity(userId) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const { data: res } = await api.get(`/admin/users/${userId}/activity`);
        if (!cancelled) setData(res);
      } catch (err) {
        console.error("Failed to load user activity", err);
        if (!cancelled) {
          setError(
            err?.response?.data?.message ||
              err?.message ||
              "Failed to load activity."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { loading, error, data };
}

function engagementFromSummary(summary) {
  if (!summary) return null;
  if (summary.listsTotal === 0 && summary.itemsTotal === 0) return "none";
  if (summary.ownItems >= 25) return "power";
  if (summary.ownItems > 0) return "builder";
  return "copier";
}

const fmtClock = (val) =>
  new Date(val).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * Opaque sticky table header. The rest of this file uses `bg-base-200`, which
 * does nothing here (no daisyUI, and no such Tailwind token) — so those headers
 * are transparent and body rows scroll visibly underneath them.
 */
const STICKY_HEAD =
  "sticky top-0 z-10 bg-neutral text-[11px] uppercase tracking-wide text-primary/60";

function ActivityStats({ summary }) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 mb-4">
      <StatField label="Their own gear">
        <span className="font-semibold text-base">{summary.ownItems}</span>
        <span className="text-primary/50 text-xs"> of {summary.itemsTotal} items</span>
      </StatField>
      <StatField label="From copied packs">
        <span className="font-semibold text-base">{summary.importedItems}</span>
        {summary.unusedImported > 0 && (
          <span className="text-primary/50 text-xs">
            {" "}({summary.unusedImported} unused)
          </span>
        )}
      </StatField>
      <StatField label="Lists">
        <span className="font-semibold text-base">{summary.listsTotal}</span>
        <span className="text-primary/50 text-xs">
          {" "}{summary.listsCopied} copied · {summary.listsOriginal} original
        </span>
      </StatField>
      <StatField label="Active days">
        <span className="font-semibold text-base">{summary.activeDays}</span>
        {summary.firstActionAt && (
          <span className="text-primary/50 text-xs">
            {" "}since {new Date(summary.firstActionAt).toLocaleDateString()}
          </span>
        )}
      </StatField>
    </div>
  );
}

function ActivityComposition({ summary }) {
  return (
    <div className="rounded-lg bg-base-100 px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide font-semibold text-primary/50 mb-1.5">
        My Gear composition
      </div>
      <GearMixBar
        own={summary.ownItems}
        imported={summary.importedItems}
        unusedImported={summary.unusedImported}
      />
      {summary.wishlistedItems > 0 && (
        <div className="text-[11px] text-primary/50 mt-1.5">
          Plus {summary.wishlistedItems} wishlisted, excluded from every count
          above and from the Items column in the users table.
        </div>
      )}
    </div>
  );
}

const PANE_VISIT_LABELS = {
  gear: "Gear lists",
  myGear: "My Gear",
  lists: "My Lists",
  templates: "Templates",
  checklist: "Checklist",
  community: "Community",
  forum: "Forum",
  admin: "Admin",
};

/**
 * Which panes this user actually opens. Unlike everything else on this screen
 * these are recorded, not inferred — so an empty panel means "nothing logged
 * yet", never "they never went there". Pane logging only covers accounts
 * active since it shipped, and rows expire on the server.
 */
function PaneVisits({ summary }) {
  const counts = summary.paneViews || {};
  const rows = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg bg-base-100 px-3 py-2.5 text-[11px] text-primary/50">
        No pane visits logged for this user yet.
      </div>
    );
  }

  const max = rows[0][1];

  return (
    <div className="rounded-lg bg-base-100 px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide font-semibold text-primary/50 mb-1.5">
        Where they go
      </div>
      <ul className="space-y-1">
        {rows.map(([pane, n]) => (
          <li key={pane} className="flex items-center gap-2 text-xs">
            <span className="w-20 flex-shrink-0 text-primary/70">
              {PANE_VISIT_LABELS[pane] || pane}
            </span>
            <span className="flex-1 h-1.5 rounded-full bg-primary/10 overflow-hidden">
              <span
                className="block h-full rounded-full bg-secondary"
                style={{ width: `${Math.round((n / max) * 100)}%` }}
              />
            </span>
            <span className="w-8 text-right tabular-nums text-primary/60">
              {n}
            </span>
          </li>
        ))}
      </ul>
      {summary.paneViewsSince && (
        <div className="text-[11px] text-primary/50 mt-1.5">
          Logged since {new Date(summary.paneViewsSince).toLocaleDateString()}
          {summary.paneViewsTruncated ? " (capped at the 500 most recent)" : ""}.
        </div>
      )}
    </div>
  );
}

function OwnGearTable({ ownItems }) {
  return (
    <section>
      <SectionHeading
        right={
          <span className="text-xs text-primary/60">
            excludes anything from copied packs
          </span>
        }
      >
        Gear they added themselves ({ownItems.length})
      </SectionHeading>

      {ownItems.length === 0 ? (
        <div className="text-sm text-primary/60 bg-base-100 rounded-lg px-3 py-3">
          Nothing yet — every item in this account arrived by copying someone
          else&apos;s list.
        </div>
      ) : (
        <div className="rounded-lg border border-primary/10 overflow-hidden bg-base-100">
          <div className="max-h-[22rem] overflow-auto lg:max-h-none lg:overflow-visible">
            <table className="min-w-full text-sm">
              <thead className={STICKY_HEAD}>
                <tr>
                  <th className="text-left font-semibold px-3 py-2">Added</th>
                  <th className="text-left font-semibold px-3 py-2">Item</th>
                  <th className="text-left font-semibold px-3 py-2">Type</th>
                  <th className="text-right font-semibold px-3 py-2">Weight</th>
                  <th className="text-left font-semibold px-3 py-2">In</th>
                </tr>
              </thead>
              <tbody>
                {ownItems.map((i) => (
                  <tr
                    key={i._id}
                    className="border-t border-primary/10 hover:bg-neutral/60 align-top"
                  >
                    <td className="px-3 py-2 text-xs text-primary/70 whitespace-nowrap">
                      {new Date(i.createdAt).toLocaleDateString()}{" "}
                      <span className="text-primary/50">{fmtClock(i.createdAt)}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-primary">
                        {[i.brand, i.name].filter(Boolean).join(" ")}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        {i.variantKey && (
                          <span className="text-[10px] text-primary/60">
                            {i.variantKey}
                          </span>
                        )}
                        {i.isCustom && (
                          <span className="text-[10px] text-primary/50">custom</span>
                        )}
                        {i.edited && (
                          <span className="text-[10px] text-primary/50">edited</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-primary/80">
                      {i.itemType || "–"}
                    </td>
                    <td className="px-3 py-2 text-xs text-right text-primary/80 whitespace-nowrap">
                      {i.weight != null ? `${i.weight} g` : "–"}
                    </td>
                    <td className="px-3 py-2 text-xs text-primary/70 max-w-[160px] truncate">
                      {i.inLists.length ? i.inLists.join(", ") : "My Gear only"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function CopyResidue({ count, items }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;

  return (
    <div>
      <button
        type="button"
        className="text-xs text-primary/70 hover:text-primary flex items-center gap-1"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <FiChevronUp /> : <FiChevronDown />}
        {count} copied items sitting unused in My Gear
      </button>
      {open && (
        <div className="mt-1.5 rounded-lg bg-base-100 px-3 py-2 text-xs text-primary/70">
          <p className="mb-1.5 text-primary/60">
            Gear that arrived with a copied list and is not in any list now —
            usually items they deleted after copying. Deletions are not
            recorded, so this is inference, not a log.
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {items.map((g) => (
              <span key={g._id}>
                {[g.brand, g.name].filter(Boolean).join(" ")}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityTimeline({ timeline, truncated }) {
  const fmtDay = (val) =>
    new Date(val).toLocaleDateString([], {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  // Group by day so a burst of activity reads as one session.
  const days = [];
  for (const ev of timeline) {
    const key = new Date(ev.at).toDateString();
    const last = days[days.length - 1];
    if (last && last.key === key) last.events.push(ev);
    else days.push({ key, at: ev.at, events: [ev] });
  }

  return (
    <section>
      <SectionHeading>
        Timeline ({timeline.length}
        {truncated ? "+" : ""})
      </SectionHeading>
      <div className="rounded-lg border border-primary/10 bg-base-100 max-h-[30rem] overflow-auto lg:max-h-none lg:overflow-visible">
        {days.map((day) => (
          <div key={day.key}>
            <div className={STICKY_HEAD + " px-3 py-1 font-semibold"}>
              {fmtDay(day.at)}
            </div>
            <ul className="px-3 py-1.5">
              {day.events.map((ev, idx) => {
                const style =
                  TIMELINE_STYLES[ev.type] || TIMELINE_STYLES["item.added"];
                return (
                  <li key={`${ev.at}-${idx}`} className="flex gap-2.5 py-1 text-sm">
                    <span className="text-[11px] text-primary/50 tabular-nums w-16 flex-shrink-0 pt-0.5 whitespace-nowrap">
                      {fmtClock(ev.at)}
                    </span>
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${style.dot}`}
                    />
                    <span className="min-w-0">
                      <span className="text-primary">{ev.label}</span>
                      {ev.detail && (
                        <span className="text-primary/60"> {ev.detail}</span>
                      )}
                      {ev.meta && (
                        <span className="block text-[11px] text-primary/50">
                          {ev.meta}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function UserDetailModal({ userId, onClose, onUserChanged }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [lists, setLists] = useState([]);
  const [error, setError] = useState("");
  const [trailname, setTrailname] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDisabled, setIsDisabled] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmResendOpen, setConfirmResendOpen] = useState(false);
  const [resending, setResending] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [catalogItemsCount, setCatalogItemsCount] = useState(0);
  const [customItemsCount, setCustomItemsCount] = useState(0);
  const [revoking, setRevoking] = useState(false);
  const [confirmRevokeOpen, setConfirmRevokeOpen] = useState(false);

  const {
    loading: activityLoading,
    error: activityError,
    data: activity,
  } = useUserActivity(userId);

  const handleRevokeSessions = async () => {
    if (!user) return;
    setRevoking(true);
    try {
      await api.post(`/admin/users/${user._id}/revoke-sessions`);
      setSessionCount(0);
      toast.success("All sessions revoked.");
    } catch (err) {
      console.error("Revoke sessions failed", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to revoke sessions.";
      toast.error(msg);
    } finally {
      setRevoking(false);
    }
  };

  const handleResendVerification = async () => {
    if (!user) return;
    setResending(true);
    try {
      await api.post(`/admin/users/${user._id}/resend-verification`);
      toast.success("Verification email sent.");
    } catch (err) {
      console.error("Resend verification failed", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to send verification email.";
      toast.error(msg);
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get(`/admin/users/${userId}`);
        setUser(data.user);
        setLists(data.lists || []);
        setTrailname(data.user.trailname || "");
        setIsVerified(Boolean(data.user.isVerified));
        setIsAdmin(Boolean(data.user.isAdmin));
        setIsDisabled(Boolean(data.user.isDisabled));
        setSessionCount(data.sessionCount ?? 0);
        setCatalogItemsCount(data.catalogItemsCount ?? 0);
        setCustomItemsCount(data.customItemsCount ?? 0);
      } catch (err) {
        console.error("Failed to load user", err);
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Failed to load user.";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [userId]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        trailname: trailname,
        isVerified,
        isAdmin,
        isDisabled,
      };
      const { data } = await api.patch(`/admin/users/${user._id}`, payload);
      setUser(data);
      toast.success("User updated.");
      onUserChanged?.("updated");
      onClose?.();
    } catch (err) {
      console.error("Failed to update user", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to update user.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    try {
      await api.delete(`/admin/users/${user._id}`);
      toast.success("User and related data deleted.");
      setConfirmDeleteOpen(false);
      onUserChanged?.("deleted");
      onClose?.();
    } catch (err) {
      console.error("Failed to delete user", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to delete user.";
      toast.error(msg);
    }
  };

  const formatDateTime = (val) => {
    if (!val) return "–";
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return "–";
    return d.toLocaleString();
  };

  const timeAgo = (val) => {
    if (!val) return "Never";
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return "Never";
    const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(months / 12);
    return `${years}y ago`;
  };

  // Portaled to <body> so the overlay is positioned against the viewport and
  // nothing in the dashboard tree can shift or clip it.
  //
  // The TopBar is sticky at z-[60] and paints over the overlay, so the dimmed
  // area starts at its bottom edge (TOPBAR_H). Padding the top by that plus a
  // gutter, and the bottom by the same gutter, leaves the card optically
  // centered in the gray area.
  return createPortal(
    <div className="fixed inset-0 bg-primary bg-opacity-50 flex items-center justify-center z-50 px-3 pb-3 pt-[3.75rem] sm:px-4 sm:pb-4 sm:pt-16">
      <form
        onSubmit={handleSave}
        className="bg-neutralAlt rounded-xl shadow-2xl max-w-6xl 2xl:max-w-7xl w-full px-4 py-4 sm:px-6 sm:py-5 max-h-full flex flex-col"
      >
        {/* Header - fixed at top */}
        <div className="flex justify-between items-start gap-3 pb-3 mb-3 border-b border-base-200 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg">
              <FiUser />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-primary truncate">
                {user?.trailname?.trim() || user?.email || "User details"}
              </h2>
              {user && (
                <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
                  <span className="text-xs text-primary/60 truncate">
                    {user.email}
                  </span>
                  {user.isAdmin && (
                    <span className="badge badge-xs badge-primary">Admin</span>
                  )}
                  {user.isDisabled && (
                    <span className="badge badge-xs badge-error">Disabled</span>
                  )}
                  {user.isVerified ? (
                    <span className="badge badge-xs badge-success">Verified</span>
                  ) : (
                    <span className="badge badge-xs badge-warning">Unverified</span>
                  )}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-shrink-0 text-error hover:text-error/80 text-lg"
          >
            <FiX />
          </button>
        </div>

        {/* Content area. Below lg this scrolls as one column; from lg up the
            two columns scroll independently so the modal fills the viewport
            instead of growing into one very tall page. */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row lg:gap-x-6 overflow-y-auto lg:overflow-hidden">
        {loading && (
          <div className="text-sm text-primary/70">
            Loading user information…
          </div>
        )}

        {!loading && error && (
          <div className="text-error mb-2 text-sm">{error}</div>
        )}

        {!loading && user && (
          // Two columns from lg up: the account facts and the narrative on the
          // left, the gear evidence (wide tables) on the right. Keeps the modal
          // short enough to read without scrolling on a 13" laptop.
          // The two columns are direct flex children of the scroll container
          // above, so they stretch to its height without relying on a
          // percentage height resolving through a wrapper.
          <>
            <div className="min-w-0 lg:w-5/12 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
            {/* Section: Profile (editable) */}
            <section className="mb-5">
              <SectionHeading icon={<FiUser className="text-primary/60" />}>
                Profile
              </SectionHeading>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wide font-semibold text-primary/50 mb-1">
                    Email
                  </label>
                  <div className="text-sm text-primary bg-base-200/60 rounded-lg px-3 py-2 break-all">
                    {user.email}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wide font-semibold text-primary/50 mb-1">
                    Trailname
                  </label>
                  <input
                    type="text"
                    className="block w-full border border-base-300 rounded-lg px-3 py-2 text-sm text-primary bg-neutralAlt focus:outline-none focus:ring-2 focus:ring-secondary/40"
                    value={trailname}
                    onChange={(e) => setTrailname(e.target.value)}
                    placeholder="Optional public name"
                  />
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wide font-semibold text-primary/50 mb-1">
                    Role
                  </label>
                  <select
                    className="block w-full border border-base-300 rounded-lg px-3 py-2 text-sm text-primary bg-neutralAlt focus:outline-none focus:ring-2 focus:ring-secondary/40"
                    value={isAdmin ? "admin" : "user"}
                    onChange={(e) => setIsAdmin(e.target.value === "admin")}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="flex flex-col justify-center gap-1.5">
                  <label className="inline-flex items-center gap-2 text-sm text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={isVerified}
                      onChange={(e) => setIsVerified(e.target.checked)}
                    />
                    <span>Verified email</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm checkbox-error"
                      checked={isDisabled}
                      onChange={(e) => setIsDisabled(e.target.checked)}
                    />
                    <span>Disable login for this user</span>
                  </label>
                  {!user.isVerified && (
                    <button
                      type="button"
                      className="btn btn-xs btn-outline self-start mt-1"
                      onClick={() => setConfirmResendOpen(true)}
                      disabled={resending}
                    >
                      {resending ? "Sending…" : "Resend verification email"}
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Section: Account & activity (read-only) */}
            <section className="mb-5">
              <SectionHeading>Account &amp; activity</SectionHeading>
              {/* Two-up: this sits in the narrow left column from lg, where
                  four across would wrap every label. */}
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-2.5">
                <StatField label="Created">
                  {formatDateTime(user.createdAt)}
                </StatField>
                <StatField label="Last login">
                  {user.lastLoginAt ? (
                    <>
                      {formatDateTime(user.lastLoginAt)}
                      <span className="text-primary/50">
                        {" "}({timeAgo(user.lastLoginAt)})
                      </span>
                    </>
                  ) : (
                    "Never"
                  )}
                </StatField>
                <StatField label="Last seen">
                  {user.lastActiveAt ? (
                    <>
                      {formatDateTime(user.lastActiveAt)}
                      <span className="text-primary/50">
                        {" "}({timeAgo(user.lastActiveAt)})
                      </span>
                    </>
                  ) : (
                    "Never"
                  )}
                </StatField>
                <StatField label="Updated">
                  {formatDateTime(user.updatedAt)}
                </StatField>

                <StatField label="Auth providers">
                  {user.authProviders && user.authProviders.length > 0 ? (
                    <span className="flex flex-wrap gap-1">
                      {user.authProviders.map((ap, i) => (
                        <span
                          key={i}
                          className={
                            "badge badge-sm " +
                            (ap.provider === "google"
                              ? "badge-secondary"
                              : "badge-ghost")
                          }
                          title={
                            ap.connectedAt
                              ? `Connected ${new Date(ap.connectedAt).toLocaleDateString()}`
                              : ""
                          }
                        >
                          {ap.provider === "google" ? "Google" : "Email"}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-primary/60">None</span>
                  )}
                </StatField>

                <StatField label="Active sessions">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{sessionCount}</span>
                    {sessionCount > 0 && (
                      <button
                        type="button"
                        className="btn btn-xs btn-outline"
                        onClick={() => setConfirmRevokeOpen(true)}
                        disabled={revoking}
                      >
                        {revoking ? "Revoking…" : "Revoke all"}
                      </button>
                    )}
                  </span>
                </StatField>

                <StatField label="Marketing">
                  {user.marketing?.optedIn ? (
                    <span className="flex flex-wrap items-center gap-1">
                      <span className="badge badge-xs badge-success">Opted in</span>
                      {user.marketing.optedInAt && (
                        <span className="text-primary/60 text-xs">
                          {new Date(user.marketing.optedInAt).toLocaleDateString()}
                        </span>
                      )}
                      {user.marketing.optedInSource && (
                        <span className="text-primary/60 text-xs">
                          via {user.marketing.optedInSource}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="badge badge-xs badge-ghost">Not opted in</span>
                  )}
                </StatField>

                <StatField label="Preferences">
                  <span className="text-xs text-primary/80">
                    {(user.region || "–").toUpperCase()} · {user.locale || "–"} ·{" "}
                    {user.language || "–"} · {user.weightUnit || "–"} ·{" "}
                    {user.measurementSystem || "–"}
                  </span>
                </StatField>

                <StatField label="Onboarding tour">
                  {user.onboarding?.tourVersionSeen ? (
                    <span className="flex flex-wrap items-center gap-1">
                      {user.onboarding.tourStatus === "completed" ? (
                        <span className="badge badge-xs badge-success">Completed</span>
                      ) : user.onboarding.tourStatus === "skipped" ? (
                        <span className="badge badge-xs badge-warning">Skipped</span>
                      ) : (
                        <span className="badge badge-xs badge-info">Seen</span>
                      )}
                      <span className="text-primary/60 text-xs">
                        v{user.onboarding.tourVersionSeen}
                      </span>
                      {user.onboarding.tourDismissedAt && (
                        <span className="text-primary/60 text-xs">
                          ·{" "}
                          {new Date(
                            user.onboarding.tourDismissedAt
                          ).toLocaleDateString()}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="badge badge-xs badge-ghost">Not seen</span>
                  )}
                </StatField>
              </div>
            </section>

            {/* Left column, lower half: composition + the narrative */}
            {activityLoading && (
              <div className="text-sm text-primary/60 mb-5">
                Reconstructing activity…
              </div>
            )}
            {activityError && (
              <div className="text-sm text-error mb-5">{activityError}</div>
            )}
            {activity && (
              <>
                <section className="mb-5">
                  <ActivityComposition summary={activity.summary} />
                </section>
                <section className="mb-5">
                  <PaneVisits summary={activity.summary} />
                </section>
                <section className="mb-5">
                  <ActivityTimeline
                    timeline={activity.timeline || []}
                    truncated={activity.timelineTruncated}
                  />
                </section>
              </>
            )}
            </div>

            <div className="min-w-0 lg:w-7/12 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
            {/* Right column: the gear evidence */}
            {activity && (
              <>
                <section className="mb-5">
                  <SectionHeading
                    right={
                      <EngagementBadge
                        value={engagementFromSummary(activity.summary)}
                      />
                    }
                  >
                    Activity
                  </SectionHeading>
                  <ActivityStats summary={activity.summary} />
                </section>

                <div className="mb-3">
                  <OwnGearTable ownItems={activity.ownItems || []} />
                </div>

                <div className="mb-5">
                  <CopyResidue
                    count={activity.summary.unusedImported}
                    items={activity.unusedImported || []}
                  />
                </div>
              </>
            )}

            {/* Section: Gear lists */}
            <section>
              <SectionHeading
                icon={<FiUsers className="text-primary/60" />}
                right={
                  <span className="text-xs text-primary/60">
                    {catalogItemsCount + customItemsCount} items ·{" "}
                    {catalogItemsCount} catalog · {customItemsCount} custom
                  </span>
                }
              >
                Gear lists ({lists.length})
              </SectionHeading>

              {lists.length === 0 && (
                <div className="text-sm text-primary/60 bg-base-200/60 rounded-lg px-3 py-3">
                  This user has no gear lists yet.
                </div>
              )}

              {lists.length > 0 && (
                <div className="rounded-lg border border-primary/10 overflow-hidden bg-base-100">
                  <div className="max-h-72 overflow-auto lg:max-h-none lg:overflow-visible">
                    <table className="min-w-full text-sm">
                      <thead className={STICKY_HEAD}>
                        <tr>
                          <th className="text-left font-semibold px-3 py-2">Title</th>
                          <th className="text-left font-semibold px-3 py-2">Origin</th>
                          <th className="text-left font-semibold px-3 py-2">Trip</th>
                          <th className="text-left font-semibold px-3 py-2">Location</th>
                          <th className="text-right font-semibold px-3 py-2">Items</th>
                          <th className="text-left font-semibold px-3 py-2">Flags</th>
                          <th className="text-left font-semibold px-3 py-2">Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lists.map((l) => {
                          const tripStart = l.tripStart
                            ? new Date(l.tripStart).toLocaleDateString()
                            : null;
                          const tripEnd = l.tripEnd
                            ? new Date(l.tripEnd).toLocaleDateString()
                            : null;
                          const tripLabel =
                            tripStart && tripEnd
                              ? `${tripStart} → ${tripEnd}`
                              : tripStart || tripEnd || "–";
                          return (
                            <tr
                              key={l._id}
                              className="border-t border-base-200 hover:bg-base-200/40 align-top"
                            >
                              <td className="px-3 py-2 font-medium text-primary truncate max-w-[180px]">
                                {l.title || "(untitled list)"}
                              </td>
                              <td className="px-3 py-2 text-xs max-w-[180px]">
                                {l.copiedFrom?.at ? (
                                  <span
                                    className="text-primary/80"
                                    title={
                                      l.copiedFrom.ownerEmail
                                        ? `Copied from "${l.copiedFrom.title}" by ${l.copiedFrom.ownerEmail}`
                                        : `Copied from "${l.copiedFrom.title}"`
                                    }
                                  >
                                    <span className="inline-block rounded-full bg-accent/15 text-accent px-1.5 py-0.5 text-[10px] font-semibold mr-1">
                                      Copy
                                    </span>
                                    <span className="truncate inline-block max-w-[110px] align-bottom">
                                      {l.copiedFrom.title || "unknown source"}
                                    </span>
                                  </span>
                                ) : (
                                  <span className="inline-block rounded-full bg-primary/10 text-primary/60 px-1.5 py-0.5 text-[10px] font-semibold">
                                    Original
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-xs text-primary/80 whitespace-nowrap">
                                {tripLabel}
                              </td>
                              <td className="px-3 py-2 text-xs text-primary/80 truncate max-w-[120px]">
                                {l.location || "–"}
                              </td>
                              <td className="px-3 py-2 text-xs text-right text-primary/80">
                                {l.itemCount ?? 0}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex flex-wrap gap-1">
                                  {l.isFeatured && (
                                    <span className="badge badge-xs badge-primary">Featured</span>
                                  )}
                                  {l.isSample && (
                                    <span className="badge badge-xs badge-secondary">Sample</span>
                                  )}
                                  {l.isLocked && (
                                    <span className="badge badge-xs badge-warning">Locked</span>
                                  )}
                                  {l.hasActiveShare && (
                                    <span className="badge badge-xs badge-success">Shared</span>
                                  )}
                                  {!l.isFeatured &&
                                    !l.isSample &&
                                    !l.isLocked &&
                                    !l.hasActiveShare && (
                                      <span className="text-xs text-primary/40">–</span>
                                    )}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-xs text-primary/80 whitespace-nowrap">
                                {formatDateTime(l.updatedAt)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
            </div>
          </>
        )}
        </div>

        {/* Actions - fixed at bottom */}
        {!loading && user && (
          <>
            <div className="mt-4 pt-3 border-t border-base-200 flex items-center justify-between flex-shrink-0">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={saving}
                className="px-3 py-1.5 bg-error/10 text-error font-semibold rounded-lg hover:bg-error/20 focus:outline-none focus:ring-2 focus:ring-error/40 transition text-sm"
              >
                Delete user
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg hover:bg-base-200 text-primary text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg bg-secondary text-white font-medium hover:bg-secondary/80 disabled:opacity-60 text-sm"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>

            {/* Resend verification confirm dialog */}
            <ConfirmDialog
              isOpen={confirmResendOpen}
              title="Resend verification email?"
              message={`Send a new verification email to ${user?.email}?`}
              confirmText="Send email"
              cancelText="Cancel"
              onConfirm={() => {
                setConfirmResendOpen(false);
                handleResendVerification();
              }}
              onCancel={() => setConfirmResendOpen(false)}
            />

            {/* Revoke sessions confirm dialog */}
            <ConfirmDialog
              isOpen={confirmRevokeOpen}
              title="Revoke all sessions?"
              message={`This will log ${user?.email} out of all devices. They can log back in immediately.`}
              confirmText="Revoke all"
              cancelText="Cancel"
              onConfirm={() => {
                setConfirmRevokeOpen(false);
                handleRevokeSessions();
              }}
              onCancel={() => setConfirmRevokeOpen(false)}
            />

            {/* Delete confirm dialog */}
            <ConfirmDialog
              isOpen={confirmDeleteOpen}
              title="Delete user?"
              message="This will permanently delete this user and all of their gear lists and templates. This action cannot be undone."
              confirmText="Delete user"
              cancelText="Cancel"
              onConfirm={handleDelete}
              onCancel={() => setConfirmDeleteOpen(false)}
            />
          </>
        )}
      </form>
    </div>,
    document.body
  );
}

function UsersSection() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all"); // "all" | "user" | "admin"
  const [verifiedFilter, setVerifiedFilter] = useState("all"); // "all" | "true" | "false"
  // "all" | "none" | "copier" | "builder" | "power"
  const [engagementFilter, setEngagementFilter] = useState("all");

  const [page, setPage] = useState(0); // 0-based
  const [pageSize, setPageSize] = useState(25);

  const [showListBody, setShowListBody] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState(null);

  const [sort, setSort] = useState({
    field: "createdAt", // "email" | "trailname" | "role" | "verified" | "lists" | "createdAt" | "updatedAt" | "lastLoginAt" | "lastActiveAt"
    dir: "desc", // "asc" | "desc"
  });

  const loadUsers = async ({
    pageOverride,
    pageSizeOverride,
    searchOverride,
    roleOverride,
    verifiedOverride,
    engagementOverride,
    sortOverride,
  } = {}) => {
    const nextPage = pageOverride ?? page;
    const nextPageSize = pageSizeOverride ?? pageSize;
    const nextSearch = searchOverride ?? search;
    const nextRole = roleOverride ?? roleFilter;
    const nextVerified = verifiedOverride ?? verifiedFilter;
    const nextEngagement = engagementOverride ?? engagementFilter;
    const nextSort = sortOverride ?? sort;

    setLoading(true);
    setError("");
    try {
      const params = {
        limit: nextPageSize,
        skip: nextPage * nextPageSize,
        sortField: nextSort.field,
        sortDir: nextSort.dir,
      };

      if (nextSearch.trim()) params.q = nextSearch.trim();
      if (nextRole !== "all") params.role = nextRole;
      if (nextVerified !== "all") params.isVerified = nextVerified;
      if (nextEngagement !== "all") params.engagement = nextEngagement;

      const { data } = await api.get("/admin/users", { params });
      setUsers(data.users || []);
      setTotal(data.total || 0);
      setPage(nextPage);
      setPageSize(nextPageSize);
    } catch (err) {
      console.error("Failed to load users", err);
      const msg =
        err?.response?.data?.message || err?.message || "Failed to load users.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers({ pageOverride: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSort = (field) => {
    const newSort =
      sort.field === field
        ? { field, dir: sort.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" };
    setSort(newSort);
    loadUsers({ pageOverride: 0, sortOverride: newSort });
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const startIndex = total === 0 ? 0 : currentPage * pageSize + 1;
  const endIndex =
    total === 0 ? 0 : Math.min((currentPage + 1) * pageSize, total);

  // Sorting is done server-side across the whole result set (including derived
  // columns like Own and Engagement). Re-sorting here would only reorder the
  // current page and disagree with the server on anything it cannot see.
  const sortedUsers = users;

  const handleRefresh = () => {
    loadUsers({ pageOverride: currentPage });
  };

  const handleFilterChange = (nextRole, nextVerified, nextEngagement) => {
    setRoleFilter(nextRole);
    setVerifiedFilter(nextVerified);
    setEngagementFilter(nextEngagement ?? engagementFilter);
    setPage(0);
    loadUsers({
      pageOverride: 0,
      roleOverride: nextRole,
      verifiedOverride: nextVerified,
      engagementOverride: nextEngagement ?? engagementFilter,
    });
  };

  const formatDate = (val) => {
    if (!val) return "–";
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return "–";
    return d.toLocaleDateString();
  };

  const timeAgo = (val) => {
    if (!val) return "Never";
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return "Never";
    const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(months / 12);
    return `${years}y ago`;
  };

  const handleUserChanged = () => {
    // After update/delete, reload current page with same filters
    loadUsers({ pageOverride: currentPage });
  };

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
          <FiUsers />
          <span>Users</span>
        </h2>
      </div>

      {/* List container */}
      <div className="border border-base-300 rounded-lg bg-base-100/80 overflow-x-auto sm:overflow-x-visible">
        {/* Header bar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-base-200 text-xs text-primary/80">
          <span>
            {loading
              ? "Loading users…"
              : `Users: ${total} (page ${currentPage + 1} of ${totalPages})`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="btn btn-ghost btn-xs"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowListBody((v) => !v)}
              className="btn btn-ghost btn-xs"
              title={showListBody ? "Hide users list" : "Show users list"}
            >
              {showListBody ? <FiChevronUp /> : <FiChevronDown />}
            </button>
          </div>
        </div>

        {showListBody && (
          <>
            {/* Filters row */}
            <div className="px-3 py-2 border-b border-base-200 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between text-xs">
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  className="input input-xs input-bordered w-full"
                  placeholder="Search by email or trailname…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setPage(0);
                      loadUsers({ pageOverride: 0 });
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-xs btn-secondary"
                  onClick={() => {
                    setPage(0);
                    loadUsers({ pageOverride: 0 });
                  }}
                >
                  Search
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  className="select select-xs select-bordered"
                  value={roleFilter}
                  onChange={(e) =>
                    handleFilterChange(e.target.value, verifiedFilter)
                  }
                >
                  <option value="all">All roles</option>
                  <option value="user">Users</option>
                  <option value="admin">Admins</option>
                </select>

                <select
                  className="select select-xs select-bordered"
                  value={verifiedFilter}
                  onChange={(e) =>
                    handleFilterChange(roleFilter, e.target.value)
                  }
                >
                  <option value="all">All verification states</option>
                  <option value="true">Verified</option>
                  <option value="false">Unverified</option>
                </select>

                <select
                  className="select select-xs select-bordered"
                  value={engagementFilter}
                  title="How far the user got past signing up"
                  onChange={(e) =>
                    handleFilterChange(
                      roleFilter,
                      verifiedFilter,
                      e.target.value
                    )
                  }
                >
                  <option value="all">All engagement</option>
                  <option value="none">No activity</option>
                  <option value="copier">Copiers only</option>
                  <option value="builder">Builders</option>
                  <option value="power">Power users</option>
                </select>

                <select
                  className="select select-xs select-bordered"
                  value={pageSize}
                  onChange={(e) => {
                    const next = Number(e.target.value) || 25;
                    setPageSize(next);
                    setPage(0);
                    loadUsers({
                      pageOverride: 0,
                      pageSizeOverride: next,
                    });
                  }}
                >
                  <option value={10}>10 / page</option>
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
              </div>
            </div>

            {/* Error / empty states */}
            {error && !loading && (
              <div className="px-3 py-2 text-xs text-error">{error}</div>
            )}

            {!error && !loading && users.length === 0 && (
              <div className="px-3 py-2 text-xs text-primary/70">
                No users found for the current filters.
              </div>
            )}

            {/* Table / Cards */}
            {!loading && !error && users.length > 0 && (
              <>
                {/* Mobile sort controls */}
                <div className="lg:hidden px-3 py-2 border-b border-base-200 flex items-center gap-2">
                  <select
                    className="select select-xs select-bordered flex-1"
                    value={sort.field}
                    onChange={(e) => {
                      const newSort = { field: e.target.value, dir: "asc" };
                      setSort(newSort);
                      loadUsers({ pageOverride: 0, sortOverride: newSort });
                    }}
                  >
                    <option value="createdAt">Sort: Created</option>
                    <option value="email">Sort: Email</option>
                    <option value="trailname">Sort: Trailname</option>
                    <option value="role">Sort: Role</option>
                    <option value="verified">Sort: Verified</option>
                    <option value="lists">Sort: Lists</option>
                    <option value="items">Sort: Items</option>
                    <option value="own">Sort: Own items</option>
                    <option value="engagement">Sort: Engagement</option>
                    <option value="lastLoginAt">Sort: Last login</option>
                    <option value="lastActiveAt">Sort: Last seen</option>
                    <option value="marketing">Sort: Marketing</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => {
                      const newSort = { ...sort, dir: sort.dir === "asc" ? "desc" : "asc" };
                      setSort(newSort);
                      loadUsers({ pageOverride: 0, sortOverride: newSort });
                    }}
                    title={sort.dir === "asc" ? "Ascending" : "Descending"}
                  >
                    {sort.dir === "asc" ? "↑" : "↓"}
                  </button>
                </div>

                {/* Desktop table */}
                <div className="hidden lg:block">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead className="bg-base-200/80">
                    <tr>
                      <th
                        className="text-left px-3 py-2 font-semibold cursor-pointer select-none"
                        onClick={() => handleSort("email")}
                      >
                        Email
                        {sort.field === "email" && (
                          <span className="ml-1 text-[10px]">
                            {sort.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </th>
                      <th
                        className="text-left px-3 py-2 font-semibold cursor-pointer select-none"
                        onClick={() => handleSort("trailname")}
                      >
                        Trailname
                        {sort.field === "trailname" && (
                          <span className="ml-1 text-[10px]">
                            {sort.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </th>
                      <th
                        className="text-left px-3 py-2 font-semibold cursor-pointer select-none"
                        onClick={() => handleSort("role")}
                      >
                        Role
                        {sort.field === "role" && (
                          <span className="ml-1 text-[10px]">
                            {sort.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </th>
                      <th
                        className="text-left px-3 py-2 font-semibold cursor-pointer select-none"
                        onClick={() => handleSort("verified")}
                      >
                        Verified
                        {sort.field === "verified" && (
                          <span className="ml-1 text-[10px]">
                            {sort.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </th>
                      <th
                        className="text-right px-3 py-2 font-semibold cursor-pointer select-none"
                        onClick={() => handleSort("lists")}
                      >
                        Lists
                        {sort.field === "lists" && (
                          <span className="ml-1 text-[10px]">
                            {sort.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </th>
                      <th
                        className="text-right px-3 py-2 font-semibold cursor-pointer select-none"
                        onClick={() => handleSort("items")}
                      >
                        Items
                        {sort.field === "items" && (
                          <span className="ml-1 text-[10px]">
                            {sort.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </th>
                      <th
                        className="text-right px-3 py-2 font-semibold cursor-pointer select-none"
                        onClick={() => handleSort("own")}
                        title="Items the user added themselves — excludes anything that arrived by copying a list"
                      >
                        Own
                        {sort.field === "own" && (
                          <span className="ml-1 text-[10px]">
                            {sort.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </th>
                      <th
                        className="text-left px-3 py-2 font-semibold cursor-pointer select-none"
                        onClick={() => handleSort("engagement")}
                      >
                        Engagement
                        {sort.field === "engagement" && (
                          <span className="ml-1 text-[10px]">
                            {sort.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </th>
                      <th
                        className="text-left px-3 py-2 font-semibold cursor-pointer select-none"
                        onClick={() => handleSort("createdAt")}
                      >
                        Created
                        {sort.field === "createdAt" && (
                          <span className="ml-1 text-[10px]">
                            {sort.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </th>
                      <th
                        className="text-left px-3 py-2 font-semibold cursor-pointer select-none"
                        onClick={() => handleSort("lastLoginAt")}
                      >
                        Last login
                        {sort.field === "lastLoginAt" && (
                          <span className="ml-1 text-[10px]">
                            {sort.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </th>
                      <th
                        className="text-left px-3 py-2 font-semibold cursor-pointer select-none"
                        onClick={() => handleSort("lastActiveAt")}
                      >
                        Last seen
                        {sort.field === "lastActiveAt" && (
                          <span className="ml-1 text-[10px]">
                            {sort.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </th>
                      <th className="text-left px-3 py-2 font-semibold">
                        Status
                      </th>
                      <th
                        className="text-left px-3 py-2 font-semibold cursor-pointer select-none"
                        onClick={() => handleSort("marketing")}
                      >
                        Marketing
                        {sort.field === "marketing" && (
                          <span className="ml-1 text-[10px]">
                            {sort.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </th>
                      <th className="text-right px-3 py-2 font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {sortedUsers.map((u) => (
                      <tr
                        key={u._id}
                        className="border-t border-base-200 hover:bg-base-200/40"
                      >
                        <td className="px-3 py-2 align-top max-w-[220px]">
                          <div className="truncate">{u.email}</div>
                          {u.locale && (
                            <div className="text-[10px] text-primary/70 mt-0.5">
                              {u.locale}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top max-w-[160px] truncate">
                          {u.trailname || "–"}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span
                            className={
                              "badge badge-xs " +
                              (u.isAdmin ? "badge-secondary" : "badge-ghost")
                            }
                          >
                            {u.isAdmin ? "Admin" : "User"}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span
                            className={
                              "badge badge-xs " +
                              (u.isVerified ? "badge-success" : "badge-ghost")
                            }
                          >
                            {u.isVerified ? "Verified" : "Unverified"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right align-top">
                          <div>{u.listsCount ?? 0}</div>
                          {(u.listsCopied ?? 0) > 0 && (
                            <div
                              className="text-[10px] text-primary/70 mt-0.5"
                              title={`${u.listsCopied} of these lists were copied from someone else`}
                            >
                              {u.listsCopied} copied
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right align-top">
                          <div>{u.itemsCount ?? 0}</div>
                          <div className="text-[10px] text-primary/70 mt-0.5">
                            {u.catalogItemsCount ?? 0} cat / {u.customItemsCount ?? 0} cust
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right align-top">
                          <div
                            className={
                              (u.ownItemsCount ?? 0) > 0
                                ? "font-semibold text-primary"
                                : "text-primary/40"
                            }
                          >
                            {u.ownItemsCount ?? 0}
                          </div>
                          {(u.importedItemsCount ?? 0) > 0 && (
                            <div
                              className="text-[10px] text-primary/70 mt-0.5"
                              title="Items that arrived by copying someone else's list"
                            >
                              +{u.importedItemsCount} pack
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <EngagementBadge value={u.engagement} />
                        </td>
                        <td className="px-3 py-2 align-top text-xs">
                          {formatDate(u.createdAt)}
                        </td>
                        <td
                          className="px-3 py-2 align-top text-xs"
                          title={u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : ""}
                        >
                          {timeAgo(u.lastLoginAt)}
                        </td>
                        <td
                          className="px-3 py-2 align-top text-xs"
                          title={u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString() : ""}
                        >
                          {timeAgo(u.lastActiveAt)}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span
                            className={
                              "badge badge-xs " +
                              (u.isDisabled ? "badge-error" : "badge-success")
                            }
                          >
                            {u.isDisabled ? "Disabled" : "Active"}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span
                            className={
                              "badge badge-xs " +
                              (u.marketing?.optedIn
                                ? "badge-success"
                                : "badge-ghost")
                            }
                          >
                            {u.marketing?.optedIn ? "Opted in" : "No"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right align-top">
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => setSelectedUserId(u._id)}
                            title="View user details"
                          >
                            <FiEdit2 />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>

                {/* Mobile cards */}
                <div className="lg:hidden divide-y divide-base-200">
                  {sortedUsers.map((u) => (
                    <div
                      key={u._id}
                      className="px-3 py-3 space-y-2"
                    >
                      {/* Header: Email + Actions */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-primary truncate">
                            {u.email}
                          </div>
                          {u.locale && (
                            <div className="text-[10px] text-primary/70 mt-0.5">
                              {u.locale}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs flex-shrink-0"
                          onClick={() => setSelectedUserId(u._id)}
                          title="View user details"
                        >
                          <FiEdit2 />
                        </button>
                      </div>

                      {/* Trailname */}
                      {u.trailname && (
                        <div className="text-xs text-primary/70">
                          {u.trailname}
                        </div>
                      )}

                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={
                            "badge badge-xs " +
                            (u.isAdmin ? "badge-secondary" : "badge-ghost")
                          }
                        >
                          {u.isAdmin ? "Admin" : "User"}
                        </span>
                        <span
                          className={
                            "badge badge-xs " +
                            (u.isVerified ? "badge-success" : "badge-ghost")
                          }
                        >
                          {u.isVerified ? "Verified" : "Unverified"}
                        </span>
                        <span
                          className={
                            "badge badge-xs " +
                            (u.isDisabled ? "badge-error" : "badge-success")
                          }
                        >
                          {u.isDisabled ? "Disabled" : "Active"}
                        </span>
                        <span
                          className={
                            "badge badge-xs " +
                            (u.marketing?.optedIn
                              ? "badge-success"
                              : "badge-ghost")
                          }
                        >
                          {u.marketing?.optedIn ? "Marketing" : "No marketing"}
                        </span>
                        <EngagementBadge value={u.engagement} />
                      </div>

                      {/* Stats */}
                      <div className="text-xs text-primary/80">
                        <span className="font-medium">{u.listsCount ?? 0}</span>{" "}
                        lists
                        {(u.listsCopied ?? 0) > 0 && (
                          <span className="text-primary/60">
                            {" "}
                            ({u.listsCopied} copied)
                          </span>
                        )}{" "}
                        &middot;{" "}
                        <span className="font-medium">{u.itemsCount ?? 0}</span>{" "}
                        items
                        <span className="text-primary/60">
                          {" "}({u.catalogItemsCount ?? 0} cat / {u.customItemsCount ?? 0} cust)
                        </span>
                      </div>
                      <div className="text-xs text-primary/80">
                        <span className="font-medium">
                          {u.ownItemsCount ?? 0}
                        </span>{" "}
                        added themselves
                        {(u.importedItemsCount ?? 0) > 0 && (
                          <span className="text-primary/60">
                            {" "}
                            &middot; {u.importedItemsCount} from packs
                          </span>
                        )}
                      </div>

                      {/* Dates */}
                      <div className="text-[11px] text-primary/60 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>
                          <span className="font-medium text-primary/70">Created:</span>{" "}
                          {formatDate(u.createdAt)}
                        </span>
                        <span title={u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : ""}>
                          <span className="font-medium text-primary/70">Login:</span>{" "}
                          {timeAgo(u.lastLoginAt)}
                        </span>
                        <span title={u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString() : ""}>
                          <span className="font-medium text-primary/70">Seen:</span>{" "}
                          {timeAgo(u.lastActiveAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination footer */}
                <div className="flex items-center justify-between px-3 py-2 border-t border-base-200 text-xs text-primary/80">
                  <span>
                    Showing {startIndex}–{endIndex} of {total}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      disabled={currentPage === 0 || loading}
                      onClick={() =>
                        loadUsers({ pageOverride: currentPage - 1 })
                      }
                    >
                      Previous
                    </button>
                    <span>
                      Page {currentPage + 1} of {totalPages}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      disabled={currentPage >= totalPages - 1 || loading}
                      onClick={() =>
                        loadUsers({ pageOverride: currentPage + 1 })
                      }
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Detail modal */}
      {selectedUserId && (
        <UserDetailModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onUserChanged={handleUserChanged}
        />
      )}
    </div>
  );
}

function PublicListsSection() {
  const [lists, setLists] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0); // 0-based
  const [pageSize, setPageSize] = useState(25);
  const [showListBody, setShowListBody] = useState(true);

  const [sort, setSort] = useState({
    field: "createdAt", // "title" | "owner" | "views" | "lastViewedAt" | "createdAt"
    dir: "desc", // "asc" | "desc"
  });

  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [featureTogglingId, setFeatureTogglingId] = useState(null);
  const [listToRevoke, setListToRevoke] = useState(null);

  const loadLists = async ({
    pageOverride,
    pageSizeOverride,
    searchOverride,
    sortOverride,
  } = {}) => {
    const nextPage = pageOverride ?? page;
    const nextPageSize = pageSizeOverride ?? pageSize;
    const nextSearch = searchOverride ?? search;
    const nextSort = sortOverride ?? sort;

    setLoading(true);
    setError("");
    try {
      const params = {
        limit: nextPageSize,
        skip: nextPage * nextPageSize,
        sortField: nextSort.field,
        sortDir: nextSort.dir,
      };
      if (nextSearch.trim()) {
        params.q = nextSearch.trim();
      }
      const { data } = await api.get("/admin/public-lists", { params });
      setLists(data.lists || []);
      setTotal(data.total || 0);
      setPage(nextPage);
      setPageSize(nextPageSize);
    } catch (err) {
      console.error("Failed to load public lists", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load public lists.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLists({ pageOverride: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSort = (field) => {
    const newSort =
      sort.field === field
        ? { field, dir: sort.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "asc" };
    setSort(newSort);
    loadLists({ pageOverride: 0, sortOverride: newSort });
  };

  const boolToNum = (val) => (val ? 1 : 0);

  const sortedLists = [...lists].sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;

    switch (sort.field) {
      case "title": {
        const at = (a.title || "").toLowerCase();
        const bt = (b.title || "").toLowerCase();
        return at.localeCompare(bt) * dir;
      }
      case "owner": {
        const ae = (a.ownerEmail || "").toLowerCase();
        const be = (b.ownerEmail || "").toLowerCase();
        return ae.localeCompare(be) * dir;
      }
      case "views": {
        const av = a.viewsCount ?? 0;
        const bv = b.viewsCount ?? 0;
        if (av === bv) return 0;
        return av > bv ? dir : -dir;
      }
      case "lastViewedAt": {
        const al = a.lastViewedAt ? new Date(a.lastViewedAt).getTime() : 0;
        const bl = b.lastViewedAt ? new Date(b.lastViewedAt).getTime() : 0;
        if (al === bl) return 0;
        return al > bl ? dir : -dir;
      }
      case "createdAt":
      default: {
        const ac = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bc = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (ac === bc) return 0;
        return ac > bc ? dir : -dir;
      }
    }
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const startIndex = total === 0 ? 0 : currentPage * pageSize + 1;
  const endIndex =
    total === 0 ? 0 : Math.min((currentPage + 1) * pageSize, total);

  const formatDate = (val) => {
    if (!val) return "–";
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return "–";
    return d.toLocaleDateString();
  };

  const formatDateTimeShort = (val) => {
    if (!val) return "–";
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return "–";
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleRefresh = () => {
    loadLists({ pageOverride: currentPage });
  };

  const handleSearchClick = () => {
    setPage(0);
    loadLists({ pageOverride: 0 });
  };

  const handleRevoke = async (list) => {
    if (!list || !list._id) return;
    setStatusUpdatingId(list._id);
    try {
      await api.post(`/admin/public-lists/${list._id}/revoke`);
      toast.success("Public link revoked.");
      setListToRevoke(null);
      loadLists({ pageOverride: currentPage });
    } catch (err) {
      console.error("Failed to revoke public list", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to revoke public list.";
      toast.error(msg);
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleUnrevoke = async (list) => {
    if (!list || !list._id) return;
    setStatusUpdatingId(list._id);
    try {
      await api.post(`/admin/public-lists/${list._id}/unrevoke`);
      toast.success("Public link re-enabled.");
      loadLists({ pageOverride: currentPage });
    } catch (err) {
      console.error("Failed to unrevoke public list", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to re-enable public list.";
      toast.error(msg);
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleToggleFeatured = async (list) => {
    if (!list || !list._id) return;
    setFeatureTogglingId(list._id);
    try {
      const next = !boolToNum(list.isFeatured);
      await api.patch(`/admin/public-lists/${list._id}`, {
        isFeatured: next,
      });
      toast.success(
        next ? "List marked as featured." : "List unmarked as featured.",
      );
      loadLists({ pageOverride: currentPage });
    } catch (err) {
      console.error("Failed to toggle featured flag", err);
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to update featured flag.";
      toast.error(msg);
    } finally {
      setFeatureTogglingId(null);
    }
  };

  const handleCopyLink = (list) => {
    if (!list || !list.token) {
      toast.error("No active share link for this list.");
      return;
    }
    const url = `${window.location.origin}/share/${list.token}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        () => toast.success("Public link copied to clipboard."),
        () => {
          // fallback
          try {
            const dummy = document.createElement("textarea");
            dummy.value = url;
            document.body.appendChild(dummy);
            dummy.select();
            document.execCommand("copy");
            document.body.removeChild(dummy);
            toast.success("Public link copied to clipboard.");
          } catch {
            toast(url);
          }
        },
      );
    } else {
      toast(url);
    }
  };

  const handleOpenLink = (list) => {
    if (!list || !list.token) {
      toast.error("No active share link for this list.");
      return;
    }
    const url = `${window.location.origin}/share/${list.token}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
          <FiUsers />
          <span>Public gear lists</span>
        </h2>
        <p className="text-xs sm:text-sm text-primary/70 max-w-md text-right">
          Search and manage shared gear lists. Revoke abused/broken links or
          flag great lists to feature later.
        </p>
      </div>

      {/* List container */}
      <div className="border border-base-300 rounded-lg bg-base-100/80 overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-base-200 text-xs text-primary/80">
          <span>
            {loading
              ? "Loading public lists…"
              : `Public lists: ${total} (page ${
                  currentPage + 1
                } of ${totalPages})`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="btn btn-ghost btn-xs"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowListBody((v) => !v)}
              className="btn btn-ghost btn-xs"
              title={showListBody ? "Hide public lists" : "Show public lists"}
            >
              {showListBody ? <FiChevronUp /> : <FiChevronDown />}
            </button>
          </div>
        </div>

        {showListBody && (
          <>
            {/* Filters / search row */}
            <div className="px-3 py-2 border-b border-base-200 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between text-xs">
              <div className="flex-1 flex gap-2">
                <input
                  type="text"
                  className="input input-xs input-bordered w-full"
                  placeholder="Search by list title, owner email, or share token…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearchClick();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-xs btn-secondary"
                  onClick={handleSearchClick}
                >
                  Search
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  className="select select-xs select-bordered"
                  value={pageSize}
                  onChange={(e) => {
                    const next = Number(e.target.value) || 25;
                    setPageSize(next);
                    setPage(0);
                    loadLists({
                      pageOverride: 0,
                      pageSizeOverride: next,
                    });
                  }}
                >
                  <option value={10}>10 / page</option>
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
              </div>
            </div>

            {/* Error / empty states */}
            {error && !loading && (
              <div className="px-3 py-2 text-xs text-error">{error}</div>
            )}

            {!error && !loading && lists.length === 0 && (
              <div className="px-3 py-2 text-xs text-primary/70">
                No public lists found for the current search.
              </div>
            )}

            {/* Table / Cards */}
            {!loading && !error && lists.length > 0 && (
              <>
                {/* Mobile sort controls */}
                <div className="lg:hidden px-3 py-2 border-b border-base-200 flex items-center gap-2">
                  <select
                    className="select select-xs select-bordered flex-1"
                    value={sort.field}
                    onChange={(e) => {
                      const newSort = { field: e.target.value, dir: "asc" };
                      setSort(newSort);
                      loadLists({ pageOverride: 0, sortOverride: newSort });
                    }}
                  >
                    <option value="createdAt">Sort: Created</option>
                    <option value="title">Sort: Title</option>
                    <option value="owner">Sort: Owner</option>
                    <option value="views">Sort: Views</option>
                    <option value="lastViewedAt">Sort: Last viewed</option>
                  </select>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => {
                      const newSort = { ...sort, dir: sort.dir === "asc" ? "desc" : "asc" };
                      setSort(newSort);
                      loadLists({ pageOverride: 0, sortOverride: newSort });
                    }}
                    title={sort.dir === "asc" ? "Ascending" : "Descending"}
                  >
                    {sort.dir === "asc" ? "↑" : "↓"}
                  </button>
                </div>

                {/* Desktop table */}
                <div className="hidden lg:block">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead className="bg-base-200/80">
                    <tr>
                      <th
                        className="text-left px-3 py-2 font-semibold cursor-pointer select-none"
                        onClick={() => handleSort("title")}
                      >
                        Title
                        {sort.field === "title" && (
                          <span className="ml-1 text-[10px]">
                            {sort.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </th>
                      <th
                        className="text-left px-3 py-2 font-semibold cursor-pointer select-none"
                        onClick={() => handleSort("owner")}
                      >
                        Owner
                        {sort.field === "owner" && (
                          <span className="ml-1 text-[10px]">
                            {sort.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </th>
                      <th className="text-left px-3 py-2 font-semibold">
                        Region
                      </th>
                      <th
                        className="text-right px-3 py-2 font-semibold cursor-pointer select-none"
                        onClick={() => handleSort("views")}
                      >
                        Views
                        {sort.field === "views" && (
                          <span className="ml-1 text-[10px]">
                            {sort.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </th>
                      <th
                        className="text-left px-3 py-2 font-semibold cursor-pointer select-none"
                        onClick={() => handleSort("lastViewedAt")}
                      >
                        Last viewed
                        {sort.field === "lastViewedAt" && (
                          <span className="ml-1 text-[10px]">
                            {sort.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </th>
                      <th
                        className="text-left px-3 py-2 font-semibold cursor-pointer select-none"
                        onClick={() => handleSort("createdAt")}
                      >
                        Created
                        {sort.field === "createdAt" && (
                          <span className="ml-1 text-[10px]">
                            {sort.dir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </th>
                      <th className="text-left px-3 py-2 font-semibold">
                        Status
                      </th>
                      <th className="text-left px-3 py-2 font-semibold">
                        Featured
                      </th>
                      <th className="text-right px-3 py-2 font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {sortedLists.map((list) => (
                      <tr
                        key={list._id}
                        className="border-t border-base-200 hover:bg-base-200/40"
                      >
                        <td className="px-3 py-2 align-top max-w-[220px]">
                          <div className="truncate">
                            {list.title || "(untitled list)"}
                          </div>
                          {list.token && list.isActive && (
                            <div className="text-[10px] text-primary/70 mt-0.5">
                              Token: {list.token}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top max-w-[220px]">
                          <div className="truncate text-xs sm:text-sm">
                            {list.ownerEmail || "–"}
                          </div>
                          {list.ownerTrailname && (
                            <div className="text-[10px] text-primary/70 mt-0.5">
                              {list.ownerTrailname}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top text-xs">
                          {list.region || "–"}
                        </td>
                        <td className="px-3 py-2 align-top text-right text-xs">
                          {list.viewsCount ?? 0}
                        </td>
                        <td className="px-3 py-2 align-top text-xs">
                          {formatDateTimeShort(list.lastViewedAt)}
                        </td>
                        <td className="px-3 py-2 align-top text-xs">
                          {formatDate(list.createdAt)}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span
                            className={
                              "badge badge-xs " +
                              (list.isActive ? "badge-success" : "badge-ghost")
                            }
                          >
                            {list.isActive ? "Active" : "Revoked"}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span
                            className={
                              "badge badge-xs " +
                              (list.isFeatured
                                ? "badge-secondary"
                                : "badge-ghost")
                            }
                          >
                            {list.isFeatured ? "Featured" : "Normal"}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top text-right">
                          <div className="inline-flex items-center gap-2 justify-end">
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => handleOpenLink(list)}
                              disabled={!list.token || !list.isActive}
                              title="Open public link in new tab"
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => handleCopyLink(list)}
                              disabled={!list.token || !list.isActive}
                              title="Copy public link"
                            >
                              Copy
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => handleToggleFeatured(list)}
                              disabled={featureTogglingId === list._id}
                              title={
                                list.isFeatured
                                  ? "Unfeature this list"
                                  : "Mark this list as featured"
                              }
                            >
                              {featureTogglingId === list._id
                                ? "Saving..."
                                : list.isFeatured
                                  ? "Unfeature"
                                  : "Feature"}
                            </button>
                            {list.isActive ? (
                              // Active: show Revoke with confirm dialog
                              <button
                                type="button"
                                className="btn btn-xs btn-outline btn-error"
                                onClick={() => setListToRevoke(list)}
                                disabled={statusUpdatingId === list._id}
                                title="Revoke / unpublish this public link"
                              >
                                {statusUpdatingId === list._id
                                  ? "Updating..."
                                  : "Revoke"}
                              </button>
                            ) : (
                              // Revoked: show Unrevoke, no confirm dialog
                              <button
                                type="button"
                                className="btn btn-xs btn-outline"
                                onClick={() => handleUnrevoke(list)}
                                disabled={statusUpdatingId === list._id}
                                title="Re-enable this public link"
                              >
                                {statusUpdatingId === list._id
                                  ? "Updating..."
                                  : "Unrevoke"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>

                {/* Mobile cards */}
                <div className="lg:hidden divide-y divide-base-200">
                  {sortedLists.map((list) => (
                    <div
                      key={list._id}
                      className="px-3 py-3 space-y-2"
                    >
                      {/* Title */}
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-primary truncate">
                          {list.title || "(untitled list)"}
                        </div>
                        {list.token && list.isActive && (
                          <div className="text-[10px] text-primary/70 mt-0.5 truncate">
                            Token: {list.token}
                          </div>
                        )}
                      </div>

                      {/* Owner */}
                      <div className="text-xs text-primary/80 truncate">
                        <span className="font-medium text-primary/70">Owner:</span>{" "}
                        {list.ownerEmail || "–"}
                        {list.ownerTrailname && (
                          <span className="text-primary/60"> ({list.ownerTrailname})</span>
                        )}
                      </div>

                      {/* Region + Views */}
                      <div className="text-xs text-primary/80 flex items-center gap-3">
                        <span>
                          <span className="font-medium text-primary/70">Region:</span>{" "}
                          {list.region || "–"}
                        </span>
                        <span>
                          <span className="font-medium text-primary/70">Views:</span>{" "}
                          {list.viewsCount ?? 0}
                        </span>
                      </div>

                      {/* Dates */}
                      <div className="text-[11px] text-primary/60 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>
                          <span className="font-medium text-primary/70">Created:</span>{" "}
                          {formatDate(list.createdAt)}
                        </span>
                        <span>
                          <span className="font-medium text-primary/70">Last viewed:</span>{" "}
                          {formatDateTimeShort(list.lastViewedAt)}
                        </span>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={
                            "badge badge-xs " +
                            (list.isActive ? "badge-success" : "badge-ghost")
                          }
                        >
                          {list.isActive ? "Active" : "Revoked"}
                        </span>
                        <span
                          className={
                            "badge badge-xs " +
                            (list.isFeatured ? "badge-secondary" : "badge-ghost")
                          }
                        >
                          {list.isFeatured ? "Featured" : "Normal"}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => handleOpenLink(list)}
                          disabled={!list.token || !list.isActive}
                          title="Open public link in new tab"
                        >
                          <FiExternalLink />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => handleCopyLink(list)}
                          disabled={!list.token || !list.isActive}
                          title="Copy public link"
                        >
                          <FiCopy />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => handleToggleFeatured(list)}
                          disabled={featureTogglingId === list._id}
                          title={
                            list.isFeatured
                              ? "Unfeature this list"
                              : "Mark this list as featured"
                          }
                        >
                          {featureTogglingId === list._id
                            ? "Saving..."
                            : list.isFeatured
                              ? "Unfeature"
                              : "Feature"}
                        </button>
                        {list.isActive ? (
                          <button
                            type="button"
                            className="btn btn-xs btn-outline btn-error"
                            onClick={() => setListToRevoke(list)}
                            disabled={statusUpdatingId === list._id}
                            title="Revoke / unpublish this public link"
                          >
                            {statusUpdatingId === list._id
                              ? "Updating..."
                              : "Revoke"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-xs btn-outline"
                            onClick={() => handleUnrevoke(list)}
                            disabled={statusUpdatingId === list._id}
                            title="Re-enable this public link"
                          >
                            {statusUpdatingId === list._id
                              ? "Updating..."
                              : "Unrevoke"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination footer */}
                <div className="flex items-center justify-between px-3 py-2 border-t border-base-200 text-xs text-primary/80">
                  <span>
                    Showing {startIndex}–{endIndex} of {total}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      disabled={currentPage === 0 || loading}
                      onClick={() =>
                        loadLists({ pageOverride: currentPage - 1 })
                      }
                    >
                      Previous
                    </button>
                    <span>
                      Page {currentPage + 1} of {totalPages}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs"
                      disabled={currentPage >= totalPages - 1 || loading}
                      onClick={() =>
                        loadLists({ pageOverride: currentPage + 1 })
                      }
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Revoke confirm dialog */}
      <ConfirmDialog
        isOpen={!!listToRevoke}
        title="Revoke public link?"
        message={
          listToRevoke
            ? `This will revoke the public share link for “${
                listToRevoke.title || "(untitled list)"
              }”. Existing visitors will no longer be able to open it.`
            : ""
        }
        confirmText="Revoke link"
        cancelText="Cancel"
        onConfirm={() => handleRevoke(listToRevoke)}
        onCancel={() => setListToRevoke(null)}
      />
    </div>
  );
}

function CommunityModerationSection() {
  const [flagged, setFlagged] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forums, setForums] = useState([]);
  const [forumsLoading, setForumsLoading] = useState(true);
  const [showAddForum, setShowAddForum] = useState(false);
  const [newForum, setNewForum] = useState({ name: "", slug: "", description: "", sortOrder: 0 });
  const [editingForumId, setEditingForumId] = useState(null);
  const [editForum, setEditForum] = useState({ name: "", description: "", sortOrder: 0 });
  const [confirmForum, setConfirmForum] = useState(null); // { action: "delete"|"archive", forum }

  async function fetch() {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/community/flagged");
      setFlagged(data);
    } catch {
      toast.error("Could not load flagged content");
    } finally {
      setLoading(false);
    }
  }

  async function fetchForums() {
    setForumsLoading(true);
    try {
      const { data } = await api.get("/admin/community/forums");
      setForums(data);
    } catch {
      toast.error("Could not load forums");
    } finally {
      setForumsLoading(false);
    }
  }

  useEffect(() => { fetch(); fetchForums(); }, []);

  async function removePost(postId) {
    if (!window.confirm("Remove this post?")) return;
    await api.delete(`/admin/community/posts/${postId}`);
    setFlagged((f) => ({ ...f, posts: f.posts.filter((p) => p._id !== postId) }));
  }

  async function clearPostFlags(postId) {
    await api.put(`/admin/community/posts/${postId}/clear-flags`);
    setFlagged((f) => ({
      ...f,
      posts: f.posts.map((p) => (p._id === postId ? { ...p, flagCount: 0 } : p)),
    }));
  }

  async function removeComment(commentId) {
    if (!window.confirm("Remove this comment?")) return;
    await api.delete(`/admin/community/comments/${commentId}`);
    setFlagged((f) => ({ ...f, comments: f.comments.filter((c) => c._id !== commentId) }));
  }

  async function clearCommentFlags(commentId) {
    await api.put(`/admin/community/comments/${commentId}/clear-flags`);
    setFlagged((f) => ({
      ...f,
      comments: f.comments.map((c) => (c._id === commentId ? { ...c, flagCount: 0 } : c)),
    }));
  }

  function handleNewForumNameChange(e) {
    const name = e.target.value;
    const autoSlug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    setNewForum((f) => ({ ...f, name, slug: autoSlug }));
  }

  async function handleCreateForum(e) {
    e.preventDefault();
    try {
      const { data } = await api.post("/admin/community/forums", newForum);
      setForums((f) => [...f, data].sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name)));
      setNewForum({ name: "", slug: "", description: "", sortOrder: 0 });
      setShowAddForum(false);
      toast.success("Forum created");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not create forum");
    }
  }

  async function handleUpdateForum(e, id) {
    e.preventDefault();
    try {
      const { data } = await api.put(`/admin/community/forums/${id}`, editForum);
      setForums((f) => f.map((fo) => (fo._id === id ? data : fo)));
      setEditingForumId(null);
      toast.success("Forum updated");
    } catch {
      toast.error("Could not update forum");
    }
  }

  async function handleToggleArchive(forum) {
    try {
      const { data } = await api.put(`/admin/community/forums/${forum._id}`, {
        name: forum.name,
        description: forum.description,
        sortOrder: forum.sortOrder,
        isArchived: !forum.isArchived,
      });
      setForums((f) => f.map((fo) => (fo._id === forum._id ? data : fo)));
      toast.success(data.isArchived ? "Forum archived" : "Forum restored");
    } catch {
      toast.error("Could not update forum");
    }
  }

  async function handleDeleteForum(id) {
    try {
      await api.delete(`/admin/community/forums/${id}`);
      setForums((f) => f.filter((fo) => fo._id !== id));
      toast.success("Forum deleted");
    } catch {
      toast.error("Could not delete forum");
    }
  }

  if (loading) return <div className="py-8 text-center opacity-40 text-sm">Loading…</div>;

  const totalFlags = (flagged?.posts.length || 0) + (flagged?.comments.length || 0);

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Community moderation</h2>
        {totalFlags === 0 && (
          <span className="text-sm text-success">No flagged content</span>
        )}
      </div>

      {/* Flagged posts */}
      {flagged?.posts.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-2 text-warning">
            Flagged posts ({flagged.posts.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-base-200 text-left">
                  <th className="py-2 pr-4 font-medium">Title</th>
                  <th className="py-2 pr-4 font-medium">Author</th>
                  <th className="py-2 pr-4 font-medium">Community</th>
                  <th className="py-2 pr-4 font-medium text-center">Flags</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {flagged.posts.map((post) => (
                  <tr key={post._id} className="border-b border-base-200 hover:bg-base-200/50">
                    <td className="py-2 pr-4 max-w-xs truncate">
                      <a
                        href={`/community/${post.communityId?.slug}/${post._id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {post.title}
                      </a>
                    </td>
                    <td className="py-2 pr-4">{post.userId?.trailname || "—"}</td>
                    <td className="py-2 pr-4">{post.communityId?.name || "—"}</td>
                    <td className="py-2 pr-4 text-center">
                      <span className="badge badge-warning badge-sm">{post.flagCount}</span>
                    </td>
                    <td className="py-2 flex gap-2">
                      <button
                        onClick={() => clearPostFlags(post._id)}
                        className="btn btn-ghost btn-xs"
                      >
                        Clear flags
                      </button>
                      <button
                        onClick={() => removePost(post._id)}
                        className="btn btn-error btn-xs"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Flagged comments */}
      {flagged?.comments.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-2 text-warning">
            Flagged comments ({flagged.comments.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-base-200 text-left">
                  <th className="py-2 pr-4 font-medium">Comment</th>
                  <th className="py-2 pr-4 font-medium">Author</th>
                  <th className="py-2 pr-4 font-medium">Post</th>
                  <th className="py-2 pr-4 font-medium text-center">Flags</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {flagged.comments.map((comment) => (
                  <tr key={comment._id} className="border-b border-base-200 hover:bg-base-200/50">
                    <td className="py-2 pr-4 max-w-xs truncate opacity-80">{comment.body}</td>
                    <td className="py-2 pr-4">{comment.userId?.trailname || "—"}</td>
                    <td className="py-2 pr-4 max-w-xs truncate">
                      {comment.postId?.title || "—"}
                    </td>
                    <td className="py-2 pr-4 text-center">
                      <span className="badge badge-warning badge-sm">{comment.flagCount}</span>
                    </td>
                    <td className="py-2 flex gap-2">
                      <button
                        onClick={() => clearCommentFlags(comment._id)}
                        className="btn btn-ghost btn-xs"
                      >
                        Clear flags
                      </button>
                      <button
                        onClick={() => removeComment(comment._id)}
                        className="btn btn-error btn-xs"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Forum management */}
      <div className="divider my-2" />
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Forum management</h2>
          <button
            onClick={() => { setShowAddForum((v) => !v); setNewForum({ name: "", slug: "", description: "", sortOrder: 0 }); }}
            className="btn btn-primary btn-xs"
          >
            + Add forum
          </button>
        </div>

        {showAddForum && (
          <form onSubmit={handleCreateForum} className="bg-base-200 rounded-lg p-3 mb-4 space-y-2">
            <div className="flex gap-2 flex-wrap">
              <input
                placeholder="Name"
                value={newForum.name}
                onChange={handleNewForumNameChange}
                className="input input-sm input-bordered flex-1 min-w-[140px]"
                required
              />
              <input
                placeholder="Slug (e.g. hiking)"
                value={newForum.slug}
                onChange={(e) => setNewForum((f) => ({ ...f, slug: e.target.value }))}
                className="input input-sm input-bordered flex-1 min-w-[140px] font-mono"
                required
              />
              <input
                placeholder="Sort order"
                type="number"
                value={newForum.sortOrder}
                onChange={(e) => setNewForum((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                className="input input-sm input-bordered w-24"
              />
            </div>
            <input
              placeholder="Description (optional)"
              value={newForum.description}
              onChange={(e) => setNewForum((f) => ({ ...f, description: e.target.value }))}
              className="input input-sm input-bordered w-full"
            />
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary btn-xs">Create</button>
              <button type="button" onClick={() => setShowAddForum(false)} className="btn btn-ghost btn-xs">Cancel</button>
            </div>
          </form>
        )}

        {forumsLoading ? (
          <div className="text-xs opacity-40 py-2">Loading…</div>
        ) : forums.length === 0 ? (
          <p className="text-xs opacity-50">No forums yet. Click "+ Add forum" to create one.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-base-200 text-left">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Slug</th>
                  <th className="py-2 pr-4 font-medium">Description</th>
                  <th className="py-2 pr-4 font-medium text-center">Order</th>
                  <th className="py-2 pr-4 font-medium text-center">Status</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {forums.map((forum) =>
                  editingForumId === forum._id ? (
                    <tr key={forum._id} className="border-b border-base-200 bg-base-200/50">
                      <td colSpan={6} className="py-2 px-1">
                        <form onSubmit={(e) => handleUpdateForum(e, forum._id)} className="flex flex-wrap gap-2 items-center">
                          <input
                            value={editForum.name}
                            onChange={(e) => setEditForum((f) => ({ ...f, name: e.target.value }))}
                            className="input input-xs input-bordered min-w-[120px]"
                            placeholder="Name"
                            required
                          />
                          <input
                            value={editForum.description}
                            onChange={(e) => setEditForum((f) => ({ ...f, description: e.target.value }))}
                            className="input input-xs input-bordered flex-1 min-w-[160px]"
                            placeholder="Description"
                          />
                          <input
                            type="number"
                            value={editForum.sortOrder}
                            onChange={(e) => setEditForum((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                            className="input input-xs input-bordered w-16"
                            placeholder="Order"
                          />
                          <button type="submit" className="btn btn-primary btn-xs">Save</button>
                          <button type="button" onClick={() => setEditingForumId(null)} className="btn btn-ghost btn-xs">Cancel</button>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    <tr key={forum._id} className={`border-b border-base-200 hover:bg-base-200/50 ${forum.isArchived ? "opacity-50" : ""}`}>
                      <td className="py-2 pr-4 font-medium">{forum.name}</td>
                      <td className="py-2 pr-4 font-mono text-xs opacity-70">{forum.slug}</td>
                      <td className="py-2 pr-4 max-w-xs truncate opacity-60">{forum.description || "—"}</td>
                      <td className="py-2 pr-4 text-center">{forum.sortOrder}</td>
                      <td className="py-2 pr-4 text-center">
                        {forum.isArchived ? (
                          <span className="badge badge-ghost badge-sm">Archived</span>
                        ) : (
                          <span className="badge badge-success badge-sm">Active</span>
                        )}
                      </td>
                      <td className="py-2">
                        <div className="flex gap-1 flex-wrap">
                          <button
                            onClick={() => {
                              setEditingForumId(forum._id);
                              setEditForum({ name: forum.name, description: forum.description || "", sortOrder: forum.sortOrder || 0 });
                            }}
                            className="px-2 py-1 text-xs rounded border border-base-300 hover:bg-base-200 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setConfirmForum({ action: "archive", forum })}
                            className={`px-2 py-1 text-xs rounded border transition-colors ${forum.isArchived ? "border-success/50 text-success hover:bg-success/10" : "border-warning/50 text-warning hover:bg-warning/10"}`}
                          >
                            {forum.isArchived ? "Restore" : "Archive"}
                          </button>
                          <a
                            href={`/community/${forum.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 text-xs rounded border border-base-300 hover:bg-base-200 transition-colors inline-flex items-center justify-center text-inherit no-underline"
                          >
                            View
                          </a>
                          <button
                            onClick={() => setConfirmForum({ action: "delete", forum })}
                            className="px-2 py-1 text-xs rounded bg-error/90 text-white hover:bg-error transition-colors font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}

        <ConfirmDialog
          isOpen={!!confirmForum}
          title={
            confirmForum?.action === "delete"
              ? "Delete forum?"
              : confirmForum?.forum?.isArchived
              ? "Restore forum?"
              : "Archive forum?"
          }
          message={
            confirmForum?.action === "delete"
              ? `Permanently delete "${confirmForum?.forum?.name}"? All posts in this forum will also be deleted. This cannot be undone.`
              : confirmForum?.forum?.isArchived
              ? `Restore "${confirmForum?.forum?.name}"? It will become visible to users again.`
              : `Archive "${confirmForum?.forum?.name}"? It will be hidden from users but all posts will be preserved.`
          }
          confirmText={
            confirmForum?.action === "delete"
              ? "Delete forum"
              : confirmForum?.forum?.isArchived
              ? "Restore"
              : "Archive"
          }
          cancelText="Cancel"
          onConfirm={() => {
            if (confirmForum?.action === "delete") handleDeleteForum(confirmForum.forum._id);
            else handleToggleArchive(confirmForum.forum);
            setConfirmForum(null);
          }}
          onCancel={() => setConfirmForum(null)}
        />
      </section>
    </div>
  );
}

// ── QA / Reports: crowd-sourced catalog report queue + zero-result search log ──
// Feeds the catalog curation workflow (add-gear Phase 5). Both tables sort by
// demand (count desc) so the hottest problems / gaps surface first.
function ReportsQaSection() {
  const [reports, setReports] = useState([]);
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("open"); // open | resolved | all
  const [updatingId, setUpdatingId] = useState(null);

  const load = async (statusOverride) => {
    const nextStatus = statusOverride ?? status;
    setLoading(true);
    setError("");
    try {
      const [rep, log] = await Promise.all([
        api.get("/admin/reports", { params: { status: nextStatus } }),
        api.get("/admin/reports/search-log"),
      ]);
      setReports(rep.data.reports || []);
      setQueries(log.data.queries || []);
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to load QA data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load("open");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setReportStatus = async (report, nextStatus) => {
    setUpdatingId(report._id);
    try {
      await api.patch(`/admin/reports/${report._id}`, { status: nextStatus });
      // Drop it from the current view if it no longer matches the filter.
      if (status !== "all" && status !== nextStatus) {
        setReports((prev) => prev.filter((r) => r._id !== report._id));
      } else {
        setReports((prev) =>
          prev.map((r) => (r._id === report._id ? { ...r, status: nextStatus } : r)),
        );
      }
    } catch {
      toast.error("Failed to update report");
    } finally {
      setUpdatingId(null);
    }
  };

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

  return (
    <div className="flex flex-col gap-6 pb-8">
      {error && <div className="text-error text-sm">{error}</div>}

      {/* Catalog report queue */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold text-primary">
            Catalog reports {loading ? "" : `(${reports.length})`}
          </h2>
          <div className="flex items-center gap-2 text-sm">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                load(e.target.value);
              }}
              className="border border-primary/30 rounded px-2 py-1 bg-base-100 text-primary"
            >
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="all">All</option>
            </select>
            <button
              type="button"
              onClick={() => load()}
              className="px-2 py-1 rounded bg-secondary/10 text-secondary hover:bg-secondary/20"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-base-300 rounded bg-base-100">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral/30 text-primary/70 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">Issue</th>
                <th className="px-3 py-2 font-medium text-right">Count</th>
                <th className="px-3 py-2 font-medium">Last note</th>
                <th className="px-3 py-2 font-medium">Shown</th>
                <th className="px-3 py-2 font-medium">Last</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {!loading && reports.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-primary/50">
                    No reports.
                  </td>
                </tr>
              )}
              {reports.map((r) => (
                <tr key={r._id} className="border-t border-base-200 align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium text-primary">
                      {r.catalogItem
                        ? `${r.catalogItem.brand ? r.catalogItem.brand + " " : ""}${r.catalogItem.name || ""}`
                        : "(deleted item)"}
                    </div>
                    <div className="text-[11px] text-primary/50">
                      {r.catalogItem?.category || "—"}
                      {r.variantKey ? ` · ${r.variantKey}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {REPORT_FIELD_LABELS[r.field] || r.field}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">
                    {r.count}
                  </td>
                  <td className="px-3 py-2 max-w-[220px] text-primary/80 break-words">
                    {r.lastNote || "—"}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-primary/60 max-w-[180px] break-words">
                    {r.shownValues
                      ? [r.shownValues.weight, r.shownValues.category, r.shownValues.itemType]
                          .filter(Boolean)
                          .join(" / ") || "—"
                      : "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-primary/60">
                    {fmtDate(r.lastReportedAt)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        r.status === "resolved"
                          ? "text-primary/50"
                          : "text-accent font-medium"
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.status === "open" ? (
                      <button
                        type="button"
                        disabled={updatingId === r._id}
                        onClick={() => setReportStatus(r, "resolved")}
                        className="px-2 py-1 rounded bg-secondary text-white hover:bg-secondary/80 disabled:opacity-50"
                      >
                        Resolve
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={updatingId === r._id}
                        onClick={() => setReportStatus(r, "open")}
                        className="px-2 py-1 rounded bg-neutralAlt text-primary hover:bg-neutralAlt/80 disabled:opacity-50"
                      >
                        Reopen
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Zero-result search log */}
      <section>
        <h2 className="text-base font-semibold text-primary mb-2">
          Zero-result searches {loading ? "" : `(${queries.length})`}
        </h2>
        <div className="overflow-x-auto border border-base-300 rounded bg-base-100">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral/30 text-primary/70 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Query</th>
                <th className="px-3 py-2 font-medium text-right">Count</th>
                <th className="px-3 py-2 font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {!loading && queries.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-primary/50">
                    No zero-result searches logged.
                  </td>
                </tr>
              )}
              {queries.map((q) => (
                <tr key={q._id} className="border-t border-base-200">
                  <td className="px-3 py-2 text-primary break-words max-w-[420px]">
                    {q.query}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">
                    {q.count}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-primary/60">
                    {fmtDate(q.lastSeenAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function AdminView() {
  const [activeTab, setActiveTab] = useState("gearCatalog");
  const [duplicateSeed, setDuplicateSeed] = useState(null);
  const { sidebarCollapsed } = useUserSettings();

  const handleDuplicate = (item) => {
    setDuplicateSeed(item);
    setActiveTab("gearCreate");
  };

  return (
    <div className="h-full w-full flex flex-col bg-neutral/40">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-base-300 bg-base-100/90">
        <div>
          <h1
            className={
              "text-lg font-semibold text-primary" +
              (sidebarCollapsed ? " pl-6" : "")
            }
          >
            Admin panel
          </h1>
        </div>
      </header>

      {/* Tabs */}
      <div className="px-4 pt-2 border-b border-base-200 bg-base-100/80">
        <nav className="flex gap-2 overflow-x-auto text-sm">
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={
                  "px-3 py-1.5 rounded-t-md border-b-2 " +
                  (isActive
                    ? "border-secondary text-secondary font-semibold bg-base-100"
                    : "border-transparent text-primary/70 hover:text-primary")
                }
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <main className="flex-1 px-4 py-2 overflow-auto bg-neutral/20">
        {activeTab === "gearCatalog" && (
          <GearCatalogSection mode="list" onDuplicate={handleDuplicate} />
        )}
        {activeTab === "gearCreate" && (
          <GearCatalogSection
            mode="create"
            duplicateSeed={duplicateSeed}
            onSeedConsumed={() => setDuplicateSeed(null)}
          />
        )}
        {activeTab === "qa" && <ReportsQaSection />}
        {activeTab === "users" && <UsersSection />}
        {activeTab === "lists" && <PublicListsSection />}
        {activeTab === "community" && <CommunityModerationSection />}
      </main>
    </div>
  );
}

export default AdminView;
