(function () {
  var CART_KEY = "av-cart-v1";
  var AUTH_KEY = "av-auth";
  var VK_PENDING_KEY = "av-vk-register-pending-v1";
  var PRODUCT_PENDING_KEY = "av-products-pending-v1";
  var PRODUCT_PUBLISHED_KEY = "av-products-published-v1";
  var DEMO_USERS_KEY = "av-app-users-v1";
  var cfg = typeof window.SITE_CONFIG !== "undefined" ? window.SITE_CONFIG : {};

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

  var __avCartToastTimer = null;

  function prefersReducedMotion() {
    try {
      return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (eR) {
      return false;
    }
  }

  function getCartIconAnchor() {
    return document.querySelector('a.icon-btn[href="cart.html"]');
  }

  function pulseCartIcon() {
    document.querySelectorAll('a.icon-btn[href="cart.html"]').forEach(function (a) {
      a.classList.remove("header-cart--pulse");
      void a.offsetWidth;
      a.classList.add("header-cart--pulse");
      setTimeout(function () {
        a.classList.remove("header-cart--pulse");
      }, 500);
    });
  }

  function showCartAddedToast(productName) {
    var id = "av-cart-toast";
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      el.className = "av-cart-toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    var nm = String(productName || "Товар").trim() || "Товар";
    if (nm.length > 44) nm = nm.slice(0, 42) + "…";
    el.textContent = nm + " в корзине";
    el.classList.remove("av-cart-toast--out");
    el.classList.add("av-cart-toast--visible");
    clearTimeout(__avCartToastTimer);
    __avCartToastTimer = setTimeout(function () {
      el.classList.add("av-cart-toast--out");
      el.classList.remove("av-cart-toast--visible");
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 320);
    }, 2600);
  }

  function flyThumbToCart(sourceEl, imageUrl) {
    if (!imageUrl || prefersReducedMotion()) {
      pulseCartIcon();
      return;
    }
    var anchor = getCartIconAnchor();
    var fromEl = sourceEl && sourceEl.getBoundingClientRect ? sourceEl : null;
    var from = fromEl
      ? fromEl.getBoundingClientRect()
      : { left: window.innerWidth * 0.4, top: window.innerHeight * 0.45, width: 0, height: 0 };
    var to = anchor
      ? anchor.getBoundingClientRect()
      : { left: window.innerWidth - 48, top: 24, width: 40, height: 40 };
    var size = 52;
    var fx = from.left + (from.width || size) / 2 - size / 2;
    var fy = from.top + (from.height || size) / 2 - size / 2;
    var tx = to.left + to.width / 2 - size / 2;
    var ty = to.top + to.height / 2 - size / 2;
    var fly = document.createElement("img");
    fly.className = "av-cart-fly";
    fly.alt = "";
    fly.src = imageUrl;
    fly.setAttribute("aria-hidden", "true");
    fly.style.left = fx + "px";
    fly.style.top = fy + "px";
    fly.style.width = size + "px";
    fly.style.height = size + "px";
    document.body.appendChild(fly);
    var dx = tx - fx;
    var dy = ty - fy;
    var flyMs = 1040;
    var done = function () {
      try {
        fly.remove();
      } catch (eD) {}
      pulseCartIcon();
    };
    if (fly.animate) {
      var anim = fly.animate(
        [
          { transform: "translate(0, 0) scale(1)", opacity: 1 },
          { transform: "translate(" + dx * 0.2 + "px," + dy * 0.15 + "px) scale(1.05)", opacity: 1, offset: 0.25 },
          { transform: "translate(" + dx + "px," + dy + "px) scale(0.28)", opacity: 0.15 },
        ],
        { duration: flyMs, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
      );
      anim.onfinish = done;
    } else {
      fly.style.transition = "all " + flyMs / 1000 + "s cubic-bezier(0.22,1,0.36,1)";
      requestAnimationFrame(function () {
        fly.style.transform = "translate(" + dx + "px," + dy + "px) scale(0.25)";
        fly.style.opacity = "0.1";
      });
      setTimeout(done, flyMs + 40);
    }
  }

  function notifyProductAddedToCart(opts) {
    opts = opts || {};
    var name = opts.name || "";
    var img = String(opts.imageUrl || "").trim();
    var el = opts.sourceEl || null;
    showCartAddedToast(name);
    if (img) flyThumbToCart(el, img);
    else pulseCartIcon();
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
        var imgSrc = img ? img.getAttribute("src") || "" : "";
        addLine({
          id: cardProductId(card),
          name: nameEl.textContent.trim(),
          price: price,
          image: imgSrc,
          qty: 1,
        });
        notifyProductAddedToCart({
          name: nameEl.textContent.trim(),
          imageUrl: imgSrc,
          sourceEl: img || btn,
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

  /** Безопасное форматирование описания: **жирный**, *курсив*, __жирный__, _курсив_, списки `- ` / `1. `, абзацы. */
  function formatRichInline(s) {
    if (!s) return "";
    var out = escapeHtml(s);
    out = out.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/__([\s\S]+?)__/g, "<strong>$1</strong>");
    out = out.replace(/\*([^*\n<]+)\*/g, "<em>$1</em>");
    out = out.replace(/_([^_\n<]+)_/g, "<em>$1</em>");
    return out;
  }

  function renderRichDescription(raw) {
    var text = String(raw || "").replace(/\r\n/g, "\n").trim();
    if (!text) return "";
    var blocks = text.split(/\n{2,}/);
    return blocks
      .map(function (block) {
        block = block.trim();
        if (!block) return "";
        if (/^-{3,}$/.test(block)) return "<hr />";
        var lines = block.split("\n");
        var nonempty = lines.filter(function (l) {
          return l.trim();
        });
        var allBullet =
          nonempty.length > 0 &&
          nonempty.every(function (ln) {
            return /^\s*[-*]\s+/.test(ln);
          });
        if (allBullet) {
          return (
            "<ul>" +
            nonempty
              .map(function (l) {
                return "<li>" + formatRichInline(l.replace(/^\s*[-*]\s+/, "").trim()) + "</li>";
              })
              .join("") +
            "</ul>"
          );
        }
        var allNum =
          nonempty.length > 0 &&
          nonempty.every(function (ln) {
            return /^\s*\d+\.\s+/.test(ln);
          });
        if (allNum) {
          return (
            "<ol>" +
            nonempty
              .map(function (l) {
                return "<li>" + formatRichInline(l.replace(/^\s*\d+\.\s+/, "").trim()) + "</li>";
              })
              .join("") +
            "</ol>"
          );
        }
        var inner = lines
          .map(function (ln) {
            return formatRichInline(ln.trim());
          })
          .join("<br />");
        return "<p>" + inner + "</p>";
      })
      .join("");
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
    var path = String(pathname);
    if (path.charAt(0) !== "/") path = "/" + path;
    if (!base) return path;
    try {
      return new URL(path, base.endsWith("/") ? base : base + "/").href;
    } catch (e) {
      return base.replace(/\/+$/, "") + path;
    }
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

  var avSheetModel = null;
  var avSheetSlideIdx = 0;
  var avCarouselTimer = null;
  var AV_CAROUSEL_MS = 5200;

  function avStopCarousel() {
    if (avCarouselTimer) {
      clearInterval(avCarouselTimer);
      avCarouselTimer = null;
    }
  }

  function avStartCarousel() {
    avStopCarousel();
    if (!avSheetModel) return;
    var slides = avSheetSlides(avSheetModel);
    if (slides.length < 2) return;
    avCarouselTimer = setInterval(function () {
      avSheetSlideIdx = (avSheetSlideIdx + 1) % slides.length;
      avRenderSheetSlide();
    }, AV_CAROUSEL_MS);
  }

  function avRestartCarousel() {
    avStopCarousel();
    avStartCarousel();
  }

  function addToCartFromViewModel(model, sourceEl) {
    if (!model) return;
    var slides = avSheetSlides(model);
    var img =
      slides.length && slides[0].kind !== "video"
        ? slides[0].url
        : model.media && model.media[0] && model.media[0].url
          ? String(model.media[0].url)
          : "";
    if (!img) img = resolveProductPreview(model);
    var id =
      String(model.productId || "").trim() ||
      slugify(String(model.name || "") + "-" + String(model.designer || ""));
    addLine({
      id: id,
      name: model.name,
      price: Number(model.price) || 0,
      image: img || "",
      qty: 1,
    });
    notifyProductAddedToCart({
      name: model.name,
      imageUrl: img || "",
      sourceEl: sourceEl || null,
    });
  }

  function avSheetSlides(model) {
    if (!model || !Array.isArray(model.media)) return [];
    return model.media
      .filter(function (m) {
        return m && m.url;
      })
      .map(function (m) {
        var k = String(m.kind || "").toLowerCase();
        var url = String(m.url);
        if (k === "video" || /\.mp4(\?|$)/i.test(url)) return { url: url, kind: "video" };
        return { url: url, kind: "image" };
      });
  }

  function ensureAvProductSheet() {
    var root = document.getElementById("av-product-sheet");
    if (root) return root;
    root = document.createElement("div");
    root.id = "av-product-sheet";
    root.className = "av-product-sheet av-product-sheet--fullscreen";
    root.setAttribute("hidden", "");
    root.setAttribute("aria-hidden", "true");
    root.innerHTML =
      '<div class="av-product-sheet__backdrop" tabindex="-1"></div>' +
      '<div class="av-product-sheet__dialog" role="dialog" aria-modal="true" aria-labelledby="av-product-sheet-title">' +
      '<button type="button" class="av-product-sheet__close" aria-label="Закрыть">×</button>' +
      '<div class="av-product-sheet__grid">' +
      '<div class="av-product-sheet__gallery">' +
      '<div class="av-product-sheet__stage-wrap">' +
      '<button type="button" class="av-product-sheet__nav av-product-sheet__nav--prev" aria-label="Предыдущее фото">‹</button>' +
      '<div class="av-product-sheet__stage"></div>' +
      '<button type="button" class="av-product-sheet__nav av-product-sheet__nav--next" aria-label="Следующее фото">›</button>' +
      "</div>" +
      '<div class="av-product-sheet__thumbs" role="tablist"></div>' +
      "</div>" +
      '<div class="av-product-sheet__info">' +
      '<p class="av-product-sheet__studio"></p>' +
      '<h2 id="av-product-sheet-title" class="av-product-sheet__title"></h2>' +
      '<p class="av-product-sheet__type"></p>' +
      '<p class="av-product-sheet__price"></p>' +
      '<div class="av-product-sheet__desc av-rich"></div>' +
      '<div class="av-product-sheet__actions">' +
      '<a class="btn btn--outline av-product-sheet__room" href="catalog.html">В комнату каталога</a>' +
      '<button type="button" class="btn btn--hero-solid av-product-sheet__cart">В корзину</button>' +
      "</div></div></div></div>";
    document.body.appendChild(root);
    root.querySelector(".av-product-sheet__backdrop").addEventListener("click", closeAvProductSheet);
    root.querySelector(".av-product-sheet__close").addEventListener("click", closeAvProductSheet);
    root.querySelector(".av-product-sheet__nav--prev").addEventListener("click", function () {
      avShiftSlide(-1);
    });
    root.querySelector(".av-product-sheet__nav--next").addEventListener("click", function () {
      avShiftSlide(1);
    });
    root.querySelector(".av-product-sheet__cart").addEventListener("click", function (ev) {
      if (!avSheetModel) return;
      var media = root.querySelector(".av-product-sheet__media");
      addToCartFromViewModel(avSheetModel, media || ev.currentTarget);
    });
    root.querySelector(".av-product-sheet__thumbs").addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-av-thumb-index]");
      if (!btn) return;
      var i = parseInt(btn.getAttribute("data-av-thumb-index"), 10);
      if (!isFinite(i)) return;
      avSheetSlideIdx = i;
      avRenderSheetSlide();
      avRestartCarousel();
    });
    return root;
  }

  function avShiftSlide(dir) {
    var slides = avSheetModel ? avSheetSlides(avSheetModel) : [];
    if (!slides.length) return;
    avSheetSlideIdx = (avSheetSlideIdx + dir + slides.length) % slides.length;
    avRenderSheetSlide();
    avRestartCarousel();
  }

  function avRenderSheetSlide() {
    var root = document.getElementById("av-product-sheet");
    if (!root || !avSheetModel) return;
    var stage = root.querySelector(".av-product-sheet__stage");
    var thumbs = root.querySelector(".av-product-sheet__thumbs");
    var prev = root.querySelector(".av-product-sheet__nav--prev");
    var next = root.querySelector(".av-product-sheet__nav--next");
    var slides = avSheetSlides(avSheetModel);
    if (!stage) return;
    if (avSheetSlideIdx >= slides.length) avSheetSlideIdx = 0;
    if (avSheetSlideIdx < 0) avSheetSlideIdx = 0;
    var s = slides[avSheetSlideIdx];
    if (!s && slides.length) s = slides[0];
    if (!s) {
      stage.innerHTML =
        '<p class="av-product-sheet__empty-media">Нет изображения</p>';
      if (prev) prev.hidden = true;
      if (next) next.hidden = true;
      if (thumbs) thumbs.innerHTML = "";
      return;
    }
    if (prev) prev.hidden = slides.length < 2;
    if (next) next.hidden = slides.length < 2;
    if (s.kind === "video") {
      stage.innerHTML =
        '<video class="av-product-sheet__media" controls playsinline preload="metadata"></video>';
      var vid = stage.querySelector("video");
      if (vid) vid.src = s.url;
    } else {
      stage.innerHTML =
        '<img class="av-product-sheet__media" alt="" />';
      var im = stage.querySelector("img");
      if (im) {
        im.src = s.url;
        im.alt = String(avSheetModel.name || "");
      }
    }
    if (thumbs) {
      thumbs.innerHTML = slides
        .map(function (sl, idx) {
          var active = idx === avSheetSlideIdx ? " is-active" : "";
          var inner =
            sl.kind === "video"
              ? '<span class="av-product-sheet__thumb-fake">▶</span>'
              : '<img src="' + escapeHtml(sl.url) + '" alt="" loading="lazy" />';
          return (
            '<button type="button" class="av-product-sheet__thumb' +
            active +
            '" data-av-thumb-index="' +
            idx +
            '" aria-label="Слайд ' +
            (idx + 1) +
            '">' +
            inner +
            "</button>"
          );
        })
        .join("");
    }
  }

  function openAvProductSheet(model) {
    if (!model) return;
    avSheetModel = model;
    avSheetSlideIdx = 0;
    var root = ensureAvProductSheet();
    var studio = root.querySelector(".av-product-sheet__studio");
    var title = root.querySelector(".av-product-sheet__title");
    var type = root.querySelector(".av-product-sheet__type");
    var price = root.querySelector(".av-product-sheet__price");
    var desc = root.querySelector(".av-product-sheet__desc");
    var room = root.querySelector(".av-product-sheet__room");
    if (studio) studio.textContent = model.designer || "";
    if (title) title.textContent = model.name || "Товар";
    if (type) type.textContent = model.type || "";
    if (price)
      price.innerHTML = formatRub(Number(model.price) || 0).replace(" ₽", ' <span class="ruble">₽</span>');
    if (desc) {
      desc.classList.add("av-rich");
      if (model.description) {
        desc.innerHTML = renderRichDescription(model.description);
        desc.hidden = false;
      } else {
        desc.innerHTML = "";
        desc.hidden = true;
      }
    }
    if (room) {
      var rs = String(model.roomSlug || "").toLowerCase();
      room.setAttribute("href", roomSlugToCatalogPage(rs));
      room.textContent = rs ? "Открыть комнату в каталоге" : "Каталог";
    }
    avRenderSheetSlide();
    avStartCarousel();
    root.removeAttribute("hidden");
    root.setAttribute("aria-hidden", "false");
    document.body.classList.add("av-product-sheet-open");
    requestAnimationFrame(function () {
      root.classList.add("av-product-sheet--open");
    });
    try {
      root.querySelector(".av-product-sheet__close").focus();
    } catch (eF) {}
    document.addEventListener("keydown", avSheetOnKeydown);
  }

  function avSheetOnKeydown(ev) {
    if (ev.key === "Escape") {
      ev.preventDefault();
      closeAvProductSheet();
    }
  }

  function closeAvProductSheet() {
    avStopCarousel();
    var root = document.getElementById("av-product-sheet");
    if (root) {
      root.classList.remove("av-product-sheet--open");
      var v = root.querySelector(".av-product-sheet__stage video");
      if (v) {
        try {
          v.pause();
        } catch (eV) {}
      }
      setTimeout(function () {
        if (!root.classList.contains("av-product-sheet--open")) {
          root.setAttribute("hidden", "");
          root.setAttribute("aria-hidden", "true");
        }
      }, 320);
    }
    document.body.classList.remove("av-product-sheet-open");
    document.removeEventListener("keydown", avSheetOnKeydown);
    avSheetModel = null;
  }

  function productViewModelFromPublished(p) {
    var slug = categoryToRoomSlug(p.category || "decor");
    return productViewModelFromApi(
      {
        listingId: p.id,
        productId: p.id,
        name: p.name,
        type: p.type,
        designer: p.designer,
        price: p.price,
        description: p.description || "",
        media: Array.isArray(p.media) ? p.media : [],
        previewMediaId: p.previewMediaId || "",
        preview: p.preview || null,
        image: p.image || "",
      },
      slug
    );
  }

  function productViewModelFromApi(p, roomSlug) {
    var media = Array.isArray(p.media) ? p.media.filter(function (m) { return m && m.url; }) : [];
    if (!media.length) {
      var u = resolveProductPreview(p);
      if (u) media = [{ id: "m0", kind: "image", url: u }];
    }
    return {
      listingId: p.listingId || "",
      productId: p.productId || p.id || "",
      name: p.name || "Товар",
      type: p.type || "",
      designer: p.designer || "Автор",
      price: Number(p.price || 0),
      description: String(p.description || "").trim(),
      media: media,
      roomSlug: roomSlug || p.category || "",
    };
  }

  function productViewModelFromDom(card) {
    if (!card) return null;
    if (card.classList.contains("profile-product")) {
      var pn = card.querySelector(".profile-product__name");
      var pm = card.querySelector(".profile-product__meta");
      var pp = card.querySelector(".profile-product__price");
      var pimg = card.querySelector(".profile-product__image-wrap img") || card.querySelector("img");
      var pname = pn ? pn.textContent.trim() : "";
      var price = parseRub(pp);
      if (price === null) price = 0;
      var imgSrc = pimg ? String(pimg.getAttribute("src") || "").trim() : "";
      var media = imgSrc ? [{ id: "dom", kind: "image", url: imgSrc }] : [];
      var pt = document.querySelector(".profile-title");
      var designerName = pt ? pt.textContent.trim() : "";
      var dc = card.getAttribute("data-cat") || "";
      return {
        listingId: "",
        productId: cardProductId(card),
        name: pname || "Товар",
        type: pm ? pm.textContent.trim() : "",
        designer: designerName,
        price: price,
        description: "",
        media: media,
        roomSlug: categoryToRoomSlug(dc || "decor"),
      };
    }
    var nameEl = card.querySelector(".product-card__name");
    var typeEl = card.querySelector(".product-card__type");
    var studioEl = card.querySelector(".product-card__studio");
    var priceEl = card.querySelector(".product-card__price");
    var img = card.querySelector(".product-card__image img");
    var name = nameEl ? nameEl.textContent.trim() : "";
    var price = parseRub(priceEl);
    if (price === null) price = 0;
    var imgSrc = img ? String(img.getAttribute("src") || "").trim() : "";
    var media = imgSrc ? [{ id: "dom", kind: "image", url: imgSrc }] : [];
    return {
      listingId: "",
      productId: cardProductId(card),
      name: name || "Товар",
      type: typeEl ? typeEl.textContent.trim() : "",
      designer: studioEl ? studioEl.textContent.trim() : "",
      price: price,
      description: "",
      media: media,
      roomSlug: "",
    };
  }

  /** Статические карточки в designer-*.html: превью с плавающей «В корзину» и клик по карточке в модалку. */
  function initProfileStaticProductCards() {
    document.querySelectorAll(".profile-grid .profile-product").forEach(function (art) {
      if (art.querySelector(".profile-product__image-wrap")) return;
      var img = art.querySelector(":scope > img");
      if (!img) return;
      var wrap = document.createElement("div");
      wrap.className = "profile-product__image-wrap";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "product-card__cart-float";
      btn.setAttribute("title", "В корзину");
      btn.setAttribute("aria-label", "В корзину");
      btn.innerHTML =
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>';
      art.insertBefore(wrap, img);
      wrap.appendChild(btn);
      wrap.appendChild(img);
      art.classList.add("profile-product--qv");
    });
  }

  function initProductQuickView() {
    document.addEventListener(
      "click",
      function (e) {
        var floatBtn = e.target.closest(".product-card__cart-float");
        if (floatBtn) {
          e.preventDefault();
          e.stopPropagation();
          var c = floatBtn.closest(".product-card, .profile-product");
          var m =
            c && c._avProductView
              ? c._avProductView
              : c
                ? productViewModelFromDom(c)
                : null;
          if (m) {
            var imgFly =
              (c && (c.querySelector(".product-card__image img") || c.querySelector(".profile-product__image-wrap img"))) ||
              (c && c.querySelector("img")) ||
              floatBtn;
            addToCartFromViewModel(m, imgFly);
          }
          return;
        }
        if (e.target.closest(".product-card__add")) return;
        if (e.target.closest("#av-product-sheet")) return;

        var card = e.target.closest(".product-card--qv");
        if (!card && document.body.classList.contains("page-room")) {
          card = e.target.closest(".shelf-zone__grid .product-card");
        }
        if (!card) {
          card = e.target.closest(".profile-grid .profile-product--qv");
        }
        if (!card) {
          card = e.target.closest(".profile-grid .profile-product");
        }
        if (!card) return;

        var model = card._avProductView || productViewModelFromDom(card);
        if (!model || !model.name) return;
        e.preventDefault();
        openAvProductSheet(model);
      },
      true
    );
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
    var roomPageSlug = categoryToRoomSlug(cat);

    function shuffleShelfGrids() {
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

    function paint(items) {
      items.forEach(function (p, i) {
        var tier = p.tier || fallbackTier[i % fallbackTier.length];
        var width = p.width || fallbackWidth[i % fallbackWidth.length];
        var zoneIdx = tier === "tier-top" ? 0 : tier === "tier-mid" ? 1 : 2;
        var zone = zones[zoneIdx] || zones[i % zones.length];
        var li = document.createElement("li");
        li.setAttribute("data-dynamic-product", "1");
        var wSlot = String(width || "width-standard").replace(/^width-/, "");
        if (wSlot !== "narrow" && wSlot !== "wide") wSlot = "standard";
        li.className = "shelf-slot shelf-slot--" + wSlot;
        li.innerHTML =
          '<article class="product-card product-card--qv">' +
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
          '<div class="product-card__image">' +
          '<button type="button" class="product-card__cart-float" title="В корзину" aria-label="В корзину">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>' +
          "</button>" +
          '<img src="' +
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
        var article = li.querySelector(".product-card");
        if (article) article._avProductView = productViewModelFromApi(p, roomPageSlug);
      });
    }

    var roomSlug = categoryToRoomSlug(cat);
    fetch(mediaApi("/api/rooms/" + roomSlug))
      .then(function (res) {
        if (!res.ok) throw new Error("rooms api failed");
        return res.json();
      })
      .then(function (data) {
        var serverItems = data && Array.isArray(data.items) ? data.items : [];
        zones.forEach(function (ul) {
          ul.innerHTML = "";
        });
        paint(serverItems);
        shuffleShelfGrids();
        initAddToCart();
      })
      .catch(function () {
        var localItems = getArrayStore(PRODUCT_PUBLISHED_KEY).filter(function (p) {
          return p && p.category === cat;
        });
        paint(localItems);
        shuffleShelfGrids();
        initAddToCart();
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
    var emptyMsg = grid.querySelector("[data-profile-empty-msg]");
    if (emptyMsg) emptyMsg.remove();
    var items = getArrayStore(PRODUCT_PUBLISHED_KEY).filter(function (p) {
      return p && normalizeDesignerName(p.designer || "") === designer;
    });
    items.forEach(function (p) {
        var article = document.createElement("article");
        article.className = "profile-product profile-product--qv";
        article.setAttribute("data-dynamic-profile", "1");
        article.setAttribute("data-cat", p.category || "decor");
        article.setAttribute("data-mat", p.material || "ceramic");
        article.innerHTML =
          '<div class="profile-product__image-wrap">' +
          '<button type="button" class="product-card__cart-float" title="В корзину" aria-label="В корзину">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>' +
          "</button>" +
          '<img src="' +
          escapeHtml(resolveProductPreview(p)) +
          '" alt="' +
          escapeHtml(p.name || "Товар") +
          '" />' +
          "</div>" +
          '<div class="profile-product__body"><h3 class="profile-product__name">' +
          escapeHtml(p.name || "Товар") +
          '</h3><p class="profile-product__meta">' +
          escapeHtml(p.type || "") +
          '</p><p class="profile-product__price">' +
          formatRub(Number(p.price) || 0) +
          "</p></div>";
        article._avProductView = productViewModelFromPublished(p);
        grid.appendChild(article);
      });
    if (items.length === 0) {
      var p = document.createElement("p");
      p.className = "profile-grid__empty";
      p.setAttribute("data-profile-empty-msg", "");
      p.textContent =
        "Здесь появятся товары после публикации заявок с этим автором в поле «как подписать на витрине».";
      grid.appendChild(p);
    }
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
    if (!form) return;
    var isSellerCabinet = document.body.classList.contains("page-seller");
    var list = document.querySelector("[data-mod-list]");
    var queueCount = document.querySelector("[data-queue-count]");
    var empty = document.querySelector("[data-mod-empty]");
    var tpl = document.querySelector("#mod-card-template");
    if (!isSellerCabinet && (!list || !queueCount || !empty || !tpl)) return;
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
      if (!queueCount || !empty) return;
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
          description: String(item.description || "").trim(),
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
      if (!list || !tpl) return;
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
            description: String(fd.get("description") || "").trim(),
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
          if (isSellerCabinet) {
            if (msg) msg.textContent = "Отправляем заявку на сервер...";
            return publishItem(item).then(function () {
              form.reset();
              fillPreviewChoices();
              if (msg) {
                msg.classList.remove("is-error");
                msg.classList.add("is-success");
                msg.textContent = "Товар отправлен на модерацию. Статус смотрите в списке «Мои карточки на сервере».";
              }
            });
          }
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
        .catch(function (err) {
          if (!msg) return;
          msg.classList.remove("is-success");
          msg.classList.add("is-error");
          var em = err && err.message ? String(err.message) : "";
          if (isSellerCabinet && em && em !== "upload failed") {
            msg.textContent = em;
          } else if (isSellerCabinet && em === "save failed") {
            msg.textContent = "Не удалось сохранить заявку. Проверьте вход и API.";
          } else {
            msg.textContent =
              "Не удалось загрузить медиа. Проверьте backend media API и ограничения формата/размера.";
          }
        })
        .finally(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
    });

    if (list) {
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

  function submitSellerApplication(form, msgEl, btn) {
    var key = cfg.web3AccessKey && String(cfg.web3AccessKey).trim();
    if (!key) {
      if (msgEl) {
        msgEl.classList.remove("is-error");
        msgEl.classList.add("is-success");
        msgEl.textContent = "Заявка принята (демо). Добавьте web3AccessKey в js/site-config.js.";
      }
      return Promise.resolve({ demo: true });
    }
    var fd = new FormData(form);
    fd.append("access_key", key);
    fd.append("subject", "Заявка продавца — Алтай-Витрин");
    if (btn) btn.disabled = true;
    return fetch("https://api.web3forms.com/submit", {
      method: "POST",
      body: fd,
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (!data || !data.success) {
          throw new Error((data && data.message) || "Ошибка отправки");
        }
        if (msgEl) {
          msgEl.classList.remove("is-error");
          msgEl.classList.add("is-success");
          msgEl.textContent = "Заявка отправлена. Мы свяжемся с вами.";
        }
        return { ok: true };
      })
      .catch(function (err) {
        if (msgEl) {
          msgEl.classList.remove("is-success");
          msgEl.classList.add("is-error");
          msgEl.textContent = (err && err.message) || "Ошибка сети. Проверьте web3forms key.";
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
    document.addEventListener("av-products-changed", initAddToCart);
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
        var emailInput = form.querySelector('input[name="email"]');
        var pwInput = form.querySelector('input[name="password"]');
        var emailRaw = emailInput ? emailInput.value.trim() : "";
        var pwVal = pwInput ? pwInput.value : "";
        var activeLoginBtn = event.submitter || form.querySelector('[type="submit"]');

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
                  (res.data && res.data.error) || "Неверный логин или пароль.";
              }
              return;
            }
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
                    "Неверный логин или пароль. Зарегистрируйтесь через VK или проверьте связь с сервером.";
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
                    "Сервер входа недоступен. Проверьте соединение или зарегистрируйтесь через VK (офлайн-режим — только демо после регистрации).";
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
        submitSellerApplication(form, msg, submitBtn).then(function (res) {
          if (res && res.ok) {
            form.reset();
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

  function roomSlugToCatalogPage(slug) {
    var map = {
      lighting: "room-lighting.html",
      texture: "room-texture.html",
      decor: "room-decor.html",
      furniture: "room-furniture.html",
    };
    return map[String(slug || "").toLowerCase()] || "catalog.html";
  }

  function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  /** Главная: «Может вам понравиться» — случайные активные товары с полок (API всех комнат). */
  function initHomeShelfPicks() {
    var ul = document.querySelector("[data-home-picks]");
    if (!ul) return;

    var roomSlugs = ["lighting", "texture", "decor", "furniture"];
    var maxCards = 4;

    Promise.all(
      roomSlugs.map(function (slug) {
        return fetch(mediaApi("/api/rooms/" + slug))
          .then(function (res) {
            return res.ok ? res.json() : { items: [] };
          })
          .catch(function () {
            return { items: [] };
          })
          .then(function (data) {
            var items = (data && data.items) || [];
            return items.map(function (p) {
              return { p: p, roomSlug: slug };
            });
          });
      })
    )
      .then(function (buckets) {
        var merged = [];
        buckets.forEach(function (part) {
          merged = merged.concat(part);
        });
        var seen = Object.create(null);
        merged = merged.filter(function (entry) {
          var id = String((entry.p && entry.p.listingId) || (entry.p && entry.p.productId) || "");
          if (!id) return true;
          if (seen[id]) return false;
          seen[id] = true;
          return true;
        });
        merged = shuffleArray(merged);
        var pick = merged.slice(0, maxCards);

        ul.innerHTML = "";
        if (!pick.length) {
          var emptyLi = document.createElement("li");
          emptyLi.className = "home-picks__placeholder";
          emptyLi.textContent = "На полках пока нет активных товаров — загляните позже или откройте каталог.";
          ul.appendChild(emptyLi);
          return;
        }

        pick.forEach(function (entry) {
          var p = entry.p;
          var li = document.createElement("li");
          var alt = escapeHtml(String((p.name || "") + " — " + (p.type || "")).trim() || "Товар");
          var priceStr = formatRub(Number(p.price) || 0).replace(" ₽", ' <span class="ruble">₽</span>');
          li.innerHTML =
            '<article class="product-card product-card--qv">' +
            '<p class="product-card__studio">' +
            escapeHtml(p.designer || "Автор") +
            '</p><div class="product-card__image">' +
            '<button type="button" class="product-card__cart-float" title="В корзину" aria-label="В корзину">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>' +
            "</button>" +
            '<img src="' +
            escapeHtml(resolveProductPreview(p)) +
            '" alt="' +
            alt +
            '" width="366" height="356" loading="lazy" /></div><div class="product-card__body"><h3 class="product-card__name">' +
            escapeHtml(p.name || "Товар") +
            '</h3><p class="product-card__type">' +
            escapeHtml(p.type || "") +
            '</p><p class="product-card__price">' +
            priceStr +
            "</p></div></article>";
          ul.appendChild(li);
          var art = li.querySelector(".product-card");
          if (art) art._avProductView = productViewModelFromApi(p, entry.roomSlug);
        });
        initAddToCart();
      })
      .catch(function () {
        ul.innerHTML =
          '<li class="home-picks__placeholder">Не удалось загрузить витрину. Проверьте соединение или зайдите позже.</li>';
      });
  }

  /** Статические карточки в room-*.html: классы слота по бейджу ширины (сетка 8 долей на ряд). */
  function initShelfSlotWidthsFromBadges() {
    if (!document.body || !document.body.classList.contains("page-room")) return;
    document.querySelectorAll(".shelf-zone__grid > li:not(.shelf-slot)").forEach(function (li) {
      var badge = li.querySelector('[class*="shelf-badge--width-"]');
      if (!badge) return;
      var cls = badge.className || "";
      var kind = "";
      if (cls.indexOf("shelf-badge--width-wide") >= 0) kind = "wide";
      else if (cls.indexOf("shelf-badge--width-narrow") >= 0) kind = "narrow";
      else if (cls.indexOf("shelf-badge--width-standard") >= 0) kind = "standard";
      if (!kind) return;
      li.classList.add("shelf-slot", "shelf-slot--" + kind);
    });
  }

  function initProductDescriptionExampleCopy() {
    document.addEventListener("click", function (ev) {
      var btn = ev.target.closest(".desc-example__copy");
      if (!btn) return;
      ev.preventDefault();
      var block = btn.closest(".desc-example");
      var pre = block && block.querySelector(".desc-example__pre");
      if (!pre) return;
      var text = pre.textContent;
      function markOk() {
        var prev = btn.textContent;
        btn.textContent = "Скопировано";
        setTimeout(function () {
          btn.textContent = prev;
        }, 1500);
      }
      function fallback() {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
        } catch (eC) {}
        document.body.removeChild(ta);
        markOk();
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(markOk).catch(fallback);
      } else {
        fallback();
      }
    });
  }

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
  initShelfSlotWidthsFromBadges();
  initVkBotChatLinks();
  initProductDescriptionExampleCopy();
  initSellerServerListings();
  initAdminProductModeration();
  initServerPendingModeration();
  renderDynamicRoomProducts();
  initProfileStaticProductCards();
  renderDynamicProfileProducts();
  initAddToCart();
  renderCartPage();
  initCatalogSearch();
  initHubSearch();
  initHomeShelfPicks();
  initProductQuickView();
  initShelfShuffle();
})();
