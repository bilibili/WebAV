import { EventTool } from '@webav/internal-utils';
import { Log } from '../src';
import { MP4Clip } from '../src/clips/mp4-clip';
import { VisibleSprite } from '../src/sprite/visible-sprite';

const textData = [
  {
    audio_class: {
      noise: 0.23929471032745592,
      speech: 0.760705289672544,
    },
    end_time: 8010,
    language: [{ lang: 'cmn', score: 0.979 }],
    start_time: 60,
    transcript: '曹操出身官宦世家三国志称其为西汉相国曹参之后',
    words: [
      { end_time: 1700, label: '曹', start_time: 1500 },
      { end_time: 1860, label: '操', start_time: 1700 },
      { end_time: 2060, label: '出', start_time: 1860 },
      { end_time: 2260, label: '身', start_time: 2060 },
      { end_time: 2580, label: '官', start_time: 2380 },
      { end_time: 2780, label: '宦', start_time: 2580 },
      { end_time: 2980, label: '世', start_time: 2780 },
      { end_time: 3180, label: '家', start_time: 2980 },
      { end_time: 3740, label: '三', start_time: 3580 },
      { end_time: 3900, label: '国', start_time: 3740 },
      { end_time: 4060, label: '志', start_time: 3900 },
      { end_time: 4380, label: '称', start_time: 4180 },
      { end_time: 4580, label: '其', start_time: 4420 },
      { end_time: 4780, label: '为', start_time: 4580 },
      { end_time: 5140, label: '西', start_time: 4940 },
      { end_time: 5420, label: '汉', start_time: 5220 },
      { end_time: 5740, label: '相', start_time: 5540 },
      { end_time: 5980, label: '国', start_time: 5780 },
      { end_time: 6860, label: '曹', start_time: 6660 },
      { end_time: 7060, label: '参', start_time: 6860 },
      { end_time: 7260, label: '之', start_time: 7060 },
      { end_time: 7660, label: '后', start_time: 7260 },
    ],
  },
  {
    audio_class: {
      accompaniment: 0.006578947368421052,
      noise: 0.23355263157894737,
      speech: 0.7598684210526315,
    },
    end_time: 14090,
    language: [{ lang: 'cmn', score: 0.953 }],
    start_time: 8010,
    transcript: '曹操的父亲曹嵩是宦官曹腾的养子曹腾立誓',
    words: [
      { end_time: 8570, label: '曹', start_time: 8370 },
      { end_time: 8650, label: '操', start_time: 8570 },
      { end_time: 8810, label: '的', start_time: 8650 },
      { end_time: 8970, label: '父', start_time: 8810 },
      { end_time: 9170, label: '亲', start_time: 8970 },
      { end_time: 9450, label: '曹', start_time: 9250 },
      { end_time: 9730, label: '嵩', start_time: 9530 },
      { end_time: 10130, label: '是', start_time: 9850 },
      { end_time: 10570, label: '宦', start_time: 10370 },
      { end_time: 10810, label: '官', start_time: 10610 },
      { end_time: 11090, label: '曹', start_time: 10890 },
      { end_time: 11210, label: '腾', start_time: 11090 },
      { end_time: 11370, label: '的', start_time: 11210 },
      { end_time: 11530, label: '养', start_time: 11370 },
      { end_time: 11850, label: '子', start_time: 11570 },
      { end_time: 12810, label: '曹', start_time: 12610 },
      { end_time: 12970, label: '腾', start_time: 12810 },
      { end_time: 13370, label: '立', start_time: 13170 },
      { end_time: 13770, label: '誓', start_time: 13490 },
    ],
  },
  {
    audio_class: {
      accompaniment: 0.06437768240343347,
      noise: 0.1459227467811159,
      speech: 0.7896995708154506,
    },
    end_time: 23400,
    language: [{ lang: 'cmn', score: 0.985 }],
    start_time: 14090,
    transcript:
      '四大皇帝颇有名望汉桓帝时封为费亭侯曹嵩继承了曹腾的爵位在汉灵帝时官至',
    words: [
      { end_time: 14570, label: '四', start_time: 14370 },
      { end_time: 14730, label: '大', start_time: 14570 },
      { end_time: 14930, label: '皇', start_time: 14730 },
      { end_time: 15130, label: '帝', start_time: 14930 },
      { end_time: 15490, label: '颇', start_time: 15290 },
      { end_time: 15690, label: '有', start_time: 15490 },
      { end_time: 15850, label: '名', start_time: 15690 },
      { end_time: 16050, label: '望', start_time: 15850 },
      { end_time: 16810, label: '汉', start_time: 16610 },
      { end_time: 17010, label: '桓', start_time: 16810 },
      { end_time: 17170, label: '帝', start_time: 17010 },
      { end_time: 17370, label: '时', start_time: 17170 },
      { end_time: 17730, label: '封', start_time: 17530 },
      { end_time: 17930, label: '为', start_time: 17730 },
      { end_time: 18250, label: '费', start_time: 18050 },
      { end_time: 18410, label: '亭', start_time: 18250 },
      { end_time: 18610, label: '侯', start_time: 18410 },
      { end_time: 19250, label: '曹', start_time: 19050 },
      { end_time: 19410, label: '嵩', start_time: 19250 },
      { end_time: 19490, label: '继', start_time: 19410 },
      { end_time: 19650, label: '承', start_time: 19490 },
      { end_time: 19850, label: '了', start_time: 19650 },
      { end_time: 20010, label: '曹', start_time: 19850 },
      { end_time: 20130, label: '腾', start_time: 20010 },
      { end_time: 20330, label: '的', start_time: 20130 },
      { end_time: 20490, label: '爵', start_time: 20330 },
      { end_time: 20690, label: '位', start_time: 20490 },
      { end_time: 21130, label: '在', start_time: 20930 },
      { end_time: 21370, label: '汉', start_time: 21170 },
      { end_time: 21530, label: '灵', start_time: 21370 },
      { end_time: 21690, label: '帝', start_time: 21530 },
      { end_time: 21890, label: '时', start_time: 21690 },
      { end_time: 22690, label: '官', start_time: 22490 },
      { end_time: 22970, label: '至', start_time: 22690 },
    ],
  },
  {
    audio_class: {
      accompaniment: 0.01485148514851485,
      noise: 0.24752475247524752,
      speech: 0.7376237623762376,
    },
    end_time: 31480,
    language: [{ lang: 'cmn', score: 0.908 }],
    start_time: 23400,
    transcript: '三公之首的太尉年轻时期的曹操机敏机智精敏擅长随机应变',
    words: [
      { end_time: 23960, label: '三', start_time: 23760 },
      { end_time: 24120, label: '公', start_time: 23960 },
      { end_time: 24280, label: '之', start_time: 24120 },
      { end_time: 24400, label: '首', start_time: 24280 },
      { end_time: 24560, label: '的', start_time: 24400 },
      { end_time: 24760, label: '太', start_time: 24560 },
      { end_time: 24960, label: '尉', start_time: 24760 },
      { end_time: 26080, label: '年', start_time: 25880 },
      { end_time: 26240, label: '轻', start_time: 26080 },
      { end_time: 26360, label: '时', start_time: 26240 },
      { end_time: 26480, label: '期', start_time: 26360 },
      { end_time: 26640, label: '的', start_time: 26480 },
      { end_time: 26880, label: '曹', start_time: 26680 },
      { end_time: 27080, label: '操', start_time: 26880 },
      { end_time: 27520, label: '机', start_time: 27320 },
      { end_time: 27720, label: '敏', start_time: 27520 },
      { end_time: 28080, label: '机', start_time: 27840 },
      { end_time: 28920, label: '智', start_time: 28720 },
      { end_time: 29240, label: '精', start_time: 29040 },
      { end_time: 29440, label: '敏', start_time: 29240 },
      { end_time: 30000, label: '擅', start_time: 29800 },
      { end_time: 30160, label: '长', start_time: 30000 },
      { end_time: 30520, label: '随', start_time: 30320 },
      { end_time: 30760, label: '机', start_time: 30560 },
      { end_time: 30920, label: '应', start_time: 30760 },
      { end_time: 31160, label: '变', start_time: 30920 },
    ],
  },
  {
    audio_class: {
      noise: 0.24468085106382978,
      speech: 0.7553191489361702,
    },
    end_time: 37120,
    language: [{ lang: 'cmn', score: 0.887 }],
    start_time: 31480,
    transcript: '而且任性好侠放荡不羁不修品行不研究学业',
    words: [
      { end_time: 31920, label: '而', start_time: 31720 },
      { end_time: 32080, label: '且', start_time: 31920 },
      { end_time: 32560, label: '任', start_time: 32360 },
      { end_time: 32800, label: '性', start_time: 32600 },
      { end_time: 33200, label: '好', start_time: 33000 },
      { end_time: 33480, label: '侠', start_time: 33280 },
      { end_time: 34160, label: '放', start_time: 33960 },
      { end_time: 34320, label: '荡', start_time: 34160 },
      { end_time: 34480, label: '不', start_time: 34320 },
      { end_time: 34680, label: '羁', start_time: 34480 },
      { end_time: 35120, label: '不', start_time: 34920 },
      { end_time: 35320, label: '修', start_time: 35120 },
      { end_time: 35520, label: '品', start_time: 35320 },
      { end_time: 35720, label: '行', start_time: 35520 },
      { end_time: 36080, label: '不', start_time: 35880 },
      { end_time: 36200, label: '研', start_time: 36080 },
      { end_time: 36360, label: '究', start_time: 36200 },
      { end_time: 36520, label: '学', start_time: 36360 },
      { end_time: 36760, label: '业', start_time: 36520 },
    ],
  },
  {
    audio_class: {
      accompaniment: 0.007246376811594203,
      noise: 0.24879227053140096,
      speech: 0.7439613526570048,
    },
    end_time: 45410,
    language: [{ lang: 'cmn', score: 0.829 }],
    start_time: 37120,
    transcript:
      '所以当时的人不认为他有什么特别的才能只有梁国人乔玄和南阳人何玉',
    words: [
      { end_time: 37600, label: '所', start_time: 37440 },
      { end_time: 37720, label: '以', start_time: 37600 },
      { end_time: 37880, label: '当', start_time: 37720 },
      { end_time: 38040, label: '时', start_time: 37880 },
      { end_time: 38200, label: '的', start_time: 38040 },
      { end_time: 38400, label: '人', start_time: 38200 },
      { end_time: 39680, label: '不', start_time: 39520 },
      { end_time: 39840, label: '认', start_time: 39680 },
      { end_time: 40000, label: '为', start_time: 39840 },
      { end_time: 40200, label: '他', start_time: 40000 },
      { end_time: 40360, label: '有', start_time: 40200 },
      { end_time: 40400, label: '什', start_time: 40360 },
      { end_time: 40640, label: '么', start_time: 40400 },
      { end_time: 40840, label: '特', start_time: 40640 },
      { end_time: 40960, label: '别', start_time: 40840 },
      { end_time: 41120, label: '的', start_time: 40960 },
      { end_time: 41280, label: '才', start_time: 41120 },
      { end_time: 41480, label: '能', start_time: 41280 },
      { end_time: 42040, label: '只', start_time: 41880 },
      { end_time: 42200, label: '有', start_time: 42040 },
      { end_time: 42440, label: '梁', start_time: 42240 },
      { end_time: 42600, label: '国', start_time: 42440 },
      { end_time: 42800, label: '人', start_time: 42600 },
      { end_time: 43000, label: '乔', start_time: 42800 },
      { end_time: 43280, label: '玄', start_time: 43080 },
      { end_time: 43760, label: '和', start_time: 43560 },
      { end_time: 44000, label: '南', start_time: 43840 },
      { end_time: 44160, label: '阳', start_time: 44000 },
      { end_time: 44360, label: '人', start_time: 44160 },
      { end_time: 44720, label: '何', start_time: 44520 },
      { end_time: 45040, label: '玉', start_time: 44760 },
    ],
  },
  {
    audio_class: {
      accompaniment: 0.06989247311827956,
      noise: 0.1935483870967742,
      speech: 0.7365591397849462,
    },
    end_time: 49120,
    language: [{ lang: 'cmn', score: 0.95 }],
    start_time: 45410,
    transcript: '认为他不平凡乔雄对曹操说',
    words: [
      { end_time: 45850, label: '认', start_time: 45690 },
      { end_time: 46010, label: '为', start_time: 45850 },
      { end_time: 46370, label: '他', start_time: 46170 },
      { end_time: 46730, label: '不', start_time: 46490 },
      { end_time: 46890, label: '平', start_time: 46730 },
      { end_time: 47130, label: '凡', start_time: 46930 },
      { end_time: 47730, label: '乔', start_time: 47570 },
      { end_time: 47850, label: '雄', start_time: 47730 },
      { end_time: 48090, label: '对', start_time: 47850 },
      { end_time: 48250, label: '曹', start_time: 48090 },
      { end_time: 48410, label: '操', start_time: 48250 },
      { end_time: 48690, label: '说', start_time: 48410 },
    ],
  },
  {
    audio_class: {
      accompaniment: 0.01272264631043257,
      noise: 0.1628498727735369,
      speech: 0.8244274809160306,
    },
    end_time: 56989,
    language: [{ lang: 'cmn', score: 0.958 }],
    start_time: 49120,
    transcript:
      '如今天下将要发生动乱非命世之才不能解救能够安定天下的岂不是你吗',
    words: [
      { end_time: 49680, label: '如', start_time: 49480 },
      { end_time: 49840, label: '今', start_time: 49680 },
      { end_time: 50080, label: '天', start_time: 49840 },
      { end_time: 50280, label: '下', start_time: 50080 },
      { end_time: 50680, label: '将', start_time: 50480 },
      { end_time: 50840, label: '要', start_time: 50680 },
      { end_time: 50960, label: '发', start_time: 50840 },
      { end_time: 51120, label: '生', start_time: 50960 },
      { end_time: 51320, label: '动', start_time: 51120 },
      { end_time: 51520, label: '乱', start_time: 51320 },
      { end_time: 52440, label: '非', start_time: 52240 },
      { end_time: 52680, label: '命', start_time: 52480 },
      { end_time: 52840, label: '世', start_time: 52680 },
      { end_time: 53040, label: '之', start_time: 52840 },
      { end_time: 53240, label: '才', start_time: 53040 },
      { end_time: 53520, label: '不', start_time: 53360 },
      { end_time: 53680, label: '能', start_time: 53520 },
      { end_time: 53840, label: '解', start_time: 53680 },
      { end_time: 54040, label: '救', start_time: 53840 },
      { end_time: 54600, label: '能', start_time: 54440 },
      { end_time: 54800, label: '够', start_time: 54600 },
      { end_time: 54960, label: '安', start_time: 54800 },
      { end_time: 55120, label: '定', start_time: 54960 },
      { end_time: 55280, label: '天', start_time: 55120 },
      { end_time: 55400, label: '下', start_time: 55280 },
      { end_time: 55640, label: '的', start_time: 55400 },
      { end_time: 55840, label: '岂', start_time: 55680 },
      { end_time: 55960, label: '不', start_time: 55840 },
      { end_time: 56160, label: '是', start_time: 55960 },
      { end_time: 56320, label: '你', start_time: 56160 },
      { end_time: 56600, label: '吗', start_time: 56320 },
    ],
  },
  {
    audio_class: {
      noise: 0.29153605015673983,
      speech: 0.7084639498432602,
    },
    end_time: 63370,
    language: [{ lang: 'cmn', score: 0.769 }],
    start_time: 56989,
    transcript: '汝南人徐绍以智人出身他曾评价曹操为太平市的奸贼',
    words: [
      { end_time: 57469, label: '汝', start_time: 57269 },
      { end_time: 57589, label: '南', start_time: 57469 },
      { end_time: 57829, label: '人', start_time: 57589 },
      { end_time: 58029, label: '徐', start_time: 57829 },
      { end_time: 58269, label: '绍', start_time: 58069 },
      { end_time: 59029, label: '以', start_time: 58829 },
      { end_time: 59269, label: '智', start_time: 59069 },
      { end_time: 59429, label: '人', start_time: 59269 },
      { end_time: 59629, label: '出', start_time: 59429 },
      { end_time: 59789, label: '身', start_time: 59629 },
      { end_time: 60309, label: '他', start_time: 60109 },
      { end_time: 60469, label: '曾', start_time: 60309 },
      { end_time: 60589, label: '评', start_time: 60469 },
      { end_time: 60749, label: '价', start_time: 60589 },
      { end_time: 60869, label: '曹', start_time: 60749 },
      { end_time: 61029, label: '操', start_time: 60869 },
      { end_time: 61189, label: '为', start_time: 61029 },
      { end_time: 62029, label: '太', start_time: 61829 },
      { end_time: 62189, label: '平', start_time: 62029 },
      { end_time: 62349, label: '市', start_time: 62189 },
      { end_time: 62549, label: '的', start_time: 62349 },
      { end_time: 62709, label: '奸', start_time: 62549 },
      { end_time: 63029, label: '贼', start_time: 62749 },
    ],
  },
  {
    audio_class: {
      noise: 0.24855491329479767,
      speech: 0.7514450867052023,
    },
    end_time: 70280,
    language: [{ lang: 'cmn', score: 0.789 }],
    start_time: 63370,
    transcript: '乱世时的奸雄英雄孙孙盛异同杂杂语记载为',
    words: [
      { end_time: 63810, label: '乱', start_time: 63650 },
      { end_time: 63970, label: '世', start_time: 63810 },
      { end_time: 64130, label: '时', start_time: 63970 },
      { end_time: 64290, label: '的', start_time: 64130 },
      { end_time: 64450, label: '奸', start_time: 64290 },
      { end_time: 64690, label: '雄', start_time: 64450 },
      { end_time: 65370, label: '英', start_time: 65170 },
      { end_time: 65570, label: '雄', start_time: 65370 },
      { end_time: 66810, label: '孙', start_time: 66610 },
      { end_time: 67290, label: '孙', start_time: 67090 },
      { end_time: 67530, label: '盛', start_time: 67330 },
      { end_time: 67930, label: '异', start_time: 67730 },
      { end_time: 68130, label: '同', start_time: 67930 },
      { end_time: 68530, label: '杂', start_time: 68330 },
      { end_time: 69010, label: '杂', start_time: 68810 },
      { end_time: 69210, label: '语', start_time: 69010 },
      { end_time: 69530, label: '记', start_time: 69330 },
      { end_time: 69690, label: '载', start_time: 69530 },
      { end_time: 70090, label: '为', start_time: 69810 },
    ],
  },
  {
    audio_class: {
      noise: 0.17692307692307693,
      speech: 0.823076923076923,
    },
    end_time: 72880,
    language: [{ lang: 'cmn', score: 0.971 }],
    start_time: 70280,
    transcript: '治世之能臣乱世之奸雄',
    words: [
      { end_time: 70680, label: '治', start_time: 70520 },
      { end_time: 70800, label: '世', start_time: 70680 },
      { end_time: 71000, label: '之', start_time: 70800 },
      { end_time: 71200, label: '能', start_time: 71000 },
      { end_time: 71400, label: '臣', start_time: 71200 },
      { end_time: 71880, label: '乱', start_time: 71680 },
      { end_time: 72040, label: '世', start_time: 71880 },
      { end_time: 72200, label: '之', start_time: 72040 },
      { end_time: 72360, label: '奸', start_time: 72200 },
      { end_time: 72680, label: '雄', start_time: 72400 },
    ],
  },
];

