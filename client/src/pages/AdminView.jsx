// client/src/pages/AdminView.jsx
import React, { useState } from "react";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "gear", label: "Gear catalog" },
  { id: "users", label: "Users" },
  { id: "lists", label: "Public lists" },
];

export default function AdminView() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="h-full w-full flex flex-col bg-neutral/40">
      {/* Header */}
      <header className="pl-15 flex items-center justify-between px-4 py-3 border-b border-base-300 bg-base-100/90">
        <div>
          <h1 className="text-lg font-semibold text-primary">Admin panel</h1>
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
        {activeTab === "overview" && (
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-primary">Overview</h2>
            <p className="text-sm text-primary/80">
              This is a simple overview placeholder. In a later step, we&apos;ll
              show key stats here (total users, lists, public lists, etc.).
            </p>
          </section>
        )}

        {activeTab === "gear" && (
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-primary">
              Gear catalog
            </h2>
            <p className="text-sm text-primary/80">
              Here you&apos;ll be able to browse and manage the curated Global
              Items (gear templates) and their affiliate data.
            </p>
          </section>
        )}

        {activeTab === "users" && (
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-primary">Users</h2>
            <p className="text-sm text-primary/80">
              Here you&apos;ll be able to search users, inspect their account
              details, and perform GDPR-safe actions like deleting an account.
            </p>
          </section>
        )}

        {activeTab === "lists" && (
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-primary">
              Public lists
            </h2>
            <p className="text-sm text-primary/80">
              Here you&apos;ll be able to see public gear lists, revoke
              problematic ones, and optionally feature great lists.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
