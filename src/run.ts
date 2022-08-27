import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';
import ProgressBar from 'progress';

interface Input {
  token: string;
  file: string;
  owner: string;
  repo: string;
  contentType: string;
}

export function getInputs(): Input {
  const result = {} as Input;
  result.token = core.getInput('github-token');
  result.file = core.getInput('file');
  result.owner = core.getInput('owner');
  result.repo = core.getInput('repo');
  result.contentType = core.getInput('content-type');
  return result;
}

const getAllLabels = async (octokit, owner, repo): Promise<{ [key: string]: number }> => {
  let bar;
  const labels = {};
  let totalProcessed = 0;
  let totalCount = 0;
  let hasNextPage = true;
  let endCursor = null;
  while (hasNextPage) {
    const response: any = await octokit.graphql(`{
      repository(owner: "${owner}", name: "${repo}") {
        labels(first: 100, after:${JSON.stringify(endCursor)}) {
          totalCount
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              name
            }
          }
        }
      }
    }`);

    totalCount = response.repository.labels.totalCount;
    totalProcessed += response.repository.labels.edges.length;
    hasNextPage = response.repository.labels.pageInfo.hasNextPage
    endCursor = response.repository.labels.pageInfo.endCursor

    response.repository.labels.edges.forEach((edge) => {
      const name = edge.node.name;
      labels[name] = 0;
    });

    bar = bar ? bar : new ProgressBar(':processed/:total [:bar] :rate/s :percent :etas', { total: Math.floor(totalCount) });
    bar.tick(response.repository.labels.edges.length, { processed: totalProcessed, total: totalCount });
  }

  return labels;
}

const getIssueLabels = async (octokit, owner, repo): Promise<{ [key: string]: number }> => {
  let bar;
  const labels = {};
  let totalProcessed = 0;
  let totalCount = 0;
  let hasNextPage = true;
  let endCursor = null;
  while (hasNextPage) {
    const response: any = await octokit.graphql(`{
      repository(owner: "${owner}", name: "${repo}") {
        issues(first: 100, after:${JSON.stringify(endCursor)}) {
          totalCount
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            title
            labels(first: 100) {
              edges {
                node {
                  name
                }
              }
            }
          }
        }
      }
    }`);

    totalCount = response.repository.issues.totalCount;
    totalProcessed += response.repository.issues.nodes.length;
    hasNextPage = response.repository.issues.pageInfo.hasNextPage
    endCursor = response.repository.issues.pageInfo.endCursor

    response.repository.issues.nodes.forEach((issue) => {
      issue.labels.edges.forEach((issueEdge) => {
        const name = issueEdge.node.name;
        labels[name] = labels[name] ? ++labels[name] : 1;
      })
    });

    if (totalCount > 0) {
      bar = bar ? bar : new ProgressBar(':processed/:total [:bar] :rate/s :percent :etas', { total: Math.floor(totalCount) });
      bar.tick(response.repository.issues.nodes.length, { processed: totalProcessed, total: totalCount });
    }
  }

  return labels;
}

const keyValueToCSV = (labels: {
  [key: string]: number;
}, keyName = 'key', valueName = 'value'): string => Object.entries(labels).reduce((csv, [key, value]) =>
  csv + `\n${key},${value}`, `${keyName},${valueName}`
);

const run = async (): Promise<void> => {
  const input = getInputs();
  let labels = {} as { [key: string]: number; };
  if (fs.existsSync('labels.json')) {
    labels = JSON.parse(fs.readFileSync('labels.json')?.toString());
    return;
  }

  const octokit: ReturnType<typeof github.getOctokit> = github.getOctokit(input.token);
  const owner = input.owner;
  const repo = input.repo;

  labels = await core.group('Get all labels...', async () => getAllLabels(octokit, owner, repo))
  labels = { ...labels, ...await core.group('Get issue label counts...', async () => getIssueLabels(octokit, owner, repo)) }
  labels = Object.entries(labels)
    .sort(([, a], [, b]) => b - a)
    .reduce((r, [k, v]) => ({ ...r, [k]: v }), {});

  let data = 'No Content';
  switch (input.contentType.toLowerCase()) {
    case 'json':
      data = JSON.stringify(labels, null, 2);
      break;
    case 'csv':
      data = keyValueToCSV(labels);
      break;
    default:
      throw (new Error(`Unsupported content type: ${input.contentType}`));
  }
  core.setOutput('data', data);
};

export default run;
