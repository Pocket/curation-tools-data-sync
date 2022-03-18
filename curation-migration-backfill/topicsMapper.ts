//todo: this function can be shared between `curation-migration-backfill`
//and `curation-migration-datasync`, similar to other common modules like dynamo db
//this requires changes to our CI packaging
enum TopicMappedToReaditlaTmpDb {
  BUSINESS = 'Business',
  CAREER = 'Career',
  EDUCATION = 'Education',
  ENTERTAINMENT = 'Entertainment',
  FOOD = 'Food',
  GAMING = 'Gaming',
  HEALTH_FITNESS = 'Health & Fitness',
  PARENTING = 'Parenting',
  PERSONAL_FINANCE = 'Personal Finance',
  POLITICS = 'Politics',
  SCIENCE = 'Science',
  SELF_IMPROVEMENT = 'Self Improvement',
  SPORTS = 'Sports',
  TECHNOLOGY = 'Technology',
  TRAVEL = 'Travel',
}

const TopicMappedToCuratedCorpusApi = new Map<
  string,
  TopicMappedToReaditlaTmpDb
>();

Object.keys(TopicMappedToReaditlaTmpDb).forEach(
  (topic: TopicMappedToReaditlaTmpDb) => {
    const topicValue: string = TopicMappedToReaditlaTmpDb[<any>topic];
    TopicMappedToCuratedCorpusApi.set(topicValue, topic);
  }
);

export function getTopicForCuratedCorpusApi(input: string) {
  const topicForCuratedCorpusApi = TopicMappedToCuratedCorpusApi.get(input);
  return topicForCuratedCorpusApi ? topicForCuratedCorpusApi : null;
}

export function getTopicForReaditLaTmpDatabase(input: string) {
  if (TopicMappedToReaditlaTmpDb[input] == undefined) {
    return null;
  }

  return TopicMappedToReaditlaTmpDb[input];
}