class WordsScissor {
  // 若移动了 sprite，当前文字剪辑失效，弹出提示语
  expired = false;
  #attchEl: HTMLDivElement;
  #sprite: VisibleSprite;
  #article: IParagraph[];
  #articleEl: HTMLElement;
  #popoverEl: HTMLElement;
  #delEl: HTMLSpanElement;
  #resetEl: HTMLSpanElement;

  #clears: Array<() => void> = [];

  constructor(conf: {
    // UI 挂载节点
    attchEl: HTMLDivElement;
    //  初始 sprite 以及 ASR 识别的数据
    sprite: VisibleSprite;
    wordsData: IParagraph[];
  }) {
    this.#attchEl = conf.attchEl;
    this.#sprite = conf.sprite;
    this.#article = conf.wordsData;

    this.#articleEl = document.createElement('section');
    this.#attchEl.appendChild(this.#articleEl);

    const searchEl = document.createElement('words-search');
    this.#attchEl.appendChild(searchEl);

    const popoverEl = document.createElement('words-popover');
    this.#popoverEl = popoverEl;
    this.#attchEl.appendChild(popoverEl);

    this.#delEl = document.createElement('span');
    this.#delEl.textContent = '删除';

    this.#resetEl = document.createElement('span');
    this.#resetEl.textContent = '恢复';

    this.#bindEvent({ searchEl });
    this.#render();
  }

