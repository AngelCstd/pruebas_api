export enum RoomType {
  SGL = 'SGL',
  DBL = 'DBL',
  TPL = 'TPL',
  QUD = 'QUD',
}

export const NEMO_ROOM_TYPE_MAP: Readonly<Record<RoomType, string>> = {
  [RoomType.SGL]: 'NMO.HTL.RMT.SGL',
  [RoomType.DBL]: 'NMO.HTL.RMT.DBL',
  [RoomType.TPL]: 'NMO.HTL.RMT.TPL',
  [RoomType.QUD]: 'NMO.HTL.RMT.QUD',
};
