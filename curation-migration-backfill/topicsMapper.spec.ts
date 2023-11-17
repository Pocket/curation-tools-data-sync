import {
  getTopicForCuratedCorpusApi,
  getTopicForReaditLaTmpDatabase,
} from './topicsMapper';

describe('topics mapepr test', () => {
  it('should convert a valid topic from  readiila-tmp to curatedCorpusApi', () => {
    const readItLaTmpTopic = 'Health & Fitness';
    expect(getTopicForCuratedCorpusApi(readItLaTmpTopic)).toEqual(
      'HEALTH_FITNESS',
    );
  });

  it('should convert a unknown topic to null', () => {
    const readItLaTmpTopic = 'unknown topic';
    expect(getTopicForCuratedCorpusApi(readItLaTmpTopic)).toEqual(null);
  });

  it('null topic should return null for curatedCorpusApi', () => {
    expect(getTopicForCuratedCorpusApi(null)).toEqual(null);
  });

  it('should convert a valid topic from curatedCorpusApi to readitLaTmp topics', () => {
    const curatedCorpusTopic = 'HEALTH_FITNESS';
    expect(getTopicForReaditLaTmpDatabase(curatedCorpusTopic)).toEqual(
      'Health & Fitness',
    );
  });

  it('should convert a unknown topic to null', () => {
    const curatedCorpusTopic = 'unknown topic';
    expect(getTopicForReaditLaTmpDatabase(curatedCorpusTopic)).toEqual(null);
  });

  it('null topic should return null for readitla-tmp database', () => {
    expect(getTopicForReaditLaTmpDatabase(null)).toEqual(null);
  });
});
