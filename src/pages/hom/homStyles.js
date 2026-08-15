// HOM Systems microsite — standalone stylesheet (Block 2).
// Deliberately separate from data/globalStyles.js's G (dark TIN app shell
// theme): this page renders standalone, outside the TIN app shell, for a
// different customer entirely — see App.jsx's homsystems host/path check.
// Reuses TIN's type system (Barlow / Barlow Condensed) and accent orange
// (#e85a2a) but on a light "drafting plate / spec sheet" surface.
export const HOM_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@300;400;500;600;700;800&family=Barlow+Condensed:wght@500;600;700;800&display=swap');
.hom-root,.hom-root *,.hom-root *::before,.hom-root *::after{box-sizing:border-box;margin:0;padding:0;font-family:'Barlow',sans-serif}
.hom-root{
  --hm-ink:#17181c;--hm-sub:#6b6d76;--hm-line:#d8d8d2;--hm-paper:#faf9f6;--hm-panel:#ffffff;
  --hm-acc:#e85a2a;--hm-acc2:#f4795a;--hm-ok:#1f9d55;--hm-warn:#c2410c;
  min-height:100vh;background:var(--hm-paper);color:var(--hm-ink);font-size:14px;line-height:1.5;
  background-image:linear-gradient(var(--hm-line) 1px,transparent 1px),linear-gradient(90deg,var(--hm-line) 1px,transparent 1px);
  background-size:28px 28px;background-position:-1px -1px;background-attachment:local;
}
.hom-root h1,.hom-root h2,.hom-root h3{font-family:'Barlow Condensed',sans-serif;font-weight:800;letter-spacing:.01em}

/* HEADER */
.hm-topbar{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;background:var(--hm-paper);border-bottom:2px solid var(--hm-ink)}
.hm-brand-block{display:flex;flex-direction:column;gap:4px}
.hm-logo{height:38px;width:auto;object-fit:contain;display:block}
.hm-brand{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:20px;letter-spacing:.04em}
.hm-brand em{color:var(--hm-acc);font-style:normal}
.hm-brand-sub{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--hm-sub);margin-top:1px}
.hm-topbar-right{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--hm-sub)}

/* LAYOUT */
.hm-shell{display:flex;align-items:flex-start;gap:24px;max-width:1240px;margin:0 auto;padding:24px 24px 80px}
.hm-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:20px}
.hm-quote{width:320px;flex-shrink:0;position:sticky;top:20px}
@media (max-width:920px){.hm-shell{flex-direction:column}.hm-quote{width:100%;position:static}}

/* PLATE (section) */
.hm-plate{background:var(--hm-panel);border:1px solid var(--hm-line);position:relative}
.hm-plate::before,.hm-plate::after,.hm-plate-tick-br::before,.hm-plate-tick-br::after{content:'';position:absolute;width:9px;height:9px;border:1.5px solid var(--hm-ink);opacity:.55}
.hm-plate::before{top:-1px;left:-1px;border-right:none;border-bottom:none}
.hm-plate::after{top:-1px;right:-1px;border-left:none;border-bottom:none}
.hm-plate-hd{display:flex;align-items:baseline;gap:10px;padding:14px 18px;border-bottom:1px solid var(--hm-line)}
.hm-plate-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:16px;text-transform:uppercase;letter-spacing:.06em}
.hm-plate-sub{margin-left:auto;font-size:11px;color:var(--hm-sub)}
.hm-plate-body{padding:18px}

