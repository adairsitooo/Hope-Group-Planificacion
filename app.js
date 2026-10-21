
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const STORAGE = {
    roles: "hgPlanRolesV1",
    plans: "hgPlansV1",
    templates: "hgPlanTemplatesV1",
    logo: "hgPlanLogoV1"
  };

  const defaultRoles = [
    "Bienvenida",
    "Alabanza",
    "Oración inicial",
    "Predicación",
    "Refacción",
    "Limpieza"
  ];

  function read(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  let roles = read(STORAGE.roles, defaultRoles);
  let plans = read(STORAGE.plans, []);
  let templates = read(STORAGE.templates, []);
  let currentId = null;
  let currentKind = "plan";
  let logoData = localStorage.getItem(STORAGE.logo) || "";

  function persist() {
    localStorage.setItem(STORAGE.roles, JSON.stringify(roles));
    localStorage.setItem(STORAGE.plans, JSON.stringify(plans));
    localStorage.setItem(STORAGE.templates, JSON.stringify(templates));
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function today() {
    const date = new Date();
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function newId() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function showMessage(message) {
    const element = $("editorMessage");
    if (element) element.textContent = message;
  }

  function showView(name) {
    document.querySelectorAll(".view").forEach((view) => {
      view.classList.toggle("hidden", view.id !== `${name}View`);
    });

    document.querySelectorAll(".nav-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === name);
    });

    if (name === "saved") renderSaved();
    if (name === "roles") renderCatalog();
  }

  function updateLogo() {
    const image = $("brandLogo");
    if (!image) return;

    if (logoData) {
      image.src = logoData;
      image.style.display = "block";
    } else {
      image.src = "recursos/logo.PNG";
      image.style.display = "";
    }

    image.onerror = () => {
      if (!logoData) image.style.display = "none";
    };
  }

  // ROLES DEL PROGRAMA

  function refreshRoleSelect(select, selected) {
    select.innerHTML = "";

    const list = roles.length ? roles : ["Otro"];

    list.forEach((role) => {
      const option = document.createElement("option");
      option.value = role;
      option.textContent = role;
      select.appendChild(option);
    });

    if (selected && !list.includes(selected)) {
      const option = document.createElement("option");
      option.value = selected;
      option.textContent = selected;
      select.insertBefore(option, select.firstChild);
    }

    const addOption = document.createElement("option");
    addOption.value = "__add__";
    addOption.textContent = "＋ Crear rol…";
    select.appendChild(addOption);

    select.value = selected && (
      list.includes(selected) ||
      [...select.options].some((option) => option.value === selected)
    ) ? selected : list[0];
  }

  function numberRows() {
    [...$("roleRows").children].forEach((row, index) => {
      row.querySelector(".row-number").textContent =
        `ROL ${String(index + 1).padStart(2, "0")}`;
    });
  }

  function addRow(data = {}) {
    const template = $("roleRowTemplate");

    if (!template) return;

    const node = template.content.firstElementChild.cloneNode(true);
    const select = node.querySelector(".row-role");

    refreshRoleSelect(select, data.role || roles[0] || "");

    // Compatibilidad con datos antiguos que guardaban una sola hora.
    node.querySelector(".row-start-time").value =
      data.startTime || data.time || "";

    node.querySelector(".row-end-time").value =
      data.endTime || "";

    node.querySelector(".row-person").value = data.person || "";
    node.querySelector(".row-sub").value = data.sub || "";

    node.querySelector(".remove-row").addEventListener("click", () => {
      node.remove();
      numberRows();
    });

    select.addEventListener("change", () => {
      if (select.value !== "__add__") return;

      const previous = select.value;
      const name = prompt("Nombre del nuevo rol:");

      if (name && name.trim()) {
        const clean = name.trim();

        if (roles.some((role) => role.toLowerCase() === clean.toLowerCase())) {
          refreshRoleSelect(select, roles.find(
            (role) => role.toLowerCase() === clean.toLowerCase()
          ));
          return;
        }

        addRole(clean);
        refreshRoleSelect(select, clean);
      } else {
        refreshRoleSelect(select, roles[0] || "");
      }
    });

    $("roleRows").appendChild(node);
    numberRows();
  }

  function getRows() {
    return [...$("roleRows").querySelectorAll(".role-row")].map((row) => ({
      startTime: row.querySelector(".row-start-time").value,
      endTime: row.querySelector(".row-end-time").value,
      role: row.querySelector(".row-role").value === "__add__"
        ? ""
        : row.querySelector(".row-role").value,
      person: row.querySelector(".row-person").value.trim(),
      sub: row.querySelector(".row-sub").value.trim()
    }));
  }

  function setForm(data = {}) {
    $("planName").value = data.name || "Planificación semanal";
    $("planDate").value = data.date || today();
    $("planTheme").value = data.theme || "";
    $("roleRows").innerHTML = "";

    const rows = data.rows?.length
      ? data.rows
      : [{ role: roles[0] || "", startTime: "", endTime: "" }];

    rows.forEach(addRow);

    $("editorTitle").textContent = data.name || "Nueva planificación";
    showMessage("");
  }

  function collect() {
    const name = $("planName").value.trim() || "Planificación semanal";
    const date = $("planDate").value;
    const theme = $("planTheme").value.trim();

    const rows = getRows().filter((row) =>
      row.role || row.person || row.startTime || row.endTime || row.sub
    );

    if (!theme) {
      showMessage("Escriba el tema de la semana antes de continuar.");
      $("planTheme").focus();
      return null;
    }

    if (!rows.length) {
      showMessage("Añada al menos un rol a la planificación.");
      return null;
    }

    return {
      id: currentId || newId(),
      name,
      date,
      theme,
      rows,
      updatedAt: new Date().toISOString()
    };
  }

  // GUARDAR Y EDITAR

  function savePlan() {
    const data = collect();
    if (!data) return;

    const index = plans.findIndex((plan) => plan.id === data.id);

    if (index >= 0) {
      plans[index] = data;
    } else {
      plans.unshift(data);
    }

    currentId = data.id;
    currentKind = "plan";

    persist();

    $("editorTitle").textContent = data.name;
    showMessage("Planificación guardada en este dispositivo.");
  }

  function saveTemplate() {
    const data = collect();
    if (!data) return;

    const template = {
      ...data,
      id: currentId || newId(),
      templateUpdatedAt: new Date().toISOString()
    };

    const index = templates.findIndex((item) => item.id === template.id);

    if (index >= 0) {
      templates[index] = template;
    } else {
      templates.unshift(template);
    }

    currentId = template.id;
    currentKind = "template";

    persist();
    showMessage("Plantilla guardada correctamente.");
  }

  function loadPlan(data, kind) {
    currentId = data.id;
    currentKind = kind;
    setForm(data);
    showView("editor");
  }

  function newPlan() {
    currentId = null;
    currentKind = "plan";

    setForm({
      name: "Planificación semanal",
      date: today(),
      theme: "",
      rows: roles.map((role) => ({
        role,
        startTime: "",
        endTime: "",
        person: "",
        sub: ""
      }))
    });

    showView("editor");
  }

  // PLANIFICACIONES Y PLANTILLAS GUARDADAS

  function renderSaved() {
    renderSavedList(
      "templatesList",
      templates,
      "Aún no hay plantillas. Cree una planificación y guárdela como plantilla.",
      "template"
    );

    renderSavedList(
      "plansList",
      plans,
      "Todavía no hay planificaciones guardadas.",
      "plan"
    );
  }

  function renderSavedList(target, list, emptyMessage, kind) {
    const root = $(target);
    if (!root) return;

    root.innerHTML = "";

    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = emptyMessage;
      root.appendChild(empty);
      return;
    }

    list.forEach((item) => {
      const element = document.createElement("div");
      element.className = "saved-item";

      const dateLabel = item.date
        ? new Date(`${item.date}T12:00:00`).toLocaleDateString("es-GT", {
            day: "2-digit",
            month: "long",
            year: "numeric"
          })
        : "Sin fecha";

      const info = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = item.name || "Planificación semanal";

      const details = document.createElement("small");
      details.textContent =
        `${dateLabel} · ${(item.rows || []).length} roles · Tema: ${item.theme || "Sin tema"}`;

      info.append(title, details);

      const actions = document.createElement("div");
      actions.className = "saved-actions";

      function actionButton(label, callback) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", callback);
        actions.appendChild(button);
      }

      actionButton("Abrir", () => loadPlan(item, kind));

      actionButton("Usar como base", () => {
        const copy = {
          ...item,
          id: newId(),
          name: `${item.name || "Planificación semanal"} (copia)`,
          date: today(),
          rows: (item.rows || []).map((row) => ({ ...row }))
        };

        currentId = null;
        currentKind = "plan";
        setForm(copy);
        showView("editor");
      });

      actionButton("Eliminar", () => {
        if (!confirm(`¿Eliminar "${item.name}"?`)) return;

        if (kind === "template") {
          templates = templates.filter((entry) => entry.id !== item.id);
        } else {
          plans = plans.filter((entry) => entry.id !== item.id);
        }

        persist();
        renderSaved();
      });

      element.append(info, actions);
      root.appendChild(element);
    });
  }

  // ADMINISTRAR CATÁLOGO DE ROLES

  function addRole(name) {
    const clean = name.trim();

    if (!clean) return false;

    if (roles.some((role) => role.toLowerCase() === clean.toLowerCase())) {
      return false;
    }

    roles.push(clean);
    persist();
    refreshAllSelects();

    return true;
  }

  function refreshAllSelects() {
    document.querySelectorAll(".row-role").forEach((select) => {
      const value = select.value;
      refreshRoleSelect(select, value);
    });

    renderCatalog();
  }

  function renderCatalog() {
    const root = $("roleCatalog");
    if (!root) return;

    root.innerHTML = "";

    roles.forEach((role, index) => {
      const row = document.createElement("div");
      row.className = "catalog-item";

      const input = document.createElement("input");
      input.type = "text";
      input.setAttribute("aria-label", "Nombre del rol");
      input.value = role;

      const saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.textContent = "Guardar";

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "Eliminar";

      saveButton.addEventListener("click", () => {
        const value = input.value.trim();

        if (!value) {
          alert("El nombre del rol no puede estar vacío.");
          return;
        }

        if (roles.some((existing, i) =>
          i !== index && existing.toLowerCase() === value.toLowerCase()
        )) {
          alert("Ese rol ya existe.");
          return;
        }

        const old = roles[index];
        roles[index] = value;

        document.querySelectorAll(".row-role").forEach((select) => {
          const selected = select.value === old ? value : select.value;
          refreshRoleSelect(select, selected);
        });

        persist();
        renderCatalog();
      });

      deleteButton.addEventListener("click", () => {
        if (!confirm(
          `¿Eliminar el rol "${role}" del catálogo? Las planificaciones guardadas no se alterarán.`
        )) return;

        roles = roles.filter((_, i) => i !== index);

        persist();
        refreshAllSelects();
      });

      row.append(input, saveButton, deleteButton);
      root.appendChild(row);
    });
  }

  // FECHAS

  function formatDate(date) {
    if (!date) return "Fecha pendiente";

    const parsed = new Date(`${date}T12:00:00`);

    if (Number.isNaN(parsed.getTime())) return "";

    return parsed.toLocaleDateString("es-GT", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }

  function formatTime(time) {
    if (!time) return "—";

    const parts = time.split(":");
    if (parts.length !== 2) return time;

    let hours = Number(parts[0]);
    const minutes = parts[1];
    const suffix = hours >= 12 ? "p. m." : "a. m.";

    hours = hours % 12 || 12;

    return `${hours}:${minutes} ${suffix}`;
  }

  // GENERAR PDF MEDIANTE IMPRESIÓN DEL NAVEGADOR

  function generatePDF() {
    const data = collect();
    if (!data) return;

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      showMessage(
        "El navegador bloqueó la ventana. Permita ventanas emergentes e inténtelo de nuevo."
      );
      return;
    }

    const hasSub = data.rows.some((row) => row.sub);
    const hasEndTime = data.rows.some((row) => row.endTime);

    const rows = data.rows.map((row, index) => {
      const time = row.startTime
        ? row.endTime
          ? `${formatTime(row.startTime)} – ${formatTime(row.endTime)}`
          : formatTime(row.startTime)
        : row.endTime
          ? formatTime(row.endTime)
          : "—";

      return `
        <tr>
          <td class="num">${index + 1}</td>
          <td class="time">${esc(time)}</td>
          <td>${esc(row.role || "—")}</td>
          <td>${esc(row.person || "Por asignar")}</td>
          ${hasSub ? `<td>${esc(row.sub || "—")}</td>` : ""}
        </tr>`;
    }).join("");

    const logo = logoData
      ? `<img class="logo" src="${logoData}" alt="Logo Hope Group">`
      : "";

    const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(data.name)} - Hope Group</title>
