export enum AgeType {
  ADT = 'ADT',
  CHD = 'CHD',
  INF = 'INF',
}

export const NEMO_AGE_TYPE_MAP: Readonly<Record<AgeType, string>> = {
  [AgeType.ADT]: 'NMO.GBL.AGT.ADT',
  [AgeType.CHD]: 'NMO.GBL.AGT.CHD',
  [AgeType.INF]: 'NMO.GBL.AGT.INF',
};
