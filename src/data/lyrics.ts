// Original lyrics written for the demo — not taken from any real song.

export interface DemoWord {
  text: string;
  start: number;
  end: number;
  /** Held note: rendered per character with glow and lift. */
  glow?: boolean;
}

export interface DemoLine {
  start: number;
  end: number;
  words: DemoWord[];
  translation?: string;
  /** Second singer: right-aligned. */
  duet?: boolean;
  /** Background vocal row shown under the main line. */
  bg?: DemoWord[];
}

export interface DemoSong {
  title: string;
  artist: string;
  duration: number;
  /** Colours "extracted" from the cover, fed to the mesh gradient. */
  palette: string[];
  lines: DemoLine[];
}

/** Splits `text` into words timed across [start, end]; a trailing `*` marks a held note. */
function words(start: number, end: number, text: string): DemoWord[] {
  const parts = text.split(' ').map((raw) => {
    const glow = raw.endsWith('*');
    const word = glow ? raw.slice(0, -1) : raw;
    return { word, glow, weight: (word.length + 1.2) * (glow ? 2.6 : 1) };
  });
  const total = parts.reduce((sum, p) => sum + p.weight, 0);
  let cursor = start;
  return parts.map(({ word, glow, weight }) => {
    const span = ((end - start) * weight) / total;
    const w: DemoWord = { text: word, start: cursor, end: cursor + span, ...(glow ? { glow } : {}) };
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
): DemoLine {
  return {
    start,
    end,
    words: words(start, end, text),
    translation,
    ...(extra.duet ? { duet: true } : {}),
    ...(extra.bg ? { bg: words(...extra.bg) } : {}),
  };
}

export const songs: DemoSong[] = [
  {
    title: 'Leaves in Motion',
    artist: 'Rustle Ensemble',
    duration: 36,
    palette: ['#a2421c', '#d98a45', '#4a170e', '#e2a95e', '#6e2433'],
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
    ],
  },
  {
    title: 'Blue Hour',
    artist: 'Night Tram Society',
    duration: 33,
    palette: ['#0f3d5c', '#1f7a8c', '#0a1f33', '#5fb3c4', '#2c2a6b'],
    lines: [
      line(0.8, 4.4, 'City lights are swimming in the window glass', '城市的灯光，在车窗玻璃里游动'),
      line(4.6, 8.3, 'Turn the volume up and let the colors pass', '调高音量，让色彩流过', { duet: true }),
      line(8.5, 12.2, 'Every frame is painted in a hundred hues', '每一帧，都由百种色调绘成'),
      line(12.4, 16.2, 'Falling into blue*', '坠入蓝色之中', { bg: [14.6, 16.8, '(into blue)'] }),
      line(20.4, 24.1, 'Hold on to the rhythm, hold on to the night', '抓紧节拍，抓紧这夜晚', { duet: true }),
      line(24.3, 28.0, 'Say it one more time and let the chorus glow*', '再唱一次，让副歌发光'),
      line(28.2, 31.6, 'We are only echoes in the afterglow', '我们只是余晖里的回声'),
    ],
  },
];
