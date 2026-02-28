import { BarChart3, Layers3, Mail, MessageCircle, Send, Users } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ThemeToggleButton } from "../components/ui/ThemeToggleButton";
import { useThemeMode } from "../lib/theme";
import "../styles/landing.css";

type LangKey = "ru" | "uz";

type TranslationDict = {
  title: string;
  pill: string;
  heroTitle: string;
  heroBodyLine1: string;
  heroBodyLine2: string;
  ctaPrimary: string;
  ctaSecondary: string;
  metric1Title: string;
  metric1Note: string;
  metric2Title: string;
  metric2Note: string;
  metric3Title: string;
  metric3Note: string;
  featuresTitle: string;
  feature1Title: string;
  feature1Body: string;
  feature2Title: string;
  feature2Body: string;
  feature3Title: string;
  feature3Body: string;
  faqTitle: string;
  faqSubtitle: string;
  faqQ1: string;
  faqA1: string;
  faqQ2: string;
  faqA2: string;
  faqQ3: string;
  faqA3: string;
  faqQ4: string;
  faqA4: string;
  faqQ5: string;
  faqA5: string;
  faqQ6: string;
  faqA6: string;
  feedbackTitle: string;
  feedbackSubtitle: string;
  feedbackIntro: string;
  feedbackNameLabel: string;
  feedbackEmailLabel: string;
  feedbackMessageLabel: string;
  feedbackSubmit: string;
  feedbackSending: string;
  feedbackSuccess: string;
  feedbackError: string;
  highlightTitle: string;
  highlightBody: string;
  highlightCta: string;
  footer: string;
  footerLink: string;
  footerContactsTitle: string;
  footerTelegramLabel: string;
  footerEmailLabel: string;
  loginLink: string;
};

type Stats = {
  total_users: number;
  total_schools: number;
  total_classes: number;
};

