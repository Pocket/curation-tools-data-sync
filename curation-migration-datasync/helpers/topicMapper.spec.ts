import { getTopicForReaditLaTmpDatabase } from './topicMapper';
import { expect } from 'chai';

describe('topics mapepr test', () => {
  it('should convert a valid topic from curatedCorpusApi to readitLaTmp topics', () => {
    const curatedCorpusTopic = 'HEALTH_FITNESS';
    expect(getTopicForReaditLaTmpDatabase(curatedCorpusTopic)).equals(
      'Health & Fitness'
    );
  });

  it('should convert a unknown topic to null', () => {
    const curatedCorpusTopic = 'unknown topic';
    expect(() => getTopicForReaditLaTmpDatabase(curatedCorpusTopic)).throw(
      'invalid topic mapping'
    );
  });

  it('null topic should return null for readitla-tmp database', () => {
    expect(() => getTopicForReaditLaTmpDatabase('')).throw(
      'topic cannot be null or empty'
    );
  });
});