  #bindEvent(opts: { searchEl: HTMLElement }) {
    const resetPopoverPos = (range: Range, el: HTMLElement) => {
      const rect = range.getClientRects()[0];
      this.#popoverEl.innerHTML = '';
      this.#popoverEl.appendChild(el);
      this.#popoverEl.setAttribute('top', rect.top - 40 + 'px');
      this.#popoverEl.setAttribute('left', rect.left + 'px');
    };

    // 点击 选中单个文字
    this.#articleEl.addEventListener('click', (evt) => {
      if (evt.target instanceof HTMLElement && evt.target.tagName === 'DEL') {
        const range = document.createRange();
        range.setStart(evt.target.firstChild!, 0);
        range.setEnd(evt.target.firstChild!, evt.target.textContent!.length);

        const selection = window.getSelection();
        if (selection == null) return;
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        const range = click2Range(evt as PointerEvent);
        if (range == null) return;
        const sel = document.getSelection();
        if (sel == null) return;
        sel.removeAllRanges();
        sel.addRange(range);
        const evtData = sel2SprGroup(sel, this.#article);
        if (evtData.length === 0) return;
        this.#evtTool.emit('selection', evtData);
      }
    });

    let lastRange: Range | null = null;
    const onSelChange = () => {
      const sel = document.getSelection();
      if (sel == null || sel.type != 'Range') return;

      const range = sel.getRangeAt(0);
      const evtData = sel2SprGroup(sel, this.#article);
      if (evtData.length === 0) return;

      lastRange = range;
      console.log(44444, range, findRangeWords(range, this.#article));
      resetPopoverPos(
        range,
        findRangeWords(range, this.#article).every((w) => w.deleted)
          ? this.#resetEl
          : this.#delEl,
      );

      this.#evtTool.emit('selection', evtData);
    };
    document.addEventListener('selectionchange', onSelChange);
    this.#clears.push(() => {
      document.removeEventListener('selectionchange', onSelChange);
    });

    this.#delEl.addEventListener('click', async () => {
      if (lastRange == null) return;
      await deleteWords(
        findRangeWords(lastRange, this.#article),
        this.#article,
      );
      this.#render();
    });

    this.#resetEl.addEventListener('click', async () => {
      if (lastRange == null) return;
      // await resetWords(
      //   findRangeWords(lastRange, this.#article),
      //   this.#article,
      // );
      findRangeWords(lastRange, this.#article).forEach(
        (w) => (w.deleted = false),
      );
      this.#render();
    });

    const seacher = createSearcher(this.#article);

    opts.searchEl.addEventListener('search', (evt) => {
      seacher.search((evt as CustomEvent).detail as string);
    });
    opts.searchEl.addEventListener('prev-result', (evt) => {
      seacher.prev();
    });
    opts.searchEl.addEventListener('next-result', (evt) => {
      seacher.next();
    });
  }

  #render() {
    let html = '';
    for (let idx = 0; idx < this.#article.length; idx++) {
      const p = this.#article[idx];
      let text = '';
      for (const [deleted, words] of groupConsecutive(p.words)) {
        const str = words.map((w) => w.label).join('');
        text += deleted ? `<del>${str}</del>` : str;
      }
      html += `<p class="pargh" data-pargh-idx="${idx}">${text}</p>`;
    }
    this.#articleEl.innerHTML = html;

    // 将一个段落中的文字按是否删除状态分组
    // [00011000] => [[000], [11], [000]] => [[false, [000]], [true, [11]], [false, [000]]]
    function groupConsecutive(words: IWord[]) {
      return words
        .reduce((result: IWord[][], cur) => {
          // 如果 result 数组为空或当前元素与上一个元素相同
          const lastIt = result[result.length - 1];
          if (result.length === 0 || lastIt[0].deleted !== cur.deleted) {
            result.push([cur]); // 新开一个组
          } else {
            lastIt.push(cur); // 向最后一个组添加元素
          }
          return result;
        }, [])
        .map((ws) => [ws[0].deleted, ws] as [boolean, IWord[]]);
    }
  }

  //  在时间轴上选中的区间，可以包含doge sprite
  setSelection(selected: ISelection[]) {}

  #evtTool = new EventTool<{
    selection: (evtData: ISelection[]) => void;
    deleteSegment: (
      deletedSprite: VisibleSprite,
      replacement: VisibleSprite[],
    ) => void;
  }>();
  on = this.#evtTool.on;

  //  // 监听用户的选中事件
  //  on (evtType: 'selection', (evtData: ISelection[]) => void)
  // //  删除片段，需要在时间轴上移除一个源 sprite，使用 多个 sprite 替代；
  // // 注意不能销毁源 sprite
  //  on (evtType: 'deleteSegment', (deletedSprite: VisibleSprite, replacement: VisibleSprite[]) => void)
  // //  恢复事件的参数跟删除片段相反，移除多个 sprite，使用一个 sprite 替代
  //  on (evtType: 'reset', (deletedSprites: VisibleSprite[], replacement: VisibleSprite) => void)

  destroy() {
    this.#articleEl.remove();
    this.#clears.forEach((fn) => fn());
  }
}

