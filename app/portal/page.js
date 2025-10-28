"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useOrgId } from "../../lib/useOrgId"; // ← added
import dynamic from "next/dynamic";
const ReportDashboard = dynamic(
  () => import("../../src/features/reports/dashboard/ReportDashboard.jsx"),
  { ssr: false } // recharts/tabs are client-side
);

export default function Portal() {
  const [page, setPage] = useState("home");
  const { orgId, loading: orgLoading, error: orgError } = useOrgId(); // ← added

  if (orgError) {
    return <div style={{padding:16,color:"#b91c1c"}}>Org resolution failed: {orgError}</div>;
  }
  if (orgLoading || !orgId) {
    return <div style={{padding:16}}>Loading organization…</div>;
  }

  return (
    <div style={{display:"flex",minHeight:"100vh"}}>
            <aside className="sidebar">
        <Logo />
        <Nav page={page} onChange={setPage}/>
      </aside>
      <main style={{flex:1,padding:20}}>
        <Header page={page} onChange={setPage}/>
        {page==="home"      && <HomePage orgId={orgId} />}
        {page==="campaigns" && <MissionsPage orgId={orgId} onLaunched={()=>setPage("home")} />}
        {page==="reports"   && <ReportsTab orgId={orgId} />}
      </main>
      <style>{`
        @media (min-width: 992px){
          .desktop-only{ display:block !important; }
          .mobile-only{ display:none !important; }
        }
        .sidebar{
          width:260px;
          padding:16px;
          background:#0B1B2B;            /* Mystery Agent NAVY */
          color:#fff;
          border-right:1px solid rgba(255,255,255,.08);
        }
        .sidebar button{
          display:block;
          width:100%;
          text-align:left;
          border:none;
          background:transparent;
          color:#fff;
          padding:8px 10px;
          border-radius:10px;
          cursor:pointer;
          margin-bottom:6px;
        }
        .sidebar button.active{
          background:rgba(255,255,255,.12);
        }
        .sidebar button:hover{
          background:rgba(255,255,255,.08);
        }
        .sidebar .logo-word{ color:#D4AF37; } /* gold accent for Mystery Agent */
      `}</style>
    </div>
  );
}

function hasValidPoint(lat, lng){
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
}

