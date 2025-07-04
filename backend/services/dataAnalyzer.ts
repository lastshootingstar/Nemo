import * as ss from 'simple-statistics';
import { compute } from '@fullstax/kaplan-meier-estimator';
import { Dataset, DataRow } from '../types/data';
import { DescriptiveStats, CorrelationResult, StatisticalResult, VisualizationConfig, TTestResult } from '../types/analysis'; // Added TTestResult

export class DataAnalyzer {
  private static instance: DataAnalyzer;

  public static getInstance(): DataAnalyzer {
    if (!DataAnalyzer.instance) {
      DataAnalyzer.instance = new DataAnalyzer();
    }
    return DataAnalyzer.instance;
  }

  calculateDescriptiveStats(dataset: Dataset, columnName: string): DescriptiveStats {
    const values = dataset.rows
      .map(row => row[columnName])
      .filter(val => val !== null && typeof val === 'number') as number[];

    if (values.length === 0) {
      throw new Error(`No numeric values found in column: ${columnName}`);
    }

    const result: DescriptiveStats = {
      column: columnName,
      count: values.length,
      mean: ss.mean(values),
      median: ss.median(values),
      standardDeviation: ss.standardDeviation(values),
      variance: ss.variance(values),
      min: ss.min(values),
      max: ss.max(values)
    };

    // Calculate quartiles
    const sortedValues = values.slice().sort((a, b) => a - b);
    result.quartiles = {
      q1: ss.quantile(sortedValues, 0.25),
      q2: ss.quantile(sortedValues, 0.5),
      q3: ss.quantile(sortedValues, 0.75)
    };

    // Calculate mode for categorical data
    const allValues = dataset.rows.map(row => row[columnName]).filter(val => val !== null);
    const frequency: { [key: string]: number } = {};
    allValues.forEach(val => {
      const key = val?.toString() || '';
      frequency[key] = (frequency[key] || 0) + 1;
    });

    const maxFreq = Math.max(...Object.values(frequency));
    const modes = Object.keys(frequency).filter(key => frequency[key] === maxFreq);
    result.mode = modes.length === 1 ? (isNaN(Number(modes[0])) ? modes[0] : Number(modes[0])) : modes[0];

    return result;
  }

  calculateCorrelation(dataset: Dataset, column1: string, column2: string): CorrelationResult {
    const values1 = dataset.rows
      .map(row => row[column1])
      .filter(val => val !== null && typeof val === 'number') as number[];

    const values2 = dataset.rows
      .map(row => row[column2])
      .filter(val => val !== null && typeof val === 'number') as number[];

    if (values1.length === 0 || values2.length === 0) {
      throw new Error('No numeric values found for correlation calculation');
    }

    // Ensure both arrays have the same length by filtering out null pairs
    const pairs: [number, number][] = [];
    dataset.rows.forEach(row => {
      const val1 = row[column1];
      const val2 = row[column2];
      if (val1 !== null && val2 !== null && typeof val1 === 'number' && typeof val2 === 'number') {
        pairs.push([val1, val2]);
      }
    });

    if (pairs.length < 2) {
      throw new Error('Insufficient data points for correlation calculation');
    }

    const coefficient = ss.sampleCorrelation(pairs.map(p => p[0]), pairs.map(p => p[1]));

    return {
      variable1: column1,
      variable2: column2,
      coefficient,
      significance: Math.abs(coefficient) > 0.5 ? 'significant' : 'not_significant'
    };
  }