const landingTranslations: Record<LangKey, TranslationDict> = {
  ru: {
    title: "ZEDLY - Платформа обучения",
    pill: "Новая образовательная платформа",
    heroTitle: "Обучение, которое растет вместе с вами",
    heroBodyLine1: "ZEDLY - это единая среда для учеников, учителей и администраторов.",
    heroBodyLine2: "Тесты, аналитика и управление учебным процессом в одном месте.",
    ctaPrimary: "Начать сейчас",
    ctaSecondary: "Подробнее",
    metric1Title: "Пользователи",
    metric1Note: "всего в платформе",
    metric2Title: "Школы",
    metric2Note: "подключено",
    metric3Title: "Классы",
    metric3Note: "в системе",
    featuresTitle: "Почему ZEDLY",
    feature1Title: "Аналитика в реальном времени",
    feature1Body: "Отслеживайте прогресс, вовлеченность и результаты по каждому классу.",
    feature2Title: "Модули и контрольные",
    feature2Body: "Готовые и настраиваемые модули для предметов и контрольных работ.",
    feature3Title: "Единая экосистема",
    feature3Body: "Ученики, учителя и администраторы работают в одном пространстве.",
    faqTitle: "База знаний / FAQ",
    faqSubtitle: "Ответы на частые вопросы по ролям.",
    faqQ1: "Как быстро начать работу администратору школы?",
    faqA1: "Загрузите пользователей через импорт, создайте классы и назначьте учителей по предметам.",
    faqQ2: "Что может делать учитель в системе?",
    faqA2: "Создавать тесты, назначать их классам, отслеживать результаты и прогресс учеников.",
    faqQ3: "Что видит ученик?",
    faqA3: "Доступные тесты, историю попыток, рейтинг и персональную аналитику успеваемости.",
    faqQ4: "Как работает импорт из Excel?",
    faqA4: "Скачайте шаблон, заполните поля и загрузите файл. Неизвестные классы и учителя автоматически пропускаются.",
    faqQ5: "Есть ли поддержка двух языков?",
    faqA5: "Да, интерфейс доступен на русском и узбекском языках.",
    faqQ6: "Куда обращаться при вопросах?",
    faqA6: "Напишите в Telegram-канал или на почту поддержки из блока обратной связи ниже.",
    feedbackTitle: "Обратная связь",
    feedbackSubtitle: "Оставьте сообщение, и команда поддержки ответит вам по email.",
    feedbackIntro: "Заполните форму и отправьте обращение за пару кликов.",
    feedbackNameLabel: "Имя",
    feedbackEmailLabel: "Email",
    feedbackMessageLabel: "Сообщение",
    feedbackSubmit: "Отправить",
    feedbackSending: "Отправка...",
    feedbackSuccess: "Сообщение отправлено. Мы свяжемся с вами в ближайшее время.",
    feedbackError: "Не удалось отправить сообщение. Напишите на support@zedly.uz",
    highlightTitle: "Готовы начать?",
    highlightBody: "Войдите в систему и начните использовать ZEDLY прямо сейчас.",
    highlightCta: "Войти в систему",
    footer: "© 2026 ZEDLY. Все права защищены.",
    footerLink: "Перейти к входу",
    footerContactsTitle: "Контакты:",
    footerTelegramLabel: "Telegram:",
    footerEmailLabel: "Email:",
    loginLink: "Вход"
  },
  uz: {
    title: "ZEDLY - Talim platformasi",
    pill: "Yangi talim platformasi",
    heroTitle: "Talim siz bilan birga osadi",
    heroBodyLine1: "ZEDLY - oquvchilar, oqituvchilar va administratorlar uchun yagona muhit.",
    heroBodyLine2: "Testlar, analitika va talim jarayonini boshqarish bir joyda.",
    ctaPrimary: "Boshlash",
    ctaSecondary: "Batafsil",
    metric1Title: "Foydalanuvchilar",
    metric1Note: "platformadagi jami",
    metric2Title: "Maktablar",
    metric2Note: "ulangan",
    metric3Title: "Sinflar",
    metric3Note: "tizimda",
    featuresTitle: "Nega ZEDLY",
    feature1Title: "Real vaqt analitikasi",
    feature1Body: "Har bir sinf boyicha progress va natijalarni kuzating.",
    feature2Title: "Modullar va nazoratlar",
    feature2Body: "Fanlar va nazoratlar uchun tayyor va moslanuvchi modullar.",
    feature3Title: "Yagona ekotizim",
    feature3Body: "Oquvchi, oqituvchi va administrator bir makonda ishlaydi.",
    faqTitle: "Bilim bazasi / FAQ",
    faqSubtitle: "Rollar boyicha kop soraladigan savollarga javoblar.",
    faqQ1: "Maktab administratori ishni qanday tez boshlaydi?",
    faqA1: "Foydalanuvchilarni import qiling, sinflarni yarating va oqituvchilarni fanlarga biriktiring.",
    faqQ2: "Oqituvchi tizimda nima qila oladi?",
    faqA2: "Test yaratadi, sinflarga tayinlaydi, natija va progressni kuzatadi.",
    faqQ3: "Oquvchi nimalarni koradi?",
    faqA3: "Mavjud testlar, urinishlar tarixi, reyting va shaxsiy analitika.",
    faqQ4: "Excel import qanday ishlaydi?",
    faqA4: "Shablonni yuklab oling, ustunlarni toldiring va faylni yuklang. Nomalum sinf yoki oqituvchi satrlari otkazib yuboriladi.",
    faqQ5: "Ikki tilda ishlash bormi?",
    faqA5: "Ha, interfeys rus va ozbek tillarida mavjud.",
    faqQ6: "Savol bolsa qayerga murojaat qilaman?",
    faqA6: "Quyidagi aloqa blokidagi Telegram kanal yoki support pochta orqali yozing.",
    feedbackTitle: "Qayta aloqa",
    feedbackSubtitle: "Xabar qoldiring va support jamoasi sizga email orqali javob beradi.",
    feedbackIntro: "Formani toldiring va murojaatni bir necha bosishda yuboring.",
    feedbackNameLabel: "Ism",
    feedbackEmailLabel: "Email",
    feedbackMessageLabel: "Xabar",
    feedbackSubmit: "Yuborish",
    feedbackSending: "Yuborilmoqda...",
    feedbackSuccess: "Xabar yuborildi. Tez orada siz bilan boglanamiz.",
    feedbackError: "Xabarni yuborib bolmadi. support@zedly.uz manziliga yozing.",
    highlightTitle: "Boshlashga tayyormisiz?",
    highlightBody: "Tizimga kiring va ZEDLYdan foydalanishni boshlang.",
    highlightCta: "Tizimga kirish",
    footer: "© 2026 ZEDLY. Barcha huquqlar himoyalangan.",
    footerLink: "Kirish sahifasiga otish",
    footerContactsTitle: "Kontaktlar:",
    footerTelegramLabel: "Telegram:",
    footerEmailLabel: "Email:",
    loginLink: "Kirish"
  }
};

