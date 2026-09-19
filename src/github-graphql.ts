import axios from 'axios';
import * as type from './type';

export const URL =
    process.env.GITHUB_ENDPOINT || 'https://api.github.com/graphql';
const maxReposOneQuery = 100;

export type CommitContributionDay = {
    occurredAt: string;
    commitCount: number;
};

export type CommitContributionsByRepository = Array<{
    contributions: {
        totalCount: number;
        nodes?: CommitContributionDay[];
    };
    repository: {
        nameWithOwner?: string;
        primaryLanguage: {
            name: string;
            /** "#RRGGBB" */
            color: string | null;
        } | null;
    };
}>;

export type ContributionCalendar = {
    isHalloween: boolean;
    totalContributions: number;
    weeks: Array<{
        contributionDays: Array<{
            contributionCount: number;
            contributionLevel: type.ContributionLevel;
            /** "YYYY-MM-DD hh:mm:ss.SSS+00:00" */
            date: string;
        }>;
    }>;
};

export type Repositories = {
    edges: Array<{
        cursor: string;
    }>;
    nodes: Array<{
        forkCount: number;
        stargazerCount: number;
    }>;
};

/** Response(first) of GraphQL */
export type ResponseType = {
    data?: {
        user: {
            contributionsCollection: {
                commitContributionsByRepository: CommitContributionsByRepository;
                contributionCalendar: ContributionCalendar;
                totalCommitContributions: number;
                totalIssueContributions: number;
                totalPullRequestContributions: number;
                totalPullRequestReviewContributions: number;
                totalRepositoryContributions: number;
            };
            repositories: Repositories;
        };
    };
    errors?: [
        {
            message: string;
            // snip
        },
    ];
};

/** Response(next) of GraphQL */
export type ResponseNextType = {
    data?: {
        user: {
            repositories: Repositories;
        };
    };
    errors?: [
        {
            message: string;
            // snip
        },
    ];
};

export const fetchFirst = async (
    token: string,
    userName: string,
    year: number | null = null,
): Promise<ResponseType> => {
    const yearArgs = year
        ? `(from:"${year}-01-01T00:00:00.000Z", to:"${year}-12-31T23:59:59.000Z")`
        : '';
    const headers = {
        Authorization: `bearer ${token}`,
    };
    const request = {
        query: `
            query($login: String!) {
                user(login: $login) {
                    contributionsCollection${yearArgs} {
                        contributionCalendar {
                            isHalloween
                            totalContributions
                            weeks {
                                contributionDays {
                                    contributionCount
                                    contributionLevel
                                    date
                                }
                            }
                        }
                        commitContributionsByRepository(maxRepositories: ${maxReposOneQuery}) {
                            repository {
                                nameWithOwner
                                primaryLanguage {
                                    name
                                    color
                                }
                            }
                            contributions(first: 100, orderBy: {field: OCCURRED_AT, direction: DESC}) {
                                totalCount
                                nodes {
                                    occurredAt
                                    commitCount
                                }
                            }
                        }
                        totalCommitContributions
                        totalIssueContributions
                        totalPullRequestContributions
                        totalPullRequestReviewContributions
                        totalRepositoryContributions
                    }
                    repositories(first: ${maxReposOneQuery}, ownerAffiliations: OWNER) {
                        edges {
                            cursor
                        }
                        nodes {
                            forkCount
                            stargazerCount
                        }
                    }
                }
            }
        `.replace(/\s+/g, ' '),
        variables: { login: userName },
    };

    const response = await axios.post<ResponseType>(URL, request, {
        headers: headers,
    });
    return response.data;
};

const toDateKey = (value: string): string => value.slice(0, 10);

const repoKey = (repo: CommitContributionsByRepository[number]): string =>
    repo.repository.nameWithOwner ||
    repo.repository.primaryLanguage?.name ||
    'unknown';

const mergeCommitRepos = (
    base: CommitContributionsByRepository,
    extra: CommitContributionsByRepository,
): void => {
    const index = new Map(base.map((repo) => [repoKey(repo), repo]));
    for (const repo of extra) {
        const key = repoKey(repo);
        const target = index.get(key);
        if (!target) {
            base.push(repo);
            index.set(key, repo);
            continue;
        }
        const counts = new Map<string, number>();
        for (const node of target.contributions.nodes || []) {
            counts.set(toDateKey(node.occurredAt), node.commitCount);
        }
        for (const node of repo.contributions.nodes || []) {
            const day = toDateKey(node.occurredAt);
            counts.set(
                day,
                Math.max(counts.get(day) || 0, node.commitCount),
            );
        }
        target.contributions.nodes = [...counts.entries()].map(
            ([occurredAt, commitCount]) => ({ occurredAt, commitCount }),
        );
    }
};

