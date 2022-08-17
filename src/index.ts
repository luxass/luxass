/* eslint-disable no-console */
import deepmerge from 'deepmerge';
import 'dotenv/config';
// eslint-disable-next-line import/order
import { promises as fs } from 'node:fs';

import { graphql } from '@octokit/graphql';

import type { Profile, Projects } from './types';

async function getProfile(username: string): Promise<Profile> {
  const profile = await graphql<Profile>(
    `
      query Profile($name: String!) {
        user(login: $name) {
          pinnedItems(first: 6) {
            edges {
              node {
                ... on Repository {
                  nameWithOwner
                  description
                  pushedAt
                  stargazerCount
                  forkCount
                  url
                  languages(first: 1, orderBy: { field: SIZE, direction: DESC }) {
                    nodes {
                      color
                      name
                    }
                  }
                  object(expression: "HEAD:.github") {
                    ... on Tree {
                      entries {
                        name
                        type
                      }
                    }
                  }
                }
              }
            }
          }
          repositories(
            first: 100
            orderBy: { direction: DESC, field: STARGAZERS }
            privacy: PUBLIC
          ) {
            totalCount
            nodes {
              nameWithOwner
              description
              pushedAt
              stargazerCount
              forkCount
              url
              languages(first: 1, orderBy: { field: SIZE, direction: DESC }) {
                nodes {
                  color
                  name
                }
              }
              object(expression: "HEAD:.github") {
                ... on Tree {
                  entries {
                    name
                    type
                  }
                }
              }
            }
          }
        }
      }
    `,
    {
      headers: {
        authorization: `bearer ${process.env.GITHUB_TOKEN}`
      },
      owner: username,
      name: username
    }
  );
  return profile;
}

function combineMerge(target: any[], source: any[], options: any) {
  const destination = target.slice();

  source.forEach((item, index) => {
    if (typeof destination[index] === 'undefined') {
      destination[index] = options.cloneUnlessOtherwiseSpecified(item, options);
    } else if (options.isMergeableObject(item)) {
      destination[index] = deepmerge(target[index], item, options);
    } else if (target.includes(item)) {
      destination.push(item);
    }
  });
  return destination;
}

async function writeProjectFile(projects: Projects) {
  console.log('writing project file');
  await fs.writeFile('./assets/projects.json', JSON.stringify(projects, null, 2));
}

async function run() {
  const profile = await getProfile('luxass');
  const pinnedItemsEdgeNodes = profile.user.pinnedItems.edges.map((edge) => edge.node);
  const repositoriesEdgeNodes = profile.user.repositories.nodes.filter((node) => node.object?.entries.find((entry) => entry.name === '.luxass-include'));

  const merged = deepmerge(pinnedItemsEdgeNodes, repositoriesEdgeNodes, {
    arrayMerge: combineMerge
  });

  const totalStars = merged.reduce((acc, curr) => acc + curr.stargazerCount, 0);
  const totalForks = merged.reduce((acc, curr) => acc + curr.forkCount, 0);
  const projects: Projects = {
    lastUpdated: new Date().toISOString(),
    totalCount: profile.user.repositories.totalCount,
    totalStars,
    totalForks,
    projects: merged
  };

  await writeProjectFile(projects);
}

run();
