import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";

const LANGUAGE_STORAGE_KEY = "judgify_language";

export const supportedLanguages = [
  { code: "en", label: "EN", name: "English" },
  { code: "uk", label: "UA", name: "Українська" },
];

const dictionaries = {
  en: {
    splash: {
      starting: "Starting backend and database...",
      loadingDemo: "Loading demo competitions...",
      waitingApi: "Waiting for API connection...",
    },
    header: {
      goHome: "Go to landing page",
      search: "Search",
      language: "Language",
      signUp: "Sign Up",
      signIn: "Sign In",
      profile: "Profile",
    },
    auth: {
      close: "Close",
      signUpTitle: "Sign Up",
      username: "Username",
      usernamePlaceholder: "Enter your username",
      emailAddress: "Email address",
      email: "Email",
      emailPlaceholder: "Enter your email address",
      password: "Password",
      passwordPlaceholder: "Password",
      createPassword: "Create your password",
      confirmPassword: "Confirm your password",
      confirmPasswordLabel: "Confirm your password",
      togglePassword: "Toggle password visibility",
      showPassword: "Show",
      hidePassword: "Hide",
      rolePrompt: "I want to join as:",
      chooseRole: "Choose account role",
      alreadyHaveAccount: "Already have an account?",
      logIn: "Log In",
      welcomeBack: "Welcome back",
      signInCaption: "Sign in to manage saved competitions, applications and organizer tools.",
      signingIn: "Signing in...",
      signInAction: "Sign in",
      or: "OR",
      continueOrganizerDemo: "Continue as organizer demo",
      continueAdminDemo: "Continue as administrator demo",
      noAccount: "No account yet?",
      createAccount: "Create account",
      fillRequired: "Please fill in all required fields.",
      passwordsMismatch: "Passwords do not match.",
      enterEmailPassword: "Enter email and password.",
    },
    onboarding: {
      title: "Tell us more",
      subtitle: "Choose your interests",
      secondary: "You can update this later in your profile.",
      interests: "Interests",
      interestPlaceholder: "Type interest and press Enter",
      createTeam: "Create team after registration",
      continue: "Continue",
    },
    roles: {
      organizer: "Organizer",
      participant: "Participant",
      viewer: "Viewer",
      admin: "Administrator",
    },
    account: {
      currentUser: "Current user",
      user: "User",
      openProfile: "Open profile",
      switchAccount: "Switch account",
      signOut: "Sign out",
      accountMenu: "Account menu",
    },
    filters: {
      title: "Filters:",
      status: "Competition status:",
      eventType: "Tournament type:",
      participationType: "Type of participation:",
      industry: "Industry:",
      difficulty: "Difficulty:",
      language: "Language:",
      reset: "Reset Filters",
    },
    landing: {
      loading: "Loading...",
    },
    sidebar: {
      recentlyViewed: "Recently Viewed",
      emptyRecent: "No recently viewed items yet.",
      competitions: "Competitions",
      materials: "Materials",
      saved: "Saved",
      emptySaved: "No saved competitions yet.",
      openCompetition: "Open {name}",
      comments: "{count} comments",
    },
    competitionHeader: {
      alreadyParticipating: "Already participating",
      pendingReview: "Pending review",
      requestRejected: "Request rejected",
      join: "Join Competition",
      round: "Round: {current}/{total}",
      team: "Team: {name} - {status}",
      edit: "Edit competition",
    },
    competitionSidebar: {
      round: "Round:",
      category: "Category:",
      dates: "Dates:",
      difficulty: "Difficulty:",
      language: "Language:",
      upcomingEvent: "Upcoming event",
      downloads: "Downloads",
    },
    joinModal: {
      title: "Join Competition",
      description: "Submit a participation request. Depending on the access model, it can be approved immediately or reviewed by organizer/administrator.",
      individual: "Individual participant",
      team: "Team participant",
      teamName: "Team name",
      teamPlaceholder: "Enter team name or create a new team",
      note: "Request note",
      notePlaceholder: "Optional note for organizer/admin",
      teamRequired: "Team name is required for team participation.",
      submitError: "Could not submit join request.",
      cancel: "Cancel",
      submitting: "Submitting...",
      joinNow: "Join now",
      submitReview: "Submit for review",
    },
    tabs: {
      active: "Active competitions",
      trending: "Trending",
      new: "New",
      open_submission: "Open Submission",
      live_stream: "Live Stream",
      completed: "Finished & archived",
    },
    card: {
      noTimer: "No timer",
      save: "Save competition",
      removeSaved: "Remove from saved",
      round: "Round: {current}/{total}",
      participants: "{count} participants",
      pendingReview: "Pending review",
      dayShort: "d",
    },
    statuses: {
      active: "Online",
      draft: "Draft",
      published: "Published",
      finished: "Finished",
      judging: "Judging",
      archived: "Archived",
      registration_open: "Registration open",
      upcoming: "Upcoming",
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
      withdrawn: "Withdrawn",
    },
  },
  uk: {
    splash: {
      starting: "Запускаємо бекенд і базу даних...",
      loadingDemo: "Завантажуємо демо-змагання...",
      waitingApi: "Очікуємо з'єднання з API...",
    },
    header: {
      goHome: "Перейти на головну сторінку",
      search: "Пошук",
      language: "Мова",
      signUp: "Реєстрація",
      signIn: "Вхід",
      profile: "Профіль",
    },
    auth: {
      close: "Закрити",
      signUpTitle: "Реєстрація",
      username: "Ім'я користувача",
      usernamePlaceholder: "Введіть ім'я користувача",
      emailAddress: "Електронна пошта",
      email: "Email",
      emailPlaceholder: "Введіть електронну пошту",
      password: "Пароль",
      passwordPlaceholder: "Пароль",
      createPassword: "Створіть пароль",
      confirmPassword: "Підтвердіть пароль",
      confirmPasswordLabel: "Підтвердження пароля",
      togglePassword: "Показати або приховати пароль",
      showPassword: "Показати",
      hidePassword: "Сховати",
      rolePrompt: "Я хочу приєднатися як:",
      chooseRole: "Виберіть роль облікового запису",
      alreadyHaveAccount: "Вже маєте обліковий запис?",
      logIn: "Увійти",
      welcomeBack: "Раді бачити знову",
      signInCaption: "Увійдіть, щоб керувати збереженими змаганнями, заявками та інструментами організатора.",
      signingIn: "Входимо...",
      signInAction: "Увійти",
      or: "АБО",
      continueOrganizerDemo: "Увійти як демо-організатор",
      continueAdminDemo: "Увійти як демо-адміністратор",
      noAccount: "Ще немає облікового запису?",
      createAccount: "Створити обліковий запис",
      fillRequired: "Заповніть усі обов'язкові поля.",
      passwordsMismatch: "Паролі не збігаються.",
      enterEmailPassword: "Введіть email і пароль.",
    },
    onboarding: {
      title: "Розкажіть більше",
      subtitle: "Оберіть інтереси",
      secondary: "Це можна змінити пізніше у профілі.",
      interests: "Інтереси",
      interestPlaceholder: "Введіть інтерес і натисніть Enter",
      createTeam: "Створити команду після реєстрації",
      continue: "Продовжити",
    },
    roles: {
      organizer: "Організатор",
      participant: "Учасник",
      viewer: "Гість",
      admin: "Адміністратор",
    },
    account: {
      currentUser: "Поточний користувач",
      user: "Користувач",
      openProfile: "Відкрити профіль",
      switchAccount: "Змінити обліковий запис",
      signOut: "Вийти",
      accountMenu: "Меню облікового запису",
    },
    filters: {
      title: "Фільтри:",
      status: "Статус змагання:",
      eventType: "Тип турніру:",
      participationType: "Тип участі:",
      industry: "Галузь:",
      difficulty: "Складність:",
      language: "Мова:",
      reset: "Скинути фільтри",
    },
    landing: {
      loading: "Завантаження...",
    },
    sidebar: {
      recentlyViewed: "Нещодавно переглянуте",
      emptyRecent: "Поки немає нещодавно переглянутих елементів.",
      competitions: "Змагання",
      materials: "Матеріали",
      saved: "Збережене",
      emptySaved: "Поки немає збережених змагань.",
      openCompetition: "Відкрити {name}",
      comments: "{count} коментарів",
    },
    competitionHeader: {
      alreadyParticipating: "Вже бере участь",
      pendingReview: "Очікує розгляду",
      requestRejected: "Заявку відхилено",
      join: "Приєднатися до змагання",
      round: "Раунд: {current}/{total}",
      team: "Команда: {name} - {status}",
      edit: "Редагувати змагання",
    },
    competitionSidebar: {
      round: "Раунд:",
      category: "Категорія:",
      dates: "Дати:",
      difficulty: "Складність:",
      language: "Мова:",
      upcomingEvent: "Найближча подія",
      downloads: "Завантаження",
    },
    joinModal: {
      title: "Приєднатися до змагання",
      description: "Подайте заявку на участь. Залежно від моделі доступу її можуть схвалити автоматично або після перегляду організатором чи адміністратором.",
      individual: "Індивідуальний учасник",
      team: "Командний учасник",
      teamName: "Назва команди",
      teamPlaceholder: "Введіть назву команди або створіть нову",
      note: "Коментар до заявки",
      notePlaceholder: "Необов'язковий коментар для організатора/адміністратора",
      teamRequired: "Для командної участі потрібна назва команди.",
      submitError: "Не вдалося подати заявку на участь.",
      cancel: "Скасувати",
      submitting: "Надсилаємо...",
      joinNow: "Приєднатися",
      submitReview: "Подати на розгляд",
    },
    tabs: {
      active: "Активні змагання",
      trending: "Популярні",
      new: "Нові",
      open_submission: "Відкритий прийом робіт",
      live_stream: "Трансляція",
      completed: "Завершені й архівні",
    },
    card: {
      noTimer: "Без таймера",
      save: "Зберегти змагання",
      removeSaved: "Прибрати зі збережених",
      round: "Раунд: {current}/{total}",
      participants: "{count} учасників",
      pendingReview: "Очікує розгляду",
      dayShort: "д",
    },
    statuses: {
      active: "Онлайн",
      draft: "Чернетка",
      published: "Опубліковано",
      finished: "Завершено",
      judging: "Оцінювання",
      archived: "Архів",
      registration_open: "Реєстрація відкрита",
      upcoming: "Незабаром",
      pending: "Очікує",
      approved: "Схвалено",
      rejected: "Відхилено",
      withdrawn: "Відкликано",
    },
  },
};

