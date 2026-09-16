(() => {
  const state = { user: null, ready: false };
  window.HIOSAuth = {
    get user() {
      return state.user;
    },
    async api(url, options = {}) {
      const res = await fetch(url, {
        ...options,
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          ...(options.headers || {}),
        },
      });
      if (res.status === 401) {
        state.user = null;
        showLogin("Votre session a expiré. Connectez-vous à nouveau.");
        throw new Error("unauthorized");
      }
      const ct = res.headers.get("content-type") || "";
      const body = ct.includes("application/json")
        ? await res.json()
        : await res.text();
      if (!res.ok)
        throw Object.assign(new Error(body?.error || "request_failed"), {
          status: res.status,
          body,
        });
      return body;
    },
    async logout() {
      try {
        await this.api("/api/auth/logout", { method: "POST", body: "{}" });
        state.user = null;
        showLogin();
      } catch (e) {
        window.HIOSUI.notify("Déconnexion impossible. Réessayez.", true);
      }
    },
  };
  const el = (tag, attrs = {}, children = []) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) =>
      k === "text" ? (n.textContent = v) : n.setAttribute(k, v),
    );
    (Array.isArray(children) ? children : [children])
      .filter(Boolean)
      .forEach((c) => n.append(c));
    return n;
  };
  const email = el("input", {
    id: "loginEmail",
    type: "email",
    autocomplete: "username",
    required: "",
    placeholder: "vous@entreprise.com",
  });
  const password = el("input", {
    id: "loginPassword",
    type: "password",
    autocomplete: "current-password",
    required: "",
    placeholder: "Votre mot de passe",
  });
  const otp = el("input", {
    id: "loginOtp",
    type: "text",
    inputmode: "numeric",
    autocomplete: "one-time-code",
    placeholder: "Code à 6 chiffres",
    pattern: "[0-9]{6}",
    maxlength: "6",
  });
  const otpField = el("label", { class: "field", hidden: "" }, [
    el("span", { text: "Code de vérification" }),
    otp,
  ]);
  const error = el("p", {
    class: "auth-error",
    role: "alert",
    id: "authError",
  });
  const submit = el("button", {
    type: "submit",
    class: "primary",
    text: "Se connecter",
  });
  const form = el("form", { class: "auth-form" }, [
    el("label", { class: "field" }, [
      el("span", { text: "Adresse e-mail" }),
      email,
    ]),
    el("label", { class: "field" }, [
      el("span", { text: "Mot de passe" }),
      password,
    ]),
    otpField,
    error,
    submit,
  ]);
  const intro = el("section", { class: "auth-intro" }, [
    el("img", {
      src: "/assets/hi-os-compact.svg",
      alt: "",
      width: "54",
      height: "52",
    }),
    el("p", { class: "auth-signature", text: "DIGITAL • SOFTWARE • GROWTH" }),
    el("div", { class: "auth-statement" }, [
      el("p", { class: "eyebrow", text: "VOTRE ESPACE DE TRAVAIL" }),
      el("h1", {}, [
        document.createTextNode("L’essentiel."),
        el("br"),
        el("em", { text: "À portée de main." }),
      ]),
      el("p", {
        text: "Vos clients, vos projets et vos idées. Un seul espace pour avancer, chaque jour.",
      }),
    ]),
    el("p", { class: "auth-footer", text: "DIGITAL • SOFTWARE • GROWTH" }),
  ]);
  const box = el("section", { class: "auth-box" }, [
    el("img", {
      class: "auth-symbol",
      src: "/assets/hi-os-compact.svg",
      alt: "",
      width: "54",
      height: "50",
    }),
    el("p", { class: "eyebrow", text: "BIENVENUE" }),
    el("h2", { text: "Heureux de vous retrouver." }),
    el("p", { text: "Connectez-vous pour retrouver votre activité." }),
    form,
    el("p", {
      class: "auth-meta",
      text: "Un espace privé. Vos informations restent protégées.",
    }),
  ]);
  const lock = el(
    "div",
    {
      class: "auth-lock",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Connexion à votre espace de travail",
    },
    el("div", { class: "auth-wrap" }, [intro, box]),
  );
  document.body.append(lock);
  const pill = el("div", { class: "auth-user-pill" }, [
    el("span", { text: "Compte connecté" }),
    el("button", { type: "button", text: "Se déconnecter" }),
  ]);
  document.querySelector("#sessionControls").append(pill);
  pill.querySelector("button").onclick = () => window.HIOSAuth.logout();
  const shell = document.querySelector(".app-shell");
  shell.inert = true;
  function showLogin(message = "") {
    lock.hidden = false;
    lock.classList.remove("hidden");
    shell.inert = true;
    document.body.classList.add("auth-visible");
    error.textContent = message;
    email.focus();
  }
  function showApp() {
    lock.hidden = true;
    shell.inert = false;
    document.body.classList.remove("auth-visible");
    password.value = "";
    otp.value = "";
    otpField.hidden = true;
    otp.required = false;
    const name = state.user?.fullName || state.user?.email || "Compte connecté";
    pill.querySelector("span").textContent = name;
    document.querySelector(".page-heading .eyebrow").textContent = state.user?.company?.name || "ESPACE DE TRAVAIL";
    document.querySelector(".sidebar-help p").textContent = state.user?.space === "hi_marketing" ? "Administration HI MARKETING" : `Espace ${state.user?.company?.name || "client"}`;
    document.querySelector("#userInitials").textContent = name
      .split(/[ @.-]+/)
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase();
    document.querySelector("#content").focus();
    document.dispatchEvent(
      new CustomEvent("hios:authenticated", { detail: state.user }),
    );
  }
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;
    submit.textContent = "Connexion…";
    error.textContent = "";
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.value,
          password: password.value,
          otp: otp.value,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (body.error === "mfa_required") {
          otpField.hidden = false;
          otp.required = true;
          otp.focus();
          throw new Error(
            "Saisissez le code de votre application de vérification.",
          );
        }
        if (res.status === 429)
          throw new Error("Trop de tentatives. Patientez quelques minutes.");
        if (body.error === "database_unavailable")
          throw new Error(
            "Connexion temporairement indisponible. Réessayez dans un instant.",
          );
        throw new Error(
          "Adresse e-mail, mot de passe ou code incorrect. Réessayez.",
        );
      }
      state.user = body.user;
      showApp();
      if (body.user?.mustChangePassword)
        document.dispatchEvent(
          new CustomEvent("hios:password-change-required"),
        );
    } catch (err) {
      error.textContent = window.HIOSUI.message(err);
    } finally {
      submit.disabled = false;
      submit.textContent = "Se connecter";
    }
  });
  (async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (res.ok) {
        state.user = (await res.json()).user;
        showApp();
      } else showLogin();
    } catch {
      showLogin(
        "Connexion temporairement indisponible. Réessayez dans un instant.",
      );
    }
    state.ready = true;
  })();
})();