/* TILE GRID (profile / colour / glass) */
.hm-tile-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.hm-tile{border:1.5px solid var(--hm-line);cursor:pointer;transition:border-color .15s,transform .1s;background:#fff}
.hm-tile:hover{border-color:var(--hm-ink)}
.hm-tile.on{border-color:var(--hm-acc);box-shadow:0 0 0 1px var(--hm-acc)}
.hm-tile-photo{position:relative;aspect-ratio:4/3;background:var(--hm-paper);display:flex;align-items:center;justify-content:center;overflow:hidden;border-bottom:1px solid var(--hm-line)}
.hm-tile-photo img{width:100%;height:100%;object-fit:cover}
.hm-tile-placeholder{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--hm-sub);text-align:center;padding:8px}
.hm-tile-name{padding:8px 10px;font-size:12px;font-weight:600}
.hm-gal-btn{position:absolute;top:50%;transform:translateY(-50%);width:22px;height:22px;border-radius:50%;background:#ffffffd8;border:1px solid var(--hm-line);display:flex;align-items:center;justify-content:center;font-size:12px;cursor:pointer;z-index:2}
.hm-gal-btn:hover{background:#fff}
.hm-gal-prev{left:6px}.hm-gal-next{right:6px}
.hm-gal-dots{position:absolute;bottom:6px;left:0;right:0;display:flex;justify-content:center;gap:4px}
.hm-gal-dot{width:5px;height:5px;border-radius:50%;background:#ffffffa0;border:1px solid var(--hm-ink)}
.hm-gal-dot.on{background:var(--hm-acc);border-color:var(--hm-acc)}

/* CHIPS */
.hm-chip-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.hm-chip{padding:6px 12px;border:1px solid var(--hm-line);border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;background:#fff;color:var(--hm-ink);transition:all .15s}
.hm-chip:hover{border-color:var(--hm-ink)}
.hm-chip.on{background:var(--hm-acc);border-color:var(--hm-acc);color:#fff}

/* CONFIG ROWS */
.hm-config-row{display:flex;flex-direction:column;gap:8px;margin-bottom:18px}
.hm-config-row:last-child{margin-bottom:0}
.hm-config-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--hm-sub)}
.hm-option-row{display:flex;gap:10px;flex-wrap:wrap}
.hm-option{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 16px;border:1.5px solid var(--hm-line);cursor:pointer;background:#fff;min-width:96px;transition:border-color .15s}
.hm-option:hover{border-color:var(--hm-ink)}
.hm-option.on{border-color:var(--hm-acc);background:var(--hm-acc)0d}
.hm-option-label{font-size:12px;font-weight:600}
.hm-stepper{display:flex;align-items:center;border:1.5px solid var(--hm-line);width:fit-content}
.hm-stepper button{width:32px;height:32px;border:none;background:#fff;cursor:pointer;font-size:16px;font-weight:700;color:var(--hm-ink)}
.hm-stepper button:hover{background:var(--hm-paper)}
.hm-stepper button:disabled{opacity:.3;cursor:not-allowed}
.hm-stepper-val{width:44px;text-align:center;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;border-left:1px solid var(--hm-line);border-right:1px solid var(--hm-line);height:32px;display:flex;align-items:center;justify-content:center}

/* DIMENSION FIELDS */
.hm-dim-row{display:flex;gap:20px;flex-wrap:wrap;align-items:flex-end}
.hm-dim-field{display:flex;flex-direction:column;gap:6px}
.hm-dim-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--hm-sub);display:flex;align-items:center;gap:6px}
.hm-dim-line{flex:1;height:1px;background:repeating-linear-gradient(90deg,var(--hm-ink) 0,var(--hm-ink) 4px,transparent 4px,transparent 8px)}
.hm-dim-input{width:120px;border:1.5px solid var(--hm-line);padding:10px 12px;font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:700;text-align:center;outline:none;background:#fff}
.hm-dim-input:focus{border-color:var(--hm-acc)}
.hm-dim-unit{font-size:11px;color:var(--hm-sub)}

/* FORM FIELDS (customer/address) */
.hm-field-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.hm-field{display:flex;flex-direction:column;gap:5px}
.hm-field-full{grid-column:1/-1}
.hm-field-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--hm-sub)}
.hm-field-label .req{color:var(--hm-acc)}
.hm-input{border:1.5px solid var(--hm-line);padding:9px 12px;font-size:13px;font-family:'Barlow',sans-serif;outline:none;background:#fff;color:var(--hm-ink);width:100%}
.hm-input:focus{border-color:var(--hm-acc)}
.hm-input.err{border-color:var(--hm-warn)}
.hm-field-err{font-size:11px;color:var(--hm-warn);font-weight:600}

/* LIVE READOUT */
.hm-readout{background:var(--hm-paper);border:1px dashed var(--hm-line);padding:14px 16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:12px;margin-top:16px}
.hm-readout-item{display:flex;flex-direction:column;gap:2px}
.hm-readout-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--hm-sub)}
.hm-readout-val{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:16px}
.hm-readout-val.acc{color:var(--hm-acc)}
.hm-readout-warn{grid-column:1/-1;font-size:12px;color:var(--hm-warn);font-weight:600}

/* SCHEDULE (cabinet list) */
.hm-sched-row{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--hm-line);margin-bottom:8px;background:#fff}
.hm-sched-main{flex:1;min-width:0}
.hm-sched-title{font-size:13px;font-weight:700}
.hm-sched-meta{font-size:11px;color:var(--hm-sub);margin-top:2px}
.hm-sched-price{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:16px;white-space:nowrap}
.hm-sched-actions{display:flex;gap:6px}
.hm-sched-empty{padding:24px;text-align:center;color:var(--hm-sub);font-size:12px;border:1px dashed var(--hm-line)}

/* ATTACHMENTS */
.hm-file-drop{border:1.5px dashed var(--hm-line);padding:20px;text-align:center;cursor:pointer;font-size:12px;color:var(--hm-sub)}
.hm-file-drop:hover{border-color:var(--hm-acc);color:var(--hm-acc)}
.hm-file-list{display:flex;flex-direction:column;gap:6px;margin-top:10px}
.hm-file-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 10px;background:var(--hm-paper);border:1px solid var(--hm-line);font-size:12px}

