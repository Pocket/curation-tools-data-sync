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
  const d = scheduledDate.split('-');
  let date;
  switch (scheduledSurfaceGuid) {
    case ScheduledSurfaceGuid.NEW_TAB_EN_US:
      //add 7 hours to GMT timezone to make it 3am EST
      date = new Date(
        Date.UTC(parseInt(d[0]), parseInt(d[1]), parseInt(d[2]), 7, 0, 0)
      );
      break;
    case ScheduledSurfaceGuid.NEW_TAB_DE_DE:
      //add 1 hour to GMT timezone to make it 3am Berlin time
      date = new Date(
        Date.UTC(parseInt(d[0]), parseInt(d[1]), parseInt(d[2]), 1, 0, 0)
      );
      break;
    case ScheduledSurfaceGuid.NEW_TAB_EN_INTL:
      //set to previous day 930 pm GMT to make it 3am IST
      //todo: fix this is read in machine time, we need to convert it to UTC before subtracting
      date = new Date(scheduledDate).toUTCString();
      date.setUTCDate(date.getUTCDate() - 1);
      date.setUTCHours(21, 30);
    default:
      //other new tabs, set to 3am GMT
      date = new Date(
        Date.UTC(parseInt(d[0]), parseInt(d[1]), parseInt(d[2]), 3, 0, 0)
      );
  }
  return Math.round(date.getTime() / 1000);
}
