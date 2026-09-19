import * as type from './type';

const OTHER_RATIO = 0.001;
const OTHER_COLOR = '#444444';

export type LangLayer = type.LangLayer;

export const languagePatternId = (language: string, color: string): string => {
    const name = language.replace(/[^A-Za-z0-9]+/g, '_') || 'lang';
    const hex = color.replace(/[^A-Za-z0-9]/g, '') || '000000';
    return `lang_${name}_${hex}`;
};

export const stackFromLangs = (
    langs: Array<Pick<type.LangInfo, 'language' | 'color' | 'contributions'>>,
    includeOther = false,
): type.LangLayer[] => {
    const source = langs.filter((lang) => {
        if (lang.contributions <= 0 || !lang.color) {
            return false;
        }
        if (
            !includeOther &&
            (lang.language.toLowerCase() === 'other' || lang.color === OTHER_COLOR)
        ) {
            return false;
        }
        return true;
    });
    const total = source.reduce((sum, lang) => sum + lang.contributions, 0);
    if (total <= 0) {
        return [];
    }
    return [...source]
        .sort((a, b) => b.contributions - a.contributions)
        .map((lang) => ({
            language: lang.language,
            color: lang.color,
            ratio: lang.contributions / total,
        }));
};

export const languageStack = (userInfo: type.UserInfo): type.LangLayer[] => {
    const source = userInfo.contributesLanguage.filter(
        (lang) =>
            lang.language.toLowerCase() !== 'other' &&
            !!lang.color &&
            lang.color !== OTHER_COLOR,
    );
    const listedSum = source.reduce((sum, lang) => sum + lang.contributions, 0);
    const total = listedSum || userInfo.totalCommitContributions;
    if (total <= 0) {
        return [];
    }
    const kept = source.filter((lang) => lang.contributions / total >= OTHER_RATIO);
    return stackFromLangs(kept);
};

export const uniqueLanguageColors = (
    userInfo: type.UserInfo,
): Array<{ language: string; color: string }> => {
    const map = new Map<string, string>();
    for (const lang of userInfo.contributesLanguage) {
        if (lang.color && lang.color !== OTHER_COLOR) {
            map.set(lang.language, lang.color);
        }
    }
    for (const day of userInfo.contributionCalendar) {
        for (const layer of day.languages) {
            map.set(layer.language, layer.color);
        }
    }
    return [...map.entries()].map(([language, color]) => ({ language, color }));
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
