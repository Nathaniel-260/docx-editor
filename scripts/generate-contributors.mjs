#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const publicRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const defaultOutput = path.join(publicRoot, "assets", "contributors.svg");
const defaultRepository = "superdoc/docx-editor";
const defaultRefs = ["refs/heads/main", "refs/heads/v1"];
const botLoginsReportedAsUsers = new Set([
  "claude",
  "copilot",
  "cursoragent",
  "semantic-release-bot",
]);
const supportedAvatarTypes = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const historyQuery = `
  query ContributorHistory($owner: String!, $name: String!, $expression: String!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      object(expression: $expression) {
        ... on Commit {
          oid
          history(first: 100, after: $cursor) {
            nodes {
              oid
              authors(first: 20) {
                nodes {
                  user {
                    avatarUrl
                    databaseId
                    login
                  }
                }
                pageInfo {
                  hasNextPage
                }
              }
            }
            pageInfo {
              endCursor
              hasNextPage
            }
          }
        }
      }
    }
  }
`;

function parseRepository(repository) {
  const [owner, name, extra] = repository.split("/");
  if (!owner || !name || extra)
    throw new Error(
      `Expected repository in owner/name form, received '${repository}'.`,
    );
  return { owner, name };
}

function isBot(login) {
  const normalized = login.toLowerCase();
  return (
    normalized.endsWith("[bot]") || botLoginsReportedAsUsers.has(normalized)
  );
}

async function githubGraphql({ fetchFn, token, variables }) {
  const response = await fetchFn("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "superdoc-contributor-generator",
      "x-github-api-version": "2022-11-28",
    },
    body: JSON.stringify({ query: historyQuery, variables }),
  });

  if (!response.ok)
    throw new Error(
      `GitHub GraphQL request failed with HTTP ${response.status}.`,
    );
  const body = await response.json();
  if (body.errors?.length)
    throw new Error(
      `GitHub GraphQL request failed: ${body.errors.map(({ message }) => message).join("; ")}`,
    );
  return body.data?.repository?.object;
}

export async function collectContributors({
  fetchFn = fetch,
  repository = defaultRepository,
  refs = defaultRefs,
  token,
} = {}) {
  if (!token) throw new Error("GITHUB_TOKEN or GH_TOKEN is required.");
  const { owner, name } = parseRepository(repository);
  const commits = new Set();
  const contributors = new Map();

  for (const expression of refs) {
    let cursor = null;
    let resolvedExpression = expression;
    do {
      const commitObject = await githubGraphql({
        fetchFn,
        token,
        variables: { owner, name, expression: resolvedExpression, cursor },
      });
      if (!commitObject)
        throw new Error(
          `GitHub ref '${expression}' does not resolve to a commit.`,
        );
      resolvedExpression = commitObject.oid;
      const { history } = commitObject;

      for (const commit of history.nodes) {
        if (commits.has(commit.oid)) continue;
        commits.add(commit.oid);
        if (commit.authors.pageInfo.hasNextPage) {
          throw new Error(
            `Commit '${commit.oid}' has more than 20 authors; pagination is required before it can be counted safely.`,
          );
        }

        const authors = new Set();
        for (const { user } of commit.authors.nodes) {
          if (!user || authors.has(user.databaseId) || isBot(user.login))
            continue;
          authors.add(user.databaseId);
          const existing = contributors.get(user.databaseId);
          contributors.set(user.databaseId, {
            avatarUrl: user.avatarUrl,
            contributions: (existing?.contributions ?? 0) + 1,
            id: user.databaseId,
            login: user.login,
          });
        }
      }

      cursor = history.pageInfo.hasNextPage ? history.pageInfo.endCursor : null;
    } while (cursor);
  }

  return [...contributors.values()].sort((left, right) => {
    if (left.contributions !== right.contributions)
      return right.contributions - left.contributions;
    const normalizedLeft = left.login.toLowerCase();
    const normalizedRight = right.login.toLowerCase();
    if (normalizedLeft !== normalizedRight)
      return normalizedLeft < normalizedRight ? -1 : 1;
    return left.login < right.login ? -1 : left.login > right.login ? 1 : 0;
  });
}

async function mapConcurrent(items, limit, transform) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await transform(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

export async function embedAvatars(contributors, { fetchFn = fetch } = {}) {
  return mapConcurrent(contributors, 8, async (contributor) => {
    const avatar = new URL(contributor.avatarUrl);
    avatar.searchParams.set("size", "128");
    const response = await fetchFn(avatar);
    if (!response.ok)
      throw new Error(
        `Could not download the avatar for ${contributor.login}: HTTP ${response.status}.`,
      );
    const contentType = response.headers.get("content-type")?.split(";")[0];
    if (!supportedAvatarTypes.has(contentType)) {
      throw new Error(
        `Avatar for ${contributor.login} has unsupported content type '${contentType ?? "missing"}'.`,
      );
    }
    const encoded = Buffer.from(await response.arrayBuffer()).toString(
      "base64",
    );
    return {
      ...contributor,
      avatarDataUrl: `data:${contentType};base64,${encoded}`,
    };
  });
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderContributorSvg(
  contributors,
  { columns = 12, itemSize = 64, gap = 4 } = {},
) {
  if (contributors.length === 0)
    throw new Error("Cannot render an empty contributor list.");
  const usedColumns = Math.min(columns, contributors.length);
  const rows = Math.ceil(contributors.length / columns);
  const width = usedColumns * itemSize + Math.max(0, usedColumns - 1) * gap;
  const height = rows * itemSize + Math.max(0, rows - 1) * gap;
  const items = contributors.map((contributor, index) => {
    if (!contributor.avatarDataUrl)
      throw new Error(
        `Contributor '${contributor.login}' has no embedded avatar.`,
      );
    const x = (index % columns) * (itemSize + gap);
    const y = Math.floor(index / columns) * (itemSize + gap);
    const clipId = `avatar-${contributor.id}`;
    return [
      `  <g transform="translate(${x} ${y})">`,
      `    <title>${escapeXml(contributor.login)} — ${contributor.contributions} contribution${contributor.contributions === 1 ? "" : "s"}</title>`,
      `    <clipPath id="${clipId}"><circle cx="${itemSize / 2}" cy="${itemSize / 2}" r="${itemSize / 2}" /></clipPath>`,
      `    <image width="${itemSize}" height="${itemSize}" clip-path="url(#${clipId})" href="${escapeXml(contributor.avatarDataUrl)}" />`,
      "  </g>",
    ].join("\n");
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="SuperDoc contributors across V1 and V2">`,
    "  <title>SuperDoc contributors across V1 and V2</title>",
    ...items,
    "</svg>",
    "",
  ].join("\n");
}

export async function generateContributors({
  fetchFn = fetch,
  output = defaultOutput,
  repository = process.env.GITHUB_REPOSITORY || defaultRepository,
  refs = defaultRefs,
  token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN,
} = {}) {
  const contributors = await collectContributors({
    fetchFn,
    repository,
    refs,
    token,
  });
  const withAvatars = await embedAvatars(contributors, { fetchFn });
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, renderContributorSvg(withAvatars), "utf8");
  return { contributors: withAvatars.length, output };
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const result = await generateContributors();
  console.log(
    `Wrote ${result.contributors} contributors to ${path.relative(publicRoot, result.output)}.`,
  );
}