// sprite 被选中的区间
interface ISelection {
  sprite: VisibleSprite;
  // 相对于 sprite.time.offset 的时间
  startTime: number;
  endTime: number;
}

interface IWord {
  start: number;
  end: number;
  label: string;
  spr: VisibleSprite;
  deleted: boolean;
}

// AI  接口返回的可用于口播剪辑的数据结构
interface IParagraph {
  start: number;
  end: number;
  text: string;
  words: IWord[];
}

Log.setLogLevel(Log.warn);
const resList = ['/audio/pri-caocao.m4a'];

(async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const vs = new VisibleSprite(new MP4Clip((await fetch(resList[0])).body!));
  const scissor = new WordsScissor({
    attchEl: container,
    wordsData: textData.map((p) => ({
      start: p.start_time * 1000,
      end: p.end_time * 1000,
      text: p.transcript,
      words: p.words.map((w) => ({
        start: w.start_time * 1000,
        end: w.end_time * 1000,
        label: w.label,
        spr: vs,
        deleted: false,
      })),
    })),
    sprite: vs,
  });

  scissor.on('selection', (evtData) => {
    console.log('selection evt:', evtData);
  });
})();

if (import.meta.vitest) {
  const { test, expect } = import.meta.vitest;

  const container = document.createElement('div');
  document.body.appendChild(container);

  const vs = new VisibleSprite(new MP4Clip((await fetch(resList[0])).body!));
  const scissor = new WordsScissor({
    attchEl: container,
    wordsData: textData.map((p) => ({
      start: p.start_time * 1000,
      end: p.end_time * 1000,
      text: p.transcript,
      words: p.words.map((w) => ({
        start: w.start_time * 1000,
        end: w.end_time * 1000,
        label: w.label,
        spr: vs,
        deleted: false,
      })),
    })),
    sprite: vs,
  });
  test('pargh count', () => {
    expect(container.querySelectorAll('section > p').length).toBe(
      textData.length,
    );
  });

  // const txtEl = container.querySelector('section')!;
  // test('selection event', () => {
  //   scissor.on('selection', (selections) => {
  //     console.log(4444444);
  //     expect(selections.length).toBe(1);
  //     expect(selections[0].sprite).toBe(vs);
  //   });
  //   txtEl.dispatchEvent(new PointerEvent('click'));
  //   console.log(555555);
  // });
}

