(function () {
  var CART_KEY = "av-cart-v1";
  var AUTH_KEY = "av-auth";
  var cfg = typeof window.SITE_CONFIG !== "undefined" ? window.SITE_CONFIG : {};

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

  function setAuth(email) {
    sessionStorage.setItem(AUTH_KEY, JSON.stringify({ email: email, t: Date.now() }));
  }

  function clearAuth() {
    sessionStorage.removeItem(AUTH_KEY);
  }

  function updateAuthNav() {
    var loginLink = document.querySelector('nav a[href="login.html"]');
    if (!loginLink) return;
    var auth = getAuth();
    if (auth && auth.email) {
      loginLink.textContent = "Выйти";
      loginLink.setAttribute("href", "#");
      loginLink.setAttribute("data-auth-logout", "");
      loginLink.classList.add("nav-logout");
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
    var section = input.closest("section") || document;
    var cards = section.querySelectorAll(".product-card");
    input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase();
      cards.forEach(function (card) {
        var blob = card.textContent.toLowerCase();
        card.hidden = q.length > 0 && blob.indexOf(q) === -1;
      });
    });
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
    var cards = Array.from(profileLayout.querySelectorAll(".profile-product"));
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
        var email = emailInput ? emailInput.value.trim() : "";
        setAuth(email);
        if (msg) {
          msg.classList.remove("is-error");
          msg.classList.add("is-success");
          msg.textContent = "Вход выполнен. Переходим в каталог…";
        }
        form.querySelectorAll("input, textarea").forEach(function (el) {
          if (el.type !== "email") el.value = "";
        });
        setTimeout(function () {
          window.location.href = "catalog.html";
        }, 600);
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
    });
  });

  /* ——— Images fallback ——— */
  document.querySelectorAll("img").forEach(function (img) {
    img.addEventListener("error", function () {
      if (img.dataset.fallbackApplied) return;
      img.dataset.fallbackApplied = "1";
      img.src = "https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=800&q=80";
    });
  });

  /* ——— Boot ——— */
  ensureCartBadge();
  updateCartBadge();
  updateAuthNav();
  initAddToCart();
  renderCartPage();
  initCatalogSearch();
})();
