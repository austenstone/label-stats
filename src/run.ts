import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';
import ProgressBar from 'progress';

interface Input {
  token: string;
}

export function getInputs(): Input {
  const result = {} as Input;
  result.token = core.getInput('github-token') || process.env.GITHUB_TOKEN || '';
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

    console.log(response);
    totalCount = response.repository.labels.totalCount;
    totalProcessed += response.repository.labels.edges.length;
    hasNextPage = response.repository.labels.pageInfo.hasNextPage
    endCursor = response.repository.labels.pageInfo.endCursor

    console.log(response.repository.labels.edges);
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

    bar = bar ? bar : new ProgressBar(':processed/:total [:bar] :rate/s :percent :etas', { total: Math.floor(totalCount) });
    bar.tick(response.repository.issues.nodes.length, { processed: totalProcessed, total: totalCount });
  }

  return labels;
}

const run = async (): Promise<void> => {
  try {
    const input = getInputs();
    let labels = {} as { [key: string]: number; };
    if (!fs.existsSync('labels.json')) {
      const octokit: ReturnType<typeof github.getOctokit> = github.getOctokit(input.token);
      const owner = 'github';
      const repo = 'solutions-engineering';
      console.log('Get all labels...');
      labels = await getAllLabels(octokit, owner, repo)
      console.log('Get issue label counts...');
      labels = { ...labels, ...await getIssueLabels(octokit, owner, repo)}
      const sortedLabels = Object.entries(labels)
        .sort(([, a], [, b]) => a - b)
        .reduce((r, [k, v]) => ({ ...r, [k]: v }), {});
      console.log('Writing labels to labels.json...');
      fs.writeFileSync('labels.json', JSON.stringify(sortedLabels, null, 2));
    } else {
      labels = JSON.parse(fs.readFileSync('labels.json')?.toString());
    }
    
    console.log('Writing labels to labels.csv...');
    const header = 'key,value';
    fs.writeFileSync('labels.csv', header);
    Object.entries(labels).forEach(([key, value]) => {
      fs.appendFileSync('labels.csv', '\n' + key + ',' + value);
    })
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : JSON.stringify(error))
  }
};

export default run;