const oldestCappedDay = (
    repos: CommitContributionsByRepository,
): number | null => {
    let oldest: number | null = null;
    for (const repo of repos) {
        const nodes = repo.contributions.nodes || [];
        if (nodes.length < 100) {
            continue;
        }
        for (const node of nodes) {
            const time = new Date(node.occurredAt).getTime();
            if (oldest === null || time < oldest) {
                oldest = time;
            }
        }
    }
    return oldest;
};

type CommitPageResponse = {
    data?: {
        user: {
            contributionsCollection: {
                commitContributionsByRepository: CommitContributionsByRepository;
            };
        };
    };
    errors?: ResponseType['errors'];
};

const fetchCommitPage = async (
    token: string,
    userName: string,
    from: string,
    to: string,
): Promise<CommitContributionsByRepository> => {
    const headers = {
        Authorization: `bearer ${token}`,
    };
    const request = {
        query: `
            query($login: String!, $from: DateTime!, $to: DateTime!) {
                user(login: $login) {
                    contributionsCollection(from: $from, to: $to) {
                        commitContributionsByRepository(maxRepositories: ${maxReposOneQuery}) {
                            repository {
                                nameWithOwner
                                primaryLanguage {
                                    name
                                    color
                                }
                            }
                            contributions(first: 100, orderBy: {field: OCCURRED_AT, direction: DESC}) {
                                nodes {
                                    occurredAt
                                    commitCount
                                }
                            }
                        }
                    }
                }
            }
        `.replace(/\s+/g, ' '),
        variables: { login: userName, from, to },
    };
    const response = await axios.post<CommitPageResponse>(URL, request, {
        headers,
    });
    if (response.data.errors?.length) {
        throw new Error(response.data.errors[0].message);
    }
    return (
        response.data.data?.user.contributionsCollection
            .commitContributionsByRepository || []
    );
};

const paginateCommitDays = async (
    token: string,
    userName: string,
    result: NonNullable<ResponseType['data']>,
): Promise<void> => {
    const days = result.user.contributionsCollection.contributionCalendar.weeks.flatMap(
        (week) => week.contributionDays,
    );
    if (days.length === 0) {
        return;
    }
    const from = new Date(days[0].date).toISOString();
    const repos =
        result.user.contributionsCollection.commitContributionsByRepository;
    let page = repos;
    for (let i = 0; i < 20; i++) {
        const oldest = oldestCappedDay(page);
        if (oldest === null) {
            return;
        }
        const nextTo = new Date(oldest - 1000).toISOString();
        if (nextTo <= from) {
            return;
        }
        page = await fetchCommitPage(token, userName, from, nextTo);
        mergeCommitRepos(repos, page);
    }
};

export const fetchNext = async (
    token: string,
    userName: string,
    cursor: string,
): Promise<ResponseNextType> => {
    const headers = {
        Authorization: `bearer ${token}`,
    };
    const request = {
        query: `
            query($login: String!, $cursor: String!) {
                user(login: $login) {
                    repositories(after: $cursor, first: ${maxReposOneQuery}, ownerAffiliations: OWNER) {
                        edges {
                            cursor
                        }
                        nodes {
                            forkCount
                            stargazerCount
                        }
                    }
                }
            }
        `.replace(/\s+/g, ' '),
        variables: {
            login: userName,
            cursor: cursor,
        },
    };
    const response = await axios.post<ResponseNextType>(URL, request, {
        headers: headers,
    });
    return response.data;
};

/** Fetch data from GitHub GraphQL */
export const fetchData = async (
    token: string,
    userName: string,
    maxRepos: number,
    year: number | null = null,
): Promise<ResponseType> => {
    const res1 = await fetchFirst(token, userName, year);
    const result = res1.data;

    if (result && result.user.repositories.nodes.length === maxReposOneQuery) {
        const repos1 = result.user.repositories;
        let cursor = repos1.edges[repos1.edges.length - 1].cursor;
        while (repos1.nodes.length < maxRepos) {
            const res2 = await fetchNext(token, userName, cursor);
            if (res2.data) {
                const repos2 = res2.data.user.repositories;
                repos1.nodes.push(...repos2.nodes);
                if (repos2.nodes.length !== maxReposOneQuery) {
                    break;
                }
                cursor = repos2.edges[repos2.edges.length - 1].cursor;
            } else {
                break;
            }
        }
    }
    if (result) {
        await paginateCommitDays(token, userName, result);
    }
    return res1;
};
