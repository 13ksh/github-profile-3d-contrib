import * as d3 from 'd3';
import * as util from './utils';
import * as type from './type';
import {
    languagePatternId,
    uniqueLanguageColors,
} from './apply-language-colors';

const ANGLE = 30;
const DARKER_LEFT = 0.5;
const DARKER_RIGHT = 1;

const toEpochDays = (date: Date): number =>
    Math.floor(date.getTime() / (24 * 60 * 60 * 1000));

type PanelType = 'top' | 'left' | 'right';

const addNormalColor = (
    path: d3.Selection<SVGRectElement, unknown, null, unknown>,
    contribLevel: number,
    panel: PanelType,
): void => {
    path.attr('class', `cont-${panel}-${contribLevel}`);
};

const decideSeasonPatternNo = (date: Date): number => {
    const sunday = new Date(date.getTime());
    sunday.setDate(sunday.getDate() - sunday.getDay());

    const month = sunday.getUTCMonth();
    const dayOfMonth = sunday.getUTCDate();

    const diff =
        dayOfMonth <= 7
            ? 0
            : dayOfMonth <= 14
              ? 1
              : dayOfMonth <= 21
                ? 2
                : dayOfMonth <= 28
                  ? 3
                  : 4;

    switch (month + 1) {
        case 9:
            // summer -> autumn = 0-4
            return 0 + diff;
        case 10:
        case 11:
            // autumn = 4
            return 4;
        case 12:
            // autumn -> winter = 5-9
            return 5 + diff;
        case 1:
        case 2:
            // winter = 9
            return 9;
        case 3:
            // winter -> spring = 10-14
            return 10 + diff;
        case 4:
        case 5:
            // spring = 14
            return 14;
        case 6:
            // spring -> summer = 15-19
            return 15 + diff;
        case 7:
        case 8:
        default:
            // summer = 19
            return 19;
    }
};

const addSeasonColor = (
    path: d3.Selection<SVGRectElement, unknown, null, unknown>,
    contribLevel: number,
    panel: PanelType,
    date: Date,
): void => {
    const pattern = decideSeasonPatternNo(date);
    path.attr('class', `cont-${panel}-p${pattern}-${contribLevel}`);
};

const addRainbowColor = (
    path: d3.Selection<SVGRectElement, unknown, null, unknown>,
    contribLevel: number,
    panel: PanelType,
    settings: type.RainbowColorSettings,
    week: number,
): void => {
    const className = `rb-l${contribLevel}-${panel}`;
    const offsetHue = week * settings.hueRatio;
    const normalizedHue = ((offsetHue % 360) + 360) % 360;
    const durationSeconds = parseFloat(settings.duration);
    const delaySeconds = -(normalizedHue / 360) * durationSeconds;

    path.attr('class', className).attr(
        'style',
        `animation-delay:${delaySeconds.toFixed(3)}s`,
    );
};

const addBitmapPattern = (
    path: d3.Selection<SVGRectElement, unknown, null, unknown>,
    contributionLevel: number,
    panel: PanelType,
): void => {
    path.attr('fill', `url(#pattern_${contributionLevel}_${panel})`);
};

const atan = (value: number) => (Math.atan(value) * 360) / 2 / Math.PI;

const paintBitmapPath = (panelPattern: type.PanelPattern): string => {
    const width = Math.max(1, panelPattern.width);
    const path = d3.path();
    for (const [y, bitmapValue] of panelPattern.bitmap.entries()) {
        const bitmap =
            typeof bitmapValue === 'string'
                ? parseInt(bitmapValue, 16)
                : bitmapValue;
        for (let x = 0; x < width; x++) {
            if ((bitmap & (1 << (width - x - 1))) !== 0) {
                path.rect(x, y, 1, 1);
            }
        }
    }
    return path.toString();
};

