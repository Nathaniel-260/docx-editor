/**
 * ECMA-376 preset text-warp geometry data.
 *
 * Generated from the standard's accompanying
 * OfficeOpenXML-DrawingMLGeometries.zip / presetTextWarpDefinitions.xml.
 * Do not hand-edit; regenerate through the evidence-plan script.
 */

export type PresetTextWarpCommand =
  | { kind: 'moveTo' | 'lnTo' | 'quadBezTo' | 'cubicBezTo'; points: Array<{ x: string; y: string }> }
  | { kind: 'arc'; wR: string; hR: string; stAng: string; swAng: string };

export type PresetTextWarpDefinition = {
  adjustments: Array<{ name: string; fmla: string }>;
  guides: Array<{ name: string; fmla: string }>;
  paths: PresetTextWarpCommand[][];
};

export const PRESET_TEXT_WARP_DEFINITIONS: Record<string, PresetTextWarpDefinition> = {
  textArchDown: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 0',
      },
    ],
    guides: [
      {
        name: 'adval',
        fmla: 'pin 0 adj 21599999',
      },
      {
        name: 'v1',
        fmla: '+- 10800000 0 adval',
      },
      {
        name: 'v2',
        fmla: '+- 32400000 0 adval',
      },
      {
        name: 'nv1',
        fmla: '+- 0 0 v1',
      },
      {
        name: 'stAng',
        fmla: '?: nv1 v2 v1',
      },
      {
        name: 'w1',
        fmla: '+- 5400000 0 adval',
      },
      {
        name: 'w2',
        fmla: '+- 16200000 0 adval',
      },
      {
        name: 'd1',
        fmla: '+- adval 0 stAng',
      },
      {
        name: 'd2',
        fmla: '+- d1 0 21600000',
      },
      {
        name: 'v3',
        fmla: '+- 0 0 10800000',
      },
      {
        name: 'c2',
        fmla: '?: w2 d1 d2',
      },
      {
        name: 'c1',
        fmla: '?: v1 d2 c2',
      },
      {
        name: 'c0',
        fmla: '?: w1 d1 c1',
      },
      {
        name: 'swAng',
        fmla: '?: stAng c0 v3',
      },
      {
        name: 'wt1',
        fmla: 'sin wd2 adj',
      },
      {
        name: 'ht1',
        fmla: 'cos hd2 adj',
      },
      {
        name: 'dx1',
        fmla: 'cat2 wd2 ht1 wt1',
      },
      {
        name: 'dy1',
        fmla: 'sat2 hd2 ht1 wt1',
      },
      {
        name: 'x1',
        fmla: '+- hc dx1 0',
      },
      {
        name: 'y1',
        fmla: '+- vc dy1 0',
      },
      {
        name: 'wt2',
        fmla: 'sin wd2 stAng',
      },
      {
        name: 'ht2',
        fmla: 'cos hd2 stAng',
      },
      {
        name: 'dx2',
        fmla: 'cat2 wd2 ht2 wt2',
      },
      {
        name: 'dy2',
        fmla: 'sat2 hd2 ht2 wt2',
      },
      {
        name: 'x2',
        fmla: '+- hc dx2 0',
      },
      {
        name: 'y2',
        fmla: '+- vc dy2 0',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'x2',
              y: 'y2',
            },
          ],
        },
        {
          kind: 'arc',
          wR: 'wd2',
          hR: 'hd2',
          stAng: 'stAng',
          swAng: 'swAng',
        },
      ],
    ],
  },
  textArchDownPour: {
    adjustments: [
      {
        name: 'adj1',
        fmla: 'val 0',
      },
      {
        name: 'adj2',
        fmla: 'val 25000',
      },
    ],
    guides: [
      {
        name: 'adval',
        fmla: 'pin 0 adj1 21599999',
      },
      {
        name: 'v1',
        fmla: '+- 10800000 0 adval',
      },
      {
        name: 'v2',
        fmla: '+- 32400000 0 adval',
      },
      {
        name: 'nv1',
        fmla: '+- 0 0 v1',
      },
      {
        name: 'stAng',
        fmla: '?: nv1 v2 v1',
      },
      {
        name: 'w1',
        fmla: '+- 5400000 0 adval',
      },
      {
        name: 'w2',
        fmla: '+- 16200000 0 adval',
      },
      {
        name: 'd1',
        fmla: '+- adval 0 stAng',
      },
      {
        name: 'd2',
        fmla: '+- d1 0 21600000',
      },
      {
        name: 'v3',
        fmla: '+- 0 0 10800000',
      },
      {
        name: 'c2',
        fmla: '?: w2 d1 d2',
      },
      {
        name: 'c1',
        fmla: '?: v1 d2 c2',
      },
      {
        name: 'c0',
        fmla: '?: w1 d1 c1',
      },
      {
        name: 'swAng',
        fmla: '?: stAng c0 v3',
      },
      {
        name: 'wt1',
        fmla: 'sin wd2 stAng',
      },
      {
        name: 'ht1',
        fmla: 'cos hd2 stAng',
      },
      {
        name: 'dx1',
        fmla: 'cat2 wd2 ht1 wt1',
      },
      {
        name: 'dy1',
        fmla: 'sat2 hd2 ht1 wt1',
      },
      {
        name: 'x1',
        fmla: '+- hc dx1 0',
      },
      {
        name: 'y1',
        fmla: '+- vc dy1 0',
      },
      {
        name: 'adval2',
        fmla: 'pin 0 adj2 99000',
      },
      {
        name: 'ratio',
        fmla: '*/ adval2 1 100000',
      },
      {
        name: 'iwd2',
        fmla: '*/ wd2 ratio 1',
      },
      {
        name: 'ihd2',
        fmla: '*/ hd2 ratio 1',
      },
      {
        name: 'wt2',
        fmla: 'sin iwd2 adval',
      },
      {
        name: 'ht2',
        fmla: 'cos ihd2 adval',
      },
      {
        name: 'dx2',
        fmla: 'cat2 iwd2 ht2 wt2',
      },
      {
        name: 'dy2',
        fmla: 'sat2 ihd2 ht2 wt2',
      },
      {
        name: 'x2',
        fmla: '+- hc dx2 0',
      },
      {
        name: 'y2',
        fmla: '+- vc dy2 0',
      },
      {
        name: 'wt3',
        fmla: 'sin iwd2 stAng',
      },
      {
        name: 'ht3',
        fmla: 'cos ihd2 stAng',
      },
      {
        name: 'dx3',
        fmla: 'cat2 iwd2 ht3 wt3',
      },
      {
        name: 'dy3',
        fmla: 'sat2 ihd2 ht3 wt3',
      },
      {
        name: 'x3',
        fmla: '+- hc dx3 0',
      },
      {
        name: 'y3',
        fmla: '+- vc dy3 0',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'x3',
              y: 'y3',
            },
          ],
        },
        {
          kind: 'arc',
          wR: 'iwd2',
          hR: 'ihd2',
          stAng: 'stAng',
          swAng: 'swAng',
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'x1',
              y: 'y1',
            },
          ],
        },
        {
          kind: 'arc',
          wR: 'wd2',
          hR: 'hd2',
          stAng: 'stAng',
          swAng: 'swAng',
        },
      ],
    ],
  },
  textArchUp: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val cd2',
      },
    ],
    guides: [
      {
        name: 'adval',
        fmla: 'pin 0 adj 21599999',
      },
      {
        name: 'v1',
        fmla: '+- 10800000 0 adval',
      },
      {
        name: 'v2',
        fmla: '+- 32400000 0 adval',
      },
      {
        name: 'end',
        fmla: '?: v1 v1 v2',
      },
      {
        name: 'w1',
        fmla: '+- 5400000 0 adval',
      },
      {
        name: 'w2',
        fmla: '+- 16200000 0 adval',
      },
      {
        name: 'd1',
        fmla: '+- end 0 adval',
      },
      {
        name: 'd2',
        fmla: '+- 21600000 d1 0',
      },
      {
        name: 'c2',
        fmla: '?: w2 d1 d2',
      },
      {
        name: 'c1',
        fmla: '?: v1 d2 c2',
      },
      {
        name: 'swAng',
        fmla: '?: w1 d1 c1',
      },
      {
        name: 'wt1',
        fmla: 'sin wd2 adj',
      },
      {
        name: 'ht1',
        fmla: 'cos hd2 adj',
      },
      {
        name: 'dx1',
        fmla: 'cat2 wd2 ht1 wt1',
      },
      {
        name: 'dy1',
        fmla: 'sat2 hd2 ht1 wt1',
      },
      {
        name: 'x1',
        fmla: '+- hc dx1 0',
      },
      {
        name: 'y1',
        fmla: '+- vc dy1 0',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'x1',
              y: 'y1',
            },
          ],
        },
        {
          kind: 'arc',
          wR: 'wd2',
          hR: 'hd2',
          stAng: 'adval',
          swAng: 'swAng',
        },
      ],
    ],
  },
  textArchUpPour: {
    adjustments: [
      {
        name: 'adj1',
        fmla: 'val cd2',
      },
      {
        name: 'adj2',
        fmla: 'val 50000',
      },
    ],
    guides: [
      {
        name: 'adval',
        fmla: 'pin 0 adj1 21599999',
      },
      {
        name: 'v1',
        fmla: '+- 10800000 0 adval',
      },
      {
        name: 'v2',
        fmla: '+- 32400000 0 adval',
      },
      {
        name: 'end',
        fmla: '?: v1 v1 v2',
      },
      {
        name: 'w1',
        fmla: '+- 5400000 0 adval',
      },
      {
        name: 'w2',
        fmla: '+- 16200000 0 adval',
      },
      {
        name: 'd1',
        fmla: '+- end 0 adval',
      },
      {
        name: 'd2',
        fmla: '+- 21600000 d1 0',
      },
      {
        name: 'c2',
        fmla: '?: w2 d1 d2',
      },
      {
        name: 'c1',
        fmla: '?: v1 d2 c2',
      },
      {
        name: 'swAng',
        fmla: '?: w1 d1 c1',
      },
      {
        name: 'wt1',
        fmla: 'sin wd2 adval',
      },
      {
        name: 'ht1',
        fmla: 'cos hd2 adval',
      },
      {
        name: 'dx1',
        fmla: 'cat2 wd2 ht1 wt1',
      },
      {
        name: 'dy1',
        fmla: 'sat2 hd2 ht1 wt1',
      },
      {
        name: 'x1',
        fmla: '+- hc dx1 0',
      },
      {
        name: 'y1',
        fmla: '+- vc dy1 0',
      },
      {
        name: 'adval2',
        fmla: 'pin 0 adj2 99000',
      },
      {
        name: 'ratio',
        fmla: '*/ adval2 1 100000',
      },
      {
        name: 'iwd2',
        fmla: '*/ wd2 ratio 1',
      },
      {
        name: 'ihd2',
        fmla: '*/ hd2 ratio 1',
      },
      {
        name: 'wt2',
        fmla: 'sin iwd2 adval',
      },
      {
        name: 'ht2',
        fmla: 'cos ihd2 adval',
      },
      {
        name: 'dx2',
        fmla: 'cat2 iwd2 ht2 wt2',
      },
      {
        name: 'dy2',
        fmla: 'sat2 ihd2 ht2 wt2',
      },
      {
        name: 'x2',
        fmla: '+- hc dx2 0',
      },
      {
        name: 'y2',
        fmla: '+- vc dy2 0',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'x1',
              y: 'y1',
            },
          ],
        },
        {
          kind: 'arc',
          wR: 'wd2',
          hR: 'hd2',
          stAng: 'adval',
          swAng: 'swAng',
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'x2',
              y: 'y2',
            },
          ],
        },
        {
          kind: 'arc',
          wR: 'iwd2',
          hR: 'ihd2',
          stAng: 'adval',
          swAng: 'swAng',
        },
      ],
    ],
  },
  textButton: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 10800000',
      },
    ],
    guides: [
      {
        name: 'adval',
        fmla: 'pin 0 adj 21599999',
      },
      {
        name: 'bot',
        fmla: '+- 5400000 0 adval',
      },
      {
        name: 'lef',
        fmla: '+- 10800000 0 adval',
      },
      {
        name: 'top',
        fmla: '+- 16200000 0 adval',
      },
      {
        name: 'rig',
        fmla: '+- 21600000 0 adval',
      },
      {
        name: 'c3',
        fmla: '?: top adval 0',
      },
      {
        name: 'c2',
        fmla: '?: lef 10800000 c3',
      },
      {
        name: 'c1',
        fmla: '?: bot rig c2',
      },
      {
        name: 'stAng',
        fmla: '?: adval c1 0',
      },
      {
        name: 'w1',
        fmla: '+- 21600000 0 stAng',
      },
      {
        name: 'stAngB',
        fmla: '?: stAng w1 0',
      },
      {
        name: 'td1',
        fmla: '*/ bot 2 1',
      },
      {
        name: 'td2',
        fmla: '*/ top 2 1',
      },
      {
        name: 'ntd2',
        fmla: '+- 0 0 td2',
      },
      {
        name: 'w2',
        fmla: '+- 0 0 10800000',
      },
      {
        name: 'c6',
        fmla: '?: top ntd2 w2',
      },
      {
        name: 'c5',
        fmla: '?: lef 10800000 c6',
      },
      {
        name: 'c4',
        fmla: '?: bot td1 c5',
      },
      {
        name: 'v1',
        fmla: '?: adval c4 10800000',
      },
      {
        name: 'swAngT',
        fmla: '+- 0 0 v1',
      },
      {
        name: 'stT',
        fmla: '?: lef stAngB stAng',
      },
      {
        name: 'stB',
        fmla: '?: lef stAng stAngB',
      },
      {
        name: 'swT',
        fmla: '?: lef v1 swAngT',
      },
      {
        name: 'swB',
        fmla: '?: lef swAngT v1',
      },
      {
        name: 'wt1',
        fmla: 'sin wd2 stT',
      },
      {
        name: 'ht1',
        fmla: 'cos hd2 stT',
      },
      {
        name: 'dx1',
        fmla: 'cat2 wd2 ht1 wt1',
      },
      {
        name: 'dy1',
        fmla: 'sat2 hd2 ht1 wt1',
      },
      {
        name: 'x1',
        fmla: '+- hc dx1 0',
      },
      {
        name: 'y1',
        fmla: '+- vc dy1 0',
      },
      {
        name: 'wt2',
        fmla: 'sin wd2 stB',
      },
      {
        name: 'ht2',
        fmla: 'cos hd2 stB',
      },
      {
        name: 'dx2',
        fmla: 'cat2 wd2 ht2 wt2',
      },
      {
        name: 'dy2',
        fmla: 'sat2 hd2 ht2 wt2',
      },
      {
        name: 'x2',
        fmla: '+- hc dx2 0',
      },
      {
        name: 'y2',
        fmla: '+- vc dy2 0',
      },
      {
        name: 'wt3',
        fmla: 'sin wd2 adj',
      },
      {
        name: 'ht3',
        fmla: 'cos hd2 adj',
      },
      {
        name: 'dx3',
        fmla: 'cat2 wd2 ht3 wt3',
      },
      {
        name: 'dy3',
        fmla: 'sat2 hd2 ht3 wt3',
      },
      {
        name: 'x3',
        fmla: '+- hc dx3 0',
      },
      {
        name: 'y3',
        fmla: '+- vc dy3 0',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'x1',
              y: 'y1',
            },
          ],
        },
        {
          kind: 'arc',
          wR: 'wd2',
          hR: 'hd2',
          stAng: 'stT',
          swAng: 'swT',
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'vc',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 'vc',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'x2',
              y: 'y2',
            },
          ],
        },
        {
          kind: 'arc',
          wR: 'wd2',
          hR: 'hd2',
          stAng: 'stB',
          swAng: 'swB',
        },
      ],
    ],
  },
  textButtonPour: {
    adjustments: [
      {
        name: 'adj1',
        fmla: 'val cd2',
      },
      {
        name: 'adj2',
        fmla: 'val 50000',
      },
    ],
    guides: [
      {
        name: 'adval',
        fmla: 'pin 0 adj1 21599999',
      },
      {
        name: 'bot',
        fmla: '+- 5400000 0 adval',
      },
      {
        name: 'lef',
        fmla: '+- 10800000 0 adval',
      },
      {
        name: 'top',
        fmla: '+- 16200000 0 adval',
      },
      {
        name: 'rig',
        fmla: '+- 21600000 0 adval',
      },
      {
        name: 'c3',
        fmla: '?: top adval 0',
      },
      {
        name: 'c2',
        fmla: '?: lef 10800000 c3',
      },
      {
        name: 'c1',
        fmla: '?: bot rig c2',
      },
      {
        name: 'stAng',
        fmla: '?: adval c1 0',
      },
      {
        name: 'w1',
        fmla: '+- 21600000 0 stAng',
      },
      {
        name: 'stAngB',
        fmla: '?: stAng w1 0',
      },
      {
        name: 'td1',
        fmla: '*/ bot 2 1',
      },
      {
        name: 'td2',
        fmla: '*/ top 2 1',
      },
      {
        name: 'ntd2',
        fmla: '+- 0 0 td2',
      },
      {
        name: 'w2',
        fmla: '+- 0 0 10800000',
      },
      {
        name: 'c6',
        fmla: '?: top ntd2 w2',
      },
      {
        name: 'c5',
        fmla: '?: lef 10800000 c6',
      },
      {
        name: 'c4',
        fmla: '?: bot td1 c5',
      },
      {
        name: 'v1',
        fmla: '?: adval c4 10800000',
      },
      {
        name: 'swAngT',
        fmla: '+- 0 0 v1',
      },
      {
        name: 'stT',
        fmla: '?: lef stAngB stAng',
      },
      {
        name: 'stB',
        fmla: '?: lef stAng stAngB',
      },
      {
        name: 'swT',
        fmla: '?: lef v1 swAngT',
      },
      {
        name: 'swB',
        fmla: '?: lef swAngT v1',
      },
      {
        name: 'wt1',
        fmla: 'sin wd2 stT',
      },
      {
        name: 'ht1',
        fmla: 'cos hd2 stT',
      },
      {
        name: 'dx1',
        fmla: 'cat2 wd2 ht1 wt1',
      },
      {
        name: 'dy1',
        fmla: 'sat2 hd2 ht1 wt1',
      },
      {
        name: 'x1',
        fmla: '+- hc dx1 0',
      },
      {
        name: 'y1',
        fmla: '+- vc dy1 0',
      },
      {
        name: 'wt6',
        fmla: 'sin wd2 stB',
      },
      {
        name: 'ht6',
        fmla: 'cos hd2 stB',
      },
      {
        name: 'dx6',
        fmla: 'cat2 wd2 ht6 wt6',
      },
      {
        name: 'dy6',
        fmla: 'sat2 hd2 ht6 wt6',
      },
      {
        name: 'x6',
        fmla: '+- hc dx6 0',
      },
      {
        name: 'y6',
        fmla: '+- vc dy6 0',
      },
      {
        name: 'adval2',
        fmla: 'pin 40000 adj2 99000',
      },
      {
        name: 'ratio',
        fmla: '*/ adval2 1 100000',
      },
      {
        name: 'iwd2',
        fmla: '*/ wd2 ratio 1',
      },
      {
        name: 'ihd2',
        fmla: '*/ hd2 ratio 1',
      },
      {
        name: 'wt2',
        fmla: 'sin iwd2 stT',
      },
      {
        name: 'ht2',
        fmla: 'cos ihd2 stT',
      },
      {
        name: 'dx2',
        fmla: 'cat2 iwd2 ht2 wt2',
      },
      {
        name: 'dy2',
        fmla: 'sat2 ihd2 ht2 wt2',
      },
      {
        name: 'x2',
        fmla: '+- hc dx2 0',
      },
      {
        name: 'y2',
        fmla: '+- vc dy2 0',
      },
      {
        name: 'wt5',
        fmla: 'sin iwd2 stB',
      },
      {
        name: 'ht5',
        fmla: 'cos ihd2 stB',
      },
      {
        name: 'dx5',
        fmla: 'cat2 iwd2 ht5 wt5',
      },
      {
        name: 'dy5',
        fmla: 'sat2 ihd2 ht5 wt5',
      },
      {
        name: 'x5',
        fmla: '+- hc dx5 0',
      },
      {
        name: 'y5',
        fmla: '+- vc dy5 0',
      },
      {
        name: 'd1',
        fmla: '+- hd2 0 ihd2',
      },
      {
        name: 'd12',
        fmla: '*/ d1 1 2',
      },
      {
        name: 'yu',
        fmla: '+- vc 0 d12',
      },
      {
        name: 'yd',
        fmla: '+- vc d12 0',
      },
      {
        name: 'v1',
        fmla: '*/ d12 d12 1',
      },
      {
        name: 'v2',
        fmla: '*/ ihd2 ihd2 1',
      },
      {
        name: 'v3',
        fmla: '*/ v1 1 v2',
      },
      {
        name: 'v4',
        fmla: '+- 1 0 v3',
      },
      {
        name: 'v5',
        fmla: '*/ iwd2 iwd2 1',
      },
      {
        name: 'v6',
        fmla: '*/ v4 v5 1',
      },
      {
        name: 'v7',
        fmla: 'sqrt v6',
      },
      {
        name: 'xl',
        fmla: '+- hc 0 v7',
      },
      {
        name: 'xr',
        fmla: '+- hc v7 0',
      },
      {
        name: 'wtadj',
        fmla: 'sin iwd2 adj1',
      },
      {
        name: 'htadj',
        fmla: 'cos ihd2 adj1',
      },
      {
        name: 'dxadj',
        fmla: 'cat2 iwd2 htadj wtadj',
      },
      {
        name: 'dyadj',
        fmla: 'sat2 ihd2 htadj wtadj',
      },
      {
        name: 'xadj',
        fmla: '+- hc dxadj 0',
      },
      {
        name: 'yadj',
        fmla: '+- vc dyadj 0',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'x1',
              y: 'y1',
            },
          ],
        },
        {
          kind: 'arc',
          wR: 'wd2',
          hR: 'hd2',
          stAng: 'stT',
          swAng: 'swT',
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'x2',
              y: 'y2',
            },
          ],
        },
        {
          kind: 'arc',
          wR: 'iwd2',
          hR: 'ihd2',
          stAng: 'stT',
          swAng: 'swT',
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'xl',
              y: 'yu',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'xr',
              y: 'yu',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'xl',
              y: 'yd',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'xr',
              y: 'yd',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'x5',
              y: 'y5',
            },
          ],
        },
        {
          kind: 'arc',
          wR: 'iwd2',
          hR: 'ihd2',
          stAng: 'stB',
          swAng: 'swB',
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'x6',
              y: 'y6',
            },
          ],
        },
        {
          kind: 'arc',
          wR: 'wd2',
          hR: 'hd2',
          stAng: 'stB',
          swAng: 'swB',
        },
      ],
    ],
  },
  textCanDown: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 14286',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 0 adj 33333',
      },
      {
        name: 'dy',
        fmla: '*/ a h 100000',
      },
      {
        name: 'y0',
        fmla: '+- t dy 0',
      },
      {
        name: 'y1',
        fmla: '+- b 0 dy',
      },
      {
        name: 'ncd2',
        fmla: '*/ cd2 -1 1',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 't',
            },
          ],
        },
        {
          kind: 'arc',
          wR: 'wd2',
          hR: 'dy',
          stAng: 'cd2',
          swAng: 'ncd2',
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'y1',
            },
          ],
        },
        {
          kind: 'arc',
          wR: 'wd2',
          hR: 'dy',
          stAng: 'cd2',
          swAng: 'ncd2',
        },
      ],
    ],
  },
  textCanUp: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 85714',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 66667 adj 100000',
      },
      {
        name: 'dy1',
        fmla: '*/ a h 100000',
      },
      {
        name: 'dy',
        fmla: '+- h 0 dy1',
      },
      {
        name: 'y0',
        fmla: '+- t dy1 0',
      },
      {
        name: 'y1',
        fmla: '+- t dy 0',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'y1',
            },
          ],
        },
        {
          kind: 'arc',
          wR: 'wd2',
          hR: 'dy',
          stAng: 'cd2',
          swAng: 'cd2',
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'b',
            },
          ],
        },
        {
          kind: 'arc',
          wR: 'wd2',
          hR: 'dy',
          stAng: 'cd2',
          swAng: 'cd2',
        },
      ],
    ],
  },
  textCascadeDown: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 44444',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 28570 adj 100000',
      },
      {
        name: 'dy',
        fmla: '*/ a h 100000',
      },
      {
        name: 'y1',
        fmla: '+- t dy 0',
      },
      {
        name: 'dy2',
        fmla: '+- h 0 dy',
      },
      {
        name: 'dy3',
        fmla: '*/ dy2 1 4',
      },
      {
        name: 'y2',
        fmla: '+- t dy3 0',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 't',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 'y2',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'y1',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 'b',
            },
          ],
        },
      ],
    ],
  },
  textCascadeUp: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 44444',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 28570 adj 100000',
      },
      {
        name: 'dy',
        fmla: '*/ a h 100000',
      },
      {
        name: 'y1',
        fmla: '+- t dy 0',
      },
      {
        name: 'dy2',
        fmla: '+- h 0 dy',
      },
      {
        name: 'dy3',
        fmla: '*/ dy2 1 4',
      },
      {
        name: 'y2',
        fmla: '+- t dy3 0',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'y2',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 't',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'b',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 'y1',
            },
          ],
        },
      ],
    ],
  },
  textChevron: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 25000',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 0 adj 50000',
      },
      {
        name: 'y',
        fmla: '*/ a h 100000',
      },
      {
        name: 'y1',
        fmla: '+- t b y',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'y',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'hc',
              y: 't',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 'y',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'b',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'hc',
              y: 'y1',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 'b',
            },
          ],
        },
      ],
    ],
  },
  textChevronInverted: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 75000',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 50000 adj 100000',
      },
      {
        name: 'y',
        fmla: '*/ a h 100000',
      },
      {
        name: 'y1',
        fmla: '+- b 0 y',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 't',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'hc',
              y: 'y1',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 't',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'y',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'hc',
              y: 'b',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 'y',
            },
          ],
        },
      ],
    ],
  },
  textCircle: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 10800000',
      },
    ],
    guides: [
      {
        name: 'adval',
        fmla: 'pin 0 adj 21599999',
      },
      {
        name: 'd0',
        fmla: '+- adval 0 10800000',
      },
      {
        name: 'd1',
        fmla: '+- 10800000 0 adval',
      },
      {
        name: 'd2',
        fmla: '+- 21600000 0 adval',
      },
      {
        name: 'd3',
        fmla: '?: d1 d1 10799999',
      },
      {
        name: 'd4',
        fmla: '?: d0 d2 d3',
      },
      {
        name: 'swAng',
        fmla: '*/ d4 2 1',
      },
      {
        name: 'wt1',
        fmla: 'sin wd2 adj',
      },
      {
        name: 'ht1',
        fmla: 'cos hd2 adj',
      },
      {
        name: 'dx1',
        fmla: 'cat2 wd2 ht1 wt1',
      },
      {
        name: 'dy1',
        fmla: 'sat2 hd2 ht1 wt1',
      },
      {
        name: 'x1',
        fmla: '+- hc dx1 0',
      },
      {
        name: 'y1',
        fmla: '+- vc dy1 0',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'x1',
              y: 'y1',
            },
          ],
        },
        {
          kind: 'arc',
          wR: 'wd2',
          hR: 'hd2',
          stAng: 'adval',
          swAng: 'swAng',
        },
      ],
    ],
  },
  textCirclePour: {
    adjustments: [
      {
        name: 'adj1',
        fmla: 'val cd2',
      },
      {
        name: 'adj2',
        fmla: 'val 50000',
      },
    ],
    guides: [
      {
        name: 'adval',
        fmla: 'pin 0 adj1 21599999',
      },
      {
        name: 'd0',
        fmla: '+- adval 0 10800000',
      },
      {
        name: 'd1',
        fmla: '+- 10800000 0 adval',
      },
      {
        name: 'd2',
        fmla: '+- 21600000 0 adval',
      },
      {
        name: 'd3',
        fmla: '?: d1 d1 10799999',
      },
      {
        name: 'd4',
        fmla: '?: d0 d2 d3',
      },
      {
        name: 'swAng',
        fmla: '*/ d4 2 1',
      },
      {
        name: 'wt1',
        fmla: 'sin wd2 adval',
      },
      {
        name: 'ht1',
        fmla: 'cos hd2 adval',
      },
      {
        name: 'dx1',
        fmla: 'cat2 wd2 ht1 wt1',
      },
      {
        name: 'dy1',
        fmla: 'sat2 hd2 ht1 wt1',
      },
      {
        name: 'x1',
        fmla: '+- hc dx1 0',
      },
      {
        name: 'y1',
        fmla: '+- vc dy1 0',
      },
      {
        name: 'adval2',
        fmla: 'pin 0 adj2 99000',
      },
      {
        name: 'ratio',
        fmla: '*/ adval2 1 100000',
      },
      {
        name: 'iwd2',
        fmla: '*/ wd2 ratio 1',
      },
      {
        name: 'ihd2',
        fmla: '*/ hd2 ratio 1',
      },
      {
        name: 'wt2',
        fmla: 'sin iwd2 adval',
      },
      {
        name: 'ht2',
        fmla: 'cos ihd2 adval',
      },
      {
        name: 'dx2',
        fmla: 'cat2 iwd2 ht2 wt2',
      },
      {
        name: 'dy2',
        fmla: 'sat2 ihd2 ht2 wt2',
      },
      {
        name: 'x2',
        fmla: '+- hc dx2 0',
      },
      {
        name: 'y2',
        fmla: '+- vc dy2 0',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'x1',
              y: 'y1',
            },
          ],
        },
        {
          kind: 'arc',
          wR: 'wd2',
          hR: 'hd2',
          stAng: 'adval',
          swAng: 'swAng',
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'x2',
              y: 'y2',
            },
          ],
        },
        {
          kind: 'arc',
          wR: 'iwd2',
          hR: 'ihd2',
          stAng: 'adval',
          swAng: 'swAng',
        },
      ],
    ],
  },
  textCurveDown: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 45977',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 0 adj 56338',
      },
      {
        name: 'dy',
        fmla: '*/ a h 100000',
      },
      {
        name: 'gd1',
        fmla: '*/ dy 3 4',
      },
      {
        name: 'gd2',
        fmla: '*/ dy 5 4',
      },
      {
        name: 'gd3',
        fmla: '*/ dy 3 8',
      },
      {
        name: 'gd4',
        fmla: '*/ dy 1 8',
      },
      {
        name: 'gd5',
        fmla: '+- h 0 gd3',
      },
      {
        name: 'gd6',
        fmla: '+- gd4 h 0',
      },
      {
        name: 'y0',
        fmla: '+- t dy 0',
      },
      {
        name: 'y1',
        fmla: '+- t gd1 0',
      },
      {
        name: 'y2',
        fmla: '+- t gd2 0',
      },
      {
        name: 'y3',
        fmla: '+- t gd3 0',
      },
      {
        name: 'y4',
        fmla: '+- t gd4 0',
      },
      {
        name: 'y5',
        fmla: '+- t gd5 0',
      },
      {
        name: 'y6',
        fmla: '+- t gd6 0',
      },
      {
        name: 'x1',
        fmla: '+- l wd3 0',
      },
      {
        name: 'x2',
        fmla: '+- r 0 wd3',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 't',
            },
          ],
        },
        {
          kind: 'cubicBezTo',
          points: [
            {
              x: 'x1',
              y: 'y1',
            },
            {
              x: 'x2',
              y: 'y2',
            },
            {
              x: 'r',
              y: 'y0',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'y5',
            },
          ],
        },
        {
          kind: 'cubicBezTo',
          points: [
            {
              x: 'x1',
              y: 'y6',
            },
            {
              x: 'x2',
              y: 'y6',
            },
            {
              x: 'r',
              y: 'y5',
            },
          ],
        },
      ],
    ],
  },
  textCurveUp: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 45977',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 0 adj 56338',
      },
      {
        name: 'dy',
        fmla: '*/ a h 100000',
      },
      {
        name: 'gd1',
        fmla: '*/ dy 3 4',
      },
      {
        name: 'gd2',
        fmla: '*/ dy 5 4',
      },
      {
        name: 'gd3',
        fmla: '*/ dy 3 8',
      },
      {
        name: 'gd4',
        fmla: '*/ dy 1 8',
      },
      {
        name: 'gd5',
        fmla: '+- h 0 gd3',
      },
      {
        name: 'gd6',
        fmla: '+- gd4 h 0',
      },
      {
        name: 'y0',
        fmla: '+- t dy 0',
      },
      {
        name: 'y1',
        fmla: '+- t gd1 0',
      },
      {
        name: 'y2',
        fmla: '+- t gd2 0',
      },
      {
        name: 'y3',
        fmla: '+- t gd3 0',
      },
      {
        name: 'y4',
        fmla: '+- t gd4 0',
      },
      {
        name: 'y5',
        fmla: '+- t gd5 0',
      },
      {
        name: 'y6',
        fmla: '+- t gd6 0',
      },
      {
        name: 'x1',
        fmla: '+- l wd3 0',
      },
      {
        name: 'x2',
        fmla: '+- r 0 wd3',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'y0',
            },
          ],
        },
        {
          kind: 'cubicBezTo',
          points: [
            {
              x: 'x1',
              y: 'y2',
            },
            {
              x: 'x2',
              y: 'y1',
            },
            {
              x: 'r',
              y: 't',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'y5',
            },
          ],
        },
        {
          kind: 'cubicBezTo',
          points: [
            {
              x: 'x1',
              y: 'y6',
            },
            {
              x: 'x2',
              y: 'y6',
            },
            {
              x: 'r',
              y: 'y5',
            },
          ],
        },
      ],
    ],
  },
  textDeflate: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 18750',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 0 adj 37500',
      },
      {
        name: 'dy',
        fmla: '*/ a ss 100000',
      },
      {
        name: 'gd0',
        fmla: '*/ dy 4 3',
      },
      {
        name: 'gd1',
        fmla: '+- h 0 gd0',
      },
      {
        name: 'adjY',
        fmla: '+- t dy 0',
      },
      {
        name: 'y0',
        fmla: '+- t gd0 0',
      },
      {
        name: 'y1',
        fmla: '+- t gd1 0',
      },
      {
        name: 'x0',
        fmla: '+- l wd3 0',
      },
      {
        name: 'x1',
        fmla: '+- r 0 wd3',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 't',
            },
          ],
        },
        {
          kind: 'cubicBezTo',
          points: [
            {
              x: 'x0',
              y: 'y0',
            },
            {
              x: 'x1',
              y: 'y0',
            },
            {
              x: 'r',
              y: 't',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'b',
            },
          ],
        },
        {
          kind: 'cubicBezTo',
          points: [
            {
              x: 'x0',
              y: 'y1',
            },
            {
              x: 'x1',
              y: 'y1',
            },
            {
              x: 'r',
              y: 'b',
            },
          ],
        },
      ],
    ],
  },
  textDeflateBottom: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 50000',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 6250 adj 100000',
      },
      {
        name: 'dy',
        fmla: '*/ a ss 100000',
      },
      {
        name: 'dy2',
        fmla: '+- h 0 dy',
      },
      {
        name: 'y1',
        fmla: '+- t dy 0',
      },
      {
        name: 'cp',
        fmla: '+- y1 0 dy2',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 't',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 't',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'b',
            },
          ],
        },
        {
          kind: 'quadBezTo',
          points: [
            {
              x: 'hc',
              y: 'cp',
            },
            {
              x: 'r',
              y: 'b',
            },
          ],
        },
      ],
    ],
  },
  textDeflateInflate: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 35000',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 5000 adj 95000',
      },
      {
        name: 'dy',
        fmla: '*/ a h 100000',
      },
      {
        name: 'del',
        fmla: '*/ h 5 100',
      },
      {
        name: 'dh1',
        fmla: '*/ h 45 100',
      },
      {
        name: 'dh2',
        fmla: '*/ h 55 100',
      },
      {
        name: 'yh',
        fmla: '+- dy 0 del',
      },
      {
        name: 'yl',
        fmla: '+- dy del 0',
      },
      {
        name: 'y3',
        fmla: '+- yh yh dh1',
      },
      {
        name: 'y4',
        fmla: '+- yl yl dh2',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 't',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 't',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'dh1',
            },
          ],
        },
        {
          kind: 'quadBezTo',
          points: [
            {
              x: 'hc',
              y: 'y3',
            },
            {
              x: 'r',
              y: 'dh1',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'dh2',
            },
          ],
        },
        {
          kind: 'quadBezTo',
          points: [
            {
              x: 'hc',
              y: 'y4',
            },
            {
              x: 'r',
              y: 'dh2',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'b',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 'b',
            },
          ],
        },
      ],
    ],
  },
  textDeflateInflateDeflate: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 25000',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 3000 adj 47000',
      },
      {
        name: 'dy',
        fmla: '*/ a h 100000',
      },
      {
        name: 'del',
        fmla: '*/ h 3 100',
      },
      {
        name: 'ey1',
        fmla: '*/ h 30 100',
      },
      {
        name: 'ey2',
        fmla: '*/ h 36 100',
      },
      {
        name: 'ey3',
        fmla: '*/ h 63 100',
      },
      {
        name: 'ey4',
        fmla: '*/ h 70 100',
      },
      {
        name: 'by',
        fmla: '+- b 0 dy',
      },
      {
        name: 'yh1',
        fmla: '+- dy 0 del',
      },
      {
        name: 'yl1',
        fmla: '+- dy del 0',
      },
      {
        name: 'yh2',
        fmla: '+- by 0 del',
      },
      {
        name: 'yl2',
        fmla: '+- by del 0',
      },
      {
        name: 'y1',
        fmla: '+- yh1 yh1 ey1',
      },
      {
        name: 'y2',
        fmla: '+- yl1 yl1 ey2',
      },
      {
        name: 'y3',
        fmla: '+- yh2 yh2 ey3',
      },
      {
        name: 'y4',
        fmla: '+- yl2 yl2 ey4',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 't',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 't',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'ey1',
            },
          ],
        },
        {
          kind: 'quadBezTo',
          points: [
            {
              x: 'hc',
              y: 'y1',
            },
            {
              x: 'r',
              y: 'ey1',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'ey2',
            },
          ],
        },
        {
          kind: 'quadBezTo',
          points: [
            {
              x: 'hc',
              y: 'y2',
            },
            {
              x: 'r',
              y: 'ey2',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'ey3',
            },
          ],
        },
        {
          kind: 'quadBezTo',
          points: [
            {
              x: 'hc',
              y: 'y3',
            },
            {
              x: 'r',
              y: 'ey3',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'ey4',
            },
          ],
        },
        {
          kind: 'quadBezTo',
          points: [
            {
              x: 'hc',
              y: 'y4',
            },
            {
              x: 'r',
              y: 'ey4',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'b',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 'b',
            },
          ],
        },
      ],
    ],
  },
  textDeflateTop: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 50000',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 0 adj 93750',
      },
      {
        name: 'dy',
        fmla: '*/ a h 100000',
      },
      {
        name: 'y1',
        fmla: '+- t dy 0',
      },
      {
        name: 'cp',
        fmla: '+- y1 dy 0',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 't',
            },
          ],
        },
        {
          kind: 'quadBezTo',
          points: [
            {
              x: 'hc',
              y: 'cp',
            },
            {
              x: 'r',
              y: 't',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'b',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 'b',
            },
          ],
        },
      ],
    ],
  },
  textDoubleWave1: {
    adjustments: [
      {
        name: 'adj1',
        fmla: 'val 6250',
      },
      {
        name: 'adj2',
        fmla: 'val 0',
      },
    ],
    guides: [
      {
        name: 'a1',
        fmla: 'pin 0 adj1 12500',
      },
      {
        name: 'a2',
        fmla: 'pin -10000 adj2 10000',
      },
      {
        name: 'y1',
        fmla: '*/ h a1 100000',
      },
      {
        name: 'dy2',
        fmla: '*/ y1 10 3',
      },
      {
        name: 'y2',
        fmla: '+- y1 0 dy2',
      },
      {
        name: 'y3',
        fmla: '+- y1 dy2 0',
      },
      {
        name: 'y4',
        fmla: '+- b 0 y1',
      },
      {
        name: 'y5',
        fmla: '+- y4 0 dy2',
      },
      {
        name: 'y6',
        fmla: '+- y4 dy2 0',
      },
      {
        name: 'of',
        fmla: '*/ w a2 100000',
      },
      {
        name: 'of2',
        fmla: '*/ w a2 50000',
      },
      {
        name: 'x1',
        fmla: 'abs of',
      },
      {
        name: 'dx2',
        fmla: '?: of2 0 of2',
      },
      {
        name: 'x2',
        fmla: '+- l 0 dx2',
      },
      {
        name: 'dx8',
        fmla: '?: of2 of2 0',
      },
      {
        name: 'x8',
        fmla: '+- r 0 dx8',
      },
      {
        name: 'dx3',
        fmla: '+/ dx2 x8 6',
      },
      {
        name: 'x3',
        fmla: '+- x2 dx3 0',
      },
      {
        name: 'dx4',
        fmla: '+/ dx2 x8 3',
      },
      {
        name: 'x4',
        fmla: '+- x2 dx4 0',
      },
      {
        name: 'x5',
        fmla: '+/ x2 x8 2',
      },
      {
        name: 'x6',
        fmla: '+- x5 dx3 0',
      },
      {
        name: 'x7',
        fmla: '+/ x6 x8 2',
      },
      {
        name: 'x9',
        fmla: '+- l dx8 0',
      },
      {
        name: 'x15',
        fmla: '+- r dx2 0',
      },
      {
        name: 'x10',
        fmla: '+- x9 dx3 0',
      },
      {
        name: 'x11',
        fmla: '+- x9 dx4 0',
      },
      {
        name: 'x12',
        fmla: '+/ x9 x15 2',
      },
      {
        name: 'x13',
        fmla: '+- x12 dx3 0',
      },
      {
        name: 'x14',
        fmla: '+/ x13 x15 2',
      },
      {
        name: 'x16',
        fmla: '+- r 0 x1',
      },
      {
        name: 'xAdj',
        fmla: '+- hc of 0',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'x2',
              y: 'y1',
            },
          ],
        },
        {
          kind: 'cubicBezTo',
          points: [
            {
              x: 'x3',
              y: 'y2',
            },
            {
              x: 'x4',
              y: 'y3',
            },
            {
              x: 'x5',
              y: 'y1',
            },
          ],
        },
        {
          kind: 'cubicBezTo',
          points: [
            {
              x: 'x6',
              y: 'y2',
            },
            {
              x: 'x7',
              y: 'y3',
            },
            {
              x: 'x8',
              y: 'y1',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'x9',
              y: 'y4',
            },
          ],
        },
        {
          kind: 'cubicBezTo',
          points: [
            {
              x: 'x10',
              y: 'y5',
            },
            {
              x: 'x11',
              y: 'y6',
            },
            {
              x: 'x12',
              y: 'y4',
            },
          ],
        },
        {
          kind: 'cubicBezTo',
          points: [
            {
              x: 'x13',
              y: 'y5',
            },
            {
              x: 'x14',
              y: 'y6',
            },
            {
              x: 'x15',
              y: 'y4',
            },
          ],
        },
      ],
    ],
  },
  textFadeDown: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 33333',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 0 adj 49999',
      },
      {
        name: 'dx',
        fmla: '*/ a w 100000',
      },
      {
        name: 'x1',
        fmla: '+- l dx 0',
      },
      {
        name: 'x2',
        fmla: '+- r 0 dx',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 't',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 't',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'x1',
              y: 'b',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'x2',
              y: 'b',
            },
          ],
        },
      ],
    ],
  },
  textFadeLeft: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 33333',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 0 adj 49999',
      },
      {
        name: 'dy',
        fmla: '*/ a h 100000',
      },
      {
        name: 'y1',
        fmla: '+- t dy 0',
      },
      {
        name: 'y2',
        fmla: '+- b 0 dy',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'y1',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 't',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'y2',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 'b',
            },
          ],
        },
      ],
    ],
  },
  textFadeRight: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 33333',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 0 adj 49999',
      },
      {
        name: 'dy',
        fmla: '*/ a h 100000',
      },
      {
        name: 'y1',
        fmla: '+- t dy 0',
      },
      {
        name: 'y2',
        fmla: '+- b 0 dy',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 't',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 'y1',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'b',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 'y2',
            },
          ],
        },
      ],
    ],
  },
  textFadeUp: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 33333',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 0 adj 49999',
      },
      {
        name: 'dx',
        fmla: '*/ a w 100000',
      },
      {
        name: 'x1',
        fmla: '+- l dx 0',
      },
      {
        name: 'x2',
        fmla: '+- r 0 dx',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'x1',
              y: 't',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'x2',
              y: 't',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'b',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 'b',
            },
          ],
        },
      ],
    ],
  },
  textInflate: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 18750',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 0 adj 20000',
      },
      {
        name: 'dy',
        fmla: '*/ a h 100000',
      },
      {
        name: 'gd',
        fmla: '*/ dy 1 3',
      },
      {
        name: 'gd0',
        fmla: '+- 0 0 gd',
      },
      {
        name: 'gd1',
        fmla: '+- h 0 gd0',
      },
      {
        name: 'ty',
        fmla: '+- t dy 0',
      },
      {
        name: 'by',
        fmla: '+- b 0 dy',
      },
      {
        name: 'y0',
        fmla: '+- t gd0 0',
      },
      {
        name: 'y1',
        fmla: '+- t gd1 0',
      },
      {
        name: 'x0',
        fmla: '+- l wd3 0',
      },
      {
        name: 'x1',
        fmla: '+- r 0 wd3',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'ty',
            },
          ],
        },
        {
          kind: 'cubicBezTo',
          points: [
            {
              x: 'x0',
              y: 'y0',
            },
            {
              x: 'x1',
              y: 'y0',
            },
            {
              x: 'r',
              y: 'ty',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'by',
            },
          ],
        },
        {
          kind: 'cubicBezTo',
          points: [
            {
              x: 'x0',
              y: 'y1',
            },
            {
              x: 'x1',
              y: 'y1',
            },
            {
              x: 'r',
              y: 'by',
            },
          ],
        },
      ],
    ],
  },
  textInflateBottom: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 60000',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 60000 adj 100000',
      },
      {
        name: 'dy',
        fmla: '*/ a h 100000',
      },
      {
        name: 'ty',
        fmla: '+- t dy 0',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 't',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 't',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'ty',
            },
          ],
        },
        {
          kind: 'quadBezTo',
          points: [
            {
              x: 'hc',
              y: 'b',
            },
            {
              x: 'r',
              y: 'ty',
            },
          ],
        },
      ],
    ],
  },
  textInflateTop: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 40000',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 0 adj 50000',
      },
      {
        name: 'dy',
        fmla: '*/ a h 100000',
      },
      {
        name: 'ty',
        fmla: '+- t dy 0',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'ty',
            },
          ],
        },
        {
          kind: 'quadBezTo',
          points: [
            {
              x: 'hc',
              y: 't',
            },
            {
              x: 'r',
              y: 'ty',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'b',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 'b',
            },
          ],
        },
      ],
    ],
  },
  textPlain: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 50000',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 30000 adj 70000',
      },
      {
        name: 'mid',
        fmla: '*/ a w 100000',
      },
      {
        name: 'midDir',
        fmla: '+- mid 0 hc',
      },
      {
        name: 'dl',
        fmla: '+- mid 0 l',
      },
      {
        name: 'dr',
        fmla: '+- r 0 mid',
      },
      {
        name: 'dl2',
        fmla: '*/ dl 2 1',
      },
      {
        name: 'dr2',
        fmla: '*/ dr 2 1',
      },
      {
        name: 'dx',
        fmla: '?: midDir dr2 dl2',
      },
      {
        name: 'xr',
        fmla: '+- l dx 0',
      },
      {
        name: 'xl',
        fmla: '+- r 0 dx',
      },
      {
        name: 'tlx',
        fmla: '?: midDir l xl',
      },
      {
        name: 'trx',
        fmla: '?: midDir xr r',
      },
      {
        name: 'blx',
        fmla: '?: midDir xl l',
      },
      {
        name: 'brx',
        fmla: '?: midDir r xr',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'tlx',
              y: 't',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'trx',
              y: 't',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'blx',
              y: 'b',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'brx',
              y: 'b',
            },
          ],
        },
      ],
    ],
  },
  textRingInside: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 60000',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 50000 adj 99000',
      },
      {
        name: 'dy',
        fmla: '*/ a h 100000',
      },
      {
        name: 'y',
        fmla: '+- t dy 0',
      },
      {
        name: 'r',
        fmla: '*/ dy 1 2',
      },
      {
        name: 'y1',
        fmla: '+- t r 0',
      },
      {
        name: 'y2',
        fmla: '+- b 0 r',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'y1',
            },
          ],
        },
        {
          kind: 'arc',
          wR: 'wd2',
          hR: 'r',
          stAng: '10800000',
          swAng: '21599999',
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'y2',
            },
          ],
        },
        {
          kind: 'arc',
          wR: 'wd2',
          hR: 'r',
          stAng: '10800000',
          swAng: '21599999',
        },
      ],
    ],
  },
  textRingOutside: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 60000',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 50000 adj 99000',
      },
      {
        name: 'dy',
        fmla: '*/ a h 100000',
      },
      {
        name: 'y',
        fmla: '+- t dy 0',
      },
      {
        name: 'r',
        fmla: '*/ dy 1 2',
      },
      {
        name: 'y1',
        fmla: '+- t r 0',
      },
      {
        name: 'y2',
        fmla: '+- b 0 r',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'y1',
            },
          ],
        },
        {
          kind: 'arc',
          wR: 'wd2',
          hR: 'r',
          stAng: '10800000',
          swAng: '-21599999',
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'y2',
            },
          ],
        },
        {
          kind: 'arc',
          wR: 'wd2',
          hR: 'r',
          stAng: '10800000',
          swAng: '-21599999',
        },
      ],
    ],
  },
  textSlantDown: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 44445',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 28569 adj 100000',
      },
      {
        name: 'dy',
        fmla: '*/ a h 100000',
      },
      {
        name: 'y1',
        fmla: '+- t dy 0',
      },
      {
        name: 'y2',
        fmla: '+- b 0 dy',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 't',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 'y2',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'y1',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 'b',
            },
          ],
        },
      ],
    ],
  },
  textSlantUp: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 55555',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 0 adj 71431',
      },
      {
        name: 'dy',
        fmla: '*/ a h 100000',
      },
      {
        name: 'y1',
        fmla: '+- t dy 0',
      },
      {
        name: 'y2',
        fmla: '+- b 0 dy',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'y1',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 't',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'b',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 'y2',
            },
          ],
        },
      ],
    ],
  },
  textStop: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 25000',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 14286 adj 50000',
      },
      {
        name: 'dx',
        fmla: '*/ w 1 3',
      },
      {
        name: 'dy',
        fmla: '*/ a h 100000',
      },
      {
        name: 'x1',
        fmla: '+- l dx 0',
      },
      {
        name: 'x2',
        fmla: '+- r 0 dx',
      },
      {
        name: 'y1',
        fmla: '+- t dy 0',
      },
      {
        name: 'y2',
        fmla: '+- b 0 dy',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'y1',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'x1',
              y: 't',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'x2',
              y: 't',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 'y1',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'y2',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'x1',
              y: 'b',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'x2',
              y: 'b',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 'y2',
            },
          ],
        },
      ],
    ],
  },
  textTriangle: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 50000',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 0 adj 100000',
      },
      {
        name: 'y',
        fmla: '*/ a h 100000',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'y',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'hc',
              y: 't',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 'y',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'b',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 'b',
            },
          ],
        },
      ],
    ],
  },
  textTriangleInverted: {
    adjustments: [
      {
        name: 'adj',
        fmla: 'val 50000',
      },
    ],
    guides: [
      {
        name: 'a',
        fmla: 'pin 0 adj 100000',
      },
      {
        name: 'y',
        fmla: '*/ a h 100000',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 't',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 't',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'l',
              y: 'y',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'hc',
              y: 'b',
            },
          ],
        },
        {
          kind: 'lnTo',
          points: [
            {
              x: 'r',
              y: 'y',
            },
          ],
        },
      ],
    ],
  },
  textWave1: {
    adjustments: [
      {
        name: 'adj1',
        fmla: 'val 12500',
      },
      {
        name: 'adj2',
        fmla: 'val 0',
      },
    ],
    guides: [
      {
        name: 'a1',
        fmla: 'pin 0 adj1 20000',
      },
      {
        name: 'a2',
        fmla: 'pin -10000 adj2 10000',
      },
      {
        name: 'y1',
        fmla: '*/ h a1 100000',
      },
      {
        name: 'dy2',
        fmla: '*/ y1 10 3',
      },
      {
        name: 'y2',
        fmla: '+- y1 0 dy2',
      },
      {
        name: 'y3',
        fmla: '+- y1 dy2 0',
      },
      {
        name: 'y4',
        fmla: '+- b 0 y1',
      },
      {
        name: 'y5',
        fmla: '+- y4 0 dy2',
      },
      {
        name: 'y6',
        fmla: '+- y4 dy2 0',
      },
      {
        name: 'of',
        fmla: '*/ w a2 100000',
      },
      {
        name: 'of2',
        fmla: '*/ w a2 50000',
      },
      {
        name: 'x1',
        fmla: 'abs of',
      },
      {
        name: 'dx2',
        fmla: '?: of2 0 of2',
      },
      {
        name: 'x2',
        fmla: '+- l 0 dx2',
      },
      {
        name: 'dx5',
        fmla: '?: of2 of2 0',
      },
      {
        name: 'x5',
        fmla: '+- r 0 dx5',
      },
      {
        name: 'dx3',
        fmla: '+/ dx2 x5 3',
      },
      {
        name: 'x3',
        fmla: '+- x2 dx3 0',
      },
      {
        name: 'x4',
        fmla: '+/ x3 x5 2',
      },
      {
        name: 'x6',
        fmla: '+- l dx5 0',
      },
      {
        name: 'x10',
        fmla: '+- r dx2 0',
      },
      {
        name: 'x7',
        fmla: '+- x6 dx3 0',
      },
      {
        name: 'x8',
        fmla: '+/ x7 x10 2',
      },
      {
        name: 'x9',
        fmla: '+- r 0 x1',
      },
      {
        name: 'xAdj',
        fmla: '+- hc of 0',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'x2',
              y: 'y1',
            },
          ],
        },
        {
          kind: 'cubicBezTo',
          points: [
            {
              x: 'x3',
              y: 'y2',
            },
            {
              x: 'x4',
              y: 'y3',
            },
            {
              x: 'x5',
              y: 'y1',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'x6',
              y: 'y4',
            },
          ],
        },
        {
          kind: 'cubicBezTo',
          points: [
            {
              x: 'x7',
              y: 'y5',
            },
            {
              x: 'x8',
              y: 'y6',
            },
            {
              x: 'x10',
              y: 'y4',
            },
          ],
        },
      ],
    ],
  },
  textWave2: {
    adjustments: [
      {
        name: 'adj1',
        fmla: 'val 12500',
      },
      {
        name: 'adj2',
        fmla: 'val 0',
      },
    ],
    guides: [
      {
        name: 'a1',
        fmla: 'pin 0 adj1 20000',
      },
      {
        name: 'a2',
        fmla: 'pin -10000 adj2 10000',
      },
      {
        name: 'y1',
        fmla: '*/ h a1 100000',
      },
      {
        name: 'dy2',
        fmla: '*/ y1 10 3',
      },
      {
        name: 'y2',
        fmla: '+- y1 0 dy2',
      },
      {
        name: 'y3',
        fmla: '+- y1 dy2 0',
      },
      {
        name: 'y4',
        fmla: '+- b 0 y1',
      },
      {
        name: 'y5',
        fmla: '+- y4 0 dy2',
      },
      {
        name: 'y6',
        fmla: '+- y4 dy2 0',
      },
      {
        name: 'of',
        fmla: '*/ w a2 100000',
      },
      {
        name: 'of2',
        fmla: '*/ w a2 50000',
      },
      {
        name: 'x1',
        fmla: 'abs of',
      },
      {
        name: 'dx2',
        fmla: '?: of2 0 of2',
      },
      {
        name: 'x2',
        fmla: '+- l 0 dx2',
      },
      {
        name: 'dx5',
        fmla: '?: of2 of2 0',
      },
      {
        name: 'x5',
        fmla: '+- r 0 dx5',
      },
      {
        name: 'dx3',
        fmla: '+/ dx2 x5 3',
      },
      {
        name: 'x3',
        fmla: '+- x2 dx3 0',
      },
      {
        name: 'x4',
        fmla: '+/ x3 x5 2',
      },
      {
        name: 'x6',
        fmla: '+- l dx5 0',
      },
      {
        name: 'x10',
        fmla: '+- r dx2 0',
      },
      {
        name: 'x7',
        fmla: '+- x6 dx3 0',
      },
      {
        name: 'x8',
        fmla: '+/ x7 x10 2',
      },
      {
        name: 'x9',
        fmla: '+- r 0 x1',
      },
      {
        name: 'xAdj',
        fmla: '+- hc of 0',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'x2',
              y: 'y1',
            },
          ],
        },
        {
          kind: 'cubicBezTo',
          points: [
            {
              x: 'x3',
              y: 'y3',
            },
            {
              x: 'x4',
              y: 'y2',
            },
            {
              x: 'x5',
              y: 'y1',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'x6',
              y: 'y4',
            },
          ],
        },
        {
          kind: 'cubicBezTo',
          points: [
            {
              x: 'x7',
              y: 'y6',
            },
            {
              x: 'x8',
              y: 'y5',
            },
            {
              x: 'x10',
              y: 'y4',
            },
          ],
        },
      ],
    ],
  },
  textWave4: {
    adjustments: [
      {
        name: 'adj1',
        fmla: 'val 6250',
      },
      {
        name: 'adj2',
        fmla: 'val 0',
      },
    ],
    guides: [
      {
        name: 'a1',
        fmla: 'pin 0 adj1 12500',
      },
      {
        name: 'a2',
        fmla: 'pin -10000 adj2 10000',
      },
      {
        name: 'y1',
        fmla: '*/ h a1 100000',
      },
      {
        name: 'dy2',
        fmla: '*/ y1 10 3',
      },
      {
        name: 'y2',
        fmla: '+- y1 0 dy2',
      },
      {
        name: 'y3',
        fmla: '+- y1 dy2 0',
      },
      {
        name: 'y4',
        fmla: '+- b 0 y1',
      },
      {
        name: 'y5',
        fmla: '+- y4 0 dy2',
      },
      {
        name: 'y6',
        fmla: '+- y4 dy2 0',
      },
      {
        name: 'of',
        fmla: '*/ w a2 100000',
      },
      {
        name: 'of2',
        fmla: '*/ w a2 50000',
      },
      {
        name: 'x1',
        fmla: 'abs of',
      },
      {
        name: 'dx2',
        fmla: '?: of2 0 of2',
      },
      {
        name: 'x2',
        fmla: '+- l 0 dx2',
      },
      {
        name: 'dx8',
        fmla: '?: of2 of2 0',
      },
      {
        name: 'x8',
        fmla: '+- r 0 dx8',
      },
      {
        name: 'dx3',
        fmla: '+/ dx2 x8 6',
      },
      {
        name: 'x3',
        fmla: '+- x2 dx3 0',
      },
      {
        name: 'dx4',
        fmla: '+/ dx2 x8 3',
      },
      {
        name: 'x4',
        fmla: '+- x2 dx4 0',
      },
      {
        name: 'x5',
        fmla: '+/ x2 x8 2',
      },
      {
        name: 'x6',
        fmla: '+- x5 dx3 0',
      },
      {
        name: 'x7',
        fmla: '+/ x6 x8 2',
      },
      {
        name: 'x9',
        fmla: '+- l dx8 0',
      },
      {
        name: 'x15',
        fmla: '+- r dx2 0',
      },
      {
        name: 'x10',
        fmla: '+- x9 dx3 0',
      },
      {
        name: 'x11',
        fmla: '+- x9 dx4 0',
      },
      {
        name: 'x12',
        fmla: '+/ x9 x15 2',
      },
      {
        name: 'x13',
        fmla: '+- x12 dx3 0',
      },
      {
        name: 'x14',
        fmla: '+/ x13 x15 2',
      },
      {
        name: 'x16',
        fmla: '+- r 0 x1',
      },
      {
        name: 'xAdj',
        fmla: '+- hc of 0',
      },
    ],
    paths: [
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'x2',
              y: 'y1',
            },
          ],
        },
        {
          kind: 'cubicBezTo',
          points: [
            {
              x: 'x3',
              y: 'y3',
            },
            {
              x: 'x4',
              y: 'y2',
            },
            {
              x: 'x5',
              y: 'y1',
            },
          ],
        },
        {
          kind: 'cubicBezTo',
          points: [
            {
              x: 'x6',
              y: 'y3',
            },
            {
              x: 'x7',
              y: 'y2',
            },
            {
              x: 'x8',
              y: 'y1',
            },
          ],
        },
      ],
      [
        {
          kind: 'moveTo',
          points: [
            {
              x: 'x9',
              y: 'y4',
            },
          ],
        },
        {
          kind: 'cubicBezTo',
          points: [
            {
              x: 'x10',
              y: 'y6',
            },
            {
              x: 'x11',
              y: 'y5',
            },
            {
              x: 'x12',
              y: 'y4',
            },
          ],
        },
        {
          kind: 'cubicBezTo',
          points: [
            {
              x: 'x13',
              y: 'y6',
            },
            {
              x: 'x14',
              y: 'y5',
            },
            {
              x: 'x15',
              y: 'y4',
            },
          ],
        },
      ],
    ],
  },
};
