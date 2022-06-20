import { getLocalTimeFromScheduledDate } from './timeConverter';
import { ScheduledSurfaceGuid } from './dynamodb/types';

describe('time converter', function () {
  const testDate = '2022-06-29';
  const istTimestamp = 1656451800; //'2022-06-28 00:21:30'; // subtract one day and set to 930 pm
  const berlinTimestamp = 1656464400; //'2022-06-29 00:01:00'; //add one hour
  const estTimestamp = 1656486000; //add 7 hrs to the given date
  const gmtTimestamp = 1656460980; //add 3 hours with given date

  it('convert given UTC date to EST 3am local time for NEW_TAB_EN_US', () => {
    const timeStamp = getLocalTimeFromScheduledDate(
      testDate,
      ScheduledSurfaceGuid.NEW_TAB_EN_US
    );
    expect(timeStamp).toEqual(estTimestamp);
  });

  it('convert given UTC date to Berlin 3am local time for NEW_TAB_DE_DE', () => {
    const timeStamp = getLocalTimeFromScheduledDate(
      testDate,
      ScheduledSurfaceGuid.NEW_TAB_DE_DE
    );
    expect(timeStamp).toEqual(berlinTimestamp);
  });

  it('convert given UTC date to IST 3am local time for NEW_TAB_EN_INTL', () => {
    const timeStamp = getLocalTimeFromScheduledDate(
      testDate,
      ScheduledSurfaceGuid.NEW_TAB_DE_DE
    );
    expect(timeStamp).toEqual(istTimestamp);
  });

  it('convert given UTC date to GMT 3am local time for any other new tab', () => {
    const timeStamp = getLocalTimeFromScheduledDate(
      testDate,
      ScheduledSurfaceGuid.NEW_TAB_EN_GB
    );
    expect(timeStamp).toEqual(gmtTimestamp);
  });
});
