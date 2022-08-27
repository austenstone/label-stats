# Action

An [Action](https://docs.github.com/en/actions).

## Usage
Create a workflow (eg: `.github/workflows/seat-count.yml`). See [Creating a Workflow file](https://help.github.com/en/articles/configuring-a-workflow#creating-a-workflow-file).

<!-- 
### PAT(Personal Access Token)

You will need to [create a PAT(Personal Access Token)](https://github.com/settings/tokens/new?scopes=admin:org) that has `admin:org` access.

Add this PAT as a secret so we can use it as input `github-token`, see [Creating encrypted secrets for a repository](https://docs.github.com/en/enterprise-cloud@latest/actions/security-guides/encrypted-secrets#creating-encrypted-secrets-for-a-repository). 
### Organizations

If your organization has SAML enabled you must authorize the PAT, see [Authorizing a personal access token for use with SAML single sign-on](https://docs.github.com/en/enterprise-cloud@latest/authentication/authenticating-with-saml-single-sign-on/authorizing-a-personal-access-token-for-use-with-saml-single-sign-on).
-->

#### Basic
```yml
name: Label Stats
on:
  workflow_dispatch:

jobs:
  print-label-usage:
    runs-on: ubuntu-latest
    steps:
      - uses: austenstone/label-stats@main
        id: labels
      - run: echo "${{ steps.labels.outputs.data }}"
```

#### CSV File
```yml
name: Get Label Usage CSV
on:
  workflow_dispatch:

jobs:
  label-usage-csv:
    runs-on: ubuntu-latest
    steps:
      - uses: austenstone/label-stats@main
        with:
          content-type: csv
        id: labels
      - run: echo "${{ steps.labels.outputs.data }}" > labels.csv
      - uses: actions/upload-artifact@v3
        with:
          name: Label Usage CSV
          path: labels.csv

```

#### Pi Chart Job Summary
```yml
name: Usage
on:
  workflow_dispatch:

jobs:
  pi-chart-job-summary:
    runs-on: ubuntu-latest
    steps:
      - uses: austenstone/label-stats@main
        id: labels
      - uses: actions/github-script@v6
        with:
          script: |
            await core.summary
              .addRaw(Object.entries(JSON.parse(`${{ steps.labels.outputs.data }}`)).reduce((acc, [key, value]) =>
              acc + `\n    "${key}" : ${value}`,
              `\`\`\`mermaid
              pie showData
                title Label Usage`
            ) + '\n```', true)
              .write()
```

## ➡️ Inputs
Various inputs are defined in [`action.yml`](action.yml):

| Name | Description | Default |
| --- | - | - |
| github&#x2011;token | Token to use to authorize. | ${{&nbsp;github.token&nbsp;}} |

<!-- 
## ⬅️ Outputs
| Name | Description |
| --- | - |
| output | The output. |
-->

## Further help
To get more help on the Actions see [documentation](https://docs.github.com/en/actions).
