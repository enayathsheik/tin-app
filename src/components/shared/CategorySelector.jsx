import { useState } from "react";
import { CATEGORY_TREE } from "../../data/constants";

export function CategorySelector({ value, onChange }) {
  const [cat, setCat] = useState(value?.category || "");
  const [sub, setSub] = useState(value?.subCategory || "");
  const [prod, setProd] = useState(value?.productType || "");

  const subs = cat ? Object.keys(CATEGORY_TREE[cat] || {}) : [];
  const prods = sub ? (CATEGORY_TREE[cat]?.[sub] || []) : [];

  const select = (level, val) => {
    if (level === "cat") { setCat(val); setSub(""); setProd(""); onChange({ category: val, subCategory: "", productType: "" }); }
    if (level === "sub") { setSub(val); setProd(""); onChange({ category: cat, subCategory: val, productType: "" }); }
    if (level === "prod") { setProd(val); onChange({ category: cat, subCategory: sub, productType: val }); }
  };

  return (
    <div className="cat-selector">
      <div className="cat-row">
        <div className="cat-col">
          <div className="cat-col-hd">Category</div>
          {Object.keys(CATEGORY_TREE).map(c => (
            <div key={c} className={`cat-item ${cat === c ? "on" : ""}`} onClick={() => select("cat", c)}>{c}</div>
          ))}
        </div>
        <div className="cat-col">
          <div className="cat-col-hd">Sub-category</div>
          {subs.length === 0 ? <div style={{ padding: "10px", fontSize: "11px", color: "var(--t3)" }}>Select category first</div> :
            subs.map(s => <div key={s} className={`cat-item ${sub === s ? "on" : ""}`} onClick={() => select("sub", s)}>{s}</div>)}
        </div>
        <div className="cat-col">
          <div className="cat-col-hd">Product Type</div>
          {prods.length === 0 ? <div style={{ padding: "10px", fontSize: "11px", color: "var(--t3)" }}>Select sub-category</div> :
            prods.map(p => <div key={p} className={`cat-item ${prod === p ? "on" : ""}`} onClick={() => select("prod", p)}>{p}</div>)}
        </div>
      </div>
      <div className="cat-selected">
        {cat ? `${cat}${sub ? ` → ${sub}` : ""}${prod ? ` → ${prod}` : ""}` : "No category selected"}
      </div>
    </div>
  );
}
