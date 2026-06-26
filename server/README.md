# Playable Studio — server

Хранит и отдаёт HTML-страницы (playables). Страницы лежат в `server/pages/`
(в git не попадают). SPA на GitHub Pages обращается к этому серверу через ngrok.

Код на TypeScript (ESM). В разработке запускается через `tsx` без сборки;
для прода компилируется `tsc` в `dist/`.

## Что нужно установить

- **Node.js 22+** — сервер и тулчейн (`tsx`, `tsc`).
- **Docker** — **обязательно** для AI-агента. Агент запускается в одноразовом
  изолированном контейнере; без Docker эндпоинт `/agent` работать не будет
  (остальной сервер — хранилище и отдача страниц — работает и без него).
- **Claude CLI** (`@anthropic-ai/claude-code`) — нужен один раз, чтобы
  сгенерировать OAuth-токен для агента (см. ниже). Требуется подписка
  **Claude Pro / Max / Teams / Enterprise**.

## Запуск

```bash
cd server
npm install
npm run agent:build  # собрать Docker-образ агента (playable-agent) — один раз
npm run dev          # tsx watch, сервер на http://localhost:3000 (авто-перезагрузка)
```

Прод-вариант (компиляция + запуск собранного кода):

```bash
npm run build        # tsc → dist/
npm start            # node dist/server.js
```

`npm run typecheck` — проверка типов без сборки (`tsc --noEmit`).
Образ агента (`npm run agent:build`) нужно пересобрать после изменений в `agent/`.

### AI-агент (анализ и правка параметров билдеров)

Эндпоинт `/api/pages/:file/agent` запускает Claude-агента (`@anthropic-ai/claude-agent-sdk`)
в **изолированном Docker-контейнере**: внутрь монтируется только один HTML-билдер,
агент правит его «на месте», а результат сохраняется как новая копия `*-ai.html`
(оригинал не трогается). Текст агента стримится в чат по мере работы (SSE).

**1. Сгенерируй OAuth-токен** (один раз, на хосте; нужна подписка Claude):

```bash
claude setup-token        # выдаст токен sk-ant-oat01-..., живёт ~1 год
```

**2. Положи токен в `server/.env`** (файл в `.gitignore`, в браузер не передаётся):

```bash
cp .env.example .env
# в .env:
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...
```

Токен пробрасывается в контейнер только по имени переменной — само значение не
попадает ни в команду `docker run`, ни в образ.

Без токена сайт работает как раньше, а агент отдаёт понятную ошибку 503.

**Ручная проверка из консоли** (без сохранения копии):

```bash
npm run agent -- pages/<file>.html "сделай заголовок вертикальным"
```

В отдельном терминале — публичный туннель через ngrok:

```bash
ngrok http 3000
```

ngrok выдаст HTTPS-URL вида `https://xxxx.ngrok-free.app`.

### Опубликовать адрес для всех (авто-подхват)

SPA сама читает адрес сервера из `server-url.json` в корне репозитория — его не
нужно вводить вручную каждому. Чтобы обновить адрес после запуска ngrok:

```bash
cd server
npm run publish-url          # запишет текущий ngrok-URL в ../server-url.json
git add ../server-url.json && git commit -m "Update server URL" && git push
```

После деплоя (~1 мин) все увидят новый адрес автоматически.

> Совет: на бесплатном тарифе ngrok URL меняется при каждом перезапуске —
> то есть `publish-url` + commit нужно повторять. Чтобы URL был постоянным
> (и публиковать его лишь один раз), привяжи бесплатный статический домен ngrok:
> ```bash
> ngrok http --domain=your-name.ngrok-free.app 3000
> ```

Кнопка **«⚙ Сервер»** в SPA остаётся как локальный запасной вариант (если
`server-url.json` нет). Приоритет адреса: `?server=URL` в ссылке →
`server-url.json` → локальный override.

## API

| Метод  | Путь                | Назначение                                        |
|--------|---------------------|---------------------------------------------------|
| GET    | `/api/pages`        | Список страниц (manifest)                                  |
| POST   | `/api/pages`        | Загрузить: `{ filename, title, folder?, contentBase64 }`  |
| PATCH  | `/api/pages/:file`  | Изменить: `{ folder?, title? }` (перемещение в папку)      |
| POST   | `/api/pages/:file/agent` | AI-агент: `{ prompt }` → SSE-стрим текста, в конце — новая `*-ai.html` копия |
| DELETE | `/api/pages/:file`  | Удалить страницу                                           |
| GET    | `/pages/<file>`     | Открыть сохранённую HTML-страницу                          |

## Хранилище

- HTML-файлы: `server/pages/<slug>.html`
- Реестр: `server/pages/manifest.json`

Папка `pages/` в `.gitignore` — страницы не хранятся в GitHub.
