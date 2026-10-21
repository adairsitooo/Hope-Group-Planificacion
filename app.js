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

  if (!Array.isArray(roles)) roles = [...defaultRoles];
  if (!Array.isArray(plans)) plans = [];
  if (!Array.isArray(templates)) templates = [];

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
    return globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
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

  // LOGO

  function getLogoSource() {
    if (logoData) return logoData;

    try {
      return new URL("recursos/logo.PNG", window.location.href).href;
    } catch {
      return "recursos/logo.PNG";
    }
  }

  function updateLogo() {
    const image = $("brandLogo");
    if (!image) return;

    image.src = getLogoSource();
    image.style.display = "block";

    image.onerror = () => {
      image.style.display = "none";
    };
  }

  // ADMINISTRACIÓN DE ROLES

  function refreshRoleSelect(select, selected) {
    if (!select) return;

    select.innerHTML = "";

    const availableRoles = roles.length ? roles : [];

    availableRoles.forEach((role) => {
      const option = document.createElement("option");
      option.value = role;
      option.textContent = role;
      select.appendChild(option);
    });

    // Mantiene roles antiguos de planificaciones guardadas
    // aunque ya no estén en el catálogo.
    if (selected && !availableRoles.includes(selected)) {
      const option = document.createElement("option");
      option.value = selected;
      option.textContent = `${selected} (fuera del catálogo)`;
      select.appendChild(option);
    }

    const addOption = document.createElement("option");
    addOption.value = "__add__";
    addOption.textContent = "＋ Crear rol…";
    select.appendChild(addOption);

    if (selected && [...select.options].some(
      (option) => option.value === selected
    )) {
      select.value = selected;
    } else if (availableRoles.length) {
      select.value = availableRoles[0];
    } else {
      select.value = "__add__";
    }
  }

  function numberRows() {
    const root = $("roleRows");
    if (!root) return;

    [...root.children].forEach((row, index) => {
      const number = row.querySelector(".row-number");
      if (number) {
        number.textContent = `ROL ${String(index + 1).padStart(2, "0")}`;
      }
    });
  }

  function addRole(name) {
    const clean = String(name || "").trim();

    if (!clean) return false;

    const duplicate = roles.some(
      (role) => role.toLowerCase() === clean.toLowerCase()
    );

    if (duplicate) return false;

    roles.push(clean);
    persist();
    refreshAllSelects();

    return true;
  }

  function addRow(data = {}) {
    const template = $("roleRowTemplate");
    const root = $("roleRows");

    if (!template || !root) return;

    const node = template.content.firstElementChild.cloneNode(true);
    const select = node.querySelector(".row-role");

    refreshRoleSelect(select, data.role || roles[0] || "");

    const start = node.querySelector(".row-start-time");
    const end = node.querySelector(".row-end-time");
    const person = node.querySelector(".row-person");
    const sub = node.querySelector(".row-sub");

    if (start) start.value = data.startTime || data.time || "";
    if (end) end.value = data.endTime || "";
    if (person) person.value = data.person || "";
    if (sub) sub.value = data.sub || "";

    node.querySelector(".remove-row")?.addEventListener("click", () => {
      node.remove();
      numberRows();
    });

    select?.addEventListener("change", () => {
      if (select.value !== "__add__") return;

      const previous = [...select.options]
        .map((option) => option.value)
        .find((value) => value !== "__add__") || "";

      const name = prompt("Nombre del nuevo rol:");

      if (!name || !name.trim()) {
        refreshRoleSelect(select, previous);
        return;
      }

      const clean = name.trim();
      const existing = roles.find(
        (role) => role.toLowerCase() === clean.toLowerCase()
      );

      if (existing) {
        refreshRoleSelect(select, existing);
        return;
      }

      if (addRole(clean)) {
        refreshRoleSelect(select, clean);
      } else {
        refreshRoleSelect(select, previous);
      }
    });

    root.appendChild(node);
    numberRows();
  }

  function getRows() {
    const root = $("roleRows");
    if (!root) return [];

    return [...root.querySelectorAll(".role-row")].map((row) => ({
      startTime: row.querySelector(".row-start-time")?.value || "",
      endTime: row.querySelector(".row-end-time")?.value || "",
      role: row.querySelector(".row-role")?.value === "__add__"
        ? ""
        : row.querySelector(".row-role")?.value || "",
      person: row.querySelector(".row-person")?.value.trim() || "",
      sub: row.querySelector(".row-sub")?.value.trim() || ""
    }));
  }

  function setForm(data = {}) {
    if ($("planName")) {
      $("planName").value = data.name || "Planificación semanal";
    }

    if ($("planDate")) $("planDate").value = data.date || today();
    if ($("planTheme")) $("planTheme").value = data.theme || "";

    if ($("roleRows")) $("roleRows").innerHTML = "";

    const rows = data.rows?.length
      ? data.rows
      : [{
          role: roles[0] || "",
          startTime: "",
          endTime: "",
          person: "",
          sub: ""
        }];

    rows.forEach(addRow);

    if ($("editorTitle")) {
      $("editorTitle").textContent = data.name || "Nueva planificación";
    }

    showMessage("");
  }

  function collect() {
    const name = $("planName")?.value.trim() || "Planificación semanal";
    const date = $("planDate")?.value || today();
    const theme = $("planTheme")?.value.trim() || "";

    const rows = getRows().filter((row) =>
      row.role || row.person || row.startTime || row.endTime || row.sub
    );

    if (!theme) {
      showMessage("Escriba el tema de la semana antes de continuar.");
      $("planTheme")?.focus();
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

  // GUARDAR PLANIFICACIONES Y PLANTILLAS

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

    if ($("editorTitle")) $("editorTitle").textContent = data.name;
    showMessage("Planificación guardada en este dispositivo.");
  }

  function saveTemplate() {
    const data = collect();
    if (!data) return;

    const template = {
      ...data,
      id: currentKind === "template" && currentId ? currentId : newId(),
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

  // LISTAS DE PLANIFICACIONES Y PLANTILLAS

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

  // ADMINISTRAR ROLES: AÑADIR, EDITAR, GUARDAR Y ELIMINAR

  function refreshAllSelects() {
    document.querySelectorAll(".row-role").forEach((select) => {
      const current = select.value;
      const selected = roles.includes(current) ? current : roles[0] || "";
      refreshRoleSelect(select, selected);
    });

    renderCatalog();
  }

  function renderCatalog() {
    const root = $("roleCatalog");
    if (!root) return;

    root.innerHTML = "";

    if (!roles.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No hay roles registrados. Añada uno con el formulario.";
      root.appendChild(empty);
    }

    roles.forEach((role, index) => {
      const row = document.createElement("div");
      row.className = "catalog-item";

      const input = document.createElement("input");
      input.type = "text";
      input.value = role;
      input.setAttribute("aria-label", `Nombre del rol ${index + 1}`);

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
          input.focus();
          return;
        }

        const duplicate = roles.some(
          (existing, i) =>
            i !== index && existing.toLowerCase() === value.toLowerCase()
        );

        if (duplicate) {
          alert("Ese rol ya existe.");
          input.focus();
          return;
        }

        const old = roles[index];
        if (old === value) {
          alert("No hay cambios que guardar.");
          return;
        }

        // Cambiar el nombre también actualiza los registros guardados.
        function renameInRecords(records) {
          records.forEach((record) => {
            (record.rows || []).forEach((item) => {
              if (item.role === old) item.role = value;
            });
          });
        }

        roles[index] = value;
        renameInRecords(plans);
        renameInRecords(templates);

        document.querySelectorAll(".row-role").forEach((select) => {
          const selected = select.value === old ? value : select.value;
          refreshRoleSelect(select, selected);
        });

        persist();
        renderCatalog();
        showMessage(`El rol "${old}" se cambió a "${value}".`);
      });

      deleteButton.addEventListener("click", () => {
        if (!confirm(
          `¿Eliminar "${role}" del catálogo?\n\nEl rol dejará de estar disponible para nuevas asignaciones. Las planificaciones ya guardadas conservarán sus datos.`
        )) return;

        roles = roles.filter((_, i) => i !== index);

        // Si el rol eliminado estaba seleccionado en el editor,
        // se selecciona otro rol disponible.
        document.querySelectorAll(".row-role").forEach((select) => {
          const selected = select.value;
          const next = roles.includes(selected) ? selected : roles[0] || "";
          refreshRoleSelect(select, next);
        });

        persist();
        renderCatalog();
        showMessage(`Rol "${role}" eliminado del catálogo.`);
      });

      row.append(input, saveButton, deleteButton);
      root.appendChild(row);
    });
  }

  // FECHAS Y HORAS

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

  // GENERAR PDF CON LOGO

  
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
          <td class="num-cell">
            <span class="number-pill">${String(index + 1).padStart(2, "0")}</span>
          </td>
          <td class="time-cell">
            <span class="time-pill">${esc(time)}</span>
          </td>
          <td class="role-cell">
            <span class="role-name">${esc(row.role || "Sin asignar")}</span>
          </td>
          <td class="person-cell">
            <span class="person-name">${esc(row.person || "Por asignar")}</span>
          </td>
          ${hasSub ? `
            <td class="sub-cell">
              <span class="sub-name">${esc(row.sub || "—")}</span>
            </td>` : ""}
        </tr>`;
    }).join("");

    const logoSrc = getLogoSource();

    const logo = `
      <img
        class="logo"
        src="${esc(logoSrc)}"
        alt="Logo Hope Group"
        onerror="this.style.display='none'"
      >`;

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

  * {
    box-sizing: border-box;
  }

  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #242424;
    margin: 0;
    font-size: 10pt;
  }

  /* ENCABEZADO: SE CONSERVA EL DISEÑO ORIGINAL */

  .header {
    display: flex;
    align-items: center;
    gap: 15px;
    border-bottom: 2px solid #222;
    padding-bottom: 14px;
    margin-bottom: 20px;
  }

  .logo {
    display: block;
    flex: 0 0 68px;
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

  /* TEMA: SE CONSERVA EL DISEÑO ORIGINAL */

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

  /* TABLA: NUEVO DISEÑO MINIMALISTA */

  .schedule-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: separate;
    border-spacing: 0 5px;
    font-size: 9pt;
  }

  .schedule-table thead {
    display: table-header-group;
  }

  .schedule-table tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .schedule-table th {
    background: #292929;
    color: #fff;
    text-align: left;
    font-size: 7.5pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.7px;
    padding: 12px 8px;
    border: none;
  }

  .schedule-table th:first-child {
    border-radius: 7px 0 0 7px;
    text-align: center;
  }

  .schedule-table th:last-child {
    border-radius: 0 7px 7px 0;
  }

  .schedule-table td {
    background: #f6f6f6;
    padding: 11px 8px;
    vertical-align: middle;
    overflow-wrap: anywhere;
    border-top: 1px solid #ededed;
    border-bottom: 1px solid #ededed;
  }

  .schedule-table tbody tr:nth-child(even) td {
    background: #fff;
  }

  .schedule-table tbody tr td:first-child {
    border-left: 1px solid #ededed;
    border-radius: 7px 0 0 7px;
  }

  .schedule-table tbody tr td:last-child {
    border-right: 1px solid #ededed;
    border-radius: 0 7px 7px 0;
  }

  /* NÚMERO DE ORDEN */

  .num-cell {
    width: 38px;
    text-align: center;
  }

  .number-pill {
    display: inline-block;
    min-width: 25px;
    padding: 5px 3px;
    border-radius: 5px;
    background: #e8e8e8;
    color: #393939;
    font-size: 8pt;
    font-weight: bold;
    text-align: center;
  }

  /* HORARIOS */

  .time-cell {
    width: ${hasEndTime ? "112px" : "88px"};
  }

  .time-pill {
    display: inline-block;
    color: #292929;
    font-size: 8.5pt;
    font-weight: bold;
    line-height: 1.5;
    white-space: normal;
  }

  /* ROLES */

  .role-cell {
    padding-left: 10px !important;
  }

  .role-name {
    display: block;
    padding-left: 8px;
    border-left: 3px solid #383838;
    font-weight: bold;
    line-height: 1.45;
  }

  /* RESPONSABLES Y SUPLENTES */

  .person-name {
    display: block;
    line-height: 1.45;
  }

  .sub-name {
    display: block;
    color: #666;
    font-size: 8.5pt;
    line-height: 1.45;
  }

  /* PIE: SE CONSERVA EL DISEÑO ORIGINAL */

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

    .schedule-table th,
    .schedule-table td,
    .number-pill {
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

  <table class="schedule-table">
    <thead>
      <tr>
        <th class="num-cell">N.º</th>
        <th class="time-cell">Horario</th>
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

      Promise.all(images.map((image) => {
        if (image.complete) return Promise.resolve();

        return new Promise((resolve) => {
          image.onload = resolve;
          image.onerror = resolve;
        });
      })).then(() => {
        setTimeout(() => window.print(), 400);
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
    const name = input?.value.trim();

    if (!name) return;

    if (!addRole(name)) {
      alert("Ese rol ya existe o el nombre no es válido.");
      return;
    }

    input.value = "";
    showMessage(`Rol "${name}" añadido correctamente.`);
  });

  $("logoUpload")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Seleccione un archivo de imagen.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      try {
        localStorage.setItem(STORAGE.logo, reader.result);
        logoData = reader.result;
        updateLogo();
        alert("Logo guardado en este navegador.");
      } catch {
        alert(
          "La imagen es demasiado grande para guardarse en el navegador. Utilice una imagen más pequeña."
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