// --- brand tokens injected as CSS variables + font ---
function BrandStyles(){
  useEffect(() => {
    // no-op on server
  }, []);
  return (
    <>
      {/* Google Fonts (swap with your corporate font if you have self-hosted files) */}
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        :root{
          /* ====== MYSTERY AGENT BRAND (edit these 8 tokens) ====== */
          --brand:        #0B57D0;   /* primary */
          --brand-600:    #0949B0;
          --brand-50:     #E6EEFF;
          --accent:       #6E59F4;   /* secondary accent */
          --text:         #111418;
          --muted:        #6B7280;
          --bg:           #FAFBFC;
          --panel:        #FFFFFF;

          /* Radii & shadows */
          --radius: 12px;
          --shadow: 0 12px 36px rgba(0,0,0,.08);

          /* Borders */
          --border: #E5E7EB;

          /* Success/Warning/Error (optional) */
          --success: #16A34A;
          --warning: #D97706;
          --error:   #DC2626;
        }
        html, body { background: var(--bg); color: var(--text); font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
        a { color: var(--brand); }
      `}</style>
    </>
  );
}

/* ===================== APP SHELL (BRANDED) ===================== */
function Logo(){
  return (
    <div className="sidebar-header">
      <img
        src="/brand/icon.svg"
        alt="MA"
        height={32}
        width={32}
        style={{borderRadius:8, display:"block"}}
        onError={(e)=>{ e.currentTarget.style.display="none"; }}
      />
      <div>
        <div className="name">Mystery Agent</div>
        <div className="sub">Client Portal</div>
      </div>
    </div>
  );
}

function Nav({page,onChange}){
  const items = [
    {key:"home",label:"Home"},
    {key:"campaigns",label:"Missions"},
    {key:"reports",label:"Reports"},
  ];
  return (
    <div className="sidebar-nav">
      {items.map(n => (
        <button key={n.key}
          onClick={()=>onChange(n.key)}
          className={page===n.key ? "active" : ""}
          style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"8px 10px",borderRadius:10,background:"transparent",border:"none"}}
        >
          {n.label}
        </button>
      ))}
    </div>
  );
}

function Header({page,onChange}){
  const items = [
    {key:"home",label:"Home"},
    {key:"campaigns",label:"Missions"},
    {key:"reports",label:"Reports"},
  ];
  return (
    <div className="topbar mobile-only">
      <select value={page} onChange={e=>onChange(e.target.value)}>
        {items.map(n => <option key={n.key} value={n.key}>{n.label}</option>)}
      </select>
      <div style={{
        height:32,width:32,borderRadius:16,
        background:"var(--gold)", color:"#1a1a1a",
        display:"grid", placeItems:"center", fontWeight:700
      }}>MA</div>
    </div>
  );
}

/* ===================== HOME (READ-ONLY + COUNTERS) ===================== */
function HomePage({ orgId }){
  const [missions, setMissions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  // NEW: completed counter pulled from /api/completed
  const [completedCount, setCompletedCount] = useState(0);
  const [completedErr, setCompletedErr] = useState(null);

  // Load missions (for Now/Scheduled tables and counts)
  useEffect(() => {
    if (!orgId) return;
    (async ()=>{
      setBusy(true); setErr(null);
      try{
        const res = await fetch(`/api/missions?orgId=${encodeURIComponent(orgId)}`);
        const js = await res.json();
        if (!res.ok) throw new Error(js.error || "Failed to load missions");
        setMissions(js.missions || []);
      }catch(e){ setErr(String(e?.message || e)); }
      finally{ setBusy(false); }
    })();
  }, [orgId]);

  // Load completed count from /api/completed
  useEffect(() => {
    if (!orgId) return;
    (async ()=>{
      setCompletedErr(null);
      try{
        const res = await fetch(`/api/completed?orgId=${encodeURIComponent(orgId)}&limit=1000`);
        const text = await res.text();
        let js;
        try { js = JSON.parse(text); }
        catch { throw new Error(`Non-JSON from /api/completed: ${text.slice(0,80)}…`); }
        const items = js.items || js.completed || js.rows || [];
        setCompletedCount(Array.isArray(items) ? items.length : 0);
      }catch(e){ setCompletedErr(String(e?.message || e)); }
    })();
  }, [orgId]);

  const live = missions.filter(m => m.status === "Now");
  const scheduled = missions.filter(m => m.status === "Scheduled");

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:16,marginBottom:16}}>
        <Card title="Missions (total)"><KPI value={missions.length} sub="All missions"/></Card>
        <Card title="Now"><KPI value={live.length} sub="Live"/></Card>
        <Card title="Scheduled"><KPI value={scheduled.length} sub="Starting later"/></Card>
        <Card title="Completed">
          <KPI value={completedCount} sub={completedErr ? "Error loading" : "Finished"}/>
        </Card>
      </div>

      {err && <div style={{color:"#b91c1c",marginBottom:8}}>{err}</div>}

      <Card title="Now" right={<span style={{fontSize:12,opacity:.7}}>{live.length} items</span>}>
        {busy ? <div style={{opacity:.7}}>Loading…</div> :
          <Table
            columns={["ID","Title","Store","Expires","Cost"]}
            rows={live.map(m => [m.id, m.title, m.store, fmtTime(m.expiresAt), money(m.cost)])}
            onRowClick={()=>{}}
          />
        }
      </Card>

      <Card title="Scheduled" right={<span style={{fontSize:12,opacity:.7}}>{scheduled.length} items</span>}>
        {busy ? <div style={{opacity:.7}}>Loading…</div> :
          <Table
            columns={["ID","Title","Store","Starts","Cost"]}
            rows={scheduled.map(m => [m.id, m.title, m.store, fmtTime(m.startsAt), money(m.cost)])}
            onRowClick={()=>{}}
          />
        }
      </Card>
    </div>
  );
}
// === Checklist mapping helpers (EDITOR -> DB rows) ===

// Expand one editor row (text + toggles) into 1..5 DB rows
function expandChecklistRow(row, baseIndex) {
  const out = [];
  let idx = baseIndex;

  const title = (row?.text || '').trim() || 'Checklist item';

  // 1) Yes/No
  if (row?.yesNo) {
    out.push({
      order_index: idx++,
      title,
      answer_type: 'YN',
      required: true,
      expected_value: null,      // set 'Y' if you want a target
      weight: 1,
      config_json: {}
    });
  }
  // 2) Photo
  if (row?.requires?.photo) {
    out.push({
      order_index: idx++,
      title: `${title} — Photo`,
      answer_type: 'PHOTO',
      required: true,
      config_json: { maxPhotos: 1 }
    });
  }
  // 3) Video
  if (row?.requires?.video) {
    out.push({
      order_index: idx++,
      title: `${title} — Video`,
      answer_type: 'VIDEO',
      required: true,
      config_json: { maxSeconds: 15 }
    });
  }
  // 4) Comment
  if (row?.requires?.comment) {
    out.push({
      order_index: idx++,
      title: `${title} — Comment`,
      answer_type: 'COMMENT',
      required: false
    });
  }
  // 5) Timer
  if (row?.requires?.timer) {
    out.push({
      order_index: idx++,
      title: `${title} — Timer`,
      answer_type: 'TIMER',
      required: true
    });
  }

    // 6) 1–5 Rating
    if (row?.requires?.rating) {
      out.push({
        order_index: idx++,
        title: `${title} — Rating`,
        answer_type: 'RATING',
        required: true,
        config_json: { min: 1, max: 5 }
      });
    }
  return out;
}

// Map the whole editor array to a flat, ordered list for DB
function mapChecklistForDB(editorList = []) {
  const flat = [];
  let order = 0;
  for (const row of editorList) {
    const expanded = expandChecklistRow(row, order);
    flat.push(...expanded);
    order += expanded.length;
  }
  return flat;
}
// app/portal/page.js (top-level helper)
async function saveChecklist(missionId, items) {
  const payload = Array.isArray(items) ? items : [];
  const res = await fetch(`/api/missions/${encodeURIComponent(missionId)}/checklist`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let js;
  try { js = JSON.parse(text); } catch {
    throw new Error(`Non-JSON from checklist PUT: ${text.slice(0,80)}…`);
  }
  if (!res.ok) throw new Error(js.error || "Checklist save failed");
  return js;
}
/* ===================== MISSIONS PAGE ===================== */
function MissionsPage({ orgId, onLaunched }) {
  const [tab, setTab] = useState("templates");
  const [templates, setTemplates] = useState([]);
  const [reviewTpl, setReviewTpl] = useState(null);
  const [launching, setLaunching] = useState(false);
  const [loadingTpls, setLoadingTpls] = useState(false);
  const [tplError, setTplError] = useState(null);

    // local tab button (ensures scope even if global TabButton moves)
  const TabBtn = ({active, onClick, children}) => (
    <button
      onClick={onClick}
      style={{
        padding:"8px 10px",
        borderRadius:10,
        border:"1px solid #E5E7EB",
        background: active ? "rgba(11, 87, 208, .08)" : "#fff",
        color: active ? "#0B57D0" : "#111",
        cursor:"pointer"
      }}
    >
      {children}
    </button>
  );

  // Single helper to create a mission (adds orgId to URL)
  async function createMission(payload) {
  // 1) Create the mission
  const res = await fetch(`/api/missions?orgId=${encodeURIComponent(orgId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const created = await res.json().catch(()=>({}));
  if (!res.ok) {
    throw new Error(created.error || "Failed to create mission");
  }

  // 2) Persist checklist if present
  const missionId = created?.id || created?.mission?.id;
  if (missionId && Array.isArray(payload?.checklist) && payload.checklist.length) {
    await saveChecklist(missionId, payload.checklist);
  }

  // 3) Return created mission id (for UI if needed)
  return created;
}

  // Load templates for this org
  useEffect(() => {
    if (!orgId) return;
    (async () => {
      setLoadingTpls(true);
      setTplError(null);
      try {
        const res = await fetch(`/api/templates?orgId=${encodeURIComponent(orgId)}`);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Failed to load templates");
        setTemplates(d.templates || []);
      } catch (err) {
        console.error("[Missions] load templates error", err);
        setTplError(String(err?.message || err));
      } finally {
        setLoadingTpls(false);
      }
    })();
  }, [orgId]);

  return (
  <div>
    {/* Tabs */}
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      <TabBtn active={tab === "templates"} onClick={() => setTab("templates")}>
        Mission Templates
      </TabBtn>
      <TabBtn active={tab === "new"} onClick={() => setTab("new")}>
        New Mission
      </TabBtn>
    </div>

    {/* Tab content */}
    {tab === "templates" && (
  <Card title="Templates">
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
      {templates.map(t => (
        <div key={t.id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12, background: "#fff" }}>
          <div style={{ fontWeight: 600 }}>{t.name}</div>
          <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>{t.notes}</div>
          <button onClick={() => setReviewTpl(t)} className="primary">Review & Start</button>
        </div>
      ))}
      {templates.length === 0 && <div style={{ opacity: 0.7, fontSize: 14 }}>No templates yet</div>}
    </div>
  </Card>
)}

    {tab === "new" && (
  <NewMissionWizard
    onCancel={() => setTab("templates")}
    onDone={() => {                 // <-- only close & refresh UI
      alert("Mission launched!");
      setTab("templates");
      onLaunched?.();
    }}
    launching={launching}
    orgId={orgId}                   // <-- pass orgId down
  />
)}

    {/* Always visible, regardless of tab */}
    <Card title="Missions"><AllMissionsAdmin orgId={orgId} /></Card>
    <Card title="Completed Missions">
      <CompletedMissionsInbox orgId={orgId} />
    </Card>

    {reviewTpl && (
      <Modal title="Review Template" onClose={() => setReviewTpl(null)}>
        <TemplateReviewForm
          template={reviewTpl}
          onStart={async (payload) => {
            try {
              setLaunching(true);

              // 1) Create the mission
              const created = await createMission(payload);
              const missionId = created?.id || created?.mission?.id;
              if (!missionId) throw new Error("No missionId returned from /api/missions");

              // 2) Persist the checklist snapshot for this mission
              await saveChecklist(missionId, payload.checklist || []);

              // 3) UX
              alert("Mission started!");
              setReviewTpl(null);
              try { window.dispatchEvent(new CustomEvent("missions:refetch")); } catch {}
              onLaunched?.();
           } catch (e) {
             alert(e?.message || "Failed to start mission");
           } finally {
             setLaunching(false);
           }
        }}
          launching={launching}
        />
      </Modal>
    )}
  </div>
);
}

/* ===================== TEMPLATE REVIEW FORM (FULL, EDITABLE) ===================== */
function TemplateReviewForm({ template, orgId, onStart, launching }){
  const [draft,setDraft] = useState({
    title: template.title || template.name || "Untitled Mission",
    store: template.defaultStore || "",
    status: "Scheduled",
    startsAt: Date.now() + 24*3600*1000,
    expiresAt: Date.now() + 24*3600*1000 + 7*24*3600*1000,
    address: template.defaultLocation?.address||"",
    location: {...template.defaultLocation},
    checklist: (template.defaultChecklist || template.checklist || []).map(toChecklistObj),
    budget: Number(template.defaultBudget||0),
    fee: Number(template.defaultFee||0),
    requiresVideo: !!template.requiresVideo,
    requiresPhotos: !!template.requiresPhotos,
    timeOnSiteMin: template.timeOnSiteMin ?? 10,
  });

  const [addr, setAddr] = useState({
    line1: template.defaultLocation?.addressParts?.line1 || "",
    city: template.defaultLocation?.addressParts?.city || "",
    region: template.defaultLocation?.addressParts?.region || "",
    postalCode: template.defaultLocation?.addressParts?.postalCode || "",
    country: template.defaultLocation?.addressParts?.country || "",
  });

  const [showPicker, setShowPicker] = useState(false);

  const setPinFromAddress = async () => {
    const res = await fetch(`/api/geocode`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({
        addressParts: addr,
        proximity: draft.location?.lat && draft.location?.lng
          ? { lat: draft.location.lat, lng: draft.location.lng }
          : undefined
      })
    });
    const js = await res.json().catch(()=>({}));
    if (res.ok) {
      setDraft(d=>({ ...d, location:{ ...d.location, lat: js.lat, lng: js.lng }, address: js.formatted || d.address }));
   } else alert(js.error || "Could not set pin");
  };


  return (
    <div>
      <Field label="Title"><input value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></Field>
      <Field label="Store"><input value={draft.store} onChange={e=>setDraft({...draft,store:e.target.value})}/></Field>

      <Field label="Status">
        <select value={draft.status} onChange={e=>{
          const v = e.target.value;
          if (v === "Now") {
            const now = Date.now();
            setDraft(d => ({ ...d, status: "Now", startsAt: now })); // no forced expiry
          } else {
            setDraft(d => ({ ...d, status: "Scheduled" }));
          }
        }}>
          <option>Now</option>
          <option>Scheduled</option>
        </select>
      </Field>

      {draft.status === "Scheduled" && (
        <Field label="Mission Start">
          <input type="datetime-local" value={toLocalInput(draft.startsAt)} onChange={e=>{
            const ts = new Date(e.target.value).getTime();
            setDraft(d => ({ ...d, startsAt: ts })); // no forced expiry bump
          }}/>
        </Field>
      )}

      <Field label="Expiry">
        <input type="datetime-local" value={toLocalInput(draft.expiresAt)} onChange={e=>{
          const ts = new Date(e.target.value).getTime();
          setDraft(d => ({ ...d, expiresAt: ts }));
        }}/>
      </Field>

      <Field label="Address">
        <AddressFields
          value={addr}
          onChange={setAddr}
          onGeocode={setPinFromAddress}
          onPickOnMap={()=>setShowPicker(true)}
        />
      </Field>

      {hasValidPoint(draft.location?.lat, draft.location?.lng) && (
       <img
         alt="Map"
         src={`/api/staticmap?lat=${draft.location.lat}&lng=${draft.location.lng}&w=640&h=220&t=${Date.now()}`}
         style={{marginTop:10,width:"100%",maxWidth:640,borderRadius:10,border:"1px solid var(--border)",pointerEvents:"none"}}
      />
      )}

      <Field label="Checklist"><ChecklistEditor value={draft.checklist} onChange={list=>setDraft({...draft,checklist:list})}/></Field>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        <Field label="Budget"><input type="number" value={draft.budget} onChange={e=>setDraft({...draft,budget:Number(e.target.value)})}/></Field>
        <Field label="Fee"><input type="number" value={draft.fee} onChange={e=>setDraft({...draft,fee:Number(e.target.value)})}/></Field>
        <Field label="Mission Cost"><input value={(Number(draft.budget)+Number(draft.fee)).toFixed(0)} readOnly/></Field>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:8}}>
        <Field label="Requires Video?"><input type="checkbox" checked={!!draft.requiresVideo} onChange={e=>setDraft({...draft,requiresVideo:e.target.checked})}/></Field>
        <Field label="Requires Photos?"><input type="checkbox" checked={!!draft.requiresPhotos} onChange={e=>setDraft({...draft,requiresPhotos:e.target.checked})}/></Field>
        <Field label="Min Time on Site (min)"><input type="number" min={0} value={draft.timeOnSiteMin} onChange={e=>setDraft({...draft,timeOnSiteMin:Number(e.target.value)})}/></Field>
      </div>

      <div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}>
        <button
          onClick={()=>onStart({
            ...draft,
            location: { ...draft.location, address: draft.address||draft.location?.address||"" },
          })}
          disabled={launching}
          className="primary"
        >
          {launching ? "Starting…" : "Start Mission"}
        </button>
      </div>

      {showPicker && (
        <MapPicker
          initial={{ lat: draft.location?.lat, lng: draft.location?.lng }}
          onCancel={()=>setShowPicker(false)}
          onSave={async ({lat,lng})=>{
            setDraft(d=>({ ...d, location:{...d.location, lat, lng} }));
            setShowPicker(false);
            const rr = await fetch("/api/revgeocode", {
              method: "POST", headers: { "Content-Type":"application/json" },
              body: JSON.stringify({ lat, lng })
            });
            const j = await rr.json().catch(()=>({}));
            if (rr.ok) setAddr(j.addressParts || {});
          }}
        />
      )}
    </div>
  );
}

