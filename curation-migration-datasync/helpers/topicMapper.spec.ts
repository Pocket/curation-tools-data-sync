import { getTopicForReaditLaTmpDatabase } from './topicMapper';
import { expect } from 'chai';

describe('topics mapper test', () => {
  it('should convert a valid topic from curatedCorpusApi to readitLaTmp topics', () => {
    const curatedCorpusTopic = 'HEALTH_FITNESS';
    expect(getTopicForReaditLaTmpDatabase(curatedCorpusTopic)).equals(
      'Health & Fitness'
    );
  });

  it('should return null for unknown topic', () => {
    const curatedCorpusTopic = 'unknown topic';
    expect(getTopicForReaditLaTmpDatabase(curatedCorpusTopic)).is.null;
  });

  it('should return null for null topic', () => {
    expect(getTopicForReaditLaTmpDatabase(null)).is.null;
  });
});
