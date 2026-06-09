# Playable Studio — server

Хранит и отдаёт HTML-страницы (playables). Страницы лежат в `server/pages/`
(в git не попадают). SPA на GitHub Pages обращается к этому серверу через ngrok.

## Запуск

```bash
cd server
npm install
npm start            # сервер на http://localhost:3000
```

В отдельном терминале — публичный туннель через ngrok:

```bash
ngrok http 3000
```

ngrok выдаст HTTPS-URL вида `https://xxxx.ngrok-free.app`.
Скопируй его и вставь в SPA: на главной странице кнопка **«⚙ Сервер»** → вставить URL.

> Совет: на бесплатном тарифе ngrok URL меняется при каждом перезапуске.
> Чтобы URL был постоянным, привяжи бесплатный статический домен ngrok:
> ```bash
> ngrok http --domain=your-name.ngrok-free.app 3000
> ```

## API

| Метод  | Путь                | Назначение                                        |
|--------|---------------------|---------------------------------------------------|
| GET    | `/api/pages`        | Список страниц (manifest)                          |
| POST   | `/api/pages`        | Загрузить: `{ filename, title, desc, contentBase64 }` |
| DELETE | `/api/pages/:file`  | Удалить страницу                                   |
| GET    | `/pages/<file>`     | Открыть сохранённую HTML-страницу                  |

## Хранилище

- HTML-файлы: `server/pages/<slug>.html`
- Реестр: `server/pages/manifest.json`

Папка `pages/` в `.gitignore` — страницы не хранятся в GitHub.