/* ===================== NEW MISSION WIZARD (FULL REPLACEMENT) ===================== */
function NewMissionWizard({ onCancel, onDone, launching, orgId }) {
  const [step, setStep] = useState(0); // 0 Basics, 1 Schedule, 2 Location, 3 Checklist, 4 Review
  const [showPicker, setShowPicker] = useState(false);
  const submittingRef = useRef(false);

  const [form, setForm] = useState({
    title: "Untitled Mission",
    store: "Unassigned Store",
    status: "Scheduled",
    startsAt: Date.now() + 24 * 3600 * 1000,
    expiresAt: Date.now() + 8 * 24 * 3600 * 1000, // ≥ 7 days
    address: "",
    location: { lat: 0, lng: 0, address: "" },
    checklist: [],
    budget: 0,
    fee: 0,
    requiresVideo: false,
    requiresPhotos: true,
    timeOnSiteMin: 10,
  });

  const [addr, setAddr] = useState({ line1: "", city: "", region: "", postalCode: "", country: "" });

const setPinFromAddress = async () => {
  try {
    const res = await fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        addressParts: addr,
        proximity:
          Number.isFinite(form.location?.lat) && Number.isFinite(form.location?.lng)
            ? { lat: form.location.lat, lng: form.location.lng }
            : undefined,
      }),
    });
    const js = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(js.error || "Could not set pin");

    setForm((f) => ({
      ...f,
      location: { ...f.location, lat: js.lat, lng: js.lng },
      address: js.formatted || f.address,          // <-- CRITICAL: write address
    }));
  } catch (err) {
    alert(err.message || "Could not set pin");
  }
};

