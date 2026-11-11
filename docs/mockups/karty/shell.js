/* =========================================================================
   Second Brain — szkielet makiet: pasek kart, pasek stanu, skróty,
   atrapa palety Ctrl+K, toasty. Strona karty potrzebuje tylko:
     <html data-card="kokpit">  ...  <div class="app"><main class="view">…</main></div>
   Pasek kart i pasek stanu dokleja ten skrypt.
   Opcjonalnie na <html>: data-project="…" data-branch="…" (pasek stanu).
   ========================================================================= */
(() => {
  const CARDS = [
    { id: "kokpit", label: "Kokpit", file: "01-kokpit.html" },
    { id: "kalendarz", label: "Kalendarz", file: "02-kalendarz.html" },
    { id: "zadania", label: "Zadania", file: "03-zadania.html" },
    { id: "projekty", label: "Projekty", file: "04-projekty.html" },
    { id: "notatki", label: "Notatki", file: "05-notatki.html" },
    { id: "plotno", label: "Płótno", file: "06-plotno.html" },
    { id: "arsenal", label: "Arsenał", file: "07-arsenal.html" },
    { id: "mapa", label: "Mapa", file: "08-mapa.html" },
  ];
  const root = document.documentElement;
  const current = root.dataset.card;
  const app = document.querySelector(".app");
  if (!app) return;

  /* ---- pasek kart ---- */
  const rail = document.createElement("nav");
  rail.className = "rail";
  rail.setAttribute("aria-label", "Karty");
  rail.innerHTML =
    `<div class="rail__logo" title="Second Brain">SB</div>` +
    CARDS.map(
      (c, i) =>
        `<a class="rail__item" href="${c.file}" style="--c: var(--c-${c.id})"
          ${c.id === current ? 'aria-current="page"' : ""} title="${c.label} (Alt+${i + 1})">
         <span class="rail__num">${i + 1}</span><span class="rail__label">${c.label}</span>
       </a>`
    ).join("") +
    `<div class="rail__spacer"></div>
     <button class="rail__cmd" type="button" data-src-toggle aria-pressed="false" title="Źródła danych (Alt+0)">src</button>
     <button class="rail__cmd" type="button" data-palette title="Paleta poleceń (Ctrl+K)">⌘K</button>`;
  app.prepend(rail);

  /* ---- pasek stanu ---- */
  const bar = document.createElement("footer");
  bar.className = "statusbar";
  bar.innerHTML = `
    <span class="statusbar__item">projekt <b>${root.dataset.project || "second-brain"}</b></span>
    <span class="statusbar__item"><span class="statusbar__dot"></span>vault <b>zsynchronizowany</b></span>
    <span class="statusbar__item">branch <b>${root.dataset.branch || "main"}</b></span>
    <span class="statusbar__spacer"></span>
    <span class="statusbar__item">Alt+1…8 karty · Alt+0 źródła · Ctrl+K polecenia</span>
    <span class="statusbar__item"><b data-clock>--:--</b></span>`;
  app.append(bar);
  const clock = bar.querySelector("[data-clock]");
  const tick = () => {
    clock.textContent = new Date().toLocaleTimeString("pl-PL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  tick();
  setInterval(tick, 15000);

  /* ---- toasty ---- */
  const toasts = document.createElement("div");
  toasts.className = "toasts";
  toasts.setAttribute("aria-live", "polite");
  document.body.append(toasts);
  const toast = (msg) => {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    toasts.append(t);
    setTimeout(() => t.remove(), 2600);
  };
  window.sbToast = toast;
  // każdy element z data-toast="…" pokazuje komunikat po kliknięciu (atrapa akcji)
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-toast]");
    if (el) toast(el.dataset.toast);
  });

  /* ---- paleta poleceń (atrapa) ---- */
  const COMMANDS = [
    ...CARDS.map((c, i) => ({ label: `Przejdź: ${c.label}`, key: `Alt+${i + 1}`, go: c.file })),
    { label: "Nowa myśl do inboxu", key: "Alt+I" },
    { label: "Nowe zadanie", key: "Alt+N" },
    { label: "Kopiuj paczkę kontekstu aktywnego projektu", key: "Alt+C" },
    { label: "Zamknij dzień", key: "" },
    { label: "Pokaż / ukryj źródła danych", key: "Alt+0", fn: () => toggleSrc() },
  ];
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-label="Paleta poleceń">
      <input class="input palette__input" placeholder="Wpisz polecenie lub nazwę…" aria-label="Polecenie">
      <ul class="palette__list" role="listbox"></ul>
    </div>`;
  document.body.append(overlay);
  const input = overlay.querySelector("input");
  const listEl = overlay.querySelector("ul");
  let sel = 0,
    shown = COMMANDS;
  const render = () => {
    const q = input.value.toLowerCase().trim();
    shown = COMMANDS.filter((c) => c.label.toLowerCase().includes(q));
    sel = Math.min(sel, Math.max(shown.length - 1, 0));
    listEl.innerHTML =
      shown
        .map(
          (c, i) =>
            `<li class="palette__item" role="option" data-i="${i}" aria-selected="${i === sel}">
         <span>${c.label}</span>${c.key ? `<span class="kbd">${c.key}</span>` : ""}</li>`
        )
        .join("") || `<li class="palette__item muted">Brak wyników</li>`;
  };
  const run = (c) => {
    if (!c) return;
    close();
    if (c.go) location.href = c.go;
    else if (c.fn) c.fn();
    else toast(`${c.label} (atrapa)`);
  };
  const open = () => {
    overlay.dataset.open = "true";
    input.value = "";
    sel = 0;
    render();
    input.focus();
  };
  const close = () => {
    overlay.dataset.open = "false";
  };
  input.addEventListener("input", () => {
    sel = 0;
    render();
  });
  listEl.addEventListener("click", (e) => {
    const li = e.target.closest("[data-i]");
    if (li) run(shown[+li.dataset.i]);
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  rail.querySelector("[data-palette]").addEventListener("click", open);

  /* ---- źródła danych ---- */
  const srcBtn = rail.querySelector("[data-src-toggle]");
  const toggleSrc = () => {
    const on = root.classList.toggle("show-src");
    srcBtn.setAttribute("aria-pressed", on);
  };
  srcBtn.addEventListener("click", toggleSrc);

  /* ---- skróty ---- */
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      open();
      return;
    }
    if (overlay.dataset.open === "true") {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowDown") {
        sel = Math.min(sel + 1, shown.length - 1);
        render();
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        sel = Math.max(sel - 1, 0);
        render();
        e.preventDefault();
      } else if (e.key === "Enter") run(shown[sel]);
      return;
    }
    if (e.altKey && e.code === "Digit0") {
      e.preventDefault();
      toggleSrc();
      return;
    }
    if (e.altKey && /^Digit[1-8]$/.test(e.code)) {
      e.preventDefault();
      location.href = CARDS[+e.code.slice(5) - 1].file;
    }
  });

  /* ---- zakładki (.tabs): przełączanie aria-selected + paneli data-tab ---- */
  document.querySelectorAll(".tabs").forEach((tabs) => {
    tabs.addEventListener("click", (e) => {
      const b = e.target.closest(".tabs__btn");
      if (!b) return;
      tabs.querySelectorAll(".tabs__btn").forEach((x) => x.setAttribute("aria-selected", x === b));
      const group = tabs.dataset.group;
      if (group)
        document.querySelectorAll(`[data-tab-group="${group}"]`).forEach((p) => {
          p.hidden = p.dataset.tab !== b.dataset.tab;
        });
    });
  });

  /* ---- przełączniki chipów (button.chip[aria-pressed]) ---- */
  document.addEventListener("click", (e) => {
    const c = e.target.closest("button.chip[aria-pressed]");
    if (c) c.setAttribute("aria-pressed", c.getAttribute("aria-pressed") !== "true");
  });
})();
