# NormaHub AI Code Review Action

[![GitHub Action](https://img.shields.io/badge/action-NormaHub_Code_Review-purple?style=flat-square&logo=github)](https://github.com/normahubcc/code-review-action)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-zero-blue.svg?style=flat-square)](action.yml)

Automated GitHub Action for Pull Request code reviews powered by [NormaHub API](https://normahub.cc).

Runs automated, actionable code reviews on open and updated PRs using high-performance models (`deepseek-v4.1-flash`, `claude-sonnet-5-5`, `gpt-5.5`).

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
- Имя: `NORMAHUB_API_KEY`
- Значение: ваш ключ из личного кабинета [normahub.cc](https://normahub.cc)

---

## Параметры (Inputs)

| Параметр | Описание | Обязательный | По умолчанию |
|---|---|---|---|
| `normahub_api_key` | API-ключ от NormaHub | **Да** | — |
| `github_token` | GitHub токен для публикации комментариев | **Да** | `${{ github.token }}` |
| `model` | Модель для анализа кода (`deepseek-v4.1-flash`, `claude-sonnet-5-5`, `gpt-5.5`, `qwen-2.5-coder-32b`) | Нет | `deepseek-v4.1-flash` |
| `max_diff_length` | Максимальный размер дифф-текста в символах перед усечением | Нет | `45000` |

---

## Лицензия

MIT License. См. [LICENSE](LICENSE).
