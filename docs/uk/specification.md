# Специфікація Judgify

Цей документ описує Judgify так, ніби продукт розроблявся через spec-driven development. Він є канонічною продуктовою та інженерною специфікацією платформи турнірних подій.

## 1. Продуктовий обсяг

Judgify - вебплатформа для створення, проведення, оцінювання та публікації результатів турнірних змагань. Система підтримує публічний каталог, реєстраційні workflow, індивідуальну та командну участь, багатоетапні подання, автоматичне оцінювання, ручне суддівство, peer review, лідерборди, нагороди, профілі та адміністративні операції.

Поточний production target - Render:

- `olympiad-api`: Django REST API.
- `olympiad-landing`: React/Vite frontend.
- `olympiad-db`: PostgreSQL database.

Demo environment має покривати основні сценарії: реєстрацію, активні раунди, judging, finished/archived події, команди, індивідуальні подання, оцінки, матеріали, беджі, сертифікати, оголошення, коментарі, saved competitions та admin queues.

## 2. Ролі та повноваження

Платформа має account-level ролі:

- `participant`: реєструється на змагання, входить у команди, подає роботи, бере участь у peer review, переглядає власні результати та матеріали.
- `organizer`: створює та редагує власні змагання, керує раундами, дедлайнами, критеріями, нагородами, матеріалами, оголошеннями, заявками, командами, суддями та auto-approval.
- `viewer`: переглядає публічну інформацію, зберігає змагання, бачить результати згідно з visibility policy.
- `admin`: керує користувачами, змаганнями, фільтрами, platform settings, pending organizer proposals та server/performance diagnostics.

Суддя не є окремою account-level роллю. Це користувач, який у межах конкретного змагання має:

- `CompetitionParticipant.role = judge`;
- `CompetitionJudgeAssignment` для ручного суддівства.

Правила:

- Суддя не може бути учасником або членом команди в тому самому змаганні.
- Учасник або член команди не може бути суддею цього самого змагання.
- Організатор редагує лише власні змагання.
- Адміністратор редагує всі змагання.
- UI перераховує доступні дії одразу після перемикання акаунта.

## 3. Життєвий цикл змагання

Business states:

- `draft`: чернетка організатора, не відображається в публічному каталозі.
- `published`: опубліковано, але основні етапи ще не стартували.
- `active`: триває хоча б один активний раунд.
- `judging`: триває оцінювання після або під час раундів.
- `finished`: результати завершені та доступні згідно з visibility policy.
- `archived`: історична подія без Join/Submit.

Landing status має відповідати датам і діям:

- до старту реєстрації: `Upcoming`;
- під час реєстрації: `Registration open`;
- після старту першого етапу: `Online / Active`;
- під час оцінювання: `Judging`;
- після публікації результатів: `Finished`;
- після архівації: `Archived`.

Якщо `starts_at` не задано, змагання стартує при публікації. Archived competitions не показують Join або Submit.

## 4. Раунди

Стани раунду:

- `draft`
- `scheduled`
- `active`
- `closed`
- `judged`

Наступний раунд не починається до завершення попереднього. Якщо старт наступного раунду не задано, система встановлює його як `previous_round.ends_at + 1 second`. Подання можливе лише в активному раунді та лише для approved participant/team.

## 5. Реєстрація

Стани заявки:

- `pending`
- `approved`
- `rejected`
- `withdrawn`

Заявка не означає автоматичну участь, якщо `access_mode = application`. Організатор вручну обробляє заявки або вмикає auto-approval на конкретному змаганні. Учасник бачить свої заявки, організатор - pending заявки власних змагань, адміністратор - загальні pending queues.

Повторне натискання Join не створює дубліката. Після login/register анонімний користувач повертається на сторінку того самого змагання.

## 6. Команди

Учасник може входити до кількох команд на платформі, але не може бути в кількох командах одного змагання. Команда має мінімум одного учасника та одного капітана. Капітан керує складом і може передати роль. Команда може подавати роботу від імені всієї команди.

Суддя не може бути членом команди у тому самому змаганні.

## 7. Подання робіт

