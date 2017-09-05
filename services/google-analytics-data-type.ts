
/**
 * Describes the types of data that can be send to Google Analytics.
 * Their values are the names of the methods in universnal-analytics that have to be called to track this type of data.
 * Also known as Hit Type: https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#t
 */
const enum GoogleAnalyticsDataType {
	Page = "pageview",
	Event = "event"
}
