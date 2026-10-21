import { useMemo, useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpRight, BookOpen, CalendarDays, Check, CheckCheck, ChevronRight, FileText, FolderOpen, GraduationCap, Loader2, LockKeyhole, Plus, Search, Upload, X } from "lucide-react";
import { academicQueue, MAX_INTAKE_BYTES, parseAcademicIntake, prepareAcademicTasks, taskIdentity } from "./academicIntake";
import { ownPrivateRecords } from "./academicStore";
import "./academic-workspace.css";

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const formatDay = value => new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function AcademicWorkspace(props) {
  // Unmounting the intake clears its draft when Private Display is enabled.
  if (props.privateMode) return <section className="academic-workspace academic-hidden"><LockKeyhole size={30} /><h2>Academic workspace hidden</h2><p>Turn off Private Display to view your documents and coursework.</p></section>;
  return <AcademicWorkspaceContent {...props} />;
}

function AcademicWorkspaceContent({ tasks: allTasks = [], documents = [], onSaveTasks, onToggleTask, onUploadDocument, onDownloadDocument, uploading, currentUserId }) {
  const tasks = useMemo(() => ownPrivateRecords(allTasks, currentUserId), [allTasks, currentUserId]);
  const [draft, setDraft] = useState("");
  const [sourceName, setSourceName] = useState("Pasted notes");
  const [review, setReview] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingTask, setPendingTask] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const intakeRef = useRef(null);
  const today = localToday();
  const queue = useMemo(() => academicQueue(tasks, today), [tasks, today]);
  const privateDocuments = ownPrivateRecords(documents, currentUserId);
  const duplicateKeys = new Set(tasks.map(taskIdentity));
  const visibleTasks = queue.open.filter(task => (filter !== "overdue" || task.due_date < today) && (!search || `${task.title} ${task.category}`.toLowerCase().includes(search.toLowerCase())));
  const chosenCount = new Set(review?.rows.filter(row => row.selected && !duplicateKeys.has(taskIdentity(row))).map(taskIdentity) || []).size;

  function openIntake() { intakeRef.current?.scrollIntoView({ behavior: "auto", block: "start" }); intakeRef.current?.focus(); }
  function reviewText(text = draft, name = sourceName) {
    setError(""); setMessage("");
    try { setReview(parseAcademicIntake(text, name)); }
    catch (cause) { setError(cause.message); }
  }
  async function readFile(file) {
    if (!file) return;
    setError(""); setMessage(""); setReview(null);
    if (!/\.(ics|txt|md)$/i.test(file.name) || file.size > MAX_INTAKE_BYTES) {
      setError("Choose an .ics, .txt or .md file up to 256 KB. PDFs can be kept in the private library below."); return;
    }
    try { const text = await file.text(); setDraft(text); setSourceName(file.name); reviewText(text, file.name); }
    catch { setError("This file could not be read. Try exporting it again as text or calendar data."); }
  }
  async function saveReview() {
    setBusy(true); setError(""); setMessage("");
    try {
      const rows = prepareAcademicTasks(review.rows, tasks);
      if (!rows.length) { setMessage("These selected actions are already in your plan."); return; }
      const saved = await onSaveTasks(rows);
      if (saved === false) { setError("The actions were not saved. Your review is still here; check your connection and retry."); return; }
      setMessage(saved === 0 ? "These actions are already in your private plan." : `${saved} ${saved === 1 ? "action was" : "actions were"} added to your private plan.`);
      setReview(null); setDraft(""); setSourceName("Pasted notes");
    } catch (cause) { setError(cause.message || "The actions could not be saved."); }
    finally { setBusy(false); }
  }
  async function finishTask(task) {
    setPendingTask(task.id); setError("");
    try { if (await onToggleTask(task) === false) setError("This action could not be updated. Please retry."); }
    catch { setError("This action could not be updated. Please retry."); }
    finally { setPendingTask(null); }
  }

  return <section className="academic-workspace" aria-labelledby="academic-title">
    <header className="academic-hero">
      <div className="academic-hero-copy"><span className="academic-eyebrow"><GraduationCap size={18} /> Iona · Personal workspace</span><h1 id="academic-title">Your semester,<br /><em>in order.</em></h1><p>Bring deadlines out of documents and into a plan you can act on.</p><button type="button" className="academic-primary" onClick={openIntake}><Plus size={18} /> Import coursework <ChevronRight size={18} /></button></div>
      <div className="academic-process" aria-label="Document workflow"><div className="academic-orbit" aria-hidden="true"><svg viewBox="0 0 280 200"><path d="M35 150V60L140 20l105 40v90l-105 35Z" /><path d="m35 60 105 42 105-42M140 102v83M88 40l104 42v87" /><circle cx="140" cy="102" r="8" /><circle cx="35" cy="60" r="4" /><circle cx="245" cy="150" r="4" /></svg><span><FileText size={25} /></span></div><ol><li><b>01</b> Add a source</li><li><b>02</b> Review each deadline</li><li><b>03</b> Build your private plan</li></ol></div>
    </header>

    <div className="academic-stats" aria-label="Academic progress"><div><span>Next 7 days</span><strong>{queue.week.toString().padStart(2, "0")}</strong><small>actions due</small></div><div><span>Needs attention</span><strong className={queue.overdue ? "academic-overdue" : undefined}>{queue.overdue.toString().padStart(2, "0")}</strong><small>past their due date</small></div><div><span>Completed</span><strong>{queue.complete.toString().padStart(2, "0")}</strong><small>actions checked off</small></div></div>

    {error && <p role="alert" className="academic-alert">{error}</p>}
    {message && <p role="status" className="academic-notice"><CheckCheck size={18} />{message}</p>}

    <div className="academic-columns"><div className="academic-main-column">
      <section className="academic-panel" aria-labelledby="academic-plan-title"><div className="academic-section-heading"><div><span className="academic-eyebrow">The next move</span><h2 id="academic-plan-title">Coursework & deadlines</h2></div><span className="academic-count">{queue.open.length} open</span></div>
        <div className="academic-toolbar"><div className="academic-filter" aria-label="Filter coursework"><button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>All open</button><button type="button" aria-pressed={filter === "overdue"} onClick={() => setFilter("overdue")}>Overdue</button></div><label className="academic-search"><Search size={17} /><input aria-label="Search coursework" placeholder="Find an action" value={search} onChange={e => setSearch(e.target.value)} /></label></div>
        {visibleTasks.length ? <ul className="academic-task-list">{visibleTasks.map(task => <li key={task.id}><button type="button" className="academic-complete" disabled={pendingTask !== null} aria-label={`Complete ${task.title}`} onClick={() => finishTask(task)}>{pendingTask === task.id ? <Loader2 className="spin" size={18} /> : <Check size={18} />}</button><div><strong>{task.title}</strong><span>{task.category.slice(8)}</span></div><time className={task.due_date < today ? "academic-overdue" : undefined} dateTime={task.due_date}>{task.due_date ? formatDay(task.due_date) : "No date"}</time></li>)}</ul> : <div className="academic-empty"><BookOpen size={28} /><h3>{queue.open.length ? "No matching actions" : "Give your next deadline a place."}</h3><p>{queue.open.length ? "Try another filter or search term." : "Import a calendar or paste dated notes. You choose what becomes a task."}</p>{!queue.open.length && <button type="button" className="academic-secondary" onClick={openIntake}>Add your first source <ArrowUpRight size={16} /></button>}</div>}
      </section>

      <section className="academic-panel academic-intake" tabIndex={-1} ref={intakeRef} aria-labelledby="academic-intake-title"><div className="academic-section-heading"><div><span className="academic-eyebrow">From source to action</span><h2 id="academic-intake-title">Document intake</h2></div><LockKeyhole size={20} /></div><p className="academic-supporting">Review happens in this browser. Only the actions you save are added to your account.</p>
        {!review ? <><label className="academic-upload"><Upload size={23} /><strong>Choose calendar or text</strong><span>.ics, .txt, .md · up to 256 KB</span><input type="file" accept=".ics,.txt,.md,text/calendar,text/plain,text/markdown" onChange={e => { readFile(e.target.files?.[0]); e.target.value = ""; }} aria-label="Import academic document" /></label><label className="academic-field">Source label<input value={sourceName} maxLength={120} onChange={e => setSourceName(e.target.value)} placeholder="Course syllabus or Outlook export" /></label><label className="academic-field">Or paste dated notes<textarea rows={5} value={draft} maxLength={MAX_INTAKE_BYTES} onChange={e => setDraft(e.target.value)} placeholder={"YYYY-MM-DD | Action to complete\nUse a full date and one action per line."} /></label><div className="academic-intake-footer"><span>PDF or image? Keep it in the library and paste its dated action items here.</span><button type="button" className="academic-primary" disabled={!draft.trim()} onClick={() => reviewText()}>Review actions <ChevronRight size={17} /></button></div></> : <div className="academic-review"><div className="academic-review-heading"><div><strong>{review.source}</strong><span>{review.rows.length} extracted · {review.duplicate_count} repeated rows removed</span></div><button type="button" className="academic-secondary" disabled={busy} onClick={() => setReview(null)}>Back to source</button></div>{review.warnings.length > 0 && <ul className="academic-warnings">{review.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}<p className="academic-supporting">Check the original document, edit any date or title, then select the actions to save. The source label is kept with each task.</p>
          <div className="academic-review-rows">{review.rows.map((row, index) => { const duplicate = duplicateKeys.has(taskIdentity(row)); return <div className="academic-review-row" key={row.id}><label className="academic-select"><input type="checkbox" checked={row.selected && !duplicate} disabled={busy || duplicate} aria-label={`Select action ${index + 1}`} onChange={e => setReview(current => ({ ...current, rows: current.rows.map(item => item.id === row.id ? { ...item, selected: e.target.checked } : item) }))} /><span>{index + 1}</span></label><div><input aria-label={`Action ${index + 1} title`} value={row.title} disabled={busy} maxLength={180} onChange={e => setReview(current => ({ ...current, rows: current.rows.map(item => item.id === row.id ? { ...item, title: e.target.value } : item) }))} /><span>{row.source_line}{duplicate ? " · Already in your plan" : " · Check against source"}</span></div><input aria-label={`Action ${index + 1} due date`} type="date" disabled={busy} value={row.due_date} onChange={e => setReview(current => ({ ...current, rows: current.rows.map(item => item.id === row.id ? { ...item, due_date: e.target.value } : item) }))} /></div>; })}</div><div className="academic-intake-footer"><span><LockKeyhole size={15} /> Only you can see saved actions.</span><button type="button" className="academic-primary" disabled={busy || !chosenCount} onClick={saveReview}>{busy ? <Loader2 size={18} className="spin" /> : <Plus size={18} />} Save {chosenCount} {chosenCount === 1 ? "action" : "actions"}</button></div>
        </div>}
      </section>
    </div><aside className="academic-aside">
      <section className="academic-panel academic-links"><span className="academic-eyebrow">Campus access</span><h2>Open the source</h2><p className="academic-supporting">Your university remains the source of record. These links open the services; they do not sync your account.</p><a href="https://my.iona.edu/home/657" target="_blank" rel="noopener noreferrer"><span><GraduationCap size={19} /><strong>My Iona</strong></span><ArrowUpRight size={18} /></a><a href="https://outlook.office.com/mail/" target="_blank" rel="noopener noreferrer"><span><CalendarDays size={19} /><strong>University Outlook</strong></span><ArrowUpRight size={18} /></a><div className="academic-connection-status"><span /> Manual import available</div></section>
      <section className="academic-panel" aria-labelledby="academic-library-title"><div className="academic-section-heading"><div><span className="academic-eyebrow">Only me</span><h2 id="academic-library-title">Private library</h2></div><FolderOpen size={20} /></div><p className="academic-supporting">Keep original PDFs and images beside your plan. Files are stored in your account when uploaded.</p><label className="academic-secondary academic-library-upload">{uploading ? <Loader2 size={18} className="spin" /> : <Upload size={18} />} Add private file<input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md" disabled={uploading} aria-label="Upload private source file" onChange={async e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) { setMessage(""); setError(""); try { const saved = await onUploadDocument(file, "private"); if (saved) setMessage("Source file saved to your private library."); else setError("The file was not saved. Check the upload message and retry."); } catch { setError("The file could not be uploaded. Check your connection and retry."); } } }} /></label>{privateDocuments.length ? <ul className="academic-document-list">{privateDocuments.slice(0, 12).map(doc => <li key={doc.id}><FileText size={18} /><div><strong>{doc.file_name}</strong><span>{Math.ceil(doc.file_size / 1024)} KB · Private</span></div><button type="button" className="academic-icon-button" aria-label={`Download ${doc.file_name}`} onClick={() => onDownloadDocument(doc)}><ArrowDownToLine size={18} /></button></li>)}</ul> : <div className="academic-library-empty">Your private source files will appear here.</div>}{privateDocuments.length > 12 && <p className="academic-supporting">Showing the 12 most recent private files.</p>}</section>
      <div className="academic-footnote"><LockKeyhole size={16} /><p>Unsaved source text is cleared when you leave this screen. Mailboxes, grades and portal records are not connected yet.</p></div>
    </aside></div>
  </section>;
}