// const playerContainer = document.querySelector('#player-container')!;
// document.querySelector('#play')?.addEventListener('click', () => {
//   (async () => {
//     const { loadStream } = playOutputStream(resList, playerContainer);
//     const allSprs: VisibleSprite[] = [];
//     for (const p of scissor.#article) {
//       for (const w of p.words) {
//         if (w.deleted || allSprs.includes(w.spr)) continue;
//         allSprs.push(w.spr);
//       }
//     }
//     const com = new Combinator();
//     await Promise.all(
//       allSprs.map(async (spr) => {
//         const offscreenSpr = new OffscreenSprite(spr.getClip());
//         spr.copyStateTo(offscreenSpr);
//         await com.addSprite(offscreenSpr);
//       }),
//     );
//     await loadStream(com.output(), com);
//   })().catch(Log.error);
// });

function sel2SprGroup(sel: Selection, article: IParagraph[]) {
  if (sel == null || sel.type !== 'Range' || sel.rangeCount === 0) return [];
  return [
    ...wordsGroupBySpr(findRangeWords(sel.getRangeAt(0), article)).entries(),
  ]
    .filter(([, words]) => words.length > 0)
    .map(([spr, words]) => ({
      sprite: spr,
      startTime: words[0].start,
      endTime: words.at(-1)!.end,
    }));
}

