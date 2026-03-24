/** Stable mock imagery for Virtual Production Scout pipeline (no API keys). */
export const MOCK = {
  location1: 'https://picsum.photos/seed/vps-loc1/400/300',
  location2: 'https://picsum.photos/seed/vps-loc2/400/300',
  location3: 'https://picsum.photos/seed/vps-loc3/400/300',
  placement: 'https://picsum.photos/seed/vps-place/320/240',
  propTable: 'https://picsum.photos/seed/vps-prop1/256/192',
  propSpeakers: 'https://picsum.photos/seed/vps-prop2/256/192',
  propSofa: 'https://picsum.photos/seed/vps-prop3/256/192',
  propPiano: 'https://picsum.photos/seed/vps-prop4/256/192',
  propLamp: 'https://picsum.photos/seed/vps-prop5/256/192',
  propChair: 'https://picsum.photos/seed/vps-prop6/256/192',
  setDressing: 'https://picsum.photos/seed/vps-dress/800/450',
  camera1: 'https://picsum.photos/seed/vps-cam1/400/225',
  camera2: 'https://picsum.photos/seed/vps-cam2/400/225',
  camera3: 'https://picsum.photos/seed/vps-cam3/400/225',
  camera4: 'https://picsum.photos/seed/vps-cam4/400/225',
  listThumb: (i: number) => `https://picsum.photos/seed/vps-list${i}/120/80`,
  lightWarm: 'https://picsum.photos/seed/vps-lit-warm/400/225',
  lightCool: 'https://picsum.photos/seed/vps-lit-cool/400/225',
  lightDrama: 'https://picsum.photos/seed/vps-lit-drama/400/225',
  lightNatural: 'https://picsum.photos/seed/vps-lit-nat/400/225',
  moodNight: 'https://picsum.photos/seed/vps-mood1/400/225',
  moodGolden: 'https://picsum.photos/seed/vps-mood2/400/225',
  moodCool: 'https://picsum.photos/seed/vps-mood3/400/225',
  moodNeon: 'https://picsum.photos/seed/vps-mood4/400/225',
  selectedShot: 'https://picsum.photos/seed/vps-final/800/444',
  decorRef: 'https://picsum.photos/seed/vps-decor/400/300',
} as const;

/** Default prop slots when `propsInputNode.data.props` is missing or empty (matches `PropsInputNode` UI fallback). */
export type ScoutPropSlot = { id: string; label: string; src: string };

export const DEFAULT_SCOUT_PROP_SLOTS: ScoutPropSlot[] = [
  { id: 'p1', label: 'Coffee table', src: MOCK.propTable },
  { id: 'p2', label: 'Vintage speakers', src: MOCK.propSpeakers },
  { id: 'p3', label: 'L-sofa', src: MOCK.propSofa },
];

export const SCENE_DESCRIPTION =
  'Open loft living room, warm oak floors, tall windows with soft daylight, minimal Scandinavian furniture, LED strip accent behind media wall, floating shelves with plants and books.';