  calculateCorrelationMatrix(dataset: Dataset): { [column1: string]: { [column2: string]: number | null } } {
    const numericColumns = dataset.columns.filter(col => {
      const values = dataset.rows.map(row => row[col]).filter(val => val !== null && typeof val === 'number');
      return values.length > 0;
    });

    const correlationMatrix: { [column1: string]: { [column2: string]: number | null } } = {};

    for (let i = 0; i < numericColumns.length; i++) {
      const column1 = numericColumns[i];
      correlationMatrix[column1] = {};
      for (let j = i; j < numericColumns.length; j++) {
        const column2 = numericColumns[j];
        try {
          const correlation = this.calculateCorrelation(dataset, column1, column2).coefficient;
          correlationMatrix[column1][column2] = correlation;
          correlationMatrix[column2][column1] = correlation; // The matrix is symmetric
        } catch (error) {
          console.warn(`Correlation calculation failed for ${column1} and ${column2}: ${error}`);
          correlationMatrix[column1][column2] = null;
          correlationMatrix[column2][column1] = null;
        }
      }
    }

    return correlationMatrix;
  }

  generateFrequencyDistribution(dataset: Dataset, columnName: string): StatisticalResult {
    const values = dataset.rows.map(row => row[columnName]).filter(val => val !== null);
    const frequency: { [key: string]: number } = {};

    values.forEach(val => {
      const key = val?.toString() || '';
      frequency[key] = (frequency[key] || 0) + 1;
    });

    const data = Object.entries(frequency)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

    const visualization: VisualizationConfig = {
      type: 'bar',
      xAxis: 'value',
      yAxis: 'count',
      title: `Frequency Distribution of ${columnName}`,
      data
    };

    return {
      type: 'descriptive',
      title: `Frequency Distribution: ${columnName}`,
      description: `Distribution of values in the ${columnName} column`,
      data: frequency,
      visualization
    };
  }

