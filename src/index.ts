/* eslint-disable no-console */
import deepmerge from 'deepmerge';
// eslint-disable-next-line import/order
import fs from 'node:fs/promises';

import { graphql } from '@octokit/graphql';

import type { Profile, Projects } from './types';

const query = `query Profile($name: String!) {
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
    repositories(first: 100, orderBy: { direction: ASC, field: PUSHED_AT }, privacy: PUBLIC) {
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
`;

async function getProfile(username: string): Promise<{ data: Profile }> {
  const profile = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    body: JSON.stringify({
      query,
      variables: { name: username }
    }),
    headers: {
      authorization: `bearer ${process.env.GITHUB_TOKEN}`
    }
  });

  return profile.json();
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
  const { data: profile } = await getProfile('luxass');

  const pinnedItemsEdgeNodes = profile.user.pinnedItems.edges.map((edge) => edge.node);
  const repositoriesEdgeNodes = profile.user.repositories.nodes.filter((node) =>
    node.object?.entries.find((entry) => entry.name === '.luxass')
  );

  const merged = deepmerge(pinnedItemsEdgeNodes, repositoriesEdgeNodes, {
    arrayMerge: combineMerge
  }).sort((a, b) => new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime());

  const totalStars = merged.reduce((acc, curr) => acc + curr.stargazerCount, 0);
  const totalForks = merged.reduce((acc, curr) => acc + curr.forkCount, 0);
  const projects: Projects = {
    lastUpdated: new Date().toISOString(),
    totalCount: profile.user.repositories.totalCount,
    totalStars,
    totalForks,
    projects: merged.map((project) => {
      return {
        name: project.nameWithOwner,
        description: project.description,
        url: project.url,
        pushedAt: project.pushedAt,
        stars: project.stargazerCount,
        forks: project.forkCount,
        primaryLanguage: project.languages.nodes[0]
      };
    })
  };

  await writeProjectFile(projects);
}

run();
