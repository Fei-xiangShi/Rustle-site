// Original lyrics written for the demo — not taken from any real song.
import type { LyricLine, LyricWord } from '@applemusic-like-lyrics/core';

export type CoverKey = 'leaves' | 'blueHour';

export interface DemoSong {
  title: string;
  artist: string;
  /** Seconds. */
  duration: number;
  cover: CoverKey;
  lines: LyricLine[];
}

/**
 * Splits `text` into words timed across [start, end] seconds. A trailing `*`
 * stretches that word into a held note, which AMLL renders with emphasis.
 */
function words(start: number, end: number, text: string): LyricWord[] {
  const parts = text.split(' ').map((raw, i, all) => {
    const held = raw.endsWith('*');
    const word = (held ? raw.slice(0, -1) : raw) + (i < all.length - 1 ? ' ' : '');
    return { word, weight: (word.trim().length + 1.2) * (held ? 2.6 : 1) };
  });
  const total = parts.reduce((sum, p) => sum + p.weight, 0);
  let cursor = start * 1000;
  return parts.map(({ word, weight }) => {
    const span = ((end - start) * 1000 * weight) / total;
    const w = { word, startTime: Math.round(cursor), endTime: Math.round(cursor + span) };
    cursor += span;
    return w;
  });
}

function line(
  start: number,
  end: number,
  text: string,
  translation: string,
  extra: { duet?: boolean; bg?: [number, number, string] } = {},
): LyricLine[] {
  const isDuet = extra.duet ?? false;
  const main: LyricLine = {
    words: words(start, end, text),
    translatedLyric: translation,
    romanLyric: '',
    startTime: Math.round(start * 1000),
    endTime: Math.round(end * 1000),
    isBG: false,
    isDuet,
  };
  if (!extra.bg) return [main];
  const [bgStart, bgEnd, bgText] = extra.bg;
  return [
    main,
    {
      words: words(bgStart, bgEnd, bgText),
      translatedLyric: '',
      romanLyric: '',
      startTime: Math.round(bgStart * 1000),
      endTime: Math.round(bgEnd * 1000),
      isBG: true,
      isDuet,
    },
  ];
}

export const songs: DemoSong[] = [
  {
    title: 'Leaves in Motion',
    artist: 'Rustle Ensemble',
    duration: 36,
    cover: 'leaves',
    lines: [
      line(0.8, 4.6, 'Leaves are falling slowly in the evening light', '落叶在暮色里缓缓飘落'),
      line(4.8, 8.6, 'Every color softly turning into gold', '每一种颜色，都悄悄化作金黄'),
      line(8.8, 12.7, 'Can you hear the rustle when the wind comes home?', '风归来时，你可听见那沙沙声？', {
        duet: true,
      }),
      line(12.9, 16.6, 'Every word I sing begins to glow*', '我唱出的每个字，都开始发光', {
        bg: [15.2, 17.4, '(begins to glow)'],
      }),
      line(21.6, 25.4, 'Hold the moment, let the music breathe', '留住此刻，让音乐呼吸'),
      line(25.6, 29.4, 'Native as the night and quiet as the sea', '如夜色般原生，如海洋般安静', { duet: true }),
      line(29.6, 34.2, 'Stay with me until the last note fades away*', '陪我，直到最后一个音符消散'),
    ].flat(),
  },
  {
    title: 'Blue Hour',
    artist: 'Night Tram Society',
    duration: 33,
    cover: 'blueHour',
    lines: [
      line(0.8, 4.4, 'City lights are swimming in the window glass', '城市的灯光，在车窗玻璃里游动'),
      line(4.6, 8.3, 'Turn the volume up and let the colors pass', '调高音量，让色彩流过', { duet: true }),
      line(8.5, 12.2, 'Every frame is painted in a hundred hues', '每一帧，都由百种色调绘成'),
      line(12.4, 16.2, 'Falling into blue*', '坠入蓝色之中', { bg: [14.6, 16.8, '(into blue)'] }),
      line(20.4, 24.1, 'Hold on to the rhythm, hold on to the night', '抓紧节拍，抓紧这夜晚', { duet: true }),
      line(24.3, 28.0, 'Say it one more time and let the chorus glow*', '再唱一次，让副歌发光'),
      line(28.2, 31.6, 'We are only echoes in the afterglow', '我们只是余晖里的回声'),
    ].flat(),
  },
];