function click2Range(evt: PointerEvent) {
  const sel = document.getSelection();
  // 用户多选文本时，使用浏览器默认选区
  if (sel != null && sel.rangeCount > 0) {
    const defRange = sel.getRangeAt(0);
    if (
      defRange.startContainer !== defRange.endContainer ||
      defRange.startOffset + 1 < defRange.endOffset
    ) {
      return null;
    }
  }
  // 单次点击选中单个文字
  const ckRange = document.caretRangeFromPoint(evt.clientX, evt.clientY);
  if (ckRange == null) return null;
  // 如果选区长度为 0，则将 endOffset 设置为下一个文字
  const endOffset =
    ckRange.endContainer === ckRange.startContainer &&
    ckRange.endOffset === ckRange.startOffset
      ? ckRange.endOffset + 1
      : ckRange.endOffset;

  // 如果选区超出文字范围，则返回 null
  if (endOffset > ckRange.startContainer.textContent!.length) return null;

  const rs = new Range();
  rs.setStart(ckRange.startContainer, ckRange.startOffset);
  rs.setEnd(ckRange.endContainer, endOffset);
  return rs;
}

// 根据选区获取选中的文字
function findRangeWords(range: Range, article: IParagraph[]) {
  // if (sel == null || sel.type !== 'Range') return [];
  // const range = sel.getRangeAt(0);
  const { startContainer, endContainer } = range;

  const startPrghIdx = findParghIdx(startContainer);
  const endPrghIdx = findParghIdx(endContainer);
  if (startPrghIdx == null || endPrghIdx == null) return [];

  const { startOffset, endOffset } = findOffsetRelativePrgh(range);

  let selectedWords: IWord[] = [];
  if (startPrghIdx === endPrghIdx) {
    const prgh = article[startPrghIdx];
    selectedWords = prgh.words.slice(startOffset, endOffset);
  } else {
    const startPrgh = article[startPrghIdx];
    const endPrgh = article[endPrghIdx];
    selectedWords = [
      ...startPrgh.words.slice(startOffset),
      ...article.slice(startPrghIdx + 1, endPrghIdx).flatMap((p) => p.words),
      ...endPrgh.words.slice(0, endOffset),
    ];
  }
  return selectedWords;
}

