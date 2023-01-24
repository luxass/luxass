
export interface Projects {
  lastUpdated: string;
  totalCount: number;
  totalStars: number;
  totalForks: number;
  projects: {
    name: string;
    owner: string;
    description: string;
    url: string;
    pushedAt: string;
    stars: number;
    forks: number;
    language: LanguageNode;
  }[];
}

export interface Profile {
  user: User;
}

export interface User {
  pinnedItems: PinnedItems;
  repositories: Repositories;
}

export interface PinnedItems {
  edges: Edge[];
}

export interface Edge {
  node: EdgeNode;
}

export interface EdgeNode {
  name: string;
  owner: {
    login: string;
  };
  description: string | null;
  pushedAt: string;
  stargazerCount: number;
  forkCount: number;
  url: string;
  languages: Languages;
  object: Object | null;
}

export interface Languages {
  nodes: LanguageNode[];
}

export interface LanguageNode {
  color: string;
  name: string;
}

export interface Object {
  entries: Entry[];
}

export interface Entry {
  name: string;
  type: EntryType;
}

export type EntryType = "blob" | "tree";

export interface Repositories {
  totalCount: number;
  nodes: EdgeNode[];
}
