export const G = `
@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@300;400;500;600;700;800&family=Barlow+Condensed:wght@500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#08090d;--s1:#0f1018;--s2:#161720;--s3:#1e1f2e;
  --b1:#ffffff08;--b2:#ffffff12;--b3:#ffffff1e;
  --t1:#080808;--t2:#080808;--t3:#080808;
  --acc:#e85a2a;--acc2:#f07d50;--acc3:#ff9a6c;
  --ok:#22c55e;--warn:#f59e0b;--info:#3b82f6;
  --r:10px;--rl:16px;--rxl:24px;
}
html,body{height:100%;background:var(--bg);color:var(--t1);font-family:'Barlow',sans-serif;font-size:14px;line-height:1.5}
#root{height:100%;display:flex;flex-direction:column}

/* LAYOUT */
.app{display:flex;flex-direction:column;height:100vh;overflow:hidden}
.mobile-nav{display:none}
.topbar{height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:var(--bg);border-bottom:1px solid var(--b1);flex-shrink:0;z-index:200}
.logo{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:18px;letter-spacing:.06em;color:var(--t1)}
.logo em{color:var(--acc);font-style:normal}
.nav-tabs{display:flex;gap:1px;background:var(--s2);border-radius:var(--r);padding:3px}
.ntab{padding:5px 14px;border-radius:7px;font-size:13px;font-weight:500;color:#080808;cursor:pointer;transition:all .15s;border:none;background:transparent;font-family:'Barlow',sans-serif}
.ntab:hover{color:#080808}
.ntab.on{background:var(--s3);color:var(--t1)}
.topbar-right{display:flex;align-items:center;gap:10px}
.pts-badge{font-size:12px;font-weight:700;color:var(--acc);background:var(--acc)18;padding:3px 10px;border-radius:20px;border:1px solid var(--acc)28}
.avatar{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--acc),var(--acc3));display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;cursor:pointer;color:white;font-family:'Barlow Condensed',sans-serif;flex-shrink:0}
.page{flex:1;overflow:hidden;display:flex;flex-direction:column}

/* CITY HERO */
.hero{height:100%;overflow-y:auto;background:var(--bg)}
.hero-top{padding:60px 24px 40px;max-width:880px;margin:0 auto;text-align:center}
.hero-eyebrow{font-family:'Barlow Condensed',sans-serif;font-weight:600;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--acc);margin-bottom:16px}
.hero-title{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:clamp(36px,6vw,64px);line-height:1;color:var(--t1);margin-bottom:16px}
.hero-title span{color:var(--acc)}
.hero-sub{font-size:16px;color:#080808;max-width:520px;margin:0 auto 40px;line-height:1.6}
.stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;max-width:680px;margin:0 auto 48px}
.stat-card{background:var(--s1);border:1px solid var(--b2);border-radius:var(--r);padding:16px;text-align:center}
.stat-num{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:28px;color:var(--acc)}
.stat-lbl{font-size:11px;color:#080808;margin-top:2px;text-transform:uppercase;letter-spacing:.06em}
.city-section{padding:0 24px 48px;max-width:880px;margin:0 auto;width:100%}
.section-hd{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#080808;margin-bottom:16px;display:flex;align-items:center;gap:8px}
.section-hd::after{content:'';flex:1;height:1px;background:var(--b2)}
.city-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}
.city-pill{padding:10px 16px;border-radius:var(--r);background:var(--s1);border:1px solid var(--b2);cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:space-between;gap:8px}
.city-pill:hover,.city-pill.sel{background:var(--s2);border-color:var(--b3);color:var(--t1)}
.city-pill.sel{border-color:var(--acc);background:var(--acc)12}
.city-name{font-weight:600;font-size:13px}
.city-count{font-size:11px;color:#080808}
.hero-cta{display:flex;gap:10px;justify-content:center;margin-top:32px;flex-wrap:wrap}
.btn{padding:10px 20px;border-radius:var(--r);font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;border:none;font-family:'Barlow',sans-serif;letter-spacing:.02em}
.btn-primary{background:var(--acc);color:white}
.btn-primary:hover{background:var(--acc2);transform:translateY(-1px)}
.btn-ghost{background:transparent;color:#080808;border:1px solid var(--b3)}
.btn-ghost:hover{color:var(--t1);border-color:var(--b3);background:var(--s2)}
.btn:disabled{opacity:.4;cursor:not-allowed;transform:none!important}

/* DISCOVERY — 3 COLUMN LAYOUT */
.discovery{display:flex;height:100%;overflow:hidden}
.disc-filters{width:220px;flex-shrink:0;background:var(--s1);border-right:1px solid var(--b1);overflow-y:auto;padding:14px 12px;transition:width .2s ease,padding .2s ease,opacity .2s ease}
.disc-filters.collapsed{width:0;padding:0;opacity:0;overflow:hidden;border-right:none}
.disc-list-col{width:360px;flex-shrink:0;background:var(--s1);border-right:1px solid var(--b1);display:flex;flex-direction:column;overflow:hidden}
.disc-list-hd{padding:10px 14px;border-bottom:1px solid var(--b1);display:flex;align-items:center;justify-content:space-between;gap:8px}
.disc-main{flex:1;overflow-y:auto;min-width:0}
.srch{display:flex;align-items:center;gap:8px;background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);padding:8px 12px;margin-bottom:10px}
.srch input{flex:1;background:none;border:none;outline:none;color:var(--t1);font-size:13px;font-family:'Barlow',sans-serif}
.srch input::placeholder{color:#080808}
.chips{display:flex;gap:5px;flex-wrap:wrap}
.chip{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:var(--s2);border:1px solid var(--b2);color:#080808;cursor:pointer;transition:all .15s;white-space:nowrap}
.chip:hover,.chip.on{background:var(--acc)18;border-color:var(--acc)40;color:var(--acc)}
.store-list{flex:1;overflow-y:auto;padding:8px}
.sc{padding:12px;border-radius:var(--r);margin-bottom:6px;background:var(--s2);border:1px solid var(--b1);cursor:pointer;transition:all .15s}
.sc:hover{border-color:var(--b3)}
.sc.sel{border-color:var(--acc)}
.sc-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;gap:8px}
.sc-name{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;line-height:1.2}
.badge{font-size:10px;padding:2px 7px;border-radius:20px;font-weight:700;white-space:nowrap;flex-shrink:0}
.bv{background:#22c55e15;color:var(--ok);border:1px solid #22c55e25}
.bc{background:#f59e0b15;color:var(--warn);border:1px solid #f59e0b25}
.bp{background:#3b82f615;color:var(--info);border:1px solid #3b82f625}
.sc-meta{font-size:11px;color:#080808;display:flex;gap:8px;flex-wrap:wrap}
.conf-bar{height:3px;border-radius:2px;background:var(--b2);margin-top:8px;overflow:hidden}
.conf-fill{height:100%;border-radius:2px;transition:width .6s}

/* STORE DETAIL */
.detail-panel{padding:24px;max-width:760px}
.detail-hd{margin-bottom:20px}
.detail-name{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:26px;margin-bottom:8px}
.detail-badges{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px}
.dg-item{background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:12px}
.dg-label{font-size:11px;color:#080808;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em}
.dg-value{font-size:13px;font-weight:500}
.cat-breadcrumb{display:flex;align-items:center;gap:6px;font-size:12px;color:#080808;margin-bottom:16px;flex-wrap:wrap}
.cat-sep{color:var(--b3)}
.cat-node{color:#080808}
.cat-node.last{color:var(--acc);font-weight:600}
.conf-section{background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:14px;margin-bottom:16px}
.conf-hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.conf-title{font-size:12px;font-weight:600;color:#080808}
.conf-pct{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:18px}
.conf-bar2{height:6px;border-radius:3px;background:var(--b2);overflow:hidden}
.conf-fill2{height:100%;border-radius:3px}
.enrich-row{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
.enrich-pill{padding:4px 10px;border-radius:20px;font-size:11px;background:var(--s3);border:1px solid var(--b2);color:#080808}
.enrich-pill.linked{color:var(--ok);border-color:#22c55e25;background:#22c55e08}
.action-row{display:flex;gap:8px;flex-wrap:wrap}
.btn-sm{padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;border:none;font-family:'Barlow',sans-serif}
.btn-acc{background:var(--acc);color:white}
.btn-acc:hover{background:var(--acc2)}
.btn-out{background:transparent;color:#080808;border:1px solid var(--b3)}
.btn-out:hover{color:var(--t1);background:var(--s3)}
.btn-ok{background:#22c55e15;color:var(--ok);border:1px solid #22c55e25}
.empty-detail{display:flex;align-items:center;justify-content:center;height:100%;color:#080808;font-size:14px;flex-direction:column;gap:12px;text-align:center;padding:40px}

/* ADD FORM */
.form-pg{height:100%;overflow-y:auto}
.form-wrap{max-width:680px;margin:0 auto;padding:24px 20px 60px}
.form-hd{margin-bottom:24px}
.form-title{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:28px;margin-bottom:4px}
.form-sub{color:#080808;font-size:13px}
.pts-hint{display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--acc)10;border:1px solid var(--acc)20;border-radius:var(--r);margin-bottom:20px;font-size:13px;color:var(--acc);font-weight:600}
.sec{margin-bottom:24px}
.sec-hd{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#080808;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.sec-hd::after{content:'';flex:1;height:1px;background:var(--b1)}
.fg{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.fg1{grid-template-columns:1fr}
.fg3{grid-template-columns:1fr 1fr 1fr}
.field{display:flex;flex-direction:column;gap:5px}
.fl{font-size:11px;color:#080808;font-weight:600;text-transform:uppercase;letter-spacing:.06em}
.fl .req{color:var(--acc)}
.fi,.fs,.fta{background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);padding:9px 13px;color:var(--t1);font-size:13px;font-family:'Barlow',sans-serif;outline:none;transition:border-color .15s;width:100%}
.fi:focus,.fs:focus,.fta:focus{border-color:var(--acc)}
.fi::placeholder,.fta::placeholder{color:#080808}
.fs{appearance:none;cursor:pointer}
.fs option{background:var(--s2)}
.fta{resize:vertical;min-height:72px}
.cat-selector{background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);overflow:hidden}
.cat-row{display:flex;border-bottom:1px solid var(--b1)}
.cat-col{flex:1;overflow-y:auto;max-height:160px;border-right:1px solid var(--b1)}
.cat-col:last-child{border-right:none}
.cat-col-hd{padding:6px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#080808;background:var(--s3);border-bottom:1px solid var(--b1)}
.cat-item{padding:7px 10px;font-size:12px;color:#080808;cursor:pointer;transition:all .1s;border-bottom:1px solid var(--b1)}
.cat-item:hover{background:var(--s3);color:var(--t1)}
.cat-item.on{background:var(--acc)15;color:var(--acc);font-weight:600}
.cat-selected{padding:8px 12px;font-size:12px;color:#080808;background:var(--s1)}
.loc-field{background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.loc-info{flex:1}
.loc-txt{font-size:12px;color:#080808}
.loc-coords{font-size:11px;color:var(--acc);font-family:monospace;margin-top:2px}
.checklist{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.chk{display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--s2);border:1px solid var(--b1);border-radius:8px;cursor:pointer;transition:all .15s;font-size:12px;color:#080808}
.chk:hover{border-color:var(--b2);color:var(--t1)}
.chk.on{background:var(--acc)12;border-color:var(--acc)30;color:var(--t1)}
.chk-box{width:14px;height:14px;border-radius:4px;border:1.5px solid var(--b3);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s}
.chk.on .chk-box{background:var(--acc);border-color:var(--acc)}
.type-tabs{display:flex;gap:8px;margin-bottom:20px}
.type-tab{flex:1;padding:12px;border-radius:var(--r);background:var(--s2);border:2px solid var(--b2);cursor:pointer;text-align:center;transition:all .15s}
.type-tab:hover{border-color:var(--b3)}
.type-tab.on{border-color:var(--acc);background:var(--acc)10}
.type-tab-icon{font-size:20px;margin-bottom:4px}
.type-tab-label{font-size:12px;font-weight:700}
.type-tab-desc{font-size:11px;color:#080808;margin-top:2px}

/* LEADERBOARD */
.lb-pg{height:100%;overflow-y:auto}
.lb-wrap{max-width:680px;margin:0 auto;padding:24px 20px}
.lb-hd{margin-bottom:20px}
.lb-title{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:28px;margin-bottom:4px}
.lb-sub{color:#080808;font-size:13px}
.lb-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px}
.lb-stat{background:var(--s1);border:1px solid var(--b2);border-radius:var(--r);padding:14px;text-align:center}
.lb-sv{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:24px;color:var(--acc)}
.lb-sl{font-size:11px;color:#080808;margin-top:2px;text-transform:uppercase;letter-spacing:.06em}
.lb-row{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:var(--r);background:var(--s1);border:1px solid var(--b1);margin-bottom:6px;transition:border-color .15s}
.lb-row:hover{border-color:var(--b2)}
.lb-rank{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:20px;width:36px;color:#080808;text-align:center}
.lb-av{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:14px;color:white;flex-shrink:0}
.lb-info{flex:1}
.lb-name{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px}
.lb-meta{font-size:11px;color:#080808;margin-top:1px}
.lb-pts{text-align:right}
.lb-pv{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:17px;color:var(--acc)}
.lb-lv{font-size:10px;font-weight:700;margin-top:1px}

/* PROFILE */
.prof-pg{height:100%;overflow-y:auto}
.prof-wrap{max-width:680px;margin:0 auto;padding:24px 20px}
.prof-hero{background:var(--s1);border:1px solid var(--b2);border-radius:var(--rl);padding:24px;margin-bottom:14px;position:relative;overflow:hidden}
.prof-hero::after{content:'TIN';position:absolute;right:-10px;top:-16px;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:120px;color:var(--acc);opacity:.04;pointer-events:none;line-height:1}
.prof-top{display:flex;align-items:center;gap:16px;margin-bottom:20px}
.prof-av{width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--acc),var(--acc3));display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:22px;color:white;flex-shrink:0}
.prof-name{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:22px}
.prof-role{font-size:12px;color:#080808;margin-top:2px}
.prof-lbadge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;margin-top:5px}
.prof-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.prof-stat{text-align:center;padding:10px;background:var(--s2);border-radius:var(--r)}
.prof-sv{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:22px}
.prof-sl{font-size:11px;color:#080808;margin-top:1px}
.prog-sec{background:var(--s1);border:1px solid var(--b2);border-radius:var(--rl);padding:20px;margin-bottom:14px}
.prog-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;margin-bottom:14px}
.lv-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.lv-name{font-size:12px;font-weight:700;width:56px}
.lv-bar{flex:1;height:5px;background:var(--s3);border-radius:3px;overflow:hidden}
.lv-fill{height:100%;border-radius:3px;transition:width .8s ease}
.lv-pts{font-size:11px;color:#080808;width:56px;text-align:right}
.act-sec{background:var(--s1);border:1px solid var(--b2);border-radius:var(--rl);padding:20px}
.act-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;margin-bottom:14px}
.act-item{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--b1)}
.act-item:last-child{border-bottom:none}
.act-dot{width:7px;height:7px;border-radius:50%;background:var(--acc);flex-shrink:0}
.act-text{flex:1;font-size:13px}
.act-meta{font-size:11px;color:#080808;margin-top:1px}
.act-pts{font-size:12px;color:var(--acc);font-weight:700}

/* SITE FOOTER */
.site-footer{border-top:1px solid var(--b1);margin-top:40px;padding:24px}
.site-footer-inner{max-width:880px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
.site-footer-brand{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:15px;letter-spacing:.06em;color:var(--t1)}
.site-footer-brand em{color:var(--acc);font-style:normal}
.site-footer-links{display:flex;align-items:center;gap:8px;font-size:12px}
.site-footer-links a{color:#080808;text-decoration:none}
.site-footer-links a:hover{color:var(--acc)}
.site-footer-sep{color:var(--b3)}
.site-footer-copy{font-size:11px;color:#080808}

/* RETAILER MOBILE NAV — hidden until the mobile breakpoint kicks in */
.retailer-mobile-topbar{display:none}
.retailer-nav-overlay{display:none}
.retailer-close-btn{display:none}

/* ADMIN */
.admin-pg{display:flex;height:100%}
.admin-mobile-topbar{display:none}
.admin-nav-overlay{display:none}
.admin-close-btn{display:none}
.admin-nav{width:200px;flex-shrink:0;background:var(--s1);border-right:1px solid var(--b1);padding:16px 12px;display:flex;flex-direction:column;gap:2px}
.admin-nav-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#080808;padding:4px 10px;margin-bottom:6px}
.anav{padding:8px 12px;border-radius:8px;font-size:13px;font-weight:500;color:#080808;cursor:pointer;transition:all .15s;display:flex;align-items:center;gap:8px}
.anav:hover{color:#080808;background:var(--s2)}
.anav.on{background:var(--s3);color:var(--t1)}
.anav-icon{font-size:15px}
.admin-main{flex:1;overflow-y:auto;padding:24px}
.admin-hd{margin-bottom:24px}
.admin-title{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:24px;margin-bottom:4px}
.admin-sub{color:#080808;font-size:13px}
.admin-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px}
.as-card{background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);padding:16px}
.as-val{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:26px;color:var(--acc)}
.as-lbl{font-size:11px;color:#080808;margin-top:2px;text-transform:uppercase;letter-spacing:.06em}
.as-delta{font-size:11px;color:var(--ok);margin-top:4px;font-weight:600}
.table-wrap{background:var(--s1);border:1px solid var(--b2);border-radius:var(--r);overflow:hidden}
.table-hd{padding:14px 16px;border-bottom:1px solid var(--b1);display:flex;justify-content:space-between;align-items:center}
.table-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px}
table{width:100%;border-collapse:collapse}
th{padding:10px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#080808;border-bottom:1px solid var(--b1)}
td{padding:10px 14px;font-size:13px;border-bottom:1px solid var(--b1);color:#080808}
tr:last-child td{border-bottom:none}
tr:hover td{background:var(--s2);color:var(--t1)}

/* BULK UPLOAD */
.upload-zone{border:2px dashed var(--b3);border-radius:var(--rl);padding:40px;text-align:center;cursor:pointer;transition:all .2s;margin-bottom:20px}
.upload-zone:hover,.upload-zone.drag{border-color:var(--acc);background:var(--acc)06}
.upload-icon{font-size:36px;margin-bottom:12px}
.upload-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:18px;margin-bottom:6px}
.upload-sub{font-size:13px;color:#080808}
.tmpl-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
.tmpl-card{background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);padding:16px;cursor:pointer;transition:all .15s}
.tmpl-card:hover{border-color:var(--b3);background:var(--s3)}
.tmpl-icon{font-size:24px;margin-bottom:8px}
.tmpl-name{font-weight:700;font-size:14px;margin-bottom:4px}
.tmpl-desc{font-size:12px;color:#080808}
.tmpl-fields{font-size:11px;color:#080808;margin-top:8px;line-height:1.6}
.preview-table{overflow-x:auto;margin-top:16px}
.preview-table table{min-width:600px}

/* DUPLICATE MANAGER */
.dup-pair{background:var(--s2);border:1px solid var(--b2);border-radius:var(--rl);padding:16px;margin-bottom:16px}
.dup-reason{font-size:11px;color:var(--warn);font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;display:flex;align-items:center;gap:6px}
.dup-grid{display:grid;grid-template-columns:1fr 40px 1fr;gap:12px;align-items:start;margin-bottom:14px}
.dup-card{background:var(--s1);border:1px solid var(--b2);border-radius:var(--r);padding:12px}
.dup-card-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;margin-bottom:8px}
.dup-field{display:flex;flex-direction:column;gap:2px;margin-bottom:6px}
.dup-field-lbl{font-size:10px;color:#080808;text-transform:uppercase;letter-spacing:.06em}
.dup-field-val{font-size:12px;color:var(--t1)}
.dup-field-val.diff{color:var(--warn);font-weight:600}
.vs-badge{display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:16px;color:#080808;padding-top:20px}
.dup-actions{display:flex;gap:8px;flex-wrap:wrap}

/* TOAST */
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(80px);background:var(--s3);border:1px solid var(--b3);border-radius:var(--r);padding:11px 20px;font-size:13px;font-weight:600;z-index:1000;transition:transform .25s ease;white-space:nowrap;box-shadow:0 8px 32px #00000060}
.toast.show{transform:translateX(-50%) translateY(0)}
.toast.ok{border-color:#22c55e30;color:var(--ok)}
.toast.err{border-color:#ef444430;color:#ef4444}

/* LOGIN */
.login-pg{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);overflow-y:auto;padding:24px 16px}
.login-card{width:420px;background:var(--s1);border:1px solid var(--b2);border-radius:var(--rxl);padding:36px}
.login-logo{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:13px;letter-spacing:.14em;color:#080808;margin-bottom:6px;text-transform:uppercase}
.login-title{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:30px;margin-bottom:6px;color:#080808}
.login-title em{color:#e85a2a;font-style:normal}
.login-sub{color:#080808;font-size:13px;margin-bottom:24px;line-height:1.5}
.role-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:20px}
.role-opt{padding:10px 12px;border-radius:var(--r);background:var(--s2);border:1.5px solid var(--b2);cursor:pointer;transition:all .15s}
.role-opt:hover{border-color:var(--b3)}
.role-opt.on{border-color:var(--acc);background:var(--acc)10}
.role-icon{font-size:16px;margin-bottom:3px}
.role-lbl{font-size:12px;font-weight:700}
.role-desc{font-size:10px;color:#080808;margin-top:1px}
.login-fields{display:flex;flex-direction:column;gap:12px;margin-bottom:14px}
.lf{display:flex;flex-direction:column;gap:5px}
.lf label{font-size:11px;color:#080808;font-weight:700;text-transform:uppercase;letter-spacing:.08em}
.btn-login{width:100%;padding:13px;border-radius:var(--r);background:var(--acc);color:white;border:none;cursor:pointer;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:16px;letter-spacing:.04em;transition:all .2s}
.btn-login:hover{background:var(--acc2);transform:translateY(-1px)}
.login-sw{font-size:13px;color:#080808;margin-top:14px;text-align:center}
.login-sw span{color:var(--acc);cursor:pointer;font-weight:700}

/* SCROLLBAR */
::-webkit-scrollbar{width:3px;height:3px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--b3);border-radius:2px}


/* MULTI-CATEGORY */
.mcat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:7px;margin-bottom:12px}
.mcat-item{padding:10px 12px;border-radius:var(--r);background:var(--s2);border:1.5px solid var(--b2);cursor:pointer;transition:all .15s}
.mcat-item:hover{border-color:var(--b3)}.mcat-item.on{border-color:var(--acc);background:var(--acc)12}
.mcat-label{font-size:12px;font-weight:700;margin-bottom:2px}
.mcat-count{font-size:10px;color:#080808}
.mcat-expanded{background:var(--s1);border:1px solid var(--b2);border-radius:var(--r);padding:12px;margin-bottom:10px}
.mcat-exp-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:13px;color:var(--acc);margin-bottom:10px;display:flex;align-items:center;justify-content:space-between}
.mcat-sub-row{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.mcat-sub{padding:4px 10px;border-radius:8px;font-size:12px;background:var(--s2);border:1px solid var(--b2);color:#080808;cursor:pointer;transition:all .15s}
.mcat-sub:hover{border-color:var(--b3);color:var(--t1)}.mcat-sub.on{background:var(--acc)15;border-color:var(--acc)40;color:var(--acc);font-weight:600}
.mcat-prod{padding:3px 8px;border-radius:6px;font-size:11px;background:var(--s3);border:1px solid var(--b1);color:#080808;cursor:pointer;transition:all .15s}
.mcat-prod.on{background:var(--ok)15;border-color:var(--ok)30;color:var(--ok)}
.sel-cat-tag{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;background:var(--acc)15;border:1px solid var(--acc)30;font-size:11px;color:var(--acc);margin:2px}
.sel-cat-x{cursor:pointer;opacity:.6;font-size:13px;line-height:1}.sel-cat-x:hover{opacity:1}
.cat-tag-group{margin-bottom:8px}
.cat-tag-main{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:13px;color:var(--acc);margin-bottom:4px}
.cat-tag-subs{display:flex;gap:5px;flex-wrap:wrap}
.cat-sub-tag{padding:2px 8px;border-radius:6px;font-size:11px;background:var(--s3);border:1px solid var(--b2);color:#080808}
/* STAFF */
.staff-section{margin-top:20px;border-top:1px solid var(--b1);padding-top:18px}
.staff-hd{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:16px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between}
.staff-card{background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:13px;margin-bottom:8px;cursor:pointer;transition:all .15s}
.staff-card:hover{border-color:var(--b3)}
.staff-top{display:flex;align-items:center;gap:12px;margin-bottom:8px}
.staff-av{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--info),#6366f1);display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:13px;color:white;flex-shrink:0}
.staff-name{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px}
.staff-desig{font-size:12px;color:#080808}
.skill-tag{padding:2px 8px;border-radius:6px;font-size:11px;background:var(--s3);border:1px solid var(--b2);color:#080808}
.skills-row{display:flex;gap:5px;flex-wrap:wrap}
.wh-timeline{position:relative;padding-left:18px}
.wh-timeline::before{content:'';position:absolute;left:5px;top:0;bottom:0;width:2px;background:var(--b2)}
.wh-entry{position:relative;margin-bottom:14px}
.wh-entry::before{content:'';position:absolute;left:-15px;top:6px;width:10px;height:10px;border-radius:50%;background:var(--s1);border:2px solid var(--acc)}
.wh-card{background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);padding:11px}
.wh-card-role{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px}
.wh-card-store{font-size:12px;color:var(--acc);margin-top:1px}
.wh-card-period{font-size:11px;color:#080808;margin-top:2px}
/* CONTRIB VALIDATION */
.val-warn{background:var(--warn)10;border:1px solid var(--warn)25;border-radius:var(--r);padding:12px 16px;font-size:13px;color:var(--warn);margin-bottom:16px;display:flex;gap:10px;align-items:flex-start}
.val-ok-banner{background:var(--ok)10;border:1px solid var(--ok)25;border-radius:var(--r);padding:12px 16px;font-size:13px;color:var(--ok);margin-bottom:16px;display:flex;gap:10px;align-items:flex-start}
.contrib-note{background:#eff6ff;border:1px solid #bfdbfe;border-radius:var(--r);padding:10px 14px;font-size:12px;color:#1d4ed8;margin-bottom:14px;line-height:1.5}
.val-status-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:8px;font-size:12px;font-weight:700}
.vs-pending{background:var(--warn)15;color:var(--warn);border:1px solid var(--warn)25}
.vs-active{background:var(--ok)15;color:var(--ok);border:1px solid var(--ok)25}


/* LIGHT MODE — default */
.light{
  --bg:#f4f5f7;--s1:#ffffff;--s2:#f0f1f5;--s3:#e8e9f0;--s4:#dfe0ea;
  --b1:#00000008;--b2:#00000014;--b3:#0000002a;--b4:#00000038;
  --t1:#111120;--t2:#080808;--t3:#080808;
  --acc:#e85a2a;--acc2:#d44e22;--acc3:#f07d50;
  --ok:#16a34a;--warn:#d97706;--info:#2563eb;--danger:#dc2626;
}








/* REWARDS PAGE */
.rewards-pg{height:100%;overflow-y:auto}
.rewards-wrap{max-width:720px;margin:0 auto;padding:24px 20px 60px}
.rewards-hd{margin-bottom:24px}
.rewards-title{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:28px;margin-bottom:4px}
.rewards-sub{color:#080808;font-size:13px}
.reward-hero{background:linear-gradient(135deg,var(--acc)18,var(--acc)05);border:1px solid var(--acc)25;border-radius:var(--rl);padding:24px;margin-bottom:20px;text-align:center}
.reward-pts-big{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:56px;color:var(--acc);line-height:1}
.reward-pts-label{font-size:13px;color:#080808;margin-top:4px}
.reward-progress-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:20px}
.reward-milestone{background:var(--s1);border:1px solid var(--b2);border-radius:var(--r);padding:14px;text-align:center;transition:all .2s}
.reward-milestone.unlocked{border-color:var(--ok);background:var(--ok)08}
.reward-milestone.next{border-color:var(--acc);background:var(--acc)08}
.rm-pts{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:20px}
.rm-reward{font-size:13px;font-weight:700;margin-top:3px}
.rm-status{font-size:11px;margin-top:4px}
.section-card{background:var(--s1);border:1px solid var(--b2);border-radius:var(--rl);padding:20px;margin-bottom:16px}
.sc-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:17px;margin-bottom:4px;display:flex;align-items:center;gap:8px}
.sc-sub{font-size:12px;color:#080808;margin-bottom:16px}
.unlock-counter{display:flex;align-items:center;gap:12px;padding:12px;background:var(--s2);border-radius:var(--r);margin-bottom:12px}
.unlock-num{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:28px;color:var(--acc)}
.unlock-label{font-size:12px;color:#080808}
.profile-reveal{background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);padding:12px;margin-bottom:8px;display:flex;align-items:center;gap:12px}
.profile-reveal.locked{opacity:.5;filter:blur(1px);pointer-events:none;user-select:none}
.pr-av{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:14px;color:white;flex-shrink:0}
.pr-info{flex:1}
.pr-name{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px}
.pr-meta{font-size:12px;color:#080808;margin-top:2px}
.pr-phone{font-size:13px;font-weight:700;color:var(--acc)}
.locked-overlay{display:flex;align-items:center;gap:8px;padding:12px;background:var(--s3);border-radius:var(--r);margin-bottom:8px;font-size:12px;color:#080808}
.bulk-reward-card{background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);padding:14px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.brc-info{flex:1}
.brc-title{font-size:13px;font-weight:700}
.brc-detail{font-size:11px;color:#080808;margin-top:3px}
.brc-reward{text-align:right}
.brc-amount{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:18px;color:var(--ok)}
.brc-pts{font-size:11px;color:#080808;margin-top:2px}
.msg-btn{display:flex;align-items:center;gap:8px;padding:13px 20px;border-radius:var(--r);background:var(--info)12;border:1px solid var(--info)25;color:var(--info);cursor:pointer;transition:all .15s;font-size:13px;font-weight:700;width:100%;justify-content:center}
.msg-btn:hover{background:var(--info)20;border-color:var(--info)40}
.referral-card{background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);padding:16px;margin-bottom:10px}
.ref-code{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:22px;color:var(--acc);letter-spacing:.1em;background:var(--acc)10;padding:10px 20px;border-radius:var(--r);display:inline-block;margin:10px 0;border:1px dashed var(--acc)40}
.leads-card{background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);padding:14px;margin-bottom:10px}
.lc-type{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--acc);margin-bottom:5px}
.lc-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;margin-bottom:5px}
.lc-meta{display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:#080808}

/* DEALS PAGE */
.deals-pg{height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;text-align:center;padding:40px}
.deals-icon{font-size:64px;opacity:.3}
.deals-title{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:32px}
.deals-sub{color:#080808;font-size:14px;max-width:400px;line-height:1.6}
.deals-badge{background:var(--acc)12;border:1px solid var(--acc)25;color:var(--acc);padding:6px 16px;border-radius:20px;font-size:12px;font-weight:700}

.coming-soon-role{position:relative;pointer-events:none}
/* Light mode specific overrides */
.light .store-list .sc{background:#fff;border-color:#e0e0ea}
.light .store-list .sc:hover{background:#f8f8fc;border-color:#c0c0d0}
.light .topbar{background:#fff;border-color:#e0e0ea}
.light .nav-tabs{background:#f0f1f5}
.light .ntab.on{background:#fff;color:#080808}
.light .hero{background:#f4f5f7}
.light .stat-card{background:#fff;border-color:#e0e0ea}
.light .city-pill{background:#fff;border-color:#e0e0ea}
.light .city-pill:hover,.light .city-pill.sel{background:#fff3ef;border-color:var(--acc)}
.light .login-card{background:#fff;border-color:#e0e0ea}
.light .fi,.light .fs,.light .fta{background:#fff;border-color:#d0d0e0;color:#080808}
.light .role-opt{background:#f8f8fc;border-color:#e0e0ea}
.light .role-opt.on{background:#fff3ef;border-color:var(--acc)}
.light .section-card,.light .info-card,.light .prog-sec,.light .act-sec{background:#fff;border-color:#e0e0ea}
.light .profile-reveal{background:#f8f8fc;border-color:#e0e0ea}
.light .disc-filters{background:#fff;border-color:#e0e0ea}
.light .disc-list-col{background:#fff;border-color:#e0e0ea}
.light .sc{background:#f8f8fc;border-color:#e0e0ea}
.light .dg-item{background:#f8f8fc;border-color:#e0e0ea}
.light .conf-section{background:#f8f8fc;border-color:#e0e0ea}
.light .table-wrap{background:#fff;border-color:#e0e0ea}
.light .lb-row{background:#fff;border-color:#e0e0ea}
.light .lb-stat{background:#fff;border-color:#e0e0ea}
.light .admin-nav{background:#fff;border-color:#e0e0ea}
.light .anav.on{background:#f0f1f5}
.light .anav:hover{background:#f8f8fc}
.light .srch{background:#f0f1f5;border-color:#d0d0e0}
.light .srch input{color:#080808}
.light .chip{background:#f0f1f5;border-color:#d0d0e0;color:#080808}
.light .chip.on{background:#fff3ef;border-color:var(--acc)40;color:var(--acc)}
.light .mcat-item{background:#f8f8fc;border-color:#e0e0ea}
.light .mcat-item.on{background:#fff3ef;border-color:var(--acc)}
.light .mcat-expanded{background:#fff;border-color:#e0e0ea}
.light .mcat-sub{background:#f0f1f5;border-color:#d0d0e0;color:#080808}
.light .prof-hero{background:#fff;border-color:#e0e0ea}
.light .prof-stat{background:#f0f1f5}
.light .reward-hero{background:linear-gradient(135deg,#fff3ef,#fff8f5);border-color:var(--acc)20}
.light .reward-milestone{background:#fff;border-color:#e0e0ea}
.light .pts-hint{background:#fff3ef;border-color:var(--acc)20}
.light .type-tab{background:#f8f8fc;border-color:#e0e0ea}
.light .type-tab.on{background:#fff3ef;border-color:var(--acc)}
.light .chk{background:#f8f8fc;border-color:#e0e0ea}
.light .chk.on{background:#fff3ef;border-color:var(--acc)30}
.light .loc-field{background:#f8f8fc;border-color:#e0e0ea}
.light .bulk-reward-card{background:#f8f8fc;border-color:#e0e0ea}
.light .referral-card{background:#f8f8fc;border-color:#e0e0ea}
.light .staff-card{background:#f8f8fc;border-color:#e0e0ea}
.light .wh-card{background:#f0f1f5;border-color:#e0e0ea}
.light .dup-pair{background:#f8f8fc;border-color:#e0e0ea}
.light .dup-card{background:#fff;border-color:#e0e0ea}
.light .tmpl-card{background:#f8f8fc;border-color:#e0e0ea}
.light .ntab{color:#080808899}
.light .ntab:hover{color:#080808}
.light .ntab.on{color:#080808}
.light .logo{color:#080808}

/* ── CONVERSATIONS ────────────────────────────────────── */
.conv-desktop{display:flex;height:100%;overflow:hidden}
.conv-pane{overflow-y:auto}
.conv-pane-list{width:300px;flex-shrink:0;border-right:1px solid #e0e0e0;background:#fff}
.conv-pane-thread{flex:1;min-width:0;background:#f5f5f5;display:flex;flex-direction:column}
.conv-pane-rail{width:280px;flex-shrink:0;border-left:1px solid #e0e0e0;background:#fff}

/* ── INSPI GRID ──────────────────────────────────────── */
.inspi-grid{column-count:4;column-gap:12px}
@media(max-width:960px){.inspi-grid{column-count:3}}
@media(max-width:640px){.inspi-grid{column-count:2}}

/* ── MOBILE RESPONSIVE ───────────────────────────────── */
@media(max-width:768px){
  /* General */
  .app{overflow-y:auto}
  .page{overflow-y:auto}
  
  /* Topbar */
  .topbar{padding:0 12px;height:48px}
  .logo{font-size:16px}
  .pts-badge{font-size:11px;padding:2px 8px}
  .avatar{width:28px;height:28px;font-size:11px}
  
  /* Nav tabs — hide on mobile, use bottom nav */
  .nav-tabs{display:none}
  
  /* Bottom nav for mobile */
  .mobile-nav{
    display:flex;position:fixed;bottom:0;left:0;right:0;
    background:#fff;border-top:1px solid #e0e0e0;
    padding:8px 0 12px;z-index:300;
    box-shadow:0 -2px 12px rgba(0,0,0,.08);
  }
  .mobile-nav-item{
    flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;
    cursor:pointer;padding:4px 0;transition:all .15s;
  }
  .mobile-nav-icon{font-size:18px;line-height:1}
  .mobile-nav-label{font-size:10px;font-weight:700;color:#888;letter-spacing:.02em}
  .mobile-nav-item.on .mobile-nav-label{color:#e85a2a}
  
  /* Add padding at bottom for fixed nav */
  .page{padding-bottom:70px}
  
  /* Discovery */
  .discovery{flex-direction:column;overflow:visible}
  .disc-filters{width:100%;border-right:none;border-bottom:1px solid #e0e0e0}
  .disc-filters.collapsed{display:none}
  .disc-list-col{width:100%;border-right:none}
  .disc-list-col.hidden-mob{display:none}
  .disc-main{flex:1}
  .disc-main.hidden-mob{display:none}
  .disc-main .detail-panel{position:fixed;inset:0;z-index:200;background:#fff;overflow-y:auto;padding:16px 16px 80px}
  
  /* Forms */
  .fg{grid-template-columns:1fr}
  .fg3{grid-template-columns:1fr 1fr}
  .form-wrap{padding:16px 14px 80px}
  
  /* Retailer dashboard */
  .retailer-layout{flex-direction:column}
  .retailer-mobile-topbar{
    display:flex;align-items:center;gap:12px;padding:10px 14px;
    background:#fff;border-bottom:1px solid #e0e0e0;flex-shrink:0;
  }
  .retailer-menu-btn{
    width:32px;height:32px;border-radius:8px;background:#f5f5f5;border:1px solid #e0e0e0;
    font-size:16px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;
  }
  .retailer-mobile-title{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:15px;color:#080808}
  .retailer-nav-overlay{
    display:block;position:fixed;inset:0;background:#00000060;z-index:390;
  }
  .retailer-close-btn{
    display:flex;align-items:center;justify-content:center;width:26px;height:26px;
    border-radius:6px;background:transparent;border:1px solid var(--b3);color:#080808;
    cursor:pointer;font-size:13px;
  }
  .retailer-sidebar{
    position:fixed!important;top:0;left:0;bottom:0;width:240px!important;
    transform:translateX(-100%);transition:transform .2s ease;z-index:400;
    box-shadow:2px 0 20px rgba(0,0,0,.15);
  }
  .retailer-sidebar.open{transform:translateX(0)}
  .retailer-content{padding-bottom:70px!important}
  .retailer-content{padding:14px}
  
  /* Cards */
  .stat-card{padding:12px}
  .stat-num{font-size:22px}
  
  /* Leaderboard */
  .lb-stats{grid-template-columns:repeat(2,1fr)}
  .lb-wrap{padding:16px 14px}
  
  /* Profile */
  .prof-wrap{padding:16px 14px 80px}
  .prof-grid{grid-template-columns:repeat(3,1fr)}
  
  /* Admin */
  .admin-pg{flex-direction:column}
  .admin-mobile-topbar{
    display:flex;align-items:center;gap:12px;padding:10px 14px;
    background:var(--s1);border-bottom:1px solid var(--b1);flex-shrink:0;
  }
  .admin-menu-btn{
    width:32px;height:32px;border-radius:8px;background:var(--s2);border:1px solid var(--b2);
    font-size:16px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;
  }
  .admin-mobile-title{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:15px;color:var(--t1)}
  .admin-nav-overlay{
    display:block;position:fixed;inset:0;background:#00000060;z-index:390;
  }
  .admin-close-btn{
    display:flex;align-items:center;justify-content:center;width:22px;height:22px;
    border-radius:6px;background:transparent;border:1px solid var(--b3);color:#080808;
    cursor:pointer;font-size:11px;
  }
  .admin-nav{
    position:fixed;top:0;left:0;bottom:0;width:220px;
    transform:translateX(-100%);transition:transform .2s ease;z-index:400;
    box-shadow:2px 0 20px rgba(0,0,0,.15);display:flex;
  }
  .admin-nav.open{transform:translateX(0)}
  .admin-main{padding:14px}
  .admin-stats{grid-template-columns:repeat(2,1fr)}
  
  /* Login */
  .login-pg{padding:16px 12px}
  .login-card{width:100%;max-width:400px;padding:24px 20px;margin:10px}
  .role-grid{grid-template-columns:1fr 1fr}
  
  /* Category selector */
  .mcat-grid{grid-template-columns:repeat(2,1fr)}
  
  /* Hero */
  .hero-top{padding:32px 16px 24px}
  .stats-row{grid-template-columns:repeat(2,1fr)}
  .city-grid{grid-template-columns:repeat(2,1fr)}

  /* Footer */
  .site-footer{padding:18px 16px;margin-top:24px}
  .site-footer-inner{flex-direction:column;align-items:flex-start;gap:8px}
}

@media(max-width:768px){
  .disc-main.hidden-mob{display:none}
  .disc-list-col.hidden-mob{display:none}
  .discovery{flex-direction:column}
  .disc-filters{width:100%}
  .disc-list-col{width:100%}
  .stats-row{grid-template-columns:repeat(2,1fr)}
  .fg{grid-template-columns:1fr}
  .fg3{grid-template-columns:1fr 1fr}
  .nav-tabs{display:none}
}
`;