function findParghIdx(node?: Node | HTMLElement | null) {
  if (node == null) return null;
  if ('classList' in node && node.classList.contains('pargh'))
    return Number(node.dataset.parghIdx);
  return findParghIdx(node.parentElement);
}

// 选取相对于段落的偏移量
function findOffsetRelativePrgh(range: Range) {
  const startPrgh = findPargh(range.startContainer);
  const endPrgh = findPargh(range.endContainer);
  if (startPrgh == null || endPrgh == null) throw Error('prgh not found');

  return {
    startOffset:
      calculateOffset(range.startContainer, startPrgh) + range.startOffset,
    endOffset: calculateOffset(range.endContainer, endPrgh) + range.endOffset,
  };

  function findPargh(node?: Node | HTMLElement | null) {
    if (node == null) return null;
    if ('classList' in node && node.classList.contains('pargh')) return node;
    return findPargh(node.parentElement);
  }

  function calculateOffset(startNode: Node, container: Node) {
    let current = startNode;
    let totalOffset = 0;

    while (current && current !== container) {
      // 累计每个兄弟节点的文本长度
      let sibling = current.previousSibling;
      while (sibling) {
        if (sibling.textContent == null) throw Error('text content not found');
        totalOffset += sibling.textContent.length;
        sibling = sibling.previousSibling;
      }
      current = current.parentNode as Node;
    }
    return totalOffset;
  }
}

function wordsGroupBySpr(words: IWord[]) {
  const sprMap = new Map<VisibleSprite, IWord[]>();
  for (const w of words) {
    if (sprMap.has(w.spr)) sprMap.get(w.spr)!.push(w);
    else sprMap.set(w.spr, [w]);
  }
  return sprMap;
}

class WordsSearch extends HTMLElement {
  // #inputEl: HTMLInputElement | undefined;

  constructor() {
    super();
  }

  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });
    const container = document.createElement('div');

    const searchEl = document.createElement('span');
    searchEl.textContent = '🔍';
    container.appendChild(searchEl);

    const inputEl = document.createElement('input');
    container.appendChild(inputEl);
    inputEl.placeholder = '搜索关键词';
    inputEl.addEventListener('keypress', (evt) => {
      if (evt.key !== 'Enter' || inputEl.value.trim() === '') return;
      this.dispatchEvent(new CustomEvent('search', { detail: inputEl.value }));
    });

    const prevEl = document.createElement('span');
    prevEl.textContent = '^';
    container.appendChild(prevEl);
    prevEl.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('prev-result'));
    });

    const nextEl = document.createElement('span');
    nextEl.textContent = 'v';
    container.appendChild(nextEl);
    nextEl.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('next-result'));
    });

    const closeEl = document.createElement('span');
    closeEl.textContent = 'x';
    container.appendChild(closeEl);

    shadow.appendChild(container);
  }
}

customElements.define('words-search', WordsSearch);

class Popover extends HTMLElement {
  #container: HTMLDivElement;
  static get observedAttributes() {
    return ['left', 'top'];
  }

  constructor() {
    super();

    const container = document.createElement('div');
    container.innerHTML = `
      <div><slot></slot></div>
      <div class="tri"></div>
    `;
    container.style.position = 'fixed';
    container.style.zIndex = '999';
    container.style.backgroundColor = 'white';
    container.style.border = '1px solid black';
    container.style.padding = '5px';
    container.style.boxShadow = '0 0 5px #000';

    this.#container = container;
  }

  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.appendChild(this.#container);
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    console.log('attributeChangedCallback', name, oldValue, newValue);
    switch (name) {
      case 'left':
        this.#container.style.left = newValue;
        break;
      case 'top':
        this.#container.style.top = newValue;
        break;
    }
  }
}
customElements.define('words-popover', Popover);