const addPatternForBitmap = (
    defs: d3.Selection<SVGDefsElement, unknown, null, unknown>,
    panelPattern: type.PanelPattern,
    contributionLevel: number,
    panel: PanelType,
): void => {
    const width = Math.max(1, panelPattern.width);
    const height = Math.max(1, panelPattern.bitmap.length);
    const pattern = defs
        .append('pattern')
        .attr('id', `pattern_${contributionLevel}_${panel}`)
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', width)
        .attr('height', height)
        .attr('patternUnits', 'userSpaceOnUse');
    pattern
        .append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', width)
        .attr('height', height)
        .attr('class', `cont-${panel}-bg-${contributionLevel}`);
    pattern
        .append('path')
        .attr('stroke', 'none')
        .attr('class', `cont-${panel}-fg-${contributionLevel}`)
        .attr('d', paintBitmapPath(panelPattern));
};

const addLanguageBitmapPattern = (
    defs: d3.Selection<SVGDefsElement, unknown, null, unknown>,
    panelPattern: type.PanelPattern,
    patternId: string,
    color: string,
    panel: PanelType,
): void => {
    const width = Math.max(1, panelPattern.width);
    const height = Math.max(1, panelPattern.bitmap.length);
    const darker = panel === 'top' ? 0 : panel === 'left' ? DARKER_LEFT : DARKER_RIGHT;
    const bg = d3.rgb(color).darker(darker).toString();
    const fg = d3.rgb(color).darker(darker + 0.8).toString();
    const pattern = defs
        .append('pattern')
        .attr('id', patternId)
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', width)
        .attr('height', height)
        .attr('patternUnits', 'userSpaceOnUse');
    pattern
        .append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', width)
        .attr('height', height)
        .attr('fill', bg);
    pattern
        .append('path')
        .attr('stroke', 'none')
        .attr('fill', fg)
        .attr('d', paintBitmapPath(panelPattern));
};

export const addDefines = (
    svg: d3.Selection<SVGSVGElement, unknown, null, unknown>,
    settings: type.Settings,
    userInfo?: type.UserInfo,
): void => {
    if (settings.type !== 'bitmap') {
        return;
    }
    const defs = svg.append('defs');
    for (const [contribLevel, info] of settings.contribPatterns.entries()) {
        addPatternForBitmap(defs, info.top, contribLevel, 'top');
        addPatternForBitmap(defs, info.left, contribLevel, 'left');
        addPatternForBitmap(defs, info.right, contribLevel, 'right');
    }
    if (!userInfo) {
        return;
    }
    const langs = uniqueLanguageColors(userInfo);
    const template = settings.contribPatterns[1] || settings.contribPatterns[0];
    langs.forEach((layer) => {
        const id = languagePatternId(layer.language, layer.color);
        addLanguageBitmapPattern(
            defs,
            template.top,
            `pattern_${id}_top`,
            layer.color,
            'top',
        );
        addLanguageBitmapPattern(
            defs,
            template.left,
            `pattern_${id}_left`,
            layer.color,
            'left',
        );
        addLanguageBitmapPattern(
            defs,
            template.right,
            `pattern_${id}_right`,
            layer.color,
            'right',
        );
    });
};

const paintPanel = (
    panel: d3.Selection<SVGRectElement, unknown, null, unknown>,
    contribLevel: number,
    face: PanelType,
    settings: type.FullSettings,
    date: Date,
    week: number,
): void => {
    if (settings.type === 'normal') {
        addNormalColor(panel, contribLevel, face);
    } else if (settings.type === 'season') {
        addSeasonColor(panel, contribLevel, face, date);
    } else if (settings.type === 'rainbow') {
        addRainbowColor(panel, contribLevel, face, settings, week);
    } else if (settings.type === 'bitmap') {
        addBitmapPattern(panel, contribLevel, face);
    }
};

