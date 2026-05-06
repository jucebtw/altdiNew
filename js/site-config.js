/**
 * Подключите реальную отправку форм: https://web3forms.com
 * 1) Создайте access key
 * 2) Вставьте его в web3AccessKey ниже
 *
 * Админ-панель: почта из adminEmails (регистр не важен). Если для почты задан adminPasswords — нужен этот пароль.
 */
window.SITE_CONFIG = {
  web3AccessKey: "",
  /**
   * true — только локальный «фейковый» код (страница с диска file:// или отладка).
   * false — на http/https всегда запрос к серверу и реальное сообщение бота ВК.
   */
  vkRegistrationDemo: false,
  /** URL backend API для регистрации через VK (если пусто — используется mediaApiBase/текущий домен) */
  vkAuthApiBase: "",
  /** URL backend API для загрузки/выдачи медиа товаров (пусто => тот же домен) */
  mediaApiBase: "",
  /** Почты с правами администратора */
  adminEmails: ["admin@altdi.ru", "admin@altay-vitrin.ru"],
  /** Пароли для указанных админ-почт (остальные админы из списка выше — любой пароль от 6 символов) */
  adminPasswords: {
    "admin@altdi.ru": "Demo123!",
  },
};
