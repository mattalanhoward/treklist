// client/src/pages/AdminView.jsx
import React, { useState, useEffect } from "react";
import api from "../services/api";
import { toast } from "react-hot-toast";

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

  const loadItems = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/catalog-items", {
        params: { isActive: "true", limit: 200 },
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
      <form
        onSubmit={handleCreate}
        className="border border-base-300 rounded-lg bg-base-100/90 p-3 space-y-3"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <div className="flex-1 space-y-2">
            <div>
              <label className="block text-xs font-medium text-primary mb-1">
                Item name *
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                className="w-full input input-sm input-bordered"
                placeholder="Nemo Hornet OSMO 2P"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-primary mb-1">
                  Brand
                </label>
                <input
                  type="text"
                  name="brand"
                  value={form.brand}
                  onChange={handleChange}
                  className="w-full input input-sm input-bordered"
                  placeholder="Nemo"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-primary mb-1">
                  Category
                </label>
                <input
                  type="text"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  className="w-full input input-sm input-bordered"
                  placeholder="shelter / mid-layer / headlamp..."
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-primary mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                className="w-full textarea textarea-bordered textarea-xs resize-y"
                rows={2}
                placeholder="Short blurb to help you recognize the item when importing."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-primary mb-1">
                  Weight (grams)
                </label>
                <input
                  type="number"
                  name="weightGrams"
                  value={form.weightGrams}
                  onChange={handleChange}
                  className="w-full input input-sm input-bordered"
                  placeholder="1400"
                  min="0"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-primary mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  name="tags"
                  value={form.tags}
                  onChange={handleChange}
                  className="w-full input input-sm input-bordered"
                  placeholder="3-season, tent, 1p"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-primary mb-1">
                  Network *
                </label>
                <select
                  name="linkNetwork"
                  value={form.linkNetwork}
                  onChange={handleChange}
                  className="w-full select select-sm select-bordered"
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
                  name="linkRegion"
                  value={form.linkRegion}
                  onChange={handleChange}
                  className="w-full select select-sm select-bordered"
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
                type="url"
                name="linkUrl"
                value={form.linkUrl}
                onChange={handleChange}
                className="w-full input input-sm input-bordered"
                placeholder="https://www.amazon.com/dp/ASIN/?tag=yourtag-20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-primary mb-1">
                  Merchant name
                </label>
                <input
                  type="text"
                  name="linkMerchantName"
                  value={form.linkMerchantName}
                  onChange={handleChange}
                  className="w-full input input-sm input-bordered"
                  placeholder="Amazon / Bergfreunde / REI"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-primary mb-1">
                  External ID
                </label>
                <input
                  type="text"
                  name="linkExternalId"
                  value={form.linkExternalId}
                  onChange={handleChange}
                  className="w-full input input-sm input-bordered"
                  placeholder="ASIN, Awin product id..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-base-200">
          <button
            type="submit"
            disabled={creating}
            className={`btn btn-sm btn-secondary ${
              creating ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            {creating ? "Saving..." : "Add to catalog"}
          </button>
        </div>
      </form>

      {/* List */}
      <div className="border border-base-300 rounded-lg bg-base-100/80 overflow-auto">
        <div className="flex items-center justify-between px-3 py-2 border-b border-base-200 text-xs text-primary/80">
          <span>
            {loading
              ? "Loading catalog items..."
              : `Active catalog items: ${items.length}`}
          </span>
          <button
            type="button"
            onClick={loadItems}
            disabled={loading}
            className="btn btn-ghost btn-xs"
          >
            Refresh
          </button>
        </div>

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
          <table className="min-w-full text-xs sm:text-sm">
            <thead className="bg-base-200/80">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Name</th>
                <th className="text-left px-3 py-2 font-semibold">Category</th>
                <th className="text-left px-3 py-2 font-semibold">Brand</th>
                <th className="text-left px-3 py-2 font-semibold">
                  Network / region
                </th>
                <th className="text-right px-3 py-2 font-semibold">Weight</th>
                <th className="text-right px-3 py-2 font-semibold">Updated</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const id = item._id || item.id;
                const mainLink = Array.isArray(item.links)
                  ? item.links[0]
                  : null;
                const updated =
                  item.updatedAt && !Number.isNaN(Date.parse(item.updatedAt))
                    ? new Date(item.updatedAt).toLocaleDateString()
                    : "–";

                return (
                  <tr
                    key={id}
                    className="border-t border-base-200 hover:bg-base-200/40"
                  >
                    <td className="px-3 py-2 align-top">{item.name}</td>
                    <td className="px-3 py-2 align-top">
                      {item.category || "–"}
                    </td>
                    <td className="px-3 py-2 align-top">{item.brand || "–"}</td>
                    <td className="px-3 py-2 align-top">
                      {mainLink
                        ? `${mainLink.network} / ${mainLink.region || "global"}`
                        : "–"}
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      {typeof item.weightGrams === "number"
                        ? `${item.weightGrams} g`
                        : "–"}
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      {updated}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
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
