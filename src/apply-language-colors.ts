import * as type from './type';

const OTHER_RATIO = 0.001;

export type LangLayer = {
    language: string;
    color: string;
    ratio: number;
};

export const languageStack = (userInfo: type.UserInfo): LangLayer[] => {
    const source = userInfo.contributesLanguage.filter(
        (lang) =>
            lang.language.toLowerCase() !== 'other' &&
            !!lang.color &&
            lang.color !== '#444444',
    );
    const listedSum = source.reduce((sum, lang) => sum + lang.contributions, 0);
    const total = listedSum || userInfo.totalCommitContributions;
    if (total <= 0) {
        return [];
    }
    const kept = source.filter((lang) => lang.contributions / total >= OTHER_RATIO);
    const keptSum = kept.reduce((sum, lang) => sum + lang.contributions, 0);
    if (keptSum <= 0) {
        return [];
    }
    return kept.map((lang) => ({
        language: lang.language,
        color: lang.color,
        ratio: lang.contributions / keptSum,
    }));
};

export const withLanguageGrassColors = (
    settings: type.Settings,
    userInfo: type.UserInfo,
): type.Settings => {
    if (
        settings.type === 'pie_lang_only' ||
        settings.type === 'radar_contrib_only'
    ) {
        return settings;
    }
    const cloned = JSON.parse(JSON.stringify(settings)) as type.Settings;
    const stack = languageStack(userInfo);
    if (stack[0] && 'radarColor' in cloned) {
        cloned.radarColor = stack[0].color;
    }
    return cloned;
};
