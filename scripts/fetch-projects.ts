// @ts-expect-error This doesn't have types......
import toEmoji from "emoji-name-map";

import type { EdgeNode, Profile, Projects } from "./types";

function parseEmojis(desc: string): string {
  return desc.replace(/:\w+:/gm, (match) => {
    return toEmoji.get(match) || match;
  });
}

const query = `query Profile($name: String!) {
  user(login: $name) {
    pinnedItems(first: 6) {
      edges {
        node {
          ... on Repository {
            name
            owner {
              login
            }
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
        name
        owner {
          login
        }
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
  const profile = await fetch("https://api.github.com/graphql", {
    method: "POST",
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

async function writeProjectFile(projects: Projects) {
  console.log("writing project file");
  await Bun.write("./assets/projects.json", JSON.stringify(projects, null, 2));
}

const includeNames = [
  ".luxass",
  ".luxassinclude",
  ".luxass_include",
  ".luxass-visdig",
  ".luxass-include",
  ".luxass-komfritfrem"
];

async function run() {
  const { data: profile } = await getProfile("luxass");

  if (!profile) throw new TypeError("An error occurred.");

  const pinnedItemsEdgeNodes = profile.user.pinnedItems.edges.map(
    (edge) => edge.node
  );
  console.log(pinnedItemsEdgeNodes);

  const repositoriesEdgeNodes = profile.user.repositories.nodes.filter((node) =>
    node.object?.entries.find((entry) => includeNames.includes(entry.name))
  );

  const all = repositoriesEdgeNodes
    .concat(pinnedItemsEdgeNodes)
    .reduce<EdgeNode[]>((prev, curr) => {
      if (!prev.find((node) => node.name === curr.name && node.owner.login === curr.owner.login)) {
        prev.push(curr);
      }

      return prev;
    }, [])
    .sort(
      (a, b) => new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime()
    );

  const totalStars = all.reduce((acc, curr) => acc + curr.stargazerCount, 0);
  const totalForks = all.reduce((acc, curr) => acc + curr.forkCount, 0);
  const projects: Projects = {
    lastUpdated: new Date().toISOString(),
    totalCount: profile.user.repositories.totalCount,
    totalStars,
    totalForks,
    projects: all.map((project) => {
      return {
        name: project.name,
        owner: project.owner.login,
        description: parseEmojis(
          project.description || "No description was set"
        ),
        url: project.url,
        pushedAt: project.pushedAt,
        stars: project.stargazerCount,
        forks: project.forkCount,
        language: project.languages.nodes[0]
      };
    })
  };

  await writeProjectFile(projects);
}

run();