Подання прив'язане до раунду та subject: індивідуального учасника або команди.

Політики:

- `single`: одне подання, повторне створення блокується;
- `latest`: оновлення замінює попереднє подання;
- `multiple`: дозволено кілька подань.

Стани:

- `created`
- `validated`
- `accepted`
- `rejected`
- `locked`

Після deadline подання блокується. До deadline participant/team може оновлювати подання лише якщо це дозволено policy раунду.

## 8. Матеріали

Матеріали підтримують:

- файли;
- посилання;
- відео;
- репозиторії;
- текстові описи.

Файли зберігаються в `MEDIA_ROOT` або object storage. База зберігає лише metadata. Максимальний розмір файлу задається організатором і перевіряється на backend.

## 9. Оцінювання

Підтримувані режими:

- `automatic`: автоматичні оцінки за правилами або fixtures;
- `manual`: запрошені судді виставляють бали за критеріями;
- `peer_review`: оцінювання approved participants або viewers, якщо дозволено;
- `mixed`: комбінація режимів.

Суддів визначає організатор. Суддя бачить вкладку Judging, список поданих робіт, критерії, модальні описи критеріїв і поля для балів/коментарів.

Оцінка має бути прив'язана до:

- судді;
- submission;
- round;
- criterion;
- subject: participant або team.

Система не створює дублікати оцінки для тієї самої комбінації judge/submission/criterion. Суддя може редагувати власну оцінку до завершення judging deadline. Judging window за замовчуванням збігається з window змагання, якщо окремі дати не задані.

## 10. Результати та leaderboard

Leaderboard формується за aggregated scores. Підтримуються aggregation modes:

- `average`
- `sum`

Результати групуються за participant або team, враховують усі релевантні раунди та сортуються за спаданням score. Організатор може бачити preview до публікації. Учасники бачать Results після відкриття результатів. Порожні або дубльовані рядки не допускаються.

## 11. Профіль

Профіль показує:

- active competitions;
- archived competitions;
- teams;
- pending заявки;
- badges;
- certificates;
- saved competitions;
- recently viewed competitions;
- latest notifications.

Секції не дублюються. Viewer бачить saved competitions. Admin не потребує вкладки "Мої змагання"; для організатора така вкладка замінюється на "Мої чернетки" для draft competitions.

## 12. Landing page

Landing page показує актуальні змагання та останні змагання окремо. Archived не змішується з активними. Вкладки організовані за статусами. Таймер на картці показує час до найближчої важливої події; якщо до deadline менше 5 хвилин, він виділяється. Archived competitions не показують таймер.

Saved state не змішується між акаунтами та очищується з UI після logout.

## 13. Оголошення та коментарі

Організатор додає оголошення у вкладці Overview. Учасники бачать їх на сторінці змагання. Коментарі доступні, якщо це дозволено налаштуваннями. Організатор може редагувати або видаляти власні оголошення. Учасник не може редагувати оголошення організатора.

Коментарі повинні відображатися у профілі автора як частина останніх активностей або сповіщень.

## 14. Адміністрування

Admin panel доступна з профілю адміністратора. Вона містить:

- керування users;
- керування competitions;
- pending organizer requests;
- landing filters, які можна додавати, редагувати або приховувати, але не видаляти повністю;
- server characteristics;
- performance diagnostics.

Розсилки вилучені з admin panel до появи повноцінного chat/notification provider.

## 15. Локалізація

Підтримуються щонайменше українська та англійська. Language preference зберігається на рівні акаунта. Перемикач мови розміщується у верхній частині UI біля auth/profile controls.

Фільтри, вкладки, описи, статуси, кнопки, validation messages та dashboard sections мають бути перекладені повністю.

## 16. Демонстраційні дані

Demo seed має бути ідемпотентним і покривати:

- registration-open competitions;
- active competitions із кількома раундами;
- judging competitions;
- finished та archived competitions;
- team та individual participation;
- manual, automatic, peer review і mixed judging;
- `average` та `sum` aggregation;
- materials із реальними demo files;
- announcements і comments;
- badges та certificates;
- saved/recently viewed competitions;
- admin pending queues;
- organizer/admin auto-approval.

