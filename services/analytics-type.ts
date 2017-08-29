/**
 * Describes the type of data sent to analytics service.
 */
const enum TrackingTypes {

	/**
	 * Defines that the data contains information for initialization of a new Analytics monitor.
	 */
	Initialization = "initialization",

	/**
	 * Defines that the data contains feature that should be tracked.
	 */
	Feature = "feature",

	/**
	 * Defines that the data contains exception that should be tracked.
	 */
	Exception = "exception",

	/**
	 * Defines that the data contains the answer of the question if user allows to be tracked.
	 */
	AcceptTrackFeatureUsage = "acceptTrackFeatureUsage",

	/**
	 * Defines that all information has been sent and no more data will be tracked in current session.
	 */
	Finish = "finish"
}
