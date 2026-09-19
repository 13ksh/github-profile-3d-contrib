import * as d3 from 'd3';
import * as util from './utils';
import * as type from './type';

const ANGLE = 30;

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
    pattern
        .append('path')
        .attr('stroke', 'none')
        .attr('class', `cont-${panel}-fg-${contributionLevel}`)
        .attr('d', path.toString());
};

export const addDefines = (
    svg: d3.Selection<SVGSVGElement, unknown, null, unknown>,
    settings: type.Settings,
): void => {
    if (settings.type === 'bitmap') {
        const defs = svg.append('defs');
        for (const [contribLevel, info] of settings.contribPatterns.entries()) {
            addPatternForBitmap(defs, info.top, contribLevel, 'top');
            addPatternForBitmap(defs, info.left, contribLevel, 'left');
            addPatternForBitmap(defs, info.right, contribLevel, 'right');
        }
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
                .attr('repeatCount', '1');
        }

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

        if (settings.type === 'normal') {
            addNormalColor(topPanel, contribLevel, 'top');
        } else if (settings.type === 'season') {
            addSeasonColor(topPanel, contribLevel, 'top', cal.date);
        } else if (settings.type === 'rainbow') {
            addRainbowColor(topPanel, contribLevel, 'top', settings, week);
        } else if (settings.type === 'bitmap') {
            addBitmapPattern(topPanel, contribLevel, 'top');
        }

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

        if (settings.type === 'normal') {
            addNormalColor(leftPanel, contribLevel, 'left');
        } else if (settings.type === 'season') {
            addSeasonColor(leftPanel, contribLevel, 'left', cal.date);
        } else if (settings.type === 'rainbow') {
            addRainbowColor(leftPanel, contribLevel, 'left', settings, week);
        } else if (settings.type === 'bitmap') {
            addBitmapPattern(leftPanel, contribLevel, 'left');
        }
        if (isAnimate && contribLevel !== 0) {
            leftPanel
                .append('animate')
                .attr('attributeName', 'height')
                .attr(
                    'values',
                    `${util.toFixed(3 / scaleLeft)};${util.toFixed(heightLeft)}`,
                )
                .attr('dur', '3s')
                .attr('repeatCount', '1');
        }

        const widthRight =
            settings.type === 'bitmap'
                ? Math.max(
                      1,
                      settings.contribPatterns[contribLevel].right.width,
                  )
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

        if (settings.type === 'normal') {
            addNormalColor(rightPanel, contribLevel, 'right');
        } else if (settings.type === 'season') {
            addSeasonColor(rightPanel, contribLevel, 'right', cal.date);
        } else if (settings.type === 'rainbow') {
            addRainbowColor(rightPanel, contribLevel, 'right', settings, week);
        } else if (settings.type === 'bitmap') {
            addBitmapPattern(rightPanel, contribLevel, 'right');
        }
        if (isAnimate && contribLevel !== 0) {
            rightPanel
                .append('animate')
                .attr('attributeName', 'height')
                .attr(
                    'values',
                    `${util.toFixed(3 / scaleRight)};${util.toFixed(
                        heightRight,
                    )}`,
                )
                .attr('dur', '3s')
                .attr('repeatCount', '1');
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
            .attr('x', util.toFixed(baseX + dxx * 1.7))
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
        group
            .append('text')
            .attr('class', 'fill-weak')
            .style('font-size', '11px')
            .attr(
                'transform',
                `translate(${util.toFixed(baseX + dxx * 0.2)} ${util.toFixed(
                    baseY + dyy * 2.2,
                )}) rotate(90)`,
            )
            .text(MONTH_LABELS[month]);
    }
};