Перевірка:

```bash
cd backend
python manage.py validate_demo_integrity --warnings-as-errors
```

## 17. API контракти

Ключові API:

- `GET /api/landing/competitions/`
- `GET /api/landing/sidebar/`
- `GET /api/competitions/{id}/`
- `GET /api/competitions/{id}/participants/`
- `POST /api/competitions/{id}/join/`
- `GET /api/competitions/{id}/judging/`
- `POST /api/competitions/{id}/judging/`
- `GET /api/competitions/{id}/results/`
- `GET /api/me/profile-dashboard/`
- `PATCH /api/me/profile-dashboard/`
- `/api/admin/...`

Competition card payload має містити computed status, timers, approved participant count, saved state, role-based affordances та participation state.

## 18. Критерії приймання

Перед shipping behavior changes мають проходити:

```bash
cd backend
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py validate_demo_integrity --warnings-as-errors
```

```bash
cd frontend
npm run build
```

Smoke checks:

- landing tabs містять коректні status-specific competitions;
- participant card count дорівнює кількості approved participants;
- judging tab має competitions у `judging`;
- judging rows згруповані за team/participant;
- seeded data покриває `average` і `sum`;
- Join не дублює pending requests;
- account switching одразу змінює доступні дії;
- archived competitions не показують Join/Submit.

## 19. Оцінка архітектури

Поточна архітектура має сильні сторони:

- чітке розділення React frontend, Django API та PostgreSQL;
- server-side permissions для critical workflows;
- нормалізовані сутності для competitions, rounds, participants, teams, submissions, judging, awards та profile dashboard;
- idempotent demo seed і integrity validation command;
- Render Blueprint для відтворюваного деплою.

Поточні ризики:

- частина великих списків ще залежить від frontend pagination;
- real-time поведінка таймерів і presence не має WebSocket/SSE шару;
- файли production-рівня потребують object storage та malware scanning;
- outbound messages ще не мають worker/provider integration;
- audit trail для admin/organizer дій неповний;
- автоматизоване тестове покриття має бути ширшим для ролей, дедлайнів і judging;
- observability та SLO поки недостатньо формалізовані.

## 20. Майбутні потреби в забезпеченні якості ПЗ

Потрібно розвивати QA як окремий engineering stream:

- unit tests для domain rules: статуси, дедлайни, ролі, permissions, aggregation;
- integration tests для API flows: Join, Submit, Judge, Results, Saved, Profile, Admin;
- E2E tests для основних сценаріїв через браузер;
- OpenAPI/schema контракт і contract tests між frontend та backend;
- regression tests для demo seed і `validate_demo_integrity`;
- property-based або table-driven tests для time/status transitions;
- visual regression для landing, profile, builder, judging та admin panel;
- accessibility checks для keyboard navigation, contrast, form labels, modals;
- i18n completeness checks для української та англійської;
- performance budgets для landing, competition page, profile і admin tables;
- load tests для landing API, file uploads, comments, judging save;
- security checks: dependency scan, SAST, CSRF regression, rate limiting, file upload scan;
- migration tests: forward, rollback strategy, seed compatibility;
- observability: structured logs, metrics, traces, error tracking, health checks;
- release quality gates: backend check, migration dry-run, frontend build, integrity validation, smoke tests.

## 21. Нецілі поточної версії

Поточний продукт не гарантує:

- production-grade email delivery;
- WebSocket presence;
- external payment flows;
- object storage deployment by default;
- high-volume server-side pagination для кожного endpoint;
- повний audit log/history UI.

Це валідні майбутні розширення, але їх треба специфікувати окремо перед реалізацією.

## 22. Change management

При додаванні функцій:

1. Оновити цю специфікацію до або в одному commit із реалізацією.
2. Додати або оновити backend validations і serializers.
3. Додати або оновити frontend affordances і локалізацію.
4. Додати demo seed coverage для user-visible сценарію.
5. Запустити integrity checks і build.
6. Записати помітні зміни в changelog, якщо поведінка змінилась.
