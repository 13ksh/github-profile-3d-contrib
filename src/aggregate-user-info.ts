import * as client from './github-graphql';
import * as langColors from './apply-language-colors';
import * as type from './type';

const OTHER_COLOR = '#444444';

type LangShare = {
    language: string;
    color: string;
    ratio: number;
};

const languageShares = (
    repo: client.CommitContributionsByRepository[number]['repository'],
): LangShare[] => {
    const total = repo.languages?.totalSize || 0;
    const edges = repo.languages?.edges || [];
    if (total > 0 && edges.length > 0) {
        return edges
            .filter((edge) => edge.size > 0 && edge.node.name)
            .map((edge) => ({
                language: edge.node.name,
                color: edge.node.color || OTHER_COLOR,
                ratio: edge.size / total,
            }));
    }
    if (repo.primaryLanguage?.name) {
        return [
            {
                language: repo.primaryLanguage.name,
                color: repo.primaryLanguage.color || OTHER_COLOR,
                ratio: 1,
            },
        ];
    }
    return [];
};

const addLangAmount = (
    target: { [language: string]: type.LangInfo },
    language: string,
    color: string,
    amount: number,
): void => {
    if (amount <= 0 || language.toLowerCase() === 'other') {
        return;
    }
    const info = target[language];
    if (info) {
        info.contributions += amount;
    } else {
        target[language] = {
            language,
            color,
            contributions: amount,
        };
    }
};

const toUtcDateKey = (value: string | Date): string => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        return value.slice(0, 10);
    }
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const toNumberContributionLevel = (level: type.ContributionLevel): number => {
    switch (level) {
        case 'NONE':
            return 0;
        case 'FIRST_QUARTILE':
            return 1;
        case 'SECOND_QUARTILE':
            return 2;
        case 'THIRD_QUARTILE':
            return 3;
        case 'FOURTH_QUARTILE':
            return 4;
    }
};

const compare = (num1: number, num2: number): number => {
    if (num1 < num2) {
        return -1;
    } else if (num1 > num2) {
        return 1;
    } else {
        return 0;
    }
};

export const aggregateUserInfo = (
    response: client.ResponseType,
): type.UserInfo => {
    if (!response.data) {
        if (response.errors && response.errors.length) {
            throw new Error(response.errors[0].message);
        } else {
            throw new Error('JSON\n' + JSON.stringify(response, null, 2));
        }
    }

    const user = response.data.user;
    const contributesLanguage: { [language: string]: type.LangInfo } = {};
    const languagesByDay: {
        [date: string]: { [language: string]: type.LangInfo };
    } = {};
    user.contributionsCollection.commitContributionsByRepository.forEach(
        (repo) => {
            const shares = languageShares(repo.repository);
            const contributions = repo.contributions.totalCount;
            for (const share of shares) {
                addLangAmount(
                    contributesLanguage,
                    share.language,
                    share.color,
                    contributions * share.ratio,
                );
            }

            const dayCounts: { [date: string]: number } = {};
            for (const node of repo.contributions.nodes || []) {
                const dayKey = toUtcDateKey(node.occurredAt);
                dayCounts[dayKey] = Math.max(
                    dayCounts[dayKey] || 0,
                    node.commitCount,
                );
            }
            for (const [dayKey, commitCount] of Object.entries(dayCounts)) {
                if (!languagesByDay[dayKey]) {
                    languagesByDay[dayKey] = {};
                }
                if (shares.length === 0) {
                    continue;
                }
                for (const share of shares) {
                    addLangAmount(
                        languagesByDay[dayKey],
                        share.language,
                        share.color,
                        commitCount * share.ratio,
                    );
                }
            }
        },
    );
    const calendar = user.contributionsCollection.contributionCalendar.weeks
        .flatMap((week) => week.contributionDays)
        .map((week) => {
            const date = new Date(week.date);
            const dayLangs = languagesByDay[toUtcDateKey(date)] || {};
            return {
                contributionCount: week.contributionCount,
                contributionLevel: toNumberContributionLevel(
                    week.contributionLevel,
                ),
                date,
                languages: langColors.stackFromLangs(
                    Object.values(dayLangs),
                    true,
                ),
            };
        });
    const languages: Array<type.LangInfo> = Object.values(
        contributesLanguage,
    ).sort((obj1, obj2) => -compare(obj1.contributions, obj2.contributions));

    const totalForkCount = user.repositories.nodes
        .map((node) => node.forkCount)
        .reduce((num1, num2) => num1 + num2, 0);
    const totalStargazerCount = user.repositories.nodes
        .map((node) => node.stargazerCount)
        .reduce((num1, num2) => num1 + num2, 0);
    const userInfo: type.UserInfo = {
        isHalloween:
            user.contributionsCollection.contributionCalendar.isHalloween,
        contributionCalendar: calendar,
        contributesLanguage: languages,
        totalContributions:
            user.contributionsCollection.contributionCalendar
                .totalContributions,
        totalCommitContributions:
            user.contributionsCollection.totalCommitContributions,
        totalIssueContributions:
            user.contributionsCollection.totalIssueContributions,
        totalPullRequestContributions:
            user.contributionsCollection.totalPullRequestContributions,
        totalPullRequestReviewContributions:
            user.contributionsCollection.totalPullRequestReviewContributions,
        totalRepositoryContributions:
            user.contributionsCollection.totalRepositoryContributions,
        totalForkCount: totalForkCount,
        totalStargazerCount: totalStargazerCount,
    };
    return userInfo;
};