const drawSolidBrick = (
    bar: d3.Selection<SVGGElement, unknown, null, unknown>,
    calHeight: number,
    contribLevel: number,
    settings: type.FullSettings,
    dxx: number,
    dyy: number,
    isAnimate: boolean,
    date: Date,
    week: number,
): void => {
    const widthTop =
        settings.type === 'bitmap'
            ? Math.max(1, settings.contribPatterns[contribLevel].top.width)
            : dxx;
    const topPanel = bar
        .append('rect')
        .attr('stroke', 'none')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', util.toFixed(widthTop))
        .attr('height', util.toFixed(widthTop))
        .attr(
            'transform',
            `skewY(${-ANGLE}) skewX(${util.toFixed(
                atan(dxx / 2 / dyy),
            )}) scale(${util.toFixed(dxx / widthTop)} ${util.toFixed(
                (2 * dyy) / widthTop,
            )})`,
        );
    paintPanel(topPanel, contribLevel, 'top', settings, date, week);

    const widthLeft =
        settings.type === 'bitmap'
            ? Math.max(1, settings.contribPatterns[contribLevel].left.width)
            : dxx;
    const scaleLeft = Math.sqrt(dxx ** 2 + dyy ** 2) / widthLeft;
    const heightLeft = calHeight / scaleLeft;
    const leftPanel = bar
        .append('rect')
        .attr('stroke', 'none')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', util.toFixed(widthLeft))
        .attr('height', util.toFixed(heightLeft))
        .attr(
            'transform',
            `skewY(${ANGLE}) scale(${util.toFixed(
                dxx / widthLeft,
            )} ${util.toFixed(scaleLeft)})`,
        );
    paintPanel(leftPanel, contribLevel, 'left', settings, date, week);
        if (isAnimate && contribLevel !== 0) {
            leftPanel
                .append('animate')
                .attr('attributeName', 'height')
                .attr(
                    'values',
                    `${util.toFixed(3 / scaleLeft)};${util.toFixed(heightLeft)}`,
                )
                .attr('dur', '3s')
                .attr('fill', 'freeze')
                .attr('repeatCount', '1');
        }

    const widthRight =
        settings.type === 'bitmap'
            ? Math.max(1, settings.contribPatterns[contribLevel].right.width)
            : dxx;
    const scaleRight = Math.sqrt(dxx ** 2 + dyy ** 2) / widthRight;
    const heightRight = calHeight / scaleRight;
    const rightPanel = bar
        .append('rect')
        .attr('stroke', 'none')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', util.toFixed(widthRight))
        .attr('height', util.toFixed(heightRight))
        .attr(
            'transform',
            `translate(${util.toFixed(dxx)} ${util.toFixed(
                dyy,
            )}) skewY(${-ANGLE}) scale(${util.toFixed(
                dxx / widthRight,
            )} ${util.toFixed(scaleRight)})`,
        );
    paintPanel(rightPanel, contribLevel, 'right', settings, date, week);
    if (isAnimate && contribLevel !== 0) {
        rightPanel
            .append('animate')
            .attr('attributeName', 'height')
            .attr(
                'values',
                `${util.toFixed(3 / scaleRight)};${util.toFixed(heightRight)}`,
            )
            .attr('dur', '3s')
            .attr('fill', 'freeze')
            .attr('repeatCount', '1');
    }
};

const animateFloorGrow = (
    panel: d3.Selection<SVGRectElement, unknown, null, unknown>,
    startY: number,
    endY: number,
    startHeight: number,
    endHeight: number,
): void => {
    panel
        .append('animate')
        .attr('attributeName', 'y')
        .attr('values', `${util.toFixed(startY)};${util.toFixed(endY)}`)
        .attr('dur', '3s')
        .attr('fill', 'freeze')
        .attr('repeatCount', '1');
    panel
        .append('animate')
        .attr('attributeName', 'height')
        .attr(
            'values',
            `${util.toFixed(startHeight)};${util.toFixed(endHeight)}`,
        )
        .attr('dur', '3s')
        .attr('fill', 'freeze')
        .attr('repeatCount', '1');
};