function formatCount(value: number, lang: LangKey) {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  if (safe >= 1000) {
    const thousands = Math.floor(safe / 1000);
    return `${thousands}K+`;
  }
  const locale = lang === "uz" ? "uz-UZ" : "ru-RU";
  return safe.toLocaleString(locale);
}

export function LandingPage() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { theme, toggleTheme } = useThemeMode();
  const [lang, setLang] = useState<LangKey>(() => {
    if (typeof window === "undefined") return "ru";
    const saved = window.localStorage.getItem("landing-lang");
    return saved === "uz" ? "uz" : "ru";
  });
  const [status, setStatus] = useState("");
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [statsDisplay, setStatsDisplay] = useState<Stats>({ total_users: 0, total_schools: 0, total_classes: 0 });
  const dict = useMemo(() => landingTranslations[lang], [lang]);
  const faqItems = useMemo(
    () => [
      { q: dict.faqQ1, a: dict.faqA1 },
      { q: dict.faqQ2, a: dict.faqA2 },
      { q: dict.faqQ3, a: dict.faqA3 },
      { q: dict.faqQ4, a: dict.faqA4 },
      { q: dict.faqQ5, a: dict.faqA5 },
      { q: dict.faqQ6, a: dict.faqA6 }
    ],
    [dict]
  );

  useEffect(() => {
    document.title = dict.title;
    window.localStorage.setItem("landing-lang", lang);
  }, [dict.title, lang]);

  useEffect(() => {
    let frameId = 0;
    let cancelled = false;

    async function loadStats() {
      try {
        const response = await fetch("/api/public/landing-stats", { method: "GET" });
        if (!response.ok) return;
        const data = await response.json();
        const target: Stats = {
          total_users: Number(data?.stats?.total_users || 0),
          total_schools: Number(data?.stats?.total_schools || 0),
          total_classes: Number(data?.stats?.total_classes || 0)
        };

        const start = performance.now();
        const from = { ...statsDisplay };
        const duration = 900;
        const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

        const tick = (ts: number) => {
          if (cancelled) return;
          const progress = Math.min(1, (ts - start) / duration);
          const eased = easeOutCubic(progress);

          setStatsDisplay({
            total_users: Math.round(from.total_users + (target.total_users - from.total_users) * eased),
            total_schools: Math.round(from.total_schools + (target.total_schools - from.total_schools) * eased),
            total_classes: Math.round(from.total_classes + (target.total_classes - from.total_classes) * eased)
          });

          if (progress < 1) {
            frameId = window.requestAnimationFrame(tick);
          }
        };

        frameId = window.requestAnimationFrame(tick);
      } catch {
        // Keep fallback placeholders when API is unavailable.
      }
    }

    void loadStats();

    return () => {
      cancelled = true;
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const cards = Array.from(root.querySelectorAll<HTMLElement>(".landing-card"));
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const maxTilt = 6;

    const cleanups: Array<() => void> = [];

    cards.forEach((card) => {
      const onEnter = () => card.classList.add("is-interactive");
      const onMove = (event: PointerEvent) => {
        const rect = card.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const px = (x / rect.width) * 100;
        const py = (y / rect.height) * 100;
        card.style.setProperty("--spot-x", `${px}%`);
        card.style.setProperty("--spot-y", `${py}%`);

        if (prefersReducedMotion) return;
        const tiltX = ((y / rect.height) - 0.5) * -maxTilt;
        const tiltY = ((x / rect.width) - 0.5) * maxTilt;
        card.style.transform = `perspective(900px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) translateY(-3px)`;
      };
      const onLeave = () => {
        card.classList.remove("is-interactive");
        card.style.transform = "";
      };
      const onFocus = () => card.classList.add("is-interactive");
      const onBlur = () => {
        card.classList.remove("is-interactive");
        card.style.transform = "";
      };
      const onKey = (event: KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          card.classList.toggle("is-interactive");
        }
      };

      card.addEventListener("pointerenter", onEnter);
      card.addEventListener("pointermove", onMove);
      card.addEventListener("pointerleave", onLeave);
      card.addEventListener("focus", onFocus);
      card.addEventListener("blur", onBlur);
      card.addEventListener("keydown", onKey);

      cleanups.push(() => {
        card.removeEventListener("pointerenter", onEnter);
        card.removeEventListener("pointermove", onMove);
        card.removeEventListener("pointerleave", onLeave);
        card.removeEventListener("focus", onFocus);
        card.removeEventListener("blur", onBlur);
        card.removeEventListener("keydown", onKey);
      });
    });

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, []);

  async function onFeedbackSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    const payload = {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      message: String(formData.get("message") || "").trim(),
      lang
    };

    setStatus(dict.feedbackSending);

    try {
      const response = await fetch("/api/public/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("feedback_failed");
      }

      setStatus(dict.feedbackSuccess);
      form.reset();
    } catch {
      setStatus(dict.feedbackError);
    }
  }

  return (
    <div ref={rootRef} className="landing-page">
      <header className="landing-nav">
        <div className="landing-brand">
          <span className="landing-logo">Z</span>
          <span>ZEDLY</span>
        </div>
        <nav className="landing-actions">
          <Link className="landing-link" to="/login">
            {dict.loginLink}
          </Link>
          <span className="landing-separator">|</span>
          <button className="landing-lang-btn" onClick={() => setLang((prev) => (prev === "ru" ? "uz" : "ru"))}>
            {lang.toUpperCase()}
          </button>
          <ThemeToggleButton theme={theme} onToggle={toggleTheme} />
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-content">
            <span className="landing-pill">{dict.pill}</span>
            <h1>{dict.heroTitle}</h1>
            <p>
              <span>{dict.heroBodyLine1}</span>
              <span>{dict.heroBodyLine2}</span>
            </p>
            <div className="landing-cta">
              <Link className="landing-btn landing-btn-primary" to="/login">
                {dict.ctaPrimary}
              </Link>
              <a className="landing-btn landing-btn-outline" href="#features">
                {dict.ctaSecondary}
              </a>
            </div>
          </div>
          <div className="landing-hero-card">
            <div className="landing-metric">
              <span className="landing-metric-title">{dict.metric1Title}</span>
              <strong>{statsDisplay.total_users > 0 ? formatCount(statsDisplay.total_users, lang) : "—"}</strong>
              <small>{dict.metric1Note}</small>
            </div>
            <div className="landing-metric">
              <span className="landing-metric-title">{dict.metric2Title}</span>
              <strong>{statsDisplay.total_schools > 0 ? formatCount(statsDisplay.total_schools, lang) : "—"}</strong>
              <small>{dict.metric2Note}</small>
            </div>
            <div className="landing-metric">
              <span className="landing-metric-title">{dict.metric3Title}</span>
              <strong>{statsDisplay.total_classes > 0 ? formatCount(statsDisplay.total_classes, lang) : "—"}</strong>
              <small>{dict.metric3Note}</small>
            </div>
          </div>
        </section>

        <section className="landing-section" id="features">
          <h2>{dict.featuresTitle}</h2>
          <div className="landing-grid">
            <article className="landing-card" tabIndex={0}>
              <i>
                <BarChart3 size={18} />
              </i>
              <h3>{dict.feature1Title}</h3>
              <p>{dict.feature1Body}</p>
            </article>
            <article className="landing-card" tabIndex={0}>
              <i>
                <Layers3 size={18} />
              </i>
              <h3>{dict.feature2Title}</h3>
              <p>{dict.feature2Body}</p>
            </article>
            <article className="landing-card" tabIndex={0}>
              <i>
                <Users size={18} />
              </i>
              <h3>{dict.feature3Title}</h3>
              <p>{dict.feature3Body}</p>
            </article>
          </div>
        </section>

        <section className="landing-section" id="faq">
          <h2>{dict.faqTitle}</h2>
          <p className="landing-section-subtitle">{dict.faqSubtitle}</p>
          <div className="landing-faq-list">
            {faqItems.map((item, index) => {
              const isOpen = activeFaq === index;
              return (
                <article key={item.q} className={`landing-faq-item ${isOpen ? "is-open" : ""}`}>
                  <button
                    type="button"
                    className="landing-faq-trigger"
                    onClick={() => setActiveFaq((prev) => (prev === index ? null : index))}
                    aria-expanded={isOpen}
                  >
                    <span>{item.q}</span>
                    <span className="landing-faq-icon" aria-hidden="true">
                      {isOpen ? "×" : "+"}
                    </span>
                  </button>
                  <div className="landing-faq-content-wrap">
                    <div className="landing-faq-content">
                      <p>{item.a}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="landing-section landing-contact" id="contact">
          <h2>{dict.feedbackTitle}</h2>
          <p className="landing-section-subtitle">{dict.feedbackSubtitle}</p>
          <div className="landing-contact-grid">
            <form className="landing-contact-form" onSubmit={onFeedbackSubmit}>
              <p className="landing-form-intro">{dict.feedbackIntro}</p>
              <div className="landing-form-row">
                <div className="landing-form-field">
                  <label htmlFor="feedbackName">{dict.feedbackNameLabel}</label>
                  <input id="feedbackName" name="name" type="text" required />
                </div>
                <div className="landing-form-field">
                  <label htmlFor="feedbackEmail">{dict.feedbackEmailLabel}</label>
                  <input id="feedbackEmail" name="email" type="email" required />
                </div>
              </div>
              <div className="landing-form-field">
                <label htmlFor="feedbackMessage">{dict.feedbackMessageLabel}</label>
                <textarea id="feedbackMessage" name="message" rows={5} required />
              </div>
              <button className="landing-btn landing-btn-primary" type="submit">
                {dict.feedbackSubmit}
              </button>
              <p className="landing-feedback-status">{status}</p>
            </form>
          </div>
        </section>

        <section className="landing-section landing-highlight">
          <div>
            <h2>{dict.highlightTitle}</h2>
            <p>{dict.highlightBody}</p>
          </div>
          <Link className="landing-btn landing-btn-primary" to="/login">
            {dict.highlightCta}
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-main">
          <span className="landing-footer-copy">{dict.footer}</span>
          <Link className="landing-footer-login" to="/login">
            <Send size={16} />
            <span>{dict.footerLink}</span>
          </Link>
        </div>
        <div className="landing-footer-contacts">
          <span className="landing-footer-contacts-title">
            <MessageCircle size={16} />
            <strong>{dict.footerContactsTitle}</strong>
          </span>
          <a
            className="landing-footer-contact"
            href="https://t.me/zedly_channel"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Telegram @zedly_channel"
          >
            <Send size={15} />
            <span>{dict.footerTelegramLabel}</span>
            <span>@zedly_channel</span>
          </a>
          <a className="landing-footer-contact" href="mailto:support@zedly.uz" aria-label="Email support@zedly.uz">
            <Mail size={15} />
            <span>{dict.footerEmailLabel}</span>
            <span>support@zedly.uz</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
