//todo: share between two lambdas
// - need to make changes to circle CI packaging code
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

export function getTopicForReaditLaTmpDatabase(input: string | null) {
  if (!input || TopicMappedToReaditlaTmpDb[input] == undefined) {
    return null;
  }

  return TopicMappedToReaditlaTmpDb[input];
}
