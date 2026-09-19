import * as d3 from 'd3';
import * as type from './type';

const GITHUB_CONTRIB_COLORS = [
    '#ebedf0',
    '#9be9a8',
    '#40c463',
    '#30a14e',
    '#216e39',
];

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

const CELL = 11;
const GAP = 3;
const STEP = CELL + GAP;
const DAY_LABEL_WIDTH = 34;
const MONTH_LABEL_HEIGHT = 18;

export const CALENDAR_HEIGHT = 176;

const levelColor = (settings: type.Settings, level: number): string => {
    const safeLevel = Math.max(0, Math.min(4, level));
    if (settings.type === 'bitmap') {
        const pattern = settings.contribPatterns[safeLevel];
        if (pattern?.top?.backgroundColor) {
            return pattern.top.backgroundColor;
        }
    }
    if (settings.type === 'normal' && settings.contribColors) {
        return settings.contribColors[safeLevel];
    }
    return GITHUB_CONTRIB_COLORS[safeLevel];
};

export const createGithubCalendar = (
    svg: d3.Selection<SVGSVGElement, unknown, null, unknown>,
    userInfo: type.UserInfo,
    x: number,
    y: number,
    width: number,
    settings: type.Settings,
): void => {
    const days = userInfo.contributionCalendar;
    if (!days.length) {
        return;
    }

    const group = svg.append('g').attr('transform', `translate(${x}, ${y})`);
    const first = days[0].date;
    const firstWeekday = first.getUTCDay();
    const weekCount = Math.ceil((firstWeekday + days.length) / 7);
    const graphWidth = DAY_LABEL_WIDTH + weekCount * STEP - GAP;
    const offsetX = Math.max(0, (width - graphWidth) / 2);

    group
        .append('text')
        .attr('x', offsetX)
        .attr('y', 12)
        .attr('class', 'fill-fg')
        .style('font-size', '14px')
        .style('font-weight', '600')
        .text(`${userInfo.totalContributions} contributions in the last year`);

    const plot = group
        .append('g')
        .attr('transform', `translate(${offsetX}, ${28})`);

    DAY_LABELS.forEach((label, dayIndex) => {
        plot.append('text')
            .attr('x', DAY_LABEL_WIDTH - 6)
            .attr('y', MONTH_LABEL_HEIGHT + dayIndex * STEP + CELL - 1)
            .attr('text-anchor', 'end')
            .attr('class', 'fill-weak')
            .style('font-size', '10px')
            .text(label);
    });

    let lastMonth = -1;
    for (let week = 0; week < weekCount; week++) {
        const sampleIndex = Math.max(0, week * 7 - firstWeekday);
        const sample = days[Math.min(sampleIndex, days.length - 1)];
        const month = sample.date.getUTCMonth();
        if (month !== lastMonth) {
            lastMonth = month;
            plot.append('text')
                .attr('x', DAY_LABEL_WIDTH + week * STEP)
                .attr('y', 10)
                .attr('class', 'fill-weak')
                .style('font-size', '10px')
                .text(MONTH_LABELS[month]);
        }
    }

    days.forEach((day, index) => {
        const pos = firstWeekday + index;
        const week = Math.floor(pos / 7);
        const weekday = pos % 7;
        const cellX = DAY_LABEL_WIDTH + week * STEP;
        const cellY = MONTH_LABEL_HEIGHT + weekday * STEP;
        plot.append('rect')
            .attr('x', cellX)
            .attr('y', cellY)
            .attr('width', CELL)
            .attr('height', CELL)
            .attr('rx', 2)
            .attr('ry', 2)
            .attr('fill', levelColor(settings, day.contributionLevel))
            .append('title')
            .text(
                `${day.contributionCount} contributions on ${day.date
                    .toISOString()
                    .slice(0, 10)}`,
            );
    });

    const legendY = MONTH_LABEL_HEIGHT + 7 * STEP + 16;
    const legend = plot
        .append('g')
        .attr(
            'transform',
            `translate(${DAY_LABEL_WIDTH + weekCount * STEP - 5 * STEP - 70}, ${legendY})`,
        );
    legend
        .append('text')
        .attr('x', 0)
        .attr('y', CELL - 1)
        .attr('class', 'fill-weak')
        .style('font-size', '10px')
        .text('Less');
    GITHUB_CONTRIB_COLORS.forEach((_, level) => {
        legend
            .append('rect')
            .attr('x', 32 + level * STEP)
            .attr('y', 0)
            .attr('width', CELL)
            .attr('height', CELL)
            .attr('rx', 2)
            .attr('ry', 2)
            .attr('fill', levelColor(settings, level));
    });
    legend
        .append('text')
        .attr('x', 32 + 5 * STEP + 4)
        .attr('y', CELL - 1)
        .attr('class', 'fill-weak')
        .style('font-size', '10px')
        .text('More');
};