function createSearcher(article: IParagraph[]) {
  let ranges: Range[] = [];
  let rangeCursor = 0;
  return {
    search(kw: string) {
      this.exit();
      if (kw.length === 0) return;
      const matchRecord: Record<
        number,
        Array<{
          prghIdx: number;
          offset: number;
        }>
      > = {};
      for (let i = 0; i < article.length; i++) {
        const p = article[i];
        let match;
        const regex = new RegExp(kw, 'g');
        while ((match = regex.exec(p.text)) !== null) {
          matchRecord[i] = matchRecord[i] ?? [];
          matchRecord[i].push({
            prghIdx: i,
            offset: match.index,
          });
        }
      }

      for (const [prghIdx, matches] of Object.entries(matchRecord)) {
        const pEl = document.querySelector(`[data-pargh-idx="${prghIdx}"]`);
        if (pEl == null) throw Error('pargh element not found');
        for (const { offset } of matches) {
          const range = new Range();
          const { node: startNode, offset: startOffset } = findTextOffset(
            pEl,
            offset,
          );
          const { node: endNode, offset: endOffset } = findTextOffset(
            pEl,
            offset + kw.length,
          );
          range.setStart(startNode, startOffset);
          range.setEnd(endNode, endOffset);
          ranges.push(range);
        }
      }
      if (ranges.length > 0) {
        const highlight = new Highlight(...ranges);
        CSS.highlights.set('search', highlight);
        CSS.highlights.set('search-cursor', new Highlight(ranges[0]));
      }
    },
    prev() {
      if (ranges.length === 0) return;
      rangeCursor = (rangeCursor - 1 + ranges.length) % ranges.length;
      const range = ranges[rangeCursor];
      CSS.highlights.set('search-cursor', new Highlight(range));
    },
    next() {
      if (ranges.length === 0) return;
      rangeCursor = (rangeCursor + 1) % ranges.length;
      const range = ranges[rangeCursor];
      CSS.highlights.set('search-cursor', new Highlight(range));
    },
    exit() {
      ranges = [];
      rangeCursor = 0;
      CSS.highlights.delete('search');
      CSS.highlights.delete('search-cursor');
    },
  };
}

declare namespace CSS {
  var highlights: {
    set: (name: string, highlight: Highlight) => void;
    delete: (name: string) => void;
  };
}

function findTextOffset(
  container: Element,
  offset: number,
): { node: Text; offset: number } {
  let currentOffset = 0;

  // 遍历所有子节点
  function traverse(node: Node): { node: Text; offset: number } | null {
    if (node.nodeType === Node.TEXT_NODE) {
      const textLength = node.textContent?.length ?? 0;

      if (currentOffset + textLength >= offset) {
        // 偏移量落在当前文本节点中，返回结果
        return {
          node: node as Text,
          offset: offset - currentOffset,
        };
      }

      currentOffset += textLength;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // 遍历元素节点的子节点
      for (const child of Array.from(node.childNodes)) {
        const result = traverse(child);
        if (result) return result;
      }
    }

    return null;
  }

  const result = traverse(container);
  if (!result) {
    throw new Error('Offset exceeds the total length of the container.');
  }

  return result;
}

async function deleteWords(words: IWord[], article: IParagraph[]) {
  if (words.length === 0) return;
  // todo: undo
  // storeSnap();
  const delWordsGroup = wordsGroupBySpr(words);
  [...delWordsGroup.values()].flat().forEach((w) => (w.deleted = true));

  const allWordsGroup = wordsGroupBySpr(article.flatMap((p) => p.words));

  // 根据需要删除片段的 spr 找到它对应的所有文字，然后根据文字的时间位置切割 sprite
  // for (const [spr] of delWordsGroup) {
  //   const groupWords = allWordsGroup.get(spr);
  //   if (groupWords == null) throw new Error('words not found');

  //   const { preWords, postWords } = cutWords(groupWords);
  //   const clip = spr.getClip() as MP4Clip;
  //   if (preWords.length > 0) {
  //     const [preClip] = await clip.split(preWords[preWords.length - 1].end);
  //     const newSpr = new VisibleSprite(preClip);
  //     spr.copyStateTo(newSpr);
  //     newSpr.time.duration = preClip.meta.duration;
  //     preWords.forEach((w) => (w.spr = newSpr));
  //   }
  //   if (postWords.length > 0) {
  //     const ts = postWords[0].start;
  //     const [_, postClip] = await clip.split(ts);
  //     const newSpr = new VisibleSprite(postClip);
  //     spr.copyStateTo(newSpr);
  //     newSpr.time.duration = postClip.meta.duration;

  //     // 找到上一个 sprite，设置 offset， 消除间隙
  //     const allWords = article.flatMap((p) => p.words);
  //     const preSpr = allWords
  //       .slice(0, allWords.indexOf(postWords[0]))
  //       .findLast((w) => !w.deleted)?.spr;
  //     newSpr.time.offset =
  //       preSpr == null ? 0 : preSpr.time.offset + preSpr.time.duration;

  //     postWords.forEach((w) => {
  //       w.spr = newSpr;
  //       w.start -= ts;
  //       w.end -= ts;
  //     });
  //   }
  // }
}

function cutWords(words: IWord[]) {
  const startIdx = words.findIndex((w) => w.deleted);
  const endIdx = words.findLastIndex((w) => w.deleted);
  if (startIdx === -1 || endIdx === -1) return { preWords: [], postWords: [] };
  const preWords = words.slice(0, startIdx);
  const postWords = words.slice(endIdx + 1);
  return { preWords, postWords };
}