/* BUTTONS */
.hm-btn{padding:11px 20px;border:none;font-size:13px;font-weight:700;cursor:pointer;font-family:'Barlow',sans-serif;letter-spacing:.02em;transition:all .15s}
.hm-btn-acc{background:var(--hm-acc);color:#fff}
.hm-btn-acc:hover{background:var(--hm-acc2)}
.hm-btn-acc:disabled{opacity:.4;cursor:not-allowed}
.hm-btn-ghost{background:transparent;color:var(--hm-ink);border:1.5px solid var(--hm-line)}
.hm-btn-ghost:hover{border-color:var(--hm-ink)}
.hm-btn-sm{padding:6px 12px;font-size:11px}
.hm-btn-danger{background:transparent;color:var(--hm-warn);border:1.5px solid var(--hm-warn)}

/* QUOTE PANEL */
.hm-quote-panel{background:var(--hm-ink);color:#fff;padding:20px}
.hm-quote-title{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:13px;text-transform:uppercase;letter-spacing:.12em;color:#a8a9b3;margin-bottom:14px}
.hm-quote-row{display:flex;justify-content:space-between;font-size:13px;padding:7px 0;border-bottom:1px solid #ffffff1a}
.hm-quote-row.total{border-bottom:none;padding-top:12px;margin-top:4px;border-top:1px solid #ffffff2e}
.hm-quote-row.total .hm-quote-val{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:24px;color:var(--hm-acc2)}
.hm-quote-lbl{color:#c7c8d1}
.hm-pay-row{display:flex;flex-direction:column;gap:8px;margin:16px 0}
.hm-pay-opt{display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid #ffffff2e;cursor:pointer;font-size:12px}
.hm-pay-opt.on{border-color:var(--hm-acc2);background:#ffffff0d}
.hm-pay-opt-disabled{cursor:not-allowed;opacity:.5}
.hm-pay-soon{margin-left:auto;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--hm-acc2)}
.hm-quote-err{font-size:11px;color:#ffb199;margin-top:8px;line-height:1.5}

/* ERROR BANNER */
.hm-error-banner{background:#fdecea;border:1.5px solid var(--hm-warn);color:var(--hm-warn);padding:12px 16px;font-size:13px;font-weight:600}

/* CONFIRMATION */
.hm-confirm{max-width:640px;margin:0 auto;padding:60px 24px}
.hm-confirm-icon{width:56px;height:56px;border:2px solid var(--hm-ok);color:var(--hm-ok);display:flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:16px}
.hm-confirm-title{font-size:32px;margin-bottom:6px}
.hm-confirm-order{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;color:var(--hm-acc);margin-bottom:24px}
.hm-confirm-steps{display:flex;flex-direction:column;gap:0;margin:20px 0}
.hm-confirm-step{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--hm-line)}
.hm-confirm-step:last-child{border-bottom:none}
.hm-confirm-step-no{font-family:'Barlow Condensed',sans-serif;font-weight:800;color:var(--hm-acc);width:22px;flex-shrink:0}

/* ADMIN TAB (Block 3) — same design tokens, arranged for a dense back-office UI */
.hm-admin-shell{max-width:1280px;margin:0 auto}
.hm-admin-nav{display:flex;gap:6px;flex-wrap:wrap;padding:14px 0 18px;border-bottom:1px solid var(--hm-line);margin-bottom:20px}
.hm-admin-navbtn{padding:8px 16px;border:1.5px solid var(--hm-line);background:#fff;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;cursor:pointer;color:var(--hm-ink)}
.hm-admin-navbtn:hover{border-color:var(--hm-ink)}
.hm-admin-navbtn.on{background:var(--hm-ink);color:#fff;border-color:var(--hm-ink)}
.hm-section-title{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:22px;margin-bottom:4px}
.hm-section-sub{font-size:12px;color:var(--hm-sub);margin-bottom:18px}
.hm-save-bar{display:flex;align-items:center;gap:12px;margin-top:18px;padding-top:16px;border-top:1px dashed var(--hm-line)}
.hm-dirty-flag{font-size:11px;color:var(--hm-warn);font-weight:700;text-transform:uppercase;letter-spacing:.06em}
.hm-table{width:100%;border-collapse:collapse;font-size:12px}
.hm-table th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--hm-sub);padding:8px 10px;border-bottom:2px solid var(--hm-ink)}
.hm-table td{padding:9px 10px;border-bottom:1px solid var(--hm-line);vertical-align:top}
.hm-table tr:hover td{background:var(--hm-paper)}
.hm-badge{display:inline-block;padding:3px 9px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;border:1px solid var(--hm-line)}
.hm-badge-warn{color:var(--hm-warn);border-color:var(--hm-warn);background:#fdecea}
.hm-badge-ok{color:var(--hm-ok);border-color:var(--hm-ok);background:#eaf7ee}
.hm-badge-neutral{color:var(--hm-sub);border-color:var(--hm-line);background:var(--hm-paper)}
.hm-catalog-item{border:1px solid var(--hm-line);padding:14px;margin-bottom:10px;background:#fff}
.hm-catalog-item-hd{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.hm-photo-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
.hm-photo-thumb{position:relative;width:64px;height:64px;border:1px solid var(--hm-line);overflow:hidden}
.hm-photo-thumb img{width:100%;height:100%;object-fit:cover}
.hm-photo-thumb .hm-photo-rm{position:absolute;top:0;right:0;background:#000000a0;color:#fff;border:none;width:18px;height:18px;font-size:11px;cursor:pointer;line-height:1}
.hm-order-row{cursor:pointer}
.hm-order-detail{border:1px solid var(--hm-line);background:#fff;padding:18px;margin-top:14px}
.hm-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.hm-detail-block{border:1px dashed var(--hm-line);padding:12px}
.hm-detail-block-hd{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--hm-sub);margin-bottom:8px;font-weight:700}
.hm-vendor-select{border:1.5px solid var(--hm-line);padding:9px 12px;font-size:13px;font-family:'Barlow',sans-serif;width:100%;background:#fff;color:var(--hm-ink)}
.hm-chit-overlay{position:fixed;inset:0;background:#00000080;z-index:500;display:flex;align-items:flex-start;justify-content:center;padding:30px;overflow-y:auto}
.hm-chit-paper{background:#fff;width:100%;max-width:720px;padding:28px;position:relative}
.hm-chit-hd{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid var(--hm-ink);padding-bottom:12px;margin-bottom:16px}
.hm-chit-title{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:18px;text-transform:uppercase}
.hm-chit-order{font-size:12px;color:var(--hm-sub)}
.hm-chit-close{position:absolute;top:14px;right:14px}
.hm-chit-label{border:1.5px dashed var(--hm-ink);padding:16px;margin-bottom:14px}
@media print{
  body *{visibility:hidden}
  .hm-chit-paper,.hm-chit-paper *{visibility:visible}
  .hm-chit-paper{position:absolute;top:0;left:0;width:100%;max-width:none}
  .hm-chit-close,.hm-chit-print-btn{display:none!important}
}
`;
