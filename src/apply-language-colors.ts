import * as d3 from 'd3';
import * as type from './type';

const EMPTY_COLOR = '#ebedf0';

export const languageGrassColors = (userInfo: type.UserInfo): [string, string, string, string, string] => {
    const langs = userInfo.contributesLanguage.filter(
        (lang) =>
            lang.language.toLowerCase() !== 'other' &&
            !!lang.color &&
            lang.color !== '#444444',
    );
    if (langs.length === 0) {
        return ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
    }
    const top = langs.slice(0, 4);
    while (top.length < 4) {
        const last = top[top.length - 1];
        top.push(last);
    }
    return [
        EMPTY_COLOR,
        top[3].color,
        top[2].color,
        top[1].color,
        top[0].color,
    ];
};

const paintBitmap = (
    settings: type.BitmapPatternSettings,
    colors: [string, string, string, string, string],
): void => {
    settings.contribPatterns.forEach((pattern, i) => {
        const color = colors[i];
        pattern.top.backgroundColor = color;
        pattern.top.foregroundColor = d3.rgb(color).darker(1.2).toString();
        delete pattern.left.backgroundColor;
        delete pattern.left.foregroundColor;
        delete pattern.right.backgroundColor;
        delete pattern.right.foregroundColor;
    });
    settings.radarColor = colors[4];
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
    const colors = languageGrassColors(userInfo);
    if (cloned.type === 'bitmap') {
        paintBitmap(cloned, colors);
    } else if (cloned.type === 'normal') {
        cloned.contribColors = colors;
        cloned.radarColor = colors[4];
    } else if (cloned.type === 'season') {
        cloned.contribColors1 = colors;
        cloned.contribColors2 = colors;
        cloned.contribColors3 = colors;
        cloned.contribColors4 = colors;
        cloned.radarColor = colors[4];
    }
    return cloned;
};
