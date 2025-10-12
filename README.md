# Recce Cloud CI/CD Action

A GitHub Action to integrate Recce Cloud into your CI/CD pipeline, automatically uploading DBT artifacts for data quality checks and lineage analysis.

[![Build Status](https://img.shields.io/github/actions/workflow/status/DataRecce/recce-cloud-cicd-action/test.yml?branch=main)](https://github.com/DataRecce/recce-cloud-cicd-action/actions)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

## 🎯 Features

- ✅ **Automated DBT Integration**: Seamlessly upload DBT manifest and catalog files
- ✅ **Pull Request Sessions**: Automatic session creation for PR reviews
- ✅ **Base Branch Tracking**: Keep your base branch up-to-date in Recce Cloud
- ✅ **Reliable**: Built-in retry logic and comprehensive error handling
- ✅ **Easy Setup**: Simple configuration with sensible defaults

## 📦 Prerequisites

1. **Recce Cloud Account**: Sign up at [Recce Cloud](https://cloud.datarecce.io)
2. **GitHub Repository Integration**: Install the Recce Cloud GitHub App from your repository settings
3. **DBT Project**: Your workflow must build DBT artifacts (`manifest.json` and `catalog.json`) before using this action

## 🚀 Usage

### Basic Example

We recommend setting up two separate workflows: one for the base branch and one for pull requests.

#### Base Pipeline (main branch)

```yaml
name: Update Base Recce Session

on:
  push:
    branches: ["main"]
  schedule:
    - cron: "0 2 * * *" # Daily at 2 AM UTC
  workflow_dispatch:

concurrency:
  group: ${{ github.workflow }}
  cancel-in-progress: true

jobs:
  update-base-session:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: "pip"

      - name: Install dependencies
        run: |
          pip install -r requirements.txt

      - name: Prepare dbt artifacts
        run: |
          # Install dbt packages
          dbt deps

          # Optional: Build tables to ensure they're materialized and updated
          # dbt build --target prod

          # Required: Generate artifacts (provides all we need)
          dbt docs generate --target prod
        env:
          DBT_ENV_SECRET_KEY: ${{ secrets.DBT_ENV_SECRET_KEY }}

      - name: Update Recce Cloud Base Session
        uses: DataRecce/recce-cloud-cicd-action@v1
```


#### PR Pipeline

```yaml
name: Validate PR Changes

on:
  pull_request:
    branches: ["main"]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  validate-changes:
    runs-on: ubuntu-latest
    timeout-minutes: 45

    steps:
      - name: Checkout PR branch
        uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: "pip"

      - name: Install dependencies
        run: |
          pip install -r requirements.txt

      # Step 1: Prepare current branch artifacts
      - name: Build current branch artifacts
        run: |
          # Install dbt packages
          dbt deps

          # Optional: Build tables to ensure they're materialized
          # dbt build --target ci

          # Required: Generate artifacts for comparison
          dbt docs generate --target ci
        env:
          DBT_ENV_SECRET_KEY: ${{ secrets.DBT_ENV_SECRET_KEY }}

      - name: Update Recce PR Session
        uses: DataRecce/recce-cloud-cicd-action@v1
```

### Advanced Example

#### Custom Configuration

```yaml
- name: Upload to Recce Cloud
  uses: DataRecce/recce-cloud-cicd-action@v1
  with:
    dbt_target_path: 'custom-target'
    base_branch: 'develop'
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## 📋 Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `dbt_target_path` | Path to DBT target directory with manifest.json and catalog.json | No | `target` |
| `base_branch` | Base branch for deployment | No | `main` |
| `github_token` | GitHub authentication token | No | `${{ github.token }}` |

## 📤 Outputs

| Output | Description | Available |
|--------|-------------|-----------|
| `session_id` | Recce Cloud session ID for accessing the review session | Pull requests only |

## ❓ How It Works

1. **Pull Request Events**: When a PR is opened or updated, the action creates a new Recce Cloud session with your current branch's DBT artifacts
2. **Push to Base Branch**: When changes are pushed to your base branch (e.g., `main`), the action updates the base session for comparison
3. **Session Link**: For PRs, a session link is automatically added to the GitHub Actions summary, allowing your team to review changes in Recce Cloud

## 🔧 Troubleshooting

### Missing DBT Artifacts

**Error**: `DBT manifest.json file not found`

**Solution**: Ensure your workflow builds DBT artifacts before running this action:

```yaml
- name: Build DBT artifacts
  run: |
    dbt deps
    dbt build
    dbt docs generate  # This generates catalog.json
```

### Authentication Issues

**Error**: `Failed to create or retrieve Recce session`

**Solution**:
1. Verify the Recce Cloud GitHub App is installed on your repository
2. Ensure `GITHUB_TOKEN` has proper permissions in your workflow
3. Check that your repository is connected to Recce Cloud

### Custom Target Path

If your DBT project uses a custom target directory:

```yaml
- name: Upload to Recce Cloud
  uses: DataRecce/recce-cloud-cicd-action@v1
  with:
    dbt_target_path: 'path/to/your/target'
```

## 📚 Additional Resources

- [Recce Documentation](https://docs.reccehq.com)
- [Getting Started with Recce Cloud](https://docs.reccehq.com/2-getting-started/start-free-with-cloud/)
- [DBT Documentation](https://docs.getdbt.com/)

## 💬 Support

Need help? We're here for you!

- 💬 **Discord**: Join our community at https://discord.com/invite/VpwXRC34jz
- 📧 **Email**: dev@reccehq.com
- � **Issues**: Report bugs at https://github.com/DataRecce/recce-cloud-cicd-action/issues
- 📖 **Documentation**: https://docs.reccehq.com

## 📄 License

Apache-2.0 - see [LICENSE](LICENSE) file for details