function resolvePath(source, path) {
  return path.split(".").reduce((value, key) => {
    if (value && Object.prototype.hasOwnProperty.call(value, key)) {
      return value[key];
    }
    return undefined;
  }, source);
}

function interpolate(template, params) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      return params[key];
    }
    return `{${key}}`;
  });
}

function detectInitialLanguage() {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (supportedLanguages.some((item) => item.code === stored)) return stored;
  } catch {
    // Ignore storage access errors.
  }

  const browserLanguage = navigator.language || "";
  return browserLanguage.toLowerCase().startsWith("uk") ? "uk" : "en";
}

const LanguageContext = createContext(null);

function normalizeLanguage(value) {
  return supportedLanguages.some((item) => item.code === value) ? value : "";
}

function writeStoredLanguage(nextLanguage) {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  } catch {
    // Ignore storage access errors.
  }
}

export function LanguageProvider({ children }) {
  const { user, loading, updateProfile } = useAuth();
  const [language, setLanguageState] = useState(detectInitialLanguage);

  const setLanguage = useCallback((nextLanguage, options = {}) => {
    const normalized = normalizeLanguage(nextLanguage) || "en";
    setLanguageState(normalized);
    writeStoredLanguage(normalized);

    if (options.persistToAccount !== false && user && user.language !== normalized) {
      updateProfile({ language: normalized });
    }
  }, [user, updateProfile]);

  useEffect(() => {
    if (loading) return;

    const accountLanguage = normalizeLanguage(user?.language);
    if (accountLanguage) {
      if (accountLanguage !== language) {
        setLanguageState(accountLanguage);
      }
      writeStoredLanguage(accountLanguage);
      return;
    }

    if (user) {
      updateProfile({ language });
    }
  }, [language, loading, updateProfile, user]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language, setLanguage]);

  const value = useMemo(() => {
    const t = (key, params = {}) => {
      const translated =
        resolvePath(dictionaries[language], key) ??
        resolvePath(dictionaries.en, key) ??
        params.defaultValue ??
        key;
      return interpolate(translated, params);
    };

    return {
      language,
      setLanguage,
      supportedLanguages,
      t,
    };
  }, [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
