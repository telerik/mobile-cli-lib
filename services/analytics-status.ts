/**
 * Describes the status of the current Analytics status, i.e. has the user allowed to be tracked.
 */
const enum AnalyticsStatus {
	/**
	 * User has allowed to be tracked.
	 */
	enabled = "enabled",

	/**
	 * User has declined to be tracked.
	 */
	disabled = "disabled",

	/**
	 * User has not been asked to allow feature and error tracking.
	 */
	notConfirmed = "not confirmed"
}
