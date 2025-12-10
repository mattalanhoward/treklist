// client/src/pages/AdminView.jsx
import React, { useState, useEffect } from "react";
import api from "../services/api";
import { toast } from "react-hot-toast";
import { FaEdit, FaTimes, FaChevronUp, FaChevronDown } from "react-icons/fa";
const TABS = [
  { id: "gear", label: "Gear catalog" },
  { id: "users", label: "Users" },
  { id: "lists", label: "Public lists" },
];

const NETWORK_OPTIONS = [
  { value: "amazon", label: "Amazon" },
  { value: "awin", label: "Awin" },
  { value: "impact", label: "Impact" },
];

const REGION_OPTIONS = [
  { value: "global", label: "Global" },
  { value: "us", label: "US" },
  { value: "uk", label: "UK" },
  { value: "de", label: "DE" },
  { value: "eu", label: "EU" },
  { value: "ca", label: "CA" },
];

function GearCatalogSection() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [archivingId, setArchivingId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(true);
  const [showListBody, setShowListBody] = useState(true);

  // Filters / sorting
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterBrand, setFilterBrand] = useState("all");
  const [filterNetwork, setFilterNetwork] = useState("all");
  const [sort, setSort] = useState({
    field: "updatedAt",
    dir: "desc", // "asc" | "desc"
  });

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    brand: "",
    category: "",
    description: "",
    weightGrams: "",
    tags: "",
    linkNetwork: "amazon",
    linkRegion: "global",
    linkUrl: "",
    linkMerchantName: "",
    linkExternalId: "",
  });

  const loadItems = async ({ includeArchived } = {}) => {
    setLoading(true);
    setError("");
    try {
      const shouldInclude = includeArchived ?? showArchived;
      const { data } = await api.get("/admin/catalog-items", {
        params: {
          isActive: shouldInclude ? "all" : "true",
          limit: 200,
        },
      });
      setItems(data.items || []);
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

  useEffect(() => {
    loadItems();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    if (!form.linkUrl.trim()) {
      toast.error("Affiliate URL is required.");
      return;
    }

    setCreating(true);
    try {
      const payload = {
        name: form.name.trim(),
        brand: form.brand.trim() || undefined,
        category: form.category.trim() || undefined,
        description: form.description.trim() || undefined,
        weightGrams: form.weightGrams ? Number(form.weightGrams) : undefined,
        tags: form.tags
          ? form.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        links: [
          {
            network: form.linkNetwork,
            region: form.linkRegion || "global",
            url: form.linkUrl.trim(),
            merchantName: form.linkMerchantName.trim() || undefined,
            externalId: form.linkExternalId.trim() || undefined,
            priority: 10,
          },
        ],
      };

      await api.post("/admin/catalog-items", payload);
      toast.success("Catalog item created.");
      setForm((prev) => ({
        ...prev,
        name: "",
        brand: "",
        category: "",
        description: "",
        weightGrams: "",
        tags: "",
        linkUrl: "",
        linkMerchantName: "",
        linkExternalId: "",
      }));
      loadItems();
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

  const handleArchiveToggle = async (item, nextIsActive) => {
    setArchivingId(item._id);
    try {
      await api.patch(`/admin/catalog-items/${item._id}/archive`, {
        isActive: nextIsActive,
      });
      toast.success(
        nextIsActive ? `Unarchived "${item.name}"` : `Archived "${item.name}"`
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
    loadItems();
  };

  // Build filter options from loaded items
  const categoryOptions = Array.from(
    new Set(items.map((i) => i.category).filter(Boolean))
  ).sort();

  const brandOptions = Array.from(
    new Set(items.map((i) => i.brand).filter(Boolean))
  ).sort();

  const networkOptions = Array.from(
    new Set(
      items
        .map((i) =>
          Array.isArray(i.links) && i.links[0] ? i.links[0].network : null
        )
        .filter(Boolean)
    )
  ).sort();

  // Filter items client-side based on search + filters
  const filteredItems = items.filter((item) => {
    const q = search.trim().toLowerCase();

    const mainLink =
      Array.isArray(item.links) && item.links[0] ? item.links[0] : null;
    const itemNetwork = mainLink?.network || "";

    // Search matches on name, brand, category, tags
    const searchMatches =
      !q ||
      [item.name, item.brand, item.category, (item.tags || []).join(" ")]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q));

    const categoryMatches =
      filterCategory === "all" || item.category === filterCategory;

    const brandMatches = filterBrand === "all" || item.brand === filterBrand;

    const networkMatches =
      filterNetwork === "all" || itemNetwork === filterNetwork;

    return searchMatches && categoryMatches && brandMatches && networkMatches;
  });

  // Sort handler
  const handleSort = (field) => {
    setSort((prev) => {
      if (prev.field === field) {
        // Same column: flip direction
        return {
          field,
          dir: prev.dir === "asc" ? "desc" : "asc",
        };
      }
      // New column: default to ascending
      return {
        field,
        dir: "asc",
      };
    });
  };

  // Apply sorting
  const sortedItems = filteredItems.slice().sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;

    const mainLinkA = Array.isArray(a.links) && a.links[0] ? a.links[0] : null;
    const mainLinkB = Array.isArray(b.links) && b.links[0] ? b.links[0] : null;

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
      case "network": {
        const na = (mainLinkA?.network || "").toLowerCase();
        const nb = (mainLinkB?.network || "").toLowerCase();
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

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-primary">
            Gear catalog (admin-curated)
          </h2>
          <p className="text-xs text-primary/80 max-w-2xl">
            Use this catalog to add affiliate-backed gear items (Amazon now,
            Awin/Impact later). When users import gear, they&apos;ll see this
            curated list instead of the full affiliate feeds.
          </p>
        </div>
      </div>

      {/* Create form */}
      <div className="bg-neutralAlt rounded-lg shadow-2xl border border-primary">
        {/* Form header with collapse toggle */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 sm:px-6 border-b border-base-200">
          <h3 className="text-sm font-semibold text-primary">
            Add catalog item
          </h3>
          <button
            type="button"
            onClick={() => setShowCreateForm((v) => !v)}
            className="btn btn-ghost btn-xs text-primary"
            title={showCreateForm ? "Hide create form" : "Show create form"}
          >
            {showCreateForm ? <FaChevronUp /> : <FaChevronDown />}
          </button>
        </div>

        {showCreateForm && (
          <form
            onSubmit={handleCreate}
            className="px-4 py-4 sm:px-6 sm:py-6 space-y-3"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              {/* LEFT column */}
              <div className="flex-1 space-y-2">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                      Category
                    </label>
                    <input
                      type="text"
                      name="category"
                      value={form.category}
                      onChange={handleChange}
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                      placeholder="shelter / mid-layer / headlamp..."
                    />
                  </div>
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
                    rows={2}
                    placeholder="Short blurb to help you recognize the item when importing."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      Weight (grams)
                    </label>
                    <input
                      type="number"
                      name="weightGrams"
                      value={form.weightGrams}
                      onChange={handleChange}
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                      placeholder="1400"
                      min="0"
                    />
                  </div>
                  <div className="sm:col-span-2">
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

              {/* RIGHT column */}
              <div className="flex-1 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium text-primary mb-0.5">
                      Network *
                    </label>
                    <select
                      name="linkNetwork"
                      value={form.linkNetwork}
                      onChange={handleChange}
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
                      name="linkRegion"
                      value={form.linkRegion}
                      onChange={handleChange}
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
                    name="linkUrl"
                    value={form.linkUrl}
                    onChange={handleChange}
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
                      name="linkMerchantName"
                      value={form.linkMerchantName}
                      onChange={handleChange}
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
                      name="linkExternalId"
                      value={form.linkExternalId}
                      onChange={handleChange}
                      className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
                      placeholder="ASIN, Awin product id..."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-base-200 mt-2">
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

      {/* List */}
      <div className="border border-base-300 rounded-lg bg-base-100/80 overflow-auto">
        <div className="flex items-center justify-between px-3 py-2 border-b border-base-200 text-xs text-primary/80">
          <span>
            {loading
              ? "Loading catalog items..."
              : showArchived
              ? `Catalog items (including archived): ${items.length}`
              : `Active catalog items: ${items.length}`}
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
              {showListBody ? <FaChevronUp /> : <FaChevronDown />}
            </button>
          </div>
        </div>
        {showListBody && (
          <>
            {error && !loading && (
              <div className="px-3 py-2 text-xs text-error">{error}</div>
            )}

            {!error && !loading && items.length === 0 && (
              <div className="px-3 py-3 text-xs text-primary/70">
                No catalog items yet. Use the form above to add your first
                affiliate-backed gear item.
              </div>
            )}

            {!loading && !error && items.length > 0 && (
              <>
                {/* Search + filters row */}
                <div className="px-3 py-2 border-b border-base-200 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between text-xs">
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      className="input input-xs input-bordered w-full"
                      placeholder="Search name, brand, category, tags..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      className="select select-xs select-bordered"
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
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
                      onChange={(e) => setFilterBrand(e.target.value)}
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
                      onChange={(e) => setFilterNetwork(e.target.value)}
                    >
                      <option value="all">All networks</option>
                      {networkOptions.map((net) => (
                        <option key={net} value={net}>
                          {net}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <table className="min-w-full text-xs sm:text-sm">
                  <thead className="bg-base-200/80">
                    <tr>
                      <th
                        className="text-left px-3 py-2 font-semibold cursor-pointer select-none"
                        onClick={() => handleSort("name")}
                      >
                        Name
                        {sort.field === "name" && (
                          <span className="ml-1 text-[10px]">
                            {sort.dir === "asc" ? "↓" : "↑"}
                          </span>
                        )}
                      </th>
                      <th
                        className="text-left px-3 py-2 font-semibold cursor-pointer select-none"
                        onClick={() => handleSort("category")}
                      >
                        Category
                        {sort.field === "category" && (
                          <span className="ml-1 text-[10px]">
                            {sort.dir === "asc" ? "↓" : "↑"}
                          </span>
                        )}
                      </th>
                      <th
                        className="text-left px-3 py-2 font-semibold cursor-pointer select-none"
                        onClick={() => handleSort("brand")}
                      >
                        Brand
                        {sort.field === "brand" && (
                          <span className="ml-1 text-[10px]">
                            {sort.dir === "asc" ? "↓" : "↑"}
                          </span>
                        )}
                      </th>
                      <th
                        className="text-left px-3 py-2 font-semibold cursor-pointer select-none"
                        onClick={() => handleSort("network")}
                      >
                        Network / Region
                        {sort.field === "network" && (
                          <span className="ml-1 text-[10px]">
                            {sort.dir === "asc" ? "↓" : "↑"}
                          </span>
                        )}
                      </th>
                      <th
                        className="text-left px-3 py-2 font-semibold cursor-pointer select-none"
                        onClick={() => handleSort("weight")}
                      >
                        Weight
                        {sort.field === "weight" && (
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
                        onClick={() => handleSort("updatedAt")}
                      >
                        Updated
                        {sort.field === "updatedAt" && (
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
                    {sortedItems.map((item) => {
                      const id = item._id || item.id;
                      const mainLink = Array.isArray(item.links)
                        ? item.links[0]
                        : null;
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
                          <td className="px-3 py-2 align-top">{item.name}</td>
                          <td className="px-3 py-2 align-top">
                            {item.category || "–"}
                          </td>
                          <td className="px-3 py-2 align-top">
                            {item.brand || "–"}
                          </td>
                          <td className="px-3 py-2 align-top">
                            {mainLink
                              ? `${mainLink.network} / ${
                                  mainLink.region || "global"
                                }`
                              : "–"}
                          </td>
                          <td className="px-3 py-2 text-right align-top">
                            {typeof item.weightGrams === "number"
                              ? `${item.weightGrams} g`
                              : "–"}
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
                          </td>
                          <td className="px-3 py-2 text-right align-top">
                            {updated}
                          </td>
                          <td className="px-3 py-2 text-right align-top">
                            <div className="inline-flex items-center gap-2 justify-end">
                              {/* Edit icon button */}
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                onClick={() => setEditingItem(item)}
                                title="Edit catalog item"
                              >
                                <FaEdit />
                              </button>

                              {/* Archive / Unarchive button */}
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
              </>
            )}
          </>
        )}
      </div>

      {editingItem && (
        <EditCatalogItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={handleEditSaved}
        />
      )}
    </section>
  );
}

function EditCatalogItemModal({ item, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(item.name || "");
  const [brand, setBrand] = useState(item.brand || "");
  const [category, setCategory] = useState(item.category || "");
  const [description, setDescription] = useState(item.description || "");
  const [weightGrams, setWeightGrams] = useState(
    typeof item.weightGrams === "number" ? String(item.weightGrams) : ""
  );
  const [tagsInput, setTagsInput] = useState(
    Array.isArray(item.tags) ? item.tags.join(", ") : ""
  );

  const primaryLink =
    Array.isArray(item.links) && item.links[0] ? item.links[0] : {};

  const [linkNetwork, setLinkNetwork] = useState(
    primaryLink.network || "amazon"
  );
  const [linkRegion, setLinkRegion] = useState(primaryLink.region || "global");
  const [linkUrl, setLinkUrl] = useState(primaryLink.url || "");
  const [linkMerchantName, setLinkMerchantName] = useState(
    primaryLink.merchantName || ""
  );
  const [linkExternalId, setLinkExternalId] = useState(
    primaryLink.externalId || ""
  );
  const [linkPriority, setLinkPriority] = useState(
    typeof primaryLink.priority === "number"
      ? String(primaryLink.priority)
      : "10"
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }
    if (!linkUrl.trim()) {
      toast.error("Affiliate URL is required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        brand: brand.trim() || undefined,
        category: category.trim() || undefined,
        description: description.trim() || undefined,
        weightGrams: weightGrams ? Number(weightGrams) : undefined,
        tags: tagsInput
          ? tagsInput
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        links: [
          {
            network: linkNetwork,
            region: linkRegion || "global",
            url: linkUrl.trim(),
            merchantName: linkMerchantName.trim() || undefined,
            externalId: linkExternalId.trim() || undefined,
            priority: linkPriority === "" ? 0 : Number(linkPriority) || 0,
          },
        ],
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
        className="bg-neutralAlt rounded-lg shadow-2xl max-w-xl w-full px-4 py-4 sm:px-6 sm:py-6 my-4"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-2 sm:mb-3">
          <h2 className="text-xl font-semibold text-primary">
            Edit catalog item
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-error hover:text-error/80"
          >
            <FaTimes />
          </button>
        </div>

        {/* Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
          {/* Name */}
          <div>
            <label className="block font-medium text-primary mb-0.5">
              Item name *
            </label>
            <input
              className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Brand */}
          <div>
            <label className="block font-medium text-primary mb-0.5">
              Brand
            </label>
            <input
              className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block font-medium text-primary mb-0.5">
              Category
            </label>
            <input
              className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="shelter / backpack / headlamp..."
            />
          </div>

          {/* Weight */}
          <div>
            <label className="block font-medium text-primary mb-0.5">
              Weight (grams)
            </label>
            <input
              type="number"
              min="0"
              className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
              value={weightGrams}
              onChange={(e) => setWeightGrams(e.target.value)}
            />
          </div>

          {/* Tags */}
          <div className="sm:col-span-2">
            <label className="block font-medium text-primary mb-0.5">
              Tags (comma-separated)
            </label>
            <input
              className="mt-0.5 block w-full border border-primary rounded px-2 py-1 text-primary"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="3-season, tent, 1p"
            />
          </div>
        </div>

        <div className="mt-3 border-t border-base-200 pt-3 space-y-2">
          <h3 className="text-sm font-semibold text-primary">
            Primary affiliate link
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-primary mb-1">
                Network
              </label>
              <select
                className="select select-xs select-bordered w-full"
                value={linkNetwork}
                onChange={(e) => setLinkNetwork(e.target.value)}
              >
                {NETWORK_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-primary mb-1">
                Region
              </label>
              <select
                className="select select-xs select-bordered w-full"
                value={linkRegion}
                onChange={(e) => setLinkRegion(e.target.value)}
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
            <label className="block text-xs font-medium text-primary mb-1">
              Affiliate URL *
            </label>
            <input
              className="input input-sm input-bordered w-full"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-primary mb-1">
                Merchant name
              </label>
              <input
                className="input input-sm input-bordered w-full"
                value={linkMerchantName}
                onChange={(e) => setLinkMerchantName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-primary mb-1">
                  External ID
                </label>
                <input
                  className="input input-sm input-bordered w-full"
                  value={linkExternalId}
                  onChange={(e) => setLinkExternalId(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-primary mb-1">
                  Priority
                </label>
                <input
                  type="number"
                  className="input input-sm input-bordered w-full"
                  value={linkPriority}
                  onChange={(e) => setLinkPriority(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 flex items-center justify-end">
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-2 py-1 bg-neutralAlt rounded hover:bg-neutralAlt/90 text-primary sm:text-base"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-2 py-1 rounded bg-secondary text-white hover:bg-secondary/80"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function AdminView() {
  const [activeTab, setActiveTab] = useState("gear");

  return (
    <div className="h-full w-full flex flex-col bg-neutral/40">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-base-300 bg-base-100/90">
        <div>
          <h1 className="text-lg font-semibold text-primary">Admin panel</h1>
          <p className="text-xs text-primary/70">
            Internal tools for managing TrekList data. Only visible to admin
            users.
          </p>
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
      <main className="flex-1 px-4 py-3 overflow-auto bg-neutral/20">
        {activeTab === "gear" && <GearCatalogSection />}

        {activeTab === "users" && (
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-primary">Users</h2>
            <p className="text-sm text-primary/80">
              In a later step we&apos;ll add a simple user search and GDPR-safe
              actions (view, delete) here.
            </p>
          </section>
        )}

        {activeTab === "lists" && (
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-primary">
              Public lists
            </h2>
            <p className="text-sm text-primary/80">
              In a later step we&apos;ll show public gear lists and let you
              revoke problematic ones here.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

export default AdminView;
