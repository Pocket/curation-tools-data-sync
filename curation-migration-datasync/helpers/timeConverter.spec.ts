import { getLocalTimeFromScheduledDate } from './timeConverter';
import { ScheduledSurfaceGuid } from '../dynamodb/types';

describe('time converter', function () {
  //for timestamp conversion: https://www.epochconverter.com/
  const testDate = '2022-06-29';
  //add 7 hrs to the given date
  const estTimestamp = 1656486000;
  //add one hour to the given date
  const berlinTimestamp = 1656464400;
  //subtract one day and set to 930 pm to the given date
  const istTimestamp = 1656451800;
  //add 3 hours to the given date
  const gmtTimestamp = 1656471600;

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
      ScheduledSurfaceGuid.NEW_TAB_EN_INTL
    );
    expect(timeStamp).toEqual(istTimestamp);
  });

  it('convert month start for NEW_TAB_EN_INTL', () => {
    const timeStamp = getLocalTimeFromScheduledDate(
      '2022-01-01',
      ScheduledSurfaceGuid.NEW_TAB_EN_INTL
    );
    //expected: Friday, December 31, 2021 9:30:00 PM
    expect(timeStamp).toEqual(1640986200);
  });

  it('convert given UTC date to GMT 3am local time for any other new tab', () => {
    const timeStamp = getLocalTimeFromScheduledDate(
      testDate,
      ScheduledSurfaceGuid.NEW_TAB_EN_GB
    );
    expect(timeStamp).toEqual(gmtTimestamp);
  });
});
