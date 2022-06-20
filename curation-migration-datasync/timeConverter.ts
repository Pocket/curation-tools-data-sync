/**
 * The given scheduled date is converted to 3am in their local time
 * for the corresponding NewTab, and then converted to unix epoc timestamp.
 *
 * For e.g scheduledDate `2022-06-01` is converted to:
 * istTimestamp = '2022-05-31 00:21:30'; // subtract one day and set to 930 pm
 * berlinTime = '2022-06-01 00:01:00'; //add one hour
 * ukTime = '2022-06-01 00:03:00'; // add 3 hours with date
 * estTime = '2022-06-01 00:07:00'; //add 7 hrs with date
 */

import { ScheduledSurfaceGuid } from './dynamodb/types';

export function getLocalTimeFromScheduledDate(
  scheduledDate: string,
  scheduledSurfaceGuid: ScheduledSurfaceGuid
): number {
  const date = new Date(scheduledDate);
  switch (scheduledSurfaceGuid) {
    case ScheduledSurfaceGuid.NEW_TAB_EN_US:
      date.setHours(7);
      break;
    case ScheduledSurfaceGuid.NEW_TAB_DE_DE:
      date.setHours(1);
      break;
    case ScheduledSurfaceGuid.NEW_TAB_EN_INTL:
      date.setDate(date.getDate() - 5);
      date.setHours(21, 30);
      break;
    default:
      date.setDate(3);
  }
  return Math.round(date.getTime() / 1000);
}
