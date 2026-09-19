import * as d3 from 'd3';
import * as type from './type';

const OTHER_NAME = 'other';
const OTHER_COLOR = '#444444';
const OTHER_RATIO = 0.001;

const groupLanguages = (userInfo: type.UserInfo): type.LangInfo[] => {
    const source = userInfo.contributesLanguage;
    const listedSum = source.reduce((sum, lang) => sum + lang.contributions, 0);
    const total = userInfo.totalCommitContributions || listedSum;
    if (total <= 0) {
        return [];
    }

    const languages: type.LangInfo[] = [];
    let otherContributions = 0;
    for (const lang of source) {
        if (lang.contributions / total < OTHER_RATIO) {
            otherContributions += lang.contributions;
        } else {
            languages.push({ ...lang });
        }
    }

    const accounted = languages.reduce((sum, lang) => sum + lang.contributions, 0) + otherContributions;
    const leftover = userInfo.totalCommitContributions - accounted;
    if (leftover > 0) {
        otherContributions += leftover;
    }
    if (otherContributions > 0) {
        languages.push({
            language: OTHER_NAME,
            color: OTHER_COLOR,
            contributions: otherContributions,
        });
    }
    return languages;
};

export const createPieLanguage = (
    svg: d3.Selection<SVGSVGElement, unknown, null, unknown>,
    userInfo: type.UserInfo,
    x: number,
    y: number,
    _width: number,
    height: number,
    settings: type.PieLangSettings,
    isForcedAnimation: boolean,
): void => {
    if (userInfo.totalContributions === 0) {
        return;
    }

    const languages = groupLanguages(userInfo);
    if (languages.length === 0) {
        return;
    }

    const isAnimate = settings.growingAnimation || isForcedAnimation;
    const animeSteps = 5;
    const animateOpacity = (num: number) =>
        Array<string>(languages.length + animeSteps)
            .fill('')
            .map((d, i) => (i < num ? 0 : Math.min((i - num) / animeSteps, 1)))
            .join(';');

    const radius = height / 2;
    const margin = radius / 10;

    const row = Math.max(8, languages.length);
    const offset = (row - languages.length) / 2 + 0.5;
    const fontSize = height / row / 1.5;

    const pie = d3
        .pie<type.LangInfo>()
        .value((d) => d.contributions)
        .sortValues(null);
    const pieData = pie(languages);

    const group = svg.append('g').attr('transform', `translate(${x}, ${y})`);

    const groupLabel = group
        .append('g')
        .attr('transform', `translate(${radius * 2.1}, ${0})`);

    // markers for label
    const markers = groupLabel
        .selectAll(null)
        .data(pieData)
        .enter()
        .append('rect')
        .attr('x', 0)
        .attr('y', (d) => (d.index + offset) * (height / row) - fontSize / 2)
        .attr('width', fontSize)
        .attr('height', fontSize)
        .attr('fill', (d) => d.data.color)
        .attr('class', 'stroke-bg')
        .attr('stroke-width', '1px');
    if (isAnimate) {
        markers
            .append('animate')
            .attr('attributeName', 'fill-opacity')
            .attr('values', (d, i) => animateOpacity(i))
            .attr('dur', '3s')
            .attr('repeatCount', '1');
    }

    // labels
    const labels = groupLabel
        .selectAll(null)
        .data(pieData)
        .enter()
        .append('text')
        .attr('dominant-baseline', 'middle')
        .text((d) => d.data.language)
        .attr('x', fontSize * 1.2)
        .attr('y', (d) => (d.index + offset) * (height / row))
        .attr('class', 'fill-fg')
        .attr('font-size', `${fontSize}px`);
    if (isAnimate) {
        labels
            .append('animate')
            .attr('attributeName', 'fill-opacity')
            .attr('values', (d, i) => animateOpacity(i))
            .attr('dur', '3s')
            .attr('repeatCount', '1');
    }

    const arc = d3
        .arc<d3.PieArcDatum<type.LangInfo>>()
        .outerRadius(radius - margin)
        .innerRadius(radius / 2);

    // pie chart
    const paths = group
        .append('g')
        .attr('transform', `translate(${radius}, ${radius})`)
        .selectAll(null)
        .data(pieData)
        .enter()
        .append('path')
        .attr('d', arc)
        .style('fill', (d) => d.data.color) // style -> attr ?
        .attr('class', 'stroke-bg')
        .attr('stroke-width', '2px');
    paths
        .append('title')
        .text((d) => `${d.data.language} ${d.data.contributions}`);
    if (isAnimate) {
        paths
            .append('animate')
            .attr('attributeName', 'fill-opacity')
            .attr('values', (d, i) => animateOpacity(i))
            .attr('dur', '3s')
            .attr('repeatCount', '1');
    }
};
