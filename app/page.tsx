"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import Image from "next/image";
import {
  ArrowDown, ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronDown,
  CircleHelp, Clock3, Compass, FileSearch, GraduationCap, Image as ImageIcon, MapPin,
  Menu, Plus, Search, ShieldCheck, Sparkles, X,
} from "lucide-react";
import {
  createReportId, loadReports, saveReports,
  type Category, type Report, type ReportStatus, type ReportType,
} from "@/lib/reports";
import { processItemImage } from "@/lib/image-processing";

type FilterType = "all" | ReportType | "open";
type FormErrors = Partial<Record<"itemName" | "category" | "description" | "location" | "contact", string>>;

const categories: Category[] = ["Electronics", "ID Cards", "Bags", "Books", "Keys", "Clothing", "Other"];
const emptyForm = {
  type: "lost" as ReportType,
  itemName: "",
  category: "" as Category | "",
  description: "",
  location: "",
  contact: "",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function getContactHref(contact: string) {
  const value = contact.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`;
  if (/^\+?[\d\s().-]{7,}$/.test(value) && (value.match(/\d/g)?.length ?? 0) >= 7) {
    return `tel:${value.replace(/[^\d+]/g, "")}`;
  }
  return null;
}

export default function Home() {
  const [reports, setReports] = useState<Report[]>([]);
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [imageData, setImageData] = useState<string | null>(null);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [imageError, setImageError] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [toast, setToast] = useState("");
  const [storageWarning, setStorageWarning] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const loaded = loadReports();
      setReports(loaded.reports);
      setStorageWarning(loaded.issue);
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!modalOpen && !selectedReport) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setModalOpen(false);
        setSelectedReport(null);
        setErrors({});
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalOpen, selectedReport]);

  const stats = useMemo(() => ({
    total: reports.length,
    open: reports.filter((report) => report.status === "open").length,
    lost: reports.filter((report) => report.type === "lost").length,
    found: reports.filter((report) => report.type === "found").length,
  }), [reports]);

  const visibleReports = useMemo(() => {
    const term = query.trim().toLowerCase();
    return reports
      .filter((report) => filter === "all" || (filter === "open" ? report.status === "open" : report.type === filter))
      .filter((report) => !term || [report.itemName, report.description, report.category, report.location].some((value) => value.toLowerCase().includes(term)))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [filter, query, reports]);

  function persist(next: Report[]) {
    const saved = saveReports(next);
    if (saved) {
      setReports(next);
      setStorageWarning(false);
    } else {
      setStorageWarning(true);
      setToast("Your browser could not save this change. Check available storage and try again.");
    }
    return saved;
  }

  function openForm(type: ReportType) {
    setForm({ ...emptyForm, type });
    setImageData(null);
    setImageError("");
    setErrors({});
    if (photoInputRef.current) photoInputRef.current.value = "";
    setModalOpen(true);
  }

  function closeForm() {
    setModalOpen(false);
    setErrors({});
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImageError("");
    setImageData(null);
    setImageProcessing(true);
    try {
      setImageData(await processItemImage(file));
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "This image could not be processed. Try a different file.");
    } finally {
      setImageProcessing(false);
    }
  }

  function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FormErrors = {};
    if (!form.itemName.trim()) nextErrors.itemName = "Add an item name.";
    if (!form.category) nextErrors.category = "Choose a category.";
    if (!form.description.trim()) nextErrors.description = "Add a short description.";
    if (!form.location.trim()) nextErrors.location = "Add a campus location.";
    if (!form.contact.trim()) nextErrors.contact = "Add a way for students to reach you.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (imageProcessing) {
      setImageError("Wait for the photo to finish processing before posting.");
      return;
    }

    const report: Report = {
      id: createReportId(), type: form.type, itemName: form.itemName.trim(),
      category: form.category as Category, description: form.description.trim(),
      location: form.location.trim(), contact: form.contact.trim(), status: "open",
      createdAt: new Date().toISOString(),
      ...(imageData ? { image: imageData } : {}),
    };
    let saved = persist([report, ...reports]);
    let photoOmitted = false;
    if (!saved && imageData) {
      const reportWithoutImage = { ...report };
      delete reportWithoutImage.image;
      saved = persist([reportWithoutImage, ...reports]);
      photoOmitted = saved;
    }
    if (!saved) return;
    closeForm();
    setFilter("all");
    setQuery("");
    setImageData(null);
    setToast(photoOmitted
      ? "Your report was saved, but its photo could not fit in browser storage."
      : "Your report is live. Thanks for helping the campus community!");
  }

  function markReturned(id: string) {
    const next = reports.map((report) => report.id === id ? { ...report, status: "returned" as ReportStatus } : report);
    const saved = persist(next);
    if (saved) setSelectedReport((current) => current?.id === id ? { ...current, status: "returned" } : current);
    if (saved) setToast("Marked as returned. Thanks for closing the loop!");
  }

  return (
    <main>
      <header className="site-header">
        <a href="#home" className="brand" aria-label="FindIt home">
          <span className="brand-mark"><Search size={19} strokeWidth={2.7} /></span>
          <span>find<span className="brand-accent">it</span></span>
        </a>
        <nav className={`nav-links ${menuOpen ? "nav-open" : ""}`} id="main-navigation" aria-label="Main navigation">
          <a href="#reports" onClick={() => setMenuOpen(false)}>Browse reports</a>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
        </nav>
        <div className="header-actions">
          <button className="button button-small button-dark" onClick={() => openForm("lost")}><Plus size={16} /> Post a report</button>
          <button className="menu-toggle" aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={19} /> : <Menu size={19} />}</button>
        </div>
      </header>

      <section className="hero" id="home">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="eyebrow hero-eyebrow"><span className="live-dot" /> YOUR CAMPUS, CONNECTED</div>
            <h1>Lost something?<br /><span>Let’s find it.</span></h1>
            <p className="hero-subtitle">A little help from your campus community can go a long way. Find what’s missing or help someone get it back.</p>
            <div className="hero-actions">
              <button className="button button-cyan" onClick={() => openForm("lost")}>I lost something <ArrowRight size={17} /></button>
              <button className="button button-outline-light" onClick={() => openForm("found")}>I found something <Plus size={17} /></button>
            </div>
            <div className="hero-proof"><span className="proof-avatars"><i>J</i><i>M</i><i>A</i><i><GraduationCap size={13} /></i></span><span>Made for campus. Powered by community.</span></div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
            <div className="art-glow" />
            <div className="finder-card">
              <div className="finder-top"><span className="finder-icon"><Search size={21} /></span><span className="finder-live"><span /> LIVE ON CAMPUS</span></div>
              <div className="finder-title">Good things find<br />their way back.</div>
              <div className="finder-map">
                <div className="map-road road-a" /><div className="map-road road-b" /><div className="map-road road-c" />
                <span className="map-building building-a" /><span className="map-building building-b" /><span className="map-building building-c" />
                <span className="map-pin pin-a"><MapPin size={16} fill="currentColor" /></span><span className="map-pin pin-b"><MapPin size={16} fill="currentColor" /></span>
                <span className="map-label">Campus library</span>
              </div>
              <div className="finder-foot"><span><span className="foot-pulse" /> Your campus is looking out</span><ArrowUpRight size={16} /></div>
            </div>
            <div className="floating-note"><span className="note-check"><Check size={15} /></span><span><b>One less thing to worry about</b><small>Good things happen here.</small></span></div>
            <div className="art-spark spark-a"><Sparkles size={19} /></div><div className="art-spark spark-b"><Sparkles size={13} /></div>
          </div>
        </div>
        <div className="hero-bottom"><span>ONE CAMPUS. ONE COMMUNITY.</span><span>THE RIGHT THING, RIGHT HERE <ArrowDown size={13} /></span></div>
      </section>

      <section className="stats-wrap" aria-label="Report statistics">
        <div className="stat-card"><span className="stat-icon icon-blue"><FileSearch size={18} /></span><span className="stat-label">TOTAL REPORTS</span><strong>{ready ? stats.total : "—"}</strong><small>Shared with the community</small></div>
        <div className="stat-card"><span className="stat-icon icon-mint"><Clock3 size={18} /></span><span className="stat-label">OPEN REPORTS</span><strong>{ready ? stats.open : "—"}</strong><small>Still looking for their owner</small></div>
        <div className="stat-card"><span className="stat-icon icon-amber"><Search size={18} /></span><span className="stat-label">ITEMS LOST</span><strong>{ready ? stats.lost : "—"}</strong><small>We’re helping them get found</small></div>
        <div className="stat-card"><span className="stat-icon icon-violet"><CheckCircle2 size={18} /></span><span className="stat-label">ITEMS FOUND</span><strong>{ready ? stats.found : "—"}</strong><small>Waiting to make someone’s day</small></div>
      </section>

      <section className="reports-section" id="reports">
        <div className="section-heading">
          <div><div className="eyebrow"><span className="eyebrow-line" /> THE COMMUNITY BOARD</div><h2>Let’s get it <span>back to you.</span></h2><p>Every report is a chance to turn a stressful day around.</p></div>
          <div className="section-note"><ShieldCheck size={17} /><span>Campus community<br /><b>looking out for each other</b></span></div>
        </div>
        <div className="listing-toolbar">
          <div className="filter-tabs" role="group" aria-label="Filter reports">
            {(["all", "lost", "found", "open"] as FilterType[]).map((item) => <button key={item} aria-pressed={filter === item} className={`filter-tab ${filter === item ? "active" : ""}`} onClick={() => setFilter(item)}>{item === "all" ? "All reports" : item === "open" ? "Open" : item[0].toUpperCase() + item.slice(1)}{item === "all" && <span>{stats.total}</span>}</button>)}
          </div>
          <div className="search-box"><Search size={17} aria-hidden="true" /><input aria-label="Search reports by item, description, category, or location" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search items, places..." />{query && <button type="button" className="search-clear" aria-label="Clear search" onClick={() => setQuery("")}><X size={15} /></button>}</div>
        </div>
        {storageWarning && <div className="storage-warning" role="status"><CircleHelp size={16} /> Some saved reports could not be read, or browser storage is unavailable. New changes may not survive a refresh.</div>}
        {!ready ? <div className="loading-state"><span className="spinner" /> Loading campus reports…</div> : visibleReports.length ? (
          <div className="report-grid">
            {visibleReports.map((report) => <article
              className="report-card"
              key={report.id}
              role="group"
              tabIndex={0}
              aria-label={`${report.itemName} report. Press Enter or Space to view details.`}
              onClick={(event) => {
                if (event.target instanceof Element && event.target.closest("a, button")) return;
                setSelectedReport(report);
              }}
              onKeyDown={(event) => {
                if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  setSelectedReport(report);
                }
              }}
            >
              <div className="report-photo">
                {report.image ? <Image src={report.image} alt={`Photo of ${report.itemName}`} width={1000} height={700} unoptimized /> : <div className="photo-placeholder" aria-label="No photo uploaded"><ImageIcon size={20} /><span>No photo</span></div>}
              </div>
              <div className="report-card-top"><span className={`report-type ${report.type}`}><span />{report.type === "lost" ? "Lost item" : "Found item"}</span><span className={`status ${report.status}`}>{report.status === "open" ? <><span className="status-dot" /> Open</> : <><CheckCircle2 size={13} /> Returned</>}</span></div>
              <div className="report-category">{report.category}</div><h3>{report.itemName}</h3><p className="report-description">{report.description}</p>
              <div className="report-meta"><span><MapPin size={15} />{report.location}</span><span><Clock3 size={15} />{formatDate(report.createdAt)}</span></div>
              <div className="report-card-bottom">
                <div className="contact-details"><span>CONTACT</span>{getContactHref(report.contact) ? <a href={getContactHref(report.contact)!} onClick={(event) => event.stopPropagation()}>{report.contact}</a> : <span className="contact-plain">{report.contact}</span>}</div>
                <div className="report-card-actions"><button type="button" className="view-details-button" onClick={() => setSelectedReport(report)}>View details <ArrowUpRight size={14} /></button>{report.status === "open" && <button className="returned-button" onClick={() => markReturned(report.id)} aria-label={`Mark ${report.itemName} as returned`}><Check size={15} /> Returned</button>}</div>
              </div>
            </article>)}
          </div>
        ) : <div className="empty-state"><div className="empty-icon"><Compass size={24} /></div><h3>{query || filter !== "all" ? "No reports match just yet" : "It’s quiet around here. That’s a good thing."}</h3><p>{query || filter !== "all" ? "Try another search or filter to see more campus reports." : "When someone shares a lost or found item, you’ll see it here. Be the first to help out."}</p>{!query && filter === "all" && <button className="button button-primary" onClick={() => openForm("found")}><Plus size={16} /> Share a found item</button>}</div>}
        {visibleReports.length > 0 && <div className="results-footer"><span>Showing <b>{visibleReports.length}</b> {visibleReports.length === 1 ? "report" : "reports"}</span><span>Every little bit helps <Sparkles size={14} /></span></div>}
      </section>

      <section className="how-section" id="how-it-works"><div className="how-inner"><div className="eyebrow"><span className="eyebrow-line" /> SIMPLE BY DESIGN</div><h2>A little effort.<br /><span>A lot of good.</span></h2><div className="steps"><div className="step"><span>01</span><h3>Share the details</h3><p>Tell the campus what you lost or found and where it happened.</p></div><div className="step"><span>02</span><h3>Make the connection</h3><p>Search reports and contact the person who posted an item.</p></div><div className="step"><span>03</span><h3>Close the loop</h3><p>Got it back? Mark it returned and make someone’s day.</p></div></div></div><div className="how-decoration" aria-hidden="true"><div /><span><MapPin size={28} /></span></div></section>

      <footer className="site-footer"><a href="#home" className="brand footer-brand"><span className="brand-mark"><Search size={17} strokeWidth={2.7} /></span><span>find<span className="brand-accent">it</span></span></a><span>Made for campus life, by campus life.</span><a href="#home">Back to top <ArrowUpRight size={14} /></a><small>© 2026 FindIt · A campus community project</small></footer>

      {toast && <div className="toast" role="status" aria-live="polite"><CheckCircle2 size={18} />{toast}<button aria-label="Dismiss notification" onClick={() => setToast("")}><X size={16} /></button></div>}

      {modalOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}>
        <section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-header"><div><div className="eyebrow"><span className="eyebrow-line" /> THE MORE WE KNOW</div><h2 id="modal-title">Post a report</h2><p>Help your campus community help you.</p></div><button className="icon-button" aria-label="Close form" onClick={closeForm}><X size={19} /></button></div>
          <form onSubmit={submitReport} noValidate>
            <fieldset className="type-choice"><legend>What are you reporting?</legend><div className="type-options"><button type="button" className={form.type === "lost" ? "selected" : ""} onClick={() => setForm({ ...form, type: "lost" })}><Search size={16} /> I lost something</button><button type="button" className={form.type === "found" ? "selected found-choice" : ""} onClick={() => setForm({ ...form, type: "found" })}><CheckCircle2 size={16} /> I found something</button></div></fieldset>
            <div className="form-grid"><label className="field full"><span>Item name <b>*</b></span><input autoFocus value={form.itemName} onChange={(event) => setForm({ ...form, itemName: event.target.value })} placeholder="e.g. Blue water bottle" aria-invalid={!!errors.itemName} />{errors.itemName && <small className="field-error">{errors.itemName}</small>}</label>
              <label className="field"><span>Category <b>*</b></span><div className="select-wrap"><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as Category | "" })} aria-invalid={!!errors.category}><option value="" disabled>Select category</option>{categories.map((category) => <option key={category}>{category}</option>)}</select><ChevronDown size={16} /></div>{errors.category && <small className="field-error">{errors.category}</small>}</label>
              <label className="field"><span>Location <b>*</b></span><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="e.g. Student centre" aria-invalid={!!errors.location} />{errors.location && <small className="field-error">{errors.location}</small>}</label>
              <label className="field full"><span>Description <b>*</b></span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Add details that could help someone recognize it..." rows={3} aria-invalid={!!errors.description} />{errors.description && <small className="field-error">{errors.description}</small>}</label>
              <label className="field full"><span>Contact information <b>*</b></span><input value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} placeholder="Email or phone number" aria-invalid={!!errors.contact} />{errors.contact && <small className="field-error">{errors.contact}</small>}<small className="field-hint">Your contact is visible to anyone viewing this report.</small></label>
              <div className="photo-field full">
                <div className="photo-field-heading"><div className="photo-label-row"><strong>Item photo</strong><span className="photo-optional">Optional</span></div><p className="photo-format-note">JPEG, PNG, or WebP · up to 10 MB</p></div>
                <input ref={photoInputRef} hidden id="report-photo" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" aria-label="Choose an optional item photo" aria-describedby={imageError ? "photo-help photo-error" : "photo-help"} aria-invalid={!!imageError} onChange={handlePhotoChange} />
                {imageData ? <div className="photo-preview-row">
                  <Image src={imageData} alt={`Preview of ${form.itemName || "selected item"}`} width={640} height={480} unoptimized />
                  <div className="photo-preview-info"><strong>Photo ready</strong><span>Resized and compressed for local storage.</span><div className="photo-preview-actions"><button type="button" className="photo-action" onClick={() => photoInputRef.current?.click()}>Replace photo</button><button type="button" className="photo-action remove-photo" onClick={() => { setImageData(null); setImageError(""); }}>Remove</button></div></div>
                </div> : <button type="button" className="photo-picker" onClick={() => photoInputRef.current?.click()} disabled={imageProcessing}><span className="photo-picker-icon"><Plus size={17} /></span><span className="photo-picker-copy"><strong>{imageProcessing ? "Preparing photo…" : "Choose a photo"}</strong><small>{imageProcessing ? "Resizing and compressing in your browser" : "Add a clear image to help identify the item"}</small></span></button>}
                <small className="field-hint" id="photo-help">Images are resized on this device before saving. Photos are optional.</small>
                {imageError && <small className="field-error" id="photo-error" role="alert">{imageError}</small>}
              </div>
            </div>
            <div className="modal-actions"><button type="button" className="button button-cancel" onClick={closeForm}>Cancel</button><button type="submit" className="button button-primary" disabled={imageProcessing}>{imageProcessing ? "Preparing photo…" : <>Post report <ArrowRight size={16} /></>}</button></div>
          </form>
        </section>
      </div>}

      {selectedReport && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedReport(null); }}>
        <section className="report-modal details-modal" role="dialog" aria-modal="true" aria-labelledby="details-title" aria-describedby="details-description">
          <div className="modal-header details-header">
            <div>
              <div className="details-badges">
                <span className={`report-type ${selectedReport.type}`}><span />{selectedReport.type === "lost" ? "Lost item" : "Found item"}</span>
                <span className={`status ${selectedReport.status}`}>{selectedReport.status === "open" ? <><span className="status-dot" /> Open</> : <><CheckCircle2 size={13} /> Returned</>}</span>
              </div>
              <h2 id="details-title">{selectedReport.itemName}</h2>
              <p>{selectedReport.category}</p>
            </div>
            <button className="icon-button" aria-label="Close item details" onClick={() => setSelectedReport(null)}><X size={19} /></button>
          </div>
          <div className="details-content">
            <div className="details-photo">
              {selectedReport.image ? <Image src={selectedReport.image} alt={`Photo of ${selectedReport.itemName}`} width={1000} height={700} unoptimized /> : <div className="photo-placeholder" aria-label="No photo uploaded"><ImageIcon size={24} /><span>No photo available</span></div>}
            </div>
            <section className="details-description-block" aria-labelledby="description-label">
              <h3 id="description-label">Description</h3>
              <p id="details-description">{selectedReport.description}</p>
            </section>
            <dl className="detail-facts">
              <div><dt><MapPin size={15} /> Location</dt><dd>{selectedReport.location}</dd></div>
              <div><dt><Clock3 size={15} /> Date reported</dt><dd><time dateTime={selectedReport.createdAt}>{formatDate(selectedReport.createdAt)}</time></dd></div>
              <div><dt><CheckCircle2 size={15} /> Current status</dt><dd>{selectedReport.status === "open" ? "Open · awaiting a match" : "Returned · report closed"}</dd></div>
            </dl>
            <section className="details-contact" aria-labelledby="contact-label">
              <div><h3 id="contact-label">Contact information</h3><p>{selectedReport.contact}</p></div>
              {getContactHref(selectedReport.contact) && <a className="button button-primary contact-button" href={getContactHref(selectedReport.contact)!}>{getContactHref(selectedReport.contact)!.startsWith("mailto:") ? "Email reporter" : "Call reporter"}<ArrowUpRight size={15} /></a>}
            </section>
          </div>
          <div className="modal-actions details-actions">
            <button type="button" className="button button-cancel" onClick={() => setSelectedReport(null)}>Close details</button>
            {selectedReport.status === "open" ? <button type="button" className="button button-primary" onClick={() => markReturned(selectedReport.id)}><Check size={16} /> Mark as returned</button> : <span className="closed-note"><CheckCircle2 size={16} /> This report is closed</span>}
          </div>
        </section>
      </div>}
    </main>
  );
}
