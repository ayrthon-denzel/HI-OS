(() => {
  const $ = (s) => document.querySelector(s),
    panel = $("#copilot"),
    toggle = $("#toggleCopilot"),
    backdrop = $("#copilotBackdrop");
  let returnFocus;
  function open(value = true) {
    if (value && !panel.classList.contains("open"))
      returnFocus = document.activeElement;
    panel.classList.toggle("open", value);
    panel.classList.remove("minimized");
    backdrop.classList.toggle("open", value);
    toggle.setAttribute("aria-expanded", String(value));
    panel.setAttribute("aria-hidden", String(!value));
    panel.inert = !value;
    panel.setAttribute("aria-modal", "true");
    $("#minimizeCopilot").setAttribute("aria-label", "Réduire l’assistant");
    document.body.classList.toggle("copilot-open", value);
    $(".app-shell .main").inert = value;
    $("#sidebar").inert = value;
    $("#minimizeCopilot").innerHTML = window.HIOSIcons.icon("minus");
    if (value) $("#chatInput").focus();
    else if (returnFocus?.isConnected) returnFocus.focus();
  }
  toggle.onclick = () => open(!panel.classList.contains("open"));
  $("#closeCopilot").onclick = () => open(false);
  backdrop.onclick = () => open(false);
  $("#minimizeCopilot").onclick = () => {
    const min = !panel.classList.contains("minimized");
    panel.classList.toggle("minimized", min);
    backdrop.classList.toggle("open", !min);
    $(".main").inert = !min;
    $("#sidebar").inert = !min;
    document.body.classList.toggle("copilot-open", !min);
    panel.setAttribute("aria-modal", String(!min));
    $("#minimizeCopilot").innerHTML = window.HIOSIcons.icon(
      min ? "expand" : "minus",
    );
    $("#minimizeCopilot").setAttribute(
      "aria-label",
      min ? "Agrandir l’assistant" : "Réduire l’assistant",
    );
  };
  document.addEventListener("keydown", (e) => {
    if (!panel.classList.contains("open")) return;
    if (e.key === "Escape") open(false);
    if (e.key === "Tab" && !panel.classList.contains("minimized")) {
      const list = [...panel.querySelectorAll("button,textarea")].filter(
        (x) => !x.disabled && x.getClientRects().length,
      );
      if (e.shiftKey && document.activeElement === list[0]) {
        e.preventDefault();
        list.at(-1).focus();
      } else if (!e.shiftKey && document.activeElement === list.at(-1)) {
        e.preventDefault();
        list[0].focus();
      }
    }
  });
  document.querySelectorAll("[data-cmd]").forEach(
    (b) =>
      (b.onclick = () => {
        open();
        $("#chatInput").value = b.dataset.cmd;
        $("#chatInput").focus();
      }),
  );
  document.addEventListener("hios:authenticated", () => {
    open(false);
    panel.setAttribute("aria-modal", "true");
  });
  window.HIOSAssistant = {
    open,
    prepare(text) {
      open();
      $("#chatInput").value = text;
      $("#chatInput").focus();
    },
  };
})();