const launch = async () => {
  if (launching || submittingRef.current) return;
  submittingRef.current = true;

  const payload = {
    ...form,
    location: { ...form.location, address: form.address || form.location.address || "" },
  };

  try {
    // 1) create mission
    const res = await fetch(`/api/missions?orgId=${encodeURIComponent(orgId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const js = await res.json().catch(() => ({}));
      alert(js.error || "Failed to create mission");
      submittingRef.current = false;
      return;
    }

    const created = await res.json();
    const missionId = created?.id || created?.mission?.id;
    if (!missionId) {
      submittingRef.current = false;
      alert("No missionId returned from /api/missions");
      return;
    }

    // 2) persist checklist from the wizard form
    await saveChecklist(missionId, form.checklist || []);

    // 3) UX reset
    alert("Mission launched!");
    try { window.dispatchEvent(new CustomEvent("missions:refetch")); } catch {}
    setShowPicker(false);
    setStep(0);
    setForm({
      title: "Untitled Mission",
      store: "Unassigned Store",
      status: "Scheduled",
      startsAt: Date.now() + 24 * 3600 * 1000,
      expiresAt: Date.now() + 8 * 24 * 3600 * 1000,
      address: "",
      location: { lat: 0, lng: 0, address: "" },
      checklist: [],
      budget: 0,
      fee: 0,
      requiresVideo: false,
      requiresPhotos: true,
      timeOnSiteMin: 10,
    });
    onDone?.();
  } catch (e) {
    alert("Failed to create mission");
  } finally {
    submittingRef.current = false;
  }
};

  function StepsHeader() {
    return (
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {["Basics", "Schedule", "Location", "Checklist", "Review"].map((label, i) => (
          <button
            key={label}
            onClick={() => setStep(i)}
            style={{
              ...buttonGhost,
              background: step === i ? "var(--brand-50)" : "#fff",
              color: step === i ? "var(--brand)" : "#111",
            }}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <Card title="New Mission (Wizard)" right={<span style={{ fontSize: 12, opacity: 0.7 }}>Step {step + 1} of 5</span>}>
      <StepsHeader />

      {/* STEP 0: BASICS */}
      {step === 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          <Field label="Mission Title"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} /></Field>
          <Field label="Store"><input value={form.store} onChange={(e) => setForm({ ...form, store: e.target.value })} style={inputStyle} /></Field>
          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "Now") {
                  const now = Date.now();
                  setForm((f) => ({ ...f, status: "Now", startsAt: now, }));
                } else {
                  setForm((f) => ({ ...f, status: "Scheduled" }));
                }
              }}
              style={inputStyle}
            >
              <option>Now</option>
              <option>Scheduled</option>
            </select>
          </Field>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <button onClick={onCancel} style={buttonGhost}>Cancel</button>
            <button onClick={() => setStep(1)} style={buttonPrimary}>Next</button>
          </div>
        </div>
      )}

      {/* STEP 1: SCHEDULE */}
      {step === 1 && (
        <div style={{ display: "grid", gap: 8 }}>
          {form.status === "Scheduled" && (
            <Field label="Mission Start">
              <input
                type="datetime-local"
                value={toLocalInput(form.startsAt)}
                onChange={(e) => {
                  const ts = new Date(e.target.value).getTime();
                  setForm((f) => ({ ...f, startsAt: ts }));
                }}
                style={inputStyle}
              />
            </Field>
          )}
          <Field label="Expiry">
            <input
              type="datetime-local"
              value={toLocalInput(form.expiresAt)}
              onChange={(e) => {
                const ts = new Date(e.target.value).getTime();
                setForm((f) => ({ ...f, expiresAt: ts }));
              }}
              style={inputStyle}
            />
          </Field>
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 8 }}>
            <button onClick={() => setStep(0)} style={buttonGhost}>Back</button>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onCancel} style={buttonGhost}>Cancel</button>
              <button onClick={() => setStep(2)} style={buttonPrimary}>Next</button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: LOCATION */}
      {step === 2 && (
        <div style={{ display: "grid", gap: 8 }}>
          <Field label="Address">
            <AddressFields value={addr} onChange={setAddr} onGeocode={setPinFromAddress} onPickOnMap={() => setShowPicker(true)} />
          </Field>

          {Number.isFinite(form.location?.lat) && Number.isFinite(form.location?.lng) && (
            <img
              alt="Map"
              src={`/api/staticmap?lat=${form.location.lat}&lng=${form.location.lng}&w=640&h=220`}
              style={{ marginTop: 10, width: "100%", maxWidth: 640, borderRadius: 10, border: "1px solid #eee", pointerEvents: "none" }}
            />
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 8 }}>
            <button onClick={() => setStep(1)} style={buttonGhost}>Back</button>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onCancel} style={buttonGhost}>Cancel</button>
              <button onClick={() => setStep(3)} style={buttonPrimary}>Next</button>
            </div>
          </div>

          {showPicker && (
            <MapPicker
              initial={{ lat: form.location?.lat, lng: form.location?.lng }}
              onCancel={() => setShowPicker(false)}
              onSave={async ({ lat, lng }) => {
                setForm((f) => ({ ...f, location: { ...f.location, lat, lng } }));
                setShowPicker(false);

                // Reverse geocode, then set both addr (structured) and form.address (display string)
                const rr = await fetch("/api/revgeocode", {
                   method: "POST",
                   headers: { "Content-Type": "application/json" },
                   body: JSON.stringify({ lat, lng }),
                });
                const j = await rr.json().catch(() => ({}));
                if (rr.ok) {
                  setAddr(j.addressParts || {});
                  setForm((f) => ({ ...f, address: j.formatted || f.address })); // <-- CRITICAL
                }
              }}
            />
          )}
        </div>
      )}

      {/* STEP 3: CHECKLIST */}
      {step === 3 && (
        <div style={{ display: "grid", gap: 8 }}>
          <Field label="Checklist">
            <ChecklistEditor value={form.checklist} onChange={(list) => setForm({ ...form, checklist: list })} />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <Field label="Budget"><input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })} style={inputStyle} /></Field>
            <Field label="Fee"><input type="number" value={form.fee} onChange={(e) => setForm({ ...form, fee: Number(e.target.value) })} style={inputStyle} /></Field>
            <Field label="Mission Cost"><input value={(form.budget + form.fee).toFixed(0)} readOnly style={inputStyle} /></Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
            <Field label="Requires Video?"><input type="checkbox" checked={!!form.requiresVideo} onChange={(e) => setForm({ ...form, requiresVideo: e.target.checked })} /></Field>
            <Field label="Requires Photos?"><input type="checkbox" checked={!!form.requiresPhotos} onChange={(e) => setForm({ ...form, requiresPhotos: e.target.checked })} /></Field>
            <Field label="Min Time on Site (min)"><input type="number" min={0} value={form.timeOnSiteMin} onChange={(e) => setForm({ ...form, timeOnSiteMin: Number(e.target.value) })} style={inputStyle} /></Field>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 8 }}>
            <button onClick={() => setStep(2)} style={buttonGhost}>Back</button>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onCancel} style={buttonGhost}>Cancel</button>
              <button onClick={() => setStep(4)} style={buttonPrimary}>Next</button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: REVIEW & LAUNCH */}
      {step === 4 && (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Review</div>
          <div><b>Title:</b> {form.title}</div>
          <div><b>Store:</b> {form.store}</div>
          <div><b>Status:</b> {form.status}</div>
          <div><b>Starts:</b> {fmtTime(form.startsAt)}</div>
          <div><b>Expires:</b> {fmtTime(form.expiresAt)}</div>
          <div><b>Address:</b> {form.address || "—"}</div>
          <div><b>Location:</b> {Number.isFinite(form.location.lat) && Number.isFinite(form.location.lng) ? `${form.location.lat}, ${form.location.lng}` : "—"}</div>
          <div><b>Budget:</b> {money(form.budget)} &nbsp; <b>Fee:</b> {money(form.fee)} &nbsp; <b>Cost:</b> {money(form.budget + form.fee)}</div>

          <Field label="Checklist (read-only)">
            <ChecklistReadOnly items={form.checklist} />
          </Field>

          <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 8 }}>
            <button onClick={() => setStep(3)} style={buttonGhost}>Back</button>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onCancel} style={buttonGhost}>Cancel</button>
              <button onClick={launch} style={buttonPrimary}>Launch Mission</button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ===================== CHECKLIST EDITOR ===================== */
function ChecklistEditor({ value = [], onChange }) {
  const [items, setItems] = useState(value.map(toChecklistObj));

  useEffect(() => { setItems(value.map(toChecklistObj)); }, [JSON.stringify(value)]);
  useEffect(() => { onChange?.(items); }, [items]);

  const add = () => setItems(p => [...p, toChecklistObj({ text: "" })]);
  const remove = (i) => setItems(p => p.filter((_, idx) => idx !== i));
  const update = (i, patch) => setItems(p => p.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const toggleReq = (i, key) => setItems(p =>
    p.map((it, idx) => idx === i ? { ...it, requires: { ...it.requires, [key]: !it.requires[key] } } : it)
  );

  return (
    <div>
      {items.length === 0 && <div style={{ marginBottom: 6 }}><em style={{ opacity: .7 }}>No items yet</em></div>}
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((it, i) => (
          <div key={i} style={{ border: "1px solid #eee", borderRadius: 10, padding: 8, background: "#fff" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
              <input value={it.text} onChange={e => update(i, { text: e.target.value })}
                     style={inputStyle} placeholder={`Checklist item #${i + 1}`} />
              <button onClick={() => remove(i)} style={buttonGhost}>Remove</button>
            </div>

            {/* NEW: Yes/No question toggle */}
            <div style={{ fontSize: 13, marginTop: 8, display: "flex", gap: 16, alignItems: "center", flexWrap:"wrap" }}>
              <label style={{ fontWeight: 600 }}>
                <input type="checkbox" checked={it.yesNo} onChange={() => update(i, { yesNo: !it.yesNo })} /> Yes/No question
              </label>
              <span style={{ fontSize: 12, opacity: .75 }}>
                App will render this as a binary choice (Y/N). Other requirements still apply.
              </span>
            </div>

            <div style={{ fontSize: 13, marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <label><input type="checkbox" checked={it.requires.photo} onChange={() => toggleReq(i, "photo")} /> Photo</label>
              <label><input type="checkbox" checked={it.requires.video} onChange={() => toggleReq(i, "video")} /> Video</label>
              <label><input type="checkbox" checked={it.requires.comment} onChange={() => toggleReq(i, "comment")} /> Comment</label>
              <label><input type="checkbox" checked={it.requires.timer} onChange={() => toggleReq(i, "timer")} /> Timer</label>
              <label><input type="checkbox" checked={it.requires.rating}  onChange={() => toggleReq(i, "rating")} /> 1–5 rating</label>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 8 }}><button onClick={add} style={buttonPrimary}>Add Item</button></div>
    </div>
  );
}
function toChecklistObj(x){
  // Normalize old shapes → new with yesNo flag
  if (typeof x === "string") {
    return { text: x, yesNo: false, requires: { photo:false, video:false, comment:false, timer:false, rating:false } };
  }
  const text = (x?.text ?? "").toString();
  const r = x?.requires || {};
  const yesNo = !!x?.yesNo; // NEW: yes/no flag used by the App to render binary question
  return { text, yesNo, requires: { photo:!!r.photo, video:!!r.video, comment:!!r.comment, timer:!!r.timer, rating:!!r.rating } };
}

/* ===================== ADMIN LIST + DELETE/EDIT ===================== */
function AllMissionsAdmin({ orgId }){
  const [missions, setMissions] = useState([]);
  const [editing, setEditing] = useState(null);

  // Single source of truth: always load with orgId
  useEffect(() => {
    if (!orgId) return;

    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/missions?orgId=${encodeURIComponent(orgId)}&ts=${Date.now()}`);
        const data = await res.json();
        const rows = Array.isArray(data.missions) ? data.missions : [];
        // ✅ keep status exactly as the API/DB returned ("Now" | "Scheduled" | "Completed")
        const unique = Array.from(new Map(rows.map(m => [m.id, m])).values());
        if (!cancelled) setMissions(unique);
      } catch (err) {
        console.error("[Admin] load error", err);
      }
    }

    load();

    function onRefetch(){ load(); }
    window.addEventListener("missions:refetch", onRefetch);
    return () => {
      cancelled = true;
      window.removeEventListener("missions:refetch", onRefetch);
    };
  }, [orgId]);

  // Keep a manual reload for post-delete refresh
  const reload = useCallback(async ()=>{
    if (!orgId) return;
    const res = await fetch(`/api/missions?orgId=${encodeURIComponent(orgId)}&ts=${Date.now()}`);
    const js  = await res.json();
    const rows = Array.isArray(js.missions) ? js.missions : [];
    setMissions(rows); // ✅ do not remap status
  }, [orgId]);

  const handleDelete = async (id) => {
  try {
    if (!confirm("Delete this mission?")) return;

    // 1) Optimistically remove from UI
    setMissions(prev => prev.filter(m => String(m.id) !== String(id)));

    // 2) Call API
    const response = await fetch(`/api/missions/${id}`, { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));

    // 3) If server failed, restore and show error
    if (!response.ok) {
      alert(payload.error || "Delete failed");
      // Reload to recover the row back if needed
      await reload();
      return;
    }

    // 4) Confirm success (and also reload to stay in sync)
    // (If your list API is still returning the deleted row, we’ll fix that next.)
    try { window.dispatchEvent(new CustomEvent("missions:refetch")); } catch {}
    await reload();
  } catch (err) {
    console.error("[Admin] DELETE exception", err);
    alert("Delete failed");
    await reload();
  }
};

  return (
    <>
      <div style={{overflowX:"auto"}}>
        <table>
          <thead>
            <tr>
              <Th>ID</Th><Th>Title</Th><Th>Status</Th><Th>Starts</Th><Th>Expires</Th>
              <Th>Budget</Th><Th>Fee</Th><Th>Cost</Th><Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {missions.map(m => (
              <tr key={m.id} style={{borderTop:"1px solid var(--border)"}}>
                <Td mono>{m.id}</Td>
                <Td>{m.title}</Td>
                <Td>{m.status}</Td>
                <Td>{fmtTime(m.startsAt)}</Td>
                <Td>{fmtTime(m.expiresAt)}</Td>
                <Td>{money(m.budget)}</Td>
                <Td>{money(m.fee)}</Td>
                <Td>{money(m.cost)}</Td>
                <Td>
                  <div style={{display:"flex",gap:6}}>
                    <button
                      onClick={()=>setEditing(m)}
                      className="ghost"
                    >Edit</button>
                    <button
                      onClick={()=>handleDelete(m.id)}
                      className="ghost"
                    >Delete</button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditMissionModal
          mission={editing}
          onClose={()=>setEditing(null)}
          onSaved={async ()=>{
            setEditing(null);
            await reload();
          }}
        />
      )}
    </>
  );
}

/* ===================== REPORTS PLACEHOLDER ===================== */
function ReportsStub(){
  return (
    <Card title="Reports">
      <div style={{fontSize:14,opacity:.8}}>Clickable investor-style report viewer coming next.</div>
    </Card>
  );
}
/* ===================== REPORTS TABS ===================== */
function ReportsTab({ orgId }) {
  const [subTab, setSubTab] = useState("dashboard");

  // local TabButton to avoid scope issues
  const RTab = ({active, onClick, children}) => (
    <button
      onClick={onClick}
      style={{
        padding:"8px 10px",
        borderRadius:10,
        border:"1px solid #E5E7EB",
        background: active ? "rgba(11, 87, 208, .08)" : "#fff",
        color: active ? "#0B57D0" : "#111",
        cursor:"pointer"
      }}
    >
      {children}
    </button>
  );

  return (
    <div>
      {/* Top row: Tabs + Org ID chip */}
      <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",gap:8}}>
          <RTab active={subTab==="dashboard"} onClick={()=>setSubTab("dashboard")}>Dashboard</RTab>
          <RTab active={subTab==="reports"}   onClick={()=>setSubTab("reports")}>Reports</RTab>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:12,opacity:.8}}>Org ID</span>
          <span style={{
            fontSize:12, padding:"6px 10px", border:"1px solid #E5E7EB",
            borderRadius:8, background:"#fff"
          }}>{orgId}</span>
        </div>
      </div>

      {/* Hide old dashboard UI; show ONLY the new mockups */}
      {subTab==="dashboard" && (
        <div style={{ marginTop: 8 }}>
          <ReportDashboard />
        </div>
      )}

      {/* Keep existing reports list tab untouched */}
      {subTab==="reports" && <ReportsList orgId={orgId} />}
    </div>
  );
}

/* ===================== REPORTS DASHBOARD (dummy KPIs from reports) ===================== */
function ReportsDashboard({ orgId }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    try{
      setBusy(true); setErr("");
      const res = await fetch(`/api/reports?orgId=${encodeURIComponent(orgId)}&limit=100`);
      const js = await res.json();
      if (!res.ok) throw new Error(js.error || "Failed to load");
      setRows(js.reports || []);
    }catch(e){
      setErr(String(e?.message || e));
    }finally{ setBusy(false); }
  };
  useEffect(() => {
  (async () => {
    try {
      if (orgId) return; // already set
      const r = await fetch("/api/orgs/latest");
      const j = await r.json();
      if (r.ok && j?.org?.id) setOrgId(j.org.id);
    } catch {}
  })();
 }, [orgId]);

  // DUMMY KPI MATH (for demo): derive fake scores from number of reports
  const total = rows.length;
  const foodandbeverageQuality = total ? Math.min(99, 75 + Math.round(total % 20)) : 0;
  const serviceQuality = total ? Math.min(95, 70 + Math.round((total*3) % 25)) : 0;
  const overallExperience = total ? Math.min(97, 72 + Math.round((total*5) % 20)) : 0;

  return (
    <div>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12}}>
        <label style={{fontSize:12,opacity:.8}}>Org ID</label>
        <input value={orgId} onChange={e=>setOrgId(e.target.value)} style={{...inputStyle,width:380}} />
        <button onClick={load} disabled={busy} style={buttonGhost}>{busy?"Loading…":"Refresh"}</button>
        {err && <span style={{color:"#b00", marginLeft:8}}>{err}</span>}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:16,marginBottom:16}}>
        <Card title="Overall Experience %"><KPI value={`${overallExperience}%`} sub="From recent reports"/></Card>
        <Card title="Service Quality Rating"><KPI value={`${serviceQuality}%`} sub="Recent average"/></Card>
        <Card title="Food and Beverage Quality"><KPI value={`${foodandbeverageQuality}%`} sub="Reports generated within window"/></Card>
        <Card title="Reports (total)"><KPI value={total} sub="Generated"/></Card>
      </div>

      <Card title="Recent Reports (sample)">
        <Table
          columns={["Title","Mission","Generated","Open"]}
          rows={rows.slice(0,8).map(r=>[
            r.title || "Mission Report",
            r.mission_id,
            fmtTime(r.generated_at),
            "Open"
          ])}
          onRowClick={(idx)=>{
            const r = rows[idx];
            if (r?.pdf_url) window.open(r.pdf_url, "_blank", "noopener,noreferrer");
          }}
        />
      </Card>
    </div>
  );
}
/* ===================== REPORTS LIST (Client-facing) ===================== */
function ReportsList({ orgId }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      setBusy(true); setError(null);
      try {
        const sp = new URLSearchParams({ orgId, limit: "20" });
        const res = await fetch(`/api/reports?${sp.toString()}`);
        const js = await res.json();
        if (!res.ok) throw new Error(js.error || "Failed to load");
        setRows(js.reports || []);
      } catch (e) {
        setError(String(e?.message || e));
      } finally {
        setBusy(false);
      }
    })();
  }, [orgId]);

  return (
    <div style={{ overflowX: "auto" }}>
      {error && <div style={{ color: "#b00", marginBottom: 8 }}>{error}</div>}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr>
            <Th>Title</Th>
            <Th>Mission</Th>
            <Th>Generated</Th>
            <Th>Open</Th>
          </tr>
        </thead>
        <tbody>
          {busy && (
            <tr>
              <td colSpan={4} style={{ padding: 12, opacity: 0.7 }}>Loading…</td>
            </tr>
          )}

          {!busy && rows.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: 12, opacity: 0.7 }}>No reports yet</td>
            </tr>
          )}

          {!busy && rows.length > 0 && rows.map((r) => (
            <tr key={r.id} style={{ borderTop: "1px solid #f0f0f0" }}>
              <Td>{r.title || "Mission Report"}</Td>
              <Td mono>{r.mission_id}</Td>
              <Td>{fmtTime(r.generated_at)}</Td>
               <Td>
                 <button
                   className="primary"
                   style={buttonPrimary}
                   onClick={async () => {
                     try {
                       const missionId = r?.mission_id || r?.meta?.mission_id || r?.meta?.missionId || null;
                       const submissionId =
                         r?.submission_id ||
                         r?.meta?.submission_id ||
                         r?.meta?.submissionId ||
                         r?.meta?.submission?.id ||
                         null;
                       const agentId =
                         r?.meta?.agent_id ||
                         r?.meta?.agentId ||
                         r?.meta?.agentID ||
                         r?.agent_id ||
                         null;

                       if (!orgId || !missionId) {
                         alert("Missing orgId or missionId to generate report.");
                         return;
                       }

                       if (!submissionId) {
                         alert("Missing submissionId for this report.");
                         return;
                       }

                       const resp = await fetch("/api/reports/auto", {
                         method: "POST",
                         headers: { "Content-Type": "application/json" },
                         cache: "no-store",
                         body: JSON.stringify(
                           agentId
                             ? { orgId, missionId, submissionId, agentId }
                             : { orgId, missionId, submissionId }
                         ),
                       });
                       const js = await resp.json().catch(() => ({}));
                       if (!resp.ok || js?.error) {
                         alert(js?.error || "Failed to generate");
                         return;
                       }

                       const url = js?.pdf_url || r.pdf_url;
                       if (!url) {
                         alert("No PDF URL returned yet.");
                         return;
                       }
                       window.open(url, "_blank", "noopener,noreferrer");
                     } catch (e) {
                       alert(e?.message || "Generate failed");
                     }
                   }}
                  >
                   Open PDF
                  </button>
               </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ===================== MODAL ===================== */
function Modal({ title, children, onClose }){
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,.35)",
      display:"grid", placeItems:"center", zIndex:1000, padding:12
    }}>
      <div style={{
        width:"min(880px, 96vw)",
        maxHeight:"90vh",
        background:"#fff",
        borderRadius:12,
        border:"1px solid #eee",
        boxShadow:"0 12px 36px rgba(0,0,0,.25)",
        display:"flex",
        flexDirection:"column",
        overflow:"hidden"
      }}>
        <div style={{
          flex:"0 0 auto",
          display:"flex", justifyContent:"space-between", alignItems:"center",
          padding:"12px 14px", borderBottom:"1px solid #f0f0f0"
        }}>
          <div style={{fontWeight:600}}>{title}</div>
          <button onClick={onClose} style={{border:"none", background:"transparent", fontSize:18, cursor:"pointer"}}>&times;</button>
        </div>
        <div style={{
          flex:"1 1 auto",
          overflowY:"auto",
          padding:14
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function MapPicker({ initial, onSave, onCancel }){
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
    if (!token) {
      console.warn("Missing NEXT_PUBLIC_MAPBOX_TOKEN");
      return;
    }
    // lazy import CSS if not included globally
    try { require("mapbox-gl/dist/mapbox-gl.css"); } catch {}

    // Decide starting center: initial → browser geolocation → Cairo
    const fallbackCairo = { lng: 31.2357, lat: 30.0444 };
    const useMap = ({lng,lat}) => {
      const mapboxgl = require("mapbox-gl");
      mapboxgl.accessToken = token;

      const center = [lng, lat];
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center,
        zoom: 14
      });
      mapRef.current = map;

      const marker = new mapboxgl.Marker({ draggable: true }).setLngLat(center).addTo(map);
      markerRef.current = marker;

      // Force resize after modal paints
      const t = setTimeout(() => map.resize(), 0);
      return () => { clearTimeout(t); try { map.remove(); } catch {} };
    };

    if (hasValidPoint(initial?.lat, initial?.lng)) {
      return useMap({ lng:Number(initial.lng), lat:Number(initial.lat) });
    }

    if (navigator?.geolocation) {
      let cleanup = () => {};
      navigator.geolocation.getCurrentPosition(
        (pos)=> { cleanup = useMap({ lng: pos.coords.longitude, lat: pos.coords.latitude }); },
        ()=> { cleanup = useMap(fallbackCairo); },
        { enableHighAccuracy:true, timeout:5000 }
      );
      return () => cleanup();
    }

    return useMap(fallbackCairo);
  }, [initial?.lat, initial?.lng]);

  const handleSave = () => {
    if (!markerRef.current) return onCancel?.();
    const { lat, lng } = markerRef.current.getLngLat();
    onSave?.({ lat, lng });
  };

  return (
    <Modal title="Pick Location" onClose={onCancel}>
      <div ref={containerRef} style={{height:"60vh", minHeight:360, borderRadius:10, overflow:"hidden", background:"#f3f3f3"}} />
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:10}}>
        <button onClick={onCancel} className="ghost">Cancel</button>
        <button onClick={handleSave} className="primary">Save Pin</button>
      </div>
    </Modal>
  );
}

function AddressFields({ value, onChange, onGeocode, onPickOnMap }) {
  const v = value || {};
  const set = (k) => (e) => onChange?.({ ...v, [k]: e.target.value });

  return (
    <div style={{display:"grid", gap:8}}>
      <Field label="Address line 1">
        <input value={v.line1||""} onChange={set("line1")} style={inputStyle} placeholder="Street & number"/>
      </Field>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
        <Field label="City"><input value={v.city||""} onChange={set("city")} style={inputStyle}/></Field>
        <Field label="Region/State"><input value={v.region||""} onChange={set("region")} style={inputStyle}/></Field>
      </div>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8}}>
        <Field label="Postal Code"><input value={v.postalCode||""} onChange={set("postalCode")} style={inputStyle}/></Field>
        <Field label="Country (ISO or name)"><input value={v.country||""} onChange={set("country")} style={inputStyle} placeholder="e.g., EG"/></Field>
      </div>
      <div style={{display:"flex", gap:8}}>
        <button onClick={onGeocode} className="primary">Set Pin from Address</button>
        <button onClick={onPickOnMap} className="ghost">Pick on Map</button>
      </div>
    </div>
  );
}
function EditMissionModal({ mission, onClose, onSaved }){
  const [form,setForm] = useState(() => ({
    id: mission.id,
    title: mission.title,
    store: mission.store,
    status: mission.status || "Scheduled",
    startsAt: mission.startsAt,
    expiresAt: mission.expiresAt,
    address: mission.location?.address || "",
    location: {
      lat: mission.location?.lat ?? null,
      lng: mission.location?.lng ?? null,
      address: mission.location?.address || ""
    },
    checklist: mission.checklist || [], // replaced by GET below
    budget: mission.budget || 0,
    fee: mission.fee || 0,
    requiresVideo: !!mission.requiresVideo,
    requiresPhotos: !!mission.requiresPhotos,
    timeOnSiteMin: mission.timeOnSiteMin ?? 10
  }));

  // NEW: visibility into checklist fetch
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [checklistErr, setChecklistErr] = useState("");

  // Load latest checklist snapshot from API (authoritative)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingChecklist(true);
      setChecklistErr("");
      try {
        const url = `/api/missions/${encodeURIComponent(mission.id)}/checklist`;
        const r = await fetch(url, { cache: "no-store" });
        const raw = await r.text();
        let j;
        try { j = JSON.parse(raw); }
        catch { throw new Error(`Non-JSON from ${url}: ${raw.slice(0,80)}…`); }

        if (!r.ok) throw new Error(j.error || "Failed to load checklist");
        const items = Array.isArray(j.items) ? j.items : [];
        if (!cancelled) {
          setForm(f => ({ ...f, checklist: items }));
        }
      } catch (e) {
        if (!cancelled) setChecklistErr(String(e?.message || e));
        console.warn("[EditMissionModal] checklist load:", e?.message || e);
      } finally {
        if (!cancelled) setLoadingChecklist(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mission.id]);

  const [addr, setAddr] = useState({ line1:"", city:"", region:"", postalCode:"", country:"" });
  const [showPicker, setShowPicker] = useState(false);

  const setPinFromAddress = async ()=>{
    const res=await fetch("/api/geocode",{
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({
        addressParts: addr,
        proximity: form.location?.lat && form.location?.lng ? { lat: form.location.lat, lng: form.location.lng } : undefined
      })
    });
    const js=await res.json().catch(()=>({}));
    if(res.ok) setForm(f=>({...f, location:{...f.location, lat: js.lat, lng: js.lng}, address: js.formatted || f.address }));
    else alert(js.error||"Could not set pin");
  };

  const save = async () => {
    // 1) Save mission fields
    const res = await fetch(`/api/missions/${encodeURIComponent(form.id)}`, {
      method:"PUT",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({
        title: form.title,
        store: form.store,
        status: form.status,
        startsAt: form.startsAt,
        expiresAt: form.expiresAt,
        budget: form.budget,
        fee: form.fee,
        requiresVideo: !!form.requiresVideo,
        requiresPhotos: !!form.requiresPhotos,
        timeOnSiteMin: form.timeOnSiteMin,
        location: {
          address: form.address || form.location?.address || "",
          lat: form.location?.lat ?? null,
          lng: form.location?.lng ?? null,
          radiusM: Number.isFinite(Number(form.location?.radiusM)) ? Number(form.location.radiusM) : 150,
        }
      })
    });
    const js = await res.json().catch(()=>({}));
    if (!res.ok) { alert(js.error || "Save failed"); return; }

    // 2) Persist checklist if we have items
    try {
      if (Array.isArray(form.checklist)) {
        await saveChecklist(form.id, form.checklist);
      }
    } catch (e) {
      alert(e?.message || "Checklist save failed");
      return;
    }
    onSaved?.(js.mission || null);
  };

  return (
    <Modal title={`Edit Mission ${form.id}`} onClose={onClose}>
      <Field label="Title">
        <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/>
      </Field>

      <Field label="Store">
        <input value={form.store} onChange={e=>setForm({...form,store:e.target.value})}/>
      </Field>

      {/* Status selector */}
      <Field label="Status">
        <select
          value={form.status}
          onChange={e=>{
            const v = e.target.value;
            if (v === "Now") {
              const now = Date.now();
              setForm(f => ({ ...f, status: "Now", startsAt: now }));
            } else {
              setForm(f => ({ ...f, status: "Scheduled" }));
            }
          }}
        >
          <option>Now</option>
          <option>Scheduled</option>
        </select>
      </Field>

      <Field label="Mission Start">
        <input
          type="datetime-local"
          value={toLocalInput(form.startsAt)}
          onChange={e=>{
            const ts = new Date(e.target.value).getTime();
            setForm(f => ({ ...f, startsAt: ts }));
          }}
        />
      </Field>

      <Field label="Expiry">
        <input
          type="datetime-local"
          value={toLocalInput(form.expiresAt)}
          onChange={e=>{
            const ts = new Date(e.target.value).getTime();
            setForm(f => ({ ...f, expiresAt: ts }));
          }}
        />
      </Field>

      <Field label="Address">
        <AddressFields
          value={addr}
          onChange={setAddr}
          onGeocode={setPinFromAddress}
          onPickOnMap={()=>setShowPicker(true)}
        />
      </Field>

      {Number.isFinite(form.location?.lat)&&Number.isFinite(form.location?.lng) && (
        <img
          alt="Map"
          src={`/api/staticmap?lat=${form.location.lat}&lng=${form.location.lng}&w=640&h=220`}
          style={{marginTop:10,width:"100%",maxWidth:640,borderRadius:10,border:"1px solid var(--border)",pointerEvents:"none"}}
        />
      )}

      <Field label="Checklist">
        <div style={{fontSize:12,opacity:.7,marginBottom:6}}>
          {loadingChecklist
            ? "Loading checklist…"
            : checklistErr
              ? `Error: ${checklistErr}`
              : `Loaded ${Array.isArray(form.checklist) ? form.checklist.length : 0} items`}
        </div>
        <ChecklistEditor
          value={Array.isArray(form.checklist) ? form.checklist : []}
          onChange={list=>setForm({...form,checklist:list})}
        />
      </Field>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        <Field label="Budget">
          <input type="number" value={form.budget} onChange={e=>setForm({...form,budget:Number(e.target.value)})}/>
        </Field>
        <Field label="Fee">
          <input type="number" value={form.fee} onChange={e=>setForm({...form,fee:Number(e.target.value)})}/>
        </Field>
        <Field label="Mission Cost">
          <input value={(form.budget+form.fee).toFixed(0)} readOnly/>
        </Field>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:8}}>
        <Field label="Requires Video?">
          <input type="checkbox" checked={!!form.requiresVideo} onChange={e=>setForm({...form,requiresVideo:e.target.checked})}/>
        </Field>
        <Field label="Requires Photos?">
          <input type="checkbox" checked={!!form.requiresPhotos} onChange={e=>setForm({...form,requiresPhotos:e.target.checked})}/>
        </Field>
        <Field label="Min Time on Site (min)">
          <input type="number" min={0} value={form.timeOnSiteMin} onChange={e=>setForm({...form,timeOnSiteMin:Number(e.target.value)})}/>
        </Field>
      </div>

      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:12}}>
        <button onClick={onClose} className="ghost">Cancel</button>
        <button onClick={save} className="primary">Save Changes</button>
      </div>

      {showPicker && (
        <MapPicker
          initial={{ lat: form.location?.lat, lng: form.location?.lng }}
          onCancel={()=>setShowPicker(false)}
          onSave={async ({lat,lng})=>{
            setForm(f=>({ ...f, location:{...f.location, lat, lng} }));
            setShowPicker(false);
            const rr = await fetch("/api/revgeocode", {
              method: "POST", headers: { "Content-Type":"application/json" },
              body: JSON.stringify({ lat, lng })
            });
            const j = await rr.json().catch(()=>({}));
            if (rr.ok) {
              setAddr(j.addressParts || {});
              setForm(f => ({ ...f, address: j.formatted || f.address }));
            }
          }}
        />
      )}
    </Modal>
  );
}

/* ===================== READ-ONLY MISSION VIEW ===================== */
function ReadOnlyMission({ mission }){
  if (!mission) return null;
  return (
    <div style={{display:"grid",gap:12}}>
      <Field label="ID"><div>{mission.id}</div></Field>
      <Field label="Status"><div>{mission.status}</div></Field>
      <Field label="Title"><div>{mission.title}</div></Field>
      <Field label="Store"><div>{mission.store}</div></Field>
      <Field label="Starts"><div>{fmtTime(mission.startsAt)}</div></Field>
      <Field label="Expires"><div>{fmtTime(mission.expiresAt)}</div></Field>
      <Field label="Location"><div>{mission.location?.address || "—"}</div></Field>

      {Number.isFinite(mission.location?.lat) && Number.isFinite(mission.location?.lng) && (
        <img
          alt="Map"
          style={{ width:"100%", maxWidth:640, borderRadius:10, border:"1px solid var(--border)", pointerEvents:"none" }}
          src={`/api/staticmap?lat=${mission.location.lat}&lng=${mission.location.lng}&w=640&h=220`}
        />
      )}

      <Field label="Budget"><div>{money(mission.budget)}</div></Field>
      <Field label="Fee"><div>{money(mission.fee)}</div></Field>
      <Field label="Mission Cost"><div>{money(mission.cost)}</div></Field>

      <Field label="Checklist">
        <ChecklistReadOnly items={mission.checklist}/>
      </Field>
    </div>
  );
}

function ChecklistReadOnly({ items = [] }){
  if (!items.length) return <em style={{opacity:.7}}>No checklist</em>;
  return (
    <div style={{display:"grid",gap:8}}>
      {items.map((it,i)=>(
        <div key={i} style={{border:"1px solid #eee",borderRadius:10,padding:"8px 10px",background:"#fafafa"}}>
          <div style={{fontWeight:600}}>{it.text}</div>
          <div style={{fontSize:12,opacity:.85,display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
            {it.yesNo && <Tag>Yes/No</Tag>}
            {it.requires?.photo && <Tag>Photo</Tag>}
            {it.requires?.video && <Tag>Video</Tag>}
            {it.requires?.comment && <Tag>Comment</Tag>}
            {it.requires?.timer && <Tag>Timer</Tag>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Tag({children}) {
  return (
    <span style={{
      border:"1px solid var(--border)",
      borderRadius:999,
      padding:"2px 8px",
      background:"#fff"
    }}>{children}</span>
  );
}

/* ===================== Completed Missions INBOX ===================== */
function CompletedMissionsInbox({ orgId }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const reload = async () => {
    if (!orgId) return;
    setBusy(true); setError(null);
    try {
      const url = `/api/completed?orgId=${encodeURIComponent(orgId)}&limit=50`;
      const res = await fetch(url);
      const text = await res.text();
      let js;
      try { js = JSON.parse(text); } catch { throw new Error(`Non-JSON from ${url}: ${text.slice(0,80)}…`); }
      if (!res.ok) throw new Error(js.error || "Failed to load");
      setRows(js.items || js.completed || js.rows || []);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { reload(); }, [orgId]);

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <button onClick={reload} disabled={busy} style={buttonGhost}>
          {busy ? "Loading…" : "Refresh"}
        </button>
      </div>
      {error && <div style={{color:"#b00", marginBottom:8}}>{error}</div>}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}>
          <thead>
            <tr><Th>Submission</Th><Th>Mission</Th><Th>Agent</Th><Th>When</Th><Th>Status</Th></tr>
          </thead>
          <tbody>
            {busy && <tr><td colSpan={5} style={{padding:12,opacity:.7}}>Loading…</td></tr>}
            {!busy && rows.length===0 && <tr><td colSpan={5} style={{padding:12,opacity:.7}}>No completed missions yet</td></tr>}
            {rows.map(r=>{
              const missionTitle = r.mission_title || r.mission_name || r.title || r.mission_id || "—";
              const showIdMeta = !!r.mission_id && missionTitle !== r.mission_id;
              return (
                <tr key={r.id} style={{borderTop:"1px solid #f0f0f0"}}>
                  <Td mono>{r.id}</Td>
                  <Td>
                    <div>{missionTitle}</div>
                    {showIdMeta && (
                      <div style={{fontSize:11,opacity:.65,marginTop:2}}>{r.mission_id}</div>
                    )}
                  </Td>
                  <Td>{r.agent_name || r.agent_id || "—"}</Td>
                  <Td>{fmtTime(r.submitted_at)}</Td>
                  <Td>{r.status || "Submitted"}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===================== SHARED UI HELPERS ===================== */
function Card({ title, right, children }){
  return (
    <div className="card" style={{marginBottom:16}}>
      {(title || right) && (
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontWeight:700}}>{title}</div>
          <div>{right}</div>
        </div>
      )}
      {children}
    </div>
  );
}
function KPI({ value, sub }){
  return (
    <div>
      <div style={{fontSize:28,fontWeight:700,lineHeight:1}}>{value}</div>
      <div style={{fontSize:12,opacity:.7,marginTop:6}}>{sub}</div>
    </div>
  );
}
function Table({columns, rows, onRowClick}) {
  return (
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}>
        <thead><tr>{columns.map(c => <Th key={c}>{c}</Th>)}</tr></thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><Td colSpan={columns.length}><em style={{opacity:.7}}>No items</em></Td></tr>
          ) : rows.map((r, i) => (
            <tr key={i} style={{borderTop:"1px solid #f0f0f0", cursor:onRowClick?"pointer":"default"}} onClick={()=>onRowClick?.(i)}>
              {r.map((cell, j) => <Td key={j} mono={j===0}>{cell}</Td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Th({children}){ return <th style={{textAlign:"left",fontSize:12,letterSpacing:.2,opacity:.7,padding:"8px 10px"}}>{children}</th>; }
function Td({children, mono}){ return <td style={{padding:"10px",fontFeatureSettings: mono? "'tnum' on, 'lnum' on" : "normal"}}>{children}</td>; }
function fmtTime(ts){ try { return new Date(ts).toLocaleString(); } catch { return "—"; } }
function toLocalInput(ts){
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2,"0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth()+1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}
const inputStyle = {
  width:"100%",
  padding:"8px 10px",
  border:"1px solid var(--border)",
  borderRadius:"var(--radius)",
  background:"#fff",
  outline:"none",
};
const buttonBase = {
  padding:"8px 12px",
  borderRadius:"var(--radius)",
  border:"1px solid var(--border)",
  cursor:"pointer",
  fontWeight:600,
};
const buttonPrimary = {
  ...buttonBase,
  background:"var(--brand)",
  color:"#fff",
  border:"1px solid var(--brand)",
};
const buttonPrimaryHover = { background:"var(--brand-600)", border:"1px solid var(--brand-600)" };
const buttonGhost = {
  ...buttonBase,
  background:"#fff",
  color:"var(--text)",
};
const buttonGhostHover = { background:"var(--brand-50)", border:"1px solid var(--brand-50)", color:"var(--brand)" };

function Field({label, children}) {
  return (
    <div style={{marginBottom:10, position:"relative", zIndex:1}}>
      <div className="field-label">{label}</div>
      {children}
    </div>
  );
}
function money(v){ if (v==null || isNaN(v)) return "—"; return `${Number(v).toFixed(0)}`; }
