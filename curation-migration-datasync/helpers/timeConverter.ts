import { ScheduledSurfaceGuid } from '../dynamodb/types';

/**
 * The given scheduled date is converted to 3am in their local time
 * for the corresponding NewTab, and then converted to unix epoch timestamp.
 *
 * For e.g scheduledDate `2022-06-01` is converted to:
 * istTimestamp translates to '2022-05-31 00:21:30'
 * i.e subtract one day and set to 930 pm to the given scheduledDate
 * berlinTimestamp translates to '2022-06-01 00:01:00' i.e add one hour to the given scheduledDate
 * ukTimestamp translates to '2022-06-01 00:03:00' i.e  add 3 hours to the given scheduledDate
 * estTimestamp translates to '2022-06-01 00:07:00' i.e add 7 hrs to the given scheduledDate
 *
 * @param scheduledDate from event payload in format YYYY-MM-DD
 * @param scheduledSurfaceGuid surfaceGuid associated with the scheduled date
 * @returns unix epoch timestamp
 */
export function getLocalTimeFromScheduledDate(
  scheduledDate: string,
  scheduledSurfaceGuid: ScheduledSurfaceGuid,
): number {
  let date;
  switch (scheduledSurfaceGuid) {
    case ScheduledSurfaceGuid.NEW_TAB_EN_US:
      //add 7 hours to GMT timezone to make it 3am EST
      date = getDate(scheduledDate, 7);
      break;

    case ScheduledSurfaceGuid.NEW_TAB_DE_DE:
      //add 1 hour to GMT timezone to make it 3am Berlin time
      date = getDate(scheduledDate, 1);
      break;

    case ScheduledSurfaceGuid.NEW_TAB_EN_INTL:
      //set to previous day 930 pm GMT to make it 3am IST
      date = getDate(scheduledDate, 21, 30);
      //get previous day
      date.setDate(date.getDate() - 1);
      break;

    default:
      //other new tabs, set to 3am GMT
      date = getDate(scheduledDate, 3);
  }
  return Math.round(date.getTime() / 1000);
}

/**
 * Function to generate Date object for given scheduledDate, hours, mins, secs
 * Date.UTC is required, otherwise date object takes machine time while manually setting hours
 * month offset starts from 0
 * @param scheduledDate
 * @param hours
 * @param mins
 * @param secs
 */
function getDate(scheduledDate: string, hours = 0, mins = 0, secs = 0): Date {
  const d = scheduledDate.split('-');
  return new Date(
    Date.UTC(
      parseInt(d[0]),
      parseInt(d[1]) - 1,
      parseInt(d[2]),
      hours,
      mins,
      secs,
    ),
  );
}
