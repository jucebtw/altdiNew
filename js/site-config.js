/**
 * Подключите реальную отправку форм заказа: https://web3forms.com
 * 1) Создайте access key
 * 2) Вставьте его в web3AccessKey ниже
 *
 * Заявка продавца (contacts.html) отправляется через Web3Forms (access key ниже).
 */
window.SITE_CONFIG = {
  web3AccessKey: "",
  /**
   * true — только локальный «фейковый» код (страница с диска file:// или отладка).
   * false — на http/https всегда запрос к серверу и реальное сообщение бота ВК.
   */
  vkRegistrationDemo: false,
  /**
   * Ссылка на диалог с ботом (сообщество). Примеры:
   * https://vk.me/your_community_slug
   * https://vk.me/im?sel=-123456789  (ID группы со знаком «минус» в sel)
   */
  vkBotChatUrl: "https://vk.com/altdiru",
  /** URL backend API для регистрации через VK (если пусто — используется mediaApiBase/текущий домен) */
  vkAuthApiBase: "",
  /** URL backend API для загрузки/выдачи медиа товаров (пусто => тот же домен) */
  mediaApiBase: "",
};