const drawStackedLanguageBrick = (
    bar: d3.Selection<SVGGElement, unknown, null, unknown>,
    calHeight: number,
    stack: type.LangLayer[],
    settings: type.BitmapPatternSettings,
    dxx: number,
    dyy: number,
    isAnimate: boolean,
): void => {
    const template = settings.contribPatterns[1] || settings.contribPatterns[0];
    const widthTop = Math.max(1, template.top.width);
    const topLayer = stack[stack.length - 1];
    const topId = languagePatternId(topLayer.language, topLayer.color);
    bar.append('rect')
        .attr('stroke', 'none')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', util.toFixed(widthTop))
        .attr('height', util.toFixed(widthTop))
        .attr('fill', `url(#pattern_${topId}_top)`)
        .attr(
            'transform',
            `skewY(${-ANGLE}) skewX(${util.toFixed(
                atan(dxx / 2 / dyy),
            )}) scale(${util.toFixed(dxx / widthTop)} ${util.toFixed(
                (2 * dyy) / widthTop,
            )})`,
        );

    const widthLeft = Math.max(1, template.left.width);
    const scaleLeft = Math.sqrt(dxx ** 2 + dyy ** 2) / widthLeft;
    const widthRight = Math.max(1, template.right.width);
    const scaleRight = Math.sqrt(dxx ** 2 + dyy ** 2) / widthRight;
    const startRatio = Math.min(1, 3 / calHeight);

    let yFromTop = 0;
    for (let i = stack.length - 1; i >= 0; i--) {
        const layer = stack[i];
        const layerHeight = calHeight * layer.ratio;
        const patternId = languagePatternId(layer.language, layer.color);
        const leftY = yFromTop / scaleLeft;
        const leftH = layerHeight / scaleLeft;
        const rightY = yFromTop / scaleRight;
        const rightH = layerHeight / scaleRight;
        const leftPanel = bar
            .append('rect')
            .attr('stroke', 'none')
            .attr('x', 0)
            .attr('y', util.toFixed(leftY))
            .attr('width', util.toFixed(widthLeft))
            .attr('height', util.toFixed(leftH))
            .attr('fill', `url(#pattern_${patternId}_left)`)
            .attr(
                'transform',
                `skewY(${ANGLE}) scale(${util.toFixed(
                    dxx / widthLeft,
                )} ${util.toFixed(scaleLeft)})`,
            );
        const rightPanel = bar
            .append('rect')
            .attr('stroke', 'none')
            .attr('x', 0)
            .attr('y', util.toFixed(rightY))
            .attr('width', util.toFixed(widthRight))
            .attr('height', util.toFixed(rightH))
            .attr('fill', `url(#pattern_${patternId}_right)`)
            .attr(
                'transform',
                `translate(${util.toFixed(dxx)} ${util.toFixed(
                    dyy,
                )}) skewY(${-ANGLE}) scale(${util.toFixed(
                    dxx / widthRight,
                )} ${util.toFixed(scaleRight)})`,
            );
        if (isAnimate) {
            animateFloorGrow(
                leftPanel,
                leftY * startRatio,
                leftY,
                leftH * startRatio,
                leftH,
            );
            animateFloorGrow(
                rightPanel,
                rightY * startRatio,
                rightY,
                rightH * startRatio,
                rightH,
            );
        }
        yFromTop += layerHeight;
    }
};

