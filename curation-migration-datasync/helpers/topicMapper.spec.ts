import { getTopicForReaditLaTmpDatabase } from './topicMapper';
import { expect } from 'chai';

describe('topics mapper test', () => {
  it('should convert a valid topic from curatedCorpusApi to readitLaTmp topics', () => {
    const curatedCorpusTopic = 'HEALTH_FITNESS';
    expect(getTopicForReaditLaTmpDatabase(curatedCorpusTopic)).equals(
      'Health & Fitness'
    );
  });

  it('should throw an error if the topic is not in the mapping', () => {
    const curatedCorpusTopic = 'unknown topic';
    expect(() => getTopicForReaditLaTmpDatabase(curatedCorpusTopic)).throw(
      'invalid topic mapping'
    );
  });

  it('should throw an error if a null topic is passed', () => {
    expect(() => getTopicForReaditLaTmpDatabase('')).throw(
      'topic cannot be null or empty'
    );
  });
});
