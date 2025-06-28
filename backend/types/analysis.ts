export interface StatisticalResult {
  type: 'descriptive' | 'correlation' | 'regression' | 'test';
  title: string;
  description: string;
  data: any;
  visualization?: VisualizationConfig;
}

export interface DescriptiveStats {
  column: string;
  count: number;
  mean?: number;
  median?: number;
  mode?: string | number;
  standardDeviation?: number;
  variance?: number;
  min?: number;
  max?: number;
  quartiles?: {
    q1: number;
    q2: number;
    q3: number;
  };
}

export interface CorrelationResult {
  variable1: string;
  variable2: string;
  coefficient: number;
  pValue?: number;
  significance: 'significant' | 'not_significant';
}

export interface RegressionResult {
  dependent: string;
  independent: string[];
  coefficients: { [variable: string]: number };
  rSquared: number;
  adjustedRSquared: number;
  pValues: { [variable: string]: number };
  residuals: number[];
}

export interface VisualizationConfig {
  type: 'bar' | 'line' | 'scatter' | 'histogram' | 'box' | 'pie';
  xAxis?: string;
  yAxis?: string;
  groupBy?: string;
  title: string;
  data: any[];
}

export interface TTestResult {
  testType: 'Independent Samples T-Test';
  group1Name: string;
  group2Name: string;
  group1Mean: number;
  group2Mean: number;
  group1Variance: number;
  group2Variance: number;
  group1Size: number;
  group2Size: number;
  tStatistic: number;
  degreesOfFreedom: number;
  pValue?: number; // p-value might be harder to calculate directly with simple-stats for MVP
  interpretation?: string; // Optional textual interpretation
}