  generateHistogram(dataset: Dataset, columnName: string, bins: number = 10): StatisticalResult {
    const values = dataset.rows
      .map(row => row[columnName])
      .filter(val => val !== null && typeof val === 'number') as number[];

    if (values.length === 0) {
      throw new Error(`No numeric values found in column: ${columnName}`);
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const binWidth = (max - min) / bins;

    const histogram: { range: string; count: number }[] = [];

    for (let i = 0; i < bins; i++) {
      const binStart = min + i * binWidth;
      const binEnd = min + (i + 1) * binWidth;
      const count = values.filter(val => val >= binStart && (i === bins - 1 ? val <= binEnd : val < binEnd)).length;

      histogram.push({
        range: `${binStart.toFixed(2)}-${binEnd.toFixed(2)}`,
        count
      });
    }

    const visualization: VisualizationConfig = {
      type: 'histogram',
      xAxis: 'range',
      yAxis: 'count',
      title: `Histogram of ${columnName}`,
      data: histogram
    };

    return {
      type: 'descriptive',
      title: `Histogram: ${columnName}`,
      description: `Distribution histogram for ${columnName} with ${bins} bins`,
      data: histogram,
      visualization
    };
  }

  generateScatterPlot(dataset: Dataset, xColumn: string, yColumn: string): StatisticalResult {
    const data: { x: number; y: number }[] = [];

    dataset.rows.forEach(row => {
      const xVal = row[xColumn];
      const yVal = row[yColumn];
      if (xVal !== null && yVal !== null && typeof xVal === 'number' && typeof yVal === 'number') {
        data.push({ x: xVal, y: yVal });
      }
    });

    if (data.length === 0) {
      throw new Error('No valid numeric pairs found for scatter plot');
    }

    const visualization: VisualizationConfig = {
      type: 'scatter',
      xAxis: xColumn,
      yAxis: yColumn,
      title: `${yColumn} vs ${xColumn}`,
      data
    };

    return {
      type: 'correlation',
      title: `Scatter Plot: ${yColumn} vs ${xColumn}`,
      description: `Relationship between ${xColumn} and ${yColumn}`,
      data,
      visualization
    };
  }

  getSummaryStatistics(dataset: Dataset): StatisticalResult {
    const numericColumns = dataset.columns.filter(col => {
      const values = dataset.rows.map(row => row[col]).filter(val => val !== null);
      return values.length > 0 && typeof values[0] === 'number';
    });

    const summary = numericColumns.map(col => this.calculateDescriptiveStats(dataset, col));

    return {
      type: 'descriptive',
      title: 'Dataset Summary Statistics',
      description: 'Descriptive statistics for all numeric columns',
      data: summary
    };
  }

  calculateKaplanMeier(timeToEvent: number[], eventOccurred: boolean[]) {
    return compute(timeToEvent, eventOccurred);
  }

  async performIndependentTTest(
    dataset: Dataset,
    groupColumnName: string,
    valueColumnName: string
  ): Promise<TTestResult> {
    if (!dataset.columns.includes(groupColumnName)) {
      throw new Error(`Group column "${groupColumnName}" not found in dataset.`);
    }
    if (!dataset.columns.includes(valueColumnName)) {
      throw new Error(`Value column "${valueColumnName}" not found in dataset.`);
    }

    const valueData = dataset.rows.map(row => row[valueColumnName]).filter(val => typeof val === 'number' && val !== null && isFinite(val)) as number[];
    if (valueData.length === 0) {
        throw new Error(`No valid numeric data found in value column "${valueColumnName}".`);
    }

    const groups: { [key: string]: number[] } = {};
    dataset.rows.forEach(row => {
      const groupValue = row[groupColumnName];
      const numericValue = row[valueColumnName];

      if (groupValue !== null && groupValue !== undefined && typeof numericValue === 'number' && isFinite(numericValue)) {
        const groupKey = String(groupValue);
        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }
        groups[groupKey].push(numericValue);
      }
    });

    const groupKeys = Object.keys(groups);
    if (groupKeys.length !== 2) {
      throw new Error(
        `Group column "${groupColumnName}" must contain exactly two unique groups for an independent t-test. Found ${groupKeys.length}: ${groupKeys.join(', ')}.`
      );
    }

    const group1Name = groupKeys[0];
    const group2Name = groupKeys[1];
    const sample1 = groups[group1Name];
    const sample2 = groups[group2Name];

    if (sample1.length < 2 || sample2.length < 2) {
      throw new Error('Each group must have at least 2 data points for a t-test.');
    }

    const group1Mean = ss.mean(sample1);
    const group2Mean = ss.mean(sample2);
    const group1Variance = ss.variance(sample1);
    const group2Variance = ss.variance(sample2);
    const group1Size = sample1.length;
    const group2Size = sample2.length;

    // simple-statistics tTestTwoSample returns the t-statistic.
    // It can take an options object, but for now, we'll use defaults.
    // The function can handle unequal sample sizes.
    // It assumes homogeneity of variances if not specified otherwise or if alpha isn't used to trigger Welch's.
    // For MVP, we'll calculate pooled variance for degrees of freedom.
    const tStatistic = ss.tTestTwoSample(sample1, sample2);

    if (tStatistic === null || !isFinite(tStatistic)) {
        throw new Error('Could not compute t-statistic. Check data variability within groups.');
    }

    // Degrees of freedom for two independent samples (assuming equal variances for simplicity, though ss.tTestTwoSample might do Welch's if variances are very different)
    // df = n1 + n2 - 2
    const degreesOfFreedom = group1Size + group2Size - 2;

    // Note: Calculating exact p-value from t-statistic and df requires a
    // cumulative distribution function (CDF) for the t-distribution.
    // simple-statistics does not seem to provide this directly.
    // For MVP, we will omit p-value or state it needs to be looked up.

    return {
      testType: 'Independent Samples T-Test',
      group1Name,
      group2Name,
      group1Mean,
      group2Mean,
      group1Variance,
      group2Variance,
      group1Size,
      group2Size,
      tStatistic,
      degreesOfFreedom,
      // pValue: undefined, // Placeholder
      interpretation: `The t-statistic for comparing ${valueColumnName} between ${group1Name} and ${group2Name} is ${tStatistic.toFixed(3)} with ${degreesOfFreedom} degrees of freedom.`
    };
  }
}
