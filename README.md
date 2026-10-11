<p align="center">
  <a href="https://normahub.cc">
    <img src="https://raw.githubusercontent.com/normahubcc/.github/main/docs/images/logo.png" alt="NormaHub" width="120" />
  </a>
</p>

# NormaHub AI Code Review Action

[![GitHub Action](https://img.shields.io/badge/action-NormaHub_Code_Review-purple?style=flat-square&logo=github)](https://github.com/normahubcc/code-review-action)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-zero-blue.svg?style=flat-square)](package.json)
[![Models](https://img.shields.io/badge/models-DeepSeek_|_Claude_|_GPT-6366f1.svg?style=flat-square)](https://normahub.cc/models)

Автоматизированный GitHub Action для проведения код-ревью в Pull Request на базе моделей [NormaHub API](https://normahub.cc) (DeepSeek v4.1 Flash, Claude Sonnet 5.5, GPT-5.5).

---

## Ключевые возможности

- 🛡️ **Фокус на реальных багах:** Ищет уязвимости (OWASP, инъекции, утечки секретов), race conditions, неперехваченные ошибки в async, утечки ресурсов и регрессии. Не спамит придирками к стилю и форматированию (табы, точки с запятой), доверяя это линтерам.
- 🧹 **Умная фильтрация шума (Smart Noise Filter):** Автоматически исключает из анализа lock-файлы (`pnpm-lock.yaml`, `package-lock.json`, `Cargo.lock`), минифицированные бандлы (`dist/**`, `build/**`), медиа-ассеты и вендорные директории.
- 🔄 **Анти-спам (Idempotent Updates):** При повторных пушах в PR бот **редактирует свой существующий комментарий**, а не плодит новые простыни текста.
- ⚡ **Zero Dependencies:** Написан на стандартном Node.js 18+ (`fetch`), работает мгновенно без `npm install`.
- 💰 **Экономика:** На модели `deepseek-v4.1-flash` средняя стоимость полного ревью одного PR составляет **~$0.0005 (менее половины копейки)**.

---

## Быстрый старт

Создайте в своем репозитории файл `.github/workflows/ai-review.yml`:

```yaml
name: NormaHub Code Review

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - name: NormaHub AI Review
        uses: normahubcc/code-review-action@main
        with:
          normahub_api_key: ${{ secrets.NORMAHUB_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
          model: 'deepseek-v4.1-flash' # или 'claude-sonnet-5-5', 'gpt-5.5'
```

Добавьте ваш API-ключ в **Settings > Secrets and variables > Actions > Secrets**:
- **Name:** `NORMAHUB_API_KEY`
- **Value:** ключ из личного кабинета [normahub.cc](https://normahub.cc)

---

## Поддержка внешних форков (Open Source)

Для открытых репозиториев, где PR приходят из форков сторонних контрибьюторов, используйте триггер `pull_request_target`, чтобы action имел доступ к секрету `NORMAHUB_API_KEY`:

```yaml
on:
  pull_request_target:
    types: [opened, synchronize]
```

---

## Параметры (Inputs)

| Параметр | Описание | Обязательный | По умолчанию |
|---|---|---|---|
| `normahub_api_key` | API-ключ от NormaHub | **Да** | — |
| `github_token` | GitHub токен для публикации/обновления комментариев | **Да** | `${{ github.token }}` |
| `model` | Идентификатор модели (`deepseek-v4.1-flash`, `claude-sonnet-5-5`, `gpt-5.5`, `qwen-2.5-coder-32b`) | Нет | `deepseek-v4.1-flash` |
| `max_diff_length` | Лимит символов диффа (включаются приоритетные файлы) | Нет | `50000` |
| `ignore_patterns` | Дополнительные regex-паттерны для исключения файлов через запятую | Нет | `""` |

---

## Поддерживаемые модели

| Модель | Назначение | Стоимость на NormaHub (1M токенов) |
|---|---|---|
| `deepseek-v4.1-flash` | Рекомендуется по умолчанию. Быстрый и глубокий анализ логики. | **$0.018 in / $0.050 out** (~0.05 ₽ за ревью) |
| `claude-sonnet-5-5` | Архитектурный синтез и аудит безопасности сложных систем. | $0.35 in / $1.80 out |
| `gpt-5.5` | Сбалансированный анализ на моделях OpenAI. | $0.12 in / $0.69 out |
| `qwen-2.5-coder-32b` | Оптимизирован для языков C++, Go, Python, Rust. | $0.035 in / $0.140 out |

---

## Лицензия

MIT License. См. [LICENSE](LICENSE).
