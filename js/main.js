(function () {
  var CART_KEY = "av-cart-v1";
  var AUTH_KEY = "av-auth";
  var VK_PENDING_KEY = "av-vk-register-pending-v1";
  var PRODUCT_PENDING_KEY = "av-products-pending-v1";
  var PRODUCT_PUBLISHED_KEY = "av-products-published-v1";
  var DEMO_USERS_KEY = "av-app-users-v1";
  var cfg = typeof window.SITE_CONFIG !== "undefined" ? window.SITE_CONFIG : {};

  function migrateAuth() {
    try {
      var raw = sessionStorage.getItem(AUTH_KEY);
      if (!raw) return;
      var obj = JSON.parse(raw);
      if (!obj || !obj.email || obj.role) return;
      var admins = (cfg.adminEmails || [])
        .map(function (x) {
          return String(x || "")
            .toLowerCase()
            .trim();
        })
        .filter(Boolean);
      obj.role =
        admins.indexOf(String(obj.email).toLowerCase()) >= 0 ? "admin" : "user";
      sessionStorage.setItem(AUTH_KEY, JSON.stringify(obj));
    } catch (e) {}
  }

  migrateAuth();

  if (document.body && document.body.classList.contains("page-admin")) {
    try {
      var rawGuard = sessionStorage.getItem(AUTH_KEY);
      var authGuard = rawGuard ? JSON.parse(rawGuard) : null;
      if (!authGuard || authGuard.role !== "admin") {
        window.location.replace("login.html");
        return;
      }
    } catch (err) {
      window.location.replace("login.html");
      return;
    }
  }

  if (document.body && document.body.classList.contains("page-seller")) {
    try {
      var rawSellerGuard = sessionStorage.getItem(AUTH_KEY);
      var sellerGuard = rawSellerGuard ? JSON.parse(rawSellerGuard) : null;
      if (!sellerGuard || !sellerGuard.email) {
        window.location.replace("login.html?next=seller-cabinet.html");
        return;
      }
    } catch (errSg) {
      window.location.replace("login.html?next=seller-cabinet.html");
      return;
    }
  }

  function getLoginRedirectUrl(role) {
    try {
      var q = new URLSearchParams(window.location.search || "");
      var next = q.get("next");
      if (
        next &&
        next.indexOf("/") === -1 &&
        next.indexOf("..") === -1 &&
        next.indexOf("\\") === -1 &&
        /\.html$/i.test(next)
      ) {
        return next;
      }
    } catch (eR) {}
    return role === "admin" ? "admin.html" : "catalog.html";
  }

  function adminPasswordRequired(emailNorm) {
    var map = cfg.adminPasswords;
    if (!map || typeof map !== "object") return null;
    for (var k in map) {
      if (
        Object.prototype.hasOwnProperty.call(map, k) &&
        String(k).toLowerCase().trim() === emailNorm
      ) {
        return map[k];
      }
    }
    return null;
  }

  function slugify(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^\w\u0400-\u04FF0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "id-" + Math.random().toString(36).slice(2);
  }

  function parseRub(el) {
    if (!el) return null;
    var raw = el.textContent || "";
    if (raw.indexOf("₽") === -1) return null;
    var digits = raw.replace(/\D/g, "");
    var n = parseInt(digits, 10);
    return isNaN(n) ? null : n;
  }

  function formatRub(n) {
    return n.toLocaleString("ru-RU") + " ₽";
  }

  function getCart() {
    try {
      var raw = localStorage.getItem(CART_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    updateCartBadge();
    document.dispatchEvent(new CustomEvent("av-cart-changed"));
  }

  function getArrayStore(key) {
    try {
      var raw = localStorage.getItem(key);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function setArrayStore(key, arr) {
    localStorage.setItem(key, JSON.stringify(arr));
  }

  function cartTotal(items) {
    return items.reduce(function (sum, line) {
      return sum + line.price * line.qty;
    }, 0);
  }

  function cartCount(items) {
    return items.reduce(function (n, line) {
      return n + line.qty;
    }, 0);
  }

  function addLine(line) {
    var items = getCart();
    var found = items.find(function (x) {
      return x.id === line.id;
    });
    if (found) {
      found.qty += line.qty || 1;
    } else {
      items.push({
        id: line.id,
        name: line.name,
        price: line.price,
        image: line.image || "",
        qty: line.qty || 1,
      });
    }
    saveCart(items);
  }

  function removeLine(id) {
    saveCart(
      getCart().filter(function (x) {
        return x.id !== id;
      })
    );
  }

  function updateQty(id, delta) {
    var items = getCart();
    var line = items.find(function (x) {
      return x.id === id;
    });
    if (!line) return;
    line.qty += delta;
    if (line.qty <= 0) {
      removeLine(id);
    } else {
      saveCart(items);
    }
  }

  function ensureCartBadge() {
    document.querySelectorAll('a.icon-btn[href="cart.html"]').forEach(function (a) {
      if (a.querySelector("[data-cart-count]")) return;
      var s = document.createElement("span");
      s.className = "header-cart-badge";
      s.setAttribute("data-cart-count", "");
      s.setAttribute("aria-hidden", "true");
      a.appendChild(s);
    });
  }

  function updateCartBadge() {
    ensureCartBadge();
    var n = cartCount(getCart());
    document.querySelectorAll("[data-cart-count]").forEach(function (el) {
      el.textContent = n > 99 ? "99+" : String(n);
      el.hidden = n === 0;
      el.classList.toggle("is-visible", n > 0);
    });
  }

  function cardProductId(card) {
    var name =
      (card.querySelector(".product-card__name, .profile-product__name") || {}).textContent || "";
    var extra =
      (card.querySelector(".product-card__studio, .profile-product__meta") || {}).textContent || "";
    return slugify(name.trim() + "-" + extra.trim());
  }

  function initAddToCart() {
    document.querySelectorAll(".product-card, .profile-product").forEach(function (card) {
      if (card.querySelector("[data-add-to-cart]")) return;
      var body = card.querySelector(".product-card__body, .profile-product__body");
      var nameEl = card.querySelector(".product-card__name, .profile-product__name");
      var priceEl = card.querySelector(".product-card__price, .profile-product__price");
      var img = card.querySelector("img");
      if (!body || !nameEl || !priceEl) return;
      var price = parseRub(priceEl);
      if (price === null) return;

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn--outline product-card__add";
      btn.setAttribute("data-add-to-cart", "");
      btn.textContent = "В корзину";
      btn.addEventListener("click", function () {
        addLine({
          id: cardProductId(card),
          name: nameEl.textContent.trim(),
          price: price,
          image: img ? img.getAttribute("src") || "" : "",
          qty: 1,
        });
        btn.textContent = "Добавлено";
        setTimeout(function () {
          btn.textContent = "В корзину";
        }, 1400);
      });
      body.appendChild(btn);
    });
  }

  function renderCartPage() {
    var root = document.querySelector("[data-cart-page]");
    if (!root) return;

    function paint() {
      var items = getCart();
      var empty = root.querySelector("[data-cart-empty]");
      var content = root.querySelector("[data-cart-content]");
      var linesEl = root.querySelector("[data-cart-lines]");
      var totalEl = root.querySelector("[data-cart-total]");
      var lead = root.querySelector("[data-cart-lead]");

      if (lead) {
        lead.textContent =
          items.length === 0
            ? "Добавьте товары из каталога или профилей дизайнеров."
            : "Проверьте состав заказа и оформите покупку.";
      }

      if (empty) empty.hidden = items.length > 0;
      if (content) content.hidden = items.length === 0;

      if (!linesEl || !totalEl) return;

      totalEl.textContent = formatRub(cartTotal(items));

      var orderEmailField = root.querySelector("[data-order-email]");
      var session = getAuth();
      if (orderEmailField && session && session.email && !orderEmailField.value) {
        orderEmailField.value = session.email;
      }

      linesEl.innerHTML = items
        .map(function (line) {
          var img =
            line.image
              ? '<img src="' +
                String(line.image).replace(/"/g, "&quot;") +
                '" alt="" width="72" height="72" loading="lazy" />'
              : '<div class="cart-line__ph"></div>';
          return (
            '<article class="cart-line" data-line-id="' +
            String(line.id).replace(/"/g, "&quot;") +
            '">' +
            '<div class="cart-line__media">' +
            img +
            "</div>" +
            '<div class="cart-line__info"><h3 class="cart-line__name">' +
            escapeHtml(line.name) +
            "</h3>" +
            '<p class="cart-line__price">' +
            formatRub(line.price) +
            " × " +
            line.qty +
            "</p></div>" +
            '<div class="cart-line__qty">' +
            '<button type="button" class="cart-qty-btn" data-cart-dec aria-label="Меньше">−</button>' +
            '<span class="cart-qty-val">' +
            line.qty +
            "</span>" +
            '<button type="button" class="cart-qty-btn" data-cart-inc aria-label="Больше">+</button>' +
            "</div>" +
            '<div class="cart-line__sum">' +
            formatRub(line.price * line.qty) +
            "</div>" +
            '<button type="button" class="cart-remove btn btn--outline" data-cart-remove>Удалить</button>' +
            "</article>"
          );
        })
        .join("");
    }

    paint();

    root.addEventListener("click", function (e) {
      var line = e.target.closest("[data-line-id]");
      if (!line) return;
      var id = line.getAttribute("data-line-id");
      if (!id) return;
      if (e.target.closest("[data-cart-remove]")) {
        removeLine(id);
        paint();
        return;
      }
      if (e.target.closest("[data-cart-inc]")) {
        updateQty(id, 1);
        paint();
        return;
      }
      if (e.target.closest("[data-cart-dec]")) {
        updateQty(id, -1);
        paint();
      }
    });

    document.addEventListener("av-cart-changed", paint);

    var checkout = root.querySelector("[data-cart-checkout]");
    var checkoutMsg = root.querySelector("[data-cart-checkout-msg]");
    if (checkout) {
      checkout.addEventListener("click", function () {
        var items = getCart();
        if (checkoutMsg) {
          checkoutMsg.classList.remove("is-success", "is-error");
          checkoutMsg.textContent = "";
        }
        if (items.length === 0) return;

        var key = cfg.web3AccessKey && String(cfg.web3AccessKey).trim();
        var lines = items
          .map(function (l) {
            return l.name + " × " + l.qty + " — " + formatRub(l.price * l.qty);
          })
          .join("\n");

        if (!key) {
          if (checkoutMsg) {
            checkoutMsg.textContent =
              "Демо: заказ сформирован. Укажите web3AccessKey в js/site-config.js для отправки на почту.";
            checkoutMsg.classList.remove("is-error");
            checkoutMsg.classList.add("is-success");
          }
          saveCart([]);
          paint();
          return;
        }

        var orderEmailEl = root.querySelector("[data-order-email]");
        var auth = getAuth();
        var orderEmail =
          (auth && auth.email) || (orderEmailEl && orderEmailEl.value && orderEmailEl.value.trim());
        if (!orderEmail || !orderEmail.includes("@")) {
          if (checkoutMsg) {
            checkoutMsg.classList.remove("is-success");
            checkoutMsg.classList.add("is-error");
            checkoutMsg.textContent = "Укажите email для ответа или войдите в кабинет.";
          }
          if (orderEmailEl) {
            orderEmailEl.focus();
            try {
              orderEmailEl.reportValidity();
            } catch (e) {}
          }
          return;
        }

        checkout.disabled = true;
        fetch("https://api.web3forms.com/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_key: key,
            subject: "Заказ — Алтай-Витрин",
            name: "Покупатель",
            email: orderEmail,
            message:
              "Новый заказ:\n\n" +
              lines +
              "\n\nИтого: " +
              formatRub(cartTotal(items)),
          }),
        })
          .then(function (r) {
            return r.json();
          })
          .then(function (data) {
            if (data.success) {
              if (checkoutMsg) {
                checkoutMsg.classList.remove("is-error");
                checkoutMsg.textContent = "Заказ отправлен. Мы свяжемся с вами.";
                checkoutMsg.classList.add("is-success");
              }
              saveCart([]);
              paint();
            } else {
              throw new Error(data.message || "Ошибка");
            }
          })
          .catch(function () {
            if (checkoutMsg) {
              checkoutMsg.textContent = "Не удалось отправить. Проверьте ключ в site-config.js.";
              checkoutMsg.classList.add("is-error");
            }
          })
          .finally(function () {
            checkout.disabled = false;
          });
      });
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getAuth() {
    try {
      var raw = sessionStorage.getItem(AUTH_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setAuth(email, role) {
    sessionStorage.setItem(
      AUTH_KEY,
      JSON.stringify({
        email: email,
        role: role || "user",
        t: Date.now(),
      })
    );
  }

  function clearAuth() {
    sessionStorage.removeItem(AUTH_KEY);
  }

  function normalizeVkHandle(raw) {
    var s = String(raw || "").trim();
    s = s.replace(/^https?:\/\/(www\.)?vk\.com\//i, "");
    s = s.replace(/^@/, "");
    return s;
  }

  function getMediaApiBase() {
    return String(cfg.mediaApiBase || "").trim().replace(/\/+$/, "");
  }

  /** Один origin с API: пустой base → относительный путь /api/... */
  function apiUrl(pathname) {
    var base = getMediaApiBase();
    if (!base) return pathname;
    return base.replace(/\/+$/, "") + pathname;
  }

  /** Авторизация: отдельный домен в vkAuthApiBase или тот же, что и медиа/сайт */
  function authApiUrl(pathname) {
    var vkOnly = String(cfg.vkAuthApiBase || "").trim().replace(/\/+$/, "");
    if (vkOnly) return vkOnly + pathname;
    return apiUrl(pathname);
  }

  /** Локальный демо-код только при file:// или vkRegistrationDemo === true */
  function shouldUseVkDemo() {
    if (cfg.vkRegistrationDemo === true) return true;
    try {
      if (String(window.location.protocol || "").toLowerCase() === "file:") return true;
    } catch (e) {}
    return false;
  }

  function mediaApi(pathname) {
    var base = getMediaApiBase();
    if (!pathname) return base || "";
    if (!base) return pathname;
    return base + pathname;
  }

  function demoPasswordHash(email, password) {
    var data = new TextEncoder().encode(
      String(password) + "|" + String(email).toLowerCase() + "|av-demo"
    );
    return crypto.subtle.digest("SHA-256", data).then(function (buf) {
      return Array.from(new Uint8Array(buf))
        .map(function (b) {
          return b.toString(16).padStart(2, "0");
        })
        .join("");
    });
  }

  function storeDemoUser(email, name, vk, password) {
    return demoPasswordHash(email, password).then(function (hash) {
      var users = getArrayStore(DEMO_USERS_KEY);
      var em = String(email).toLowerCase();
      users = users.filter(function (u) {
        return String(u.email).toLowerCase() !== em;
      });
      users.push({
        email: em,
        name: name || "",
        vk: vk || "",
        passwordHash: hash,
        role: "user",
      });
      setArrayStore(DEMO_USERS_KEY, users);
    });
  }

  function demoLoginCheck(email, password) {
    return demoPasswordHash(email, password).then(function (hash) {
      var users = getArrayStore(DEMO_USERS_KEY);
      var u = users.find(function (x) {
        return String(x.email).toLowerCase() === String(email).toLowerCase();
      });
      return !!(u && u.passwordHash === hash);
    });
  }

  function resolveProductPreview(item) {
    if (item && item.preview && item.preview.url) return String(item.preview.url);
    if (item && Array.isArray(item.media) && item.media.length) {
      var byId = item.media.find(function (m) {
        return m && m.id === item.previewMediaId;
      });
      if (byId && byId.url) return String(byId.url);
      if (item.media[0] && item.media[0].url) return String(item.media[0].url);
    }
    return String((item && item.image) || "");
  }

  function requestVkCode(payload) {
    if (shouldUseVkDemo()) {
      var demoCode = String(Math.floor(100000 + Math.random() * 900000));
      sessionStorage.setItem(
        VK_PENDING_KEY,
        JSON.stringify({
          email: payload.email,
          name: payload.name,
          vk: payload.vk,
          code: demoCode,
          createdAt: Date.now(),
        })
      );
      return Promise.resolve({ ok: true, demo: true, code: demoCode });
    }
    return fetch(authApiUrl("/api/auth/vk/send-code"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) {
          var err = new Error(
            (data && data.error) || "Не удалось отправить код. Проверьте бота и VK_BOT_TOKEN."
          );
          err.apiDetail = data;
          throw err;
        }
        return { ok: !!(data && data.ok), demo: false };
      });
    });
  }

  function verifyVkCode(payload) {
    if (shouldUseVkDemo()) {
      try {
        var raw = sessionStorage.getItem(VK_PENDING_KEY);
        var pending = raw ? JSON.parse(raw) : null;
        if (
          pending &&
          pending.email === payload.email &&
          pending.vk === payload.vk &&
          pending.code === payload.code
        ) {
          sessionStorage.removeItem(VK_PENDING_KEY);
          return storeDemoUser(payload.email, payload.name, payload.vk, payload.password).then(function () {
            return { ok: true, email: payload.email, role: "user", demo: true };
          });
        }
      } catch (e) {}
      return Promise.resolve({ ok: false, demo: true });
    }
    return fetch(authApiUrl("/api/auth/vk/verify-code"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(function (r) {
      return r.json().then(function (data) {
        if (!r.ok) {
          var err = new Error((data && data.error) || "verify failed");
          err.apiDetail = data;
          throw err;
        }
        return {
          ok: !!(data && data.ok),
          email: (data && data.email) || payload.email,
          role: (data && data.role) || "user",
          demo: false,
        };
      });
    });
  }

  function updateAuthNav() {
    document.querySelectorAll("[data-admin-nav]").forEach(function (el) {
      el.remove();
    });
    document.querySelectorAll("[data-seller-nav]").forEach(function (el) {
      el.remove();
    });
    var loginLink =
      document.querySelector("nav .nav-auth-btn") ||
      document.querySelector('nav a[href="login.html"]');
    if (!loginLink) return;
    var auth = getAuth();
    if (auth && auth.email) {
      var cab = document.createElement("a");
      cab.href = "seller-cabinet.html";
      cab.className = "btn btn--outline";
      cab.setAttribute("data-seller-nav", "");
      cab.textContent = "Кабинет";
      loginLink.parentNode.insertBefore(cab, loginLink);
      if (auth.role === "admin") {
        var adm = document.createElement("a");
        adm.href = "admin.html";
        adm.className = "btn btn--outline";
        adm.setAttribute("data-admin-nav", "");
        adm.textContent = "Админ";
        loginLink.parentNode.insertBefore(adm, loginLink);
      }
      loginLink.textContent = "Выйти";
      loginLink.setAttribute("href", "#");
      loginLink.setAttribute("data-auth-logout", "");
      loginLink.classList.add("nav-auth-btn", "nav-logout");
    }
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[data-auth-logout]");
    if (!a) return;
    e.preventDefault();
    clearAuth();
    window.location.href = "index.html";
  });

  function initCatalogSearch() {
    var input = document.querySelector("[data-catalog-search]");
    if (!input) return;
    var root =
      input.closest("[data-catalog-root]") ||
      input.closest("section") ||
      document.body;
    var cards = root.querySelectorAll(".product-card");
    input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase();
      cards.forEach(function (card) {
        var blob = card.textContent.toLowerCase();
        card.hidden = q.length > 0 && blob.indexOf(q) === -1;
      });
    });
  }

  function initHubSearch() {
    var input = document.querySelector("[data-hub-search]");
    if (!input) return;
    var wrap = input.closest("[data-catalog-root]") || document.body;
    var cards = wrap.querySelectorAll("[data-hub-cards] .cat-card");
    if (!cards.length) return;
    input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase();
      cards.forEach(function (card) {
        var blob = card.textContent.toLowerCase();
        var hide = q.length > 0 && blob.indexOf(q) === -1;
        card.hidden = hide;
        card.style.display = hide ? "none" : "";
      });
    });
  }

  function initShelfShuffle() {
    document.querySelectorAll("[data-shelf-shuffle] .shelf-zone__grid").forEach(function (ul) {
      var items = Array.from(ul.children);
      items.sort(function () {
        return Math.random() - 0.5;
      });
      items.forEach(function (li) {
        ul.appendChild(li);
      });
    });
  }

  function getRoomCategoryByPath() {
    var p = String(window.location.pathname || "").toLowerCase();
    if (p.indexOf("room-lighting") >= 0) return "light";
    if (p.indexOf("room-texture") >= 0) return "texture";
    if (p.indexOf("room-decor") >= 0) return "decor";
    if (p.indexOf("room-furniture") >= 0) return "furniture";
    return "";
  }

  function categoryToRoomSlug(cat) {
    if (cat === "light") return "lighting";
    if (cat === "furniture") return "furniture";
    if (cat === "texture") return "texture";
    return "decor";
  }

  function renderDynamicRoomProducts() {
    if (!document.body || !document.body.classList.contains("page-room")) return;
    var cat = getRoomCategoryByPath();
    if (!cat) return;
    var zones = Array.from(document.querySelectorAll(".shelf-zone__grid"));
    if (!zones.length) return;
    document.querySelectorAll("[data-dynamic-product]").forEach(function (el) {
      el.remove();
    });
    var tierMap = {
      "tier-top": "Верх полки",
      "tier-mid": "Середина",
      "tier-low": "Низ полки",
    };
    var widthMap = {
      "width-wide": "Широкая полка",
      "width-standard": "Стандарт",
      "width-narrow": "Узкая полка",
    };
    var fallbackTier = ["tier-top", "tier-mid", "tier-low"];
    var fallbackWidth = ["width-wide", "width-standard", "width-narrow"];

    function paint(items) {
      items.forEach(function (p, i) {
        var tier = p.tier || fallbackTier[i % fallbackTier.length];
        var width = p.width || fallbackWidth[i % fallbackWidth.length];
        var zoneIdx = tier === "tier-top" ? 0 : tier === "tier-mid" ? 1 : 2;
        var zone = zones[zoneIdx] || zones[i % zones.length];
        var li = document.createElement("li");
        li.setAttribute("data-dynamic-product", "1");
        li.innerHTML =
          '<article class="product-card">' +
          '<div class="product-card__badges">' +
          '<span class="shelf-badge shelf-badge--' +
          tier +
          '">' +
          (tierMap[tier] || "Середина") +
          "</span>" +
          '<span class="shelf-badge shelf-badge--' +
          width +
          '">' +
          (widthMap[width] || "Стандарт") +
          "</span>" +
          "</div>" +
          '<p class="product-card__studio">' +
          escapeHtml(p.designer || "Автор") +
          "</p>" +
          '<div class="product-card__image"><img src="' +
          escapeHtml(resolveProductPreview(p)) +
          '" alt="' +
          escapeHtml((p.name || "") + " — " + (p.type || "")) +
          '" width="600" height="600" loading="lazy" /></div>' +
          '<div class="product-card__body"><h3 class="product-card__name">' +
          escapeHtml(p.name || "Товар") +
          '</h3><p class="product-card__type">' +
          escapeHtml(p.type || "") +
          '</p><p class="product-card__price">' +
          formatRub(Number(p.price) || 0) +
          "</p></div></article>";
        zone.appendChild(li);
      });
    }

    var localItems = getArrayStore(PRODUCT_PUBLISHED_KEY).filter(function (p) {
      return p && p.category === cat;
    });
    paint(localItems);

    var roomSlug = categoryToRoomSlug(cat);
    fetch(mediaApi("/api/rooms/" + roomSlug))
      .then(function (res) {
        if (!res.ok) throw new Error("rooms api failed");
        return res.json();
      })
      .then(function (data) {
        var serverItems = data && Array.isArray(data.items) ? data.items : [];
        if (!serverItems.length) return;
        document.querySelectorAll("[data-dynamic-product]").forEach(function (el) {
          el.remove();
        });
        paint(serverItems);
      })
      .catch(function () {
        /* fallback на localStorage уже отрисован выше */
      });
  }

  function renderDynamicProfileProducts() {
    var grid = document.querySelector(".profile-grid");
    var title = document.querySelector(".profile-title");
    if (!grid || !title) return;
    function normalizeDesignerName(s) {
      return String(s || "")
        .toLowerCase()
        .replace(/[«»"']/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }
    var designer = normalizeDesignerName(title.textContent || "");
    document.querySelectorAll("[data-dynamic-profile]").forEach(function (el) {
      el.remove();
    });
    getArrayStore(PRODUCT_PUBLISHED_KEY)
      .filter(function (p) {
        return p && normalizeDesignerName(p.designer || "") === designer;
      })
      .forEach(function (p) {
        var article = document.createElement("article");
        article.className = "profile-product";
        article.setAttribute("data-dynamic-profile", "1");
        article.setAttribute("data-cat", p.category || "decor");
        article.setAttribute("data-mat", p.material || "ceramic");
        article.innerHTML =
          '<img src="' +
          escapeHtml(resolveProductPreview(p)) +
          '" alt="' +
          escapeHtml(p.name || "Товар") +
          '" /><div class="profile-product__body"><h3 class="profile-product__name">' +
          escapeHtml(p.name || "Товар") +
          '</h3><p class="profile-product__meta">' +
          escapeHtml(p.type || "") +
          '</p><p class="profile-product__price">' +
          formatRub(Number(p.price) || 0) +
          "</p></div>";
        grid.appendChild(article);
      });
    document.dispatchEvent(new CustomEvent("av-products-changed"));
  }

  function initSellerServerListings() {
    var box = document.querySelector("[data-seller-server-list]");
    if (!box || !document.body.classList.contains("page-seller")) return;
    var listEl = box.querySelector("[data-seller-server-list-body]");
    var emptyEl = box.querySelector("[data-seller-server-empty]");
    var loadEl = box.querySelector("[data-seller-server-loading]");
    var statusRu = {
      active: "На витрине",
      pending_review: "На модерации",
      expired: "Истекла аренда",
      cancelled: "Отклонено",
      pending_payment: "Ожидает оплаты",
    };
    function refresh() {
      var auth = getAuth();
      if (!auth || !auth.email || !listEl) return;
      if (loadEl) loadEl.hidden = false;
      fetch(
        mediaApi("/api/seller/listings?seller=" + encodeURIComponent(String(auth.email).trim().toLowerCase()))
      )
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          var items = (data && data.items) || [];
          listEl.innerHTML = "";
          if (loadEl) loadEl.hidden = true;
          if (emptyEl) emptyEl.hidden = items.length !== 0;
          items.forEach(function (row) {
            var p = row.product || {};
            var article = document.createElement("article");
            article.className = "seller-server-card";
            var st = String(row.status || "");
            var imgUrl =
              (p.preview && p.preview.url) ||
              p.image ||
              resolveProductPreview({ preview: p.preview, image: p.image, media: p.media });
            var ends = row.endsAt ? new Date(row.endsAt).toLocaleString("ru-RU") : "";
            article.innerHTML =
              '<div class="seller-server-card__media"><img width="120" height="120" alt="" /></div>' +
              '<div class="seller-server-card__body">' +
              "<h3></h3>" +
              '<p class="seller-server-card__meta"></p>' +
              '<p class="seller-server-card__status"></p>' +
              "</div>";
            var im = article.querySelector("img");
            if (im) im.src = imgUrl || "";
            if (im) im.alt = p.name || "Товар";
            var h3 = article.querySelector("h3");
            if (h3) h3.textContent = p.name || "Товар";
            var meta = article.querySelector(".seller-server-card__meta");
            if (meta) meta.textContent = (p.type || "") + (ends ? " · аренда до " + ends : "");
            var stEl = article.querySelector(".seller-server-card__status");
            if (stEl) stEl.textContent = statusRu[st] || st;
            listEl.appendChild(article);
          });
        })
        .catch(function () {
          if (loadEl) loadEl.hidden = true;
        });
    }
    document.addEventListener("av-seller-server-refresh", refresh);
    refresh();
  }

  function initAdminProductModeration() {
    var form = document.querySelector("[data-product-form]");
    var list = document.querySelector("[data-mod-list]");
    var queueCount = document.querySelector("[data-queue-count]");
    var empty = document.querySelector("[data-mod-empty]");
    var tpl = document.querySelector("#mod-card-template");
    if (!form || !list || !queueCount || !empty || !tpl) return;
    var msg = form.querySelector("[data-product-form-msg]");
    var mediaInput = form.querySelector('input[name="mediaFiles"]');
    var previewSelect = form.querySelector("[data-preview-index]");

    function fillPreviewChoices() {
      if (!mediaInput || !previewSelect) return;
      var files = Array.from(mediaInput.files || []);
      previewSelect.innerHTML = "";
      if (!files.length) {
        previewSelect.innerHTML = '<option value="">Сначала выберите файлы</option>';
        return;
      }
      files.forEach(function (file, idx) {
        var op = document.createElement("option");
        op.value = String(idx);
        op.textContent = (idx === 0 ? "Превью: " : "") + file.name;
        previewSelect.appendChild(op);
      });
      previewSelect.value = "0";
    }

    function parseLeaseDeleteAfter(leaseEndsAtIso) {
      var leaseMs = Date.parse(leaseEndsAtIso || "");
      if (!isFinite(leaseMs)) return { leaseEndsAt: "", deleteAfter: "" };
      var deleteAfterMs = leaseMs + 24 * 60 * 60 * 1000;
      return {
        leaseEndsAt: new Date(leaseMs).toISOString(),
        deleteAfter: new Date(deleteAfterMs).toISOString(),
      };
    }

    function uploadMediaFiles(itemId, category, ownerType, files, previewIndex, leaseEndsAtIso) {
      var fd = new FormData();
      fd.append("productId", itemId);
      fd.append("category", category);
      fd.append("ownerType", ownerType);
      fd.append("previewIndex", String(previewIndex));
      fd.append("leaseEndsAt", leaseEndsAtIso);
      Array.from(files || []).forEach(function (file) {
        fd.append("mediaFiles", file);
      });
      return fetch(mediaApi("/api/media/upload"), {
        method: "POST",
        body: fd,
      }).then(function (res) {
        if (!res.ok) throw new Error("upload failed");
        return res.json();
      });
    }

    function updateQueueMeta(n) {
      queueCount.textContent = String(n);
      empty.hidden = n !== 0;
    }

    function removeFromQueue(id) {
      var next = getArrayStore(PRODUCT_PENDING_KEY).filter(function (x) {
        return x.id !== id;
      });
      setArrayStore(PRODUCT_PENDING_KEY, next);
      return next;
    }

    function publishItem(item) {
      var auth = getAuth();
      var sellerEmail = auth && auth.email ? String(auth.email).trim().toLowerCase() : "";
      var listingStatus = auth && auth.role === "admin" ? "active" : "pending_review";
      var payload = {
        productId: item.id,
        roomSlug: categoryToRoomSlug(item.category || "decor"),
        tier: item.tier || "tier-mid",
        widthTier: item.width || "width-standard",
        leaseEndsAt: item.leaseEndsAt || "",
        ownerUserId: sellerEmail,
        status: listingStatus,
        product: {
          id: item.id,
          name: item.name,
          type: item.type,
          designer: item.designer,
          category: item.category,
          material: item.material,
          price: Number(item.price || 0),
          media: Array.isArray(item.media) ? item.media : [],
          previewMediaId: item.previewMediaId || "",
          preview: item.preview || null,
          image: item.image || "",
        },
      };
      return fetch(mediaApi("/api/seller/listings"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok) {
              var err = new Error((data && data.error) || "save failed");
              err.detail = data;
              throw err;
            }
            return data;
          });
        })
        .then(function (data) {
          if (listingStatus === "active") {
            var out = getArrayStore(PRODUCT_PUBLISHED_KEY);
            out.push(item);
            setArrayStore(PRODUCT_PUBLISHED_KEY, out);
          }
          document.dispatchEvent(new CustomEvent("av-products-changed"));
          document.dispatchEvent(new CustomEvent("av-seller-server-refresh"));
          return data;
        });
    }

    function renderQueue() {
      var queue = getArrayStore(PRODUCT_PENDING_KEY);
      list.innerHTML = "";
      updateQueueMeta(queue.length);
      queue.forEach(function (item) {
        var node = tpl.content.firstElementChild.cloneNode(true);
        node.setAttribute("data-item-id", item.id);
        var img = node.querySelector("img");
        var nm = node.querySelector(".admin-mod-card__name");
        var st = node.querySelector(".admin-mod-card__studio");
        var pr = node.querySelector(".admin-mod-card__price");
        if (img) {
          img.src = resolveProductPreview(item);
          img.alt = item.name || "Товар на модерации";
        }
        if (nm) nm.textContent = item.name || "Без названия";
        if (st)
          st.textContent =
            (item.designer || "Автор") +
            " · " +
            (item.type || "") +
            " · " +
            (item.category || "") +
            (item.leaseEndsAt ? " · аренда до " + new Date(item.leaseEndsAt).toLocaleString("ru-RU") : "");
        if (pr) pr.innerHTML = formatRub(Number(item.price) || 0).replace(" ₽", '&nbsp;<span class="ruble">₽</span>');
        list.appendChild(node);
      });
      if (document.body.classList.contains("page-seller")) {
        list.querySelectorAll("[data-mod-publish]").forEach(function (b) {
          b.textContent = "Отправить на модерацию";
        });
      }
    }

    if (mediaInput) {
      mediaInput.addEventListener("change", fillPreviewChoices);
    }
    fillPreviewChoices();

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      var fd = new FormData(form);
      var itemId = "prd-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
      var files = fd.getAll("mediaFiles").filter(function (f) {
        return f && typeof f === "object" && f.size > 0;
      });
      var previewIndex = Number(fd.get("previewIndex") || 0);
      if (!files.length) {
        if (msg) {
          msg.classList.remove("is-success");
          msg.classList.add("is-error");
          msg.textContent = "Добавьте хотя бы один файл медиа.";
        }
        return;
      }
      if (!(previewIndex >= 0 && previewIndex < files.length)) {
        if (msg) {
          msg.classList.remove("is-success");
          msg.classList.add("is-error");
          msg.textContent = "Выберите корректный файл превью.";
        }
        return;
      }
      var leaseRaw = String(fd.get("leaseEndsAt") || "").trim();
      var lease = parseLeaseDeleteAfter(leaseRaw);
      if (!lease.leaseEndsAt) {
        if (msg) {
          msg.classList.remove("is-success");
          msg.classList.add("is-error");
          msg.textContent = "Укажите корректный срок аренды.";
        }
        return;
      }
      if (msg) {
        msg.classList.remove("is-success", "is-error");
        msg.textContent = "Загружаем медиа на сервер...";
      }
      var submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      uploadMediaFiles(
        itemId,
        String(fd.get("category") || "").trim(),
        String(fd.get("ownerType") || "designers").trim(),
        files,
        previewIndex,
        lease.leaseEndsAt
      )
        .then(function (uploadResult) {
          var uploadedMedia = Array.isArray(uploadResult.media) ? uploadResult.media : [];
          if (!uploadedMedia.length) throw new Error("empty media");
          var preview = uploadedMedia.find(function (m) {
            return m && m.id === uploadResult.previewMediaId;
          }) || uploadedMedia[0];
          var item = {
            id: itemId,
            name: String(fd.get("name") || "").trim(),
            type: String(fd.get("type") || "").trim(),
            designer: String(fd.get("designer") || "").trim(),
            ownerType: String(fd.get("ownerType") || "designers").trim(),
            category: String(fd.get("category") || "").trim(),
            material: String(fd.get("material") || "").trim(),
            tier: String(fd.get("tier") || "").trim(),
            width: String(fd.get("width") || "").trim(),
            media: uploadedMedia,
            previewMediaId: preview && preview.id ? preview.id : "",
            preview: preview || null,
            image: preview && preview.url ? preview.url : "",
            price: Number(fd.get("price") || 0),
            leaseEndsAt: lease.leaseEndsAt,
            deleteAfter: lease.deleteAfter,
            createdAt: Date.now(),
          };
          var queue = getArrayStore(PRODUCT_PENDING_KEY);
          queue.unshift(item);
          setArrayStore(PRODUCT_PENDING_KEY, queue);
          form.reset();
          fillPreviewChoices();
          if (msg) {
            msg.classList.remove("is-error");
            msg.classList.add("is-success");
            msg.textContent = "Товар добавлен в очередь модерации.";
          }
          renderQueue();
        })
        .catch(function () {
          if (msg) {
            msg.classList.remove("is-success");
            msg.classList.add("is-error");
            msg.textContent =
              "Не удалось загрузить медиа. Проверьте backend media API и ограничения формата/размера.";
          }
        })
        .finally(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });

    list.addEventListener("click", function (event) {
      var card = event.target.closest("[data-item-id]");
      if (!card) return;
      var id = card.getAttribute("data-item-id");
      if (!id) return;
      var queue = getArrayStore(PRODUCT_PENDING_KEY);
      var item = queue.find(function (x) {
        return x.id === id;
      });
      if (!item) return;
      if (event.target.closest("[data-mod-publish]")) {
        var btn = event.target.closest("[data-mod-publish]");
        if (btn) btn.disabled = true;
        publishItem(item)
          .then(function () {
            removeFromQueue(id);
            renderQueue();
          })
          .catch(function (err) {
            if (msg) {
              msg.classList.remove("is-success");
              msg.classList.add("is-error");
              msg.textContent =
                (err && err.message) || "Не удалось сохранить на сервере. Проверьте вход и API.";
            }
          })
          .finally(function () {
            if (btn) btn.disabled = false;
          });
        return;
      } else if (event.target.closest("[data-mod-revision]")) {
        removeFromQueue(id);
      } else if (event.target.closest("[data-mod-reject]")) {
        removeFromQueue(id);
      } else {
        return;
      }
      renderQueue();
    });

    renderQueue();
  }

  function initServerPendingModeration() {
    var wrap = document.querySelector("[data-server-pending-list]");
    var empty = document.querySelector("[data-server-pending-empty]");
    if (!wrap || !document.body.classList.contains("page-admin")) return;
    function refresh() {
      fetch(mediaApi("/api/admin/listings?status=pending_review"))
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          var items = (data && data.items) || [];
          wrap.innerHTML = "";
          if (empty) empty.hidden = items.length !== 0;
          items.forEach(function (row) {
            var p = row.product || {};
            var imgUrl = (p.preview && p.preview.url) || p.image || "";
            var article = document.createElement("article");
            article.className = "admin-mod-card admin-mod-card--server";
            article.setAttribute("data-server-listing-id", row.id);
            article.innerHTML =
              '<div class="admin-mod-card__media"><img width="160" height="160" alt="" /></div>' +
              '<div class="admin-mod-card__body">' +
              '<h2 class="admin-mod-card__name"></h2>' +
              '<p class="admin-mod-card__studio"></p>' +
              '<p class="admin-mod-card__price"></p>' +
              '<div class="admin-mod-card__actions">' +
              '<button type="button" class="btn btn--admin-solid" data-server-approve>На витрину</button>' +
              '<button type="button" class="btn btn--admin-reject" data-server-reject>Отклонить</button>' +
              "</div></div>";
            var img = article.querySelector("img");
            if (img && imgUrl) {
              img.src = imgUrl;
              img.alt = p.name || "";
            }
            var nm = article.querySelector(".admin-mod-card__name");
            if (nm) nm.textContent = p.name || "Без названия";
            var st = article.querySelector(".admin-mod-card__studio");
            if (st)
              st.textContent =
                (row.ownerUserId || "продавец") +
                " · " +
                (p.type || "") +
                " · " +
                (row.roomSlug || "");
            var pr = article.querySelector(".admin-mod-card__price");
            if (pr)
              pr.innerHTML = formatRub(Number(p.price) || 0).replace(" ₽", '&nbsp;<span class="ruble">₽</span>');
            wrap.appendChild(article);
          });
        })
        .catch(function () {
          if (empty) empty.hidden = false;
        });
    }
    wrap.addEventListener("click", function (ev) {
      var card = ev.target.closest("[data-server-listing-id]");
      if (!card) return;
      var lid = card.getAttribute("data-server-listing-id");
      if (!lid) return;
      if (ev.target.closest("[data-server-approve]")) {
        fetch(mediaApi("/api/admin/listings/" + encodeURIComponent(lid)), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "active" }),
        }).then(function (r) {
          if (r.ok) {
            refresh();
            document.dispatchEvent(new CustomEvent("av-seller-server-refresh"));
          }
        });
      } else if (ev.target.closest("[data-server-reject]")) {
        fetch(mediaApi("/api/admin/listings/" + encodeURIComponent(lid)), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelled" }),
        }).then(function (r) {
          if (r.ok) {
            refresh();
            document.dispatchEvent(new CustomEvent("av-seller-server-refresh"));
          }
        });
      }
    });
    refresh();
  }

  function submitWeb3Seller(brand, email, message, msgEl, btn) {
    var key = cfg.web3AccessKey && String(cfg.web3AccessKey).trim();
    if (!key) {
      if (msgEl) {
        msgEl.classList.remove("is-error");
        msgEl.classList.add("is-success");
        msgEl.textContent =
          "Заявка принята (демо). Добавьте web3AccessKey в js/site-config.js для отправки на почту.";
      }
      return Promise.resolve({ demo: true });
    }
    if (btn) btn.disabled = true;
    return fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_key: key,
        subject: "Заявка продавца — Алтай-Витрин",
        name: brand,
        email: email,
        message: message,
      }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (!data.success) throw new Error(data.message || "Ошибка отправки");
        if (msgEl) {
          msgEl.classList.remove("is-error");
          msgEl.classList.add("is-success");
          msgEl.textContent = "Заявка отправлена. Мы свяжемся с вами.";
        }
        return { ok: true };
      })
      .catch(function () {
        if (msgEl) {
          msgEl.classList.remove("is-success");
          msgEl.classList.add("is-error");
          msgEl.textContent = "Ошибка сети или ключа. Проверьте js/site-config.js.";
        }
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  /* ——— Nav toggle ——— */
  var toggle = document.querySelector("[data-nav-toggle]");
  var nav = document.querySelector("[data-nav]");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ——— Designer slider ——— */
  var slider = document.querySelector("[data-designer-slider]");
  var prev = document.querySelector("[data-slider-prev]");
  var next = document.querySelector("[data-slider-next]");
  if (slider && prev && next) {
    var step = function (dir) {
      var w = slider.querySelector(".designer-card")?.offsetWidth || 320;
      slider.scrollBy({ left: dir * (w + 20), behavior: "smooth" });
    };
    prev.addEventListener("click", function () {
      step(-1);
    });
    next.addEventListener("click", function () {
      step(1);
    });
  }

  /* ——— Designer profile filters ——— */
  var profileLayout = document.querySelector(".profile-layout");
  if (profileLayout) {
    var groups = Array.from(profileLayout.querySelectorAll("[data-filter-group]"));
    var state = {};

    groups.forEach(function (groupEl) {
      var name = groupEl.getAttribute("data-filter-group");
      state[name] = "all";
      groupEl.addEventListener("click", function (event) {
        var btn = event.target.closest("button[data-filter]");
        if (!btn) return;
        state[name] = btn.getAttribute("data-filter") || "all";
        groupEl.querySelectorAll("button[data-filter]").forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
        });
        applyFilters();
      });
    });

    function applyFilters() {
      var cards = Array.from(profileLayout.querySelectorAll(".profile-product"));
      cards.forEach(function (card) {
        var cat = (card.getAttribute("data-cat") || "")
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean);
        var mat = (card.getAttribute("data-mat") || "")
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean);
        var catPass = state.cat === "all" || cat.includes(state.cat);
        var matPass = state.mat === "all" || mat.includes(state.mat);
        card.style.display = catPass && matPass ? "" : "none";
      });
    }

    document.addEventListener("av-products-changed", applyFilters);
  }

  /* ——— Forms ——— */
  document.querySelectorAll("form[data-form]").forEach(function (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var msg = form.querySelector(".form-message");
      var submitBtn = form.querySelector('[type="submit"]');
      var valid = form.checkValidity();
      if (!valid) {
        form.reportValidity();
        if (msg) {
          msg.classList.remove("is-success");
          msg.classList.add("is-error");
          msg.textContent = "Проверьте поля формы и попробуйте снова.";
        }
        return;
      }

      var kind = form.dataset.form;

      if (kind === "login") {
        var emailInput = form.querySelector('input[name="email"], input[type="email"]');
        var pwInput = form.querySelector('input[name="password"]');
        var emailRaw = emailInput ? emailInput.value.trim() : "";
        var emailNorm = emailRaw.toLowerCase();
        var pwVal = pwInput ? pwInput.value : "";
        var admins = (cfg.adminEmails || [])
          .map(function (x) {
            return String(x || "")
              .toLowerCase()
              .trim();
          })
          .filter(Boolean);
        var activeLoginBtn = event.submitter || form.querySelector('[type="submit"]');

        function legacyAdminLogin() {
          var role = "admin";
          if (admins.indexOf(emailNorm) < 0) return false;
          var needPw = adminPasswordRequired(emailNorm);
          if (needPw !== null && pwVal !== needPw) {
            if (msg) {
              msg.classList.remove("is-success");
              msg.classList.add("is-error");
              msg.textContent = "Неверный пароль для этой учётной записи.";
            }
            return true;
          }
          setAuth(emailRaw, role);
          if (msg) {
            msg.classList.remove("is-error");
            msg.classList.add("is-success");
            msg.textContent = "Вход как администратор. Открываем панель…";
          }
          form.querySelectorAll("input, textarea").forEach(function (el) {
            if (el.type !== "email") el.value = "";
          });
          setTimeout(function () {
            window.location.href = getLoginRedirectUrl("admin");
          }, 600);
          return true;
        }

        function finishUserLogin(role) {
          setAuth(emailRaw, role || "user");
          updateAuthNav();
          if (msg) {
            msg.classList.remove("is-error");
            msg.classList.add("is-success");
            msg.textContent =
              role === "admin"
                ? "Вход как администратор. Открываем панель…"
                : "Вход выполнен. Переходим в каталог…";
          }
          form.querySelectorAll("input, textarea").forEach(function (el) {
            if (el.type !== "email") el.value = "";
          });
          setTimeout(function () {
            window.location.href = getLoginRedirectUrl(role);
          }, 600);
        }

        if (activeLoginBtn) activeLoginBtn.disabled = true;
        fetch(authApiUrl("/api/auth/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailRaw, password: pwVal }),
        })
          .then(function (r) {
            return r.json().then(function (data) {
              return { okHttp: r.ok, status: r.status, data: data };
            });
          })
          .then(function (res) {
            if (res.data && res.data.ok) {
              finishUserLogin(res.data.role || "user");
              return;
            }
            if (res.status === 401) {
              if (msg) {
                msg.classList.remove("is-success");
                msg.classList.add("is-error");
                msg.textContent =
                  (res.data && res.data.error) || "Неверный email или пароль.";
              }
              return;
            }
            if (legacyAdminLogin()) return;
            demoLoginCheck(emailRaw, pwVal)
              .then(function (okDemo) {
                if (okDemo) {
                  finishUserLogin("user");
                  return;
                }
                if (msg) {
                  msg.classList.remove("is-success");
                  msg.classList.add("is-error");
                  msg.textContent =
                    "Неверный email или пароль. Зарегистрируйтесь через VK или проверьте связь с сервером.";
                }
              })
              .catch(function () {
                if (msg) {
                  msg.classList.remove("is-success");
                  msg.classList.add("is-error");
                  msg.textContent = "Не удалось проверить пароль в этом браузере (нужен HTTPS или localhost).";
                }
              });
          })
          .catch(function () {
            if (legacyAdminLogin()) return;
            demoLoginCheck(emailRaw, pwVal)
              .then(function (okDemo) {
                if (okDemo) {
                  finishUserLogin("user");
                  return;
                }
                if (msg) {
                  msg.classList.remove("is-success");
                  msg.classList.add("is-error");
                  msg.textContent =
                    "Сервер входа недоступен. Для офлайн-режима используйте учётку после регистрации (демо) или админа из конфига.";
                }
              })
              .catch(function () {
                if (msg) {
                  msg.classList.remove("is-success");
                  msg.classList.add("is-error");
                  msg.textContent = "Не удалось проверить пароль в этом браузере (нужен HTTPS или localhost).";
                }
              });
          })
          .finally(function () {
            if (activeLoginBtn) activeLoginBtn.disabled = false;
          });
        return;
      }

      if (kind === "seller") {
        var brandInput = form.querySelector('input[name="brand"]');
        var emailIn = form.querySelector('input[name="email"]');
        var ta = form.querySelector('textarea[name="message"]');
        var brand = brandInput ? brandInput.value.trim() : "";
        var em = emailIn ? emailIn.value.trim() : "";
        var messageText = ta ? ta.value.trim() : "";

        submitWeb3Seller(brand, em, messageText, msg, submitBtn).then(function (res) {
          if (res && (res.demo || res.ok)) {
            form.querySelectorAll("input, textarea").forEach(function (el) {
              if (el.type !== "email") el.value = "";
            });
          }
        });
        return;
      }

      if (kind === "vk-register") {
        var action = (event.submitter && event.submitter.getAttribute("data-action")) || "";
        var vkActiveBtn = event.submitter || form.querySelector('[type="submit"]');
        var nameInput = form.querySelector('input[name="name"]');
        var emailInput2 = form.querySelector('input[name="email"]');
        var vkInput = form.querySelector('input[name="vk"]');
        var codeInput = form.querySelector('input[name="code"]');
        var regPassEl = form.querySelector('input[name="reg_password"]');
        var regPass2El = form.querySelector('input[name="reg_password_confirm"]');
        var regPayload = {
          name: nameInput ? nameInput.value.trim() : "",
          email: emailInput2 ? emailInput2.value.trim() : "",
          vk: normalizeVkHandle(vkInput ? vkInput.value : ""),
          code: codeInput ? String(codeInput.value || "").trim() : "",
          password: "",
          origin: window.location.origin,
        };

        if (!regPayload.name || !regPayload.email || !regPayload.vk) {
          if (msg) {
            msg.classList.remove("is-success");
            msg.classList.add("is-error");
            msg.textContent = "Заполните имя, email и VK ID.";
          }
          return;
        }

        if (vkActiveBtn) vkActiveBtn.disabled = true;
        if (msg) {
          msg.classList.remove("is-error", "is-success");
          msg.textContent =
            action === "request-vk-code"
              ? "Отправляем код в ВКонтакте…"
              : "Проверяем код…";
        }

        if (action === "request-vk-code") {
          requestVkCode(regPayload)
            .then(function (res) {
              if (msg) {
                msg.classList.remove("is-error");
                msg.classList.add("is-success");
                msg.textContent = res.demo
                  ? "Локальный режим: код " +
                    res.code +
                    ". Откройте сайт по адресу https://… чтобы код приходил от бота в ВК."
                  : "Код отправлен в личные сообщения ВКонтакте (диалог с сообществом бота). Введите пароль и код, затем «Подтвердить и войти».";
              }
            })
            .catch(function (err) {
              if (msg) {
                msg.classList.remove("is-success");
                msg.classList.add("is-error");
                msg.textContent =
                  (err && err.message) ||
                  "Не удалось отправить код. Напишите боту «старт» в ЛС и проверьте VK_BOT_TOKEN.";
              }
            })
            .finally(function () {
              if (vkActiveBtn) vkActiveBtn.disabled = false;
            });
          return;
        }

        if (!/^\d{6}$/.test(regPayload.code)) {
          if (msg) {
            msg.classList.remove("is-success");
            msg.classList.add("is-error");
            msg.textContent = "Введите 6-значный код подтверждения.";
          }
          if (vkActiveBtn) vkActiveBtn.disabled = false;
          return;
        }

        var rp = regPassEl ? String(regPassEl.value || "") : "";
        var rp2 = regPass2El ? String(regPass2El.value || "") : "";
        if (rp.length < 8) {
          if (msg) {
            msg.classList.remove("is-success");
            msg.classList.add("is-error");
            msg.textContent = "Задайте пароль не короче 8 символов.";
          }
          if (vkActiveBtn) vkActiveBtn.disabled = false;
          return;
        }
        if (rp !== rp2) {
          if (msg) {
            msg.classList.remove("is-success");
            msg.classList.add("is-error");
            msg.textContent = "Пароли не совпадают.";
          }
          if (vkActiveBtn) vkActiveBtn.disabled = false;
          return;
        }
        regPayload.password = rp;

        verifyVkCode(regPayload)
          .then(function (res) {
            if (!res.ok) throw new Error("bad code");
            setAuth(res.email, res.role || "user");
            updateAuthNav();
            if (msg) {
              msg.classList.remove("is-error");
              msg.classList.add("is-success");
              msg.textContent = "Регистрация подтверждена. Переходим в каталог…";
            }
            setTimeout(function () {
              window.location.href = "catalog.html";
            }, 650);
          })
          .catch(function (err) {
            if (msg) {
              msg.classList.remove("is-success");
              msg.classList.add("is-error");
              msg.textContent =
                (err && err.message) || "Неверный код, пароль или ошибка проверки.";
            }
          })
          .finally(function () {
            if (vkActiveBtn) vkActiveBtn.disabled = false;
          });
        return;
      }
    });
  });

  /* ——— Images fallback ——— */
  document.querySelectorAll("img").forEach(function (img) {
    img.addEventListener("error", function () {
      if (img.dataset.fallbackApplied) return;
      img.dataset.fallbackApplied = "1";
      img.src =
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="100%" height="100%" fill="#ece8e2"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#7f7565" font-family="Arial" font-size="28">Нет изображения</text></svg>'
        );
    });
  });

  function initVkBotChatLinks() {
    document.querySelectorAll("[data-vk-bot-chat]").forEach(function (el) {
      var url = String(cfg.vkBotChatUrl || "").trim();
      if (url) {
        el.setAttribute("href", url);
        return;
      }
      el.addEventListener("click", function (e) {
        e.preventDefault();
        alert(
          "Укажите ссылку на чат с ботом: vkBotChatUrl в js/site-config.js (например https://vk.me/im?sel=-ID_группы)."
        );
      });
    });
  }

  /* ——— Boot ——— */
  ensureCartBadge();
  updateCartBadge();
  updateAuthNav();
  initVkBotChatLinks();
  initSellerServerListings();
  initAdminProductModeration();
  initServerPendingModeration();
  renderDynamicRoomProducts();
  renderDynamicProfileProducts();
  initAddToCart();
  renderCartPage();
  initCatalogSearch();
  initHubSearch();
  initShelfShuffle();
})();