<style>
  @page {
    size: A4 portrait;
    margin: 14mm;
  }

  * { box-sizing: border-box; }

  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #222;
    margin: 0;
    font-size: 10pt;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 15px;
    border-bottom: 2px solid #222;
    padding-bottom: 14px;
    margin-bottom: 20px;
  }

  .logo {
    width: 68px;
    height: 68px;
    object-fit: contain;
  }

  .brand {
    font-size: 9pt;
    letter-spacing: 2px;
    color: #666;
    font-weight: bold;
    margin: 0 0 5px;
  }

  h1 {
    font-size: 21pt;
    margin: 0 0 5px;
    overflow-wrap: anywhere;
  }

  .date {
    font-size: 10pt;
    color: #666;
    margin: 0;
  }

  .theme {
    border: 1px solid #ddd;
    padding: 12px 14px;
    margin-bottom: 20px;
    background: #fafafa;
    break-inside: avoid;
  }

  .label {
    font-size: 8pt;
    letter-spacing: 1.5px;
    color: #666;
    font-weight: bold;
    margin: 0 0 7px;
  }

  .theme-text {
    font-size: 13pt;
    font-weight: bold;
    line-height: 1.4;
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  thead { display: table-header-group; }

  tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  th {
    background: #ededed;
    text-align: left;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: .3px;
  }

  th, td {
    border: 1px solid #d8d8d8;
    padding: 8px 7px;
    vertical-align: middle;
    overflow-wrap: anywhere;
  }

  tbody tr:nth-child(even) { background: #fafafa; }

  .num {
    width: 30px;
    text-align: center;
    color: #777;
  }

  .time {
    width: ${hasEndTime ? "125px" : "90px"};
  }

  .footer {
    margin-top: 22px;
    padding-top: 9px;
    border-top: 1px solid #ddd;
    color: #777;
    font-size: 8pt;
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }

  @media print {
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
</style>
</head>
<body>
  <header class="header">
    ${logo}
    <div>
      <p class="brand">HOPE GROUP</p>
      <h1>${esc(data.name)}</h1>
      <p class="date">${esc(formatDate(data.date))}</p>
    </div>
  </header>

  <section class="theme">
    <p class="label">TEMA DE LA SEMANA</p>
    <p class="theme-text">${esc(data.theme)}</p>
  </section>

  <table>
    <thead>
      <tr>
        <th class="num">N.º</th>
        <th class="time">Horario</th>
        <th>Rol</th>
        <th>Responsable</th>
        ${hasSub ? "<th>Suplente</th>" : ""}
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <footer class="footer">
    <span>Hope Group · Planificación</span>
    <span>${esc(formatDate(data.date))}</span>
  </footer>

  <script>
    window.addEventListener("load", () => {
      const images = Array.from(document.images);

      Promise.all(images.map(image => {
        if (image.complete) return Promise.resolve();

        return new Promise(resolve => {
          image.onload = resolve;
          image.onerror = resolve;
        });
      })).then(() => {
        setTimeout(() => window.print(), 300);
      });
    });
  <\/script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    showMessage(
      "Vista de impresión abierta. Seleccione «Guardar como PDF» para guardar el documento."
    );
  }

  // EVENTOS DE LA INTERFAZ

  document.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });

  $("newPlanBtn")?.addEventListener("click", newPlan);

  $("addRoleRowBtn")?.addEventListener("click", () => {
    addRow({ role: roles[0] || "" });
  });

  $("savePlanBtn")?.addEventListener("click", savePlan);
  $("saveTemplateBtn")?.addEventListener("click", saveTemplate);
  $("pdfBtn")?.addEventListener("click", generatePDF);

  $("roleForm")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const input = $("newRoleName");
    const name = input.value.trim();

    if (!name) return;

    if (!addRole(name)) {
      alert("Ese rol ya existe o el nombre no es válido.");
      return;
    }

    input.value = "";
  });

  // Opcional: solo se activa si se añade logoUpload al HTML.
  $("logoUpload")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Seleccione un archivo de imagen.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      logoData = reader.result;

      try {
        localStorage.setItem(STORAGE.logo, logoData);
        updateLogo();
        alert("Logo guardado en este navegador.");
      } catch {
        alert(
          "La imagen es demasiado grande para guardarse en el almacenamiento del navegador. Utilice una imagen más pequeña."
        );
      }
    };

    reader.readAsDataURL(file);
  });

  // INICIALIZACIÓN

  if ($("planDate")) $("planDate").value = today();

  updateLogo();

  setForm({
    name: "Planificación semanal",
    date: today(),
    rows: roles.map((role) => ({
      role,
      startTime: "",
      endTime: "",
      person: "",
      sub: ""
    }))
  });

  persist();
})();
