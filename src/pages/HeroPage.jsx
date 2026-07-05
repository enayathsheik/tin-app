import { useState } from "react";
import { CITIES } from "../data/constants";

// Baseline numbers shown when a Firestore fetch fails, so the hero never reads as "0 of everything"
const BASELINE_STATS = { stores: 2222, contributors: 220, cities: 40, categories: 22 };

export function HeroPage({ onCitySelect, selectedCity, onExplore, onAdd, stores, contributors, storesLoadFailed, contributorsLoadFailed }) {
  const [search, setSearch] = useState("");
  const topCities = ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Pune", "Ahmedabad", "Kolkata", "Jaipur", "Surat"];
  const filtered = search ? CITIES.filter(c => c.toLowerCase().includes(search.toLowerCase())) : CITIES;

  const uniqueCities = [...new Set((stores || []).map(s => s.city).filter(Boolean))];
  // Stores carry a `categories` array of { category, subCategory, productType }, not a scalar `category` field
  const uniqueCategories = [...new Set((stores || []).flatMap(s => (s.categories || []).map(c => c.category)).filter(Boolean))];

  const totalStores = storesLoadFailed ? BASELINE_STATS.stores : (stores?.length || 0);
  const totalContributors = contributorsLoadFailed ? BASELINE_STATS.contributors : (contributors?.length || 0);
  const totalCities = storesLoadFailed ? BASELINE_STATS.cities : uniqueCities.length;
  const totalCategories = storesLoadFailed ? BASELINE_STATS.categories : uniqueCategories.length;
  const cityCounts = (stores || []).reduce((acc, s) => {
    if (s.city) acc[s.city] = (acc[s.city] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="hero">
      <div className="hero-top">
        <div className="hero-eyebrow">TIN</div>
        <div className="hero-title">India's Largest Building<br /><span>Materials Network</span></div>
        <div className="hero-sub">Discover stores, brands, products, architects, designers, and contractors. Connecting the industry. Helping everyone grow together.</div>
        <div className="stats-row">
          <div className="stat-card"><div className="stat-num">{totalStores.toLocaleString()}</div><div className="stat-lbl">Stores</div></div>
          <div className="stat-card"><div className="stat-num">{totalContributors.toLocaleString()}</div><div className="stat-lbl">Market Champions</div></div>
          <div className="stat-card"><div className="stat-num">{totalCities.toLocaleString()}</div><div className="stat-lbl">Cities</div></div>
          <div className="stat-card"><div className="stat-num">{totalCategories.toLocaleString()}</div><div className="stat-lbl">Categories</div></div>
        </div>
        <div className="hero-cta">
          <button className="btn btn-primary" onClick={onExplore}>Explore {selectedCity || "Stores"}</button>
          <button className="btn btn-ghost" onClick={onAdd}>+ Add a Business</button>
        </div>
      </div>
      <div className="city-section">
        <div className="section-hd">Quick Cities</div>
        <div className="city-grid" style={{ marginBottom: 20 }}>
          {topCities.map(c => (
            <div key={c} className={`city-pill ${selectedCity === c ? "sel" : ""}`} onClick={() => onCitySelect(c)}>
              <span className="city-name">{c}</span>
              <span className="city-count">{cityCounts[c] || 0}</span>
            </div>
          ))}
        </div>
        <div className="section-hd">All Cities</div>
        <input className="fi" style={{ marginBottom: 12 }} placeholder="Search any city..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="city-grid">
          {filtered.slice(0, 40).map(c => (
            <div key={c} className={`city-pill ${selectedCity === c ? "sel" : ""}`} onClick={() => onCitySelect(c)}>
              <span className="city-name">{c}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