export const create3DContrib = (
    svg: d3.Selection<SVGSVGElement, unknown, null, unknown>,
    userInfo: type.UserInfo,
    x: number,
    y: number,
    width: number,
    height: number,
    settings: type.FullSettings,
    isForcedAnimation = false,
): void => {
    if (userInfo.contributionCalendar.length === 0) {
        return;
    }

    const firstDate = userInfo.contributionCalendar[0].date;
    const sundayOfFirstWeek = toEpochDays(firstDate) - firstDate.getUTCDay();
    const weekcount = Math.ceil(
        (userInfo.contributionCalendar.length + firstDate.getUTCDay()) / 7.0,
    );
    const dx = width / 64;
    const dy = dx * Math.tan(ANGLE * ((2 * Math.PI) / 360));
    const dxx = dx * 0.9;
    const dyy = dy * 0.9;

    const offsetX = dx * 7;
    const offsetY = height - (weekcount + 7) * dy;

    const group = svg.append('g');

    userInfo.contributionCalendar.forEach((cal) => {
        const week = Math.floor(
            (toEpochDays(cal.date) - sundayOfFirstWeek) / 7,
        );
        const dayOfWeek = cal.date.getUTCDay(); // sun = 0, mon = 1, ...

        const baseX = offsetX + (week - dayOfWeek) * dx;
        const baseY = offsetY + (week + dayOfWeek) * dy;
        // ref. https://github.com/yoshi389111/github-profile-3d-contrib/issues/27
        const calHeight = Math.log10(cal.contributionCount / 20 + 1) * 144 + 3;
        const contribLevel = cal.contributionLevel;
        const dayStack = cal.languages;

        const isAnimate = settings.growingAnimation || isForcedAnimation;

        const bar = group
            .append('g')
            .attr(
                'transform',
                `translate(${util.toFixed(baseX)} ${util.toFixed(
                    baseY - calHeight,
                )})`,
            );
        if (isAnimate && contribLevel !== 0) {
            bar.append('animateTransform')
                .attr('attributeName', 'transform')
                .attr('type', 'translate')
                .attr(
                    'values',
                    `${util.toFixed(baseX)} ${util.toFixed(
                        baseY - 3,
                    )};${util.toFixed(baseX)} ${util.toFixed(
                        baseY - calHeight,
                    )}`,
                )
                .attr('dur', '3s')
                .attr('fill', 'freeze')
                .attr('repeatCount', '1');
        }

        if (settings.type === 'bitmap' && dayStack.length > 0 && contribLevel !== 0) {
            drawStackedLanguageBrick(
                bar,
                calHeight,
                dayStack,
                settings,
                dxx,
                dyy,
                isAnimate,
            );
        } else {
            drawSolidBrick(
                bar,
                calHeight,
                contribLevel,
                settings,
                dxx,
                dyy,
                isAnimate,
                cal.date,
                week,
            );
        }
    });

    addCalendarLabels(group, userInfo, weekcount, offsetX, offsetY, dx, dy, dxx, dyy);
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
];

const addStackedLabel = (
    group: d3.Selection<SVGGElement, unknown, null, unknown>,
    x: number,
    y: number,
    label: string,
    lineHeight: number,
): void => {
    const text = group
        .append('text')
        .attr('class', 'fill-weak')
        .attr('text-anchor', 'middle')
        .style('font-size', '10px');
    [...label].forEach((ch, i) => {
        text.append('tspan')
            .attr('x', util.toFixed(x))
            .attr('y', util.toFixed(y + i * lineHeight))
            .text(ch);
    });
};

const addCalendarLabels = (
    group: d3.Selection<SVGGElement, unknown, null, unknown>,
    userInfo: type.UserInfo,
    weekcount: number,
    offsetX: number,
    offsetY: number,
    dx: number,
    dy: number,
    dxx: number,
    dyy: number,
): void => {
    const lastWeek = Math.max(0, weekcount - 1);
    DAY_LABELS.forEach((label, dayOfWeek) => {
        const baseX = offsetX + (lastWeek - dayOfWeek) * dx;
        const baseY = offsetY + (lastWeek + dayOfWeek) * dy;
        group
            .append('text')
            .attr('x', util.toFixed(baseX + dxx * 3.8))
            .attr('y', util.toFixed(baseY + dyy * 0.35))
            .attr('class', 'fill-weak')
            .attr('dominant-baseline', 'middle')
            .style('font-size', '11px')
            .text(label);
    });

    const days = userInfo.contributionCalendar;
    const firstWeekday = days[0].date.getUTCDay();
    let lastMonth = -1;
    for (let week = 0; week < weekcount; week++) {
        const sampleIndex = Math.min(
            Math.max(0, week * 7 - firstWeekday),
            days.length - 1,
        );
        const month = days[sampleIndex].date.getUTCMonth();
        if (month === lastMonth) {
            continue;
        }
        lastMonth = month;
        const dayOfWeek = 6;
        const baseX = offsetX + (week - dayOfWeek) * dx;
        const baseY = offsetY + (week + dayOfWeek) * dy;
        addStackedLabel(
            group,
            baseX + dxx * 0.45,
            baseY + dyy * 2.6,
            MONTH_LABELS[month],
            11,
        );
    }
};
