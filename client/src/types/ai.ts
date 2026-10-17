export interface ComparisonItem {
  device1: string;
  device2: string;
  winner: string;
}

export interface AIComparison {
  power: ComparisonItem;
  battery: ComparisonItem;
  weight: ComparisonItem;
  valueForMoney: ComparisonItem;
  conclusion: string;
  recommendation: string;
}
