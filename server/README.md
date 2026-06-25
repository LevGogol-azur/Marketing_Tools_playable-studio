# Playable Studio — server

Хранит и отдаёт HTML-страницы (playables). Страницы лежат в `server/pages/`
(в git не попадают). SPA на GitHub Pages обращается к этому серверу через ngrok.

Код на TypeScript (ESM). В разработке запускается через `tsx` без сборки;
для прода компилируется `tsc` в `dist/`.

## Запуск

```bash
cd server
npm install
npm run dev          # tsx watch, сервер на http://localhost:3000 (авто-перезагрузка)
```

Прод-вариант (компиляция + запуск собранного кода):

```bash
npm run build        # tsc → dist/
npm start            # node dist/server.js
```

`npm run typecheck` — проверка типов без сборки (`tsc --noEmit`).

### AI-чат (анализ и правка параметров билдеров)

Эндпоинты `/api/pages/:file/chat` и `/api/pages/:file/apply` используют Claude API.
Задай ключ перед запуском (в браузер он не передаётся):

```bash
# PowerShell
$env:ANTHROPIC_API_KEY = "sk-ant-..."
npm run dev
```

Без ключа сайт работает как раньше, а чат отдаёт понятную ошибку 503. Модель — `claude-opus-4-8`.
Весь HTML билдера передаётся модели (base64-данные ассетов схлопываются в плейсхолдеры),
промпт кэшируется, поэтому многоходовой диалог по одному билдеру дешёвый.

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
| POST   | `/api/pages/:file/chat`  | AI-чат: `{ messages }` → `{ reply, proposal? }`      |
| POST   | `/api/pages/:file/apply` | Применить правки AI: `{ edits, title? }` → новая копия |
| DELETE | `/api/pages/:file`  | Удалить страницу                                           |
| GET    | `/pages/<file>`     | Открыть сохранённую HTML-страницу                          |

## Хранилище

- HTML-файлы: `server/pages/<slug>.html`
- Реестр: `server/pages/manifest.json`

Папка `pages/` в `.gitignore` — страницы не хранятся в GitHub.
