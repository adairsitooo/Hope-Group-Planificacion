(() => {
  const $ = (id) => document.getElementById(id);
  const STORAGE = { roles: "hgPlanRolesV1", plans: "hgPlansV1", templates: "hgPlanTemplatesV1", logo: "hgPlanLogoV1" };
  const defaultRoles = ["Bienvenida", "Alabanza", "Oración inicial", "Predicación", "Refacción", "Limpieza"];
  let roles = read(STORAGE.roles, defaultRoles);
  let plans = read(STORAGE.plans, []);
  let templates = read(STORAGE.templates, []);
  let currentId = null;
  let currentKind = "plan";
  let logoData = localStorage.getItem(STORAGE.logo) || "";
  let currentView = "editor";

  function read(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } }
  function persist() {
    localStorage.setItem(STORAGE.roles, JSON.stringify(roles));
    localStorage.setItem(STORAGE.plans, JSON.stringify(plans));
    localStorage.setItem(STORAGE.templates, JSON.stringify(templates));
  }
  function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
  function showMessage(message) { $("editorMessage").textContent = message; }
  function showView(name) {
    currentView = name;
    document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
    $(`${name}View`).classList.remove("hidden");
    document.querySelectorAll(".nav-button").forEach(b => b.classList.toggle("active", b.dataset.view === name));
    if (name === "saved") renderSaved();
    if (name === "roles") renderCatalog();
  }
  function updateLogo() {
    const img = $("brandLogo");
    if (logoData) { img.src = logoData; img.style.display = "block"; }
    else { img.src = "recursos/logo.PNG"; img.style.display = ""; }
  }
  function addRow(data = {}) {
    const node = $("roleRowTemplate").content.firstElementChild.cloneNode(true);
    const select = node.querySelector(".row-role");
    refreshRoleSelect(select, data.role || roles[0] || "");
    node.querySelector(".row-time").value = data.time || "";
    node.querySelector(".row-person").value = data.person || "";
    node.querySelector(".row-sub").value = data.sub || "";
    node.querySelector(".remove-row").addEventListener("click", () => { node.remove(); numberRows(); });
    select.addEventListener("change", () => {
      if (select.value === "__add__") {
        const name = prompt("Nombre del nuevo rol:");
        if (name && name.trim()) { addRole(name.trim()); refreshRoleSelect(select, name.trim()); }
        else refreshRoleSelect(select, roles[0] || "");
      }
    });
    $("roleRows").appendChild(node);
    numberRows();
  }
  function refreshRoleSelect(select, selected) {
    select.innerHTML = "";
    const list = roles.length ? roles : ["Otro"];
    list.forEach(role => { const o = document.createElement("option"); o.value = role; o.textContent = role; select.appendChild(o); });
    const add = document.createElement("option"); add.value = "__add__"; add.textContent = "＋ Crear rol…"; select.appendChild(add);
    if (selected && !list.includes(selected)) { const o = document.createElement("option"); o.value = selected; o.textContent = selected; select.insertBefore(o, add); }
    select.value = selected && (list.includes(selected) || [...select.options].some(o => o.value === selected)) ? selected : (list[0] || "__add__");
  }
  function numberRows() { [...$("roleRows").children].forEach((r, i) => r.querySelector(".row-number").textContent = `ROL ${String(i+1).padStart(2,"0")}`); }
  function getRows() {
    return [...$("roleRows").querySelectorAll(".role-row")].map(r => ({
      time: r.querySelector(".row-time").value,
      role: r.querySelector(".row-role").value === "__add__" ? "" : r.querySelector(".row-role").value,
      person: r.querySelector(".row-person").value.trim(),
      sub: r.querySelector(".row-sub").value.trim()
    }));
  }
  function setForm(data = {}) {
    $("planName").value = data.name || "Planificación semanal";
    $("planDate").value = data.date || today();
    $("planTheme").value = data.theme || "";
    $("roleRows").innerHTML = "";
    (data.rows && data.rows.length ? data.rows : [{role: roles[0] || "", time: "18:30"}]).forEach(addRow);
    $("editorTitle").textContent = data.name || "Nueva planificación";
    showMessage("");
  }
  function collect() {
    const name = $("planName").value.trim() || "Planificación semanal";
    const date = $("planDate").value;
    const theme = $("planTheme").value.trim();
    const rows = getRows().filter(r => r.role || r.person || r.time || r.sub);
    if (!theme) { showMessage("Escriba el tema de la semana antes de guardar o generar el PDF."); $("planTheme").focus(); return null; }
    if (!rows.length) { showMessage("Añada al menos un rol a la planificación."); return null; }
    return { id: currentId || crypto.randomUUID(), name, date, theme, rows, updatedAt: new Date().toISOString() };
  }
  function savePlan() {
    const data = collect(); if (!data) return;
    currentId = data.id; currentKind = "plan";
    const index = plans.findIndex(p => p.id === data.id);
    if (index >= 0) plans[index] = data; else plans.unshift(data);
    persist(); $("editorTitle").textContent = data.name; showMessage("Planificación guardada en este dispositivo.");
  }
  function saveTemplate() {
    const data = collect(); if (!data) return;
    const template = {...data, id: currentId || crypto.randomUUID(), templateUpdatedAt: new Date().toISOString()};
    const index = templates.findIndex(t => t.id === template.id);
    if (index >= 0) templates[index] = template; else templates.unshift(template);
    persist(); currentId = template.id; currentKind = "template";
    showMessage("Plantilla guardada. Puede reutilizarla desde Planificaciones guardadas.");
  }
  function loadPlan(data, kind) { currentId = data.id; currentKind = kind; setForm(data); showView("editor"); }
  function newPlan() { currentId = null; currentKind = "plan"; setForm({name:"Planificación semanal", date:today(), rows: roles.map(role => ({role, time:"", person:"", sub:""}))}); showView("editor"); }
  function renderSaved() {
    renderSavedList("templatesList", templates, "Aún no hay plantillas. Cree una planificación y elija “Guardar como plantilla”.", "template");
    renderSavedList("plansList", plans, "Todavía no hay planificaciones guardadas.", "plan");
  }
  function renderSavedList(target, list, empty, kind) {
    const root = $(target); root.innerHTML = "";
    if (!list.length) { root.innerHTML = `<div class="empty-state">${esc(empty)}</div>`; return; }
    list.forEach(item => {
      const el = document.createElement("div"); el.className = "saved-item";
      const dateLabel = item.date ? new Date(item.date+"T12:00:00").toLocaleDateString("es-GT",{day:"2-digit",month:"long",year:"numeric"}) : "Sin fecha";
      el.innerHTML = `<div><strong>${esc(item.name)}</strong><small>${esc(dateLabel)} · ${item.rows.length} roles · Tema: ${esc(item.theme)}</small></div><div class="saved-actions"><button data-action="open">Abrir</button><button data-action="copy">Usar como base</button><button data-action="delete">Eliminar</button></div>`;
      el.querySelector('[data-action="open"]').onclick = () => loadPlan(item, kind);
      el.querySelector('[data-action="copy"]').onclick = () => { const copy = {...item, id: crypto.randomUUID(), name: `${item.name} (copia)`, date: today()}; loadPlan(copy, "plan"); currentId = null; };
      el.querySelector('[data-action="delete"]').onclick = () => {
        if (!confirm(`¿Eliminar "${item.name}"?`)) return;
        if (kind === "template") templates = templates.filter(x => x.id !== item.id); else plans = plans.filter(x => x.id !== item.id);
        persist(); renderSaved();
      };
      root.appendChild(el);
    });
  }
  function addRole(name) {
    const clean = name.trim();
    if (!clean || roles.some(r => r.toLowerCase() === clean.toLowerCase())) return;
    roles.push(clean); persist(); refreshAllSelects();
  }
  function refreshAllSelects() {
    document.querySelectorAll(".row-role").forEach(sel => { const val = sel.value; refreshRoleSelect(sel, val); });
    renderCatalog();
  }
  function renderCatalog() {
    const root = $("roleCatalog"); root.innerHTML = "";
    roles.forEach((role, index) => {
      const row = document.createElement("div"); row.className = "catalog-item";
      row.innerHTML = `<input aria-label="Nombre del rol" value="${esc(role)}"><button type="button" data-action="save">Guardar</button><button type="button" data-action="delete">Eliminar</button>`;
      const input = row.querySelector("input");
      row.querySelector('[data-action="save"]').onclick = () => {
        const value = input.value.trim();
        if (!value) return alert("El nombre del rol no puede estar vacío.");
        if (roles.some((r,i) => i !== index && r.toLowerCase() === value.toLowerCase())) return alert("Ese rol ya existe.");
        const old = roles[index]; roles[index] = value;
        document.querySelectorAll(".row-role").forEach(sel => { const val = sel.value === old ? value : sel.value; refreshRoleSelect(sel, val); });
        persist(); renderCatalog();
      };
      row.querySelector('[data-action="delete"]').onclick = () => {
        if (!confirm(`¿Eliminar el rol "${role}" del catálogo? Las planificaciones guardadas no se alterarán.`)) return;
        roles = roles.filter((_,i) => i !== index); persist(); refreshAllSelects();
      };
      root.appendChild(row);
    });
  }
  function formatDate(date) { if (!date) return ""; return new Date(date+"T12:00:00").toLocaleDateString("es-GT",{day:"numeric",month:"long",year:"numeric"}); }
  function generatePDF() {
    const data = collect(); if (!data) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) { showMessage("El navegador bloqueó la ventana del PDF. Permita ventanas emergentes e inténtelo de nuevo."); return; }
    const logo = logoData || "";
    const rows = data.rows.map((r,i) => `<tr><td class="num">${i+1}</td><td class="time">${esc(r.time || "—")}</td><td>${esc(r.role || "—")}</td><td>${esc(r.person || "Por asignar")}</td>${data.rows.some(x => x.sub) ? `<td>${esc(r.sub || "—")}</td>` : ""}</tr>`).join("");
    const hasSub = data.rows.some(r => r.sub);
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(data.name)} - Hope Group</title><style>
      @page{size:A4 portrait;margin:16mm 14mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:0;font-size:11pt}
      .header{display:flex;align-items:center;gap:15px;border-bottom:2px solid #222;padding-bottom:14px;margin-bottom:20px}
      .logo{width:72px;height:72px;object-fit:contain}.brand{font-size:9pt;letter-spacing:2px;color:#666;font-weight:bold;margin:0 0 5px}
      h1{font-size:22pt;margin:0 0 4px;letter-spacing:-.5px}.date{font-size:10pt;color:#666;margin:0}
      .theme{border:1px solid #ddd;padding:13px 15px;margin-bottom:20px;background:#fafafa;break-inside:avoid}
      .label{font-size:8pt;letter-spacing:1.5px;color:#666;font-weight:bold;margin:0 0 7px}.theme-text{font-size:14pt;font-weight:bold;line-height:1.35;margin:0;white-space:pre-wrap}
      table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}th{background:#ededed;text-align:left;font-size:9pt;text-transform:uppercase;letter-spacing:.5px}
      th,td{border:1px solid #d8d8d8;padding:10px 9px;vertical-align:middle;overflow-wrap:anywhere}tbody tr:nth-child(even){background:#fafafa}
      .num{width:35px;text-align:center;color:#777}.time{width:78px;white-space:nowrap}.footer{margin-top:22px;padding-top:9px;border-top:1px solid #ddd;color:#777;font-size:8pt;display:flex;justify-content:space-between}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}} 
    </style></head><body>
      <header class="header">${logo ? `<img class="logo" src="${logo}" alt="Logo Hope Group">` : ""}<div><p class="brand">HOPE GROUP</p><h1>${esc(data.name)}</h1><p class="date">${esc(formatDate(data.date))}</p></div></header>
      <section class="theme"><p class="label">TEMA DE LA SEMANA</p><p class="theme-text">${esc(data.theme)}</p></section>
      <table><thead><tr><th class="num">N.º</th><th class="time">Hora</th><th>Rol</th><th>Responsable</th>${hasSub ? "<th>Suplente</th>" : ""}</tr></thead><tbody>${rows}</tbody></table>
      <footer class="footer"><span>Hope Group · Planificación</span><span>${esc(formatDate(data.date))}</span></footer>
      <script>window.onload=()=>setTimeout(()=>window.print(),350);window.onafterprint=()=>{};<\/script>
    </body></html>`;
    printWindow.document.open(); printWindow.document.write(html); printWindow.document.close();
    showMessage("Se abrió la vista de impresión. Elija “Guardar como PDF” en las opciones de impresión.");
  }
  document.querySelectorAll(".nav-button").forEach(b => b.addEventListener("click", () => showView(b.dataset.view)));
  $("newPlanBtn").addEventListener("click", newPlan);
  $("addRoleRowBtn").addEventListener("click", () => addRow({role:roles[0] || ""}));
  $("savePlanBtn").addEventListener("click", savePlan);
  $("saveTemplateBtn").addEventListener("click", saveTemplate);
  $("pdfBtn").addEventListener("click", generatePDF);
  $("roleForm").addEventListener("submit", e => { e.preventDefault(); const name=$("newRoleName").value.trim(); if (!name) return; addRole(name); $("newRoleName").value=""; });
  $("logoUpload").addEventListener("change", e => {
    const file=e.target.files && e.target.files[0]; if(!file) return;
    if(!file.type.startsWith("image/")) return alert("Seleccione un archivo de imagen.");
    const reader=new FileReader(); reader.onload=()=>{logoData=reader.result; localStorage.setItem(STORAGE.logo,logoData);updateLogo();alert("Logo cargado y guardado en este navegador. Para incluirlo como archivo del proyecto, copie también la imagen a recursos/logo.png.");};reader.readAsDataURL(file);
  });
  $("planDate").value = today();
  updateLogo();
  setForm({name:"Planificación semanal",date:today(),rows:roles.map(role=>({role,time:"",person:"",sub:""}))});
  persist();
})();