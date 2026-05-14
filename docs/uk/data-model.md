# Оновлення моделі даних Judgify

Ця версія переносить профільні дані з frontend-only стану в backend-центричну модель.

## Додані та оновлені сутності backend

- `UserProfile`: публічний профіль, роль, біо, організація, навички, інтереси, посилання на аватар.
- `UserFile`: метадані всіх файлів користувачів і змагань. База зберігає лише метадані та storage key, не binary content.
- `RecentlyViewedCompetition`: нормалізована історія переглядів із `viewed_at` та `view_count`.
- `Badge` / `UserBadge`: каталог беджів та видані беджі.
- `Certificate`: метадані сертифіката, пов'язаного з файлом і змаганням.
- `UserMaterial`: особисті матеріали, сертифікати, ресурси, подання, нотатки та фідбек.
- `Competition.status`: підтримує `draft` для чернеток організатора.

## Profile API

`GET /api/me/profile-dashboard/` повертає агрегований профіль:

- `user`
- `profile`
- `active_competitions`
- `saved_competitions`
- `recently_viewed`
- `archived_competitions`
- `draft_competitions`
- `badges`
- `certificates`
- `materials`
- `stats`

`PATCH /api/me/profile-dashboard/` оновлює поля профілю.

## Стратегія зберігання файлів

Великі файли не мають зберігатися в рядках relational database. Файлові байти слід тримати в object storage, а в базі залишати лише метадані.

Рекомендовані production варіанти: Amazon S3, Cloudflare R2, Google Cloud Storage, Azure Blob Storage. Для локальної розробки можна використовувати MinIO у Docker Compose або змонтований Docker volume.

Рекомендований формат `storage_key`:

```text
users/{user_id}/avatars/{uuid}.webp
users/{user_id}/certificates/{uuid}.pdf
competitions/{competition_id}/attachments/{uuid}.zip
competitions/{competition_id}/submissions/{user_id}/{uuid}.zip
```

Приватні завантаження повинні проходити через backend permission checks і короткоживучі signed URLs.

## Участь, approval та команди

Участь моделюється окремим workflow, а не локальним frontend прапорцем. Один користувач може мати тільки один `CompetitionParticipant` record у межах одного змагання. Це блокує дублікати заявок і не дозволяє показувати Join користувачу, який уже pending або approved.

Стани workflow:

- `pending`: користувач подав заявку та чекає approval організатора або адміністратора;
- `approved`: користувача допущено, він входить до активного складу змагання;
- `rejected`: заявку відхилено;
- `withdrawn`: користувач скасував заявку або вийшов.

Командна участь представлена `CompetitionTeam` та пов'язаними `CompetitionParticipant` records. Команда має власний статус (`draft`, `pending`, `approved`, `rejected`, `archived`) і капітана.

Frontend не повинен виводити участь з локальних списків карток. Він має використовувати API-поля:

- `user_participation_status`;
- `user_participation_role`;
- `user_team`;
- `can_join`.

Кнопка Join активна лише коли `can_join=true`. Для `pending` UI показує "Очікує підтвердження", для `approved` - "Ви вже учасник".

## Конструктор змагання

Конструктор використовує одну чернетку змагання замість окремої чернетки на кожен крок. Змагання зі `status = draft` зберігає `setup_step` та `completion_percent`, тому організатор може перервати налаштування і повернутися без створення кількох часткових сутностей.

Етапи налаштування:

1. `Basics`: назва, описи, категорія, складність, тип події, cover/banner.
2. `Format & Access`: `access_mode`, тип участі, обмеження команд, видимість.
3. `Schedule`: реєстрація, дати змагання, judging, публікація результатів.
4. `Content & Evaluation`: раунди, правила подання, критерії, нагороди.
5. `Publish`: валідація, preview, запрошення та outbound messages.

## Запрошення та черга повідомлень

`CompetitionInvitation` і `OutboundMessage` дозволяють конструктору поставити запрошення в чергу. На цьому етапі повідомлення зберігаються зі `status = queued`; майбутній worker або provider integration має надсилати їх через email, platform notifications або інший канал.
